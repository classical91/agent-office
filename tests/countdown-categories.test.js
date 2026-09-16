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
vm.runInNewContext(read('resets.js'), context);

const { CATEGORY_FILTERS, CATEGORY_OPTIONS, normalizeCard } = context.window.AOResets;
const view = card => ({ card: normalizeCard(card, 0), state: 'active' });

test('countdowns expose editable categories including subscriptions, bills, and other', () => {
  const values = Array.from(CATEGORY_OPTIONS, item => item.value);
  assert.ok(values.includes('subscriptions-bills'));
  assert.ok(values.includes('other'));

  const html = read('countdowns.html');
  const script = read('resets.js');
  assert.match(html, /id="rst-category-filter"/);
  assert.match(html, /id="rst-new-category"/);
  assert.match(script, /data-field="category"/);
});

test('category filters select only countdowns assigned to that category', () => {
  const rent = view({ title: 'Rent', resetAt: '2026-10-01T09:00:00.000Z', category: 'subscriptions-bills' });
  const haircut = view({ title: 'Haircut', resetAt: '2026-10-02T09:00:00.000Z', category: 'personal' });
  const loose = view({ title: 'Something else', resetAt: '2026-10-03T09:00:00.000Z', category: 'other' });

  assert.equal(CATEGORY_FILTERS['subscriptions-bills'].keep(rent), true);
  assert.equal(CATEGORY_FILTERS['subscriptions-bills'].keep(haircut), false);
  assert.equal(CATEGORY_FILTERS.personal.keep(haircut), true);
  assert.equal(CATEGORY_FILTERS.other.keep(loose), true);
});

test('the canonical navigation name and URL are Countdowns', () => {
  const shell = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'shell', 'shell.html'), 'utf8');
  assert.match(shell, /href="\/countdowns\.html"[^>]*>.*Countdowns<\/span>/);
  assert.doesNotMatch(shell, />Countdown Timers<\/span>/);
  assert.match(read('countdowns.html'), /<title>Countdowns - Agent Office<\/title>/);
  assert.match(read('resets.html'), /window\.location\.replace\('\/countdowns\.html'\)/);
});
