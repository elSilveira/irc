const { inferAgentSkills, listAgentSkillPacks, skillPackGuide } = require('./agent-skills');

function handleBotServ(text, services) {
  const [command, ...args] = tokenize(text);
  const normalized = (command || 'HELP').toUpperCase();

  if (normalized === 'HELP') {
    return response(helpLines());
  }

  if (normalized === 'AGENTS') {
    return response(listAgents(services.agents));
  }

  if (normalized === 'SHOW') {
    return response(showAgent(args[0], services.agents));
  }

  if (normalized === 'SKILLS') {
    return response(['Skills', ...listAgentSkillPacks()]);
  }

  if (normalized === 'SKILLPACK') {
    return response(skillPackGuide(args, parseFlags));
  }

  if (normalized === 'CREATE') {
    return response(createAgent(args, services.agents));
  }

  if (normalized === 'UPDATE') {
    return response(updateAgent(args, services.agents));
  }

  if (normalized === 'DELETE') {
    return response(deleteAgent(args[0], services.agents));
  }

  if (normalized === 'NEW') {
    const task = services.tasks.createTask(args.join(' '));
    return {
      ok: true,
      joins: [task.channel],
      replies: [`Created ${task.id} in ${task.channel}.`],
    };
  }

  return response(helpLines());
}

function helpLines() {
  return [
    'BotService',
    'HELP | AGENTS | SHOW <id> | DELETE <id> | SKILLS',
    'NEW "title" -> create task channel',
    'CREATE <id> --nick <nick> --role <role>',
    '  --context "text"',
    '  [--strengths a,b] [--weaknesses x] [--capacity n] [--skills a,b]',
    'SKILLPACK CREATE <id> --skills a,b --match words',
    'UPDATE <id> [--nick n] [--role r]',
    '  [--context "text"]',
    'Codex: @codex <message> or /msg codex-agent <message>',
  ];
}

function listAgents(repository) {
  const managed = repository ? repository.listAgents() : [];
  return [
    'Agents',
    ...managed.map(formatAgent),
    'codex-agent | legacy bridge',
  ];
}

function showAgent(id, repository) {
  if (!id) return ['SHOW requires id'];
  const agent = repository.findAgent(id);
  if (!agent) return [`Agent not found: ${id}`];
  return routeLine(agent) ? [formatAgent(agent), routeLine(agent), skillsLine(agent), `context=${agent.context}`].filter(Boolean) : [
    formatAgent(agent),
    skillsLine(agent),
    `context=${agent.context}`,
  ].filter(Boolean);
}

function createAgent(args, repository) {
  const id = args[0];
  const flags = parseFlags(args.slice(1));
  if (!id || !flags.nick || !flags.role || !flags.context) {
    return ['CREATE requires id, --nick, --role, and --context'];
  }
  const agent = repository.createAgent({
    id,
    nick: flags.nick,
    role: flags.role,
    context: flags.context,
    strengths: flags.strengths,
    weaknesses: flags.weaknesses,
    capacity: parseCapacity(flags.capacity),
    skills: flags.skills || inferAgentSkills(flags),
  });
  return [`OK created ${agent.id} | nick=${agent.nick} | role=${agent.role}`];
}

function updateAgent(args, repository) {
  const id = args[0];
  const flags = parseFlags(args.slice(1));
  if (!id) return ['UPDATE requires id'];
  if (!flags.role && !flags.context && !flags.nick && !flags.strengths && !flags.weaknesses && !flags.capacity && !flags.skills) {
    return ['UPDATE requires --nick, --role, --context, --skills, or route fields'];
  }
  repository.updateAgent(id, cleanFields({
    nick: flags.nick,
    role: flags.role,
    context: flags.context,
    strengths: flags.strengths,
    weaknesses: flags.weaknesses,
    capacity: parseCapacity(flags.capacity),
    skills: flags.skills,
  }));
  return [`OK updated ${id}`];
}

function deleteAgent(id, repository) {
  if (!id) return ['DELETE requires id'];
  return repository.deleteAgent(id) ? [`OK deleted ${id}`] : [`Agent not found: ${id}`];
}

function formatAgent(agent) {
  return `${agent.id} | nick=${agent.nick} | role=${agent.role} | status=${agent.status}`;
}

function routeLine(agent) {
  if (!agent.strengths && !agent.weaknesses && !agent.capacity) return null;
  return `route strengths=${agent.strengths || '-'} | weaknesses=${agent.weaknesses || '-'} | capacity=${agent.capacity || 1}`;
}

function skillsLine(agent) {
  return agent.skills ? `skills=${agent.skills}` : null;
}


function response(replies) {
  return { ok: true, joins: [], replies };
}

function tokenize(text) {
  const tokens = [];
  let current = '';
  let inQuote = false;

  for (const char of text.trim()) {
    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (char === ' ' && !inQuote) {
      push(tokens, current);
      current = '';
      continue;
    }
    current += char;
  }

  push(tokens, current);
  return tokens;
}

function push(tokens, value) {
  const token = value.trim();
  if (token) tokens.push(token);
}

function parseFlags(args) {
  const flags = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (key && key.startsWith('--') && value) {
      flags[key.slice(2)] = value;
    }
  }
  return flags;
}

function cleanFields(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

function parseCapacity(value) {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

module.exports = {
  handleBotServ,
};
