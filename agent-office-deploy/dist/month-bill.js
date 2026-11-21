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
// browser, or the server's APP_TIMEZONE.

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

  function monthBounds(now = new Date()) {
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
  function shiftedRenewal(card, steps) {
    const date = new Date(card.repeatMonths && card.skipWeekends && card.shiftedFrom ? card.shiftedFrom : card.resetAt);
    if (card.repeatMonths) rotation.addMonths(date, card.repeatMonths * steps);
    else date.setDate(date.getDate() + card.repeatDays * steps);
    return card.skipWeekends ? Date.parse(rotation.landing(date, true).resetAt) : date.getTime();
  }

  /**
   * The charges a card makes this calendar month, local time, oldest first.
   *
   * A charge is paid once its time has passed. A card marked done is paid up:
   * its renewals this month up to the one it stopped on count as paid, and it
   * makes no more. A paused card is on hold and makes none.
   */
  function monthCharges(card, now = new Date()) {
    if (card.deleted || card.source === 'office' || card.status === 'paused' || !card.cost) return [];
    const base = Date.parse(card.resetAt);
    if (Number.isNaN(base)) return [];
    const { start, end } = monthBounds(now);
    const done = card.status === 'completed';
    const charge = at => ({ at, paid: done || at <= now.getTime() });
    if (!card.repeatDays && !card.repeatMonths) return base >= start && base < end ? [charge(base)] : [];

    // Back to the last renewal before this month, then forward through it.
    let steps = 0;
    for (let guard = 0; guard < MAX_STEPS && shiftedRenewal(card, steps) >= start; guard += 1) steps -= 1;
    const found = [];
    for (let guard = 0; guard < MAX_STEPS; guard += 1) {
      steps += 1;
      const at = shiftedRenewal(card, steps);
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
  function billSummary(cards, now = new Date(), { isBill = card => card.category === BILLS_CATEGORY } = {}) {
    const bills = (Array.isArray(cards) ? cards : [])
      .filter(card => card && !card.deleted && card.source !== 'office' && isBill(card));
    const due = bills
      .flatMap(card => monthCharges(card, now).filter(charge => !charge.paid).map(charge => ({ card, ...charge })))
      .sort((a, b) => a.at - b.at);
    // Added in cents, so twelve $9.99s come to $119.88 and not $119.88000000000001.
    const left = due.reduce((total, charge) => total + Math.round(charge.card.cost * 100), 0) / 100;
    return {
      month: new Date(now.getFullYear(), now.getMonth(), 1),
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
    const month = summary.month;
    const charge = item => ({ title: item.card.title, cost: item.card.cost, at: new Date(item.at).toISOString() });
    return {
      generated_at: now.toISOString(),
      timezone,
      month: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
      month_label: month.toLocaleDateString('en-US', { month: 'long' }),
      currency: 'USD',
      left: summary.left,
      count: summary.count,
      unpriced: summary.unpriced,
      next: summary.next ? charge(summary.next) : null,
      charges: summary.charges.slice(0, maxCharges).map(charge),
      truncated: summary.charges.length > maxCharges,
    };
  }

  return { BILLS_CATEGORY, MAX_COST, MAX_STEPS, billCard, billPayload, billSummary, monthBounds, monthCharges, storedCost };
});
