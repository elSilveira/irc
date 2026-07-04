import type { Repositories } from '@irc/db';
import type { IrcClient } from './irc.js';
import { isTaskCommand, handleTaskCommand } from './task-commands.js';
import { chooseAgentForTask } from './agent-routing.js';
import { ensureQaAgent, isQaAgent } from './qa-agent.js';

export interface CommandServices {
  irc: IrcClient;
  repos: Repositories;
  nick: string;
  channels: string[];
  agentSupervisor?: {
    assignTaskChannel(nick: string, task: { id: string; title: string; channel: string }): boolean;
  };
}

export interface CommandResult {
  handled: boolean;
  /** Optional prompt to forward to the brain instead of a fixed reply. */
  prompt?: string;
}

export function handleCommand(command: { name: string; args: string[] }, services: CommandServices): CommandResult {
  try {
    if (isTaskCommand(command.name)) {
      reply(services, handleTaskCommand(command, services));
      return { handled: true };
    }

    switch (command.name) {
      case 'help':
        reply(services, helpLines().join(' | '));
        return { handled: true };
      case 'agents':
        reply(services, formatAgents(services.repos));
        return { handled: true };
      case 'status':
      case 'tasks':
        reply(services, formatTasks(services.repos));
        return { handled: true };
      case 'new': {
        const title = command.args.join(' ');
        if (!title) {
          reply(services, 'Usage: @orc new "task title"');
          return { handled: true };
        }
        const task = services.repos.tasks.createTask(title);
        services.irc.join(task.channel);
        const hadQa = services.repos.agents.findAgent('qa') !== null;
        ensureQaAgent(services.repos);
        if (!hadQa) requestQaAgent(services);
        const routed = chooseAgentForTask({
          title,
          agents: services.repos.agents.listAgents().filter((agent) => !isQaAgent(agent)),
          tasks: services.repos.tasks.listTasks(),
        });
        if (!routed) {
          reply(services, `Created ${task.id} in ${task.channel}. No agents registered.`);
          return { handled: true };
        }
        services.repos.tasks.assignTask(task.id, routed.agent.id, routed.status);
        if (routed.status === 'ready') {
          services.agentSupervisor?.assignTaskChannel(routed.agent.nick, task);
          reply(services, `Created ${task.id} in ${task.channel}; assigned ${routed.agent.id}.`);
        } else {
          reply(services, `Created ${task.id} in ${task.channel}; queued for ${routed.agent.id}.`);
        }
        return { handled: true };
      }
      default:
        return { handled: false };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reply(services, `ERR ${command.name} failed: ${message}`);
    return { handled: true };
  }
}

function helpLines(): string[] {
  return [
    '@orc help',
    '@orc agents - list registered agents',
    '@orc tasks - list tasks',
    '@orc new "title" - create a task channel',
    '@orc logs <TASK-0001> - show a task event timeline',
    '@orc approvals - list pending approvals',
    '@orc approve|deny <TASK-0001> - resolve a blocked task',
    '@orc assign <TASK-0001> <agent> - assign a task and notify the agent',
    '@orc review <TASK-0001> - move a task into review',
    '@orc summarize <TASK-0001> - task overview with event counts',
    '@orchestrator <question> - ask me to use tools (read files, git, manage agents)',
    'or DM me directly',
  ];
}

function formatAgents(repos: Repositories): string {
  const agents = repos.agents.listAgents();
  if (agents.length === 0) return 'No agents registered. Ask me to create one.';
  return `Agents: ${agents.map((agent) => agent.id).join(', ')}`;
}

function formatTasks(repos: Repositories): string {
  const tasks = repos.tasks.listTasks();
  if (tasks.length === 0) return 'No tasks yet. Use @orc new "title".';
  return tasks.map((task) => `${task.id} ${task.title} (${task.status})`).join(' | ');
}

function reply(services: CommandServices, text: string): void {
  services.irc.privmsg(services.channels[0] ?? '#control', text);
}

function requestQaAgent(services: CommandServices): void {
  services.irc.privmsg('codex-agent', 'Please create managed QA agent `qa` nick `QA` for task validation.');
}

function notifyAgent(
  services: CommandServices,
  nick: string,
  taskId: string,
  title: string,
  channel: string,
): void {
  services.irc.privmsg(
    nick,
    `You are assigned ${taskId} (${title}) in ${channel}. Reply [task:${taskId}] [type:ack].`,
  );
}
