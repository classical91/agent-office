'use strict';

// YouTube Claw's packaging command. Two things are worth pinning down here.
//
// The first is that the committed fixtures still match what the command
// generates -- the command is deterministic for a given input plus --now, so
// any drift is a real behaviour change and should show up as a failing test
// rather than as a surprise in someone's next package.
//
// The second is the playbook dependency. The review checklist lives in exactly
// one place, YOUTUBE_PACKAGING.md, and is read at runtime. That is only worth
// anything if a missing or checklist-less playbook is a hard failure, so those
// are asserted directly instead of trusted.

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..');
const PLAYBOOK = path.join(REPO_ROOT, 'YOUTUBE_PACKAGING.md');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'package-youtube.mjs');
const FIXTURES = path.join(REPO_ROOT, 'fixtures', 'youtube-packaging');

const loadPlaybookModule = () =>
  import(pathToFileURL(path.join(REPO_ROOT, 'scripts', 'lib', 'playbook.mjs')).href);

// Same arguments as `npm run package:youtube:smoke`. Pinned --now so the
// generated package is byte-comparable against the committed fixture.
const SMOKE_ARGS = [
  SCRIPT,
  '--input', path.join(FIXTURES, 'sample-input.json'),
  '--now', '2026-08-05T00:00:00.000Z',
  '--out', path.join(FIXTURES, 'sample-output.md'),
  '--out-json', path.join(FIXTURES, 'sample-output.json'),
  '--check'
];

test('committed fixtures match freshly generated output', () => {
  const output = execFileSync(process.execPath, SMOKE_ARGS, {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  assert.match(output, /^ok\s+fixtures\/youtube-packaging\/sample-output\.md /m);
  assert.match(output, /^ok\s+fixtures\/youtube-packaging\/sample-output\.json /m);
  assert.doesNotMatch(output, /^FAIL/m);
});

test('--check reports drift instead of silently rewriting the fixture', () => {
  const target = path.join(FIXTURES, 'sample-output.md');
  const original = fs.readFileSync(target);

  fs.writeFileSync(target, original.toString('utf8').replace(/^# /, '# drifted '));
  try {
    assert.throws(
      () => execFileSync(process.execPath, SMOKE_ARGS, { cwd: REPO_ROOT, encoding: 'utf8' }),
      error => {
        assert.equal(error.status, 1);
        assert.match(error.stdout, /^FAIL\s+fixtures\/youtube-packaging\/sample-output\.md /m);
        return true;
      }
    );
  } finally {
    fs.writeFileSync(target, original);
  }

  // The failing run must not have touched the fixture on its way out.
  assert.deepEqual(fs.readFileSync(target), original);
});

test('the playbook is read at runtime, not baked into the code', async () => {
  const { loadPlaybook, PLAYBOOK_FILENAME } = await loadPlaybookModule();
  assert.equal(PLAYBOOK_FILENAME, 'YOUTUBE_PACKAGING.md');

  const playbook = await loadPlaybook(REPO_ROOT);
  assert.ok(playbook.checklist.length > 0, 'expected checklist groups');
  assert.ok(playbook.itemCount > 0, 'expected checklist items');
  assert.match(playbook.sha256, /^[0-9a-f]{12}$/);

  // Every group carries at least one item, and no item is an empty string.
  for (const group of playbook.checklist) {
    assert.ok(group.name, 'checklist group is missing a name');
    assert.ok(group.items.length > 0, `checklist group "${group.name}" has no items`);
    for (const item of group.items) assert.ok(item.trim(), 'empty checklist item');
  }

  // The stamp tracks content: change the playbook, change the hash.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-playbook-'));
  try {
    const edited = fs.readFileSync(PLAYBOOK, 'utf8') + '\nA trailing change.\n';
    fs.writeFileSync(path.join(scratch, 'YOUTUBE_PACKAGING.md'), edited);
    const restamped = await loadPlaybook(scratch);
    assert.notEqual(restamped.sha256, playbook.sha256);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('a missing or checklist-less playbook fails instead of packaging', async () => {
  const { loadPlaybook } = await loadPlaybookModule();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-playbook-'));

  try {
    await assert.rejects(
      async () => loadPlaybook(scratch),
      /YOUTUBE_PACKAGING\.md not found/
    );

    // Present but with nothing to review against is just as unusable.
    fs.writeFileSync(
      path.join(scratch, 'YOUTUBE_PACKAGING.md'),
      '# YOUTUBE_PACKAGING.md\n\n## 1. When this playbook applies\n\nNo checklist here.\n'
    );
    await assert.rejects(
      async () => loadPlaybook(scratch),
      /no "## Review checklist" items found/
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
