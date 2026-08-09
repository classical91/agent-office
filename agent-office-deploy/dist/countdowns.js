'use strict';

// Countdowns — the "how long have I got" side of planning.
//
// This is not the Calendar and it is not Streaks. A calendar event answers
// "what is happening at 2pm"; a streak answers "did I keep it up today". A
// countdown answers "how long until the thing, and what do I do next about it",
// which is why every card carries a next action and nothing here has an end
// time.
//
// Everything in this file is pure: dates in, plain objects out. The server owns
// storage and Google, so this module can be tested without either.

const CATEGORIES = [
  { id: 'deadline', label: 'Deadline', color: '#ef4444' },
  { id: 'goal', label: 'Goal', color: '#6366f1' },
  { id: 'shift', label: 'Work Shift', color: '#38bdf8' },
  { id: 'routine', label: 'Routine', color: '#22c55e' },
  { id: 'trading', label: 'Trading', color: '#f59e0b' },
  { id: 'personal', label: 'Personal', color: '#a855f7' },
];

const CATEGORY_IDS = CATEGORIES.map(item => item.id);
const DEFAULT_CATEGORY = 'deadline';
const FALLBACK_COLOR = '#94a3b8';

// `weekday` is daily with the weekend cut out — the shape a Mon–Fri routine
// actually has. `none` is a one-off: it goes overdue and stays there until it
// is dealt with, because a deadline that quietly rolls forward is not a
// deadline.
const REPEATS = ['none', 'daily', 'weekday', 'weekly', 'monthly'];
const DEFAULT_REPEAT = 'none';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// A repeating countdown whose target is years behind should not be advanced one
// step at a time forever. Nothing legitimate needs more than a few thousand.
const MAX_ROLL_STEPS = 5000;

// ─── Small helpers ───────────────────────────────────────────────────────────

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// Adding a month to the 31st lands on the 1st or the 3rd depending on the
// month, which reads as a bug on a card. Clamp to the last day instead so
// "monthly on the 31st" means the end of every month.
function addMonths(date, months) {
  const day = date.getDate();
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

function categoryLabel(id) {
  const known = CATEGORIES.find(item => item.id === id);
  if (known) return known.label;
  return String(id || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Deadline';
}

function categoryColor(id) {
  const known = CATEGORIES.find(item => item.id === id);
  return known ? known.color : FALLBACK_COLOR;
}

function normalizeCategory(value) {
  const slug = String(value || '').trim().toLowerCase();
  return CATEGORY_IDS.includes(slug) ? slug : DEFAULT_CATEGORY;
}

function normalizeRepeat(value) {
  const slug = String(value || '').trim().toLowerCase();
  return REPEATS.includes(slug) ? slug : DEFAULT_REPEAT;
}

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateCountdownInput(input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }

  const value = {};

  if (input.title !== undefined || !partial) {
    const title = cleanText(input.title, 160);
    if (!title) return { ok: false, error: 'A countdown needs a title.' };
    value.title = title;
  }

  if (input.target_at !== undefined || input.targetAt !== undefined || !partial) {
    const raw = input.target_at !== undefined ? input.target_at : input.targetAt;
    const target = toDate(raw);
    if (!target) return { ok: false, error: 'target_at must be a date and time.' };
    value.target_at = target.toISOString();
  }

  if (input.category !== undefined || !partial) value.category = normalizeCategory(input.category);
  if (input.repeat !== undefined || !partial) value.repeat = normalizeRepeat(input.repeat);
  if (input.next_action !== undefined || input.nextAction !== undefined || !partial) {
    value.next_action = cleanText(
      input.next_action !== undefined ? input.next_action : input.nextAction,
      300
    );
  }
  if (input.notes !== undefined || !partial) value.notes = cleanText(input.notes, 600);
  if (input.pinned !== undefined) value.pinned = Boolean(input.pinned);
  else if (!partial) value.pinned = false;
  if (input.archived !== undefined) value.archived = Boolean(input.archived);
  else if (!partial) value.archived = false;

  if (partial && Object.keys(value).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }
  return { ok: true, value };
}

// ─── When does it next land ──────────────────────────────────────────────────

// Trading countdowns and weekday routines never land on a Saturday or a Sunday:
// the market is shut and the point of this page is not to invent weekend work.
function skipsWeekends(countdown) {
  return normalizeCategory(countdown.category) === 'trading'
    || normalizeRepeat(countdown.repeat) === 'weekday';
}

function stepOccurrence(date, repeat) {
  switch (repeat) {
    case 'daily':
    case 'weekday':
      return addDays(date, 1);
    case 'weekly':
      return addDays(date, 7);
    case 'monthly':
      return addMonths(date, 1);
    default:
      return null;
  }
}

/**
 * The next time this countdown comes due.
 *
 * A one-off returns its target even when that target is in the past — an
 * overdue deadline is the single most important thing this page can show, and
 * rolling it forward would hide it. A repeating countdown walks forward from
 * its target to the first occurrence still ahead of `now`, skipping weekends
 * when the countdown is one that should not fall on one.
 *
 * @returns {Date|null} null when target_at is unusable.
 */
function nextOccurrence(countdown, now = new Date()) {
  const target = toDate(countdown.target_at || countdown.targetAt);
  if (!target) return null;

  const repeat = normalizeRepeat(countdown.repeat);
  if (repeat === 'none') return target;

  const avoidWeekend = skipsWeekends(countdown);
  let candidate = new Date(target);

  for (let step = 0; step < MAX_ROLL_STEPS; step += 1) {
    if (candidate.getTime() > now.getTime() && !(avoidWeekend && isWeekend(candidate))) {
      return candidate;
    }
    const next = stepOccurrence(candidate, repeat);
    if (!next) return candidate;
    candidate = next;
  }
  return candidate;
}

// ─── How long is left ────────────────────────────────────────────────────────

function pluralize(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/**
 * Turn a gap in milliseconds into the phrase a card shows.
 *
 * The unit shrinks as the gap does: days while there is more than a day, then
 * hours, then minutes. "0 days" on the morning of the deadline is useless.
 */
function describeRemaining(ms) {
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / DAY_MS);
  const hours = Math.floor((abs % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((abs % HOUR_MS) / MINUTE_MS);

  let label;
  if (days > 0) label = hours > 0 ? `${pluralize(days, 'day')} ${pluralize(hours, 'hr')}` : pluralize(days, 'day');
  else if (hours > 0) label = minutes > 0 ? `${pluralize(hours, 'hr')} ${pluralize(minutes, 'min')}` : pluralize(hours, 'hr');
  else if (minutes > 0) label = pluralize(minutes, 'min');
  else label = 'now';

  return {
    ms,
    overdue,
    days: overdue ? -days : days,
    hours,
    minutes,
    label: overdue ? (label === 'now' ? 'now' : `${label} ago`) : label,
  };
}

/**
 * Which of the three sections an instant belongs in.
 *
 * The week runs to the end of the sixth day after today rather than to Sunday:
 * "this week" on a Friday should not mean "the next 36 hours".
 */
function bucketFor(date, now = new Date()) {
  const today = startOfDay(now);
  if (date.getTime() < now.getTime() && date.getTime() < today.getTime()) return 'past';
  const endOfToday = addDays(today, 1);
  if (date.getTime() < endOfToday.getTime()) return 'today';
  if (date.getTime() < addDays(today, 7).getTime()) return 'week';
  return 'later';
}

// ─── Decorating for the client ───────────────────────────────────────────────

/**
 * A countdown plus everything the card needs worked out on the server, so a
 * phone and a browser show the same numbers.
 */
function decorateCountdown(countdown, now = new Date()) {
  const category = normalizeCategory(countdown.category);
  const repeat = normalizeRepeat(countdown.repeat);
  const occurrence = nextOccurrence(countdown, now);
  const remaining = occurrence ? describeRemaining(occurrence.getTime() - now.getTime()) : null;
  const bucket = occurrence ? bucketFor(occurrence, now) : 'later';

  // "No weekend active-trade pressure": a trading card goes quiet both on the
  // weekend itself and when its next occurrence lands on one. Quiet cards are
  // still shown — they are just never urgent and never lead the roll-up.
  const weekendQuiet = category === 'trading' && (isWeekend(now) || (occurrence ? isWeekend(occurrence) : false));

  return {
    id: countdown.id,
    kind: 'countdown',
    title: countdown.title || '',
    category,
    categoryLabel: categoryLabel(category),
    color: categoryColor(category),
    repeat,
    next_action: countdown.next_action || '',
    notes: countdown.notes || '',
    pinned: Boolean(countdown.pinned),
    archived: Boolean(countdown.archived),
    target_at: countdown.target_at || null,
    occurrence_at: occurrence ? occurrence.toISOString() : null,
    created_at: countdown.created_at || null,
    updated_at: countdown.updated_at || null,
    remaining,
    bucket,
    overdue: Boolean(remaining && remaining.overdue),
    weekendQuiet,
    urgent: Boolean(remaining && !weekendQuiet && (remaining.overdue || bucket === 'today')),
  };
}

/**
 * A calendar event in the same shape as a countdown card.
 *
 * Events arrive flattened by the server (`{ id, title, start, end }`), so this
 * does not care whether Google or local storage produced them.
 */
function decorateEvent(event, now = new Date()) {
  const start = toDate(event.start);
  if (!start) return null;
  const end = toDate(event.end);
  const remaining = describeRemaining(start.getTime() - now.getTime());
  const bucket = bucketFor(start, now);

  return {
    id: `event:${event.id}`,
    kind: 'event',
    title: event.title || '(untitled event)',
    category: 'calendar',
    categoryLabel: 'Calendar',
    color: '#38bdf8',
    repeat: 'none',
    next_action: '',
    notes: '',
    pinned: false,
    archived: false,
    target_at: start.toISOString(),
    occurrence_at: start.toISOString(),
    end_at: end ? end.toISOString() : null,
    // An event that started an hour ago and runs until five is happening now,
    // not late.
    inProgress: Boolean(end && start.getTime() <= now.getTime() && end.getTime() > now.getTime()),
    remaining,
    bucket,
    overdue: false,
    weekendQuiet: false,
    urgent: bucket === 'today' && !remaining.overdue,
  };
}

function sortItems(items) {
  return items.slice().sort((a, b) => {
    // Pinned cards lead their section; past-due work leads everything.
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aTime = a.occurrence_at ? Date.parse(a.occurrence_at) : Infinity;
    const bTime = b.occurrence_at ? Date.parse(b.occurrence_at) : Infinity;
    if (aTime !== bTime) return aTime - bTime;
    return String(a.title).localeCompare(String(b.title));
  });
}

/**
 * Build the whole page payload: every card, grouped into Today / This Week /
 * Later.
 *
 * @param {object} options
 * @param {Array}  options.countdowns Stored countdown rows.
 * @param {Array}  options.events     Flattened calendar events, or [].
 * @param {Date}   [options.now]
 * @param {number} [options.horizonDays] How far out events are worth showing.
 * @param {boolean}[options.includeArchived]
 */
function buildUpcoming(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const horizonDays = Number.isFinite(options.horizonDays) ? options.horizonDays : 60;
  const horizon = addDays(startOfDay(now), horizonDays).getTime();
  const includeArchived = Boolean(options.includeArchived);

  const countdowns = (Array.isArray(options.countdowns) ? options.countdowns : [])
    .map(item => decorateCountdown(item, now))
    .filter(item => includeArchived || !item.archived);

  const events = (Array.isArray(options.events) ? options.events : [])
    .map(item => decorateEvent(item, now))
    .filter(Boolean)
    // An event is worth showing until it is over, so a meeting you are sitting
    // in stays on the page.
    .filter(item => {
      const endsAt = item.end_at ? Date.parse(item.end_at) : Date.parse(item.occurrence_at);
      return endsAt >= now.getTime() && Date.parse(item.occurrence_at) <= horizon;
    });

  const items = sortItems([...countdowns, ...events]);
  const groups = { today: [], week: [], later: [] };
  items.forEach(item => {
    // Overdue work is not a fourth section — it sits at the top of Today, where
    // it is impossible to scroll past.
    const key = item.bucket === 'past' ? 'today' : item.bucket;
    groups[key].push(item);
  });

  return {
    now: now.toISOString(),
    items,
    groups,
    counts: {
      today: groups.today.length,
      week: groups.week.length,
      later: groups.later.length,
      overdue: items.filter(item => item.overdue).length,
      countdowns: countdowns.length,
      events: events.length,
    },
  };
}

// ─── The evening roll-up ─────────────────────────────────────────────────────

function formatClock(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDay(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * The lines the evening roll-up pastes in.
 *
 * Quiet trading cards are left out on purpose: the roll-up is the nudge, and
 * nudging about a trade on a Saturday night is exactly the pressure this page
 * is meant not to add. They stay visible on the page itself.
 */
function selectRollupItems(payload, limit = 5) {
  const max = Math.max(1, Math.min(Number(limit) || 5, 20));
  return payload.items
    .filter(item => !item.weekendQuiet)
    .filter(item => item.bucket !== 'later' || item.pinned)
    .slice(0, max);
}

function formatRollupText(payload, limit = 5) {
  const now = new Date(payload.now);
  const selected = selectRollupItems(payload, limit);
  if (!selected.length) return `Countdowns — ${formatDay(now)}\nNothing due in the next week.`;

  const lines = selected.map(item => {
    const at = new Date(item.occurrence_at);
    const when = item.overdue
      ? `overdue ${item.remaining.label}`
      : `${item.remaining.label} — ${formatDay(at)} ${formatClock(at)}`;
    const action = item.next_action ? ` → ${item.next_action}` : '';
    return `• ${item.title} (${when})${action}`;
  });

  return [`Countdowns — ${formatDay(now)}`, ...lines].join('\n');
}

module.exports = {
  CATEGORIES,
  REPEATS,
  addDays,
  addMonths,
  bucketFor,
  buildUpcoming,
  decorateCountdown,
  decorateEvent,
  describeRemaining,
  formatRollupText,
  isWeekend,
  nextOccurrence,
  normalizeCategory,
  normalizeRepeat,
  selectRollupItems,
  validateCountdownInput,
};
