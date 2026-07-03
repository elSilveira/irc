import { statSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import type { Tool, ToolContext, ToolResult } from '../tool.js';

const MAX_LIST_ENTRIES = 200;
const MAX_READ_BYTES = 32_000;

export const listFilesTool: Tool = {
  name: 'list_files',
  description: 'List the files and directories directly inside a path within the workspace.',
  capability: 'list_files',
  schema: 'object',
  async run(input: unknown, context: ToolContext): Promise<ToolResult> {
    const target = resolvePath(context.workspaceRoot, readField(input, 'path') ?? '.');
    if (!target) return fail('path must stay inside the workspace');

    let entries: import('node:fs').Dirent[];
    try {
      entries = readdirSync(target, { withFileTypes: true });
    } catch (error) {
      return fail(`could not read directory: ${message(error)}`);
    }

    const names = entries
      .slice(0, MAX_LIST_ENTRIES)
      .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
      .sort();
    const truncated = entries.length > MAX_LIST_ENTRIES;

    return ok({
      path: relative(context.workspaceRoot, target) || '.',
      entries: names,
      ...(truncated ? { truncated: true } : {}),
    });
  },
};

export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the text contents of a single file inside the workspace.',
  capability: 'read_file',
  schema: 'object',
  async run(input: unknown, context: ToolContext): Promise<ToolResult> {
    const requested = readField(input, 'path');
    if (!requested) return fail('path is required');
    const target = resolvePath(context.workspaceRoot, requested);
    if (!target) return fail('path must stay inside the workspace');

    let stats;
    try {
      stats = statSync(target);
    } catch (error) {
      return fail(`could not stat file: ${message(error)}`);
    }
    if (!stats.isFile()) return fail('path is not a file');

    try {
      const buffer = readFileSync(target);
      const truncated = buffer.length > MAX_READ_BYTES;
      const slice = truncated ? buffer.subarray(0, MAX_READ_BYTES) : buffer;
      return ok({
        path: relative(context.workspaceRoot, target),
        content: slice.toString('utf8'),
        ...(truncated ? { truncated: true, bytes: stats.size } : {}),
      });
    } catch (error) {
      return fail(`could not read file: ${message(error)}`);
    }
  },
};

export function resolvePath(workspaceRoot: string, requested: string): string | null {
  const root = resolve(workspaceRoot);
  const target = resolve(root, requested);
  const rel = relative(root, target);
  if (rel.startsWith('..') || rel === `..${sep}` || isAbsoluteLike(rel)) return null;
  return target;
}

function isAbsoluteLike(rel: string): boolean {
  return rel.length > 0 && rel === resolve(rel);
}

function readField(input: unknown, field: string): string | undefined {
  if (input && typeof input === 'object') {
    const value = (input as Record<string, unknown>)[field];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

function ok(data: unknown): ToolResult {
  return { ok: true, data };
}

function fail(error: string): ToolResult {
  return { ok: false, error };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
