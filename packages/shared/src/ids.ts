export const TASK_ID_PREFIX = 'TASK-';
const TASK_ID_WIDTH = 4;

export function firstTaskId(): string {
  return formatTaskId(1);
}

export function nextTaskId(currentTaskId: string): string {
  const number = Number(currentTaskId.slice(TASK_ID_PREFIX.length));
  return formatTaskId(number + 1);
}

export function taskChannel(taskId: string): string {
  return `#${taskId.toLowerCase()}`;
}

export function formatTaskId(number: number): string {
  return `${TASK_ID_PREFIX}${String(number).padStart(TASK_ID_WIDTH, '0')}`;
}
