import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChainContextKey,
  createChainRef,
  ensureChainRef,
  extractChainRef,
  frameChainPrompt,
} from './conversation-chain.js';

test('extractChainRef reads supported chain markers', () => {
  assert.equal(extractChainRef('[chain:abc123ef] continue'), 'abc123ef');
  assert.equal(extractChainRef('reply [ref:Task_42]'), 'Task_42');
  assert.equal(extractChainRef('no marker'), null);
});

test('createChainRef is stable for the same conversation seed', () => {
  const first = createChainRef({ agent: 'a', sender: 'u', target: '#c', prompt: 'do work' });
  const second = createChainRef({ agent: 'a', sender: 'u', target: '#c', prompt: 'do work' });

  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{12}$/);
});

test('buildChainContextKey scopes context by channel or dm and chain ref', () => {
  assert.equal(
    buildChainContextKey({ agent: 'worker', isDm: false, sender: 'user', target: '#control', chainRef: 'abc' }),
    'agent:worker:channel:#control:chain:abc',
  );
  assert.equal(
    buildChainContextKey({ agent: 'worker', isDm: true, sender: 'user', target: 'worker', chainRef: 'abc' }),
    'agent:worker:dm:user:chain:abc',
  );
});

test('frameChainPrompt and ensureChainRef keep responses correlated', () => {
  const framed = frameChainPrompt('abc123ef', 'implement feature');
  assert.match(framed, /\[chain:abc123ef\]/);
  assert.match(framed, /include \[chain:abc123ef\]/);
  assert.equal(ensureChainRef('abc123ef', 'done'), '[chain:abc123ef] done');
  assert.equal(ensureChainRef('abc123ef', '[chain:abc123ef] done'), '[chain:abc123ef] done');
});
