export type TaskStatus =
  | 'backlog'
  | 'ready'
  | 'doing'
  | 'blocked'
  | 'review'
  | 'approval'
  | 'done'
  | 'archived'
  | 'failed'
  | 'cancelled';

export type TaskStatusLegacy = 'open';

export type AgentRole = 'manager' | 'coder' | 'qa' | 'researcher' | 'memory' | 'runner' | 'codex';

export type AgentStatus = 'idle' | 'online' | 'offline' | 'busy' | 'disabled';

export type AgentMode = 'no_cli' | 'read_only' | 'safe_execute' | 'write_with_approval';

export interface Agent {
  id: string;
  nick: string;
  role: string;
  status: string;
  context: string;
  capabilities?: string[];
  mode?: AgentMode;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus | TaskStatusLegacy;
  channel: string;
}

export type ProviderName = 'openai' | 'ollama' | 'codex';

export interface ProviderLimits {
  name: ProviderName;
  /** True when the provider is currently unusable due to quota/rate-limit/auth. */
  limited: boolean;
  reason?: string;
}
