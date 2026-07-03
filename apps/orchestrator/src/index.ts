import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { createRepositories } from '@irc/db';
import { LangChainBrain, buildSystemPrompt, type Brain, type BrainContext } from './brain.js';
import { CodexBrain } from './codex-brain.js';
import { IrcClient, nickFromPrefix, type ParsedLine } from './irc.js';
import { routeOrchestratorMessage } from './router.js';
import { handleCommand } from './commands.js';
import { buildGateway, buildRuntime, ensureDatabaseDir } from './factory.js';
import { AgentSupervisor, type AgentSummary } from './supervisor.js';
import { loadConfig } from './config.js';

export async function startOrchestrator(): Promise<IrcClient> {
  const config = loadConfig();
  ensureDatabaseDir(config.database);

  const repos = createRepositories(config.database);
  const onSwitch = (event: { from: string; to: string; reason: string }) => {
    console.error(`[runtime] provider fallback ${event.from} -> ${event.to}: ${event.reason}`);
  };
  const { runtime, codexClient } = buildRuntime(config, onSwitch);
  const gateway = buildGateway(config, repos);

  const brain = selectBrain(config, runtime, codexClient, gateway, repos);

  const supervisor = new AgentSupervisor({
    host: config.host,
    port: config.port,
    codex: codexClient,
    conversations: repos.conversations,
    gateway,
    workspace: config.workspace,
    reservedNicks: [config.nick],
  });
  const existingAgents = repos.agents.listAgents().map(toSummary);
  supervisor.spawnAll(existingAgents, ['#agents']);

  console.error(
    `[orchestrator] brain: ${brain.constructor.name} | providers: ${runtime.configuredProviders.join(', ') || '(none)'} | tools: ${gateway.names().join(', ')} | agents online: ${existingAgents.length}`,
  );

  const irc = new IrcClient({
    host: config.host,
    port: config.port,
    nick: config.nick,
    handlers: {
      onReady: () => {
        for (const channel of config.channels) irc.join(channel);
        console.error(`[orchestrator] connected, joined ${config.channels.join(', ')}`);
      },
      onLine: (line) => handlePrivmsg(irc, config, repos, brain, supervisor, line),
      onError: (error) => console.error(`[orchestrator] irc error: ${error.message}`),
    },
  });

  return irc;
}

async function handlePrivmsg(
  irc: IrcClient,
  config: ReturnType<typeof loadConfig>,
  repos: ReturnType<typeof createRepositories>,
  brain: Brain,
  supervisor: AgentSupervisor,
  line: ParsedLine,
): Promise<void> {
  if (line.command !== 'PRIVMSG') return;

  const [target, text] = line.params;
  if (!target || text === undefined) return;
  const sender = nickFromPrefix(line.prefix);

  const routed = routeOrchestratorMessage({ botNick: config.nick, sender, target, text });
  if (routed.kind === 'ignore') return;

  if (routed.kind === 'command' && routed.command) {
    handleCommand(routed.command, { irc, repos, nick: config.nick, channels: config.channels });
    return;
  }

  if (routed.kind === 'chat' && routed.prompt) {
    const contextKey = target.toLowerCase() === config.nick.toLowerCase()
      ? `orchestrator:dm:${sender}`
      : `orchestrator:channel:${target}`;
    const context: BrainContext = { contextKey, sender, channel: target };

    const before = new Set(repos.agents.listAgents().map((agent) => agent.id));
    await answerWithBrain(irc, routed.replyTarget, brain, routed.prompt, context);

    const created = repos.agents
      .listAgents()
      .filter((agent) => !before.has(agent.id))
      .map(toSummary);

    for (const agent of created) {
      const isDm = target.toLowerCase() === config.nick.toLowerCase();
      const channels = isDm ? ['#agents'] : ['#agents', target];
      const greetChannel = isDm ? '#agents' : target;
      supervisor.spawn(agent, channels, greetChannel);
    }
  }
}

async function answerWithBrain(
  irc: IrcClient,
  replyTarget: string,
  brain: Brain,
  prompt: string,
  context: BrainContext,
): Promise<string | undefined> {
  try {
    const output = await brain.respond(prompt, context);
    for (const chunk of chunkLines(output, 400)) {
      irc.privmsg(replyTarget, chunk);
    }
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[orchestrator] brain error: ${message}`);
    irc.privmsg(replyTarget, `I could not process that: ${message}`);
    return undefined;
  }
}

function chunkLines(text: string, size: number): string[] {
  if (text.length <= size) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > size) {
    chunks.push(remaining.slice(0, size));
    remaining = remaining.slice(size);
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

function selectBrain(
  config: ReturnType<typeof loadConfig>,
  runtime: unknown,
  codexClient: { configured: boolean },
  gateway: ReturnType<typeof buildGateway>,
  repos: ReturnType<typeof createRepositories>,
): Brain {
  if (config.providers[0] === 'codex' && codexClient.configured) {
    return new CodexBrain({
      client: codexClient as never,
      gateway,
      conversations: repos.conversations,
      workspace: config.workspace,
    });
  }
  return new LangChainBrain({
    runtime: runtime as never,
    gateway,
    systemPrompt: buildSystemPrompt(`You are connected as IRC nick ${config.nick}.`),
  });
}

function toSummary(agent: { id: string; nick: string; role: string; context: string }): AgentSummary {
  return { id: agent.id, nick: agent.nick, role: agent.role, context: agent.context };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  startOrchestrator().catch((error) => {
    console.error(`[orchestrator] fatal: ${error.message}`);
    process.exitCode = 1;
  });
}
