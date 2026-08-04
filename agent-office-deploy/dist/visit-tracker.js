/**
 * Visitor tracker.
 *
 * Drop this on any site you run:
 *
 *   <script src="https://your-agent-office-host/visit-tracker.js" defer></script>
 *
 * It records that a browser opened a page, and pings while the tab stays open
 * so the Visitors page can show who is reading something right now.
 *
 * What it keeps: a random id it makes up about the browser, the page opened,
 * the page that linked there, and the screen size. The id lives in this site's
 * own storage and is never shared with anything else - it exists so a second
 * visit can be told apart from a second visitor, and for nothing else.
 *
 * What it does not do: no third-party requests, no fingerprinting, no attempt
 * to work out who anybody is.
 */
(function () {
  'use strict';

  // The script's own src is the server to report to, so a site only ever names
  // the host once - in the script tag.
  var script = document.currentScript
    || (function () {
      var all = document.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i -= 1) {
        if ((all[i].src || '').indexOf('visit-tracker.js') !== -1) return all[i];
      }
      return null;
    })();
  if (!script) return;

  var endpoint;
  try {
    endpoint = new URL('/api/visits/track', script.src).href;
  } catch (error) {
    return;
  }

  var VISITOR_KEY = 'ao_visitor_id';
  var SESSION_KEY = 'ao_session_id';
  var PING_INTERVAL_MS = 30000;

  // Honour the browser's own "do not track" switch. Someone who set it has
  // already answered the question this script would be asking.
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  function randomId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID().replace(/-/g, '');
    if (window.crypto && window.crypto.getRandomValues) {
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return Array.prototype.map.call(bytes, function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    }
    return String(Date.now()) + Math.random().toString(36).slice(2, 12);
  }

  // Private browsing throws on storage access rather than returning null, and a
  // visitor with storage switched off should still be counted - as a visitor
  // who looks new every time, which is the truthful answer.
  function readOrCreate(store, key) {
    try {
      var existing = store.getItem(key);
      if (existing) return existing;
      var created = randomId();
      store.setItem(key, created);
      return created;
    } catch (error) {
      return randomId();
    }
  }

  var visitorId = readOrCreate(window.localStorage, VISITOR_KEY);
  var sessionId = readOrCreate(window.sessionStorage, SESSION_KEY);

  function send(event) {
    var payload = JSON.stringify({
      event: event,
      site: location.hostname,
      visitor_id: visitorId,
      session_id: sessionId,
      path: location.pathname + location.search,
      title: document.title || '',
      referrer: document.referrer || '',
      screen: window.screen ? window.screen.width + 'x' + window.screen.height : ''
    });

    // text/plain keeps this a simple request: no preflight, so a page load on
    // the tracked site never waits on a second round trip.
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([payload], { type: 'text/plain;charset=UTF-8' }));
        return;
      }
    } catch (error) { /* fall through to fetch */ }

    try {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: payload,
        keepalive: true,
        mode: 'cors',
        credentials: 'omit'
      }).catch(function () {});
    } catch (error) { /* a view that cannot be reported is simply not reported */ }
  }

  var lastPath = location.pathname + location.search;
  send('view');

  // A tab left open on a background monitor is not somebody reading, so the
  // ping stops while the tab is hidden and the live view lets them drop off.
  setInterval(function () {
    if (document.visibilityState === 'visible') send('ping');
  }, PING_INTERVAL_MS);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') send('ping');
  });

  // Single-page sites change the URL without loading anything, so a moved
  // address counts as the next page view.
  function checkForNavigation() {
    var current = location.pathname + location.search;
    if (current === lastPath) return;
    lastPath = current;
    send('view');
  }

  ['pushState', 'replaceState'].forEach(function (method) {
    var original = history[method];
    if (typeof original !== 'function') return;
    history[method] = function () {
      var result = original.apply(this, arguments);
      setTimeout(checkForNavigation, 0);
      return result;
    };
  });
  window.addEventListener('popstate', checkForNavigation);
}());
