const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer, START_ATTEMPTS } = require('./helpers/test-server.js');

// A stand-in server whose behaviour the test controls: it reads a JSON control
// file and either exits immediately (what losing the port race looks like),
// starts but never answers, or serves normally.
const FAKE_SERVER = `
const fs = require('fs');
const http = require('http');
const control = JSON.parse(fs.readFileSync(process.env.CONTROL_FILE, 'utf8'));
control.starts = (control.starts || 0) + 1;
fs.writeFileSync(process.env.CONTROL_FILE, JSON.stringify(control));

if (control.starts <= (control.failFirst || 0)) {
  process.exit(1);
}
const server = http.createServer((req, res) => {
  if (control.neverAnswer) return;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end('{"ok":true}');
});
server.listen(Number(process.env.PORT), '127.0.0.1');
`;

function makeScratch(control) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-harness-'));
  const serverPath = path.join(dir, 'fake-server.js');
  const controlFile = path.join(dir, 'control.json');
  fs.writeFileSync(serverPath, FAKE_SERVER);
  fs.writeFileSync(controlFile, JSON.stringify(control));
  return { dir, serverPath, controlFile };
}

function buildEnvFor(controlFile) {
  return port => ({ ...process.env, PORT: String(port), CONTROL_FILE: controlFile });
}

function readControl(controlFile) {
  return JSON.parse(fs.readFileSync(controlFile, 'utf8'));
}

test('a server that exits immediately is retried on a fresh port', async t => {
  const { serverPath, controlFile } = makeScratch({ failFirst: 2 });
  const server = await startTestServer({
    serverPath,
    cwd: path.dirname(serverPath),
    buildEnv: buildEnvFor(controlFile),
    readyPath: '/',
  });
  t.after(() => server.child.kill());

  // Two attempts died on startup, the third came up: exactly the port-race
  // recovery this harness exists for.
  assert.equal(readControl(controlFile).starts, 3);
  assert.equal((await fetch(`${server.origin}/`)).ok, true);
});

test('a server that never recovers fails after the attempt budget, not forever', async () => {
  const { serverPath, controlFile } = makeScratch({ failFirst: 999 });
  await assert.rejects(
    startTestServer({
      serverPath,
      cwd: path.dirname(serverPath),
      buildEnv: buildEnvFor(controlFile),
      readyPath: '/',
    }),
    /exited with code 1/
  );
  assert.equal(readControl(controlFile).starts, START_ATTEMPTS);
});

test('a genuinely occupied port does not make the harness give up', async t => {
  // Hold a port open, then hand it to the first attempt. The child cannot bind
  // it and exits, and the retry has to find its own way through.
  const blocker = net.createServer();
  await new Promise(resolve => blocker.listen(0, '127.0.0.1', resolve));
  const blockedPort = blocker.address().port;
  t.after(() => blocker.close());

  const { serverPath, controlFile } = makeScratch({});
  let attempt = 0;
  const buildEnv = port => {
    attempt += 1;
    return {
      ...process.env,
      // The first attempt is pointed at the port that is already taken.
      PORT: String(attempt === 1 ? blockedPort : port),
      CONTROL_FILE: controlFile,
    };
  };

  // The first child exits on EADDRINUSE; the harness retries and succeeds.
  const server = await startTestServer({
    serverPath,
    cwd: path.dirname(serverPath),
    buildEnv,
    readyPath: '/',
  });
  t.after(() => server.child.kill());

  assert.ok(attempt >= 2, 'the harness retried after the port collision');
  assert.equal((await fetch(`${server.origin}/`)).ok, true);
});

test('an unresponsive server is reported immediately instead of being retried', async () => {
  const { serverPath, controlFile } = makeScratch({ neverAnswer: true });
  const started = Date.now();
  await assert.rejects(
    startTestServer({
      serverPath,
      cwd: path.dirname(serverPath),
      buildEnv: buildEnvFor(controlFile),
      readyPath: '/',
    }),
    /did not answer/
  );
  // One readiness budget, not four: a server that is up but mute is a real
  // failure, and retrying would only slow the suite down.
  assert.equal(readControl(controlFile).starts, 1);
  assert.ok(Date.now() - started < 40000);
});

// Keep the fake server honest: if it stopped resembling a real one, the tests
// above would pass for the wrong reason.
test('the fake server serves normally when the control file asks for nothing', async t => {
  const { serverPath, controlFile } = makeScratch({});
  const server = await startTestServer({
    serverPath,
    cwd: path.dirname(serverPath),
    buildEnv: buildEnvFor(controlFile),
    readyPath: '/',
  });
  t.after(() => server.child.kill());

  assert.equal(readControl(controlFile).starts, 1);
  const payload = await (await fetch(`${server.origin}/`)).json();
  assert.deepEqual(payload, { ok: true });
  assert.equal(typeof server.port, 'number');
  assert.ok(server.origin.startsWith('http://127.0.0.1:'));
});
