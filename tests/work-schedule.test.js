'use strict';

// The work schedule's rules, without a server.
//
// The one that earns its place: an overnight shift. 21:00-05:00 read literally
// is an end before its start, which the scheduler drops - and a dropped shift
// is not a gap in the record, it is a night the week gets planned straight over.

const assert = require('node:assert/strict');
const test = require('node:test');

const workSchedule = require('../agent-office-deploy/dist/work-schedule.js');

function schedule(shifts, extra = {}) {
  return workSchedule.normalizeSchedule({ shifts, ...extra });
}

test('a shift needs days and both ends of its hours', () => {
  assert.ok(workSchedule.normalizeShift({ days: [1], start: '12:30', end: '21:00' }));
  assert.equal(workSchedule.normalizeShift({ days: [], start: '12:30', end: '21:00' }), null);
  assert.equal(workSchedule.normalizeShift({ days: [1], start: '', end: '21:00' }), null);
  assert.equal(workSchedule.normalizeShift({ days: [1], start: '12:30', end: '' }), null);
  // A shift that starts and ends at the same moment protects nothing.
  assert.equal(workSchedule.normalizeShift({ days: [1], start: '09:00', end: '09:00' }), null);
});

test('days and times are normalized to one convention', () => {
  const shift = workSchedule.normalizeShift({
    label: '  Close  ',
    days: [5, 2, 2, 9, 'x', 7],
    start: '9:05',
    end: '17:00',
  });
  assert.deepEqual(shift.days, [2, 5, 7], 'ISO weekdays, deduplicated and sorted');
  assert.equal(shift.start, '09:05', 'padded to HH:MM');
  assert.equal(shift.label, 'Close');
});

test('the days off are whatever is left', () => {
  const rota = schedule([{ days: [2, 3, 4, 5, 6], start: '12:30', end: '21:00' }]);
  assert.deepEqual(workSchedule.workingDays(rota), [2, 3, 4, 5, 6]);
  assert.deepEqual(workSchedule.daysOff(rota), [1, 7]);
  assert.deepEqual(workSchedule.daysOff(schedule([])), [1, 2, 3, 4, 5, 6, 7]);
});

test('a week of hours is counted across every day a shift runs', () => {
  const summary = workSchedule.summarize(schedule([
    { days: [2, 3, 4, 5, 6], start: '12:30', end: '21:00' },
  ]));
  assert.equal(summary.shifts, 1);
  assert.equal(summary.weekly_minutes, 8.5 * 60 * 5);
  assert.deepEqual(summary.days_off, [1, 7]);
});

test('an overnight shift becomes two commitments, not a dropped one', () => {
  // Monday 21:00 to Tuesday 05:00.
  const commitments = workSchedule.toCommitments(schedule([
    { label: 'Nights', days: [1], start: '21:00', end: '05:00' },
  ]));
  assert.equal(commitments.length, 2);
  assert.deepEqual(commitments[0], { label: 'Nights', days: [1], start: '21:00', end: '23:59' });
  assert.deepEqual(commitments[1], { label: 'Nights (overnight)', days: [2], start: '00:00', end: '05:00' });
});

test('an overnight shift on Sunday wraps round to Monday', () => {
  const commitments = workSchedule.toCommitments(schedule([
    { label: 'Nights', days: [7], start: '22:00', end: '06:00' },
  ]));
  assert.deepEqual(commitments[1].days, [1], 'the morning after Sunday is Monday');
});

test('an ordinary shift is one commitment, unchanged', () => {
  const commitments = workSchedule.toCommitments(schedule([
    { label: 'Work', days: [2, 3], start: '12:30', end: '21:00' },
  ]));
  assert.deepEqual(commitments, [{ label: 'Work', days: [2, 3], start: '12:30', end: '21:00' }]);
});

test('an overnight shift is counted as the hours it actually runs', () => {
  const summary = workSchedule.summarize(schedule([
    { days: [1], start: '21:00', end: '05:00' },
  ]));
  assert.equal(summary.weekly_minutes, 8 * 60);
});

test('input is refused with the row named, not quietly dropped', () => {
  // A corrected rota that loses a row the person thinks they entered is worse
  // than one that refuses to save.
  const missingDays = workSchedule.validateInput({ shifts: [{ start: '09:00', end: '17:00' }] });
  assert.equal(missingDays.ok, false);
  assert.match(missingDays.error, /Shift 1/);

  const missingEnd = workSchedule.validateInput({
    shifts: [
      { days: [1], start: '09:00', end: '17:00' },
      { days: [2], start: '09:00' },
    ],
  });
  assert.equal(missingEnd.ok, false);
  assert.match(missingEnd.error, /Shift 2/);

  assert.equal(workSchedule.validateInput({ shifts: 'monday' }).ok, false);
  assert.equal(workSchedule.validateInput({ shifts: [] }).ok, true, 'an empty rota is a valid answer');
});

test('a stored schedule survives a round trip, and junk does not become one', () => {
  const saved = schedule([{ label: 'Work', days: [2, 3], start: '12:30', end: '21:00' }]);
  const parsed = workSchedule.parseStored(workSchedule.encode(saved));
  assert.deepEqual(parsed.shifts.map(shift => shift.start), ['12:30']);
  assert.equal(workSchedule.parseStored('not json'), null);
  assert.equal(workSchedule.parseStored(''), null);
});

test('the builder is handed a work schedule, not a pile of shifts', () => {
  const payload = workSchedule.toWorkSchedule(schedule([
    { days: [1], start: '09:00', end: '17:00' },
  ]));
  assert.ok(Array.isArray(payload.shifts));
  assert.equal(payload.shifts[0].start, '09:00');
});
