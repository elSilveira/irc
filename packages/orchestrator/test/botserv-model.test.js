const test = require('node:test');
const assert = require('node:assert/strict');

const { handleBotServ } = require('../src/botserv-service');

test('creates and shows per-agent model choice through BotService', () => {
  const agents = {
    createAgent(input) {
      assert.equal(input.modelProvider, 'codex');
      assert.equal(input.modelAuth, 'login');
      assert.equal(input.modelName, 'gpt-5-codex');
      return { ...input, status: 'idle' };
    },
    findAgent() {
      return {
        id: 'helper-agent',
        nick: 'helper',
        role: 'helper',
        status: 'idle',
        context: 'Helps users',
        modelProvider: 'codex',
        modelAuth: 'login',
        modelName: 'gpt-5-codex',
      };
    },
  };

  assert.deepEqual(
    handleBotServ('CREATE helper-agent --nick helper --role helper --context "Helps users" --model codex --auth login --model-name gpt-5-codex', { agents }).replies,
    ['OK created helper-agent | nick=helper | role=helper'],
  );
  assert.match(handleBotServ('SHOW helper-agent', { agents }).replies.join('\n'), /model=codex login gpt-5-codex/);
});

test('updates model selection without changing other agent fields', () => {
  const calls = [];
  const agents = {
    updateAgent(id, fields) {
      calls.push([id, fields]);
      return { id, ...fields };
    },
  };

  assert.deepEqual(
    handleBotServ('MODEL feature --provider glm-5.2-z-ai --auth api-key --name glm-5.2', { agents }).replies,
    ['OK model feature | provider=glm-5.2-z-ai | auth=api-key | name=glm-5.2'],
  );
  assert.deepEqual(calls, [
    ['feature', { modelProvider: 'glm-5.2-z-ai', modelAuth: 'api-key', modelName: 'glm-5.2' }],
  ]);
});

test('validates supported model providers and auth modes', () => {
  const agents = { updateAgent() { throw new Error('must not update'); } };

  assert.deepEqual(handleBotServ('MODEL a --provider anthropic --auth login', { agents }).replies, [
    'MODEL provider must be codex, openai, ollama, or glm-5.2-z-ai',
  ]);
  assert.deepEqual(handleBotServ('MODEL a --provider codex --auth token', { agents }).replies, [
    'MODEL auth must be login, api-key, or local',
  ]);
});
