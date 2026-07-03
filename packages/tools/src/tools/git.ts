import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Tool, ToolResult } from '../tool.js';
import type { ToolContext } from '../types.js';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 15_000;
const MAX_OUTPUT = 16_000;

export const gitStatusTool: Tool = {
  name: 'git_status',
  description: 'Run `git status --porcelain` in the workspace to see uncommitted changes.',
  capability: 'git_status',
  schema: 'object',
  async run(_input: unknown, context: ToolContext): Promise<ToolResult> {
    return runGit(['status', '--porcelain', '--branch'], context);
  },
};

export const gitDiffTool: Tool = {
  name: 'git_diff',
  description: 'Run `git diff` in the workspace to see unstaged changes.',
  capability: 'git_diff',
  schema: 'object',
  async run(input: unknown, context: ToolContext): Promise<ToolResult> {
    const staged = readBool(input, 'staged');
    const args = ['diff', ...(staged ? ['--staged'] : []), '--stat'];
    return runGit(args, context);
  },
};

async function runGit(args: string[], context: ToolContext): Promise<ToolResult> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: context.workspaceRoot,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: 1024 * 512,
      windowsHide: true,
    });
    const trimmed = stdout.length > MAX_OUTPUT ? `${stdout.slice(0, MAX_OUTPUT)}\n[truncated]` : stdout;
    return { ok: true, data: { command: `git ${args.join(' ')}`, output: trimmed.trimEnd() } };
  } catch (error) {
    return { ok: false, error: `git failed: ${message(error)}` };
  }
}

function readBool(input: unknown, field: string): boolean {
  if (input && typeof input === 'object') {
    return Boolean((input as Record<string, unknown>)[field]);
  }
  return false;
}

function message(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'stderr' in error) {
    return String((error as { stderr?: string }).stderr ?? error);
  }
  return String(error);
}
