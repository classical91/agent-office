'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const distDir = path.join(__dirname, '..', 'agent-office-deploy', 'dist');
const read = name => fs.readFileSync(path.join(distDir, name), 'utf8');

// resets.js reads the Happy Hour schedule off window.AOHappyHour, the same way
// the page does — happy-hour.js is a <script> ahead of it on resets.html and a
// require() in the server. Load it first here for the same reason.
// `window` points at the sandbox itself, as it does in a browser: happy-hour.js
// hangs its exports off the global, and resets.js reads them off `window`.
const context = { Date, console, setInterval, clearInterval };
context.window = context;
vm.runInNewContext(read('happy-hour.js'), context);
vm.runInNewContext(read('timer-rotation.js'), context);
vm.runInNewContext(read('resets.js'), context);
const {
  colorForView,
  happyHourDetails,
  happyHourMeal,
  happyHourShortcutTime,
  holidayCards,
  isDueSoon,
  dayUrgency,
  dayUrgencyLabel,
  isListView,
} = context.window.AOResets;

test('holiday countdowns use the Holidays filter and requested dates', () => {
  const cards = holidayCards();
  assert.deepEqual(Array.from(cards, card => card.title), [
    'Halloween',
    'Black Friday',
    'Christmas',
    "New Year's Day",
    "Valentine's Day",
  ]);
  assert.deepEqual(Array.from(cards, card => card.resetAt.slice(0, 10)), [
    '2026-10-31',
    '2026-11-27',
    '2026-12-25',
    '2027-01-01',
    '2027-02-14',
  ]);
  cards.forEach(card => {
    assert.equal(card.category, 'holidays');
    assert.equal(card.repeatMonths, 12);
  });
});

test('happy hour keeps only the meal name in the header shortcut', () => {
  assert.equal(happyHourMeal('50% off Fresh Appetizers'), 'Fresh Appetizers');
  assert.equal(happyHourMeal('50\u00a2 each Marinated Split Chicken Wings'), 'Marinated Split Chicken Wings');
});

test('happy hour lives in the header instead of the countdown list', () => {
  assert.equal(isListView({ card: { id: 'routine-happy-hour-daily' } }), false);
  assert.equal(isListView({ card: { id: 'ordinary-countdown' } }), true);
});

test('happy hour header uses a shorter timer label', () => {
  const view = {
    remaining: 60 * 60 * 1000,
    card: { happyHourPhase: 'open' },
  };
  assert.match(happyHourShortcutTime(view), /^Ends in /);
});

test('happy hour shows the correct Sunday deal before the heads-up', () => {
  const details = happyHourDetails(new Date(2026, 7, 9, 12, 0));
  assert.equal(details.phase, 'upcoming');
  assert.match(details.title, /Today.*50% off Burger Patties/);
  assert.equal(details.target.getHours(), 14);
  assert.equal(details.target.getMinutes(), 30);
});

test('happy hour counts to opening from 2:30 and closing after 3', () => {
  const starting = happyHourDetails(new Date(2026, 7, 10, 14, 45));
  assert.equal(starting.phase, 'starting');
  assert.equal(starting.target.getHours(), 15);
  assert.match(starting.title, /Marinated Chicken Kebobs/);

  const open = happyHourDetails(new Date(2026, 7, 12, 16, 0));
  assert.equal(open.phase, 'open');
  assert.equal(open.target.getHours(), 18);
  assert.match(open.title, /50.* each Marinated Split Chicken Wings/);
});

test('after closing, happy hour advances to tomorrow\'s deal and heads-up', () => {
  const details = happyHourDetails(new Date(2026, 7, 14, 19, 0));
  assert.equal(details.phase, 'tomorrow');
  assert.match(details.title, /Tomorrow.*50% off Burger Patties/);
  assert.equal(details.target.getDate(), 15);
  assert.equal(details.target.getHours(), 14);
  assert.equal(details.target.getMinutes(), 30);
});

test('due today is orange; tomorrow within 24h stays yellow', () => {
  const now = new Date(2026, 10, 12, 21, 0);
  const makeView = (day, hour, state = 'active') => {
    const at = new Date(2026, 10, day, hour, 0);
    return {
      state,
      remaining: at.getTime() - now.getTime(),
      card: { title: 'Claude reset', resetAt: at.toISOString() },
    };
  };
  const today = makeView(12, 23);
  const tomorrow = makeView(13, 7);
  const later = makeView(14, 8);
  const paused = makeView(12, 23, 'paused');
  const expired = makeView(12, 20, 'expired');

  assert.equal(dayUrgency(today, now), 'today');
  assert.equal(dayUrgency(tomorrow, now), 'tomorrow');
  assert.equal(dayUrgencyLabel('today'), 'Due today');
  assert.equal(dayUrgencyLabel('tomorrow'), 'Tomorrow · within 24h');
  assert.equal(colorForView(today, now), 'var(--orange)');
  assert.equal(colorForView(tomorrow, now), 'var(--yellow)');
  assert.equal(isDueSoon(tomorrow), true);
  assert.equal(dayUrgency(later, now), '');
  assert.equal(isDueSoon(later), false);
  assert.equal(dayUrgency(paused, now), '');
  assert.equal(dayUrgency(expired, now), '');
  assert.notEqual(colorForView(paused, now), 'var(--orange)');
});

test('tomorrow changes to today at local midnight without resetting its countdown', () => {
  const target = new Date(2026, 11, 1, 7, 0); // month boundary
  const before = new Date(2026, 10, 30, 23, 59);
  const after = new Date(2026, 11, 1, 0, 0);
  const view = now => ({
    state: 'active',
    remaining: target.getTime() - now.getTime(),
    card: { title: 'Morning reset', resetAt: target.toISOString() },
  });
  assert.equal(dayUrgency(view(before), before), 'tomorrow');
  assert.equal(dayUrgency(view(after), after), 'today');
  assert.equal(colorForView(view(before), before), 'var(--yellow)');
  assert.equal(colorForView(view(after), after), 'var(--orange)');
});

test('tomorrow does not get 24-hour urgency until its rolling window begins', () => {
  const target = new Date(2026, 10, 13, 8, 0);
  const before = new Date(2026, 10, 12, 7, 59);
  const onBoundary = new Date(2026, 10, 12, 8, 0);
  const view = now => ({
    state: 'active',
    remaining: target.getTime() - now.getTime(),
    card: { title: 'Tomorrow reset', resetAt: target.toISOString() },
  });
  assert.equal(dayUrgency(view(before), before), '');
  assert.equal(dayUrgency(view(onBoundary), onBoundary), 'tomorrow');
  assert.equal(colorForView(view(onBoundary), onBoundary), 'var(--yellow)');
});

test('countdowns have separate visible day badges that update during ticks', () => {
  const source = read('resets.js');
  const styles = read('resets.css');
  assert.equal((source.match(/data-role="day-urgency"/g) || []).length, 2);
  assert.match(source, /node\.dataset\.dayUrgency = day/);
  assert.match(source, /dayLabel\.textContent = dayUrgencyLabel\(day\)/);
  assert.match(styles, /\[data-day-urgency="today"\]/);
  assert.match(styles, /\[data-day-urgency="tomorrow"\]/);
});
