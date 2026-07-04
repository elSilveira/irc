# Agent Routing And Validation Roadmap

**Goal:** Let the orchestrator choose the best agent for new tasks, queue work
when that agent is busy, validate results, and publish final responses through a
responder agent.

## Target Flow

1. User creates a task with `@orc new "title"`.
2. Orchestrator scores managed agents using stored strengths, weaknesses, role,
   and context.
3. If the best agent has free capacity, task becomes `ready` and the agent is
   notified.
4. If the best agent is busy, task becomes `queued` for that agent.
5. Worker agent sends `[task:ID] [type:result] ...`.
6. Orchestrator forwards the result to a validator agent.
7. Validator emits approval/rework status.
8. Orchestrator either loops back to the worker or sends approved output to a
   responder agent.
9. Responder posts the final response in the task channel.

## Implementation Checkpoints

- [x] Roadmap created.
- [x] Agents store `strengths`, `weaknesses`, and `capacity`.
- [x] Pure routing policy selects the best agent for a task.
- [x] `@orc new` auto-assigns free agents or queues work for busy agents.
- [x] Agent CRUD commands can edit routing metadata.
- [ ] Queue promotion starts next queued task when an agent completes work.
- [ ] Validator/responder special agents are documented and bootstrapped.
- [ ] Result events trigger validator handoff.
- [ ] Validator approval triggers responder handoff.
- [ ] Rework/failed validation loops back to the worker.
- [ ] README and architecture docs explain the full flow.
- [ ] Verification passes: `npm test`, `npm run test:ts`, `npm run typecheck`,
  `docker compose config --quiet`, file-size guard.

## Resume Notes

Start with data and routing in `packages/db` and `apps/orchestrator/src`.
Keep routing as a pure tested module before wiring IRC side effects. Do not
implement validator/responder until automatic assignment and queueing are green.
