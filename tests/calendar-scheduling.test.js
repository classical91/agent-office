const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const scheduling = require(path.resolve(__dirname, '..', 'agent-office-deploy', 'dist', 'calendar-scheduling.js'));

// All fixtures are built in local time on purpose: the scheduler works in the
// runtime timezone, and pinning to UTC would hide off-by-one-day bugs.
function local(dateText) {
  return new Date(dateText);
}

// 2026-07-28 is a Tuesday.
const TUESDAY = '2026-07-28';

function at(dateText, clock) {
  return `${dateText}T${clock}:00`;
}

test('preferences are normalized and nonsense values fall back to defaults', () => {
  const prefs = scheduling.normalizePreferences({
    workdayStart: '25:99',
    workdayEnd: '08:00',
    minFocusMinutes: 5000,
    maxConcurrentAgentRuns: 0,
    deepWorkWindows: [{ start: '09:00', end: '08:00' }, { start: '13:00', end: '15:00' }],
    commitments: [{ label: 'School', days: [1, 3], start: '13:00', end: '15:30' }],
    workingDays: [1, 2, 3, 4, 5, 6],
  });

  assert.equal(prefs.workdayStart, '09:00', 'an invalid clock falls back to the default');
  // An end before the start is a typo, not an overnight shift.
  assert.ok(prefs.workdayEnd > prefs.workdayStart);
  assert.equal(prefs.minFocusMinutes, 480, 'clamped to the maximum');
  assert.equal(prefs.maxConcurrentAgentRuns, 1, 'clamped to the minimum');
  assert.deepEqual(prefs.deepWorkWindows, [{ start: '13:00', end: '15:00' }], 'inverted windows are dropped');
  assert.equal(prefs.commitments.length, 1);
  assert.deepEqual(prefs.workingDays, [1, 2, 3, 4, 5, 6]);
});

test('free windows respect the working day, lunch, commitments and meeting buffers', () => {
  const events = [
    { id: 'standup', title: 'Standup', start: at(TUESDAY, '09:00'), end: at(TUESDAY, '09:30') },
  ];
  const prefs = {
    workdayStart: '09:00',
    workdayEnd: '17:00',
    meetingBufferMinutes: 10,
    lunch: { start: '12:00', durationMinutes: 60 },
    commitments: [{ label: 'Class', days: [2], start: '15:00', end: '16:00' }],
  };

  const windows = scheduling.freeWindowsForDay(local(at(TUESDAY, '00:00')), events, prefs)
    .map(window => [
      window.start.toTimeString().slice(0, 5),
      window.end.toTimeString().slice(0, 5),
    ]);

  assert.deepEqual(windows, [
    ['09:40', '12:00'], // the standup is padded by the 10-minute buffer
    ['13:00', '15:00'], // lunch runs 12:00-13:00
    ['16:00', '17:00'], // the Tuesday class blocks 15:00-16:00
  ]);
});

test('a non-working day yields no windows unless weekends are allowed', () => {
  const saturday = '2026-08-01';
  assert.equal(scheduling.freeWindowsForDay(local(at(saturday, '00:00')), [], {}).length, 0);
  assert.ok(scheduling.freeWindowsForDay(local(at(saturday, '00:00')), [], { allowWeekends: true }).length > 0);
});

test('slot scoring prefers deep work and penalizes crowding against a neighbour', () => {
  const events = [
    { id: 'call', title: 'Client call', start: at(TUESDAY, '10:30'), end: at(TUESDAY, '11:00'), meta: { projectId: 'acme' } },
  ];
  const prefs = { deepWorkWindows: [{ start: '09:00', end: '12:00' }], meetingBufferMinutes: 15 };
  const context = { events, now: local(at(TUESDAY, '08:00')), horizonDays: 14 };
  const request = { priority: 'high', energy: 'high' };

  const clean = scheduling.scoreSlot(
    { start: local(at(TUESDAY, '09:00')), end: local(at(TUESDAY, '10:00')) },
    request, prefs, context
  );
  const crowded = scheduling.scoreSlot(
    { start: local(at(TUESDAY, '11:05')), end: local(at(TUESDAY, '11:50')) },
    request, prefs, context
  );

  assert.ok(clean.score > crowded.score, 'a clean deep-work slot beats one jammed against a meeting');
  assert.ok(clean.reasons.includes('Inside a deep-work window'));
  assert.ok(crowded.breakdown.interruptionCost < 0, 'crowding shows up as a cost, not a silent drop');
});

test('a slot that misses the deadline is scored as a conflict, not just a worse option', () => {
  const prefs = {};
  const context = { events: [], now: local(at(TUESDAY, '08:00')) };
  const late = scheduling.scoreSlot(
    { start: local(at('2026-07-30', '09:00')), end: local(at('2026-07-30', '10:00')) },
    { deadline: at('2026-07-29', '17:00') }, prefs, context
  );

  assert.equal(late.viable, false);
  assert.ok(late.warnings.includes('Finishes after the deadline'));
  assert.ok(late.breakdown.conflictRisk < 0);
});

test('the concurrency cap keeps a third agent run out of an already busy window', () => {
  const events = [
    { id: 'a', title: 'Run A', start: at(TUESDAY, '09:00'), end: at(TUESDAY, '11:00'), meta: { executionMode: 'agent-run' } },
    { id: 'b', title: 'Run B', start: at(TUESDAY, '09:00'), end: at(TUESDAY, '11:00'), meta: { executionMode: 'agent-run' } },
  ];
  const scored = scheduling.scoreSlot(
    { start: local(at(TUESDAY, '09:30')), end: local(at(TUESDAY, '10:30')) },
    { executionMode: 'agent-run' },
    { maxConcurrentAgentRuns: 2 },
    { events, now: local(at(TUESDAY, '08:00')) }
  );

  assert.ok(scored.warnings.some(warning => /agent runs/.test(warning)));
  assert.ok(scored.breakdown.conflictRisk < 0);
});

test('suggestSlots returns scored windows rather than the first one that fits', () => {
  const events = [
    { id: 'early', title: 'Early call', start: at(TUESDAY, '09:00'), end: at(TUESDAY, '09:15') },
  ];
  const slots = scheduling.suggestSlots({
    events,
    now: local(at(TUESDAY, '08:00')),
    horizonDays: 5,
    limit: 5,
    preferences: { deepWorkWindows: [{ start: '09:00', end: '12:00' }] },
    request: { durationMinutes: 60, priority: 'high', energy: 'high' },
  });

  assert.ok(slots.length > 0);
  // Sorted best-first, and every returned slot carries its reasoning.
  for (let index = 1; index < slots.length; index += 1) {
    assert.ok(slots[index - 1].score >= slots[index].score);
  }
  slots.forEach(slot => {
    assert.equal(typeof slot.score, 'number');
    assert.ok(slot.breakdown && 'urgency' in slot.breakdown);
    assert.equal(slot.durationMinutes, 60);
  });
  // The very first fitting window (09:25) is not automatically the winner.
  assert.notEqual(new Date(slots[0].start).getTime(), local(at(TUESDAY, '09:25')).getTime());
});

test('suggestSlots honours notBefore so a follow-up cannot start before its dependency', () => {
  const slots = scheduling.suggestSlots({
    events: [],
    now: local(at(TUESDAY, '08:00')),
    horizonDays: 2,
    limit: 5,
    request: { durationMinutes: 30, notBefore: at(TUESDAY, '14:00') },
  });
  slots
    .filter(slot => slot.start.slice(0, 10) === TUESDAY)
    .forEach(slot => assert.ok(new Date(slot.start) >= local(at(TUESDAY, '14:00'))));
});

test('natural language yields an agent, a project, a duration, a constraint and a follow-up', () => {
  const parsed = scheduling.parseScheduleRequest(
    'Have Codex work on Flashcards tomorrow for 90 minutes after my last appointment, then have Guardian review the result',
    {
      now: local(at(TUESDAY, '08:00')),
      agents: [{ id: 'codex', name: 'Codex' }, { id: 'guardian', name: 'Guardian' }],
      projects: [{ id: 'flashcards', name: 'Flashcards' }],
    }
  );

  assert.equal(parsed.ok, true);
  assert.equal(parsed.request.agent, 'codex');
  assert.equal(parsed.request.project, 'flashcards');
  assert.equal(parsed.request.action, 'implementation');
  assert.equal(parsed.request.durationMinutes, 90);
  assert.equal(parsed.request.constraint, 'after-last-appointment');
  assert.equal(parsed.request.executionMode, 'agent-run');
  assert.equal(parsed.request.followUp.agent, 'guardian');
  assert.equal(parsed.request.followUp.action, 'review');
  assert.equal(scheduling.describeRequest(parsed.request), 'Codex: Flashcards implementation');
});

test('empty natural-language input is rejected instead of scheduling something arbitrary', () => {
  assert.equal(scheduling.parseScheduleRequest('   ').ok, false);
});
