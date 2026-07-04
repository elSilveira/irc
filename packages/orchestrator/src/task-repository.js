const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { firstTaskId, nextTaskId, taskChannel } = require('./task-ids');

function createTaskRepository(location) {
  const database = new DatabaseSync(location);
  database.exec('PRAGMA busy_timeout = 5000');
  database.exec(readSchema());

  return {
    createTask(title) {
      assertTitle(title);
      const id = nextId(database);
      const channel = taskChannel(id);

      database.prepare(`
        INSERT INTO tasks (id, title, status, channel)
        VALUES (?, ?, ?, ?)
      `).run(id, title, 'open', channel);

      return { id, title, status: 'open', channel };
    },

    close() {
      database.close();
    },
  };
}

function nextId(database) {
  const row = database.prepare(`
    SELECT id FROM tasks ORDER BY id DESC LIMIT 1
  `).get();

  return row ? nextTaskId(row.id) : firstTaskId();
}

function assertTitle(title) {
  if (typeof title !== 'string' || title.trim() === '') {
    throw new Error('title is required');
  }
}

function readSchema() {
  return readFileSync(join(__dirname, '../../../db/schema.sql'), 'utf8');
}

module.exports = {
  createTaskRepository,
};
