import type { AgentRepository } from '@irc/db';

export interface ToolContext {
  /** Directory the read-only tools are allowed to inspect. */
  workspaceRoot: string;
  /** Agent repository backing the manage_agents tool. */
  agents: AgentRepository;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export type ToolLogger = (entry: ToolLogEntry) => void;

export interface ToolLogEntry {
  tool: string;
  capability: string;
  input: unknown;
  ok: boolean;
  durationMs: number;
  error?: string;
}
