'use strict';

// Which TLS policy the database connection gets, per host.
//
// The connection itself is never expected to succeed here - there is no
// database behind these URLs. What matters is the decision the server makes
// before it dials, which it announces on startup; outside production a failed
// connection falls back to file storage, so the process stays up long enough to
// read the line.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');

const TLS_LINE = /Dropbox storage TLS: (.+)/;
const READ_TIMEOUT_MS = 15000;

// Reads the TLS decision off the server's own startup output.
function readTlsMode(env) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-tls-test-'));
  const environment = {
    ...process.env,
    PORT: '0',
    APP_TIMEZONE: 'UTC',
    APP_SETTINGS_FILE: path.join(scratch, 'settings.json'),
    DROPS_FILE: path.join(scratch, 'drops.json'),
  };
  ['NODE_ENV', 'PGSSLMODE', 'PGSSLROOTCERT', 'PGSSL_ALLOW_SELF_SIGNED',
    'RAILWAY_ENVIRONMENT', 'RAILWAY_ENVIRONMENT_NAME', 'RAILWAY_PROJECT_ID', 'RAILWAY_SERVICE_ID']
    .forEach(key => delete environment[key]);
  Object.assign(environment, env);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER_PATH], {
      cwd: DIST,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    const finish = outcome => {
      clearTimeout(timer);
      child.kill();
      fs.rmSync(scratch, { recursive: true, force: true });
      outcome();
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error(`No TLS line within ${READ_TIMEOUT_MS}ms. Output:\n${output}`))),
      READ_TIMEOUT_MS
    );

    const onData = chunk => {
      output += chunk;
      const match = TLS_LINE.exec(output);
      if (match) finish(() => resolve(match[1].trim()));
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', error => finish(() => reject(error)));
  });
}

test('a Railway private host is encrypted but not verified', async () => {
  const mode = await readTlsMode({
    DATABASE_URL: 'postgresql://user:pw@postgres.railway.internal:5432/railway',
  });
  assert.match(mode, /^encrypted, unverified/);
  assert.match(mode, /private network/);
});

test('a public host is verified', async () => {
  // The case that matters: anything reachable from the open internet has to
  // prove who it is, which is exactly what rejectUnauthorized:false gave up.
  const mode = await readTlsMode({
    DATABASE_URL: 'postgresql://user:pw@db.example.com:5432/railway',
  });
  assert.equal(mode, 'verified');
});

test('a public host can still opt out, loudly and by name', async () => {
  const mode = await readTlsMode({
    DATABASE_URL: 'postgresql://user:pw@db.example.com:5432/railway',
    PGSSL_ALLOW_SELF_SIGNED: 'true',
  });
  assert.match(mode, /UNVERIFIED/);
  assert.match(mode, /PGSSL_ALLOW_SELF_SIGNED/);
});

test('a supplied CA is used to verify', async () => {
  const caFile = path.join(os.tmpdir(), `agent-office-test-ca-${process.pid}.pem`);
  fs.writeFileSync(caFile, '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----\n');
  try {
    const mode = await readTlsMode({
      DATABASE_URL: 'postgresql://user:pw@db.example.com:5432/railway',
      PGSSLROOTCERT: caFile,
    });
    assert.match(mode, /^verified against /);
  } finally {
    fs.rmSync(caFile, { force: true });
  }
});

test('loopback and PGSSLMODE=disable stay off', async () => {
  const loopback = await readTlsMode({
    DATABASE_URL: 'postgresql://user:pw@localhost:5432/railway',
  });
  assert.match(loopback, /^off/);

  const disabled = await readTlsMode({
    DATABASE_URL: 'postgresql://user:pw@db.example.com:5432/railway',
    PGSSLMODE: 'disable',
  });
  assert.match(disabled, /PGSSLMODE=disable/);
});
