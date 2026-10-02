'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { startTestServer } = require('./helpers/test-server.js');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');
const PASSPHRASE = 'journal-office-passphrase';
const JOURNAL_TOKEN = 'journal-token-long-enough-for-tests';
const SHORTCUTS_TOKEN = 'shortcuts-token-long-enough-for-tests';

async function startServer() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-journal-'));
  const buildEnv = port => ({
    ...process.env,
    PORT: String(port),
    PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
    APP_SETTINGS_FILE: path.join(scratch, 'settings.json'),
    DROPS_FILE: path.join(scratch, 'drops.json'),
    MEMORIES_FILE: path.join(scratch, 'memories.json'),
    PROJECTS_FILE: path.join(scratch, 'projects.json'),
    AGENTS_FILE: path.join(scratch, 'agents.json'),
    PROMPTS_FILE: path.join(scratch, 'prompts.json'),
    STREAKS_FILE: path.join(scratch, 'streaks.json'),
    STREAK_DAYS_FILE: path.join(scratch, 'streak-days.json'),
    COUNTDOWNS_FILE: path.join(scratch, 'countdowns.json'),
    VISITS_FILE: path.join(scratch, 'visits.json'),
    CALENDAR_EVENTS_FILE: path.join(scratch, 'calendar.json'),
    DROPS_PASSPHRASE: PASSPHRASE,
    JOURNAL_TOKEN,
    SHORTCUTS_TOKEN,
    DATABASE_URL: '',
  });
  const server = await startTestServer({ serverPath: SERVER_PATH, cwd: DIST, buildEnv });
  const login = await fetch(`${server.origin}/api/session`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ passphrase: PASSPHRASE }) });
  return { ...server, scratch, cookie: login.headers.get('set-cookie').split(';')[0] };
}

function stop(server) { server.child.kill(); fs.rmSync(server.scratch, { recursive: true, force: true }); }

test('journal sync is token-authenticated, sanitized, and session-readable', async () => {
  const server = await startServer();
  try {
    const entry = {
      record_id: 'dry-run-1', record_type: 'dry_run', timestamp_utc: '2026-08-11T20:00:00Z', asset: 'BTCUSDT', direction: 'LONG', timeframe: '1h', regime: 'risk-on',
      strategy: { name: 'EMA', version: 'v1', secret: 'drop-me' },
      lesson: { evidence_based_lesson: 'Wait for confirmation.' },
      promotion_gate: { status: 'rejected', reason: 'Sample too small', sample_size: 1, out_of_sample: false, walk_forward: false },
      source_refs: ['C:/private/path'], audit: { credentials: 'never-sync' },
    };
    const denied = await fetch(`${server.origin}/api/traderclaw-journal/sync`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({entries:[entry]}) });
    assert.equal(denied.status, 401);
    const synced = await fetch(`${server.origin}/api/traderclaw-journal/sync`, { method:'POST', headers:{'Content-Type':'application/json','X-Journal-Token':JOURNAL_TOKEN}, body:JSON.stringify({entries:[entry]}) });
    assert.equal(synced.status, 200);
    const locked = await fetch(`${server.origin}/api/traderclaw-journal`);
    assert.equal(locked.status, 401);
    const response = await fetch(`${server.origin}/api/traderclaw-journal`, { headers:{cookie:server.cookie} });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.entries[0].asset, 'BTCUSDT');
    assert.equal(payload.counts.rejected, 1);
    assert.equal(payload.entries[0].source_refs, undefined);
    assert.equal(payload.entries[0].audit, undefined);
    assert.equal(payload.entries[0].strategy.secret, undefined);
  } finally { stop(server); }
});

test('journal page and shared navigation are shipped', () => {
  const page = fs.readFileSync(path.join(DIST, 'traderclaw-journal.html'), 'utf8');
  const shell = fs.readFileSync(path.join(ROOT, 'scripts', 'shell', 'shell.html'), 'utf8');
  assert.match(page, /TraderClaw Journal - Agent Office/);
  assert.match(page, /traderclaw-journal\.js/);
  assert.doesNotMatch(shell, /href="\/traderclaw-journal\.html"/);
});

test('the phone inbox serves a journal roll-up, and only the summary of it', async () => {
  // The journal page is session-authenticated because an entry's substance is
  // its thesis and its lesson. The roll-up is for the things that cannot hold a
  // session — an evening Shortcut, and Main Hub's dashboard card — so it says
  // what a roll-up says out loud and stops there.
  const server = await startServer();
  try {
    const entry = {
      record_id: 'dry-run-2',
      record_type: 'dry_run',
      timestamp_utc: '2026-08-12T20:00:00Z',
      asset: 'ETHUSDT',
      direction: 'SHORT',
      timeframe: '4h',
      regime: 'risk-off',
      strategy: { name: 'Mean reversion', version: 'v3' },
      thesis: { setup: 'Faded the open', invalidation: 'Above the prior high' },
      result: { status: 'win', r_multiple: '1.8' },
      lesson: { evidence_based_lesson: 'The London open held.' },
      promotion_gate: { status: 'validated', sample_size: 40 },
    };

    const synced = await fetch(`${server.origin}/api/traderclaw-journal/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Journal-Token': JOURNAL_TOKEN },
      body: JSON.stringify({ entries: [entry] }),
    });
    assert.equal(synced.status, 200);

    // Behind the phone inbox's own token, like every other /api/shortcuts route.
    const anonymous = await fetch(`${server.origin}/api/shortcuts/traderclaw-journal`);
    assert.equal(anonymous.status, 401);

    const response = await fetch(`${server.origin}/api/shortcuts/traderclaw-journal`, {
      headers: { 'X-Shortcuts-Token': SHORTCUTS_TOKEN },
    });
    assert.equal(response.status, 200);
    const payload = await response.json();

    assert.equal(payload.counts.validated, 1);
    assert.equal(payload.count, 1);

    const [row] = payload.entries;
    assert.equal(row.asset, 'ETHUSDT');
    assert.equal(row.direction, 'SHORT');
    assert.equal(row.strategy, 'Mean reversion');
    assert.equal(row.result_status, 'win');
    assert.equal(row.r_multiple, '1.8');
    assert.equal(row.gate_status, 'validated');

    // The journal's substance stays on the journal page.
    assert.equal(row.thesis, undefined);
    assert.equal(row.lesson, undefined);
    assert.equal(row.quality, undefined);
    assert.doesNotMatch(JSON.stringify(payload), /Faded the open/);
    assert.doesNotMatch(JSON.stringify(payload), /London open held/);

    // A Shortcut can speak the answer without parsing it.
    const text = await fetch(`${server.origin}/api/shortcuts/traderclaw-journal?format=text`, {
      headers: { 'X-Shortcuts-Token': SHORTCUTS_TOKEN },
    });
    assert.equal(text.status, 200);
    const body = await text.text();
    assert.match(body, /1 entries · 1 validated · 0 rejected/);
    assert.match(body, /ETHUSDT SHORT/);
    assert.match(body, /win · 1.8R · validated/);
  } finally { stop(server); }
});

test('an empty journal is an empty roll-up, not an error', async () => {
  const server = await startServer();
  try {
    const response = await fetch(`${server.origin}/api/shortcuts/traderclaw-journal`, {
      headers: { 'X-Shortcuts-Token': SHORTCUTS_TOKEN },
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload.entries, []);
    assert.equal(payload.synced_at, null);
  } finally { stop(server); }
});
