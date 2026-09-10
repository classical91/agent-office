'use strict';

// Happy Hour — the weekday deal, when it starts, and how long is left.
//
// This lived inside resets.js, which is a page: it renders cards, opens a
// modal, and cannot be loaded by the server. Main Hub's Daily Dashboard shows
// the same meal and the same countdown, and a second copy of this schedule in
// another repository would be wrong the first week a deal changed. So the rule
// moved here, unchanged, and resets.js reads it from here like everything else.
//
// The schedule is 3:00–6:00 PM with the heads-up at 2:30 PM, and the deal is
// whichever one the day of the week carries. Everything is local time — the
// server pins TZ to APP_TIMEZONE (America/Vancouver) at boot, which is the
// clock the deal is actually on.
//
// Loadable two ways on purpose: `require()` from server.js, and a plain
// <script> tag on resets.html. Same file, so there is only ever one schedule.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AOHappyHour = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const HAPPY_HOUR_ID = 'routine-happy-hour-daily';

  // Indexed by Date#getDay(): Sunday first.
  const HAPPY_HOUR_DEALS = [
    '50% off Burger Patties',
    '50% off Marinated Chicken Kebobs',
    '50% off Marinated Chicken Kebobs',
    '50¢ each Marinated Split Chicken Wings',
    '50% off Fresh Appetizers',
    '50% off Fresh Appetizers',
    '50% off Burger Patties',
  ];

  function atHour(date, hour, minute) {
    const copy = new Date(date);
    copy.setHours(hour, minute || 0, 0, 0);
    return copy;
  }

  /**
   * Where the day is against the window, and what the countdown is pointing at:
   *
   *   before 2:30 PM  'upcoming'  → counts down to the 2:30 heads-up
   *   2:30–3:00 PM    'starting'  → counts down to the doors opening
   *   3:00–6:00 PM    'open'      → counts down to the end
   *   after 6:00 PM   'tomorrow'  → counts down to tomorrow's heads-up,
   *                                 and carries tomorrow's deal
   */
  function happyHourDetails(now = new Date()) {
    const current = new Date(now);
    const reminder = atHour(current, 14, 30);
    const starts = atHour(current, 15, 0);
    const ends = atHour(current, 18, 0);
    let dealDate = current;
    let target = reminder;
    let phase = 'upcoming';

    if (current >= ends) {
      dealDate = new Date(current);
      dealDate.setDate(dealDate.getDate() + 1);
      target = atHour(dealDate, 14, 30);
      phase = 'tomorrow';
    } else if (current >= starts) {
      target = ends;
      phase = 'open';
    } else if (current >= reminder) {
      target = starts;
      phase = 'starting';
    }

    const dayName = dealDate.toLocaleDateString([], { weekday: 'long' });
    const deal = HAPPY_HOUR_DEALS[dealDate.getDay()];
    return {
      phase,
      target,
      dayName,
      deal,
      meal: happyHourMeal(deal),
      title: `Happy Hour ${phase === 'tomorrow' ? 'Tomorrow' : 'Today'} — ${deal}`,
      message: `${dayName}: ${deal}. Happy Hour is 3:00–6:00 PM; the countdown starts at 2:30 PM. More Rewards card required; while quantities last.`,
    };
  }

  /** Just the food, with the discount stripped off — the header has no room. */
  function happyHourMeal(deal) {
    return String(deal || '')
      .replace(/^50% off\s+/i, '')
      .replace(/^50¢ each\s+/i, '');
  }

  return { HAPPY_HOUR_ID, HAPPY_HOUR_DEALS, atHour, happyHourDetails, happyHourMeal };
});
