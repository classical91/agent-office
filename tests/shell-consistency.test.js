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

test('every sidebar row can be told apart in the compact rail', () => {
  // The rail hides labels, so a row with no data-icon collapses to an empty
  // strip. The template is the only place this can be got wrong.
  const iconless = sidebarRows().filter(row => !row.includes('data-icon='));
  assert.deepStrictEqual(iconless, [], 'these sidebar rows have no data-icon');
});

test('the rail monograms are short letter tags, not emoji', () => {
  // data-icon used to hold an emoji per row. The sidebar reads by label now
  // and the tag is only drawn in the collapsed rail, so anything but a couple
  // of letters is either an emoji creeping back in or too wide for a 56px rail.
  const bad = sidebarRows()
    .map(row => row.match(/data-icon="([^"]*)"/)[1])
    .filter(icon => !/^[A-Z]{1,3}$/.test(icon));
  assert.deepStrictEqual(bad, [], 'these rail monograms are not plain letter tags');
});

test('the rail monograms are unique', () => {
  // Two rows sharing a tag are indistinguishable once the rail hides labels.
  const icons = sidebarRows().map(row => row.match(/data-icon="([^"]*)"/)[1]);
  assert.strictEqual(new Set(icons).size, icons.length, 'two sidebar rows share a monogram');
});

test('the shell templates cover every region the sync script replaces', () => {
  REGIONS.forEach(region => {
    assert.ok(
      fs.existsSync(path.join(__dirname, '..', 'scripts', 'shell', region.template)),
      `missing template for the ${region.name} region`
    );
  });
});
