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
    const steps = stepsBetween(timer.rotationAnchor, timer.resetAt, timer.repeatDays, timer.repeatMonths);
    return items[((steps % items.length) + items.length) % items.length];
  }

  return { MAX_ITEMS, MAX_ITEM_LENGTH, currentRotation, normalizeRotation };
});
