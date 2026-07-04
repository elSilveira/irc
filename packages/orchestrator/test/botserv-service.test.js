const test = require('node:test');
const assert = require('node:assert/strict');

const { handleBotServ } = require('../src/botserv-service');

test('returns BotService help', () => {
  const result = handleBotServ('HELP', {});
  assert.equal(result.ok, true);
  assert.equal(result.joins.length, 0);
  assert.ok(result.replies.every((line) => line.length <= 90));
  assert.match(result.replies.join('\n'), /HELP AGENTS/);
  assert.match(result.replies.join('\n'), /HELP SKILLS/);
  assert.match(result.replies.join('\n'), /HELP CODEX/);
});

test('lists available skill packs', () => {
  const result = handleBotServ('SKILLS', {});
  assert.match(result.replies.join('\n'), /implementation/);
  assert.match(result.replies.join('\n'), /qa/);
});

test('guides skill pack creation', () => {
  const result = handleBotServ('SKILLPACK CREATE browser --skills browser,inspection --match browser,web', {});
  assert.deepEqual(result.replies, [
    'Skill pack draft: browser',
    'skills=browser,inspection',
    'match=browser,web',
    'Add it to agent-skills catalog, then use --skills browser,inspection',
  ]);
});

test('creates task channels through BotService NEW', () => {
  const tasks = {
    createTask(title) {
      assert.equal(title, 'Build agent');
      return { id: 'TASK-0001', channel: '#task-0001' };
    },
  };

  assert.deepEqual(handleBotServ('NEW "Build agent"', { tasks }), {
    ok: true,
    joins: ['#task-0001'],
    replies: ['Created TASK-0001 in #task-0001.'],
  });
});

test('lists available service agents', () => {
  const agents = {
    listAgents: () => [
      { id: 'feature', nick: 'feature-implementer', role: 'implementer', status: 'idle' },
    ],
  };

  assert.deepEqual(handleBotServ('AGENTS', { agents }), {
    ok: true,
    joins: [],
    replies: ['Agents', 'feature | nick=feature-implementer | role=implementer | status=idle', 'helper | user command bridge'],
  });
});

test('shows one managed agent', () => {
  const agents = {
    findAgent(id) {
      assert.equal(id, 'feature');
      return { id, nick: 'feature-implementer', role: 'implementer', status: 'idle', context: 'Builds features' };
    },
  };

  assert.deepEqual(handleBotServ('SHOW feature', { agents }), {
    ok: true,
    joins: [],
    replies: ['feature | nick=feature-implementer | role=implementer | status=idle', 'context=Builds features'],
  });
});

test('creates managed agents through BotService', () => {
  const agents = {
    createAgent(input) {
      assert.deepEqual(input, {
        id: 'feature',
        nick: 'feature-implementer',
        role: 'implementer',
        context: 'Builds features',
        strengths: 'typescript,tests',
        weaknesses: 'infra',
        capacity: 2,
        skills: 'implementation,tdd,repo-editing',
      });
      return { ...input, status: 'idle' };
    },
  };

  assert.deepEqual(
    handleBotServ(
      'CREATE feature --nick feature-implementer --role implementer --context "Builds features" --strengths typescript,tests --weaknesses infra --capacity 2',
      { agents },
    ),
    { ok: true, joins: [], replies: ['OK created feature | nick=feature-implementer | role=implementer'] },
  );
});

test('keeps create replies compact for mIRC', () => {
  const agents = {
    createAgent(input) {
      return { ...input, status: 'idle' };
    },
  };

  const result = handleBotServ(
    'CREATE feature-implementer --nick feature-implementer --role implementer --context Implements IRC features',
    { agents },
  );

  assert.ok(result.replies.every((line) => line.length <= 90));
  assert.deepEqual(result.replies, [
    'OK created feature-implementer | nick=feature-implementer | role=implementer',
  ]);
});

test('updates and deletes managed agents through BotService', () => {
  const calls = [];
  const agents = {
    updateAgent(id, fields) {
      calls.push(['update', id, fields]);
      return { id, nick: 'feature-implementer', role: fields.role, status: 'idle', context: fields.context };
    },
    deleteAgent(id) {
      calls.push(['delete', id]);
      return true;
    },
  };

  assert.deepEqual(
    handleBotServ('UPDATE feature --role qa --context "Reviews changes" --strengths review --capacity 3 --skills qa,testing', { agents })
      .replies,
    ['OK updated feature'],
  );
  assert.deepEqual(handleBotServ('DELETE feature', { agents }).replies, ['OK deleted feature']);
  assert.deepEqual(calls, [
    ['update', 'feature', { role: 'qa', context: 'Reviews changes', strengths: 'review', capacity: 3, skills: 'qa,testing' }],
    ['delete', 'feature'],
  ]);
});

test('shows routing metadata for one managed agent', () => {
  const agents = {
    findAgent(id) {
      return {
        id,
        nick: 'feature-implementer',
        role: 'implementer',
        status: 'idle',
        context: 'Builds features',
        strengths: 'typescript,tests',
        weaknesses: 'infra',
        capacity: 2,
      };
    },
  };

  assert.deepEqual(handleBotServ('SHOW feature', { agents }).replies, [
    'feature | nick=feature-implementer | role=implementer | status=idle',
    'route strengths=typescript,tests | weaknesses=infra | capacity=2',
    'context=Builds features',
  ]);
});
