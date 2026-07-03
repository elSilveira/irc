import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import {
  createOpenAIProvider,
  createOllamaProvider,
  createCodexProvider,
  AgentRuntime,
  type Provider,
  type ProviderSwitchCallback,
  type CodexClient,
} from '@irc/llm';
import type { ProviderName } from '@irc/shared';
import { createRepositories, type Repositories } from '@irc/db';
import {
  ToolGateway,
  listFilesTool,
  readFileTool,
  gitStatusTool,
  gitDiffTool,
  manageAgentsTool,
} from '@irc/tools';
import { loadConfig, type OrchestratorConfig } from './config.js';
import { createCodexBridge } from './codex-bridge.js';

export interface RuntimeBundle {
  runtime: AgentRuntime;
  providers: Provider[];
  codexClient: CodexClient;
  onSwitch?: ProviderSwitchCallback;
}

export function buildRuntime(
  config: OrchestratorConfig,
  onSwitch?: ProviderSwitchCallback,
): RuntimeBundle {
  const codexBridge = createCodexBridge({ cwd: config.workspace, useCodex: config.useCodex });
  const providers: Provider[] = [];

  for (const name of config.providers) {
    providers.push(createProvider(name, config, codexBridge.client));
  }

  const runtime = new AgentRuntime({ providers, order: config.providers, onSwitch });
  return { runtime, providers, codexClient: codexBridge.client };
}

function createProvider(name: ProviderName, config: OrchestratorConfig, codexClient: CodexClient): Provider {
  switch (name) {
    case 'openai':
      return createOpenAIProvider();
    case 'ollama':
      return createOllamaProvider();
    case 'codex':
      return createCodexProvider(codexClient);
    default:
      throw new Error(`unknown provider: ${name}`);
  }
}

export function buildGateway(config: OrchestratorConfig, repos: Repositories): ToolGateway {
  return new ToolGateway(
    [listFilesTool, readFileTool, gitStatusTool, gitDiffTool, manageAgentsTool],
    { workspaceRoot: config.workspace, agents: repos.agents },
    {
      actor: config.nick,
      logger: (entry) => {
        const status = entry.ok ? 'ok' : 'FAIL';
        console.error(`[tool] ${entry.tool} ${status} ${entry.durationMs}ms${entry.error ? ` :: ${entry.error}` : ''}`);
      },
    },
  );
}

export function ensureDatabaseDir(database: string): void {
  if (!database || database === ':memory:') return;
  mkdirSync(dirname(database), { recursive: true });
}
