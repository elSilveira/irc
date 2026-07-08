import type { DatabaseSync } from 'node:sqlite';
import type { Project } from './types.js';

export interface ProjectInput {
  channel: string;
  name?: string;
  workspace: string;
}

export interface ProjectRepository {
  connectChannelProject(input: ProjectInput): Project;
  findByChannel(channel: string): Project | null;
  listProjects(): Project[];
  close(): void;
}

const PROJECT_COLUMNS = 'channel, name, workspace';

export function createProjectRepository(database: DatabaseSync): ProjectRepository {
  return {
    connectChannelProject(input) {
      const channel = normalizeChannel(input.channel);
      const workspace = requireValue(input.workspace, 'workspace');
      const name = (input.name?.trim() || channel.slice(1));

      database.prepare(`
        INSERT INTO projects (channel, name, workspace)
        VALUES (?, ?, ?)
        ON CONFLICT(channel) DO UPDATE SET
          name = excluded.name,
          workspace = excluded.workspace,
          updated_at = CURRENT_TIMESTAMP
      `).run(channel, name, workspace);

      return findProjectRow(database, channel) ?? fail(`project not found: ${channel}`);
    },

    findByChannel(channel) {
      return findProjectRow(database, normalizeChannel(channel));
    },

    listProjects() {
      const rows = database
        .prepare(`SELECT ${PROJECT_COLUMNS} FROM projects ORDER BY channel`)
        .all() as unknown as Project[];
      return rows.map((row) => ({ ...row }));
    },

    close: () => database.close(),
  };
}

function findProjectRow(database: DatabaseSync, channel: string): Project | null {
  const row = database
    .prepare(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE lower(channel) = lower(?)`)
    .get(channel) as Project | undefined;
  return row ? { ...row } : null;
}

function normalizeChannel(channel: string): string {
  const value = requireValue(channel, 'channel');
  if (!value.startsWith('#')) throw new Error('channel must start with #');
  return value.toLowerCase();
}

function requireValue(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${field} is required`);
  return value.trim();
}

function fail(message: string): never {
  throw new Error(message);
}
