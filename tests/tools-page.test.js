'use strict';

// Tools & Commands: one sidebar page that gathers the OpenClaw CLI docs, the
// prompt builder and the Market Dashboard bot command sheet.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PAGES, DIST, readTemplate } = require('../scripts/sync-shell.js');

test('Tools & Commands wears the shell and is linked from the sidebar', () => {
  assert.ok(PAGES.includes('tools.html'));
  const sidebar = readTemplate('shell.html').match(/<nav class="nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.match(sidebar, /class="nav-item" href="\/tools\.html"[^>]*>.*Tools &amp; Commands/);
});

test('Tools & Commands links the three tools in a new tab', () => {
  const page = fs.readFileSync(path.join(DIST, 'tools.html'), 'utf8');
  assert.match(page, /id="view-tools"/);
  for (const href of [
    'https://docs.openclaw.ai/cli',
    'https://main-page-production-9927.up.railway.app/prompt-builder.html',
    'https://market-dashboard-production-b2f4.up.railway.app/bot-commands.html',
  ]) {
    const escaped = href.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    assert.match(page, new RegExp(`href="${escaped}" target="_blank" rel="noopener noreferrer"`));
  }
});
