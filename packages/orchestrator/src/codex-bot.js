const net = require('node:net');
const { dirname, join } = require('node:path');
const { mkdirSync } = require('node:fs');
const { handleBotServ } = require('./botserv-service');
const { createCodexAppClient } = require('./codex-app-client');
const { createConversationRepository } = require('./conversation-repository');
const { parseCommand } = require('./command-parser');
const {
  formatJoin,
  formatNick,
  formatPrivmsg,
  formatUser,
  parseLine,
} = require('./irc-lines');
const { routeCodexMessage } = require('./message-router');
const { createTaskRepository } = require('./task-repository');

const config = {
  host: process.env.IRC_HOST || '127.0.0.1',
  port: Number(process.env.IRC_PORT || 6667),
  nick: process.env.CODEX_IRC_NICK || 'codex-agent',
  botServNick: process.env.BOTSERV_IRC_NICK || 'BotServ',
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
  if (handleBotServMessage(socket, options, sender, target, text)) return;
  if (handleOrcCommand(socket, options, target, text)) return;
  const routed = routeCodexMessage({
    botNick: options.nick || config.nick,
    sender,
    target,
    text,
  });
  if (!routed.ok) return;
  if (routed.isLogin) {
    const login = await options.codex.startLogin();
    socket.write(formatPrivmsg(replyTarget(target, sender, options.nick), formatLogin(login)));
    return;
  }

  const existing = options.conversations.findThread(routed.contextKey);
  const result = await options.codex.generate({
    prompt: routed.prompt,
    threadId: existing ? existing.threadId : undefined,
  });
  options.conversations.saveThread(routed.contextKey, result.threadId);
  socket.write(formatPrivmsg(replyTarget(target, sender, options.nick), result.text));
}

function createDefaultServices(options) {
  ensureDatabaseDirectory(options.database);
  return {
    conversations: options.conversations || createConversationRepository(options.database),
    codex: options.codex || createCodexAppClient({ cwd: process.cwd() }),
    tasks: options.tasks || createTaskRepository(options.database),
  };
}

function ensureDatabaseDirectory(database) {
  if (!database || database === ':memory:') return;
  mkdirSync(dirname(database), { recursive: true });
}

function nickFromPrefix(prefix) {
  return (prefix || '').split('!')[0];
}

function handleOrcCommand(socket, options, target, text) {
  const parsed = parseCommand(text);
  if (!parsed.ok || parsed.command !== 'new') return false;
  const task = options.tasks.createTask(parsed.args.join(' '));
  socket.write(formatJoin(task.channel));
  socket.write(formatPrivmsg(target, `Created ${task.id} in ${task.channel}.`));
  return true;
}

function handleBotServMessage(socket, options, sender, target, text) {
  if (target.toLowerCase() !== (options.botServNick || 'BotServ').toLowerCase()) {
    return false;
  }
  const result = handleBotServ(text, options);
  for (const channel of result.joins) {
    socket.write(formatJoin(channel));
  }
  for (const reply of result.replies) {
    socket.write(formatPrivmsg(sender, reply));
  }
  return true;
}

function replyTarget(target, sender, botNick = config.nick) {
  return target.toLowerCase() === botNick.toLowerCase() ? sender : target;
}

function formatLogin(login) {
  if (login.authUrl) return `Codex login: ${login.authUrl}`;
  if (login.verificationUrl && login.userCode) {
    return `Codex login: ${login.verificationUrl} code ${login.userCode}`;
  }
  return 'Codex login started. Follow the Codex app-server instructions.';
}

if (require.main === module) {
  startCodexBot();
}

module.exports = {
  handleLine,
  startCodexBot,
};
