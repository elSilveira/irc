import type { CapabilityResult } from './permissions-types.js';

/**
 * v0 permission policy. The orchestrator can use safe read/coordination tools.
 * Execution-class capabilities stay blocked until the approval runner exists.
 */
export const ALLOWED_CAPABILITIES = Object.freeze([
  'read_channel',
  'reply',
  'receive_assignment',
  'update_status',
  'ask_context',
  'summarize',
  'propose_action',
  // tool-calling capabilities granted to the orchestrator in v1
  'list_files',
  'read_file',
  'git_status',
  'git_diff',
  'manage_agents',
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
