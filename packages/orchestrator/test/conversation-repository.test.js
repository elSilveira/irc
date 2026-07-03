const test = require('node:test');
const assert = require('node:assert/strict');

const { createConversationRepository } = require('../src/conversation-repository');

test('persists conversation thread by context key', () => {
  const repo = createConversationRepository(':memory:');

  repo.saveThread('channel:#control', 'thr_1');

  assert.deepEqual(repo.findThread('channel:#control'), {
    contextKey: 'channel:#control',
    threadId: 'thr_1',
  });

  repo.close();
});
