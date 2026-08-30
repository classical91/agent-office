'use strict';

// The orchestration and calendar-execution paths, against a real PostgreSQL.
//
// The rest of the suite runs on file storage, so every line of SQL in the
// Postgres storage layer ships to Railway having never been executed. That is
// not a theoretical gap: `updateOrchestrationGoal` used one uncast parameter in
// both an assignment and a comparison, PostgreSQL refused the whole statement
// with "inconsistent types deduced for parameter $2", and every Mission Control
// result write-back failed with a 500 on the deployment while the file-backed
// tests stayed green. This file is where that class of bug gets caught.
//
// Skips itself without DATABASE_URL so `npm test` on a laptop is unchanged; CI
// provides one.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { startTestServer } = require('./helpers/test-server.js');

const DIST = path.resolve(__dirname, '..', 'agent-office-deploy', 'dist');
const PASSPHRASE = 'postgres-orchestration';
const GATEWAY_TOKEN = 'postgres-orchestration-token';
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const skip = DATABASE_URL ? false : 'set DATABASE_URL to run the PostgreSQL storage tests';

// Every test starts from an empty database: the event-metadata map lives in
// app_settings, so leftovers from a previous test would count against the
// concurrency cap and make the next one fail for the wrong reason.
async function resetDatabase() {
  const { Client } = require('pg');
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const tables = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    if (tables.rows.length) {
      const names = tables.rows.map(row => `"${row.tablename}"`).join(', ');
      await client.query(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await client.end();
  }
}

async function startServer(t) {
  await resetDatabase();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-pg-'));
  const buildEnv = port => ({
    ...process.env,
    PORT: String(port),
    PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
    APP_TIMEZONE: 'UTC',
    DROPS_PASSPHRASE: PASSPHRASE,
    GATEWAY_TOKEN,
    DATABASE_URL,
    // Calendar blocks stay file-backed either way; only the orchestration
    // storage under test is PostgreSQL.
    CALENDAR_EVENTS_FILE: path.join(scratch, 'calendar.json'),
  });

  const server = await startTestServer({ serverPath: path.join(DIST, 'server.js'), cwd: DIST, buildEnv });
  const login = await fetch(`${server.origin}/api/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];

  const api = {
    as(method, route, body) {
      return fetch(`${server.origin}${route}`, {
        method,
        headers: body === undefined ? { Cookie: cookie } : { Cookie: cookie, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    },
    relay(method, route, body) {
      const headers = { 'X-Gateway-Token': GATEWAY_TOKEN };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      return fetch(`${server.origin}${route}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    },
  };

  await api.relay('POST', '/api/gateway/heartbeat', { host: 'pg-test', agents: [] });
  t.after(() => {
    server.child.kill();
    fs.rmSync(scratch, { recursive: true, force: true });
  });
  return api;
}

async function createAgentBlock(api, overrides = {}) {
  const start = new Date(Date.now() - 60 * 1000);
  const response = await api.as('POST', '/api/calendar/events', {
    title: overrides.title || 'Postgres repo review',
    start: start.toISOString(),
    end: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
    type: 'agent-run',
    meta: { agentId: 'codex', projectId: 'agent-office', taskId: 'pg-1', executionMode: 'agent-run', ...(overrides.meta || {}) },
  });
  assert.equal(response.status, 201);
  return (await response.json()).id;
}

const execution = (api, eventId) =>
  api.as('GET', `/api/calendar/events/${encodeURIComponent(eventId)}/execution`).then(r => r.json());

test('a Mission Control goal can be completed on PostgreSQL', { skip }, async t => {
  const api = await startServer(t);

  const created = await api.as('POST', '/api/orchestration/goals', {
    goal: 'Inspect the dashboard and recommend one improvement.', priority: 'urgent',
  });
  assert.equal(created.status, 201);
  const goalId = (await created.json()).id;

  await api.relay('POST', '/api/orchestration/goals/claim');

  // The statement that used to fail. All three terminal states go through it.
  for (const [status, body] of [
    ['needs_approval', { status: 'needs_approval', result: '[BUILD_APPROVAL_REQUIRED] Proposed scope.' }],
    ['completed', { status: 'completed', result: 'Recommended: tighten the signal review panel.' }],
    ['failed', { status: 'failed', error: 'Could not reach the host.' }],
  ]) {
    const patched = await api.relay('PATCH', `/api/orchestration/goals/${encodeURIComponent(goalId)}`, body);
    assert.equal(patched.status, 200, `PATCH to ${status} must succeed on PostgreSQL`);
    assert.equal((await patched.json()).orchestration_status, status);
  }

  const [stored] = await (await api.as('GET', '/api/orchestration/goals')).json();
  assert.equal(stored.orchestration_status, 'failed');
  assert.equal(stored.orchestration_error, 'Could not reach the host.');
});

test('the calendar execution bridge round-trips through PostgreSQL', { skip }, async t => {
  const api = await startServer(t);
  const eventId = await createAgentBlock(api);

  const swept = await (await api.relay('POST', '/api/calendar/runs/due')).json();
  assert.equal(swept.dispatched.length, 1);

  const submitted = await execution(api, eventId);
  assert.equal(submitted.runStatus, 'scheduled', 'submitted is not running');
  assert.equal(submitted.execution.state, 'queued');

  const goal = (await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal;
  assert.equal(goal.orchestration_calendar_event_id, eventId, 'the calendar column round-trips');
  assert.equal((await execution(api, eventId)).runStatus, 'running');

  await api.relay('PATCH', `/api/orchestration/goals/${encodeURIComponent(goal.id)}`, {
    status: 'completed', result: 'Repo health is fine. https://github.com/classical91/agent-office/pull/9',
  });

  const finished = await execution(api, eventId);
  assert.equal(finished.runStatus, 'completed');
  const events = await (await api.as('GET', '/api/calendar/events')).json();
  const block = events.events.find(item => item.id === eventId);
  assert.equal(block.meta.resultUrl, 'https://github.com/classical91/agent-office/pull/9');
  assert.match(block.meta.runSummary, /Repo health is fine/);
});

test('the partial unique index stops a duplicate execution on PostgreSQL', { skip }, async t => {
  const api = await startServer(t);
  const eventId = await createAgentBlock(api);
  const route = `/api/calendar/events/${encodeURIComponent(eventId)}/dispatch`;

  const [a, b] = await Promise.all([api.as('POST', route, {}), api.as('POST', route, {})]);
  assert.deepEqual([a.status, b.status].sort(), [202, 409], 'exactly one dispatch wins the race');

  const goals = await (await api.as('GET', '/api/orchestration/goals')).json();
  assert.equal(goals.filter(goal => goal.orchestration_calendar_event_id === eventId).length, 1);

  // A finished execution leaves the index, so the block can be run again.
  const goal = (await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal;
  await api.relay('PATCH', `/api/orchestration/goals/${encodeURIComponent(goal.id)}`, {
    status: 'failed', error: 'Transient failure.',
  });
  assert.equal((await api.as('POST', `/api/calendar/events/${encodeURIComponent(eventId)}/run`, { action: 'reset' })).status, 200);
  assert.equal((await api.as('POST', route, {})).status, 202, 'a retry is allowed once the old goal is finished');
});

test('approval on PostgreSQL resumes the same Penny session', { skip }, async t => {
  const api = await startServer(t);
  const eventId = await createAgentBlock(api, { title: 'Add a health endpoint' });
  await api.relay('POST', '/api/calendar/runs/due');
  const goal = (await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal;

  await api.relay('PATCH', `/api/orchestration/goals/${encodeURIComponent(goal.id)}`, {
    status: 'needs_approval', result: '[BUILD_APPROVAL_REQUIRED] one route and a test.',
  });
  const waiting = await execution(api, eventId);
  assert.equal(waiting.runStatus, 'needs_input');
  assert.equal(waiting.approvalId, goal.id);

  assert.equal((await api.as('POST', `/api/orchestration/goals/${encodeURIComponent(goal.id)}/approve`)).status, 200);
  const resumed = (await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal;
  assert.equal(resumed.id, goal.id, 'the same goal resumes');
  assert.equal(resumed.orchestration_session_key, goal.orchestration_session_key, 'and the same Penny session');
  assert.equal(resumed.orchestration_build_approved, true);
  assert.equal((await execution(api, eventId)).runStatus, 'running');
});

test('cancelling before the claim removes the goal from the queue on PostgreSQL', { skip }, async t => {
  const api = await startServer(t);
  const eventId = await createAgentBlock(api);
  await api.relay('POST', '/api/calendar/runs/due');

  assert.equal((await api.as('DELETE', `/api/calendar/events/${encodeURIComponent(eventId)}/dispatch`)).status, 200);
  const released = await execution(api, eventId);
  assert.equal(released.executionId, '');
  assert.equal((await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal, null);
});
