'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { parseReminderTime, parseDurationMs, describeReminder } = require(
  path.join(__dirname, '..', 'agent-office-deploy', 'dist', 'reminder-time.js')
);

// Wednesday 2026-08-05, 14:30 local.
const NOW = new Date(2026, 7, 5, 14, 30, 0, 0);

function parse(value, now = NOW) {
  const result = parseReminderTime(value, { now });
  assert.equal(result.ok, true, `expected ${JSON.stringify(value)} to parse: ${result.error}`);
  return result.at;
}

function localParts(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()];
}

test('an empty reminder clears rather than failing', () => {
  assert.deepEqual(parseReminderTime('', { now: NOW }), { ok: true, at: null });
  assert.deepEqual(parseReminderTime(null, { now: NOW }), { ok: true, at: null });
  assert.deepEqual(parseReminderTime('  none ', { now: NOW }), { ok: true, at: null });
});

test('durations are read relative to now', () => {
  assert.equal(parse('in 30m').getTime(), NOW.getTime() + 30 * 60000);
  assert.equal(parse('45 minutes').getTime(), NOW.getTime() + 45 * 60000);
  assert.equal(parse('2h').getTime(), NOW.getTime() + 2 * 3600000);
  assert.equal(parse('1h 30m').getTime(), NOW.getTime() + 90 * 60000);
  assert.equal(parse('3 days').getTime(), NOW.getTime() + 3 * 86400000);
  assert.equal(parse('+1w').getTime(), NOW.getTime() + 7 * 86400000);
  assert.equal(parse('now').getTime(), NOW.getTime());
});

test('a duration only counts when the whole phrase is one', () => {
  assert.equal(parseDurationMs('2 hours before the meeting'), null);
  assert.equal(parseDurationMs('2 potatoes'), null);
  assert.equal(parseDurationMs('90m'), 90 * 60000);
});

test('day words default to 9am and accept an explicit time', () => {
  assert.deepEqual(localParts(parse('tomorrow')), [2026, 8, 6, 9, 0]);
  assert.deepEqual(localParts(parse('tomorrow 9am')), [2026, 8, 6, 9, 0]);
  assert.deepEqual(localParts(parse('tomorrow at 5:45pm')), [2026, 8, 6, 17, 45]);
  assert.deepEqual(localParts(parse('today 6pm')), [2026, 8, 5, 18, 0]);
  assert.deepEqual(localParts(parse('tonight')), [2026, 8, 5, 20, 0]);
  assert.deepEqual(localParts(parse('next week')), [2026, 8, 12, 9, 0]);
});

test('weekday names roll forward to the next matching day', () => {
  // NOW is a Wednesday.
  assert.deepEqual(localParts(parse('friday')), [2026, 8, 7, 9, 0]);
  assert.deepEqual(localParts(parse('mon 8am')), [2026, 8, 10, 8, 0]);
  // The same weekday means a week out, never a time that has already passed.
  assert.deepEqual(localParts(parse('wednesday 9am')), [2026, 8, 12, 9, 0]);
  assert.deepEqual(localParts(parse('next wednesday')), [2026, 8, 12, 9, 0]);
});

test('a bare time picks the next occurrence', () => {
  assert.deepEqual(localParts(parse('6pm')), [2026, 8, 5, 18, 0]);
  assert.deepEqual(localParts(parse('9am')), [2026, 8, 6, 9, 0]);
  assert.deepEqual(localParts(parse('18:15')), [2026, 8, 5, 18, 15]);
});

test('ISO timestamps and epoch millis pass straight through', () => {
  assert.equal(parse('2026-09-01T12:00:00Z').toISOString(), '2026-09-01T12:00:00.000Z');
  assert.deepEqual(localParts(parse('2026-09-01 07:30')), [2026, 9, 1, 7, 30]);
  // A date with no time is a local day at the default hour, not midnight UTC.
  assert.deepEqual(localParts(parse('2026-09-01')), [2026, 9, 1, 9, 0]);
  assert.equal(parse(NOW.getTime() + 60000).getTime(), NOW.getTime() + 60000);
});

test('unreadable and absurd times are rejected with a usable message', () => {
  const gibberish = parseReminderTime('sometime-ish', { now: NOW });
  assert.equal(gibberish.ok, false);
  assert.match(gibberish.error, /tomorrow 9am/);

  const tooFar = parseReminderTime('in 4000 days', { now: NOW });
  assert.equal(tooFar.ok, false);
  assert.match(tooFar.error, /too far/);
});

test('describeReminder reports due state on both sides of now', () => {
  const soon = describeReminder(new Date(NOW.getTime() + 2 * 3600000), NOW);
  assert.equal(soon.due, false);
  assert.equal(soon.relative, 'in 2h');

  const late = describeReminder(new Date(NOW.getTime() - 90 * 60000), NOW);
  assert.equal(late.due, true);
  assert.equal(late.relative, '1h 30m overdue');

  assert.equal(describeReminder(null, NOW), null);
  assert.equal(describeReminder('not a date', NOW), null);
});
