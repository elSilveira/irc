import type { ToolContext, ToolResult } from './types.js';

export interface Tool {
  readonly name: string;
  readonly description: string;
  /** Capability required to run this tool (checked against the permission policy). */
  readonly capability: string;
  /** Informal marker; LangChain adapters attach their own zod schema. */
  readonly schema: 'object';
  run(input: unknown, context: ToolContext): Promise<ToolResult>;
}

export type { ToolContext, ToolResult } from './types.js';
