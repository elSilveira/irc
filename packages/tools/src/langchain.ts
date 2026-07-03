import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolGateway } from './gateway.js';

type SchemaMap = Record<string, z.ZodObject<z.ZodRawShape>>;

const SCHEMAS: SchemaMap = {
  list_files: z.object({
    path: z
      .string()
      .optional()
      .describe('Directory relative to the workspace root. Defaults to the workspace root.'),
  }),
  read_file: z.object({
    path: z.string().describe('File path relative to the workspace root.'),
  }),
  git_status: z.object({}),
  git_diff: z.object({
    staged: z.boolean().optional().describe('Show staged (--cached) changes instead of unstaged.'),
  }),
  manage_agents: z
    .object({
      action: z
        .enum(['list', 'create', 'update'])
        .describe('list: return all agents. create: register a new agent. update: edit an existing agent.'),
      id: z.string().optional().describe('Agent id. Required for create and update.'),
      nick: z.string().optional().describe('IRC nickname. Required for create.'),
      role: z.string().optional().describe('Agent role (manager, coder, qa, researcher, memory, runner, codex).'),
      context: z
        .string()
        .optional()
        .describe('Durable operating notes / responsibility of the agent.'),
    })
    .describe('Manage IRC agents globally (create, list, update).'),
};

export function toLangChainTools(gateway: ToolGateway): DynamicStructuredTool[] {
  return gateway.names().flatMap((name) => {
    const schema = SCHEMAS[name];
    if (!schema) return [];
    return [
      new DynamicStructuredTool({
        name,
        description: describe(name),
        schema,
        func: async (input) => {
          const result = await gateway.execute(name, input);
          return JSON.stringify(result);
        },
      }),
    ];
  });
}

function describe(name: string): string {
  switch (name) {
    case 'list_files':
      return 'List files and directories inside a workspace path.';
    case 'read_file':
      return 'Read a text file from the workspace.';
    case 'git_status':
      return 'Show `git status --porcelain` for the workspace.';
    case 'git_diff':
      return 'Show `git diff` (unstaged by default, or staged) for the workspace.';
    case 'manage_agents':
      return 'Create, list, or update IRC agents in the control plane.';
    default:
      return name;
  }
}
