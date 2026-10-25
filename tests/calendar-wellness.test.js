'use strict';

// The Calendar's Wellness layer: the Wellness Tracker's workout rota and
// Nutri-Mind's planned meals, read from those apps, with the diet sync code
// never leaving the server.

process.env.TZ = 'America/Vancouver';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');
const calendarWellness = require(path.join(DIST, 'calendar-wellness.js'));

const PASSPHRASE = 'open-the-calendar-wellness';
const SYNC_CODE = 'diet-sync-code-that-is-secret';

// Wednesday, Oct 14 2026, 10:00 in Vancouver.
const NOW = new Date('2026-10-14T10:00:00-07:00');

const WEEK = [
  { day: 'Monday', theme: 'Strength', emoji: '💪', color: '#FF6B35', focus: 'Upper & Lower Dumbbell', items: [{ emoji: '💪', name: 'Workout 1', detail: '30 min', path: '/#/workout-sets' }] },
  { day: 'Tuesday', theme: 'Move Easy', emoji: '🏃', color: '#378ADD', focus: 'Bodyweight & Breath', items: [{ emoji: '🏃', name: 'Simple Workouts', detail: '15 min' }] },
  { day: 'Wednesday', theme: 'Strength', emoji: '🔥', color: '#FFD93D', focus: 'Core & Lower Body Burn', items: [{ emoji: '🔥', name: 'Workout 2', detail: '30 min' }, { emoji: '🧴', name: 'Foam Roller', detail: '10 min' }] },
  { day: 'Thursday', theme: 'Recovery', emoji: '🌿', color: '#2ECC71', focus: 'Active Recovery', items: [{ emoji: '🧘', name: 'Stretch', detail: '10 min' }] },
  { day: 'Friday', theme: 'Strength', emoji: '🧘', color: '#C77DFF', focus: 'Total Body Tone-Up', items: [{ emoji: '🧘', name: 'Workout 3', detail: '30 min' }] },
  { day: 'Saturday', theme: 'Move Easy', emoji: '▶️', color: '#E74C3C', focus: 'Cardio & Video', items: [{ emoji: '🚴', name: 'Bike, Swim or Run', detail: '20 min' }] },
  { day: 'Sunday', theme: 'Rest', emoji: '🌙', color: '#4ECDC4', focus: 'Full Rest & Calm', items: [{ emoji: '🌙', name: 'Calm Down', detail: '5 min' }] },
];

const WEEKDAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function mealDay(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const id = WEEKDAY_IDS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return {
    date: dateKey,
    today: {
      day: id,
      label: id,
      planned: true,
      slots: [
        { id: 'morning', icon: '🌅', label: 'Morning', text: `Oats (${id})`, hidden: false, planned: true },
        { id: 'afternoon', icon: '☀️', label: 'Afternoon', text: 'Not chosen yet', hidden: false, planned: false },
        { id: 'night', icon: '🌙', label: 'Night', text: `Salmon (${id})`, hidden: false, planned: true },
      ],
    },
  };
}

const ENV = {
  WORKOUT_TRACKER_BASE_URL: 'https://workouts.example',
  DIET_PLAN_BASE_URL: 'https://meals.example/',
  DIET_PLAN_SYNC_CODE: SYNC_CODE,
};

function jsonResponse(status, body) {
  return {
    status,
    json: async () => body,
  };
}

// Answers the way the two apps do, and records what was asked.
function fakeFetch(overrides = {}) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const parsed = new URL(url);
    if (parsed.pathname === '/api/weekly-plan') {
      return overrides.workout ? overrides.workout(parsed, init) : jsonResponse(200, { date: parsed.searchParams.get('date'), week: WEEK });
    }
    if (parsed.pathname === '/api/daily-meal-plan') {
      if (overrides.meals) return overrides.meals(parsed, init);
      if (init.headers['x-sync-code'] !== SYNC_CODE) return jsonResponse(401, { error: 'A valid sync code is required.' });
      return jsonResponse(200, mealDay(parsed.searchParams.get('date')));
    }
    return jsonResponse(404, {});
  };
  return { impl, calls };
}

function read(options = {}) {
  const { impl, calls } = options.fake || fakeFetch();
  const reader = calendarWellness.createWellnessReader({ fetchImpl: impl, ttlMs: options.ttlMs });
  const from = options.from || new Date('2026-10-12T00:00:00-07:00');
  const to = options.to || new Date('2026-10-26T00:00:00-07:00');
  return reader.read({ from, to, now: NOW, env: options.env || ENV, deployed: options.deployed }).then(payload => ({ payload, calls, reader }));
}

function localKey(iso) {
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

test('workouts land on every day from today on, matched to the weekday', async () => {
  const { payload } = await read();
  const workouts = payload.items.filter(item => item.source === 'workout');
  // Oct 14 (Wed) through Oct 25 (Sun): twelve days, none before today.
  assert.equal(workouts.length, 12);
  assert.equal(workouts[0].date, '2026-10-14');
  assert.equal(workouts[0].title, 'Strength · Core & Lower Body Burn');
  assert.equal(localKey(workouts[0].at), '10/14 17:30');
  assert.deepEqual(workouts[0].lines.map(line => line.text), ['Workout 2', 'Foam Roller']);
  assert.equal(workouts[0].color, '#FFD93D');
  assert.equal(workouts[0].href, 'https://workouts.example/#/weekly-plan');
  assert.equal(workouts.find(item => item.date === '2026-10-19').title, 'Strength · Upper & Lower Dumbbell');
  assert.ok(workouts.every(item => item.blocksTime === false));
});

test('meals cover today and the six days after it, planned slots only', async () => {
  const { payload, calls } = await read();
  const meals = payload.items.filter(item => item.source === 'meal');
  const days = Array.from(new Set(meals.map(item => item.date)));
  assert.deepEqual(days, ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']);
  // "Not chosen yet" is not a meal, so the afternoon slot is never drawn.
  assert.ok(meals.every(item => item.slot !== 'afternoon'));
  const wednesday = meals.filter(item => item.date === '2026-10-14');
  assert.deepEqual(wednesday.map(item => [item.label, item.title, localKey(item.at)]), [
    ['Morning', 'Oats (wed)', '10/14 8:00'],
    ['Night', 'Salmon (wed)', '10/14 18:30'],
  ]);
  assert.equal(wednesday[0].href, 'https://meals.example/weekly-calendar');
  const mealCalls = calls.filter(call => call.url.includes('/api/daily-meal-plan'));
  assert.equal(mealCalls.length, 7);
  assert.ok(mealCalls.every(call => call.init.redirect === 'manual'));
  assert.ok(mealCalls.every(call => !call.url.includes(SYNC_CODE)), 'the sync code travels in a header, never the URL');
  assert.deepEqual(payload.sources, { workout: { state: 'ok', message: '' }, meals: { state: 'ok', message: '' } });
});

test('nothing is drawn for days already past', async () => {
  const { payload, calls } = await read({
    from: new Date('2026-10-01T00:00:00-07:00'),
    to: new Date('2026-10-08T00:00:00-07:00'),
  });
  assert.equal(payload.items.length, 0);
  assert.equal(calls.length, 0, 'a range entirely in the past asks neither app');
});

test('CALENDAR_WELLNESS_TIMES moves the nominal times', async () => {
  const { payload } = await read({
    env: { ...ENV, CALENDAR_WELLNESS_TIMES: 'workout=6:45, night=19:15, bogus=01:00, morning=99:00' },
    to: new Date('2026-10-15T00:00:00-07:00'),
  });
  const keyed = payload.items.map(item => [item.source, item.slot || '', localKey(item.at)]);
  assert.deepEqual(keyed, [
    ['workout', '', '10/14 6:45'],
    ['meal', 'morning', '10/14 8:00'],
    ['meal', 'night', '10/14 19:15'],
  ]);
  assert.equal(payload.times.workout, '06:45');
});

test('each source says why it is missing instead of looking empty', async () => {
  const unconfigured = await read({ env: {} });
  assert.equal(unconfigured.payload.sources.workout.state, 'not_configured');
  assert.match(unconfigured.payload.sources.workout.message, /WORKOUT_TRACKER_BASE_URL/);
  assert.equal(unconfigured.payload.sources.meals.state, 'not_configured');
  assert.equal(unconfigured.calls.length, 0);

  const noCode = await read({ env: { ...ENV, DIET_PLAN_SYNC_CODE: '' } });
  assert.match(noCode.payload.sources.meals.message, /DIET_PLAN_SYNC_CODE/);
  assert.equal(noCode.payload.sources.workout.state, 'ok');

  const refused = await read({ env: { ...ENV, DIET_PLAN_SYNC_CODE: 'wrong-code-entirely' } });
  assert.equal(refused.payload.sources.meals.state, 'auth_error');
  assert.equal(refused.payload.counts.meals, 0);
  assert.ok(refused.payload.counts.workouts > 0, 'a refused meal plan never costs the workouts');

  const neverSynced = await read({ fake: fakeFetch({ meals: () => jsonResponse(404, { error: 'No synced plan yet.' }) }) });
  assert.equal(neverSynced.payload.sources.meals.state, 'empty');

  const down = await read({
    fake: fakeFetch({
      workout: () => {
        throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
      },
    }),
  });
  assert.deepEqual(down.payload.sources.workout, { state: 'unreachable', message: 'ECONNREFUSED' });
  assert.ok(down.payload.counts.meals > 0);
});

test('a deployment refuses plain-http upstreams except loopback', () => {
  const remote = calendarWellness.resolveConfig({ ...ENV, DIET_PLAN_BASE_URL: 'http://meals.example' }, { deployed: true });
  assert.equal(remote.meals.ok, false);
  assert.match(remote.meals.reason, /https/);
  const local = calendarWellness.resolveConfig({ ...ENV, DIET_PLAN_BASE_URL: 'http://127.0.0.1:4000' }, { deployed: true });
  assert.equal(local.meals.ok, true);
});

test('answers are reused for a minute, failures are not', async () => {
  let failMeals = true;
  const fake = fakeFetch({
    meals: (parsed, init) => (failMeals ? jsonResponse(500, {}) : jsonResponse(200, mealDay(parsed.searchParams.get('date')))),
  });
  const reader = calendarWellness.createWellnessReader({ fetchImpl: fake.impl });
  const range = { from: new Date('2026-10-14T00:00:00-07:00'), to: new Date('2026-10-15T00:00:00-07:00'), now: NOW, env: ENV };
  const first = await reader.read(range);
  assert.equal(first.sources.meals.state, 'error');
  failMeals = false;
  const second = await reader.read(range);
  assert.equal(second.sources.meals.state, 'ok');
  const before = fake.calls.length;
  await reader.read(range);
  assert.equal(fake.calls.length, before, 'a fresh answer is not asked for again');
});

// ─── Against a real server ───────────────────────────────────────────────────

function startUpstream(handler) {
  return new Promise(resolve => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

test('GET /api/calendar/wellness is private and never hands back the sync code', async t => {
  const seenCodes = [];
  const upstream = await startUpstream((req, res) => {
    const url = new URL(req.url, 'http://upstream');
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/weekly-plan') {
      res.end(JSON.stringify({ date: url.searchParams.get('date'), week: WEEK }));
      return;
    }
    if (url.pathname === '/api/daily-meal-plan') {
      seenCodes.push(req.headers['x-sync-code']);
      res.end(JSON.stringify(mealDay(url.searchParams.get('date'))));
      return;
    }
    res.statusCode = 404;
    res.end('{}');
  });
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-calendar-wellness-'));
  const buildEnv = port => {
    const environment = {
      ...process.env,
      PORT: String(port),
      PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
      APP_TIMEZONE: 'America/Vancouver',
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
      WORKOUT_TRACKER_BASE_URL: upstream.origin,
      DIET_PLAN_BASE_URL: upstream.origin,
      DIET_PLAN_SYNC_CODE: SYNC_CODE,
    };
    ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DROPS_PASSPHRASE_HASH', 'SHORTCUTS_TOKEN', 'CALENDAR_WELLNESS_TIMES']
      .forEach(key => { delete environment[key]; });
    return environment;
  };
  const server = await startTestServer({ serverPath: SERVER_PATH, cwd: DIST, buildEnv });
  t.after(() => {
    server.child.kill();
    upstream.server.close();
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  assert.equal((await fetch(`${server.origin}/api/calendar/wellness`)).status, 401);

  const unlocked = await fetch(`${server.origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  assert.equal(unlocked.status, 200);
  const cookie = String(unlocked.headers.get('set-cookie') || '').split(';')[0];

  const bad = await fetch(`${server.origin}/api/calendar/wellness?from=2026-10-20&to=2026-10-01`, { headers: { Cookie: cookie } });
  assert.equal(bad.status, 400);

  const from = new Date();
  const to = new Date(from.getTime() + 3 * 24 * 60 * 60 * 1000);
  const response = await fetch(
    `${server.origin}/api/calendar/wellness?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
    { headers: { Cookie: cookie } }
  );
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.ok(!body.includes(SYNC_CODE), 'the sync code never leaves the server');
  const payload = JSON.parse(body);
  assert.equal(payload.timezone, 'America/Vancouver');
  assert.equal(payload.sources.workout.state, 'ok');
  assert.equal(payload.sources.meals.state, 'ok');
  assert.ok(payload.counts.workouts >= 3);
  assert.ok(payload.counts.meals >= 6);
  assert.ok(seenCodes.length > 0 && seenCodes.every(code => code === SYNC_CODE));
});
