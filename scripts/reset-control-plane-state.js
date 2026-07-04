const { DatabaseSync } = require('node:sqlite');

const databasePath = process.argv[2] ?? 'data/orchestrator.sqlite';
const tables = [
  'task_events',
  'irc_messages',
  'approvals',
  'artifacts',
  'tasks',
  'agents',
  'codex_conversations',
];

const database = new DatabaseSync(databasePath);

try {
  database.exec(tables.map((table) => `DELETE FROM ${table};`).join('\n'));
  database.exec(
    "DELETE FROM sqlite_sequence WHERE name IN ('task_events', 'irc_messages', 'artifacts');",
  );

  for (const table of tables) {
    const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
    console.log(`${table}=${row.count}`);
  }
} finally {
  database.close();
}
