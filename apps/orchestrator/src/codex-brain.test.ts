import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CodexBrain } from './codex-brain.js';
import { ToolGateway, manageAgentsTool, readFileTool } from '@irc/tools';
import { createRepositories } from '@irc/db';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CodexClient } from '@irc/llm';
import type { BrainContext } from './brain.js';

function fakeClient(script: string[], threads: { prompt: string; threadId: string }[]): CodexClient {
  let call = 0;
  return {
    configured: true,
    async generate(input) {
      const text = script[call] ?? 'fallback';
      call += 1;
      const generated = `thread-${call}`;
      threads.push({ prompt: input.prompt, threadId: input.threadId ?? generated });
      return { threadId: input.threadId ?? generated, text };
    },
  };
}

function makeGateway() {
  const root = mkdtempSync(join(tmpdir(), 'codex-brain-'));
  const repos = createRepositories(':memory:');
  return {
    gateway: new ToolGateway([manageAgentsTool, readFileTool], { workspaceRoot: root, agents: repos.agents }),
    repos,
    root,
  };
}

const CTX: BrainContext = { contextKey: 'orchestrator:channel:#control' };

test('CodexBrain runs a manage_agents tool call then returns the final answer', async () => {
  const { gateway, repos } = makeGateway();
  const threads: { prompt: string; threadId: string }[] = [];
  const client = fakeClient(
    [
      'IRC_TOOL: {"tool":"manage_agents","input":{"action":"create","id":"manager-agent","nick":"manager-agent","role":"manager","context":"plans work"}}',
      'Created manager-agent successfully.',
    ],
    threads,
  );

  const brain = new CodexBrain({ client, gateway, conversations: repos.conversations, workspace: '/tmp/ws' });
  const answer = await brain.respond('create a manager agent', CTX);

  assert.equal(answer, 'Created manager-agent successfully.');
  assert.equal(repos.agents.findAgent('manager-agent')?.role, 'manager');
});

test('CodexBrain runs a read_file tool call then returns the final answer', async () => {
  const { gateway, repos, root } = makeGateway();
  writeFileSync(join(root, 'README.md'), 'local readme content');
  const client = fakeClient(
    [
      'IRC_TOOL: {"tool":"read_file","input":{"path":"README.md"}}',
      'README says: local readme content',
    ],
    [],
  );

  const brain = new CodexBrain({ client, gateway, conversations: repos.conversations, workspace: root });
  const answer = await brain.respond('read README.md', CTX);

  assert.equal(answer, 'README says: local readme content');
});

test('CodexBrain advertises read tools in the prompt', async () => {
  const { gateway, repos } = makeGateway();
  const threads: { prompt: string; threadId: string }[] = [];
  const client = fakeClient(['ok'], threads);

  const brain = new CodexBrain({ client, gateway, conversations: repos.conversations, workspace: '/tmp/ws' });
  await brain.respond('read README.md', CTX);

  assert.match(threads[0]?.prompt ?? '', /read_file/);
  assert.match(threads[0]?.prompt ?? '', /list_files/);
  assert.match(threads[0]?.prompt ?? '', /IRC_TOOL/);
});

test('CodexBrain returns plain answers directly when no tool call is emitted', async () => {
  const { gateway } = makeGateway();
  const client = fakeClient(['Hello from codex.'], []);
  const brain = new CodexBrain({ client, gateway, conversations: makeGateway().repos.conversations, workspace: '/tmp/ws' });

  const answer = await brain.respond('hi', CTX);
  assert.equal(answer, 'Hello from codex.');
});

test('CodexBrain persists and reuses the codex thread per context', async () => {
  const { gateway, repos } = makeGateway();
  const threads: { prompt: string; threadId: string }[] = [];
  const client = fakeClient(['one', 'two'], threads);

  const brain = new CodexBrain({ client, gateway, conversations: repos.conversations, workspace: '/tmp/ws' });
  await brain.respond('first message', CTX);
  const firstThread = repos.conversations.findThread('orchestrator:channel:#control')?.threadId;
  assert.ok(firstThread, 'thread persisted after first call');

  await brain.respond('second message', CTX);

  // second call must reuse the persisted thread id instead of starting a new one
  assert.equal(threads[1]?.threadId, firstThread);
});
