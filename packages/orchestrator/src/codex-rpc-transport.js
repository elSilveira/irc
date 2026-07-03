const { spawn } = require('node:child_process');
const readline = require('node:readline');

function createCodexRpcTransport(options = {}) {
  const child = options.child || spawn(
    options.command || 'codex',
    options.args || ['app-server'],
    {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  const pending = new Map();
  const notifications = [];
  const waiters = [];
  let nextId = 1;
  let closed = false;

  const lines = readline.createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    if (!line.trim()) return;
    handleMessage(JSON.parse(line));
  });
  child.once('error', rejectAll);
  child.once('exit', () => rejectAll(new Error('codex app-server exited')));

  function handleMessage(message) {
    if (Object.prototype.hasOwnProperty.call(message, 'id')) {
      settleRequest(message);
      return;
    }
    if (waiters.length > 0) {
      waiters.shift().resolve(message);
      return;
    }
    notifications.push(message);
  }

  function settleRequest(message) {
    const pendingRequest = pending.get(message.id);
    if (!pendingRequest) return;
    pending.delete(message.id);
    clearTimeout(pendingRequest.timer);
    if (message.error) {
      pendingRequest.reject(new Error(message.error.message || 'JSON-RPC error'));
      return;
    }
    pendingRequest.resolve(message.result);
  }

  function rejectAll(error) {
    closed = true;
    for (const pendingRequest of pending.values()) {
      clearTimeout(pendingRequest.timer);
      pendingRequest.reject(error);
    }
    pending.clear();
    while (waiters.length > 0) {
      waiters.shift().reject(error);
    }
  }

  function write(message) {
    if (closed) throw new Error('codex app-server transport is closed');
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
  }

  function request(method, params, timeout = 30000) {
    const id = nextId;
    nextId += 1;
    write({ id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeout);
      pending.set(id, { resolve, reject, timer });
    });
  }

  async function notify(method, params) {
    write({ method, params });
  }

  function nextNotification(timeout = 30000) {
    if (notifications.length > 0) {
      return Promise.resolve(notifications.shift());
    }
    return new Promise((resolve, reject) => {
      const waiter = {
        resolve: (message) => {
          clearTimeout(waiter.timer);
          resolve(message);
        },
        reject: (error) => {
          clearTimeout(waiter.timer);
          reject(error);
        },
      };
      waiter.timer = setTimeout(() => {
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error('Timed out waiting for notification'));
      }, timeout);
      waiters.push(waiter);
    });
  }

  function close() {
    closed = true;
    lines.close();
    if (typeof child.kill === 'function') child.kill();
  }

  return {
    request,
    notify,
    nextNotification,
    close,
  };
}

module.exports = {
  createCodexRpcTransport,
};
