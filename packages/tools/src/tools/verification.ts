import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Tool, ToolContext, ToolResult } from '../tool.js';

const execFileAsync = promisify(execFile);
const MAX_OUTPUT = 32_000;
const TIMEOUT_MS = 120_000;

const ALLOWLIST = new Map<string, { file: string; args: string[] }>([
  ['npm test', { file: npmFile(), args: ['test'] }],
  ['npm run test:ts', { file: npmFile(), args: ['run', 'test:ts'] }],
  ['npm run typecheck', { file: npmFile(), args: ['run', 'typecheck'] }],
  ['docker compose config --quiet', { file: 'docker', args: ['compose', 'config', '--quiet'] }],
]);

export const runVerificationTool: Tool = {
  name: 'run_verification',
  description: 'Run an allowlisted verification command in the workspace.',
  capability: 'run_verification',
  schema: 'object',
  async run(input: unknown, context: ToolContext): Promise<ToolResult> {
    const command = readString(input, 'command');
    if (!command) return fail('command is required');
    const allowed = ALLOWLIST.get(command.trim());
    if (!allowed) return fail(`command is not allowlisted: ${command}`);

    try {
      const result = await execFileAsync(allowed.file, allowed.args, {
        cwd: context.workspaceRoot,
        timeout: TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
      return ok(command, result.stdout, result.stderr);
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string; code?: unknown };
      return {
        ok: false,
        error: err.message ?? String(error),
        data: output(command, err.stdout, err.stderr, err.code),
      };
    }
  },
};

function readString(input: unknown, field: string): string | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const value = (input as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
}

function npmFile(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function ok(command: string, stdout: string, stderr: string): ToolResult {
  return { ok: true, data: output(command, stdout, stderr, 0) };
}

function output(command: string, stdout = '', stderr = '', exitCode: unknown): unknown {
  return {
    command,
    exitCode,
    stdout: truncate(stdout),
    stderr: truncate(stderr),
  };
}

function truncate(value: string): string {
  return value.length > MAX_OUTPUT ? `${value.slice(0, MAX_OUTPUT)}\n[truncated]` : value;
}

function fail(error: string): ToolResult {
  return { ok: false, error };
}
