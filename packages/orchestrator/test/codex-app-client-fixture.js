function createQueueTransport(handlers = {}) {
  const calls = [];
  const notifications = [];
  const waiters = [];

  function push(notification) {
    if (waiters.length > 0) {
      waiters.shift()(notification);
      return;
    }
    notifications.push(notification);
  }

  return {
    calls,
    push,
    async request(method, params) {
      calls.push({ type: 'request', method, params });
      if (handlers[method]) return handlers[method](params, calls);
      if (method === 'initialize') return { protocolVersion: 1 };
      if (method === 'account/login/start') return { authUrl: 'https://example.com/auth' };
      if (method === 'account/read') return { id: 'acct_1' };
      if (method === 'thread/start') return { thread: { id: 'thr_1' } };
      if (method === 'turn/start') return { turn: { id: 'turn_1' } };
      throw new Error(`unexpected request: ${method}`);
    },
    async notify(method, params) {
      calls.push({ type: 'notify', method, params });
    },
    nextNotification() {
      if (notifications.length > 0) return Promise.resolve(notifications.shift());
      return new Promise((resolve) => waiters.push(resolve));
    },
  };
}

function countCalls(transport, method) {
  return transport.calls.filter((call) => call.method === method).length;
}

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

module.exports = {
  countCalls,
  createQueueTransport,
  tick,
};
