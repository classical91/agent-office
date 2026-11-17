'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, before, after } = require('node:test');
const { startTestServer } = require('./helpers/test-server.js');

const DIST = path.resolve(__dirname, '../agent-office-deploy/dist');
let browser, server, scratch, skipReason;
before(async () => {
  try {
    browser = await require('playwright-core').chromium.launch({
      executablePath: process.env.SMOKE_CHROMIUM_PATH || undefined
    });
  } catch (error) {
    skipReason = error.message.split('\n')[0];
    if (process.env.CI) throw error;
    return;
  }
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'office-handoff-'));
  server = await startTestServer({
    serverPath: path.join(DIST, 'server.js'), cwd: DIST,
    buildEnv(port) {
      const env = { ...process.env, PORT: String(port), DROPS_PASSPHRASE: 'handoff-test' };
      for (const key of ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) delete env[key];
      for (const key of ['APP_SETTINGS', 'CALENDAR_EVENTS', 'AGENTS', 'MEMORIES', 'DROPS', 'PROJECTS', 'STREAKS', 'STREAK_DAYS', 'VISITS']) {
        env[`${key}_FILE`] = path.join(scratch, `${key}.json`);
      }
      return env;
    }
  });
});
after(async () => {
  await browser?.close();
  server?.child.kill();
  if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
});

const feed = {
  generatedAt: '2026-11-16T12:00:00Z',
  sources: [
    { name: 'OpenAI', homepage: 'https://openai.com/news/', status: 'ok', fetchedAt: '2026-11-16T12:00:00Z', items: [
      { title: 'Release <script>example</script>', url: 'https://openai.com/news/example', summary: 'Release detail', publishedAt: '2026-11-15T12:00:00Z' }
    ] },
    { name: 'Apple', homepage: 'https://www.apple.com/newsroom/', status: 'error', error: 'Source timed out', items: [] }
  ],
  unrelated: 'not part of the page snapshot'
};

async function openPage(t, route, { failWatch = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  t.after(() => context.close());
  await context.route('**/*', request => {
    const url = new URL(request.request().url());
    if (url.origin !== server.origin) return request.abort();
    if (url.pathname === '/api/watch') return request.fulfill({
      status: failWatch ? 503 : 200, contentType: 'application/json', body: JSON.stringify(feed)
    });
    return request.continue();
  });
  await context.request.post(`${server.origin}/api/session`, { data: { passphrase: 'handoff-test' } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('unrelated-office-note', 'private-storage-marker');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async text => { window.copiedPrompt = text; }
    } });
  });
  await page.goto(`${server.origin}${route}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.ai-handoff summary').click();
  t.after(() => assert.deepEqual(errors, []));
  return page;
}

async function readSnapshot(page) {
  const text = await page.locator('#ai-handoff-preview').inputValue();
  return JSON.parse(text.split('## Page snapshot (JSON)\n')[1]);
}

test('audit handoff exports filtered full records, custom request, clipboard and Markdown download on mobile', async t => {
  if (skipReason) return t.skip(skipReason);
  const page = await openPage(t, '/audits.html?token=url-marker#private-fragment');
  const all = await readSnapshot(page);
  assert.ok(all.audits.length > 1);
  const project = all.audits[0].project;
  await page.selectOption('#projectFilter', project);
  const snapshot = await readSnapshot(page);
  assert.deepEqual(snapshot.audits, all.audits.filter(audit => audit.project === project));
  assert.ok(snapshot.audits.some(audit => audit.findings));
  assert.equal(await page.locator('.audit-details[open]').count(), 0, 'collapsed findings are still exported');
  await page.fill('#ai-handoff-request', 'Fix the highest priority verified issue.');
  await page.locator('[data-handoff-copy]').click();
  const copied = await page.evaluate(() => window.copiedPrompt);
  assert.match(copied, /Fix the highest priority verified issue\./);
  assert.match(copied, /audits-data\.js/);
  assert.doesNotMatch(copied, /url-marker|private-fragment|private-storage-marker/);
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.locator('[data-handoff-download]').click()
  ]);
  assert.equal(download.suggestedFilename(), 'agent-office-audit-log-handoff.md');
  assert.match(fs.readFileSync(await download.path(), 'utf8'), /Fix the highest priority verified issue\./);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.selectOption('#projectFilter', 'all');
  await page.fill('#search', 'no-record-matches-this-query-987654');
  const empty = await readSnapshot(page);
  assert.equal(empty.matchingAudits, 0);
  assert.deepEqual(empty.audits, []);
});

test('blocked clipboard selects the prompt and offers a manual fallback', async t => {
  if (skipReason) return t.skip(skipReason);
  const page = await openPage(t, '/audits.html');
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; });
  await page.locator('[data-handoff-copy]').click();
  assert.match(await page.locator('.ai-handoff-status').textContent(), /copy it manually/);
  assert.equal(await page.locator('#ai-handoff-preview').evaluate(el => el.selectionEnd - el.selectionStart === el.value.length), true);
});

test('legacy radar URL exports the loaded feed, source errors, timestamps and current search routes', async t => {
  if (skipReason) return t.skip(skipReason);
  const page = await openPage(t, '/intel-radar.html');
  await page.waitForSelector('#watch-grid[aria-busy="false"]');
  assert.equal(new URL(page.url()).pathname, '/platform-watch.html');
  await page.fill('#intel-query', 'OpenClaw workflows');
  const snapshot = await readSnapshot(page);
  assert.equal(snapshot.watchlist.status, 'partial');
  assert.equal(snapshot.watchlist.generatedAt, feed.generatedAt);
  assert.equal(snapshot.watchlist.sources[0].items[0].url, feed.sources[0].items[0].url);
  assert.equal(snapshot.watchlist.sources[1].error, 'Source timed out');
  assert.equal(snapshot.query, 'OpenClaw workflows');
  assert.match(snapshot.searchRoutes[0].urls[0], /OpenClaw%20workflows/);
  assert.equal(snapshot.watchlist.unrelated, undefined);
  assert.equal(await page.locator('.ai-handoff script').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
});

test('watch failure and refresh export current state without stale feed data', async t => {
  if (skipReason) return t.skip(skipReason);
  const page = await openPage(t, '/platform-watch.html', { failWatch: true });
  await page.waitForSelector('#watch-grid[aria-busy="false"]');
  let snapshot = await readSnapshot(page);
  assert.equal(snapshot.watchlist.status, 'unavailable');
  assert.match(snapshot.watchlist.error, /503/);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/watch?*', async route => {
    await gate;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(feed) });
  });
  await page.locator('#refresh-watch-button').click();
  assert.equal((await readSnapshot(page)).watchlist.status, 'loading');
  release();
  await page.waitForSelector('#watch-grid[aria-busy="false"]');
  snapshot = await readSnapshot(page);
  assert.equal(snapshot.watchlist.status, 'partial');
  assert.equal(snapshot.watchlist.sources.length, 2);
});
