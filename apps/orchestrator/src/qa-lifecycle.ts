import type { Repositories } from '@irc/db';
import type { IngestResult } from './task-events.js';

const QA_AGENT = {
  id: 'qa',
  nick: 'QA',
  role: 'qa',
  context: 'Validates task results against the initial request before final answer.',
  strengths: 'qa,testing,validation,review,regression,acceptance',
  weaknesses: '',
  capacity: 1,
};

export interface QaLifecycleServices {
  ingested: IngestResult;
  repos: Repositories;
  supervisor: {
    spawn(agent: typeof QA_AGENT, channels: string[], greetChannel?: string): unknown;
    assignTaskChannel(nick: string, task: { id: string; title: string; channel: string }): boolean;
  };
  irc: { privmsg(target: string, text: string): void };
}

export function handleQaLifecycle(services: QaLifecycleServices): void {
  switch (services.ingested.eventType) {
    case 'result':
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

function handoffToQa({ ingested, repos, supervisor }: QaLifecycleServices): void {
  const task = repos.tasks.findTask(ingested.taskId);
  if (!task) return;
  const qa = ensureQaAgent(repos);
  supervisor.spawn(qa, ['#agents', task.channel], task.channel);
  repos.tasks.assignTask(task.id, qa.id, 'testing');
  supervisor.assignTaskChannel(qa.nick, {
    id: task.id,
    channel: task.channel,
    title: qaPrompt(task.title, latestContent(repos, task.id, ['result', 'rdt'])),
  });
}

function announcePass({ ingested, repos, irc }: QaLifecycleServices): void {
  const task = repos.tasks.findTask(ingested.taskId);
  if (!task) return;
  repos.tasks.updateStatus(task.id, 'done');
  irc.privmsg(task.channel, `${task.id} passed QA; final answer is ready.`);
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
  repos.tasks.assignTask(task.id, implementer.id, 'ready');
  supervisor.assignTaskChannel(implementer.nick, {
    id: task.id,
    channel: task.channel,
    title: `${task.title}\nQA feedback: ${feedback}`,
  });
}

function ensureQaAgent(repos: Repositories): typeof QA_AGENT {
  return repos.agents.findAgent(QA_AGENT.id) ?? repos.agents.createAgent(QA_AGENT);
}

function qaPrompt(title: string, result: string): string {
  return [
    `QA validate the initial request: ${title}`,
    `Implementation result/context: ${result}`,
    'Report [type:testing], [type:tested], then [type:pass] or [type:not.pass].',
  ].join('\n');
}

function latestContent(repos: Repositories, taskId: string, types: string[]): string {
  return repos.taskEvents
    .listEvents(taskId)
    .filter((event) => types.includes(event.eventType))
    .at(-1)?.content ?? '';
}

function findImplementer(repos: Repositories, taskId: string) {
  const actors = repos.taskEvents.listEvents(taskId).map((event) => event.actor).reverse();
  return repos.agents.listAgents().find((agent) => {
    if (agent.role.toLowerCase() === 'qa' || agent.id.toLowerCase() === 'qa') return false;
    return actors.some((actor) => actor.toLowerCase() === agent.nick.toLowerCase());
  }) ?? repos.agents.listAgents().find((agent) => agent.role.toLowerCase() !== 'qa');
}
