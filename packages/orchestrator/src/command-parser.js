const COMMAND_PREFIX = '@orc';

function parseCommand(message) {
  const text = message.trim();
  if (!text.startsWith(COMMAND_PREFIX)) {
    return { ok: false, reason: 'missing_prefix' };
  }

  const rest = text.slice(COMMAND_PREFIX.length).trim();
  if (!rest) {
    return { ok: false, reason: 'missing_command' };
  }

  const tokens = tokenize(rest);
  const [command, ...args] = tokens;
  return { ok: true, command, args };
}

function tokenize(text) {
  const tokens = [];
  let current = '';
  let inQuote = false;

  for (const char of text) {
    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }

    if (char === ' ' && !inQuote) {
      pushToken(tokens, current);
      current = '';
      continue;
    }

    current += char;
  }

  pushToken(tokens, current);
  return tokens;
}

function pushToken(tokens, value) {
  const token = value.trim();
  if (token) {
    tokens.push(token);
  }
}

module.exports = {
  parseCommand,
};
