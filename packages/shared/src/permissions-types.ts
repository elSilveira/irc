export interface CapabilityResult {
  ok: boolean;
  reason?: 'unknown_agent' | 'blocked_capability' | 'unknown_capability';
}
