'use strict';

// The AI Portal, Apps & Sites and the Audit Log used to live on Main Hub, and
// the sidebar sent you off-site to reach two of them. They are Agent Office
// pages now, in the shared shell, and the sidebar links them like any other.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { PAGES, DIST, readTemplate } = require('../scripts/sync-shell.js');

function readPage(name) {
  return fs.readFileSync(path.join(DIST, name), 'utf8');
}

function loadAuditRecords() {
  const source = fs.readFileSync(path.join(DIST, 'audits-data.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context, { timeout: 1000 });
  return context.window.AUDITS;
}

test('the three pages wear the shared shell', () => {
  for (const page of ['ai.html', 'apps.html', 'audits.html']) {
    assert.ok(PAGES.includes(page), `${page} is not in the shell sync list`);
    assert.ok(readPage(page).includes('hub-pages.css'), `${page} does not load its stylesheet`);
  }
});

test('the sidebar links all three in-app, not off to Main Hub', () => {
  const shell = readTemplate('shell.html');
  // Workspace-area metadata may sit between the route and its badge; the
  // invariant is that the detail panel keeps each destination in-app.
  assert.match(shell, /<a class="nav-item" href="\/ai\.html"[^>]*data-icon="AP">/);
  assert.match(shell, /<a class="nav-item" href="\/apps\.html"[^>]*data-icon="WP">/);
  assert.match(shell, /<a class="nav-item" href="\/audits\.html"[^>]*data-icon="AU"><span class="nav-item-label">Audit Log<\/span><\/a>/);
  assert.doesNotMatch(shell, /main-page-production-9927\.up\.railway\.app\/(ai|apps)\.html/);
});

test('the AI Portal points at the in-app pages and keeps the Main Hub tools external', () => {
  const page = readPage('ai.html');
  for (const href of ['/apps.html', '/audits.html', '/ai-landscape.html', '/dev.html']) {
    assert.ok(page.includes(`class="portal-card" style="--i:`) && page.includes(`href="${href}"`), `no card for ${href}`);
  }
  assert.match(page, /href="https:\/\/main-page-production-9927\.up\.railway\.app\/ai-shortcuts\.html" target="_blank"/);
  assert.match(page, /href="https:\/\/main-page-production-9927\.up\.railway\.app\/prompt-builder\.html" target="_blank"/);
  assert.match(page, /id="promptInstructionsModal"/);
});

test('Apps & Sites has a prominent Audit Log link outside the project list', () => {
  const page = readPage('apps.html');
  assert.match(page, /class="ao-btn ao-btn--primary audit-link" href="\/audits\.html"/);
  assert.match(page, /> Open Audit Log /);
  assert.doesNotMatch(page, /title: "Audit Log"/);
  assert.match(page, /const SECTIONS = \[/);
  assert.match(page, /data-filter="live"/);
  assert.match(page, /data-filter="github"/);
});

test('Audit Log loads its data file and preserves all five legacy records', () => {
  const page = readPage('audits.html');
  assert.ok(page.includes('<script src="audits-data.js"></script>'));
  assert.ok(page.includes('const AUDITS = window.AUDITS || [];'));
  const audits = loadAuditRecords();
  for (const date of ['2026-10-25T03:54:16Z', '2026-09-16', '2026-08-30T02:02:39.735Z',
    '2026-08-21T04:42:28Z', '2026-07-29T23:09:47Z']) {
    assert.ok(audits.some(a => a.auditedAt === date), 'Missing legacy record ' + date);
  }
  assert.ok(audits.some(a => a.project === 'Agent Office' && a.type === 'Security audit'));
  assert.ok(audits.some(a => a.type === 'Strategy parity audit'));
  assert.ok(audits.some(a => a.type === 'Unpublished work audit'));
});

test('the weekly report keeps ranking, severity, previous status and ordered fixes', () => {
  const audits = loadAuditRecords();
  const weekly = audits.find(a => a.id === 'weekly-2026-10-25-farm-bot');
  assert.ok(weekly);
  assert.equal(weekly.repository, 'classical91/farm-bot');
  assert.equal(weekly.findings.critical.length, 0);
  assert.ok(weekly.findings.high.length >= 2);
  assert.ok(weekly.previousFindings.some(f => f.status === 'Still open'));
  assert.ok(weekly.recommendedFixes.length >= 3);
  assert.ok(audits.some(a => a.id === 'weekly-2026-10-18-farm-bot'));
  const page = readPage('audits.html');
  assert.ok(page.includes('renderAuditDetails(audit)'));
  assert.ok(page.includes('escapeHtml(item.summary'));
});

test('Audit Log includes search, project, and year filters', () => {
  const page = readPage('audits.html');
  assert.match(page, /id="search"/);
  assert.match(page, /id="projectFilter"/);
  assert.match(page, /id="yearFilter"/);
  assert.match(page, /function render\(\)/);
});

