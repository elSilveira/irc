const { createCodexRpcTransport } = require('./codex-rpc-transport');

const DEVELOPER_INSTRUCTIONS = [
  'This IRC integration is chat-only and read-only.',
  'Do not run shell commands, edit files, use git, browse, deploy, or access secrets.',
].join(' ');

function createCodexAppClient(options = {}) {
  const cwd = options.cwd || process.cwd();
  const timeout = options.timeout || 30000;
  const transport = options.transport || createCodexRpcTransport({ cwd });
  let initializePromise;

  async function initialize() {
    if (!initializePromise) {
      initializePromise = (async () => {
        await transport.request('initialize', {
          clientInfo: { name: 'irc-orchestrator', version: '0.0.0' },
          capabilities: {},
        }, timeout);
        await transport.notify('initialized', {});
      })();
    }
    return initializePromise;
  }

  async function readAccount() {
    await initialize();
    return transport.request('account/read', { refreshToken: true }, timeout);
  }

  async function startLogin() {
    await initialize();
    return transport.request('account/login/start', { type: 'chatgpt' }, timeout);
  }

  async function generate({ prompt, threadId }) {
    await initialize();
    const targetThreadId = threadId || await startThread();
    const turn = await transport.request('turn/start', {
      threadId: targetThreadId,
      input: [{ type: 'text', text: prompt }],
      sandboxPolicy: { type: 'readOnly', networkAccess: false },
    }, timeout);
    const turnId = getId(turn, 'turnId');
    const text = await collectTurnText(targetThreadId, turnId);
    return { threadId: targetThreadId, text };
  }

  async function startThread() {
    const thread = await transport.request('thread/start', {
      cwd,
      sandbox: 'read-only',
      approvalPolicy: 'never',
      developerInstructions: DEVELOPER_INSTRUCTIONS,
    }, timeout);
    return getId(thread, 'threadId');
  }

  async function collectTurnText(threadId, turnId) {
    let text = '';
    for (;;) {
      const notification = await transport.nextNotification(timeout);
      const params = notification.params || {};
      if (!matchesTarget(params, threadId, turnId)) continue;

      if (notification.method === 'error') {
        throw new Error(readErrorMessage(params));
      }
      if (notification.method === 'item/agentMessage/delta') {
        text += params.delta || params.text || '';
      }
      if (notification.method === 'turn/completed') {
        return text;
      }
    }
  }

  function close() {
    if (transport.close) transport.close();
  }

  return {
    readAccount,
    startLogin,
    generate,
    close,
  };
}

function getId(result, key) {
  if (!result) return undefined;
  return result[key] || result.id;
}

function matchesTarget(params, threadId, turnId) {
  if (params.threadId && threadId && params.threadId !== threadId) return false;
  if (params.turnId && turnId && params.turnId !== turnId) return false;
  return true;
}

function readErrorMessage(params) {
  if (params.message) return params.message;
  if (params.error && params.error.message) return params.error.message;
  if (typeof params.error === 'string') return params.error;
  return 'Codex app-server turn failed';
}

module.exports = {
  createCodexAppClient,
};
