const { spawn } = require('node:child_process');
const readline = require('node:readline');

function createCodexRpcTransport(options = {}) {
  const spawnConfig = createCodexSpawnConfig(options);
  const child = options.child || spawn(spawnConfig.command, spawnConfig.args, {
    cwd: options.cwd,
    env: options.env || process.env,
    shell: spawnConfig.shell,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const pending = new Map();
  const notifications = [];
  const waiters = [];
  const stderrLimit = options.stderrLimit || 4096;
  let nextId = 1;
  let closed = false;
  let stderr = '';

  const lines = readline.createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    if (!line.trim()) return;
    try {
      handleMessage(JSON.parse(line));
    } catch (error) {
      rejectAll(withDiagnostics(new Error(
        `Invalid JSON from codex app-server: ${error.message}`,
      )));
    }
  });
  lines.once('error', (error) => rejectAll(withDiagnostics(error)));
  child.stdout.once('error', (error) => rejectAll(withDiagnostics(error)));
  child.stdin.once('error', (error) => rejectAll(withDiagnostics(error)));
  child.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk.toString('utf8')}`.slice(-stderrLimit);
  });
  child.once('error', (error) => rejectAll(withDiagnostics(error)));
  child.once('exit', (code, signal) => {
    rejectAll(withDiagnostics(new Error(
      `codex app-server exited${formatExit(code, signal)}`,
    )));
  });

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

  function write(message, onError = () => {}) {
    if (closed) throw new Error('codex app-server transport is closed');
    try {
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`, onError);
    } catch (error) {
      onError(error);
    }
  }

  function request(method, params, timeout = 30000) {
    const id = nextId;
    nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeout);
      pending.set(id, { resolve, reject, timer });
      try {
        write({ id, method, params }, (error) => {
          if (!error || !pending.has(id)) return;
          pending.delete(id);
          clearTimeout(timer);
          reject(error);
        });
      } catch (error) {
        pending.delete(id);
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  async function notify(method, params) {
    return new Promise((resolve, reject) => {
      try {
        write({ method, params }, (error) => {
          if (error) reject(error);
          else resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
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

  function withDiagnostics(error) {
    if (!stderr) return error;
    return new Error(`${error.message}\nstderr:\n${stderr.trimEnd()}`);
  }

  return {
    request,
    notify,
    nextNotification,
    close,
  };
}

function createCodexSpawnConfig(options = {}) {
  const platform = options.platform || process.platform;
  const command = options.command || defaultCodexCommand(platform);
  return {
    command,
    args: options.args || ['app-server'],
    shell: options.shell ?? platform === 'win32',
  };
}

function defaultCodexCommand(platform) {
  return platform === 'win32' ? 'codex.cmd' : 'codex';
}

function formatExit(code, signal) {
  if (code !== null && code !== undefined) return ` with code ${code}`;
  if (signal) return ` with signal ${signal}`;
  return '';
}

module.exports = {
  createCodexRpcTransport,
  createCodexSpawnConfig,
};
