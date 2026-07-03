import { firstTaskId, nextTaskId, taskChannel } from '@irc/shared';
import type { DatabaseSync } from 'node:sqlite';
import type { Task } from './types.js';

export function createTaskRepository(database: DatabaseSync) {
  return {
    createTask(title: string): Task {
      assertTitle(title);
      const id = nextId(database);
      const channel = taskChannel(id);

      database.prepare(`
        INSERT INTO tasks (id, title, status, channel)
        VALUES (?, ?, ?, ?)
      `).run(id, title, 'open', channel);

      return { id, title, status: 'open', channel };
    },

    listTasks(): Task[] {
      const rows = database
        .prepare('SELECT id, title, status, channel FROM tasks ORDER BY id')
        .all() as unknown as Task[];
      return rows.map((row) => ({ ...row }));
    },

    close: () => database.close(),
  };
}

function nextId(database: DatabaseSync): string {
  const row = database.prepare('SELECT id FROM tasks ORDER BY id DESC LIMIT 1').get() as
    | { id: string }
    | undefined;
  return row?.id ? nextTaskId(row.id) : firstTaskId();
}

function assertTitle(title: unknown): void {
  if (typeof title !== 'string' || title.trim() === '') {
    throw new Error('title is required');
  }
}
