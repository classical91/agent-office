const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(error => (error ? reject(error) : resolve(port)));
    });
  });
}

// Each server gets its own JSON files so the suite never touches a developer's
// real data - and so state cannot leak between tests.
async function startServer(options = {}) {
  const port = await getFreePort();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-test-'));
  const environment = {
    ...process.env,
    PORT: String(port),
    PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
    // server.js pins process.env.TZ from APP_TIMEZONE; fixing it to UTC keeps
    // "inside the working day" assertions independent of the host timezone.
    APP_TIMEZONE: 'UTC',
    APP_SETTINGS_FILE: path.join(scratch, 'settings.json'),
    CALENDAR_EVENTS_FILE: path.join(scratch, 'calendar-events.json'),
    AGENTS_FILE: path.join(scratch, 'agents.json'),
    MEMORIES_FILE: path.join(scratch, 'memories.json'),
    DROPS_FILE: path.join(scratch, 'drops.json'),
    PROJECTS_FILE: path.join(scratch, 'projects.json'),
  };
  ['DATABASE_URL', 'GOOGLE_REFRESH_TOKEN', 'DROPS_PASSPHRASE', 'DROPS_PASSPHRASE_HASH'].forEach(key => {
    delete environment[key];
  });
  if (options.passphrase) environment.DROPS_PASSPHRASE = options.passphrase;
  if (options.google !== false) {
    environment.GOOGLE_CLIENT_ID = 'calendar-api-test.apps.googleusercontent.com';
    environment.GOOGLE_CLIENT_SECRET = 'calendar-api-test-secret';
  } else {
    delete environment.GOOGLE_CLIENT_ID;
    delete environment.GOOGLE_CLIENT_SECRET;
  }

  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd: DIST,
    env: environment,
    stdio: 'ignore',
    windowsHide: true,
  });
  const origin = `http://127.0.0.1:${port}`;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Test server exited with code ${child.exitCode}.`);
    try {
      const response = await fetch(`${origin}/api/calendar/status`);
      if (response.ok) return { child, origin, scratch };
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  child.kill();
  throw new Error('Test server did not become ready.');
}

async function json(response) {
  const payload = await response.json();
  assert.equal(response.ok, true, payload.error || `HTTP ${response.status}`);
  return payload;
}

function post(origin, pathname, body) {
  return fetch(`${origin}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function createEvent(origin, event) {
  const created = await json(await post(origin, '/api/calendar/events', event));
  return created.id;
}

test('the status endpoint returns one canonical shape for every sync state', async t => {
  const configured = await startServer();
  t.after(() => configured.child.kill());
  const status = await json(await fetch(`${configured.origin}/api/calendar/status`));

  ['configured', 'connected', 'accountEmail', 'lastSyncedAt', 'syncState', 'error'].forEach(key => {
    assert.ok(key in status, `status is missing the canonical field "${key}"`);
  });
  assert.equal(status.configured, true);
  assert.equal(status.connected, false);
  assert.equal(status.syncState, 'disconnected');
  assert.equal(status.error, null);
  assert.equal(status.lastSyncedAt, null);
  // The legacy keys the older client still reads stay in place.
  assert.equal(status.googleConfigured, true);

  const bare = await startServer({ google: false });
  t.after(() => bare.child.kill());
  const bareStatus = await json(await fetch(`${bare.origin}/api/calendar/status`));
  assert.equal(bareStatus.syncState, 'unconfigured');
  assert.equal(bareStatus.configured, false);
});

test('an empty calendar reports a state instead of looking like a broken sync', async t => {
  const server = await startServer();
  t.after(() => server.child.kill());

  const empty = await json(await fetch(`${server.origin}/api/calendar/events`));
  assert.deepEqual(empty.events, []);
  assert.equal(empty.calendarState, 'disconnected');
  assert.equal(empty.googleConnected, false);

  // Nothing is seeded: an empty response really means an empty calendar.
  assert.equal(empty.events.length, 0);
});

test('event metadata survives create, read and patch', async t => {
  const server = await startServer();
  t.after(() => server.child.kill());

  const id = await createEvent(server.origin, {
    title: 'Build Flashcards onboarding page',
    start: '2026-07-28T15:00:00',
    end: '2026-07-28T16:30:00',
    type: 'agent-run',
    meta: {
      agentId: 'codex',
      projectId: 'flashcards',
      executionMode: 'agent-run',
      movable: true,
      expectedOutput: 'Draft pull request',
      priority: 'high',
    },
  });

  const listed = await json(await fetch(`${server.origin}/api/calendar/events`));
  const event = listed.events.find(item => item.id === id);
  assert.ok(event, 'the created event comes back');
  assert.equal(event.meta.agentId, 'codex');
  assert.equal(event.meta.projectId, 'flashcards');
  assert.equal(event.meta.movable, true);
  assert.equal(event.meta.expectedOutput, 'Draft pull request');

  const patched = await json(await fetch(`${server.origin}/api/calendar/events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meta: { taskId: 'task-42', priority: 'urgent' } }),
  }));
  assert.equal(patched.meta.taskId, 'task-42');
  assert.equal(patched.meta.priority, 'urgent');
  // A patch merges; it does not wipe the fields it did not mention.
  assert.equal(patched.meta.agentId, 'codex');
});

test('deleting an event drops its metadata too', async t => {
  const server = await startServer();
  t.after(() => server.child.kill());

  const id = await createEvent(server.origin, {
    title: 'Temporary',
    start: '2026-07-28T15:00:00',
    end: '2026-07-28T16:00:00',
    meta: { agentId: 'codex' },
  });
  await json(await fetch(`${server.origin}/api/calendar/events/${encodeURIComponent(id)}`, { method: 'DELETE' }));

  const timeline = await json(await fetch(`${server.origin}/api/calendar/agent-timeline`));
  assert.equal(timeline.agents.length, 0, 'a deleted block leaves nothing behind on the timeline');
});

test('the run lifecycle moves the block and the agent record together', async t => {
  const server = await startServer();
  t.after(() => server.child.kill());

  const id = await createEvent(server.origin, {
    title: 'Flashcards repo review',
    start: '2026-07-28T15:00:00',
    end: '2026-07-28T16:30:00',
    type: 'agent-run',
    meta: { agentId: 'codex', projectId: 'flashcards', taskId: 'task-7', executionMode: 'agent-run' },
  });
  const run = action => post(server.origin, `/api/calendar/events/${encodeURIComponent(id)}/run`, action);

  const started = await json(await run({ action: 'start' }));
  assert.equal(started.to, 'running');
  assert.equal(started.agent.status, 'running');
  assert.equal(started.agent.current_project_id, 'flashcards');
  assert.equal(started.agent.current_task_id, 'task-7');
  assert.ok(started.agent.last_heartbeat, 'starting a run beats the agent heartbeat');

  const progressed = await json(await run({ action: 'progress', findings: 3, progress: 'Draft PR being prepared' }));
  assert.match(progressed.status, /^Running/);
  assert.match(progressed.status, /3 findings/);

  const blocked = await run({ action: 'start' });
  assert.equal(blocked.status, 409, 'a running block cannot be started again');

  const completed = await json(await run({
    action: 'complete',
    summary: '3 findings',
    resultUrl: 'https://example.com/pr/1',
  }));
  assert.equal(completed.to, 'completed');
  assert.equal(completed.meta.resultUrl, 'https://example.com/pr/1');
  assert.equal(completed.agent.status, 'idle');
  assert.equal(completed.agent.current_task_id, '', 'a finished run releases the agent');

  const timeline = await json(await fetch(`${server.origin}/api/calendar/agent-timeline`));
  assert.equal(timeline.agents[0].agentId, 'codex');
  assert.equal(timeline.completedOutputs.length, 1);
  assert.equal(timeline.completedOutputs[0].resultUrl, 'https://example.com/pr/1');
});

test('a block waiting on input surfaces in the timeline rather than looking idle', async t => {
  const server = await startServer();
  t.after(() => server.child.kill());

  const id = await createEvent(server.origin, {
    title: 'Needs a decision',
    start: '2026-07-28T15:00:00',
    end: '2026-07-28T16:00:00',
    meta: { agentId: 'guardian', executionMode: 'agent-run' },
  });
  const run = action => post(server.origin, `/api/calendar/events/${encodeURIComponent(id)}/run`, action);
  await json(await run({ action: 'start' }));
  const waiting = await json(await run({ action: 'needs_input' }));
  assert.equal(waiting.to, 'needs_input');
  assert.equal(waiting.agent.status, 'needs_input');

  const timeline = await json(await fetch(`${server.origin}/api/calendar/agent-timeline`));
  assert.equal(timeline.waitingForYou.length, 1);
  assert.equal(timeline.waitingForYou[0].agentId, 'guardian');
});

test('the concurrent agent run cap is enforced when a run is started', async t => {
  const server = await startServer();
  t.after(() => server.child.kill());

  await json(await fetch(`${server.origin}/api/calendar/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferences: { maxConcurrentAgentRuns: 1 } }),
  }));

  const first = await createEvent(server.origin, {
    title: 'Run one',
    start: '2026-07-28T15:00:00',
    end: '2026-07-28T16:00:00',
    meta: { agentId: 'codex', executionMode: 'agent-run' },
  });
  const second = await createEvent(server.origin, {
    title: 'Run two',
    start: '2026-07-28T16:00:00',
    end: '2026-07-28T17:00:00',
    meta: { agentId: 'guardian', executionMode: 'agent-run' },
  });

  await json(await post(server.origin, `/api/calendar/events/${encodeURIComponent(first)}/run`, { action: 'start' }));
  const blocked = await post(server.origin, `/api/calendar/events/${encodeURIComponent(second)}/run`, { action: 'start' });
  assert.equal(blocked.status, 409);
  assert.match((await blocked.json()).error, /concurrent agent run limit/);
});

test('an unknown run action is rejected with a helpful message', async t => {
  const server = await startServer();
  t.after(() => server.child.kill());
  const id = await createEvent(server.origin, {
    title: 'Whatever',
    start: '2026-07-28T15:00:00',
    end: '2026-07-28T16:00:00',
  });
  const response = await post(server.origin, `/api/calendar/events/${encodeURIComponent(id)}/run`, { action: 'explode' });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /action must be one of/);
});

test('scheduling preferences round-trip and drive the suggestion endpoint', async t => {
  const server = await startServer();
  t.after(() => server.child.kill());

  const saved = await json(await fetch(`${server.origin}/api/calendar/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      preferences: {
        workdayStart: '10:00',
        workdayEnd: '16:00',
        deepWorkWindows: [{ start: '10:00', end: '12:00' }],
        lunch: { start: '12:30', durationMinutes: 30 },
      },
    }),
  }));
  assert.equal(saved.preferences.workdayStart, '10:00');

  const reread = await json(await fetch(`${server.origin}/api/calendar/preferences`));
  assert.equal(reread.preferences.workdayEnd, '16:00');

  const suggestion = await json(await post(server.origin, '/api/calendar/schedule/suggest', {
    request: { durationMinutes: 60, priority: 'high', energy: 'high' },
    limit: 3,
  }));
  assert.ok(suggestion.slots.length > 0);
  suggestion.slots.forEach(slot => {
    const start = new Date(slot.start);
    assert.ok(start.getUTCHours() >= 10 && start.getUTCHours() < 16, 'suggestions stay inside the declared working day');
    assert.ok('urgency' in slot.breakdown, 'every suggestion explains its score');
  });
});

test('a natural-language request previews a plan and only writes it on commit', async t => {
  const server = await startServer();
  t.after(() => server.child.kill());

  const plan = await json(await post(server.origin, '/api/calendar/schedule/plan', {
    text: 'Have Codex work on Flashcards tomorrow for 90 minutes, then have Guardian review the result',
  }));
  assert.equal(plan.request.agent, 'codex');
  assert.equal(plan.blocks.length, 2);
  assert.equal(plan.blocks[0].meta.agentId, 'codex');
  assert.equal(plan.blocks[1].meta.agentId, 'guardian');
  assert.ok(new Date(plan.blocks[1].start) >= new Date(plan.blocks[0].end), 'the review follows the run it reviews');

  // Previewing writes nothing.
  const before = await json(await fetch(`${server.origin}/api/calendar/events`));
  assert.equal(before.events.length, 0);

  const committed = await json(await post(server.origin, '/api/calendar/schedule/commit', { blocks: plan.blocks }));
  assert.equal(committed.created.length, 2);

  const after = await json(await fetch(`${server.origin}/api/calendar/events`));
  assert.equal(after.events.length, 2);
  const codexBlock = after.events.find(event => event.meta && event.meta.agentId === 'codex');
  assert.ok(codexBlock, 'the committed block keeps its agent metadata');
  assert.equal(codexBlock.meta.runStatus, 'scheduled');
});

test('committing nothing is rejected rather than silently succeeding', async t => {
  const server = await startServer();
  t.after(() => server.child.kill());
  const response = await post(server.origin, '/api/calendar/schedule/commit', { blocks: [] });
  assert.equal(response.status, 400);
});

test('a completed run leaves a summary in the agent\'s memory', async t => {
  const passphrase = 'calendar-api-test-passphrase';
  const server = await startServer({ passphrase });
  t.after(() => server.child.kill());

  const session = await post(server.origin, '/api/session', { passphrase });
  assert.equal(session.ok, true);
  const cookie = session.headers.get('set-cookie').split(';')[0];
  const authed = (pathname, body) => fetch(`${server.origin}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });

  const created = await json(await authed('/api/calendar/events', {
    title: 'Flashcards repo review',
    start: '2026-07-28T15:00:00',
    end: '2026-07-28T16:30:00',
    meta: { agentId: 'codex', projectId: 'flashcards', executionMode: 'agent-run' },
  }));
  const runPath = `/api/calendar/events/${encodeURIComponent(created.id)}/run`;
  await json(await authed(runPath, { action: 'start' }));
  await json(await authed(runPath, {
    action: 'complete',
    summary: '3 findings',
    resultUrl: 'https://example.com/pr/1',
  }));

  const memories = await json(await fetch(`${server.origin}/api/memories`, { headers: { Cookie: cookie } }));
  const recorded = memories.find(item => item.agent === 'codex' && /Completed/.test(item.content));
  assert.ok(recorded, 'a completed run leaves a trace in agent memory');
  assert.match(recorded.content, /https:\/\/example\.com\/pr\/1/);
  assert.match(recorded.content, /flashcards/);
});
