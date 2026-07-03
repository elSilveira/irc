import { canUseCapability } from '@irc/shared';
import type { Tool } from './tool.js';
import type { ToolContext, ToolLogEntry, ToolLogger, ToolResult } from './types.js';

export interface ToolGatewayOptions {
  actor?: string;
  logger?: ToolLogger;
}

export class ToolGateway {
  private readonly tools = new Map<string, Tool>();
  private readonly context: ToolContext;
  private readonly actor: string;
  private readonly logger?: ToolLogger;

  constructor(tools: Tool[], context: ToolContext, options: ToolGatewayOptions = {}) {
    this.context = context;
    this.actor = options.actor ?? 'orchestrator';
    this.logger = options.logger;
    for (const tool of tools) {
      if (this.tools.has(tool.name)) {
        throw new Error(`duplicate tool: ${tool.name}`);
      }
      this.tools.set(tool.name, tool);
    }
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async execute(name: string, input: unknown): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, error: `unknown tool: ${name}` };

    const permission = canUseCapability(this.actor, tool.capability);
    if (!permission.ok) {
      const error = `permission denied for ${tool.capability} (${permission.reason})`;
      this.log({ tool: name, capability: tool.capability, input, ok: false, durationMs: 0, error });
      return { ok: false, error };
    }

    const started = Date.now();
    let result: ToolResult;
    try {
      result = await tool.run(input ?? {}, this.context);
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    this.log({
      tool: name,
      capability: tool.capability,
      input,
      ok: result.ok,
      durationMs: Date.now() - started,
      error: result.error,
    });
    return result;
  }

  private log(entry: ToolLogEntry): void {
    this.logger?.(entry);
  }
}
