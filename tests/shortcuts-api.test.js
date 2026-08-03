'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

const TOKEN = 'shortcuts-test-token-0123456789';
const PASSPHRASE = 'open-the-dropbox';

async function startServer(options = {}) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-shortcuts-'));

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
      DROPS_PASSPHRASE: PASSPHRASE,
    };
    ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DROPS_PASSPHRASE_HASH', 'SHORTCUTS_TOKEN']
      .forEach(key => { delete environment[key]; });
    if (options.token !== null) environment.SHORTCUTS_TOKEN = options.token || TOKEN;
    return environment;
  };

  const server = await startTestServer({ serverPath: SERVER_PATH, cwd: DIST, buildEnv });
  return { ...server, scratch };
}

function stop(server) {
  server.child.kill();
  fs.rmSync(server.scratch, { recursive: true, force: true });
}

function send(origin, pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.token !== null) headers['X-Shortcuts-Token'] = options.token || TOKEN;
  return fetch(`${origin}${pathname}`, { ...options, headers });
}

async function pull(origin, query = 'due=now') {
  const response = await send(origin, `/api/shortcuts/drops?${query}`);
  assert.equal(response.status, 200);
  return response.json();
}

test('the phone inbox rejects requests without the right token', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  const anonymous = await fetch(`${server.origin}/api/shortcuts/drops?due=now`);
  assert.equal(anonymous.status, 401);

  const wrong = await send(server.origin, '/api/shortcuts/drops?due=now', { token: 'not-the-token-at-all' });
  assert.equal(wrong.status, 401);

  // Reading the Dropbox session cookie is not enough either: the phone inbox
  // has its own credential.
  const cookieOnly = await fetch(`${server.origin}/api/shortcuts/status`);
  assert.equal(cookieOnly.status, 401);

  const good = await send(server.origin, '/api/shortcuts/status');
  assert.equal(good.status, 200);
});

test('the phone inbox stays off until a long enough token is configured', async t => {
  const off = await startServer({ token: null });
  t.after(() => stop(off));
  const disabled = await send(off.origin, '/api/shortcuts/status', { token: 'anything' });
  assert.equal(disabled.status, 503);
  assert.match((await disabled.json()).error, /SHORTCUTS_TOKEN/);

  const weak = await startServer({ token: 'short' });
  t.after(() => stop(weak));
  const refused = await send(weak.origin, '/api/shortcuts/status', { token: 'short' });
  assert.equal(refused.status, 503);
  assert.match((await refused.json()).error, /at least 16/);
});

test('a plain-text body from the share sheet becomes a drop', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  const response = await send(server.origin, '/api/shortcuts/drops', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'Book the dentist',
  });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.title, 'Book the dentist');
  assert.equal(created.content, 'Book the dentist');
  assert.equal(created.subject, 'Inbox');
  assert.equal(created.remind_at, '');
  assert.match(created.url, /\/mission-board\.html\?task=drop-/);

  // With no reminder time it is not "due", so a due=now pull stays quiet.
  assert.equal((await pull(server.origin)).count, 0);
  assert.equal((await pull(server.origin, 'due=any')).count, 1);
});

test('a reminder sent from the phone comes back when it is due', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  const past = await send(server.origin, '/api/shortcuts/drops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Call the bank', remind: '2026-01-01T09:00:00Z', project: '' }),
  });
  assert.equal(past.status, 201);
  const due = await past.json();
  assert.equal(due.subject, 'Reminder');
  assert.equal(due.project, 'iOS');
  assert.equal(due.remind_at, '2026-01-01T09:00:00.000Z');

  await send(server.origin, '/api/shortcuts/drops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Renew the domain', remind: 'in 3 days' }),
  });

  const nowScope = await pull(server.origin, 'due=now');
  assert.equal(nowScope.count, 1);
  assert.equal(nowScope.items[0].title, 'Call the bank');
  assert.equal(nowScope.items[0].due, true);
  assert.match(nowScope.items[0].due_relative, /overdue$/);

  const allScope = await pull(server.origin, 'due=all');
  assert.deepEqual(allScope.items.map(item => item.title), ['Call the bank', 'Renew the domain']);

  const upcoming = await pull(server.origin, 'due=upcoming');
  assert.deepEqual(upcoming.items.map(item => item.title), ['Renew the domain']);
  assert.equal(upcoming.items[0].due, false);
});

test('form bodies and query strings are accepted the same way', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  const form = await send(server.origin, '/api/shortcuts/drops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ text: 'Pick up parcel', remind: 'in 5m', priority: 'high' }).toString(),
  });
  assert.equal(form.status, 201);
  assert.equal((await form.json()).priority, 'high');

  const query = await send(
    server.origin,
    `/api/shortcuts/drops?${new URLSearchParams({ text: 'Water the plants', remind: 'in 10m', tags: 'home,chores' })}`,
    { method: 'POST' }
  );
  assert.equal(query.status, 201);
  const created = await query.json();
  assert.deepEqual(created.tags, ['home', 'chores']);
  assert.equal(created.subject, 'Reminder');

  const empty = await send(server.origin, '/api/shortcuts/drops', { method: 'POST' });
  assert.equal(empty.status, 400);
  assert.match((await empty.json()).error, /text/);

  const badTime = await send(server.origin, '/api/shortcuts/drops?text=hi&remind=sometime-ish', { method: 'POST' });
  assert.equal(badTime.status, 400);
  assert.match((await badTime.json()).error, /reminder time/i);
});

test('format=text returns a list a Shortcut can show as-is', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  const quiet = await send(server.origin, '/api/shortcuts/drops?due=now&format=text');
  assert.equal(quiet.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(await quiet.text(), 'Nothing due.');

  await send(server.origin, '/api/shortcuts/drops?text=Take%20the%20bins%20out&remind=2026-01-01T09:00:00Z', { method: 'POST' });
  const report = await (await send(server.origin, '/api/shortcuts/drops?due=now&format=text')).text();
  assert.match(report, /^1 item\n• Take the bins out — .*overdue$/);
});

test('done and snooze clear or push out a reminder', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  const created = await (await send(server.origin, '/api/shortcuts/drops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Reply to the invoice', remind: '2026-01-01T09:00:00Z' }),
  })).json();

  const snoozed = await send(server.origin, `/api/shortcuts/drops/${created.id}/snooze?for=2h`, { method: 'POST' });
  assert.equal(snoozed.status, 200);
  const afterSnooze = await snoozed.json();
  assert.equal(afterSnooze.due, false);
  assert.ok(new Date(afterSnooze.remind_at).getTime() > Date.now() + 90 * 60000);
  assert.equal((await pull(server.origin)).count, 0);

  const done = await send(server.origin, `/api/shortcuts/drops/${created.id}/done`, { method: 'POST' });
  assert.equal(done.status, 200);
  const afterDone = await done.json();
  assert.equal(afterDone.status, 'done');
  assert.equal(afterDone.remind_at, '');
  assert.equal((await pull(server.origin, 'due=any')).count, 0);

  const missing = await send(server.origin, '/api/shortcuts/drops/drop-nope/done', { method: 'POST' });
  assert.equal(missing.status, 404);
});

test('status counts what is waiting and names the next reminder', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  await send(server.origin, '/api/shortcuts/drops?text=Overdue%20thing&remind=2026-01-01T09:00:00Z', { method: 'POST' });
  await send(server.origin, '/api/shortcuts/drops?text=Later%20thing&remind=in%202h', { method: 'POST' });
  await send(server.origin, '/api/shortcuts/drops?text=Much%20later&remind=in%205d', { method: 'POST' });

  const status = await (await send(server.origin, '/api/shortcuts/status')).json();
  assert.equal(status.ok, true);
  assert.equal(status.due, 1);
  assert.equal(status.upcoming, 2);
  assert.equal(status.next.title, 'Later thing');
});

test('reminders set through the phone are visible to the web Dropbox', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  await send(server.origin, '/api/shortcuts/drops?text=Sync%20check&remind=2026-01-01T09:00:00Z', { method: 'POST' });

  const login = await fetch(`${server.origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];

  const drops = await (await fetch(`${server.origin}/api/drops`, { headers: { cookie } })).json();
  assert.equal(drops.length, 1);
  assert.equal(drops[0].remind_at, '2026-01-01T09:00:00.000Z');

  // And the web form can set a reminder in the same natural language.
  const patched = await fetch(`${server.origin}/api/drops/${drops[0].id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ remind_at: 'tomorrow 9am' }),
  });
  assert.equal(patched.status, 200);
  assert.ok(new Date((await patched.json()).remind_at).getTime() > Date.now());

  const cleared = await fetch(`${server.origin}/api/drops/${drops[0].id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ remind_at: '' }),
  });
  assert.equal(cleared.status, 200);
  assert.equal((await cleared.json()).remind_at, '');
});

test('every drop gets a title no other drop is using', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  const send1 = async text => (await send(server.origin, '/api/shortcuts/drops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })).json();

  assert.equal((await send1('Telegram Chats with Agents Commands')).title, 'Telegram Chats with Agents Commands');
  assert.equal((await send1('Telegram Chats with Agents Commands')).title, 'Telegram Chats with Agents Commands (2)');
  assert.equal((await send1('Telegram Chats with Agents Commands')).title, 'Telegram Chats with Agents Commands (3)');

  // Case and surrounding space do not make a title different.
  assert.equal((await send1('  telegram chats with agents commands  ')).title, 'telegram chats with agents commands (4)');

  // A different note is left alone.
  assert.equal((await send1('top ways to use pushcut')).title, 'top ways to use pushcut');

  // An explicit title counts the same way.
  const explicit = await (await send(server.origin, '/api/shortcuts/drops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'anything at all', title: 'top ways to use pushcut' }),
  })).json();
  assert.equal(explicit.title, 'top ways to use pushcut (2)');
});

test('the web Dropbox numbers duplicate titles too, and titles stay in range', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  const login = await fetch(`${server.origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];

  const create = async body => (await fetch(`${server.origin}/api/drops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ priority: 'normal', ...body }),
  })).json();

  assert.equal((await create({ content: 'Weekly review notes' })).title, 'Weekly review notes');
  assert.equal((await create({ content: 'Weekly review notes' })).title, 'Weekly review notes (2)');

  // A phone drop and a web drop share one namespace.
  const fromPhone = await (await send(server.origin, '/api/shortcuts/drops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Weekly review notes' }),
  })).json();
  assert.equal(fromPhone.title, 'Weekly review notes (3)');

  // A title taken from the content is capped at 120 characters.
  const long = 'x'.repeat(400);
  assert.equal((await create({ content: long })).title.length, 120);

  // An explicit title fills the 200-character column, and the suffix must not
  // push the next one past it.
  const full = 'y'.repeat(200);
  assert.equal((await create({ content: 'first', title: full })).title.length, 200);
  const second = await create({ content: 'second', title: full });
  assert.equal(second.title.length, 200);
  assert.match(second.title, / \(2\)$/);
});

test('the settings page can read the setup details but never the token', async t => {
  const server = await startServer();
  t.after(() => stop(server));

  const locked = await fetch(`${server.origin}/api/shortcuts/setup`);
  assert.equal(locked.status, 401);

  const login = await fetch(`${server.origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];

  const response = await fetch(`${server.origin}/api/shortcuts/setup`, { headers: { cookie } });
  assert.equal(response.status, 200);
  const setup = await response.json();
  assert.equal(setup.configured, true);
  assert.equal(setup.header, 'X-Shortcuts-Token');
  assert.match(setup.send_url, /\/api\/shortcuts\/drops$/);
  assert.equal(JSON.stringify(setup).includes(TOKEN), false);
});
