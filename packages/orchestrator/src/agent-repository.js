const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function createAgentRepository(location) {
  const database = new DatabaseSync(location);
  database.exec(readSchema());

  return {
    createAgent(agent) {
      if (this.findAgent(agent.id)) {
        throw new Error(`agent already exists: ${agent.id}`);
      }

      database.prepare(`
        INSERT INTO agents (id, nick, role, status, context)
        VALUES (?, ?, ?, ?, ?)
      `).run(agent.id, agent.nick, agent.role, 'idle', agent.context);

      return this.findAgent(agent.id);
    },

    findAgent(id) {
      const row = database.prepare(`
        SELECT id, nick, role, status, context
        FROM agents
        WHERE id = ?
      `).get(id);

      return row ? { ...row } : null;
    },

    close() {
      database.close();
    },
  };
}

function readSchema() {
  return readFileSync(join(__dirname, '../../../db/schema.sql'), 'utf8');
}

module.exports = {
  createAgentRepository,
};
