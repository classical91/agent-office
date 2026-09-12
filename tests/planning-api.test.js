'use strict';

// The Planning Mode API against a real server: the list is personal, so every
// route sits behind the Office passphrase, and the list persists across a
// restart because a planning list that forgets on Sunday night is not a
// planning list.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

const PASSPHRASE = 'plan-the-week';
const SHORTCUTS_TOKEN = 'coachclaw-planning-test-token';

function buildEnvFor(scratch) {
  return port => {
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
}

async function startServer(existing) {
  const scratch = existing || fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-planning-'));
  const server = await startTestServer({ serverPath: SERVER_PATH, cwd: DIST, buildEnv: buildEnvFor(scratch) });
  const cookie = await unlock(server.origin);
  return { ...server, scratch, cookie };
}

function stop(server, { keepScratch = false } = {}) {
  server.child.kill();
  if (!keepScratch) fs.rmSync(server.scratch, { recursive: true, force: true });
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

async function addItem(server, body) {
  const response = await call(server, '/api/planning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 201, await response.clone().text());
  return response.json();
}

async function listItems(server) {
  const response = await call(server, '/api/planning');
  assert.equal(response.status, 200);
  return response.json();
}

test('the planning list is behind the passphrase, every verb of it', async () => {
  const server = await startServer();
  try {
    for (const [method, pathname] of [
      ['GET', '/api/planning'],
      ['GET', '/api/planning/brief'],
      ['POST', '/api/planning'],
      ['PATCH', '/api/planning/whatever'],
      ['DELETE', '/api/planning/whatever'],
    ]) {
      const response = await fetch(`${server.origin}${pathname}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'GET' || method === 'DELETE' ? undefined : '{}',
      });
      assert.equal(response.status, 401, `${method} ${pathname} should be locked`);
    }
  } finally {
    stop(server);
  }
});

test('items are added, edited, ticked and deleted', async () => {
  const server = await startServer();
  try {
    const workout = await addItem(server, { title: 'Workout 3 times' });
    assert.equal(workout.schedule_this_week, true);
    assert.equal(workout.completed, false);

    const edited = await call(server, `/api/planning/${encodeURIComponent(workout.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Workout 4 times', estimated_duration: 45, priority: 'high' }),
    });
    assert.equal(edited.status, 200);
    const updated = await edited.json();
    assert.equal(updated.title, 'Workout 4 times');
    assert.equal(updated.estimated_duration, 45);

    const garage = await addItem(server, { title: 'Clean garage', schedule_this_week: false });
    assert.equal(garage.schedule_this_week, false);

    const { items, counts } = await listItems(server);
    assert.deepEqual(items.map(entry => entry.title), ['Workout 4 times', 'Clean garage']);
    assert.equal(counts.scheduled, 1);
    assert.equal(counts.parked, 1);

    const removed = await call(server, `/api/planning/${encodeURIComponent(garage.id)}`, { method: 'DELETE' });
    assert.equal(removed.status, 200);
    assert.deepEqual((await listItems(server)).items.map(entry => entry.title), ['Workout 4 times']);

    const missing = await call(server, '/api/planning/plan-nope', { method: 'DELETE' });
    assert.equal(missing.status, 404);
  } finally {
    stop(server);
  }
});

test('marking something done does not untick anything else, and ticking does not complete', async () => {
  const server = await startServer();
  try {
    const workout = await addItem(server, { title: 'Workout' });
    const reporter = await addItem(server, { title: 'Work on Reporter Room' });

    const done = await call(server, `/api/planning/${encodeURIComponent(workout.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    });
    assert.equal(done.status, 200);
    const completed = await done.json();
    assert.equal(completed.completed, true);
    assert.ok(completed.completed_at);
    assert.equal(completed.schedule_this_week, false);

    const { items } = await listItems(server);
    const other = items.find(entry => entry.id === reporter.id);
    assert.equal(other.schedule_this_week, true, 'finishing one item leaves the rest of the week alone');
    assert.equal(other.completed, false);
  } finally {
    stop(server);
  }
});

test('a bad field is a 400, and the list is not touched', async () => {
  const server = await startServer();
  try {
    const item = await addItem(server, { title: 'Read Zohar chapter' });
    const bad = await call(server, `/api/planning/${encodeURIComponent(item.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: 'whenever' }),
    });
    assert.equal(bad.status, 400);

    const empty = await call(server, '/api/planning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '  ' }),
    });
    assert.equal(empty.status, 400);

    const { items } = await listItems(server);
    assert.deepEqual(items.map(entry => entry.title), ['Read Zohar chapter']);
    assert.equal(items[0].priority, 'normal');
  } finally {
    stop(server);
  }
});

test('the brief hands CoachClaw the ticked items in the shape the scheduler reads', async () => {
  const server = await startServer();
  try {
    await addItem(server, { title: 'Workout', estimated_duration: 45, priority: 'high', preferred_time: 'morning', preferred_days: [2, 4] });
    await addItem(server, { title: 'Review trading strategy' });
    await addItem(server, { title: 'Clean garage', schedule_this_week: false });

    const response = await call(server, '/api/planning/brief');
    assert.equal(response.status, 200);
    const brief = await response.json();

    assert.deepEqual(brief.items.map(entry => entry.title), ['Workout', 'Review trading strategy']);
    assert.equal(brief.counts.parked, 1);

    const [workout, review] = brief.items;
    assert.equal(workout.request.durationMinutes, 45);
    assert.deepEqual(workout.preferred_days, [2, 4]);
    assert.deepEqual(workout.preferred_window, { start: '06:00', end: '12:00' });
    assert.equal(review.request.durationMinutes, brief.default_duration_minutes);
    assert.equal(review.duration_is_estimated, true);
  } finally {
    stop(server);
  }
});

test('CoachClaw can read the brief with its bearer token but gets no planning write access', async () => {
  const server = await startServer();
  try {
    await addItem(server, { title: 'Workout', estimated_duration: 45, priority: 'high' });
    await addItem(server, { title: 'Clean garage', schedule_this_week: false });

    const locked = await fetch(`${server.origin}/api/shortcuts/planning/brief`);
    assert.equal(locked.status, 401);

    const response = await fetch(`${server.origin}/api/shortcuts/planning/brief`, {
      headers: { Authorization: `Bearer ${SHORTCUTS_TOKEN}` },
    });
    assert.equal(response.status, 200);
    const brief = await response.json();
    assert.deepEqual(brief.items.map(entry => entry.title), ['Workout']);
    assert.equal(brief.counts.parked, 1);

    const write = await fetch(`${server.origin}/api/planning`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SHORTCUTS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Must stay locked' }),
    });
    assert.equal(write.status, 401);
  } finally {
    stop(server);
  }
});

test('the list survives a restart', async () => {
  let server = await startServer();
  let scratch = server.scratch;
  try {
    await addItem(server, { title: 'Visit grandmother', preferred_days: [6] });
    stop(server, { keepScratch: true });

    server = await startServer(scratch);
    const { items } = await listItems(server);
    assert.deepEqual(items.map(entry => entry.title), ['Visit grandmother']);
    assert.deepEqual(items[0].preferred_days, [6]);
  } finally {
    stop(server);
  }
});
