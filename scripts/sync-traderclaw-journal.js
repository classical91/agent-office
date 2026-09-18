#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const OFFICE_URL = String(process.env.OFFICE_URL || '').trim().replace(/\/+$/, '');
const TOKEN = String(process.env.JOURNAL_TOKEN || '').trim();
const JOURNAL_DIR = String(process.env.TRADERCLAW_JOURNAL_DIR || 'C:\\Users\\JAson\\.openclaw\\workspace-trader\\learning-journal');
const INTERVAL_MS = Math.max(60, Number(process.env.JOURNAL_SYNC_SECONDS) || 300) * 1000;
const ONCE = process.env.JOURNAL_SYNC_ONCE === '1';
const MAX_PAYLOAD_BYTES = Math.max(4096, Number(process.env.JOURNAL_SYNC_MAX_BYTES) || 45 * 1024);

function filesUnder(dir, suffix) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full, suffix) : entry.name.endsWith(suffix) ? [full] : [];
  });
}

function readEntries() {
  return filesUnder(path.join(JOURNAL_DIR, 'entries'), '.jsonl').flatMap(file => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; }
  })).slice(-50);
}

function readSummaries() {
  return filesUnder(path.join(JOURNAL_DIR, 'weekly-summaries'), '.md').slice(-8).map(file => ({
    name: path.basename(file),
    updated_at: fs.statSync(file).mtime.toISOString(),
    content: fs.readFileSync(file, 'utf8').slice(0, 8000),
  }));
}

function payloadBytes(payload) {
  return Buffer.byteLength(JSON.stringify(payload), 'utf8');
}

function buildPayload(entries = readEntries(), summaries = readSummaries(), maxBytes = MAX_PAYLOAD_BYTES) {
  const payload = { entries: [], weekly_summaries: [] };

  // Keep newest journal entries first in admission priority. The API sorts
  // them after sanitizing, while the request must stay below its 50 KiB body
  // limit. An oversized entry is skipped rather than blocking newer compact
  // records from syncing.
  for (const entry of entries.slice(-50).reverse()) {
    const candidate = { ...payload, entries: [entry, ...payload.entries] };
    if (payloadBytes(candidate) <= maxBytes) payload.entries = candidate.entries;
  }

  const newestSummaries = summaries
    .slice(-8)
    .sort((a, b) => Date.parse(b.updated_at || 0) - Date.parse(a.updated_at || 0));
  for (const summary of newestSummaries) {
    const candidate = { ...payload, weekly_summaries: [...payload.weekly_summaries, summary] };
    if (payloadBytes(candidate) <= maxBytes) payload.weekly_summaries = candidate.weekly_summaries;
  }

  return payload;
}

async function sync() {
  const payload = buildPayload();
  const body = JSON.stringify(payload);
  const response = await fetch(`${OFFICE_URL}/api/traderclaw-journal/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Journal-Token': TOKEN },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Agent Office replied ${response.status}: ${(await response.text()).slice(0, 180)}`);
  const result = await response.json();
  console.log(`${new Date().toISOString()} synced TraderClaw journal (${result.counts.entries} entries, ${Buffer.byteLength(body, 'utf8')} bytes)`);
}

async function main() {
  if (!OFFICE_URL || !TOKEN) throw new Error('Set OFFICE_URL and JOURNAL_TOKEN.');
  try { await sync(); } catch (error) { console.error(`${new Date().toISOString()} ${error.message}`); if (ONCE) process.exit(1); }
  if (ONCE) return;
  setInterval(() => sync().catch(error => console.error(`${new Date().toISOString()} ${error.message}`)), INTERVAL_MS);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`${new Date().toISOString()} ${error.message}`);
    process.exit(1);
  });
}

module.exports = { buildPayload, payloadBytes };
