import type { createRepositories } from '@irc/db';
import type { AgentSupervisor, AgentSummary } from './supervisor.js';

export interface ReconcileAgentsInput {
  repos: ReturnType<typeof createRepositories>;
  supervisor: AgentSupervisor;
  channels: string[];
  greetChannel?: string;
  log?: (message: string) => void;
}

export function reconcileManagedAgents(input: ReconcileAgentsInput): void {
  const diff = input.supervisor.reconcile(
    input.repos.agents.listAgents().map(toSummary),
    input.channels,
    input.greetChannel,
  );
  if (!diff.started.length && !diff.stopped.length) return;

  const parts: string[] = [];
  if (diff.started.length) parts.push(`+${diff.started.join(', ')}`);
  if (diff.stopped.length) parts.push(`-${diff.stopped.join(', ')}`);
  input.log?.(`[orchestrator] reconcile ${parts.join(' ')}`);
}

function toSummary(agent: { id: string; nick: string; role: string; context: string }): AgentSummary {
  return { id: agent.id, nick: agent.nick, role: agent.role, context: agent.context };
}
