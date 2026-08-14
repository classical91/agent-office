'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'agent-office-deploy', 'dist');
const shared = fs.readFileSync(path.join(DIST, 'app-shared.js'), 'utf8');
const configDir = path.join(DIST, 'config-files');

test('the Agent Office roster matches the current OpenClaw agents', () => {
  const block = shared.slice(shared.indexOf('const AGENTS = ['), shared.indexOf('\n];'));
  const ids = [...block.matchAll(/\bid:\s*'([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(ids, [
    'oss',
    'webclaw',
    'nutrimind',
    'pc',
    'traderclaw',
    'studioclaw',
    'nightwaveaudio',
    'youtubeclaw',
    'commentfarm',
    'newsreporter',
    'routercoder',
  ]);
  assert.match(block, /name:\s*'ShareBot67'/);
  assert.match(block, /name:\s*'RouterCoder'/);
  assert.match(block, /role:\s*'OpenRouter Coding Specialist'/);
  assert.match(block, /GPT-5\.5 OAuth route verified/);
  for (const obsoleteId of ['coder', 'xbot', 'farmbot', 'security']) {
    assert.doesNotMatch(block, new RegExp(`\\bid:\\s*['\"]${obsoleteId}['\"]`, 'i'));
  }
});

test('deploy artifacts contain no local OpenClaw config snapshots', () => {
  const entries = fs.readdirSync(configDir, { withFileTypes: true });
  assert.deepEqual(entries.map(entry => entry.name), ['README.md']);
});

test('tracked deploy text contains no Telegram bot token shapes', () => {
  const tokenPattern = /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/;
  const pending = [DIST];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(fullPath);
      else if (/\.(?:html|js|json|md|css)$/i.test(entry.name)) {
        assert.doesNotMatch(fs.readFileSync(fullPath, 'utf8'), tokenPattern, fullPath);
      }
    }
  }
});
