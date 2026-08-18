'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appShared = fs.readFileSync(
  path.join(__dirname, '..', 'agent-office-deploy', 'dist', 'app-shared.js'),
  'utf8'
);

test('org chart marks websites that require login with a lock', () => {
  assert.match(appShared, /website: 'Agents Office',[\s\S]*websiteLogin: true/);
  assert.match(appShared, /org-login-lock[\s\S]*&#128274;/);
  assert.match(appShared, /org-login-legend[\s\S]*Login required/);
});

test('org chart uses the current CoachClaw display name and app ownership', () => {
  assert.match(appShared, /id: 'nutrimind',[\s\S]*name: 'CoachClaw'/);
  assert.match(appShared, /website: 'NutriMind \+ Workout Tracker'/);
});
