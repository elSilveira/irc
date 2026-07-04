import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from './index.js';

function task(repos: ReturnType<typeof createRepositories>) {
  return repos.tasks.createTask('Needs approval');
}

test('requestApproval creates a pending approval', () => {
  const repos = createRepositories(':memory:');
  const t = task(repos);
  const approval = repos.approvals.requestApproval({ taskId: t.id, requestedBy: 'worker', action: 'resume' });

  assert.equal(approval.taskId, t.id);
  assert.equal(approval.status, 'pending');
  assert.equal(approval.requestedBy, 'worker');
  assert.match(approval.id, /^APR-\d{4}$/);
  repos.close();
});

test('requestApproval is idempotent while an approval is pending', () => {
  const repos = createRepositories(':memory:');
  const t = task(repos);
  const first = repos.approvals.requestApproval({ taskId: t.id, requestedBy: 'worker', action: 'resume' });
  const second = repos.approvals.requestApproval({ taskId: t.id, requestedBy: 'worker', action: 'resume' });

  assert.equal(second.id, first.id);
  assert.equal(repos.approvals.listPending().length, 1);
  repos.close();
});

test('resolve marks an approval approved or denied', () => {
  const repos = createRepositories(':memory:');
  const t = task(repos);
  const approval = repos.approvals.requestApproval({ taskId: t.id, requestedBy: 'worker', action: 'resume' });

  const resolved = repos.approvals.resolve(approval.id, 'approved');
  assert.equal(resolved.status, 'approved');
  assert.equal(repos.approvals.listPending().length, 0);

  const t2 = task(repos);
  const a2 = repos.approvals.requestApproval({ taskId: t2.id, requestedBy: 'worker', action: 'resume' });
  assert.equal(repos.approvals.resolve(a2.id, 'denied').status, 'denied');
  repos.close();
});

test('resolve throws for an unknown approval', () => {
  const repos = createRepositories(':memory:');
  assert.throws(() => repos.approvals.resolve('APR-9999', 'approved'));
  repos.close();
});

test('findPendingForTask returns null when none pending', () => {
  const repos = createRepositories(':memory:');
  const t = task(repos);
  assert.equal(repos.approvals.findPendingForTask(t.id), null);
  repos.close();
});

test('a new pending approval can be opened after the previous one is resolved', () => {
  const repos = createRepositories(':memory:');
  const t = task(repos);
  const first = repos.approvals.requestApproval({ taskId: t.id, requestedBy: 'worker', action: 'resume' });
  repos.approvals.resolve(first.id, 'denied');

  const second = repos.approvals.requestApproval({ taskId: t.id, requestedBy: 'worker', action: 'resume' });
  assert.notEqual(second.id, first.id);
  assert.equal(repos.approvals.listPending().length, 1);
  repos.close();
});
