'use strict';

// The shared Agent Office countdowns on /countdowns.html used to render as a
// read-only card: a title, a clock and a footnote, with no way to fix the time
// or the name from the page showing them. They expand into an editor now, wired
// to /api/countdowns rather than to the browser's own timer storage. These
// tests hold that shape.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const DIST = path.join(__dirname, '..', 'agent-office-deploy', 'dist');
const read = name => fs.readFileSync(path.join(DIST, name), 'utf8');

// `window` points at the sandbox itself, as it does in a browser: happy-hour.js
// hangs its exports off the global and resets.js reads them off `window`.
const context = { Date, console, setInterval, clearInterval };
context.window = context;
vm.runInNewContext(read('happy-hour.js'), context);
vm.runInNewContext(read('resets.js'), context);
const {
  cardHtml,
  normalizeCard,
  officeDraftFrom,
  officePatchBody,
  viewOf,
} = context.window.AOResets;

const officeCard = (overrides = {}) => normalizeCard({
  id: 'countdown-1',
  title: 'Biweekly home cleaning',
  // What the card counts down to is the next occurrence; what the editor moves
  // is the stored target. They are deliberately different here.
  resetAt: '2026-09-21T14:00:00.000Z',
  targetAt: '2026-09-07T14:00:00.000Z',
  officeRepeat: 'biweekly',
  repeatDays: 14,
  category: 'routine',
  officeCategory: 'routine',
  nextAction: 'Complete the home-cleaning checklist',
  message: 'Complete the home-cleaning checklist',
  notes: 'Cleaning checklist: wash bedsheets, vacuum carpet.',
  source: 'office',
  ...overrides,
}, 0);

const html = card => cardHtml(viewOf(card));

// resets.js runs in a vm, so the objects it returns do not share this file's
// Object prototype. A JSON round trip compares what they hold instead.
const plain = value => JSON.parse(JSON.stringify(value));

test('a shared countdown renders the fields needed to edit it', () => {
  const markup = html(officeCard());
  ['title', 'date', 'time', 'officeRepeat', 'officeCategory', 'nextAction', 'notes']
    .forEach(field => assert.ok(
      markup.includes(`data-field="${field}"`),
      `shared card is missing its ${field} field`
    ));
  assert.ok(markup.includes('data-action="save"'), 'shared card cannot be saved');
  assert.ok(markup.includes('data-action="delete"'), 'shared card cannot be deleted');
  assert.ok(markup.includes('managed by Penny'), 'shared card lost its footnote');
});

test('a shared countdown keeps Pushcut off the card', () => {
  const markup = html(officeCard());
  // The shared record has no webhook field, and the notification for one is not
  // this page's to send.
  assert.ok(!markup.includes('data-field="webhookUrl"'));
  assert.ok(!markup.includes('data-field="pushcut"'));
});

test('the editor offers the office vocabulary, not this page\'s own', () => {
  const markup = html(officeCard());
  ['none', 'daily', 'every2days', 'weekday', 'weekly', 'biweekly', 'monthly']
    .forEach(repeat => assert.ok(markup.includes(`value="${repeat}"`), `no ${repeat} repeat`));
  ['deadline', 'goal', 'shift', 'routine', 'trading', 'personal']
    .forEach(category => assert.ok(markup.includes(`value="${category}"`), `no ${category} category`));
  assert.ok(markup.includes('value="biweekly" selected'));
  assert.ok(markup.includes('value="routine" selected'));
});

test('the editor opens on the stored target, not on the next occurrence', () => {
  const card = officeCard();
  const markup = html(card);
  const date = new Date(card.targetAt);
  const pad = value => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  assert.ok(markup.includes(`data-field="date"\n                       value="${day}"`)
    || markup.includes(`value="${day}"`), 'the date field does not show the stored target');
  assert.ok(!markup.includes('value="2026-09-21"'), 'the date field shows the occurrence');
});

test('a browser countdown is untouched by all of this', () => {
  const markup = html(normalizeCard({
    id: 'local-1',
    title: 'Claude usage reset',
    resetAt: '2026-09-21T14:00:00.000Z',
    pushcut: true,
  }, 0));
  assert.ok(markup.includes('data-field="webhookUrl"'));
  assert.ok(markup.includes('data-field="repeatDays"'));
  assert.ok(!markup.includes('data-field="officeRepeat"'));
  assert.ok(!markup.includes('managed by Penny'));
});

test('the draft read off a shared card is sent as the API spells it', () => {
  const values = {
    title: '  Biweekly home cleaning  ',
    date: '2026-09-07',
    time: '10:00',
    officeRepeat: 'weekly',
    officeCategory: 'personal',
    nextAction: '  Run the checklist  ',
    notes: '  Bedsheets first.  ',
  };
  const node = {
    querySelector(selector) {
      const field = /data-field="([^"]+)"/.exec(selector)[1];
      return values[field] === undefined ? null : { value: values[field] };
    },
  };

  const draft = officeDraftFrom(node);
  assert.equal(draft.title, 'Biweekly home cleaning');
  assert.equal(draft.repeat, 'weekly');
  assert.equal(draft.category, 'personal');
  assert.equal(draft.nextAction, 'Run the checklist');
  assert.equal(draft.notes, 'Bedsheets first.');
  assert.equal(new Date(draft.targetAt).toISOString(), draft.targetAt);

  // The sandbox has its own Object, so compare the shape rather than the
  // prototype: deepEqual would fail on two identical objects from either side.
  assert.deepEqual(plain(officePatchBody(draft)), {
    title: 'Biweekly home cleaning',
    target_at: draft.targetAt,
    repeat: 'weekly',
    category: 'personal',
    next_action: 'Run the checklist',
    notes: 'Bedsheets first.',
  });
});

test('a shared card with nothing typed in it still reads as a draft', () => {
  const node = { querySelector: () => null };
  assert.deepEqual(plain(officeDraftFrom(node)), {
    title: '',
    targetAt: '',
    repeat: '',
    category: '',
    nextAction: '',
    notes: '',
  });
});
