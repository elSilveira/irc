import { parseTaskEvents, type TaskStatus } from '@irc/shared';
import type { Repositories } from '@irc/db';

const STATUS_BY_EVENT: Record<string, TaskStatus> = {
  ack: 'doing',
  wip: 'doing',
  blocked: 'blocked',
  'review.request': 'review',
  result: 'review',
  done: 'done',
  failed: 'failed',
};

export interface IngestResult {
  taskId: string;
  eventType: string;
  approvalId?: string;
}

export const TASK_PROTOCOL_INSTRUCTIONS = [
  'Task lifecycle protocol — when you are given a task id (TASK-NNNN), report',
  'progress on its own line using this exact format, in addition to your reply:',
  '  [task:TASK-0001] [type:ack] acknowledged, starting',
  '  [task:TASK-0001] [type:wip] current step: <what you are doing>',
  '  [task:TASK-0001] [type:blocked] <reason>',
  '  [task:TASK-0001] [type:result] <what you produced>',
  '  [task:TASK-0001] [type:done] completed',
  'Send ack right away, then wip while working, then result and done. If stuck,',
  'send blocked with the reason. Keep each line self-contained.',
].join('\n');

/**
 * Detect a structured `[task:...]` line, record it against the task event log,
 * and reflect a derived status onto the task row. Returns `null` when the line
 * is not a task-event message or references an unknown task.
 */
export function ingestTaskEvent(
  text: string,
  sender: string,
  repos: Repositories,
  channel?: string,
): IngestResult | null {
  const events = parseTaskEvents(text).filter((event) => repos.tasks.findTask(event.taskId));
  if (events.length === 0) return null;

  let result: IngestResult | null = null;
  for (const event of events) {
    const actor = event.from ?? sender;
    if (channel) {
      repos.ircMessages.recordMessage({
        channel,
        sender: actor,
        message: text,
        taskId: event.taskId,
      });
    }

    repos.taskEvents.recordEvent({
      taskId: event.taskId,
      actor,
      eventType: event.type,
      content: event.content,
    });

    const next = STATUS_BY_EVENT[event.type];
    if (next) repos.tasks.updateStatus(event.taskId, next);

    let approvalId: string | undefined;
    if (event.type === 'blocked') {
      approvalId = repos.approvals.requestApproval({
        taskId: event.taskId,
        requestedBy: actor,
        action: 'resume',
      }).id;
    }
    result = { taskId: event.taskId, eventType: event.type, approvalId };
  }

  return result;
}
