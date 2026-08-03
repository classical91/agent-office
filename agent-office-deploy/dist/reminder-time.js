'use strict';

// Reminder times arrive from three places that all speak different dialects:
// the Dropbox capture form ("tomorrow 9am"), an iOS Shortcut ("in 45m", or a
// formatted date from a Date action), and the API ("2026-08-05T09:00:00Z").
// Everything funnels through parseReminderTime so a reminder means the same
// instant wherever it was typed.
//
// All day/time arithmetic is local to the server's timezone (server.js pins
// process.env.TZ from APP_TIMEZONE), because "tomorrow at 9" is a statement
// about the user's clock, not UTC.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// A bare day with no time attached ("tomorrow", "friday") lands here.
const DEFAULT_HOUR = 9;
const DEFAULT_MINUTE = 0;

// Guardrails: a typo like "in 900000 days" should be rejected rather than
// stored as a reminder no one will ever see.
const MAX_FUTURE_MS = 5 * 365 * DAY;

const DURATION_UNITS = {
  m: MINUTE, min: MINUTE, mins: MINUTE, minute: MINUTE, minutes: MINUTE,
  h: HOUR, hr: HOUR, hrs: HOUR, hour: HOUR, hours: HOUR,
  d: DAY, day: DAY, days: DAY,
  w: 7 * DAY, wk: 7 * DAY, wks: 7 * DAY, week: 7 * DAY, weeks: 7 * DAY,
};

const WEEKDAYS = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const NAMED_TIMES = {
  morning: [9, 0],
  noon: [12, 0],
  midday: [12, 0],
  lunch: [12, 0],
  afternoon: [14, 0],
  evening: [18, 0],
  tonight: [20, 0],
  night: [20, 0],
  midnight: [0, 0],
};

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function atTime(base, hour, minute) {
  const date = new Date(base.getTime());
  date.setHours(hour, minute, 0, 0);
  return date;
}

function addDays(base, days) {
  const date = new Date(base.getTime());
  date.setDate(date.getDate() + days);
  return date;
}

function normalize(value) {
  return String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// "1h 30m", "in 2 hours", "45m from now" -> milliseconds. Returns null unless
// the whole string is durations, so "2 hours before the meeting" is not
// silently read as "2 hours".
function parseDurationMs(text) {
  const cleaned = normalize(text)
    .replace(/^(?:in|after|\+)\s*/, '')
    .replace(/\s*from now$/, '')
    .trim();
  if (!cleaned) return null;

  const token = /^(\d+(?:\.\d+)?)\s*([a-z]+)\s*(?:,|and\b)?\s*/;
  let rest = cleaned;
  let total = 0;
  let matched = 0;

  while (rest) {
    const match = token.exec(rest);
    if (!match) return null;
    const unit = DURATION_UNITS[match[2]];
    if (unit === undefined) return null;
    total += Number(match[1]) * unit;
    rest = rest.slice(match[0].length);
    matched += 1;
  }

  return matched ? total : null;
}

// Pulls a time off the end of a phrase: "tomorrow 9am", "friday at 17:30",
// "monday evening". Returns { hour, minute, rest } with the time removed, or
// null when the phrase carries no time.
function extractTimeOfDay(text) {
  const named = /\b(?:at\s+|in\s+the\s+)?(morning|noon|midday|lunch|afternoon|evening|tonight|night|midnight)\b/.exec(text);
  if (named) {
    const [hour, minute] = NAMED_TIMES[named[1]];
    return { hour, minute, rest: (text.slice(0, named.index) + text.slice(named.index + named[0].length)).trim() };
  }

  const clock = /\b(?:at\s+|@\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(?:at\s+|@\s*)?(\d{1,2}):(\d{2})\b/.exec(text);
  if (!clock) return null;

  let hour;
  let minute;
  if (clock[3]) {
    hour = Number(clock[1]) % 12;
    minute = Number(clock[2] || 0);
    if (clock[3] === 'pm') hour += 12;
  } else {
    hour = Number(clock[4]);
    minute = Number(clock[5]);
  }
  if (hour > 23 || minute > 59) return null;

  return { hour, minute, rest: (text.slice(0, clock.index) + text.slice(clock.index + clock[0].length)).trim() };
}

function parseDayPhrase(text, now, time) {
  const hour = time ? time.hour : DEFAULT_HOUR;
  const minute = time ? time.minute : DEFAULT_MINUTE;
  const words = text.replace(/^(?:on|this)\s+/, '').trim();

  if (!words) {
    // A bare time: "9am" means the next 9am, today or tomorrow.
    if (!time) return null;
    const candidate = atTime(now, hour, minute);
    return candidate.getTime() > now.getTime() ? candidate : addDays(candidate, 1);
  }

  if (words === 'today') return atTime(now, hour, minute);
  if (words === 'tomorrow') return atTime(addDays(now, 1), hour, minute);
  if (words === 'next week') return atTime(addDays(now, 7), hour, minute);
  if (words === 'next month') {
    const next = new Date(now.getTime());
    next.setMonth(next.getMonth() + 1);
    return atTime(next, hour, minute);
  }

  const weekdayMatch = /^(?:next\s+)?([a-z]+)$/.exec(words);
  if (weekdayMatch && WEEKDAYS[weekdayMatch[1]] !== undefined) {
    const target = WEEKDAYS[weekdayMatch[1]];
    const forceNextWeek = words.startsWith('next ');
    let delta = (target - now.getDay() + 7) % 7;
    // "monday" on a Monday means the one coming up, not five minutes ago.
    // "next monday" always skips a whole week rather than landing on today.
    if (delta === 0 && (forceNextWeek || atTime(now, hour, minute).getTime() <= now.getTime())) delta = 7;
    return atTime(addDays(now, delta), hour, minute);
  }

  return null;
}

// A date-only ISO string is midnight UTC to `new Date`, which reads as the
// evening before for anyone west of Greenwich. Treat it as a local day, at the
// same default hour a bare "tomorrow" gets.
function parseIsoLike(text, hasExplicitTime) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    const base = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), DEFAULT_HOUR, DEFAULT_MINUTE);
    return isValidDate(base) ? base : null;
  }
  if (!hasExplicitTime) return null;
  const parsed = new Date(text);
  return isValidDate(parsed) ? parsed : null;
}

/**
 * Parse a reminder time written by a human, a Shortcut, or an API client.
 *
 * @param {*} value                Raw input. Empty/null clears the reminder.
 * @param {{now?: Date}} [options]
 * @returns {{ok: true, at: Date|null} | {ok: false, error: string}}
 */
function parseReminderTime(value, options = {}) {
  const now = isValidDate(options.now) ? new Date(options.now.getTime()) : new Date();

  if (value instanceof Date) {
    return isValidDate(value) ? { ok: true, at: value } : { ok: false, error: 'Reminder time is not a valid date.' };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Epoch milliseconds (what Shortcuts hands back from a Date action).
    return { ok: true, at: new Date(value) };
  }

  const raw = String(value == null ? '' : value).trim();
  if (!raw) return { ok: true, at: null };

  const text = normalize(raw);
  if (text === 'none' || text === 'never' || text === 'clear') return { ok: true, at: null };
  if (text === 'now') return { ok: true, at: now };

  const durationMs = parseDurationMs(text);
  if (durationMs !== null) {
    if (durationMs > MAX_FUTURE_MS) return { ok: false, error: 'Reminder time is too far in the future.' };
    return { ok: true, at: new Date(now.getTime() + durationMs) };
  }

  const time = extractTimeOfDay(text);
  const dayText = time ? time.rest : text;
  const fromPhrase = parseDayPhrase(dayText, now, time);
  if (fromPhrase) return finish(fromPhrase, now);

  const fromIso = parseIsoLike(raw.trim(), /[t\s]\d{1,2}:\d{2}/.test(text));
  if (fromIso) return finish(fromIso, now);

  return {
    ok: false,
    error: 'Could not read that reminder time. Try "in 2h", "tomorrow 9am", "friday", or an ISO timestamp.',
  };
}

function finish(at, now) {
  if (!isValidDate(at)) return { ok: false, error: 'Reminder time is not a valid date.' };
  if (at.getTime() - now.getTime() > MAX_FUTURE_MS) {
    return { ok: false, error: 'Reminder time is too far in the future.' };
  }
  return { ok: true, at };
}

function formatRelative(ms) {
  const abs = Math.abs(ms);
  if (abs < MINUTE) return 'now';
  if (abs < HOUR) return `${Math.round(abs / MINUTE)}m`;
  if (abs < DAY) {
    const hours = Math.floor(abs / HOUR);
    const minutes = Math.round((abs % HOUR) / MINUTE);
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  const days = Math.round(abs / DAY);
  return days === 1 ? '1 day' : `${days} days`;
}

/**
 * Describe a reminder for display: an absolute label, a relative one, and
 * whether it has already come due.
 *
 * @param {Date|string|null} at
 * @param {Date} [now]
 * @returns {{at: string, label: string, relative: string, due: boolean}|null}
 */
function describeReminder(at, now = new Date()) {
  const date = at instanceof Date ? at : at ? new Date(at) : null;
  if (!isValidDate(date)) return null;

  const delta = date.getTime() - now.getTime();
  const sameDay = date.toDateString() === now.toDateString();
  const label = sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return {
    at: date.toISOString(),
    label,
    relative: delta >= 0 ? `in ${formatRelative(delta)}` : `${formatRelative(delta)} overdue`,
    due: delta <= 0,
  };
}

module.exports = {
  parseReminderTime,
  parseDurationMs,
  describeReminder,
  DEFAULT_HOUR,
  MAX_FUTURE_MS,
};
