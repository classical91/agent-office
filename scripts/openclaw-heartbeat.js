#!/usr/bin/env node
'use strict';

/**
 * OpenClaw heartbeat.
 *
 * Run this on the machine OpenClaw runs on. It asks the local gateway what is
 * running and posts that to Agent Office every 30 seconds, so a deployed
 * office can show a real green light for a gateway it has no way of reaching.
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
 *
 * A beat older than 90 seconds reads as offline in the office, so the default
 * interval leaves room for one to go missing without flapping the light.
 */

const os = require('node:os');

const OFFICE_URL = String(process.env.OFFICE_URL || '').trim().replace(/\/+$/, '');
const GATEWAY_URL = String(process.env.GATEWAY_URL || 'http://localhost:18789').trim().replace(/\/+$/, '');
const TOKEN = String(process.env.GATEWAY_TOKEN || '').trim();
const INTERVAL_MS = Math.max(5, Number(process.env.HEARTBEAT_SECONDS) || 30) * 1000;
const ONCE = process.env.HEARTBEAT_ONCE === '1';
const PROBE_PATHS = ['/agents', '/api/agents', '/status', '/api/status', '/health', '/api/health'];
const REQUEST_TIMEOUT_MS = 5000;

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

(async () => {
  const ok = await beat();
  if (ONCE) process.exit(ok ? 0 : 1);
  setInterval(beat, INTERVAL_MS);
  console.log(`Reporting ${GATEWAY_URL} to ${OFFICE_URL} every ${INTERVAL_MS / 1000}s. Ctrl-C to stop.`);
})();
