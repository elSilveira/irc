const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

test('defines initial control-plane tables', () => {
  const schemaPath = join(__dirname, '../../../db/schema.sql');
  const schema = readFileSync(schemaPath, 'utf8');

  for (const table of [
    'agents',
    'tasks',
    'task_events',
    'irc_messages',
    'approvals',
    'artifacts',
  ]) {
    assert.match(schema, new RegExp(`CREATE TABLE ${table}`));
  }
});

test('stores durable agent context', () => {
  const schemaPath = join(__dirname, '../../../db/schema.sql');
  const schema = readFileSync(schemaPath, 'utf8');

  assert.match(schema, /context TEXT NOT NULL/);
});
