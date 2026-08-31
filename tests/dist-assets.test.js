'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// The deployed copies under agent-office-deploy/dist are byte-for-byte copies of
// the files at the repo root, kept in step by hand. Editing one and forgetting
// the other ships a half-updated calendar, so the pairing is checked here.
// `npm run sync:dist` copies the root files over the deployed ones.
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'agent-office-deploy', 'dist');

const PAIRED_FILES = [
  'calendar-agent-assistant.js',
  'calendar-mobile-day-popup.js',
  'calendar-mobile-event-add.js',
  'calendar-mobile-fit.js',
  'calendar-view-base.js',
  'calendar-view.css',
  'calendar-view.js'
];

test('deployed assets match the files at the repo root', () => {
  const stale = PAIRED_FILES.filter(name => {
    const source = fs.readFileSync(path.join(ROOT, name));
    const deployed = fs.readFileSync(path.join(DIST, name));
    return !source.equals(deployed);
  });
  assert.deepStrictEqual(
    stale,
    [],
    'These files differ from their agent-office-deploy/dist copies. Run `npm run sync:dist`.'
  );
});
