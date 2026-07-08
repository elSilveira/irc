import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inferAgentSkills,
  inferAgentTools,
  inferAgentGraphRoute,
} from '@irc/shared';
import { buildAgentSystemPrompt } from './agent-bot.js';

test('infers specialty skills for common agent roles', () => {
  assert.equal(inferAgentSkills({ role: 'feature implementer', context: 'writes code and tests' }), 'implementation,tdd,repo-editing');
  assert.equal(inferAgentSkills({ role: 'qa reviewer', context: 'validates completed work' }), 'qa,testing,review');
  assert.equal(inferAgentSkills({ role: 'docs researcher', context: 'reads project documentation' }), 'research,docs,context');
});

test('connects tool access to inferred agent usage', () => {
  assert.deepEqual(
    inferAgentTools({ role: 'qa reviewer', context: 'validates completed work', skills: 'qa,testing,review' }),
    ['list_files', 'read_file', 'git_status', 'git_diff', 'run_verification'],
  );
  assert.deepEqual(
    inferAgentTools({ role: 'feature implementer', context: 'writes code', skills: 'implementation,tdd,repo-editing' }),
    ['list_files', 'read_file', 'git_status', 'git_diff', 'write_file', 'run_verification'],
  );
  assert.deepEqual(
    inferAgentTools({ role: 'orchestrator', context: 'routes and creates agents', skills: 'orchestration,planning,routing' }),
    ['list_files', 'read_file', 'git_status', 'git_diff', 'manage_agents'],
  );
});

test('connects new agents to graph channels and rag scopes', () => {
  assert.deepEqual(
    inferAgentGraphRoute({ id: 'qa', nick: 'QA', role: 'qa reviewer', context: 'validates tasks', skills: 'qa,testing,review' }),
    { node: 'qa', chainPrefix: 'agent:QA', channelScope: '#qa', ragScope: 'qa:testing:review' },
  );
});

test('agent prompt advertises specialty tools and graph routing', () => {
  const prompt = buildAgentSystemPrompt({
    id: 'feature-implementer',
    nick: 'feature-implementer',
    role: 'feature implementer',
    context: 'implements scoped features',
    skills: 'implementation,tdd,repo-editing',
  });

  assert.match(prompt, /Connected tools: list_files, read_file, git_status, git_diff, write_file, run_verification/);
  assert.match(prompt, /LangGraph node: implementation/);
  assert.match(prompt, /Chain prefix: agent:feature-implementer/);
  assert.match(prompt, /RAG scope: implementation:tdd:repo-editing/);
});
