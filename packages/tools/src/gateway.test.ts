import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRepositories } from '@irc/db';
import {
  ToolGateway,
  listFilesTool,
  readFileTool,
  writeFileTool,
  runVerificationTool,
  resolvePath,
  manageAgentsTool,
  npmCommand,
} from './index.js';

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

test('write_file creates a workspace file and keeps it readable', async () => {
  const ctx = makeContext();
  const gateway = new ToolGateway([writeFileTool, readFileTool], {
    workspaceRoot: ctx.root,
    agents: ctx.repos.agents,
  });

  const written = await gateway.execute('write_file', { path: 'notes/status.txt', content: 'green' });
  assert.equal(written.ok, true);
  assert.equal(readFileSync(join(ctx.root, 'notes', 'status.txt'), 'utf8'), 'green');

  const read = await gateway.execute('read_file', { path: 'notes/status.txt' });
  assert.equal((read.data as { content: string }).content, 'green');
  ctx.close();
});

test('write_file rejects traversal and oversized hand-written files', async () => {
  const ctx = makeContext();
  const gateway = new ToolGateway([writeFileTool], { workspaceRoot: ctx.root, agents: ctx.repos.agents });
  const outside = await gateway.execute('write_file', { path: '../escape.txt', content: 'no' });
  const tooLong = await gateway.execute('write_file', { path: 'long.ts', content: `${'x\n'.repeat(201)}` });

  assert.equal(outside.ok, false);
  assert.equal(tooLong.ok, false);
  assert.equal(existsSync(join(ctx.root, 'long.ts')), false);
  ctx.close();
});

test('run_verification only runs allowlisted commands', async () => {
  const ctx = makeContext();
  const gateway = new ToolGateway([runVerificationTool], { workspaceRoot: ctx.root, agents: ctx.repos.agents });

  const denied = await gateway.execute('run_verification', { command: 'npm install' });
  assert.equal(denied.ok, false);
  assert.match(denied.error ?? '', /not allowlisted/);
  ctx.close();
});

test('run_verification launches npm through cmd on Windows', () => {
  const command = npmCommand(['run', 'typecheck'], 'win32');
  assert.match(command.file, /cmd(?:\.exe)?$/i);
  assert.deepEqual(command.args, ['/d', '/s', '/c', 'npm', 'run', 'typecheck']);
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
    strengths: 'planning,docs',
    weaknesses: 'frontend',
    capacity: 2,
    skills: 'orchestration,planning',
  });
  assert.equal(created.ok, true);

  const list = await gateway.execute('manage_agents', { action: 'list' });
  const data = list.data as { agents: { id: string; strengths: string; capacity: number; skills: string }[] };
  assert.deepEqual(data.agents.map((a) => a.id), ['manager-agent']);
  assert.equal(data.agents[0]?.strengths, 'planning,docs');
  assert.equal(data.agents[0]?.capacity, 2);
  assert.equal(data.agents[0]?.skills, 'orchestration,planning');
  ctx.close();
});

test('manage_agents pins backlog agent context to backlog.md', async () => {
  const ctx = makeContext();
  const gateway = new ToolGateway([manageAgentsTool], {
    workspaceRoot: ctx.root,
    agents: ctx.repos.agents,
  });

  const created = await gateway.execute('manage_agents', {
    action: 'create',
    id: 'backlog',
    nick: 'backlog',
    role: 'Backlog keeper',
    context: 'Track backlog tasks in .agents/backlog.md.',
  });
  assert.equal(created.ok, true);
  assert.match((created.data as { agent: { context: string } }).agent.context, /Always use `backlog\.md`/);

  const updated = await gateway.execute('manage_agents', {
    action: 'update',
    id: 'backlog',
    context: 'Switch to project-backlog.md.',
  });
  assert.equal(updated.ok, true);
  assert.match((updated.data as { agent: { context: string } }).agent.context, /Always use `backlog\.md`/);
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
