import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '@irc/db';
import { handleCommand, type CommandServices } from './commands.js';
import type { IrcClient } from './irc.js';

interface Captured {
  services: CommandServices;
  sent: { target: string; text: string }[];
  joined: string[];
  assignedChannels: string[];
}

function setup(): Captured {
  const sent: { target: string; text: string }[] = [];
  const joined: string[] = [];
  const assignedChannels: string[] = [];
  const irc = {
    privmsg: (target: string, text: string) => sent.push({ target, text }),
    join: (channel: string) => joined.push(channel),
    send: () => {},
  } as unknown as IrcClient;
  const services: CommandServices = {
    irc,
    repos: createRepositories(':memory:'),
    nick: 'orchestrator',
    channels: ['#control'],
    agentSupervisor: {
      assignTaskChannel: (nick, task) => {
        assignedChannels.push(`${nick}:${task.id}:${task.channel}`);
        return true;
      },
    },
  };
  return { services, sent, joined, assignedChannels };
}

function replies(c: Captured): string[] {
  return c.sent.filter((entry) => entry.target === '#control').map((entry) => entry.text);
}

test('new creates a task, joins its channel, and replies', () => {
  const c = setup();
  const result = handleCommand({ name: 'new', args: ['Ship heartbeat policy'] }, c.services);

  assert.equal(result.handled, true);
  assert.deepEqual(c.joined, ['#task-0001']);
  assert.match(replies(c)[0] ?? '', /Created TASK-0001 in #task-0001\./);
});

test('new auto-assigns the best free agent', () => {
  const c = setup();
  c.services.repos.agents.createAgent({
    id: 'docs-agent',
    nick: 'DocsAgent',
    role: 'docs',
    context: 'writes docs',
    strengths: 'readme,documentation',
  });

  handleCommand({ name: 'new', args: ['Update README documentation'] }, c.services);

  assert.equal(c.services.repos.tasks.findTask('TASK-0001')?.assignedTo, 'docs-agent');
  assert.equal(c.services.repos.tasks.findTask('TASK-0001')?.status, 'ready');
  assert.match(replies(c).at(-1) ?? '', /assigned docs-agent/);
  assert.equal(c.sent.some((entry) => entry.target === 'DocsAgent'), false);
  assert.deepEqual(c.assignedChannels, ['DocsAgent:TASK-0001:#task-0001']);
});

test('new ensures dedicated QA before assigning implementer work', () => {
  const c = setup();
  c.services.repos.agents.createAgent({
    id: 'feature-agent',
    nick: 'FeatureAgent',
    role: 'feature',
    context: 'implements features',
    strengths: 'feature',
  });

  handleCommand({ name: 'new', args: ['Build feature'] }, c.services);

  assert.equal(c.services.repos.agents.findAgent('qa')?.nick, 'QA');
  assert.equal(c.sent.some((entry) => entry.target === 'codex-agent' && /create.*QA/i.test(entry.text)), true);
  assert.equal(c.services.repos.tasks.findTask('TASK-0001')?.assignedTo, 'feature-agent');
  assert.deepEqual(c.assignedChannels, ['FeatureAgent:TASK-0001:#task-0001']);
});

test('new queues for the best busy agent', () => {
  const c = setup();
  c.services.repos.agents.createAgent({
    id: 'feature-agent',
    nick: 'FeatureAgent',
    role: 'feature',
    context: 'implements TypeScript',
    strengths: 'typescript,tests',
    capacity: 1,
  });
  const busy = c.services.repos.tasks.createTask('Existing work');
  c.services.repos.tasks.assignTask(busy.id, 'feature-agent', 'doing');

  handleCommand({ name: 'new', args: ['Fix TypeScript tests'] }, c.services);

  assert.equal(c.services.repos.tasks.findTask('TASK-0002')?.assignedTo, 'feature-agent');
  assert.equal(c.services.repos.tasks.findTask('TASK-0002')?.status, 'queued');
  assert.match(replies(c).at(-1) ?? '', /queued for feature-agent/);
});

test('command errors are reported without throwing', () => {
  const c = setup();
  c.services.repos.tasks.createTask = () => {
    throw new Error('database is locked');
  };

  const result = handleCommand({ name: 'new', args: ['Locked task'] }, c.services);

  assert.equal(result.handled, true);
  assert.match(replies(c).at(-1) ?? '', /ERR new failed: database is locked/);
});

test('assign sets the assignee, records an event, and DMs the agent', () => {
  const c = setup();
  handleCommand({ name: 'new', args: ['Do thing'] }, c.services);
  const result = handleCommand({ name: 'assign', args: ['TASK-0001', 'worker'] }, c.services);

  assert.equal(result.handled, true);
  assert.match(replies(c).at(-1) ?? '', /TASK-0001 assigned to worker; status ready\./);
  assert.equal(c.services.repos.tasks.findTask('TASK-0001')?.assignedTo, 'worker');
  assert.equal(c.services.repos.tasks.findTask('TASK-0001')?.status, 'ready');

  const dm = c.sent.find((entry) => entry.target === 'worker');
  assert.match(dm?.text ?? '', /You are assigned TASK-0001/);
  assert.equal(c.services.repos.taskEvents.listEvents('TASK-0001').length, 1);
});

test('summarize reports status, assignee, and event counts', () => {
  const c = setup();
  handleCommand({ name: 'new', args: ['Summarize me'] }, c.services);
  handleCommand({ name: 'assign', args: ['TASK-0001', 'worker'] }, c.services);
  c.services.repos.taskEvents.recordEvent({ taskId: 'TASK-0001', actor: 'worker', eventType: 'ack', content: 'ok' });
  c.services.repos.taskEvents.recordEvent({ taskId: 'TASK-0001', actor: 'worker', eventType: 'wip', content: 'x' });
  c.services.repos.taskEvents.recordEvent({ taskId: 'TASK-0001', actor: 'worker', eventType: 'wip', content: 'y' });

  handleCommand({ name: 'summarize', args: ['TASK-0001'] }, c.services);
  const summary = replies(c).at(-1) ?? '';
  assert.match(summary, /status=ready assigned=worker/);
  assert.match(summary, /assign\(1\)/);
  assert.match(summary, /ack\(1\)/);
  assert.match(summary, /wip\(2\)/);
});

test('logs shows the event timeline', () => {
  const c = setup();
  handleCommand({ name: 'new', args: ['Log me'] }, c.services);
  c.services.repos.taskEvents.recordEvent({ taskId: 'TASK-0001', actor: 'worker', eventType: 'ack', content: 'hi' });

  handleCommand({ name: 'logs', args: ['TASK-0001'] }, c.services);
  assert.match(replies(c).at(-1) ?? '', /ack@worker: hi/);
});

test('review moves a task into review', () => {
  const c = setup();
  handleCommand({ name: 'new', args: ['Review me'] }, c.services);

  handleCommand({ name: 'review', args: ['TASK-0001'] }, c.services);
  assert.equal(c.services.repos.tasks.findTask('TASK-0001')?.status, 'review');
  assert.match(replies(c).at(-1) ?? '', /TASK-0001 moved to review\./);
});

test('approve resolves a pending approval and resumes the task', () => {
  const c = setup();
  handleCommand({ name: 'new', args: ['Approve me'] }, c.services);
  c.services.repos.approvals.requestApproval({ taskId: 'TASK-0001', requestedBy: 'worker', action: 'resume' });
  c.services.repos.tasks.updateStatus('TASK-0001', 'blocked');

  handleCommand({ name: 'approve', args: ['TASK-0001'] }, c.services);

  assert.equal(c.services.repos.tasks.findTask('TASK-0001')?.status, 'doing');
  assert.equal(c.services.repos.approvals.listPending().length, 0);
  assert.match(replies(c).at(-1) ?? '', /TASK-0001 approved/);
});

test('unknown commands are not handled', () => {
  const c = setup();
  assert.equal(handleCommand({ name: 'nope', args: [] }, c.services).handled, false);
});
