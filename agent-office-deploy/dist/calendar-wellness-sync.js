'use strict';

// Workouts and meals, written into Google Calendar.
//
// The Calendar's Wellness layer (calendar-wellness.js) draws the Wellness
// Tracker's rota and Nutri-Mind's planned meals without storing anything. That
// keeps them off every other calendar app, so this module also writes them to
// Google as real events — and keeps them in step as the plans change.
//
// Every event it writes is tagged in Google's private extended properties:
//
//   aoSource       'wellness' — the only events this module ever reads back,
//                  changes or deletes. Nothing else on the calendar is touched.
//   aoWellnessKey  which item it is: `workout:2026-10-26`, `meal:2026-10-26:night`.
//   aoWellnessHash a hash of what was last written for that item.
//
// One pass looks at today and the six days after it (the meal plan's rolling
// week, used for workouts too so the calendar is not filled months ahead):
//
//   - an item with no event gets one;
//   - an item whose content changed in its app (the hash differs) is rewritten;
//   - an item that is unchanged is left alone, so moving its event by hand in
//     Google sticks until the plan itself changes;
//   - an event whose item is gone (a meal un-ticked, a dinner cleared) is
//     deleted — but only when that source answered `ok`. A source that is down,
//     refused or not configured deletes nothing: an outage must never read as
//     "everything was cancelled".
//
// Days before today are never touched, so last week's events stay as a record.
//
// Everything is driven through an injected `api` (list / create / patch /
// remove), so the whole pass can be run against a fake Google in tests.

const crypto = require('crypto');

const SOURCE_TAG = 'wellness';
const HORIZON_DAYS = 7;
const MEAL_MINUTES = 30;
const DEFAULT_WORKOUT_MINUTES = 30;
const MIN_WORKOUT_MINUTES = 10;
const MAX_WORKOUT_MINUTES = 180;
// Google's event colours: Basil for workouts, Banana for meals.
const COLOR_IDS = { workout: '10', meal: '5' };
// Which Agent Office event type each kind reads as on its own Calendar.
const EVENT_TYPES = { workout: 'task', meal: 'reminder' };
// The source each kind comes from, as calendar-wellness.js reports them.
const SOURCE_OF = { workout: 'workout', meal: 'meals' };

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** The syncing window: today and the six days after it, in the app's timezone. */
function syncWindow(now) {
  const from = startOfDay(now);
  return { from, to: addDays(from, HORIZON_DAYS) };
}

/**
 * How long a day's workout runs, from the minutes in its items' details
 * ("30 min", "10–15 min" counts as 10). Unreadable details fall back to half
 * an hour rather than inventing precision.
 */
function workoutMinutes(lines) {
  let total = 0;
  (Array.isArray(lines) ? lines : []).forEach(line => {
    const match = /(\d{1,3})\s*(?:[–-]\s*\d{1,3}\s*)?min/i.exec(String((line && line.detail) || ''));
    if (match) total += Number(match[1]);
  });
  if (!total) return DEFAULT_WORKOUT_MINUTES;
  return Math.min(MAX_WORKOUT_MINUTES, Math.max(MIN_WORKOUT_MINUTES, total));
}

function describe(item) {
  const lines = (item.lines || []).map(line => {
    const head = [line.emoji, line.text].filter(Boolean).join(' ');
    return '• ' + head + (line.detail ? ' — ' + line.detail : '');
  });
  return lines.concat([
    '',
    `From ${item.appLabel}: ${item.href}`,
    `Added by Agent Office from your ${item.source === 'meal' ? 'meal plan' : 'workout plan'}. Change it in ${item.appLabel}; this event follows on the next sync.`,
  ]).join('\n').trim();
}

/**
 * The Google event body for one wellness item, and the hash that says whether
 * it has changed since it was last written. The hash covers what this module
 * decides — not what Google adds — so a plan that has not changed hashes the
 * same every time.
 */
function eventFor(item, timeZone) {
  const start = new Date(item.at);
  const minutes = item.source === 'meal' ? MEAL_MINUTES : workoutMinutes(item.lines);
  const end = new Date(start.getTime() + minutes * 60 * 1000);
  const summary = item.source === 'meal'
    ? `${item.emoji} ${item.label}: ${item.title}`
    : `${item.emoji} ${item.title}`;
  const content = {
    summary,
    description: describe(item),
    start: { dateTime: start.toISOString(), timeZone },
    end: { dateTime: end.toISOString(), timeZone },
    colorId: COLOR_IDS[item.source] || undefined,
    // Three meal pings a day would be noise; a workout keeps the calendar's
    // own default reminder.
    reminders: item.source === 'meal' ? { useDefault: false, overrides: [] } : { useDefault: true },
  };
  const hash = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 32);
  return {
    hash,
    body: {
      ...content,
      extendedProperties: {
        private: {
          aoSource: SOURCE_TAG,
          aoWellnessKey: item.id,
          aoWellnessHash: hash,
          agentOfficeType: EVENT_TYPES[item.source] || 'reminder',
        },
      },
    },
  };
}

function privateOf(event) {
  return (event && event.extendedProperties && event.extendedProperties.private) || {};
}

function kindOfKey(key) {
  return String(key || '').split(':')[0];
}

/**
 * What one pass has to do, worked out without touching Google.
 *
 * @param {object} options
 * @param {Array}  options.items    Wellness items in the window (calendar-wellness.js).
 * @param {object} options.sources  How each source answered: `{ workout, meals }`.
 * @param {Array}  options.existing Google events tagged `aoSource: wellness` in the window.
 * @param {string} options.timeZone
 */
function planSync({ items, sources, existing, timeZone }) {
  const desired = new Map();
  (Array.isArray(items) ? items : []).forEach(item => {
    if (!item || !item.id || !item.at || desired.has(item.id)) return;
    desired.set(item.id, eventFor(item, timeZone));
  });

  const creates = [];
  const updates = [];
  const deletes = [];
  const seen = new Set();

  (Array.isArray(existing) ? existing : []).forEach(event => {
    const tags = privateOf(event);
    if (tags.aoSource !== SOURCE_TAG || !event.id) return;
    const key = tags.aoWellnessKey;
    const want = desired.get(key);
    if (!want) {
      // Gone from its app. Only a source that answered may take an event away.
      const source = sources && sources[SOURCE_OF[kindOfKey(key)]];
      if (source && source.state === 'ok') deletes.push({ id: event.id, key });
      return;
    }
    if (seen.has(key)) {
      // Two events for one item — a pass that was interrupted between its
      // create and its record. Keep the first, drop the rest.
      deletes.push({ id: event.id, key });
      return;
    }
    seen.add(key);
    if (tags.aoWellnessHash !== want.hash) updates.push({ id: event.id, key, body: want.body });
  });

  desired.forEach((want, key) => {
    if (!seen.has(key)) creates.push({ key, body: want.body });
  });

  return { creates, updates, deletes };
}

/**
 * One full pass: read the plans, read what was written before, and bring
 * Google in line.
 *
 * @param {object} options
 * @param {(range: {from: Date, to: Date, now: Date}) => Promise<object>} options.readWellness
 *        calendar-wellness.js's reader, bound to its configuration.
 * @param {object} options.api  `{ list({timeMin, timeMax}), create(body), patch(id, body), remove(id) }`
 * @param {Date}   [options.now]
 * @param {string} [options.timeZone]
 */
async function runWellnessSync({ readWellness, api, now = new Date(), timeZone }) {
  const window = syncWindow(now);
  const wellness = await readWellness({ from: window.from, to: window.to, now });
  const existing = await api.list({ timeMin: window.from.toISOString(), timeMax: window.to.toISOString() });
  const plan = planSync({
    // Past items in today (this morning's breakfast) are still written, so
    // today reads whole in Google too.
    items: (wellness.items || []).filter(item => Date.parse(item.at) >= window.from.getTime()),
    sources: wellness.sources,
    existing,
    timeZone,
  });

  const result = { created: 0, updated: 0, deleted: 0, failed: 0, errors: [] };
  const attempt = async (count, work, key) => {
    try {
      await work();
      result[count] += 1;
    } catch (error) {
      result.failed += 1;
      if (result.errors.length < 5) result.errors.push(`${key}: ${(error && error.message) || 'failed'}`);
    }
  };
  // One at a time: a week is a few dozen writes, and Google rate-limits bursts.
  for (const op of plan.deletes) await attempt('deleted', () => api.remove(op.id), op.key);
  for (const op of plan.updates) await attempt('updated', () => api.patch(op.id, op.body), op.key);
  for (const op of plan.creates) await attempt('created', () => api.create(op.body), op.key);

  return {
    ranAt: now.toISOString(),
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    sources: wellness.sources,
    items: (wellness.items || []).length,
    ...result,
  };
}

module.exports = {
  HORIZON_DAYS,
  SOURCE_TAG,
  eventFor,
  planSync,
  runWellnessSync,
  syncWindow,
  workoutMinutes,
};
