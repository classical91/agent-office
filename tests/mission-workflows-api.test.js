'use strict';

// Mission Control's workflow dashboard against a real server: the records are
// dashboard-only, the OpenClaw inventory is mirrored rather than owned, and a
// schedule inventory pasted in as a goal can never be claimed by Penny.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const DIST = path.resolve(__dirname, '..', 'agent-office-deploy', 'dist');
const PASSPHRASE = 'mission-workflows';
const SHORTCUTS_TOKEN = 'mission-workflows-shortcut-token';
const GATEWAY_TOKEN = 'mission-workflows-gateway-token';

function buildEnvFor(scratch) {
  return port => {
    const environment = {
      ...process.env,
      PORT: String(port),
      PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
      APP_TIMEZONE: 'UTC',
      APP_SETTINGS_FILE: path.join(scratch, 'settings.json'),
      CALENDAR_EVENTS_FILE: path.join(scratch, 'calendar-events.json'),
      AGENTS_FILE: path.join(scratch, 'agents.json'),
      MEMORIES_FILE: path.join(scratch, 'memories.json'),
      DROPS_FILE: path.join(scratch, 'drops.json'),
      PROJECTS_FILE: path.join(scratch, 'projects.json'),
      STREAKS_FILE: path.join(scratch, 'streaks.json'),
      STREAK_DAYS_FILE: path.join(scratch, 'streak-days.json'),
      COUNTDOWNS_FILE: path.join(scratch, 'countdowns.json'),
      DROPS_PASSPHRASE: PASSPHRASE,
      SHORTCUTS_TOKEN,
      GATEWAY_TOKEN,
    };
    ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DROPS_PASSPHRASE_HASH']
      .forEach(key => { delete environment[key]; });
    return environment;
  };
}

async function startServer(existing) {
  const scratch = existing || fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-workflows-'));
  const server = await startTestServer({ serverPath: path.join(DIST, 'server.js'), cwd: DIST, buildEnv: buildEnvFor(scratch) });
  const login = await fetch(`${server.origin}/api/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  assert.equal(login.status, 200);
  return { ...server, scratch, cookie: String(login.headers.get('set-cookie') || '').split(';')[0] };
}

function stop(server, { keepScratch = false } = {}) {
  server.child.kill();
  if (!keepScratch) fs.rmSync(server.scratch, { recursive: true, force: true });
}

async function restart(server) {
  const scratch = server.scratch;
  stop(server, { keepScratch: true });
  return startServer(scratch);
}

async function call(server, method, route, body, headers = {}) {
  const response = await fetch(`${server.origin}${route}`, {
    method,
    headers: { Cookie: server.cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function relay(server, route, body) {
  return fetch(`${server.origin}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Gateway-Token': GATEWAY_TOKEN },
    body: JSON.stringify(body),
  });
}

const CHATGPT_INVENTORY = [
  '- Daily reflection: every day at 9 PM',
  '- Repo audit: weekly on Monday 10 AM',
  '- Security audit: monthly on the 1st',
  '- Workflow audit: every Friday at 4 PM',
].join('\n');

test('workflow routes are behind the Office session and the phone-inbox token', async () => {
  const server = await startServer();
  try {
    assert.equal((await fetch(`${server.origin}/api/workflows`)).status, 401);
    assert.equal((await fetch(`${server.origin}/api/shortcuts/workflow-runs`, { method: 'POST' })).status, 401);
    const dashboard = await call(server, 'GET', '/api/workflows');
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.display_zone, 'America/Vancouver');
    assert.equal(dashboard.body.sources.openclaw.state, 'not_connected');
    assert.deepEqual(dashboard.body.workflows, []);
  } finally { stop(server); }
});

test('an inventory pasted in as a goal is moved out of Penny\'s queue, kept, and restorable', async () => {
  let server = await startServer();
  try {
    const inventoryText = 'OpenClaw cron jobs (17)\n1. Morning brief — `0 8 * * *` id: morning-brief';
    const inventory = await call(server, 'POST', '/api/orchestration/goals', { title: 'OpenClaw cron jobs', goal: inventoryText, priority: 'urgent' });
    const real = await call(server, 'POST', '/api/orchestration/goals', { title: 'Ship the landing page', goal: 'Build it', priority: 'urgent' });
    assert.equal(inventory.status, 201);

    server = await restart(server);
    const goals = (await call(server, 'GET', '/api/orchestration/goals')).body;
    assert.deepEqual(goals.map(goal => goal.title), ['Ship the landing page'], 'the inventory is no longer a goal');

    // Penny's claim reaches the real goal and never the inventory.
    const claim = await relay(server, '/api/orchestration/goals/claim', {});
    assert.equal((await claim.json()).goal.id, real.body.id);
    assert.equal((await (await relay(server, '/api/orchestration/goals/claim', {})).json()).goal, null);

    const archive = (await call(server, 'GET', '/api/workflows')).body.archive;
    assert.equal(archive.length, 1);
    assert.equal(archive[0].title, 'OpenClaw cron jobs');
    assert.equal(archive[0].content, inventoryText, 'the original text is kept verbatim');
    assert.equal(archive[0].previous_priority, 'urgent');

    // Restoring puts it back exactly as it was, and a restart does not undo
    // Jason's choice.
    const restored = await call(server, 'POST', `/api/workflows/archive/${archive[0].id}/restore`, {});
    assert.equal(restored.status, 200);
    assert.equal(restored.body.goal.priority, 'urgent');
    assert.equal(restored.body.goal.orchestration_status, 'queued');
    server = await restart(server);
    const after = (await call(server, 'GET', '/api/orchestration/goals')).body;
    assert.ok(after.some(goal => goal.id === inventory.body.id));
  } finally { stop(server); }
});

test('any goal can be moved to workflow reference by hand, and then cannot be claimed', async () => {
  const server = await startServer();
  try {
    const goal = await call(server, 'POST', '/api/orchestration/goals', { title: 'ChatGPT schedule notes', goal: 'Brief daily 8am', priority: 'urgent' });
    const moved = await call(server, 'POST', `/api/orchestration/goals/${goal.body.id}/reference`, {});
    assert.equal(moved.status, 200);
    assert.equal((await (await relay(server, '/api/orchestration/goals/claim', {})).json()).goal, null);
    assert.deepEqual((await call(server, 'GET', '/api/orchestration/goals')).body, []);
    // Editing an archived goal cannot sneak it back into the queue.
    await call(server, 'PATCH', `/api/orchestration/goals/${goal.body.id}/edit`, { title: 'x', goal: 'y', priority: 'urgent' });
    assert.equal((await (await relay(server, '/api/orchestration/goals/claim', {})).json()).goal, null);
  } finally { stop(server); }
});

test('imports preview first, dedupe on repeat, never drop records, and leave goals alone', async () => {
  const server = await startServer();
  try {
    const preview = await call(server, 'POST', '/api/workflows/import', { provider: 'chatgpt', text: CHATGPT_INVENTORY, dry_run: true });
    assert.equal(preview.status, 200);
    assert.equal(preview.body.drafts.length, 4);
    assert.deepEqual((await call(server, 'GET', '/api/workflows')).body.workflows, [], 'a preview saves nothing');

    const first = await call(server, 'POST', '/api/workflows/import', { provider: 'chatgpt', text: CHATGPT_INVENTORY });
    assert.deepEqual([first.body.created, first.body.updated, first.body.unchanged], [4, 0, 0]);
    const again = await call(server, 'POST', '/api/workflows/import', { provider: 'chatgpt', text: CHATGPT_INVENTORY });
    assert.deepEqual([again.body.created, again.body.updated, again.body.unchanged], [0, 0, 4]);
    const partial = await call(server, 'POST', '/api/workflows/import', { provider: 'chatgpt', text: '- Daily reflection: every day at 10 PM' });
    assert.deepEqual([partial.body.created, partial.body.updated], [0, 1]);

    const dashboard = (await call(server, 'GET', '/api/workflows')).body;
    assert.equal(dashboard.workflows.length, 4, 'a partial import removes nothing');
    const reflection = dashboard.workflows.find(w => w.name === 'Daily reflection');
    assert.equal(reflection.schedule.text, 'every day at 10 PM');
    assert.equal(reflection.schedule.flexible, true, 'ChatGPT timing is flexible');
    assert.equal(reflection.next_run.basis, 'unknown', 'a provider-native schedule is not guessed');
    assert.equal(reflection.health, 'unknown', 'no history is unknown, not failed');
    assert.deepEqual(dashboard.attention, []);

    // Three ChatGPT audits are flagged together and all kept.
    assert.equal(dashboard.overlaps.length, 1);
    assert.equal(dashboard.overlaps[0].names.length, 3);
    const ack = await call(server, 'POST', '/api/workflows/overlaps/acknowledge', { key: dashboard.overlaps[0].key });
    assert.equal(ack.status, 200);
    assert.equal((await call(server, 'GET', '/api/workflows')).body.overlaps[0].acknowledged, true);

    assert.deepEqual((await call(server, 'GET', '/api/orchestration/goals')).body, [], 'no import creates a goal');
  } finally { stop(server); }
});

test('the OpenClaw inventory is mirrored live, kept as a stale snapshot, and only annotated here', async () => {
  let server = await startServer();
  try {
    const jobs = [
      { id: 'brief', name: 'Morning brief', enabled: true, schedule: { kind: 'cron', expr: '0 8 */2 * *', tz: 'America/Vancouver' }, next_run_at_ms: Date.now() + 3600000, last_run_at_ms: Date.now() - 3600000, last_run_status: 'ok' },
      { id: 'audit', name: 'Nightly audit', enabled: true, schedule: { kind: 'cron', expr: '0 2 * * *', tz: 'UTC' }, last_run_at_ms: Date.now() - 7200000, last_run_status: 'error', last_run_error: 'Telegram timed out' },
      { id: 'old', name: 'Retired digest', enabled: false, schedule: { kind: 'cron', expr: '0 9 * * 1' } },
    ];
    assert.equal((await relay(server, '/api/gateway/heartbeat', { host: 'desk', agents: [], cron_jobs: jobs })).status, 200);

    let dashboard = (await call(server, 'GET', '/api/workflows')).body;
    assert.equal(dashboard.sources.openclaw.state, 'live');
    const brief = dashboard.workflows.find(w => w.provider_id === 'brief');
    assert.equal(brief.schedule.expr, '0 8 */2 * *', 'the expression is preserved exactly');
    assert.equal(brief.next_run.basis, 'provider');
    assert.match(brief.schedule_notes.join(' '), /not always 48 hours apart/);
    assert.equal(brief.health, 'succeeded');
    const retired = dashboard.workflows.find(w => w.provider_id === 'old');
    assert.equal(retired.enabled, false);
    assert.equal(retired.health, 'disabled', 'disabled jobs are kept');
    assert.ok(!dashboard.upcoming.includes(retired.id));
    assert.deepEqual(dashboard.attention.map(item => item.kind), ['failed']);

    // Schedule and enabled state belong to OpenClaw.
    assert.equal((await call(server, 'PATCH', `/api/workflows/${encodeURIComponent(brief.id)}`, { enabled: false })).status, 409);
    assert.equal((await call(server, 'DELETE', `/api/workflows/${encodeURIComponent(brief.id)}`)).status, 409);
    const annotated = await call(server, 'PATCH', `/api/workflows/${encodeURIComponent(brief.id)}`, { delivery: 'Telegram', purpose: 'Markets and calendar' });
    assert.equal(annotated.status, 200);

    // A restart keeps the snapshot but says it is stale — a connection state,
    // not a failure of every job.
    server = await restart(server);
    dashboard = (await call(server, 'GET', '/api/workflows')).body;
    assert.equal(dashboard.sources.openclaw.state, 'stale');
    const staleBrief = dashboard.workflows.find(w => w.provider_id === 'brief');
    assert.equal(staleBrief.delivery, 'Telegram', 'annotations survive and attach to the live job');
    assert.equal(staleBrief.health, 'stale');
    assert.equal(dashboard.workflows.filter(w => w.provider === 'openclaw').length, 3, 'no duplicate record for the annotated job');
    assert.deepEqual(dashboard.attention.map(item => item.kind).sort(), ['failed', 'stale_connection']);
  } finally { stop(server); }
});

test('execution and delivery are recorded separately, from the panel or a Shortcut', async () => {
  const server = await startServer();
  try {
    await call(server, 'POST', '/api/workflows/import', { provider: 'chatgpt', text: CHATGPT_INVENTORY });
    let dashboard = (await call(server, 'GET', '/api/workflows')).body;
    const reflection = dashboard.workflows.find(w => w.name === 'Daily reflection');

    const manual = await call(server, 'POST', `/api/workflows/${reflection.id}/runs`, {
      execution_status: 'succeeded', delivery_status: 'failed', error: 'Email bounced', output_title: 'Reflection — Oct 9',
    });
    assert.equal(manual.status, 201);
    dashboard = (await call(server, 'GET', '/api/workflows')).body;
    assert.equal(dashboard.workflows.find(w => w.id === reflection.id).health, 'delivery_failed');
    assert.deepEqual(dashboard.attention.map(item => item.kind), ['delivery_failed']);

    const bad = await call(server, 'POST', `/api/workflows/${reflection.id}/runs`, { output_url: 'javascript:alert(1)' });
    assert.equal(bad.status, 400);

    const reported = await fetch(`${server.origin}/api/shortcuts/workflow-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shortcuts-Token': SHORTCUTS_TOKEN },
      body: JSON.stringify({ provider: 'chatgpt', workflow: 'daily reflection', status: 'completed', delivery_status: 'delivered', output_url: 'https://chatgpt.com/c/abc', output_title: 'Reflection — Oct 10' }),
    });
    assert.equal(reported.status, 201);
    dashboard = (await call(server, 'GET', '/api/workflows')).body;
    assert.equal(dashboard.workflows.find(w => w.id === reflection.id).health, 'delivered');
    assert.equal(dashboard.results[0].output_url, 'https://chatgpt.com/c/abc');
    assert.equal(dashboard.results[0].workflow_name, 'Daily reflection');
    assert.deepEqual(dashboard.attention, []);

    const unknown = await fetch(`${server.origin}/api/shortcuts/workflow-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shortcuts-Token': SHORTCUTS_TOKEN },
      body: JSON.stringify({ workflow: 'no such thing' }),
    });
    assert.equal(unknown.status, 404);
  } finally { stop(server); }
});

test('the earlier tracked schedules carry over once as manual workflows', async () => {
  let server = await startServer();
  try {
    const item = { title: 'Brief', source: 'Claude', start: '2026-10-06T08:00', repeat: 'weekly', timezone: 'America/Vancouver', notes: 'from Claude' };
    // The legacy list is written before the workflow store is ever read.
    assert.equal((await call(server, 'PUT', '/api/mission-schedules', { items: [item], previous: [] })).status, 200);
    let dashboard = (await call(server, 'GET', '/api/workflows')).body;
    assert.equal(dashboard.workflows.length, 1);
    assert.equal(dashboard.workflows[0].provider, 'claude');
    assert.equal(dashboard.workflows[0].schedule.expr, '0 8 * * 2', 'Oct 6 2026 is a Tuesday');
    assert.equal(dashboard.workflows[0].source, 'manual');

    server = await restart(server);
    dashboard = (await call(server, 'GET', '/api/workflows')).body;
    assert.equal(dashboard.workflows.length, 1, 'migrated once, not on every read');

    // Manual records are edited and removed here; the dashboard says the
    // automation itself is untouched.
    const id = dashboard.workflows[0].id;
    const edited = await call(server, 'PATCH', `/api/workflows/${id}`, { enabled: false });
    assert.equal(edited.body.enabled, false);
    const removed = await call(server, 'DELETE', `/api/workflows/${id}`);
    assert.match(removed.body.note, /dashboard only/);
  } finally { stop(server); }
});
