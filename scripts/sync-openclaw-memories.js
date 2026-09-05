#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const MAX_FILES_PER_AGENT = 20;
const MAX_ITEMS_PER_AGENT = 24;
const MAX_CONTENT_LENGTH = 12000;

function redact(text) {
  return String(text || '')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]')
    .replace(/\b(token|secret|password|passwd|api[_ -]?key|cookie)\s*[:=]\s*[^\s,;]+/gi, '$1: [REDACTED]')
    .replace(/([?&](?:token|key|secret|signature)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{12,}\b/g, '[REDACTED]');
}

function memoryItems(markdown) {
  const items = [];
  for (const raw of String(markdown || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('```') || /^---+$/.test(line)) continue;
    if (!/^[-*+]\s+|^\d+[.)]\s+/.test(line)) continue;
    const cleaned = redact(line.replace(/^[-*+]\s+|^\d+[.)]\s+/, '').trim());
    if (cleaned.length >= 8 && !items.includes(cleaned)) items.push(cleaned.slice(0, 800));
  }
  return items;
}

async function memoryFiles(workspace) {
  const candidates = [];
  const main = path.join(workspace, 'MEMORY.md');
  try {
    const stat = await fs.stat(main);
    if (stat.isFile()) candidates.push({ path: main, stat });
  } catch {}

  const dailyDir = path.join(workspace, 'memory');
  try {
    for (const entry of await fs.readdir(dailyDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;
      const file = path.join(dailyDir, entry.name);
      candidates.push({ path: file, stat: await fs.stat(file) });
    }
  } catch {}

  return candidates
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
    .slice(0, MAX_FILES_PER_AGENT);
}

async function buildSnapshot(agent) {
  const files = await memoryFiles(agent.workspace);
  const items = [];
  for (const file of files) {
    const markdown = await fs.readFile(file.path, 'utf8');
    for (const item of memoryItems(markdown)) {
      if (!items.includes(item)) items.push(item);
      if (items.length >= MAX_ITEMS_PER_AGENT) break;
    }
    if (items.length >= MAX_ITEMS_PER_AGENT) break;
  }

  const newest = files[0] ? files[0].stat.mtime.toISOString() : '';
  const lines = [
    'AUTOMATIC OPENCLAW MEMORY SYNC',
    `Source: ${files.length} durable memory file${files.length === 1 ? '' : 's'}`,
    `Last source update: ${newest || 'No durable memory file found'}`,
    '',
  ];
  if (!files.length) {
    lines.push('No MEMORY.md or memory/*.md files currently exist for this agent. HQ will update automatically when durable memory is added.');
  } else if (!items.length) {
    lines.push('Durable memory files exist, but they contain no safe bullet-point memories suitable for the HQ summary.');
  } else {
    lines.push('Curated remembered context:');
    lines.push(...items.map(item => `• ${item}`));
  }

  return {
    agent: agent.id,
    content: lines.join('\n').slice(0, MAX_CONTENT_LENGTH),
    sourceUpdatedAt: newest || null,
    sourceFileCount: files.length,
  };
}

async function configuredAgents(configPath) {
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const agentConfig = config && config.agents;
  const list = Array.isArray(agentConfig && agentConfig.list)
    ? agentConfig.list
    : Object.entries((agentConfig && agentConfig.entries) || {}).map(([id, agent]) => ({ id, ...agent }));
  return list
    .filter(agent => agent && agent.id && agent.workspace)
    .map(agent => ({ id: String(agent.id), workspace: path.resolve(String(agent.workspace)) }));
}

async function syncOpenClawMemories(options = {}) {
  const officeUrl = String(options.officeUrl || process.env.OFFICE_URL || '').trim().replace(/\/+$/, '');
  const token = String(options.token || process.env.GATEWAY_TOKEN || '').trim();
  const configPath = path.resolve(options.configPath || process.env.OPENCLAW_CONFIG_PATH || path.join(os.homedir(), '.openclaw', 'openclaw.json'));
  if (!officeUrl || !token) throw new Error('OFFICE_URL and GATEWAY_TOKEN are required.');

  const agents = await configuredAgents(configPath);
  const memories = await Promise.all(agents.map(buildSnapshot));
  const response = await fetch(`${officeUrl}/api/memories/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Gateway-Token': token },
    body: JSON.stringify({ memories }),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Agent Office replied ${response.status}`);
  return payload;
}

if (require.main === module) {
  syncOpenClawMemories()
    .then(result => console.log(`${new Date().toISOString()} synced ${result.synced || 0} OpenClaw agent memory snapshots`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { redact, memoryItems, memoryFiles, buildSnapshot, configuredAgents, syncOpenClawMemories };
