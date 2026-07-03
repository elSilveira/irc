import type { Tool, ToolResult } from '../tool.js';
import type { ToolContext } from '../types.js';

/**
 * The agent-management tool. This is what lets the orchestrator (and BotService)
 * create, list, and edit agents globally — fulfilling the "BotService is
 * responsible for helping, creation and editing globally" goal.
 */
export const manageAgentsTool: Tool = {
  name: 'manage_agents',
  description:
    'Create, list, or update IRC agents. Actions: list, create, update. ' +
    'create needs id, nick, role, context. update needs id plus any of role/context.',
  capability: 'manage_agents',
  schema: 'object',
  async run(input: unknown, context: ToolContext): Promise<ToolResult> {
    const action = readString(input, 'action');
    if (action === 'list') {
      return { ok: true, data: { agents: context.agents.listAgents() } };
    }
    if (action === 'create') {
      return createAgent(input, context);
    }
    if (action === 'update') {
      return updateAgent(input, context);
    }
    return { ok: false, error: `unknown action: ${action ?? '(missing)'}` };
  },
};

function createAgent(input: unknown, context: ToolContext): ToolResult {
  const id = readString(input, 'id');
  const nick = readString(input, 'nick');
  const role = readString(input, 'role');
  const agentContext = readString(input, 'context');
  if (!id || !nick || !role || !agentContext) {
    return { ok: false, error: 'create requires id, nick, role, context' };
  }
  try {
    const agent = context.agents.createAgent({ id, nick, role, context: agentContext });
    return { ok: true, data: { agent } };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

function updateAgent(input: unknown, context: ToolContext): ToolResult {
  const id = readString(input, 'id');
  if (!id) return { ok: false, error: 'update requires id' };
  const fields: { role?: string; context?: string } = {};
  const role = readString(input, 'role');
  const agentContext = readString(input, 'context');
  if (role) fields.role = role;
  if (agentContext) fields.context = agentContext;
  if (Object.keys(fields).length === 0) {
    return { ok: false, error: 'update requires at least one of role, context' };
  }
  try {
    const agent = context.agents.updateAgent(id, fields);
    return { ok: true, data: { agent } };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

function readString(input: unknown, field: string): string | undefined {
  if (input && typeof input === 'object') {
    const value = (input as Record<string, unknown>)[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
