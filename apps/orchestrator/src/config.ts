import { join } from 'node:path';
import type { ProviderName } from '@irc/shared';

export interface OrchestratorConfig {
  host: string;
  port: number;
  nick: string;
  channels: string[];
  database: string;
  workspace: string;
  providers: ProviderName[];
  useCodex: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): OrchestratorConfig {
  return {
    host: env.IRC_HOST ?? '127.0.0.1',
    port: Number(env.IRC_PORT ?? 6667),
    nick: env.ORCHESTRATOR_NICK ?? 'orchestrator',
    channels: parseChannels(env.ORCHESTRATOR_CHANNELS, ['#control', '#agents', '#logs']),
    database: env.ORCHESTRATOR_DB ?? join(process.cwd(), 'data', 'orchestrator.sqlite'),
    workspace: env.ORCHESTRATOR_WORKSPACE ?? process.cwd(),
    providers: parseProviders(env.ORCHESTRATOR_PROVIDERS, ['openai', 'ollama', 'codex']),
    useCodex: parseBool(env.ORCHESTRATOR_USE_CODEX, true),
  };
}

function parseChannels(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(',')
    .map((channel) => channel.trim())
    .filter(Boolean);
}

function parseProviders(value: string | undefined, fallback: ProviderName[]): ProviderName[] {
  if (!value) return fallback;
  const known: ProviderName[] = ['openai', 'ollama', 'codex'];
  return value
    .split(',')
    .map((provider) => provider.trim().toLowerCase() as ProviderName)
    .filter((provider) => known.includes(provider));
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}
