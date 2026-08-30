'use strict';

// The Calendar → Penny execution bridge.
//
// The property under test throughout is truthfulness: a calendar block may only
// show execution state that actually happened. It becomes `running` when Penny
// claims the goal and not a moment earlier, it completes only from a real
// result, and no restart, retry or duplicate poll may launch the same work
// twice. Penny is driven here the way the real relay drives her - claim the
// goal with the gateway token, PATCH the outcome back - so these tests exercise
// the same code path production uses.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { startTestServer } = require('./helpers/test-server.js');

const DIST = path.resolve(__dirname, '..', 'agent-office-deploy', 'dist');
const PASSPHRASE = 'calendar-penny-execution';
const GATEWAY_TOKEN = 'calendar-penny-gateway-token';

async function startServer(t) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-calendar-penny-'));
  const buildEnv = port => {
    const environment = {
      ...process.env,
      PORT: String(port),
      PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
      APP_TIMEZONE: 'UTC',
      DROPS_PASSPHRASE: PASSPHRASE,
      GATEWAY_TOKEN,
      DROPS_FILE: path.join(scratch, 'drops.json'),
      PROJECTS_FILE: path.join(scratch, 'projects.json'),
      AGENTS_FILE: path.join(scratch, 'agents.json'),
      MEMORIES_FILE: path.join(scratch, 'memories.json'),
      APP_SETTINGS_FILE: path.join(scratch, 'settings.json'),
      CALENDAR_EVENTS_FILE: path.join(scratch, 'calendar.json'),
      STREAKS_FILE: path.join(scratch, 'streaks.json'),
      VISITS_FILE: path.join(scratch, 'visits.json'),
    };
    ['DATABASE_URL', 'DROPS_PASSPHRASE_HASH', 'GOOGLE_REFRESH_TOKEN'].forEach(key => delete environment[key]);
    return environment;
  };

  const server = await startTestServer({ serverPath: path.join(DIST, 'server.js'), cwd: DIST, buildEnv });
  const login = await fetch(`${server.origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];

  const api = {
    origin: server.origin,
    scratch,
    // Jason, through the browser.
    async as(method, route, body) {
      const headers = { Cookie: cookie };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      return fetch(`${server.origin}${route}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    },
    // The OpenClaw relay, which holds a token and no cookie.
    async relay(method, route, body) {
      const headers = { 'X-Gateway-Token': GATEWAY_TOKEN };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      return fetch(`${server.origin}${route}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    },
  };

  // A fresh heartbeat is how the server knows Penny is reachable. Without it
  // every dispatch fails closed, which is its own test further down.
  await api.relay('POST', '/api/gateway/heartbeat', { host: 'test-desktop', agents: [] });

  t.after(() => {
    server.child.kill();
    fs.rmSync(scratch, { recursive: true, force: true });
  });
  return api;
}

function windowAround(now = Date.now(), startOffsetMinutes = -1, durationMinutes = 60) {
  const start = new Date(now + startOffsetMinutes * 60 * 1000);
  return { start: start.toISOString(), end: new Date(start.getTime() + durationMinutes * 60 * 1000).toISOString() };
}

async function createBlock(api, overrides = {}) {
  const times = overrides.times || windowAround();
  const response = await api.as('POST', '/api/calendar/events', {
    title: overrides.title || 'Repo health review',
    start: times.start,
    end: times.end,
    notes: overrides.notes || '',
    type: 'agent-run',
    meta: {
      agentId: 'codex',
      projectId: 'agent-office',
      taskId: 'task-9',
      executionMode: 'agent-run',
      expectedOutput: 'A summary of repo health.',
      ...(overrides.meta || {}),
    },
  });
  assert.equal(response.status, 201);
  return (await response.json()).id;
}

async function meta(api, eventId) {
  const response = await api.as('GET', `/api/calendar/events/${encodeURIComponent(eventId)}/execution`);
  assert.equal(response.status, 200);
  return response.json();
}

async function agentRecord(api, agentId) {
  const agents = await (await api.as('GET', '/api/agents')).json();
  return agents.find(agent => agent.id === agentId);
}

// -- Dispatch ------------------------------------------------------

test('a due block is dispatched once and stays scheduled until Penny claims it', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api);

  const swept = await (await api.relay('POST', '/api/calendar/runs/due')).json();
  assert.equal(swept.dispatched.length, 1, 'the due block is submitted to Penny');
  assert.equal(swept.dispatched[0].eventId, eventId);

  // The crucial one: submitted is not running. Nothing has claimed the work yet.
  const afterDispatch = await meta(api, eventId);
  assert.equal(afterDispatch.runStatus, 'scheduled');
  assert.ok(afterDispatch.executionId, 'the block now points at a real goal');
  assert.equal(afterDispatch.execution.state, 'queued');
  assert.equal((await agentRecord(api, 'codex')).status, 'idle', 'no agent is running yet');

  // And the goal is an ordinary Mission Control goal, not a parallel system.
  const goals = await (await api.as('GET', '/api/orchestration/goals')).json();
  const goal = goals.find(item => item.id === afterDispatch.executionId);
  assert.ok(goal, 'the calendar goal shows up in Mission Control');
  assert.equal(goal.agent, 'oss');
  assert.equal(goal.subject, 'Mission Control');
  assert.match(goal.content, /Requested specialist: codex/);
  assert.match(goal.content, /A summary of repo health\./);
});

test('a duplicate poll does not dispatch the same block twice', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api);

  const first = await (await api.relay('POST', '/api/calendar/runs/due')).json();
  const second = await (await api.relay('POST', '/api/calendar/runs/due')).json();
  const third = await (await api.relay('POST', '/api/calendar/runs/due')).json();

  assert.equal(first.dispatched.length, 1);
  assert.equal(second.dispatched.length, 0, 'the second poll finds nothing due');
  assert.equal(third.dispatched.length, 0);

  const goals = await (await api.as('GET', '/api/orchestration/goals')).json();
  const forThisBlock = goals.filter(goal => goal.orchestration_calendar_event_id === eventId);
  assert.equal(forThisBlock.length, 1, 'exactly one goal exists for the block');
});

test('two concurrent dispatches of one block still produce a single execution', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api);
  const route = `/api/calendar/events/${encodeURIComponent(eventId)}/dispatch`;

  const [a, b] = await Promise.all([api.as('POST', route, {}), api.as('POST', route, {})]);
  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [202, 409], 'one submission wins, the other is refused');

  const goals = await (await api.as('GET', '/api/orchestration/goals')).json();
  assert.equal(goals.filter(goal => goal.orchestration_calendar_event_id === eventId).length, 1);
});

test('a block that is not an agent run is never dispatched', async t => {
  const api = await startServer(t);
  const response = await api.as('POST', '/api/calendar/events', {
    title: 'Dentist', ...windowAround(), type: 'meeting',
  });
  const { id } = await response.json();

  const dispatched = await api.as('POST', `/api/calendar/events/${encodeURIComponent(id)}/dispatch`, {});
  assert.equal(dispatched.status, 400);
  assert.match((await dispatched.json()).error, /not an agent run/);

  const swept = await (await api.relay('POST', '/api/calendar/runs/due')).json();
  assert.equal(swept.dispatched.length, 0);
});

test('a block whose agent is not in the registry is refused, not queued', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api, { meta: { agentId: 'nobody' } });

  const dispatched = await api.as('POST', `/api/calendar/events/${encodeURIComponent(eventId)}/dispatch`, {});
  assert.equal(dispatched.status, 400);
  assert.match((await dispatched.json()).error, /nobody/);
  const untouched = await meta(api, eventId);
  assert.equal(untouched.executionId, '', 'no execution was created');
  assert.notEqual(untouched.runStatus, 'running', 'and the block was not moved');
});

test('a block scheduled for later is not swept up early', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api, { times: windowAround(Date.now(), 120, 60) });

  const swept = await (await api.relay('POST', '/api/calendar/runs/due')).json();
  assert.equal(swept.dispatched.length, 0);
  assert.equal((await meta(api, eventId)).executionId, '');
});

test('a block with unmet required inputs waits for a person rather than an agent', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api, { meta: { requiredInputs: ['Latest design doc'] } });

  const swept = await (await api.relay('POST', '/api/calendar/runs/due')).json();
  assert.equal(swept.dispatched.length, 0, 'the sweep leaves it alone');

  // Jason starting it by hand is the confirmation that the inputs exist.
  const started = await api.as('POST', `/api/calendar/events/${encodeURIComponent(eventId)}/dispatch`, {});
  assert.equal(started.status, 202);
});

// -- Fail closed ---------------------------------------------------

test('with Penny unreachable the block stays scheduled and says so', async t => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-penny-down-'));
  const buildEnv = port => {
    const environment = {
      ...process.env, PORT: String(port), PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
      APP_TIMEZONE: 'UTC', DROPS_PASSPHRASE: PASSPHRASE, GATEWAY_TOKEN,
      DROPS_FILE: path.join(scratch, 'drops.json'), PROJECTS_FILE: path.join(scratch, 'projects.json'),
      AGENTS_FILE: path.join(scratch, 'agents.json'), MEMORIES_FILE: path.join(scratch, 'memories.json'),
      APP_SETTINGS_FILE: path.join(scratch, 'settings.json'), CALENDAR_EVENTS_FILE: path.join(scratch, 'calendar.json'),
    };
    // No heartbeat is ever posted to this server and no gateway address was ever
    // saved, so the probe falls back to the default local gateway and finds
    // nothing there: the server has no evidence Penny exists.
    ['DATABASE_URL', 'DROPS_PASSPHRASE_HASH', 'GOOGLE_REFRESH_TOKEN'].forEach(key => delete environment[key]);
    return environment;
  };
  const server = await startTestServer({ serverPath: path.join(DIST, 'server.js'), cwd: DIST, buildEnv });
  t.after(() => {
    server.child.kill();
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  const login = await fetch(`${server.origin}/api/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const as = (method, route, body) => fetch(`${server.origin}${route}`, {
    method,
    headers: body === undefined ? { Cookie: cookie } : { Cookie: cookie, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const created = await as('POST', '/api/calendar/events', {
    title: 'Repo health review', ...windowAround(), type: 'agent-run',
    meta: { agentId: 'codex', executionMode: 'agent-run' },
  });
  const { id } = await created.json();

  const dispatched = await as('POST', `/api/calendar/events/${encodeURIComponent(id)}/dispatch`, {});
  assert.equal(dispatched.status, 503, 'dispatch fails closed when Penny cannot be reached');
  assert.match((await dispatched.json()).error, /unavailable/i);

  const execution = await (await as('GET', `/api/calendar/events/${encodeURIComponent(id)}/execution`)).json();
  assert.equal(execution.runStatus, '', 'the block was not moved');
  assert.equal(execution.executionId, '', 'and no execution was invented');

  const goals = await (await as('GET', '/api/orchestration/goals')).json();
  assert.equal(goals.length, 0, 'no goal was created for work that was never accepted');
});

// -- Lifecycle -----------------------------------------------------

test('scheduled to running happens only when Penny claims the goal', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api);
  await api.relay('POST', '/api/calendar/runs/due');

  assert.equal((await meta(api, eventId)).runStatus, 'scheduled');

  const claimed = (await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal;
  assert.ok(claimed, 'the relay claims the calendar goal like any other');

  const running = await meta(api, eventId);
  assert.equal(running.runStatus, 'running');
  assert.equal(running.execution.state, 'running');
  assert.match(running.status, /^Running/);

  const agent = await agentRecord(api, 'codex');
  assert.equal(agent.status, 'running');
  assert.equal(agent.current_project_id, 'agent-office');
  assert.equal(agent.current_task_id, 'task-9');
  assert.ok(agent.last_heartbeat, 'claiming the goal beats the agent heartbeat');
});

test('running to completed carries the real result back to the block', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api);
  await api.relay('POST', '/api/calendar/runs/due');
  const goal = (await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal;

  const finished = await api.relay('PATCH', `/api/orchestration/goals/${encodeURIComponent(goal.id)}`, {
    status: 'completed',
    result: 'Repo health is good; three stale branches found.\n\nFull write-up: https://github.com/classical91/agent-office/pull/1',
  });
  assert.equal(finished.status, 200);

  const completed = await meta(api, eventId);
  assert.equal(completed.runStatus, 'completed');
  assert.equal(completed.execution.state, 'completed');

  const events = await (await api.as('GET', '/api/calendar/events')).json();
  const block = events.events.find(item => item.id === eventId);
  assert.match(block.meta.runSummary, /three stale branches/);
  assert.equal(block.meta.resultUrl, 'https://github.com/classical91/agent-office/pull/1');
  assert.ok(block.meta.runEndedAt, 'the run has an end time');

  // The agent is released, and the run leaves a trace it can read back later.
  const agent = await agentRecord(api, 'codex');
  assert.equal(agent.status, 'idle');
  assert.equal(agent.current_task_id, '');
  assert.equal(agent.current_project_id, '');

  const memories = await (await api.as('GET', '/api/memories')).json();
  const recorded = memories.find(item => item.agent === 'codex' && /stale branches/.test(item.content));
  assert.ok(recorded, 'a completed run leaves a completion summary in agent memory');
});

test('a failed execution is reported as failed, with the reason', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api);
  await api.relay('POST', '/api/calendar/runs/due');
  const goal = (await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal;

  await api.relay('PATCH', `/api/orchestration/goals/${encodeURIComponent(goal.id)}`, {
    status: 'failed', error: 'The specialist could not reach the repository.',
  });

  const failed = await meta(api, eventId);
  assert.equal(failed.runStatus, 'failed');

  const events = await (await api.as('GET', '/api/calendar/events')).json();
  const block = events.events.find(item => item.id === eventId);
  assert.match(block.meta.runSummary, /could not reach the repository/);
  assert.equal(block.meta.resultUrl || '', '', 'a failed run invents no result');
  assert.equal((await agentRecord(api, 'codex')).status, 'failed');
});

test('a run Penny never accepted cannot be marked running by clicking', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api);
  await api.relay('POST', '/api/calendar/runs/due');

  // The block is submitted but unclaimed. The manual lifecycle endpoint must not
  // be a way around that.
  const forced = await api.as('POST', `/api/calendar/events/${encodeURIComponent(eventId)}/run`, { action: 'start' });
  assert.equal(forced.status, 409);
  assert.match((await forced.json()).error, /follows the real execution/);
  assert.equal((await meta(api, eventId)).runStatus, 'scheduled');
});

// -- Approvals -----------------------------------------------------

test('a build request pauses the block and approval resumes the same Penny session', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api, { title: 'Add a health endpoint' });
  await api.relay('POST', '/api/calendar/runs/due');
  const goal = (await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal;
  const sessionKey = goal.orchestration_session_key;

  await api.relay('PATCH', `/api/orchestration/goals/${encodeURIComponent(goal.id)}`, {
    status: 'needs_approval',
    result: '[BUILD_APPROVAL_REQUIRED] Proposed scope: add one route and a test.',
  });

  const waiting = await meta(api, eventId);
  assert.equal(waiting.runStatus, 'needs_input');
  assert.equal(waiting.approvalId, goal.id, 'the block points at the approval to give');
  assert.match(waiting.status, /^Needs approval/, 'an approval reads differently from a question');
  assert.equal((await agentRecord(api, 'codex')).status, 'needs_input');

  // Approval goes through Mission Control's own gate - there is no calendar-only
  // approval path to weaken it.
  const approved = await api.as('POST', `/api/orchestration/goals/${encodeURIComponent(goal.id)}/approve`);
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).orchestration_build_approved, true);

  // Approved is not running: the work resumes when Penny picks it back up.
  assert.equal((await meta(api, eventId)).runStatus, 'needs_input');

  const resumed = (await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal;
  assert.equal(resumed.id, goal.id, 'the same goal is resumed, not a new one');
  assert.equal(resumed.orchestration_session_key, sessionKey, 'and the same Penny session with it');
  assert.equal(resumed.orchestration_build_approved, true);

  const running = await meta(api, eventId);
  assert.equal(running.runStatus, 'running');
  assert.equal(running.approvalId, '', 'the approval is spent');
  assert.equal(running.execution.buildApproved, true);
});

test('approving the build does not approve a deployment', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api, { title: 'Ship the health endpoint' });
  await api.relay('POST', '/api/calendar/runs/due');
  const goal = (await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal;

  await api.relay('PATCH', `/api/orchestration/goals/${encodeURIComponent(goal.id)}`, {
    status: 'needs_approval', result: '[BUILD_APPROVAL_REQUIRED] Proposed scope: one route.',
  });
  await api.as('POST', `/api/orchestration/goals/${encodeURIComponent(goal.id)}/approve`);
  await api.relay('POST', '/api/orchestration/goals/claim');

  // Penny comes back for a second, separate approval before deploying. The block
  // parks again rather than treating the earlier yes as covering it.
  await api.relay('PATCH', `/api/orchestration/goals/${encodeURIComponent(goal.id)}`, {
    status: 'needs_approval', result: '[BUILD_APPROVAL_REQUIRED] Deploying to Railway needs its own approval.',
  });

  const parked = await meta(api, eventId);
  assert.equal(parked.runStatus, 'needs_input');
  assert.equal(parked.approvalId, goal.id);
  assert.match(parked.execution.result, /own approval/);
});

// -- Concurrency and cancellation ----------------------------------

test('the concurrent run limit counts submitted work, not just running work', async t => {
  const api = await startServer(t);
  await api.as('PUT', '/api/calendar/preferences', { preferences: { maxConcurrentAgentRuns: 1 } });

  const first = await createBlock(api, { title: 'First run' });
  const second = await createBlock(api, { title: 'Second run', meta: { agentId: 'guardian' } });

  const swept = await (await api.relay('POST', '/api/calendar/runs/due')).json();
  assert.equal(swept.dispatched.length, 1, 'only one block fits under the cap');
  assert.equal(swept.skipped.length, 1);
  assert.match(swept.skipped[0].reason, /concurrent agent run limit/);

  const dispatchedId = swept.dispatched[0].eventId;
  const heldId = dispatchedId === first ? second : first;
  assert.equal((await meta(api, heldId)).executionId, '', 'the held block has no execution');
});

test('a submitted run can be cancelled before Penny claims it, and not after', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api);
  await api.relay('POST', '/api/calendar/runs/due');

  const cancelled = await api.as('DELETE', `/api/calendar/events/${encodeURIComponent(eventId)}/dispatch`);
  assert.equal(cancelled.status, 200);

  const released = await meta(api, eventId);
  assert.equal(released.runStatus, 'scheduled');
  assert.equal(released.executionId, '', 'the block is free again');

  const nothingToClaim = await (await api.relay('POST', '/api/orchestration/goals/claim')).json();
  assert.equal(nothingToClaim.goal, null, 'the cancelled goal is not handed to Penny');

  // Once claimed, the work is running on another machine and is not cancellable
  // from here - saying otherwise would be a lie about external state.
  await api.relay('POST', '/api/calendar/runs/due');
  await api.relay('POST', '/api/orchestration/goals/claim');
  const tooLate = await api.as('DELETE', `/api/calendar/events/${encodeURIComponent(eventId)}/dispatch`);
  assert.equal(tooLate.status, 409);
  assert.match((await tooLate.json()).error, /already claimed/);
});

test('deleting a block cancels the work Penny has not started', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api);
  await api.relay('POST', '/api/calendar/runs/due');

  const deleted = await api.as('DELETE', `/api/calendar/events/${encodeURIComponent(eventId)}`);
  assert.equal(deleted.status, 200);
  assert.ok((await deleted.json()).cancelledExecution, 'the pending goal was cancelled with it');

  const nothingToClaim = await (await api.relay('POST', '/api/orchestration/goals/claim')).json();
  assert.equal(nothingToClaim.goal, null);
});

// -- Recovery ------------------------------------------------------

test('a restart reconnects a running block to its goal instead of launching it again', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api);
  await api.relay('POST', '/api/calendar/runs/due');
  const goal = (await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal;
  assert.equal((await meta(api, eventId)).runStatus, 'running');

  // Every subsequent sweep - which is what a restarted relay does first - must
  // find nothing to launch, because the block already has a live execution.
  for (let pass = 0; pass < 3; pass += 1) {
    const swept = await (await api.relay('POST', '/api/calendar/runs/due')).json();
    assert.equal(swept.dispatched.length, 0, 'a running block is never re-dispatched');
  }

  const goals = await (await api.as('GET', '/api/orchestration/goals')).json();
  assert.equal(goals.filter(item => item.orchestration_calendar_event_id === eventId).length, 1);
  assert.equal((await meta(api, eventId)).execution.id, goal.id);
});

test('a result that landed while the block was out of step is reconciled by the sweep', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api);
  await api.relay('POST', '/api/calendar/runs/due');
  const goal = (await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal;

  await api.relay('PATCH', `/api/orchestration/goals/${encodeURIComponent(goal.id)}`, {
    status: 'completed', result: 'Finished while the calendar was not looking.',
  });

  // Knock the block back behind its goal, the way a crash between the goal write
  // and the calendar write leaves it. The goal is the record of what happened;
  // the block is the thing that is now wrong.
  await api.as('PATCH', `/api/calendar/events/${encodeURIComponent(eventId)}`, {
    meta: { runStatus: 'scheduled', runSummary: null, runEndedAt: null },
  });
  assert.equal((await meta(api, eventId)).runStatus, 'scheduled');

  const swept = await (await api.relay('POST', '/api/calendar/runs/due')).json();
  assert.equal(swept.dispatched.length, 0, 'reconciling never launches new work');
  assert.deepEqual(swept.reconciled, [{ eventId, action: 'complete', ok: true }]);

  const settled = await meta(api, eventId);
  assert.equal(settled.runStatus, 'completed', 'the block catches up to the real outcome');
  assert.equal(settled.execution.id, goal.id, 'against the same execution, not a new one');
});

test('a running block whose execution record vanished is surfaced, not completed', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api);
  await api.relay('POST', '/api/calendar/runs/due');
  const goal = (await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal;

  await api.as('DELETE', `/api/drops/${encodeURIComponent(goal.id)}`);

  await api.relay('POST', '/api/calendar/runs/due');
  const settled = await meta(api, eventId);
  assert.equal(settled.runStatus, 'failed', 'a lost execution is never reported as success');

  const events = await (await api.as('GET', '/api/calendar/events')).json();
  const block = events.events.find(item => item.id === eventId);
  assert.match(block.meta.runSummary, /missing/i);
});

test('a failed run can be retried as a fresh execution', async t => {
  const api = await startServer(t);
  const eventId = await createBlock(api);
  await api.relay('POST', '/api/calendar/runs/due');
  const first = (await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal;
  await api.relay('PATCH', `/api/orchestration/goals/${encodeURIComponent(first.id)}`, {
    status: 'failed', error: 'Transient network failure.',
  });
  assert.equal((await meta(api, eventId)).runStatus, 'failed');

  // Retry is reset-then-dispatch: the block must not carry the old execution id
  // into the new job.
  const reset = await api.as('POST', `/api/calendar/events/${encodeURIComponent(eventId)}/run`, { action: 'reset' });
  assert.equal(reset.status, 200);
  const cleared = await meta(api, eventId);
  assert.equal(cleared.executionId, '', 'the finished execution is let go');
  assert.equal(cleared.runStatus, 'scheduled');

  const dispatched = await api.as('POST', `/api/calendar/events/${encodeURIComponent(eventId)}/dispatch`, {});
  assert.equal(dispatched.status, 202);
  const retried = await meta(api, eventId);
  assert.notEqual(retried.executionId, first.id, 'the retry is a new execution');

  const second = (await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal;
  assert.equal(second.id, retried.executionId);
  assert.equal((await meta(api, eventId)).runStatus, 'running');
});
