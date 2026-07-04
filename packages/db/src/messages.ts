import type { DatabaseSync } from 'node:sqlite';
import type { IrcMessageRecord } from './types.js';

export interface IrcMessageRepository {
  recordMessage(input: {
    channel: string;
    sender: string;
    message: string;
    taskId: string | null;
  }): IrcMessageRecord;
  listMessages(taskId: string): IrcMessageRecord[];
  close(): void;
}

const COLUMNS = 'id, channel, sender, message, task_id AS taskId, created_at AS createdAt';

export function createIrcMessageRepository(database: DatabaseSync): IrcMessageRepository {
  return {
    recordMessage({ channel, sender, message, taskId }) {
      const info = database
        .prepare('INSERT INTO irc_messages (channel, sender, message, task_id) VALUES (?, ?, ?, ?)')
        .run(channel, sender, message, taskId);
      return mapRow(
        database.prepare(`SELECT ${COLUMNS} FROM irc_messages WHERE id = ?`).get(Number(info.lastInsertRowid)) as Row,
      );
    },

    listMessages(taskId) {
      const rows = database
        .prepare(`SELECT ${COLUMNS} FROM irc_messages WHERE task_id = ? ORDER BY id`)
        .all(taskId) as Row[];
      return rows.map(mapRow);
    },

    close: () => database.close(),
  };
}

type Row = Record<string, unknown>;

function mapRow(row: Row): IrcMessageRecord {
  return {
    id: Number(row.id),
    channel: String(row.channel),
    sender: String(row.sender),
    message: String(row.message),
    taskId: row.taskId === null || row.taskId === undefined ? null : String(row.taskId),
    createdAt: String(row.createdAt),
  };
}
