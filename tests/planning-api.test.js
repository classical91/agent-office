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

// ─── The week ────────────────────────────────────────────────────────────────
//
// Steps 4 to 6 over HTTP: the proposal is built from the ticked items and the
// calendar, it is locked like everything else here, and — the part that matters
// most — it writes nothing until it is accepted.

async function buildWeek(server, body = {}) {
  const response = await call(server, '/api/planning/week', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}

async function listCalendarEvents(server) {
  const response = await call(server, '/api/calendar/events');
  assert.equal(response.status, 200);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : (payload.events || []);
}

test('the week is built from the ticked items only', async () => {
  const server = await startServer();
  try {
    await addItem(server, { title: 'Workout', estimated_duration: 60 });
    await addItem(server, { title: 'Reporter Room', estimated_duration: 120 });
    await addItem(server, { title: 'Clean garage', schedule_this_week: false });

    const week = await buildWeek(server);
    assert.equal(week.counts.considered, 2);
    assert.equal(week.blocks.length + week.unscheduled.length, 2);
    assert.ok(!week.blocks.some(block => block.title === 'Clean garage'));
    week.blocks.forEach(block => {
      assert.ok(block.start && block.end, 'a block needs a start and an end');
      assert.equal(block.meta.eventKind, 'task');
    });
  } finally {
    stop(server);
  }
});

test('building a week writes nothing to the calendar', async () => {
  const server = await startServer();
  try {
    await addItem(server, { title: 'Workout' });
    await buildWeek(server);
    await buildWeek(server);
    assert.deepEqual(await listCalendarEvents(server), [], 'a proposal must not become events on its own');
  } finally {
    stop(server);
  }
});

test('accepting the week is what puts it on the calendar', async () => {
  const server = await startServer();
  try {
    await addItem(server, { title: 'Workout', estimated_duration: 60 });
    const week = await buildWeek(server);
    assert.ok(week.blocks.length, 'expected something to accept');

    const commit = await call(server, '/api/calendar/schedule/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks: week.blocks }),
    });
    assert.equal(commit.status, 201, await commit.clone().text());

    const events = await listCalendarEvents(server);
    assert.equal(events.length, week.blocks.length);
    // The events API answers in Google's shape, so the title comes back as
    // `summary` whether or not an account is connected.
    assert.ok(events.some(event => (event.summary || event.title) === 'Workout'));
    const planned = events.find(event => (event.summary || event.title) === 'Workout');
    assert.equal(
      planned.meta.planningItemId,
      week.blocks[0].planning_item_id,
      'a committed block should still know which planning item it came from'
    );
  } finally {
    stop(server);
  }
});

test('a block is never planned over an event already on the calendar', async () => {
  const server = await startServer();
  try {
    // A day that is entirely spoken for, starting tomorrow so "now" cannot
    // make this flaky.
    const day = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const busyStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
    const busyEnd = new Date(busyStart.getTime() + 24 * 60 * 60 * 1000);

    const created = await call(server, '/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Away all day',
        start: busyStart.toISOString(),
        end: busyEnd.toISOString(),
      }),
    });
    assert.ok(created.status < 400, await created.clone().text());

    await addItem(server, { title: 'Workout', estimated_duration: 60 });
    const week = await buildWeek(server);

    week.blocks.forEach(block => {
      const start = Date.parse(block.start);
      const end = Date.parse(block.end);
      assert.ok(
        end <= busyStart.getTime() || start >= busyEnd.getTime(),
        'a block was planned over an existing calendar event'
      );
    });
  } finally {
    stop(server);
  }
});

test('a work schedule keeps the week off your shifts', async () => {
  const server = await startServer();
  try {
    await addItem(server, { title: 'Workout', estimated_duration: 60 });
    const week = await buildWeek(server, {
      workSchedule: { shifts: [{ label: 'Work', days: [1, 2, 3, 4, 5, 6, 7], start: '12:30', end: '21:00' }] },
    });

    assert.ok(week.blocks.length, 'the item should still find a slot outside the shift');
    week.blocks.forEach(block => {
      const start = new Date(block.start);
      const end = new Date(block.end);
      const minutes = date => date.getHours() * 60 + date.getMinutes();
      assert.ok(
        minutes(end) <= 12 * 60 + 30 || minutes(start) >= 21 * 60,
        `a block was planned inside a work shift: ${block.start} – ${block.end}`
      );
    });
  } finally {
    stop(server);
  }
});

test('the week is locked like the rest of the planning list', async () => {
  const server = await startServer();
  try {
    const response = await fetch(`${server.origin}/api/planning/week`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401);
  } finally {
    stop(server);
  }
});

// ─── THE WORK SCHEDULE (STEP 1) ──────────────────────────────────────────────

async function putWorkSchedule(server, body) {
  return call(server, '/api/planning/work-schedule', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('the work schedule is locked like everything else personal', async () => {
  const server = await startServer();
  try {
    for (const [method, pathname] of [
      ['GET', '/api/planning/work-schedule'],
      ['PUT', '/api/planning/work-schedule'],
      ['DELETE', '/api/planning/work-schedule'],
      ['POST', '/api/planning/work-schedule/read'],
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

test('there is no work schedule until one is saved', async () => {
  const server = await startServer();
  try {
    const response = await call(server, '/api/planning/work-schedule');
    assert.equal(response.status, 200);
    const payload = await response.json();
    // Not an empty record standing in for one: nothing is a real answer here,
    // and it is what the page uses to offer the photo.
    assert.equal(payload.schedule, null);
    assert.equal(payload.summary, null);
    assert.equal(typeof payload.reader_configured, 'boolean');
  } finally {
    stop(server);
  }
});

test('a saved schedule comes back with its days off worked out', async () => {
  const server = await startServer();
  try {
    const saved = await putWorkSchedule(server, {
      shifts: [{ label: 'Work', days: [2, 3, 4, 5, 6], start: '12:30', end: '21:00' }],
      source: 'photo',
    });
    assert.equal(saved.status, 200);
    const payload = await saved.json();
    assert.equal(payload.schedule.shifts.length, 1);
    assert.deepEqual(payload.summary.working_days, [2, 3, 4, 5, 6]);
    assert.deepEqual(payload.summary.days_off, [1, 7]);
    assert.ok(payload.schedule.updated_at);

    const read = await (await call(server, '/api/planning/work-schedule')).json();
    assert.equal(read.schedule.shifts[0].start, '12:30');
  } finally {
    stop(server);
  }
});

test('a half-filled shift is refused with the row named', async () => {
  const server = await startServer();
  try {
    const bad = await putWorkSchedule(server, { shifts: [{ days: [1], start: '09:00' }] });
    assert.equal(bad.status, 400);
    assert.match((await bad.json()).error, /Shift 1/);

    // And nothing was stored on the way to failing.
    assert.equal((await (await call(server, '/api/planning/work-schedule')).json()).schedule, null);
  } finally {
    stop(server);
  }
});

test('the saved schedule is what the week is built around, with no help from the caller', async () => {
  const server = await startServer();
  try {
    await addItem(server, { title: 'Workout', estimated_duration: 60 });
    await putWorkSchedule(server, {
      shifts: [{ label: 'Work', days: [1, 2, 3, 4, 5, 6, 7], start: '12:30', end: '21:00' }],
    });

    // No workSchedule in the request: the point is that step 1 is now a record,
    // not something every caller has to remember to pass.
    const week = await buildWeek(server, {});
    assert.ok(week.blocks.length, 'the item should still find a slot outside the shift');
    week.blocks.forEach(block => {
      const start = new Date(block.start);
      const end = new Date(block.end);
      const minutes = date => date.getHours() * 60 + date.getMinutes();
      assert.ok(
        minutes(end) <= 12 * 60 + 30 || minutes(start) >= 21 * 60,
        `a block was planned inside a saved work shift: ${block.start} – ${block.end}`
      );
    });
  } finally {
    stop(server);
  }
});

test('deleting the schedule gives the week its hours back', async () => {
  const server = await startServer();
  try {
    await putWorkSchedule(server, {
      shifts: [{ label: 'Work', days: [1, 2, 3, 4, 5, 6, 7], start: '00:00', end: '23:59' }],
    });
    const removed = await call(server, '/api/planning/work-schedule', { method: 'DELETE' });
    assert.equal(removed.status, 200);
    assert.equal((await (await call(server, '/api/planning/work-schedule')).json()).schedule, null);
  } finally {
    stop(server);
  }
});

test('the schedule survives a restart', async () => {
  let server = await startServer();
  const scratch = server.scratch;
  try {
    await putWorkSchedule(server, {
      shifts: [{ label: 'Nights', days: [5, 6], start: '21:00', end: '05:00' }],
    });
    stop(server, { keepScratch: true });

    server = await startServer(scratch);
    const payload = await (await call(server, '/api/planning/work-schedule')).json();
    assert.deepEqual(payload.schedule.shifts[0].days, [5, 6]);
    assert.equal(payload.schedule.shifts[0].end, '05:00');
  } finally {
    stop(server);
  }
});

test('reading a photo is refused cleanly when the server has no key for it', async () => {
  const server = await startServer();
  try {
    const response = await call(server, '/api/planning/work-schedule/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'data:image/png;base64,iVBORw0KGgo=' }),
    });
    // The test server runs without ANTHROPIC_API_KEY, which is the same state a
    // deployment is in until someone sets one: the page has to keep working.
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /type the schedule in/i);
  } finally {
    stop(server);
  }
});

test('a night shift is planned around both halves of itself', async () => {
  const server = await startServer();
  try {
    await addItem(server, { title: 'Workout', estimated_duration: 60 });
    // 21:00 to 05:00, every night: read literally that is an end before its
    // start, and the week would be planned straight through it.
    await putWorkSchedule(server, {
      shifts: [{ label: 'Nights', days: [1, 2, 3, 4, 5, 6, 7], start: '21:00', end: '05:00' }],
    });

    const week = await buildWeek(server, {});
    week.blocks.forEach(block => {
      const start = new Date(block.start);
      const end = new Date(block.end);
      const minutes = date => date.getHours() * 60 + date.getMinutes();
      assert.ok(minutes(start) >= 5 * 60, `a block started during a night shift: ${block.start}`);
      assert.ok(minutes(end) <= 21 * 60, `a block ran into a night shift: ${block.end}`);
    });
  } finally {
    stop(server);
  }
});
