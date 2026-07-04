function parseLine(line) {
  const parsed = { prefix: null, command: '', params: [] };
  let rest = line.trimEnd();

  if (rest.startsWith(':')) {
    const space = rest.indexOf(' ');
    parsed.prefix = rest.slice(1, space);
    rest = rest.slice(space + 1);
  }

  const trailingIndex = rest.indexOf(' :');
  const trailing = trailingIndex === -1 ? null : rest.slice(trailingIndex + 2);
  const head = trailingIndex === -1 ? rest : rest.slice(0, trailingIndex);
  const parts = head.split(' ').filter(Boolean);

  parsed.command = parts.shift() || '';
  parsed.params = trailing === null ? parts : [...parts, trailing];
  return parsed;
}

function formatNick(nick) {
  return line(`NICK ${nick}`);
}

function formatUser(user) {
  return line(`USER ${user} 0 * :${user}`);
}

function formatJoin(channel) {
  return line(`JOIN ${channel}`);
}

function formatPrivmsg(target, text) {
  return safeLine(`PRIVMSG ${target} :`, text);
}

function line(text) {
  return `${text}\r\n`;
}

function safeLine(prefix, text) {
  let body = String(text).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  while (Buffer.byteLength(`${prefix}${body}\r\n`, 'utf8') > 512) {
    body = body.slice(0, -1);
  }
  return `${prefix}${body}\r\n`;
}

module.exports = {
  formatJoin,
  formatNick,
  formatPrivmsg,
  formatUser,
  parseLine,
};
