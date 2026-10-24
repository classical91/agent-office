'use strict';

// The Daily Dashboard's Today/Next Up contract.
//
// Two things this exists to guarantee. That the dashboard gets an answer to
// "what is on today, and what should I look at next" without reading
// /api/countdowns — this page's whole internal payload. And that what travels
// is a projection: no notes, no later buckets, no field a row does not draw.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');
const countdowns = require(path.join(DIST, 'countdowns.js'));

const PASSPHRASE = 'open-the-widgets';
const SHORTCUTS_TOKEN = 'widgets-machine-token-1234567890';

// ─── The pure selection ──────────────────────────────────────────────────────

const at = (hour, minute = 0) => new Date(2026, 8, 10, hour, minute); // Thursday
const on = (day, hour) => new Date(2026, 8, day, hour, 0);

function build(now, rows, events = []) {
  return countdowns.buildUpcoming({ now, countdowns: rows, events });
}

test('next up is the soonest thing on today', () => {
  const now = at(9);
  const payload = build(now, [
    { id: 'late', title: 'Evening review', category: 'routine', target_at: at(21).toISOString() },
    { id: 'soon', title: 'Standup', category: 'routine', target_at: at(11).toISOString() },
  ]);

  const widget = countdowns.selectWidgetToday(payload);
  assert.equal(widget.next.title, 'Standup');
  assert.equal(widget.nextIsLater, false);
  assert.equal(widget.total, 2);
});

test("today's events are the whole day, outside the countdown cap", () => {
  const now = at(15);
  const events = [
    { id: 'gym', title: 'Morning gym', start: at(7).toISOString(), end: at(8).toISOString() },
    { id: 'standup', title: 'Standup', start: at(14, 30).toISOString(), end: at(15, 30).toISOString() },
    { id: 'dinner', title: 'Dinner', start: at(19).toISOString(), end: at(21).toISOString(), notes: 'PRIVATE' },
    { id: 'off', title: 'Day off', start: '2026-09-10', end: '2026-09-11' },
    { id: 'yday', title: 'Yesterday', start: '2026-09-09', end: '2026-09-10' },
    { id: 'tmrw', title: 'Tomorrow', start: on(11, 9).toISOString(), end: on(11, 10).toISOString() },
  ];
  // Twenty-five overdue countdowns would fill every row the cap allows.
  const rows = Array.from({ length: 25 }, (_, i) => ({
    id: `late-${i}`, title: `Late ${i}`, category: 'deadline', target_at: at(6).toISOString(),
  }));
  const payload = build(now, rows, events);
  assert.equal(countdowns.selectWidgetToday(payload, { limit: 20 }).items.some(item => item.kind === 'event'), false);

  const today = countdowns.selectTodayEvents(events, now);
  assert.deepEqual(today.map(event => event.title), ['Day off', 'Morning gym', 'Standup', 'Dinner']);
  assert.deepEqual(today.map(event => [event.allDay, event.ended, event.inProgress]), [
    [true, false, false],
    [false, true, false],
    [false, false, true],
    [false, false, false],
  ]);
  // An all-day date is today's local midnight, not UTC's.
  assert.equal(today[0].startAt, new Date(2026, 8, 10).toISOString());
  assert.equal(JSON.stringify(today).includes('PRIVATE'), false);
});

test('overdue work leads, because it is the thing to deal with', () => {
  const now = at(15);
  const payload = build(now, [
    { id: 'soon', title: 'Standup', category: 'routine', target_at: at(17).toISOString() },
    { id: 'late', title: 'Rent due', category: 'deadline', target_at: at(9).toISOString() },
  ]);

  const widget = countdowns.selectWidgetToday(payload);
  assert.equal(widget.next.title, 'Rent due');
  assert.equal(widget.next.overdue, true);
  assert.equal(widget.overdue, 1);
});

test('a quiet weekend trading card never leads, but still shows', () => {
  // Saturday. The roll-up leaves these out for the same reason: nudging about a
  // trade on a weekend is the pressure these pages exist not to add.
  const now = on(12, 10);
  const payload = build(now, [
    { id: 'trade', title: 'Weekly TradingView review', category: 'trading', target_at: on(12, 14).toISOString() },
    { id: 'chore', title: 'Laundry', category: 'personal', target_at: on(12, 18).toISOString() },
  ]);

  const widget = countdowns.selectWidgetToday(payload);
  assert.equal(widget.next.title, 'Laundry');
  assert.ok(widget.items.some(item => item.title === 'Weekly TradingView review'));
});

test('an empty today looks ahead rather than going blank', () => {
  const now = at(9);
  const payload = build(now, [
    { id: 'thu', title: 'Dentist', category: 'personal', target_at: on(14, 10).toISOString() },
  ]);

  const widget = countdowns.selectWidgetToday(payload);
  assert.equal(widget.next.title, 'Dentist');
  assert.equal(widget.nextIsLater, true, 'the look-ahead is not flagged as such');
  assert.deepEqual(widget.items, []);
  assert.equal(widget.total, 0);
});

test('a pinned card leads the page, but does not decide what is next', () => {
  // Pinning is how this page is told to keep a card where it can be seen. It is
  // not a claim about time, and the look-ahead used to read it as one — it took
  // payload.items[0], which is the first card in the page's order, not the next
  // thing to happen. The dashboard led with an audit two days out while an
  // unpinned review due the next morning went unmentioned.
  const now = at(9);
  const payload = build(now, [
    { id: 'pinned', title: 'Weekly agent health audit', category: 'routine', pinned: true, target_at: on(13, 9).toISOString() },
    { id: 'sooner', title: 'Review phone privacy', category: 'routine', target_at: on(11, 9).toISOString() },
  ]);

  assert.equal(payload.items[0].title, 'Weekly agent health audit', 'the page no longer leads with the pinned card');

  const widget = countdowns.selectWidgetToday(payload);
  assert.equal(widget.next.title, 'Review phone privacy', 'the look-ahead followed the pin instead of the clock');
  assert.equal(widget.nextIsLater, true);
});

test('pinning does not reorder what is due today either', () => {
  const now = at(9);
  const payload = build(now, [
    { id: 'pinned', title: 'Evening review', category: 'routine', pinned: true, target_at: at(21).toISOString() },
    { id: 'sooner', title: 'Standup', category: 'routine', target_at: at(11).toISOString() },
  ]);

  const widget = countdowns.selectWidgetToday(payload);
  assert.equal(widget.next.title, 'Standup');
  assert.equal(widget.nextIsLater, false);
});

test('overdue leads even when something later today is pinned', () => {
  const now = at(15);
  const payload = build(now, [
    { id: 'pinned', title: 'Standup', category: 'routine', pinned: true, target_at: at(17).toISOString() },
    { id: 'late', title: 'Rent due', category: 'deadline', target_at: at(9).toISOString() },
  ]);

  const widget = countdowns.selectWidgetToday(payload);
  assert.equal(widget.next.title, 'Rent due');
  assert.equal(widget.next.overdue, true);
});

test('nothing anywhere is null, not a fabricated row', () => {
  const widget = countdowns.selectWidgetToday(build(at(9), []));
  assert.equal(widget.next, null);
  assert.deepEqual(widget.items, []);
  assert.equal(widget.total, 0);
});

test('the list is capped, and the total still reports the truth', () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    id: `c-${index}`,
    title: `Thing ${index}`,
    category: 'routine',
    target_at: at(10 + Math.floor(index / 3), (index % 3) * 15).toISOString(),
  }));
  const payload = build(at(9), rows);

  assert.equal(countdowns.selectWidgetToday(payload).items.length, 6, 'default cap');
  assert.equal(countdowns.selectWidgetToday(payload, { limit: 3 }).items.length, 3);
  assert.equal(countdowns.selectWidgetToday(payload, { limit: 999 }).items.length, 12, 'capped at 20');
  assert.equal(countdowns.selectWidgetToday(payload).total, 12, 'total is the real count');
});

test('a row carries what a card draws and nothing else', () => {
  const payload = build(at(9), [{
    id: 'a',
    title: 'Rent due',
    category: 'deadline',
    target_at: at(23).toISOString(),
    next_action: 'Send the transfer',
    notes: 'PRIVATE NOTE THAT SHOULD NOT TRAVEL',
  }]);

  const widget = countdowns.selectWidgetToday(payload);
  assert.deepEqual(Object.keys(widget.items[0]).sort(), [
    'categoryLabel', 'color', 'id', 'inProgress', 'kind', 'nextAction',
    'occurrenceAt', 'overdue', 'remaining', 'remainingMs', 'title', 'urgent',
  ]);
  assert.equal(JSON.stringify(widget).includes('PRIVATE NOTE'), false);
  assert.equal(widget.items[0].nextAction, 'Send the transfer');
});

test('only today reaches the list — the other buckets stay behind', () => {
  const payload = build(at(9), [
    { id: 'today', title: 'Today thing', category: 'routine', target_at: at(20).toISOString() },
    { id: 'week', title: 'Week thing', category: 'routine', target_at: on(13, 10).toISOString() },
    { id: 'later', title: 'Later thing', category: 'goal', target_at: on(30, 10).toISOString() },
  ]);

  const widget = countdowns.selectWidgetToday(payload);
  assert.deepEqual(widget.items.map(item => item.title), ['Today thing']);
  assert.equal(JSON.stringify(widget.items).includes('Week thing'), false);
  assert.equal(JSON.stringify(widget.items).includes('Later thing'), false);
});

// ─── The route ───────────────────────────────────────────────────────────────

async function startServer() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-widgets-'));

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
  return { ...server, scratch };
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

test('GET /api/widgets/today rejects anonymous access', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  const response = await fetch(`${server.origin}/api/widgets/today`);
  assert.equal(response.status, 401);
});

test('GET /api/widgets/today answers with correct machine auth', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  const response = await fetch(`${server.origin}/api/widgets/today`, {
    headers: { Authorization: `Bearer ${SHORTCUTS_TOKEN}` },
  });
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.match(payload.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(payload.timezone, 'UTC');
  assert.ok(Array.isArray(payload.items));
  assert.ok(Array.isArray(payload.events));
  assert.ok(Array.isArray(payload.calendarCountdowns));
  assert.equal(typeof payload.calendar, 'string');
  assert.equal(typeof payload.total, 'number');
  assert.ok('next' in payload);
});

test('a countdown created today shows up as next up', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  const cookie = await unlock(server.origin);
  const target = new Date();
  // This server uses UTC. Keep the fixture on today even in late-night CI;
  // adding two hours can put it in tomorrow's bucket, whose today total is 0.
  target.setUTCHours(12, 0, 0, 0);

  const created = await fetch(`${server.origin}/api/countdowns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      title: 'Rent due',
      category: 'deadline',
      target_at: target.toISOString(),
      next_action: 'Send the transfer',
      notes: 'PRIVATE NOTE THAT SHOULD NOT TRAVEL',
    }),
  });
  assert.equal(created.status, 201);

  const response = await fetch(`${server.origin}/api/widgets/today`, {
    headers: { Authorization: `Bearer ${SHORTCUTS_TOKEN}` },
  });
  const payload = await response.json();

  assert.equal(payload.next.title, 'Rent due');
  assert.equal(payload.next.nextAction, 'Send the transfer');
  assert.ok(payload.total >= 1);

  // The note was stored, and did not travel.
  const body = await (await fetch(`${server.origin}/api/widgets/today`, {
    headers: { Authorization: `Bearer ${SHORTCUTS_TOKEN}` },
  })).text();
  assert.equal(body.includes('PRIVATE NOTE'), false);
});

test('the widget includes the same countdown and timer markers as the calendar day', async t => {
  const server = await startServer();
  t.after(() => stop(server));
  const cookie = await unlock(server.origin);
  const call = (pathname, options = {}) => fetch(`${server.origin}${pathname}`, {
    ...options,
    headers: { Cookie: cookie, ...(options.headers || {}) },
  });
  // The server is pinned to UTC; construct its complete day explicitly rather
  // than depending on the test runner's local timezone.
  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);
  const yesterday = new Date(from);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const created = await call('/api/countdowns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Daily morning routine', target_at: yesterday.toISOString(), repeat: 'daily', notes: 'PRIVATE NOTE',
    }),
  });
  assert.equal(created.status, 201);
  const saved = await call('/api/reset-timers', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{
      id: 'reading-timer', title: 'Reading timer',
      resetAt: new Date(to.getTime() - 60000).toISOString(),
      webhookUrl: 'https://api.pushcut.io/PRIVATE-WEBHOOK/notifications/Reading',
    }] }),
  });
  assert.equal(saved.status, 200);

  const response = await fetch(`${server.origin}/api/widgets/today?limit=1`, {
    headers: { Authorization: `Bearer ${SHORTCUTS_TOKEN}` },
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  const day = await (await call(`/api/calendar/countdowns?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)).json();
  assert.deepEqual(payload.calendarCountdowns.map(item => item.id), day.items.map(item => item.id));
  assert.deepEqual(payload.calendarCountdowns.map(item => item.kind).sort(), ['countdown', 'resetTimer']);
  assert.equal(payload.calendarCountdowns[0].state, 'passed');
  assert.equal(payload.items.length <= 1, true, 'the separate next-up limit still applies');
  assert.equal(JSON.stringify(payload).includes('PRIVATE NOTE'), false);
  assert.equal(JSON.stringify(payload).includes('PRIVATE-WEBHOOK'), false);
});

test('the widget does not answer writes', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  const response = await fetch(`${server.origin}/api/widgets/today`, { method: 'POST' });
  assert.equal(response.status, 405);
});
