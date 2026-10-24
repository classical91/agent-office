'use strict';

// The Calendar's Countdowns layer: countdowns and Countdown Timers projected
// onto the dates they land, read-only, with no webhook URL in sight.

process.env.TZ = 'America/Vancouver';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');
const calendarCountdowns = require(path.join(DIST, 'calendar-countdowns.js'));

const PASSPHRASE = 'open-the-calendar-countdowns';
const WEBHOOK = 'https://api.pushcut.io/secret-token-abc/notifications/Reset';

// Wednesday, Oct 14 2026, 10:00 in Vancouver.
const NOW = new Date('2026-10-14T10:00:00-07:00');

function range(fromIso, toIso) {
  const parsed = calendarCountdowns.parseRange(fromIso, toIso, NOW);
  assert.ok(parsed.ok, parsed.error);
  return parsed;
}

function build(options) {
  return calendarCountdowns.buildCalendarCountdowns({ now: NOW, countdowns: [], timers: [], ...options });
}

function localDay(iso) {
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

test('a weekly countdown appears on every week in range, at the same local time across the DST change', () => {
  const { from, to } = range('2026-10-12T00:00:00-07:00', '2026-11-16T00:00:00-08:00');
  const payload = build({
    from,
    to,
    countdowns: [{ id: 'review', title: 'Weekly review', target_at: '2026-10-05T16:00:00.000Z', repeat: 'weekly', category: 'routine' }],
  });
  // Oct 5 9:00 PDT. Vancouver falls back on Nov 1, and the review stays at 9.
  assert.deepEqual(payload.items.map(item => localDay(item.at)), ['10/19 9:00', '10/26 9:00', '11/2 9:00', '11/9 9:00']);
  payload.items.forEach(item => {
    assert.equal(item.source, 'countdown');
    assert.equal(item.recordId, 'review');
    assert.equal(item.blocksTime, false);
    assert.equal(item.href, '/countdowns.html?open=review');
  });
  assert.equal(new Set(payload.items.map(item => item.id)).size, payload.items.length, 'occurrence ids are unique');
});

test('past occurrences of a repeating countdown are not drawn, but today is kept whole', () => {
  const { from, to } = range('2026-10-12T00:00:00-07:00', '2026-10-16T00:00:00-07:00');
  const payload = build({
    from,
    to,
    countdowns: [{ id: 'standup', title: 'Standup', target_at: '2026-10-01T15:00:00.000Z', repeat: 'daily' }],
  });
  // 8:00 daily. Mon/Tue are behind us; today's 8:00 has passed but stays on today.
  assert.deepEqual(payload.items.map(item => localDay(item.at)), ['10/14 8:00', '10/15 8:00']);
  assert.equal(payload.items[0].state, 'passed');
  assert.equal(payload.items[0].overdue, false);
});

test('an overdue one-off stays on its date as overdue and leads the upcoming list', () => {
  const { from, to } = range('2026-10-01T00:00:00-07:00', '2026-11-01T00:00:00-07:00');
  const payload = build({
    from,
    to,
    countdowns: [
      { id: 'tax', title: 'Tax filing', target_at: '2026-10-10T17:00:00-07:00', repeat: 'none' },
      { id: 'soon', title: 'Ship it', target_at: '2026-10-14T18:00:00-07:00', repeat: 'none' },
      { id: 'old', title: 'Archived', target_at: '2026-10-20T18:00:00-07:00', archived: true },
    ],
  });
  assert.deepEqual(payload.items.map(item => item.recordId), ['tax', 'soon']);
  assert.equal(payload.items[0].state, 'overdue');
  assert.equal(payload.items[1].state, 'soon');
  assert.deepEqual(payload.upcoming.map(item => item.recordId), ['tax', 'soon']);
});

test('weekday and trading countdowns skip the weekend, and monthly clamps to short months', () => {
  const { from, to } = range('2026-10-14T00:00:00-07:00', '2026-12-31T00:00:00-08:00');
  const payload = build({
    from,
    to,
    countdowns: [
      { id: 'open', title: 'Market open', target_at: '2026-10-14T06:30:00-07:00', repeat: 'daily', category: 'trading' },
      { id: 'rent', title: 'Rent', target_at: '2026-08-31T09:00:00-07:00', repeat: 'monthly' },
    ],
  });
  const trading = payload.items.filter(item => item.recordId === 'open');
  assert.ok(trading.length > 40);
  trading.forEach(item => {
    const day = new Date(item.at).getDay();
    assert.ok(day !== 0 && day !== 6, `${item.at} lands on a weekend`);
  });
  const rent = payload.items.filter(item => item.recordId === 'rent').map(item => localDay(item.at));
  // Same chained clamp the Countdowns page uses: Aug 31 → Sep 30 → Oct 30 …
  assert.deepEqual(rent, ['10/30 9:00', '11/30 9:00', '12/30 9:00']);
});

test('timers expand by days, carry their rotation entry, and never carry the webhook', () => {
  const { from, to } = range('2026-10-14T00:00:00-07:00', '2026-10-24T00:00:00-07:00');
  const payload = build({
    from,
    to,
    timers: [
      {
        id: 'reading',
        title: 'Read a book',
        resetAt: '2026-10-15T20:00:00-07:00',
        repeatDays: 3,
        rotation: ['Ebook', 'Audiobook', 'Summary'],
        rotationAnchor: '2026-10-15T20:00:00-07:00',
        webhookUrl: WEBHOOK,
        category: 'reading',
      },
      { id: 'paused', title: 'Paused one', resetAt: '2026-10-16T09:00:00-07:00', status: 'paused' },
      { id: 'gone', title: 'Deleted one', resetAt: '2026-10-16T09:00:00-07:00', deleted: true },
      { id: 'countdown-mirror', title: 'Mirror', resetAt: '2026-10-16T09:00:00-07:00', source: 'office' },
    ],
  });
  assert.deepEqual(payload.items.map(item => [localDay(item.at), item.rotation]), [
    ['10/15 20:00', 'Ebook'],
    ['10/18 20:00', 'Audiobook'],
    ['10/21 20:00', 'Summary'],
  ]);
  assert.equal(payload.items[0].source, 'timer');
  assert.equal(payload.items[0].categoryLabel, 'Reading');
  assert.equal(payload.items[0].repeatLabel, 'Every 3 days');
  assert.ok(!JSON.stringify(payload).includes('pushcut'), 'no webhook in the payload');
  assert.ok(!JSON.stringify(payload).includes('secret-token'), 'no webhook secret in the payload');

  const withInactive = build({ from, to, includeInactive: true, timers: [{ id: 'paused', title: 'Paused one', resetAt: '2026-10-16T09:00:00-07:00', status: 'paused' }] });
  assert.equal(withInactive.items.length, 1);
});

test('a countdown in a custom category keeps that category and its saved name', () => {
  const { from, to } = range('2026-10-14T00:00:00-07:00', '2026-10-21T00:00:00-07:00');
  const payload = build({
    from,
    to,
    categories: [{ id: 'house', label: 'House jobs', color: '#94a3b8' }],
    countdowns: [
      { id: 'gutters', title: 'Clear gutters', target_at: '2026-10-17T10:00:00-07:00', category: 'house' },
      { id: 'legacy', title: 'Shift', target_at: '2026-10-18T10:00:00-07:00', category: 'shift' },
    ],
  });
  assert.equal(payload.items[0].category, 'house');
  assert.equal(payload.items[0].categoryLabel, 'House jobs');
  assert.equal(payload.items[1].category, 'work');
});

test('the projection does not change the records it reads', () => {
  const { from, to } = range('2026-10-14T00:00:00-07:00', '2026-11-14T00:00:00-08:00');
  const countdowns = [{ id: 'c', title: 'C', target_at: '2026-09-01T16:00:00.000Z', repeat: 'weekly' }];
  const timers = [{ id: 't', title: 'T', resetAt: '2026-09-01T16:00:00.000Z', repeatDays: 2, webhookUrl: WEBHOOK }];
  const before = JSON.stringify({ countdowns, timers });
  build({ from, to, countdowns, timers });
  assert.equal(JSON.stringify({ countdowns, timers }), before);
});

test('the today widget matches the calendar day across DST, uncapped and including passed routines', () => {
  // This local day is 25 hours long. A rolling 24-hour cutoff drops 11:59 PM.
  const now = new Date('2025-11-02T12:00:00-08:00');
  const records = Array.from({ length: 23 }, (_, index) => ({
    id: `routine-${index}`,
    title: `Routine ${index}`,
    target_at: '2025-11-01T08:00:00-07:00',
    repeat: 'daily',
    notes: 'PRIVATE NOTE',
  }));
  records.push({ id: 'tomorrow', title: 'Tomorrow', target_at: '2025-11-03T00:00:00-08:00' });
  const timers = [
    { id: 'late', title: 'Late timer', resetAt: '2025-11-02T23:59:00-08:00', webhookUrl: WEBHOOK },
    { id: 'paused', title: 'Paused timer', resetAt: '2025-11-02T20:00:00-08:00', status: 'paused' },
  ];
  const widget = calendarCountdowns.selectTodayCountdowns({ now, countdowns: records, timers });
  const day = calendarCountdowns.buildCalendarCountdowns({
    now, countdowns: records, timers,
    from: new Date('2025-11-02T00:00:00-07:00'),
    to: new Date('2025-11-03T00:00:00-08:00'),
  });
  assert.equal(widget.length, 24, 'calendar rows are independent of the twenty-row next-up cap');
  assert.deepEqual(widget.map(item => item.id), day.items.map(item => item.id));
  assert.equal(widget[0].state, 'passed', 'a recurring morning item remains on today');
  assert.equal(widget.at(-1).title, 'Late timer');
  assert.equal(widget.at(-1).kind, 'resetTimer');
  assert.equal(widget[0].kind, 'countdown');
  assert.equal(widget[0].endAt, null, 'a marker does not claim a block of time');
  assert.equal(widget[0].allDay, false);
  assert.equal(JSON.stringify(widget).includes('PRIVATE NOTE'), false);
  assert.equal(JSON.stringify(widget).includes('secret-token'), false);
});

test('ranges must be ordered and bounded', () => {
  assert.equal(calendarCountdowns.parseRange('2026-10-14', '2026-10-01', NOW).ok, false);
  assert.equal(calendarCountdowns.parseRange('nope', '2026-10-01', NOW).ok, false);
  assert.equal(calendarCountdowns.parseRange('2026-01-01', '2026-12-31', NOW).ok, false);
  assert.equal(calendarCountdowns.parseRange(null, null, NOW).ok, true);
});

// ─── Against a real server ───────────────────────────────────────────────────

async function startServer() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-calendar-countdowns-'));
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
    };
    ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DROPS_PASSPHRASE_HASH', 'SHORTCUTS_TOKEN']
      .forEach(key => { delete environment[key]; });
    return environment;
  };
  const server = await startTestServer({ serverPath: SERVER_PATH, cwd: DIST, buildEnv });
  const unlocked = await fetch(`${server.origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  assert.equal(unlocked.status, 200);
  const cookie = String(unlocked.headers.get('set-cookie') || '').split(';')[0];
  return { ...server, scratch, cookie };
}

test('GET /api/calendar/countdowns is private, merges both stores and leaves them untouched', async t => {
  const server = await startServer();
  t.after(() => {
    server.child.kill();
    fs.rmSync(server.scratch, { recursive: true, force: true });
  });
  const call = (pathname, options = {}) => fetch(`${server.origin}${pathname}`, {
    ...options,
    headers: { Cookie: server.cookie, ...(options.headers || {}) },
  });

  assert.equal((await fetch(`${server.origin}/api/calendar/countdowns`)).status, 401);

  const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const created = await call('/api/countdowns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Quarterly filing', target_at: soon.toISOString(), category: 'deadline', next_action: 'Gather receipts' }),
  });
  assert.equal(created.status, 201);
  const countdown = await created.json();

  const timers = [{
    id: 'haircut',
    title: 'Haircut',
    resetAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    repeatDays: 21,
    webhookUrl: WEBHOOK,
    updatedAt: new Date().toISOString(),
  }];
  const saved = await call('/api/reset-timers', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: timers }),
  });
  assert.equal(saved.status, 200);
  const storedBefore = await (await call('/api/reset-timers')).text();
  const countdownsBefore = await (await call('/api/countdowns?events=0')).json();

  const from = new Date();
  const to = new Date(from.getTime() + 20 * 24 * 60 * 60 * 1000);
  const response = await call(`/api/calendar/countdowns?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.ok(!text.includes('pushcut'), 'the webhook URL never leaves the server');
  const payload = JSON.parse(text);
  assert.deepEqual(payload.items.map(item => item.source).sort(), ['countdown', 'timer']);
  const marker = payload.items.find(item => item.source === 'countdown');
  assert.equal(marker.recordId, countdown.id);
  assert.equal(marker.nextAction, 'Gather receipts');
  assert.equal(marker.blocksTime, false);
  assert.equal(payload.timezone, 'America/Vancouver');
  assert.equal(payload.upcoming.length, 2);

  // Reading the calendar wrote nothing to either store.
  assert.equal(await (await call('/api/reset-timers')).text(), storedBefore);
  const countdownsAfter = await (await call('/api/countdowns?events=0')).json();
  assert.deepEqual(countdownsAfter.items.map(item => item.updated_at), countdownsBefore.items.map(item => item.updated_at));

  assert.equal((await call('/api/calendar/countdowns?from=2026-10-14&to=2026-10-01')).status, 400);
});
