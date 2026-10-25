'use strict';

// Workouts and meals on the Calendar — read from the apps that own them.
//
// The Wellness Tracker owns the weekly workout rota and publishes it at
// `GET /api/weekly-plan`. Nutri-Mind owns the meal plan and answers for one
// day at a time at `GET /api/daily-meal-plan?date=`, behind its sync code.
// The Calendar draws both as markers on the dates they land, asked for every
// time it loads. Nothing is copied into Google Calendar or into this app's
// stores, so editing the rota or changing tonight's dinner in its own app is
// what moves it here — there is no second copy to drift.
//
// Neither app says *when* in the day a workout or a meal happens, only which
// day. The Calendar needs a time to draw a marker in the week and day grids,
// so each kind gets a nominal time (WELLNESS_TIMES below, overridable with
// CALENDAR_WELLNESS_TIMES). Markers take no time (`blocksTime: false`), so
// free-time windows and scheduling ignore them, same as countdowns.
//
// The diet sync code is the key to the whole meal plan. It is read from this
// process's environment, sent in a header, never follows a redirect, and never
// comes back out: the browser gets titles and lines, nothing else.
//
// Which days are drawn:
//   - workouts: every day from today onward in the range — the rota is fixed
//     to the weekday, so next Tuesday's workout is known;
//   - meals: today and the six days after it. The planner keeps one rolling
//     week keyed by weekday, so drawing "Monday's" meals on the Monday after
//     next would be repeating a plan that will have been replaced by then.
// Past days are not drawn: a forecast shown for yesterday reads as a record of
// what was done, which neither app is claiming.

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 60 * 1000;
const MEAL_DAYS = 7;
const MAX_TEXT = 200;
const MAX_LINES = 12;

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const WELLNESS_TIMES = {
  morning: '08:00',
  afternoon: '12:30',
  workout: '17:30',
  night: '18:30',
};

const MEAL_COLOR = '#f59e0b';
const WORKOUT_COLOR = '#22c55e';

// Every way reading a source can end. `ok` and `empty` are answers; the rest
// each name a different thing to fix, so the bar can say which.
const SOURCE_STATES = {
  OK: 'ok',
  EMPTY: 'empty',
  NOT_CONFIGURED: 'not_configured',
  AUTH_ERROR: 'auth_error',
  UNREACHABLE: 'unreachable',
  ERROR: 'error',
};

function text(value, max = MAX_TEXT) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, max);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/**
 * The nominal times, with CALENDAR_WELLNESS_TIMES applied on top:
 * `workout=06:30,morning=07:30`. An unknown name or an unreadable time is
 * ignored rather than fatal — the default is still a sensible place to draw.
 */
function resolveTimes(value) {
  const times = { ...WELLNESS_TIMES };
  String(value || '').split(',').forEach(pair => {
    const [name, clock] = pair.split('=').map(part => String(part || '').trim().toLowerCase());
    if (Object.prototype.hasOwnProperty.call(times, name) && parseClock(clock)) times[name] = clock.padStart(5, '0');
  });
  return times;
}

function at(day, clock) {
  const parsed = parseClock(clock) || { hours: 12, minutes: 0 };
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), parsed.hours, parsed.minutes);
}

/** The days in [from, to) from today onward, at most `limit` of them. */
function daysInRange(from, to, now, limit = Infinity) {
  const days = [];
  const floor = startOfDay(now);
  let day = startOfDay(from);
  if (day.getTime() < floor.getTime()) day = floor;
  while (day.getTime() < to.getTime() && days.length < limit) {
    days.push(day);
    day = addDays(day, 1);
  }
  return days;
}

function stateFor(when, now) {
  return when.getTime() < now.getTime() ? 'passed' : 'upcoming';
}

function safeColor(value, fallback) {
  return /^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? String(value) : fallback;
}

// ─── Config ──────────────────────────────────────────────────────────────────

function isLoopback(hostname) {
  const host = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
}

/**
 * A base URL from configuration, or the reason it cannot be used. A deployment
 * must use HTTPS — the meal plan's sync code rides on these requests — and
 * plain HTTP is allowed only against loopback, for both apps running locally.
 */
function resolveBase(value, name, deployed) {
  const raw = text(value, 500);
  if (!raw) return { ok: false, reason: `Set ${name} to show this.` };
  let url;
  try {
    url = new URL(raw);
  } catch (error) {
    return { ok: false, reason: `${name} is not a valid URL.` };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: `${name} must be an http or https address.` };
  }
  if (deployed && url.protocol !== 'https:' && !isLoopback(url.hostname)) {
    return { ok: false, reason: `${name} must use https.` };
  }
  return { ok: true, base: url.origin + url.pathname.replace(/\/+$/, '') };
}

function resolveConfig(env = process.env, { deployed = false } = {}) {
  const workout = resolveBase(env.WORKOUT_TRACKER_BASE_URL, 'WORKOUT_TRACKER_BASE_URL', deployed);
  let meals = resolveBase(env.DIET_PLAN_BASE_URL, 'DIET_PLAN_BASE_URL', deployed);
  const syncCode = text(env.DIET_PLAN_SYNC_CODE, 200);
  if (meals.ok && !syncCode) meals = { ok: false, reason: 'Set DIET_PLAN_SYNC_CODE to show this.' };
  return { workout, meals: meals.ok ? { ...meals, syncCode } : meals, times: resolveTimes(env.CALENDAR_WELLNESS_TIMES) };
}

// ─── Turning each app's answer into markers ──────────────────────────────────

function workoutLines(planDay) {
  const items = Array.isArray(planDay && planDay.items) ? planDay.items : [];
  return items.slice(0, MAX_LINES).map(item => ({
    emoji: text(item && item.emoji, 8),
    text: text(item && item.name),
    detail: text(item && item.detail),
  })).filter(line => line.text);
}

/** One marker per day from the rota, the day's theme and focus as its title. */
function workoutItems(week, days, { base, times, now }) {
  const byName = new Map((Array.isArray(week) ? week : []).map(planDay => [text(planDay && planDay.day, 20), planDay]));
  return days.map(day => {
    const planDay = byName.get(WEEKDAY_NAMES[day.getDay()]);
    if (!planDay) return null;
    const lines = workoutLines(planDay);
    if (!lines.length) return null;
    const when = at(day, times.workout);
    const theme = text(planDay.theme, 60);
    const focus = text(planDay.focus, 120);
    return {
      id: `workout:${dateKey(day)}`,
      source: 'workout',
      date: dateKey(day),
      title: [theme, focus].filter(Boolean).join(' · ') || 'Workout',
      label: 'Workout',
      emoji: text(planDay.emoji, 8) || '💪',
      at: when.toISOString(),
      lines,
      color: safeColor(planDay.color, WORKOUT_COLOR),
      state: stateFor(when, now),
      href: `${base}/#/weekly-plan`,
      appLabel: 'Wellness Tracker',
      blocksTime: false,
    };
  }).filter(Boolean);
}

/**
 * The planned slots of one day. Nutri-Mind already leaves out the meals turned
 * off, and says per slot whether anything is chosen — an empty "Not chosen
 * yet" slot is not drawn, because a marker on the calendar should be a meal.
 */
function mealItems(payload, day, { base, times, now }) {
  const today = payload && payload.today;
  const slots = Array.isArray(today && today.slots) ? today.slots : [];
  return slots.filter(slot => slot && slot.planned && !slot.hidden).map(slot => {
    const id = text(slot.id, 20);
    const when = at(day, times[id] || times.afternoon);
    const label = text(slot.label, 40) || 'Meal';
    return {
      id: `meal:${dateKey(day)}:${id}`,
      source: 'meal',
      date: dateKey(day),
      slot: id,
      title: text(slot.text),
      label,
      emoji: text(slot.icon, 8) || '🍽️',
      at: when.toISOString(),
      lines: [],
      color: MEAL_COLOR,
      state: stateFor(when, now),
      href: `${base}/weekly-calendar`,
      appLabel: 'Nutri-Mind',
      blocksTime: false,
    };
  }).filter(item => item.title);
}

// ─── Reading the two apps ────────────────────────────────────────────────────

function sourceStatus(state, message = '') {
  return { state, message: text(message, 300) };
}

function failureState(error) {
  if (error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return sourceStatus(SOURCE_STATES.UNREACHABLE, 'timed out');
  const code = (error && error.cause && error.cause.code) || '';
  if (code) return sourceStatus(SOURCE_STATES.UNREACHABLE, code);
  return sourceStatus(SOURCE_STATES.ERROR, (error && error.message) || 'failed');
}

async function getJson(fetchImpl, url, headers, timeoutMs) {
  const response = await fetchImpl(url, {
    method: 'GET',
    // The meal request carries the sync code; following a 3xx would hand it
    // to whatever origin the redirect names.
    redirect: 'manual',
    headers: { Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  let body = null;
  if (response.status >= 200 && response.status < 300) {
    body = await response.json();
  }
  return { status: response.status, body };
}

async function readWorkouts(config, days, options) {
  if (!config.workout.ok) return { status: sourceStatus(SOURCE_STATES.NOT_CONFIGURED, config.workout.reason), items: [] };
  if (!days.length) return { status: sourceStatus(SOURCE_STATES.OK), items: [] };
  try {
    const { status, body } = await options.cachedGet(`${config.workout.base}/api/weekly-plan?date=${dateKey(days[0])}`, {});
    if (status < 200 || status >= 300) return { status: sourceStatus(SOURCE_STATES.ERROR, `Wellness Tracker answered ${status}`), items: [] };
    if (!body || !Array.isArray(body.week)) return { status: sourceStatus(SOURCE_STATES.ERROR, 'the weekly plan had no week in it'), items: [] };
    return {
      status: sourceStatus(SOURCE_STATES.OK),
      items: workoutItems(body.week, days, { base: config.workout.base, times: config.times, now: options.now }),
    };
  } catch (error) {
    return { status: failureState(error), items: [] };
  }
}

async function readMeals(config, days, options) {
  if (!config.meals.ok) return { status: sourceStatus(SOURCE_STATES.NOT_CONFIGURED, config.meals.reason), items: [] };
  if (!days.length) return { status: sourceStatus(SOURCE_STATES.OK), items: [] };
  const headers = { 'x-sync-code': config.meals.syncCode };
  let answers;
  try {
    answers = await Promise.all(days.map(day => options.cachedGet(
      `${config.meals.base}/api/daily-meal-plan?date=${dateKey(day)}`,
      headers
    )));
  } catch (error) {
    return { status: failureState(error), items: [] };
  }
  const statuses = answers.map(answer => answer.status);
  if (statuses.some(status => status === 401 || status === 403)) {
    return { status: sourceStatus(SOURCE_STATES.AUTH_ERROR, 'Nutri-Mind refused DIET_PLAN_SYNC_CODE.'), items: [] };
  }
  // The code is fine but nothing has ever been synced under it: a setup step.
  if (statuses.every(status => status === 404)) {
    return { status: sourceStatus(SOURCE_STATES.EMPTY, 'No meal plan has been synced under this code yet.'), items: [] };
  }
  if (statuses.some(status => status === 503)) {
    return { status: sourceStatus(SOURCE_STATES.ERROR, 'Nutri-Mind has no sync database configured.'), items: [] };
  }
  const failed = statuses.find(status => status < 200 || status >= 300);
  if (failed) return { status: sourceStatus(SOURCE_STATES.ERROR, `Nutri-Mind answered ${failed}`), items: [] };
  const items = [];
  answers.forEach((answer, index) => {
    items.push(...mealItems(answer.body, days[index], { base: config.meals.base, times: config.times, now: options.now }));
  });
  return { status: sourceStatus(SOURCE_STATES.OK), items };
}

function byTime(a, b) {
  return Date.parse(a.at) - Date.parse(b.at) || String(a.source).localeCompare(String(b.source));
}

/**
 * A reader that remembers each upstream answer for a minute, so flipping
 * between month, week and day does not re-ask both apps every time. Only
 * successful answers are kept; a failure is asked again on the next load.
 */
function createWellnessReader(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : CACHE_TTL_MS;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const cache = new Map();

  async function cachedGet(url, headers) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value;
    const value = await getJson(fetchImpl, url, headers, timeoutMs);
    if (value.status >= 200 && value.status < 300) cache.set(url, { at: Date.now(), value });
    else cache.delete(url);
    return value;
  }

  /**
   * Every workout and planned meal inside [from, to), with how each source
   * answered.
   */
  async function read({ from, to, now = new Date(), env = process.env, deployed = false }) {
    const config = resolveConfig(env, { deployed });
    const workoutDays = daysInRange(from, to, now);
    const mealCutoff = addDays(startOfDay(now), MEAL_DAYS);
    const mealDays = daysInRange(from, to.getTime() < mealCutoff.getTime() ? to : mealCutoff, now, MEAL_DAYS);
    const [workouts, meals] = await Promise.all([
      readWorkouts(config, workoutDays, { now, cachedGet }),
      readMeals(config, mealDays, { now, cachedGet }),
    ]);
    const items = workouts.items.concat(meals.items).sort(byTime);
    return {
      now: now.toISOString(),
      from: from.toISOString(),
      to: to.toISOString(),
      items,
      sources: { workout: workouts.status, meals: meals.status },
      times: config.times,
      counts: {
        items: items.length,
        workouts: workouts.items.length,
        meals: meals.items.length,
      },
    };
  }

  return { read, clear: () => cache.clear() };
}

module.exports = {
  SOURCE_STATES,
  WELLNESS_TIMES,
  createWellnessReader,
  mealItems,
  resolveConfig,
  resolveTimes,
  workoutItems,
};
