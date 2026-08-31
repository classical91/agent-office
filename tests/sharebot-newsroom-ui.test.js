'use strict';

// The ShareBot67 newsroom panel, in a browser.
//
// The panel exists because the office feed beside this agent reads like a
// status and is not one — "ShareBot67 smoke check passed" says the same thing
// on a morning the newsroom failed at 4am. So the two things worth checking
// here are that live state actually reaches the screen, and that a newsroom
// nobody can read says so plainly rather than showing a hopeful blank.
//
// The upstream is a fake Market Dashboard on localhost. Requires a Chromium,
// the same way tests/ui-smoke.test.js does: a checkout without one skips,
// unless CI=true, where a missing browser is a broken pipeline.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, before, after } = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

const PASSPHRASE = 'newsroom-ui-passphrase';
const DASHBOARD_KEY = 'market-dashboard-ui-key';
// Report text the panel must never show. Health does not carry it today, and
// the panel must not become the place where that changes.
const REPORT_TEXT = 'TOP 10 EMERGING CRYPTO TOKENS — the actual report body';

const BASE_CYCLE = {
  id: 'cyc_ui11', cycleKey: 'scheduled:2026-08-26T13:00:00.000Z', status: 'completed',
  scheduledAt: '2026-08-26T13:00:00.000Z', startedAt: '2026-08-26T13:00:01.000Z',
  completedAt: '2026-08-26T13:02:00.000Z',
  sectionsExpected: ['crypto', 'economics', 'markets'], generatedSectionCount: 3,
  deliverySucceeded: 6, deliveryFailed: 0,
};

const PAYLOADS = {
  healthy: {
    status: 'completed',
    reporter: { model: 'gpt-5.4-mini', configured: true },
    sections: ['crypto', 'economics', 'markets'],
    currentCycle: null,
    lastAttemptedCycle: BASE_CYCLE,
    lastSuccessfulCycle: BASE_CYCLE,
    nextExpectedRunAt: '2026-08-27T13:00:00.000Z',
    lastError: null,
    agentRoute: { status: 'pass', verified: true, detail: 'Agent route resolved.', code: null },
  },
  running: {
    status: 'running',
    reporter: { model: 'gpt-5.4-mini', configured: true },
    sections: ['crypto', 'economics', 'markets'],
    currentCycle: { ...BASE_CYCLE, id: 'cyc_ui22', status: 'generating', completedAt: null, generatedSectionCount: 1, deliverySucceeded: 0, deliveryFailed: 0 },
    lastAttemptedCycle: { ...BASE_CYCLE, id: 'cyc_ui22', status: 'generating', completedAt: null, generatedSectionCount: 1, deliverySucceeded: 0, deliveryFailed: 0 },
    lastSuccessfulCycle: BASE_CYCLE,
    nextExpectedRunAt: '2026-08-27T13:00:00.000Z',
    lastError: null,
    agentRoute: { status: 'pass', verified: true, detail: 'Agent route resolved.', code: null },
  },
  partial: {
    status: 'delivery_partial',
    reporter: { model: 'gpt-5.4-mini', configured: true },
    sections: ['crypto', 'economics', 'markets'],
    currentCycle: null,
    lastAttemptedCycle: { ...BASE_CYCLE, id: 'cyc_ui33', status: 'delivery_partial', generatedSectionCount: 2, deliverySucceeded: 4, deliveryFailed: 2 },
    lastSuccessfulCycle: BASE_CYCLE,
    nextExpectedRunAt: '2026-08-27T13:00:00.000Z',
    lastError: {
      at: '2026-08-27T13:02:00.000Z', phase: 'delivery', class: 'retryable', retryable: true,
      code: 'server_error', message: 'Telegram rejected Stock',
      reason: 'The destination returned a server error.',
    },
    agentRoute: { status: 'warn', verified: false, detail: 'The agent route is not verified.', code: null },
  },
  failed: {
    status: 'generation_failed',
    reporter: { model: 'gpt-5.4-mini', configured: true },
    sections: ['crypto', 'economics', 'markets'],
    currentCycle: null,
    lastAttemptedCycle: { ...BASE_CYCLE, id: 'cyc_ui44', status: 'generation_failed', generatedSectionCount: 0, deliverySucceeded: 0, deliveryFailed: 0 },
    lastSuccessfulCycle: BASE_CYCLE,
    nextExpectedRunAt: '2026-08-27T13:00:00.000Z',
    lastError: {
      at: '2026-08-27T13:00:20.000Z', phase: 'generation', class: 'non_retryable', retryable: false,
      code: 'provider_user_not_found', message: 'HTTP 401: User not found',
      reason: 'The agent/model route is not recognized.',
    },
    agentRoute: { status: 'fail', verified: false, detail: 'The agent route was rejected.', code: 'provider_user_not_found' },
  },
};

let chromium = null;
try {
  ({ chromium } = require('playwright-core'));
} catch { /* reported as a skip below, where a test can carry the message */ }

let upstream = null;
let server = null;
let browser = null;
let scratch = null;
let skipReason = null;
let mode = 'healthy';

function startUpstream() {
  const service = http.createServer((req, res) => {
    if (mode === 'down') {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'upstream is restarting' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    // The report text rides along on the upstream response so the assertion
    // that it never reaches the screen is testing something real.
    res.end(JSON.stringify({ ...PAYLOADS[mode], reportText: REPORT_TEXT, adminKey: DASHBOARD_KEY }));
  });
  return new Promise(resolve => service.listen(0, '127.0.0.1', () => resolve(service)));
}

function startServer(upstreamOrigin) {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-newsroom-ui-'));
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
      MARKET_DASHBOARD_URL: upstreamOrigin,
      MARKET_DASHBOARD_ADMIN_API_KEY: DASHBOARD_KEY,
      MARKET_DASHBOARD_TIMEOUT_MS: '1500',
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
  if (skipReason && process.env.CI) throw new Error(`newsroom panel tests cannot run in CI: ${skipReason}`);
  if (skipReason) return;
  upstream = await startUpstream();
  server = await startServer(`http://127.0.0.1:${upstream.address().port}`);
});

after(async () => {
  await browser?.close();
  server?.child.kill();
  upstream?.close();
  if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
});

/**
 * The office, unlocked, with the ShareBot67 panel open.
 *
 * Everything off-origin is blocked: shared.css opens with a font-CDN import,
 * and this suite is about the app, not about whether that CDN is up.
 */
async function openNewsroomPanel(t, { viewport = { width: 1280, height: 900 } } = {}) {
  const context = await browser.newContext({ viewport });
  t.after(() => context.close());
  await context.route('**/*', route => (
    new URL(route.request().url()).origin === server.origin ? route.continue() : route.abort()
  ));
  const session = await context.request.post(`${server.origin}/api/session`, { data: { passphrase: PASSPHRASE } });
  assert.equal(session.status(), 200, 'the newsroom panel tests could not open a session');

  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', error => problems.push(`uncaught ${error.message}`));

  await page.goto(`${server.origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await openAgent(page, 'newsreporter');
  await page.waitForSelector('#newsroom-panel .newsroom-rows');
  return { page, problems };
}

/**
 * Click an agent in the room.
 *
 * `dispatchEvent` rather than a real mouse click: the characters are animated
 * inside one SVG, and their own drop shadows sit over them often enough that a
 * positional click is flaky. The event still bubbles to the office stage,
 * which is where the panel's listener lives.
 */
async function openAgent(page, id) {
  const character = `.agent-char[data-agent-id="${id}"]`;
  await page.waitForSelector(character, { state: 'attached' });
  await page.locator(character).first().dispatchEvent('click');
  await page.waitForSelector('#control-center:not([hidden]) .control-agent-hero');
}

const rows = page => page.$$eval('.newsroom-row', nodes => nodes.map(node => ({
  label: node.querySelector('span').textContent.trim(),
  value: node.querySelector('strong').textContent.trim(),
})));

const rowValue = async (page, label) => (await rows(page)).find(row => row.label === label)?.value;

test('a healthy newsroom renders its real state', async t => {
  if (skipReason) return t.skip(skipReason);
  mode = 'healthy';

  const { page, problems } = await openNewsroomPanel(t);

  assert.equal(await rowValue(page, 'Health'), 'Healthy');
  assert.equal(await rowValue(page, 'Agent route'), 'Verified');
  assert.equal(await rowValue(page, 'Generation'), '3 / 3 sections');
  assert.equal(await rowValue(page, 'Delivery'), '6 successful · 0 failed');
  assert.match(await rowValue(page, 'Last attempt'), /completed/);
  assert.notEqual(await rowValue(page, 'Last successful cycle'), 'None recorded');
  assert.notEqual(await rowValue(page, 'Next expected cycle'), 'No schedule reported');
  assert.equal(await page.$('.newsroom-error'), null, 'no error block when there is no error');
  assert.deepEqual(problems, []);
});

test('a cycle in flight renders as running', async t => {
  if (skipReason) return t.skip(skipReason);
  mode = 'running';

  const { page, problems } = await openNewsroomPanel(t);
  assert.equal(await rowValue(page, 'Health'), 'Running');
  assert.equal(await rowValue(page, 'Generation'), '1 / 3 sections');
  assert.deepEqual(problems, []);
});

test('a partial delivery renders as degraded, with the error and the route warning', async t => {
  if (skipReason) return t.skip(skipReason);
  mode = 'partial';

  const { page, problems } = await openNewsroomPanel(t);

  assert.equal(await rowValue(page, 'Health'), 'Degraded');
  assert.equal(await rowValue(page, 'Agent route'), 'Warning');
  assert.equal(await rowValue(page, 'Delivery'), '4 successful · 2 failed');
  const error = await page.textContent('.newsroom-error');
  assert.match(error, /Telegram rejected Stock/);
  assert.match(error, /delivery/);
  assert.deepEqual(problems, []);
});

test('a failed cycle renders as failed and shows why', async t => {
  if (skipReason) return t.skip(skipReason);
  mode = 'failed';

  const { page, problems } = await openNewsroomPanel(t);

  assert.equal(await rowValue(page, 'Health'), 'Failed');
  assert.equal(await rowValue(page, 'Agent route'), 'Failed');
  assert.equal(await rowValue(page, 'Generation'), '0 / 3 sections');
  const error = await page.textContent('.newsroom-error');
  assert.match(error, /User not found/);
  assert.match(error, /not retryable/);
  assert.deepEqual(problems, []);
});

test('an unreadable newsroom says so, and does not look healthy', async t => {
  if (skipReason) return t.skip(skipReason);
  mode = 'down';

  const { page, problems } = await openNewsroomPanel(t);

  assert.equal(await rowValue(page, 'Health'), 'Unavailable');
  const message = await page.textContent('.control-unavailable');
  assert.match(message, /unavailable/i);
  assert.match(message, /not evidence that the newsroom is healthy/i);
  // No hopeful blanks: an unreadable newsroom must not show a last success.
  assert.equal(await page.$('.newsroom-rows .newsroom-row:nth-child(2)'), null);
  assert.deepEqual(problems, []);
});

test('the panel shows no report content and no credential', async t => {
  if (skipReason) return t.skip(skipReason);
  mode = 'healthy';

  const { page } = await openNewsroomPanel(t);
  const html = await page.innerHTML('#newsroom-panel');

  assert.equal(html.includes(REPORT_TEXT), false, 'report text must never reach the panel');
  assert.equal(html.includes('EMERGING CRYPTO'), false);
  assert.equal(html.includes(DASHBOARD_KEY), false, 'the dashboard key must never reach the browser');
  assert.equal(html.includes(PASSPHRASE), false);
});

// The panel reports on another service. A button here that could make that
// service generate or publish something is the one thing it must not grow.
test('the panel is read-only', async t => {
  if (skipReason) return t.skip(skipReason);
  mode = 'partial';

  const { page } = await openNewsroomPanel(t);
  const buttons = await page.$$eval('#newsroom-panel button, #newsroom-panel a', nodes =>
    nodes.map(node => node.textContent.trim()));

  assert.deepEqual(buttons, ['Refresh'], 'the only control is a re-read');
  for (const forbidden of ['Run', 'Retry', 'Deliver', 'Send', 'Telegram', 'Generate', 'Publish']) {
    assert.equal(
      buttons.some(label => label.includes(forbidden)),
      false,
      `${forbidden} must not be offered from this panel`,
    );
  }
});

test('the panel is usable at phone width, with nothing scrolling sideways', async t => {
  if (skipReason) return t.skip(skipReason);
  mode = 'partial';

  const { page, problems } = await openNewsroomPanel(t, { viewport: { width: 375, height: 780 } });

  assert.equal(await rowValue(page, 'Health'), 'Degraded');
  const overflow = await page.evaluate(() => {
    const panel = document.querySelector('#newsroom-panel');
    return {
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      panelOverflow: panel.scrollWidth - panel.clientWidth,
      visible: panel.getBoundingClientRect().width > 200,
    };
  });
  assert.ok(overflow.pageOverflow <= 1, `the page scrolls sideways by ${overflow.pageOverflow}px`);
  assert.ok(overflow.panelOverflow <= 1, `the panel scrolls sideways by ${overflow.panelOverflow}px`);
  assert.equal(overflow.visible, true);
  assert.deepEqual(problems, []);
});

test('the rest of the office is unchanged: other agents and Mission Control still open', async t => {
  if (skipReason) return t.skip(skipReason);
  mode = 'healthy';

  const { page, problems } = await openNewsroomPanel(t);

  // Another specialist opens their own panel, with no newsroom section.
  await page.evaluate(() => window.AOControlCenter.close());
  await openAgent(page, 'webclaw');
  assert.equal(await page.textContent('#control-center-title'), 'WebClaw');
  assert.equal(await page.$('#newsroom-panel'), null, 'the newsroom panel belongs to ShareBot67 alone');

  // And Mission Control still opens over the top of it.
  await page.evaluate(() => window.AOControlCenter.openMissionControl());
  await page.waitForSelector('#mission-goal-form');
  assert.equal(await page.textContent('#control-center-title'), 'Mission Control');
  assert.equal(await page.$('#newsroom-panel'), null);

  assert.deepEqual(problems, []);
});
