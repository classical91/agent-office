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

    const reference = document.createElement('canvas');
    reference.width = A.SPRITE_W;
    reference.height = A.SPRITE_H;
    const refContext = reference.getContext('2d', { willReadFrequently: true });

    // Every source sprite's own outline, read from the asset. A hairstyle now
    // brings its whole head across, so containment has to be judged against the
    // head that was actually pasted rather than always against Penny's.
    window.__spans = {};
    for (const name of ['penny', 'webclaw', 'nutrimind', 'pc', 'studioclaw']) {
      const image = await new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = `assets/character-demo/${name}.png`;
      });
      refContext.setTransform(1, 0, 0, 1, 0, 0);
      refContext.clearRect(0, 0, A.SPRITE_W, A.SPRITE_H);
      refContext.imageSmoothingEnabled = false;
      refContext.drawImage(image, 0, 0);
      const data = refContext.getImageData(0, 0, A.SPRITE_W, A.SPRITE_H).data;
      const spans = [];
      for (let y = 0; y < A.SPRITE_H; y += 1) {
        let min = -1; let max = -1;
        for (let x = 0; x < A.SPRITE_W; x += 1) {
          if (data[(y * A.SPRITE_W + x) * 4 + 3] > 20) { if (min < 0) min = x; max = x; }
        }
        spans[y] = min < 0 ? null : [min, max];
      }
      window.__spans[name] = spans;
    }
    window.__headSpans = window.__spans.penny;

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
const spansFor = name => page.evaluate(n => window.__spans[n], name);

// Which sprite each hairstyle's head comes from.
const HAIR_HEADS = { bald: 'penny', spiked: 'webclaw', tousled: 'nutrimind', swept: 'pc' };

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

test('each hairstyle is the artist\'s own, pixel for pixel', async t => {
  if (skipReason) return t.skip(skipReason);

  // The strongest thing that can be said about hair here: its silhouette is
  // identical to the sprite it was painted on. Hair was generated for a while,
  // built up from Penny's skull, and it could not be made to look like the
  // originals — she is drawn high on the canvas because she is bald, and the
  // sprites with hair sit lower precisely to leave room for it. Comparing
  // outlines is what stops anyone quietly going back to approximating it.
  for (const [style, source] of Object.entries(HAIR_HEADS)) {
    const spans = await spansFor(source);
    const pixels = await render({ ...BASE, hair: style });
    const drawn = [];
    pixels.forEach(({ x, y }) => {
      if (y > CHIN) return;
      if (!drawn[y]) drawn[y] = [x, x];
      else { drawn[y][0] = Math.min(drawn[y][0], x); drawn[y][1] = Math.max(drawn[y][1], x); }
    });
    const mismatched = [];
    for (let y = 0; y <= CHIN; y += 1) {
      const want = spans[y] ? `${spans[y][0]}-${spans[y][1]}` : '-';
      const got = drawn[y] ? `${drawn[y][0]}-${drawn[y][1]}` : '-';
      if (want !== got) mismatched.push(`row ${y}: ${source} has ${want}, ${style} drew ${got}`);
    }
    assert.deepEqual(mismatched, [], `${style} is not ${source}'s hair any more`);
  }
});

test('every hairstyle is a different head, and none of them is the bald one', async t => {
  if (skipReason) return t.skip(skipReason);

  const signature = async (hair) => {
    const pixels = await render({ ...BASE, hair });
    return pixels.filter(p => p.y <= CHIN).map(p => `${p.x},${p.y},${p.r},${p.g},${p.b}`).join('|');
  };
  const seen = new Map();
  for (const style of Object.keys(HAIR_HEADS)) seen.set(style, await signature(style));

  const styles = [...seen.keys()];
  for (let i = 0; i < styles.length; i += 1) {
    for (let j = i + 1; j < styles.length; j += 1) {
      assert.notEqual(
        seen.get(styles[i]), seen.get(styles[j]),
        `${styles[i]} and ${styles[j]} render the same head`
      );
    }
  }
});

test('the hair colour reaches the whole mass, and stops at the hair', async t => {
  if (skipReason) return t.skip(skipReason);

  // Recolouring keyed on brightness looked right on WebClaw, whose hair carries
  // some lit strands, and failed on PC's, which is dark throughout: almost every
  // pixel was treated as outline and the colour reached a few spidery strands
  // over a black mass. So this asks for the colour across the mass, on the style
  // that broke.
  const isNear = (p, hex) => {
    const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16);
    const sum = p.r + p.g + p.b;
    if (sum < 40) return false;
    // Same hue family: compare the channel ordering and rough ratios rather than
    // exact values, since the art's shading rides on top of the tint.
    const near = (a, c) => Math.abs(a / Math.max(1, sum) - c / Math.max(1, r + g + b)) < 0.09;
    return near(p.r, r) && near(p.g, g) && near(p.b, b);
  };

  for (const style of ['spiked', 'tousled', 'swept']) {
    const violet = await render({ ...BASE, hair: style, hairColor: '#72519b' });
    const coloured = violet.filter(p => p.y <= 24 && isNear(p, '#72519b'));
    assert.ok(
      coloured.length >= 90,
      `${style} took the hair colour on only ${coloured.length} pixels — the mass is still black underneath`
    );

    // The face is not hair. Eye whites and skin must come through untouched.
    const white = violet.filter(p => p.r > 220 && p.g > 220 && p.b > 210);
    assert.ok(white.length > 0, `${style} lost the eye whites to the hair recolour`);
  }
});

test('an expression and an accessory follow the head the hairstyle brought', async t => {
  if (skipReason) return t.skip(skipReason);

  // The head moves when the hairstyle changes — WebClaw's sits nine rows below
  // Penny's. Anything drawn onto it has to move with it, or the earpiece ends up
  // on a forehead.
  for (const [style, source] of Object.entries(HAIR_HEADS)) {
    const spans = await spansFor(source);
    for (const accessory of ['earpiece', 'headset', 'glasses']) {
      const pixels = await render({ ...BASE, hair: style, accessory });
      const strays = pixels.filter(({ x, y }) => {
        if (y > CHIN) return false;
        const span = spans[y];
        if (!span) return true;
        return x < span[0] - 1 || x > span[1] + 1;
      });
      assert.deepEqual(
        strays.map(({ x, y }) => `${x},${y}`),
        [],
        `with ${style} hair the ${accessory} is drawn off ${source}'s head`
      );
    }
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

test('hair is taken from the art, not built', () => {
  // The mechanism, pinned at the source as well as in the pixels above: a
  // hairstyle picks a head, and the head carries the hair that was painted on
  // it. The generated version that stood here briefly — a silhouette measured
  // off Penny's skull and filled in — is what this is written against.
  assert.match(avatars, /const HAIR_HEADS = \{/);
  assert.match(avatars, /const HEAD_OFFSETS = \{/);
  assert.match(avatars, /function recolorHair/);
  assert.doesNotMatch(avatars, /function hairCells/, 'hair is being generated again');
  assert.doesNotMatch(avatars, /function measureHeadRows/);
  assert.doesNotMatch(avatars, /const HAIR_STYLES/);
  // The measurements every layer is placed against, kept in one place.
  assert.match(avatars, /const PENNY_HEAD = \{/);
  for (const landmark of ['crown', 'chin', 'farEye', 'nearEye', 'ear']) {
    assert.match(avatars, new RegExp(`\\b${landmark}\\b`), `PENNY_HEAD lost its ${landmark}`);
  }
});
