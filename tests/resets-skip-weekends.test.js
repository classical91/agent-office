'use strict';

// A Countdown Timer can skip weekends: an occurrence that would land on a
// Saturday or a Sunday lands on the Monday instead, and the repeat starts again
// from there. The page, the server's Pushcut processor and the Calendar all
// step a timer forward, so these tests hold that they agree.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const DIST = path.join(__dirname, '..', 'agent-office-deploy', 'dist');
const read = name => fs.readFileSync(path.join(DIST, name), 'utf8');
const rotation = require(path.join(DIST, 'timer-rotation.js'));
const resetTimers = require(path.join(DIST, 'reset-timers.js'));
const calendarCountdowns = require(path.join(DIST, 'calendar-countdowns.js'));

const context = { Date, console, setInterval, clearInterval };
context.window = context;
vm.runInNewContext(read('happy-hour.js'), context);
vm.runInNewContext(read('timer-rotation.js'), context);
vm.runInNewContext(read('resets.js'), context);
const {
  cardHtml, draftFrom, landingFor, monthCharges, normalizeCard, viewOf, whenLabel, yesterdayItems,
} = context.window.AOResets;

// October 2026: Fri 23, Sat 24, Sun 25, Mon 26. November 1st is a Sunday.
const local = (y, m, d, h = 9) => new Date(y, m, d, h, 0, 0).toISOString();
const day = iso => new Date(iso).toDateString();
const plain = value => JSON.parse(JSON.stringify(value));

function walk(timer, count) {
  const seen = [];
  let current = timer;
  for (let i = 0; i < count; i += 1) {
    current = { ...current, ...rotation.followingOccurrence(current) };
    seen.push(day(current.resetAt));
  }
  return seen;
}

test('a daily timer that skips weekends goes from Friday to Monday', () => {
  const next = rotation.followingOccurrence({ resetAt: local(2026, 9, 23), repeatDays: 1, skipWeekends: true });
  assert.equal(next.resetAt, local(2026, 9, 26), 'Monday, at the same time');
  assert.equal(next.shiftedFrom, local(2026, 9, 24), 'and it says it was due on Saturday');
});

test('without the option a timer still lands on the weekend', () => {
  const next = rotation.followingOccurrence({ resetAt: local(2026, 9, 23), repeatDays: 1 });
  assert.deepEqual(next, { resetAt: local(2026, 9, 24), shiftedFrom: '' });
});

test('an every-3-days timer restarts its count from Monday', () => {
  assert.deepEqual(walk({ resetAt: local(2026, 9, 22), repeatDays: 3, skipWeekends: true }, 3), [
    'Mon Oct 26 2026', // due Sunday the 25th
    'Thu Oct 29 2026', // three days on from Monday, not from Sunday
    'Mon Nov 02 2026', // due Sunday the 1st
  ]);
});

test('a weekly Sunday timer becomes a Monday one', () => {
  assert.deepEqual(walk({ resetAt: local(2026, 9, 18), repeatDays: 7, skipWeekends: true }, 2),
    ['Mon Oct 26 2026', 'Mon Nov 02 2026']);
});

test('a monthly timer moved to Monday is back on its own day next month', () => {
  assert.deepEqual(walk({ resetAt: local(2026, 9, 1), repeatMonths: 1, skipWeekends: true }, 3),
    ['Mon Nov 02 2026', 'Tue Dec 01 2026', 'Fri Jan 01 2027']);
  // Christmas 2027 is a Saturday; 2028's is a Monday and stays on the 25th.
  assert.deepEqual(walk({ resetAt: local(2026, 11, 25), repeatMonths: 12, skipWeekends: true }, 2),
    ['Mon Dec 27 2027', 'Mon Dec 25 2028']);
});

test('a timer that fell behind catches up to a weekday', () => {
  const next = rotation.occurrenceAfter(
    { resetAt: local(2026, 8, 1), repeatDays: 1, skipWeekends: true },
    new Date(2026, 9, 23, 10).getTime()
  );
  assert.equal(day(next.resetAt), 'Mon Oct 26 2026');
  assert.equal(rotation.occurrenceAfter({ resetAt: local(2026, 8, 1), skipWeekends: true }, Date.now()), null,
    'a one-off stays where it is');
});

test('the Pushcut processor rolls a sent timer on to Monday', async () => {
  const outcome = await resetTimers.processDueTimers({
    timers: [{
      id: 'standup', title: 'Standup', status: 'active', resetAt: local(2026, 9, 23),
      repeatDays: 1, skipWeekends: true, webhookUrl: 'https://api.pushcut.io/secret/notifications/Standup',
    }],
    now: new Date(2026, 9, 23, 9, 1),
    send: async () => ({ ok: true, status: 200 }),
  });
  const { patch } = outcome.updates[0];
  assert.equal(patch.resetAt, local(2026, 9, 26));
  assert.equal(patch.shiftedFrom, local(2026, 9, 24));
  assert.equal(patch.firedForResetAt, local(2026, 9, 23), 'Friday is the one that was sent');
});

test('the Calendar draws a weekday timer on weekdays only', () => {
  const items = calendarCountdowns.timerOccurrences(
    { id: 'standup', title: 'Standup', resetAt: local(2026, 9, 22), repeatDays: 1, skipWeekends: true },
    { from: new Date(2026, 9, 22), to: new Date(2026, 9, 29) },
    new Date(2026, 9, 21)
  );
  assert.deepEqual(items.map(item => day(item.at)), [
    'Thu Oct 22 2026', 'Fri Oct 23 2026', 'Mon Oct 26 2026', 'Tue Oct 27 2026', 'Wed Oct 28 2026',
  ]);
  assert.equal(items[0].repeatLabel, 'Weekdays');

  const monthly = calendarCountdowns.timerOccurrences(
    { id: 'review', title: 'Review', resetAt: local(2026, 9, 1), repeatMonths: 1, skipWeekends: true },
    { from: new Date(2026, 9, 1), to: new Date(2027, 0, 31) },
    new Date(2026, 8, 30)
  );
  assert.deepEqual(monthly.map(item => day(item.at)),
    ['Thu Oct 01 2026', 'Mon Nov 02 2026', 'Tue Dec 01 2026', 'Fri Jan 01 2027']);
  assert.equal(monthly[0].repeatLabel, 'Monthly, skipping weekends');
});

test('a rotation moves one entry per weekday, not per calendar day', () => {
  const timer = {
    rotation: ['Ebook', 'Audiobook', 'Summary'], rotationAnchor: local(2026, 9, 23),
    repeatDays: 1, skipWeekends: true,
  };
  assert.equal(rotation.currentRotation({ ...timer, resetAt: local(2026, 9, 23) }), 'Ebook');
  assert.equal(rotation.currentRotation({ ...timer, resetAt: local(2026, 9, 26) }), 'Audiobook');
  assert.equal(rotation.currentRotation({ ...timer, resetAt: local(2026, 9, 27) }), 'Summary');

  const monthly = {
    rotation: ['Ebook', 'Audiobook', 'Summary'], rotationAnchor: local(2026, 9, 31),
    repeatMonths: 1, skipWeekends: true,
  };
  // The 31st is a Saturday and lands on Monday, November 2nd — still October's.
  assert.equal(rotation.currentRotation({ ...monthly, resetAt: local(2026, 10, 2), shiftedFrom: local(2026, 9, 31) }), 'Ebook');
  assert.equal(rotation.currentRotation({ ...monthly, resetAt: local(2026, 10, 30) }), 'Audiobook');
});

test('the card carries the option and says when the weekend moved it', () => {
  const card = normalizeCard({
    id: 'standup', title: 'Standup', resetAt: local(2030, 0, 7), repeatDays: 1,
    skipWeekends: true, shiftedFrom: local(2030, 0, 5),
  }, 0);
  assert.equal(card.skipWeekends, true);
  assert.equal(card.shiftedFrom, local(2030, 0, 5));
  assert.match(cardHtml(viewOf(card)), /data-field="skipWeekends" checked/);
  assert.match(whenLabel(viewOf(card)), /moved from Sat$/);

  const plainCard = normalizeCard({ id: 'plain', title: 'Plain', resetAt: local(2030, 0, 7) }, 0);
  assert.equal(plainCard.skipWeekends, false);
  assert.doesNotMatch(cardHtml(viewOf(plainCard)), /data-field="skipWeekends" checked/);
  assert.doesNotMatch(whenLabel(viewOf(plainCard)), /moved/);
});

test('saving a weekend time lands it on Monday, and re-saving keeps where it came from', () => {
  const fields = { title: 'Review', date: '2026-10-31', time: '09:00', repeatDays: '-1', skipWeekends: true };
  const node = {
    querySelector(selector) {
      const name = /data-field="([^"]+)"/.exec(selector)[1];
      if (!(name in fields)) return null;
      return name === 'skipWeekends' ? { checked: fields[name] } : { value: String(fields[name]) };
    },
  };
  const draft = draftFrom(node);
  assert.equal(draft.skipWeekends, true);

  const card = normalizeCard({ id: 'review', title: 'Review', resetAt: local(2026, 9, 30), repeatMonths: 1 }, 0);
  assert.deepEqual(plain(landingFor(card, draft)),
    { resetAt: local(2026, 10, 2), shiftedFrom: local(2026, 9, 31) });

  const moved = { ...card, resetAt: local(2026, 10, 2), shiftedFrom: local(2026, 9, 31), skipWeekends: true };
  const untouched = { ...draft, resetAt: local(2026, 10, 2) };
  assert.deepEqual(plain(landingFor(moved, untouched)),
    { resetAt: local(2026, 10, 2), shiftedFrom: local(2026, 9, 31) },
    'the 31st survives a save that did not change the time');
  assert.deepEqual(plain(landingFor(moved, { ...untouched, skipWeekends: false })),
    { resetAt: local(2026, 10, 2), shiftedFrom: '' }, 'turning it off keeps the time on screen');
});

test('a weekday bill is charged on weekdays only', () => {
  const lunch = normalizeCard({
    id: 'lunch', title: 'Lunch', resetAt: local(2026, 9, 16, 12), repeatDays: 1,
    skipWeekends: true, cost: 12, category: 'subscriptions-bills',
  }, 0);
  assert.equal(monthCharges(lunch, new Date(2026, 9, 15, 13)).length, 22, 'October 2026 has 22 weekdays');
  assert.equal(monthCharges({ ...lunch, skipWeekends: false }, new Date(2026, 9, 15, 13)).length, 31);

  // Due Saturday the 31st, charged Monday November 2nd.
  const rent = normalizeCard({
    id: 'rent', title: 'Rent', resetAt: local(2026, 10, 2), shiftedFrom: local(2026, 9, 31),
    repeatMonths: 1, skipWeekends: true, cost: 900, category: 'subscriptions-bills',
  }, 0);
  assert.equal(monthCharges(rent, new Date(2026, 9, 20)).length, 0, 'nothing goes out in October');
  assert.deepEqual(plain(monthCharges(rent, new Date(2026, 10, 1, 12)).map(charge => day(charge.at))),
    ['Mon Nov 02 2026', 'Mon Nov 30 2026']);
});

test('Yesterday lists a weekday timer where it landed', () => {
  const standup = when => normalizeCard({
    id: 'standup', title: 'Standup', status: 'active', resetAt: when, repeatDays: 1, skipWeekends: true,
  }, 0);
  const titles = (card, now) => yesterdayItems([card], now).map(item => day(item.at));

  assert.deepEqual(titles(standup(local(2026, 9, 27)), new Date(2026, 9, 26, 12)), [], 'nothing on Sunday');
  assert.deepEqual(titles(standup(local(2026, 9, 28)), new Date(2026, 9, 27, 12)), ['Mon Oct 26 2026'],
    'Monday, once');

  // Due Sunday November 1st, landed Monday the 2nd, and rolled on to December.
  const review = normalizeCard({
    id: 'review', title: 'Review', status: 'active', resetAt: local(2026, 11, 1),
    repeatMonths: 1, skipWeekends: true,
  }, 0);
  assert.deepEqual(titles(review, new Date(2026, 10, 3, 12)), ['Mon Nov 02 2026']);
});

test('the new countdown form offers the option', () => {
  assert.match(read('countdowns.html'), /id="rst-new-skip-weekends"/);
});
