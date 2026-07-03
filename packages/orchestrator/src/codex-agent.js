function createCodexReply(message) {
  const text = message.text.trim();
  if (!text.toLowerCase().startsWith('@codex')) {
    return null;
  }

  const body = text.slice('@codex'.length).trim();
  if (!body || body === 'help') {
    return 'Commands: @codex status | @codex help | @codex echo <text>. v0 is chat-only.';
  }

  if (body === 'status') {
    return 'codex-agent online. Mode: deterministic chat-only bridge; no shell, files, git, browser, or deploy access.';
  }

  if (body.startsWith('echo ')) {
    return body.slice('echo '.length);
  }

  return 'codex-agent v0 heard you. Use @codex help for available commands.';
}

module.exports = {
  createCodexReply,
};
