import type { Repositories } from '@irc/db';
import type { Agent } from '@irc/db';
import type { IngestResult } from './task-events.js';
import { QA_AGENT } from './qa-agent.js';
import { startNextQueuedTaskForAgent } from './task-queue.js';

export interface QaLifecycleServices {
  ingested: IngestResult;
  repos: Repositories;
  supervisor: {
    spawn(agent: Pick<Agent, 'id' | 'nick' | 'role' | 'context'>, channels: string[], greetChannel?: string): unknown;
    assignTaskChannel(nick: string, task: { id: string; title: string; channel: string }): boolean;
  };
  irc: { privmsg(target: string, text: string): void };
}

export function handleQaLifecycle(services: QaLifecycleServices): void {
  switch (services.ingested.eventType) {
    case 'rdt':
      handoffToQa(services);
      return;
    case 'pass':
      announcePass(services);
      return;
    case 'not.pass':
      loopToImplementer(services);
      return;
  }
}

function handoffToQa({ ingested, repos, supervisor, irc }: QaLifecycleServices): void {
  const task = repos.tasks.findTask(ingested.taskId);
  if (!task) return;
  if (task.assignedTo === QA_AGENT.id) return;
  if (task.status === 'done' || latestActor(repos, task.id, 'rdt') === QA_AGENT.nick) return;
  const qa = repos.agents.findAgent(QA_AGENT.id);
  if (!qa) {
    repos.tasks.updateStatus(task.id, 'rdt');
    irc.privmsg(task.channel, `${task.id} is ready to test, but QA agent is missing.`);
    return;
  }
  supervisor.spawn(qa, ['#agents', task.channel], task.channel);
  repos.tasks.assignTask(task.id, qa.id, 'testing');
  supervisor.assignTaskChannel(qa.nick, {
    id: task.id,
    channel: task.channel,
    title: qaPrompt(task.title, implementationResult(repos, task.id)),
  });
}

function announcePass({ ingested, repos, supervisor, irc }: QaLifecycleServices): void {
  const task = repos.tasks.findTask(ingested.taskId);
  if (!task) return;
  repos.tasks.updateStatus(task.id, 'done');
  irc.privmsg(task.channel, `${task.id} passed QA; final answer is ready.`);
  startNextQueuedTask({ taskId: task.id, repos, supervisor });
}

function loopToImplementer({ ingested, repos, supervisor, irc }: QaLifecycleServices): void {
  const task = repos.tasks.findTask(ingested.taskId);
  if (!task) return;
  const implementer = findImplementer(repos, task.id);
  if (!implementer) {
    irc.privmsg(task.channel, `${task.id} did not pass QA; no implementer found to resume.`);
    return;
  }
  const feedback = latestContent(repos, task.id, ['not.pass']);
  const result = implementationResult(repos, task.id);
  repos.tasks.assignTask(task.id, implementer.id, 'ready');
  repos.taskEvents.recordEvent({
    taskId: task.id,
    actor: 'orchestrator',
    eventType: 'assign',
    content: `assigned to ${implementer.nick} after QA not.pass`,
  });
  supervisor.assignTaskChannel(implementer.nick, {
    id: task.id,
    channel: task.channel,
    title: `${task.title}\nPrevious result: ${result}\nQA feedback: ${feedback}\nFix the QA feedback and return result plus rdt again.`,
  });
}

function startNextQueuedTask(input: Pick<QaLifecycleServices, 'repos' | 'supervisor'> & { taskId: string }): void {
  const { taskId, repos, supervisor } = input;
  const implementer = findImplementer(repos, taskId);
  if (!implementer) return;
  startNextQueuedTaskForAgent({ repos, supervisor, agent: implementer });
}

function qaPrompt(title: string, result: string): string {
  return [
    `QA validate the initial request: ${title}`,
    `Implementation result/context: ${result}`,
    'Report [type:testing], [type:tested], then exactly one final [type:pass] or [type:not.pass].',
    'Do not report [type:result] or [type:rdt] from QA.',
    'If not passing, [type:not.pass] must say exactly what needs to change before retry.',
  ].join('\n');
}

function latestContent(repos: Repositories, taskId: string, types: string[]): string {
  return repos.taskEvents
    .listEvents(taskId)
    .filter((event) => types.includes(event.eventType))
    .at(-1)?.content ?? '';
}

function implementationResult(repos: Repositories, taskId: string): string {
  return latestContent(repos, taskId, ['result']) || latestContent(repos, taskId, ['rdt']);
}

function latestActor(repos: Repositories, taskId: string, type: string): string {
  return repos.taskEvents
    .listEvents(taskId)
    .filter((event) => event.eventType === type)
    .at(-1)?.actor ?? '';
}

function findImplementer(repos: Repositories, taskId: string) {
  const actors = repos.taskEvents.listEvents(taskId).map((event) => event.actor).reverse();
  return repos.agents.listAgents().find((agent) => {
    if (agent.role.toLowerCase() === 'qa' || agent.id.toLowerCase() === 'qa') return false;
    return actors.some((actor) => actor.toLowerCase() === agent.nick.toLowerCase());
  }) ?? repos.agents.listAgents().find((agent) => agent.role.toLowerCase() !== 'qa');
}
