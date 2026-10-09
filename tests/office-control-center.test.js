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

test('Mission Control is workflow-first, with goals kept as a secondary section', () => {
  assert.match(index, /office-control-center\.js\?v=workflows-20261009/);
  assert.match(index, /workflow-dashboard\.js\?v=/);
  assert.match(index, /mission-control\.js\?v=/);
  // workflow-dashboard.js defines the shared rules mission-control.js draws with.
  assert.ok(index.indexOf('workflow-dashboard.js') < index.indexOf('mission-control.js'));
  assert.match(control, /Your scheduled workflows and latest results\./);
  assert.match(control, /AOMissionControl\.mount/);
  assert.match(control, /Goals and manual assignments/);
  assert.match(control, /Open goals/);
  assert.match(control, /missionRequest\('\/api\/orchestration\/goals'\)/);
  assert.match(control, /goal\.orchestration_status !== 'completed'/);
  assert.match(control, /The same goals shown on your Mission Control card/);
});

test('Mission Control goals can be filtered, toggled for Penny, and moved to reference', () => {
  // Penny claims only urgent goals, so active and disabled map onto priority.
  assert.match(control, /data-goal-filter="active"/);
  assert.match(control, /data-goal-filter="disabled"/);
  assert.match(control, /goal\.priority === 'urgent'/);
  assert.match(control, /priority: active \? 'urgent' : 'normal'/);
  assert.match(control, /\/api\/orchestration\/goals\/\$\{encodeURIComponent\(goal\.id\)\}\/edit/);
  assert.match(control, /priority: enable \? 'urgent' : 'normal'/);
  assert.match(control, /Disable for Penny/);
  assert.match(control, /\/api\/orchestration\/goals\/\$\{encodeURIComponent\(goal\.id\)\}\/reference/);
});

test('workflow controls say they change the dashboard record only', () => {
  const panel = fs.readFileSync(path.join(DIST, 'mission-control.js'), 'utf8');
  assert.match(panel, /Mark disabled here/);
  assert.match(panel, /Remove from dashboard/);
  assert.match(panel, /change Agent Office's record only/);
  assert.match(panel, /Dashboard records only — never changes OpenClaw or ChatGPT/);
  // The panel never talks to a provider; every write goes to this app's API.
  assert.doesNotMatch(panel, /fetch\((?!url)/);
  assert.doesNotMatch(panel, /chatgpt\.com\/backend|openclaw\.cmd|\/api\/cron\//);
});

test('an unreachable gateway makes agent state unknown, not blocked', () => {
  assert.match(shared, /if \(openClawGatewayReachable === false\) return 'unknown';/);
  assert.doesNotMatch(shared, /if \(openClawGatewayReachable === false\) return 'blocked';/);
  assert.doesNotMatch(shared, /Every agent is blocked/);
  assert.match(shared, /Agent status is unknown until it answers/);
});

test('one general login gates the entire Agent Office site', () => {
  assert.match(index, /id="ao-login-trigger"[^>]*>Login</);
  assert.match(index, /id="ao-login-password"[^>]*type="password"/);
  assert.match(shared, /fetch\('\/api\/session',\s*\{/);
  assert.match(shared, /JSON\.stringify\(\{ passphrase:/);
  assert.match(shared, /dropsAuthState = \{ configured: true, authenticated: true/);
  assert.match(shared, /return requestOfficeLogin\(\)/);
  // The gate used to be closed on every load and reopened once /api/session
  // answered, which flashed the login panel at someone who was already logged
  // in. It is painted from the readable hint cookie now, and the server still
  // has the last word on it.
  assert.match(shared, /applyOfficeSessionState\(\{\s*gated: hint !== OFFICE_HINT_NO_GATE/);
  // And it is three answers, not two: an instance with no passphrase has no
  // gate to paint and no password to ask for.
  assert.match(shared, /officeLoginGated = state\.gated !== false/);
  assert.match(shared, /classList\.toggle\('ao-site-locked', !authenticated\)/);
  assert.match(sharedCss, /\.ao-site-locked body > :not\(\.ao-login-modal\)/);
  const server = fs.readFileSync(path.join(DIST, 'server.js'), 'utf8');
  // The page and the server have to mean the same cookie, or the gate paints
  // from something nobody sets.
  assert.match(shared, /const OFFICE_SESSION_HINT_COOKIE = 'agent_office_signed_in'/);
  assert.match(server, /const SESSION_HINT_COOKIE = 'agent_office_signed_in'/);
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
});
