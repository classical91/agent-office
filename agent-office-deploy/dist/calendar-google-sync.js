'use strict';

// Incremental Google Calendar sync.
//
// A full 13-month re-fetch on every page load is both slow and unnecessary:
// Google hands out a syncToken that returns only what changed since the last
// call. The cache here holds the last known event set so the token has
// something to apply changes to. It is per-process, so a restart simply falls
// back to one full sync - and a 410 from Google (an expired token) does the
// same.
//
// The HTTP call is injected rather than imported so the whole state machine -
// pagination, token reuse, cancellations, 410 recovery - can be driven by a
// scripted fake Google in tests. That is the only reason this is a module and
// not a handful of functions inside server.js.

const PAGE_LIMIT = 40;
const MAX_RESULTS = '2500';
const EVENTS_PATH = '/calendar/v3/calendars/primary/events';
const WINDOW_PAST_DAYS = 30;
const WINDOW_FUTURE_DAYS = 365;

function syncWindow(nowMs) {
  const timeMin = new Date(nowMs - WINDOW_PAST_DAYS * 24 * 60 * 60 * 1000);
  const timeMax = new Date(nowMs + WINDOW_FUTURE_DAYS * 24 * 60 * 60 * 1000);
  return {
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    // Anchored to the day, not the millisecond, so an ordinary page refresh
    // keeps reusing the same token instead of forcing a full sync every time.
    key: `${timeMin.toISOString().slice(0, 10)}..${timeMax.toISOString().slice(0, 10)}`,
  };
}

function isSyncTokenExpired(error) {
  return Boolean(error && (error.statusCode === 410 || error.status === 410));
}

function startOf(event) {
  if (!event || !event.start) return '';
  return event.start.dateTime || event.start.date || '';
}

/**
 * @param {object} options
 * @param {(path: string) => Promise<object>} options.request
 *        Performs one Google API GET and resolves the parsed body. Errors are
 *        expected to carry `statusCode`.
 * @param {() => number} [options.now] Injectable clock, for tests.
 */
function createGoogleSync(options) {
  const request = options.request;
  const now = options.now || (() => Date.now());

  const state = {
    token: null,
    windowKey: '',
    items: new Map(),
    lastSyncedAt: null,
  };

  // A cancelled event, or one stripped of its times, is a deletion as far as
  // the cache is concerned - incremental responses report removals that way.
  function applyPage(items) {
    (Array.isArray(items) ? items : []).forEach(event => {
      if (!event || !event.id) return;
      if (event.status === 'cancelled' || !event.start || !event.end) {
        state.items.delete(event.id);
        return;
      }
      state.items.set(event.id, event);
    });
  }

  async function fetchPages(baseParams) {
    let pageToken = '';
    let syncToken = null;
    for (let page = 0; page < PAGE_LIMIT; page += 1) {
      const params = new URLSearchParams(baseParams);
      if (pageToken) params.set('pageToken', pageToken);
      const data = await request(`${EVENTS_PATH}?${params}`);
      applyPage(data && data.items);
      if (data && data.nextSyncToken) syncToken = data.nextSyncToken;
      if (!data || !data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }
    return syncToken;
  }

  function snapshot() {
    return Array.from(state.items.values())
      .filter(event => event && event.id && event.start && event.end)
      .sort((a, b) => {
        const left = startOf(a);
        const right = startOf(b);
        return left < right ? -1 : left > right ? 1 : 0;
      });
  }

  async function list(listOptions = {}) {
    const window = syncWindow(now());
    const canReuseToken = Boolean(state.token)
      && state.windowKey === window.key
      && !listOptions.force;

    if (canReuseToken) {
      try {
        // A sync-token request may not carry timeMin/timeMax/orderBy - Google
        // rejects it. The window is already baked into the token.
        const token = await fetchPages({
          singleEvents: 'true',
          maxResults: MAX_RESULTS,
          syncToken: state.token,
        });
        // No new token on an incremental page means "keep using the one you
        // have", not "you no longer have one".
        if (token) state.token = token;
        state.lastSyncedAt = new Date(now()).toISOString();
        return snapshot();
      } catch (error) {
        if (!isSyncTokenExpired(error)) throw error;
        // Google forgot the token, so the cache it described is no longer
        // trustworthy either. Both are dealt with by falling through to the
        // full sync below, which clears the cache and replaces the token -
        // clearing them here as well would be dead code.
      }
    }

    state.items.clear();
    const token = await fetchPages({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: MAX_RESULTS,
      timeMin: window.timeMin,
      timeMax: window.timeMax,
    });
    // A full sync that yielded no token is a degraded mode, not an error: the
    // next call simply syncs fully again.
    state.token = token || null;
    state.windowKey = window.key;
    state.lastSyncedAt = new Date(now()).toISOString();
    return snapshot();
  }

  function reset() {
    state.token = null;
    state.windowKey = '';
    state.items.clear();
    state.lastSyncedAt = null;
  }

  // Local writes keep the cache coherent so a create or edit shows up without
  // waiting for the next sync to come round.
  function upsert(event) {
    if (!event || !event.id) return;
    state.items.set(event.id, event);
  }

  function remove(eventId) {
    if (!eventId) return;
    state.items.delete(eventId);
  }

  return {
    list,
    reset,
    upsert,
    remove,
    snapshot,
    get lastSyncedAt() {
      return state.lastSyncedAt;
    },
    get syncToken() {
      return state.token;
    },
    get size() {
      return state.items.size;
    },
  };
}

module.exports = { createGoogleSync, syncWindow, isSyncTokenExpired, PAGE_LIMIT };
