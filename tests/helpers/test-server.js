'use strict';

// Shared harness for the tests that boot a real server.
//
// Picking a port by binding to :0 and closing the socket is a time-of-check /
// time-of-use race: nothing stops another process taking the port between the
// close and the spawn. `node --test` runs the test files in parallel and this
// suite starts a dozen-plus servers, so the race is small but real - it showed
// up as a single unexplained failure in an otherwise green suite.
//
// The fix is not a bigger sleep. When the child exits immediately (which is
// what losing the race looks like) we pick a new port and try again; a server
// that starts but never answers is a genuine failure and is reported straight
// away.

const { spawn } = require('node:child_process');
const net = require('node:net');

const READY_TIMEOUT_MS = 20000;
const POLL_INTERVAL_MS = 100;
const POLL_REQUEST_TIMEOUT_MS = 2000;
const START_ATTEMPTS = 4;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function waitForReady(child, origin, readyPath) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    // An exit code means the process is gone - almost always because the port
    // was taken between getFreePort() and spawn().
    if (child.exitCode !== null) return { ready: false, exitCode: child.exitCode };
    try {
      // Without a per-request timeout a server that accepts the connection and
      // then says nothing leaves fetch pending forever, and the deadline below
      // is never reached.
      const response = await fetch(`${origin}${readyPath}`, {
        signal: AbortSignal.timeout(Math.min(POLL_REQUEST_TIMEOUT_MS, Math.max(1, deadline - Date.now()))),
      });
      if (response.ok) return { ready: true };
    } catch {}
    await sleep(POLL_INTERVAL_MS);
  }
  return { ready: false, exitCode: null };
}

/**
 * Boot a server and wait until it answers.
 *
 * @param {object} options
 * @param {string} options.serverPath   Path to the server entrypoint.
 * @param {string} options.cwd          Working directory for the child.
 * @param {(port: number) => object} options.buildEnv
 *        Called per attempt so each retry gets its own port in the environment.
 * @param {string} [options.readyPath]  Endpoint polled until it returns 2xx.
 * @returns {Promise<{child: import('node:child_process').ChildProcess, origin: string, port: number}>}
 */
async function startTestServer(options) {
  const readyPath = options.readyPath || '/api/calendar/status';
  let lastError = null;

  for (let attempt = 1; attempt <= START_ATTEMPTS; attempt += 1) {
    const port = await getFreePort();
    const origin = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, [options.serverPath], {
      cwd: options.cwd,
      env: options.buildEnv(port),
      stdio: 'ignore',
      windowsHide: true,
    });

    const result = await waitForReady(child, origin, readyPath);
    if (result.ready) return { child, origin, port };

    child.kill();
    if (result.exitCode === null) {
      // It started and stayed up but never answered: retrying a different port
      // will not help, and a slow retry loop would only hide the problem.
      throw new Error(
        `Test server on port ${port} did not answer ${readyPath} within ${READY_TIMEOUT_MS}ms.`
      );
    }
    lastError = new Error(
      `Test server exited with code ${result.exitCode} on port ${port} (attempt ${attempt}/${START_ATTEMPTS}).`
    );
  }

  throw lastError;
}

module.exports = { startTestServer, getFreePort, READY_TIMEOUT_MS, START_ATTEMPTS };
