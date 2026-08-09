'use strict';

// Serving static files.
//
// The server used to answer every miss with index.html at status 200 — assets
// included. That turned a half-deployed build into a silent one: the browser
// asked for resets.css, was handed a page, applied none of it, and the screen
// looked like an older version of the app rather than a broken one. These tests
// hold the line between a page, which falls back to the shell so a deep link
// still lands somewhere, and an asset, which is either there or a 404.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

async function startServer() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-static-'));

  const buildEnv = port => {
    const environment = {
      ...process.env,
      PORT: String(port),
      APP_TIMEZONE: 'UTC',
      APP_SETTINGS_FILE: path.join(scratch, 'settings.json'),
      CALENDAR_EVENTS_FILE: path.join(scratch, 'calendar-events.json'),
      AGENTS_FILE: path.join(scratch, 'agents.json'),
      MEMORIES_FILE: path.join(scratch, 'memories.json'),
      DROPS_FILE: path.join(scratch, 'drops.json'),
      PROJECTS_FILE: path.join(scratch, 'projects.json'),
      STREAKS_FILE: path.join(scratch, 'streaks.json'),
      STREAK_DAYS_FILE: path.join(scratch, 'streak-days.json'),
      VISITS_FILE: path.join(scratch, 'visits.json'),
    };
    ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'].forEach(key => { delete environment[key]; });
    return environment;
  };

  const server = await startTestServer({ serverPath: SERVER_PATH, cwd: DIST, buildEnv });
  return { ...server, scratch };
}

function stop(server) {
  server.child.kill();
  fs.rmSync(server.scratch, { recursive: true, force: true });
}

test('a missing stylesheet or script is a 404, not a page', async () => {
  const server = await startServer();
  try {
    for (const missing of ['/resets-typo.css', '/app-shared-typo.js', '/data-that-is-gone.json']) {
      const response = await fetch(`${server.origin}${missing}`);
      assert.equal(response.status, 404, `${missing} should not be answered with a page`);
      assert.doesNotMatch(
        await response.text(),
        /<!DOCTYPE html>/i,
        `${missing} should not be answered with the app shell`
      );
    }
  } finally {
    stop(server);
  }
});

test('an asset that is there comes back with its own content type', async () => {
  const server = await startServer();
  try {
    const css = await fetch(`${server.origin}/resets.css`);
    assert.equal(css.status, 200);
    assert.equal(css.headers.get('content-type'), 'text/css; charset=utf-8');

    const js = await fetch(`${server.origin}/resets.js`);
    assert.equal(js.status, 200);
    assert.equal(js.headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.match(await js.text(), /window\.AOResets/);
  } finally {
    stop(server);
  }
});

// Pages keep the old behaviour: the shell is a better answer than an error page
// for a URL that is meant to be a view.
test('a page URL still falls back to the app shell', async () => {
  const server = await startServer();
  try {
    for (const route of ['/not-a-real-page.html', '/some-deep-link']) {
      const response = await fetch(`${server.origin}${route}`);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /<!DOCTYPE html>/i);
    }
  } finally {
    stop(server);
  }
});

// The ?v= query on a shared script is the only thing standing between a
// browser and a stale copy of it. Two pages asking for two different versions
// of the same file is two cache entries, and one of them is always the old one.
test('every page asks for the same version of app-shared.js', () => {
  const versions = new Map();
  fs.readdirSync(DIST)
    .filter(name => name.endsWith('.html'))
    .forEach(name => {
      const match = fs.readFileSync(path.join(DIST, name), 'utf8').match(/app-shared\.js\?v=([^"]+)/);
      if (match) versions.set(name, match[1]);
    });

  assert.ok(versions.size > 0, 'no page loads app-shared.js — this test is looking at the wrong thing');
  assert.equal(
    new Set(versions.values()).size,
    1,
    `pages disagree about the app-shared.js version: ${JSON.stringify(Object.fromEntries(versions), null, 2)}`
  );
});

test('a real page is served as itself', async () => {
  const server = await startServer();
  try {
    const response = await fetch(`${server.origin}/resets.html`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.match(await response.text(), /id="reset-cards"/);
  } finally {
    stop(server);
  }
});
