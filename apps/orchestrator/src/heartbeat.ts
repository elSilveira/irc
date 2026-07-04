import type { Repositories } from '@irc/db';

export interface TaskHeartbeat {
  taskId: string;
  status: string;
  lastEventAt: number | null;
}

export interface StaleTask {
  taskId: string;
  reason: 'no_heartbeat' | 'stale_wip';
}

const ACTIVE_STATUS = 'doing';

/**
 * Collect heartbeat signals for tasks that are expected to emit progress
 * events (currently `doing`). `lastEventAt` is epoch ms or null when the task
 * has no recorded events.
 */
export function collectHeartbeats(repos: Repositories): TaskHeartbeat[] {
  return repos.tasks
    .listTasks()
    .filter((task) => task.status === ACTIVE_STATUS)
    .map((task) => ({
      taskId: task.id,
      status: task.status,
      lastEventAt: parseDbTimestamp(repos.taskEvents.latestEventAt(task.id)),
    }));
}

/**
 * Pure staleness check: a `doing` task is stale when it has no heartbeat at all
 * or its last event is older than `staleAfterMs`. Tasks in other states are
 * ignored.
 */
export function findStaleTasks(
  heartbeats: TaskHeartbeat[],
  now: number,
  staleAfterMs: number,
): StaleTask[] {
  const stale: StaleTask[] = [];
  for (const beat of heartbeats) {
    if (beat.status !== ACTIVE_STATUS) continue;
    if (beat.lastEventAt === null) {
      stale.push({ taskId: beat.taskId, reason: 'no_heartbeat' });
      continue;
    }
    if (now - beat.lastEventAt > staleAfterMs) {
      stale.push({ taskId: beat.taskId, reason: 'stale_wip' });
    }
  }
  return stale;
}

/** Parse a SQLite `CURRENT_TIMESTAMP` ("YYYY-MM-DD HH:MM:SS", UTC) to epoch ms. */
export function parseDbTimestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(`${value.replace(' ', 'T')}Z`);
  return Number.isNaN(parsed) ? null : parsed;
}
