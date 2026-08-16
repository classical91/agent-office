'use strict';

// The authorization matrix for the Calendar API.
//
// These routes read and write the owner's real calendar - when Google is
// connected they reach Google itself - so every one of them is checked against
// an anonymous caller here. The rest of the calendar suite runs without a
// passphrase (a developer machine), which is exactly the configuration that
// cannot catch a missing guard; this file configures the passphrase on purpose
// so a route that forgets to authenticate fails loudly.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

const PASSPHRASE = 'calendar-auth-test-passphrase';

async function startServer(options = {}) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-auth-test-'));

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
      GOOGLE_CLIENT_ID: 'calendar-auth-test.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'calendar-auth-test-secret',
    };
    [
      'DATABASE_URL',
      'GOOGLE_REFRESH_TOKEN',
      'DROPS_PASSPHRASE',
      'DROPS_PASSPHRASE_HASH',
      'NODE_ENV',
      'RAILWAY_ENVIRONMENT',
      'RAILWAY_ENVIRONMENT_NAME',
      'RAILWAY_PROJECT_ID',
      'RAILWAY_SERVICE_ID',
    ].forEach(key => {
      delete environment[key];
    });
    Object.assign(environment, options.env || {});
    return environment;
  };

  const server = await startTestServer({ serverPath: SERVER_PATH, cwd: DIST, buildEnv });
  return { ...server, scratch };
}

async function unlock(origin) {
  const response = await fetch(`${origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  assert.equal(response.status, 200, 'the test passphrase should unlock the Office');
  return response.headers.get('set-cookie').split(';')[0];
}

// Every calendar route that can read or change the owner's schedule. Bodies are
// deliberately valid enough to reach the handler: a request rejected at
// validation would prove nothing about the guard in front of it.
const PROTECTED_ROUTES = [
  { method: 'GET', path: '/api/calendar/events' },
  { method: 'GET', path: '/api/calendar/preferences' },
  { method: 'PUT', path: '/api/calendar/preferences', body: { preferences: { workdayStart: '09:00' } } },
  { method: 'GET', path: '/api/calendar/agent-timeline' },
  {
    method: 'POST',
    path: '/api/calendar/events',
    body: { title: 'Injected block', start: '2026-08-20T10:00:00', end: '2026-08-20T11:00:00' },
  },
  { method: 'PATCH', path: '/api/calendar/events/some-event-id', body: { title: 'Renamed' } },
  { method: 'DELETE', path: '/api/calendar/events/some-event-id' },
  { method: 'POST', path: '/api/calendar/events/some-event-id/run', body: { action: 'start' } },
  { method: 'PATCH', path: '/api/calendar/series/standup', body: { title: 'Renamed' } },
  { method: 'DELETE', path: '/api/calendar/series/standup' },
  { method: 'POST', path: '/api/calendar/quick-add', body: { text: 'Coffee tomorrow at 9am' } },
  { method: 'POST', path: '/api/calendar/schedule/suggest', body: { durationMinutes: 30 } },
  { method: 'POST', path: '/api/calendar/schedule/plan', body: { text: 'Deep work for 2 hours' } },
  { method: 'POST', path: '/api/calendar/schedule/commit', body: { blocks: [] } },
  { method: 'GET', path: '/api/calendar/oauth/start' },
  { method: 'DELETE', path: '/api/calendar/oauth/connection' },
];

function call(origin, route, cookie) {
  const headers = {};
  if (route.body) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  return fetch(`${origin}${route.path}`, {
    method: route.method,
    headers,
    body: route.body ? JSON.stringify(route.body) : undefined,
  });
}

test('every calendar route refuses anonymous callers when a passphrase is set', async t => {
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  for (const route of PROTECTED_ROUTES) {
    const response = await call(server.origin, route);
    assert.equal(
      response.status,
      401,
      `${route.method} ${route.path} answered ${response.status} to an anonymous caller; it must be 401`
    );
  }
});

test('an anonymous write never reaches the calendar', async t => {
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  const rejected = await call(server.origin, {
    method: 'POST',
    path: '/api/calendar/events',
    body: { title: 'Injected block', start: '2026-08-20T10:00:00', end: '2026-08-20T11:00:00' },
  });
  assert.equal(rejected.status, 401);

  // A 401 that still wrote the row would be worse than no guard at all, because
  // it would look safe. Read the calendar back as the owner to be sure.
  const cookie = await unlock(server.origin);
  const response = await call(server.origin, { method: 'GET', path: '/api/calendar/events' }, cookie);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(
    payload.events.some(event => event.title === 'Injected block'),
    false,
    'the rejected request must not have created an event'
  );
});

test('an unlocked session still reaches every calendar route', async t => {
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  const cookie = await unlock(server.origin);

  for (const route of PROTECTED_ROUTES) {
    const response = await call(server.origin, route, cookie);
    assert.notEqual(
      response.status,
      401,
      `${route.method} ${route.path} rejected an unlocked session`
    );
  }
});

test('calendar status stays public so a locked client knows to ask for the passphrase', async t => {
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  const response = await fetch(`${server.origin}/api/calendar/status`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.authRequired, true);
  assert.equal(payload.authenticated, false);
  // Lock state is all an anonymous caller may learn - not whose calendar it is.
  assert.equal(payload.accountEmail, null);
  assert.equal(payload.account, null);
});

// -- Fail closed when auth is not configured -----------------------

test('a deployed host with no passphrase serves nothing instead of everything', async t => {
  // RAILWAY_SERVICE_ID marks the host as deployed for auth without tripping the
  // separate "production needs PostgreSQL" check, so the server boots and the
  // guard itself can be exercised. On real Railway both signals are set and the
  // process would refuse to start without a database - covered below.
  const server = await startServer({ env: { RAILWAY_SERVICE_ID: 'svc-test' } });
  t.after(() => server.child.kill());

  for (const route of PROTECTED_ROUTES) {
    const response = await call(server.origin, route);
    assert.equal(
      response.status,
      503,
      `${route.method} ${route.path} answered ${response.status} with auth unconfigured on a deployed host; it must be 503`
    );
  }
});

test('an unconfigured deployment cannot be unlocked at all', async t => {
  const server = await startServer({ env: { RAILWAY_SERVICE_ID: 'svc-test' } });
  t.after(() => server.child.kill());

  const response = await fetch(`${server.origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: '' }),
  });
  assert.equal(response.status, 503);

  // And the lock is not quietly reported as "open" to the client either.
  const status = await (await fetch(`${server.origin}/api/calendar/status`)).json();
  assert.equal(status.authRequired, false, 'no passphrase is configured');
  const events = await call(server.origin, { method: 'GET', path: '/api/calendar/events' });
  assert.equal(events.status, 503, 'but the data stays sealed regardless');
});

test('a Railway deployment that never set NODE_ENV still fails closed', async t => {
  // The gap this closes: NODE_ENV is not set by default on Railway, so keying
  // "am I in production?" off it alone would leave a real deployment wide open.
  // Here the host is deployed and has no database, so it must not come up.
  await assert.rejects(
    startServer({ env: { RAILWAY_ENVIRONMENT: 'production' } }),
    /exited with code 1/,
    'a deployed host without PostgreSQL must refuse to start rather than serve from a scratch file'
  );
});

test('a developer machine with no passphrase still works', async t => {
  // Fail-closed must not mean "unusable locally": an undeployed host with no
  // passphrase is the ordinary development setup the rest of the suite uses.
  const server = await startServer();
  t.after(() => server.child.kill());

  const response = await call(server.origin, { method: 'GET', path: '/api/calendar/events' });
  assert.equal(response.status, 200);
});
