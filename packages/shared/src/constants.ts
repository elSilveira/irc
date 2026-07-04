export const NICKS = {
  orchestrator: 'orchestrator',
  botService: 'BotService',
  codexAgent: 'helper',
} as const;

export const CHANNELS = {
  control: '#control',
  agents: '#agents',
  logs: '#logs',
} as const;

export const COMMAND_PREFIX = '@orc';
export const ORCHESTRATOR_MENTION = '@orchestrator';

export const DEFAULT_ORCHESTRATOR_PROVIDERS = ['openai', 'ollama', 'codex'] as const;
