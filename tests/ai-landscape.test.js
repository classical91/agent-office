'use strict';

// The AI Models page (ai-landscape.html) renders its whole catalog from the
// data in ai-landscape.js. These tests render it with a stub DOM and check the
// things a data edit can quietly break.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DIST = path.join(__dirname, '..', 'agent-office-deploy', 'dist');
const SOURCE = fs.readFileSync(path.join(DIST, 'ai-landscape.js'), 'utf8');

function renderPage() {
  const root = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const document = {
    readyState: 'complete',
    getElementById: id => (id === 'ai-landscape-root' ? root : null),
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const context = { window: {}, document, console };
  vm.runInNewContext(SOURCE, context, { timeout: 2000 });
  context.window.AILandscape.render();
  return root.innerHTML;
}

test('every catalog entry is rendered, so none sits in a group the page does not list', () => {
  const html = renderPage();
  const entries = (SOURCE.match(/^\s+group: "/gm) || []).length;
  const cards = (html.match(/<article class="ai-card/g) || []).length;
  assert.ok(entries > 0);
  assert.equal(cards, entries);
});

test('the Skills & Plugins group lists the skill and plugin catalogs', () => {
  const html = renderPage();
  assert.match(html, /<h2 class="ai-cat-title">Skills &amp; Plugins<\/h2>/);
  for (const name of ['Claude Code Skills', 'Claude Code Plugins', 'Codex skills', 'Gemini CLI extensions', 'ClawHub']) {
    assert.ok(html.includes(`data-ai-card="${name}"`), `no card for ${name}`);
  }
  assert.ok(html.includes('data-category="Skills &amp; Plugins"'), 'no filter pill for Skills & Plugins');
});

test('the header says when the catalog was last updated', () => {
  const html = renderPage();
  const match = html.match(/<p class="ai-updated">Last updated <time datetime="(\d{4}-\d{2}-\d{2})">([^<]+)<\/time><\/p>/);
  assert.ok(match, 'no last-updated line');
  const [, iso, shown] = match;
  assert.ok(!Number.isNaN(Date.parse(iso)), `not a date: ${iso}`);
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  assert.equal(shown, `${d} ${months[m - 1]} ${y}`);
});

test('an open card shows its update links once, not twice', () => {
  // Cards render closed; the always-visible links row is the only copy.
  const html = renderPage();
  const cards = (html.match(/<article class="ai-card/g) || []).length;
  const cardsWithLinks = (SOURCE.match(/^\s+updateLinks: \[/gm) || []).length;
  const rows = (html.match(/<div class="ai-update-links"/g) || []).length;
  assert.ok(cardsWithLinks <= cards);
  assert.equal(rows, cardsWithLinks);
});

test('the recommendation matrix does not recommend a retired product', () => {
  const html = renderPage();
  const matrix = html.slice(html.indexOf('<table class="ai-matrix">'), html.indexOf('</table>'));
  assert.ok(matrix.length > 0);
  assert.doesNotMatch(matrix, /Sora/);
});

test('chart dots that share a cost and burn tier are spread apart', () => {
  const html = renderPage();
  const positions = [...html.matchAll(/class="ai-dot[^"]*"[^>]*style="left:([\d.-]+)%; bottom:([\d.-]+)%;"/g)].map(m => `${m[1]}|${m[2]}`);
  assert.ok(positions.length > 10);
  assert.equal(new Set(positions).size, positions.length);
});
