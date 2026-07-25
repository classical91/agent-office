const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER_PATH = path.join(REPO_ROOT, 'agent-office-deploy', 'dist', 'server.js');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function startServer(options = {}) {
  const port = await getFreePort();
  const environment = {
    ...process.env,
    PORT: String(port),
    PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
    GOOGLE_CLIENT_ID: 'calendar-oauth-test.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'calendar-oauth-test-secret',
  };
  [
    'DATABASE_URL',
    'GOOGLE_REFRESH_TOKEN',
    'DROPS_PASSPHRASE',
    'DROPS_PASSPHRASE_HASH',
    'GOOGLE_REDIRECT_URI',
  ].forEach(key => delete environment[key]);
  if (options.passphrase) environment.DROPS_PASSPHRASE = options.passphrase;

  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd: path.dirname(SERVER_PATH),
    env: environment,
    stdio: 'ignore',
    windowsHide: true,
  });
  const origin = `http://127.0.0.1:${port}`;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Test server exited with code ${child.exitCode}.`);
    try {
      const response = await fetch(`${origin}/api/calendar/status`);
      if (response.ok) return { child, origin };
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  child.kill();
  throw new Error('Test server did not become ready.');
}

async function readJson(response) {
  const payload = await response.json();
  assert.equal(response.ok, true, payload.error || `HTTP ${response.status}`);
  return payload;
}

test('Google Calendar OAuth start exposes a signed offline authorization URL', async t => {
  const server = await startServer();
  t.after(() => server.child.kill());

  const status = await readJson(await fetch(`${server.origin}/api/calendar/status`));
  assert.equal(status.googleConfigured, true);
  assert.equal(status.connected, false);
  assert.equal(status.redirectUri, `${server.origin}/api/calendar/oauth/callback`);

  const start = await readJson(await fetch(`${server.origin}/api/calendar/oauth/start`));
  const authorizationUrl = new URL(start.url);
  assert.equal(authorizationUrl.origin, 'https://accounts.google.com');
  assert.equal(authorizationUrl.searchParams.get('client_id'), 'calendar-oauth-test.apps.googleusercontent.com');
  assert.equal(authorizationUrl.searchParams.get('access_type'), 'offline');
  assert.equal(authorizationUrl.searchParams.get('prompt'), 'consent');
  assert.match(authorizationUrl.searchParams.get('scope'), /calendar\.events/);
  assert.ok(authorizationUrl.searchParams.get('state'));

  const state = authorizationUrl.searchParams.get('state');
  const tamperedState = `${state.slice(0, -1)}${state.endsWith('a') ? 'b' : 'a'}`;
  const callback = await fetch(
    `${server.origin}/api/calendar/oauth/callback?code=fake&state=${encodeURIComponent(tamperedState)}`
  );
  assert.equal(callback.status, 400);
  assert.match(await callback.text(), /could not be verified/);

  const events = await readJson(await fetch(`${server.origin}/api/calendar/events`));
  assert.equal(events.googleConnected, false);

  const disconnected = await readJson(await fetch(`${server.origin}/api/calendar/oauth/connection`, {
    method: 'DELETE',
  }));
  assert.equal(disconnected.connected, false);
});

test('Google Calendar connection changes require the Agent Office passphrase session', async t => {
  const passphrase = 'calendar-oauth-test-passphrase';
  const server = await startServer({ passphrase });
  t.after(() => server.child.kill());

  const locked = await fetch(`${server.origin}/api/calendar/oauth/start`);
  assert.equal(locked.status, 401);

  const sessionResponse = await fetch(`${server.origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase }),
  });
  assert.equal(sessionResponse.ok, true);
  const cookie = sessionResponse.headers.get('set-cookie').split(';')[0];

  const authorized = await fetch(`${server.origin}/api/calendar/oauth/start`, {
    headers: { Cookie: cookie },
  });
  assert.equal(authorized.ok, true);
  const payload = await authorized.json();
  assert.match(payload.url, /^https:\/\/accounts\.google\.com\//);
});
