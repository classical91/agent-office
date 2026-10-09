'use strict';

// A repeating Countdown Timer can cycle through a list — a reading slot that
// alternates Ebook, Audiobook and Summary. Which entry is up is counted from
// the dates, so the card on the page and the Pushcut notification the server
// sends name the same one whoever rolled the timer forward.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const DIST = path.join(__dirname, '..', 'agent-office-deploy', 'dist');
const read = name => fs.readFileSync(path.join(DIST, name), 'utf8');
const rotation = require(path.join(DIST, 'timer-rotation.js'));
const resetTimers = require(path.join(DIST, 'reset-timers.js'));

const context = { Date, console, setInterval, clearInterval };
context.window = context;
vm.runInNewContext(read('happy-hour.js'), context);
vm.runInNewContext(read('timer-rotation.js'), context);
vm.runInNewContext(read('resets.js'), context);
const { cardHtml, normalizeCard, viewOf } = context.window.AOResets;

const BOOKS = ['Ebook', 'Audiobook', 'Summary'];
const local = (y, m, d, h = 9) => new Date(y, m, d, h, 0, 0).toISOString();

test('a typed list is split on commas and trimmed', () => {
  assert.deepEqual(rotation.normalizeRotation(' Ebook, Audiobook ,, Summary '), BOOKS);
  assert.deepEqual(rotation.normalizeRotation(['Ebook', '', 7, 'Summary']), ['Ebook', 'Summary']);
  assert.deepEqual(rotation.normalizeRotation(undefined), []);
});

test('each occurrence of an every-3-days timer moves one entry along, and wraps', () => {
  const anchor = local(2026, 9, 1);
  const at = day => rotation.currentRotation({
    rotation: BOOKS, rotationAnchor: anchor, resetAt: local(2026, 9, day), repeatDays: 3,
  });
  assert.equal(at(1), 'Ebook');
  assert.equal(at(4), 'Audiobook');
  assert.equal(at(7), 'Summary');
  assert.equal(at(10), 'Ebook');
});

test('a daylight-saving change does not knock the rotation out of step', () => {
  // Vancouver falls back on Nov 1 2026; a local 9 AM a day later is 25 hours on.
  const entry = rotation.currentRotation({
    rotation: BOOKS, rotationAnchor: local(2026, 9, 31), resetAt: local(2026, 10, 2), repeatDays: 2,
  });
  assert.equal(entry, 'Audiobook');
});

test('monthly timers count months, not days', () => {
  const entry = rotation.currentRotation({
    rotation: BOOKS, rotationAnchor: local(2026, 0, 31), resetAt: local(2026, 2, 31), repeatMonths: 1,
  });
  assert.equal(entry, 'Summary');
});

test('a timer without a list has no rotation', () => {
  assert.equal(rotation.currentRotation({ resetAt: local(2026, 9, 1), repeatDays: 3 }), '');
});

test('the card says which entry is up next', () => {
  const resetAt = new Date(Date.now() + 3 * 86400000).toISOString();
  const card = normalizeCard({
    id: 'reading', title: 'Read a book', resetAt, repeatDays: 3,
    rotation: 'Ebook, Audiobook, Summary',
  }, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(card.rotation)), BOOKS);
  assert.equal(card.rotationAnchor, resetAt, 'a list without an anchor starts where the timer is');

  const markup = cardHtml(viewOf({ ...card, rotationAnchor: new Date(Date.parse(resetAt) - 3 * 86400000).toISOString() }));
  assert.match(markup, /data-role="rotation">Up next: Audiobook</);
  assert.match(markup, /data-field="rotation"[\s\S]*value="Ebook, Audiobook, Summary"/);
});

test('a card without a list shows no rotation line', () => {
  const card = normalizeCard({ id: 'plain', title: 'Plain', resetAt: local(2030, 0, 1) }, 0);
  assert.equal(card.rotationAnchor, '');
  assert.doesNotMatch(cardHtml(viewOf(card)), /data-role="rotation"/);
});

test('the Pushcut notification and the Shortcut text name the entry', () => {
  const timer = resetTimers.normalizeTimer({
    id: 'reading', title: 'Read a book', resetAt: local(2026, 9, 7), repeatDays: 3,
    rotation: BOOKS, rotationAnchor: local(2026, 9, 1),
  });
  const items = resetTimers.selectShortcutTimers([timer], { state: 'all', now: new Date(2026, 9, 6) });
  assert.equal(items[0].rotation, 'Summary');
  assert.match(resetTimers.formatShortcutText(items, 'all'), /• Read a book \(Summary\) — /);
  assert.equal(resetTimers.notificationPayload(timer).text, 'Read a book — the countdown has landed. This time: Summary.');
});

test('countdowns.html loads the rotation before the page that reads it', () => {
  const html = read('countdowns.html');
  const rotationAt = html.indexOf('<script src="timer-rotation.js');
  const page = html.indexOf('<script src="resets.js');
  assert.ok(rotationAt !== -1, 'countdowns.html does not load timer-rotation.js');
  assert.ok(rotationAt < page, 'timer-rotation.js must load before resets.js');
});
