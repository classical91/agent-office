# Calendar → Penny execution bridge

## What already existed (Phase 1 audit)

Two systems, both complete, with nothing joining them.

**Mission Control execution (the real orchestrator).**

| Piece | Where |
| --- | --- |
| Goal creation | `POST /api/orchestration/goals` → a `drops` row with `agent='oss'`, `subject='Mission Control'`, `priority='urgent'`, `orchestration_status='queued'` |
| Atomic claim | `POST /api/orchestration/goals/claim` (gateway token) → `storage.claimOrchestrationGoal()`; PostgreSQL uses `FOR UPDATE SKIP LOCKED`, the file store the same rule in one read/write |
| Stale claim recovery | a `running` goal older than 20 minutes is re-claimable, capped at 3 attempts |
| Desktop relay | `scripts/openclaw-heartbeat.js` — one 30 s loop that beats `/api/gateway/heartbeat`, claims one goal, runs `openclaw agent --agent oss --session-key <orchestration_session_key>`, and PATCHes the result back |
| Approval gate | Penny's prompt requires `[BUILD_APPROVAL_REQUIRED]` for code/config/infra/deploy work → goal becomes `needs_approval` → `POST /api/orchestration/goals/:id/approve` (Jason's session) re-queues it with `orchestration_build_approved`, and the relay re-claims **the same session key** |
| Result persistence | `PATCH /api/orchestration/goals/:id` (gateway token) writes `orchestration_result`/`orchestration_error`; the goal is a Drop, so the Outbox shows it |
| Penny liveness | `describeGatewayHeartbeat()` (fresh ≤ 90 s) and `probeGateway()` |

**Calendar run lifecycle (a recorded state machine, no execution).**

| Piece | Where |
| --- | --- |
| Event metadata | `calendar-agent-meta.js` — `agentId`, `projectId`, `taskId`, `eventKind`, `executionMode`, `runStatus`, `expectedOutput`, `requiredInputs`, `resultUrl`, `runSummary`, `runProgress`, `runFindings`, `runStartedAt`/`runEndedAt`/`runHeartbeatAt`. Local map is authoritative; Google `extendedProperties` are best effort |
| Transitions | `agentMeta.runTransition()` — `scheduled → running → (needs_input → running)* → completed \| failed`, returning both the event patch and the agent-registry patch |
| Driver | `POST /api/calendar/events/:id/run` → `advanceEventRun()`: concurrency cap, agent status + heartbeat, memory write on finish, Google mirror |

The gap: `advanceEventRun` was only ever called by a human clicking, so `running` meant "someone said so", not "an agent is working".

## The bridge

```
Calendar agent-run block  (executionMode=agent-run, runStatus=scheduled)
   │
   │  “Start now”  → POST /api/calendar/events/:id/dispatch      (Office session)
   │  due sweep    → POST /api/calendar/runs/due                 (gateway token, from the existing relay loop)
   ▼
dispatchCalendarEventRun()
   validate executable → not already dispatched → concurrency → Penny reachable
   build the execution request from event metadata
   storage.createCalendarExecutionGoal()      idempotency key: calendar-event:<eventId>
   ▼
Mission Control goal (queued)   ← the SAME row shape Mission Control creates
   event keeps runStatus=scheduled, and now carries executionId + pennySessionId
   ▼
POST /api/orchestration/goals/claim           ← the existing relay, unchanged in purpose
   goal → running, and only now the event → running, agent → running
   ▼
openclaw agent --agent oss --session-key <pennySessionId>   → Penny → specialist
   ▼
PATCH /api/orchestration/goals/:id
   completed      → event completed  (runSummary, resultUrl, runEndedAt, agent memory)
   needs_approval → event needs_input (approvalId set, shown as “Needs approval”)
   failed         → event failed
   ▼
POST /api/orchestration/goals/:id/approve  → goal re-queued → relay re-claims the same
   session key → event back to running
```

Penny stays the only orchestrator: a calendar block does not run anything, it submits a
Mission Control goal and then only ever *reflects* what that goal reports. There is no
second poller either — the sweep runs inside the relay's existing 30 s cycle.

## A bug this uncovered

Wiring the calendar into `PATCH /api/orchestration/goals/:id` meant running that
statement against a real PostgreSQL for the first time. It fails there, and always has:

```
inconsistent types deduced for parameter $2
```

`updateOrchestrationGoal` used `$2` both as the value assigned to `orchestration_status`
and as the left side of `CASE WHEN $2 = 'completed'`, so PostgreSQL deduced two types for
one parameter and rejected the whole statement. On the deployment every Mission Control
result write-back returned 500; on file storage — which is what the entire test suite ran
on — it was fine. Each `$2` is now cast explicitly.

That gap is closed as well as fixed: `tests/postgres-orchestration.test.js` exercises the
orchestration and calendar-execution SQL against a real database (and skips itself without
`DATABASE_URL`, so a laptop `npm test` is unchanged), and CI now runs a `postgres:16`
service so it actually executes. Reverting the cast turns four of its five tests red.

## Truthfulness rules encoded

* Dispatch failure leaves the block `scheduled` (retryable) or `failed` with the reason — never `running`.
* `running` is written only when Penny actually claims the goal.
* `completed` is written only from a real goal result; a run with no result is not completed.
* Penny unreachable → dispatch is refused, `Scheduled — Penny currently unavailable`.
* A block with a live `executionId` refuses manual run transitions: its state belongs to Penny.
* A running block whose heartbeat has aged past 20 minutes reads `Execution status unknown`, not `failed`.
* `reconcileCalendarExecutions()` runs on every sweep, so a restart re-syncs blocks to their
  stored goal instead of launching the work again.

## Production verification (Phase 11) — not yet run

This needs the live Railway deployment, the connected Google Calendar, and the OpenClaw
relay running on Jason's machine, none of which are reachable from a CI sandbox. The
procedure, once the branch is deployed and `scripts/openclaw-heartbeat.js` is restarted so
it picks up the due sweep:

1. Create a block a few minutes out: agent `codex`, `executionMode: agent-run`, notes
   *"Research Agent Office repo health and summarize findings. No changes."*
2. Confirm it reads **Scheduled** and `/execution` shows no `executionId`.
3. At the start time, watch one relay cycle: `dispatched 1 due calendar block(s) to Penny`,
   then `claimed Mission Control goal …`.
4. Confirm the block flips to **Running** only after the claim, and the Agent Registry shows
   `codex` running on the right project/task.
5. On completion, confirm **Completed**, the summary on the block, the result link if Penny
   returned one, `codex` back to idle, the goal in the Outbox, and the completion line in
   agent memory.
6. Confirm exactly one goal carries that `orchestration_calendar_event_id`.

Then repeat with a code-inspection block (*"Inspect the calendar dispatch code and propose
changes. Do not modify anything."*) and confirm it parks on **Needs approval** with an
`approvalId`, and that approving resumes the same `orchestration_session_key`. Deploy
nothing during either run.
