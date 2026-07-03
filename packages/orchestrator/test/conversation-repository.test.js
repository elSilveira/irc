const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

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

test('reopens persisted conversation database', () => {
  const directory = mkdtempSync(join(tmpdir(), 'conversation-repository-'));
  const databasePath = join(directory, 'conversations.sqlite');
  let reopened;

  try {
    const repo = createConversationRepository(databasePath);
    repo.saveThread('channel:#control', 'thr_1');
    repo.close();

    reopened = createConversationRepository(databasePath);

    assert.deepEqual(reopened.findThread('channel:#control'), {
      contextKey: 'channel:#control',
      threadId: 'thr_1',
    });
  } finally {
    if (reopened) {
      reopened.close();
    }

    try {
      rmSync(directory, { recursive: true, force: true });
    } catch {
      // If construction fails before returning the repository, node:sqlite can
      // briefly hold the file on Windows. Preserve the original test failure.
    }
  }
});

test('rejects blank conversation values', () => {
  const repo = createConversationRepository(':memory:');

  assert.throws(
    () => repo.saveThread('', 'thr_1'),
    /contextKey is required/,
  );
  assert.throws(
    () => repo.saveThread(null, 'thr_1'),
    /contextKey is required/,
  );
  assert.throws(
    () => repo.saveThread('channel:#control', ''),
    /threadId is required/,
  );

  repo.close();
});

test('overwrites thread for an existing context key', () => {
  const repo = createConversationRepository(':memory:');

  repo.saveThread('channel:#control', 'thr_1');
  repo.saveThread('channel:#control', 'thr_2');

  assert.deepEqual(repo.findThread('channel:#control'), {
    contextKey: 'channel:#control',
    threadId: 'thr_2',
  });

  repo.close();
});

test('returns null for a missing context key', () => {
  const repo = createConversationRepository(':memory:');

  assert.equal(repo.findThread('channel:#missing'), null);

  repo.close();
});
