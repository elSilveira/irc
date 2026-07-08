const allowedCapabilities = Object.freeze([
  'read_channel',
  'reply',
  'receive_assignment',
  'update_status',
  'ask_context',
  'summarize',
  'propose_action',
  'service_restart',
  'docker_update',
]);

const blockedCapabilities = Object.freeze([
  'shell',
  'filesystem',
  'git',
  'browser',
  'deploy',
  'secrets',
  'local_scripts',
]);

function canAgentUseCapability(agentId, capability) {
  if (!agentId || blockedCapabilities.includes(capability)) {
    return false;
  }

  return allowedCapabilities.includes(capability);
}

module.exports = {
  allowedCapabilities,
  blockedCapabilities,
  canAgentUseCapability,
};
