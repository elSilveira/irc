import { DatabaseSync } from 'node:sqlite';
import { readSchema } from './schema.js';
import { createTaskRepository, type TaskRepository } from './tasks.js';
import { createConversationRepository } from './conversations.js';
import { createTaskEventRepository, type TaskEventRepository } from './task-events.js';
import { createApprovalRepository, type ApprovalRepository } from './approvals.js';
import { createIrcMessageRepository, type IrcMessageRepository } from './messages.js';
import type { Agent, Task, ConversationThread, TaskEventRecord } from './types.js';

export interface Repositories {
  agents: AgentRepository;
  tasks: TaskRepository;
  taskEvents: TaskEventRepository;
  approvals: ApprovalRepository;
  ircMessages: IrcMessageRepository;
  conversations: ConversationRepository;
  close(): void;
}

export interface AgentRepository {
  createAgent(input: AgentInput): Agent;
  findAgent(id: string): Agent | null;
  listAgents(): Agent[];
  updateAgent(id: string, fields: Partial<Omit<Agent, 'id'>>): Agent;
  close(): void;
}

export interface AgentInput {
  id: string;
  nick: string;
  role: string;
  context: string;
  strengths?: string;
  weaknesses?: string;
  capacity?: number;
  skills?: string;
}

export interface ConversationRepository {
  saveThread(contextKey: string, threadId: string): void;
  findThread(contextKey: string): ConversationThread | null;
  close(): void;
}

export function createRepositories(location: string): Repositories {
  const database = new DatabaseSync(location);
  database.exec('PRAGMA busy_timeout = 5000');
  database.exec(readSchema());
  ensureAgentRoutingColumns(database);

  return {
    agents: createAgentRepository(database),
    tasks: createTaskRepository(database),
    taskEvents: createTaskEventRepository(database),
    approvals: createApprovalRepository(database),
    ircMessages: createIrcMessageRepository(database),
    conversations: createConversationRepository(database),
    close: () => database.close(),
  };
}

export function createAgentRepository(database: DatabaseSync): AgentRepository {
  return {
    createAgent(input) {
      const { id, nick, role, context } = input;
      const existing = database.prepare('SELECT id FROM agents WHERE id = ?').get(id);
      if (existing) throw new Error(`agent already exists: ${id}`);

      database.prepare(`
        INSERT INTO agents (id, nick, role, status, context, strengths, weaknesses, capacity, skills)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, nick, role, 'idle', context, input.strengths ?? '', input.weaknesses ?? '', input.capacity ?? 1, input.skills ?? '');

      return findAgentRow(database, id) ?? throwNotFound(id);
    },

    findAgent(id) {
      return findAgentRow(database, id);
    },

    listAgents() {
      const rows = database
        .prepare(`SELECT ${AGENT_COLUMNS} FROM agents ORDER BY created_at`)
        .all() as unknown as Agent[];
      return rows.map((row) => ({ ...row }));
    },

    updateAgent(id, fields) {
      const current = findAgentRow(database, id);
      if (!current) throw new Error(`agent not found: ${id}`);

      const next: Agent = { ...current, ...stripUndefined(fields) };
      database.prepare(`
        UPDATE agents
        SET nick = ?, role = ?, status = ?, context = ?, strengths = ?, weaknesses = ?, capacity = ?, skills = ?
        WHERE id = ?
      `).run(next.nick, next.role, next.status, next.context, next.strengths, next.weaknesses, next.capacity, next.skills, id);

      return findAgentRow(database, id) ?? throwNotFound(id);
    },

    close: () => database.close(),
  };
}

const AGENT_COLUMNS = 'id, nick, role, status, context, strengths, weaknesses, capacity, skills';

function findAgentRow(database: DatabaseSync, id: string): Agent | null {
  const row = database
    .prepare(`SELECT ${AGENT_COLUMNS} FROM agents WHERE id = ?`)
    .get(id) as Agent | undefined;
  return row ? { ...row } : null;
}

function ensureAgentRoutingColumns(database: DatabaseSync): void {
  const columns = database.prepare('PRAGMA table_info(agents)').all() as { name: string }[];
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('strengths')) database.exec("ALTER TABLE agents ADD COLUMN strengths TEXT NOT NULL DEFAULT ''");
  if (!names.has('weaknesses')) database.exec("ALTER TABLE agents ADD COLUMN weaknesses TEXT NOT NULL DEFAULT ''");
  if (!names.has('capacity')) database.exec('ALTER TABLE agents ADD COLUMN capacity INTEGER NOT NULL DEFAULT 1');
  if (!names.has('skills')) database.exec("ALTER TABLE agents ADD COLUMN skills TEXT NOT NULL DEFAULT ''");
}

function throwNotFound(id: string): never {
  throw new Error(`agent not found: ${id}`);
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}
