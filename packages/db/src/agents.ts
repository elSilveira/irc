import { DatabaseSync } from 'node:sqlite';
import { readSchema } from './schema.js';
import { createTaskRepository, type TaskRepository } from './tasks.js';
import { createConversationRepository } from './conversations.js';
import { createTaskEventRepository, type TaskEventRepository } from './task-events.js';
import { createApprovalRepository, type ApprovalRepository } from './approvals.js';
import { createIrcMessageRepository, type IrcMessageRepository } from './messages.js';
import { createProjectRepository, type ProjectRepository } from './projects.js';
import type { Agent, ConversationThread } from './types.js';

export interface Repositories {
  agents: AgentRepository;
  projects: ProjectRepository;
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
  modelProvider?: string;
  modelAuth?: string;
  modelName?: string;
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
  ensureSchemaColumns(database);

  return {
    agents: createAgentRepository(database),
    projects: createProjectRepository(database),
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
      const existing = database.prepare('SELECT id FROM agents WHERE id = ?').get(input.id);
      if (existing) throw new Error(`agent already exists: ${input.id}`);

      database.prepare(`
        INSERT INTO agents (${AGENT_INSERT_COLUMNS})
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.id,
        input.nick,
        input.role,
        'idle',
        input.context,
        input.strengths ?? '',
        input.weaknesses ?? '',
        input.capacity ?? 1,
        input.skills ?? '',
        input.modelProvider ?? '',
        input.modelAuth ?? '',
        input.modelName ?? '',
      );

      return findAgentRow(database, input.id) ?? throwNotFound(input.id);
    },

    findAgent(id) {
      return findAgentRow(database, id);
    },

    listAgents() {
      const rows = database.prepare(`SELECT ${AGENT_COLUMNS} FROM agents ORDER BY created_at`).all() as unknown as Agent[];
      return rows.map((row) => ({ ...row }));
    },

    updateAgent(id, fields) {
      const current = findAgentRow(database, id);
      if (!current) throw new Error(`agent not found: ${id}`);

      const next = { ...current, ...stripUndefined(fields) };
      database.prepare(`
        UPDATE agents
        SET nick = ?, role = ?, status = ?, context = ?, strengths = ?, weaknesses = ?, capacity = ?, skills = ?,
            model_provider = ?, model_auth = ?, model_name = ?
        WHERE id = ?
      `).run(
        next.nick,
        next.role,
        next.status,
        next.context,
        next.strengths,
        next.weaknesses,
        next.capacity,
        next.skills,
        next.modelProvider ?? '',
        next.modelAuth ?? '',
        next.modelName ?? '',
        id,
      );

      return findAgentRow(database, id) ?? throwNotFound(id);
    },

    close: () => database.close(),
  };
}

const AGENT_INSERT_COLUMNS = 'id, nick, role, status, context, strengths, weaknesses, capacity, skills, model_provider, model_auth, model_name';
const AGENT_COLUMNS = 'id, nick, role, status, context, strengths, weaknesses, capacity, skills, model_provider AS modelProvider, model_auth AS modelAuth, model_name AS modelName';

function findAgentRow(database: DatabaseSync, id: string): Agent | null {
  const row = database.prepare(`SELECT ${AGENT_COLUMNS} FROM agents WHERE id = ?`).get(id) as Agent | undefined;
  return row ? { ...row } : null;
}

function ensureSchemaColumns(database: DatabaseSync): void {
  const agentColumns = columnNames(database, 'agents');
  if (!agentColumns.has('strengths')) database.exec("ALTER TABLE agents ADD COLUMN strengths TEXT NOT NULL DEFAULT ''");
  if (!agentColumns.has('weaknesses')) database.exec("ALTER TABLE agents ADD COLUMN weaknesses TEXT NOT NULL DEFAULT ''");
  if (!agentColumns.has('capacity')) database.exec('ALTER TABLE agents ADD COLUMN capacity INTEGER NOT NULL DEFAULT 1');
  if (!agentColumns.has('skills')) database.exec("ALTER TABLE agents ADD COLUMN skills TEXT NOT NULL DEFAULT ''");
  if (!agentColumns.has('model_provider')) database.exec("ALTER TABLE agents ADD COLUMN model_provider TEXT NOT NULL DEFAULT ''");
  if (!agentColumns.has('model_auth')) database.exec("ALTER TABLE agents ADD COLUMN model_auth TEXT NOT NULL DEFAULT ''");
  if (!agentColumns.has('model_name')) database.exec("ALTER TABLE agents ADD COLUMN model_name TEXT NOT NULL DEFAULT ''");

  const taskColumns = columnNames(database, 'tasks');
  if (!taskColumns.has('project_channel')) database.exec('ALTER TABLE tasks ADD COLUMN project_channel TEXT');
  if (!taskColumns.has('workspace')) database.exec('ALTER TABLE tasks ADD COLUMN workspace TEXT');
}

function columnNames(database: DatabaseSync, table: string): Set<string> {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(columns.map((column) => column.name));
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
