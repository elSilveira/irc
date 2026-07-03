function routeCodexMessage({ botNick, sender, target, text }) {
  const raw = text.trim();
  const isDm = target.toLowerCase() === botNick.toLowerCase();
  const hasPrefix = raw.toLowerCase().startsWith('@codex');

  if (!isDm && !hasPrefix) return { ok: false };

  const prompt = hasPrefix ? raw.slice('@codex'.length).trim() : raw;

  return {
    ok: true,
    contextKey: isDm ? `dm:${sender}` : `channel:${target}`,
    prompt,
    isLogin: prompt.toLowerCase() === 'login',
  };
}

module.exports = { routeCodexMessage };
