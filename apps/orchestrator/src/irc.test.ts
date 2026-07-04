import { test } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './irc.js';

test('format.privmsg removes embedded line breaks', () => {
  assert.equal(
    format.privmsg('#control', 'first\r\nsecond\nthird'),
    'PRIVMSG #control :first second third\r\n',
  );
});

test('format.privmsg limits one IRC command line to 512 bytes', () => {
  const line = format.privmsg('#control', 'x'.repeat(600));
  assert.ok(Buffer.byteLength(line, 'utf8') <= 512);
  assert.match(line, /^PRIVMSG #control :x+\r\n$/);
});
