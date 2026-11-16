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
  assert.match(app, /canonicalAgentId\(entry\.agent\) === id/);
  assert.match(app, /renderRoster\(entries\)/);
  assert.match(app, /class="ao-card ao-card--interactive ao-entity-card mem-bank-card"/);
  assert.match(app, /aria-label="Show \$\{escHTML\(info\.name\)\} memories"/);
});

test('memory filters accept legacy display names and current agent ids', () => {
  const app = fs.readFileSync(path.join(dist, 'app-shared.js'), 'utf8');

  assert.match(app, /function canonicalAgentId\(value\)/);
  assert.match(app, /item\.name\.toLowerCase\(\) === wanted/);
  assert.match(app, /canonicalAgentId\(e\.agent\) === activeAgent/);
});

test('Mission Control follows Calendar in Planning Tools', () => {
  const shell = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'shell', 'shell.html'), 'utf8');
  const start = shell.indexOf('data-nav-sub="planning"');
  const planning = shell.slice(start, shell.indexOf('data-nav-area="dropbox"', start));
  const labels = [...planning.matchAll(/class="nav-item-label">([^<]+)</g)].map(match => match[1]);

  assert.deepEqual(labels, ['Planning Tools', 'Fix Queue', 'Countdowns', 'Calendar', 'Planning Mode', 'Mission Control', 'Streaks']);
  assert.match(planning, /href="\/\?panel=mission-control"/);
});
