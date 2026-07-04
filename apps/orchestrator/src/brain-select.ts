import type { createRepositories } from '@irc/db';
import { LangChainBrain, buildSystemPrompt, type Brain } from './brain.js';
import { CodexBrain } from './codex-brain.js';
import type { buildGateway } from './factory.js';
import type { loadConfig } from './config.js';

export function selectBrain(
  config: ReturnType<typeof loadConfig>,
  runtime: unknown,
  codexClient: { configured: boolean },
  gateway: ReturnType<typeof buildGateway>,
  repos: ReturnType<typeof createRepositories>,
): Brain {
  if (config.providers[0] === 'codex' && codexClient.configured) {
    return new CodexBrain({
      client: codexClient as never,
      gateway,
      conversations: repos.conversations,
      workspace: config.workspace,
    });
  }
  return new LangChainBrain({
    runtime: runtime as never,
    gateway,
    systemPrompt: buildSystemPrompt(`You are connected as IRC nick ${config.nick}.`),
  });
}
