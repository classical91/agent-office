'use strict';

// This month's bill — what the Subscriptions / Bills countdowns still have to
// charge before the calendar month ends.
//
// One implementation, loaded two ways like timer-rotation.js: a <script> tag
// on countdowns.html, where the Subscriptions / Bills view draws the bill, and
// require() from server.js, which hands the same numbers to Main Hub's System
// Logs (GET /api/shortcuts/month-bill). Main Hub displays the answer; it never
// works out a bill of its own, so the two cannot disagree.
//
// A charge counts in the month its renewal lands in: a yearly card in its own
// month only, a weekly one once for each week. Paused cards make no charges, a
// card marked done is paid up, and shared Agent Office countdowns (source
// "office") have no cost and are left out. Months are local time — the page's
// browser, or the server's APP_TIMEZONE — unless a timeZone is given: Main Hub
// passes its reader's, so a renewal just after midnight on the 1st where they
// are is next month's bill there too, as it is on this page in their browser.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./timer-rotation.js'));
  else root.AOMonthBill = factory(root.AOTimerRotation);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (rotation) {
  const BILLS_CATEGORY = 'subscriptions-bills';
  // How far monthCharges() will step to find a renewal. countdowns.js and
  // reset-timers.js draw the same line.
  const MAX_STEPS = 5000;
  const MAX_COST = 1000000;

  /** A stored cost as dollars, or 0 for none. 0 is "not set", not "free". */
  function storedCost(value) {
    const amount = typeof value === 'number' ? value : Number(String(value == null ? '' : value).replace(/[$\s,]/g, ''));
    return Number.isFinite(amount) && amount > 0 && amount <= MAX_COST ? Math.round(amount * 100) / 100 : 0;
  }

  /** An IANA time zone this runtime knows, or '' for anything else. */
  function validTimeZone(value) {
    const zone = String(value == null ? '' : value).trim();
    if (!zone || zone.length > 64 || !/^[A-Za-z0-9_+\-\/]+$/.test(zone)) return '';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: zone });
      return zone;
    } catch {
      return '';
    }
  }

  // The wall-clock date and time at `ms` in `timeZone`.
  function zonedParts(ms, timeZone) {
    const parts = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(new Date(ms)).forEach(part => { parts[part.type] = Number(part.value); });
    return parts;
  }

  // How far `timeZone` is ahead of UTC at `ms`.
  function zoneOffset(ms, timeZone) {
    const p = zonedParts(ms, timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
  }

  // Midnight on the 1st of a month in `timeZone`. Date.UTC rolls month 12
  // into January; the offset is checked twice in case the guess crossed DST.
  function zonedMonthStart(year, monthIndex, timeZone) {
    const wall = Date.UTC(year, monthIndex, 1);
    const first = wall - zoneOffset(wall, timeZone);
    return wall - zoneOffset(first, timeZone);
  }

  // `ms` as a Date whose UTC fields read as `zone`'s wall clock, and back.
  function wallOf(ms, zone) {
    return new Date(ms + zoneOffset(ms, zone));
  }
  function fromWall(wall, zone) {
    const first = wall - zoneOffset(wall, zone);
    return wall - zoneOffset(first, zone);
  }

  // shiftedRenewal() on `zone`'s wall clock: rotation.addMonths() and
  // rotation.landing() with the UTC fields standing in for local ones.
  function zonedRenewal(card, steps, zone) {
    const date = wallOf(Date.parse(card.repeatMonths && card.skipWeekends && card.shiftedFrom ? card.shiftedFrom : card.resetAt), zone);
    if (card.repeatMonths) {
      const day = date.getUTCDate();
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() + card.repeatMonths * steps);
      const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      date.setUTCDate(Math.min(day, lastDay));
    } else {
      date.setUTCDate(date.getUTCDate() + card.repeatDays * steps);
    }
    if (card.skipWeekends) while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 1);
    return fromWall(date.getTime(), zone);
  }

  /** The calendar month `now` falls in: local time, or `timeZone`'s. */
  function monthBounds(now = new Date(), timeZone = '') {
    const zone = validTimeZone(timeZone);
    if (zone) {
      const p = zonedParts(now.getTime(), zone);
      return { start: zonedMonthStart(p.year, p.month - 1, zone), end: zonedMonthStart(p.year, p.month, zone) };
    }
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime(),
    };
  }

  // The renewal `steps` repeats away from the one the card points at. Each is
  // worked out from that one rather than from the last, so a bill due on the
  // 31st comes back to the 31st after a short month instead of creeping to
  // the 28th. A card that skips weekends is charged where the renewal lands,
  // and a monthly one counts from the day it was due, as it rolls forward.
  //
  // With a timeZone the stepping is done on that zone's wall clock, as the
  // page does it in the reader's browser: the 1st at 12:59 AM there steps to
  // the next 1st at 12:59 AM, not to wherever the server's clock puts it.
  function shiftedRenewal(card, steps, zone = '') {
    if (zone) return zonedRenewal(card, steps, zone);
    const date = new Date(card.repeatMonths && card.skipWeekends && card.shiftedFrom ? card.shiftedFrom : card.resetAt);
    if (card.repeatMonths) rotation.addMonths(date, card.repeatMonths * steps);
    else date.setDate(date.getDate() + card.repeatDays * steps);
    return card.skipWeekends ? Date.parse(rotation.landing(date, true).resetAt) : date.getTime();
  }

  /**
   * The charges a card makes this calendar month, local time (or `timeZone`'s),
   * oldest first.
   *
   * A charge is paid once its time has passed. A card marked done is paid up:
   * its renewals this month up to the one it stopped on count as paid, and it
   * makes no more. A paused card is on hold and makes none.
   */
  function monthCharges(card, now = new Date(), timeZone = '') {
    if (card.deleted || card.source === 'office' || card.status === 'paused' || !card.cost) return [];
    const base = Date.parse(card.resetAt);
    if (Number.isNaN(base)) return [];
    const zone = validTimeZone(timeZone);
    const { start, end } = monthBounds(now, zone);
    const done = card.status === 'completed';
    const charge = at => ({ at, paid: done || at <= now.getTime() });
    if (!card.repeatDays && !card.repeatMonths) return base >= start && base < end ? [charge(base)] : [];

    // Back to the last renewal before this month, then forward through it.
    let steps = 0;
    for (let guard = 0; guard < MAX_STEPS && shiftedRenewal(card, steps, zone) >= start; guard += 1) steps -= 1;
    const found = [];
    for (let guard = 0; guard < MAX_STEPS; guard += 1) {
      steps += 1;
      const at = shiftedRenewal(card, steps, zone);
      if (at >= end || (done && at > base)) break;
      // A daily card that skips weekends lands Saturday's and Sunday's
      // renewals on Monday too, and Monday is charged once.
      if (at >= start && !found.some(item => item.at === at)) found.push(charge(at));
    }
    return found;
  }

  /**
   * The month's bill from a list of cards. `isBill` picks which cards are
   * bills; by default, live non-office cards filed under Subscriptions / Bills.
   *
   * Only renewals still ahead of `now` and before the month ends are counted:
   * what has already gone out this month is not still to pay, and the next
   * renewal of a card that already rolled over belongs to next month's bill.
   */
  function billSummary(cards, now = new Date(), { isBill = card => card.category === BILLS_CATEGORY, timeZone = '' } = {}) {
    const zone = validTimeZone(timeZone);
    const bills = (Array.isArray(cards) ? cards : [])
      .filter(card => card && !card.deleted && card.source !== 'office' && isBill(card));
    const due = bills
      .flatMap(card => monthCharges(card, now, zone).filter(charge => !charge.paid).map(charge => ({ card, ...charge })))
      .sort((a, b) => a.at - b.at);
    // Added in cents, so twelve $9.99s come to $119.88 and not $119.88000000000001.
    const left = due.reduce((total, charge) => total + Math.round(charge.card.cost * 100), 0) / 100;
    return {
      month: new Date(now.getFullYear(), now.getMonth(), 1),
      // The month by `timeZone`, when the bill was worked out in one.
      zone,
      zoneMonth: zone ? zonedParts(now.getTime(), zone) : null,
      left,
      count: due.length,
      charges: due,
      next: due[0] || null,
      unpriced: bills.filter(card => !card.cost && card.status !== 'paused').length,
    };
  }

  /**
   * A stored timer record as the bill reads it. Records are stored as the page
   * wrote them; only the fields the bill uses are taken, and the cost is read
   * as stored dollars.
   */
  function billCard(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const repeatDays = Number(raw.repeatDays);
    const repeatMonths = Number(raw.repeatMonths);
    return {
      id: String(raw.id || ''),
      title: String(raw.title || 'Untitled countdown').slice(0, 160),
      resetAt: String(raw.resetAt || ''),
      repeatDays: Number.isFinite(repeatDays) && repeatDays > 0 ? Math.round(repeatDays) : 0,
      repeatMonths: Number.isFinite(repeatMonths) && repeatMonths > 0 ? Math.round(repeatMonths) : 0,
      skipWeekends: Boolean(raw.skipWeekends),
      shiftedFrom: String(raw.shiftedFrom || ''),
      status: raw.status === 'paused' || raw.status === 'completed' ? raw.status : 'active',
      deleted: Boolean(raw.deleted),
      source: raw.source === 'office' ? 'office' : 'browser',
      category: String(raw.category || '').trim().toLowerCase(),
      cost: storedCost(raw.cost),
    };
  }

  /**
   * The bill as another app reads it: amounts in dollars, times as ISO
   * strings, titles and costs only. A webhook URL or note never reaches it.
   */
  function billPayload(summary, { now = new Date(), timezone = '', maxCharges = 31 } = {}) {
    const zm = summary.zoneMonth;
    const year = zm ? zm.year : summary.month.getFullYear();
    const monthIndex = zm ? zm.month - 1 : summary.month.getMonth();
    const charge = item => ({ title: item.card.title, cost: item.card.cost, at: new Date(item.at).toISOString() });
    return {
      generated_at: now.toISOString(),
      timezone: summary.zone || timezone,
      month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
      // Mid-month at noon UTC names the same month in every zone.
      month_label: new Date(Date.UTC(year, monthIndex, 15, 12)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' }),
      currency: 'USD',
      left: summary.left,
      count: summary.count,
      unpriced: summary.unpriced,
      next: summary.next ? charge(summary.next) : null,
      charges: summary.charges.slice(0, maxCharges).map(charge),
      truncated: summary.charges.length > maxCharges,
    };
  }

  return { BILLS_CATEGORY, MAX_COST, MAX_STEPS, billCard, billPayload, billSummary, monthBounds, monthCharges, storedCost, validTimeZone };
});
