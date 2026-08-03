'use strict';

// The streaks API: a streak is a habit, a streak day is one date it was kept,
// and the counts the page shows are worked out on the server so a phone gets
// the same numbers as the browser.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

const PASSPHRASE = 'open-the-streaks';

async function startServer() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-streaks-'));

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
  return String(response.headers.get('set-cookie') || '').split(';')[0];
}

function call(server, pathname, options = {}) {
  return fetch(`${server.origin}${pathname}`, {
    ...options,
    headers: { Cookie: server.cookie, ...(options.headers || {}) },
  });
}

async function createStreak(server, body) {
  const response = await call(server, '/api/streaks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 201);
  return response.json();
}

function mark(server, id, day, note) {
  return call(server, `/api/streaks/${id}/days/${day}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: note || '' }),
  });
}

async function listStreaks(server, query = '') {
  const response = await call(server, `/api/streaks${query}`);
  assert.equal(response.status, 200);
  return response.json();
}

function dayKey(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

// The server runs in UTC in these tests, so "today" is the UTC day.
function daysAgo(count) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - count);
  return dayKey(date);
}

test('the streak API is behind the Dropbox passphrase', async () => {
  const server = await startServer();
  try {
    const locked = await fetch(`${server.origin}/api/streaks`);
    assert.equal(locked.status, 401);

    const lockedWrite = await fetch(`${server.origin}/api/streaks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sneak in' }),
    });
    assert.equal(lockedWrite.status, 401);

    const unlocked = await call(server, '/api/streaks');
    assert.equal(unlocked.status, 200);
  } finally {
    stop(server);
  }
});

test('a streak keeps its name, type and colour, and starts empty', async () => {
  const server = await startServer();
  try {
    const streak = await createStreak(server, {
      name: 'Morning run',
      type: 'Health',
      color: '#22c55e',
      notes: '3km before anything else',
    });

    assert.equal(streak.name, 'Morning run');
    assert.equal(streak.type, 'health', 'the type is stored as a slug');
    assert.equal(streak.color, '#22c55e');
    assert.equal(streak.archived, false);
    assert.deepEqual(streak.stats, {
      total_days: 0,
      current: 0,
      longest: 0,
      first_day: '',
      last_day: '',
      marked_today: false,
    });

    const nameless = await call(server, '/api/streaks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    });
    assert.equal(nameless.status, 400);

    const badColor = await createStreak(server, { name: 'Odd colour', color: 'chartreuse' });
    assert.equal(badColor.color, '', 'a colour that is not #rrggbb is dropped, not stored');
  } finally {
    stop(server);
  }
});

test('marking days builds the current and longest runs', async () => {
  const server = await startServer();
  try {
    const streak = await createStreak(server, { name: 'Ship something', type: 'focus' });

    // A run of four ending today, and an older isolated day.
    for (const offset of [3, 2, 1, 0, 10]) {
      const response = await mark(server, streak.id, daysAgo(offset));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).marked, true);
    }

    const [afterMarking] = (await listStreaks(server)).streaks;
    assert.equal(afterMarking.stats.total_days, 5);
    assert.equal(afterMarking.stats.current, 4);
    assert.equal(afterMarking.stats.longest, 4);
    assert.equal(afterMarking.stats.marked_today, true);
    assert.equal(afterMarking.stats.last_day, daysAgo(0));
    assert.equal(afterMarking.stats.first_day, daysAgo(10));

    // Today is not a day you have missed yet: dropping it leaves the run alive,
    // one day shorter, ending yesterday.
    const cleared = await call(server, `/api/streaks/${streak.id}/days/${daysAgo(0)}`, { method: 'DELETE' });
    assert.equal(cleared.status, 200);
    assert.equal((await cleared.json()).marked, false);

    const [afterClearingToday] = (await listStreaks(server)).streaks;
    assert.equal(afterClearingToday.stats.current, 3);
    assert.equal(afterClearingToday.stats.longest, 3);
    assert.equal(afterClearingToday.stats.marked_today, false);

    // Breaking the middle of the run ends the current one at yesterday.
    await call(server, `/api/streaks/${streak.id}/days/${daysAgo(2)}`, { method: 'DELETE' });
    const [afterBreak] = (await listStreaks(server)).streaks;
    assert.equal(afterBreak.stats.current, 1);
    assert.equal(afterBreak.stats.longest, 1);
  } finally {
    stop(server);
  }
});

test('marking the same day twice keeps one day and updates its note', async () => {
  const server = await startServer();
  try {
    const streak = await createStreak(server, { name: 'Read' });
    const day = daysAgo(1);

    await mark(server, streak.id, day, 'twenty pages');
    const again = await mark(server, streak.id, day, 'forty pages');
    assert.equal(again.status, 200);

    const payload = await listStreaks(server);
    assert.equal(payload.streaks[0].stats.total_days, 1, 'a repeated mark is not a second day');
    const marks = payload.days.filter(item => item.streak_id === streak.id);
    assert.equal(marks.length, 1);
    assert.equal(marks[0].note, 'forty pages');
  } finally {
    stop(server);
  }
});

test('a day range only returns the marks inside it', async () => {
  const server = await startServer();
  try {
    const streak = await createStreak(server, { name: 'Practice' });
    for (const day of ['2026-01-31', '2026-02-01', '2026-02-28', '2026-03-01']) {
      await mark(server, streak.id, day);
    }

    const february = await listStreaks(server, '?from=2026-02-01&to=2026-02-28');
    assert.deepEqual(february.days.map(item => item.day), ['2026-02-01', '2026-02-28']);
    assert.equal(
      february.streaks[0].stats.total_days,
      4,
      'the window narrows the marks drawn, not the totals'
    );
    assert.equal(february.today.length, 10);
  } finally {
    stop(server);
  }
});

test('a day that is not a real date is refused', async () => {
  const server = await startServer();
  try {
    const streak = await createStreak(server, { name: 'Stretch' });

    for (const day of ['2026-13-01', '2026-02-30', 'today', '2026-2-1']) {
      const response = await mark(server, streak.id, day);
      assert.equal(response.status, 400, `${day} should be refused`);
    }

    const missing = await mark(server, 'streak-does-not-exist', daysAgo(0));
    assert.equal(missing.status, 404);

    const badRange = await call(server, '/api/streaks?from=last-week');
    assert.equal(badRange.status, 400);
  } finally {
    stop(server);
  }
});

test('a streak can be edited, archived and deleted with its days', async () => {
  const server = await startServer();
  try {
    const streak = await createStreak(server, { name: 'Weights', type: 'health' });
    await mark(server, streak.id, daysAgo(0));

    const patched = await call(server, `/api/streaks/${streak.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Weights (heavy)', type: 'Deep Work', archived: true }),
    });
    assert.equal(patched.status, 200);
    const updated = await patched.json();
    assert.equal(updated.name, 'Weights (heavy)');
    assert.equal(updated.type, 'deep-work');
    assert.equal(updated.archived, true);
    assert.equal(updated.stats.total_days, 1, 'editing a streak does not touch its days');

    const deleted = await call(server, `/api/streaks/${streak.id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 200);

    const payload = await listStreaks(server);
    assert.equal(payload.streaks.length, 0);
    assert.equal(payload.days.length, 0, 'deleting a streak takes its days with it');

    const gone = await call(server, `/api/streaks/${streak.id}`, { method: 'DELETE' });
    assert.equal(gone.status, 404);
  } finally {
    stop(server);
  }
});

test('every streak reports its own days', async () => {
  const server = await startServer();
  try {
    const run = await createStreak(server, { name: 'Run', type: 'health' });
    const ship = await createStreak(server, { name: 'Ship', type: 'focus' });

    await mark(server, run.id, daysAgo(0));
    await mark(server, run.id, daysAgo(1));
    await mark(server, ship.id, daysAgo(0));

    const payload = await listStreaks(server);
    const byName = Object.fromEntries(payload.streaks.map(streak => [streak.name, streak]));
    assert.equal(byName.Run.stats.current, 2);
    assert.equal(byName.Ship.stats.current, 1);
    assert.equal(payload.days.filter(item => item.streak_id === run.id).length, 2);
    assert.equal(payload.days.filter(item => item.streak_id === ship.id).length, 1);
  } finally {
    stop(server);
  }
});
