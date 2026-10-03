'use strict';

// The work schedule — step 1 of the weekly build.
//
// Everything else in Planning Mode is about what you want to do. This is the
// one part that is not negotiable: the hours you are at work. It exists so the
// week is built around them instead of over them, and it is kept separately
// from the calendar because a rota is a weekly pattern, not a list of events —
// "12:30 to 9, Tuesday through Saturday" is four words and sixty calendar
// entries a month.
//
// A schedule arrives one of two ways: typed in, or read off a photograph of the
// rota on the fridge. Reading is in work-schedule-reader.js; this module is the
// record it produces, the rules that record has to satisfy, and the conversion
// into the commitments calendar-scheduling.js already knows how to plan around.
//
// Nothing here is read from a photograph on its own authority. A read schedule
// is handed back to the page unsaved, corrected by eye, and only then PUT. OCR
// gets 9:00 and 8:00 wrong often enough that a schedule nobody looked at is a
// week built on a guess.
//
// Pure: records in, records out. The server owns storage and the HTTP surface.

const STORAGE_KEY = 'planning-work-schedule.v1';

const MAX_SHIFTS = 20;
const MAX_LABEL_LENGTH = 80;
const MAX_NOTE_LENGTH = 500;
const MAX_ENCODED_LENGTH = 20000;

// ISO weekdays, Monday = 1, matching calendar-scheduling.js and the planning
// items' preferred_days. One convention across the whole flow.
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CLOCK_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const END_OF_DAY = '23:59';
const START_OF_DAY = '00:00';

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function normalizeClock(value) {
  const match = CLOCK_PATTERN.exec(String(value == null ? '' : value).trim());
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function clockMinutes(value) {
  const clock = normalizeClock(value);
  if (!clock) return null;
  const [hours, minutes] = clock.split(':').map(Number);
  return hours * 60 + minutes;
}

function normalizeDays(value) {
  const list = Array.isArray(value) ? value : [value];
  const days = list
    .map(day => Math.round(Number(day)))
    .filter(day => Number.isInteger(day) && day >= 1 && day <= 7);
  return [...new Set(days)].sort((a, b) => a - b);
}

function makeId() {
  return `shift-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// A shift is only a shift if it says which days and which hours. Anything
// missing one of those is dropped rather than stored half-formed: a row with no
// end time would otherwise reach the scheduler as a commitment of zero length
// and silently protect nothing.
function normalizeShift(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const days = normalizeDays(source.days !== undefined ? source.days : source.day);
  const start = normalizeClock(source.start);
  const end = normalizeClock(source.end);
  if (!days.length || !start || !end || start === end) return null;
  return {
    id: cleanText(source.id, 60) || makeId(),
    label: cleanText(source.label, MAX_LABEL_LENGTH) || 'Work',
    days,
    start,
    end,
  };
}

function normalizeShifts(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const shifts = [];
  value.forEach(entry => {
    const shift = normalizeShift(entry);
    if (!shift || seen.has(shift.id)) return;
    seen.add(shift.id);
    shifts.push(shift);
  });
  return shifts.slice(0, MAX_SHIFTS);
}

// `source` is kept because it changes what the page says about the record: a
// schedule read off a photograph is shown with "check this before you plan on
// it" until it has been saved, and after that it is just the schedule.
function normalizeSchedule(raw, now = new Date().toISOString()) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    version: 1,
    shifts: normalizeShifts(source.shifts),
    note: cleanText(source.note, MAX_NOTE_LENGTH),
    source: source.source === 'photo' ? 'photo' : 'manual',
    updated_at: cleanText(source.updated_at, 40) || now,
  };
}

function emptySchedule(now = new Date().toISOString()) {
  return { version: 1, shifts: [], note: '', source: 'manual', updated_at: now };
}

function parseStored(raw) {
  if (!raw) return null;
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  return normalizeSchedule(parsed);
}

function encode(schedule) {
  return JSON.stringify(normalizeSchedule(schedule));
}

// Validation refuses rather than quietly corrects, because this is the record a
// person has just read off a photograph and confirmed. Silently dropping the
// row they mistyped would leave them planning a week around a shift they think
// they entered.
function validateInput(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  if (source.shifts !== undefined && !Array.isArray(source.shifts)) {
    return { ok: false, error: 'shifts must be an array.' };
  }
  const shifts = Array.isArray(source.shifts) ? source.shifts : [];
  if (shifts.length > MAX_SHIFTS) {
    return { ok: false, error: `A work schedule holds at most ${MAX_SHIFTS} shifts.` };
  }

  for (let index = 0; index < shifts.length; index += 1) {
    const entry = shifts[index] && typeof shifts[index] === 'object' ? shifts[index] : {};
    const where = `Shift ${index + 1}`;
    if (!normalizeDays(entry.days).length) {
      return { ok: false, error: `${where} needs at least one day (Monday = 1).` };
    }
    if (!normalizeClock(entry.start)) {
      return { ok: false, error: `${where} needs a start time as HH:MM.` };
    }
    if (!normalizeClock(entry.end)) {
      return { ok: false, error: `${where} needs an end time as HH:MM.` };
    }
    if (normalizeClock(entry.start) === normalizeClock(entry.end)) {
      return { ok: false, error: `${where} starts and ends at the same time.` };
    }
  }

  return { ok: true, value: normalizeSchedule({ ...source, shifts }) };
}

function workingDays(schedule) {
  const days = new Set();
  normalizeSchedule(schedule).shifts.forEach(shift => shift.days.forEach(day => days.add(day)));
  return [...days].sort((a, b) => a - b);
}

// The days off are what is left, which is the honest way round: you do not
// declare a day off, you simply are not rostered on it.
function daysOff(schedule) {
  const working = new Set(workingDays(schedule));
  return [1, 2, 3, 4, 5, 6, 7].filter(day => !working.has(day));
}

function shiftMinutes(shift) {
  const start = clockMinutes(shift.start);
  const end = clockMinutes(shift.end);
  // An overnight shift runs to the same clock time on the next day.
  return end > start ? end - start : (24 * 60) - start + end;
}

function summarize(schedule) {
  const normalized = normalizeSchedule(schedule);
  const minutes = normalized.shifts.reduce(
    (total, shift) => total + (shiftMinutes(shift) * shift.days.length),
    0
  );
  return {
    shifts: normalized.shifts.length,
    working_days: workingDays(normalized),
    days_off: daysOff(normalized),
    weekly_minutes: minutes,
  };
}

function dayLabel(day) {
  return DAY_NAMES[day - 1] || '';
}

function describeDays(days) {
  return normalizeDays(days).map(dayLabel).filter(Boolean).join(' ');
}

// What the scheduler is handed.
//
// A night shift is the reason this is not a one-line map. calendar-scheduling.js
// takes a commitment as a span inside one day, so 21:00-05:00 read literally is
// an end before its start and gets dropped — the one shift pattern where
// planning over your working hours would be most obviously wrong. It is split
// into the evening of the day you clock on and the morning of the day after.
function toCommitments(schedule) {
  const commitments = [];
  normalizeSchedule(schedule).shifts.forEach(shift => {
    const start = clockMinutes(shift.start);
    const end = clockMinutes(shift.end);
    if (start === null || end === null) return;

    if (end > start) {
      commitments.push({ label: shift.label, days: shift.days, start: shift.start, end: shift.end });
      return;
    }

    commitments.push({
      label: shift.label,
      days: shift.days,
      start: shift.start,
      end: END_OF_DAY,
    });
    const nextDays = normalizeDays(shift.days.map(day => (day % 7) + 1));
    if (end > 0) {
      commitments.push({
        label: `${shift.label} (overnight)`,
        days: nextDays,
        start: START_OF_DAY,
        end: shift.end,
      });
    }
  });
  return commitments;
}

// The shape planning-week.js reads. Keeping the wrapper here means the server
// hands the builder a work schedule rather than knowing how one is shaped.
function toWorkSchedule(schedule) {
  return { shifts: toCommitments(schedule) };
}

module.exports = {
  DAY_NAMES,
  MAX_ENCODED_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_SHIFTS,
  STORAGE_KEY,
  clockMinutes,
  dayLabel,
  daysOff,
  describeDays,
  emptySchedule,
  encode,
  makeId,
  normalizeClock,
  normalizeDays,
  normalizeSchedule,
  normalizeShift,
  normalizeShifts,
  parseStored,
  shiftMinutes,
  summarize,
  toCommitments,
  toWorkSchedule,
  validateInput,
  workingDays,
};
