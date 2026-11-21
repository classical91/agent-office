'use strict';

// The read-only audit summary Main Hub's System Logs reads: how audits-data.js
// is read (never executed), what the summary counts, and the route's lock.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const {
  ROUTE,
  createAuditsSummarySource,
  handleAuditsSummaryIntegration,
  parseAuditsSource,
  summarizeAudits,
} = require(path.join(DIST, 'audits-summary.js'));

const TOKEN = 'audit-summary-test-token-0123456789abcdef';

function weekly(overrides = {}) {
  return {
    id: 'weekly-2026-11-15-farm-bot',
    project: 'FarmBot',
    type: 'Weekly repository audit',
    auditedAt: '2026-11-15',
    overallStatus: 'At risk — production not verified',
    repository: 'classical91/farm-bot',
    findings: {
      critical: [],
      high: [{ id: 'H1', summary: 'Memory fallback', classification: 'Verified finding (code)', evidence: 'https://github.com/x/y' }],
      medium: [{ id: 'M1', summary: 'Race' }],
      low: [],
    },
    checks: { production: 'Not verified' },
    references: ['https://github.com/classical91/farm-bot', 'javascript:alert(1)', 'http://plain.example.com'],
    ...overrides,
  };
}

// ─── Reading the file ──────────────────────────────────────────────────────

test('the file is read as JSON and never executed', () => {
  const records = parseAuditsSource('/* note */\nwindow.AUDITS = [{"project":"A","auditedAt":"2026-01-01"}];\n');
  assert.deepEqual(records, [{ project: 'A', auditedAt: '2026-01-01' }]);

  // Script that would run if evaluated is refused as unreadable instead.
  global.__auditsSummaryRan = false;
  assert.throws(
    () => parseAuditsSource('window.AUDITS = (global.__auditsSummaryRan = true, []);'),
    /not a plain JSON array/
  );
  assert.equal(global.__auditsSummaryRan, false);
  delete global.__auditsSummaryRan;

  assert.throws(() => parseAuditsSource('var x = 1;'), /does not assign window\.AUDITS/);
  assert.throws(() => parseAuditsSource('window.AUDITS = {"a":1};'), /not an array/);
});

test('the real audits-data.js parses and summarizes', () => {
  const source = fs.readFileSync(path.join(DIST, 'audits-data.js'), 'utf8');
  const records = parseAuditsSource(source);
  const summary = summarizeAudits(records, { now: new Date('2026-11-21T00:00:00Z') });
  assert.equal(summary.totals.records, records.length);
  assert.equal(summary.totals.duplicates, 0);
  assert.equal(summary.totals.skipped, 0);
  // Every FarmBot record is one repository, including the two older ones that
  // name no repository of their own.
  const farm = summary.repositories.find(entry => entry.repository === 'classical91/farm-bot');
  assert.ok(farm);
  assert.equal(farm.auditCount, records.filter(r => r.project === 'FarmBot').length);
  assert.equal(summary.repositories.filter(entry => entry.project === 'FarmBot').length, 1);
  // The latest is the newest record, and its counts are its own.
  const newest = records.slice().sort((a, b) => Date.parse(b.auditedAt) - Date.parse(a.auditedAt))[0];
  assert.equal(summary.latest.id, newest.id);
  for (const level of ['critical', 'high', 'medium', 'low']) {
    assert.equal(summary.latest.counts[level], newest.findings[level].length);
  }
});

// ─── What the summary counts ───────────────────────────────────────────────

test('current counts come from each repository\'s latest audit, not the sum of its history', () => {
  const older = weekly({
    id: 'weekly-2026-11-08-farm-bot',
    auditedAt: '2026-11-08',
    findings: { critical: [{ summary: 'old critical' }], high: [{ summary: 'a' }, { summary: 'b' }, { summary: 'c' }], medium: [], low: [] },
  });
  // File order is not trusted: the older record comes first here.
  const summary = summarizeAudits([older, weekly()]);
  assert.equal(summary.totals.records, 2);
  assert.equal(summary.totals.projects, 1);
  const [farm] = summary.repositories;
  assert.equal(farm.auditCount, 2);
  assert.equal(farm.latest.id, 'weekly-2026-11-15-farm-bot');
  assert.deepEqual(farm.latest.counts, { critical: 0, high: 1, medium: 1, low: 0 });
  assert.deepEqual(farm.history.map(h => h.date), ['2026-11-15', '2026-11-08']);
  assert.equal(summary.latest.id, 'weekly-2026-11-15-farm-bot');
});

test('a record with no findings is "missing", never zero', () => {
  const summary = summarizeAudits([{ project: 'Agent Office', type: 'Security audit', auditedAt: '2026-09-16', note: 'Done.' }]);
  assert.equal(summary.latest.findingsState, 'missing');
  assert.equal(summary.latest.counts, null);
  assert.deepEqual(summary.latest.topFindings, []);
});

test('a malformed findings section is "unverified" and counts only what is a list', () => {
  const partial = summarizeAudits([weekly({ findings: { high: [{ summary: 'x' }], medium: 'see notes' } })]);
  assert.equal(partial.latest.findingsState, 'unverified');
  assert.deepEqual(partial.latest.counts, { critical: null, high: 1, medium: null, low: null });
  const wrongType = summarizeAudits([weekly({ findings: ['x'] })]);
  assert.equal(wrongType.latest.findingsState, 'unverified');
  assert.equal(wrongType.latest.counts, null);
});

test('duplicate records are counted once and records with no project are skipped', () => {
  const legacy = { project: 'Market Dashboard', type: 'Strategy parity audit', auditedAt: '2026-08-21T04:42:28Z' };
  const summary = summarizeAudits([weekly(), weekly(), legacy, { ...legacy }, { type: 'orphan' }, null, 'x']);
  assert.equal(summary.totals.records, 2);
  assert.equal(summary.totals.duplicates, 2);
  assert.equal(summary.totals.skipped, 3);
  assert.equal(summary.totals.projects, 2);
});

test('a derived id does not depend on where a record sits in the file', () => {
  const legacy = { project: 'Agent Office', type: 'Security audit', auditedAt: '2026-09-16' };
  const a = summarizeAudits([legacy]).latest.id;
  const b = summarizeAudits([weekly(), weekly({ id: 'another' }), legacy]).repositories.find(r => r.project === 'Agent Office').latest.id;
  assert.equal(a, b);
});

test('undated records sort last and are still counted', () => {
  const summary = summarizeAudits([{ project: 'Mystery', auditedAt: 'soon' }, weekly()]);
  assert.equal(summary.totals.records, 2);
  assert.equal(summary.latest.id, 'weekly-2026-11-15-farm-bot');
  const mystery = summary.repositories.find(r => r.project === 'Mystery');
  assert.equal(mystery.latest.auditedAt, null);
  assert.equal(mystery.latest.date, null);
});

test('only https links leave, text is trimmed, and long audit sections stay home', () => {
  const summary = summarizeAudits([weekly({ note: 'n'.repeat(2000), scope: 'long scope', recommendedFixes: ['a'] })]);
  const latest = summary.latest;
  assert.deepEqual(latest.references, ['https://github.com/classical91/farm-bot']);
  assert.ok(latest.note.length <= 400);
  assert.equal(latest.productionCheck, 'Not verified');
  assert.equal(latest.topFindings[0].evidence, 'https://github.com/x/y');
  assert.equal(latest.topFindings[0].severity, 'high');
  for (const key of ['scope', 'recommendedFixes', 'priorityRanking', '_time', '_index']) {
    assert.equal(key in latest, false, `${key} should not be in the summary`);
  }
  const bad = summarizeAudits([weekly({ repository: 'not a repo <script>', findings: { critical: [], high: [{ summary: 'x', evidence: 'javascript:alert(1)' }], medium: [], low: [] } })]);
  assert.equal(bad.latest.repository, null);
  assert.equal(bad.latest.topFindings[0].evidence, null);
});

test('the source re-reads the file only when it changes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audits-summary-'));
  const file = path.join(dir, 'audits-data.js');
  try {
    fs.writeFileSync(file, `window.AUDITS = ${JSON.stringify([weekly()])};`);
    const source = createAuditsSummarySource({ file });
    assert.equal((await source.summary()).totals.records, 1);
    fs.writeFileSync(file, `window.AUDITS = ${JSON.stringify([weekly(), weekly({ id: 'next', auditedAt: '2026-11-22' })])};`);
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(file, later, later);
    const summary = await source.summary();
    assert.equal(summary.totals.records, 2);
    assert.equal(summary.latest.id, 'next');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ─── The route ─────────────────────────────────────────────────────────────

function fakeRes() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
  };
}

function capture() {
  const calls = [];
  return { calls, sendJson: (res, status, body, headers) => calls.push({ status, body, headers }) };
}

test('the handler only claims its own path and stays closed without a long token', async () => {
  const { calls, sendJson } = capture();
  const req = { method: 'GET', headers: { authorization: 'Bearer short' } };
  assert.equal(await handleAuditsSummaryIntegration({ req, res: fakeRes(), pathname: '/api/other', sendJson, token: TOKEN }), false);
  assert.equal(calls.length, 0);
  assert.equal(await handleAuditsSummaryIntegration({ req, res: fakeRes(), pathname: ROUTE, sendJson, token: 'short' }), true);
  assert.equal(calls[0].status, 503);
  assert.equal(await handleAuditsSummaryIntegration({ req, res: fakeRes(), pathname: ROUTE, sendJson, token: '' }), true);
  assert.equal(calls[1].status, 503);
});

test('an unreadable history answers 500 without the file\'s contents', async () => {
  const { calls, sendJson } = capture();
  const source = { summary: async () => { throw new Error('secret detail from parser'); } };
  const req = { method: 'GET', headers: { authorization: `Bearer ${TOKEN}` } };
  await handleAuditsSummaryIntegration({ req, res: fakeRes(), pathname: ROUTE, sendJson, token: TOKEN, source, log: {} });
  assert.equal(calls[0].status, 500);
  assert.doesNotMatch(JSON.stringify(calls[0].body), /secret detail/);
});

async function startServer(env) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-audits-summary-'));
  const buildEnv = port => {
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
    };
    ['DATABASE_URL', 'GOOGLE_REFRESH_TOKEN', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DROPS_PASSPHRASE',
      'DROPS_PASSPHRASE_HASH', 'NODE_ENV', 'RAILWAY_ENVIRONMENT', 'RAILWAY_ENVIRONMENT_NAME', 'RAILWAY_PROJECT_ID',
      'RAILWAY_SERVICE_ID', 'SESSION_SECRET', 'AUDITS_SUMMARY_TOKEN'].forEach(key => { delete environment[key]; });
    return Object.assign(environment, env);
  };
  const server = await startTestServer({ serverPath: path.join(DIST, 'server.js'), cwd: DIST, buildEnv });
  return {
    ...server,
    stop() {
      server.child.kill();
      fs.rmSync(scratch, { recursive: true, force: true });
    },
  };
}

test('the route on a real server: lock, read-only, contract, and the Audit Log page untouched', async () => {
  const server = await startServer({ AUDITS_SUMMARY_TOKEN: TOKEN, DROPS_PASSPHRASE: 'audits-summary-test-passphrase' });
  try {
    const url = `${server.origin}${ROUTE}`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}x` } })).status, 401);
    assert.equal((await fetch(url, { headers: { Authorization: TOKEN } })).status, 401);
    // The Office login cookie is not this route's credential.
    assert.equal((await fetch(url, { headers: { Cookie: 'agent_office_session=anything' } })).status, 401);

    const write = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: '{}' });
    assert.equal(write.status, 405);

    const response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const raw = await response.text();
    assert.equal(raw.includes(TOKEN), false);
    const body = JSON.parse(raw);
    assert.equal(body.version, 1);
    assert.equal(body.auditLogPath, '/audits.html');
    for (const key of ['records', 'projects', 'repositories', 'skipped', 'duplicates']) {
      assert.equal(Number.isInteger(body.totals[key]), true, key);
    }
    assert.ok(body.totals.records >= 1);
    assert.ok(Array.isArray(body.repositories) && body.repositories.length >= 1);
    assert.ok(Array.isArray(body.recent) && body.recent.length <= 10);
    for (const entry of body.repositories) {
      assert.ok(['reported', 'missing', 'unverified'].includes(entry.latest.findingsState));
      if (entry.latest.findingsState === 'missing') assert.equal(entry.latest.counts, null);
    }

    // The detailed page is still where it was, behind the Office login.
    const page = await fetch(`${server.origin}/audits.html`, { redirect: 'manual' });
    assert.equal(page.status, 302);
    assert.match(page.headers.get('location'), /^\/login\.html\?next=%2Faudits\.html/);
  } finally {
    server.stop();
  }
});

test('the route is disabled, not open, when no token is configured', async () => {
  const server = await startServer({});
  try {
    const response = await fetch(`${server.origin}${ROUTE}`, { headers: { Authorization: 'Bearer ' } });
    assert.equal(response.status, 503);
  } finally {
    server.stop();
  }
});
