#!/usr/bin/env node
'use strict';

// Writes the shared app shell — the stylesheet link and pre-paint boot script
// in <head>, and the topbar plus sidebar in <body> — into every deployed page.
//
// The shell used to be copy-pasted into each page and maintained by hand. It
// drifted: index.html called the first nav row "Agents Office" and listed Org
// Chart above Memory, memory.html called it "Office" and listed Memory first,
// and the two loaded different cache-busted copies of shared.css. The templates
// in scripts/shell are the single source now, and
// tests/shell-consistency.test.js fails when a page falls out of step with
// them. This script is the fix.
//
// Usage: node scripts/sync-shell.js [--check]

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'agent-office-deploy', 'dist');
const TEMPLATES = path.join(__dirname, 'shell');

// Every page that wears the shell. A page not listed here keeps its own chrome.
const PAGES = [
  'index.html',
  'org-chart.html',
  'memory.html',
  'traderclaw-journal.html',
  'agent-registry.html',
  'project-rooms.html',
  'mission-board.html',
  'streaks.html',
  'visitors.html',
  'ai-landscape.html',
  'settings.html',
  'resets.html',
  'dev.html',
  'calendar-v3.html',
  'countdowns.html',
];

// The two regions a page hands over. Both are delimited by markup the pages
// already had, so no page needed new marker comments to opt in.
const REGIONS = [
  {
    name: 'stylesheet',
    template: 'stylesheet.html',
    // Just the link. Pages that add their own stylesheet after it (streaks,
    // visitors, ai-landscape) keep it where they put it.
    pattern: /<link rel="stylesheet" href="shared\.css[^"]*"\/>/,
  },
  {
    name: 'boot',
    template: 'boot.html',
    // The pre-paint boot script, with the comment above it when there is one.
    // Matched on the ACCENTS map rather than the comment's wording, which has
    // changed and would otherwise pin the pattern to one revision of it.
    pattern: /(?:<!--[\s\S]*?-->\s*)?<script>\s*\(function\(\)\{[\s\S]*?ACCENTS[\s\S]*?<\/script>/,
  },
  {
    name: 'shell',
    template: 'shell.html',
    // The mobile overlay through the close of the sidebar.
    pattern: /<!-- Mobile nav overlay -->[\s\S]*?<\/nav>/,
  },
];

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES, name), 'utf8').trimEnd();
}

// Returns the page's content with every region replaced, or throws when a
// region cannot be located — a silent no-op there would ship a stale shell.
function applyShell(page, source) {
  return REGIONS.reduce((html, region) => {
    if (!region.pattern.test(html)) {
      throw new Error(`${page}: could not find the ${region.name} region. Has the page's markup changed?`);
    }
    return html.replace(region.pattern, () => readTemplate(region.template));
  }, source);
}

function run({ check }) {
  const stale = [];
  PAGES.forEach(page => {
    const file = path.join(DIST, page);
    const source = fs.readFileSync(file, 'utf8');
    const updated = applyShell(page, source);
    if (updated === source) return;
    stale.push(page);
    if (!check) fs.writeFileSync(file, updated);
  });

  if (check) {
    if (stale.length) {
      console.error('These pages are out of step with scripts/shell:\n  ' + stale.join('\n  '));
      console.error('Run `npm run sync:shell`.');
      process.exit(1);
    }
    console.log('Shell is in sync across ' + PAGES.length + ' pages.');
    return;
  }

  stale.forEach(page => console.log('synced ' + page));
  console.log(stale.length ? stale.length + ' page(s) synced.' : 'Already in sync.');
}

module.exports = { PAGES, REGIONS, DIST, applyShell, readTemplate };

if (require.main === module) run({ check: process.argv.includes('--check') });
