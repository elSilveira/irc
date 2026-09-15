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
  const mentioned = firstMentionedAgent(input.title, input.agents);
  const candidates = mentioned ? [mentioned] : plannerCandidates(input.agents);
  const planningMode = !mentioned && candidates.length > 0;
  const agents = candidates.length > 0 ? candidates : input.agents;
  const scored = agents
    .map((agent) => ({ agent, score: scoreAgent(input.title, agent) + (planningMode ? plannerPriority(agent) : 0) }))
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
  const text = tokenize(`${agent.id} ${agent.role} ${agent.strengths}`);
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

function plannerPriority(agent: Agent): number {
  const exact = [agent.id, agent.nick].map((value) => value.toLowerCase());
  if (exact.includes('plan') || exact.includes('planner')) return 20;
  const role = tokenize(agent.role);
  if (role.has('planner') || role.has('planning')) return 10;
  const strengths = split(agent.strengths);
  return strengths.includes('planning') || strengths.includes('planner') ? 5 : 0;
}

function firstMentionedAgent(title: string, agents: Agent[]): Agent | null {
  for (const mention of title.matchAll(/@([a-z0-9_-]+)/gi)) {
    const agent = bestMentionMatch(mention[1] ?? '', agents);
    if (agent) return agent;
  }
  return null;
}

function bestMentionMatch(raw: string, agents: Agent[]): Agent | null {
  const mention = normalizeAlias(raw);
  return agents
    .map((agent) => ({ agent, score: mentionScore(mention, agent) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.agent.id.localeCompare(b.agent.id))[0]?.agent ?? null;
}

function mentionScore(mention: string, agent: Agent): number {
  const exact = [agent.id, agent.nick].map(normalizeAlias);
  if (exact.includes(mention)) return 100;
  const identity = tokenize(`${agent.id} ${agent.nick} ${agent.role}`).values();
  if ([...identity].map(normalizeAlias).includes(mention)) return 80;
  const skills = split(agent.skills).map(normalizeAlias);
  return skills.includes(mention) ? 50 : 0;
}

function normalizeAlias(value: string): string {
  const lower = value.toLowerCase();
  if (lower === 'testing' || lower === 'tester' || lower === 'tests') return 'test';
  if (lower === 'planning' || lower === 'planner') return 'plan';
  return lower;
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
