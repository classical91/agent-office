'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const DIST = path.join(__dirname, '..', 'agent-office-deploy', 'dist');
const read = name => fs.readFileSync(path.join(DIST, name), 'utf8');

// `window` points at the sandbox itself, as it does in a browser: happy-hour.js
// hangs its exports off the global and resets.js reads them off `window`, which
// is how resets.html loads the pair.
const context = { Date, console, setInterval, clearInterval };
context.window = context;
vm.runInNewContext(read('happy-hour.js'), context);
vm.runInNewContext(read('resets.js'), context);
const { DEFAULT_FILTER, FILTERS, normalizeCard, tradingViewTimeframeCards } = context.window.AOResets;

const keep = card => FILTERS.pushcut.keep({ card: normalizeCard(card, 0) });

test('the countdown page opens on the Pushcut filter', () => {
  assert.equal(DEFAULT_FILTER, 'pushcut');
  assert.equal(Object.keys(FILTERS)[0], 'pushcut');
});

test('the Pushcut filter keeps the ticked countdowns and nothing else', () => {
  assert.equal(keep({ title: 'Claude reset', resetAt: '2026-09-09T12:00:00.000Z', pushcut: true }), true);
  assert.equal(keep({ title: 'Haircut', resetAt: '2026-09-09T12:00:00.000Z', pushcut: false }), false);
});

test('the tick is the filter answer, not the webhook: either can be set without the other', () => {
  // Ticked with no webhook is a countdown you want in the list but do not want
  // pushed; a webhook with the tick cleared still notifies, it just sits under
  // "All timers".
  assert.equal(keep({ title: 'Rent', resetAt: '2026-09-09T12:00:00.000Z', pushcut: true, webhookUrl: '' }), true);
  assert.equal(
    keep({
      title: 'Backup',
      resetAt: '2026-09-09T12:00:00.000Z',
      pushcut: false,
      webhookUrl: 'https://api.pushcut.io/secret/notifications/Backup',
    }),
    false
  );
});

test('a countdown saved before the tick existed answers from its webhook', () => {
  const withHook = normalizeCard({
    title: 'Gemini reset',
    resetAt: '2026-09-09T12:00:00.000Z',
    webhookUrl: 'https://api.pushcut.io/secret/notifications/Gemini',
  }, 0);
  const without = normalizeCard({ title: 'Sheets', resetAt: '2026-09-09T12:00:00.000Z' }, 1);
  assert.equal(withHook.pushcut, true);
  assert.equal(without.pushcut, false);
});

test('the editor and the new-countdown form both offer the tick', () => {
  assert.match(read('resets.js'), /data-field="pushcut"/);
  const html = fs.readFileSync(path.join(DIST, 'resets.html'), 'utf8');
  assert.match(html, /id="rst-new-pushcut" checked/);
});

test('TradingView weekly and monthly reviews live in the Pushcut filter', () => {
  const cards = Array.from(tradingViewTimeframeCards(new Date(2026, 8, 5, 12, 0, 0)));
  assert.equal(cards.length, 8);
  assert.equal(cards.every(card => keep(card)), true);
  assert.equal(cards.filter(card => card.repeatDays === 7).length, 4);
  assert.equal(cards.filter(card => card.repeatMonths === 1).length, 4);
  assert.deepEqual(cards.map(card => card.title), [
    'Weekly timeframe review - Bitcoin',
    'Monthly timeframe review - Bitcoin',
    'Weekly timeframe review - TOTAL1',
    'Monthly timeframe review - TOTAL1',
    'Weekly timeframe review - TOTAL2',
    'Monthly timeframe review - TOTAL2',
    'Weekly timeframe review - TOTAL3',
    'Monthly timeframe review - TOTAL3',
  ]);
});
