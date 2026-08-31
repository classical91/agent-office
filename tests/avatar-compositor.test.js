'use strict';

// What the character editor actually draws.
//
// The compositor builds every character by pasting Penny's head onto an outfit
// sprite's body and then drawing hair, an expression and an accessory over it.
// Each of those layers had its own idea of where the head was: the five source
// sprites are not registered to one another, so borrowed hair landed across the
// eyes, the far eye's brow and sclera were drawn seven columns wide of the eye,
// and the earpiece and the headset's second cup were drawn out past x45 — off
// the head entirely, as loose blocks floating beside the character.
//
// Reading the code cannot catch that class of bug; only the pixels can. These
// tests render the real compositor in a browser and measure what came out
// against Penny's own silhouette, read from the asset file.
//
// Requires a Chromium, the same way tests/ui-smoke.test.js does.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, before, after } = require('node:test');

const { startTestServer } = require('./helpers/test-server.js');

const DIST = path.join(path.resolve(__dirname, '..'), 'agent-office-deploy', 'dist');
const SERVER_PATH = path.join(DIST, 'server.js');
const avatars = fs.readFileSync(path.join(DIST, 'agent-avatars.js'), 'utf8');
const PASSPHRASE = 'compositor-passphrase';

let chromium = null;
try {
  ({ chromium } = require('playwright-core'));
} catch { /* reported as a skip below */ }

let server = null;
let browser = null;
let page = null;
let scratch = null;
let skipReason = null;

function startServer() {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-office-compositor-'));
  const buildEnv = port => {
    const environment = {
      ...process.env,
      PORT: String(port),
      APP_TIMEZONE: 'UTC',
      DROPS_PASSPHRASE: PASSPHRASE,
      APP_SETTINGS_FILE: path.join(scratch, 'settings.json'),
      CALENDAR_EVENTS_FILE: path.join(scratch, 'calendar-events.json'),
      AGENTS_FILE: path.join(scratch, 'agents.json'),
      MEMORIES_FILE: path.join(scratch, 'memories.json'),
      DROPS_FILE: path.join(scratch, 'drops.json'),
      PROJECTS_FILE: path.join(scratch, 'projects.json'),
      STREAKS_FILE: path.join(scratch, 'streaks.json'),
      STREAK_DAYS_FILE: path.join(scratch, 'streak-days.json'),
      VISITS_FILE: path.join(scratch, 'visits.json'),
    };
    ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'].forEach(key => { delete environment[key]; });
    return environment;
  };
  return startTestServer({ serverPath: SERVER_PATH, cwd: DIST, buildEnv });
}

before(async () => {
  if (!chromium) {
    skipReason = 'playwright-core is not installed (run `npm install`)';
  } else {
    try {
      browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM_PATH || undefined });
    } catch (error) {
      skipReason = `no Chromium available: ${error.message.split('\n')[0]}`;
    }
  }
  if (skipReason && process.env.CI) throw new Error(`compositor tests cannot run in CI: ${skipReason}`);
  if (skipReason) return;

  server = await startServer();
  const context = await browser.newContext();
  await context.route('**/*', route => (
    new URL(route.request().url()).origin === server.origin ? route.continue() : route.abort()
  ));
  await context.request.post(`${server.origin}/api/session`, { data: { passphrase: PASSPHRASE } });
  page = await context.newPage();
  await page.goto(`${server.origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.agent-char', { state: 'attached' });
  await page.evaluate(() => window.AgentAvatars.ready());

  // One helper installed in the page: composite a look and hand back the pixels,
  // plus Penny's own silhouette read from the asset the compositor uses.
  await page.evaluate(async () => {
    const A = window.AgentAvatars;
    await A.ready();
    const canvas = document.createElement('canvas');
    canvas.width = A.SPRITE_W;
    canvas.height = A.SPRITE_H;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    const penny = await new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.src = 'assets/character-demo/penny.png';
    });
    const reference = document.createElement('canvas');
    reference.width = A.SPRITE_W;
    reference.height = A.SPRITE_H;
    const refContext = reference.getContext('2d', { willReadFrequently: true });
    refContext.imageSmoothingEnabled = false;
    refContext.drawImage(penny, 0, 0);
    const refData = refContext.getImageData(0, 0, A.SPRITE_W, A.SPRITE_H).data;

    window.__headSpans = [];
    for (let y = 0; y < A.SPRITE_H; y += 1) {
      let min = -1; let max = -1;
      for (let x = 0; x < A.SPRITE_W; x += 1) {
        if (refData[(y * A.SPRITE_W + x) * 4 + 3] > 20) { if (min < 0) min = x; max = x; }
      }
      window.__headSpans[y] = min < 0 ? null : [min, max];
    }

    window.__render = (look) => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, A.SPRITE_W, A.SPRITE_H);
      A.drawAvatar(canvas, look);
      const data = context.getImageData(0, 0, A.SPRITE_W, A.SPRITE_H).data;
      const out = [];
      for (let y = 0; y < A.SPRITE_H; y += 1) {
        for (let x = 0; x < A.SPRITE_W; x += 1) {
          const i = (y * A.SPRITE_W + x) * 4;
          if (data[i + 3] > 20) out.push({ x, y, r: data[i], g: data[i + 1], b: data[i + 2] });
        }
      }
      return out;
    };
  });
});

after(async () => {
  await browser?.close();
  server?.child.kill();
  if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
});

const BASE = {
  face: 'friendly', skin: '#dca276', hair: 'bald', hairColor: '#704127',
  outfit: 'lead', outfitColor: '#172554', accessory: 'none',
};

const render = look => page.evaluate(l => window.__render(l), look);
const headSpans = () => page.evaluate(() => window.__headSpans);

// The chin. Below it the shoulders start and the body sprite takes over, so
// containment against the head only means anything above this row.
const CHIN = 36;

test('nothing an accessory draws lands off the head', async t => {
  if (skipReason) return t.skip(skipReason);

  const spans = await headSpans();
  for (const accessory of ['none', 'glasses', 'headset', 'earpiece']) {
    const pixels = await render({ ...BASE, accessory });
    const strays = pixels.filter(({ x, y }) => {
      if (y > CHIN) return false;
      const span = spans[y];
      // A row the head does not reach at all must stay empty; on a row it does
      // reach, one column of overhang is the outline and no more.
      if (!span) return true;
      return x < span[0] - 1 || x > span[1] + 1;
    });
    assert.deepEqual(
      strays.map(({ x, y }) => `${x},${y}`),
      [],
      `the ${accessory} draws ${strays.length} pixel(s) beside the head instead of on it`
    );
  }
});

test('every expression puts its features on the eyes the head actually has', async t => {
  if (skipReason) return t.skip(skipReason);

  // Measured from penny.png: the far eye's white, and the near eye's.
  const FAR = { x0: 29, x1: 34, y0: 23, y1: 28 };
  const isWhite = ({ r, g, b }) => r > 220 && g > 220 && b > 210;

  const bright = await render({ ...BASE, face: 'bright' });
  const whites = bright.filter(isWhite);
  assert.ok(
    whites.some(p => p.x >= FAR.x0 && p.x <= FAR.x1 && p.y >= FAR.y0 && p.y <= FAR.y1),
    'Bright draws no white in the far eye'
  );
  // The temple. The far eye's sclera used to be painted here, seven columns
  // short of the eye, as a block on the side of the head.
  assert.deepEqual(
    whites.filter(p => p.x >= 20 && p.x <= 27 && p.y >= 20 && p.y <= 30).map(p => `${p.x},${p.y}`),
    [],
    'Bright is still painting an eye on the temple'
  );

  // And it must read as an eye rather than a white slab dropped on the socket.
  // An eye has a pupil inside its white; the block this used to draw did not,
  // beyond the single square sitting on top of it.
  const socket = p => p.x >= FAR.x0 - 1 && p.x <= FAR.x1 + 1 && p.y >= FAR.y0 - 1 && p.y <= FAR.y1 + 1;
  const farWhites = whites.filter(socket);
  const socketArea = (FAR.x1 - FAR.x0 + 3) * (FAR.y1 - FAR.y0 + 3);
  assert.ok(
    farWhites.length < socketArea * 0.6,
    `the far eye is ${farWhites.length} white pixels in a ${socketArea}-pixel socket — a slab, not an eye`
  );
  const pupil = bright.filter(p => socket(p) && p.r < 60 && p.g < 60 && p.b < 70);
  assert.ok(pupil.length >= 4, 'the far eye has no pupil in it');
  const whiteRows = new Set(farWhites.map(p => p.y));
  const pupilRows = new Set(pupil.map(p => p.y));
  assert.ok(
    [...pupilRows].some(row => whiteRows.has(row)),
    'the pupil and the white of the far eye are on different rows'
  );
});

test('hair sits on the skull rather than above it or through it', async t => {
  if (skipReason) return t.skip(skipReason);

  const spans = await headSpans();
  const bald = await render(BASE);
  const baldAt = new Map(bald.map(p => [`${p.x},${p.y}`, p]));
  const CROWN = 2;

  for (const hair of ['spiked', 'tousled', 'swept']) {
    const pixels = await render({ ...BASE, hair });
    // Covered, not merely opaque: the scalp underneath is opaque too, so what
    // matters is whether the pixel changed from the bald head.
    const covered = new Set(pixels
      .filter(p => {
        const before = baldAt.get(`${p.x},${p.y}`);
        return !before || before.r !== p.r || before.g !== p.g || before.b !== p.b;
      })
      .map(p => `${p.x},${p.y}`));

    // The crown is covered edge to edge. A mask cut from a different skull left
    // holes here for the bare scalp to show through.
    for (const y of [6, 9, 12]) {
      const [min, max] = spans[y];
      const gaps = [];
      for (let x = min; x <= max; x += 1) if (!covered.has(`${x},${y}`)) gaps.push(`${x},${y}`);
      assert.deepEqual(gaps, [], `${hair} leaves ${gaps.length} bare pixel(s) across row ${y} of the head`);
    }

    // Hair changes the head; it does not float clear of it. Above the crown
    // only tufts reach, and only over the crown's own width — borrowed hair used
    // to hang out to x9 and x54, well past the sides of the head.
    const [crownMin, crownMax] = spans[CROWN];
    const aboveCrown = pixels.filter(p => p.y < CROWN && !baldAt.has(`${p.x},${p.y}`));
    const floating = aboveCrown.filter(p => p.x < crownMin - 1 || p.x > crownMax + 1);
    assert.deepEqual(
      floating.map(p => `${p.x},${p.y}`),
      [],
      `${hair} hangs in the air beside the head, above the crown`
    );

    // Hair must not reach the mouth, which is where the borrowed masks landed.
    const overMouth = pixels.filter(p => p.y >= 33 && p.y <= 35 && p.x >= 30 && p.x <= 39 && !baldAt.has(`${p.x},${p.y}`));
    assert.deepEqual(overMouth.map(p => `${p.x},${p.y}`), [], `${hair} is drawn across the mouth`);

    // And the character still has eyes. Hair cut for a head that sits nine rows
    // lower came down over them: a fringe may cross an eye, but not blind both.
    const isWhite = ({ r, g, b }) => r > 220 && g > 220 && b > 210;
    const eyesLeft = [
      pixels.some(p => isWhite(p) && p.x >= 29 && p.x <= 34 && p.y >= 23 && p.y <= 28),
      pixels.some(p => isWhite(p) && p.x >= 38 && p.x <= 42 && p.y >= 19 && p.y <= 23),
    ].filter(Boolean).length;
    assert.ok(eyesLeft >= 1, `${hair} covers both of the character's eyes`);
    assert.ok(
      pixels.some(p => isWhite(p) && p.x >= 38 && p.x <= 42 && p.y >= 19 && p.y <= 23),
      `${hair} is drawn over the near eye`
    );
  }
});

test('the outfit is one garment, not two shades meeting at the shoulders', async t => {
  if (skipReason) return t.skip(skipReason);

  // Rows 42..48 are Penny's collar, which the compositor pastes in with the
  // head; rows 50+ are the outfit sprite's own torso. The recolour used to run
  // before the paste, so the collar kept its original colour and every
  // character wore a band of the wrong shade across the shoulders.
  const pixels = await render({ ...BASE, outfit: 'hoodie', outfitColor: '#be185d' });
  const hueOf = ({ r, g, b }) => (r - b) / Math.max(1, r + g + b);
  const band = row => {
    const lit = pixels.filter(p => p.y === row && p.x >= 20 && p.x <= 40 && p.r + p.g + p.b > 90);
    return lit.length ? lit.reduce((sum, p) => sum + hueOf(p), 0) / lit.length : null;
  };

  const collar = band(46);
  const torso = band(52);
  assert.ok(collar !== null && torso !== null, 'the torso rows came back empty');
  assert.ok(
    Math.abs(collar - torso) < 0.12,
    `the collar and the torso are different colours (${collar.toFixed(3)} vs ${torso.toFixed(3)})`
  );
});

test('the compositor no longer borrows another sprite head for hair', () => {
  // The registration bug had one cause: hair cut out of WebClaw's, NutriMind's
  // and PC's heads and stamped onto Penny's, which sits up to nine rows higher.
  // Hair is built from her own silhouette now, so there is no second head in
  // play and nothing left to misregister.
  assert.doesNotMatch(avatars, /HAIR_SPRITES/, 'hair is being taken from another sprite again');
  assert.doesNotMatch(avatars, /buildHairMask/);
  assert.match(avatars, /function measureHeadRows/);
  assert.match(avatars, /function hairPixels/);
  // The measurements every layer is placed against, kept in one place.
  assert.match(avatars, /const PENNY_HEAD = \{/);
  for (const landmark of ['crown', 'chin', 'farEye', 'nearEye', 'ear']) {
    assert.match(avatars, new RegExp(`\\b${landmark}\\b`), `PENNY_HEAD lost its ${landmark}`);
  }
});
