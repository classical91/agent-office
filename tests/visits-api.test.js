'use strict';

// The visitors API: the tracker posts one row per page view, the dashboard
// reads them back grouped. The things worth pinning down are the ones a
// browser cannot be trusted to get right - what counts as a returning visitor,
// what counts as a referrer, and what is dropped on the floor.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

const PASSPHRASE = 'open-the-visitors';
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function startServer() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-visits-'));

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
      STREAKS_FILE: path.join(scratch, 'streaks.json'),
      STREAK_DAYS_FILE: path.join(scratch, 'streak-days.json'),
      VISITS_FILE: path.join(scratch, 'visits.json'),
      DROPS_PASSPHRASE: PASSPHRASE,
    };
    ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DROPS_PASSPHRASE_HASH', 'SHORTCUTS_TOKEN']
      .forEach(key => { delete environment[key]; });
    return environment;
  };

  const server = await startTestServer({ serverPath: SERVER_PATH, cwd: DIST, buildEnv });
  const cookie = await unlock(server.origin);
  return { ...server, scratch, cookie };
}

function stop(server) {
  server.child.kill();
  fs.rmSync(server.scratch, { recursive: true, force: true });
}

async function unlock(origin) {
  const response = await fetch(`${origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

// The real tracker posts text/plain via sendBeacon, so the tests do too.
async function track(server, payload, headers = {}) {
  return fetch(`${server.origin}/api/visits/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': BROWSER_UA, ...headers },
    body: JSON.stringify(payload),
  });
}

async function summary(server, query = '') {
  const response = await fetch(`${server.origin}/api/visits/summary${query}`, {
    headers: { cookie: server.cookie },
  });
  assert.equal(response.status, 200);
  return response.json();
}

function view(overrides = {}) {
  return {
    event: 'view',
    site: 'https://example.com',
    visitor_id: 'visitor00000001',
    session_id: 'session00000001',
    path: '/pricing',
    title: 'Pricing',
    screen: '1440x900',
    ...overrides,
  };
}

test('a page view is recorded and read back grouped', async () => {
  const server = await startServer();
  try {
    assert.equal((await track(server, view())).status, 204);

    const payload = await summary(server);
    assert.equal(payload.totals.pageviews, 1);
    assert.equal(payload.totals.visitors, 1);
    assert.equal(payload.totals.sessions, 1);
    assert.equal(payload.recent.length, 1);

    const recorded = payload.recent[0];
    assert.equal(recorded.site, 'example.com', 'the site is stored as a hostname');
    assert.equal(recorded.path, '/pricing');
    assert.equal(recorded.title, 'Pricing');
    assert.equal(recorded.device, 'Mac · Chrome');
    assert.equal(recorded.is_returning, false);
  } finally {
    stop(server);
  }
});

test('a visitor seen before is marked as returning, a new one is not', async () => {
  const server = await startServer();
  try {
    await track(server, view());
    await track(server, view({ session_id: 'session00000002', path: '/docs' }));
    await track(server, view({ visitor_id: 'visitor00000002', session_id: 'session00000003' }));

    const payload = await summary(server);
    assert.equal(payload.totals.visitors, 2);
    assert.equal(payload.totals.pageviews, 3);
    assert.equal(payload.totals.new, 1, 'the second visitor has never been here');
    assert.equal(payload.totals.returning, 1, 'the first visitor came back');
  } finally {
    stop(server);
  }
});

test('whoever is on the site now shows up in the live list, once', async () => {
  const server = await startServer();
  try {
    await track(server, view({ path: '/one' }));
    await track(server, view({ path: '/two', title: 'Two' }));

    const payload = await summary(server);
    assert.equal(payload.totals.live, 1, 'two pages read by one person is one person');
    assert.equal(payload.live.length, 1);
    assert.equal(payload.live[0].path, '/two', 'the live row is the page they are on now');
  } finally {
    stop(server);
  }
});

test('a ping keeps a visitor live without counting as another page view', async () => {
  const server = await startServer();
  try {
    await track(server, view());
    const before = await summary(server);

    assert.equal((await track(server, view({ event: 'ping' }))).status, 204);

    const after = await summary(server);
    assert.equal(after.totals.pageviews, before.totals.pageviews, 'a ping is not a page view');
    assert.equal(after.totals.live, 1);
    assert.ok(
      after.live[0].last_seen_at >= before.live[0].last_seen_at,
      'the ping moved the visitor forward in time'
    );
  } finally {
    stop(server);
  }
});

test('a link from another site is a referrer, a link from the same site is not', async () => {
  const server = await startServer();
  try {
    await track(server, view({ referrer: 'https://news.ycombinator.com/item?id=1' }));
    await track(server, view({
      session_id: 'session00000009',
      path: '/docs',
      referrer: 'https://example.com/pricing',
    }));

    const payload = await summary(server);
    assert.equal(payload.top_referrers.length, 1, 'moving around one site is not arriving from somewhere');
    assert.equal(payload.top_referrers[0].referrer, 'news.ycombinator.com/item');
  } finally {
    stop(server);
  }
});

test('bots and malformed beacons are dropped without an error', async () => {
  const server = await startServer();
  try {
    const bot = await track(server, view(), { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' });
    assert.equal(bot.status, 204);

    assert.equal((await track(server, view({ visitor_id: 'no' }))).status, 204);
    assert.equal((await track(server, view({ event: 'sneak' }))).status, 204);

    const raw = await fetch(`${server.origin}/api/visits/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'User-Agent': BROWSER_UA },
      body: 'not json at all',
    });
    assert.equal(raw.status, 204);

    const payload = await summary(server);
    assert.equal(payload.totals.pageviews, 0, 'none of those should have been recorded');
  } finally {
    stop(server);
  }
});

test('the summary is behind the passphrase but the tracker is not', async () => {
  const server = await startServer();
  try {
    assert.equal((await track(server, view())).status, 204, 'a stranger\'s browser can report a visit');

    const locked = await fetch(`${server.origin}/api/visits/summary`);
    assert.equal(locked.status, 401, 'the numbers are not public');

    const cleared = await fetch(`${server.origin}/api/visits`, { method: 'DELETE' });
    assert.equal(cleared.status, 401);
  } finally {
    stop(server);
  }
});

test('the site filter narrows the summary to one site', async () => {
  const server = await startServer();
  try {
    await track(server, view());
    await track(server, view({ site: 'https://other.dev', visitor_id: 'visitor00000005', session_id: 'session00000005' }));

    const all = await summary(server);
    assert.deepEqual(all.all_sites.sort(), ['example.com', 'other.dev']);
    assert.equal(all.totals.pageviews, 2);

    const filtered = await summary(server, '?site=other.dev');
    assert.equal(filtered.totals.pageviews, 1);
    assert.equal(filtered.recent[0].site, 'other.dev');
  } finally {
    stop(server);
  }
});

test('deleting the visits empties the dashboard', async () => {
  const server = await startServer();
  try {
    await track(server, view());
    await track(server, view({ path: '/docs' }));

    const response = await fetch(`${server.origin}/api/visits`, {
      method: 'DELETE',
      headers: { cookie: server.cookie },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { removed: 2 });

    const payload = await summary(server);
    assert.equal(payload.totals.pageviews, 0);
    assert.equal(payload.live.length, 0);
  } finally {
    stop(server);
  }
});
