'use strict';

// Building the week — steps 4, 5 and 6 of the planning flow.
//
// planning.js owns the list and, in buildSchedulingBrief(), what CoachClaw is
// being asked to schedule. This is what happens next: the brief goes in, and a
// week comes out with each ticked item sitting in time that is actually free.
//
// Two things it deliberately is not:
//
//   It is not a writer. Nothing here touches the calendar. The caller shows the
//   week, the user drops what does not work and sends anything they have
//   changed their mind about back to the list, and only then are the blocks
//   posted to /api/calendar/schedule/commit. A week you have not seen is not a
//   week you agreed to.
//
//   It is not a second scheduler. calendar-scheduling.js already knows what a
//   free window is and what makes one slot better than another — sleep, lunch,
//   commutes declared as commitments, meeting buffers, recovery time,
//   deep-work windows. This module walks those windows, scores them with
//   scoreSlot(), and adds the two things a planning item knows that a calendar
//   request does not: the days you would rather do it on, and the part of the
//   day you had in mind.
//
// The one piece of policy of its own is packing order. Items are placed
// hardest-and-most-urgent first and each placed block is fed back in as a
// commitment before the next item is placed, so a week fills up the way a real
// one does: the second workout cannot land on top of the first, and the space
// between two blocks is the same space the calendar leaves everywhere else.

const scheduling = require('./calendar-scheduling.js');
const planning = require('./planning.js');

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// "The week ahead" is the next seven days, not Monday to Sunday. You plan on a
// Sunday for the week that is coming and on a Wednesday for the rest of the one
// you are in; a fixed calendar week gets one of those two wrong.
const HORIZON_DAYS = 7;
const MAX_HORIZON_DAYS = 30;

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

// A preferred time is a strong preference, not a constraint. It is worth about
// as much as the scheduler's own conflict penalty — enough that "sometime in
// the evening" is not answered with nine in the morning, not so much that a slot
// nothing else fits around wins for being at the right hour.
const PREFERRED_WINDOW_WEIGHT = 45;

function normalizeInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoWeekday(date) {
  return date.getDay() === 0 ? 7 : date.getDay();
}

function cleanLabel(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function clockMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value == null ? '' : value).trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

// ─── The work schedule ───────────────────────────────────────────────────────

/**
 * Step 1's output, in the vocabulary the scheduler already reads.
 *
 * A rota is a wall: the hours you are at work are not free time, and nothing in
 * the week may be planned over them. Reading a photograph into this shape — and
 * showing what was read so an obvious mistake can be corrected before anything
 * is planned — happens before this; by the time a schedule arrives here it is
 * days and clock times a person has had the chance to fix.
 *
 * A shift that does not describe a real span is dropped rather than guessed at.
 * An overnight shift is not supported by the scheduler's own commitment shape,
 * so "21:00 to 06:00" is left out instead of being silently read backwards.
 */
function workScheduleCommitments(workSchedule) {
  const shifts = Array.isArray(workSchedule)
    ? workSchedule
    : (workSchedule && Array.isArray(workSchedule.shifts) ? workSchedule.shifts : []);

  return shifts
    .map(shift => {
      const source = shift && typeof shift === 'object' ? shift : {};
      const days = [...new Set(
        (Array.isArray(source.days) ? source.days : [source.day])
          .map(day => Math.round(Number(day)))
          .filter(day => Number.isInteger(day) && day >= 1 && day <= 7)
      )].sort((a, b) => a - b);
      const start = clockMinutes(source.start);
      const end = clockMinutes(source.end);
      if (!days.length || start === null || end === null || end <= start) return null;
      return {
        label: cleanLabel(source.label, 80) || 'Work',
        days,
        start: String(source.start).padStart(5, '0'),
        end: String(source.end).padStart(5, '0'),
      };
    })
    .filter(Boolean);
}

/**
 * The preferences a *personal* week is planned against.
 *
 * The calendar's own preferences describe a working day — nine to six, weekdays
 * — because that is when an agent run belongs. A planning item is not an agent
 * run. "Visit grandmother" is a Saturday and "stretching" is half nine at
 * night, and a scheduler that only offers weekday office hours has nowhere to
 * put either of them. So the day is widened to your waking hours and all seven
 * days, and everything that makes a slot realistic is left exactly as you set
 * it: sleep, lunch, meeting buffers, recovery time, deep-work windows, and the
 * commitments you already keep — now including the work schedule.
 *
 * Pass respectWorkingHours to plan inside office hours instead, which is what
 * you want when the thing being placed really is work.
 */
function planningPreferences(preferences, options = {}) {
  const base = scheduling.normalizePreferences(preferences);
  const commitments = base.commitments.concat(workScheduleCommitments(options.workSchedule));
  if (options.respectWorkingHours) {
    return scheduling.normalizePreferences({ ...base, commitments });
  }

  return scheduling.normalizePreferences({
    ...base,
    // Sleep bounds the day either way — workingWindowForDay() clips to it — but
    // saying so here is what opens up the evening.
    workdayStart: base.sleepEnd,
    workdayEnd: base.sleepStart,
    workingDays: [1, 2, 3, 4, 5, 6, 7],
    allowWeekends: true,
    commitments,
  });
}

// ─── Choosing a slot ─────────────────────────────────────────────────────────

/**
 * How much of the preferred part of the day this slot actually uses.
 *
 * Measured against whichever is shorter, the slot or the window, so a two-hour
 * task starting exactly at a one-hour preferred time counts as a hit rather
 * than as half a miss.
 */
function preferredWindowPenalty(slotStart, slotEnd, window) {
  if (!window) return 0;
  const from = clockMinutes(window.start);
  const to = clockMinutes(window.end);
  if (from === null || to === null || to <= from) return 0;

  const dayStart = startOfDay(slotStart).getTime();
  const windowStart = dayStart + from * MINUTE_MS;
  const windowEnd = dayStart + to * MINUTE_MS;
  const overlapMs = Math.max(0, Math.min(slotEnd.getTime(), windowEnd) - Math.max(slotStart.getTime(), windowStart));
  const comparable = Math.min(slotEnd - slotStart, windowEnd - windowStart);
  if (comparable <= 0) return 0;

  const covered = Math.min(1, overlapMs / comparable);
  return (1 - covered) * PREFERRED_WINDOW_WEIGHT;
}

/**
 * Every slot in the horizon this item would fit in, scored by the calendar's
 * own policy.
 *
 * suggestSlots() is the right call for "when should this one thing go": it
 * returns a short shortlist, spread out, at most two per day. That spread is
 * the problem here. The two best-scoring slots on a day are always the
 * deep-work ones, so an item that wants the evening never sees a candidate
 * anywhere near it. Planning is asking a different question — where does this
 * belong in a whole week — so it walks the free windows itself and scores them
 * with the same scoreSlot().
 */
function candidateSlots({ preferences, events, now, horizonDays, request, days }) {
  const step = scheduling.SLOT_GRANULARITY_MINUTES * MINUTE_MS;
  const durationMs = request.durationMinutes * MINUTE_MS;
  const slots = [];

  for (let offset = 0; offset < horizonDays; offset += 1) {
    const day = addDays(startOfDay(now), offset);
    if (days.length && !days.includes(isoWeekday(day))) continue;

    scheduling.freeWindowsForDay(day, events, preferences).forEach(window => {
      // Align to the granularity grid so suggestions land on clean times.
      const first = Math.ceil(window.start.getTime() / step) * step;
      for (let time = first; time + durationMs <= window.end.getTime(); time += step) {
        if (time < now.getTime()) continue;
        const start = new Date(time);
        const end = new Date(time + durationMs);
        const scored = scheduling.scoreSlot(
          { start, end, windowStart: window.start, windowEnd: window.end },
          request,
          preferences,
          { events, now, horizonDays }
        );
        if (!scored.viable) continue;
        slots.push({ start, end, scored });
      }
    });
  }

  return slots;
}

function pickSlot(slots, preferredWindow) {
  let best = null;
  slots.forEach(slot => {
    const adjusted = slot.scored.score - preferredWindowPenalty(slot.start, slot.end, preferredWindow);
    if (!best || adjusted > best.adjusted || (adjusted === best.adjusted && slot.start < best.slot.start)) {
      best = { slot, adjusted };
    }
  });
  return best ? best.slot : null;
}

// A block the user has already agreed to, or one just placed, is a wall for
// everything placed after it.
function asCommitment(id, title, start, end) {
  return { id, title, start, end, meta: { eventKind: 'task', movable: false } };
}

// ─── The week ────────────────────────────────────────────────────────────────

/**
 * Place the ticked items in the time that is left.
 *
 * @param {object} options
 * @param {Array}  options.items      Planning records (the stored list).
 * @param {Array}  options.events     Existing calendar events.
 * @param {object} options.preferences Scheduling preferences.
 * @param {Date|string} [options.now]
 * @param {number} [options.horizonDays]
 * @param {object} [options.workSchedule] Shifts nothing may be planned over.
 * @param {Array}  [options.only]     Restrict to these planning item ids — how
 *                                    one block is rescheduled without redoing
 *                                    the week around it.
 * @param {Array}  [options.pinned]   Blocks already agreed to, treated as
 *                                    commitments.
 * @param {boolean} [options.respectWorkingHours]
 */
function buildWeek(options = {}) {
  const now = toDate(options.now) || new Date();
  const horizonDays = normalizeInt(options.horizonDays, HORIZON_DAYS, 1, MAX_HORIZON_DAYS);
  const preferences = planningPreferences(options.preferences, options);
  const brief = planning.buildSchedulingBrief(
    Array.isArray(options.items) ? options.items : [],
    { now }
  );

  const only = Array.isArray(options.only) && options.only.length
    ? new Set(options.only.map(String))
    : null;

  const queue = brief.items
    .filter(item => !only || only.has(String(item.id)))
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (
      (PRIORITY_RANK[a.item.request.priority] - PRIORITY_RANK[b.item.request.priority])
      || (b.item.request.durationMinutes - a.item.request.durationMinutes)
      || (a.index - b.index)
    ))
    .map(entry => entry.item);

  const events = (Array.isArray(options.events) ? options.events : []).slice();
  (Array.isArray(options.pinned) ? options.pinned : []).forEach((block, index) => {
    const start = toDate(block && block.start);
    const end = toDate(block && block.end);
    if (!start || !end || end <= start) return;
    events.push(asCommitment(`plan:pinned:${index}`, (block && block.title) || 'Planned', start, end));
  });

  const blocks = [];
  const unscheduled = [];

  queue.forEach(item => {
    const request = item.request;
    const search = { preferences, events, now, horizonDays, request };
    const onPreferred = candidateSlots({ ...search, days: item.preferred_days });
    // A preferred day with no room on it is a preference, not a rule: widen to
    // the week rather than dropping the item, and say which happened.
    const usedOtherDay = item.preferred_days.length > 0 && onPreferred.length === 0;
    const slots = usedOtherDay ? candidateSlots({ ...search, days: [] }) : onPreferred;
    const chosen = pickSlot(slots, item.preferred_window);

    if (!chosen) {
      unscheduled.push({
        planning_item_id: item.id,
        title: item.title,
        reason: item.preferred_days.length
          ? 'No free window in the next seven days fits it, even off your preferred days.'
          : 'No free window in the next seven days fits it around everything else.',
      });
      return;
    }

    const warnings = (chosen.scored.warnings || []).slice();
    if (usedOtherDay) warnings.push('No free window on your preferred days — placed on the next best day.');

    const block = {
      planning_item_id: item.id,
      title: item.title,
      start: chosen.start.toISOString(),
      end: chosen.end.toISOString(),
      duration_minutes: request.durationMinutes,
      duration_is_estimated: item.duration_is_estimated,
      score: chosen.scored.score,
      reasons: chosen.scored.reasons || [],
      warnings,
      notes: item.notes,
      // The shape /api/calendar/schedule/commit writes.
      meta: {
        eventKind: 'task',
        executionMode: 'manual',
        priority: request.priority,
        movable: true,
        estimatedDuration: request.durationMinutes,
        energy: request.energy,
        planningItemId: item.id,
      },
    };

    blocks.push(block);
    events.push(asCommitment(`plan:${item.id}`, item.title, chosen.start, chosen.end));
  });

  blocks.sort((a, b) => new Date(a.start) - new Date(b.start));

  return {
    version: 1,
    generated_at: now.toISOString(),
    window: {
      start: now.toISOString(),
      end: new Date(startOfDay(now).getTime() + horizonDays * DAY_MS).toISOString(),
      days: horizonDays,
    },
    blocks,
    unscheduled,
    counts: {
      considered: queue.length,
      planned: blocks.length,
      unscheduled: unscheduled.length,
    },
  };
}

module.exports = {
  HORIZON_DAYS,
  PREFERRED_WINDOW_WEIGHT,
  workScheduleCommitments,
  planningPreferences,
  buildWeek,
};
