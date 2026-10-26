'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const DIST = path.join(__dirname, '..', 'agent-office-deploy', 'dist');
const read = name => fs.readFileSync(path.join(DIST, name), 'utf8');

const context = { Date, console, setInterval, clearInterval };
context.window = context;
vm.runInNewContext(read('happy-hour.js'), context);
vm.runInNewContext(read('timer-rotation.js'), context);
vm.runInNewContext(read('resets.js'), context);
const { STATUS_FILTERS, normalizeCard, viewOf } = context.window.AOResets;

const future = new Date(Date.now() + 3600000).toISOString();
const past = new Date(Date.now() - 3600000).toISOString();
const view = raw => viewOf(normalizeCard({ title: 'T', resetAt: future, ...raw }, 0));

test('the status menu opens on every card', () => {
  assert.equal(Object.keys(STATUS_FILTERS)[0], 'all');
  assert.ok(STATUS_FILTERS.all.keep(view({ status: 'paused' })));
});

test('the Paused status shows paused countdowns only', () => {
  assert.ok(STATUS_FILTERS.paused.keep(view({ status: 'paused' })));
  assert.ok(!STATUS_FILTERS.paused.keep(view({ status: 'active' })));
  assert.ok(!STATUS_FILTERS.active.keep(view({ status: 'paused' })));
  assert.ok(STATUS_FILTERS.finished.keep(view({ status: 'active', resetAt: past })));
});

test('the countdowns page carries the status menu', () => {
  assert.match(read('countdowns.html'), /id="rst-status-filter"[^>]*\n?[^>]*setStatusFilter/);
});
