import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStartupChannels } from './startup-channels.js';

test('buildStartupChannels includes configured, project, task, and agent channels once', () => {
  assert.deepEqual(
    buildStartupChannels({
      configured: ['#control', '#agents', '#logs', '#control'],
      projects: [{ channel: '#project' }],
      tasks: [{ channel: '#task-0001' }, { channel: '#task-0002' }, { channel: '#task-0001' }],
      agents: [{ channels: '#qa,#review' }, { channels: '#project, #agents' }, { channels: '' }],
    }),
    ['#control', '#agents', '#logs', '#project', '#task-0001', '#task-0002', '#qa', '#review'],
  );
});
