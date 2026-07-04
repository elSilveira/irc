import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentSupervisor,
  type AgentSummary,
  type AgentHandle,
  type BotFactory,
} from './supervisor.js';
import type { AgentBotOptions } from './agent-bot.js';

interface FakeBot extends AgentHandle {
  nick: string;
  started: number;
  stopped: number;
  assigned: string[];
}

function makeFakeFactory(): { factory: BotFactory; bots: Map<string, FakeBot> } {
  const bots = new Map<string, FakeBot>();
  const factory: BotFactory = (options: AgentBotOptions): FakeBot => {
    const bot: FakeBot = {
      nick: options.agent.nick,
      started: 0,
      stopped: 0,
      assigned: [],
      start() {
        this.started += 1;
      },
      stop() {
        this.stopped += 1;
      },
      assignTaskChannel(task) {
        this.assigned.push(task.channel);
      },
    };
    bots.set(bot.nick.toLowerCase(), bot);
    return bot;
  };
  return { factory, bots };
}

function makeSupervisor(factory: BotFactory, reservedNicks?: string[]): AgentSupervisor {
  return new AgentSupervisor({
    host: 'irc.example',
    port: 6667,
    codex: {} as never,
    conversations: {} as never,
    gateway: {} as never,
    workspace: '/tmp/ws',
    reservedNicks,
    createBot: factory,
  });
}

function agent(id: string, nick = id): AgentSummary {
  return { id, nick, role: 'worker', context: 'does work' };
}

test('spawn starts a bot once and is idempotent', () => {
  const { factory, bots } = makeFakeFactory();
  const supervisor = makeSupervisor(factory);

  const first = supervisor.spawn(agent('alpha'), ['#control']) as FakeBot | null;
  const second = supervisor.spawn(agent('alpha'), ['#control']);

  assert.ok(first);
  assert.equal(second, first, 'second spawn returns the same handle');
  assert.equal(bots.size, 1);
  assert.equal(first!.started, 1, 'start called exactly once');
  assert.ok(supervisor.isRunning('alpha'));
});

test('spawn refuses reserved nicks', () => {
  const { factory } = makeFakeFactory();
  const supervisor = makeSupervisor(factory, ['orchestrator']);

  const result = supervisor.spawn(agent('orchestrator'), ['#control']);

  assert.equal(result, null);
  assert.equal(supervisor.isRunning('orchestrator'), false);
});

test('stop disconnects and removes a running bot', () => {
  const { factory, bots } = makeFakeFactory();
  const supervisor = makeSupervisor(factory);
  supervisor.spawn(agent('alpha'), ['#control']);

  const stopped = supervisor.stop('alpha');

  assert.equal(stopped, true);
  assert.equal(bots.get('alpha')!.stopped, 1, 'bot.stop called');
  assert.equal(supervisor.isRunning('alpha'), false);
});

test('stop returns false for an unknown nick', () => {
  const { factory } = makeFakeFactory();
  const supervisor = makeSupervisor(factory);
  assert.equal(supervisor.stop('ghost'), false);
});

test('reconcile starts desired agents that are not yet running', () => {
  const { factory } = makeFakeFactory();
  const supervisor = makeSupervisor(factory);

  const result = supervisor.reconcile([agent('alpha'), agent('beta')], ['#agents']);

  assert.deepEqual(result.started.sort(), ['alpha', 'beta']);
  assert.deepEqual(result.stopped, []);
  assert.equal(result.unchanged, 0);
});

test('reconcile stops running agents missing from the desired set', () => {
  const { factory, bots } = makeFakeFactory();
  const supervisor = makeSupervisor(factory);
  supervisor.spawn(agent('alpha'), ['#agents']);
  supervisor.spawn(agent('beta'), ['#agents']);

  const result = supervisor.reconcile([agent('alpha')], ['#agents']);

  assert.deepEqual(result.started, []);
  assert.deepEqual(result.stopped, ['beta']);
  assert.equal(result.unchanged, 1);
  assert.equal(bots.get('beta')!.stopped, 1, 'deleted bot was stopped');
  assert.equal(supervisor.isRunning('beta'), false);
  assert.ok(supervisor.isRunning('alpha'), 'kept agent still running');
});

test('reconcile is idempotent for an unchanged set', () => {
  const { factory, bots } = makeFakeFactory();
  const supervisor = makeSupervisor(factory);
  supervisor.reconcile([agent('alpha'), agent('beta')], ['#agents']);

  const result = supervisor.reconcile([agent('alpha'), agent('beta')], ['#agents']);

  assert.deepEqual(result.started, []);
  assert.deepEqual(result.stopped, []);
  assert.equal(result.unchanged, 2);
  assert.equal(bots.get('alpha')!.started, 1, 'no duplicate start');
  assert.equal(bots.get('beta')!.started, 1);
});

test('reconcile handles mixed create and delete in one pass', () => {
  const { factory } = makeFakeFactory();
  const supervisor = makeSupervisor(factory);
  supervisor.reconcile([agent('alpha'), agent('beta')], ['#agents']);

  const result = supervisor.reconcile([agent('beta'), agent('gamma')], ['#agents']);

  assert.deepEqual(result.started, ['gamma']);
  assert.deepEqual(result.stopped, ['alpha']);
  assert.equal(result.unchanged, 1);
  assert.deepEqual(supervisor.runningNicks().sort(), ['beta', 'gamma']);
});

test('reconcile with an empty list stops everything', () => {
  const { factory } = makeFakeFactory();
  const supervisor = makeSupervisor(factory);
  supervisor.reconcile([agent('alpha'), agent('beta')], ['#agents']);

  const result = supervisor.reconcile([], ['#agents']);

  assert.deepEqual(result.started, []);
  assert.deepEqual(result.stopped.sort(), ['alpha', 'beta']);
  assert.equal(supervisor.runningNicks().length, 0);
});

test('reconcile skips reserved nicks even when present in the desired set', () => {
  const { factory } = makeFakeFactory();
  const supervisor = makeSupervisor(factory, ['orchestrator']);

  const result = supervisor.reconcile([agent('orchestrator'), agent('alpha')], ['#agents']);

  assert.deepEqual(result.started, ['alpha']);
  assert.equal(supervisor.isRunning('orchestrator'), false);
});
