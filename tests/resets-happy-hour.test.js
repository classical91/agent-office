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
const { happyHourDetails } = context.window.AOResets;

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
