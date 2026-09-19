'use strict';

// Building the week: steps 4 and 5, without a server.
//
// planning.test.js holds the line on what a planning item is and on checked
// never meaning done. This file is about what happens to the ticked ones: that
// they land in time that is genuinely free, that they do not land on each
// other, that a preference is honoured when it can be and reported when it
// cannot, and that nothing is quietly dropped.

const assert = require('node:assert/strict');
const test = require('node:test');

const planningWeek = require('../agent-office-deploy/dist/planning-week.js');

// A Monday morning, well before the working day, so every test starts with a
// whole week in front of it.
const NOW = new Date('2026-09-07T06:00:00');

let nextId = 0;
function item(overrides = {}) {
  nextId += 1;
  return {
    id: `planning-${nextId}`,
    title: 'Something to do',
    notes: '',
    completed: false,
    completed_at: null,
    schedule_this_week: true,
    estimated_duration: 60,
    priority: 'normal',
    preferred_days: [],
    preferred_time: '',
    created_at: '2026-09-06T10:00:00.000Z',
    updated_at: '2026-09-06T10:00:00.000Z',
    ...overrides,
  };
}

function build(options = {}) {
  return planningWeek.buildWeek({ now: NOW, events: [], ...options });
}

function blockFor(week, title) {
  return week.blocks.find(block => block.title === title);
}

test('only the ticked, unfinished items are placed', () => {
  const week = build({
    items: [
      item({ title: 'Workout' }),
      item({ title: 'Clean garage', schedule_this_week: false }),
      item({ title: 'Old workout', completed: true }),
    ],
  });

  assert.equal(week.counts.considered, 1);
  assert.deepEqual(week.blocks.map(block => block.title), ['Workout']);
  // An unticked item is not a failure to schedule: it was never up for it.
  assert.deepEqual(week.unscheduled, []);
});

test('nothing ticked is an empty week, not an error', () => {
  const week = build({ items: [item({ schedule_this_week: false })] });
  assert.deepEqual(week.blocks, []);
  assert.deepEqual(week.unscheduled, []);
  assert.equal(week.counts.considered, 0);
});

test('two blocks in one week never overlap', () => {
  const week = build({
    items: [
      item({ title: 'Workout' }),
      item({ title: 'Reporter Room', estimated_duration: 120 }),
      item({ title: 'Review trading strategy', estimated_duration: 45 }),
    ],
  });

  assert.equal(week.blocks.length, 3);
  const spans = week.blocks.map(block => [Date.parse(block.start), Date.parse(block.end)]);
  spans.forEach(([start, end], index) => {
    spans.slice(index + 1).forEach(([otherStart, otherEnd]) => {
      assert.ok(end <= otherStart || otherEnd <= start, 'two planned blocks overlap');
    });
  });
});

test('an existing calendar event is time the week cannot use', () => {
  const busyStart = new Date('2026-09-07T09:00:00');
  const busyEnd = new Date('2026-09-07T18:00:00');
  const week = build({
    items: [item({ title: 'Workout' })],
    events: [{ id: 'busy', title: 'All day thing', start: busyStart.toISOString(), end: busyEnd.toISOString() }],
  });

  const block = blockFor(week, 'Workout');
  assert.ok(block, 'the item should still be placed somewhere');
  const start = Date.parse(block.start);
  const end = Date.parse(block.end);
  assert.ok(end <= busyStart.getTime() || start >= busyEnd.getTime(), 'a block was planned over a calendar event');
});

test('the work schedule is a wall, not a suggestion', () => {
  const week = build({
    items: [item({ title: 'Workout', preferred_days: [1] })],
    workSchedule: { shifts: [{ label: 'Work', days: [1, 2, 3, 4, 5], start: '12:30', end: '21:00' }] },
  });

  const block = blockFor(week, 'Workout');
  assert.ok(block);
  const start = new Date(block.start);
  const end = new Date(block.end);
  const minutes = date => date.getHours() * 60 + date.getMinutes();
  assert.ok(
    minutes(end) <= 12 * 60 + 30 || minutes(start) >= 21 * 60,
    `expected a slot outside the shift, got ${start} – ${end}`
  );
});

test('a rota becomes commitments, and an unusable shift is dropped', () => {
  assert.deepEqual(
    planningWeek.workScheduleCommitments({
      shifts: [
        { label: 'Work', days: [1, 2], start: '12:30', end: '21:00' },
        { day: 3, start: '12:30', end: '21:00' },
        { days: [4], start: '21:00', end: '06:00' },
        { days: [], start: '09:00', end: '17:00' },
        { days: [5], start: 'nonsense', end: '17:00' },
      ],
    }),
    [
      { label: 'Work', days: [1, 2], start: '12:30', end: '21:00' },
      { label: 'Work', days: [3], start: '12:30', end: '21:00' },
    ]
  );
});

test('a personal week is planned against waking hours, not office hours', () => {
  const preferences = {
    workdayStart: '09:00',
    workdayEnd: '18:00',
    sleepStart: '23:00',
    sleepEnd: '07:00',
    workingDays: [1, 2, 3, 4, 5],
  };

  const widened = planningWeek.planningPreferences(preferences);
  assert.equal(widened.workdayStart, '07:00');
  assert.equal(widened.workdayEnd, '23:00');
  assert.deepEqual(widened.workingDays, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(widened.allowWeekends, true);

  // ...unless what is being placed really is work.
  const office = planningWeek.planningPreferences(preferences, { respectWorkingHours: true });
  assert.equal(office.workdayStart, '09:00');
  assert.equal(office.workdayEnd, '18:00');
  assert.deepEqual(office.workingDays, [1, 2, 3, 4, 5]);
});

test('an evening item is placed in the evening, outside office hours', () => {
  const week = build({
    preferences: { workdayStart: '09:00', workdayEnd: '18:00', sleepStart: '23:00', sleepEnd: '07:00' },
    items: [item({ title: 'Stretching', estimated_duration: 30, preferred_time: 'evening' })],
  });

  const start = new Date(blockFor(week, 'Stretching').start);
  assert.ok(start.getHours() >= 17, `expected an evening slot, got ${start}`);
});

test('a Saturday item is placed on a Saturday', () => {
  const week = build({ items: [item({ title: 'Visit grandmother', preferred_days: [6] })] });
  assert.equal(new Date(blockFor(week, 'Visit grandmother').start).getDay(), 6);
});

test('a preferred day with no room falls back, and says so', () => {
  const week = build({
    items: [item({ title: 'Visit grandmother', preferred_days: [6] })],
    events: [{
      id: 'away',
      title: 'Away both Saturdays',
      start: '2026-09-12T00:00:00',
      end: '2026-09-13T00:00:00',
    }],
  });

  const block = blockFor(week, 'Visit grandmother');
  assert.ok(block);
  assert.notEqual(new Date(block.start).getDay(), 6);
  assert.match(block.warnings.join(' '), /preferred days/i);
});

test('an item with nowhere to go is reported, not dropped', () => {
  const week = build({
    items: [item({ title: 'Reporter Room', estimated_duration: 8 * 60, preferred_days: [1] })],
    events: [{
      id: 'gone',
      title: 'Whole week gone',
      start: '2026-09-07T00:00:00',
      end: '2026-09-15T00:00:00',
    }],
  });

  assert.deepEqual(week.blocks, []);
  assert.equal(week.unscheduled.length, 1);
  assert.equal(week.unscheduled[0].title, 'Reporter Room');
  assert.ok(week.unscheduled[0].reason);
  assert.equal(week.counts.unscheduled, 1);
});

test('the urgent, awkward things get first pick of the week', () => {
  const week = build({
    items: [
      item({ title: 'Small and low', estimated_duration: 30, priority: 'low' }),
      item({ title: 'Big and urgent', estimated_duration: 120, priority: 'urgent' }),
    ],
  });

  const urgent = Date.parse(blockFor(week, 'Big and urgent').start);
  const low = Date.parse(blockFor(week, 'Small and low').start);
  assert.ok(urgent <= low, 'the urgent item should not be scheduled around the low-priority one');
});

test('a block carries what the calendar needs to commit it', () => {
  const week = build({ items: [item({ title: 'Workout', priority: 'high' })] });
  const block = blockFor(week, 'Workout');

  assert.ok(block.title && block.start && block.end, 'commit needs a title, a start and an end');
  assert.equal(block.meta.eventKind, 'task');
  assert.equal(block.meta.executionMode, 'manual');
  assert.equal(block.meta.priority, 'high');
  assert.equal(block.meta.planningItemId, block.planning_item_id);
  assert.equal(block.meta.estimatedDuration, 60);
});

test('an item with no stated duration is placed as an hour, and says it was assumed', () => {
  const week = build({ items: [item({ title: 'Read Zohar chapter', estimated_duration: null })] });
  const block = blockFor(week, 'Read Zohar chapter');
  assert.equal(block.duration_minutes, 60);
  assert.equal(block.duration_is_estimated, true);
  assert.equal(Date.parse(block.end) - Date.parse(block.start), 60 * 60 * 1000);
});

test('`only` and `pinned` move one block without disturbing the rest', () => {
  const week = build({
    items: [item({ id: 'planning-a', title: 'Workout' }), item({ id: 'planning-b', title: 'Reporter Room' })],
  });
  assert.equal(week.blocks.length, 2);

  const keep = week.blocks.filter(block => block.planning_item_id !== 'planning-a');
  const moving = week.blocks.find(block => block.planning_item_id === 'planning-a');

  const again = planningWeek.buildWeek({
    now: NOW,
    events: [],
    items: [item({ id: 'planning-a', title: 'Workout' }), item({ id: 'planning-b', title: 'Reporter Room' })],
    only: ['planning-a'],
    // Everything already agreed to, including the slot it is being moved out of.
    pinned: keep.concat([moving]).map(block => ({ title: block.title, start: block.start, end: block.end })),
  });

  assert.equal(again.counts.considered, 1);
  assert.equal(again.blocks.length, 1);
  assert.equal(again.blocks[0].planning_item_id, 'planning-a');
  assert.notEqual(again.blocks[0].start, moving.start, 'a move should not hand back the same slot');
  keep.forEach(kept => {
    assert.ok(
      Date.parse(again.blocks[0].end) <= Date.parse(kept.start)
      || Date.parse(again.blocks[0].start) >= Date.parse(kept.end),
      'the moved block landed on a block that was pinned'
    );
  });
});

test('the week describes the window it planned into', () => {
  const week = build({ items: [item()], horizonDays: 5 });
  assert.equal(week.window.days, 5);
  assert.equal(week.window.start, NOW.toISOString());
  assert.ok(Date.parse(week.window.end) > Date.parse(week.window.start));
  week.blocks.forEach(block => {
    assert.ok(Date.parse(block.start) >= Date.parse(week.window.start), 'a block was planned in the past');
    assert.ok(Date.parse(block.end) <= Date.parse(week.window.end), 'a block was planned outside the window');
  });
});
