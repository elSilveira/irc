const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function createConversationRepository(location) {
  const database = new DatabaseSync(location);
  database.exec(readSchema());

  return {
    saveThread(contextKey, threadId) {
      database.prepare(`
        INSERT INTO codex_conversations (context_key, thread_id)
        VALUES (?, ?)
        ON CONFLICT(context_key) DO UPDATE SET
          thread_id = excluded.thread_id,
          updated_at = CURRENT_TIMESTAMP
      `).run(contextKey, threadId);
    },

    findThread(contextKey) {
      const row = database.prepare(`
        SELECT context_key AS contextKey, thread_id AS threadId
        FROM codex_conversations
        WHERE context_key = ?
      `).get(contextKey);

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
  createConversationRepository,
};
