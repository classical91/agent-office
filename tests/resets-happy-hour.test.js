'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'agent-office-deploy', 'dist', 'resets.js'),
  'utf8'
);
const context = { window: {}, Date, console, setInterval, clearInterval };
vm.runInNewContext(source, context);
const {
  colorForView,
  happyHourDetails,
  happyHourMeal,
  happyHourShortcutTime,
  isDueSoon,
  isListView,
} = context.window.AOResets;

test('happy hour keeps only the meal name in the header shortcut', () => {
  assert.equal(happyHourMeal('50% off Fresh Appetizers'), 'Fresh Appetizers');
  assert.equal(happyHourMeal('50\u00a2 each Marinated Split Chicken Wings'), 'Marinated Split Chicken Wings');
});

test('happy hour lives in the header instead of the countdown list', () => {
  assert.equal(isListView({ card: { id: 'routine-happy-hour-daily' } }), false);
  assert.equal(isListView({ card: { id: 'ordinary-countdown' } }), true);
});

test('happy hour header uses a shorter timer label', () => {
  const view = {
    remaining: 60 * 60 * 1000,
    card: { happyHourPhase: 'open' },
  };
  assert.match(happyHourShortcutTime(view), /^Ends in /);
});

test('happy hour shows the correct Sunday deal before the heads-up', () => {
  const details = happyHourDetails(new Date(2026, 7, 9, 12, 0));
  assert.equal(details.phase, 'upcoming');
  assert.match(details.title, /Today.*50% off Burger Patties/);
  assert.equal(details.target.getHours(), 14);
  assert.equal(details.target.getMinutes(), 30);
});

test('happy hour counts to opening from 2:30 and closing after 3', () => {
  const starting = happyHourDetails(new Date(2026, 7, 10, 14, 45));
  assert.equal(starting.phase, 'starting');
  assert.equal(starting.target.getHours(), 15);
  assert.match(starting.title, /Marinated Chicken Kebobs/);

  const open = happyHourDetails(new Date(2026, 7, 12, 16, 0));
  assert.equal(open.phase, 'open');
  assert.equal(open.target.getHours(), 18);
  assert.match(open.title, /50.* each Marinated Split Chicken Wings/);
});

test('after closing, happy hour advances to tomorrow\'s deal and heads-up', () => {
  const details = happyHourDetails(new Date(2026, 7, 14, 19, 0));
  assert.equal(details.phase, 'tomorrow');
  assert.match(details.title, /Tomorrow.*50% off Burger Patties/);
  assert.equal(details.target.getDate(), 15);
  assert.equal(details.target.getHours(), 14);
  assert.equal(details.target.getMinutes(), 30);
});

test('active reset timers due within 24 hours share the same color', () => {
  const soon = { state: 'active', remaining: 23 * 3600000, card: { title: 'Claude reset' } };
  const boundary = { state: 'active', remaining: 24 * 3600000, card: { title: 'OpenAI reset' } };
  const later = { state: 'active', remaining: 25 * 3600000, card: { title: 'Claude reset' } };
  const paused = { state: 'paused', remaining: 23 * 3600000, card: { title: 'OpenAI reset' } };
  const expired = { state: 'expired', remaining: -1, card: { title: 'Gemini reset' } };

  assert.equal(isDueSoon(soon), true);
  assert.equal(isDueSoon(boundary), true);
  assert.equal(colorForView(soon), 'var(--yellow)');
  assert.equal(colorForView(boundary), 'var(--yellow)');
  assert.equal(isDueSoon(later), false);
  assert.equal(isDueSoon(paused), false);
  assert.equal(isDueSoon(expired), false);
  assert.notEqual(colorForView(later), 'var(--yellow)');
  assert.notEqual(colorForView(paused), 'var(--yellow)');
});
