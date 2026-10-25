'use strict';

// Workouts and meals written into Google Calendar: created once, rewritten
// only when the plan changes, removed only when their app says so, and
// nothing else on the calendar ever touched.

process.env.TZ = 'America/Vancouver';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const DIST = path.join(path.resolve(__dirname, '..'), 'agent-office-deploy', 'dist');
const wellnessSync = require(path.join(DIST, 'calendar-wellness-sync.js'));

const TZ = 'America/Vancouver';
// Wednesday, Oct 14 2026, 10:00 in Vancouver.
const NOW = new Date('2026-10-14T10:00:00-07:00');
const OK = { state: 'ok', message: '' };

function workout(date, overrides = {}) {
  return {
    id: `workout:${date}`,
    source: 'workout',
    date,
    title: 'Strength · Core & Lower Body Burn',
    label: 'Workout',
    emoji: '🔥',
    at: new Date(`${date}T17:30:00-07:00`).toISOString(),
    lines: [
      { emoji: '🔥', text: 'Workout 2', detail: 'Calf raises, step-ups · 30 min' },
      { emoji: '🧴', text: 'Foam Roller', detail: 'Roll out the legs · 10–15 min' },
    ],
    href: 'https://workouts.example/#/weekly-plan',
    appLabel: 'Wellness Tracker',
    ...overrides,
  };
}

function meal(date, slot, title, overrides = {}) {
  const times = { morning: '08:00', afternoon: '12:30', night: '18:30' };
  const labels = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' };
  return {
    id: `meal:${date}:${slot}`,
    source: 'meal',
    date,
    slot,
    title,
    label: labels[slot],
    emoji: '🍽️',
    at: new Date(`${date}T${times[slot]}:00-07:00`).toISOString(),
    lines: [],
    href: 'https://meals.example/weekly-calendar',
    appLabel: 'Nutri-Mind',
    ...overrides,
  };
}

// A Google that keeps events in memory and answers the list the way the real
// one does when filtered by a private extended property.
function fakeGoogle(seed = []) {
  const events = new Map(seed.map(event => [event.id, event]));
  let next = 1;
  const calls = [];
  return {
    events,
    calls,
    api: {
      async list({ timeMin, timeMax }) {
        calls.push(['list', timeMin, timeMax]);
        return Array.from(events.values()).filter(event => {
          const tags = (event.extendedProperties && event.extendedProperties.private) || {};
          const start = Date.parse(event.start.dateTime);
          return tags.aoSource === 'wellness' && start >= Date.parse(timeMin) && start < Date.parse(timeMax);
        });
      },
      async create(body) {
        const id = `evt${next++}`;
        calls.push(['create', id]);
        events.set(id, { id, ...JSON.parse(JSON.stringify(body)) });
        return events.get(id);
      },
      async patch(id, body) {
        calls.push(['patch', id]);
        events.set(id, { ...events.get(id), ...JSON.parse(JSON.stringify(body)) });
        return events.get(id);
      },
      async remove(id) {
        calls.push(['remove', id]);
        events.delete(id);
      },
    },
  };
}

function run(google, items, sources = { workout: OK, meals: OK }, now = NOW) {
  return wellnessSync.runWellnessSync({
    readWellness: async () => ({ items, sources }),
    api: google.api,
    now,
    timeZone: TZ,
  });
}

function byKey(google) {
  const map = new Map();
  google.events.forEach(event => map.set(event.extendedProperties.private.aoWellnessKey, event));
  return map;
}

test('a first pass writes every workout and meal as a tagged Google event', async () => {
  const google = fakeGoogle();
  const result = await run(google, [
    workout('2026-10-14'),
    meal('2026-10-14', 'morning', 'Oats, Berries'),
    meal('2026-10-14', 'night', 'Salmon — Rice · Veggies'),
  ]);
  assert.equal(result.created, 3);
  assert.equal(result.failed, 0);

  const events = byKey(google);
  const gym = events.get('workout:2026-10-14');
  assert.equal(gym.summary, '🔥 Strength · Core & Lower Body Burn');
  assert.equal(gym.start.timeZone, TZ);
  // 30 min + the low end of 10–15 min.
  assert.equal(Date.parse(gym.end.dateTime) - Date.parse(gym.start.dateTime), 40 * 60 * 1000);
  assert.match(gym.description, /• 🔥 Workout 2 — Calf raises, step-ups · 30 min/);
  assert.match(gym.description, /https:\/\/workouts\.example\/#\/weekly-plan/);
  assert.equal(gym.colorId, '10');
  assert.deepEqual(gym.reminders, { useDefault: true });
  assert.equal(gym.extendedProperties.private.aoSource, 'wellness');

  const dinner = events.get('meal:2026-10-14:night');
  assert.equal(dinner.summary, '🍽️ Night: Salmon — Rice · Veggies');
  assert.equal(Date.parse(dinner.end.dateTime) - Date.parse(dinner.start.dateTime), 30 * 60 * 1000);
  assert.deepEqual(dinner.reminders, { useDefault: false, overrides: [] });
  assert.equal(dinner.colorId, '5');
});

test('an unchanged plan writes nothing, and a hand-moved event stays where it was put', async () => {
  const google = fakeGoogle();
  const items = [workout('2026-10-14'), meal('2026-10-14', 'night', 'Salmon')];
  await run(google, items);
  const dinner = byKey(google).get('meal:2026-10-14:night');
  // Moved to 7:30pm in Google by hand.
  dinner.start = { dateTime: new Date('2026-10-14T19:30:00-07:00').toISOString(), timeZone: TZ };
  dinner.end = { dateTime: new Date('2026-10-14T20:00:00-07:00').toISOString(), timeZone: TZ };
  google.calls.length = 0;

  const result = await run(google, items);
  assert.deepEqual([result.created, result.updated, result.deleted], [0, 0, 0]);
  assert.deepEqual(google.calls.map(call => call[0]), ['list']);
  assert.equal(byKey(google).get('meal:2026-10-14:night').start.dateTime, new Date('2026-10-14T19:30:00-07:00').toISOString());
});

test('a changed dinner is rewritten in place, a removed one is deleted', async () => {
  const google = fakeGoogle();
  await run(google, [meal('2026-10-14', 'night', 'Salmon'), meal('2026-10-15', 'night', 'Tacos')]);
  const salmonId = byKey(google).get('meal:2026-10-14:night').id;

  const result = await run(google, [meal('2026-10-14', 'night', 'Chicken curry')]);
  assert.deepEqual([result.created, result.updated, result.deleted], [0, 1, 1]);
  const events = byKey(google);
  assert.equal(events.get('meal:2026-10-14:night').id, salmonId, 'the same event, rewritten');
  assert.equal(events.get('meal:2026-10-14:night').summary, '🍽️ Night: Chicken curry');
  assert.equal(events.has('meal:2026-10-15:night'), false);
});

test('a source that did not answer deletes nothing', async () => {
  const google = fakeGoogle();
  await run(google, [workout('2026-10-14'), meal('2026-10-14', 'night', 'Salmon')]);

  for (const state of ['unreachable', 'auth_error', 'not_configured', 'error', 'empty']) {
    const result = await run(google, [workout('2026-10-14')], { workout: OK, meals: { state, message: '' } });
    assert.equal(result.deleted, 0, `meals ${state} must not delete`);
    assert.ok(byKey(google).has('meal:2026-10-14:night'));
  }
  const down = await run(google, [], { workout: { state: 'unreachable', message: '' }, meals: OK });
  assert.ok(byKey(google).has('workout:2026-10-14'), 'a down tracker keeps its workouts');
  assert.equal(down.deleted, 1, 'meals answered ok with nothing, so its event goes');
});

test('only events tagged as wellness are ever changed', async () => {
  const dentist = {
    id: 'dentist',
    summary: 'Dentist',
    start: { dateTime: new Date('2026-10-14T18:30:00-07:00').toISOString() },
    end: { dateTime: new Date('2026-10-14T19:00:00-07:00').toISOString() },
    extendedProperties: { private: { agentOfficeType: 'meeting' } },
  };
  const google = fakeGoogle([dentist]);
  await run(google, [meal('2026-10-14', 'night', 'Salmon')]);
  await run(google, []);
  assert.ok(google.events.has('dentist'));
  assert.ok(google.calls.every(call => call[1] !== 'dentist'));
});

test('duplicates left by an interrupted pass are cleaned up', async () => {
  const google = fakeGoogle();
  const items = [meal('2026-10-14', 'night', 'Salmon')];
  await run(google, items);
  const original = Array.from(google.events.values())[0];
  google.events.set('dupe', { ...original, id: 'dupe' });
  const result = await run(google, items);
  assert.equal(result.deleted, 1);
  assert.equal(google.events.size, 1);
});

test('the window is today and the next six days; earlier events are never touched', async () => {
  const yesterday = {
    id: 'old',
    summary: 'Old dinner',
    start: { dateTime: new Date('2026-10-13T18:30:00-07:00').toISOString() },
    end: { dateTime: new Date('2026-10-13T19:00:00-07:00').toISOString() },
    extendedProperties: { private: { aoSource: 'wellness', aoWellnessKey: 'meal:2026-10-13:night', aoWellnessHash: 'x' } },
  };
  const google = fakeGoogle([yesterday]);
  await run(google, []);
  assert.ok(google.events.has('old'));
  const [, timeMin, timeMax] = google.calls[0];
  assert.equal(timeMin, new Date('2026-10-14T00:00:00-07:00').toISOString());
  assert.equal(timeMax, new Date('2026-10-21T00:00:00-07:00').toISOString());
});

test('one failed write is reported without stopping the rest', async () => {
  const google = fakeGoogle();
  const create = google.api.create;
  google.api.create = async body => {
    if (body.extendedProperties.private.aoWellnessKey === 'meal:2026-10-14:morning') throw new Error('Rate Limit Exceeded');
    return create(body);
  };
  const result = await run(google, [meal('2026-10-14', 'morning', 'Oats'), meal('2026-10-14', 'night', 'Salmon')]);
  assert.equal(result.created, 1);
  assert.equal(result.failed, 1);
  assert.match(result.errors[0], /meal:2026-10-14:morning: Rate Limit Exceeded/);
});

test('workout length comes from its items, within sensible bounds', () => {
  assert.equal(wellnessSync.workoutMinutes([{ detail: '30 min' }, { detail: '10 min' }]), 40);
  assert.equal(wellnessSync.workoutMinutes([{ detail: '5–10 min' }]), 10);
  assert.equal(wellnessSync.workoutMinutes([{ detail: 'easy pace' }]), 30);
  assert.equal(wellnessSync.workoutMinutes([{ detail: '200 min' }]), 180);
});

// ─── Against a real server ───────────────────────────────────────────────────

test('POST /api/calendar/wellness/sync is private and says why it did not run', async t => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-wellness-sync-'));
  const PASSPHRASE = 'open-the-wellness-sync';
  const buildEnv = port => {
    const environment = {
      ...process.env,
      PORT: String(port),
      PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
      APP_TIMEZONE: TZ,
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
      WORKOUT_TRACKER_BASE_URL: 'http://127.0.0.1:9',
    };
    ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DROPS_PASSPHRASE_HASH', 'SHORTCUTS_TOKEN',
      'DIET_PLAN_BASE_URL', 'DIET_PLAN_SYNC_CODE'].forEach(key => { delete environment[key]; });
    return environment;
  };
  const server = await startTestServer({ serverPath: path.join(DIST, 'server.js'), cwd: DIST, buildEnv });
  t.after(() => {
    server.child.kill();
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  assert.equal((await fetch(`${server.origin}/api/calendar/wellness/sync`, { method: 'POST' })).status, 401);

  const unlocked = await fetch(`${server.origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  const cookie = String(unlocked.headers.get('set-cookie') || '').split(';')[0];

  const response = await fetch(`${server.origin}/api/calendar/wellness/sync`, { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.skipped, 'Google Calendar is not connected.');

  const layer = await (await fetch(`${server.origin}/api/calendar/wellness`, { headers: { Cookie: cookie } })).json();
  assert.equal(layer.googleSync.auto, true);
  assert.equal(layer.googleSync.last.skipped, 'Google Calendar is not connected.');
});
