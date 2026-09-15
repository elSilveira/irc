const { createCodexRpcTransport } = require('./codex-rpc-transport');

const DEVELOPER_INSTRUCTIONS = [
  'This IRC integration uses external IRC_TOOL requests for workspace actions.',
  'You may inspect workspace directories through IRC_TOOL list_files when the orchestrator prompt advertises it.',
  'You may read workspace files through IRC_TOOL read_file when the orchestrator prompt advertises it.',
  'You may edit files through IRC_TOOL write_file when the orchestrator prompt advertises it.',
  'You may run verification through IRC_TOOL run_verification when the prompt advertises it.',
  'Do not directly run shell commands, browse, deploy, push git, install packages, or access secrets.',
  'Emit IRC_TOOL lines only for tools advertised in the current prompt.',
].join(' ');

function createCodexAppClient(options = {}) {
  const cwd = options.cwd || process.cwd();
  const timeout = options.timeout || 30000;
  const developerInstructions = options.developerInstructions || DEVELOPER_INSTRUCTIONS;
  const transport = options.transport || createCodexRpcTransport({ cwd });
  let initializePromise;
  let generateQueue = Promise.resolve();

  async function initialize() {
    if (!initializePromise) {
      initializePromise = (async () => {
        await transport.request('initialize', {
          clientInfo: { name: 'irc-orchestrator', version: '0.0.0' },
          capabilities: {},
        }, timeout);
        await transport.notify('initialized', {});
      })().catch((error) => {
        initializePromise = undefined;
        throw error;
      });
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
    const queued = generateQueue.then(
      () => runGenerate({ prompt, threadId }),
      () => runGenerate({ prompt, threadId }),
    );
    generateQueue = queued.catch(() => {});
    return queued;
  }

  async function runGenerate({ prompt, threadId }) {
    await initialize();
    const targetThreadId = threadId || await startThread();
    const turn = await transport.request('turn/start', {
      threadId: targetThreadId,
      input: [{ type: 'text', text: prompt }],
      sandboxPolicy: { type: 'workspaceWrite', networkAccess: false },
    }, timeout);
    const turnId = requireId(turn, 'turnId', 'turn/start');
    const text = await collectTurnText(targetThreadId, turnId);
    return { threadId: targetThreadId, text };
  }

  async function startThread() {
    const thread = await transport.request('thread/start', {
      cwd,
      sandbox: 'workspace-write',
      approvalPolicy: 'never',
      developerInstructions,
    }, timeout);
    return requireId(thread, 'threadId', 'thread/start');
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

function requireId(result, key, method) {
  const value = readId(result, key);
  if (!value) {
    throw new Error(`${method} did not return a ${key}`);
  }
  return value;
}

function readId(result, key) {
  if (!result) return '';
  if (typeof result[key] === 'string' && result[key]) return result[key];
  const objectKey = key.replace(/Id$/, '');
  const nested = result[objectKey];
  if (nested && typeof nested.id === 'string' && nested.id) return nested.id;
  return '';
}

function matchesTarget(params, threadId, turnId) {
  return params.threadId === threadId && readParamTurnId(params) === turnId;
}

function readParamTurnId(params) {
  if (params.turnId) return params.turnId;
  if (params.turn && params.turn.id) return params.turn.id;
  return '';
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
