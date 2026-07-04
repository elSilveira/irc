const packs = Object.freeze([
  { id: 'implementation', skills: 'implementation,tdd,repo-editing', match: ['implement', 'code', 'feature'] },
  { id: 'qa', skills: 'qa,testing,review', match: ['qa', 'test', 'validate', 'review'] },
  { id: 'orchestration', skills: 'orchestration,planning,routing', match: ['manager', 'orchestr', 'route'] },
  { id: 'research', skills: 'research,docs,context', match: ['research', 'readme', 'docs'] },
  { id: 'operations', skills: 'ops,logs,diagnostics', match: ['ops', 'runtime', 'logs'] },
]);

function listAgentSkillPacks() {
  return packs.map((pack) => pack.id);
}

function inferAgentSkills(input) {
  const text = `${input.role || ''} ${input.context || ''}`.toLowerCase();
  const pack = packs.find((candidate) => candidate.match.some((word) => text.includes(word)));
  return pack ? pack.skills : 'general,communication,context';
}

function skillPackGuide(args, parseFlags) {
  if ((args[0] || '').toUpperCase() !== 'CREATE' || !args[1]) return ['Usage: SKILLPACK CREATE <id> --skills a,b --match words'];
  const flags = parseFlags(args.slice(2));
  if (!flags.skills || !flags.match) return ['SKILLPACK CREATE requires --skills and --match'];
  return [`Skill pack draft: ${args[1]}`, `skills=${flags.skills}`, `match=${flags.match}`, `Add it to agent-skills catalog, then use --skills ${flags.skills}`];
}

module.exports = {
  inferAgentSkills,
  listAgentSkillPacks,
  skillPackGuide,
};
