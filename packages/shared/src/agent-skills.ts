export interface AgentSkill {
  id: string;
  title: string;
  description: string;
}

export interface AgentSkillPack {
  id: string;
  skills: string;
  match: string[];
  tools: string[];
  graphNode: string;
}

export interface AgentSpecializationInput {
  id?: string;
  nick?: string;
  role: string;
  context: string;
  skills?: string;
}

export interface AgentGraphRoute {
  node: string;
  chainPrefix: string;
  channelScope: string;
  ragScope: string;
}

const READ_TOOLS = ['list_files', 'read_file', 'git_status', 'git_diff'];

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
  { id: 'implementation', skills: 'implementation,tdd,repo-editing', match: ['implement', 'code', 'feature', 'fix'], tools: [...READ_TOOLS, 'write_file', 'run_verification'], graphNode: 'implementation' },
  { id: 'qa', skills: 'qa,testing,review', match: ['qa', 'test', 'validate', 'review'], tools: [...READ_TOOLS, 'run_verification'], graphNode: 'qa' },
  { id: 'orchestration', skills: 'orchestration,planning,routing', match: ['manager', 'orchestr', 'route', 'plan'], tools: [...READ_TOOLS, 'manage_agents'], graphNode: 'orchestration' },
  { id: 'research', skills: 'research,docs,context', match: ['research', 'readme', 'docs', 'context'], tools: ['list_files', 'read_file', 'git_status', 'git_diff'], graphNode: 'research' },
  { id: 'operations', skills: 'ops,logs,diagnostics', match: ['ops', 'runtime', 'logs', 'diagnose'], tools: ['list_files', 'read_file', 'git_status', 'git_diff', 'run_verification'], graphNode: 'operations' },
];

export function listAgentSkills(): readonly AgentSkill[] {
  return AGENT_SKILLS;
}

export function listAgentSkillPacks(): string[] {
  return AGENT_SKILL_PACKS.map((pack) => pack.id);
}

export function normalizeAgentSkills(value?: string): string {
  return normalizeSkills(value).join(',');
}

export function validateAgentSkills(value?: string): string[] {
  const known = new Set(AGENT_SKILLS.map((skill) => skill.id));
  return normalizeSkills(value).filter((skill) => !known.has(skill));
}

export function inferAgentSkills(input: { role: string; context: string }): string {
  return findSkillPack(input)?.skills ?? 'research,docs,context';
}

export function inferAgentTools(input: AgentSpecializationInput): string[] {
  const pack = findSkillPack(input);
  if (pack) return [...pack.tools];
  const skills = skillSet(input);
  const tools = new Set<string>(['list_files', 'read_file']);
  if (hasAny(skills, ['repo-editing', 'implementation'])) tools.add('write_file');
  if (hasAny(skills, ['tdd', 'testing', 'qa', 'ops', 'diagnostics'])) tools.add('run_verification');
  if (hasAny(skills, ['orchestration', 'routing', 'planning'])) tools.add('manage_agents');
  return [...tools];
}

export function inferAgentGraphRoute(input: AgentSpecializationInput): AgentGraphRoute {
  const pack = findSkillPack(input);
  const skills = normalizeSkills(input.skills || pack?.skills || inferAgentSkills(input));
  const node = pack?.graphNode ?? skills[0] ?? 'research';
  const nick = input.nick || input.id || 'agent';
  return {
    node,
    chainPrefix: `agent:${nick}`,
    channelScope: `#${node}`,
    ragScope: skills.join(':'),
  };
}

function findSkillPack(input: { role: string; context: string; skills?: string }): AgentSkillPack | undefined {
  const skills = normalizeSkills(input.skills);
  const explicit = AGENT_SKILL_PACKS.find((pack) => normalizeSkills(pack.skills).every((skill) => skills.includes(skill)));
  if (explicit) return explicit;
  const text = `${input.role} ${input.context}`.toLowerCase();
  return AGENT_SKILL_PACKS.find((candidate) => candidate.match.some((word) => text.includes(word)));
}

function skillSet(input: { role: string; context: string; skills?: string }): Set<string> {
  return new Set(normalizeSkills(input.skills || inferAgentSkills(input)));
}

function normalizeSkills(value?: string): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const part of (value ?? '').toLowerCase().split(/[;,]/).map((item) => item.trim()).filter(Boolean)) {
    if (!seen.has(part)) {
      seen.add(part);
      normalized.push(part);
    }
  }
  return normalized;
}

function hasAny(values: Set<string>, expected: string[]): boolean {
  return expected.some((value) => values.has(value));
}
