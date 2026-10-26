'use strict';

// Timer rotation — a repeating Countdown Timer that cycles through a list.
//
// A reading countdown that alternates Ebook → Audiobook → Summary is one timer,
// not three: the same slot every few days, a different format each time. The
// timer stores the list and the occurrence the first entry belongs to (the
// anchor); which entry is up is the number of repeat steps between the anchor
// and the current occurrence, wrapped around the list.
//
// Nothing here is a counter. The browser rolls a timer forward on its tick and
// the server's Pushcut processor rolls it forward after a send, and neither
// knows about the other — a stored index would be bumped twice or not at all.
// Counting steps from the dates gives both the same answer.
//
// What one repeat step is lives here too, weekends included, because the
// rotation is counted in steps: the page, the Pushcut processor and the
// Calendar all have to agree on where a timer lands next, and this is the file
// all three already load.
//
// Loadable two ways on purpose, like happy-hour.js: `require()` from
// reset-timers.js, and a plain <script> tag on countdowns.html.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AOTimerRotation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const MAX_ITEMS = 12;
  const MAX_ITEM_LENGTH = 40;
  // A repeating timer whose reset time is years behind should not be stepped
  // forward one day at a time forever. countdowns.js draws the same line.
  const MAX_ROLL_STEPS = 5000;

  /**
   * A clean rotation list from whatever was stored or typed: an array, or one
   * string split on commas and new lines. Blank entries are dropped.
   */
  function normalizeRotation(value) {
    const parts = Array.isArray(value)
      ? value
      : typeof value === 'string' ? value.split(/[,\n]/) : [];
    return parts
      .filter(item => typeof item === 'string')
      .map(item => item.trim().slice(0, MAX_ITEM_LENGTH))
      .filter(Boolean)
      .slice(0, MAX_ITEMS);
  }

  function toTime(value) {
    if (!value) return NaN;
    return new Date(value).getTime();
  }

  // Whole repeat steps from the anchor to the occurrence. Days are rounded
  // rather than floored so a daylight-saving hour either way does not land a
  // step short.
  function stepsBetween(anchor, resetAt, repeatDays, repeatMonths) {
    const months = Number(repeatMonths) > 0 ? Math.round(Number(repeatMonths)) : 0;
    const days = Number(repeatDays) > 0 ? Math.round(Number(repeatDays)) : 0;
    if (months) {
      const from = new Date(anchor);
      const to = new Date(resetAt);
      const diff = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
      return Math.round(diff / months);
    }
    if (days) return Math.round((toTime(resetAt) - toTime(anchor)) / (days * DAY_MS));
    return 0;
  }

  // ─── Repeats and weekends ──────────────────────────────────────────────
  //
  // A timer can skip weekends. An occurrence that would land on a Saturday or
  // a Sunday lands on the Monday after it instead, at the same time of day,
  // and the repeat starts again from that Monday: an every-3-days routine due
  // on a Saturday comes round on Monday and then Thursday.
  //
  // A monthly or yearly timer keeps its day of the month instead. A review on
  // the 1st that the weekend moved to Monday the 2nd is back on the 1st next
  // month, and Christmas stays on the 25th. That is what `shiftedFrom` is for:
  // when the occurrence was due before the weekend moved it, or '' when it was
  // not moved.

  function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  // Adding a month to the 31st lands on the 1st or the 3rd depending on the
  // month, so the day is clamped to the end of a short month instead.
  function addMonths(date, months) {
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + months);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
  }

  function repeatOf(timer) {
    const days = Number(timer && timer.repeatDays);
    const months = Number(timer && timer.repeatMonths);
    return {
      days: Number.isFinite(days) && days > 0 ? Math.round(days) : 0,
      months: Number.isFinite(months) && months > 0 ? Math.round(months) : 0,
    };
  }

  /**
   * Where an occurrence due at `due` actually lands, as { resetAt, shiftedFrom }.
   * null when `due` is not a date.
   */
  function landing(due, skipWeekends) {
    const date = new Date(due);
    if (Number.isNaN(date.getTime())) return null;
    const at = new Date(date);
    // setDate() keeps the wall-clock time across a daylight-saving change.
    if (skipWeekends) while (isWeekend(at)) at.setDate(at.getDate() + 1);
    return {
      resetAt: at.toISOString(),
      shiftedFrom: at.getTime() === date.getTime() ? '' : date.toISOString(),
    };
  }

  /**
   * The occurrence after the timer's current one, as { resetAt, shiftedFrom },
   * keeping the hour it was set to. null for a one-off.
   */
  function followingOccurrence(timer) {
    const { days, months } = repeatOf(timer);
    if (!days && !months) return null;
    const skipWeekends = Boolean(timer.skipWeekends);
    const from = new Date(months && skipWeekends && timer.shiftedFrom ? timer.shiftedFrom : timer.resetAt);
    if (Number.isNaN(from.getTime())) return null;
    if (months) addMonths(from, months);
    else from.setDate(from.getDate() + days);
    return landing(from, skipWeekends);
  }

  /**
   * The first occurrence after `now`, as { resetAt, shiftedFrom }. null for a
   * one-off, which stays expired, and for a timer too far behind to catch up.
   */
  function occurrenceAfter(timer, now = Date.now()) {
    let current = { resetAt: timer.resetAt, shiftedFrom: timer.shiftedFrom || '' };
    for (let step = 0; step < MAX_ROLL_STEPS && !(toTime(current.resetAt) > now); step += 1) {
      current = followingOccurrence({ ...timer, ...current });
      if (!current) return null;
    }
    return toTime(current.resetAt) > now ? current : null;
  }

  // stepsBetween() for a timer that skips weekends. A monthly one counts the
  // months between the days it was due. An every-few-days one restarts from
  // Monday, so its steps are not all the same length and are walked instead.
  // The anchor is the day the first entry was due, which may be a weekend.
  function weekdayStepsBetween(timer) {
    const { days, months } = repeatOf(timer);
    if (!days) return stepsBetween(timer.rotationAnchor, timer.shiftedFrom || timer.resetAt, days, months);
    const target = toTime(timer.resetAt);
    let current = landing(timer.rotationAnchor, true);
    if (toTime(current.resetAt) > target) return stepsBetween(timer.rotationAnchor, timer.resetAt, days, months);
    let steps = 0;
    for (; steps < MAX_ROLL_STEPS; steps += 1) {
      const next = followingOccurrence({ ...timer, ...current });
      // Half a day either way still counts, as Math.round() does above.
      if (!next || toTime(next.resetAt) - target > DAY_MS / 2) break;
      current = next;
    }
    return steps;
  }

  /**
   * The rotation entry for the timer's current occurrence, or '' when it has
   * no rotation. A timer with a list but no usable anchor reads as the first
   * entry.
   */
  function currentRotation(timer) {
    const items = normalizeRotation(timer && timer.rotation);
    if (!items.length) return '';
    const anchor = toTime(timer.rotationAnchor);
    const reset = toTime(timer.resetAt);
    if (Number.isNaN(anchor) || Number.isNaN(reset)) return items[0];
    const steps = timer.skipWeekends
      ? weekdayStepsBetween(timer)
      : stepsBetween(timer.rotationAnchor, timer.resetAt, timer.repeatDays, timer.repeatMonths);
    return items[((steps % items.length) + items.length) % items.length];
  }

  return {
    MAX_ITEMS,
    MAX_ITEM_LENGTH,
    MAX_ROLL_STEPS,
    currentRotation,
    followingOccurrence,
    isWeekend,
    landing,
    normalizeRotation,
    occurrenceAfter,
  };
});
