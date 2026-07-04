import 'dotenv/config';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRepositories } from '@irc/db';
import { type Brain, type BrainContext } from './brain.js';
import { IrcClient, nickFromPrefix, type ParsedLine } from './irc.js';
import { isManagedAgentDirectMessage, routeOrchestratorMessage } from './router.js';
import { handleCommand } from './commands.js';
import { ingestTaskEvent } from './task-events.js';
import { buildGateway, buildRuntime, ensureDatabaseDir } from './factory.js';
import { AgentSupervisor, type AgentSummary } from './supervisor.js';
import { collectHeartbeats, findStaleTasks } from './heartbeat.js';
import { loadConfig } from './config.js';
import { acquireRuntimeGuardian } from './runtime-guardian.js';
import { selectBrain } from './brain-select.js';
import { reconcileManagedAgents } from './agent-reconcile.js';
import { handleQaLifecycle } from './qa-lifecycle.js';
import { buildStartupChannels } from './startup-channels.js';
import { recoverStaleTasks } from './heartbeat-recovery.js';

export async function startOrchestrator(): Promise<IrcClient> {
  const config = loadConfig();
  ensureDatabaseDir(config.database);
  const guardian = acquireRuntimeGuardian({
    lockPath: join(dirname(config.database), `${config.nick}.lock`),
  });
  process.once('exit', () => guardian.release());

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
  const startupChannels = buildStartupChannels({ configured: config.channels, tasks: repos.tasks.listTasks() });
  const startup = supervisor.reconcile(existingAgents, startupChannels);

  console.error(
    `[orchestrator] brain: ${brain.constructor.name} | providers: ${runtime.configuredProviders.join(', ') || '(none)'} | tools: ${gateway.names().join(', ')} | agents online: ${startup.unchanged + startup.started.length}`,
  );

  const irc = new IrcClient({
    host: config.host,
    port: config.port,
    nick: config.nick,
    handlers: {
      onReady: () => {
        for (const channel of startupChannels) irc.join(channel);
        console.error(`[orchestrator] connected, joined ${startupChannels.join(', ')}`);
      },
      onLine: (line) => handlePrivmsg(irc, config, repos, brain, supervisor, line),
      onError: (error) => console.error(`[orchestrator] irc error: ${error.message}`),
    },
  });

  const logsChannel = config.channels.find((c) => c.toLowerCase() === '#logs') ?? config.channels[0] ?? '#control';
  setInterval(() => {
    const stale = findStaleTasks(collectHeartbeats(repos), Date.now(), config.heartbeatStaleMs);
    recoverStaleTasks({ repos, stale, supervisor, irc, logsChannel });
    if (stale.length) console.error(`[heartbeat] ${stale.length} stale task(s)`);
  }, config.heartbeatIntervalMs);

  setInterval(() => {
    reconcileManagedAgents({
      repos,
      supervisor,
      channels: ['#agents'],
      log: (message) => console.error(message),
    });
  }, 2_000);

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
  if (!sender || sender.toLowerCase() === config.nick.toLowerCase()) return;

  const ingested = ingestTaskEvent(text, sender, repos, target);
  if (ingested) {
    handleQaLifecycle({ ingested, repos, supervisor, irc });
    if (ingested.approvalId) {
      irc.privmsg(target, `${ingested.taskId} blocked; waiting for approval. Use @orc approve ${ingested.taskId}.`);
    }
    return;
  }

  if (isManagedAgentDirectMessage({
    botNick: config.nick,
    sender,
    target,
    agentNicks: repos.agents.listAgents().map((agent) => agent.nick),
  })) {
    console.error(`[orchestrator] ignored unstructured DM from managed agent ${sender}`);
    return;
  }

  const routed = routeOrchestratorMessage({ botNick: config.nick, sender, target, text });
  if (routed.kind === 'ignore') return;

  if (routed.kind === 'command' && routed.command) {
    handleCommand(routed.command, { irc, repos, nick: config.nick, channels: config.channels, agentSupervisor: supervisor });
    return;
  }

  if (routed.kind === 'chat' && routed.prompt) {
    const contextKey = target.toLowerCase() === config.nick.toLowerCase()
      ? `orchestrator:dm:${sender}`
      : `orchestrator:channel:${target}`;
    const context: BrainContext = { contextKey, sender, channel: target };

    await answerWithBrain(irc, routed.replyTarget, brain, routed.prompt, context);

    const isDm = target.toLowerCase() === config.nick.toLowerCase();
    reconcileManagedAgents({
      repos,
      supervisor,
      channels: isDm ? ['#agents'] : ['#agents', target],
      greetChannel: isDm ? '#agents' : target,
      log: (message) => console.error(message),
    });
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

function toSummary(agent: { id: string; nick: string; role: string; context: string; skills?: string }): AgentSummary {
  return { id: agent.id, nick: agent.nick, role: agent.role, context: agent.context, skills: agent.skills };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  startOrchestrator().catch((error) => {
    console.error(`[orchestrator] fatal: ${error.message}`);
    process.exitCode = 1;
  });
}
