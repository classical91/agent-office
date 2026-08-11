#!/usr/bin/env node
'use strict';

/**
 * OpenClaw heartbeat.
 *
 * Run this on the machine OpenClaw runs on. It asks the local gateway what is
 * running and posts that to Agent Office every 30 seconds. The same outbound
 * loop claims Mission Control goals, launches Penny through the local gateway,
 * and writes Penny's result back to the Agent Office Outbox.
 *
 * You only need this when Agent Office is NOT on the same machine as OpenClaw.
 * When they share a machine the server probes the gateway directly and there is
 * nothing to run.
 *
 *   OFFICE_URL=https://your-office.up.railway.app \
 *   GATEWAY_TOKEN=the-same-string-the-server-has \
 *   node scripts/openclaw-heartbeat.js
 *
 * Optional:
 *   GATEWAY_URL       the local gateway (default http://localhost:18789)
 *   HEARTBEAT_SECONDS how often to report (default 30)
 *   HEARTBEAT_ONCE=1  send a single beat and exit, for testing
 *   PENNY_TELEGRAM_TARGET  Telegram chat receiving acknowledgements/results
 *   PENNY_TELEGRAM_ACCOUNT OpenClaw Telegram account id (default oss)
 *
 * A beat older than 90 seconds reads as offline in the office, so the default
 * interval leaves room for one to go missing without flapping the light.
 */

const os = require('node:os');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const OFFICE_URL = String(process.env.OFFICE_URL || '').trim().replace(/\/+$/, '');
const GATEWAY_URL = String(process.env.GATEWAY_URL || 'http://localhost:18789').trim().replace(/\/+$/, '');
const TOKEN = String(process.env.GATEWAY_TOKEN || '').trim();
const INTERVAL_MS = Math.max(5, Number(process.env.HEARTBEAT_SECONDS) || 30) * 1000;
const ONCE = process.env.HEARTBEAT_ONCE === '1';
const PROBE_PATHS = ['/agents', '/api/agents', '/status', '/api/status', '/health', '/api/health'];
const REQUEST_TIMEOUT_MS = 5000;
const TELEGRAM_TARGET = String(process.env.PENNY_TELEGRAM_TARGET || '5752282291').trim();
const TELEGRAM_ACCOUNT = String(process.env.PENNY_TELEGRAM_ACCOUNT || 'oss').trim();
const AGENT_TIMEOUT_MS = Math.max(60, Number(process.env.PENNY_GOAL_TIMEOUT_SECONDS) || 1800) * 1000;
let cycleRunning = false;

if (!OFFICE_URL || !TOKEN) {
  console.error('Set OFFICE_URL and GATEWAY_TOKEN. See the comment at the top of this file.');
  process.exit(1);
}

// The gateway is asked for its agents; whichever path answers with a list wins.
// A gateway that is up but has no agents endpoint still counts as up - the
// heartbeat is the signal, and the agent list is a bonus on top of it.
async function readGateway() {
  let up = false;

  for (const path of PROBE_PATHS) {
    try {
      const response = await fetch(GATEWAY_URL + path, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      up = true;
      if (!response.ok) continue;

      const parsed = await response.json().catch(() => null);
      const list = Array.isArray(parsed) ? parsed
        : Array.isArray(parsed && parsed.agents) ? parsed.agents
          : null;
      if (list && list.length) return { up, agents: list, from: path };
    } catch {
      // Try the next path; a refused connection will fail them all and fall
      // through to "not up", which is the honest answer.
    }
  }

  return { up, agents: [], from: '' };
}

async function beat() {
  const gateway = await readGateway();
  if (!gateway.up) {
    // Saying nothing is how the office learns the gateway went away: the last
    // beat ages out and the light goes red on its own.
    console.log(`${new Date().toISOString()} gateway not responding at ${GATEWAY_URL} - not reporting`);
    return false;
  }

  try {
    const response = await fetch(`${OFFICE_URL}/api/gateway/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Gateway-Token': TOKEN },
      body: JSON.stringify({
        host: os.hostname(),
        version: process.version,
        agents: gateway.agents,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`${new Date().toISOString()} office replied ${response.status}: ${detail.slice(0, 200)}`);
      return false;
    }

    const label = gateway.agents.length ? `${gateway.agents.length} agent(s) from ${gateway.from}` : 'no agent list';
    console.log(`${new Date().toISOString()} reported gateway up - ${label}`);
    return true;
  } catch (error) {
    console.error(`${new Date().toISOString()} could not reach ${OFFICE_URL}: ${error.message}`);
    return false;
  }
}

async function officeRequest(route, options = {}) {
  const response = await fetch(`${OFFICE_URL}${route}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Gateway-Token': TOKEN,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Agent Office replied ${response.status}`);
  return payload;
}

function extractReply(stdout) {
  const raw = String(stdout || '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    const candidates = [
      parsed.reply, parsed.text, parsed.message, parsed.content,
      parsed.result && parsed.result.text,
      parsed.payloads && parsed.payloads.map(item => item && (item.text || item.content)).filter(Boolean).join('\n\n'),
    ];
    return String(candidates.find(Boolean) || raw).slice(0, 40000);
  } catch {
    return raw.slice(0, 40000);
  }
}

async function runPennyGoal(goal) {
  const buildApproval = goal.orchestration_build_approved
    ? 'Jason approved the proposed build through Agent Office. You may now implement only that approved scope.'
    : 'Jason has NOT approved a build for this goal.';
  const prompt = [
    'Mission Control goal from Jason in OpenClaw Agents Office.',
    `Goal ID: ${goal.id}`,
    '',
    goal.content,
    '',
    'You are Penny, the sole orchestrator. Own this goal through completion.',
    'Immediately acknowledge receipt to Jason in the current Telegram direct conversation using the message tool.',
    'Delegate only to the appropriate specialist agents; specialists do not command one another.',
    buildApproval,
    'For any code, configuration, infrastructure, scheduled-task, or deployment work without build approval: perform read-only inspection only, send Jason the exact proposed scope/affected systems/risks/deployment intent, make no changes, and begin your final response with [BUILD_APPROVAL_REQUIRED].',
    'For approved code work: fetch the latest GitHub main/master first; verify repo, remote, branch, and dirty state; use a clean branch/worktree; preserve unrelated changes; test; commit; and push the exact tested commit to GitHub.',
    'Never deploy unless Jason separately approved deployment or the approved scope explicitly included it. Deploy only from the pushed commit and verify production.',
    'Keep Agent Office approval boundaries: no public posting, payments, real trades, production deployment, or destructive action without explicit approval.',
    'Return one coherent final result. Your final reply will also be delivered to Jason and saved to the Agent Office Outbox.',
  ].join('\n');
  const promptPath = path.join(os.tmpdir(), `agent-office-${goal.id.replace(/[^a-zA-Z0-9_-]/g, '')}.txt`);
  await fs.writeFile(promptPath, prompt, 'utf8');
  try {
    const command = process.platform === 'win32' ? 'openclaw.cmd' : 'openclaw';
    const args = [
      'agent', '--agent', 'oss', '--session-key', goal.orchestration_session_key,
      '--message-file', promptPath, '--thinking', 'medium', '--json', '--deliver',
      '--reply-channel', 'telegram', '--reply-account', TELEGRAM_ACCOUNT, '--reply-to', TELEGRAM_TARGET,
      '--timeout', String(Math.ceil(AGENT_TIMEOUT_MS / 1000)),
    ];
    const { stdout } = await execFileAsync(command, args, {
      timeout: AGENT_TIMEOUT_MS + 30000,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
      shell: process.platform === 'win32',
    });
    return extractReply(stdout) || 'Penny completed the goal and delivered the result to Telegram.';
  } finally {
    await fs.unlink(promptPath).catch(() => {});
  }
}

async function relayOneGoal() {
  const claimed = await officeRequest('/api/orchestration/goals/claim', { method: 'POST', body: '{}' });
  if (!claimed.goal) return false;
  const goal = claimed.goal;
  console.log(`${new Date().toISOString()} claimed Mission Control goal ${goal.id}`);
  try {
    const result = await runPennyGoal(goal);
    const needsApproval = result.includes('[BUILD_APPROVAL_REQUIRED]');
    await officeRequest(`/api/orchestration/goals/${encodeURIComponent(goal.id)}`, {
      method: 'PATCH', body: JSON.stringify({ status: needsApproval ? 'needs_approval' : 'completed', result }),
    });
    console.log(`${new Date().toISOString()} ${needsApproval ? 'paused for approval' : 'completed'} Mission Control goal ${goal.id}`);
  } catch (error) {
    await officeRequest(`/api/orchestration/goals/${encodeURIComponent(goal.id)}`, {
      method: 'PATCH', body: JSON.stringify({ status: 'failed', error: error.message }),
    }).catch(reportError => console.error(`${new Date().toISOString()} could not report goal failure: ${reportError.message}`));
    console.error(`${new Date().toISOString()} failed Mission Control goal ${goal.id}: ${error.message}`);
  }
  return true;
}

async function cycle() {
  if (cycleRunning) return;
  cycleRunning = true;
  try {
    const gatewayUp = await beat();
    if (gatewayUp) await relayOneGoal();
  } catch (error) {
    console.error(`${new Date().toISOString()} relay cycle failed: ${error.message}`);
  } finally {
    cycleRunning = false;
  }
}

(async () => {
  const ok = await beat();
  if (ONCE) process.exit(ok ? 0 : 1);
  setInterval(cycle, INTERVAL_MS);
  console.log(`Reporting ${GATEWAY_URL} and relaying Penny goals from ${OFFICE_URL} every ${INTERVAL_MS / 1000}s. Ctrl-C to stop.`);
})();
