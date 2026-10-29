'use strict';

// The Subscriptions / Bills view on /countdowns.html adds up the month's bill
// from what each card costs, and counts it down as each renewal lands. These
// tests hold the arithmetic: which renewals fall in the month, which are paid,
// and which cards are left out.

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
const { normalizeCard, readCost, monthCharges, billSummary, billHtml, cardHtml, viewOf } = context.window.AOResets;

const now = new Date(2026, 9, 26, 12, 0); // Mon Oct 26, noon local
const at = (month, day, hour = 9) => new Date(2026, month - 1, day, hour, 0).toISOString();
const bill = (overrides, index = 0) => normalizeCard({
  id: `b${index}`, title: `Bill ${index}`, status: 'active', category: 'subscriptions-bills',
  repeatMonths: 1, ...overrides,
}, index);
// Spread into this realm's arrays: the page runs in its own vm context.
const dates = charges => [...charges].map(charge => new Date(charge.at).getDate());
const days = card => dates(monthCharges(card, now));

test('a cost reads from what people type, and junk is refused', () => {
  assert.equal(readCost(''), 0);
  assert.equal(readCost('9.99'), 9.99);
  assert.equal(readCost('$ 9.99'), 9.99);
  assert.equal(readCost('1,299.00'), 1299);
  assert.equal(readCost('9,99'), 9.99);
  assert.equal(readCost('12.345'), 12.35);
  assert.ok(Number.isNaN(readCost('ten')));
  assert.ok(Number.isNaN(readCost('-5')));
});

test('a card keeps its cost through normalizeCard, and a bad one is dropped', () => {
  assert.equal(bill({ cost: 15.99 }).cost, 15.99);
  assert.equal(bill({ cost: '7.50' }).cost, 7.5);
  assert.equal(bill({ cost: 'nope' }).cost, 0);
  assert.equal(bill({}).cost, 0);
});

test('a monthly bill that already rolled to next month still counts as paid this month', () => {
  const rent = bill({ cost: 1500, resetAt: at(11, 1) });
  const charges = monthCharges(rent, now);
  assert.equal(charges.length, 1);
  assert.equal(new Date(charges[0].at).getDate(), 1);
  assert.equal(charges[0].paid, true);
});

test('a monthly bill later this month is still to pay', () => {
  const charges = monthCharges(bill({ cost: 5.99, resetAt: at(10, 29) }), now);
  assert.equal(charges.length, 1);
  assert.equal(charges[0].paid, false);
});

test('a yearly bill counts only in the month it renews', () => {
  assert.deepEqual(days(bill({ cost: 29.99, repeatMonths: 12, resetAt: new Date(2027, 7, 8, 9).toISOString() })), []);
  assert.deepEqual(days(bill({ cost: 29.99, repeatMonths: 12, resetAt: at(10, 30) })), [30]);
});

test('a weekly bill counts every week it lands in the month', () => {
  assert.deepEqual(days(bill({ cost: 3, repeatMonths: 0, repeatDays: 7, resetAt: at(11, 2) })), [5, 12, 19, 26]);
});

test('a bill due on the 31st lands on the last day of a short month, and back on the 31st after it', () => {
  const card = bill({ cost: 10, resetAt: new Date(2027, 2, 31, 9).toISOString() }); // Mar 31
  assert.deepEqual(dates(monthCharges(card, new Date(2027, 1, 10))), [28]);
  assert.deepEqual(dates(monthCharges(card, new Date(2027, 0, 10))), [31]);
});

test('a one-off bill counts only if it lands this month', () => {
  assert.deepEqual(days(bill({ cost: 80, repeatMonths: 0, resetAt: at(10, 3) })), [3]);
  assert.deepEqual(days(bill({ cost: 80, repeatMonths: 0, resetAt: at(11, 3) })), []);
});

test('the summary adds up the month and counts down what is left', () => {
  const cards = [
    bill({ title: 'Rent', cost: 1500, resetAt: at(11, 1) }, 1),
    bill({ title: 'ChatGPT Plus', cost: 20, resetAt: at(11, 7) }, 2),
    bill({ title: 'Telegram Premium', cost: 5.99, resetAt: at(10, 29) }, 3),
    bill({ title: 'Pushcut', cost: 9.99, resetAt: at(10, 30) }, 4),
  ];
  const summary = billSummary(cards, now);
  assert.equal(summary.total, 1535.98);
  assert.equal(summary.paid, 1520);
  assert.equal(summary.left, 15.98);
  assert.equal(summary.count, 4);
  assert.equal(summary.paidCount, 2);
  assert.equal(summary.next.card.title, 'Telegram Premium');

  const html = billHtml(summary, now);
  assert.match(html, /<strong class="rst-money">\$15\.98<\/strong>/);
  assert.match(html, /left to pay/);
  assert.match(html, /2 of 4 paid/);
  assert.match(html, /<strong class="rst-money">\$1,535\.98<\/strong> total/);
  assert.match(html, /<strong class="rst-money">\$1,520\.00<\/strong> paid/);
  assert.match(html, /&middot; <strong class="rst-money">\$5\.99<\/strong> &middot;/);
});

test('once the last renewal lands the month reads as paid', () => {
  const summary = billSummary([bill({ cost: 9.99, resetAt: at(11, 3) })], now);
  assert.equal(summary.left, 0);
  assert.match(billHtml(summary, now), /All paid for October/);
});

test('paused, deleted, shared and other-category cards stay out of the bill', () => {
  const cards = [
    bill({ cost: 10, resetAt: at(10, 28), status: 'paused' }, 1),
    bill({ cost: 10, resetAt: at(10, 28), deleted: true }, 2),
    bill({ cost: 10, resetAt: at(10, 28), source: 'office' }, 3),
    bill({ cost: 10, resetAt: at(10, 28), category: 'holidays' }, 4),
    bill({ cost: 4, resetAt: at(10, 28) }, 5),
  ];
  assert.equal(billSummary(cards, now).total, 4);
});

test('a bill marked done is paid up and makes no more charges', () => {
  const weekly = bill({ cost: 3, repeatMonths: 0, repeatDays: 7, resetAt: at(10, 28), status: 'completed' });
  const charges = monthCharges(weekly, now);
  assert.deepEqual(dates(charges), [7, 14, 21, 28]);
  assert.ok(charges.every(charge => charge.paid));
});

test('bills without a cost are counted so the panel can ask for them', () => {
  const summary = billSummary([bill({ resetAt: at(10, 28) }, 1), bill({ cost: 2, resetAt: at(10, 28) }, 2)], now);
  assert.equal(summary.unpriced, 1);
  assert.match(billHtml(summary, now), /1 bill has no cost yet/);
});

test('a priced card shows its cost, and the cost field shows on bills only', () => {
  const priced = cardHtml(viewOf(bill({ cost: 5.99, resetAt: at(10, 29) })));
  assert.match(priced, /<span class="rst-cost" data-role="cost"><strong class="rst-money">\$5\.99<\/strong> \/ month<\/span>/);
  assert.match(priced, /Cost per month/);
  assert.match(priced, /data-role="cost-field">/);

  const holiday = cardHtml(viewOf(bill({ category: 'holidays', repeatMonths: 12, resetAt: at(10, 31) })));
  assert.doesNotMatch(holiday, /class="rst-cost"/);
  assert.match(holiday, /data-role="cost-field" hidden>/);
});

test('the countdowns page has the bill panel and a cost field in the add form', () => {
  const html = read('countdowns.html');
  assert.match(html, /id="rst-bill"/);
  assert.match(html, /id="rst-new-cost-field"/);
  assert.match(html, /id="rst-new-cost"/);
});
