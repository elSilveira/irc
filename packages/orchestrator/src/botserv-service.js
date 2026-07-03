function handleBotServ(text, services) {
  const [command, ...args] = tokenize(text);
  const normalized = (command || 'HELP').toUpperCase();

  if (normalized === 'HELP') {
    return response(helpLines());
  }

  if (normalized === 'AGENTS') {
    return response(['Agents: codex-agent']);
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
    'BotService commands:',
    'HELP - show this guide',
    'NEW <title> - create TASK-0001 and join #task-0001',
    'AGENTS - list available agents',
    'Codex chat: use @codex <message> in a channel or /msg codex-agent <message>',
  ];
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

module.exports = {
  handleBotServ,
};
