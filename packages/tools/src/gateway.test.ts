import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRepositories } from '@irc/db';
import { ToolGateway, listFilesTool, readFileTool, resolvePath, manageAgentsTool } from './index.js';

function makeContext() {
  const root = mkdtempSync(join(tmpdir(), 'irc-tools-'));
  mkdirSync(join(root, 'sub'), { recursive: true });
  writeFileSync(join(root, 'hello.txt'), 'hello world');
  writeFileSync(join(root, 'sub', 'nested.txt'), 'nested');
  const repos = createRepositories(':memory:');
  return { root, repos, close: () => repos.close() };
}

test('list_files lists the workspace root', async () => {
  const ctx = makeContext();
  const gateway = new ToolGateway([listFilesTool], {
    workspaceRoot: ctx.root,
    agents: ctx.repos.agents,
  });
  const result = await gateway.execute('list_files', { path: '.' });
  assert.equal(result.ok, true);
  const data = result.data as { entries: string[] };
  assert.ok(data.entries.includes('hello.txt'));
  assert.ok(data.entries.includes('sub/'));
  ctx.close();
});

test('read_file returns file contents', async () => {
  const ctx = makeContext();
  const gateway = new ToolGateway([readFileTool], {
    workspaceRoot: ctx.root,
    agents: ctx.repos.agents,
  });
  const result = await gateway.execute('read_file', { path: 'hello.txt' });
  assert.equal(result.ok, true);
  assert.equal((result.data as { content: string }).content, 'hello world');
  ctx.close();
});

test('resolvePath blocks traversal outside the workspace', () => {
  const ctx = makeContext();
  assert.equal(resolvePath(ctx.root, '../../../etc/passwd'), null);
  assert.notEqual(resolvePath(ctx.root, 'sub/nested.txt'), null);
  ctx.close();
});

test('gateway denies a tool whose capability is not in the policy', async () => {
  const ctx = makeContext();
  const rogue = {
    name: 'rm_rf',
    description: 'delete everything',
    capability: 'shell',
    schema: 'object' as const,
    async run() {
      return { ok: true };
    },
  };
  const gateway = new ToolGateway([rogue], { workspaceRoot: ctx.root, agents: ctx.repos.agents });
  const result = await gateway.execute('rm_rf', {});
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /permission denied/);
  ctx.close();
});

test('manage_agents creates and lists agents', async () => {
  const ctx = makeContext();
  const gateway = new ToolGateway([manageAgentsTool], {
    workspaceRoot: ctx.root,
    agents: ctx.repos.agents,
  });
  const created = await gateway.execute('manage_agents', {
    action: 'create',
    id: 'manager-agent',
    nick: 'manager-agent',
    role: 'manager',
    context: 'plans work',
  });
  assert.equal(created.ok, true);

  const list = await gateway.execute('manage_agents', { action: 'list' });
  const data = list.data as { agents: { id: string }[] };
  assert.deepEqual(data.agents.map((a) => a.id), ['manager-agent']);
  ctx.close();
});

test('gateway logs every tool call', async () => {
  const ctx = makeContext();
  const logs: { tool: string; ok: boolean }[] = [];
  const gateway = new ToolGateway(
    [listFilesTool],
    { workspaceRoot: ctx.root, agents: ctx.repos.agents },
    { logger: (entry) => logs.push({ tool: entry.tool, ok: entry.ok }) },
  );
  await gateway.execute('list_files', { path: '.' });
  assert.deepEqual(logs, [{ tool: 'list_files', ok: true }]);
  ctx.close();
});
