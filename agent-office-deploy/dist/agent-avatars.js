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

  const HAIR_SPRITES = {
    bald: null,
    spiked: 'webclaw',
    tousled: 'nutrimind',
    swept: 'pc',
  };

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
  const hairMasks = {};
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

  function buildHairMask(image) {
    const canvas = document.createElement('canvas');
    canvas.width = SPRITE_W;
    canvas.height = SPRITE_H;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, SPRITE_W, SPRITE_H).data;
    const candidate = new Uint8Array(SPRITE_W * 50);
    for (let y = 0; y < 50; y += 1) {
      for (let x = 0; x < SPRITE_W; x += 1) {
        const index = (y * SPRITE_W + x) * 4;
        const alpha = pixels[index + 3];
        const brightness = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]);
        if (alpha > 30 && brightness < 125) candidate[y * SPRITE_W + x] = 1;
      }
    }

    const visited = new Uint8Array(candidate.length);
    const queue = [];
    for (let y = 0; y < 13; y += 1) {
      for (let x = 0; x < SPRITE_W; x += 1) {
        const position = y * SPRITE_W + x;
        if (candidate[position]) { visited[position] = 1; queue.push(position); }
      }
    }
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const position = queue[cursor];
      const x = position % SPRITE_W; const y = Math.floor(position / SPRITE_W);
      const neighbors = [position - 1, position + 1, position - SPRITE_W, position + SPRITE_W];
      neighbors.forEach((next) => {
        const nx = next % SPRITE_W; const ny = Math.floor(next / SPRITE_W);
        if (next < 0 || next >= candidate.length || Math.abs(nx - x) > 1 || Math.abs(ny - y) > 1) return;
        if (candidate[next] && !visited[next]) { visited[next] = 1; queue.push(next); }
      });
    }

    return queue.filter((position) => {
      const x = position % SPRITE_W;
      const y = Math.floor(position / SPRITE_W);
      // The source sprite's eyes, glasses and jaw use the same near-black ink
      // as its hair. Keep only the scalp and outside silhouette; controlled
      // fringe pixels are added separately so facial details never leak in.
      return y < 21 || (y < 45 && (x < 19 || x > 45));
    }).map((position) => {
      const index = position * 4;
      return {
        x: position % SPRITE_W,
        y: Math.floor(position / SPRITE_W),
        r: pixels[index], g: pixels[index + 1], b: pixels[index + 2], a: pixels[index + 3],
      };
    });
  }

  function drawHair(context, style, color) {
    if (style === 'bald' || !hairMasks[style]) return;
    const target = parseHex(color);
    const image = context.getImageData(0, 0, SPRITE_W, SPRITE_H);
    const data = image.data;
    hairMasks[style].forEach((pixel) => {
      const index = (pixel.y * SPRITE_W + pixel.x) * 4;
      const brightness = Math.max(pixel.r, pixel.g, pixel.b);
      if (brightness < 30) {
        data[index] = 13; data[index + 1] = 14; data[index + 2] = 18;
      } else {
        data[index] = tintChannel(target.r, brightness);
        data[index + 1] = tintChannel(target.g, brightness);
        data[index + 2] = tintChannel(target.b, brightness);
      }
      data[index + 3] = pixel.a;
    });
    context.putImageData(image, 0, 0);

    const ink = '#111318';
    const shade = parseHex(color);
    const mid = `rgb(${tintChannel(shade.r, 112)}, ${tintChannel(shade.g, 112)}, ${tintChannel(shade.b, 112)})`;
    context.fillStyle = ink;
    if (style === 'spiked') {
      context.fillRect(18, 18, 7, 4); context.fillRect(27, 18, 6, 3); context.fillRect(36, 17, 7, 3);
      context.fillStyle = mid;
      context.fillRect(19, 18, 5, 2); context.fillRect(28, 18, 4, 1); context.fillRect(37, 17, 5, 1);
    } else if (style === 'tousled') {
      context.fillRect(18, 17, 8, 5); context.fillRect(25, 18, 8, 4); context.fillRect(34, 17, 9, 4);
      context.fillStyle = mid;
      context.fillRect(19, 18, 5, 2); context.fillRect(27, 18, 4, 2); context.fillRect(36, 17, 5, 2);
    } else if (style === 'swept') {
      context.fillRect(20, 17, 8, 3); context.fillRect(27, 18, 9, 4); context.fillRect(35, 18, 10, 5);
      context.fillStyle = mid;
      context.fillRect(21, 17, 6, 1); context.fillRect(29, 18, 6, 2); context.fillRect(37, 18, 6, 2);
    }
  }

  function drawFace(context, expression, skin) {
    if (expression === 'friendly') return;
    const darkSkin = parseHex(skin);
    const erase = `rgb(${Math.round(darkSkin.r * 0.92)}, ${Math.round(darkSkin.g * 0.92)}, ${Math.round(darkSkin.b * 0.92)})`;
    context.imageSmoothingEnabled = false;
    if (expression === 'focused') {
      context.fillStyle = '#231a18';
      context.fillRect(21, 20, 7, 1); context.fillRect(37, 19, 7, 1);
      context.fillStyle = erase;
      context.fillRect(30, 34, 8, 2);
      context.fillStyle = '#6b3027';
      context.fillRect(31, 35, 7, 1);
    } else if (expression === 'bright') {
      context.fillStyle = '#f7fbff';
      context.fillRect(22, 23, 5, 4); context.fillRect(38, 21, 5, 4);
      context.fillStyle = '#17181c';
      context.fillRect(24, 24, 2, 2); context.fillRect(39, 22, 2, 2);
      context.fillStyle = '#743029';
      context.fillRect(30, 34, 2, 1); context.fillRect(32, 35, 6, 1); context.fillRect(38, 34, 2, 1);
    } else if (expression === 'stoic') {
      context.fillStyle = erase;
      context.fillRect(29, 33, 11, 4);
      context.fillStyle = '#64302a';
      context.fillRect(31, 35, 8, 1);
    }
  }

  function drawAccessory(context, accessory, accent) {
    const ink = '#111318';
    if (accessory === 'glasses') {
      context.fillStyle = ink;
      context.fillRect(18, 20, 11, 2); context.fillRect(17, 22, 2, 7); context.fillRect(28, 22, 2, 7); context.fillRect(19, 28, 9, 2);
      context.fillRect(35, 18, 10, 2); context.fillRect(34, 20, 2, 7); context.fillRect(44, 20, 2, 7); context.fillRect(36, 26, 8, 2);
      context.fillRect(29, 22, 6, 1);
    } else if (accessory === 'headset') {
      context.fillStyle = ink;
      context.fillRect(15, 3, 30, 3); context.fillRect(11, 6, 5, 18); context.fillRect(44, 6, 5, 18);
      context.fillStyle = accent;
      context.fillRect(10, 17, 6, 11); context.fillRect(45, 17, 6, 11);
      context.fillStyle = ink;
      context.fillRect(47, 27, 8, 2); context.fillRect(53, 28, 3, 3);
    } else if (accessory === 'earpiece') {
      context.fillStyle = '#28344a';
      context.fillRect(47, 22, 3, 7); context.fillRect(49, 28, 6, 2);
      context.fillStyle = '#7dd3fc';
      context.fillRect(48, 23, 2, 3);
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
    recolorOutfit(workContext, look.outfitColor);

    // Every combination starts from the approved Penny head silhouette. The
    // interchangeable hair, expression, skin and accessory layers sit on top.
    workContext.clearRect(0, 0, SPRITE_W, 49);
    workContext.drawImage(spriteImages.penny, 0, 0, SPRITE_W, 49, 0, 0, SPRITE_W, 49);
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
      Object.entries(HAIR_SPRITES).forEach(([style, source]) => {
        if (source) hairMasks[style] = buildHairMask(spriteImages[source]);
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
