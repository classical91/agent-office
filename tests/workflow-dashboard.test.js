'use strict';

// The rules behind Mission Control's workflow view, without a server: exact
// schedules, honest next runs, and status that never invents a failure.

const assert = require('node:assert/strict');
const test = require('node:test');
const W = require('../agent-office-deploy/dist/workflow-dashboard.js');

const VAN = 'America/Vancouver';
const iso = ms => new Date(ms).toISOString();
const at = text => Date.parse(text);

function workflow(patch = {}) {
  return W.normalizeWorkflow({ name: 'Brief', provider: 'openclaw', schedule: { kind: 'cron', expr: '0 8 * * *', timezone: VAN }, ...patch }, { now: at('2026-10-09T00:00Z') });
}

// Wall-clock time in a zone, as the zone's own tz database sees it. British
// Columbia's offset rules changed in late 2026 (permanent UTC-7), and Node
// versions ship different tzdata, so Vancouver is checked by local time and
// the DST mechanics by Los Angeles, whose rules are stable.
function local(ms, zone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(ms).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
const LA = 'America/Los_Angeles';

test('cron runs follow daylight-saving changes in the schedule\'s zone', () => {
  // 1 Nov 2026: PDT ends in Los Angeles. 08:00 is 15:00Z before and 16:00Z after.
  assert.equal(iso(W.nextCronRun('0 8 * * *', LA, at('2026-10-31T16:00Z'))), '2026-11-01T16:00:00.000Z');
  assert.equal(iso(W.nextCronRun('0 8 * * *', LA, at('2026-10-30T16:00Z'))), '2026-10-31T15:00:00.000Z');
  // 14 Mar 2027: 02:30 does not exist, so that day is skipped, not shifted.
  assert.equal(iso(W.nextCronRun('30 2 * * *', LA, at('2027-03-14T00:00Z'))), '2027-03-15T09:30:00.000Z');
  // The repeated 01:30 on 7 Nov 2027 runs once.
  const first = W.nextCronRun('30 1 * * *', LA, at('2027-11-07T00:00Z'));
  assert.equal(iso(first), '2027-11-07T08:30:00.000Z');
  assert.equal(iso(W.nextCronRun('30 1 * * *', LA, first)), '2027-11-08T09:30:00.000Z');
  // Vancouver runs at 08:00 local whatever its offset is that day.
  for (const after of ['2026-10-30T16:00Z', '2026-11-01T17:00Z', '2027-03-15T17:00Z', '2027-11-08T17:00Z']) {
    assert.match(local(W.nextCronRun('0 8 * * *', VAN, at(after)), VAN), / 08:00$/, after);
  }
});

test('day-of-month steps restart each month and are never described as a fixed interval', () => {
  // */2 runs on the 31st and again on the 1st: one day apart, not two.
  assert.equal(local(W.nextCronRun('0 8 */2 * *', VAN, at('2026-10-30T16:00Z')), VAN), '2026-10-31 08:00');
  assert.equal(local(W.nextCronRun('0 8 */2 * *', VAN, at('2026-10-31T16:00Z')), VAN), '2026-11-01 08:00');
  // November has no 31st: from the 29th the next run is 1 December.
  assert.equal(local(W.nextCronRun('0 8 */2 * *', VAN, at('2026-11-29T17:00Z')), VAN), '2026-12-01 08:00');
  const described = W.describeCron('0 8 */2 * *');
  assert.match(described.text, /days 1, 3, 5 … 31/);
  assert.doesNotMatch(described.text, /48|every 2 days|every other day/i);
  assert.match(described.notes.join(' '), /not always 48 hours apart/);
  // A 31st-of-the-month job skips short months instead of moving.
  assert.equal(iso(W.nextCronRun('0 9 31 * *', 'UTC', at('2026-09-01T00:00Z'))), '2026-10-31T09:00:00.000Z');
  assert.equal(iso(W.nextCronRun('0 0 29 2 *', 'UTC', at('2026-10-09T00:00Z'))), '2028-02-29T00:00:00.000Z');
});

test('cron syntax follows standard semantics and rejects what it cannot run', () => {
  // Day-of-month and day-of-week both set: either matches (Fri 9 Oct 2026).
  assert.equal(iso(W.nextCronRun('0 9 15 * FRI', 'UTC', at('2026-10-09T00:00Z'))), '2026-10-09T09:00:00.000Z');
  assert.equal(iso(W.nextCronRun('0 9 * * 7', 'UTC', at('2026-10-09T00:00Z'))), '2026-10-11T09:00:00.000Z', '7 is Sunday');
  assert.equal(W.describeCron('0 7 * * 1-5').text, 'at 07:00, on Mon–Fri');
  assert.equal(W.describeCron('@daily').text, 'at 00:00, every day');
  for (const bad of ['0 8 * *', '61 8 * * *', '0 8 */0 * *', '0 8 5-1 * *', 'every day']) {
    assert.equal(W.isValidCron(bad), false, bad);
  }
});

test('a next run names its source: provider, calculated, unknown, past or disabled', () => {
  const now = at('2026-10-09T17:00Z');
  const reported = workflow({ provider_next_run_at: at('2026-10-10T15:05Z') });
  assert.deepEqual(W.nextRun(reported, now), { at: at('2026-10-10T15:05Z'), basis: 'provider', approximate: false });
  // A provider time already in the past is stale; the schedule takes over.
  const stale = workflow({ provider_next_run_at: at('2026-10-01T15:00Z') });
  assert.equal(W.nextRun(stale, now).basis, 'calculated');
  assert.equal(iso(W.nextRun(stale, now).at), '2026-10-10T15:00:00.000Z');

  const flexible = workflow({ provider: 'chatgpt', schedule: { kind: 'provider', text: 'Daily around 9 PM', flexible: true } });
  assert.equal(W.nextRun(flexible, now).basis, 'unknown');
  const flexibleCron = workflow({ schedule: { kind: 'cron', expr: '0 21 * * *', timezone: VAN, flexible: true } });
  assert.equal(W.nextRun(flexibleCron, now).approximate, true);
  assert.match(W.describeSchedule(flexibleCron.schedule).notes.join(' '), /Flexible timing/);

  assert.equal(W.nextRun(workflow({ enabled: false }), now).basis, 'disabled');
  const once = workflow({ schedule: { kind: 'once', at: '2026-10-01T09:00', timezone: VAN } });
  assert.equal(W.nextRun(once, now).basis, 'past');
  assert.equal(iso(W.nextRun(once, now).past_at), '2026-10-01T16:00:00.000Z');

  const interval = workflow({ schedule: { kind: 'interval', every_ms: 6 * 3600000, anchor: '2026-10-09T00:00:00Z' } });
  assert.equal(iso(W.nextRun(interval, now).at), '2026-10-09T18:00:00.000Z');
  const anchorless = workflow({ schedule: { kind: 'interval', every_ms: 6 * 3600000 } });
  assert.equal(W.nextRun(anchorless, now).basis, 'unknown');
});

test('missing history is unknown, and execution and delivery fail separately', () => {
  const view = { ...workflow(), source: 'imported' };
  assert.equal(W.workflowHealth(view, null), 'unknown');
  const run = patch => W.normalizeRun({ workflow_id: 'x', ...patch });
  assert.equal(W.workflowHealth(view, run({ status: 'error' })), 'failed');
  assert.equal(W.workflowHealth(view, run({ status: 'ok', delivery_status: 'bounced' })), 'delivery_failed');
  assert.equal(W.workflowHealth(view, run({ status: 'ok' })), 'succeeded');
  assert.equal(W.workflowHealth(view, run({ status: 'ok', delivery_status: 'sent' })), 'delivered');
  assert.equal(W.workflowHealth(view, run({ status: 'weird' })), 'unknown');
  assert.equal(W.workflowHealth({ ...view, source: 'live', live_fresh: false }, null), 'stale');
  assert.equal(W.workflowHealth({ ...view, enabled: false }, run({ status: 'error' })), 'disabled');
  assert.throws(() => run({ output_url: 'javascript:alert(1)' }), /http/);
});

test('a stale relay is one connection notice, not a failure per job', () => {
  const jobs = Array.from({ length: 11 }, (_, i) => ({ id: `job-${i}`, name: `Job ${i}`, enabled: true, schedule: { kind: 'cron', expr: '0 8 * * *' } }));
  const dashboard = W.buildDashboard({ snapshot: { jobs, updated_at: '2026-10-09T10:00:00.000Z', fresh: false }, now: at('2026-10-09T17:00Z') });
  assert.equal(dashboard.sources.openclaw.state, 'stale');
  assert.deepEqual(dashboard.attention.map(item => item.kind), ['stale_connection']);
  assert.ok(dashboard.workflows.every(w => w.health === 'stale'));
  assert.equal(dashboard.upcoming.length, 11, 'stale schedules still show when they should next run');

  const empty = W.buildDashboard({ snapshot: null });
  assert.equal(empty.sources.openclaw.state, 'not_connected');
  assert.deepEqual(empty.attention, []);
});

test('overlapping audits are flagged once per provider and every one is kept', () => {
  const views = ['Repo audit', 'Security audit', 'Workflow audit', 'Daily reflection']
    .map((name, i) => ({ ...workflow({ name, provider: 'chatgpt' }), id: `wf-${i}` }));
  const flags = W.detectOverlaps(views, []);
  assert.equal(flags.length, 1);
  assert.deepEqual(flags[0].names, ['Repo audit', 'Security audit', 'Workflow audit']);
  assert.equal(W.detectOverlaps(views, [flags[0].key])[0].acknowledged, true);
  // Adding a fourth audit changes the group, so it is asked about again.
  const more = [...views, { ...workflow({ name: 'Cost audit', provider: 'chatgpt' }), id: 'wf-9' }];
  assert.equal(W.detectOverlaps(more, [flags[0].key])[0].acknowledged, false);
});

test('the raw `openclaw cron list --json` output imports with ids, zones and exact schedules', () => {
  const raw = JSON.stringify({ jobs: [
    { id: 'a1', name: 'internal-brief', displayName: 'Morning brief', enabled: true, agentId: 'oss', schedule: { kind: 'cron', expr: '0 8 */2 * *', tz: VAN }, state: { nextRunAtMs: 1791000000000 } },
    { id: 'b2', name: 'heartbeat', enabled: false, schedule: { kind: 'every', everyMs: 1800000 } },
    { id: 'c3', name: 'launch', schedule: { kind: 'at', at: '2026-01-02T03:04:00Z' } },
  ] });
  const { drafts, errors } = W.parseImport(raw, { provider: 'openclaw' });
  assert.deepEqual(errors, []);
  assert.deepEqual(drafts.map(d => [d.provider_id, d.name, d.schedule.kind, d.enabled]), [
    ['a1', 'Morning brief', 'cron', true], ['b2', 'heartbeat', 'interval', false], ['c3', 'launch', 'once', true],
  ]);
  assert.equal(drafts[0].schedule.expr, '0 8 */2 * *');
  assert.equal(drafts[0].schedule.timezone, VAN);
  assert.equal(drafts[0].provider_next_run_at, 1791000000000);
  assert.equal(drafts[0].agent, 'oss');
});

test('pasted inventory text keeps only what is plainly there', () => {
  const text = [
    'OpenClaw cron jobs (3)',
    '',
    '1. Morning brief — `0 8 * * *` Europe/London, id: morning-brief',
    '   Sends Jason the morning brief',
    '2. Weekly audit (disabled)',
    '   Schedule: 0 9 * * 1 · id: weekly-audit',
    '3. Something odd',
    '   runs whenever Penny feels like it',
  ].join('\n');
  const { drafts } = W.parseImport(text, { provider: 'openclaw' });
  assert.deepEqual(drafts.map(d => d.name), ['Morning brief', 'Weekly audit', 'Something odd']);
  assert.equal(drafts[0].schedule.timezone, 'Europe/London');
  assert.equal(drafts[1].enabled, false);
  assert.equal(drafts[2].schedule.kind, 'provider', 'no schedule is invented');
  assert.match(drafts[0].prompt, /Sends Jason the morning brief/, 'the source text is kept with the record');
  assert.deepEqual(W.parseImport('', {}).errors, ['Paste an inventory to import.']);
});

test('repeated imports dedupe by provider and id, then name, and never delete', () => {
  let n = 0;
  const newId = () => `wf-${++n}`;
  const drafts = W.parseImport('- Brief: daily at 8 AM\n- Audit: weekly', { provider: 'chatgpt' }).drafts;
  const first = W.mergeImport([], drafts, { newId, now: at('2026-10-09T00:00Z') });
  assert.equal(first.summary.created, 2);
  const again = W.mergeImport(first.records, drafts, { newId, now: at('2026-10-10T00:00Z') });
  assert.deepEqual(again.summary, { created: 0, updated: 0, unchanged: 2 });
  assert.equal(again.records[0].synced_at, '2026-10-10T00:00:00.000Z', 'a re-import refreshes the sync time');
  const partial = W.mergeImport(again.records, W.parseImport('- Brief: daily at 9 AM', { provider: 'chatgpt' }).drafts, { newId });
  assert.deepEqual(partial.summary, { created: 0, updated: 1, unchanged: 0 });
  assert.equal(partial.records.length, 2);
  // The same name from a different provider is a different workflow.
  const other = W.mergeImport(partial.records, W.parseImport('- Brief: daily at 9 AM', { provider: 'claude' }).drafts, { newId });
  assert.equal(other.summary.created, 1);
});

test('the earlier daily/weekly/monthly tracker converts to exact schedules', () => {
  const base = { title: 'Brief', source: 'ChatGPT', start: '2026-10-06T08:00', timezone: VAN, notes: '' };
  assert.equal(W.fromLegacySchedule({ ...base, repeat: 'daily' }).schedule.expr, '0 8 * * *');
  assert.equal(W.fromLegacySchedule({ ...base, repeat: 'weekly' }).schedule.expr, '0 8 * * 2');
  assert.equal(W.fromLegacySchedule({ ...base, repeat: 'monthly' }).schedule.expr, '0 8 6 * *');
  assert.equal(W.fromLegacySchedule({ ...base, repeat: 'once' }).schedule.kind, 'once');
  const legacy = W.normalizeWorkflow(W.fromLegacySchedule({ ...base, start: '2026-12-01T08:00', repeat: 'daily' }));
  assert.equal(local(W.nextRun(legacy, at('2026-10-09T00:00Z')).at, VAN), '2026-12-01 08:00', 'not before its first date');
});

test('a run recorded on a live job stays with it once the job has a stored record', () => {
  const snapshot = { jobs: [{ id: 'brief', name: 'Brief', enabled: true, schedule: { kind: 'cron', expr: '0 8 * * *' } }], updated_at: '2026-10-09T10:00:00.000Z', fresh: true };
  const run = W.normalizeRun({ workflow_id: 'openclaw:brief', status: 'ok', delivery_status: 'delivered', output_title: 'Brief — Oct 9' });
  const record = { ...workflow({ name: 'Brief', provider_id: 'brief', delivery: 'Telegram' }), id: 'wf-stored' };
  const dashboard = W.buildDashboard({ records: [record], runs: [run], snapshot });
  assert.equal(dashboard.workflows.length, 1);
  assert.equal(dashboard.workflows[0].id, 'wf-stored');
  assert.equal(dashboard.workflows[0].health, 'delivered');
  assert.equal(dashboard.results[0].workflow_name, 'Brief');
});
