const { parseCommand } = require('./command-parser');

function handleCommand(message, services) {
  const parsed = parseCommand(message);
  if (!parsed.ok) {
    return parsed;
  }

  if (parsed.command === 'agent' && parsed.args[0] === 'create') {
    return createAgent(parsed.args.slice(1), services.agents);
  }

  return { ok: false, reason: 'unknown_command' };
}

function createAgent(args, repository) {
  const id = args[0];
  const flags = parseFlags(args.slice(1));

  if (!id || !flags.nick || !flags.role || !flags.context) {
    return { ok: false, reason: 'missing_required_agent_fields' };
  }

  const agent = repository.createAgent({
    id,
    nick: flags.nick,
    role: flags.role,
    context: flags.context,
  });

  return {
    ok: true,
    message: `Created agent ${agent.id} with role ${agent.role}.`,
  };
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

module.exports = {
  handleCommand,
};
