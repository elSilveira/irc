export interface AgentSkill {
  id: string;
  title: string;
  description: string;
}

export interface AgentSkillPack {
  id: string;
  skills: string;
  match: string[];
}

export const AGENT_SKILLS: readonly AgentSkill[] = [
  { id: 'implementation', title: 'Implementation', description: 'Builds scoped features and fixes with focused production edits.' },
  { id: 'tdd', title: 'Test-driven development', description: 'Adds or updates tests before implementation changes.' },
  { id: 'repo-editing', title: 'Repository editing', description: 'Reads, writes, and keeps code changes limited to the assigned repo task.' },
  { id: 'qa', title: 'QA', description: 'Validates completed work against the requested behavior.' },
  { id: 'testing', title: 'Testing', description: 'Runs targeted checks and reports actionable failures.' },
  { id: 'review', title: 'Review', description: 'Reviews code for regressions, risks, and missing coverage.' },
  { id: 'orchestration', title: 'Orchestration', description: 'Coordinates agents, task state, and handoffs.' },
  { id: 'planning', title: 'Planning', description: 'Breaks requested work into concrete execution steps.' },
  { id: 'routing', title: 'Routing', description: 'Selects the right agent or channel for incoming work.' },
  { id: 'research', title: 'Research', description: 'Finds project context and supporting references before changes.' },
  { id: 'docs', title: 'Documentation', description: 'Updates written project guidance and user-facing docs.' },
  { id: 'context', title: 'Context', description: 'Collects and preserves relevant task, repo, and conversation context.' },
  { id: 'ops', title: 'Operations', description: 'Handles runtime, deployment, and service operation tasks.' },
  { id: 'logs', title: 'Logs', description: 'Inspects logs and traces to diagnose current behavior.' },
  { id: 'diagnostics', title: 'Diagnostics', description: 'Investigates failures and narrows them to likely causes.' },
];

export const AGENT_SKILL_PACKS: readonly AgentSkillPack[] = [
  { id: 'implementation', skills: 'implementation,tdd,repo-editing', match: ['implement', 'code', 'feature'] },
  { id: 'qa', skills: 'qa,testing,review', match: ['qa', 'test', 'validate', 'review'] },
  { id: 'orchestration', skills: 'orchestration,planning,routing', match: ['manager', 'orchestr', 'route'] },
  { id: 'research', skills: 'research,docs,context', match: ['research', 'readme', 'docs'] },
  { id: 'operations', skills: 'ops,logs,diagnostics', match: ['ops', 'runtime', 'logs'] },
];

export function listAgentSkills(): readonly AgentSkill[] {
  return AGENT_SKILLS;
}

export function listAgentSkillPacks(): string[] {
  return AGENT_SKILL_PACKS.map((pack) => pack.id);
}

export function inferAgentSkills(input: { role: string; context: string }): string {
  const text = `${input.role} ${input.context}`.toLowerCase();
  const pack = AGENT_SKILL_PACKS.find((candidate) => candidate.match.some((word) => text.includes(word)));
  return pack?.skills ?? 'general,communication,context';
}
