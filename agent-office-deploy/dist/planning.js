'use strict';

// Planning Mode — the weekly planning checklist behind /planning.html.
//
// This is not the calendar and it is not a to-do list. It is the manual bridge
// between "things I want to get done this week" and CoachClaw's scheduling
// pass: the list is kept by hand, it survives the week, and ticking an item is
// a *scheduling request* rather than a claim that the work is finished.
//
// That distinction is the whole reason a planning item is not a checkbox with a
// title on it. `schedule_this_week` says "CoachClaw should find time for this";
// `completed` says "this actually happened". Ticking Workout on Sunday for a
// Wednesday session must not mark the workout done, and finishing it on
// Wednesday must not quietly drop it out of the list you plan from next Sunday.
// Two fields, two meanings, and nothing reads one for the other.
//
// Everything here is pure: records in, records out. The server owns storage and
// the HTTP surface, which is what lets the rules — what a valid item is, which
// items CoachClaw is being asked to schedule, what the scheduler is told about
// each of them — be tested without a server.

const STORAGE_KEY = 'planning-items.v1';

// A planning list is a week's intentions, not an archive. The caps are here so
// a runaway client cannot turn one app_settings row into a database problem.
const MAX_ITEMS = 300;
const MAX_ENCODED_LENGTH = 250000;
const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;

const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const DEFAULT_PRIORITY = 'normal';

// Minutes. Five is the smallest block worth putting on a calendar; a day is the
// most a single planning item can honestly claim.
const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 24 * 60;
// What CoachClaw assumes when an item does not say how long it takes. Deliberate
// and visible rather than buried in the scheduler: an hour is long enough to be
// worth blocking and short enough that a wrong guess is cheap.
const DEFAULT_DURATION_MINUTES = 60;

// A preferred time is either a clock time or one of these windows, because
// "sometime in the morning" is how people actually plan and "09:00" is not the
// same promise. Days are ISO weekdays (Monday = 1), matching
// calendar-scheduling.js so a brief can be handed straight to it.
const NAMED_WINDOWS = {
  morning: { start: '06:00', end: '12:00' },
  afternoon: { start: '12:00', end: '17:00' },
  evening: { start: '17:00', end: '22:00' },
};

const CLOCK_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+$/g, '').trim().slice(0, max);
}

function normalizeBoolean(value, fallback = false) {
  if (value === true || value === false) return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

function normalizePriority(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase();
  return PRIORITIES.includes(text) ? text : DEFAULT_PRIORITY;
}

// null, not a default: "I have not said how long this takes" and "this takes an
// hour" are different facts, and only the scheduler gets to turn the first into
// the second.
function normalizeDuration(value) {
  if (value === null || value === undefined || value === '') return null;
  const minutes = Math.round(Number(value));
  if (!Number.isFinite(minutes)) return null;
  if (minutes < MIN_DURATION_MINUTES) return MIN_DURATION_MINUTES;
  if (minutes > MAX_DURATION_MINUTES) return MAX_DURATION_MINUTES;
  return minutes;
}

function normalizePreferredDays(value) {
  if (!Array.isArray(value)) return [];
  const days = value
    .map(entry => Math.round(Number(entry)))
    .filter(day => Number.isInteger(day) && day >= 1 && day <= 7);
  return [...new Set(days)].sort((a, b) => a - b);
}

function normalizePreferredTime(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase();
  if (!text) return '';
  if (NAMED_WINDOWS[text]) return text;
  const match = CLOCK_PATTERN.exec(text);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function normalizeTimestamp(value, fallback) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return fallback;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

// The record every other function in here agrees on. Unknown fields are dropped
// rather than carried: this shape is the contract with CoachClaw, and a store
// that quietly keeps whatever a client posted is not a contract.
function normalizeItem(raw, now = new Date().toISOString()) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const title = cleanText(source.title, MAX_TITLE_LENGTH);
  if (!title) return null;
  const createdAt = normalizeTimestamp(source.created_at, now);
  const completed = normalizeBoolean(source.completed, false);
  return {
    id: cleanText(source.id, 80) || makeId(),
    title,
    notes: cleanText(source.notes, MAX_NOTES_LENGTH),
    // Two independent states. See the note at the top of this file.
    completed,
    completed_at: completed ? normalizeTimestamp(source.completed_at, now) : null,
    schedule_this_week: normalizeBoolean(source.schedule_this_week, false),
    estimated_duration: normalizeDuration(source.estimated_duration),
    priority: normalizePriority(source.priority),
    preferred_days: normalizePreferredDays(source.preferred_days),
    preferred_time: normalizePreferredTime(source.preferred_time),
    created_at: createdAt,
    updated_at: normalizeTimestamp(source.updated_at, createdAt),
  };
}

function makeId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `plan-${Date.now().toString(36)}-${random}`;
}

function normalizeItems(list, now = new Date().toISOString()) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const items = [];
  list.forEach(entry => {
    const item = normalizeItem(entry, now);
    if (!item || seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  });
  return items.slice(0, MAX_ITEMS);
}

function parseStoredItems(raw) {
  if (!raw) return [];
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch { return []; }
  if (Array.isArray(parsed)) return normalizeItems(parsed);
  return normalizeItems(parsed && parsed.items);
}

function encodeItems(items) {
  return JSON.stringify(items);
}

// Input validation is separate from normalization because a client that sends
// nonsense should be told, not silently corrected. Normalization is for records
// that are already in the store.
function validateInput(raw, partial = false) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const value = {};

  if (source.title !== undefined || !partial) {
    const title = cleanText(source.title, MAX_TITLE_LENGTH);
    if (!title) return { ok: false, error: 'A planning item needs a title.' };
    value.title = title;
  }
  if (source.notes !== undefined) value.notes = cleanText(source.notes, MAX_NOTES_LENGTH);
  if (source.completed !== undefined) value.completed = normalizeBoolean(source.completed, false);
  if (source.schedule_this_week !== undefined) {
    value.schedule_this_week = normalizeBoolean(source.schedule_this_week, false);
  }
  if (source.estimated_duration !== undefined) {
    if (source.estimated_duration !== null && source.estimated_duration !== ''
      && !Number.isFinite(Number(source.estimated_duration))) {
      return { ok: false, error: 'estimated_duration must be a number of minutes.' };
    }
    value.estimated_duration = normalizeDuration(source.estimated_duration);
  }
  if (source.priority !== undefined) {
    const priority = String(source.priority || '').trim().toLowerCase();
    if (priority && !PRIORITIES.includes(priority)) {
      return { ok: false, error: `priority must be one of ${PRIORITIES.join(', ')}.` };
    }
    value.priority = normalizePriority(priority);
  }
  if (source.preferred_days !== undefined) {
    if (source.preferred_days !== null && !Array.isArray(source.preferred_days)) {
      return { ok: false, error: 'preferred_days must be an array of ISO weekdays (Monday = 1).' };
    }
    value.preferred_days = normalizePreferredDays(source.preferred_days);
  }
  if (source.preferred_time !== undefined) {
    const preferred = normalizePreferredTime(source.preferred_time);
    if (source.preferred_time && !preferred) {
      return {
        ok: false,
        error: `preferred_time must be HH:MM or one of ${Object.keys(NAMED_WINDOWS).join(', ')}.`,
      };
    }
    value.preferred_time = preferred;
  }

  if (!partial && value.title === undefined) return { ok: false, error: 'A planning item needs a title.' };
  if (partial && Object.keys(value).length === 0) return { ok: false, error: 'Nothing to update.' };
  return { ok: true, value };
}

function createItem(input, now = new Date().toISOString()) {
  return normalizeItem({
    id: makeId(),
    schedule_this_week: true,
    ...input,
    created_at: now,
    updated_at: now,
  }, now);
}

// Applying a patch is where the two states could most easily be confused, so
// this is the only place either of them moves. Completing an item stamps
// completed_at and stops it being scheduled again; un-completing clears the
// stamp and leaves the scheduling flag exactly where the user last put it.
function applyUpdate(item, patch, now = new Date().toISOString()) {
  const next = { ...item, ...patch, id: item.id, created_at: item.created_at, updated_at: now };
  if (patch.completed !== undefined && patch.completed !== item.completed) {
    next.completed_at = patch.completed ? now : null;
    if (patch.completed && patch.schedule_this_week === undefined) next.schedule_this_week = false;
  }
  return normalizeItem(next, now);
}

function summarize(items) {
  return {
    total: items.length,
    scheduled: items.filter(item => item.schedule_this_week && !item.completed).length,
    completed: items.filter(item => item.completed).length,
    // Kept for later: unchecked items are not scheduled this week and are not
    // deleted either. That is the point of the list.
    parked: items.filter(item => !item.schedule_this_week && !item.completed).length,
  };
}

// What CoachClaw is actually being asked to schedule.
//
// A completed item is never scheduled even if its box is still ticked — the
// tick is a request and the request has been satisfied. An unticked item is
// left alone entirely: it stays in the list and out of the week.
function selectSchedulableItems(items) {
  return items.filter(item => item.schedule_this_week && !item.completed);
}

function preferredWindowFor(item) {
  if (!item.preferred_time) return null;
  if (NAMED_WINDOWS[item.preferred_time]) return { ...NAMED_WINDOWS[item.preferred_time] };
  // A clock time is a start, not a window: give the scheduler the hour around
  // it rather than pretending the user asked for a single 15-minute slot.
  const [hours, minutes] = item.preferred_time.split(':').map(Number);
  const startMinutes = Math.max(0, hours * 60 + minutes);
  const endMinutes = Math.min(24 * 60 - 1, startMinutes + 60);
  const format = total => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  return { start: format(startMinutes), end: format(endMinutes) };
}

// Step 2 of the weekly build: the checklist, in the shape the scheduler reads.
// Each entry carries a `request` that can be handed to
// calendar-scheduling.suggestSlots() as-is, plus the preferences that scheduler
// does not model itself and CoachClaw applies when it picks between slots.
function buildSchedulingBrief(items, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const generatedAt = Number.isNaN(now.getTime()) ? new Date() : now;
  const schedulable = selectSchedulableItems(items);
  return {
    version: 1,
    generated_at: generatedAt.toISOString(),
    default_duration_minutes: DEFAULT_DURATION_MINUTES,
    counts: summarize(items),
    items: schedulable.map(item => ({
      id: item.id,
      title: item.title,
      notes: item.notes,
      request: {
        durationMinutes: item.estimated_duration || DEFAULT_DURATION_MINUTES,
        priority: item.priority,
        // The scheduler reads energy when it decides whether a short slot will
        // do; a high-priority intention is the one worth protecting.
        energy: item.priority === 'urgent' || item.priority === 'high' ? 'high' : 'medium',
      },
      duration_is_estimated: !item.estimated_duration,
      preferred_days: item.preferred_days,
      preferred_time: item.preferred_time,
      preferred_window: preferredWindowFor(item),
    })),
  };
}

module.exports = {
  DEFAULT_DURATION_MINUTES,
  DEFAULT_PRIORITY,
  MAX_DURATION_MINUTES,
  MAX_ENCODED_LENGTH,
  MAX_ITEMS,
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
  MIN_DURATION_MINUTES,
  NAMED_WINDOWS,
  PRIORITIES,
  STORAGE_KEY,
  applyUpdate,
  buildSchedulingBrief,
  createItem,
  encodeItems,
  makeId,
  normalizeItem,
  normalizeItems,
  parseStoredItems,
  preferredWindowFor,
  selectSchedulableItems,
  summarize,
  validateInput,
};
