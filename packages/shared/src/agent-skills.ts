export interface AgentSkillPack {
  id: string;
  skills: string;
  match: string[];
}

export const AGENT_SKILL_PACKS: readonly AgentSkillPack[] = [
  { id: 'implementation', skills: 'implementation,tdd,repo-editing', match: ['implement', 'code', 'feature'] },
  { id: 'qa', skills: 'qa,testing,review', match: ['qa', 'test', 'validate', 'review'] },
  { id: 'orchestration', skills: 'orchestration,planning,routing', match: ['manager', 'orchestr', 'route'] },
  { id: 'research', skills: 'research,docs,context', match: ['research', 'readme', 'docs'] },
  { id: 'operations', skills: 'ops,logs,diagnostics', match: ['ops', 'runtime', 'logs'] },
];

export function listAgentSkillPacks(): string[] {
  return AGENT_SKILL_PACKS.map((pack) => pack.id);
}

export function inferAgentSkills(input: { role: string; context: string }): string {
  const text = `${input.role} ${input.context}`.toLowerCase();
  const pack = AGENT_SKILL_PACKS.find((candidate) => candidate.match.some((word) => text.includes(word)));
  return pack?.skills ?? 'general,communication,context';
}
