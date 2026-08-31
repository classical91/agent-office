const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dist = path.join(__dirname, '..', 'agent-office-deploy', 'dist');

test('memory page presents an all-agent overview', () => {
  const page = fs.readFileSync(path.join(dist, 'memory.html'), 'utf8');
  const app = fs.readFileSync(path.join(dist, 'app-shared.js'), 'utf8');

  assert.match(page, /All-agent memory overview/);
  assert.match(page, /Agent Memory Banks/);
  assert.match(app, /Remembered context/);
  assert.match(app, /Current focus/);
  assert.match(app, /saved.*memories/);
  assert.match(app, /No HQ note saved yet/);
});

test('memory roster is populated from every registered agent', () => {
  const app = fs.readFileSync(path.join(dist, 'app-shared.js'), 'utf8');

  assert.match(app, /Object\.entries\(AGENT_DESCRIPTIONS\)/);
  assert.match(app, /entries\.filter\(entry => entry\.agent === id\)/);
  assert.match(app, /renderRoster\(entries\)/);
});
