'use strict';

// ShareBot67's newsroom health adapter.
//
// The newsroom runs in the Market Dashboard and its health endpoint needs an
// admin key, so the browser cannot read it: a key in page JavaScript is a
// published key. Agent Office reads it server-side and hands the browser a
// summary. These tests are about the two halves of that promise — the key goes
// up and never comes back down, and a newsroom that cannot be read is reported
// as unreadable rather than as fine.
//
// The upstream here is a fake Market Dashboard on localhost. Nothing in this
// file reaches a real one.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');
const adapter = require('../agent-office-deploy/dist/sharebot-newsroom.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

const PASSPHRASE = 'newsroom-adapter-passphrase';
const DASHBOARD_KEY = 'market-dashboard-admin-key';
const ENDPOINT = '/api/sharebot/newsroom-health';

// A real-shaped payload from GET /api/newsroom/health. Note what is *not* in
// it and never should be: no key, no prompt, no report text.
const HEALTHY = {
  status: 'completed',
  reporter: { model: 'gpt-5.4-mini', configured: true },
  telegramConfigured: true,
  sections: ['crypto', 'economics', 'markets'],
  currentCycle: null,
  lastAttemptedCycle: {
    id: 'cyc_aaaa1111', cycleKey: 'scheduled:2026-08-26T13:00:00.000Z', status: 'completed',
    scheduledAt: '2026-08-26T13:00:00.000Z', startedAt: '2026-08-26T13:00:01.000Z',
    completedAt: '2026-08-26T13:02:00.000Z',
    sectionsExpected: ['crypto', 'economics', 'markets'], generatedSectionCount: 3,
    deliverySucceeded: 6, deliveryFailed: 0, receiptIds: ['rcp_1'],
  },
  lastSuccessfulCycle: {
    id: 'cyc_aaaa1111', status: 'completed', completedAt: '2026-08-26T13:02:00.000Z',
    scheduledAt: '2026-08-26T13:00:00.000Z', sectionsExpected: ['crypto', 'economics', 'markets'],
    generatedSectionCount: 3, deliverySucceeded: 6, deliveryFailed: 0,
  },
  nextExpectedRunAt: '2026-08-27T13:00:00.000Z',
  lastError: null,
  counts: { cyclesInWindow: 4, completed: 3, generatedSections: 11, deliverySucceeded: 20, deliveryFailed: 1 },
  agentRoute: { status: 'pass', verified: true, detail: 'Agent route resolved.', code: null },
  allowPartialDelivery: false,
  lastPreflight: null,
};

const PARTIAL = {
  ...HEALTHY,
  status: 'delivery_partial',
  lastAttemptedCycle: {
    ...HEALTHY.lastAttemptedCycle,
    id: 'cyc_bbbb2222', status: 'delivery_partial', generatedSectionCount: 2,
    deliverySucceeded: 4, deliveryFailed: 2,
  },
  agentRoute: { status: 'warn', verified: false, detail: 'The agent route is not verified.', code: null },
  lastError: {
    at: '2026-08-27T13:02:00.000Z', phase: 'delivery', class: 'retryable', retryable: true,
    code: 'server_error', message: 'Telegram rejected Stock', reason: 'The destination returned a server error.',
  },
};

const RUNNING = {
  ...HEALTHY,
  status: 'running',
  currentCycle: {
    ...HEALTHY.lastAttemptedCycle, id: 'cyc_cccc3333', status: 'generating',
    completedAt: null, generatedSectionCount: 1, deliverySucceeded: 0, deliveryFailed: 0,
  },
};

/* ── a fake Market Dashboard ── */

let upstream;
let upstreamOrigin;
let decoy;
let decoyOrigin;
let decoyHits = 0;
// Flipped per test. One upstream that can behave badly on request beats a
// server per failure mode.
let mode = 'healthy';
let seenKeys = [];

function startUpstream() {
  const service = http.createServer((req, res) => {
    seenKeys.push(String(req.headers['x-admin-key'] || ''));

    if (mode === 'auth') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      // Deliberately nasty: an upstream that echoes the rejected credential
      // back in its error body. None of it may reach the browser.
      res.end(JSON.stringify({ error: `Unauthorized: ${req.headers['x-admin-key']} is not a valid key.` }));
      return;
    }
    if (mode === 'server-error') {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'upstream is restarting' }));
      return;
    }
    if (mode === 'malformed') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('<html>a login page, not health</html>');
      return;
    }
    if (mode === 'wrong-shape') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([1, 2, 3]));
      return;
    }
    if (mode === 'redirect') {
      res.writeHead(302, { Location: `${decoyOrigin}/api/newsroom/health` });
      res.end();
      return;
    }
    if (mode === 'hang') {
      // Never answers. The adapter's own timeout has to end this.
      return;
    }

    const payload = mode === 'partial' ? PARTIAL : mode === 'running' ? RUNNING : HEALTHY;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  });
  return new Promise(resolve => {
    service.listen(0, '127.0.0.1', () => resolve(service));
  });
}

function startDecoy() {
  const service = http.createServer((req, res) => {
    decoyHits += 1;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ...HEALTHY, status: 'completed', reporter: { model: 'decoy-model' } }));
  });
  return new Promise(resolve => {
    service.listen(0, '127.0.0.1', () => resolve(service));
  });
}

let server;
let unconfigured;
let scratch;
let unconfiguredScratch;
let cookie;
let unconfiguredCookie;

function buildEnvFactory(dir, extra) {
  return port => {
    const environment = {
      ...process.env,
      PORT: String(port),
      APP_TIMEZONE: 'UTC',
      DROPS_PASSPHRASE: PASSPHRASE,
      APP_SETTINGS_FILE: path.join(dir, 'settings.json'),
      CALENDAR_EVENTS_FILE: path.join(dir, 'calendar-events.json'),
      AGENTS_FILE: path.join(dir, 'agents.json'),
      MEMORIES_FILE: path.join(dir, 'memories.json'),
      DROPS_FILE: path.join(dir, 'drops.json'),
      PROJECTS_FILE: path.join(dir, 'projects.json'),
      STREAKS_FILE: path.join(dir, 'streaks.json'),
      STREAK_DAYS_FILE: path.join(dir, 'streak-days.json'),
      VISITS_FILE: path.join(dir, 'visits.json'),
    };
    ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DROPS_PASSPHRASE_HASH',
      'MARKET_DASHBOARD_URL', 'MARKET_DASHBOARD_ADMIN_API_KEY', 'MARKET_DASHBOARD_TIMEOUT_MS',
      'NODE_ENV', 'RAILWAY_ENVIRONMENT', 'RAILWAY_ENVIRONMENT_NAME', 'RAILWAY_PROJECT_ID', 'RAILWAY_SERVICE_ID',
    ].forEach(key => { delete environment[key]; });
    return { ...environment, ...extra };
  };
}

async function openSession(origin) {
  const response = await fetch(`${origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  assert.equal(response.status, 200);
  return String(response.headers.get('set-cookie') || '').split(';')[0];
}

const read = (origin, jar, suffix = '') =>
  fetch(`${origin}${ENDPOINT}${suffix}`, { headers: jar ? { cookie: jar } : {} });

test.before(async () => {
  upstream = await startUpstream();
  upstreamOrigin = `http://127.0.0.1:${upstream.address().port}`;
  decoy = await startDecoy();
  decoyOrigin = `http://127.0.0.1:${decoy.address().port}`;

  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-newsroom-'));
  server = await startTestServer({
    serverPath: SERVER_PATH,
    cwd: DIST,
    buildEnv: buildEnvFactory(scratch, {
      MARKET_DASHBOARD_URL: upstreamOrigin,
      MARKET_DASHBOARD_ADMIN_API_KEY: DASHBOARD_KEY,
      MARKET_DASHBOARD_TIMEOUT_MS: '1000',
    }),
  });
  cookie = await openSession(server.origin);

  unconfiguredScratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-newsroom-off-'));
  unconfigured = await startTestServer({
    serverPath: SERVER_PATH,
    cwd: DIST,
    buildEnv: buildEnvFactory(unconfiguredScratch, {}),
  });
  unconfiguredCookie = await openSession(unconfigured.origin);
});

test.after(() => {
  server?.child.kill();
  unconfigured?.child.kill();
  upstream?.close();
  decoy?.close();
  if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
  if (unconfiguredScratch) fs.rmSync(unconfiguredScratch, { recursive: true, force: true });
});

test.beforeEach(() => {
  mode = 'healthy';
  seenKeys = [];
  decoyHits = 0;
});

/* ── the happy path ── */

test('a configured upstream comes back as normalized health', async () => {
  const response = await read(server.origin, cookie);
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.state, 'ok');
  assert.equal(body.available, true);
  assert.equal(body.health, 'healthy');
  assert.equal(body.upstream_status, 'completed');
  assert.equal(body.last_success.id, 'cyc_aaaa1111');
  assert.equal(body.last_attempt.status, 'completed');
  assert.equal(body.next_expected_at, '2026-08-27T13:00:00.000Z');
  assert.deepEqual(body.generation, { generated: 3, expected: 3 });
  assert.deepEqual(body.delivery, { succeeded: 6, failed: 0 });
  assert.equal(body.agent_route.route, 'verified');
  assert.equal(body.agent_route.verified, true);
  assert.equal(body.latest_error, null);
  assert.equal(body.reporter_model, 'gpt-5.4-mini');
  assert.ok(body.checked_at, 'the read stamps when it happened');
});

test('a partial cycle reads as degraded and keeps its error and its route warning', async () => {
  mode = 'partial';
  const body = await (await read(server.origin, cookie)).json();

  assert.equal(body.health, 'degraded');
  assert.equal(body.upstream_status, 'delivery_partial');
  assert.deepEqual(body.generation, { generated: 2, expected: 3 });
  assert.deepEqual(body.delivery, { succeeded: 4, failed: 2 });
  assert.equal(body.latest_error.code, 'server_error');
  assert.equal(body.latest_error.retryable, true);
  assert.equal(body.agent_route.route, 'warning');
  assert.equal(body.agent_route.verified, false, 'an unverified route is never reported as verified');
});

test('a cycle in flight reads as running', async () => {
  mode = 'running';
  const body = await (await read(server.origin, cookie)).json();
  assert.equal(body.health, 'running');
  assert.equal(body.current_cycle.id, 'cyc_cccc3333');
  assert.deepEqual(body.generation, { generated: 1, expected: 3 });
});

/* ── the key ── */

test('the dashboard key goes up and never comes back down', async () => {
  const raw = await (await read(server.origin, cookie)).text();

  assert.deepEqual(seenKeys, [DASHBOARD_KEY], 'the upstream must be called with the configured key');
  assert.equal(raw.includes(DASHBOARD_KEY), false, 'the key must not appear in the response');
  assert.equal(raw.includes(PASSPHRASE), false);
  assert.equal(raw.toLowerCase().includes('x-admin-key'), false);
  assert.equal(raw.includes(upstreamOrigin), false, 'the upstream address is not part of the answer either');
});

test('an upstream that echoes the key in its error body cannot relay it', async () => {
  mode = 'auth';
  const response = await read(server.origin, cookie);
  const raw = await response.text();

  assert.equal(response.status, 200, 'a rejected key is a status to display, not a crash');
  assert.equal(raw.includes(DASHBOARD_KEY), false, 'the upstream error body must not be passed through');

  const body = JSON.parse(raw);
  assert.equal(body.state, 'auth_error');
  assert.equal(body.available, false);
  assert.equal(body.health, 'unavailable');
  assert.match(body.error, /rejected this server's key/i);
  assert.equal(body.upstream_http_status, 401);
});

/* ── failure is never dressed up as health ── */

test('a hanging upstream becomes unreachable, not healthy', async () => {
  mode = 'hang';
  const body = await (await read(server.origin, cookie)).json();

  assert.equal(body.state, 'unreachable');
  assert.equal(body.available, false);
  assert.equal(body.health, 'unavailable');
  assert.equal(body.last_success, null, 'no stale success is invented for an unreadable newsroom');
  assert.match(body.error, /did not answer/i);
});

test('a malformed upstream response is reported as malformed', async () => {
  mode = 'malformed';
  const html = await (await read(server.origin, cookie)).json();
  assert.equal(html.state, 'invalid_response');
  assert.equal(html.available, false);

  mode = 'wrong-shape';
  const array = await (await read(server.origin, cookie)).json();
  assert.equal(array.state, 'invalid_response');
  assert.equal(array.health, 'unavailable');
});

test('an upstream server error is reported as an upstream error', async () => {
  mode = 'server-error';
  const body = await (await read(server.origin, cookie)).json();

  assert.equal(body.state, 'upstream_error');
  assert.equal(body.available, false);
  assert.equal(body.upstream_http_status, 503);
  assert.match(body.error, /server error/i);
});

test('a redirect is not followed, so the key cannot be forwarded to another origin', async () => {
  mode = 'redirect';
  const body = await (await read(server.origin, cookie)).json();

  assert.equal(body.state, 'upstream_error');
  assert.equal(decoyHits, 0, 'the redirect target must never be called');
  assert.match(body.error, /redirected/i);
});

test('an unconfigured server says exactly what is missing', async () => {
  const response = await read(unconfigured.origin, unconfiguredCookie);
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.state, 'not_configured');
  assert.equal(body.available, false);
  assert.equal(body.health, 'unavailable');
  assert.match(body.error, /MARKET_DASHBOARD_URL/);
  assert.match(body.error, /MARKET_DASHBOARD_ADMIN_API_KEY/);
});

/* ── the boundary ── */

test('the request cannot choose an upstream', async () => {
  const suffix = `?url=${encodeURIComponent(decoyOrigin)}&target=${encodeURIComponent(decoyOrigin)}`
    + `&MARKET_DASHBOARD_URL=${encodeURIComponent(decoyOrigin)}`;
  const body = await (await read(server.origin, cookie, suffix)).json();

  assert.equal(decoyHits, 0, 'a request parameter must not be able to name a host');
  assert.equal(body.reporter_model, 'gpt-5.4-mini', 'the configured upstream answered, not the decoy');
  assert.deepEqual(seenKeys, [DASHBOARD_KEY]);
});

test('the adapter is behind the Office session', async () => {
  const anonymous = await read(server.origin, null);
  assert.equal(anonymous.status, 401);
  assert.equal(seenKeys.length, 0, 'an unauthenticated caller must not cause an upstream call');

  const wrongCookie = await read(server.origin, 'agent_office_session=not-a-real-token');
  assert.equal(wrongCookie.status, 401);
  assert.equal(seenKeys.length, 0);
});

// The adapter is a read. An unmatched method falls through to this server's
// app-shell fallback, the same way every other route here does — what matters
// is that it is not the adapter answering, and that nothing reaches upstream.
test('only GET reads health; another method is not the adapter answering', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const response = await fetch(`${server.origin}${ENDPOINT}`, {
      method,
      headers: { cookie, 'Content-Type': 'application/json' },
      body: method === 'DELETE' ? undefined : '{}',
    });
    const raw = await response.text();
    assert.equal(raw.includes('"state"'), false, `${method} must not return newsroom health`);
    assert.equal(raw.includes(DASHBOARD_KEY), false);
  }
  assert.equal(seenKeys.length, 0, 'and none of them reaches the upstream');
});

/* ── configuration rules, without a server ── */

test('a deployment must use HTTPS for a public dashboard', () => {
  const env = { MARKET_DASHBOARD_URL: 'http://dashboard.example.com', MARKET_DASHBOARD_ADMIN_API_KEY: 'k' };

  const deployed = adapter.resolveConfig(env, { deployed: true });
  assert.equal(deployed.ok, false);
  assert.match(deployed.reason, /HTTPS/);

  // Local development, both apps on the machine: plain HTTP cannot leave it.
  const loopback = adapter.resolveConfig(
    { ...env, MARKET_DASHBOARD_URL: 'http://localhost:3001' },
    { deployed: true },
  );
  assert.equal(loopback.ok, true);

  const https = adapter.resolveConfig(
    { ...env, MARKET_DASHBOARD_URL: 'https://dashboard.example.com' },
    { deployed: true },
  );
  assert.equal(https.ok, true);
  assert.equal(https.endpoint, 'https://dashboard.example.com/api/newsroom/health');
});

test('configuration names a host, not a route or a scheme of its choosing', () => {
  const withPath = adapter.resolveConfig(
    { MARKET_DASHBOARD_URL: 'https://dash.example.com/some/other/place', MARKET_DASHBOARD_ADMIN_API_KEY: 'k' },
    { deployed: true },
  );
  assert.equal(withPath.endpoint, 'https://dash.example.com/api/newsroom/health');

  for (const bad of ['file:///etc/passwd', 'javascript:alert(1)', 'ftp://dash.example.com', 'not a url']) {
    const result = adapter.resolveConfig(
      { MARKET_DASHBOARD_URL: bad, MARKET_DASHBOARD_ADMIN_API_KEY: 'k' },
      { deployed: false },
    );
    assert.equal(result.ok, false, `${bad} must not be fetchable`);
  }
});

test('the normalizer is a whitelist, so upstream additions cannot leak through', () => {
  const body = adapter.normalizeHealth({
    ...HEALTHY,
    // None of these exist upstream today. If they ever did, they must not
    // arrive in a browser through this panel.
    reportText: 'the full crypto section body',
    adminKey: 'super-secret',
    lastPreflight: { checks: [{ name: 'reporter-credentials', detail: 'key present' }] },
  });

  const raw = JSON.stringify(body);
  assert.equal(raw.includes('the full crypto section body'), false);
  assert.equal(raw.includes('super-secret'), false);
  assert.equal(raw.includes('reporter-credentials'), false);
  assert.equal(body.health, 'healthy');
});
