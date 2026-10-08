'use strict';

// The Planning Mode API against a real server: the list is personal, so every
// route sits behind the Office passphrase, and the list persists across a
// restart because a planning list that forgets on Sunday night is not a
// planning list.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

const PASSPHRASE = 'plan-the-week';
const SHORTCUTS_TOKEN = 'coachclaw-planning-test-token';
const GATEWAY_TOKEN = 'gateway-token-long-enough';

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
  const scratch = existing || fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-planning-'));
  const server = await startTestServer({ serverPath: SERVER_PATH, cwd: DIST, buildEnv: buildEnvFor(scratch) });
  const cookie = await unlock(server.origin);
  return { ...server, scratch, cookie };
}

function stop(server, { keepScratch = false } = {}) {
  server.child.kill();
  if (!keepScratch) fs.rmSync(server.scratch, { recursive: true, force: true });
}

async function unlock(origin) {
  const response = await fetch(`${origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  assert.equal(response.status, 200);
  return String(response.headers.get('set-cookie') || '').split(';')[0];
}

function call(server, pathname, options = {}) {
  return fetch(`${server.origin}${pathname}`, {
    ...options,
    headers: { Cookie: server.cookie, ...(options.headers || {}) },
  });
}

test('schedule registry is authenticated, persistent, validated and isolated from Penny', async () => {
 let server=await startServer();
 try {
  assert.equal((await fetch(server.origin+'/api/mission-schedules')).status,401);
  const item={title:'Brief',source:'Claude',start:'2026-10-06T08:00',repeat:'daily',timezone:'America/Vancouver',notes:''};
  const put=(items,previous)=>call(server,'/api/mission-schedules',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,previous})});
  assert.equal((await put([item],[])).status,200);
  assert.equal((await put([],[])).status,409);
  assert.equal((await put([{...item,start:'invalid'}],[item])).status,400);
  assert.deepEqual((await (await call(server,'/api/mission-schedules')).json()).items,[item]);
  assert.deepEqual(await (await call(server,'/api/orchestration/goals')).json(),[]);
  const scratch=server.scratch;stop(server,{keepScratch:true});server=await startServer(scratch);
  assert.deepEqual((await (await call(server,'/api/mission-schedules')).json()).items,[item]);
 } finally {stop(server);}
});

test('the last cron inventory survives a server restart as a stale snapshot', async () => {
  let server = await startServer();
  try {
    const job = { id: 'daily-brief', name: 'Daily brief', enabled: true, schedule: { kind: 'cron', expr: '0 8 * * *' }, next_run_at_ms: 1790000000000 };
    const beat = await fetch(`${server.origin}/api/gateway/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Gateway-Token': GATEWAY_TOKEN },
      body: JSON.stringify({ host: 'jason-desktop', agents: [], cron_jobs: [job] }),
    });
    assert.equal(beat.status, 200);
    const live = await (await call(server, '/api/cron-jobs')).json();
    assert.equal(live.fresh, true);
    assert.deepEqual(live.jobs.map(item => item.name), ['Daily brief']);

    const scratch = server.scratch; stop(server, { keepScratch: true }); server = await startServer(scratch);
    const recalled = await (await call(server, '/api/cron-jobs')).json();
    assert.equal(recalled.fresh, false, 'nothing has reported since the restart');
    assert.equal(recalled.updated_at, live.updated_at);
    assert.deepEqual(recalled.jobs.map(item => item.name), ['Daily brief']);
    assert.equal(recalled.jobs[0].schedule.expr, '0 8 * * *');

    // The relay's first beat after a restart can arrive before it has read cron.
    await fetch(`${server.origin}/api/gateway/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Gateway-Token': GATEWAY_TOKEN },
      body: JSON.stringify({ host: 'jason-desktop', agents: [] }),
    });
    const kept = await (await call(server, '/api/cron-jobs')).json();
    assert.equal(kept.fresh, true);
    assert.deepEqual(kept.jobs.map(item => item.name), ['Daily brief']);
  } finally { stop(server); }
});
