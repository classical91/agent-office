'use strict';

// Folder actions on the Dropbox: a folder is only the subject its notes share,
// so emptying or deleting one is a batch operation on the notes the page sends.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const DIST = path.join(path.resolve(__dirname, '..'), 'agent-office-deploy', 'dist');
const PASSPHRASE = 'open-the-folders';

async function startServer() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-folders-'));
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
    };
    ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DROPS_PASSPHRASE_HASH', 'SHORTCUTS_TOKEN']
      .forEach(key => { delete environment[key]; });
    return environment;
  };
  const server = await startTestServer({ serverPath: path.join(DIST, 'server.js'), cwd: DIST, buildEnv });
  const login = await fetch(`${server.origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  assert.equal(login.status, 200);
  const cookie = String(login.headers.get('set-cookie') || '').split(';')[0];
  return { ...server, scratch, cookie };
}

function call(server, pathname, method = 'GET', body) {
  return fetch(`${server.origin}${pathname}`, {
    method,
    headers: { Cookie: server.cookie, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function createNote(server, title, subject) {
  const response = await call(server, '/api/drops', 'POST', { title, subject, content: `${title} body`, priority: 'normal' });
  assert.equal(response.status, 201, await response.clone().text());
  return response.json();
}

async function subjectsById(server) {
  const drops = await (await call(server, '/api/drops')).json();
  return Object.fromEntries(drops.map(drop => [drop.id, drop.subject]));
}

test('bulk delete removes only the notes it names', async t => {
  const server = await startServer();
  t.after(() => { server.child.kill(); fs.rmSync(server.scratch, { recursive: true, force: true }); });

  const a = await createNote(server, 'Doge short', 'TraderClaw');
  const b = await createNote(server, 'Link long', 'TraderClaw');
  const keep = await createNote(server, 'Groceries', 'Home');

  assert.equal((await fetch(`${server.origin}/api/drops/bulk-delete`, { method: 'POST', body: '{"ids":["x"]}' })).status, 401);
  assert.equal((await call(server, '/api/drops/bulk-delete', 'POST', { ids: [] })).status, 400);
  assert.equal((await call(server, '/api/drops/bulk-delete', 'POST', { ids: [42] })).status, 400);

  const response = await call(server, '/api/drops/bulk-delete', 'POST', { ids: [a.id, b.id, 'drop-missing'] });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).deleted, 2);
  assert.deepEqual(await subjectsById(server), { [keep.id]: 'Home' });
});

test('bulk move refiles notes and defaults to General', async t => {
  const server = await startServer();
  t.after(() => { server.child.kill(); fs.rmSync(server.scratch, { recursive: true, force: true }); });

  const a = await createNote(server, 'Doge short', 'TraderClaw');
  const b = await createNote(server, 'Link long', 'TraderClaw');
  const other = await createNote(server, 'Groceries', 'Home');

  const response = await call(server, '/api/drops/bulk-move', 'POST', { ids: [a.id, b.id], subject: 'General' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).moved, 2);
  assert.deepEqual(await subjectsById(server), { [a.id]: 'General', [b.id]: 'General', [other.id]: 'Home' });

  // A blank subject falls back to General, as PATCH does.
  assert.equal((await call(server, '/api/drops/bulk-move', 'POST', { ids: [other.id], subject: ' ' })).status, 200);
  assert.equal((await subjectsById(server))[other.id], 'General');
});
