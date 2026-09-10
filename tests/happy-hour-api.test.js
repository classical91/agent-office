'use strict';

// Happy Hour as an API, and the one schedule behind it.
//
// The deal table used to live inside resets.js, where only the page could read
// it. Main Hub's Daily Dashboard shows the same meal and the same countdown, so
// it moved to happy-hour.js — loaded by the page with a <script> tag and by the
// server with require(). These tests hold that arrangement in place: the
// endpoint answers, it answers the same thing the page renders, and the
// schedule has not quietly grown a second copy.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

const happyHour = require(path.join(DIST, 'happy-hour.js'));

async function startServer() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-happy-hour-'));

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
      // Deliberately no DROPS_PASSPHRASE: this route is open, and a suite that
      // sets one could pass without proving that.
    };
    ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DROPS_PASSPHRASE', 'DROPS_PASSPHRASE_HASH']
      .forEach(key => { delete environment[key]; });
    return environment;
  };

  const server = await startTestServer({ serverPath: SERVER_PATH, cwd: DIST, buildEnv });
  return { ...server, scratch };
}

function stop(server) {
  server.child.kill();
  fs.rmSync(server.scratch, { recursive: true, force: true });
}

test('GET /api/happy-hour reports the phase, the meal and the countdown', async () => {
  const server = await startServer();
  try {
    const response = await fetch(`${server.origin}/api/happy-hour`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.ok(['upcoming', 'starting', 'open', 'tomorrow'].includes(payload.phase));
    assert.ok(payload.meal);
    assert.ok(payload.deal);
    assert.match(payload.targetAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(payload.remainingMs >= 0);

    // The meal is the deal with the discount stripped — never the raw string.
    assert.equal(payload.meal, happyHour.happyHourMeal(payload.deal));
    assert.equal(payload.remainingMs, Math.max(0, Date.parse(payload.targetAt) - Date.parse(payload.now)));
  } finally {
    stop(server);
  }
});

test('the endpoint agrees with the page for the same moment', async () => {
  const server = await startServer();
  try {
    const payload = await (await fetch(`${server.origin}/api/happy-hour`)).json();
    // The page renders happyHourDetails() for whatever "now" is; the server
    // answers from the same function. Recomputing here for the instant the
    // server reported must land on the same deal and phase.
    const details = happyHour.happyHourDetails(new Date(payload.now));

    assert.equal(payload.phase, details.phase);
    assert.equal(payload.deal, details.deal);
    assert.equal(payload.meal, details.meal);
    assert.equal(payload.dayName, details.dayName);
    assert.equal(payload.targetAt, details.target.toISOString());
  } finally {
    stop(server);
  }
});

test('the endpoint is open, and carries nothing from the timer store', async () => {
  const server = await startServer();
  try {
    // No passphrase is set at all, so a route behind requireDropsAuth would 503
    // here. This one is a grocery flyer and answers anyone.
    const response = await fetch(`${server.origin}/api/happy-hour`);
    assert.equal(response.status, 200);

    const body = await response.text();
    for (const leak of ['webhook', 'pushcut', 'passphrase', 'token']) {
      assert.equal(body.toLowerCase().includes(leak), false, `payload mentions ${leak}`);
    }

    // The protected reset-timer store is still protected.
    const timers = await fetch(`${server.origin}/api/reset-timers`);
    assert.ok(timers.status >= 400, 'the reset-timer store answered without auth');
  } finally {
    stop(server);
  }
});

test('the endpoint does not answer writes', async () => {
  const server = await startServer();
  try {
    const response = await fetch(`${server.origin}/api/happy-hour`, { method: 'POST' });
    assert.ok(response.status >= 400);
  } finally {
    stop(server);
  }
});

test('every weekday has a deal, and the meal never keeps the discount', () => {
  assert.equal(happyHour.HAPPY_HOUR_DEALS.length, 7);
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const deal = happyHour.HAPPY_HOUR_DEALS[weekday];
    assert.ok(deal, `weekday ${weekday} has no deal`);
    assert.doesNotMatch(happyHour.happyHourMeal(deal), /50% off|50¢ each/);
  }
});

test('the schedule is in one file, not two', () => {
  // The deal strings and the window hours live in happy-hour.js. If they turn up
  // in resets.js again, the page and the server can disagree about what today's
  // deal is — which is exactly what moving them out was for.
  const page = fs.readFileSync(path.join(DIST, 'resets.js'), 'utf8');

  for (const deal of happyHour.HAPPY_HOUR_DEALS) {
    assert.equal(page.includes(deal), false, `resets.js still carries the deal "${deal}"`);
  }
  assert.equal(/function happyHourDetails/.test(page), false);
  assert.equal(/function happyHourMeal/.test(page), false);

  // And the page really does read them from the shared module.
  assert.match(page, /window\.AOHappyHour/);
});

test('the page still gets the schedule through window, as the browser gives it', () => {
  const read = name => fs.readFileSync(path.join(DIST, name), 'utf8');
  const context = { Date, console, setInterval, clearInterval };
  context.window = context;
  vm.runInNewContext(read('happy-hour.js'), context);
  vm.runInNewContext(read('resets.js'), context);

  // resets.js re-exports both, so anything already reading AOResets keeps working.
  assert.equal(typeof context.window.AOResets.happyHourDetails, 'function');
  assert.equal(context.window.AOResets.happyHourMeal('50% off Fresh Appetizers'), 'Fresh Appetizers');
  assert.equal(context.window.AOResets.happyHourDetails, context.window.AOHappyHour.happyHourDetails);
});

test('resets.html loads the schedule before the page that reads it', () => {
  const html = fs.readFileSync(path.join(DIST, 'resets.html'), 'utf8');
  const schedule = html.indexOf('<script src="happy-hour.js');
  const page = html.indexOf('<script src="resets.js');

  assert.ok(schedule !== -1, 'resets.html does not load happy-hour.js');
  assert.ok(page !== -1, 'resets.html does not load resets.js');
  assert.ok(schedule < page, 'happy-hour.js must load before resets.js');
});

test('the phases walk through the day in order', () => {
  // 2026-09-10 is a Thursday. Times are local, which is what the deal is on.
  const at = (hour, minute) => happyHour.happyHourDetails(new Date(2026, 8, 10, hour, minute));

  assert.equal(at(9, 0).phase, 'upcoming');
  assert.equal(at(14, 29).phase, 'upcoming');
  assert.equal(at(14, 30).phase, 'starting');
  assert.equal(at(15, 0).phase, 'open');
  assert.equal(at(17, 59).phase, 'open');
  assert.equal(at(18, 0).phase, 'tomorrow');

  // Past closing it carries tomorrow's deal, not today's.
  const tonight = at(19, 0);
  assert.equal(tonight.dayName, 'Friday');
  assert.equal(tonight.deal, happyHour.HAPPY_HOUR_DEALS[5]);
  assert.equal(tonight.target.getTime(), new Date(2026, 8, 11, 14, 30).getTime());
});
