const TASK_ID_PREFIX = 'TASK-';
const TASK_ID_WIDTH = 4;

function firstTaskId() {
  return formatTaskId(1);
}

function nextTaskId(currentTaskId) {
  const number = Number(currentTaskId.slice(TASK_ID_PREFIX.length));
  return formatTaskId(number + 1);
}

function taskChannel(taskId) {
  return `#${taskId.toLowerCase()}`;
}

function formatTaskId(number) {
  return `${TASK_ID_PREFIX}${String(number).padStart(TASK_ID_WIDTH, '0')}`;
}

module.exports = {
  firstTaskId,
  nextTaskId,
  taskChannel,
};
