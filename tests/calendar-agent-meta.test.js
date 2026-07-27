const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const meta = require(path.resolve(__dirname, '..', 'agent-office-deploy', 'dist', 'calendar-agent-meta.js'));

test('metadata normalization coerces loose input and drops unknown fields', () => {
  const normalized = meta.normalizeMeta({
    agentId: '  codex  ',
    projectId: 'flashcards',
    movable: 'yes',
    estimatedDuration: '90',
    prepMinutes: 'not-a-number',
    requiredInputs: 'repo, branch , repo-access',
    executionMode: 'AGENT_RUN',
    runStatus: 'Running',
    priority: 'high',
    nonsense: 'ignored',
  });

  assert.deepEqual(normalized, {
    agentId: 'codex',
    projectId: 'flashcards',
    priority: 'high',
    executionMode: 'agent-run',
    movable: true,
    estimatedDuration: 90,
    requiredInputs: ['repo', 'branch', 'repo-access'],
    runStatus: 'running',
  });
  assert.equal('nonsense' in normalized, false);
  assert.equal('prepMinutes' in normalized, false);
});

test('metadata survives a round trip through Google extended properties', () => {
  const original = meta.normalizeMeta({
    agentId: 'codex',
    projectId: 'flashcards',
    taskId: 'task-12',
    eventKind: 'agent-run',
    executionMode: 'agent-run',
    movable: false,
    estimatedDuration: 90,
    prepMinutes: 15,
    followUpMinutes: 10,
    requiredInputs: ['repo', 'design doc'],
    expectedOutput: 'Draft pull request',
    runStatus: 'scheduled',
  });

  const bag = meta.metaToGooglePrivate(original);
  // Google only stores strings.
  Object.values(bag).forEach(value => assert.equal(typeof value, 'string'));
  assert.equal(bag.aoAgentId, 'codex');
  assert.equal(bag.aoRequiredInputs, 'repo|design doc');

  assert.deepEqual(meta.metaFromGooglePrivate(bag), original);
});

test('events created before the metadata layer still resolve a kind', () => {
  assert.deepEqual(meta.metaFromGooglePrivate({ agentOfficeType: 'focus' }), { eventKind: 'focus' });
});

test('the local mapping table wins over stale Google properties', () => {
  const resolved = meta.resolveMeta(
    { aoAgentId: 'codex', aoRunStatus: 'scheduled' },
    { runStatus: 'running' }
  );
  assert.equal(resolved.agentId, 'codex');
  assert.equal(resolved.runStatus, 'running');
});

test('mergeMeta clears a field when the patch sends null or an empty value', () => {
  const base = meta.normalizeMeta({ agentId: 'codex', resultUrl: 'https://example.com/pr/1' });
  assert.deepEqual(meta.mergeMeta(base, { resultUrl: null }), { agentId: 'codex' });
  assert.deepEqual(meta.mergeMeta(base, { agentId: '' }), { resultUrl: 'https://example.com/pr/1' });
});

test('a run walks scheduled to completed and moves the agent with it', () => {
  const start = meta.runTransition({ agentId: 'codex', projectId: 'flashcards', taskId: 't1' }, 'start');
  assert.equal(start.ok, true);
  assert.equal(start.to, 'running');
  assert.equal(start.agentPatch.status, 'running');
  assert.equal(start.agentPatch.current_project_id, 'flashcards');
  assert.equal(start.agentPatch.current_task_id, 't1');
  assert.ok(start.meta.runStartedAt);

  const needsInput = meta.runTransition(start.meta, 'needs_input');
  assert.equal(needsInput.agentPatch.status, 'needs_input');

  const done = meta.runTransition(needsInput.meta, 'complete', {
    summary: '3 findings',
    resultUrl: 'https://example.com/pr/1',
    findings: 3,
  });
  assert.equal(done.to, 'completed');
  assert.equal(done.meta.resultUrl, 'https://example.com/pr/1');
  assert.equal(done.meta.runFindings, 3);
  // A finished run releases the agent.
  assert.equal(done.agentPatch.status, 'idle');
  assert.equal(done.agentPatch.current_task_id, '');
});

test('illegal run transitions are refused rather than silently applied', () => {
  const running = meta.runTransition({ agentId: 'codex' }, 'start').meta;
  const again = meta.runTransition(running, 'start');
  assert.equal(again.ok, false);
  assert.match(again.error, /running/);

  const fresh = meta.runTransition({}, 'progress');
  assert.equal(fresh.ok, false);
});

test('describeRun reports elapsed time and findings for a live run', () => {
  const startedAt = new Date('2026-07-27T10:00:00Z');
  const now = new Date('2026-07-27T10:18:00Z');
  const running = meta.mergeMeta(
    { agentId: 'codex', runStatus: 'running', runFindings: 3 },
    { runStartedAt: startedAt.toISOString() }
  );
  assert.equal(meta.describeRun(running, now), 'Running · 18 minutes elapsed · 3 findings');
});

test('isAgentOwned recognises agent blocks and ignores ordinary appointments', () => {
  assert.equal(meta.isAgentOwned({ agentId: 'codex' }), true);
  assert.equal(meta.isAgentOwned({ executionMode: 'agent-run' }), true);
  assert.equal(meta.isAgentOwned({ eventKind: 'meeting' }), false);
  assert.equal(meta.isAgentOwned({}), false);
});
