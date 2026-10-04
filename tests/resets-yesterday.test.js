'use strict';

// The Yesterday button on /countdowns.html lists the countdowns that landed the
// day before. A repeating card has already rolled past yesterday by the time
// anyone asks, so these tests hold that its earlier occurrences are still found.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const DIST = path.join(__dirname, '..', 'agent-office-deploy', 'dist');
const read = name => fs.readFileSync(path.join(DIST, name), 'utf8');

const context = { Date, console, setInterval, clearInterval };
context.window = context;
vm.runInNewContext(read('happy-hour.js'), context);
vm.runInNewContext(read('resets.js'), context);
const { normalizeCard, yesterdayItems } = context.window.AOResets;

const now = new Date(2026, 9, 4, 12, 0); // Sun Oct 4, noon local
const local = (day, hour) => new Date(2026, 9, day, hour, 0).toISOString();
const card = (overrides, index = 0) => normalizeCard({
  id: `c${index}`, title: `Card ${index}`, status: 'active', ...overrides,
}, index);
const titles = cards => yesterdayItems(cards, now).map(item => item.card.title);

test('a one-off that landed yesterday is listed, today and the day before are not', () => {
  const cards = [
    card({ title: 'Yesterday', resetAt: local(3, 9) }, 1),
    card({ title: 'Today', resetAt: local(4, 9) }, 2),
    card({ title: 'Two days ago', resetAt: local(2, 23) }, 3),
  ];
  assert.deepEqual(titles(cards), ['Yesterday']);
});

test('a daily card that rolled forward still shows its occurrence yesterday', () => {
  assert.deepEqual(titles([card({ title: 'Daily', resetAt: local(5, 8), repeatDays: 1 })]), ['Daily']);
});

test('a weekly card that did not land yesterday is not listed', () => {
  assert.deepEqual(titles([card({ title: 'Weekly', resetAt: local(6, 8), repeatDays: 7 })]), []);
});

test('paused cards, deleted cards and occurrences before the card existed are left out', () => {
  const cards = [
    card({ title: 'Paused', resetAt: local(3, 9), status: 'paused' }, 1),
    card({ title: 'Deleted', resetAt: local(3, 9), deleted: true }, 2),
    card({ title: 'New', resetAt: local(5, 8), repeatDays: 1, createdAt: new Date(2026, 9, 4, 6).getTime() }, 3),
  ];
  assert.deepEqual(titles(cards), []);
});

test('an office weekday countdown skips the weekend when stepping back', () => {
  // Monday's occurrence steps back to Friday, not to Saturday or Sunday.
  const office = card({ title: 'Weekday', resetAt: local(5, 9), repeatDays: 1, officeRepeat: 'weekday', source: 'office' });
  assert.deepEqual(titles([office]), []);
  const tuesday = new Date(2026, 9, 6, 12);
  assert.deepEqual(yesterdayItems([office], tuesday).map(item => item.card.title), ['Weekday']);
});

test('the countdowns page has a Yesterday button wired to the modal', () => {
  const html = read('countdowns.html');
  assert.match(html, /onclick="AOResets\.openYesterday\(this\)"/);
  assert.match(html, /id="rst-yesterday-modal"/);
});
