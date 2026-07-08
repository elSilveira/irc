import type { Agent, Repositories, Task } from '@irc/db';

export interface TaskQueueSupervisor {
  assignTaskChannel(nick: string, task: { id: string; title: string; channel: string; workspace?: string | null }): boolean;
}

export function startNextQueuedTaskForAgent(input: {
  repos: Repositories;
  supervisor: TaskQueueSupervisor;
  agent: Agent;
}): Task | null {
  const queued = input.repos.tasks
    .listTasks()
    .find((task) => task.status === 'queued' && task.assignedTo === input.agent.id);
  if (!queued) return null;

  const next = input.repos.tasks.assignTask(queued.id, input.agent.id, 'ready');
  input.repos.taskEvents.recordEvent({
    taskId: next.id,
    actor: 'orchestrator',
    eventType: 'assign',
    content: `started queued task for ${input.agent.nick}`,
  });
  input.supervisor.assignTaskChannel(input.agent.nick, next);
  return next;
}
