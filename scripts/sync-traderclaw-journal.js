#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const OFFICE_URL = String(process.env.OFFICE_URL || '').trim().replace(/\/+$/, '');
const TOKEN = String(process.env.JOURNAL_TOKEN || '').trim();
const JOURNAL_DIR = String(process.env.TRADERCLAW_JOURNAL_DIR || 'C:\\Users\\JAson\\.openclaw\\workspace-trader\\learning-journal');
const INTERVAL_MS = Math.max(60, Number(process.env.JOURNAL_SYNC_SECONDS) || 300) * 1000;
const ONCE = process.env.JOURNAL_SYNC_ONCE === '1';

if (!OFFICE_URL || !TOKEN) {
  console.error('Set OFFICE_URL and JOURNAL_TOKEN.');
  process.exit(1);
}

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

async function sync() {
  const response = await fetch(`${OFFICE_URL}/api/traderclaw-journal/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Journal-Token': TOKEN },
    body: JSON.stringify({ entries: readEntries(), weekly_summaries: readSummaries() }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Agent Office replied ${response.status}: ${(await response.text()).slice(0, 180)}`);
  const result = await response.json();
  console.log(`${new Date().toISOString()} synced TraderClaw journal (${result.counts.entries} entries)`);
}

(async () => {
  try { await sync(); } catch (error) { console.error(`${new Date().toISOString()} ${error.message}`); if (ONCE) process.exit(1); }
  if (ONCE) return;
  setInterval(() => sync().catch(error => console.error(`${new Date().toISOString()} ${error.message}`)), INTERVAL_MS);
})();
