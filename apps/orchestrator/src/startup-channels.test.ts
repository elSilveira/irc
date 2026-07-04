import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStartupChannels } from './startup-channels.js';

test('buildStartupChannels includes configured and task channels once', () => {
  assert.deepEqual(
    buildStartupChannels({
      configured: ['#control', '#agents', '#logs', '#control'],
      tasks: [{ channel: '#task-0001' }, { channel: '#task-0002' }, { channel: '#task-0001' }],
    }),
    ['#control', '#agents', '#logs', '#task-0001', '#task-0002'],
  );
});
