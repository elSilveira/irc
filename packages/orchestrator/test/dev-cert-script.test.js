const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

test('trust script imports the dev cert into current user root', () => {
  const script = readFileSync(
    join(__dirname, '../../../scripts/trust-dev-cert.ps1'),
    'utf8',
  );

  assert.match(script, /Import-Certificate/);
  assert.match(script, /Cert:\\CurrentUser\\Root/);
  assert.match(script, /fullchain\.pem/);
});

test('mirc docs explain fixing self-signed certificate verification', () => {
  const readme = readFileSync(
    join(__dirname, '../../../clients/mirc/README.md'),
    'utf8',
  );

  assert.match(readme, /SSL certificate verify failed/);
  assert.match(readme, /trust-dev-cert\.ps1/);
});
