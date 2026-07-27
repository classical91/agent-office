'use strict';

// Scheduling policy for the Agent Office calendar.
//
// The old rule was "first window that fits between 08:00 and 18:00". That is
// only correct when every hour of the day is worth the same, which is never
// true: a 90 minute agent run wants a deep-work block, a review wants to sit
// after the thing it reviews, and nothing wants to land in the ten minutes
// before a meeting.
//
// So this module does two separate jobs:
//   1. work out which windows are genuinely free, given the user's declared
//      working hours, sleep, commitments, lunch and meeting buffers;
//   2. *score* those windows instead of taking the first one.
//
// All times are handled in the runtime's local timezone.

const MINUTES = 60 * 1000;
const SLOT_GRANULARITY_MINUTES = 15;

const DEFAULT_PREFERENCES = {
  workdayStart: '09:00',
  workdayEnd: '18:00',
  sleepStart: '23:00',
  sleepEnd: '07:00',
  minFocusMinutes: 45,
  meetingBufferMinutes: 10,
  recoveryMinutes: 15,
  lunch: { start: '12:00', durationMinutes: 45 },
  deepWorkWindows: [{ start: '09:00', end: '12:00' }],
  maxConcurrentAgentRuns: 2,
  // [{ label, days: [1..7, Monday = 1], start: 'HH:MM', end: 'HH:MM' }]
  commitments: [],
  workingDays: [1, 2, 3, 4, 5],
  allowWeekends: false,
  autoMoveMovableEvents: true,
};

const PRIORITY_SCORE = { low: 0.15, normal: 0.4, high: 0.75, urgent: 1 };

// Weights are deliberately visible: the whole point of scoring is that you can
// see why a slot won.
const WEIGHTS = {
  urgency: 30,
  preferredTime: 20,
  projectPriority: 15,
  dependencyReadiness: 15,
  interruptionCost: 20,
  contextSwitchCost: 15,
  conflictRisk: 45,
};

function clamp(value, min = 0, max = 1) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function parseClock(text, fallbackMinutes = 0) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(text || '').trim());
  if (!match) return fallbackMinutes;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallbackMinutes;
  return hours * 60 + minutes;
}

function formatClock(minutes) {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(total / 60);
  return `${String(hours).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function atMinutes(date, minutes) {
  const d = startOfDay(date);
  d.setMinutes(minutes);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Monday = 1 ... Sunday = 7, which is what the commitment editor uses.
function isoWeekday(date) {
  return ((date.getDay() + 6) % 7) + 1;
}

function toDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeWindowList(list, fallback) {
  if (!Array.isArray(list)) return fallback.map(item => ({ ...item }));
  const windows = list
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const start = parseClock(item.start, -1);
      const end = parseClock(item.end, -1);
      if (start < 0 || end < 0 || end <= start) return null;
      return { start: formatClock(start), end: formatClock(end) };
    })
    .filter(Boolean);
  return windows;
}

function normalizeCommitments(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const start = parseClock(item.start, -1);
      const end = parseClock(item.end, -1);
      if (start < 0 || end < 0 || end <= start) return null;
      const days = Array.isArray(item.days)
        ? item.days.map(day => normalizeInt(day, 0, 1, 7)).filter(Boolean)
        : [1, 2, 3, 4, 5];
      return {
        label: String(item.label || 'Commitment').slice(0, 80),
        days: days.length ? Array.from(new Set(days)).sort() : [1, 2, 3, 4, 5],
        start: formatClock(start),
        end: formatClock(end),
      };
    })
    .filter(Boolean)
    .slice(0, 40);
}

function normalizePreferences(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const workdayStart = parseClock(input.workdayStart, parseClock(DEFAULT_PREFERENCES.workdayStart));
  let workdayEnd = parseClock(input.workdayEnd, parseClock(DEFAULT_PREFERENCES.workdayEnd));
  // A workday that ends before it starts is a typo, not an overnight shift.
  if (workdayEnd <= workdayStart) workdayEnd = Math.min(1439, workdayStart + 60);

  const workingDays = Array.isArray(input.workingDays)
    ? Array.from(new Set(input.workingDays.map(day => normalizeInt(day, 0, 1, 7)).filter(Boolean))).sort()
    : DEFAULT_PREFERENCES.workingDays.slice();

  const lunchInput = input.lunch && typeof input.lunch === 'object' ? input.lunch : {};

  return {
    workdayStart: formatClock(workdayStart),
    workdayEnd: formatClock(workdayEnd),
    sleepStart: formatClock(parseClock(input.sleepStart, parseClock(DEFAULT_PREFERENCES.sleepStart))),
    sleepEnd: formatClock(parseClock(input.sleepEnd, parseClock(DEFAULT_PREFERENCES.sleepEnd))),
    minFocusMinutes: normalizeInt(input.minFocusMinutes, DEFAULT_PREFERENCES.minFocusMinutes, 5, 480),
    meetingBufferMinutes: normalizeInt(input.meetingBufferMinutes, DEFAULT_PREFERENCES.meetingBufferMinutes, 0, 120),
    recoveryMinutes: normalizeInt(input.recoveryMinutes, DEFAULT_PREFERENCES.recoveryMinutes, 0, 120),
    lunch: {
      start: formatClock(parseClock(lunchInput.start, parseClock(DEFAULT_PREFERENCES.lunch.start))),
      durationMinutes: normalizeInt(lunchInput.durationMinutes, DEFAULT_PREFERENCES.lunch.durationMinutes, 0, 240),
    },
    deepWorkWindows: normalizeWindowList(input.deepWorkWindows, DEFAULT_PREFERENCES.deepWorkWindows),
    maxConcurrentAgentRuns: normalizeInt(input.maxConcurrentAgentRuns, DEFAULT_PREFERENCES.maxConcurrentAgentRuns, 1, 20),
    commitments: normalizeCommitments(input.commitments),
    workingDays: workingDays.length ? workingDays : DEFAULT_PREFERENCES.workingDays.slice(),
    allowWeekends: input.allowWeekends === undefined
      ? DEFAULT_PREFERENCES.allowWeekends
      : Boolean(input.allowWeekends),
    autoMoveMovableEvents: input.autoMoveMovableEvents === undefined
      ? DEFAULT_PREFERENCES.autoMoveMovableEvents
      : Boolean(input.autoMoveMovableEvents),
  };
}

// ── Busy / free windows ────────────────────────────────────────────────────

function mergeIntervals(intervals) {
  const sorted = intervals
    .filter(item => item && item.end > item.start)
    .sort((a, b) => a.start - b.start);
  const merged = [];
  sorted.forEach(interval => {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      if (interval.end > last.end) last.end = interval.end;
      return;
    }
    merged.push({ start: interval.start, end: interval.end });
  });
  return merged;
}

function normalizeEvent(event) {
  if (!event || typeof event !== 'object') return null;
  const start = toDate(event.start && event.start.dateTime ? event.start.dateTime : event.start);
  const end = toDate(event.end && event.end.dateTime ? event.end.dateTime : event.end);
  if (!start || !end || end <= start) return null;
  const meta = event.meta && typeof event.meta === 'object' ? event.meta : {};
  return {
    id: event.id || event.serverId || '',
    title: event.title || event.summary || '',
    start,
    end,
    meta,
    movable: meta.movable === true,
  };
}

// Busy blocks for one day: real events (padded by the meeting buffer), lunch,
// recurring commitments and anything outside the working window.
function busyIntervalsForDay(day, events, prefs) {
  const preferences = normalizePreferences(prefs);
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const buffer = preferences.meetingBufferMinutes * MINUTES;
  const intervals = [];

  events.forEach(raw => {
    const event = normalizeEvent(raw);
    if (!event) return;
    if (event.end <= dayStart || event.start >= dayEnd) return;
    // Movable agent blocks are not treated as immovable walls when the policy
    // allows rearranging them, but they still cost something (see conflictRisk).
    if (event.movable && preferences.autoMoveMovableEvents) return;
    intervals.push({
      start: new Date(event.start.getTime() - buffer),
      end: new Date(event.end.getTime() + buffer),
    });
  });

  if (preferences.lunch.durationMinutes > 0) {
    const lunchStart = atMinutes(dayStart, parseClock(preferences.lunch.start));
    intervals.push({
      start: lunchStart,
      end: new Date(lunchStart.getTime() + preferences.lunch.durationMinutes * MINUTES),
    });
  }

  const weekday = isoWeekday(dayStart);
  preferences.commitments.forEach(commitment => {
    if (!commitment.days.includes(weekday)) return;
    intervals.push({
      start: atMinutes(dayStart, parseClock(commitment.start)),
      end: atMinutes(dayStart, parseClock(commitment.end)),
    });
  });

  return mergeIntervals(intervals);
}

function workingWindowForDay(day, prefs) {
  const preferences = normalizePreferences(prefs);
  const dayStart = startOfDay(day);
  const weekday = isoWeekday(dayStart);
  if (!preferences.workingDays.includes(weekday) && !preferences.allowWeekends) return null;

  const sleepEnd = parseClock(preferences.sleepEnd);
  const sleepStart = parseClock(preferences.sleepStart);
  // Sleep clips the working window from both ends; an overnight sleep block
  // (23:00 → 07:00) means "no earlier than 07:00, no later than 23:00".
  const from = Math.max(parseClock(preferences.workdayStart), sleepEnd);
  const to = Math.min(parseClock(preferences.workdayEnd), sleepStart > sleepEnd ? sleepStart : 1439);
  if (to <= from) return null;
  return { start: atMinutes(dayStart, from), end: atMinutes(dayStart, to) };
}

function freeWindowsForDay(day, events, prefs) {
  const window = workingWindowForDay(day, prefs);
  if (!window) return [];
  const busy = busyIntervalsForDay(day, events, prefs);
  const free = [];
  let cursor = window.start;
  busy.forEach(interval => {
    if (interval.end <= cursor) return;
    if (interval.start > cursor) {
      free.push({ start: cursor, end: new Date(Math.min(interval.start, window.end)) });
    }
    if (interval.end > cursor) cursor = interval.end;
    if (cursor >= window.end) cursor = window.end;
  });
  if (cursor < window.end) free.push({ start: cursor, end: window.end });
  return free.filter(item => item.end > item.start);
}

// ── Scoring ────────────────────────────────────────────────────────────────

function overlapMinutes(aStart, aEnd, bStart, bEnd) {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return end > start ? (end - start) / MINUTES : 0;
}

function deepWorkOverlapFraction(slotStart, slotEnd, prefs) {
  const durationMinutes = (slotEnd - slotStart) / MINUTES;
  if (durationMinutes <= 0) return 0;
  const dayStart = startOfDay(slotStart);
  let covered = 0;
  prefs.deepWorkWindows.forEach(window => {
    covered += overlapMinutes(
      slotStart.getTime(),
      slotEnd.getTime(),
      atMinutes(dayStart, parseClock(window.start)).getTime(),
      atMinutes(dayStart, parseClock(window.end)).getTime()
    );
  });
  return clamp(covered / durationMinutes);
}

function concurrentAgentRunsDuring(slotStart, slotEnd, events) {
  let peak = 0;
  const running = events
    .map(normalizeEvent)
    .filter(event => event && event.meta && event.meta.executionMode === 'agent-run');
  running.forEach(event => {
    if (overlapMinutes(slotStart.getTime(), slotEnd.getTime(), event.start.getTime(), event.end.getTime()) <= 0) return;
    peak += 1;
  });
  return peak;
}

function neighbouringEvents(slotStart, slotEnd, events) {
  let before = null;
  let after = null;
  events.map(normalizeEvent).filter(Boolean).forEach(event => {
    if (event.end <= slotStart && (!before || event.end > before.end)) before = event;
    if (event.start >= slotEnd && (!after || event.start < after.start)) after = event;
  });
  return { before, after };
}

/**
 * Score one candidate slot.
 *
 *   slotScore = urgency + preferredTime + projectPriority + dependencyReadiness
 *             - interruptionCost - contextSwitchCost - conflictRisk
 *
 * Each term is normalized to 0..1 and then weighted, so the breakdown that
 * comes back is directly explainable in the UI.
 */
function scoreSlot(slot, request, prefs, context = {}) {
  const preferences = normalizePreferences(prefs);
  const events = Array.isArray(context.events) ? context.events : [];
  const now = toDate(context.now) || new Date();
  const horizonDays = normalizeInt(context.horizonDays, 14, 1, 90);

  const slotStart = toDate(slot.start);
  const slotEnd = toDate(slot.end);
  const durationMinutes = (slotEnd - slotStart) / MINUTES;
  const deadline = request.deadline ? toDate(request.deadline) : null;
  const reasons = [];
  const warnings = [];

  // urgency - a near deadline pulls a slot forward; with no deadline, sooner
  // still beats later, but much more gently.
  let urgency;
  if (deadline) {
    const totalMs = Math.max(1, deadline.getTime() - now.getTime());
    const remainingMs = deadline.getTime() - slotEnd.getTime();
    urgency = clamp(1 - remainingMs / totalMs);
    if (remainingMs < 0) warnings.push('Finishes after the deadline');
    else if (urgency > 0.7) reasons.push('Lands close to the deadline');
  } else {
    const hoursOut = Math.max(0, (slotStart.getTime() - now.getTime()) / (60 * MINUTES));
    urgency = 0.35 + 0.4 * (1 - clamp(hoursOut / (24 * horizonDays)));
  }

  // preferredTime - deep-work overlap, inverted for work that wants low energy.
  const deepWork = deepWorkOverlapFraction(slotStart, slotEnd, preferences);
  const energy = String(request.energy || 'medium').toLowerCase();
  let preferredTime = energy === 'low' ? 1 - deepWork : deepWork;
  if (energy === 'medium') preferredTime = 0.4 + 0.6 * deepWork;
  if (deepWork >= 0.9 && energy !== 'low') reasons.push('Inside a deep-work window');

  const projectPriority = PRIORITY_SCORE[String(request.priority || 'normal').toLowerCase()] ?? PRIORITY_SCORE.normal;

  // dependencyReadiness - every prerequisite must already be finished.
  const dependencies = Array.isArray(request.dependsOn) ? request.dependsOn : [];
  let dependencyReadiness = 1;
  if (dependencies.length) {
    const byId = new Map(events.map(normalizeEvent).filter(Boolean).map(event => [event.id, event]));
    const unmet = dependencies.filter(id => {
      const dependency = byId.get(id);
      if (!dependency) return false;
      return dependency.end > slotStart;
    });
    dependencyReadiness = unmet.length ? 0 : 1;
    if (unmet.length) warnings.push('Starts before its prerequisites finish');
  }

  // interruptionCost - crowding against neighbours, and fragments too small to
  // use left on either side.
  const { before, after } = neighbouringEvents(slotStart, slotEnd, events);
  let interruptionCost = 0;
  const bufferMs = preferences.meetingBufferMinutes * MINUTES;
  if (before && slotStart.getTime() - before.end.getTime() < bufferMs) interruptionCost += 0.5;
  if (after && after.start.getTime() - slotEnd.getTime() < bufferMs) interruptionCost += 0.5;
  const windowEnd = toDate(slot.windowEnd) || slotEnd;
  const windowStart = toDate(slot.windowStart) || slotStart;
  const leadingGap = (slotStart - windowStart) / MINUTES;
  const trailingGap = (windowEnd - slotEnd) / MINUTES;
  if (leadingGap > 0 && leadingGap < preferences.minFocusMinutes) interruptionCost += 0.25;
  if (trailingGap > 0 && trailingGap < preferences.minFocusMinutes) interruptionCost += 0.25;
  interruptionCost = clamp(interruptionCost);

  // contextSwitchCost - the adjacent block belonging to another project costs
  // more than one belonging to another agent on the same project.
  let contextSwitchCost = 0;
  [before, after].forEach(neighbour => {
    if (!neighbour) return;
    // Sitting right after a block this request depends on is the point, not a
    // switch: a review is *supposed* to follow the run it reviews.
    if (dependencies.includes(neighbour.id)) {
      reasons.push('Follows the work it depends on');
      return;
    }
    const gapMinutes = neighbour === before
      ? (slotStart - neighbour.end) / MINUTES
      : (neighbour.start - slotEnd) / MINUTES;
    if (gapMinutes > 60) return;
    const sameProject = request.projectId && neighbour.meta.projectId === request.projectId;
    const sameAgent = request.agentId && neighbour.meta.agentId === request.agentId;
    if (sameProject) return;
    contextSwitchCost += neighbour.meta.projectId ? 0.5 : 0.25;
    if (sameAgent) contextSwitchCost -= 0.15;
  });
  contextSwitchCost = clamp(contextSwitchCost);

  // conflictRisk - the hard failures: missing the deadline, running outside the
  // working window, or exceeding the agent-run concurrency cap.
  let conflictRisk = 0;
  if (deadline && slotEnd > deadline) conflictRisk += 1;
  const window = workingWindowForDay(slotStart, preferences);
  if (!window || slotStart < window.start || slotEnd > window.end) {
    conflictRisk += 0.6;
    warnings.push('Outside the working window');
  }
  if (String(request.executionMode || '') === 'agent-run') {
    const concurrent = concurrentAgentRunsDuring(slotStart, slotEnd, events);
    if (concurrent >= preferences.maxConcurrentAgentRuns) {
      conflictRisk += 0.8;
      warnings.push(`Already ${concurrent} agent runs in that window`);
    }
  }
  if (durationMinutes < preferences.minFocusMinutes && String(request.energy || '') === 'high') {
    conflictRisk += 0.3;
  }
  conflictRisk = clamp(conflictRisk);

  const breakdown = {
    urgency: Number((urgency * WEIGHTS.urgency).toFixed(2)),
    preferredTime: Number((preferredTime * WEIGHTS.preferredTime).toFixed(2)),
    projectPriority: Number((projectPriority * WEIGHTS.projectPriority).toFixed(2)),
    dependencyReadiness: Number((dependencyReadiness * WEIGHTS.dependencyReadiness).toFixed(2)),
    interruptionCost: Number((-interruptionCost * WEIGHTS.interruptionCost).toFixed(2)),
    contextSwitchCost: Number((-contextSwitchCost * WEIGHTS.contextSwitchCost).toFixed(2)),
    conflictRisk: Number((-conflictRisk * WEIGHTS.conflictRisk).toFixed(2)),
  };

  const score = Number(
    Object.keys(breakdown).reduce((total, key) => total + breakdown[key], 0).toFixed(2)
  );

  return { score, breakdown, reasons, warnings, viable: conflictRisk < 1 };
}

/**
 * Walk the next `horizonDays` days, cut every free window into candidate slots
 * and return the best ones.
 */
function suggestSlots(options = {}) {
  const preferences = normalizePreferences(options.preferences);
  const events = Array.isArray(options.events) ? options.events : [];
  const now = toDate(options.now) || new Date();
  const request = options.request && typeof options.request === 'object' ? options.request : {};
  const horizonDays = normalizeInt(options.horizonDays, 14, 1, 90);
  const limit = normalizeInt(options.limit, 5, 1, 50);
  const durationMinutes = normalizeInt(
    request.durationMinutes,
    Math.max(preferences.minFocusMinutes, 60),
    5,
    12 * 60
  );
  const earliest = toDate(request.notBefore) || now;
  const candidates = [];

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset += 1) {
    const day = addDays(startOfDay(now), dayOffset);
    freeWindowsForDay(day, events, preferences).forEach(window => {
      const windowMinutes = (window.end - window.start) / MINUTES;
      if (windowMinutes < durationMinutes) return;
      const step = SLOT_GRANULARITY_MINUTES * MINUTES;
      // Align the first candidate to the granularity grid so suggestions land
      // on clean times rather than 10:07.
      const alignedStart = Math.ceil(window.start.getTime() / step) * step;
      for (let time = alignedStart; time + durationMinutes * MINUTES <= window.end.getTime(); time += step) {
        const slotStart = new Date(time);
        if (slotStart < earliest) continue;
        const slotEnd = new Date(time + durationMinutes * MINUTES);
        const scored = scoreSlot(
          { start: slotStart, end: slotEnd, windowStart: window.start, windowEnd: window.end },
          request,
          preferences,
          { events, now, horizonDays }
        );
        candidates.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          durationMinutes,
          ...scored,
        });
      }
    });
  }

  candidates.sort((a, b) => b.score - a.score || new Date(a.start) - new Date(b.start));

  // One suggestion per distinct start time is plenty; adjacent 15-minute shifts
  // of the same window are noise.
  const seenDays = new Map();
  const spread = [];
  candidates.forEach(candidate => {
    const dayKey = candidate.start.slice(0, 10);
    const perDay = seenDays.get(dayKey) || 0;
    if (perDay >= 2) return;
    seenDays.set(dayKey, perDay + 1);
    spread.push(candidate);
  });

  return spread.slice(0, limit);
}

// ── Natural language ───────────────────────────────────────────────────────
//
// "Have Codex work on Flashcards tomorrow for 90 minutes after my last
// appointment, then have Guardian review the result."

const ACTION_WORDS = [
  { action: 'implementation', patterns: ['work on', 'build', 'implement', 'ship', 'code'] },
  { action: 'review', patterns: ['review', 'check', 'audit', 'inspect'] },
  { action: 'research', patterns: ['research', 'investigate', 'look into', 'explore'] },
  { action: 'writing', patterns: ['write', 'draft', 'document'] },
  { action: 'fix', patterns: ['fix', 'debug', 'repair', 'patch'] },
];

function matchNamed(text, candidates) {
  const haystack = text.toLowerCase();
  let best = null;
  (candidates || []).forEach(candidate => {
    const names = [candidate.id, candidate.name, candidate.slug].filter(Boolean).map(String);
    names.forEach(name => {
      const needle = name.toLowerCase();
      if (needle.length < 3 || !haystack.includes(needle)) return;
      if (!best || needle.length > best.matched.length) {
        best = { id: candidate.id || candidate.slug || candidate.name, name: candidate.name || candidate.id, matched: needle };
      }
    });
  });
  return best;
}

function detectAction(text) {
  const haystack = text.toLowerCase();
  const found = ACTION_WORDS.find(entry => entry.patterns.some(pattern => haystack.includes(pattern)));
  return found ? found.action : 'implementation';
}

function detectDuration(text) {
  const hourMatch = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i.exec(text);
  if (hourMatch) return Math.round(Number(hourMatch[1]) * 60);
  const minuteMatch = /(\d+)\s*(?:minutes?|mins?|m)\b/i.exec(text);
  if (minuteMatch) return Number(minuteMatch[1]);
  return null;
}

function detectConstraint(text) {
  const haystack = text.toLowerCase();
  if (/after my last (appointment|meeting|event)/.test(haystack)) return 'after-last-appointment';
  if (/before my first (appointment|meeting|event)/.test(haystack)) return 'before-first-appointment';
  if (/\bmorning\b/.test(haystack)) return 'morning';
  if (/\bafternoon\b/.test(haystack)) return 'afternoon';
  if (/\bevening\b/.test(haystack)) return 'evening';
  if (/\bas soon as possible|\basap\b/.test(haystack)) return 'asap';
  return null;
}

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function detectDay(text, now) {
  const haystack = text.toLowerCase();
  const today = startOfDay(now);
  if (/\btoday\b/.test(haystack)) return today;
  if (/\btomorrow\b/.test(haystack)) return addDays(today, 1);
  const explicit = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(haystack);
  if (explicit) return startOfDay(new Date(`${explicit[1]}-${explicit[2]}-${explicit[3]}T00:00`));
  for (let index = 0; index < WEEKDAY_NAMES.length; index += 1) {
    if (!new RegExp(`\\b${WEEKDAY_NAMES[index]}\\b`).test(haystack)) continue;
    const delta = ((index - today.getDay()) + 7) % 7 || 7;
    return addDays(today, delta);
  }
  return null;
}

function detectPriority(text) {
  const haystack = text.toLowerCase();
  if (/\burgent|critical|right now|immediately\b/.test(haystack)) return 'urgent';
  if (/\bhigh priority|important\b/.test(haystack)) return 'high';
  if (/\blow priority|whenever|sometime\b/.test(haystack)) return 'low';
  return 'normal';
}

/**
 * Turn one sentence into a structured request, including a follow-up step when
 * the sentence chains one ("... then have Guardian review the result").
 * Returns a plan description only - nothing is created here.
 */
function parseScheduleRequest(text, context = {}) {
  const raw = String(text || '').trim();
  if (!raw) return { ok: false, error: 'Nothing to schedule.' };
  const now = toDate(context.now) || new Date();
  const agents = context.agents || [];
  const projects = context.projects || [];

  const [primaryText, ...followUpParts] = raw.split(/\bthen\b/i);
  const followUpText = followUpParts.join(' then ').trim();

  const agent = matchNamed(primaryText, agents);
  const project = matchNamed(primaryText, projects);
  const durationMinutes = detectDuration(primaryText) || (agent ? 60 : 45);

  const request = {
    text: raw,
    agent: agent ? agent.id : null,
    agentName: agent ? agent.name : null,
    project: project ? project.id : null,
    projectName: project ? project.name : null,
    action: detectAction(primaryText),
    durationMinutes,
    constraint: detectConstraint(primaryText),
    priority: detectPriority(primaryText),
    day: detectDay(primaryText, now),
    executionMode: agent ? 'agent-run' : 'manual',
    followUp: null,
  };

  if (followUpText) {
    const followAgent = matchNamed(followUpText, agents);
    request.followUp = {
      agent: followAgent ? followAgent.id : null,
      agentName: followAgent ? followAgent.name : null,
      action: detectAction(followUpText),
      durationMinutes: detectDuration(followUpText) || 30,
      executionMode: followAgent ? 'agent-run' : 'manual',
    };
  }

  return { ok: true, request };
}

// Build a human-readable title such as "Codex: Flashcards implementation".
function describeRequest(request) {
  const who = request.agentName || request.agent;
  const what = request.projectName || request.project;
  const action = request.action || 'work';
  if (who && what) return `${who}: ${what} ${action}`;
  if (who) return `${who}: ${action}`;
  if (what) return `${what} ${action}`;
  return action.charAt(0).toUpperCase() + action.slice(1);
}

module.exports = {
  DEFAULT_PREFERENCES,
  WEIGHTS,
  SLOT_GRANULARITY_MINUTES,
  normalizePreferences,
  parseClock,
  formatClock,
  workingWindowForDay,
  busyIntervalsForDay,
  freeWindowsForDay,
  scoreSlot,
  suggestSlots,
  parseScheduleRequest,
  describeRequest,
};
