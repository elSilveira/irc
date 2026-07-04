import { TASK_ID_PREFIX } from './ids.js';

export type TaskEventType =
  | 'ack'
  | 'wip'
  | 'context.request'
  | 'context.result'
  | 'review.request'
  | 'review.result'
  | 'blocked'
  | 'result'
  | 'rdt'
  | 'testing'
  | 'tested'
  | 'pass'
  | 'not.pass'
  | 'done'
  | 'failed';

export const TASK_EVENT_TYPES: readonly TaskEventType[] = [
  'ack',
  'wip',
  'context.request',
  'context.result',
  'review.request',
  'review.result',
  'blocked',
  'result',
  'rdt',
  'testing',
  'tested',
  'pass',
  'not.pass',
  'done',
  'failed',
];

const KNOWN_EVENT_TYPES = new Set<string>(TASK_EVENT_TYPES);

export interface TaskEvent {
  taskId: string;
  from: string | null;
  type: string;
  status: string | null;
  content: string;
}

const HEADER_RE =
  /^\s*\[task:(?<task>[^\]]+)\]\s*(?:\[from:(?<from>[^\]]+)\]\s*)?\[type:(?<type>[^\]]+)\]\s*(?:\[status:(?<status>[^\]]+)\]\s*)?(?<content>[\s\S]*)$/;
const EVENT_START_RE = /\[task:[^\]]+\]\s*(?:\[from:[^\]]+\]\s*)?\[type:[^\]]+\]/g;

export function isTaskEventType(value: string): value is TaskEventType {
  return KNOWN_EVENT_TYPES.has(value);
}

/**
 * Parse an IRC line into a structured task event. Returns `null` for lines that
 * are not task-event protocol messages. `from` and `status` are optional; the
 * caller may fill `from` from the IRC sender when it is absent.
 */
export function parseTaskEvent(text: string): TaskEvent | null {
  const match = HEADER_RE.exec(text);
  if (!match?.groups) return null;
  const { task, from, type, status, content } = match.groups;
  if (!task || !type) return null;
  return {
    taskId: task.trim(),
    from: from?.trim() || null,
    type: type.trim(),
    status: status?.trim() || null,
    content: (content ?? '').trim(),
  };
}

export function parseTaskEvents(text: string): TaskEvent[] {
  const starts = [...text.matchAll(EVENT_START_RE)].map((match) => match.index ?? 0);
  if (starts.length <= 1) {
    const event = parseTaskEvent(text);
    return event ? [event] : [];
  }

  return starts
    .map((start, index) => text.slice(start, starts[index + 1]).trim())
    .map(parseTaskEvent)
    .filter((event): event is TaskEvent => event !== null);
}

/** Render a task event back into its canonical IRC line. */
export function formatTaskEvent(event: TaskEvent): string {
  const headers = [
    `[task:${event.taskId}]`,
    event.from ? `[from:${event.from}]` : '',
    `[type:${event.type}]`,
    event.status ? `[status:${event.status}]` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const body = event.content.trim();
  return body ? `${headers} ${body}` : headers;
}

/** True when a status value looks like a task id we track (`TASK-NNNN`). */
export function isTaskId(value: string): boolean {
  return new RegExp(`^${TASK_ID_PREFIX}\\d+$`, 'i').test(value);
}

/**
 * Derive a task id from a structured `[task:...]` line, or from a task channel
 * (`#task-0001`). Returns `null` when the line/channel carries no task context.
 */
export function deriveTaskId(text: string, channel: string): string | null {
  const event = parseTaskEvent(text);
  if (event) return event.taskId;
  const match = channel.toLowerCase().match(/^#task-(\d+)$/);
  return match ? `${TASK_ID_PREFIX}${match[1]}` : null;
}
