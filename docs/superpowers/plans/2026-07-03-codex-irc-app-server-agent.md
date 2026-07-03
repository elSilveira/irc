# Codex IRC App-Server Agent Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Connect `codex-agent` to local `codex app-server` with durable per-channel and per-DM context.
**Architecture:** Split routing, persistence, Codex JSON-RPC, and IRC wiring into small modules. Each context key maps to one persisted Codex thread id. The first slice is chat-only/read-only with no IRC-exposed tool execution.
**Tech Stack:** Node.js CommonJS, Node test runner, Node `child_process`, `readline`, experimental `node:sqlite`, Ergo IRC, mIRC.
---
## File Structure
- `message-router.js`: returns `{ contextKey, prompt, isLogin }` for addressed IRC input.
- `conversation-repository.js`: stores `context_key -> thread_id`.
- `codex-rpc-transport.js`: starts `codex app-server` and sends JSON-RPC.
- `codex-app-client.js`: initializes Codex, starts login, starts threads/turns, collects deltas.
- `task-repository.js`: creates persisted tasks with split task channels.
- `codex-bot.js`: wires IRC to router, repositories, and Codex client.
- `db/schema.sql`: adds `codex_conversations`.
- `README.md`, `clients/mirc/*`: document login, channels, DMs, and task channels.
### Task 1: Message Router
**Files:**
- Create: `packages/orchestrator/src/message-router.js`
- Test: `packages/orchestrator/test/message-router.test.js`
- [ ] **Step 1: Write failing tests**
```javascript
assert.deepEqual(routeCodexMessage({ botNick: 'codex-agent', sender: 'eduardo', target: '#control', text: '@codex status' }), {
  ok: true, contextKey: 'channel:#control', prompt: 'status', isLogin: false,
});
assert.equal(routeCodexMessage({ botNick: 'codex-agent', sender: 'eduardo', target: 'codex-agent', text: 'hello' }).contextKey, 'dm:eduardo');
assert.deepEqual(routeCodexMessage({ botNick: 'codex-agent', sender: 'eduardo', target: '#control', text: 'hello' }), { ok: false });
```
- [ ] **Step 2: Verify red**
Run: `npm test -- packages/orchestrator/test/message-router.test.js`
Expected: FAIL with module-not-found for `message-router`.
- [ ] **Step 3: Implement router**
```javascript
function routeCodexMessage({ botNick, sender, target, text }) {
  const raw = text.trim();
  const isDm = target.toLowerCase() === botNick.toLowerCase();
  const hasPrefix = raw.toLowerCase().startsWith('@codex');
  if (!isDm && !hasPrefix) return { ok: false };
  const prompt = hasPrefix ? raw.slice('@codex'.length).trim() : raw;
  return { ok: true, contextKey: isDm ? `dm:${sender}` : `channel:${target}`, prompt, isLogin: prompt.toLowerCase() === 'login' };
}
```
- [ ] **Step 4: Verify green**
Run: `npm test -- packages/orchestrator/test/message-router.test.js`
Expected: PASS.
### Task 2: Conversation Persistence
**Files:**
- Modify: `db/schema.sql`
- Create: `packages/orchestrator/src/conversation-repository.js`
- Test: `packages/orchestrator/test/conversation-repository.test.js`
- [ ] **Step 1: Write failing tests**
```javascript
const repo = createConversationRepository(':memory:');
repo.saveThread('channel:#control', 'thr_1');
assert.deepEqual(repo.findThread('channel:#control'), { contextKey: 'channel:#control', threadId: 'thr_1' });
repo.close();
```
- [ ] **Step 2: Verify red**
Run: `npm test -- packages/orchestrator/test/conversation-repository.test.js`
Expected: FAIL with module-not-found for `conversation-repository`.
- [ ] **Step 3: Add schema and repository**
```sql
CREATE TABLE IF NOT EXISTS codex_conversations (
  context_key TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
Expose `saveThread(contextKey, threadId)`, `findThread(contextKey)`, and `close()`.
- [ ] **Step 4: Verify green**
Run: `npm test -- packages/orchestrator/test/conversation-repository.test.js`
Expected: PASS.
### Task 3: Codex App-Server Client
**Files:**
- Create: `packages/orchestrator/src/codex-rpc-transport.js`
- Create: `packages/orchestrator/src/codex-app-client.js`
- Test: `packages/orchestrator/test/codex-app-client.test.js`
- [ ] **Step 1: Write failing tests**
```javascript
assert.equal((await client.startLogin()).authUrl, 'https://example.com/auth');
assert.deepEqual(await client.generate({ prompt: 'hello' }), { threadId: 'thr_1', text: 'hi' });
```
Use a fake transport that records `initialize`, `initialized`, `account/login/start`, `thread/start`, `turn/start`, emits `item/agentMessage/delta`, then emits `turn/completed`.
- [ ] **Step 2: Verify red**
Run: `npm test -- packages/orchestrator/test/codex-app-client.test.js`
Expected: FAIL with module-not-found for `codex-app-client`.
- [ ] **Step 3: Implement client**
Expose `readAccount()`, `startLogin()`, and `generate({ prompt, threadId })`. Initialize once. Use `sandbox: 'read-only'`, `approvalPolicy: 'never'`, and turn `sandboxPolicy: { type: 'readOnly', networkAccess: false }`.
- [ ] **Step 4: Verify green**
Run: `npm test -- packages/orchestrator/test/codex-app-client.test.js`
Expected: PASS.
### Task 4: IRC Chat Wiring
**Files:**
- Modify: `packages/orchestrator/src/codex-bot.js`
- Test: `packages/orchestrator/test/codex-bot.test.js`
- [ ] **Step 1: Write failing tests**
```javascript
await handleLine(socket, { nick: 'codex-agent', conversations, codex }, ':eduardo PRIVMSG #control :@codex hello');
assert.equal(conversations.saved[0].contextKey, 'channel:#control');
assert.deepEqual(socket.writes, ['PRIVMSG #control :real reply\r\n']);
```
Add a DM case where `target` is `codex-agent` and the reply target is sender.
- [ ] **Step 2: Verify red**
Run: `npm test -- packages/orchestrator/test/codex-bot.test.js`
Expected: FAIL because `handleLine` is deterministic and synchronous.
- [ ] **Step 3: Implement async chat path**
Keep PING and welcome JOIN behavior. For routed `PRIVMSG`, load saved thread, call `codex.generate`, save returned thread id, and reply to channel or sender.
- [ ] **Step 4: Verify green**
Run: `npm test -- packages/orchestrator/test/codex-bot.test.js`
Expected: PASS.
### Task 5: Login Command And mIRC Alias
**Files:**
- Modify: `packages/orchestrator/src/codex-bot.js`
- Modify: `clients/mirc/eduardoirc.mrc`
- Test: `packages/orchestrator/test/codex-bot.test.js`
- Test: `packages/orchestrator/test/codex-mirc.test.js`
- [ ] **Step 1: Write failing tests**
```javascript
await handleLine(socket, { nick: 'codex-agent', codex }, ':eduardo PRIVMSG #control :@codex login');
assert.deepEqual(socket.writes, ['PRIVMSG #control :Codex login: https://example.com/auth\r\n']);
```
Assert `clients/mirc/eduardoirc.mrc` contains `alias codex-login`.
- [ ] **Step 2: Verify red**
Run: `npm test -- packages/orchestrator/test/codex-bot.test.js packages/orchestrator/test/codex-mirc.test.js`
Expected: FAIL because login handling and `/codex-login` do not exist.
- [ ] **Step 3: Implement login**
If `codex.startLogin()` returns `authUrl`, reply `Codex login: <url>`. Add `/codex-login` alias that sends `@codex login` to `#control`.
- [ ] **Step 4: Verify green**
Run: `npm test -- packages/orchestrator/test/codex-bot.test.js packages/orchestrator/test/codex-mirc.test.js`
Expected: PASS.
### Task 6: Task Channels
**Files:**
- Create: `packages/orchestrator/src/task-repository.js`
- Modify: `packages/orchestrator/src/codex-bot.js`
- Test: `packages/orchestrator/test/task-repository.test.js`
- Test: `packages/orchestrator/test/codex-bot.test.js`
- [ ] **Step 1: Write failing tests**
```javascript
assert.deepEqual(repo.createTask('Build agent'), { id: 'TASK-0001', title: 'Build agent', status: 'open', channel: '#task-0001' });
```
Bot test: `@orc new "Build agent"` writes `JOIN #task-0001` and `PRIVMSG #control :Created TASK-0001 in #task-0001.`
- [ ] **Step 2: Verify red**
Run: `npm test -- packages/orchestrator/test/task-repository.test.js packages/orchestrator/test/codex-bot.test.js`
Expected: FAIL with module-not-found for `task-repository` or missing bot behavior.
- [ ] **Step 3: Implement tasks**
Use existing `tasks` table. Derive first id with `firstTaskId()`, next ids with `nextTaskId(lastId)`, and channels with `taskChannel(taskId)`.
- [ ] **Step 4: Verify green**
Run: `npm test -- packages/orchestrator/test/task-repository.test.js packages/orchestrator/test/codex-bot.test.js`
Expected: PASS.
### Task 7: Documentation And Verification
**Files:**
- Modify: `README.md`
- Modify: `clients/mirc/README.md`
- [ ] **Step 1: Update docs**
Document `/codex-login`, `@codex` in channels, direct messages to `codex-agent`, `@orc new`, Codex CLI requirement, and app-server login behavior.
- [ ] **Step 2: Run full verification**
Run: `npm test`
Expected: PASS.
Run: `Get-ChildItem -Recurse package.json,packages,db,clients,docs,scripts | Where-Object { -not $_.PSIsContainer } | ForEach-Object { "$((Get-Content $_.FullName).Count) $($_.FullName)" } | Sort-Object {[int]($_ -split ' ')[0]} -Descending | Select-Object -First 20`
Expected: every touched file is 200 lines or fewer.
