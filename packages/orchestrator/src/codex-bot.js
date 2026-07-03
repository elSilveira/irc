const net = require('node:net');
const { createCodexReply } = require('./codex-agent');
const {
  formatJoin,
  formatNick,
  formatPrivmsg,
  formatUser,
  parseLine,
} = require('./irc-lines');

const config = {
  host: process.env.IRC_HOST || '127.0.0.1',
  port: Number(process.env.IRC_PORT || 6667),
  nick: process.env.CODEX_IRC_NICK || 'codex-agent',
  channel: process.env.CODEX_IRC_CHANNEL || '#control',
};

function startCodexBot(options = config) {
  const socket = net.createConnection(options.port, options.host);
  let buffer = '';

  socket.on('connect', () => {
    socket.write(formatNick(options.nick));
    socket.write(formatUser(options.nick));
  });

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\r\n');
    buffer = lines.pop();
    for (const line of lines) {
      handleLine(socket, options, line);
    }
  });

  socket.on('error', (error) => {
    console.error(`codex-agent IRC error: ${error.message}`);
  });

  return socket;
}

function handleLine(socket, options, line) {
  const parsed = parseLine(line);
  if (parsed.command === 'PING') {
    socket.write(`PONG :${parsed.params.at(-1)}\r\n`);
    return;
  }

  if (parsed.command === '001') {
    socket.write(formatJoin(options.channel));
    return;
  }

  if (parsed.command === 'PRIVMSG') {
    const [target, text] = parsed.params;
    const reply = createCodexReply({ text });
    if (reply) {
      socket.write(formatPrivmsg(target, reply));
    }
  }
}

if (require.main === module) {
  startCodexBot();
}

module.exports = {
  handleLine,
  startCodexBot,
};
