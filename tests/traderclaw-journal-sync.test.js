'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildPayload, payloadBytes } = require('../scripts/sync-traderclaw-journal.js');

test('journal sync payload stays below the configured request budget and keeps newest entries', () => {
  const entries = Array.from({ length: 50 }, (_, index) => ({
    record_id: `entry-${index}`,
    timestamp_utc: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    notes: 'x'.repeat(2200),
  }));
  const summaries = [{ name: 'week.md', updated_at: '2026-02-01T00:00:00Z', content: 'y'.repeat(8000) }];
  const budget = 45 * 1024;

  const payload = buildPayload(entries, summaries, budget);

  assert.ok(payloadBytes(payload) <= budget);
  assert.equal(payload.entries.at(-1).record_id, 'entry-49');
  assert.ok(payload.entries.length < entries.length);
});

test('one oversized entry does not prevent compact recent entries from syncing', () => {
  const payload = buildPayload([
    { record_id: 'oversized', notes: 'x'.repeat(60 * 1024) },
    { record_id: 'latest', notes: 'ok' },
  ], [], 45 * 1024);

  assert.deepEqual(payload.entries.map(entry => entry.record_id), ['latest']);
});
