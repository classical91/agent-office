'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'agent-office-deploy', 'dist');
const index = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const control = fs.readFileSync(path.join(DIST, 'office-control-center.js'), 'utf8');
const shared = fs.readFileSync(path.join(DIST, 'app-shared.js'), 'utf8');
const sharedCss = fs.readFileSync(path.join(DIST, 'shared.css'), 'utf8');
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const relay = fs.readFileSync(path.join(ROOT, 'scripts', 'openclaw-heartbeat.js'), 'utf8');

test('Penny is explicitly the sole orchestrator and office owner', () => {
  assert.match(readme, /Penny \(`oss`\) is the sole OpenClaw orchestrator/);
  assert.match(control, /Penny owns this office/);
  assert.match(control, /Specialists do not command one another/);
});

test('the office exposes Mission Control and operational agent inspection', () => {
  assert.match(index, /AOControlCenter\.openMissionControl\(\)/);
  assert.match(index, /office-control-center\.js\?v=/);
  assert.match(control, /office\.addEventListener\('click', interceptAgentClick, true\)/);
  assert.match(control, /fetch\('\/api\/agents'/);
  assert.match(control, /current_task_title/);
  assert.doesNotMatch(sharedCss, /\.office-command-btn\s*\{\s*display:\s*none/);
});

test('Mission Control sends goals to Penny through the authenticated board', () => {
  assert.match(control, /fetch\('\/api\/orchestration\/goals'/);
  assert.match(control, /id="mission-goal-priority"/);
  assert.doesNotMatch(control, /id="mission-goal-rank"/);
  assert.match(control, /id="mission-goal-source"/);
  assert.match(relay, /Saved ChatGPT conversation context/);
  assert.match(control, /Currently working/);
  assert.match(control, /Completed history/);
  assert.match(control, /priority === 'urgent'/);
  assert.match(control, /refreshMissionGoals/);
  assert.match(control, /Goals and Outbox/);
  assert.match(control, /Edit order/);
  assert.match(control, /draggable=/);
  assert.match(control, /Move goal up/);
  assert.match(control, /\/api\/orchestration\/goals\/order/);
  assert.match(control, /\/edit/);
});

test('one general login gates the entire Agent Office site', () => {
  assert.match(index, /id="ao-login-trigger"[^>]*>Login</);
  assert.match(index, /id="ao-login-password"[^>]*type="password"/);
  assert.match(shared, /fetch\('\/api\/session',\s*\{/);
  assert.match(shared, /JSON\.stringify\(\{ passphrase:/);
  assert.match(shared, /dropsAuthState = \{ configured: true, authenticated: true/);
  assert.match(shared, /return requestOfficeLogin\(\)/);
  assert.match(shared, /setOfficeGateState\(false\)/);
  assert.match(shared, /classList\.toggle\('ao-site-locked', !authenticated\)/);
  assert.match(sharedCss, /\.ao-site-locked body > :not\(\.ao-login-modal\)/);
  const server = fs.readFileSync(path.join(DIST, 'server.js'), 'utf8');
  const login = fs.readFileSync(path.join(DIST, 'login.html'), 'utf8');
  assert.match(server, /pathname !== '\/login\.html'.*!getSession\(req\)/s);
  assert.match(server, /Location: `\/login\.html\?next=/);
  assert.match(login, /Enter your password to access the entire Agent Office website/);
  assert.doesNotMatch(shared, /function showPassphraseModal/);
  assert.doesNotMatch(fs.readFileSync(path.join(DIST, 'calendar-v3.html'), 'utf8'), /window\.prompt\('Enter the Agent Office passphrase/);
});

test('unsupported runtime controls are disclosed instead of simulated', () => {
  assert.match(control, /will appear only when the OpenClaw gateway exposes verified control and telemetry endpoints/);
  assert.doesNotMatch(control, /method:\s*['"](?:PATCH|DELETE)['"].*\/api\/agents/is);
});

test('code goals pause for approval and enforce the GitHub push-first workflow', () => {
  assert.match(relay, /Jason has NOT approved a build/);
  assert.match(relay, /\[BUILD_APPROVAL_REQUIRED\]/);
  assert.match(relay, /fetch the latest GitHub main\/master first/);
  assert.match(relay, /push the exact tested commit to GitHub/);
  assert.match(relay, /Never deploy unless Jason separately approved deployment/);
  assert.match(control, /Approve build/);
  assert.match(control, /\/approve/);
});
