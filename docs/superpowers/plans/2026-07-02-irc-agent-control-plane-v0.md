# IRC Agent Control Plane V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first safe, testable control-plane primitives for a local IRC agent coordinator.

**Architecture:** Keep the existing Ergo deployment intact. Add a small Node package under `packages/orchestrator` with pure modules for command parsing, task IDs, message formatting, permissions, and schema definition before adding a live IRC client.

**Tech Stack:** Node.js built-in test runner, CommonJS modules, Markdown, SQL.

---

## File Structure

- `package.json`: root scripts for running orchestrator tests.
- `packages/orchestrator/src/command-parser.js`: parses `@orc` commands.
- `packages/orchestrator/src/task-ids.js`: formats and increments task IDs.
- `packages/orchestrator/src/messages.js`: formats structured agent messages.
- `packages/orchestrator/src/permissions.js`: declares v0 blocked capabilities.
- `packages/orchestrator/test/*.test.js`: focused TDD coverage.
- `db/schema.sql`: source-of-truth schema from the external plan.

### Task 1: Command Parser

**Files:**
- Create: `package.json`
- Create: `packages/orchestrator/src/command-parser.js`
- Test: `packages/orchestrator/test/command-parser.test.js`

- [ ] **Step 1: Write failing parser tests**

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCommand } = require('../src/command-parser');

test('parses quoted new task command', () => {
  assert.deepEqual(parseCommand('@orc new "Build local IRC control plane"'), {
    ok: true,
    command: 'new',
    args: ['Build local IRC control plane'],
  });
});

test('ignores non-orchestrator messages', () => {
  assert.deepEqual(parseCommand('hello'), { ok: false, reason: 'missing_prefix' });
});
```

Run: `npm test -- packages/orchestrator/test/command-parser.test.js`
Expected: FAIL because `command-parser.js` does not exist.

- [ ] **Step 2: Implement parser and root test script**

Add `package.json` with `"test": "node --test"` and implement a minimal parser that supports quoted args.

- [ ] **Step 3: Verify parser tests pass**

Run: `npm test -- packages/orchestrator/test/command-parser.test.js`
Expected: PASS.

### Task 2: Task IDs And Messages

**Files:**
- Create: `packages/orchestrator/src/task-ids.js`
- Create: `packages/orchestrator/src/messages.js`
- Test: `packages/orchestrator/test/task-ids.test.js`
- Test: `packages/orchestrator/test/messages.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
assert.equal(nextTaskId('TASK-0001'), 'TASK-0002');
assert.equal(formatAgentMessage({ taskId: 'TASK-0001', agent: 'manager-agent', status: 'plan_ready', body: 'Plan ready.' }), '[TASK-0001] [manager-agent] [status:plan_ready]\nPlan ready.');
```

Run: `npm test -- packages/orchestrator/test/task-ids.test.js packages/orchestrator/test/messages.test.js`
Expected: FAIL because modules do not exist.

- [ ] **Step 2: Implement focused helpers**

Keep each helper pure and validate required fields with clear errors.

- [ ] **Step 3: Verify helper tests pass**

Run: `npm test -- packages/orchestrator/test/task-ids.test.js packages/orchestrator/test/messages.test.js`
Expected: PASS.

### Task 3: V0 Safety And Schema

**Files:**
- Create: `packages/orchestrator/src/permissions.js`
- Test: `packages/orchestrator/test/permissions.test.js`
- Create: `db/schema.sql`

- [ ] **Step 1: Write failing permissions test**

```javascript
assert.equal(canAgentUseCapability('coder-agent', 'shell'), false);
assert.equal(canAgentUseCapability('manager-agent', 'reply'), true);
```

Run: `npm test -- packages/orchestrator/test/permissions.test.js`
Expected: FAIL because `permissions.js` does not exist.

- [ ] **Step 2: Implement v0 permission policy and SQL schema**

Define allowlisted communication capabilities and blocked execution capabilities. Add the `agents`, `tasks`, `task_events`, `irc_messages`, `approvals`, and `artifacts` tables.

- [ ] **Step 3: Verify all tests and file sizes**

Run: `npm test`
Expected: PASS.

Run: `Get-ChildItem -Recurse package.json,packages,db | Where-Object { -not $_.PSIsContainer } | ForEach-Object { "$((Get-Content $_.FullName).Count) $($_.FullName)" }`
Expected: every new file is `200` lines or fewer.
