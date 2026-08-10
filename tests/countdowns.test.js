'use strict';

// The countdown arithmetic: when a card next comes due, how long that is, which
// of the three sections it lands in, and which cards the evening roll-up is
// allowed to nag about.

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const countdowns = require(path.join(__dirname, '..', 'agent-office-deploy', 'dist', 'countdowns.js'));

// A fixed Wednesday at 09:00 local, so "this week" and "the weekend" mean the
// same thing on every machine that runs this suite.
const WEDNESDAY = new Date(2026, 7, 12, 9, 0, 0);
const SATURDAY = new Date(2026, 7, 15, 9, 0, 0);

function at(date, hour = 9, minute = 0) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0).toISOString();
}

function make(overrides = {}) {
  return {
    id: 'countdown-1',
    title: 'Test countdown',
    target_at: at(WEDNESDAY, 17),
    category: 'deadline',
    repeat: 'none',
    next_action: '',
    notes: '',
    pinned: false,
    archived: false,
    ...overrides,
  };
}

test('a one-off keeps its target even once it is in the past', () => {
  const past = make({ target_at: at(new Date(2026, 7, 10), 12) });
  const occurrence = countdowns.nextOccurrence(past, WEDNESDAY);
  assert.equal(occurrence.toISOString(), past.target_at);

  const card = countdowns.decorateCountdown(past, WEDNESDAY);
  assert.equal(card.overdue, true);
  assert.equal(card.bucket, 'past');
  assert.match(card.remaining.label, /ago$/);
});

test('a weekly routine rolls forward to the next occurrence still ahead', () => {
  // Started five weeks ago on a Wednesday; the next one is today at 20:00.
  const routine = make({
    title: 'Instagram download review',
    repeat: 'weekly',
    category: 'routine',
    target_at: at(new Date(2026, 6, 8), 20),
  });
  const occurrence = countdowns.nextOccurrence(routine, WEDNESDAY);
  assert.equal(occurrence.getDay(), 3);
  assert.equal(occurrence.getHours(), 20);
  assert.equal(countdowns.decorateCountdown(routine, WEDNESDAY).bucket, 'today');
});

test('a biweekly routine rolls forward in 14-day steps', () => {
  const routine = make({
    title: 'Home cleaning',
    repeat: 'biweekly',
    category: 'routine',
    target_at: at(new Date(2026, 6, 29), 16),
  });
  const occurrence = countdowns.nextOccurrence(routine, new Date(2026, 7, 13, 9, 0, 0));
  assert.equal(occurrence.toISOString(), at(new Date(2026, 7, 26), 16));
});

test('monthly repeats clamp to the last day of a short month', () => {
  const monthly = make({ repeat: 'monthly', target_at: at(new Date(2026, 0, 31), 9) });
  const occurrence = countdowns.nextOccurrence(monthly, new Date(2026, 1, 10, 9, 0, 0));
  assert.equal(occurrence.getMonth(), 1);
  assert.equal(occurrence.getDate(), 28);
});

test('weekday routines and trading countdowns never land on a weekend', () => {
  // A daily-shaped routine started on a Friday: the next one is Monday, not
  // Saturday.
  const weekday = make({ repeat: 'weekday', target_at: at(new Date(2026, 7, 7), 8) });
  const nextWeekday = countdowns.nextOccurrence(weekday, new Date(2026, 7, 7, 12, 0, 0));
  assert.equal(nextWeekday.getDay(), 1, 'weekday routine skipped to Monday');

  const trading = make({ category: 'trading', repeat: 'daily', target_at: at(new Date(2026, 7, 7), 6, 30) });
  const nextTrade = countdowns.nextOccurrence(trading, new Date(2026, 7, 7, 12, 0, 0));
  assert.equal(nextTrade.getDay(), 1, 'trading countdown skipped the closed market');
});

test('trading countdowns go quiet on the weekend instead of urgent', () => {
  const trading = make({ category: 'trading', repeat: 'none', target_at: at(SATURDAY, 18) });

  const onSaturday = countdowns.decorateCountdown(trading, SATURDAY);
  assert.equal(onSaturday.weekendQuiet, true);
  assert.equal(onSaturday.urgent, false, 'a weekend trading card never shouts');
  assert.equal(onSaturday.bucket, 'today', 'it is still shown, just not urgent');

  // The same card on a weekday is ordinary again.
  const deadline = countdowns.decorateCountdown(make({ target_at: at(WEDNESDAY, 18) }), WEDNESDAY);
  assert.equal(deadline.weekendQuiet, false);
  assert.equal(deadline.urgent, true);
});

test('remaining time shrinks its unit as the gap closes', () => {
  assert.equal(countdowns.describeRemaining(3 * 86400000).label, '3 days');
  assert.equal(countdowns.describeRemaining(2 * 3600000 + 30 * 60000).label, '2 hrs 30 mins');
  assert.equal(countdowns.describeRemaining(45 * 60000).label, '45 mins');
  assert.equal(countdowns.describeRemaining(0).label, 'now');
  assert.equal(countdowns.describeRemaining(-90 * 60000).label, '1 hr 30 mins ago');
});

test('buckets split into today, this week and later', () => {
  assert.equal(countdowns.bucketFor(new Date(2026, 7, 12, 23, 30), WEDNESDAY), 'today');
  assert.equal(countdowns.bucketFor(new Date(2026, 7, 14, 9, 0), WEDNESDAY), 'week');
  assert.equal(countdowns.bucketFor(new Date(2026, 7, 18, 9, 0), WEDNESDAY), 'week');
  assert.equal(countdowns.bucketFor(new Date(2026, 7, 30, 9, 0), WEDNESDAY), 'later');
  assert.equal(countdowns.bucketFor(new Date(2026, 7, 1, 9, 0), WEDNESDAY), 'past');
});

test('buildUpcoming groups countdowns and calendar events together', () => {
  const payload = countdowns.buildUpcoming({
    now: WEDNESDAY,
    countdowns: [
      make({ id: 'a', title: 'Tax filing', target_at: at(WEDNESDAY, 17) }),
      make({ id: 'b', title: 'Quarterly goal', target_at: at(new Date(2026, 8, 30), 9) }),
      make({ id: 'c', title: 'Archived thing', archived: true, target_at: at(WEDNESDAY, 18) }),
    ],
    events: [
      { id: 'evt-1', title: 'Shift at the shop', start: at(new Date(2026, 7, 14), 8), end: at(new Date(2026, 7, 14), 16) },
      { id: 'evt-old', title: 'Yesterday', start: at(new Date(2026, 7, 11), 8), end: at(new Date(2026, 7, 11), 9) },
    ],
  });

  assert.deepEqual(payload.groups.today.map(item => item.title), ['Tax filing']);
  assert.deepEqual(payload.groups.week.map(item => item.title), ['Shift at the shop']);
  assert.deepEqual(payload.groups.later.map(item => item.title), ['Quarterly goal']);
  assert.equal(payload.counts.countdowns, 2, 'the archived countdown is left out');
  assert.equal(payload.counts.events, 1, 'a finished event is left out');
  assert.equal(payload.groups.week[0].kind, 'event');
});

test('an event that has started but not finished counts as in progress', () => {
  const payload = countdowns.buildUpcoming({
    now: WEDNESDAY,
    countdowns: [],
    events: [{ id: 'evt-now', title: 'Morning shift', start: at(WEDNESDAY, 8), end: at(WEDNESDAY, 16) }],
  });
  const card = payload.groups.today[0];
  assert.equal(card.inProgress, true);
  assert.equal(card.overdue, false);
});

test('overdue work leads Today and pinned cards lead their section', () => {
  const payload = countdowns.buildUpcoming({
    now: WEDNESDAY,
    countdowns: [
      make({ id: 'later-today', title: 'Later today', target_at: at(WEDNESDAY, 22) }),
      make({ id: 'pinned', title: 'Pinned', pinned: true, target_at: at(WEDNESDAY, 23) }),
      make({ id: 'overdue', title: 'Overdue', target_at: at(new Date(2026, 7, 9), 9) }),
    ],
    events: [],
  });
  assert.deepEqual(payload.groups.today.map(item => item.title), ['Overdue', 'Pinned', 'Later today']);
  assert.equal(payload.counts.overdue, 1);
});

test('the roll-up skips quiet trading cards and anything further out', () => {
  const payload = countdowns.buildUpcoming({
    now: SATURDAY,
    countdowns: [
      make({ id: 'trade', title: 'Open the position', category: 'trading', target_at: at(SATURDAY, 18) }),
      make({ id: 'due', title: 'Renew insurance', next_action: 'Call the broker', target_at: at(new Date(2026, 7, 17), 10) }),
      make({ id: 'far', title: 'Passport renewal', target_at: at(new Date(2026, 9, 1), 9) }),
    ],
    events: [],
  });

  const selected = countdowns.selectRollupItems(payload, 5);
  assert.deepEqual(selected.map(item => item.title), ['Renew insurance']);

  const text = countdowns.formatRollupText(payload, 5);
  assert.match(text, /^Countdowns — /);
  assert.match(text, /• Renew insurance \(2 days/);
  assert.match(text, /→ Call the broker/);
  assert.doesNotMatch(text, /Open the position/, 'no weekend trade pressure in the roll-up');
});

test('the roll-up says so when there is nothing to say', () => {
  const payload = countdowns.buildUpcoming({ now: WEDNESDAY, countdowns: [], events: [] });
  assert.equal(countdowns.formatRollupText(payload).split('\n')[1], 'Nothing due in the next week.');
});

test('input validation holds the line on titles and dates', () => {
  assert.equal(countdowns.validateCountdownInput({ title: '', target_at: at(WEDNESDAY) }).ok, false);
  assert.equal(countdowns.validateCountdownInput({ title: 'x', target_at: 'not a date' }).ok, false);
  assert.equal(countdowns.validateCountdownInput('nope').ok, false);
  assert.equal(countdowns.validateCountdownInput({ pinned: true }, true).ok, true);
  assert.equal(countdowns.validateCountdownInput({}, true).ok, false, 'an empty patch is a mistake, not a no-op');

  const built = countdowns.validateCountdownInput({
    title: '  Renew insurance  ',
    target_at: at(WEDNESDAY, 10),
    category: 'nonsense',
    repeat: 'fortnightly',
  });
  assert.equal(built.ok, true);
  assert.equal(built.value.title, 'Renew insurance');
  assert.equal(built.value.category, 'deadline', 'an unknown category falls back rather than 400s');
  assert.equal(built.value.repeat, 'none');
});
