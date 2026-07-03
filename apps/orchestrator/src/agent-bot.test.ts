import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentSystemPrompt } from './agent-bot.js';

test('agent prompt includes role context and repo tools', () => {
  const prompt = buildAgentSystemPrompt({
    id: 'readme-agent',
    nick: 'readme-agent',
    role: 'researcher',
    context: 'Reads repository docs for IRC users.',
  });

  assert.match(prompt, /readme-agent/);
  assert.match(prompt, /researcher/);
  assert.match(prompt, /Reads repository docs/);
  assert.match(prompt, /read_file/);
  assert.match(prompt, /IRC_TOOL/);
});
