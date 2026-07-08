import type { Agent, Task } from '@irc/db';

export interface RoutingInput {
  title: string;
  agents: Agent[];
  tasks: Task[];
}

export interface RoutingResult {
  agent: Agent;
  status: 'ready' | 'queued';
  score: number;
}

const ACTIVE = new Set(['ready', 'doing', 'review', 'rdt', 'testing', 'tested']);

export function chooseAgentForTask(input: RoutingInput): RoutingResult | null {
  const candidates = plannerCandidates(input.agents);
  const agents = candidates.length > 0 ? candidates : input.agents;
  const scored = agents
    .map((agent) => ({ agent, score: scoreAgent(input.title, agent) }))
    .sort((a, b) => b.score - a.score || a.agent.id.localeCompare(b.agent.id));

  const best = scored[0];
  if (!best) return null;

  const active = input.tasks.filter(
    (task) => task.assignedTo === best.agent.id && ACTIVE.has(task.status),
  ).length;
  return {
    agent: best.agent,
    score: best.score,
    status: active < best.agent.capacity ? 'ready' : 'queued',
  };
}

export function isPlanningAgent(agent: Pick<Agent, 'id' | 'role' | 'context' | 'skills' | 'strengths'>): boolean {
  const text = tokenize(`${agent.id} ${agent.role} ${agent.context} ${agent.skills} ${agent.strengths}`);
  return text.has('plan') || text.has('planner') || text.has('planning');
}

function plannerCandidates(agents: Agent[]): Agent[] {
  return agents.filter(isPlanningAgent);
}

function scoreAgent(title: string, agent: Agent): number {
  const text = tokenize(`${title} ${agent.role} ${agent.context}`);
  let score = 0;
  for (const strength of split(agent.strengths)) if (text.has(strength)) score += 3;
  for (const weakness of split(agent.weaknesses)) if (text.has(weakness)) score -= 4;
  if (agent.status === 'offline') score -= 2;
  return score;
}

function split(value: string): string[] {
  return value
    .toLowerCase()
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function tokenize(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}
