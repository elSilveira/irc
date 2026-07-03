import { DatabaseSync } from 'node:sqlite';
import { readSchema } from './schema.js';
import { createTaskRepository } from './tasks.js';
import { createConversationRepository } from './conversations.js';
import type { Agent, Task, ConversationThread } from './types.js';

export interface Repositories {
  agents: AgentRepository;
  tasks: TaskRepository;
  conversations: ConversationRepository;
  close(): void;
}

export interface AgentRepository {
  createAgent(input: { id: string; nick: string; role: string; context: string }): Agent;
  findAgent(id: string): Agent | null;
  listAgents(): Agent[];
  updateAgent(id: string, fields: Partial<Pick<Agent, 'nick' | 'role' | 'status' | 'context'>>): Agent;
  close(): void;
}

export interface TaskRepository {
  createTask(title: string): Task;
  listTasks(): Task[];
  close(): void;
}

export interface ConversationRepository {
  saveThread(contextKey: string, threadId: string): void;
  findThread(contextKey: string): ConversationThread | null;
  close(): void;
}

export function createRepositories(location: string): Repositories {
  const database = new DatabaseSync(location);
  database.exec(readSchema());

  return {
    agents: createAgentRepository(database),
    tasks: createTaskRepository(database),
    conversations: createConversationRepository(database),
    close: () => database.close(),
  };
}

export function createAgentRepository(database: DatabaseSync): AgentRepository {
  return {
    createAgent({ id, nick, role, context }) {
      const existing = database.prepare('SELECT id FROM agents WHERE id = ?').get(id);
      if (existing) throw new Error(`agent already exists: ${id}`);

      database.prepare(`
        INSERT INTO agents (id, nick, role, status, context)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, nick, role, 'idle', context);

      return findAgentRow(database, id) ?? throwNotFound(id);
    },

    findAgent(id) {
      return findAgentRow(database, id);
    },

    listAgents() {
      const rows = database
        .prepare('SELECT id, nick, role, status, context FROM agents ORDER BY created_at')
        .all() as unknown as Agent[];
      return rows.map((row) => ({ ...row }));
    },

    updateAgent(id, fields) {
      const current = findAgentRow(database, id);
      if (!current) throw new Error(`agent not found: ${id}`);

      const next: Agent = { ...current, ...stripUndefined(fields) };
      database.prepare(`
        UPDATE agents
        SET nick = ?, role = ?, status = ?, context = ?
        WHERE id = ?
      `).run(next.nick, next.role, next.status, next.context, id);

      return findAgentRow(database, id) ?? throwNotFound(id);
    },

    close: () => database.close(),
  };
}

function findAgentRow(database: DatabaseSync, id: string): Agent | null {
  const row = database
    .prepare('SELECT id, nick, role, status, context FROM agents WHERE id = ?')
    .get(id) as Agent | undefined;
  return row ? { ...row } : null;
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
