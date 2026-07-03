function formatAgentMessage(message) {
  const taskId = requireValue(message.taskId, 'taskId');
  const agent = requireValue(message.agent, 'agent');
  const status = requireValue(message.status, 'status');
  const body = requireValue(message.body, 'body');

  return `[${taskId}] [${agent}] [status:${status}]\n${body}`;
}

function requireValue(value, name) {
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

module.exports = {
  formatAgentMessage,
};
