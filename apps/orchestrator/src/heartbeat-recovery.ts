import type { Repositories } from '@irc/db';
import type { StaleTask } from './heartbeat.js';

export interface HeartbeatRecoveryServices {
  repos: Repositories;
  stale: StaleTask[];
  supervisor: {
    assignTaskChannel(nick: string, task: { id: string; title: string; channel: string }): boolean;
  };
  irc: { privmsg(target: string, text: string): void };
  logsChannel: string;
}

export function recoverStaleTasks({ repos, stale, supervisor, irc, logsChannel }: HeartbeatRecoveryServices): void {
  for (const staleTask of stale) {
    const task = repos.tasks.findTask(staleTask.taskId);
    if (!task) continue;
    const agentId = task.assignedTo;
    if (!agentId) {
      irc.privmsg(logsChannel, `[heartbeat] ${task.id} stale (${staleTask.reason}); no assigned agent to resume`);
      continue;
    }
    const agent = repos.agents.findAgent(agentId);
    if (!agent) {
      irc.privmsg(logsChannel, `[heartbeat] ${task.id} stale (${staleTask.reason}); assigned agent missing`);
      continue;
    }

    repos.taskEvents.recordEvent({
      taskId: task.id,
      actor: 'orchestrator',
      eventType: 'heartbeat.resume',
      content: `resuming ${agent.nick} after ${staleTask.reason}`,
    });
    const assigned = supervisor.assignTaskChannel(agent.nick, {
      id: task.id,
      channel: task.channel,
      title: resumePrompt(task.title, staleTask.reason),
    });
    irc.privmsg(logsChannel, `[heartbeat] ${task.id} stale (${staleTask.reason}); ${assigned ? 'resuming' : 'resume failed'} ${agent.nick}`);
  }
}

function resumePrompt(title: string, reason: string): string {
  return [
    `Resume this stale task after heartbeat ${reason}: ${title}`,
    'Continue from the last reported step; do not restart from scratch.',
    'Report a fresh [type:wip], then [type:result] and [type:rdt], or [type:blocked] with the exact blocker.',
  ].join('\n');
}
