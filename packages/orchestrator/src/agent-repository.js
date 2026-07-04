const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function createAgentRepository(location) {
  const database = new DatabaseSync(location);
  database.exec('PRAGMA busy_timeout = 5000');
  database.exec(readSchema());
  ensureAgentRoutingColumns(database);

  return {
    createAgent(agent) {
      if (this.findAgent(agent.id)) {
        throw new Error(`agent already exists: ${agent.id}`);
      }

      database.prepare(`
        INSERT INTO agents (id, nick, role, status, context, strengths, weaknesses, capacity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        agent.id,
        agent.nick,
        agent.role,
        'idle',
        agent.context,
        agent.strengths || '',
        agent.weaknesses || '',
        agent.capacity || 1,
      );

      return this.findAgent(agent.id);
    },

    findAgent(id) {
      const row = database.prepare(`
        SELECT ${AGENT_COLUMNS}
        FROM agents
        WHERE id = ?
      `).get(id);

      return row ? { ...row } : null;
    },

    listAgents() {
      return database.prepare(`
        SELECT ${AGENT_COLUMNS}
        FROM agents
        ORDER BY created_at
      `).all().map((row) => ({ ...row }));
    },

    updateAgent(id, fields) {
      const current = this.findAgent(id);
      if (!current) {
        throw new Error(`agent not found: ${id}`);
      }

      const next = { ...current, ...stripUndefined(fields) };
      database.prepare(`
        UPDATE agents
        SET nick = ?, role = ?, status = ?, context = ?, strengths = ?, weaknesses = ?, capacity = ?
        WHERE id = ?
      `).run(next.nick, next.role, next.status, next.context, next.strengths, next.weaknesses, next.capacity, id);

      return this.findAgent(id);
    },

    deleteAgent(id) {
      const result = database.prepare('DELETE FROM agents WHERE id = ?').run(id);
      return result.changes > 0;
    },

    close() {
      database.close();
    },
  };
}

const AGENT_COLUMNS = 'id, nick, role, status, context, strengths, weaknesses, capacity';

function ensureAgentRoutingColumns(database) {
  const names = new Set(database.prepare('PRAGMA table_info(agents)').all().map((column) => column.name));
  if (!names.has('strengths')) database.exec("ALTER TABLE agents ADD COLUMN strengths TEXT NOT NULL DEFAULT ''");
  if (!names.has('weaknesses')) database.exec("ALTER TABLE agents ADD COLUMN weaknesses TEXT NOT NULL DEFAULT ''");
  if (!names.has('capacity')) database.exec('ALTER TABLE agents ADD COLUMN capacity INTEGER NOT NULL DEFAULT 1');
}

function stripUndefined(fields) {
  const clean = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (value !== undefined) clean[key] = value;
  }
  return clean;
}

function readSchema() {
  return readFileSync(join(__dirname, '../../../db/schema.sql'), 'utf8');
}

module.exports = {
  createAgentRepository,
};
