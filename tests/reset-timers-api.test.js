'use strict';

// Reset Timers end to end: the passphrase-gated store the page writes, the
// token-gated view a Shortcut reads, and the server-side processor that pushes
// a landed timer to Pushcut.
//
// Nothing in here talks to Pushcut. Deliveries go to a throwaway HTTP server
// started per test, which is also how the "did it retry / did it send twice"
// questions get answered: the mock counts what it received.
//
// That local server is not a destination the processor would accept on its own:
// delivery is Pushcut-only, and every test that uses the mock says so out loud
// by passing the loopback allowance in. Nothing here relaxes the production
// rule, and the tests below the harness pin down what that rule refuses.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');
const resetTimers = require(path.join(DIST, 'reset-timers.js'));

const PASSPHRASE = 'open-the-reset-timers';
const SHORTCUTS_TOKEN = 'reset-timer-shortcut-token-1234567890';

// A URL shaped like the real thing: the secret is in the query string, which is
// exactly what must never turn up in a response, a log line or a stored error.
const SECRET = 'sEcReT-pushcut-key-98765';
const FAKE_WEBHOOK = `https://api.pushcut.io/${SECRET}/notifications/Timer`;

// ─── Harness ─────────────────────────────────────────────────────────────────

async function startServer(options = {}) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-reset-timers-'));

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
      STREAKS_FILE: path.join(scratch, 'streaks.json'),
      STREAK_DAYS_FILE: path.join(scratch, 'streak-days.json'),
      COUNTDOWNS_FILE: path.join(scratch, 'countdowns.json'),
      DROPS_PASSPHRASE: PASSPHRASE,
      SHORTCUTS_TOKEN,
      // Off by default: only the one processor test wants the loop running, and
      // a background timer firing under the other tests would make them flaky.
      RESET_TIMER_INTERVAL_MS: String(options.intervalMs ?? 0),
      // The one way the server will send anywhere but Pushcut, and it only ever
      // buys loopback: the stand-in below runs on 127.0.0.1. A deployment
      // refuses this outright, which is what the last test in this file checks.
      RESET_TIMER_ALLOW_LOOPBACK_WEBHOOKS: options.allowLoopback === false
        ? ''
        : resetTimers.LOOPBACK_WEBHOOK_ACK,
    };
    ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DROPS_PASSPHRASE_HASH']
      .forEach(key => { delete environment[key]; });
    return environment;
  };

  const server = await startTestServer({ serverPath: SERVER_PATH, cwd: DIST, buildEnv });
  const cookie = await unlock(server.origin);
  return { ...server, scratch, cookie };
}

function stop(server) {
  server.child.kill();
  fs.rmSync(server.scratch, { recursive: true, force: true });
}

async function unlock(origin) {
  const response = await fetch(`${origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  assert.equal(response.status, 200);
  return String(response.headers.get('set-cookie') || '').split(';')[0];
}

function call(server, pathname, options = {}) {
  return fetch(`${server.origin}${pathname}`, {
    ...options,
    headers: { Cookie: server.cookie, ...(options.headers || {}) },
  });
}

function shortcut(server, pathname, token = SHORTCUTS_TOKEN) {
  const headers = token === null ? {} : { 'X-Shortcuts-Token': token };
  return fetch(`${server.origin}${pathname}`, { headers });
}

async function putTimers(server, items) {
  return call(server, '/api/reset-timers', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
}

async function getTimers(server) {
  const response = await call(server, '/api/reset-timers');
  assert.equal(response.status, 200);
  return (await response.json()).items;
}

function inHours(count) {
  return new Date(Date.now() + count * 3600000).toISOString();
}

function timer(fields) {
  return {
    id: 'timer-1',
    title: 'Claude Usage Reset',
    resetAt: inHours(2),
    webhookUrl: '',
    repeatDays: 0,
    status: 'active',
    fired: false,
    updatedAt: new Date().toISOString(),
    ...fields,
  };
}

/**
 * A stand-in for Pushcut: records every request and answers however the test
 * says it should.
 */
async function startPushcut(options = {}) {
  const received = [];
  let status = options.status || 200;

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      received.push({ url: req.url, method: req.method, body });
      res.writeHead(status, { 'Content-Type': 'text/plain' });
      res.end(status < 400 ? 'ok' : 'no');
    });
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    received,
    url: `http://127.0.0.1:${port}/${SECRET}/notifications/Timer`,
    setStatus(next) { status = next; },
    async close() { await new Promise(resolve => server.close(resolve)); },
  };
}

// ─── Persistence ─────────────────────────────────────────────────────────────

test('reset timer storage is behind the passphrase', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  assert.equal((await fetch(`${server.origin}/api/reset-timers`)).status, 401);

  const blindWrite = await fetch(`${server.origin}/api/reset-timers`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [] }),
  });
  assert.equal(blindWrite.status, 401);

  const items = [timer({}), timer({ id: 'timer-2', title: 'Codex Usage Reset', resetAt: inHours(6) })];
  assert.equal((await putTimers(server, items)).status, 200);
  assert.deepEqual(await getTimers(server), items, 'records round-trip exactly as written');
});

test('a malformed reset timer payload is rejected, and the limits hold', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  const notAnArray = await putTimers(server, { nope: true });
  assert.equal(notAnArray.status, 400);
  assert.match((await notAnArray.json()).error, /array/);

  const notObjects = await putTimers(server, ['just a string']);
  assert.equal(notObjects.status, 400);
  assert.match((await notObjects.json()).error, /object/);

  const tooMany = await putTimers(server, Array.from({ length: 201 }, (_, i) => timer({ id: `t-${i}` })));
  assert.equal(tooMany.status, 400);
  assert.match((await tooMany.json()).error, /no more than 200/);

  // The server's own 50KB body cap closes the connection long before a payload
  // gets near the timer-store limit, so that one is checked where it lives.
  await assert.rejects(putTimers(server, [timer({ notes: 'x'.repeat(260000) })]));
  const oversized = resetTimers.validateStoredItems([{ id: 'big', notes: 'x'.repeat(260000) }]);
  assert.equal(oversized.ok, false);
  assert.equal(oversized.status, 413);

  assert.deepEqual(await getTimers(server), [], 'nothing was stored on the way through');
});

// ─── The Shortcuts view ──────────────────────────────────────────────────────

test('the reset timer Shortcut endpoint needs the phone inbox token', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  assert.equal((await shortcut(server, '/api/shortcuts/reset-timers', null)).status, 401);
  assert.equal((await shortcut(server, '/api/shortcuts/reset-timers', 'not-the-token-at-all')).status, 401);
  assert.equal((await shortcut(server, '/api/shortcuts/reset-timers')).status, 200);

  // The session cookie is not a substitute: the phone inbox has its own key.
  assert.equal((await call(server, '/api/shortcuts/reset-timers')).status, 401);
});

test('a Shortcut reads the timers as JSON, soonest first, without the webhook', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  await putTimers(server, [
    timer({ id: 'later', title: 'Haircut', resetAt: inHours(120), webhookUrl: FAKE_WEBHOOK }),
    timer({ id: 'soon', title: 'Claude Usage Reset', resetAt: inHours(2), webhookUrl: FAKE_WEBHOOK }),
    timer({ id: 'middle', title: 'Codex Usage Reset', resetAt: inHours(27), repeatDays: 1 }),
    timer({ id: 'paused', title: 'Paused thing', resetAt: inHours(3), status: 'paused' }),
    timer({ id: 'done', title: 'Finished thing', resetAt: inHours(4), status: 'completed' }),
    timer({ id: 'expired', title: 'Landed already', resetAt: inHours(-3) }),
    timer({ id: 'gone', title: 'Deleted thing', resetAt: inHours(1), deleted: true }),
  ]);

  const response = await shortcut(server, '/api/shortcuts/reset-timers');
  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.ok(Date.parse(payload.generated_at), 'generated_at is an ISO timestamp');
  assert.equal(payload.state, 'active');
  assert.equal(payload.count, 3);
  assert.deepEqual(
    payload.items.map(item => item.id),
    ['soon', 'middle', 'later'],
    'active only, sorted by the soonest reset'
  );

  const first = payload.items[0];
  assert.equal(first.title, 'Claude Usage Reset');
  assert.equal(first.status, 'active');
  assert.equal(first.repeat_days, 0);
  assert.ok(first.remaining_ms > 0 && first.remaining_ms <= 2 * 3600000);
  assert.match(first.remaining, /^1h \d\dm$/);
  assert.equal(payload.items[1].remaining_ms > first.remaining_ms, true);
  assert.equal(payload.items[1].repeat_days, 1);

  // The credential is the whole reason this projection exists.
  const raw = JSON.stringify(payload);
  assert.equal(raw.includes('webhookUrl'), false);
  assert.equal(raw.includes('pushcut'), false);
  assert.equal(raw.includes(SECRET), false);
});

test('state and limit narrow what the Shortcut gets', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  await putTimers(server, [
    timer({ id: 'a', title: 'A', resetAt: inHours(1) }),
    timer({ id: 'b', title: 'B', resetAt: inHours(2) }),
    timer({ id: 'c', title: 'C', resetAt: inHours(3) }),
    timer({ id: 'p', title: 'Paused', resetAt: inHours(4), status: 'paused' }),
    timer({ id: 'x', title: 'Expired', resetAt: inHours(-1) }),
  ]);

  const limited = await (await shortcut(server, '/api/shortcuts/reset-timers?limit=2')).json();
  assert.deepEqual(limited.items.map(item => item.id), ['a', 'b']);
  assert.equal(limited.count, 2);

  const paused = await (await shortcut(server, '/api/shortcuts/reset-timers?state=paused')).json();
  assert.deepEqual(paused.items.map(item => item.id), ['p']);

  const expired = await (await shortcut(server, '/api/shortcuts/reset-timers?state=expired')).json();
  assert.deepEqual(expired.items.map(item => item.id), ['x']);

  const all = await (await shortcut(server, '/api/shortcuts/reset-timers?state=all')).json();
  assert.equal(all.count, 5);

  // An unknown state falls back to the default rather than erroring at a phone.
  const nonsense = await (await shortcut(server, '/api/shortcuts/reset-timers?state=sideways')).json();
  assert.equal(nonsense.state, 'active');
  assert.equal(nonsense.count, 3);
});

test('format=text is something a Shortcut can show as-is', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  const quiet = await shortcut(server, '/api/shortcuts/reset-timers?format=text');
  assert.equal(quiet.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(await quiet.text(), 'No active timers.');

  await putTimers(server, [
    timer({ id: 'a', title: 'Claude Usage Reset', resetAt: inHours(2), webhookUrl: FAKE_WEBHOOK }),
    timer({ id: 'b', title: 'Codex Usage Reset', resetAt: inHours(27) }),
    timer({ id: 'c', title: 'Haircut', resetAt: inHours(121) }),
  ]);

  const report = await (await shortcut(server, '/api/shortcuts/reset-timers?format=text')).text();
  const lines = report.split('\n');
  assert.equal(lines[0], '3 active timers');
  assert.match(lines[1], /^• Claude Usage Reset — 1h \d\dm$/);
  assert.match(lines[2], /^• Codex Usage Reset — 1 Day & 2h$/);
  assert.match(lines[3], /^• Haircut — 5 Days$/);
  assert.equal(report.includes(SECRET), false);

  const one = await (await shortcut(server, '/api/shortcuts/reset-timers?format=text&limit=1')).text();
  assert.equal(one.split('\n')[0], '1 active timer');
});

test('the setup page publishes the reset timer URL alongside the countdowns one', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  const setup = await (await call(server, '/api/shortcuts/setup')).json();
  assert.match(setup.reset_timers_url, /\/api\/shortcuts\/reset-timers\?limit=5&format=text$/);
  assert.match(setup.countdowns_url, /\/api\/shortcuts\/countdowns\?limit=5&format=text$/);
  assert.equal(setup.header, 'X-Shortcuts-Token');
  assert.equal(JSON.stringify(setup).includes(SHORTCUTS_TOKEN), false);
});

// ─── The notification processor ──────────────────────────────────────────────
//
// processDueTimers() is pure apart from the delivery call, so these run it
// directly against the mock Pushcut rather than through a server. What it
// returns is a list of patches; applyTimerUpdates() folds them back in, which
// is exactly what the server does between cycles.

// Delivery is Pushcut-only; the mock is on loopback. Every run through the
// processor therefore has to ask for the loopback allowance explicitly - which
// is the point of it being an argument rather than a default.
function runProcessor(timers, options = {}) {
  return resetTimers.processDueTimers({
    timers,
    retryBaseMs: 0,
    allowTarget: resetTimers.loopbackWebhookTarget(),
    ...options,
  });
}

async function cycle(timers, options = {}) {
  const outcome = await runProcessor(timers, options);
  return {
    ...outcome,
    timers: resetTimers.applyTimerUpdates(timers, outcome.updates).items,
  };
}

test('a due timer is sent once, and a restart does not send it again', async t => {
  const pushcut = await startPushcut();
  t.after(() => pushcut.close());

  const first = await cycle([timer({ resetAt: inHours(-0.5), webhookUrl: pushcut.url })]);
  assert.equal(pushcut.received.length, 1);
  assert.deepEqual(first.results.map(r => r.outcome), ['delivered']);

  const sent = JSON.parse(pushcut.received[0].body);
  assert.equal(sent.title, 'Claude Usage Reset');
  assert.equal(sent.event, 'countdown_reached_zero');

  const stored = first.timers[0];
  assert.equal(stored.fired, true);
  assert.equal(stored.firedForResetAt, stored.resetAt, 'the occurrence that was sent is recorded');
  assert.ok(Date.parse(stored.firedAt));
  assert.equal(stored.lastNotificationError, '');

  // Same records, fresh processor: this is what a Railway restart looks like.
  const second = await cycle(first.timers);
  assert.equal(pushcut.received.length, 1, 'no second notification for the same occurrence');
  assert.deepEqual(second.results.map(r => r.reason), ['already-fired']);
});

test('nothing is sent for a timer that is not due, paused, done, deleted or unhooked', async t => {
  const pushcut = await startPushcut();
  t.after(() => pushcut.close());

  const outcome = await runProcessor([
    timer({ id: 'future', resetAt: inHours(2), webhookUrl: pushcut.url }),
    timer({ id: 'paused', resetAt: inHours(-1), webhookUrl: pushcut.url, status: 'paused' }),
    timer({ id: 'done', resetAt: inHours(-1), webhookUrl: pushcut.url, status: 'completed' }),
    timer({ id: 'gone', resetAt: inHours(-1), webhookUrl: pushcut.url, deleted: true }),
    timer({ id: 'no-hook', resetAt: inHours(-1), webhookUrl: '' }),
    timer({ id: 'shared', resetAt: inHours(-1), webhookUrl: pushcut.url, source: 'office' }),
  ]);

  assert.equal(pushcut.received.length, 0);
  assert.equal(outcome.changed, false);
  assert.deepEqual(
    outcome.results.map(result => [result.id, result.reason]),
    [
      ['future', 'not-due'],
      ['paused', 'paused'],
      ['done', 'completed'],
      ['gone', 'deleted'],
      ['no-hook', 'no-webhook'],
      ['shared', 'shared'],
    ]
  );
});

test('a failed delivery stays retryable and never writes the webhook URL down', async t => {
  const pushcut = await startPushcut({ status: 500 });
  t.after(() => pushcut.close());

  const failed = await cycle([timer({ resetAt: inHours(-0.5), webhookUrl: pushcut.url })]);
  assert.equal(pushcut.received.length, 1);
  assert.deepEqual(failed.results.map(r => r.outcome), ['failed']);

  const after = failed.timers[0];
  assert.equal(after.fired, false, 'nothing claims the send happened');
  assert.equal(after.firedForResetAt, undefined);
  assert.equal(after.notificationAttempts, 1);
  assert.ok(Date.parse(after.lastNotificationAttemptAt));
  assert.match(after.lastNotificationError, /500/);

  // The record keeps its own webhook - the page needs it - but nothing the
  // failure produced may repeat it back: the stored error is read by the page
  // and the result line is what gets logged.
  const written = after.lastNotificationError + JSON.stringify(failed.results);
  assert.equal(written.includes(SECRET), false);
  assert.equal(written.includes(pushcut.url), false);

  // A retry is genuinely attempted once the backoff has passed...
  pushcut.setStatus(200);
  const retried = await cycle(failed.timers);
  assert.equal(pushcut.received.length, 2);
  assert.deepEqual(retried.results.map(r => r.outcome), ['delivered']);
  assert.equal(retried.timers[0].firedForResetAt, retried.timers[0].resetAt);
});

test('a failing webhook is backed off rather than hammered', async t => {
  const pushcut = await startPushcut({ status: 500 });
  t.after(() => pushcut.close());

  const failed = await cycle(
    [timer({ resetAt: inHours(-0.5), webhookUrl: pushcut.url })],
    { retryBaseMs: 5 * 60000 }
  );
  assert.equal(pushcut.received.length, 1);

  const held = await cycle(failed.timers, { retryBaseMs: 5 * 60000 });
  assert.equal(pushcut.received.length, 1, 'the next cycle waits');
  assert.deepEqual(held.results.map(r => r.reason), ['backoff']);

  // Each failure pushes the next attempt further out.
  assert.equal(resetTimers.backoffMs(1, 1000, 60000), 1000);
  assert.equal(resetTimers.backoffMs(2, 1000, 60000), 2000);
  assert.equal(resetTimers.backoffMs(3, 1000, 60000), 4000);
  assert.equal(resetTimers.backoffMs(20, 1000, 60000), 60000, 'and stops at the ceiling');
});

test('an unreachable webhook fails without leaking the URL into the error', async t => {
  // Port 1 on loopback: nothing is listening, so this is a connection error
  // rather than an HTTP status.
  const outcome = await cycle([timer({
    resetAt: inHours(-0.5),
    webhookUrl: `http://127.0.0.1:1/${SECRET}/notifications/Timer`,
  })]);

  assert.deepEqual(outcome.results.map(r => r.outcome), ['failed']);
  const written = outcome.timers[0].lastNotificationError + JSON.stringify(outcome.results);
  assert.equal(written.includes(SECRET), false);
  assert.equal(outcome.timers[0].lastNotificationError.length > 0, true);
});

test('a webhook URL is reduced to its host before it can be written down', () => {
  // This is what the server's log line uses, and what every stored error is
  // passed through. The path and query are the Pushcut secret.
  assert.equal(resetTimers.describeWebhook(FAKE_WEBHOOK), 'api.pushcut.io/…');
  assert.equal(resetTimers.describeWebhook('not a url at all'), 'the webhook URL');

  assert.equal(resetTimers.redactWebhook(`POST ${FAKE_WEBHOOK} failed`, FAKE_WEBHOOK), 'POST [webhook] failed');
  // Even a URL this call was not told about is taken out.
  assert.equal(
    resetTimers.redactWebhook(`connect ECONNREFUSED ${FAKE_WEBHOOK}`, '').includes(SECRET),
    false
  );
  assert.equal(resetTimers.redactWebhook('ECONNREFUSED', FAKE_WEBHOOK), 'ECONNREFUSED');
});

test('a repeating timer advances exactly once, a one-off stays expired', async t => {
  const pushcut = await startPushcut();
  t.after(() => pushcut.close());

  const landed = inHours(-0.5);
  const outcome = await cycle([
    timer({ id: 'daily', title: 'Daily reset', resetAt: landed, repeatDays: 1, webhookUrl: pushcut.url }),
    timer({ id: 'once', title: 'One-off', resetAt: landed, repeatDays: 0, webhookUrl: pushcut.url }),
  ]);
  assert.equal(pushcut.received.length, 2);

  const repeating = outcome.timers.find(item => item.id === 'daily');
  assert.equal(Date.parse(repeating.resetAt) > Date.now(), true, 'moved to the next occurrence');
  assert.equal(
    Math.round((Date.parse(repeating.resetAt) - Date.parse(landed)) / 3600000),
    24,
    'exactly one day on, keeping the hour it was set to'
  );
  assert.equal(repeating.fired, false, 're-armed for the new occurrence');
  assert.equal(repeating.firedForResetAt, landed, 'and the send it already made is still on the record');

  const once = outcome.timers.find(item => item.id === 'once');
  assert.equal(once.resetAt, landed, 'a one-off does not move');
  assert.equal(once.fired, true);
  assert.equal(once.firedForResetAt, landed);

  // Neither one sends again on the next pass.
  const again = await cycle(outcome.timers);
  assert.equal(pushcut.received.length, 2);
  assert.deepEqual(again.results.map(r => r.reason).sort(), ['already-fired', 'not-due']);
});

test('timers the browser already fired, and long-dead ones, are not replayed', async t => {
  const pushcut = await startPushcut();
  t.after(() => pushcut.close());

  const outcome = await cycle([
    // Written before delivery moved to the server: `fired` and nothing else.
    timer({ id: 'legacy', resetAt: inHours(-2), webhookUrl: pushcut.url, fired: true }),
    // Landed a week ago while nothing was running.
    timer({ id: 'ancient', resetAt: inHours(-24 * 7), webhookUrl: pushcut.url }),
  ]);

  assert.equal(pushcut.received.length, 0, 'deploying this must not replay old notifications');
  assert.deepEqual(
    outcome.results.map(result => [result.id, result.reason]),
    [['legacy', 'already-fired-by-browser'], ['ancient', 'too-late']]
  );
  // Both are marked handled, so they are not reconsidered every cycle.
  outcome.timers.forEach(item => assert.equal(item.firedForResetAt, item.resetAt));
});

test('a timer retimed mid-flight does not inherit the old occurrence result', async () => {
  const outcome = await runProcessor(
    [timer({ resetAt: inHours(-0.5), webhookUrl: FAKE_WEBHOOK })],
    { send: async () => ({ ok: true, status: 200, error: '' }) }
  );
  assert.equal(outcome.updates.length, 1);

  // The owner picked a new time while the webhook was in flight.
  const retimed = [timer({ resetAt: inHours(5), webhookUrl: FAKE_WEBHOOK })];
  const applied = resetTimers.applyTimerUpdates(retimed, outcome.updates);
  assert.equal(applied.applied, 0);
  assert.deepEqual(applied.items, retimed, 'the new occurrence is left armed');
});

// ─── Where a webhook may point ───────────────────────────────────────────────
//
// A timer's webhook URL decides where the server makes an outbound request to,
// and the timer store is behind one passphrase. Delivery is therefore an
// allowlist of one host: Pushcut over HTTPS, and nothing else gets a socket.

const BLOCKED = resetTimers.BLOCKED_WEBHOOK_ERROR;

test('a Pushcut webhook URL is a destination the processor will send to', () => {
  assert.deepEqual(resetTimers.checkWebhookTarget(FAKE_WEBHOOK), { ok: true, error: '' });
  assert.equal(resetTimers.checkWebhookTarget(`${FAKE_WEBHOOK}?input=hello`).ok, true);
  assert.equal(resetTimers.checkWebhookTarget(`  ${FAKE_WEBHOOK}  `).ok, true, 'a pasted URL keeps its whitespace out of it');
  assert.equal(resetTimers.checkWebhookTarget('https://API.PushCut.io/key/notifications/Timer').ok, true);
  assert.deepEqual(resetTimers.PUSHCUT_WEBHOOK_HOSTS, ['api.pushcut.io']);
});

test('everywhere else is refused, with one answer for all of it', () => {
  const refused = [
    // Somebody else's site.
    'https://example.com/hook',
    'https://evil.example.com/api.pushcut.io/notifications/Timer',
    // A host that only reads like Pushcut.
    'https://api.pushcut.io.evil.example.com/notifications/Timer',
    'https://notapi.pushcut.io/notifications/Timer',
    // Pushcut in the userinfo, somewhere else in the host.
    'https://api.pushcut.io@10.0.0.4/notifications/Timer',
    'https://api.pushcut.io:pass@127.0.0.1/notifications/Timer',
    // The server itself.
    'http://localhost/notifications/Timer',
    'https://localhost:8080/notifications/Timer',
    'http://127.0.0.1/notifications/Timer',
    'http://127.0.0.1:8080/notifications/Timer',
    'http://[::1]/notifications/Timer',
    // Private and link-local space, including the cloud metadata address.
    'http://10.0.0.4/notifications/Timer',
    'http://192.168.1.10/notifications/Timer',
    'http://172.16.4.9/notifications/Timer',
    'http://169.254.169.254/latest/meta-data/',
    // Railway's own internal network.
    'http://agent-office.railway.internal/notifications/Timer',
    'http://postgres.railway.internal:5432/',
    // Not HTTP at all.
    'file:///etc/passwd',
    'ftp://api.pushcut.io/notifications/Timer',
    'gopher://api.pushcut.io/',
    'data:text/plain,hello',
    // The right host, the wrong everything else. The query string is the
    // Pushcut secret, so it does not travel in the clear even to Pushcut.
    'http://api.pushcut.io/notifications/Timer',
    'https://api.pushcut.io:8443/notifications/Timer',
  ];

  for (const url of refused) {
    assert.deepEqual(
      resetTimers.checkWebhookTarget(url),
      { ok: false, error: BLOCKED },
      `${url} must not be a webhook destination`
    );
  }

  // A URL that is not one at all is its own answer, and still says nothing back.
  for (const value of ['', '   ', 'not a url at all', 'api.pushcut.io/notifications/Timer', null, undefined, 42]) {
    assert.deepEqual(resetTimers.checkWebhookTarget(value), {
      ok: false,
      error: resetTimers.INVALID_WEBHOOK_ERROR,
    });
  }

  // Neither answer repeats the destination back, so neither can carry a secret
  // into a log line, a stored error or an HTTP response.
  assert.equal(BLOCKED.includes('://'), false);
  assert.equal(
    resetTimers.checkWebhookTarget(`https://evil.example.com/${SECRET}`).error.includes(SECRET),
    false
  );
});

test('a refused destination is never actually requested', async () => {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    return new Response('ok', { status: 200 });
  };

  const blocked = await resetTimers.deliverWebhook('http://127.0.0.1:9/steal', {}, { fetchImpl });
  assert.deepEqual(blocked, { ok: false, status: 0, error: BLOCKED });
  assert.deepEqual(calls, [], 'nothing left the process');

  const nonsense = await resetTimers.deliverWebhook('not a url', {}, { fetchImpl });
  assert.equal(nonsense.error, resetTimers.INVALID_WEBHOOK_ERROR);
  assert.deepEqual(calls, []);

  // And the allowed one does go out, so this is a gate rather than an off switch.
  const sent = await resetTimers.deliverWebhook(FAKE_WEBHOOK, { hello: true }, { fetchImpl });
  assert.equal(sent.ok, true);
  assert.deepEqual(calls, [FAKE_WEBHOOK]);
});

test('a timer pointed somewhere it may not go fails, quietly and retryably', async t => {
  const pushcut = await startPushcut();
  t.after(() => pushcut.close());

  // The same local server the tests above deliver to, minus the loopback
  // allowance: this is what a Railway process does with the same record.
  const outcome = await cycle(
    [timer({ resetAt: inHours(-0.5), webhookUrl: pushcut.url })],
    { allowTarget: undefined }
  );

  assert.equal(pushcut.received.length, 0, 'the request was never made');
  assert.deepEqual(outcome.results.map(r => r.outcome), ['failed']);
  assert.equal(outcome.results[0].reason, BLOCKED);

  const after = outcome.timers[0];
  assert.equal(after.fired, false, 'nothing claims the notification was delivered');
  assert.equal(after.firedForResetAt, undefined, 'the occurrence stays armed');
  assert.equal(after.webhookUrl, pushcut.url, 'the record is still editable, webhook and all');
  assert.equal(after.lastNotificationError, BLOCKED);
  assert.equal(after.notificationAttempts, 1);

  const written = after.lastNotificationError + JSON.stringify(outcome.results);
  assert.equal(written.includes(SECRET), false);
  assert.equal(written.includes(pushcut.url), false);

  // Fixing the URL is all it takes: the same record with a Pushcut destination
  // is delivered by the next pass.
  const fixed = await runProcessor(
    [{ ...after, webhookUrl: FAKE_WEBHOOK }],
    { send: async () => ({ ok: true, status: 200, error: '' }) }
  );
  assert.deepEqual(fixed.results.map(r => r.outcome), ['delivered']);
});

test('the loopback allowance is opt-in by name, and a deployment refuses it', () => {
  const ack = resetTimers.LOOPBACK_WEBHOOK_ACK;

  assert.equal(resetTimers.resolveWebhookAllowance({ env: {} }), null);
  assert.equal(resetTimers.resolveWebhookAllowance({ env: { RESET_TIMER_ALLOW_LOOPBACK_WEBHOOKS: '1' } }), null);
  assert.equal(resetTimers.resolveWebhookAllowance({ env: { RESET_TIMER_ALLOW_LOOPBACK_WEBHOOKS: 'true' } }), null);
  assert.equal(resetTimers.resolveWebhookAllowance({ env: { RESET_TIMER_ALLOW_LOOPBACK_WEBHOOKS: ack.toUpperCase() } }), null);

  // Even said exactly right, a deployment does not take it.
  assert.equal(
    resetTimers.resolveWebhookAllowance({ env: { RESET_TIMER_ALLOW_LOOPBACK_WEBHOOKS: ack }, deployed: true }),
    null
  );

  const allowance = resetTimers.resolveWebhookAllowance({
    env: { RESET_TIMER_ALLOW_LOOPBACK_WEBHOOKS: ack },
    deployed: false,
  });
  assert.equal(typeof allowance, 'function');

  // And all it ever buys is the machine the tests are already running on.
  const allows = url => resetTimers.checkWebhookTarget(url, { allowTarget: allowance }).ok;
  assert.equal(allows('http://127.0.0.1:8080/hook'), true);
  assert.equal(allows('http://localhost:8080/hook'), true);
  assert.equal(allows('http://[::1]:8080/hook'), true);
  assert.equal(allows('https://example.com/hook'), false);
  assert.equal(allows('http://10.0.0.4/hook'), false);
  assert.equal(allows('http://postgres.railway.internal:5432/'), false);
  assert.equal(allows('file:///etc/passwd'), false);
});

test('the page refuses the same destinations before anything is saved', () => {
  // resets.js is browser code, evaluated the way reset-timers-sync.test.js does
  // it. The server is where this rule has to hold; the page carries it so a
  // URL the processor would refuse is caught while it is still on screen.
  const source = fs.readFileSync(path.join(DIST, 'resets.js'), 'utf8');
  const context = { window: {}, Date, console, setInterval, clearInterval, URL };
  vm.runInNewContext(source, context);
  const { webhookTargetError } = context.window.AOResets;

  assert.equal(webhookTargetError(FAKE_WEBHOOK), '');
  assert.equal(webhookTargetError(''), '', 'a timer without a webhook is just a countdown');
  assert.equal(webhookTargetError('   '), '');

  for (const url of [
    'https://example.com/hook',
    'http://127.0.0.1:8080/hook',
    'http://localhost/hook',
    'http://10.0.0.4/hook',
    'http://postgres.railway.internal:5432/',
    'http://api.pushcut.io/notifications/Timer',
    'file:///etc/passwd',
    'nonsense',
  ]) {
    const message = webhookTargetError(url);
    assert.match(message, /pushcut\.io/, `${url} is refused with something the owner can act on`);
    assert.equal(message.includes(url), false, 'the message never repeats the URL back');
  }
});

// ─── The loop, on a real server ──────────────────────────────────────────────

test('the server sends a landed timer with nobody watching the page', async t => {
  const pushcut = await startPushcut();
  t.after(() => pushcut.close());

  const server = await startServer({ intervalMs: 250 });
  t.after(() => stop(server));

  await putTimers(server, [
    timer({ id: 'due', title: 'Claude Usage Reset', resetAt: inHours(-0.25), webhookUrl: pushcut.url }),
    timer({ id: 'later', title: 'Haircut', resetAt: inHours(48), webhookUrl: pushcut.url }),
  ]);

  const deadline = Date.now() + 10000;
  while (pushcut.received.length === 0 && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(pushcut.received.length, 1, 'the due timer was pushed by the server itself');

  // Several more cycles go by; the occurrence stays sent exactly once.
  await new Promise(resolve => setTimeout(resolve, 1200));
  assert.equal(pushcut.received.length, 1);

  const stored = await getTimers(server);
  const due = stored.find(item => item.id === 'due');
  assert.equal(due.firedForResetAt, due.resetAt);
  assert.ok(Date.parse(due.firedAt));
  assert.equal(due.webhookUrl, pushcut.url, 'the page still has its webhook');

  // And the Shortcut view still refuses to hand the credential out.
  const view = await (await shortcut(server, '/api/shortcuts/reset-timers?state=all')).text();
  assert.equal(view.includes(SECRET), false);
});

test('a server without the loopback allowance sends nowhere but Pushcut', async t => {
  const pushcut = await startPushcut();
  t.after(() => pushcut.close());

  // Same server, same due timer, same local destination as the test above -
  // only this one is configured the way a deployment is. Nothing arrives.
  const server = await startServer({ intervalMs: 250, allowLoopback: false });
  t.after(() => stop(server));

  await putTimers(server, [
    timer({ id: 'due', title: 'Claude Usage Reset', resetAt: inHours(-0.25), webhookUrl: pushcut.url }),
  ]);

  const deadline = Date.now() + 5000;
  let stored = [];
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 100));
    stored = await getTimers(server);
    if (stored[0] && stored[0].lastNotificationError) break;
  }

  assert.equal(pushcut.received.length, 0, 'the server made no request to a destination it may not use');

  const due = stored[0];
  assert.equal(due.lastNotificationError, BLOCKED);
  assert.equal(due.fired, false);
  assert.equal(due.firedForResetAt, undefined, 'the occurrence is still armed for a fixed URL');
  assert.equal(due.webhookUrl, pushcut.url, 'and the card still has its webhook to edit');
  assert.equal(JSON.stringify(stored).includes(SECRET), true, 'the record keeps the credential the page needs');
  assert.equal(due.lastNotificationError.includes(SECRET), false, 'the error it shows does not');
});
