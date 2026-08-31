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

  // Penny's hairline: the lowest row hair may reach at a given column. The face
  // is on the right of a three-quarter view, so the line rises towards it —
  // level with the top of the ear at the back, above the near brow at the front.
  // It curves rather than ramps: a straight line across twenty columns reads as
  // a helmet with a bevelled edge, which is exactly what the first pass looked
  // like.
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

  // Hair, cut from Penny's own skull.
  //
  // It used to be lifted out of WebClaw's, NutriMind's and PC's heads and
  // stamped onto hers. Those heads sit up to nine rows lower and are shaped
  // differently, so the borrowed hair landed across her eyes, left holes where
  // her skull showed through, and hung in the air above her crown. Hair built
  // from the silhouette it has to sit on cannot be misregistered, so that is
  // what this does: it reads Penny's outline once, and fills it from the crown
  // down to a hairline.
  let headRows = null;

  function measureHeadRows(image) {
    const canvas = document.createElement('canvas');
    canvas.width = SPRITE_W;
    canvas.height = SPRITE_H;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, SPRITE_W, SPRITE_H).data;
    const rows = [];
    for (let y = 0; y <= PENNY_HEAD.chin; y += 1) {
      let min = -1; let max = -1;
      for (let x = 0; x < SPRITE_W; x += 1) {
        if (pixels[(y * SPRITE_W + x) * 4 + 3] > 20) { if (min < 0) min = x; max = x; }
      }
      rows[y] = min < 0 ? null : [min, max];
    }
    return rows;
  }

  // How far past the base hairline each style grows, and how ragged its edge is.
  // `spikes` adds tufts above the crown; `lift` pulls the whole hairline up.
  const HAIR_STYLES = {
    spiked: { drop: -1, ragged: 2, spikes: true },
    tousled: { drop: 2, ragged: 2, spikes: false },
    swept: { drop: 0, ragged: 1, spikes: false },
  };

  // A repeatable wobble, so a style's edge is uneven without being noisy from
  // one render to the next.
  function edgeWobble(x, amount) {
    if (!amount) return 0;
    return (((x * 7 + 3) % 5) - 2) * amount / 2;
  }

  function hairPixels(style) {
    const shape = HAIR_STYLES[style];
    if (!shape || !headRows) return [];
    const cells = [];
    const top = PENNY_HEAD.crown - (shape.spikes ? 3 : 0);
    for (let y = Math.max(0, top); y <= PENNY_HEAD.chin; y += 1) {
      // Above the crown only the spikes reach, and they follow the crown's own
      // width so they never float clear of the head.
      const span = headRows[y] || headRows[PENNY_HEAD.crown];
      if (!span) continue;
      const limit = y < PENNY_HEAD.crown ? span : span;
      for (let x = limit[0]; x <= limit[1]; x += 1) {
        const line = hairlineAt(x) + shape.drop + edgeWobble(x, shape.ragged);
        if (y > line) continue;
        if (y < PENNY_HEAD.crown && !(shape.spikes && (x % 4 === 1 || x % 7 === 3))) continue;
        cells.push({ x, y, edge: x === limit[0] || x === limit[1] || y >= line - 1 });
      }
    }
    return cells;
  }

  function drawHair(context, style, color) {
    if (style === 'bald' || !HAIR_STYLES[style]) return;
    const target = parseHex(color);
    const image = context.getImageData(0, 0, SPRITE_W, SPRITE_H);
    const data = image.data;
    hairPixels(style).forEach((cell) => {
      if (cell.y < 0 || cell.y >= SPRITE_H || cell.x < 0 || cell.x >= SPRITE_W) return;
      const index = (cell.y * SPRITE_W + cell.x) * 4;
      if (cell.edge) {
        // An ink outline, the same one the source sprites draw around their own
        // hair, so the cap reads as hair rather than as a painted patch.
        data[index] = 17; data[index + 1] = 18; data[index + 2] = 24;
      } else {
        // Light falls from the top front, which is where this character's other
        // highlights sit; the back of the head stays in shadow.
        const lit = 92 + (cell.x - PENNY_HEAD.ear.x0) * 2.6 - (cell.y - PENNY_HEAD.crown) * 1.9;
        const brightness = Math.max(48, Math.min(190, Math.round(lit)));
        data[index] = tintChannel(target.r, brightness);
        data[index + 1] = tintChannel(target.g, brightness);
        data[index + 2] = tintChannel(target.b, brightness);
      }
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

    // Every combination starts from the approved Penny head silhouette. The
    // interchangeable hair, expression, skin and accessory layers sit on top.
    workContext.clearRect(0, 0, SPRITE_W, 49);
    workContext.drawImage(spriteImages.penny, 0, 0, SPRITE_W, 49, 0, 0, SPRITE_W, 49);

    // After the head, not before it. Recolouring first and then pasting rows
    // 0..48 over the top put Penny's own un-recoloured collar back on every
    // character, which is the horizontal band of the wrong shade that ran across
    // each of them at the shoulders.
    recolorOutfit(workContext, look.outfitColor);
    recolorSkin(workContext, look.skin);
    drawHair(workContext, look.hair, look.hairColor);
    drawFace(workContext, look.face, look.skin);
    drawAccessory(workContext, look.accessory, look.outfitColor);

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
      headRows = measureHeadRows(spriteImages.penny);
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
