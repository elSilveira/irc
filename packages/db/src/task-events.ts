import type { DatabaseSync } from 'node:sqlite';
import type { TaskEventRecord } from './types.js';

export interface TaskEventRepository {
  recordEvent(input: {
    taskId: string;
    actor: string;
    eventType: string;
    content: string;
  }): TaskEventRecord;
  listEvents(taskId: string): TaskEventRecord[];
  latestEventAt(taskId: string): string | null;
  close(): void;
}

export function createTaskEventRepository(database: DatabaseSync): TaskEventRepository {
  return {
    recordEvent({ taskId, actor, eventType, content }) {
      const info = database
        .prepare(
          'INSERT INTO task_events (task_id, actor, event_type, content) VALUES (?, ?, ?, ?)',
        )
        .run(taskId, actor, eventType, content);
      const row = database
        .prepare(
          'SELECT id, task_id, actor, event_type, content, created_at FROM task_events WHERE id = ?',
        )
        .get(Number(info.lastInsertRowid)) as Row;
      return mapRow(row);
    },

    listEvents(taskId) {
      const rows = database
        .prepare(
          'SELECT id, task_id, actor, event_type, content, created_at FROM task_events WHERE task_id = ? ORDER BY id',
        )
        .all(taskId) as Row[];
      return rows.map(mapRow);
    },

    latestEventAt(taskId) {
      const row = database
        .prepare('SELECT created_at FROM task_events WHERE task_id = ? ORDER BY id DESC LIMIT 1')
        .get(taskId) as { created_at?: string } | undefined;
      return row?.created_at ?? null;
    },

    close: () => database.close(),
  };
}

type Row = Record<string, unknown>;

function mapRow(row: Row): TaskEventRecord {
  return {
    id: Number(row.id),
    taskId: String(row.task_id),
    actor: String(row.actor),
    eventType: String(row.event_type),
    content: String(row.content),
    createdAt: String(row.created_at),
  };
}
