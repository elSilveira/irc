import type { Repositories } from '@irc/db';
import type { CommandServices } from './commands.js';
import { startNextQueuedTaskForAgent } from './task-queue.js';

const TASK_COMMANDS = new Set(['logs', 'approvals', 'approve', 'deny', 'assign', 'review', 'sign', 'summarize']);

export function isTaskCommand(name: string): boolean {
  return TASK_COMMANDS.has(name);
}

export function handleTaskCommand(command: { name: string; args: string[] }, services: CommandServices): string {
  switch (command.name) {
    case 'logs':
      return command.args[0] ? formatTaskLog(services.repos, command.args[0]) : 'Usage: @orc logs <TASK-0001>';
    case 'approvals':
      return formatPendingApprovals(services.repos);
    case 'approve':
    case 'deny': {
      const id = command.args[0];
      if (!id) return `Usage: @orc ${command.name} <TASK-0001>`;
      return resolveApproval(services.repos, id, command.name === 'approve');
    }
    case 'assign': {
      const [id, agent] = command.args;
      if (!id || !agent) return 'Usage: @orc assign <TASK-0001> <agent-nick>';
      return assignTask(services, id, agent);
    }
    case 'review': {
      const id = command.args[0];
      if (!id) return 'Usage: @orc review <TASK-0001>';
      return requestReview(services.repos, id);
    }
    case 'sign': {
      const id = command.args[0];
      if (!id) return 'Usage: @orc sign <TASK-0001>';
      return signTask(services, id);
    }
    case 'summarize': {
      const id = command.args[0];
      if (!id) return 'Usage: @orc summarize <TASK-0001>';
      return summarizeTask(services.repos, id);
    }
    default:
      return '';
  }
}

function formatTaskLog(repos: Repositories, id: string): string {
  const task = repos.tasks.findTask(id);
  if (!task) return `No task ${id}.`;
  const events = repos.taskEvents.listEvents(id);
  if (events.length === 0) return `${id} ${task.title} (${task.status}): no events yet.`;
  const timeline = events
    .map((event) => `${event.eventType}@${event.actor}: ${truncate(event.content, 60)}`)
    .join(' | ');
  return `${id} (${task.status}): ${timeline}`;
}

function formatPendingApprovals(repos: Repositories): string {
  const pending = repos.approvals.listPending();
  if (pending.length === 0) return 'No pending approvals.';
  return pending
    .map((approval) => `${approval.id} ${approval.taskId} ${approval.action} (by ${approval.requestedBy})`)
    .join(' | ');
}

function resolveApproval(repos: Repositories, taskId: string, approved: boolean): string {
  const pending = repos.approvals.findPendingForTask(taskId);
  if (!pending) return `No pending approval for ${taskId}.`;

  repos.approvals.resolve(pending.id, approved ? 'approved' : 'denied');
  const nextStatus = approved ? 'doing' : 'cancelled';
  repos.tasks.updateStatus(taskId, nextStatus);
  repos.taskEvents.recordEvent({
    taskId,
    actor: 'orchestrator',
    eventType: approved ? 'review.result' : 'failed',
    content: approved ? 'approved; resuming' : 'denied; cancelled',
  });
  return approved
    ? `${taskId} approved (${pending.id}); status ${nextStatus}.`
    : `${taskId} denied (${pending.id}); status ${nextStatus}.`;
}

function assignTask(services: CommandServices, taskId: string, agent: string): string {
  const task = services.repos.tasks.findTask(taskId);
  if (!task) return `No task ${taskId}.`;

  services.repos.tasks.assignTask(taskId, agent);
  services.repos.taskEvents.recordEvent({
    taskId,
    actor: 'orchestrator',
    eventType: 'assign',
    content: `assigned to ${agent}`,
  });
  const started = services.agentSupervisor?.assignTaskChannel?.(agent, task) ?? false;
  if (!started) {
    services.irc.privmsg(
      agent,
      `You are assigned ${taskId} (${task.title}) in ${task.channel}. Reply with [task:${taskId}] [type:ack] to start.`,
    );
  }
  return `${taskId} assigned to ${agent}; status ready.`;
}

function requestReview(repos: Repositories, taskId: string): string {
  const task = repos.tasks.findTask(taskId);
  if (!task) return `No task ${taskId}.`;

  repos.tasks.updateStatus(taskId, 'review');
  repos.taskEvents.recordEvent({
    taskId,
    actor: 'orchestrator',
    eventType: 'review.request',
    content: 'moved to review',
  });
  return `${taskId} moved to review.`;
}

function signTask(services: CommandServices, rawTaskId: string): string {
  const taskId = rawTaskId.toUpperCase();
  const task = services.repos.tasks.findTask(taskId);
  if (!task) return `No task ${taskId}.`;

  services.repos.tasks.updateStatus(taskId, 'done');
  services.repos.taskEvents.recordEvent({
    taskId,
    actor: 'orchestrator',
    eventType: 'done',
    content: 'signed off',
  });
  const agent = task.assignedTo ? services.repos.agents.findAgent(task.assignedTo) : null;
  const assignTaskChannel = services.agentSupervisor?.assignTaskChannel;
  const next = agent && assignTaskChannel
    ? startNextQueuedTaskForAgent({ repos: services.repos, supervisor: { assignTaskChannel }, agent })
    : null;
  return next
    ? `${taskId} signed off; status done; started ${next.id}.`
    : `${taskId} signed off; status done.`;
}

function summarizeTask(repos: Repositories, taskId: string): string {
  const task = repos.tasks.findTask(taskId);
  if (!task) return `No task ${taskId}.`;

  const events = repos.taskEvents.listEvents(taskId);
  const counts = countBy(events.map((event) => event.eventType));
  const timeline = Object.entries(counts)
    .map(([type, count]) => `${type}(${count})`)
    .join(' ');
  const assignee = task.assignedTo ?? 'unassigned';
  const summary = `${taskId} "${truncate(task.title, 50)}": status=${task.status} assigned=${assignee}.`;
  return events.length === 0 ? `${summary} No events yet.` : `${summary} Events: ${timeline}.`;
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function truncate(value: string, size: number): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > size ? `${flat.slice(0, size)}…` : flat;
}
