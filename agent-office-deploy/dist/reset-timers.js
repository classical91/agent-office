'use strict';

// Reset Timers — the personal countdown cards on /resets.html.
//
// These are not the Agent Office Countdowns in countdowns.js. A countdown is a
// planning card with a category, a next action and a place in Today / This Week
// / Later. A reset timer is a stopwatch with a phone number on it: it counts
// down to a usage-window reset or a chore, and when it lands it pushes a
// notification to Pushcut. The two pages share the Countdowns screen and
// nothing else, so they stay in separate modules.
//
// Everything here is pure except deliverWebhook(): records in, records out. The
// server owns storage and the timer loop, which is what lets the delivery
// decisions - is this due, has it already been sent, may it be retried yet - be
// tested without a server and without ever touching Pushcut.

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const STORAGE_KEY = 'reset-timers.v1';
const MAX_TIMERS = 200;
const MAX_ENCODED_LENGTH = 250000;

// A repeating timer whose reset time is years behind should not be stepped
// forward one day at a time forever. countdowns.js draws the same line.
const MAX_ROLL_STEPS = 5000;

// Delivery defaults. The first retry waits five minutes and each one after that
// doubles, up to two hours: a Pushcut outage costs a handful of requests a day
// rather than one every cycle, and a typo'd URL is not hammered at all.
const RETRY_BASE_MS = 5 * MINUTE_MS;
const RETRY_MAX_MS = 2 * HOUR_MS;

// How late a notification may be and still be worth sending. A timer that
// landed while the server was down for an hour is still news; one that landed
// last week is noise, and a page full of them - which is exactly what the first
// deploy of server-side delivery meets - should not become a burst of
// notifications. Late occurrences are marked handled instead, so a repeating
// timer still rolls on to its next one.
const LATE_GRACE_MS = 24 * HOUR_MS;

const DELIVERY_TIMEOUT_MS = 10 * 1000;
const STATE_FILTERS = ['active', 'paused', 'expired', 'completed', 'all'];

// ─── Records ─────────────────────────────────────────────────────────────────

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function toIso(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

/**
 * One stored timer in the shape the rest of this module expects.
 *
 * The browser writes these records, so everything is treated as untrusted and
 * every field has a fallback. Notification metadata is carried through rather
 * than defaulted away: it is the record of what has already been sent, and
 * losing it means sending it again.
 *
 * @returns {object|null} null when the record is not an object at all.
 */
function normalizeTimer(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const repeatDays = Number(raw.repeatDays);
  const status = raw.status === 'paused' || raw.status === 'completed' ? raw.status : 'active';
  const resetAt = toIso(raw.resetAt);

  return {
    id: String(raw.id || ''),
    title: cleanText(raw.title, 160) || 'Untitled countdown',
    resetAt,
    targetMs: resetAt ? Date.parse(resetAt) : NaN,
    webhookUrl: typeof raw.webhookUrl === 'string' ? raw.webhookUrl.trim() : '',
    repeatDays: Number.isFinite(repeatDays) && repeatDays > 0 ? Math.round(repeatDays) : 0,
    status,
    deleted: Boolean(raw.deleted),
    source: raw.source === 'office' ? 'office' : 'browser',
    fired: Boolean(raw.fired),
    firedAt: toIso(raw.firedAt),
    firedForResetAt: toIso(raw.firedForResetAt),
    lastNotificationAttemptAt: toIso(raw.lastNotificationAttemptAt),
    lastNotificationError: cleanText(raw.lastNotificationError, 300),
    notificationAttempts: Number.isFinite(Number(raw.notificationAttempts))
      ? Math.max(0, Math.round(Number(raw.notificationAttempts)))
      : 0,
    notificationOccurrence: toIso(raw.notificationOccurrence),
    updatedAt: toIso(raw.updatedAt),
  };
}

function normalizeTimers(items) {
  return (Array.isArray(items) ? items : []).map(normalizeTimer).filter(Boolean);
}

/**
 * What a stored PUT body is allowed to be.
 *
 * Records are stored verbatim rather than normalized, because the browser owns
 * their shape and a rewrite here would quietly drop fields the page adds later.
 * The checks are therefore about size and type only.
 */
function validateStoredItems(items) {
  if (!Array.isArray(items)) {
    return { ok: false, status: 400, error: 'items must be an array with no more than 200 timers.' };
  }
  if (items.length > MAX_TIMERS) {
    return { ok: false, status: 400, error: `items must be an array with no more than ${MAX_TIMERS} timers.` };
  }
  if (items.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
    return { ok: false, status: 400, error: 'Every timer must be an object.' };
  }

  const encoded = JSON.stringify(items);
  if (encoded.length > MAX_ENCODED_LENGTH) {
    return { ok: false, status: 413, error: 'Reset timer data is too large.' };
  }
  return { ok: true, encoded };
}

function parseStoredTimers(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Reading a timer ─────────────────────────────────────────────────────────

/**
 * The four states a card can be in, worked out the same way the page does it:
 * an explicit status wins, otherwise a timer that has run out is expired.
 */
function deriveState(timer, now = Date.now()) {
  if (timer.status === 'completed') return 'completed';
  if (timer.status === 'paused') return 'paused';
  if (!Number.isFinite(timer.targetMs) || timer.targetMs - now <= 0) return 'expired';
  return 'active';
}

/**
 * "1 Day & 21h", then "2h 14m", then "14m".
 *
 * This is resets.js's own readout with the seconds dropped: a Shortcut showing
 * a notification does not tick, so a second-level number is stale the moment it
 * is read. The rest - spelled-out days, no zero-padded leading unit, minutes
 * dropped once there is a day on the clock - is deliberately identical, so the
 * phone and the page never disagree about how long is left.
 */
function formatRemaining(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'Finished';
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
  if (days > 0) {
    const label = `${days} Day${days === 1 ? '' : 's'}`;
    return hours > 0 ? `${label} & ${hours}h` : label;
  }
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m`;
  return 'Under a minute';
}

function normalizeStateFilter(value) {
  const slug = String(value || '').trim().toLowerCase();
  return STATE_FILTERS.includes(slug) ? slug : 'active';
}

/**
 * A timer as a Shortcut sees it.
 *
 * The webhook URL is a credential and is not in this object. Nothing that
 * builds a Shortcuts response may reach past this function to the record.
 */
function toShortcutItem(timer, now = Date.now()) {
  const remainingMs = Number.isFinite(timer.targetMs) ? timer.targetMs - now : 0;
  return {
    id: timer.id,
    title: timer.title,
    reset_at: timer.resetAt,
    remaining_ms: remainingMs,
    remaining: formatRemaining(remainingMs),
    repeat_days: timer.repeatDays,
    status: deriveState(timer, now),
  };
}

/**
 * The timers a Shortcut asked for: soonest first, the state it named, capped.
 *
 * Deleted tombstones and shared Agent Office cards are never in here. The
 * former are gone, and the latter belong to /api/shortcuts/countdowns.
 */
function selectShortcutTimers(items, options = {}) {
  const now = options.now instanceof Date ? options.now.getTime() : Number(options.now) || Date.now();
  const state = normalizeStateFilter(options.state);
  const limit = Number.isFinite(Number(options.limit)) && Number(options.limit) > 0
    ? Math.floor(Number(options.limit))
    : null;

  const selected = normalizeTimers(items)
    .filter(timer => !timer.deleted && timer.source !== 'office' && Number.isFinite(timer.targetMs))
    .sort((a, b) => a.targetMs - b.targetMs || a.title.localeCompare(b.title))
    .map(timer => toShortcutItem(timer, now))
    .filter(item => state === 'all' || item.status === state);

  return limit ? selected.slice(0, limit) : selected;
}

/**
 * The same list as plain text, for a Shortcut that shows or speaks it directly.
 */
function formatShortcutText(items, state = 'active') {
  const scope = normalizeStateFilter(state);
  if (!items.length) return scope === 'all' ? 'No timers.' : `No ${scope} timers.`;
  const noun = items.length === 1 ? 'timer' : 'timers';
  const heading = scope === 'all'
    ? `${items.length} ${noun}`
    : `${items.length} ${scope} ${noun}`;
  return [heading, ...items.map(item => `• ${item.title} — ${item.remaining}`)].join('\n');
}

// ─── Repeats ─────────────────────────────────────────────────────────────────

/**
 * The next occurrence of a repeating timer after `now`, keeping the hour it was
 * set to. Returns '' for a one-off: an expired one-off stays expired.
 */
function nextOccurrence(resetAt, repeatDays, now = Date.now()) {
  const days = Number(repeatDays);
  if (!Number.isFinite(days) || days <= 0) return '';
  const next = new Date(resetAt);
  if (Number.isNaN(next.getTime())) return '';
  for (let step = 0; step < MAX_ROLL_STEPS && next.getTime() <= now; step += 1) {
    next.setDate(next.getDate() + Math.round(days));
  }
  return next.getTime() > now ? next.toISOString() : '';
}

// ─── Delivery ────────────────────────────────────────────────────────────────

/**
 * A Pushcut URL with its secret taken out.
 *
 * The path of a Pushcut webhook carries the notification name and the query
 * carries the account secret, so only the host and a fixed marker are ever
 * safe to write down. Every log line and every stored error goes through here.
 */
function describeWebhook(url) {
  try {
    return `${new URL(url).host}/…`;
  } catch {
    return 'the webhook URL';
  }
}

/**
 * Strip a webhook URL - and anything that looks like one - out of a message.
 *
 * Node puts the request URL into some network error messages, and a stored
 * error is read back by the page, so a raw message is a credential leak with a
 * delay on it. Both the exact URL and any other Pushcut-shaped URL are removed.
 */
function redactWebhook(text, url) {
  let message = String(text == null ? '' : text);
  const trimmed = String(url || '').trim();
  if (trimmed) message = message.split(trimmed).join('[webhook]');
  return message.replace(/https?:\/\/\S+/g, '[webhook]').slice(0, 300);
}

function describeDeliveryError(error, url) {
  if (!error) return 'Delivery failed.';
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'Pushcut did not answer in time.';
  const code = (error.cause && error.cause.code) || error.code || '';
  return redactWebhook(code || error.message || 'Delivery failed.', url);
}

/**
 * POST the notification to Pushcut and report what came back.
 *
 * This is an ordinary HTTPS request, not the browser's `no-cors` one: the whole
 * reason delivery moved to the server is that a status code can be read here,
 * so "sent" can mean sent rather than "the fetch resolved".
 *
 * @returns {Promise<{ok: boolean, status: number, error: string}>}
 */
async function deliverWebhook(url, payload, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DELIVERY_TIMEOUT_MS;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, status: 0, error: 'The webhook URL is not a valid URL.' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, status: 0, error: 'The webhook URL must be http or https.' };
  }

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return { ok: false, status: response.status, error: `Pushcut answered ${response.status}.` };
    }
    return { ok: true, status: response.status, error: '' };
  } catch (error) {
    return { ok: false, status: 0, error: describeDeliveryError(error, url) };
  }
}

function notificationPayload(timer) {
  return {
    title: timer.title,
    text: `${timer.title} — the countdown has landed.`,
    resetAt: timer.resetAt,
    event: 'countdown_reached_zero',
    timerId: timer.id,
    source: 'agent-office',
  };
}

// ─── The processor ───────────────────────────────────────────────────────────

function backoffMs(attempts, baseMs, maxMs) {
  if (attempts <= 0) return 0;
  const scaled = baseMs * Math.pow(2, attempts - 1);
  return Math.min(scaled, maxMs);
}

function attemptsForOccurrence(timer) {
  return timer.notificationOccurrence === timer.resetAt ? timer.notificationAttempts : 0;
}

/**
 * Should this timer be pushed to Pushcut right now, and if not, why not.
 *
 * The "why not" is returned rather than swallowed because it is the whole
 * behaviour of this feature: every reason here is a rule the tests pin down.
 */
function planFor(timer, now, options) {
  if (timer.deleted) return { action: 'skip', reason: 'deleted' };
  if (timer.source === 'office') return { action: 'skip', reason: 'shared' };
  if (timer.status !== 'active') return { action: 'skip', reason: timer.status };
  if (!timer.webhookUrl) return { action: 'skip', reason: 'no-webhook' };
  if (!Number.isFinite(timer.targetMs)) return { action: 'skip', reason: 'no-reset-time' };
  if (timer.targetMs > now) return { action: 'skip', reason: 'not-due' };

  // An occurrence is only ever fired once, and that is decided by the reset
  // time it was fired for - not by a boolean, which cannot tell yesterday's
  // send from today's. A restart re-reads exactly this and stays quiet.
  if (timer.firedForResetAt && timer.firedForResetAt === timer.resetAt) {
    return { action: 'skip', reason: 'already-fired' };
  }

  // Records written before delivery moved to the server carry the page's own
  // `fired` flag and nothing else. Believe it: the browser already sent this
  // one, and re-sending every past timer on the first deploy would be the
  // loudest possible way to ship this.
  if (timer.fired && !timer.firedForResetAt) {
    return { action: 'suppress', reason: 'already-fired-by-browser' };
  }

  if (now - timer.targetMs > options.lateGraceMs) {
    return { action: 'suppress', reason: 'too-late' };
  }

  const attempts = attemptsForOccurrence(timer);
  if (attempts > 0 && timer.lastNotificationAttemptAt) {
    const waitUntil = Date.parse(timer.lastNotificationAttemptAt) + backoffMs(attempts, options.retryBaseMs, options.retryMaxMs);
    if (Number.isFinite(waitUntil) && waitUntil > now) {
      return { action: 'skip', reason: 'backoff' };
    }
  }

  return { action: 'send' };
}

/**
 * What a delivered (or deliberately skipped) occurrence leaves behind.
 *
 * A repeating timer moves on to its next occurrence and is re-armed for it; a
 * one-off stays exactly where it is, expired, with the record of the send on
 * it. `firedForResetAt` is left pointing at the occurrence that was sent even
 * after a repeat advances, so the history survives and the dedupe check - which
 * compares it against the *new* reset time - correctly reads as not-yet-fired.
 */
function firedPatch(timer, now, error) {
  const nowIso = new Date(now).toISOString();
  const patch = {
    fired: true,
    firedAt: nowIso,
    firedForResetAt: timer.resetAt,
    lastNotificationAttemptAt: nowIso,
    lastNotificationError: error || '',
    notificationAttempts: 0,
    notificationOccurrence: timer.resetAt,
    updatedAt: nowIso,
  };

  const advanced = nextOccurrence(timer.resetAt, timer.repeatDays, now);
  if (advanced) {
    patch.resetAt = advanced;
    // The new occurrence has not been sent, and the page reads `fired` to
    // decide whether a card is still armed.
    patch.fired = false;
  }
  return patch;
}

function failedPatch(timer, now, error) {
  const nowIso = new Date(now).toISOString();
  return {
    lastNotificationAttemptAt: nowIso,
    lastNotificationError: error,
    notificationAttempts: attemptsForOccurrence(timer) + 1,
    notificationOccurrence: timer.resetAt,
    updatedAt: nowIso,
  };
}

/**
 * One pass over the stored timers: send what is due, and say what changed.
 *
 * Nothing is written here. The caller gets `updates`, each keyed by the reset
 * time the decision was made against, so the write can be applied to a freshly
 * read array and skip any timer the owner has retimed in the meantime.
 *
 * @param {object} options
 * @param {Array}  options.timers   Stored timer records.
 * @param {Date|number} [options.now]
 * @param {Function} [options.send] Delivery function, for tests. (url, payload) => {ok, status, error}
 * @param {number} [options.retryBaseMs]
 * @param {number} [options.retryMaxMs]
 * @param {number} [options.lateGraceMs]
 */
async function processDueTimers(options = {}) {
  const now = options.now instanceof Date ? options.now.getTime() : Number(options.now) || Date.now();
  const settings = {
    retryBaseMs: Number.isFinite(options.retryBaseMs) ? options.retryBaseMs : RETRY_BASE_MS,
    retryMaxMs: Number.isFinite(options.retryMaxMs) ? options.retryMaxMs : RETRY_MAX_MS,
    lateGraceMs: Number.isFinite(options.lateGraceMs) ? options.lateGraceMs : LATE_GRACE_MS,
  };
  const send = typeof options.send === 'function'
    ? options.send
    : (url, payload) => deliverWebhook(url, payload, options);

  const timers = normalizeTimers(options.timers);
  const updates = [];
  const results = [];

  for (const timer of timers) {
    const plan = planFor(timer, now, settings);

    if (plan.action === 'skip') {
      results.push({ id: timer.id, outcome: 'skipped', reason: plan.reason });
      continue;
    }

    if (plan.action === 'suppress') {
      updates.push({ id: timer.id, expectedResetAt: timer.resetAt, patch: firedPatch(timer, now, '') });
      results.push({ id: timer.id, outcome: 'suppressed', reason: plan.reason });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- one phone, a handful of
    // timers: sequential delivery keeps the order of notifications sane.
    const delivery = await send(timer.webhookUrl, notificationPayload(timer));
    if (delivery && delivery.ok) {
      updates.push({ id: timer.id, expectedResetAt: timer.resetAt, patch: firedPatch(timer, now, '') });
      results.push({ id: timer.id, outcome: 'delivered', status: delivery.status });
    } else {
      const error = redactWebhook((delivery && delivery.error) || 'Delivery failed.', timer.webhookUrl);
      updates.push({ id: timer.id, expectedResetAt: timer.resetAt, patch: failedPatch(timer, now, error) });
      results.push({ id: timer.id, outcome: 'failed', reason: error, status: (delivery && delivery.status) || 0 });
    }
  }

  return { updates, results, changed: updates.length > 0 };
}

/**
 * Fold the processor's updates back into whatever is stored right now.
 *
 * Re-reading before the write is what keeps a cycle from clobbering an edit the
 * owner made while Pushcut was answering. A timer whose reset time no longer
 * matches the one the decision was made against is left alone entirely: it has
 * been retimed, and marking a send against its new occurrence would silence a
 * notification that has not happened yet.
 */
function applyTimerUpdates(items, updates) {
  const stored = Array.isArray(items) ? items.slice() : [];
  let applied = 0;

  for (const update of updates) {
    const index = stored.findIndex(item => item && typeof item === 'object' && String(item.id || '') === update.id);
    if (index < 0) continue;
    if (toIso(stored[index].resetAt) !== update.expectedResetAt) continue;
    stored[index] = { ...stored[index], ...update.patch };
    applied += 1;
  }

  return { items: stored, applied };
}

module.exports = {
  DAY_MS,
  LATE_GRACE_MS,
  MAX_TIMERS,
  RETRY_BASE_MS,
  RETRY_MAX_MS,
  STATE_FILTERS,
  STORAGE_KEY,
  applyTimerUpdates,
  backoffMs,
  deliverWebhook,
  deriveState,
  describeWebhook,
  formatRemaining,
  formatShortcutText,
  nextOccurrence,
  normalizeStateFilter,
  normalizeTimer,
  normalizeTimers,
  parseStoredTimers,
  processDueTimers,
  redactWebhook,
  selectShortcutTimers,
  toShortcutItem,
  validateStoredItems,
};
