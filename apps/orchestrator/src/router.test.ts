import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isManagedAgentDirectMessage, routeOrchestratorMessage } from './router.js';

test('routes a direct message as chat', () => {
  const routed = routeOrchestratorMessage({
    botNick: 'orchestrator',
    sender: 'eduardo',
    target: 'orchestrator',
    text: 'list the agents',
  });
  assert.equal(routed.kind, 'chat');
  assert.equal(routed.replyTarget, 'eduardo');
  assert.equal(routed.prompt, 'list the agents');
});

test('routes @orchestrator mention as chat', () => {
  const routed = routeOrchestratorMessage({
    botNick: 'orchestrator',
    sender: 'eduardo',
    target: '#control',
    text: '@orchestrator read package.json',
  });
  assert.equal(routed.kind, 'chat');
  assert.equal(routed.prompt, 'read package.json');
  assert.equal(routed.replyTarget, '#control');
});

test('routes deterministic @orc commands', () => {
  const routed = routeOrchestratorMessage({
    botNick: 'orchestrator',
    sender: 'eduardo',
    target: '#control',
    text: '@orc agents',
  });
  assert.equal(routed.kind, 'command');
  assert.deepEqual(routed.command, { name: 'agents', args: [] });
});

test('routes sign as a deterministic @orc command', () => {
  const routed = routeOrchestratorMessage({
    botNick: 'orchestrator',
    sender: 'eduardo',
    target: '#control',
    text: '@orc sign task-0011',
  });
  assert.equal(routed.kind, 'command');
  assert.deepEqual(routed.command, { name: 'sign', args: ['task-0011'] });
});

test('routes slash project command as a deterministic command', () => {
  const routed = routeOrchestratorMessage({
    botNick: 'orchestrator',
    sender: 'eduardo',
    target: '#client-a',
    text: '/project connect client-a C:/work/client-a',
  });
  assert.equal(routed.kind, 'command');
  assert.deepEqual(routed.command, { name: 'project', args: ['connect', 'client-a', 'C:/work/client-a'] });
  assert.equal(routed.replyTarget, '#client-a');
});

test('routes join as a deterministic @orc command', () => {
  const routed = routeOrchestratorMessage({
    botNick: 'orchestrator',
    sender: 'eduardo',
    target: '#control',
    text: '@orc join #investments all',
  });
  assert.equal(routed.kind, 'command');
  assert.deepEqual(routed.command, { name: 'join', args: ['#investments', 'all'] });
});

test('routes unknown @orc subcommand to chat', () => {
  const routed = routeOrchestratorMessage({
    botNick: 'orchestrator',
    sender: 'eduardo',
    target: '#control',
    text: '@orc frobnicate TASK-0001',
  });
  assert.equal(routed.kind, 'chat');
  assert.equal(routed.prompt, 'frobnicate TASK-0001');
});

test('ignores unrelated channel chatter', () => {
  const routed = routeOrchestratorMessage({
    botNick: 'orchestrator',
    sender: 'eduardo',
    target: '#control',
    text: 'hello everyone',
  });
  assert.equal(routed.kind, 'ignore');
});

test('identifies managed agent direct messages to orchestrator', () => {
  assert.equal(isManagedAgentDirectMessage({
    botNick: 'orchestrator',
    sender: 'FeatureImpl',
    target: 'orchestrator',
    agentNicks: ['FeatureImpl'],
  }), true);
  assert.equal(isManagedAgentDirectMessage({
    botNick: 'orchestrator',
    sender: 'esilveira',
    target: 'orchestrator',
    agentNicks: ['FeatureImpl'],
  }), false);
});

test('ignores the orchestrator own messages', () => {
  const routed = routeOrchestratorMessage({
    botNick: 'orchestrator',
    sender: 'orchestrator',
    target: '#control',
    text: '@orchestrator echo',
  });
  assert.equal(routed.kind, 'ignore');
});
