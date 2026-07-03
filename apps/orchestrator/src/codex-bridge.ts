import { createRequire } from 'node:module';
import type { CodexClient } from '@irc/llm';

const require = createRequire(import.meta.url);

interface LegacyCodexAppClient {
  generate(input: { prompt: string; threadId?: string }): Promise<{ threadId: string; text: string }>;
  startLogin(): Promise<{ authUrl?: string; verificationUrl?: string; userCode?: string }>;
  close(): void;
}

interface LegacyCodexModule {
  createCodexAppClient(options?: { cwd?: string; timeout?: number; developerInstructions?: string }): LegacyCodexAppClient;
}

const READ_ONLY_INSTRUCTIONS = [
  'You are an IRC control-plane agent operating in a READ-ONLY sandbox.',
  'You MAY inspect the workspace: read files and run read-only commands such as ls, cat, git status, git diff.',
  'You MUST NOT edit files, write, push git, install packages, deploy, browse the network, or access secrets.',
  'Keep answers concise and suitable for IRC.',
].join(' ');

/**
 * Bridge the legacy CommonJS codex-app-client (local `codex app-server`
 * JSON-RPC) into the provider-agnostic runtime. The client connects lazily, so
 * `configured` follows the ORCHESTRATOR_USE_CODEX flag and any failure surfaces
 * from generate(), where the runtime treats it as a recoverable fallback.
 */
export function createCodexBridge(options: { cwd: string; useCodex: boolean }): {
  client: CodexClient;
  legacy?: LegacyCodexAppClient;
} {
  if (!options.useCodex) {
    return { client: { configured: false, async generate() {
      throw new Error('codex disabled by ORCHESTRATOR_USE_CODEX');
    } } };
  }

  let legacy: LegacyCodexAppClient | undefined;
  try {
    const module = loadLegacyCodexModule();
    legacy = module.createCodexAppClient({ cwd: options.cwd, developerInstructions: READ_ONLY_INSTRUCTIONS });
  } catch {
    return { client: { configured: false, async generate() {
      throw new Error('codex app-server client unavailable');
    } } };
  }

  const client: CodexClient = {
    configured: true,
    async generate(input) {
      if (!legacy) throw new Error('codex app-server client unavailable');
      return legacy.generate(input);
    },
    async startLogin() {
      if (!legacy) throw new Error('codex app-server client unavailable');
      return legacy.startLogin();
    },
  };

  return { client, legacy };
}

function loadLegacyCodexModule(): LegacyCodexModule {
  return require('../../../packages/orchestrator/src/codex-app-client.js') as LegacyCodexModule;
}
