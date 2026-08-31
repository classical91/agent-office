'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');
const { redact, memoryItems, buildSnapshot } = require('../scripts/sync-openclaw-memories.js');

const DIST = path.join(__dirname, '..', 'agent-office-deploy', 'dist');
const TOKEN = 'memory-sync-token-long-enough';

test('memory snapshots keep useful bullets and redact credentials', async t => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-memory-source-'));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  fs.mkdirSync(path.join(workspace, 'memory'));
  fs.writeFileSync(path.join(workspace, 'MEMORY.md'), [
    '# Durable memory',
    '- Owns the bounded test workflow.',
    '- api_key=super-secret-value',
    '- Uses Bearer abcdefghijklmnop for a connector.',
  ].join('\n'));

  const snapshot = await buildSnapshot({ id: 'tester', workspace });
  assert.match(snapshot.content, /Owns the bounded test workflow/);
  assert.doesNotMatch(snapshot.content, /super-secret-value|abcdefghijklmnop/);
  assert.match(snapshot.content, /\[REDACTED\]/);
  assert.equal(snapshot.sourceFileCount, 1);
});

test('agents without files get a truthful missing-memory snapshot', async t => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-memory-empty-'));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const snapshot = await buildSnapshot({ id: 'empty', workspace });
  assert.match(snapshot.content, /No MEMORY\.md or memory\/\*\.md files/);
  assert.equal(snapshot.sourceFileCount, 0);
});

test('memory sync endpoint is token-gated and idempotently upserts per agent', async t => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-memory-sync-'));
  const buildEnv = port => {
    const env = {
      ...process.env,
      PORT: String(port),
      PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
      MEMORIES_FILE: path.join(scratch, 'memories.json'),
      DROPS_FILE: path.join(scratch, 'drops.json'),
      PROJECTS_FILE: path.join(scratch, 'projects.json'),
      AGENTS_FILE: path.join(scratch, 'agents.json'),
      GATEWAY_TOKEN: TOKEN,
    };
    delete env.DATABASE_URL;
    delete env.DROPS_PASSPHRASE;
    delete env.DROPS_PASSPHRASE_HASH;
    return env;
  };
  const server = await startTestServer({ serverPath: path.join(DIST, 'server.js'), cwd: DIST, buildEnv });
  t.after(() => { server.child.kill(); fs.rmSync(scratch, { recursive: true, force: true }); });

  const denied = await fetch(`${server.origin}/api/memories/sync`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memories: [] }),
  });
  assert.equal(denied.status, 401);

  const send = content => fetch(`${server.origin}/api/memories/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Gateway-Token': TOKEN },
    body: JSON.stringify({ memories: [{ agent: 'TraderClaw', content }] }),
  });
  assert.equal((await send('First safe snapshot')).status, 200);
  assert.equal((await send('Updated safe snapshot')).status, 200);

  const rows = JSON.parse(fs.readFileSync(path.join(scratch, 'memories.json'), 'utf8'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'openclaw-sync-traderclaw');
  assert.equal(rows[0].content, 'Updated safe snapshot');
});

test('bullet parser ignores prose and headings', () => {
  assert.deepEqual(memoryItems('# Heading\nProse\n- Keep this\n1. And this'), ['Keep this', 'And this']);
  assert.match(redact('token=abc123456789'), /\[REDACTED\]/);
});
