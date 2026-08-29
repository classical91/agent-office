'use strict';

// Choosing who is in the 3D office.
//
// The office draws every agent on the roster and clicking one opens the
// appearance editor. Neither of those answers "which agents are in the room",
// which is what the roster selector is for. The risk this file is written
// against is not a broken animation: it is a screen that goes on advertising a
// cast the app does not have — a hardcoded total, a second roster literal,
// invented agents lifted from concept art. So the assertions below read the
// numbers and the names off the live AGENTS list and compare, rather than
// pinning either side to a copy of its own.
//
// Requires a Chromium, the same way tests/ui-smoke.test.js does: a checkout
// without one skips, unless CI=true, where a missing browser is a broken
// pipeline.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, before, after } = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

// The Office locks itself until a session is opened, and these tests want the
// office as an operator sees it rather than behind the gate.
const PASSPHRASE = 'roster-passphrase';

const shared = fs.readFileSync(path.join(DIST, 'app-shared.js'), 'utf8');
const selector = fs.readFileSync(path.join(DIST, 'office-roster-selector.js'), 'utf8');
const avatars = fs.readFileSync(path.join(DIST, 'agent-avatars.js'), 'utf8');

// The canonical cast, read out of AGENTS itself. Every expectation below is
// derived from this, so the tests cannot drift from the roster they guard.
function liveAgents() {
  const block = shared.slice(shared.indexOf('const AGENTS = ['), shared.indexOf('\n];'));
  return [...block.matchAll(/\n  \{\n\s+id: '([^']+)',\n\s+name: '([^']+)',[\s\S]*?\n\s+role: '([^']+)',/g)]
    .map(([, id, name, role]) => ({ id, name, role }));
}

let chromium = null;
try {
  ({ chromium } = require('playwright-core'));
} catch { /* reported as a skip below, where a test can carry the message */ }

let server = null;
let browser = null;
let scratch = null;
let skipReason = null;

function startServer() {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-roster-'));

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
      browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM_PATH || undefined });
    } catch (error) {
      skipReason = `no Chromium available: ${error.message.split('\n')[0]}`;
    }
  }
  if (skipReason && process.env.CI) throw new Error(`roster selector tests cannot run in CI: ${skipReason}`);
  if (skipReason) return;
  server = await startServer();
});

after(async () => {
  await browser?.close();
  server?.child.kill();
  if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
});

// A browser of its own per test, so one test's saved roster cannot decide what
// the next one opens with. The session is opened over the API rather than
// through the login modal: the gate is tests/office-auth.test.js's subject, and
// what this file wants is the office already unlocked.
async function newOfficeContext(t, { seedStorage = null, seedValue = undefined } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  t.after(() => context.close());
  // Hermetic: shared.css opens with an @import of a font CDN, and this suite is
  // about the app, not about whether that CDN is up.
  await context.route('**/*', route => (
    new URL(route.request().url()).origin === server.origin ? route.continue() : route.abort()
  ));
  const response = await context.request.post(`${server.origin}/api/session`, { data: { passphrase: PASSPHRASE } });
  assert.equal(response.status(), 200, 'the roster tests could not open a session');
  if (seedStorage) await context.addInitScript(seedStorage, seedValue);
  return context;
}

// A context per test, so one test's saved roster cannot decide what the next
// one opens with. `context` is handed back for the reload tests, which need the
// same browser storage on the far side of a navigation.
async function openOffice(t, { reuse = null } = {}) {
  const context = reuse || await newOfficeContext(t);

  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', error => problems.push(`uncaught ${error.message}`));

  await page.goto(`${server.origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.agent-char', { state: 'attached' });
  return { page, context, problems };
}

function roomIds(page) {
  return page.$$eval('.agent-char[data-agent-id]', nodes => nodes.map(node => node.dataset.agentId));
}

async function openPanel(page) {
  await page.click('.office-roster-btn');
  await page.waitForSelector('#office-roster-selector:not([hidden]) .roster-card');
}

test('the panel lists the live roster, with the names and roles the office uses', async t => {
  if (skipReason) return t.skip(skipReason);

  const { page, problems } = await openOffice(t);
  await openPanel(page);

  const cards = await page.$$eval('.roster-card', nodes => nodes.map(node => ({
    id: node.dataset.agentId,
    name: node.querySelector('.roster-card-name').textContent.trim(),
    role: node.querySelector('.roster-card-role').textContent.trim(),
  })));

  assert.deepEqual(cards, liveAgents(), 'the panel is not showing the AGENTS roster');
  // The concept art's cast. None of them is a real agent, and a name here would
  // mean a second roster had been written down somewhere.
  for (const invented of ['RankForge', 'EarthWatch', 'Flashcards', 'CodeSmith', 'VaultKeeper', 'Market Analyst', 'SEO Specialist']) {
    assert.ok(!cards.some(card => `${card.name} ${card.role}`.includes(invented)), `${invented} is not a real agent`);
  }
  assert.deepEqual(problems, []);
});

test('the counters are read off the roster, not written down', async t => {
  if (skipReason) return t.skip(skipReason);

  const { page } = await openOffice(t);
  await openPanel(page);

  const total = liveAgents().length;
  assert.equal(await page.textContent('#roster-selector-available'), `${total} available`);
  assert.equal(await page.textContent('#roster-selector-selected'), `0 / 10 selected`);
  assert.match(await page.textContent('#roster-selector-status'), new RegExp(`all ${total} agents`));

  await page.click('.roster-card[data-agent-id="webclaw"]');
  assert.equal(await page.textContent('#roster-selector-selected'), '1 / 10 selected');
  assert.equal(await page.textContent('#roster-selector-available'), `${total} available`);
});

test('every card draws the character the room draws', async t => {
  if (skipReason) return t.skip(skipReason);

  const { page } = await openOffice(t);
  await openPanel(page);

  // A card whose canvas is blank is a card that has not drawn anything, which
  // is how a roster ends up as a wall of empty slabs on a slow load.
  const painted = await page.$$eval('.roster-card-pixel', canvases => canvases.map(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < data.length; index += 4) if (data[index] > 12) return true;
    return false;
  }));
  assert.equal(painted.length, liveAgents().length);
  assert.deepEqual(painted.filter(Boolean).length, painted.length, 'a roster card drew nothing');
});

test('with no selection made the whole roster is in the office', async t => {
  if (skipReason) return t.skip(skipReason);

  const { page } = await openOffice(t);
  assert.deepEqual(await roomIds(page), liveAgents().map(agent => agent.id));
});

test('an unselected agent leaves the office and comes back with their character intact', async t => {
  if (skipReason) return t.skip(skipReason);

  const { page } = await openOffice(t);
  await openPanel(page);

  await page.click('.roster-card[data-agent-id="oss"]');
  await page.click('.roster-card[data-agent-id="nutrimind"]');
  assert.deepEqual(await roomIds(page), ['oss', 'nutrimind']);

  // Out of the room, still on the roster: the data behind an agent who is not
  // standing in the office has to survive, or taking someone out would delete
  // them.
  assert.equal(await page.evaluate(() => agentState.length), liveAgents().length);
  assert.equal(await page.evaluate(() => agentState.some(agent => agent.id === 'routercoder')), true);

  await page.click('.roster-card[data-agent-id="oss"]');
  assert.deepEqual(await roomIds(page), ['nutrimind']);

  await page.click('.roster-selector-everyone');
  assert.deepEqual(await roomIds(page), liveAgents().map(agent => agent.id));
});

test('a saved character look survives being taken out of the office and put back', async t => {
  if (skipReason) return t.skip(skipReason);

  // The look the in-office character editor writes. Leaving an agent out of the
  // room must not be a way to lose it.
  const saved = {
    face: 'stoic', skin: '#573222', hair: 'spiked', hairColor: '#d6ab5e',
    outfit: 'director', outfitColor: '#be185d', accessory: 'chain',
  };
  const context = await newOfficeContext(t, {
    seedStorage: look => localStorage.setItem('agent-office-avatar-looks-v1', JSON.stringify({ pc: look })),
    seedValue: saved,
  });
  const { page } = await openOffice(t, { reuse: context });
  assert.deepEqual(await page.evaluate(() => agentState.find(a => a.id === 'pc').lookState.avatar), saved);

  await openPanel(page);
  await page.click('.roster-card[data-agent-id="webclaw"]');
  assert.equal((await roomIds(page)).includes('pc'), false);
  await page.click('.roster-card[data-agent-id="pc"]');
  assert.deepEqual(await roomIds(page), ['webclaw', 'pc']);
  assert.deepEqual(await page.evaluate(() => agentState.find(a => a.id === 'pc').lookState.avatar), saved);
});

test('the office holds ten, and the eleventh has to wait for a free desk', async t => {
  if (skipReason) return t.skip(skipReason);

  const { page } = await openOffice(t);
  await openPanel(page);

  const ids = liveAgents().map(agent => agent.id);
  assert.ok(ids.length > 10, 'this test only means something with more agents than desks');

  for (const id of ids.slice(0, 10)) await page.click(`.roster-card[data-agent-id="${id}"]`);
  assert.equal(await page.textContent('#roster-selector-selected'), '10 / 10 selected');
  assert.equal(await page.locator('.roster-card.locked').count(), ids.length - 10);

  const eleventh = ids[10];
  const locked = page.locator(`.roster-card[data-agent-id="${eleventh}"]`);
  assert.equal(await locked.getAttribute('aria-disabled'), 'true', 'a full office does not say so to a screen reader');
  // aria-disabled stops assistive tech and Playwright's own actionability
  // check, but not a mouse. Forcing the click is how the guard behind it gets
  // tested rather than assumed.
  await locked.click({ force: true });
  assert.equal(await page.textContent('#roster-selector-selected'), '10 / 10 selected');
  assert.equal((await roomIds(page)).includes(eleventh), false, 'the cap let an eleventh agent into the room');
  assert.match(await page.textContent('#roster-selector-status'), /Take someone out/);

  // Free a desk and the eleventh fits.
  await page.click(`.roster-card[data-agent-id="${ids[0]}"]`);
  await page.click(`.roster-card[data-agent-id="${eleventh}"]`);
  assert.deepEqual(await roomIds(page), ids.slice(1, 10).concat(eleventh));
});

test('an empty office is a choice the panel can express', async t => {
  if (skipReason) return t.skip(skipReason);

  const { page } = await openOffice(t);
  await openPanel(page);

  await page.click('.roster-selector-empty');
  assert.deepEqual(await roomIds(page), []);
  assert.equal(await page.textContent('#roster-selector-selected'), '0 / 10 selected');
  assert.match(await page.textContent('#roster-selector-status'), /office is empty/i);
});

test('the choice survives a reload, and stays in this browser', async t => {
  if (skipReason) return t.skip(skipReason);

  const first = await openOffice(t);
  await openPanel(first.page);
  await first.page.click('.roster-card[data-agent-id="pc"]');
  await first.page.click('.roster-card[data-agent-id="routercoder"]');
  assert.deepEqual(await roomIds(first.page), ['pc', 'routercoder']);
  await first.page.close();

  const again = await openOffice(t, { reuse: first.context });
  assert.deepEqual(await roomIds(again.page), ['pc', 'routercoder']);
  await openPanel(again.page);
  assert.equal(await again.page.textContent('#roster-selector-selected'), '2 / 10 selected');
  assert.deepEqual(again.problems, []);

  // A different browser has made no choice of its own and sees the whole cast.
  const fresh = await openOffice(t);
  assert.deepEqual(await roomIds(fresh.page), liveAgents().map(agent => agent.id));
});

test('a saved roster naming an agent the office no longer has is dropped', async t => {
  if (skipReason) return t.skip(skipReason);

  // A roster saved before an agent was retired, plus a name that was never
  // real. Neither may put a character in the room.
  const context = await newOfficeContext(t, {
    seedStorage: selected => localStorage.setItem('agent-office-room-roster-v1', JSON.stringify({ selected })),
    seedValue: ['webclaw', 'security', 'RankForge'],
  });

  const page = await context.newPage();
  await page.goto(`${server.origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.agent-char', { state: 'attached' });
  assert.deepEqual(await roomIds(page), ['webclaw']);
});

test('the selector owns no roster of its own', () => {
  // The failure this guards against is the screenshot's: a second cast, written
  // down here, going stale the moment AGENTS changes. The panel may hold the
  // desk count and nothing else.
  assert.match(selector, /agentState\.map|agentState\.find|agentState\.length/);
  assert.doesNotMatch(selector, /const\s+\w*ROSTER\w*\s*=\s*\[/i, 'the selector has grown a roster literal');
  assert.doesNotMatch(selector, /\bid:\s*'[a-z0-9]+'/, 'the selector names agents instead of reading them');
  // The totals in the header come from the roster's own length.
  assert.match(selector, /\$\{agentState\.length\} available/);
  assert.match(selector, /\$\{selectedCount\(\)\} \/ \$\{MAX_IN_ROOM\} selected/);
});

test('leaving the room does not touch an agent, only where they are drawn', () => {
  // renderAgents() is the only thing that filters. agentState, the ops summary
  // and the saved looks all still cover the whole roster.
  assert.match(shared, /function roomAgents\(\)/);
  assert.match(shared, /roomAgents\(\)\.forEach\(agent => \{/);
  assert.doesNotMatch(selector, /agentState\s*=[^=]/, 'the selector rewrites the roster instead of filtering the room');
  assert.doesNotMatch(selector, /\.splice\(|delete agentState/);
});

test('the studio and the office call every agent the same thing', () => {
  // agent-avatars.js keeps a name and role per agent because the studio page
  // cannot read AGENTS. That copy drifted once — StudioClaw for Studio
  // Director, News Reporter for ShareBot67 — and this is what catches it.
  const block = avatars.slice(avatars.indexOf('const ROSTER = ['), avatars.indexOf('\n  ];'));
  const studio = [...block.matchAll(/id: '([^']+)', name: '([^']+)', shortRole: '[^']*', role: '([^']+)'/g)]
    .map(([, id, name, role]) => ({ id, name, role }));
  assert.deepEqual(studio, liveAgents());
});
