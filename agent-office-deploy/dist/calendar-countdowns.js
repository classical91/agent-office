'use strict';

// Countdowns on the Calendar — a read-only projection, not a second copy.
//
// Two stores hold things with a clock on them: the Agent Office countdowns
// (deadlines, goals, routines, trading dates) and the Countdown Timers on
// /countdowns.html (resets, haircuts, rotating reading slots, Pushcut). The
// Calendar shows both as markers on the dates they land, worked out from the
// stored records every time it asks. Nothing is written back and nothing is
// stored as a calendar event, so there is one record per countdown and the
// countdown's own page stays the place it is edited.
//
// A marker is a moment, not a block: `blocksTime` is false on every item so
// nothing that looks for free time treats a deadline as a meeting.
//
// Everything here is pure — records and dates in, plain objects out — and it
// reuses the stepping rules in countdowns.js and timer-rotation.js rather than
// restating them, so the Calendar and the Countdowns page cannot disagree
// about when something next lands.
//
// What a future occurrence is NOT: proof that anything happened. Expanding a
// weekly routine across next month is a forecast; it never marks a timer sent,
// never rolls one forward, and never fires a notification.

const countdowns = require('./countdowns.js');
const { currentRotation } = require('./timer-rotation.js');
const resetTimers = require('./reset-timers.js');

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// A month view is six weeks; an agenda is two. Anything wider than this is not
// a calendar screen asking.
const MAX_RANGE_DAYS = 120;
const DEFAULT_RANGE_DAYS = 42;
// A daily countdown over 120 days is 120 markers. Nothing legitimate needs
// more from one record, and a malformed one should not be able to ask for it.
const MAX_OCCURRENCES_PER_RECORD = 400;
const MAX_WALK_STEPS = 5000;
const UPCOMING_LIMIT = 6;

const TIMER_COLOR = '#22d3ee';

const COUNTDOWN_REPEAT_LABELS = {
  none: 'One-off',
  daily: 'Daily',
  every2days: 'Every 2 days',
  every3days: 'Every 3 days',
  every4days: 'Every 4 days',
  weekday: 'Weekdays',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
};

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * The window the calendar is looking at, from `?from=` and `?to=`.
 *
 * Missing ends default to six weeks from the start of today, which covers a
 * month grid. A reversed or oversized window is an error rather than a silent
 * clamp, so a caller asking for the wrong thing finds out.
 */
function parseRange(fromValue, toValue, now = new Date()) {
  const from = fromValue ? toDate(fromValue) : startOfDay(now);
  if (!from) return { ok: false, error: 'from must be a date.' };
  const to = toValue ? toDate(toValue) : countdowns.addDays(from, DEFAULT_RANGE_DAYS);
  if (!to) return { ok: false, error: 'to must be a date.' };
  if (to.getTime() <= from.getTime()) return { ok: false, error: 'to must be after from.' };
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS + HOUR_MS) {
    return { ok: false, error: `The range can be at most ${MAX_RANGE_DAYS} days.` };
  }
  return { ok: true, from, to };
}

// ─── Walking a repeat rule ───────────────────────────────────────────────────

/**
 * Every occurrence of a repeating rule inside [from, to).
 *
 * Starts at the record's own first occurrence and steps with the same function
 * the record's page uses, so a monthly countdown on the 31st clamps the same
 * way here as on its card. `floor` is the earliest occurrence worth showing.
 */
function walkOccurrences(first, step, options) {
  const { from, to, floor, skip } = options;
  const lower = Math.max(from.getTime(), floor.getTime());
  const found = [];
  let candidate = new Date(first);
  for (let i = 0; i < MAX_WALK_STEPS && candidate.getTime() < to.getTime(); i += 1) {
    if (candidate.getTime() >= lower && !(skip && skip(candidate))) {
      found.push(new Date(candidate));
      if (found.length >= MAX_OCCURRENCES_PER_RECORD) break;
    }
    const next = step(candidate);
    if (!next || next.getTime() <= candidate.getTime()) break;
    candidate = next;
  }
  return found;
}

// A repeating record's past occurrences are not on the calendar: they were a
// forecast once, and drawing them now would read as a record of things done.
// Today is kept whole, so a daily 8am routine is still on today's column at
// 10am — as passed, not as missing.
function repeatFloor(now) {
  return startOfDay(now);
}

function stateFor(at, now, oneOff) {
  const ms = at.getTime() - now.getTime();
  if (ms < 0) return oneOff ? 'overdue' : 'passed';
  if (ms <= DAY_MS) return 'soon';
  return 'upcoming';
}

// ─── The two sources ─────────────────────────────────────────────────────────

// `categories` is the saved Manage categories list, so a custom category keeps
// its own name here; categorySlug() reads a stored record leniently, the same
// way the Countdowns page does.
function countdownItem(record, at, now, categories) {
  const category = countdowns.categorySlug(record.category);
  const repeat = countdowns.normalizeRepeat(record.repeat);
  const state = stateFor(at, now, repeat === 'none');
  const weekendQuiet = category === 'trading' && (countdowns.isWeekend(now) || countdowns.isWeekend(at));
  return {
    id: `countdown:${record.id}:${at.toISOString()}`,
    source: 'countdown',
    recordId: String(record.id),
    title: record.title || '',
    rotation: '',
    at: at.toISOString(),
    category,
    categoryLabel: countdowns.categoryLabel(category, categories),
    color: countdowns.categoryColor(category),
    repeat,
    repeatLabel: COUNTDOWN_REPEAT_LABELS[repeat] || repeat,
    nextAction: record.next_action || '',
    state,
    overdue: state === 'overdue',
    weekendQuiet,
    pinned: Boolean(record.pinned),
    href: `/countdowns.html?open=${encodeURIComponent(record.id)}`,
    blocksTime: false,
  };
}

function countdownOccurrences(record, range, now, categories) {
  if (!record || !record.id || record.archived) return [];
  const target = toDate(record.target_at || record.targetAt);
  if (!target) return [];
  const repeat = countdowns.normalizeRepeat(record.repeat);
  if (repeat === 'none') {
    const inRange = target.getTime() >= range.from.getTime() && target.getTime() < range.to.getTime();
    return inRange ? [countdownItem(record, target, now, categories)] : [];
  }
  const avoidWeekend = countdowns.skipsWeekends(record);
  return walkOccurrences(target, date => countdowns.stepOccurrence(date, repeat), {
    from: range.from,
    to: range.to,
    floor: repeatFloor(now),
    skip: avoidWeekend ? countdowns.isWeekend : null,
  }).map(at => countdownItem(record, at, now, categories));
}

function timerRepeatLabel(timer) {
  if (timer.repeatMonths) return timer.repeatMonths === 1 ? 'Monthly' : `Every ${timer.repeatMonths} months`;
  if (timer.repeatDays === 1) return 'Daily';
  if (timer.repeatDays === 7) return 'Weekly';
  if (timer.repeatDays) return `Every ${timer.repeatDays} days`;
  return 'One-off';
}

function stepTimer(timer) {
  if (timer.repeatMonths) return date => countdowns.addMonths(date, timer.repeatMonths);
  if (timer.repeatDays) return date => countdowns.addDays(date, timer.repeatDays);
  return null;
}

// The raw record's category is free text the page wrote; it is a label here
// and nothing more.
function timerCategoryLabel(raw) {
  const value = raw && typeof raw.category === 'string' ? raw.category.trim().slice(0, 40) : '';
  if (!value) return 'Timer';
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * A Countdown Timer occurrence, with the webhook left behind.
 *
 * The webhook URL is a credential (its query string is the Pushcut secret), so
 * this builds the item field by field from the normalized timer rather than
 * spreading the record.
 */
function timerItem(timer, raw, at, now) {
  const oneOff = !timer.repeatDays && !timer.repeatMonths;
  const state = stateFor(at, now, oneOff);
  return {
    id: `timer:${timer.id}:${at.toISOString()}`,
    source: 'timer',
    recordId: timer.id,
    title: timer.title,
    rotation: currentRotation({ ...timer, resetAt: at.toISOString() }),
    at: at.toISOString(),
    category: 'timer',
    categoryLabel: timerCategoryLabel(raw),
    color: TIMER_COLOR,
    repeat: oneOff ? 'none' : 'repeat',
    repeatLabel: timerRepeatLabel(timer),
    nextAction: '',
    state,
    overdue: state === 'overdue',
    weekendQuiet: false,
    pinned: false,
    href: `/countdowns.html?open=${encodeURIComponent(timer.id)}`,
    blocksTime: false,
  };
}

function timerOccurrences(raw, range, now, options = {}) {
  const timer = resetTimers.normalizeTimer(raw);
  if (!timer || !timer.id || timer.deleted) return [];
  // An 'office' record mirrors an Agent Office countdown, which is already on
  // the calendar from its own store. Showing both would draw it twice.
  if (timer.source === 'office') return [];
  if (!Number.isFinite(timer.targetMs)) return [];
  if ((timer.status === 'paused' || timer.status === 'completed') && !options.includeInactive) return [];

  const target = new Date(timer.targetMs);
  const step = stepTimer(timer);
  if (!step) {
    const inRange = target.getTime() >= range.from.getTime() && target.getTime() < range.to.getTime();
    return inRange ? [timerItem(timer, raw, target, now)] : [];
  }
  return walkOccurrences(target, step, {
    from: range.from,
    to: range.to,
    floor: repeatFloor(now),
  }).map(at => timerItem(timer, raw, at, now));
}

// ─── The payload ─────────────────────────────────────────────────────────────

function byTime(a, b) {
  return Date.parse(a.at) - Date.parse(b.at) || String(a.title).localeCompare(String(b.title));
}

/**
 * The next thing each record is waiting on, soonest first, with overdue
 * one-offs leading — the same rule the Countdowns page follows. Independent of
 * the range on screen, so a month view of March still says what is due today.
 */
function selectUpcoming(options) {
  const { countdownRecords, timerRecords, now, includeInactive, categories } = options;
  const lookahead = { from: new Date(0), to: countdowns.addDays(startOfDay(now), MAX_RANGE_DAYS) };
  const nextFor = items => {
    const overdue = items.find(item => item.overdue);
    if (overdue) return overdue;
    return items.find(item => Date.parse(item.at) >= now.getTime()) || null;
  };
  const picks = [];
  countdownRecords.forEach(record => {
    const pick = nextFor(countdownOccurrences(record, lookahead, now, categories));
    if (pick) picks.push(pick);
  });
  timerRecords.forEach(raw => {
    const pick = nextFor(timerOccurrences(raw, lookahead, now, { includeInactive }));
    if (pick) picks.push(pick);
  });
  return picks
    .sort((a, b) => (a.overdue === b.overdue ? byTime(a, b) : a.overdue ? -1 : 1))
    .slice(0, UPCOMING_LIMIT);
}

/**
 * Every countdown and timer occurrence inside the range, plus the short list
 * of what is next.
 *
 * @param {object} options
 * @param {Array}  options.countdowns  Stored Agent Office countdown rows.
 * @param {Array}  options.timers      Stored Countdown Timer records (raw).
 * @param {Array}  [options.categories] The saved category list, for labels.
 * @param {Date}   options.from
 * @param {Date}   options.to
 * @param {Date}   [options.now]
 * @param {boolean}[options.includeInactive] Show paused and completed timers.
 */
function buildCalendarCountdowns(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const range = { from: options.from, to: options.to };
  const countdownRecords = Array.isArray(options.countdowns) ? options.countdowns : [];
  const timerRecords = Array.isArray(options.timers) ? options.timers : [];
  const includeInactive = Boolean(options.includeInactive);
  const categories = Array.isArray(options.categories) ? options.categories : countdowns.CATEGORIES;

  const items = [];
  countdownRecords.forEach(record => items.push(...countdownOccurrences(record, range, now, categories)));
  timerRecords.forEach(raw => items.push(...timerOccurrences(raw, range, now, { includeInactive })));
  items.sort(byTime);

  return {
    now: now.toISOString(),
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    items,
    upcoming: selectUpcoming({ countdownRecords, timerRecords, now, includeInactive, categories }),
    counts: {
      items: items.length,
      countdowns: items.filter(item => item.source === 'countdown').length,
      timers: items.filter(item => item.source === 'timer').length,
      overdue: items.filter(item => item.overdue).length,
    },
  };
}

// The hub's calendar uses the same occurrences as this app's day view, rather
// than the capped/overdue-ranked widget list. Keep today's passed routines and
// both stores, but only send the fields a dashboard row can draw.
function selectTodayCountdowns(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const from = startOfDay(now);
  const to = countdowns.addDays(from, 1);
  return buildCalendarCountdowns({ ...options, now, from, to }).items.map(item => ({
    id: item.id,
    title: item.title,
    startAt: item.at,
    endAt: null,
    allDay: false,
    kind: item.source === 'timer' ? 'resetTimer' : 'countdown',
    url: item.href,
    state: item.state,
  }));
}

module.exports = {
  MAX_RANGE_DAYS,
  buildCalendarCountdowns,
  countdownOccurrences,
  parseRange,
  selectTodayCountdowns,
  timerOccurrences,
};
