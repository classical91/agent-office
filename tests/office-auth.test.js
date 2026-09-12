'use strict';

// Guards on the Office credential itself.
//
// Two things are checked here: that guessing the passphrase gets expensive, and
// that the config-file reader is behind the same session as everything else.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

const PASSPHRASE = 'office-auth-test-passphrase';

async function startServer(options = {}) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-login-test-'));

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
    [
      'DATABASE_URL',
      'GOOGLE_REFRESH_TOKEN',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
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

// Each caller gets its own X-Forwarded-For so one test's lockout cannot decide
// another's result - the throttle is keyed on the client address.
function login(origin, passphrase, from = '203.0.113.1') {
  return fetch(`${origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': from },
    body: JSON.stringify({ passphrase }),
  });
}

// -- Brute-force throttle -----------------------------------------

test('the login stops answering guesses after five wrong passphrases', async t => {
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  const from = '203.0.113.10';
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await login(server.origin, `wrong-${attempt}`, from);
    assert.equal(response.status, 401, `guess ${attempt} should still be answered normally`);
  }

  const throttled = await login(server.origin, 'wrong-6', from);
  assert.equal(throttled.status, 429, 'the sixth guess should be refused outright');
  const payload = await throttled.json();
  // The lockout must not tell an attacker anything the 401 did not.
  assert.doesNotMatch(payload.error, new RegExp(PASSPHRASE));
});

test('a locked-out caller cannot get in with the right passphrase either', async t => {
  // Otherwise the throttle would only be a speed bump: an attacker who lands on
  // the passphrase mid-lockout should still be turned away.
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  const from = '203.0.113.11';
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await login(server.origin, `wrong-${attempt}`, from);
  }

  const correct = await login(server.origin, PASSPHRASE, from);
  assert.equal(correct.status, 429);
  assert.equal(correct.headers.get('set-cookie'), null, 'no session may be issued while locked out');
});

test('one address being locked out does not lock out the owner', async t => {
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await login(server.origin, `wrong-${attempt}`, '203.0.113.20');
  }

  const owner = await login(server.origin, PASSPHRASE, '203.0.113.21');
  assert.equal(owner.status, 200, 'a different address should be unaffected');
});

test('a successful login clears the failure count', async t => {
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  const from = '203.0.113.30';
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await login(server.origin, `wrong-${attempt}`, from);
  }
  assert.equal((await login(server.origin, PASSPHRASE, from)).status, 200);

  // Four fresh failures would trip the limit if the earlier four still counted.
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await login(server.origin, `wrong-again-${attempt}`, from);
    assert.equal(response.status, 401, 'the counter should have restarted');
  }
});

test('website pages redirect to the general login until authenticated', async t => {
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  const locked = await fetch(`${server.origin}/mission-board.html?view=ios`, { redirect: 'manual' });
  assert.equal(locked.status, 302);
  assert.match(locked.headers.get('location'), /^\/login\.html\?next=/);

  const loginPage = await fetch(`${server.origin}/login.html`);
  assert.equal(loginPage.status, 200);
  assert.match(await loginPage.text(), /Agent Office Login/);

  const session = await login(server.origin, PASSPHRASE, '203.0.113.35');
  const cookie = session.headers.get('set-cookie').split(';')[0];
  const unlocked = await fetch(`${server.origin}/mission-board.html?view=ios`, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  });
  assert.equal(unlocked.status, 200);
});

// -- Config files --------------------------------------------------

test('config files are not readable without a session', async t => {
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  for (const target of ['/api/config-files', '/api/config-files/oss', '/api/config-files/oss/SOUL.md']) {
    const response = await fetch(`${server.origin}${target}`);
    assert.equal(response.status, 401, `${target} should require an unlocked session`);
  }
});

test('config files stay readable once unlocked', async t => {
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  const session = await login(server.origin, PASSPHRASE, '203.0.113.40');
  const cookie = session.headers.get('set-cookie').split(';')[0];

  const response = await fetch(`${server.origin}/api/config-files`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.ok(Array.isArray((await response.json()).agents));
});

test('config files are sealed on a deployed host with no passphrase', async t => {
  const server = await startServer({ env: { RAILWAY_SERVICE_ID: 'svc-test' } });
  t.after(() => server.child.kill());

  const response = await fetch(`${server.origin}/api/config-files`);
  assert.equal(response.status, 503);
});

// -- The readable session hint -------------------------------------
//
// The real session cookie is HttpOnly, so a page cannot read it and used to
// lock itself and raise the login panel on every load, unlocking again only
// once /api/session answered — a login screen flashing at someone who was
// already logged in. The hint cookie is what the page reads instead. It has to
// be readable to be worth anything, so what matters here is that it carries no
// token and that it never outlives the session it stands for.

function setCookies(response) {
  return typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
}

function findCookie(response, name) {
  return setCookies(response).find(cookie => cookie.startsWith(`${name}=`)) || null;
}

function cookieValue(cookie) {
  return cookie.slice(cookie.indexOf('=') + 1).split(';')[0];
}

test('logging in sets a readable hint beside the HttpOnly session cookie', async t => {
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  const session = await login(server.origin, PASSPHRASE, '203.0.113.50');
  assert.equal(session.status, 200);

  const real = findCookie(session, 'agent_office_session');
  const hint = findCookie(session, 'agent_office_signed_in');
  assert.ok(real, 'the session cookie should still be set');
  assert.ok(hint, 'the hint cookie should be set alongside it');

  assert.match(real, /HttpOnly/, 'the token must stay out of reach of scripts');
  assert.doesNotMatch(hint, /HttpOnly/, 'the hint is only useful if the page can read it');

  // A flag, not a credential: there is nothing in it to stand in for the token.
  assert.equal(cookieValue(hint), '1');
  assert.match(hint, /SameSite=Strict/);
  assert.match(hint, /Path=\//);
});

test('the hint alone unlocks nothing', async t => {
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  const response = await fetch(`${server.origin}/api/config-files`, {
    headers: { Cookie: 'agent_office_signed_in=1' },
  });
  assert.equal(response.status, 401, 'the hint is not a credential');

  const page = await fetch(`${server.origin}/mission-board.html`, {
    headers: { Cookie: 'agent_office_signed_in=1' },
    redirect: 'manual',
  });
  assert.equal(page.status, 302, 'and it does not open a page either');
});

test('logging out takes the hint back with the session', async t => {
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  const session = await login(server.origin, PASSPHRASE, '203.0.113.51');
  const cookie = cookieValue(findCookie(session, 'agent_office_session'));

  const out = await fetch(`${server.origin}/api/session`, {
    method: 'DELETE',
    headers: { Cookie: `agent_office_session=${cookie}; agent_office_signed_in=1` },
  });
  assert.equal(out.status, 200);

  const hint = findCookie(out, 'agent_office_signed_in');
  assert.ok(hint, 'the hint should be cleared, not left behind');
  assert.equal(cookieValue(hint), '');
  assert.match(hint, /Max-Age=0/);
});

test('a hint left over from a forgotten session is cleared on the next check', async t => {
  // Sessions live in memory, so a restart forgets them while the browser still
  // holds both cookies. Left alone, the stale hint would have every load paint
  // itself unlocked and then lock again.
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  const stale = await fetch(`${server.origin}/api/session`, {
    headers: { Cookie: 'agent_office_signed_in=1' },
  });
  assert.equal(stale.status, 200);
  assert.equal((await stale.json()).authenticated, false);

  const hint = findCookie(stale, 'agent_office_signed_in');
  assert.ok(hint, 'the stale hint should be taken back');
  assert.equal(cookieValue(hint), '');
});

test('a check with no cookies at all sets nothing', async t => {
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  const response = await fetch(`${server.origin}/api/session`);
  assert.equal(response.status, 200);
  assert.deepEqual(setCookies(response), [], 'nothing to clear, nothing to send');
});

test('an expired session answering an API call takes the hint back', async t => {
  const server = await startServer({ env: { DROPS_PASSPHRASE: PASSPHRASE } });
  t.after(() => server.child.kill());

  const response = await fetch(`${server.origin}/api/drops`, {
    headers: { Cookie: 'agent_office_session=not-a-real-token; agent_office_signed_in=1' },
  });
  assert.equal(response.status, 401);

  const hint = findCookie(response, 'agent_office_signed_in');
  assert.ok(hint, 'a 401 should stop the page believing it is logged in');
  assert.equal(cookieValue(hint), '');
});
