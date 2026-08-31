#!/usr/bin/env node
'use strict';

// Copies the root calendar assets over their agent-office-deploy/dist copies.
// tests/dist-assets.test.js fails when the two drift, and this is the fix.

const fs = require('node:fs');
const path = require('node:path');

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

let copied = 0;
PAIRED_FILES.forEach(name => {
  const source = path.join(ROOT, name);
  const target = path.join(DIST, name);
  if (fs.readFileSync(source).equals(fs.readFileSync(target))) return;
  fs.copyFileSync(source, target);
  console.log('synced ' + name);
  copied += 1;
});

console.log(copied ? copied + ' file(s) synced.' : 'Already in sync.');
