const TASK_PROTOCOL = /\[task:[^\]]+\]\s*(?:\[from:[^\]]+\]\s*)?\[type:[^\]]+\]/;

export function ensureTaskProtocolOutput(taskId: string, output: string): string {
  const trimmed = output.trim();
  if (TASK_PROTOCOL.test(trimmed)) return trimmed;
  return `[task:${taskId}] [type:blocked] agent stopped without task protocol output`;
}
