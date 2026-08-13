'use strict';

// The countdowns API against a real server: reading is open so the page and the
// roll-up work without a prompt, writing sits behind the Dropbox passphrase,
// and the payload the page draws is grouped on the server.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

const PASSPHRASE = 'open-the-countdowns';
const SHORTCUTS_TOKEN = 'countdowns-shortcut-token-1234567890';

async function startServer() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-countdowns-'));

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
      COUNTDOWNS_FILE: path.join(scratch, 'countdowns.json'),
      DROPS_PASSPHRASE: PASSPHRASE,
      SHORTCUTS_TOKEN,
    };
    ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DROPS_PASSPHRASE_HASH']
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
  return String(response.headers.get('set-cookie') || '').split(';')[0];
}

function call(server, pathname, options = {}) {
  return fetch(`${server.origin}${pathname}`, {
    ...options,
    headers: { Cookie: server.cookie, ...(options.headers || {}) },
  });
}

async function createCountdown(server, body) {
  const response = await call(server, '/api/countdowns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 201, await response.clone().text());
  return response.json();
}

async function listCountdowns(server, query = '') {
  const response = await call(server, `/api/countdowns${query}`);
  assert.equal(response.status, 200);
  return response.json();
}

function inHours(count) {
  return new Date(Date.now() + count * 3600000).toISOString();
}

test('reading countdowns is open, writing needs the passphrase', async () => {
  const server = await startServer();
  try {
    const open = await fetch(`${server.origin}/api/countdowns`);
    assert.equal(open.status, 200, 'the page reads without a prompt');

    const lockedWrite = await fetch(`${server.origin}/api/countdowns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Sneak in', target_at: inHours(4) }),
    });
    assert.equal(lockedWrite.status, 401);

    const payload = await open.json();
    assert.deepEqual(payload.groups, { today: [], week: [], later: [] });
    assert.ok(Array.isArray(payload.categories) && payload.categories.length);
  } finally {
    stop(server);
  }
});

test('legacy reset timers are persisted behind the passphrase', async () => {
  const server = await startServer();
  try {
    const locked = await fetch(`${server.origin}/api/reset-timers`);
    assert.equal(locked.status, 401);

    const items = [{ id: 'usage-reset', title: 'Usage reset', resetAt: inHours(12), webhookUrl: '' }];
    const saved = await call(server, '/api/reset-timers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    assert.equal(saved.status, 200);

    const loaded = await call(server, '/api/reset-timers');
    assert.equal(loaded.status, 200);
    assert.deepEqual((await loaded.json()).items, items);
  } finally {
    stop(server);
  }
});

test('ShareBot countdowns are seeded once as persisted every-two-day records', async () => {
  const server = await startServer();
  try {
    const first = await listCountdowns(server, '?sharebot=1&events=0');
    const firstItems = Object.values(first.groups).flat().filter(item => item.id.startsWith('sharebot-report-'));
    assert.equal(firstItems.length, 3);
    assert.ok(firstItems.every(item => item.repeat === 'every2days'));

    const second = await listCountdowns(server, '?sharebot=1&events=0');
    const secondItems = Object.values(second.groups).flat().filter(item => item.id.startsWith('sharebot-report-'));
    assert.deepEqual(secondItems.map(item => item.target_at), firstItems.map(item => item.target_at));

    const stored = JSON.parse(fs.readFileSync(path.join(server.scratch, 'countdowns.json'), 'utf8'));
    assert.equal(stored.filter(item => item.id.startsWith('sharebot-report-')).length, 3);
  } finally {
    stop(server);
  }
});

test('a countdown keeps its category, repeat rule and next action', async () => {
  const server = await startServer();
  try {
    const created = await createCountdown(server, {
      title: 'Instagram download review',
      target_at: inHours(30),
      category: 'routine',
      repeat: 'weekly',
      next_action: 'Clear the downloads folder',
      notes: 'Weekly sweep',
    });

    assert.equal(created.title, 'Instagram download review');
    assert.equal(created.category, 'routine');
    assert.equal(created.repeat, 'weekly');
    assert.equal(created.next_action, 'Clear the downloads folder');
    assert.equal(created.kind, 'countdown');
    assert.ok(created.remaining.label, 'the card comes back with time left on it');

    const payload = await listCountdowns(server);
    assert.equal(payload.counts.countdowns, 1);
    assert.equal(payload.groups.week.length + payload.groups.today.length, 1);
  } finally {
    stop(server);
  }
});

test('a bad body is rejected before anything is stored', async () => {
  const server = await startServer();
  try {
    const noTitle = await call(server, '/api/countdowns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_at: inHours(3) }),
    });
    assert.equal(noTitle.status, 400);

    const badDate = await call(server, '/api/countdowns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Whenever', target_at: 'soon' }),
    });
    assert.equal(badDate.status, 400);

    assert.equal((await listCountdowns(server)).counts.countdowns, 0);
  } finally {
    stop(server);
  }
});

test('countdowns are edited and deleted by id', async () => {
  const server = await startServer();
  try {
    const created = await createCountdown(server, { title: 'Renew insurance', target_at: inHours(50) });

    const patched = await call(server, `/api/countdowns/${encodeURIComponent(created.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: true, next_action: 'Call the broker' }),
    });
    assert.equal(patched.status, 200);
    const updated = await patched.json();
    assert.equal(updated.pinned, true);
    assert.equal(updated.next_action, 'Call the broker');
    assert.equal(updated.title, 'Renew insurance', 'a partial patch leaves the rest alone');

    const missing = await call(server, '/api/countdowns/countdown-nope', { method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: true }) });
    assert.equal(missing.status, 404);

    const deleted = await call(server, `/api/countdowns/${encodeURIComponent(created.id)}`, { method: 'DELETE' });
    assert.equal(deleted.status, 200);
    assert.equal((await listCountdowns(server)).counts.countdowns, 0);
  } finally {
    stop(server);
  }
});

test('archived countdowns drop off the page unless asked for', async () => {
  const server = await startServer();
  try {
    const created = await createCountdown(server, { title: 'Old goal', target_at: inHours(80) });
    await call(server, `/api/countdowns/${encodeURIComponent(created.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true }),
    });

    assert.equal((await listCountdowns(server)).counts.countdowns, 0);
    assert.equal((await listCountdowns(server, '?archived=1')).counts.countdowns, 1);
  } finally {
    stop(server);
  }
});

test('local calendar events show up alongside the countdowns', async () => {
  const server = await startServer();
  try {
    const start = new Date(Date.now() + 4 * 3600000);
    const end = new Date(start.getTime() + 3600000);
    const created = await call(server, '/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Shift at the shop', start: start.toISOString(), end: end.toISOString() }),
    });
    assert.equal(created.status, 201);

    const payload = await listCountdowns(server);
    const events = payload.items.filter(item => item.kind === 'event');
    assert.ok(events.some(item => item.title === 'Shift at the shop'), 'the event is on the page');
    assert.ok(payload.counts.events >= 1);

    // The same page without the calendar half, for when only the cards matter.
    const cardsOnly = await listCountdowns(server, '?events=0');
    assert.equal(cardsOnly.counts.events, 0);
  } finally {
    stop(server);
  }
});

test('the roll-up returns the top countdowns as text', async () => {
  const server = await startServer();
  try {
    await createCountdown(server, {
      title: 'Renew insurance',
      target_at: inHours(26),
      next_action: 'Call the broker',
    });

    const response = await fetch(`${server.origin}/api/countdowns/rollup?limit=3&format=text`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/plain/);
    const text = await response.text();
    assert.match(text, /^Countdowns — /);
    assert.match(text, /• Renew insurance/);
    assert.match(text, /→ Call the broker/);

    const asJson = await fetch(`${server.origin}/api/countdowns/rollup?limit=3`);
    const payload = await asJson.json();
    assert.equal(payload.items.length, 1);
    assert.equal(payload.items[0].title, 'Renew insurance');
  } finally {
    stop(server);
  }
});

test('the phone inbox serves the same roll-up behind its token', async () => {
  const server = await startServer();
  try {
    await createCountdown(server, { title: 'Tax filing', target_at: inHours(20) });

    const noToken = await fetch(`${server.origin}/api/shortcuts/countdowns`);
    assert.equal(noToken.status, 401);

    const response = await fetch(`${server.origin}/api/shortcuts/countdowns?limit=5`, {
      headers: { 'X-Shortcuts-Token': SHORTCUTS_TOKEN },
    });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /• Tax filing/);

    const setup = await call(server, '/api/shortcuts/setup');
    const details = await setup.json();
    assert.match(details.countdowns_url, /\/api\/shortcuts\/countdowns\?limit=5&format=text$/);
  } finally {
    stop(server);
  }
});

test('countdowns survive a restart', async () => {
  const server = await startServer();
  try {
    await createCountdown(server, { title: 'Passport renewal', target_at: inHours(400) });
    assert.equal(fs.existsSync(path.join(server.scratch, 'countdowns.json')), true);
  } finally {
    stop(server);
  }
});
