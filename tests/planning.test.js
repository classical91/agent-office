'use strict';

// Planning Mode's rules, without a server.
//
// The one that matters most: ticking an item is a scheduling request and
// nothing else. Every other test here exists to stop that distinction eroding —
// a checkbox that quietly means "done" would put a workout in the past because
// it was planned on a Sunday.

const assert = require('node:assert/strict');
const test = require('node:test');

const planning = require('../agent-office-deploy/dist/planning.js');

function item(overrides = {}) {
  return planning.createItem({ title: 'Workout 3 times', ...overrides });
}

test('a new item is a scheduling request, not a finished task', () => {
  const created = item();
  assert.equal(created.schedule_this_week, true);
  assert.equal(created.completed, false);
  assert.equal(created.completed_at, null);
});

test('ticking and completing are separate states', () => {
  const parked = planning.applyUpdate(item(), { schedule_this_week: false });
  assert.equal(parked.schedule_this_week, false);
  // The point of the list: an unticked item is kept, not finished and not gone.
  assert.equal(parked.completed, false);

  const ticked = planning.applyUpdate(parked, { schedule_this_week: true });
  assert.equal(ticked.completed, false, 'ticking must never complete anything');
});

test('completing an item stamps it and stops it being scheduled again', () => {
  const done = planning.applyUpdate(item(), { completed: true }, '2026-09-08T10:00:00.000Z');
  assert.equal(done.completed, true);
  assert.equal(done.completed_at, '2026-09-08T10:00:00.000Z');
  assert.equal(done.schedule_this_week, false, 'a finished task is not still asking for a slot');

  const undone = planning.applyUpdate(done, { completed: false });
  assert.equal(undone.completed, false);
  assert.equal(undone.completed_at, null);
  // Un-completing does not re-book it: putting it back in the week is a
  // separate, deliberate tick.
  assert.equal(undone.schedule_this_week, false);
});

test('unfinished items are kept for later rather than dropped', () => {
  const items = [
    item({ title: 'Clean garage', schedule_this_week: false }),
    item({ title: 'Read Zohar chapter', schedule_this_week: false }),
    item({ title: 'Visit grandmother' }),
  ];
  const counts = planning.summarize(items);
  assert.equal(counts.total, 3);
  assert.equal(counts.scheduled, 1);
  assert.equal(counts.parked, 2);
  assert.equal(counts.completed, 0);
});

test('the fields CoachClaw will grow into are normalized now', () => {
  const created = item({
    estimated_duration: '90',
    priority: 'HIGH',
    preferred_days: [3, 1, 1, 9, 'x', 6],
    preferred_time: '9:30',
    notes: '  three sessions  ',
  });
  assert.equal(created.estimated_duration, 90);
  assert.equal(created.priority, 'high');
  assert.deepEqual(created.preferred_days, [1, 3, 6]);
  assert.equal(created.preferred_time, '09:30');
  assert.equal(created.notes, 'three sessions');
});

test('a duration outside what a day can hold is clamped, not stored', () => {
  assert.equal(item({ estimated_duration: 2 }).estimated_duration, planning.MIN_DURATION_MINUTES);
  assert.equal(item({ estimated_duration: 9000 }).estimated_duration, planning.MAX_DURATION_MINUTES);
  assert.equal(item({ estimated_duration: '' }).estimated_duration, null, 'unsaid is not an hour');
});

test('input is refused rather than silently corrected', () => {
  assert.equal(planning.validateInput({ title: '   ' }).ok, false);
  assert.equal(planning.validateInput({ title: 'ok', priority: 'yesterday' }).ok, false);
  assert.equal(planning.validateInput({ title: 'ok', preferred_time: 'lunchtime' }).ok, false);
  assert.equal(planning.validateInput({ title: 'ok', preferred_days: 'monday' }).ok, false);
  assert.equal(planning.validateInput({}, true).ok, false, 'an empty patch changes nothing');
  assert.equal(planning.validateInput({ title: 'ok', preferred_time: 'morning' }).ok, true);
});

test('stored lists survive a round trip and drop what they should', () => {
  const items = [item({ title: 'One' }), item({ title: 'Two' })];
  const parsed = planning.parseStoredItems(planning.encodeItems(items));
  assert.deepEqual(parsed.map(entry => entry.title), ['One', 'Two']);

  assert.deepEqual(planning.parseStoredItems('not json'), []);
  assert.deepEqual(planning.parseStoredItems(''), []);
  // A titleless record is not a planning item, and a duplicate id is one item.
  const messy = JSON.stringify([{ title: '' }, { id: 'dup', title: 'A' }, { id: 'dup', title: 'B' }]);
  assert.deepEqual(planning.parseStoredItems(messy).map(entry => entry.title), ['A']);
  // Unknown fields are not carried: the record shape is the contract.
  const smuggled = JSON.stringify([{ id: 'x', title: 'A', done: true, secret: 'no' }]);
  assert.deepEqual(Object.keys(planning.parseStoredItems(smuggled)[0]).includes('secret'), false);
});

test('the brief is the ticked, unfinished items and nothing else', () => {
  const items = [
    item({ title: 'Workout 3 times', estimated_duration: 45, priority: 'high' }),
    item({ title: 'Clean garage', schedule_this_week: false }),
    item({ title: 'Visit grandmother', completed: true }),
  ];
  const brief = planning.buildSchedulingBrief(items, { now: '2026-09-08T12:00:00.000Z' });

  assert.deepEqual(brief.items.map(entry => entry.title), ['Workout 3 times']);
  assert.equal(brief.generated_at, '2026-09-08T12:00:00.000Z');
  assert.equal(brief.counts.parked, 1);

  const [workout] = brief.items;
  assert.equal(workout.request.durationMinutes, 45);
  assert.equal(workout.request.priority, 'high');
  assert.equal(workout.duration_is_estimated, false);
});

test('an item that never said how long it takes is scheduled as an hour, and says so', () => {
  const brief = planning.buildSchedulingBrief([item({ title: 'Review trading strategy' })]);
  const [entry] = brief.items;
  assert.equal(entry.request.durationMinutes, planning.DEFAULT_DURATION_MINUTES);
  assert.equal(entry.duration_is_estimated, true, 'the scheduler should know this was a guess');
});

test('a ticked item that has been done is not scheduled again', () => {
  // The state that would break a week: the box is still ticked because ticking
  // it was the request, and the request has already been satisfied.
  const done = { ...item({ title: 'Workout' }), completed: true, schedule_this_week: true };
  assert.deepEqual(planning.selectSchedulableItems([done]), []);
});

test('a preferred time becomes a window the scheduler can use', () => {
  assert.deepEqual(planning.preferredWindowFor(item({ preferred_time: 'morning' })), { start: '06:00', end: '12:00' });
  // A clock time is a start, not a one-slot demand.
  assert.deepEqual(planning.preferredWindowFor(item({ preferred_time: '09:30' })), { start: '09:30', end: '10:30' });
  assert.equal(planning.preferredWindowFor(item()), null);
});
