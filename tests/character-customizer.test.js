'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const DIST = path.join(__dirname, '..', 'agent-office-deploy', 'dist');
const html = fs.readFileSync(path.join(DIST, 'character-demo.html'), 'utf8');
const script = fs.readFileSync(path.join(DIST, 'character-demo.js'), 'utf8');

test('avatar studio keeps the approved five-agent roster', () => {
  for (const id of ['oss', 'webclaw', 'nutrimind', 'pc', 'studioclaw']) {
    assert.match(script, new RegExp(`id:\\s*'${id}'`));
  }
  for (const inventedAgent of ['RankForge', 'EarthWatch', 'Flashcards', 'Nightwave', 'Market', 'CodeSmith', 'VaultKeeper']) {
    assert.doesNotMatch(script, new RegExp(inventedAgent, 'i'));
  }
});

test('avatar studio exposes mix-and-match appearance controls', () => {
  for (const trait of ['face', 'skin', 'hair', 'hairColor', 'outfit', 'outfitColor', 'accessory']) {
    assert.match(script, new RegExp(`\\b${trait}\\b`));
  }
  assert.match(html, /Choose an agent/);
  assert.match(html, /Character editor/);
  assert.match(html, /Save draft look/);
});

test('avatar drafts stay browser-local and do not alter the live roster', () => {
  assert.match(script, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(html, /live roster unchanged/i);
  assert.match(html, /live sprites are untouched/i);
  assert.doesNotMatch(script, /fetch\([^)]*\/api\/agents[^)]*,\s*\{[^}]*method:\s*['"](?:POST|PUT|PATCH)/is);
});

test('avatar studio composites the approved detailed sprite assets', () => {
  assert.match(script, /const ASSET_ROOT = 'assets\/character-demo\/'/);
  for (const sprite of ['penny.png', 'webclaw.png', 'nutrimind.png', 'pc.png', 'studioclaw.png']) {
    assert.match(script, new RegExp(sprite.replace('.', '\\.')));
  }
  assert.match(script, /OUTFIT_SPRITES/);
  assert.match(script, /HAIR_SPRITES/);
  assert.match(script, /drawImage\(spriteImages/);
  assert.doesNotMatch(script, /canvas\.width\s*\/\s*32/);
});
