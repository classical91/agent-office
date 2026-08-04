'use strict';

// The gateway check. The whole point of moving it to the server is that the
// server can read the reply, so these tests are about the distinctions the old
// browser probe could not make: a real gateway vs. any other server on that
// port vs. nothing listening, and a machine reporting in from somewhere this
// server cannot reach.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

const PASSPHRASE = 'open-the-gateway';
const GATEWAY_TOKEN = 'gateway-token-long-enough';

async function startServer() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-gateway-'));

  const buildEnv = port => {
    const environment = {
      ...process.env,
      PORT: String(port),
      PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
      APP_TIMEZONE: 'UTC',
      APP_SETTINGS_FILE: path.join(scratch, 'settings.json'),
      CALENDAR_EVENTS_FILE: path.join(scratch, 'calendar-events.json'),
      AGENTS_FILE: path.join(scratch, 'agents.json'),
      MEMORIES_FILE: path.join(scratch, 'memories.json'),
      DROPS_FILE: path.join(scratch, 'drops.json'),
      PROJECTS_FILE: path.join(scratch, 'projects.json'),
      STREAKS_FILE: path.join(scratch, 'streaks.json'),
      STREAK_DAYS_FILE: path.join(scratch, 'streak-days.json'),
      VISITS_FILE: path.join(scratch, 'visits.json'),
      DROPS_PASSPHRASE: PASSPHRASE,
      GATEWAY_TOKEN,
    };
    ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DROPS_PASSPHRASE_HASH', 'SHORTCUTS_TOKEN']
      .forEach(key => { delete environment[key]; });
    return environment;
  };

  const server = await startTestServer({ serverPath: SERVER_PATH, cwd: DIST, buildEnv });
  const response = await fetch(`${server.origin}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: PASSPHRASE }),
  });
  const cookie = response.headers.get('set-cookie').split(';')[0];
  return { ...server, scratch, cookie };
}

function stop(server) {
  server.child.kill();
  fs.rmSync(server.scratch, { recursive: true, force: true });
}

// A stand-in for whatever is on the port: `routes` maps a path to a handler,
// and anything else 404s, exactly as a real server would.
function startFakeService(routes) {
  return new Promise(resolve => {
    const service = http.createServer((req, res) => {
      const handler = routes[req.url.split('?')[0]];
      if (!handler) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      handler(res);
    });
    service.listen(0, '127.0.0.1', () => {
      const { port } = service.address();
      resolve({ service, url: `http://127.0.0.1:${port}` });
    });
  });
}

const json = payload => res => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

async function status(server, url) {
  const query = url ? `?url=${encodeURIComponent(url)}` : '';
  const response = await fetch(`${server.origin}/api/gateway/status${query}`, {
    headers: { cookie: server.cookie },
  });
  assert.equal(response.status, 200);
  return response.json();
}

test('a real gateway is up, and its agents come back', async () => {
  const server = await startServer();
  const fake = await startFakeService({
    '/health': json({ ok: true }),
    '/api/agents': json([
      { id: 'oss', name: 'OSS', role: 'Coding Agent', status: 'running', model: 'GPT-5' },
      { id: 'webclaw', name: 'WebClaw', status: 'idle' },
    ]),
  });

  try {
    const payload = await status(server, fake.url);
    assert.equal(payload.alive, true);
    assert.equal(payload.source, 'probe');
    assert.equal(payload.agents_source, 'probe');
    assert.equal(payload.probe.agents_endpoint, '/api/agents');
    assert.deepEqual(payload.agents.map(agent => agent.id), ['oss', 'webclaw']);
    assert.equal(payload.agents[0].status, 'running');
    // A gateway that did not say is reported as unknown, not quietly as idle.
    assert.equal(payload.agents[1].status, 'idle');
    assert.equal(payload.agents[1].role, '');
  } finally {
    fake.service.close();
    stop(server);
  }
});

test('nothing listening is reported as not running', async () => {
  const server = await startServer();
  const fake = await startFakeService({});
  const deadUrl = fake.url;
  await new Promise(resolve => fake.service.close(resolve));

  try {
    const payload = await status(server, deadUrl);
    assert.equal(payload.alive, false);
    assert.equal(payload.source, 'none');
    assert.equal(payload.probe.reachable, false);
    assert.match(payload.probe.error, /Nothing is listening/);
    assert.deepEqual(payload.agents, []);
  } finally {
    stop(server);
  }
});

// The bug this whole change exists for: the browser's no-cors probe called any
// answer a live gateway, so pointing it at this app's own port showed green.
test('another server on the port is reachable but is not a gateway with agents', async () => {
  const server = await startServer();
  const impostor = await startFakeService({
    '/': res => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body>some other app</body></html>');
    },
  });

  try {
    const payload = await status(server, impostor.url);
    assert.equal(payload.probe.reachable, true, 'something did answer');
    assert.deepEqual(payload.agents, [], 'but it never claimed to have agents');
    assert.equal(payload.agents_source, '');

    // The health paths 404 and only "/" answers, which is what the endpoint
    // report has to show for this to be diagnosable rather than mysterious.
    const health = payload.probe.endpoints.find(endpoint => endpoint.path === '/health');
    const root = payload.probe.endpoints.find(endpoint => endpoint.path === '/');
    assert.equal(health.status, 404);
    assert.equal(root.status, 200);
    assert.equal(root.shape, 'html');
  } finally {
    impostor.service.close();
    stop(server);
  }
});

test('a heartbeat keeps a gateway the server cannot reach reported as up', async () => {
  const server = await startServer();
  const fake = await startFakeService({});
  const unreachable = fake.url;
  await new Promise(resolve => fake.service.close(resolve));

  try {
    const before = await status(server, unreachable);
    assert.equal(before.alive, false, 'nothing to probe and nothing has reported in');
    assert.equal(before.heartbeat.configured, true);
    assert.equal(before.heartbeat.received, false);

    const beat = await fetch(`${server.origin}/api/gateway/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Gateway-Token': GATEWAY_TOKEN },
      body: JSON.stringify({
        host: 'jason-desktop',
        agents: [{ id: 'studioclaw', name: 'StudioClaw', status: 'running' }],
      }),
    });
    assert.equal(beat.status, 200);

    const after = await status(server, unreachable);
    assert.equal(after.alive, true);
    assert.equal(after.source, 'heartbeat', 'the probe still fails; the beat is what makes it up');
    assert.equal(after.heartbeat.host, 'jason-desktop');
    assert.equal(after.heartbeat.fresh, true);
    assert.equal(after.agents_source, 'heartbeat');
    assert.deepEqual(after.agents.map(agent => agent.id), ['studioclaw']);
  } finally {
    stop(server);
  }
});

test('a live probe wins over a heartbeat', async () => {
  const server = await startServer();
  const fake = await startFakeService({ '/health': json({ ok: true }) });

  try {
    await fetch(`${server.origin}/api/gateway/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Gateway-Token': GATEWAY_TOKEN },
      body: JSON.stringify({ host: 'elsewhere', agents: [] }),
    });

    const payload = await status(server, fake.url);
    assert.equal(payload.alive, true);
    assert.equal(payload.source, 'probe', 'reached just now beats reported recently');
  } finally {
    fake.service.close();
    stop(server);
  }
});

test('the heartbeat needs the token, and the status needs the passphrase', async () => {
  const server = await startServer();
  try {
    const noToken = await fetch(`${server.origin}/api/gateway/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: 'stranger' }),
    });
    assert.equal(noToken.status, 401);

    const wrongToken = await fetch(`${server.origin}/api/gateway/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Gateway-Token': 'not-the-token' },
      body: JSON.stringify({ host: 'stranger' }),
    });
    assert.equal(wrongToken.status, 401);

    const locked = await fetch(`${server.origin}/api/gateway/status`);
    assert.equal(locked.status, 401);

    // A rejected beat must not have registered as one.
    const payload = await status(server);
    assert.equal(payload.heartbeat.received, false);
  } finally {
    stop(server);
  }
});

test('a URL that is not http is refused rather than fetched', async () => {
  const server = await startServer();
  try {
    for (const bad of ['file:///etc/passwd', 'ftp://example.com', 'javascript:alert(1)']) {
      const payload = await status(server, bad);
      assert.equal(payload.probe.attempted, false, `${bad} was fetched`);
      assert.equal(payload.alive, false);
      assert.match(payload.probe.error, /not an http/);
      // It must not quietly answer about the default address instead.
      assert.equal(payload.probe.url, '');
      assert.deepEqual(payload.probe.endpoints, []);
    }
  } finally {
    stop(server);
  }
});

// The reason the scheme check cannot simply reject every colon.
test('a bare host:port is still accepted and probed', async () => {
  const server = await startServer();
  const fake = await startFakeService({ '/health': json({ ok: true }) });

  try {
    const hostPort = fake.url.replace('http://', '');
    const payload = await status(server, hostPort);
    assert.equal(payload.probe.attempted, true);
    assert.equal(payload.alive, true);
    assert.equal(payload.probe.url, fake.url);
  } finally {
    fake.service.close();
    stop(server);
  }
});
