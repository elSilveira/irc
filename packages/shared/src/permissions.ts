import type { CapabilityResult } from './permissions-types.js';

/**
 * v0 permission policy. Agents can use scoped repo tools, but arbitrary shell,
 * deploy, secrets, and raw filesystem capabilities stay blocked.
 */
export const ALLOWED_CAPABILITIES = Object.freeze([
  'read_channel',
  'reply',
  'receive_assignment',
  'update_status',
  'ask_context',
  'summarize',
  'propose_action',
  'service_restart',
  'docker_update',
  // tool-calling capabilities granted to the orchestrator in v1
  'list_files',
  'read_file',
  'git_status',
  'git_diff',
  'manage_agents',
  'workspace_write',
  'run_verification',
]);

export const BLOCKED_CAPABILITIES = Object.freeze([
  'shell',
  'filesystem_write',
  'git_write',
  'browser',
  'deploy',
  'secrets',
  'local_scripts',
]);

export function canUseCapability(agentId: string | undefined, capability: string): CapabilityResult {
  if (!agentId) return { ok: false, reason: 'unknown_agent' };
  if (BLOCKED_CAPABILITIES.includes(capability)) {
    return { ok: false, reason: 'blocked_capability' };
  }
  if (ALLOWED_CAPABILITIES.includes(capability)) {
    return { ok: true };
  }
  return { ok: false, reason: 'unknown_capability' };
}
