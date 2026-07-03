const net = require('node:net');
const { dirname, join } = require('node:path');
const { mkdirSync } = require('node:fs');
const { createCodexAppClient } = require('./codex-app-client');
const { createConversationRepository } = require('./conversation-repository');
const {
  formatJoin,
  formatNick,
  formatPrivmsg,
  formatUser,
  parseLine,
} = require('./irc-lines');
const { routeCodexMessage } = require('./message-router');

const config = {
  host: process.env.IRC_HOST || '127.0.0.1',
  port: Number(process.env.IRC_PORT || 6667),
  nick: process.env.CODEX_IRC_NICK || 'codex-agent',
  channel: process.env.CODEX_IRC_CHANNEL || '#control',
  database: process.env.CODEX_IRC_DB || join(process.cwd(), 'data', 'orchestrator.sqlite'),
};

function startCodexBot(options = config) {
  const settings = { ...config, ...options };
  const services = { ...settings, ...createDefaultServices(settings) };
  const socket = net.createConnection(settings.port, settings.host);
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
      handleLine(socket, services, line).catch((error) => {
        console.error(`codex-agent handler error: ${error.message}`);
      });
    }
  });

  socket.on('error', (error) => {
    console.error(`codex-agent IRC error: ${error.message}`);
  });

  return socket;
}

async function handleLine(socket, options, line) {
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
    await handlePrivmsg(socket, options, parsed.prefix, target, text);
  }
}

async function handlePrivmsg(socket, options, prefix, target, text) {
  const sender = nickFromPrefix(prefix);
  const routed = routeCodexMessage({
    botNick: options.nick || config.nick,
    sender,
    target,
    text,
  });
  if (!routed.ok) return;

  const existing = options.conversations.findThread(routed.contextKey);
  const result = await options.codex.generate({
    prompt: routed.prompt,
    threadId: existing ? existing.threadId : undefined,
  });
  options.conversations.saveThread(routed.contextKey, result.threadId);
  socket.write(formatPrivmsg(replyTarget(target, sender, options.nick), result.text));
}

function createDefaultServices(options) {
  if (options.conversations && options.codex) {
    return {};
  }
  ensureDatabaseDirectory(options.database);
  return {
    conversations: options.conversations || createConversationRepository(options.database),
    codex: options.codex || createCodexAppClient({ cwd: process.cwd() }),
  };
}

function ensureDatabaseDirectory(database) {
  if (!database || database === ':memory:') return;
  mkdirSync(dirname(database), { recursive: true });
}

function nickFromPrefix(prefix) {
  return (prefix || '').split('!')[0];
}

function replyTarget(target, sender, botNick = config.nick) {
  return target.toLowerCase() === botNick.toLowerCase() ? sender : target;
}

if (require.main === module) {
  startCodexBot();
}

module.exports = {
  handleLine,
  startCodexBot,
};
