const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const repoRoot = join(__dirname, '../../..');

test('publishes local plaintext IRC only on host loopback', () => {
  const compose = readFileSync(join(repoRoot, 'compose.yaml'), 'utf8');

  assert.match(compose, /"127\.0\.0\.1:6667:6667\/tcp"/);
  assert.match(compose, /"6697:6697\/tcp"/);
});

test('ergo listens on container plaintext port for local mapping', () => {
  const config = readFileSync(join(repoRoot, 'config/ergo/ircd.yaml'), 'utf8');

  assert.match(config, /":6667":/);
});

test('mirc local shortcut avoids self-signed TLS verification', () => {
  const script = readFileSync(join(repoRoot, 'clients/mirc/eduardoirc.mrc'), 'utf8');

  assert.match(script, /server -m 127\.0\.0\.1:6667/);
});
