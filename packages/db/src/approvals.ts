import type { DatabaseSync } from 'node:sqlite';
import type { ApprovalDecision, ApprovalRecord } from './types.js';

export interface ApprovalRepository {
  requestApproval(input: { taskId: string; requestedBy: string; action: string }): ApprovalRecord;
  resolve(id: string, decision: ApprovalDecision): ApprovalRecord;
  listPending(): ApprovalRecord[];
  findPendingForTask(taskId: string): ApprovalRecord | null;
  close(): void;
}

const PENDING = 'pending';

export function createApprovalRepository(database: DatabaseSync): ApprovalRepository {
  return {
    requestApproval({ taskId, requestedBy, action }) {
      const existing = findPendingRowForTask(database, taskId);
      if (existing) return mapRow(existing);

      const id = nextId(database);
      database.prepare(
        'INSERT INTO approvals (id, task_id, requested_by, action, status) VALUES (?, ?, ?, ?, ?)',
      ).run(id, taskId, requestedBy, action, PENDING);
      return mapRow(findRow(database, id));
    },

    resolve(id, decision) {
      if (!findRow(database, id)) throw new Error(`approval not found: ${id}`);
      database.prepare('UPDATE approvals SET status = ? WHERE id = ?').run(decision, id);
      return mapRow(findRow(database, id));
    },

    listPending() {
      const rows = database
        .prepare(
          'SELECT id, task_id, requested_by, action, status, created_at FROM approvals WHERE status = ? ORDER BY id',
        )
        .all(PENDING) as Row[];
      return rows.map(mapRow);
    },

    findPendingForTask(taskId) {
      const row = findPendingRowForTask(database, taskId);
      return row ? mapRow(row) : null;
    },

    close: () => database.close(),
  };
}

type Row = Record<string, unknown>;

function findRow(database: DatabaseSync, id: string): Row | undefined {
  return database
    .prepare('SELECT id, task_id, requested_by, action, status, created_at FROM approvals WHERE id = ?')
    .get(id) as Row | undefined;
}

function findPendingRowForTask(database: DatabaseSync, taskId: string): Row | undefined {
  return database
    .prepare(
      'SELECT id, task_id, requested_by, action, status, created_at FROM approvals WHERE task_id = ? AND status = ? ORDER BY id DESC LIMIT 1',
    )
    .get(taskId, PENDING) as Row | undefined;
}

function mapRow(row: Row | undefined): ApprovalRecord {
  if (!row) throw new Error('approval not found');
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    requestedBy: String(row.requested_by),
    action: String(row.action),
    status: String(row.status),
    createdAt: String(row.created_at),
  };
}

function nextId(database: DatabaseSync): string {
  const row = database.prepare('SELECT COUNT(*) AS count FROM approvals').get() as { count: number };
  return `APR-${String((row?.count ?? 0) + 1).padStart(4, '0')}`;
}
