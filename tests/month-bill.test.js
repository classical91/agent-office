'use strict';

// This month's bill, worked out once: month-bill.js is what the countdowns page
// draws and what /api/shortcuts/month-bill hands to Main Hub's System Logs.
// These tests hold the two to the same answer, and the route to its token.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { startTestServer } = require('./helpers/test-server.js');

const DIST = path.join(__dirname, '..', 'agent-office-deploy', 'dist');
const read = name => fs.readFileSync(path.join(DIST, name), 'utf8');
const monthBill = require(path.join(DIST, 'month-bill.js'));

const context = { Date, console, setInterval, clearInterval };
context.window = context;
vm.runInNewContext(read('happy-hour.js'), context);
vm.runInNewContext(read('timer-rotation.js'), context);
vm.runInNewContext(read('month-bill.js'), context);
vm.runInNewContext(read('resets.js'), context);
const page = context.window.AOResets;

const now = new Date(2026, 10, 12, 12, 0); // Thu Nov 12, noon local
const at = (month, day, hour = 9) => new Date(2026, month - 1, day, hour, 0).toISOString();
const BILLS = 'subscriptions-bills';

// What the page has saved: the records the server reads back verbatim.
const RECORDS = [
  { id: 'rent', title: 'Rent', category: BILLS, repeatMonths: 1, resetAt: at(11, 30), cost: 1500 },
  { id: 'phone', title: 'Phone', category: BILLS, repeatMonths: 1, resetAt: at(11, 3), cost: 45.5 },
  { id: 'gym', title: 'Gym', category: BILLS, repeatDays: 7, resetAt: at(11, 13), cost: 9.99, notes: 'private' },
  { id: 'domain', title: 'Domain', category: BILLS, repeatMonths: 12, resetAt: at(11, 20), cost: 20 },
  { id: 'paper', title: 'Paper', category: BILLS, repeatDays: 1, skipWeekends: true, resetAt: at(11, 13), cost: 1.25 },
  { id: 'paused', title: 'Paused', category: BILLS, repeatMonths: 1, resetAt: at(11, 25), cost: 99, status: 'paused' },
  { id: 'done', title: 'Done', category: BILLS, repeatMonths: 1, resetAt: at(11, 14), cost: 30, status: 'completed' },
  { id: 'office', title: 'Office', category: BILLS, repeatMonths: 1, resetAt: at(11, 18), cost: 5, source: 'office' },
  { id: 'gone', title: 'Gone', category: BILLS, repeatMonths: 1, resetAt: at(11, 18), cost: 5, deleted: true },
  { id: 'free', title: 'No cost yet', category: BILLS, repeatMonths: 1, resetAt: at(11, 21) },
  { id: 'other', title: 'Not a bill', category: 'health', repeatMonths: 1, resetAt: at(11, 21), cost: 70 },
  { id: 'hook', title: 'Pushcut bill', category: BILLS, repeatMonths: 1, resetAt: at(11, 26), cost: 12,
    webhookUrl: 'https://api.pushcut.io/sEcReT-key/notifications/Bill' },
];

function serverSummary(records, when = now) {
  return monthBill.billSummary(records.map(monthBill.billCard), when, {
    isBill: card => card.category === monthBill.BILLS_CATEGORY,
  });
}

function shape(summary) {
  return {
    left: summary.left,
    count: summary.count,
    unpriced: summary.unpriced,
    charges: [...summary.charges].map(charge => [charge.card.id, charge.at]),
  };
}

test('the page and the server work out the same bill from the same records', () => {
  const cards = RECORDS.map((raw, index) => page.normalizeCard(raw, index));
  const fromPage = shape(page.billSummary(cards, now));
  const fromServer = shape(serverSummary(RECORDS));
  assert.deepEqual(fromServer, fromPage);
  // And the bill is the one the records describe.
  assert.equal(fromServer.count > 0, true);
  assert.equal(fromServer.charges.some(([id]) => ['paused', 'office', 'gone', 'other', 'done'].includes(id)), false);
  assert.equal(fromServer.unpriced, 1);
});

test('the same holds across a month of days', () => {
  const cards = RECORDS.map((raw, index) => page.normalizeCard(raw, index));
  for (let day = 1; day <= 30; day += 1) {
    const when = new Date(2026, 10, day, 8, 30);
    assert.deepEqual(shape(serverSummary(RECORDS, when)), shape(page.billSummary(cards, when)), `Nov ${day}`);
  }
});

test('a stored cost is read as dollars and anything else as no cost', () => {
  assert.equal(monthBill.storedCost(9.99), 9.99);
  assert.equal(monthBill.storedCost('12.345'), 12.35);
  assert.equal(monthBill.storedCost('$1,299.00'), 1299);
  assert.equal(monthBill.storedCost(0), 0);
  assert.equal(monthBill.storedCost(-4), 0);
  assert.equal(monthBill.storedCost('ten'), 0);
  assert.equal(monthBill.storedCost(null), 0);
  assert.equal(monthBill.storedCost(monthBill.MAX_COST + 1), 0);
});

test('the payload carries titles, costs and times, and nothing else from a record', () => {
  const payload = monthBill.billPayload(serverSummary(RECORDS), { now, timezone: 'UTC' });
  assert.equal(payload.month, '2026-11');
  assert.equal(payload.month_label, 'November');
  assert.equal(payload.currency, 'USD');
  assert.equal(payload.timezone, 'UTC');
  assert.equal(payload.count, payload.charges.length);
  assert.deepEqual(payload.next, payload.charges[0]);
  for (const charge of payload.charges) assert.deepEqual(Object.keys(charge).sort(), ['at', 'cost', 'title']);
  const text = JSON.stringify(payload);
  assert.equal(text.includes('sEcReT'), false);
  assert.equal(text.includes('private'), false);
  const cents = payload.charges.reduce((sum, charge) => sum + Math.round(charge.cost * 100), 0);
  assert.equal(Math.round(payload.left * 100), cents);
});

test('an empty month says nothing is left, with no next charge', () => {
  const payload = monthBill.billPayload(serverSummary([]), { now });
  assert.equal(payload.left, 0);
  assert.equal(payload.count, 0);
  assert.equal(payload.next, null);
  assert.deepEqual(payload.charges, []);
  assert.equal(payload.unpriced, 0);
});

test('a long month is capped and says so', () => {
  const daily = [{ id: 'd', title: 'Daily', category: BILLS, repeatDays: 1, resetAt: at(11, 1), cost: 1 }];
  const early = new Date(2026, 10, 1, 0, 30);
  const payload = monthBill.billPayload(serverSummary(daily, early), { now: early, maxCharges: 5 });
  assert.equal(payload.charges.length, 5);
  assert.equal(payload.truncated, true);
  assert.equal(payload.count, 30);
});

// ─── The route ─────────────────────────────────────────────────────────────

const PASSPHRASE = 'open-the-month-bill';
const SHORTCUTS_TOKEN = 'month-bill-shortcut-token-1234567890';

async function startServer() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-month-bill-'));
  const buildEnv = port => {
    const environment = {
      ...process.env,
      PORT: String(port),
      PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
      APP_TIMEZONE: 'UTC',
      APP_SETTINGS_FILE: path.join(scratch, 'settings.json'),
      CALENDAR_EVENTS_FILE: path.join(scratch, 'calendar-events.json'),
      AGENTS_FILE: path.join(scratch, 'agents.json'),
      MEMORIES_FILE: path.join(scratch, 'memories.json'),
      DROPS_FILE: path.join(scratch, 'drops.json'),
      PROJECTS_FILE: path.join(scratch, 'projects.json'),
      COUNTDOWNS_FILE: path.join(scratch, 'countdowns.json'),
      DROPS_PASSPHRASE: PASSPHRASE,
      SHORTCUTS_TOKEN,
      RESET_TIMER_INTERVAL_MS: '0',
    };
    ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DROPS_PASSPHRASE_HASH', 'NODE_ENV',
      'RAILWAY_ENVIRONMENT', 'RAILWAY_ENVIRONMENT_NAME', 'RAILWAY_PROJECT_ID', 'RAILWAY_SERVICE_ID', 'SESSION_SECRET']
      .forEach(key => { delete environment[key]; });
    return environment;
  };
  const server = await startTestServer({ serverPath: path.join(DIST, 'server.js'), cwd: DIST, buildEnv });
  const session = await fetch(`${server.origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  assert.equal(session.status, 200);
  const cookie = String(session.headers.get('set-cookie') || '').split(';')[0];
  return {
    ...server,
    cookie,
    stop() {
      server.child.kill();
      fs.rmSync(scratch, { recursive: true, force: true });
    },
  };
}

test('/api/shortcuts/month-bill: token only, and the bill the stored records make', async () => {
  const server = await startServer();
  try {
    const url = `${server.origin}/api/shortcuts/month-bill`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: { 'X-Shortcuts-Token': 'wrong' } })).status, 401);
    // The Office session is not this route's credential.
    assert.equal((await fetch(url, { headers: { Cookie: server.cookie } })).status, 401);

    // Records the way the page saves them: one bill due later this month in
    // UTC, wherever "now" falls, plus one with no cost and one paused.
    const soon = new Date(Date.now() + 60 * 1000);
    const monthEnd = Date.UTC(soon.getUTCFullYear(), soon.getUTCMonth() + 1, 1);
    const due = new Date(Math.min(soon.getTime() + 60 * 60 * 1000, monthEnd - 60 * 1000)).toISOString();
    const items = [
      { id: 'b1', title: 'Streaming', category: BILLS, resetAt: due, cost: 15.99, status: 'active',
        webhookUrl: 'https://api.pushcut.io/sEcReT-key/notifications/Bill', updatedAt: new Date().toISOString() },
      { id: 'b2', title: 'Insurance', category: BILLS, resetAt: due, status: 'active', updatedAt: new Date().toISOString() },
      { id: 'b3', title: 'Paused', category: BILLS, resetAt: due, cost: 50, status: 'paused', updatedAt: new Date().toISOString() },
    ];
    const put = await fetch(`${server.origin}/api/reset-timers`, {
      method: 'PUT',
      headers: { Cookie: server.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    assert.equal(put.status, 200);

    const response = await fetch(url, { headers: { Authorization: `Bearer ${SHORTCUTS_TOKEN}` } });
    assert.equal(response.status, 200);
    const raw = await response.text();
    assert.equal(raw.includes('sEcReT'), false);
    assert.equal(raw.includes(SHORTCUTS_TOKEN), false);
    const payload = JSON.parse(raw);
    assert.equal(payload.timezone, 'UTC');
    assert.equal(payload.left, 15.99);
    assert.equal(payload.count, 1);
    assert.equal(payload.unpriced, 1);
    assert.deepEqual(payload.next, { title: 'Streaming', cost: 15.99, at: due });
  } finally {
    server.stop();
  }
});

test('countdowns.html loads month-bill.js between timer-rotation.js and resets.js', () => {
  const html = read('countdowns.html');
  const rotation = html.indexOf('<script src="timer-rotation.js');
  const bill = html.indexOf('<script src="month-bill.js');
  const resets = html.indexOf('<script src="resets.js');
  assert.ok(rotation !== -1 && bill !== -1 && resets !== -1);
  assert.ok(rotation < bill && bill < resets);
});

test('countdowns.html?category=<id> opens on that category without saving it', () => {
  const source = read('resets.js');
  assert.match(source, /new URLSearchParams\(window\.location\.search\)\.get\('category'\)/);
  assert.match(source, /if \(linked && CATEGORY_FILTERS\[linked\]\) state\.categoryFilter = linked;/);
});

test("the month ends where the reader's ends: a renewal just after midnight on the 1st is next month's", () => {
  // Run as if on a Vancouver server, read from Toronto, as Main Hub does.
  const script = `
    const monthBill = require(${JSON.stringify(path.join(DIST, 'month-bill.js'))});
    const now = new Date('2026-11-21T17:00:00Z');
    const records = [
      { id: 'claude', title: 'Claude Pro', category: 'subscriptions-bills', repeatMonths: 1, resetAt: '2026-12-01T05:59:00Z', cost: 31.16 },
      { id: 'later', title: 'Later in Nov', category: 'subscriptions-bills', repeatMonths: 1, resetAt: '2026-11-28T15:00:00Z', cost: 10 },
    ];
    const cards = records.map(monthBill.billCard);
    const pay = tz => monthBill.billPayload(monthBill.billSummary(cards, now, { timeZone: tz }), { now, timezone: process.env.TZ });
    // Just before midnight Dec 1 in Toronto, it is already December there.
    const edge = new Date('2026-12-01T05:30:00Z');
    const edgePay = monthBill.billPayload(monthBill.billSummary(cards, edge, { timeZone: 'America/Toronto' }), { now: edge });
    console.log(JSON.stringify({
      server: pay(''), toronto: pay('America/Toronto'), bogus: pay('Not/AZone'), edge: edgePay,
      bad: [monthBill.validTimeZone('../etc'), monthBill.validTimeZone(''), monthBill.validTimeZone('America/Toronto')],
    }));`;
  const { execFileSync } = require('node:child_process');
  const out = JSON.parse(execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: 'America/Vancouver' } }).toString());

  // Vancouver's November still holds 9:59 PM Nov 30 there; Toronto's does not.
  assert.equal(out.server.left, 41.16);
  assert.equal(out.toronto.timezone, 'America/Toronto');
  assert.equal(out.toronto.month, '2026-11');
  assert.equal(out.toronto.month_label, 'November');
  assert.equal(out.toronto.left, 10);
  assert.deepEqual(out.toronto.charges.map(c => c.title), ['Later in Nov']);
  // An unknown zone is the server's month, never an error.
  assert.equal(out.bogus.left, 41.16);
  assert.equal(out.bogus.timezone, 'America/Vancouver');
  // At 12:30 AM Dec 1 in Toronto the bill is December's: the 12:59 AM renewal
  // once, stepped on Toronto's clock (Jan 1 is January's), and the 28th's.
  assert.equal(out.edge.month, '2026-12');
  assert.equal(out.edge.month_label, 'December');
  assert.deepEqual(out.edge.charges.map(c => [c.title, c.at]),
    [['Claude Pro', '2026-12-01T05:59:00.000Z'], ['Later in Nov', '2026-12-28T15:00:00.000Z']]);
  assert.deepEqual(out.bad, ['', '', 'America/Toronto']);
});
