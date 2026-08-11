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
  assert.match(shell, /href="\/traderclaw-journal\.html"/);
});
