'use strict';

// Shared character art for the Agent Office cast.
//
// The sprite compositor below is the approved one from the avatar studio: it
// layers the detailed 64x110 assets in assets/character-demo/ — outfit body,
// Penny's head silhouette, then recoloured skin, hair, expression and
// accessory. It lived inside character-demo.js, where only the studio could
// reach it. Moving it here lets the live office draw the very same characters
// instead of the borrowed Habbo PNGs and the coloured-box fallback, and means
// a look approved in the studio is the look that ships.
//
// The art itself is untouched. Nothing below changes how any character renders.
(function (global) {
  const ASSET_ROOT = 'assets/character-demo/';
  const SPRITE_W = 64;
  const SPRITE_H = 110;

  const SKINS = ['#f2c49b', '#dca276', '#ba7651', '#8b5036', '#573222'];
  const HAIR_COLORS = ['#151518', '#36231c', '#704127', '#b96c32', '#d6ab5e', '#72519b'];
  const OUTFIT_COLORS = ['#172554', '#2563eb', '#0f766e', '#16803a', '#7c3aed', '#be185d', '#343948', '#d9d8d2'];

  const SPRITE_SOURCES = {
    penny: `${ASSET_ROOT}penny.png`,
    webclaw: `${ASSET_ROOT}webclaw.png`,
    nutrimind: `${ASSET_ROOT}nutrimind.png`,
    pc: `${ASSET_ROOT}pc.png`,
    studioclaw: `${ASSET_ROOT}studioclaw.png`,
  };

  const OUTFIT_SPRITES = {
    lead: 'penny',
    hoodie: 'webclaw',
    overshirt: 'nutrimind',
    utility: 'pc',
    director: 'studioclaw',
  };

  // Hair is not drawn. It arrives on a head, the way it was originally painted.
  //
  // Generating hair was tried and it cannot work here: Penny's head is drawn
  // high on the canvas because she is bald, and the sprites that do have hair
  // sit five to nine rows lower precisely to leave room for it. Building hair
  // onto her skull therefore has nowhere to go but sideways, which reads as a
  // cap or a beret rather than as hair. So a hairstyle selects the head that was
  // hand-painted with it, and the strands, the black outline and the shading are
  // the artist's, not an approximation of them.
  const HAIR_HEADS = {
    bald: 'penny',
    spiked: 'webclaw',
    tousled: 'nutrimind',
    swept: 'pc',
  };

  // The head each sprite carries is in a slightly different place — measured
  // from the assets, in columns and rows from Penny's. Everything drawn onto a
  // head (expression, accessory, hair recolour) is shifted by its source's
  // offset, so the landmarks in PENNY_HEAD stay the single set of coordinates
  // the whole compositor is written against.
  const HEAD_OFFSETS = {
    penny: { dx: 0, dy: 0 },
    webclaw: { dx: 3, dy: 9 },
    nutrimind: { dx: 3, dy: 8 },
    pc: { dx: 2, dy: 5 },
    studioclaw: { dx: 2, dy: 6 },
  };

  // How much of the source sprite comes across as "the head": down to the base
  // of the neck, above where any body's shoulders start.
  const HEAD_CUT = 52;

  // Penny's head, measured off assets/character-demo/penny.png rather than
  // guessed. Every head this compositor draws is hers — the outfit sprite's own
  // head is cleared and Penny's pasted in its place — so hair, expressions and
  // accessories all have to land on these coordinates and no others.
  //
  // They were not landing on them. The far eye's brow, sclera and lens were
  // drawn around x22, which on this head is the ear, and the headset's right cup
  // and the earpiece were drawn out past x45, which is off the head entirely:
  // that is where the loose blocks floating beside every character came from.
  // `sclera` is the white of each eye; `ear` is the one ear a three-quarter view
  // shows, on the far side.
  const PENNY_HEAD = {
    crown: 2,
    chin: 36,
    farEye: { x0: 29, x1: 34, y0: 23, y1: 28 },
    nearEye: { x0: 38, x1: 42, y0: 19, y1: 23 },
    ear: { x0: 15, x1: 22, y0: 21, y1: 31 },
  };

  // The five sprites are not registered to one another — each has its head in a
  // slightly different place, by as much as nine rows. That is why nothing here
  // borrows another sprite's head any more: hair is cut from Penny's own
  // silhouette below, and her head is the only one this compositor ever draws.

  // The brow line, in Penny's columns: the lowest row hair can reach before it
  // would be over the face. It is the cut-off for the hair mask, so that the
  // near-black ink a sprite draws its glasses, lashes and jaw with is never
  // mistaken for hair and recoloured. The face is on the right of a
  // three-quarter view, so the line rises towards it — level with the top of the
  // ear at the back, above the near brow at the front.
  function hairlineAt(x) {
    const front = Math.max(0, x - PENNY_HEAD.ear.x1);
    return 26 - front * 0.62 + Math.min(4, front * front * 0.012);
  }

  const CHOICES = {
    face: [
      { value: 'friendly', label: 'Friendly', icon: '☺' },
      { value: 'focused', label: 'Focused', icon: '⌁' },
      { value: 'bright', label: 'Bright', icon: '◉' },
      { value: 'stoic', label: 'Stoic', icon: '—' },
    ],
    hair: [
      { value: 'bald', label: 'Bald', icon: '○' },
      { value: 'spiked', label: 'Spiked', icon: '✦' },
      { value: 'tousled', label: 'Tousled', icon: '●' },
      { value: 'swept', label: 'Swept', icon: '◢' },
    ],
    outfit: [
      { value: 'lead', label: 'Lead jacket', icon: '◆' },
      { value: 'hoodie', label: 'Hoodie', icon: '⌂' },
      { value: 'overshirt', label: 'Overshirt', icon: '║' },
      { value: 'utility', label: 'Utility', icon: '▦' },
      { value: 'director', label: 'Director', icon: '◇' },
    ],
    accessory: [
      { value: 'none', label: 'None', icon: '×' },
      { value: 'glasses', label: 'Glasses', icon: '▭' },
      { value: 'headset', label: 'Headset', icon: '◖' },
      { value: 'earpiece', label: 'Earpiece', icon: '·)' },
      { value: 'chain', label: 'Chain', icon: '⌄' },
    ],
  };

  // The live room's ids, not the display names: `oss` is Penny and
  // `studioclaw` is the Studio Director. Stations mirror AGENT_STATIONS and the
  // hot-desk assignment in app-shared.js, so the studio's office preview stands
  // everyone exactly where the real room does.
  //
  // `name` and `role` are copies of the AGENTS entry with the same id, and are
  // the studio's only reason to hold either: the studio page does not load
  // app-shared.js, so it cannot read AGENTS directly. They drifted once —
  // studioclaw read "StudioClaw" and newsreporter read "News Reporter" while
  // the office called them Studio Director and ShareBot67 — so
  // tests/character-customizer.test.js now fails when the two disagree.
  // Anything that can reach AGENTS (the office, the roster selector) reads the
  // name and role from there instead of from here.
  //
  // The first five carry the studio's approved defaults unchanged. The last
  // four had no character at all — they were the coloured boxes in the room —
  // and are dressed from the existing outfit, hair and accessory sets rather
  // than any new art, so the whole cast stays one visual family.
  const ROSTER = [
    {
      id: 'oss', name: 'Penny', shortRole: 'Team lead', role: 'Sole Orchestrator', color: '#f59e0b',
      station: { gx: 5, gy: 1 },
      defaults: { face: 'friendly', skin: '#dca276', hair: 'bald', hairColor: '#36231c', outfit: 'lead', outfitColor: '#172554', accessory: 'earpiece' },
    },
    {
      id: 'webclaw', name: 'WebClaw', shortRole: 'Web agency', role: 'Web Agency Specialist', color: '#3b82f6',
      station: { gx: 1, gy: 4 },
      defaults: { face: 'focused', skin: '#f2c49b', hair: 'spiked', hairColor: '#151518', outfit: 'hoodie', outfitColor: '#2563eb', accessory: 'glasses' },
    },
    {
      id: 'nutrimind', name: 'NutriMind', shortRole: 'Nutrition app', role: 'Nutrition App Specialist', color: '#22c55e',
      station: { gx: 8, gy: 5 },
      defaults: { face: 'bright', skin: '#ba7651', hair: 'tousled', hairColor: '#36231c', outfit: 'overshirt', outfitColor: '#16803a', accessory: 'none' },
    },
    {
      id: 'pc', name: 'PC', shortRole: 'Windows', role: 'Windows Workstation Specialist', color: '#10b981',
      station: { gx: 10, gy: 5 },
      defaults: { face: 'stoic', skin: '#dca276', hair: 'swept', hairColor: '#151518', outfit: 'utility', outfitColor: '#0f766e', accessory: 'headset' },
    },
    {
      id: 'traderclaw', name: 'TraderClaw', shortRole: 'Markets', role: 'Trading and Market Specialist', color: '#14b8a6',
      station: { gx: 0, gy: 3 },
      defaults: { face: 'focused', skin: '#8b5036', hair: 'spiked', hairColor: '#151518', outfit: 'utility', outfitColor: '#115e59', accessory: 'earpiece' },
    },
    {
      id: 'studioclaw', name: 'Studio Director', shortRole: 'Studio routing', role: 'Studio Routing Lead', color: '#8b5cf6',
      station: { gx: 7, gy: 1 },
      defaults: { face: 'friendly', skin: '#f2c49b', hair: 'swept', hairColor: '#151518', outfit: 'director', outfitColor: '#7c3aed', accessory: 'chain' },
    },
    {
      id: 'nightwaveaudio', name: 'Nightwave Audio', shortRole: 'Audio', role: 'Audio Specialist', color: '#06b6d4',
      station: { gx: 8, gy: 1 },
      defaults: { face: 'focused', skin: '#573222', hair: 'tousled', hairColor: '#151518', outfit: 'hoodie', outfitColor: '#0f766e', accessory: 'headset' },
    },
    {
      id: 'youtubeclaw', name: 'YouTube Claw', shortRole: 'Packaging', role: 'YouTube Packaging Specialist', color: '#ef4444',
      station: { gx: 2, gy: 4 },
      defaults: { face: 'bright', skin: '#f2c49b', hair: 'spiked', hairColor: '#704127', outfit: 'lead', outfitColor: '#be185d', accessory: 'none' },
    },
    {
      id: 'commentfarm', name: 'CommentFarm', shortRole: 'Engagement', role: 'Engagement Specialist', color: '#84cc16',
      station: { gx: 2, gy: 6 },
      defaults: { face: 'friendly', skin: '#ba7651', hair: 'swept', hairColor: '#b96c32', outfit: 'overshirt', outfitColor: '#343948', accessory: 'earpiece' },
    },
    {
      id: 'newsreporter', name: 'ShareBot67', shortRole: 'News & research', role: 'News and Research Specialist', color: '#f97316',
      station: { gx: 11, gy: 5 },
      defaults: { face: 'stoic', skin: '#8b5036', hair: 'bald', hairColor: '#151518', outfit: 'director', outfitColor: '#d9d8d2', accessory: 'glasses' },
    },
    {
      id: 'routercoder', name: 'RouterCoder', shortRole: 'OpenRouter code', role: 'OpenRouter Coding Specialist', color: '#ec4899',
      station: { gx: 9, gy: 5 },
      defaults: { face: 'focused', skin: '#573222', hair: 'swept', hairColor: '#72519b', outfit: 'utility', outfitColor: '#172554', accessory: 'glasses' },
    },
  ];

  const DEFAULT_LOOKS = Object.fromEntries(ROSTER.map((agent) => [agent.id, agent.defaults]));

  let assetsReady = false;
  const spriteImages = {};
  const workCanvas = document.createElement('canvas');
  workCanvas.width = SPRITE_W;
  workCanvas.height = SPRITE_H;
  const workContext = workCanvas.getContext('2d', { willReadFrequently: true });

  function parseHex(hex) {
    const raw = String(hex).replace('#', '');
    const value = parseInt(raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw, 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }

  function isSkinPixel(r, g, b, x, y) {
    const skinLike = r > 80 && r > g * 1.04 && g > b * 1.04 && r - b > 22;
    const bodySkinZone = y < 53 || (y > 48 && y < 90 && (x < 22 || x > 42));
    return skinLike && bodySkinZone;
  }

  function tintChannel(base, lightness) {
    const factor = 0.35 + (lightness / 255) * 1.05;
    return Math.max(0, Math.min(255, Math.round(base * factor)));
  }

  function recolorOutfit(context, color) {
    const target = parseHex(color);
    const image = context.getImageData(0, 0, SPRITE_W, SPRITE_H);
    const data = image.data;
    for (let y = 42; y < 104; y += 1) {
      for (let x = 0; x < SPRITE_W; x += 1) {
        const index = (y * SPRITE_W + x) * 4;
        if (data[index + 3] < 20) continue;
        const r = data[index]; const g = data[index + 1]; const b = data[index + 2];
        const high = Math.max(r, g, b); const low = Math.min(r, g, b);
        if (high < 28 || (high > 218 && low > 180) || isSkinPixel(r, g, b, x, y)) continue;
        const lightness = Math.round((high + low) / 2);
        data[index] = tintChannel(target.r, lightness);
        data[index + 1] = tintChannel(target.g, lightness);
        data[index + 2] = tintChannel(target.b, lightness);
      }
    }
    context.putImageData(image, 0, 0);
  }

  function recolorSkin(context, color) {
    const target = parseHex(color);
    const image = context.getImageData(0, 0, SPRITE_W, SPRITE_H);
    const data = image.data;
    for (let y = 0; y < SPRITE_H; y += 1) {
      for (let x = 0; x < SPRITE_W; x += 1) {
        const index = (y * SPRITE_W + x) * 4;
        if (data[index + 3] < 20) continue;
        const r = data[index]; const g = data[index + 1]; const b = data[index + 2];
        if (!isSkinPixel(r, g, b, x, y)) continue;
        const high = Math.max(r, g, b); const low = Math.min(r, g, b);
        const lightness = Math.round((high + low) / 2);
        data[index] = tintChannel(target.r, lightness);
        data[index + 1] = tintChannel(target.g, lightness);
        data[index + 2] = tintChannel(target.b, lightness);
      }
    }
    context.putImageData(image, 0, 0);
  }

  // Recolouring the hair that came in on the head.
  //
  // The mass is found by flooding out from the dark pixels along the top of the
  // sprite, which is what the hair is and what nothing else touches. This is the
  // same trick an earlier version used, but it ran against a head the hair had
  // been moved off, so it caught eyes and jaws and left holes. Run against the
  // sprite the hair was painted on, the registration is exact by construction.
  const hairMasks = {};

  function buildHairMask(image, sourceKey) {
    const canvas = document.createElement('canvas');
    canvas.width = SPRITE_W;
    canvas.height = SPRITE_H;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, SPRITE_W, SPRITE_H).data;
    const offset = HEAD_OFFSETS[sourceKey] || { dx: 0, dy: 0 };

    const candidate = new Uint8Array(SPRITE_W * HEAD_CUT);
    for (let y = 0; y < HEAD_CUT; y += 1) {
      for (let x = 0; x < SPRITE_W; x += 1) {
        const index = (y * SPRITE_W + x) * 4;
        const brightness = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]);
        // Above the brow only. Below it the same near-black ink draws the
        // glasses, the lashes and the jaw line, none of which are hair.
        if (y > hairlineAt(x - offset.dx) + offset.dy) continue;
        if (pixels[index + 3] > 30 && brightness < 130) candidate[y * SPRITE_W + x] = 1;
      }
    }

    const seen = new Uint8Array(candidate.length);
    const queue = [];
    for (let y = 0; y < 14; y += 1) {
      for (let x = 0; x < SPRITE_W; x += 1) {
        const at = y * SPRITE_W + x;
        if (candidate[at]) { seen[at] = 1; queue.push(at); }
      }
    }
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const at = queue[cursor];
      const x = at % SPRITE_W;
      [at - 1, at + 1, at - SPRITE_W, at + SPRITE_W].forEach((next) => {
        if (next < 0 || next >= candidate.length) return;
        if (Math.abs((next % SPRITE_W) - x) > 1) return;
        if (candidate[next] && !seen[next]) { seen[next] = 1; queue.push(next); }
      });
    }

    // The outline is the boundary of the mass, not the darkest pixels in it.
    // Telling them apart by brightness worked on WebClaw, whose hair carries
    // some light strands, and failed on PC's, which is dark throughout: nearly
    // every pixel counted as outline and the colour only reached a few spidery
    // strands. Geometry does not care how dark the style is.
    const inMask = new Set(queue);
    let min = 255; let max = 0;
    const found = queue.map((at) => {
      const index = at * 4;
      const x = at % SPRITE_W;
      const v = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]);
      const edge = !inMask.has(at - SPRITE_W) || !inMask.has(at + SPRITE_W)
        || (x > 0 && !inMask.has(at - 1)) || (x < SPRITE_W - 1 && !inMask.has(at + 1));
      if (!edge) { if (v < min) min = v; if (v > max) max = v; }
      return { at, v, edge };
    });
    if (max <= min) { min = 0; max = 255; }
    return { pixels: found, range: { min, max }, length: found.length };
  }

  function recolorHair(context, sourceKey, color) {
    const mask = hairMasks[sourceKey];
    if (!mask || !mask.length) return;
    const target = parseHex(color);
    const image = context.getImageData(0, 0, SPRITE_W, SPRITE_H);
    const data = image.data;

    // Habbo hair is painted almost entirely between black and about a third
    // brightness, so a fixed threshold puts nearly all of it on the "outline"
    // side and only the few lit strands take the colour — which came out as a
    // blond fringe over a black mass. Spreading the mask's own range across the
    // full tint instead keeps the artist's shading and lets the colour read.
    const span = mask.range;
    mask.pixels.forEach((pixel) => {
      const index = pixel.at * 4;
      // The sprite's own black outline, kept so the silhouette stays as crisp as
      // the art it came from.
      if (pixel.edge) {
        data[index] = 13; data[index + 1] = 14; data[index + 2] = 18;
        data[index + 3] = 255;
        return;
      }
      const shade = Math.max(0, Math.min(1, (pixel.v - span.min) / (span.max - span.min)));
      // A floor under the darkest strands, so the colour reads across the whole
      // mass rather than only on the lit ones, and the artist's shading rides on
      // top of it.
      const lightness = Math.round(66 + shade * 132);
      data[index] = tintChannel(target.r, lightness);
      data[index + 1] = tintChannel(target.g, lightness);
      data[index + 2] = tintChannel(target.b, lightness);
      data[index + 3] = 255;
    });
    context.putImageData(image, 0, 0);
  }

  // Expressions are drawn onto PENNY_HEAD's eyes and mouth. In a three-quarter
  // view the near eye sits higher and further forward than the far one, which is
  // why the two are not a mirrored pair. The far eye's features used to be drawn
  // around x22 — over the ear, seven columns short of the eye — so every
  // expression but Friendly put a stray mark on the side of the head.
  const FAR_EYE = PENNY_HEAD.farEye;
  const NEAR_EYE = PENNY_HEAD.nearEye;

  function drawFace(context, expression, skin) {
    if (expression === 'friendly') return;
    const darkSkin = parseHex(skin);
    const erase = `rgb(${Math.round(darkSkin.r * 0.92)}, ${Math.round(darkSkin.g * 0.92)}, ${Math.round(darkSkin.b * 0.92)})`;
    context.imageSmoothingEnabled = false;
    if (expression === 'focused') {
      // A brow lowered over each eye.
      context.fillStyle = '#231a18';
      context.fillRect(FAR_EYE.x0, FAR_EYE.y0 - 2, 6, 1);
      context.fillRect(NEAR_EYE.x0 - 1, NEAR_EYE.y0 - 1, 6, 1);
      context.fillStyle = erase;
      context.fillRect(30, 34, 8, 2);
      context.fillStyle = '#6b3027';
      context.fillRect(31, 35, 7, 1);
    } else if (expression === 'bright') {
      // Opened wider, inside the eye the art already draws. Filling the whole
      // socket with white and dropping a square in it — which is what this used
      // to do — reads as a pair of stuck-on googly eyes.
      context.fillStyle = '#f7fbff';
      context.fillRect(FAR_EYE.x0 + 1, FAR_EYE.y0 + 1, 4, 3);
      context.fillRect(NEAR_EYE.x0, NEAR_EYE.y0 + 1, 4, 3);
      context.fillStyle = '#17181c';
      context.fillRect(FAR_EYE.x0 + 3, FAR_EYE.y0 + 2, 2, 2);
      context.fillRect(NEAR_EYE.x0 + 2, NEAR_EYE.y0 + 2, 2, 2);
      context.fillStyle = '#743029';
      context.fillRect(30, 34, 2, 1); context.fillRect(32, 35, 6, 1); context.fillRect(38, 34, 2, 1);
    } else if (expression === 'stoic') {
      context.fillStyle = erase;
      context.fillRect(29, 33, 11, 4);
      context.fillStyle = '#64302a';
      context.fillRect(31, 35, 8, 1);
    }
  }

  // Worn on PENNY_HEAD, which spans x13..x44 and ends at the chin on row 36.
  // Everything here used to be drawn from x45 outwards — past the edge of the
  // head — so the earpiece and the headset's second cup and microphone hung in
  // empty space beside the character rather than sitting on it.
  function drawAccessory(context, accessory, accent) {
    const ink = '#111318';
    const ear = PENNY_HEAD.ear;
    if (accessory === 'glasses') {
      context.fillStyle = ink;
      // Far lens, around the far eye.
      context.fillRect(27, 21, 9, 2); context.fillRect(27, 23, 2, 6); context.fillRect(34, 23, 2, 6); context.fillRect(28, 28, 8, 2);
      // Near lens, higher and further forward, and the bridge between them.
      context.fillRect(36, 17, 9, 2); context.fillRect(36, 19, 2, 6); context.fillRect(43, 19, 2, 6); context.fillRect(37, 24, 8, 2);
      context.fillRect(35, 21, 2, 1);
    } else if (accessory === 'headset') {
      context.fillStyle = ink;
      // The band sits on the crown, which is only x23..x33 wide on its top row.
      context.fillRect(23, 2, 11, 1); context.fillRect(20, 3, 17, 2);
      // The arm follows the head's own edge down to the ear rather than dropping
      // straight past it, and the near side shows nothing but that edge.
      context.fillRect(16, 7, 2, 2); context.fillRect(15, 9, 2, 2); context.fillRect(14, 11, 2, 10);
      context.fillRect(42, 11, 3, 8);
      // The cup: an ink shell with the accent inside it, cornered off so it
      // reads as a pad over the ear instead of a coloured square.
      context.fillRect(ear.x0, ear.y0, 7, 1); context.fillRect(ear.x0 - 1, ear.y0 + 1, 9, 7); context.fillRect(ear.x0, ear.y0 + 8, 7, 1);
      context.fillStyle = accent;
      context.fillRect(ear.x0 + 1, ear.y0 + 1, 5, 1); context.fillRect(ear.x0, ear.y0 + 2, 7, 5); context.fillRect(ear.x0 + 1, ear.y0 + 7, 5, 1);
      context.fillStyle = ink;
      // The boom, forward along the jaw rather than out into the air.
      context.fillRect(21, 29, 7, 2); context.fillRect(27, 31, 3, 2);
    } else if (accessory === 'earpiece') {
      context.fillStyle = ink;
      context.fillRect(ear.x0 + 1, ear.y0 + 1, 6, 9);
      context.fillStyle = '#28344a';
      context.fillRect(ear.x0 + 2, ear.y0 + 2, 4, 6); context.fillRect(ear.x0 + 4, ear.y0 + 8, 4, 1);
      context.fillStyle = '#7dd3fc';
      context.fillRect(ear.x0 + 3, ear.y0 + 3, 2, 3);
    } else if (accessory === 'chain') {
      context.fillStyle = '#d5a733';
      context.fillRect(25, 49, 2, 2); context.fillRect(27, 51, 2, 2); context.fillRect(29, 53, 6, 2); context.fillRect(35, 51, 2, 2); context.fillRect(37, 49, 2, 2);
    }
  }

  function drawAvatar(canvas, look) {
    const target = canvas.getContext('2d', { willReadFrequently: true });
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.clearRect(0, 0, canvas.width, canvas.height);
    target.imageSmoothingEnabled = false;
    if (!assetsReady) return;

    workContext.setTransform(1, 0, 0, 1, 0, 0);
    workContext.clearRect(0, 0, SPRITE_W, SPRITE_H);
    workContext.imageSmoothingEnabled = false;
    workContext.drawImage(spriteImages[OUTFIT_SPRITES[look.outfit]], 0, 0);

    // The head comes from whichever sprite was painted with this hairstyle, and
    // brings the artist's hair with it. Everything after this is recolouring and
    // small details drawn on top — no hair is invented.
    const headKey = HAIR_HEADS[look.hair] || HAIR_HEADS.bald;
    const head = HEAD_OFFSETS[headKey] || { dx: 0, dy: 0 };
    workContext.clearRect(0, 0, SPRITE_W, HEAD_CUT);
    workContext.drawImage(spriteImages[headKey], 0, 0, SPRITE_W, HEAD_CUT, 0, 0, SPRITE_W, HEAD_CUT);

    // After the head, not before it. Recolouring first and then pasting the head
    // over the top put the head sprite's own un-recoloured collar back on every
    // character, which is the horizontal band of the wrong shade that used to
    // run across each of them at the shoulders.
    recolorOutfit(workContext, look.outfitColor);
    recolorSkin(workContext, look.skin);
    recolorHair(workContext, headKey, look.hairColor);

    // The expression and the accessory are written against Penny's landmarks, so
    // they travel with the head they are being drawn on rather than staying at
    // her coordinates while the face sits nine rows lower.
    //
    // `source-atop` then clips them to the character. Translating alone gets the
    // ear close but not exact — these heads are shaped differently, not just
    // offset — and an earpiece was hanging a pixel or three past the jaw on the
    // lower-set ones. This makes "nothing is drawn off the head" a property of
    // the compositor rather than of how well the coordinates were tuned.
    workContext.save();
    workContext.globalCompositeOperation = 'source-atop';
    workContext.translate(head.dx, head.dy);
    drawFace(workContext, look.face, look.skin);
    drawAccessory(workContext, look.accessory, look.outfitColor);
    workContext.restore();

    // Fit rather than stretch. Every canvas the studio hands over is 64x110 —
    // exactly the sprite's own size — so this is a 1:1 blit there and the art
    // is untouched. The office's sprite buffer is 78x108, which is a different
    // aspect, and filling it would squash the character.
    const fit = Math.min(canvas.width / SPRITE_W, canvas.height / SPRITE_H);
    const w = Math.round(SPRITE_W * fit);
    const h = Math.round(SPRITE_H * fit);
    target.drawImage(workCanvas, Math.round((canvas.width - w) / 2), canvas.height - h, w, h);
  }

  function loadAssets() {
    return Promise.all(Object.entries(SPRITE_SOURCES).map(([key, source]) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => { spriteImages[key] = image; resolve(); };
      image.onerror = () => reject(new Error(`Could not load ${source}`));
      image.src = source;
    }))).then(() => {
      Object.values(HAIR_HEADS).forEach((key) => {
        hairMasks[key] = buildHairMask(spriteImages[key], key);
      });
      assetsReady = true;
    });
  }

  let loading = null;
  // Both pages call this; the second caller joins the first load rather than
  // fetching and re-masking the sprite sheets all over again.
  function ready() {
    if (!loading) loading = loadAssets();
    return loading;
  }

  const AgentAvatars = {
    SPRITE_W, SPRITE_H, SKINS, HAIR_COLORS, OUTFIT_COLORS, CHOICES, ROSTER, DEFAULT_LOOKS,
    drawAvatar, ready,
    get assetsReady() { return assetsReady; },
  };

  global.AgentAvatars = AgentAvatars;
})(window);
