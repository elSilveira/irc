import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import type { Tool, ToolContext, ToolResult } from '../tool.js';
import { resolvePath } from './fs.js';

const MAX_HAND_WRITTEN_LINES = 200;

export const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Create or replace a text file inside the workspace.',
  capability: 'workspace_write',
  schema: 'object',
  async run(input: unknown, context: ToolContext): Promise<ToolResult> {
    const requested = readString(input, 'path');
    const content = readString(input, 'content');
    if (!requested) return fail('path is required');
    if (content === undefined) return fail('content is required');

    const target = resolvePath(context.workspaceRoot, requested);
    if (!target) return fail('path must stay inside the workspace');
    if (lineCount(content) > MAX_HAND_WRITTEN_LINES && !isGenerated(requested)) {
      return fail(`hand-written files must stay at or below ${MAX_HAND_WRITTEN_LINES} lines`);
    }

    try {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, 'utf8');
      return { ok: true, data: { path: relative(context.workspaceRoot, target), lines: lineCount(content) } };
    } catch (error) {
      return fail(`could not write file: ${message(error)}`);
    }
  },
};

function readString(input: unknown, field: string): string | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const value = (input as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
}

function lineCount(value: string): number {
  if (value.length === 0) return 0;
  return value.split(/\r?\n/).length;
}

function isGenerated(path: string): boolean {
  return /(^|[/\\])(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(path);
}

function fail(error: string): ToolResult {
  return { ok: false, error };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
