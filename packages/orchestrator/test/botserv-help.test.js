const test = require('node:test');
const assert = require('node:assert/strict');

const { handleBotServ } = require('../src/botserv-service');

test('BotService top help lists command levels', () => {
  const result = handleBotServ('HELP', {});
  const text = result.replies.join('\n');

  assert.equal(result.ok, true);
  assert.ok(result.replies.every((line) => line.length <= 90));
  assert.match(text, /BotService help/);
  assert.match(text, /HELP AGENTS/);
  assert.match(text, /HELP TASKS/);
  assert.match(text, /HELP SKILLS/);
  assert.match(text, /HELP CODEX/);
});

test('BotService agent help explains CRUD commands', () => {
  const text = handleBotServ('HELP AGENTS', {}).replies.join('\n');

  assert.match(text, /Agent commands/);
  assert.match(text, /CREATE <id>/);
  assert.match(text, /UPDATE <id>/);
  assert.match(text, /DELETE <id>/);
});

test('BotService task help explains task creation', () => {
  const text = handleBotServ('HELP TASKS', {}).replies.join('\n');

  assert.match(text, /Task commands/);
  assert.match(text, /NEW "title"/);
  assert.match(text, /@orc new/);
});

test('BotService codex help points users at helper', () => {
  const text = handleBotServ('HELP CODEX', {}).replies.join('\n');

  assert.match(text, /Helper commands/);
  assert.match(text, /\/msg helper/);
  assert.match(text, /@codex/);
});
