'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const DIST = path.join(__dirname, '..', 'agent-office-deploy', 'dist');
const html = fs.readFileSync(path.join(DIST, 'character-demo.html'), 'utf8');
const script = fs.readFileSync(path.join(DIST, 'character-demo.js'), 'utf8');
const shared = fs.readFileSync(path.join(DIST, 'app-shared.js'), 'utf8');
const index = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
// The cast and the compositor moved here so the live office can draw the same
// characters the studio approves.
const avatars = fs.readFileSync(path.join(DIST, 'agent-avatars.js'), 'utf8');

// The ids the live office actually renders, read off AGENTS rather than
// hand-copied, so this fails if the roster and the character art diverge.
function liveAgentIds() {
  const block = shared.slice(shared.indexOf('const AGENTS = ['), shared.indexOf('\n];'));
  return [...block.matchAll(/^\s+id: '([a-z0-9]+)',$/gm)].map((match) => match[1]);
}

function rosterIds() {
  const block = avatars.slice(avatars.indexOf('const ROSTER = ['), avatars.indexOf('\n  ];'));
  return [...block.matchAll(/id: '([a-z0-9]+)'/g)].map((match) => match[1]);
}

function rosterDefaults() {
  const block = avatars.slice(avatars.indexOf('const ROSTER = ['), avatars.indexOf('\n  ];'));
  return [...block.matchAll(/defaults: \{([^}]+)\}/g)].map((match) => Object.fromEntries(
    match[1].split(',').map((pair) => pair.split(':').map((part) => part.trim().replace(/'/g, ''))).filter((pair) => pair.length === 2)
  ));
}

test('avatar studio composites the approved detailed sprite assets', () => {
  assert.match(avatars, /const ASSET_ROOT = 'assets\/character-demo\/'/);
  for (const sprite of ['penny.png', 'webclaw.png', 'nutrimind.png', 'pc.png', 'studioclaw.png']) {
    assert.match(avatars, new RegExp(sprite.replace('.', '\\.')));
    assert.ok(fs.existsSync(path.join(DIST, 'assets', 'character-demo', sprite)), `${sprite} is missing`);
  }
  assert.match(avatars, /OUTFIT_SPRITES/);
  assert.match(avatars, /HAIR_SPRITES/);
  assert.match(avatars, /drawImage\(spriteImages/);
  // No going back to the blockier procedural renderer this replaced.
  assert.doesNotMatch(avatars, /canvas\.width\s*\/\s*32/);
  assert.doesNotMatch(script, /canvas\.width\s*\/\s*32/);
});

test('every agent the office renders has a character of their own', () => {
  assert.deepStrictEqual(rosterIds(), liveAgentIds());
});

test('the redesign invents no agents and drops none', () => {
  // These come from the reference image only; "Nightwave Audio" is a real
  // roster member and must not be confused with the image's "Nightwave".
  for (const invented of ['RankForge', 'EarthWatch', 'Flashcards', 'CodeSmith', 'VaultKeeper', 'Music Curator', 'Market Analyst', 'SEO Specialist']) {
    assert.doesNotMatch(avatars, new RegExp(invented, 'i'), `${invented} is not a real agent`);
  }
  assert.ok(rosterIds().includes('nightwaveaudio'));
});

test('each agent stands on a tile of their own', () => {
  const block = avatars.slice(avatars.indexOf('const ROSTER = ['), avatars.indexOf('\n  ];'));
  const tiles = [...block.matchAll(/station: \{ gx: (\d+), gy: (\d+) \}/g)].map((m) => `${m[1]},${m[2]}`);
  assert.strictEqual(tiles.length, rosterIds().length, 'every agent needs a station');
  assert.strictEqual(new Set(tiles).size, tiles.length, 'two agents share a tile');
});

test('each agent is visually distinguishable', () => {
  const looks = rosterDefaults();
  assert.strictEqual(looks.length, rosterIds().length);
  for (const trait of ['face', 'skin', 'hair', 'hairColor', 'outfit', 'outfitColor', 'accessory']) {
    assert.ok(looks.every((look) => look[trait] !== undefined), `every agent needs a ${trait}`);
  }
  const signatures = looks.map((look) => `${look.outfit}/${look.outfitColor}/${look.accessory}`);
  assert.strictEqual(new Set(signatures).size, signatures.length, 'two agents wear the same look');
});

test('avatar studio and the live office share one renderer', () => {
  assert.match(script, /window\.AgentAvatars/);
  assert.match(html, /<script src="agent-avatars\.js/);
  // Neither page may keep a private copy of the art, or the approved design and
  // the shipped design can drift apart.
  assert.doesNotMatch(script, /function drawAvatar\s*\(/);
  assert.doesNotMatch(shared, /function drawAvatar\s*\(/);
});

test('avatar studio exposes mix-and-match appearance controls', () => {
  for (const trait of ['face', 'skin', 'hair', 'hairColor', 'outfit', 'outfitColor', 'accessory']) {
    assert.match(avatars, new RegExp(`\\b${trait}\\b`));
  }
  assert.match(html, /Choose an agent/);
  assert.match(html, /Character editor/);
  assert.match(html, /Save &amp; apply to office/);
});

test('the live office keeps its current sprites until the redesign is approved', () => {
  assert.match(shared, /const STUDIO_AVATARS = false;/);
  assert.match(shared, /HABBO_SPRITES\[spriteKey\]/);
});

test('avatar drafts stay browser-local and apply to the live office renderer', () => {
  assert.match(script, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(script, /localStorage\.setItem\(STUDIO_ENABLED_KEY, '1'\)/);
  assert.match(shared, /agent-office-avatar-drafts-v2/);
  assert.match(shared, /savedAvatarDraft\(agentId\)/);
  assert.match(html, /Saved appearances apply to this browser's office/i);
  assert.doesNotMatch(script, /fetch\([^)]*\/api\/agents[^)]*,\s*\{[^}]*method:\s*['"](?:POST|PUT|PATCH)/is);
});

test('the office exposes and deep-links the avatar studio', () => {
  assert.match(index, /href="\/character-demo\.html"[^>]*>Avatar Studio</);
  assert.match(index, />🎨 Appearance<\/a>/);
  assert.match(shared, /\/character-demo\.html\?agent=/);
  assert.match(script, /URLSearchParams\(window\.location\.search\)\.get\('agent'\)/);
});
