'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appShared = fs.readFileSync(
  path.join(__dirname, '..', 'agent-office-deploy', 'dist', 'app-shared.js'),
  'utf8'
);

test('org chart uses the current CoachClaw display name and app ownership', () => {
  assert.match(appShared, /id: 'nutrimind',[\s\S]*name: 'CoachClaw'/);
  assert.match(appShared, /repo: 'diet-plan and workout-tracker'/);
});

test('org chart uses the current FarmClaw identity and ownership', () => {
  assert.match(appShared, /id: 'commentfarm',[\s\S]*name: 'FarmClaw'/);
  assert.match(appShared, /repo: 'farm-bot and CommentFarm workflows'/);
});
