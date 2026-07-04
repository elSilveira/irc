import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureTaskProtocolOutput } from './agent-task-output.js';

test('ensureTaskProtocolOutput keeps valid task protocol output', () => {
  assert.equal(
    ensureTaskProtocolOutput('TASK-0002', '[task:TASK-0002] [type:rdt] ready for QA'),
    '[task:TASK-0002] [type:rdt] ready for QA',
  );
});

test('ensureTaskProtocolOutput converts no-answer output to blocked', () => {
  assert.equal(
    ensureTaskProtocolOutput('TASK-0002', '(no answer)'),
    '[task:TASK-0002] [type:blocked] agent stopped without task protocol output',
  );
});
