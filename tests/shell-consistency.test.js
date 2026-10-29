'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { PAGES, REGIONS, DIST, applyShell, readTemplate } = require('../scripts/sync-shell.js');

// The topbar and sidebar are copied into every page. Kept by hand, the copies
// drifted: index.html labelled the first nav row "Agents Office" and put Org
// Chart above Memory, memory.html labelled it "Office" and put Memory first,
// and the two pulled different cache-busted builds of shared.css. The
// templates under scripts/shell are the source now, and this is what stops the
// copies wandering off again. `npm run sync:shell` is the fix when it fails.
function readPage(name) {
  return fs.readFileSync(path.join(DIST, name), 'utf8');
}

test('every page carries the shell exactly as scripts/shell defines it', () => {
  const stale = PAGES.filter(page => applyShell(page, readPage(page)) !== readPage(page));
  assert.deepStrictEqual(
    stale,
    [],
    'These pages have drifted from scripts/shell. Run `npm run sync:shell`.'
  );
});

test('every page loads the same build of shared.css', () => {
  const expected = readTemplate('stylesheet.html');
  PAGES.forEach(page => {
    const link = readPage(page).match(/<link rel="stylesheet" href="shared\.css[^"]*"\/>/);
    assert.ok(link, `${page} does not load shared.css`);
    assert.strictEqual(link[0], expected, `${page} loads a different build of shared.css`);
  });
});

test('no page hand-marks its own active nav row', () => {
  // markActiveNav() works the highlight out from the URL. A hardcoded `active`
  // in the markup is how the copies came to disagree about which page they
  // were, and it would now fight the class the code sets.
  PAGES.forEach(page => {
    const nav = readPage(page).match(/<nav class="nav[\s\S]*?<\/nav>/);
    assert.ok(nav, `${page} has no sidebar`);
    assert.doesNotMatch(nav[0], /class="[^"]*nav-item[^"]*\bactive\b/, `${page} hardcodes an active nav row`);
  });
});

// `nav-item`, not `nav-items-wrap`: the lookahead keeps the wrapper out.
function sidebarRows() {
  const shell = readTemplate('shell.html');
  const rows = [...shell.matchAll(/<(?:a|div) class="nav-item(?=[ "])[^"]*"[^>]*>/g)].map(match => match[0]);
  assert.ok(rows.length >= 15, 'expected the full sidebar in the template');
  return rows;
}

test('every sidebar row has a scannable detail-panel badge', () => {
  // The pale detail panel uses short badges to keep a long navigation tree
  // scannable beside the permanent icon rail.
  const iconless = sidebarRows().filter(row => !row.includes('data-icon='));
  assert.deepStrictEqual(iconless, [], 'these sidebar rows have no data-icon');
});

test('the detail-panel badges are short letter tags, not emoji', () => {
  const bad = sidebarRows()
    .map(row => row.match(/data-icon="([^"]*)"/)[1])
    .filter(icon => !/^[A-Z]{1,3}$/.test(icon));
  assert.deepStrictEqual(bad, [], 'these detail-panel badges are not plain letter tags');
});

test('the detail-panel badges are unique', () => {
  const icons = sidebarRows().map(row => row.match(/data-icon="([^"]*)"/)[1]);
  assert.strictEqual(new Set(icons).size, icons.length, 'two sidebar rows share a badge');
});

test('the sidebar has a permanent icon rail and a full navigation panel', () => {
  const shell = readTemplate('shell.html');
  const rail = shell.match(/<div class="nav-rail"[\s\S]*?<div class="nav-panel/);
  assert.ok(rail, 'the shared shell does not contain both sidebar layers');

  const shortcuts = [...rail[0].matchAll(/class="nav-rail-item"[^>]*data-nav-area="([^"]+)"[^>]*>[\s\S]*?<svg/g)];
  assert.ok(shortcuts.length >= 7, 'the shortcut rail is missing workspace destinations');
  assert.strictEqual(
    new Set(shortcuts.map(match => match[1])).size,
    shortcuts.length,
    'two shortcut-rail destinations target the same workspace area'
  );
});

test('the shell templates cover every region the sync script replaces', () => {
  REGIONS.forEach(region => {
    assert.ok(
      fs.existsSync(path.join(__dirname, '..', 'scripts', 'shell', region.template)),
      `missing template for the ${region.name} region`
    );
  });
});
