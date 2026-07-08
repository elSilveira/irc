import { inferAgentGraphRoute, inferAgentSkills, inferAgentTools } from '@irc/shared';
import type { Tool, ToolResult } from '../tool.js';
import type { ToolContext } from '../types.js';

const BACKLOG_AGENT_ID = 'backlog';
const BACKLOG_FILE_INSTRUCTION =
  'Always use `backlog.md` as the single backlog file; do not create, read from, or write to alternate backlog files for backlog tasks.';

export const manageAgentsTool: Tool = {
  name: 'manage_agents',
  description:
    'Create, list, or update IRC agents. Actions: list, create, update. ' +
    'create needs id, nick, role, context. Optional: strengths, weaknesses, capacity, skills.',
  capability: 'manage_agents',
  schema: 'object',
  async run(input: unknown, context: ToolContext): Promise<ToolResult> {
    const action = readString(input, 'action');
    if (action === 'list') return { ok: true, data: { agents: context.agents.listAgents() } };
    if (action === 'create') return createAgent(input, context);
    if (action === 'update') return updateAgent(input, context);
    return { ok: false, error: `unknown action: ${action ?? '(missing)'}` };
  },
};

function createAgent(input: unknown, context: ToolContext): ToolResult {
  const id = readString(input, 'id');
  const nick = readString(input, 'nick');
  const role = readString(input, 'role');
  const agentContext = readString(input, 'context');
  const strengths = readString(input, 'strengths');
  const weaknesses = readString(input, 'weaknesses');
  const capacity = readNumber(input, 'capacity');
  if (!id || !nick || !role || !agentContext) return { ok: false, error: 'create requires id, nick, role, context' };
  const skills = readString(input, 'skills') ?? inferAgentSkills({ role, context: agentContext });
  try {
    const agent = context.agents.createAgent({
      id,
      nick,
      role,
      context: enrichAgentContext({ id, nick, role, context: normalizeBacklogContext(id, agentContext), skills }),
      strengths,
      weaknesses,
      capacity,
      skills,
    });
    return { ok: true, data: { agent } };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

function updateAgent(input: unknown, context: ToolContext): ToolResult {
  const id = readString(input, 'id');
  if (!id) return { ok: false, error: 'update requires id' };
  const current = context.agents.findAgent(id);
  if (!current) return { ok: false, error: `agent not found: ${id}` };
  const role = readString(input, 'role') ?? current.role;
  const baseContext = readString(input, 'context') ?? stripSpecialization(current.context);
  const explicitSkills = readString(input, 'skills') ?? current.skills;
  const skills = explicitSkills || inferAgentSkills({ role, context: baseContext });
  const fields: { role?: string; context?: string; strengths?: string; weaknesses?: string; capacity?: number; skills?: string } = {};
  const strengths = readString(input, 'strengths');
  const weaknesses = readString(input, 'weaknesses');
  const capacity = readNumber(input, 'capacity');
  fields.role = role;
  fields.context = enrichAgentContext({ id, nick: current.nick, role, context: normalizeBacklogContext(id, baseContext), skills });
  fields.skills = skills;
  if (strengths) fields.strengths = strengths;
  if (weaknesses) fields.weaknesses = weaknesses;
  if (capacity) fields.capacity = capacity;
  try {
    const agent = context.agents.updateAgent(id, fields);
    return { ok: true, data: { agent } };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

function enrichAgentContext(input: { id: string; nick: string; role: string; context: string; skills: string }): string {
  const route = inferAgentGraphRoute(input);
  const tools = inferAgentTools(input).join(', ');
  return [
    stripSpecialization(input.context),
    `Connected tools: ${tools}.`,
    `LangGraph node: ${route.node}; chain prefix: ${route.chainPrefix}; channel scope: ${route.channelScope}; RAG scope: ${route.ragScope}.`,
  ].join(' ');
}

function stripSpecialization(value: string): string {
  return value
    .replace(/\s*Connected tools: .*?(?=\s+LangGraph node:|$)/g, '')
    .replace(/\s*LangGraph node: .*?RAG scope: .*?\./g, '')
    .trim();
}

function normalizeBacklogContext(id: string, agentContext: string): string {
  if (id !== BACKLOG_AGENT_ID || agentContext.includes(BACKLOG_FILE_INSTRUCTION)) return agentContext;
  return `${agentContext} ${BACKLOG_FILE_INSTRUCTION}`;
}

function readString(input: unknown, field: string): string | undefined {
  if (input && typeof input === 'object') {
    const value = (input as Record<string, unknown>)[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function readNumber(input: unknown, field: string): number | undefined {
  if (input && typeof input === 'object') {
    const value = (input as Record<string, unknown>)[field];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
