'use strict';

// The gap the rest of the suite cannot reach.
//
// Every other test here talks to the server over HTTP: it can tell you that
// /api/drops returns the right JSON and that shared.css comes back as CSS. None
// of them can tell you whether the page built out of those answers actually
// works — whether a script threw on load, whether a stylesheet the markup needs
// was never requested, whether clicking a folder opens it. That is most of this
// app: ~3.5k lines of app-shared.js and a page script apiece, none of it
// executed by `npm test` until now.
//
// These are smoke tests, not a UI spec. They ask two questions of every page —
// did anything throw, and did every asset the page asked this server for come
// back — and then walk the Dropbox, which is the most stateful screen in the
// app. A failure here means the page is broken, not that it looks different.
//
// Requires a Chromium. CI installs one (see .github/workflows/ci.yml); a
// checkout without one skips these rather than failing, unless CI=true, where a
// missing browser is a broken pipeline and says so.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, before, after } = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

// The Office is behind a password whenever one is configured, and these tests
// want the locked path exercised rather than skipped.
const PASSPHRASE = 'smoke-passphrase';

// Two subjects and an iOS drop: enough for a folder wall, a folder with more
// than one note in it, and the Reminders lane that is deliberately not foldered.
const SEED_DROPS = [
  ['drop-1', 'Evening Rollup 2026-08-10', 'Evening Rollup', '', '2026-08-10T21:33:45.000Z'],
  ['drop-2', 'Evening Rollup 2026-08-09', 'Evening Rollup', '', '2026-08-09T21:32:54.000Z'],
  ['drop-3', 'Shadow Bots', 'Githubs', '', '2026-05-04T17:49:41.000Z'],
  ['drop-4', 'Renew the domain', 'Reminder', 'iOS', '2026-08-11T08:00:00.000Z'],
].map(([id, title, subject, project, stamp]) => ({
  id, title, subject, category: subject, project,
  tags: [], status: 'idea', priority: 'normal', done: false, remind_at: '',
  content: `Body of ${title}.`, date: stamp, updated_at: stamp,
}));

let chromium = null;
try {
  ({ chromium } = require('playwright-core'));
} catch { /* reported as a skip below, where a test can carry the message */ }

let server = null;
let browser = null;
let scratch = null;
let skipReason = null;

function startServer() {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-ui-smoke-'));
  fs.writeFileSync(path.join(scratch, 'drops.json'), JSON.stringify(SEED_DROPS), 'utf8');

  const buildEnv = port => {
    const environment = {
      ...process.env,
      PORT: String(port),
      APP_TIMEZONE: 'UTC',
      DROPS_PASSPHRASE: PASSPHRASE,
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

  return startTestServer({ serverPath: SERVER_PATH, cwd: DIST, buildEnv });
}

before(async () => {
  if (!chromium) {
    skipReason = 'playwright-core is not installed (run `npm install`)';
  } else {
    try {
      browser = await chromium.launch({
        // An escape hatch for a machine whose Chromium came from somewhere
        // other than `playwright install` — a distro package, a sandbox image.
        executablePath: process.env.SMOKE_CHROMIUM_PATH || undefined,
      });
    } catch (error) {
      skipReason = `no Chromium available: ${error.message.split('\n')[0]}`;
    }
  }

  // On a laptop a missing browser is a setup detail. In CI it means the install
  // step regressed and every one of these tests would quietly stop running.
  if (skipReason && process.env.CI) throw new Error(`UI smoke tests cannot run in CI: ${skipReason}`);
  if (skipReason) return;

  server = await startServer();
});

after(async () => {
  await browser?.close();
  server?.child.kill();
  if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
});

// Every page is opened in a fresh context so one page's localStorage — a theme,
// a folder layout, a pin — cannot decide how the next one renders.
async function openPage(t) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // Nothing leaves the machine. These tests are about this app, not about
  // whether Google's font CDN is up — and shared.css opens with an @import of
  // it, which sits on the render path of every page: with the CDN unreachable,
  // DOMContentLoaded took 12.8s per page and the suite took four minutes.
  // Blocking outbound requests makes the run hermetic, fast, and the same on a
  // CI box with no egress as on a laptop.
  await context.route('**/*', route => {
    const sameOrigin = new URL(route.request().url()).origin === server.origin;
    return sameOrigin ? route.continue() : route.abort();
  });

  const page = await context.newPage();
  t.after(() => context.close());

  const problems = [];
  page.on('pageerror', error => problems.push(`uncaught ${error.message}`));
  page.on('requestfailed', request => {
    // Outbound requests are aborted above on purpose; only this server's own
    // assets failing is news.
    if (new URL(request.url()).origin !== server.origin) return;
    // A reload cancels whatever poll was in flight, which the browser reports
    // as an abort. That is the test navigating, not the page breaking.
    const reason = request.failure()?.errorText || '';
    if (reason.includes('ERR_ABORTED')) return;
    problems.push(`request failed: ${request.url()} (${reason})`);
  });
  page.on('response', response => {
    if (new URL(response.url()).origin !== server.origin) return;
    // 401 is this app saying "locked", not a page saying "broken": every page
    // polls /api/gateway/status, and /api/drops answers the same way until the
    // login has been through. tests/gateway-status.test.js pins that as the
    // designed answer. Everything else — a 404 for an asset the markup asked
    // for, a 500 from a handler — is a real failure.
    if (response.status() === 401) return;
    if (response.status() >= 400) problems.push(`${response.status()} for ${response.url()}`);
  });

  return { page, problems };
}

// Panes are switched by hiding them, not by emptying them: a table that has
// been drawn once stays in the DOM behind the folder wall. What matters to
// anyone using the page is whether it is on screen, so that is what is asked.
async function onScreen(page, selector) {
  const el = page.locator(selector).first();
  return await el.count() ? el.isVisible() : false;
}

// One login for the whole Office: pages that need it raise #ao-login-modal and
// wait on it. It opens by itself when a page asks for something gated, so this
// gives it a moment to appear before deciding there is nothing to unlock.
async function logIn(page) {
  const modal = page.locator('#ao-login-modal:not([hidden])');
  await modal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (!await modal.count()) return false;
  await page.fill('#ao-login-password', PASSPHRASE);
  await page.click('#ao-login-submit');
  await page.waitForSelector('#ao-login-modal', { state: 'hidden' });
  return true;
}

function pageNames() {
  return fs.readdirSync(DIST).filter(name => name.endsWith('.html')).sort();
}

// A page that throws on load looks fine in a curl and is blank in a browser.
// A same-origin 404 is the half-deployed build tests/static-assets.test.js
// guards the server side of: this is the other half, asked from the page.
test('every page loads without throwing or losing an asset', async t => {
  if (skipReason) return t.skip(skipReason);

  for (const name of pageNames()) {
    const { page, problems } = await openPage(t);
    await page.goto(`${server.origin}/${name}`, { waitUntil: 'domcontentloaded' });
    // Long enough for the deferred work every page kicks off on load — the
    // clock, the roster fetch, the visit ping — to have failed if it is going to.
    await page.waitForTimeout(600);
    assert.deepEqual(problems, [], `${name} did not come up clean`);
  }
});

test('the Dropbox opens on folders, not on every note', async t => {
  if (skipReason) return t.skip(skipReason);

  const { page, problems } = await openPage(t);
  await page.goto(`${server.origin}/mission-board.html`, { waitUntil: 'domcontentloaded' });
  await logIn(page);
  await page.waitForSelector('.drop-folder');

  const names = await page.locator('.drop-folder-name').allTextContents();
  assert.deepEqual(names, ['All Notes', 'Evening Rollup', 'Githubs']);
  // The iOS drop belongs to Reminders and must not turn up as a folder here.
  assert.ok(!names.includes('Reminder'), 'the Reminders lane leaked into the folder wall');
  assert.equal(await onScreen(page, '.dropbox-table'), false, 'notes were listed before a folder was opened');

  await page.locator('.drop-folder', { hasText: 'Evening Rollup' }).click();
  await page.waitForSelector('.dropbox-table');
  assert.equal(await page.locator('.dropbox-table tbody tr').count(), 2);
  assert.equal(await page.locator('.drop-folder-crumb').textContent(), 'Evening Rollup');

  // Title and Updated only: project and tags were taken off this list on
  // purpose, and a stray column here means they came back.
  assert.deepEqual(await page.locator('.dropbox-table th').allTextContents(), ['Title', 'Updated']);

  await page.click('#drop-folder-back');
  await page.waitForSelector('.drop-folder');
  assert.equal(await onScreen(page, '.dropbox-table'), false, 'the note list survived the trip back to the wall');
  assert.deepEqual(problems, []);
});

// Search is the one way past the wall, so it has to reach into folders the
// search box itself is not standing in.
test('a search crosses folders, and clearing it puts the wall back', async t => {
  if (skipReason) return t.skip(skipReason);

  const { page, problems } = await openPage(t);
  await page.goto(`${server.origin}/mission-board.html`, { waitUntil: 'domcontentloaded' });
  await logIn(page);
  await page.waitForSelector('.drop-folder');

  await page.fill('#drop-search', 'shadow');
  await page.waitForSelector('.dropbox-table');
  assert.equal(await page.locator('.dropbox-table tbody tr').count(), 1);
  assert.match(await page.locator('.dropbox-table tbody tr').first().textContent(), /Shadow Bots/);
  // Across folders the subject earns its column back.
  assert.deepEqual(await page.locator('.dropbox-table th').allTextContents(), ['Title', 'Subject', 'Updated']);

  await page.fill('#drop-search', '');
  await page.waitForSelector('.drop-folder');
  assert.equal(await onScreen(page, '.dropbox-table'), false, 'clearing the search left the results on screen');
  assert.deepEqual(problems, []);
});

test('a pinned folder goes to the front and stays there', async t => {
  if (skipReason) return t.skip(skipReason);

  const { page, problems } = await openPage(t);
  await page.goto(`${server.origin}/mission-board.html`, { waitUntil: 'domcontentloaded' });
  await logIn(page);
  await page.waitForSelector('.drop-folder');

  // Githubs sorts last of the two; pinning it should move it ahead of Evening
  // Rollup but still behind All Notes, which is not a folder anyone filed into.
  await page.locator('.drop-folder', { hasText: 'Githubs' }).locator('.drop-folder-pin').click();
  await page.waitForTimeout(150);
  assert.deepEqual(
    await page.locator('.drop-folder-name').allTextContents(),
    ['All Notes', 'Githubs', 'Evening Rollup']
  );
  assert.equal(await page.locator('.drop-folder.is-pinned .drop-folder-name').textContent(), 'Githubs');
  // The star must pin the folder, not open it.
  assert.equal(await onScreen(page, '.dropbox-table'), false);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await logIn(page);
  await page.waitForSelector('.drop-folder');
  assert.deepEqual(
    await page.locator('.drop-folder-name').allTextContents(),
    ['All Notes', 'Githubs', 'Evening Rollup'],
    'the pin did not survive a reload'
  );
  assert.deepEqual(problems, []);
});

test('the folder wall can be laid out as a list, and remembers', async t => {
  if (skipReason) return t.skip(skipReason);

  const { page, problems } = await openPage(t);
  await page.goto(`${server.origin}/mission-board.html`, { waitUntil: 'domcontentloaded' });
  await logIn(page);
  await page.waitForSelector('.drop-folder');

  await page.click('#dropbox-folders-list');
  await page.waitForSelector('.drop-folder-row');
  assert.equal(await page.locator('.drop-folder').count(), 0, 'tiles and rows were on screen together');
  assert.deepEqual(
    await page.locator('.drop-folder-row-label').allTextContents(),
    ['All Notes', 'Evening Rollup', 'Githubs']
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await logIn(page);
  await page.waitForSelector('.drop-folder-row');
  assert.deepEqual(problems, []);
});

// Writing is the path that goes all the way through: form, POST, reload, list.
test('a note saved into an open folder lands in that folder', async t => {
  if (skipReason) return t.skip(skipReason);

  const { page, problems } = await openPage(t);
  await page.goto(`${server.origin}/mission-board.html`, { waitUntil: 'domcontentloaded' });
  await logIn(page);
  await page.waitForSelector('.drop-folder');

  await page.locator('.drop-folder', { hasText: 'Githubs' }).click();
  await page.waitForSelector('.dropbox-table');
  await page.click('#new-drop-btn');
  await page.waitForSelector('#dropbox-quick-capture:not(.is-collapsed)');
  // The open folder is the subject, so the form should already say so.
  assert.equal(await page.inputValue('#drop-subject'), 'Githubs');

  await page.fill('#drop-title', 'Smoke test note');
  await page.fill('#drop-content', 'Written by tests/ui-smoke.test.js');
  await page.click('#save-drop-btn');
  await page.waitForSelector('.dropbox-table tbody tr:nth-child(2)');

  assert.equal(await page.locator('.drop-folder-crumb').textContent(), 'Githubs');
  assert.equal(await page.locator('.dropbox-table tbody tr').count(), 2);
  assert.match(await page.locator('.dropbox-table').textContent(), /Smoke test note/);
  assert.deepEqual(problems, []);
});

// Every gated page has to carry the login markup, not just the pages someone
// remembered. Memory is the one that once shipped without it: the old
// showPassphraseModal() dereferenced a null and the page could never be
// unlocked at all. One login now serves the Office, and this walks it end to
// end on a page that is not the Dropbox.
test('a gated page can actually be logged into', async t => {
  if (skipReason) return t.skip(skipReason);

  const { page, problems } = await openPage(t);
  await page.goto(`${server.origin}/memory.html`, { waitUntil: 'domcontentloaded' });
  assert.equal(await logIn(page), true, 'the memory page never asked for a login');

  assert.doesNotMatch(
    await page.locator('#mem-list').textContent(),
    /Unlock the dropbox first/,
    'the page still thinks it is locked after logging in'
  );
  assert.deepEqual(problems, [], 'the memory page did not survive being logged into');
});

// Reminders is the same page with a different job: one project's lane, listed
// straight away, with no wall in front of it.
test('the Reminders lane skips the folder wall', async t => {
  if (skipReason) return t.skip(skipReason);

  const { page, problems } = await openPage(t);
  await page.goto(`${server.origin}/mission-board.html?view=ios`, { waitUntil: 'domcontentloaded' });
  await logIn(page);
  await page.waitForSelector('.dropbox-table');

  assert.equal(await page.locator('.drop-folder').count(), 0, 'Reminders grew a folder wall');
  assert.deepEqual(await page.locator('.dropbox-table th').allTextContents(), ['Title', 'Reminder', 'Updated']);
  assert.equal(await page.locator('.dropbox-table tbody tr').count(), 1);
  assert.match(await page.locator('.dropbox-table').textContent(), /Renew the domain/);
  assert.deepEqual(problems, []);
});

// A note is a page of its own: the list steps aside, and Back brings it and the
// folder you were in back together.
test('opening a note takes the screen, and Back returns to its folder', async t => {
  if (skipReason) return t.skip(skipReason);

  const { page, problems } = await openPage(t);
  await page.goto(`${server.origin}/mission-board.html`, { waitUntil: 'domcontentloaded' });
  await logIn(page);
  await page.waitForSelector('.drop-folder');

  await page.locator('.drop-folder', { hasText: 'Evening Rollup' }).click();
  await page.waitForSelector('.dropbox-table');
  await page.locator('.dropbox-table tbody tr').first().click();
  await page.waitForSelector('#note-view-section');

  assert.match(await page.locator('.drop-detail-title').textContent(), /Evening Rollup 2026-08-10/);
  assert.match(await page.locator('.drop-detail-content').textContent(), /Body of Evening Rollup 2026-08-10/);
  assert.ok(!await page.locator('.dropbox-table').isVisible(), 'the list stayed on screen behind the note');

  await page.click('#mission-detail-back');
  await page.waitForSelector('.dropbox-table');
  assert.equal(await page.locator('.drop-folder-crumb').textContent(), 'Evening Rollup');
  assert.deepEqual(problems, []);
});
