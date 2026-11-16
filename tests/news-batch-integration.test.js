'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { startTestServer } = require('./helpers/test-server');

const DIST = path.resolve(__dirname, '../agent-office-deploy/dist');
const TOKEN = 'news-service-token-'.repeat(3);
const GATEWAY = 'gateway-token-long-enough';
const ID = '00000000-0000-4000-8000-000000000001';
const spec = { clientBatchId: `dashboard-top10-2026-11-16-ondemand-${ID.replace(/-/g, '')}`, requestedAt: '2026-11-16T10:00:00.000Z', windowHours: 24, instructions: '' };

async function setup(t) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'office-news-'));
  let server;
  const start = async () => {
    server = await startTestServer({ serverPath: path.join(DIST, 'server.js'), cwd: DIST, buildEnv: port => {
      const env = { ...process.env, PORT: String(port), PUBLIC_APP_URL: `http://127.0.0.1:${port}`, APP_TIMEZONE: 'UTC',
        DROPS_PASSPHRASE: 'news-tests', NEWS_BATCH_SERVICE_TOKEN: TOKEN, GATEWAY_TOKEN: GATEWAY };
      for (const name of ['DROPS', 'PROJECTS', 'MEMORIES', 'AGENTS', 'CALENDAR_EVENTS', 'APP_SETTINGS', 'STREAKS', 'STREAK_DAYS', 'VISITS']) env[`${name}_FILE`] = path.join(scratch, `${name}.json`);
      for (const name of ['DATABASE_URL', 'DROPS_PASSPHRASE_HASH', 'NODE_ENV', 'RAILWAY_ENVIRONMENT', 'RAILWAY_ENVIRONMENT_NAME']) delete env[name];
      return env;
    } });
  };
  const stop = async () => { if (server && server.child.exitCode === null) { const exited = once(server.child, 'exit'); server.child.kill(); await exited; } };
  await start();
  t.after(async () => { await stop(); fs.rmSync(scratch, { recursive: true, force: true }); });
  return { scratch, restart: async () => { await stop(); await start(); },
    owner: async (method, route, body) => {
      const login = await fetch(`${server.origin}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passphrase: 'news-tests' }) });
      return fetch(`${server.origin}${route}`, { method, headers: { Cookie: login.headers.get('set-cookie').split(';')[0], 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body) });
    },
    call: (method, route, body, token = TOKEN) => fetch(`${server.origin}${route}`, { method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) }),
    relay: (method, route, body) => fetch(`${server.origin}${route}`, { method,
      headers: { 'Content-Type': 'application/json', 'X-Gateway-Token': GATEWAY }, body: body === undefined ? undefined : JSON.stringify(body) }),
  };
}

test('narrow service auth, concurrent intake, restart and fenced completion reuse one Penny goal', async t => {
  const api = await setup(t);
  const route = `/api/integrations/news-batches/${ID}`;
  assert.equal((await api.call('POST', route, spec, 'wrong')).status, 401);
  assert.equal((await api.call('POST', '/api/orchestration/goals', { goal: 'arbitrary' })).status, 401);
  assert.equal((await api.call('POST', route, { ...spec, clientBatchId: 'farmclaw-top5-not-permitted' })).status, 400);
  const responses = await Promise.all(Array.from({ length: 6 }, () => api.call('POST', route, spec)));
  assert.ok(responses.every(response => response.status === 200));
  const tickets = await Promise.all(responses.map(response => response.json()));
  assert.equal(new Set(tickets.map(ticket => ticket.goalId)).size, 1);
  assert.equal(tickets[0].clientBatchId, spec.clientBatchId);
  assert.equal(tickets[0].status, 'queued');
  assert.equal(tickets[0].execution, null);
  await api.restart();
  assert.equal((await (await api.call('POST', route, spec)).json()).goalId, tickets[0].goalId);
  assert.equal((await api.call('POST', route, { ...spec, instructions: 'different' })).status, 409);
  assert.equal((await api.owner('DELETE', `/api/orchestration/goals/${tickets[0].goalId}`)).status, 409);
  assert.equal((await api.owner('DELETE', `/api/drops/${tickets[0].goalId}`)).status, 404);
  assert.equal((await api.owner('PATCH', `/api/orchestration/goals/${tickets[0].goalId}/edit`, { goal: 'change task' })).status, 409);
  assert.equal((await api.owner('POST', `/api/orchestration/goals/${tickets[0].goalId}/reference`, {})).status, 409);
  const claimed = await (await api.relay('POST', '/api/orchestration/goals/claim')).json();
  assert.equal(claimed.goal.id, tickets[0].goalId);
  assert.equal(claimed.goal.agent, 'oss');
  assert.match(claimed.goal.content, /commentfarm/);
  assert.match(claimed.goal.content, /Never approve, queue, schedule or publish/);
  assert.equal((await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal, null);
  const patchRoute = `/api/orchestration/goals/${tickets[0].goalId}`;
  assert.equal((await api.relay('PATCH', patchRoute, { status: 'completed', result: '{}' })).status, 409);
  assert.equal((await api.relay('PATCH', patchRoute, { status: 'completed', result: '{}', attempt: 99 })).status, 409);
  const result = { attempt: 1, clientBatchId: spec.clientBatchId, farmclaw: { agentId: 'commentfarm', executionId: 'actual-child' },
    batchId: 'fnb_00000000-0000-4000-8000-000000000002', revision: 1, payloadHash: `sha256:${'a'.repeat(64)}` };
  assert.equal((await api.relay('PATCH', patchRoute, { status: 'completed', result: JSON.stringify(result), attempt: 1 })).status, 200);
  assert.equal((await api.relay('PATCH', patchRoute, { status: 'failed', error: 'late failure', attempt: 1 })).status, 409);
  const completed = await (await api.call('GET', route)).json();
  assert.equal(completed.status, 'completed');
  assert.equal(completed.execution.attempt, 1);
  assert.deepEqual(completed.result, result);
  assert.equal((await (await api.call('POST', route, spec)).json()).status, 'completed');
  assert.equal(JSON.parse(fs.readFileSync(path.join(api.scratch, 'DROPS.json'))).length, 1);
});

test('an ambiguous old news claim is never automatically launched again', async t => {
  const api = await setup(t);
  await api.call('POST', `/api/integrations/news-batches/${ID}`, spec);
  await api.relay('POST', '/api/orchestration/goals/claim');
  const file = path.join(api.scratch, 'DROPS.json');
  const rows = JSON.parse(fs.readFileSync(file));
  rows[0].orchestration_claimed_at = '2000-01-01T00:00:00.000Z';
  fs.writeFileSync(file, JSON.stringify(rows));
  await api.restart();
  assert.equal((await (await api.relay('POST', '/api/orchestration/goals/claim')).json()).goal, null);
  assert.equal((await (await api.call('GET', `/api/integrations/news-batches/${ID}`)).json()).execution.attempt, 1);
});
