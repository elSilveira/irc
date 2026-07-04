import { firstTaskId, nextTaskId, taskChannel } from '@irc/shared';
import type { DatabaseSync } from 'node:sqlite';
import type { Task } from './types.js';

export interface TaskRepository {
  createTask(title: string): Task;
  findTask(id: string): Task | null;
  listTasks(): Task[];
  updateStatus(id: string, status: string): Task;
  assignTask(id: string, assignedTo: string, status?: string): Task;
  close(): void;
}

const TASK_COLUMNS = 'id, title, status, channel, assigned_to AS assignedTo';

export function createTaskRepository(database: DatabaseSync): TaskRepository {
  return {
    createTask(title) {
      assertTitle(title);
      const id = nextId(database);
      const channel = taskChannel(id);

      database.prepare(`
        INSERT INTO tasks (id, title, status, channel)
        VALUES (?, ?, ?, ?)
      `).run(id, title, 'open', channel);

      return { id, title, status: 'open', channel, assignedTo: null };
    },

    findTask(id) {
      const row = database
        .prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`)
        .get(id) as Task | undefined;
      return row ? { ...row } : null;
    },

    listTasks() {
      const rows = database
        .prepare(`SELECT ${TASK_COLUMNS} FROM tasks ORDER BY id`)
        .all() as unknown as Task[];
      return rows.map((row) => ({ ...row }));
    },

    updateStatus(id, status) {
      const current = database
        .prepare('SELECT id FROM tasks WHERE id = ?')
        .get(id) as { id: string } | undefined;
      if (!current) throw new Error(`task not found: ${id}`);
      database.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
      return findTaskRow(database, id);
    },

    assignTask(id, assignedTo, status = 'ready') {
      const current = database
        .prepare('SELECT id FROM tasks WHERE id = ?')
        .get(id) as { id: string } | undefined;
      if (!current) throw new Error(`task not found: ${id}`);
      database
        .prepare('UPDATE tasks SET assigned_to = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(assignedTo, status, id);
      return findTaskRow(database, id);
    },

    close: () => database.close(),
  };
}

function findTaskRow(database: DatabaseSync, id: string): Task {
  const row = database
    .prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`)
    .get(id) as Task | undefined;
  if (!row) throwTaskNotFound(id);
  return { ...row };
}

function throwTaskNotFound(id: string): never {
  throw new Error(`task not found: ${id}`);
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
