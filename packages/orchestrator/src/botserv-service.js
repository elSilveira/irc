const { inferAgentSkills, listAgentSkillPacks, skillPackGuide } = require('./agent-skills');
const { helpLines } = require('./botserv-help');
const { createServiceOps } = require('./service-ops');

const MODEL_PROVIDERS = ['codex', 'openai', 'ollama', 'glm-5.2-z-ai'];
const MODEL_AUTHS = ['login', 'api-key', 'local'];

function handleBotServ(text, services) {
  const [command, ...args] = tokenize(text);
  const normalized = (command || 'HELP').toUpperCase();

  if (normalized === 'HELP') return response(helpLines(args[0]));
  if (normalized === 'AGENTS') return response(listAgents(services.agents));
  if (normalized === 'SHOW') return response(showAgent(args[0], services.agents));
  if (normalized === 'SKILLS') return response(['Skills', ...listAgentSkillPacks()]);
  if (normalized === 'SKILLPACK') return response(skillPackGuide(args, parseFlags));
  if (normalized === 'CREATE') return response(createAgent(args, services.agents));
  if (normalized === 'UPDATE') return response(updateAgent(args, services.agents));
  if (normalized === 'MODEL') return response(updateModel(args, services.agents));
  if (normalized === 'DELETE') return response(deleteAgent(args[0], services.agents));
  if (normalized === 'BUILD') return response(runOps(['build'], services.ops));
  if (normalized === 'RESTART') return response(runOps(['restart'], services.ops));
  if (normalized === 'DEPLOY') return response(runOps(['deploy'], services.ops));

  if (normalized === 'NEW') {
    const task = services.tasks.createTask(args.join(' '));
    return { ok: true, joins: [task.channel], replies: [`Created ${task.id} in ${task.channel}.`] };
  }

  return response(helpLines());
}

function runOps(actions, ops = createServiceOps()) {
  const replies = [];
  for (const action of actions) {
    const result = ops.run(action);
    replies.push(result.message);
    if (!result.ok) break;
  }
  return replies;
}

function listAgents(repository) {
  const managed = repository ? repository.listAgents() : [];
  return ['Agents', ...managed.map(formatAgent), 'helper | user command bridge'];
}

function showAgent(id, repository) {
  if (!id) return ['SHOW requires id'];
  const agent = repository.findAgent(id);
  if (!agent) return [`Agent not found: ${id}`];
  return [formatAgent(agent), routeLine(agent), modelLine(agent), skillsLine(agent), `context=${agent.context}`].filter(Boolean);
}

function createAgent(args, repository) {
  const id = args[0];
  const flags = parseFlags(args.slice(1));
  if (!id || !flags.nick || !flags.role || !flags.context) {
    return ['CREATE requires id, --nick, --role, and --context'];
  }
  const modelError = validateModelFlags(flags);
  if (modelError) return [modelError];
  const agent = repository.createAgent(cleanFields({
    id,
    nick: flags.nick,
    role: flags.role,
    context: flags.context,
    strengths: flags.strengths,
    weaknesses: flags.weaknesses,
    capacity: parseCapacity(flags.capacity),
    skills: flags.skills || inferAgentSkills(flags),
    modelProvider: flags.model || flags.provider,
    modelAuth: flags.auth,
    modelName: flags['model-name'] || flags.name,
  }));
  return [`OK created ${agent.id} | nick=${agent.nick} | role=${agent.role}`];
}

function updateAgent(args, repository) {
  const id = args[0];
  const flags = parseFlags(args.slice(1));
  if (!id) return ['UPDATE requires id'];
  if (!hasUpdateFlags(flags)) return ['UPDATE requires --nick, --role, --context, --skills, or route fields'];
  const modelError = validateModelFlags(flags);
  if (modelError) return [modelError];
  repository.updateAgent(id, cleanFields({
    nick: flags.nick,
    role: flags.role,
    context: flags.context,
    strengths: flags.strengths,
    weaknesses: flags.weaknesses,
    capacity: parseCapacity(flags.capacity),
    skills: flags.skills,
    modelProvider: flags.model || flags.provider,
    modelAuth: flags.auth,
    modelName: flags['model-name'] || flags.name,
  }));
  return [`OK updated ${id}`];
}

function updateModel(args, repository) {
  const id = args[0];
  const flags = parseFlags(args.slice(1));
  if (!id) return ['MODEL requires id'];
  const modelError = validateModelFlags(flags);
  if (modelError) return [modelError];
  const provider = flags.provider || flags.model || '';
  const auth = flags.auth || '';
  const name = flags.name || flags['model-name'] || '';
  if (!provider && !auth && !name) return ['MODEL requires --provider, --auth, or --name'];
  repository.updateAgent(id, cleanFields({ modelProvider: provider, modelAuth: auth, modelName: name }));
  return [`OK model ${id} | provider=${provider || '-'} | auth=${auth || '-'} | name=${name || '-'}`];
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

function modelLine(agent) {
  if (!agent.modelProvider && !agent.modelAuth && !agent.modelName) return null;
  return `model=${agent.modelProvider || '-'} ${agent.modelAuth || '-'} ${agent.modelName || '-'}`;
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
    if (char === '"') { inQuote = !inQuote; continue; }
    if (char === ' ' && !inQuote) { push(tokens, current); current = ''; continue; }
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
    if (key && key.startsWith('--') && value) flags[key.slice(2)] = value;
  }
  return flags;
}

function hasUpdateFlags(flags) {
  return ['role', 'context', 'nick', 'strengths', 'weaknesses', 'capacity', 'skills', 'model', 'provider', 'auth', 'model-name', 'name']
    .some((key) => flags[key]);
}

function validateModelFlags(flags) {
  const provider = flags.provider || flags.model;
  if (provider && !MODEL_PROVIDERS.includes(provider)) return 'MODEL provider must be codex, openai, ollama, or glm-5.2-z-ai';
  if (flags.auth && !MODEL_AUTHS.includes(flags.auth)) return 'MODEL auth must be login, api-key, or local';
  return null;
}

function cleanFields(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== ''));
}

function parseCapacity(value) {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

module.exports = { handleBotServ };
