'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { startTestServer } = require('./helpers/test-server.js');

const DIST = path.resolve(__dirname, '..', 'agent-office-deploy', 'dist');
const PASSPHRASE = 'open-mission-control';
const GATEWAY_TOKEN = 'gateway-token-long-enough';

async function startServer() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-orchestration-'));
  const buildEnv = port => {
    const environment = {
      ...process.env, PORT: String(port), PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
      APP_TIMEZONE: 'UTC', DROPS_PASSPHRASE: PASSPHRASE, GATEWAY_TOKEN,
      DROPS_FILE: path.join(scratch, 'drops.json'), PROJECTS_FILE: path.join(scratch, 'projects.json'),
      AGENTS_FILE: path.join(scratch, 'agents.json'), MEMORIES_FILE: path.join(scratch, 'memories.json'),
      APP_SETTINGS_FILE: path.join(scratch, 'settings.json'), CALENDAR_EVENTS_FILE: path.join(scratch, 'calendar.json'),
      STREAKS_FILE: path.join(scratch, 'streaks.json'), STREAK_DAYS_FILE: path.join(scratch, 'streak-days.json'),
      VISITS_FILE: path.join(scratch, 'visits.json'),
    };
    ['DATABASE_URL', 'DROPS_PASSPHRASE_HASH', 'SHORTCUTS_TOKEN'].forEach(key => delete environment[key]);
    return environment;
  };
  const server = await startTestServer({ serverPath: path.join(DIST, 'server.js'), cwd: DIST, buildEnv });
  const login = await fetch(`${server.origin}/api/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  return { ...server, scratch, cookie: login.headers.get('set-cookie').split(';')[0] };
}

function stop(server) {
  server.child.kill();
  fs.rmSync(server.scratch, { recursive: true, force: true });
}

test('a goal is queued, atomically claimed, completed, and exposed in the Outbox', async () => {
  const server = await startServer();
  try {
    const createdResponse = await fetch(`${server.origin}/api/orchestration/goals`, {
      method: 'POST', headers: { Cookie: server.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: 'Inspect Market Dashboard and recommend one improvement.' }),
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    assert.equal(created.agent, 'oss');
    assert.equal(created.orchestration_status, 'queued');
    assert.match(created.orchestration_session_key, /^agent:oss:mission-control-/);

    const claimResponse = await fetch(`${server.origin}/api/orchestration/goals/claim`, {
      method: 'POST', headers: { 'X-Gateway-Token': GATEWAY_TOKEN },
    });
    const claimed = (await claimResponse.json()).goal;
    assert.equal(claimed.id, created.id);
    assert.equal(claimed.orchestration_status, 'running');
    assert.equal(claimed.orchestration_attempts, 1);

    const emptyClaim = await fetch(`${server.origin}/api/orchestration/goals/claim`, {
      method: 'POST', headers: { 'X-Gateway-Token': GATEWAY_TOKEN },
    });
    assert.equal((await emptyClaim.json()).goal, null);

    const waitingResponse = await fetch(`${server.origin}/api/orchestration/goals/${created.id}`, {
      method: 'PATCH', headers: { 'X-Gateway-Token': GATEWAY_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'needs_approval', result: '[BUILD_APPROVAL_REQUIRED] Proposed scope.' }),
    });
    assert.equal(waitingResponse.status, 200);

    const approvedResponse = await fetch(`${server.origin}/api/orchestration/goals/${created.id}/approve`, {
      method: 'POST', headers: { Cookie: server.cookie },
    });
    assert.equal(approvedResponse.status, 200);
    assert.equal((await approvedResponse.json()).orchestration_build_approved, true);

    const reclaimedResponse = await fetch(`${server.origin}/api/orchestration/goals/claim`, {
      method: 'POST', headers: { 'X-Gateway-Token': GATEWAY_TOKEN },
    });
    const reclaimed = (await reclaimedResponse.json()).goal;
    assert.equal(reclaimed.id, created.id);
    assert.equal(reclaimed.orchestration_attempts, 2);

    const completedResponse = await fetch(`${server.origin}/api/orchestration/goals/${created.id}`, {
      method: 'PATCH', headers: { 'X-Gateway-Token': GATEWAY_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', result: 'Recommended action: improve the signal review panel.' }),
    });
    assert.equal(completedResponse.status, 200);

    const listResponse = await fetch(`${server.origin}/api/orchestration/goals`, { headers: { Cookie: server.cookie } });
    const [finished] = await listResponse.json();
    assert.equal(finished.orchestration_status, 'completed');
    assert.match(finished.orchestration_result, /signal review panel/);
  } finally {
    stop(server);
  }
});

test('claim and completion endpoints reject browser sessions without the relay token', async () => {
  const server = await startServer();
  try {
    const claim = await fetch(`${server.origin}/api/orchestration/goals/claim`, { method: 'POST' });
    assert.equal(claim.status, 401);
    const patch = await fetch(`${server.origin}/api/orchestration/goals/not-real`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed' }),
    });
    assert.equal(patch.status, 401);
  } finally {
    stop(server);
  }
});

test('build approval requires an authenticated Jason session and the waiting state', async () => {
  const server = await startServer();
  try {
    const unauthorized = await fetch(`${server.origin}/api/orchestration/goals/not-real/approve`, { method: 'POST' });
    assert.equal(unauthorized.status, 401);
    const wrongState = await fetch(`${server.origin}/api/orchestration/goals/not-real/approve`, {
      method: 'POST', headers: { Cookie: server.cookie },
    });
    assert.equal(wrongState.status, 409);
  } finally {
    stop(server);
  }
});
