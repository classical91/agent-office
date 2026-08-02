// Habbo Hotel Isometric Room Generator
//
// This module is the single source of truth for the office room: the tile
// grid, the viewBox, every piece of furniture, and which tile each agent
// works on. `inject_room.js` renders it into dist/index.html AND writes the
// matching geometry + station table into dist/app-shared.js, so the room and
// the agents standing in it can no longer drift apart.
//
// Everything is laid out on the tile grid, never in raw pixels:
//   tile (i, j) corner  = (OX + (i - j) * HW, OY + (i + j) * HH)
//   tile (i, j) centre  = corner of (i + 0.5, j + 0.5)
// The camera looks from +gx/+gy, so a bigger (gx + gy) is nearer the viewer.
// Every workstation puts the agent one tile *in front of* their desk, which is
// what keeps the avatars (plain DOM nodes stacked over this SVG) from covering
// furniture they are supposed to be standing behind.
//
// Furniture occupies whole tiles. A footprint is [i, j, w, d] in tiles, with
// w and d whole numbers, so nothing straddles a tile boundary. Only details
// sitting *on* a surface (a monitor, a keyboard, a mug) use fractions.
//
// The room is built by buildRoom(), which takes the grid size and wall height,
// so the same code runs at build time under Node (via inject_room.js) and live
// in the browser when the room is resized from build mode.

const DEFAULTS = {
  OX: 550,        // origin X (back corner)
  OY: 295,        // origin Y (back corner)
  HW: 36,         // half tile width
  HH: 18,         // half tile height
  gridW: 12,      // grid width (tiles)
  gridH: 9,       // grid depth (tiles)
  wallHeight: 110,
};

function buildRoom(options = {}) {
  const OX = DEFAULTS.OX;  // origin X (back corner)
    const OY = DEFAULTS.OY;  // origin Y (back corner)
    const HW = DEFAULTS.HW;  // half tile width
    const HH = DEFAULTS.HH;  // half tile height
    const GW = Math.round(options.gridW ?? DEFAULTS.gridW);   // grid width (tiles)
    const GH = Math.round(options.gridH ?? DEFAULTS.gridH);   // grid depth (tiles)

    // Heights are authored against a 40x20 tile and scaled with it, so changing
    // HW/HH rescales the whole room instead of leaving furniture the wrong height.
    const U = HH / 20;
    const WALL_H = Math.round(options.wallHeight ?? DEFAULTS.wallHeight) * U;
    const DESK_H = 22 * U;

  // Skew angle of the +gx axis, used when placing flat details on a shelf face.
  // tan = HH / HW, and skewY() shifts by x * tan, so anything drawn with the
  // transform has to subtract that shift back out of its y.
  const SKEW_DEG = Math.atan2(HH, HW) * 180 / Math.PI;
  const SKEW_TAN = HH / HW;

  function g2s(gx, gy) {
    return [OX + (gx - gy) * HW, OY + (gx + gy) * HH];
  }

  function pts(...coords) {
    return coords.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(' ');
  }

  function r1(n) { return Math.round(n * 10) / 10; }

  // ─── WORKSTATIONS ───────────────────────────────────────────────────
  // tile   — the desk's tile, one whole tile
  // orient — 'front': agent works from (i, j + 1), desk faces the viewer
  //          'side' : agent works from (i + 1, j), desk faces right
  // The agent tile is derived, never written down twice.
  const STATIONS = [
    // Back-wall bank (agents end up on row gy = 1)
    { agent: 'devin', tile: [0, 0], orient: 'front', screen: '#6366f1' },
    { agent: 'fatherclaw', tile: [1, 0], orient: 'front', screen: '#94a3b8' },
    { agent: 'command', tile: [2, 0], orient: 'front', screen: '#38bdf8' },
    { agent: 'forge', tile: [3, 0], orient: 'front', screen: '#8b5cf6' },
    { agent: 'swarm', tile: [4, 0], orient: 'front', screen: '#eab308' },
    { agent: 'penny', tile: [5, 0], orient: 'front', screen: '#f59e0b' },
    // Left-wall bank (agents end up on column gx = 1)
    { agent: 'traderclaw', tile: [0, 3], orient: 'side', screen: '#22c55e' },
    { agent: 'webclaw', tile: [0, 4], orient: 'side', screen: '#3b82f6' },
    { agent: 'lyra', tile: [0, 5], orient: 'side', screen: '#a855f7' },
    { agent: 'reaper', tile: [0, 6], orient: 'side', screen: '#78716c' },
    // Right island (agents end up on row gy = 5)
    { agent: 'xhunter', tile: [8, 4], orient: 'front', screen: '#06b6d4' },
    { agent: 'xbot', tile: [9, 4], orient: 'front', screen: '#ec4899' },
    { agent: 'guardian', tile: [10, 4], orient: 'front', screen: '#ef4444' },
  ];

  // Where an agent stands, given the desk they work at.
  function agentTile(station) {
    const [i, j] = station.tile;
    return station.orient === 'front'
      ? { gx: i, gy: j + 1, facing: 'N' }
      : { gx: i + 1, gy: j, facing: 'W' };
  }

  // ─── FLOOR PLAN ─────────────────────────────────────────────────────
  // Every piece of floor furniture registers its footprint in whole tiles, which
  // is then checked against the agent tiles. Agents are DOM nodes stacked over
  // this SVG, so anything standing between an agent and the camera would be
  // painted over by that agent — the checks below catch it at build time instead
  // of leaving it to be spotted in a screenshot.
  const FURNITURE = [];

  // i, j, w, d in whole tiles. `flat` marks something with no height (a rug),
  // which can sit anywhere because nothing can be drawn "in front of" it.
  function place(name, i, j, w, d, { flat = false } = {}) {
    FURNITURE.push({ name, i, j, w, d, flat });
    return { i, j, w, d };
  }

  function tilesOf({ i, j, w, d }) {
    const out = [];
    for (let y = j; y < j + d; y++) for (let x = i; x < i + w; x++) out.push(`${x},${y}`);
    return out;
  }

  // The smallest grid this layout still fits on, derived from the furniture and
  // the agent tiles rather than written down separately.
  function minimumSize() {
    let w = 1, h = 1;
    FURNITURE.forEach(f => { w = Math.max(w, f.i + f.w); h = Math.max(h, f.j + f.d); });
    STATIONS.forEach(s => {
      const a = agentTile(s);
      w = Math.max(w, a.gx + 1);
      h = Math.max(h, a.gy + 1);
    });
    return { gridW: w, gridH: h };
  }

  function validateFloorPlan() {
    const problems = [];
    const agentTiles = new Map();
    STATIONS.forEach(s => {
      const a = agentTile(s);
      agentTiles.set(`${a.gx},${a.gy}`, s.agent);
    });

    // Two agents must never share a tile.
    const seen = new Set();
    STATIONS.forEach(s => {
      const a = agentTile(s);
      const key = `${a.gx},${a.gy}`;
      if (seen.has(key)) problems.push(`two agents share tile ${key}`);
      seen.add(key);
      if (a.gx < 0 || a.gx >= GW || a.gy < 0 || a.gy >= GH) {
        problems.push(`${s.agent} stands on ${key}, outside the ${GW}x${GH} floor`);
      }
    });

    // Tiles between an agent and the camera: +gy, +gx and the diagonal.
    const protectedTiles = new Map();
    agentTiles.forEach((agent, key) => {
      const [gx, gy] = key.split(',').map(Number);
      [[gx, gy + 1], [gx + 1, gy], [gx + 1, gy + 1]].forEach(([x, y]) => {
        if (!agentTiles.has(`${x},${y}`)) protectedTiles.set(`${x},${y}`, agent);
      });
    });

    const occupied = new Map();
    FURNITURE.forEach(f => {
      if (![f.i, f.j, f.w, f.d].every(n => Number.isInteger(n))) {
        problems.push(`${f.name} footprint [${f.i},${f.j},${f.w},${f.d}] is not whole tiles`);
      }
      if (f.i < 0 || f.j < 0 || f.i + f.w > GW || f.j + f.d > GH) {
        problems.push(`${f.name} footprint [${f.i},${f.j},${f.w},${f.d}] falls off the ${GW}x${GH} floor`);
      }
      tilesOf(f).forEach(key => {
        if (f.flat) return;
        if (occupied.has(key)) problems.push(`${f.name} overlaps ${occupied.get(key)} on tile ${key}`);
        occupied.set(key, f.name);
        if (agentTiles.has(key)) problems.push(`${f.name} sits on ${agentTiles.get(key)}'s tile ${key}`);
        if (protectedTiles.has(key)) {
          problems.push(`${f.name} on tile ${key} stands in front of ${protectedTiles.get(key)} and would be drawn over`);
        }
      });
    });

    // Throwing rather than exiting: this runs in the browser too, where the
    // build panel catches it and refuses the change instead of killing the page.
    if (problems.length) {
      const err = new Error('Floor plan is invalid:\n  - ' + problems.join('\n  - '));
      err.problems = problems;
      throw err;
    }
  }

  const lines = [];

  function emit(s) { lines.push(s); }

  // ─── DEFS ────────────────────────────────────────────────────────────
  emit('<defs>');

  // Wall stripe pattern
  emit(`  <pattern id="wallstripe" x="0" y="0" width="20" height="40" patternUnits="userSpaceOnUse" patternTransform="skewX(-26)">
      <rect width="20" height="40" fill="var(--wall-a, #C8B8E8)"/>
      <rect x="0" y="0" width="8" height="40" fill="var(--wall-b, #BCA8DC)" opacity="0.5"/>
    </pattern>`);

  // Wall stripe pattern right side (skew other way)
  emit(`  <pattern id="wallstripeR" x="0" y="0" width="20" height="40" patternUnits="userSpaceOnUse" patternTransform="skewX(26)">
      <rect width="20" height="40" fill="var(--wall-ra, #B8A8D8)"/>
      <rect x="0" y="0" width="8" height="40" fill="var(--wall-rb, #AC9CCC)" opacity="0.5"/>
    </pattern>`);

  // Radial gradient for floor lighting
  const [fcx, fcy] = g2s(GW / 2, GH / 2);
  emit(`  <radialGradient id="floorLight" cx="${r1(fcx)}" cy="${r1(fcy)}" r="${r1(300 * U)}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="60%" stop-color="#ffffff" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.1"/>
    </radialGradient>`);

  // Screen glow
  emit(`  <filter id="screenGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`);

  // Plant shadow
  emit(`  <radialGradient id="shadowGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>`);

  emit('</defs>');

  // ─── WALLS ──────────────────────────────────────────────────────────

  const backCorner = g2s(0, 0);
  const rightBack = g2s(GW, 0);
  const leftFront = g2s(0, GH);

  // Left (west) wall face
  const wlTL = [backCorner[0], backCorner[1] - WALL_H];
  const wlBL = [leftFront[0], leftFront[1] - WALL_H];
  emit(`<polygon points="${pts(wlTL, wlBL, leftFront, backCorner)}" fill="url(#wallstripe)"/>`);
  emit(`<polygon points="${pts(wlTL, wlBL, leftFront, backCorner)}" fill="var(--wall-shade, #8878b8)" opacity="0.28"/>`);

  // North (back) wall face
  const wnTR = [rightBack[0], rightBack[1] - WALL_H];
  emit(`<polygon points="${pts(wlTL, wnTR, rightBack, backCorner)}" fill="url(#wallstripeR)"/>`);
  emit(`<polygon points="${pts(wlTL, wnTR, rightBack, backCorner)}" fill="#ffffff" opacity="0.06"/>`);

  // Wall top edge lines
  emit(`<line x1="${r1(wlTL[0])}" y1="${r1(wlTL[1])}" x2="${r1(wlBL[0])}" y2="${r1(wlBL[1])}" stroke="#a090c8" stroke-width="1.2"/>`);
  emit(`<line x1="${r1(wlTL[0])}" y1="${r1(wlTL[1])}" x2="${r1(wnTR[0])}" y2="${r1(wnTR[1])}" stroke="#b0a0d0" stroke-width="1.2"/>`);
  emit(`<line x1="${r1(wlBL[0])}" y1="${r1(wlBL[1])}" x2="${r1(leftFront[0])}" y2="${r1(leftFront[1])}" stroke="#7060a0" stroke-width="1"/>`);
  emit(`<line x1="${r1(wnTR[0])}" y1="${r1(wnTR[1])}" x2="${r1(rightBack[0])}" y2="${r1(rightBack[1])}" stroke="#9080b8" stroke-width="1"/>`);

  // Corner pillar line
  emit(`<line x1="${r1(backCorner[0])}" y1="${r1(backCorner[1])}" x2="${r1(wlTL[0])}" y2="${r1(wlTL[1])}" stroke="#c0b0e0" stroke-width="1.5"/>`);

  // ─── WALL DECORATIONS ───────────────────────────────────────────────
  // Wall fittings span whole tiles along the wall they hang on.

  // Windows on the LEFT wall, above the left-hand desk bank
  function wallWindow(gyFrom, gyTo) {
    const base1 = g2s(0, gyFrom);
    const base2 = g2s(0, gyTo);
    const t1 = [base1[0], base1[1] - 78 * U];
    const t2 = [base2[0], base2[1] - 78 * U];
    const b1 = [base1[0], base1[1] - 30 * U];
    const b2 = [base2[0], base2[1] - 30 * U];
    emit(`<polygon points="${pts(t1, t2, b2, b1)}" fill="var(--view-bg)" stroke="var(--border)" stroke-width="0.8"/>`);
    emit(`<polygon points="${pts(t1, t2, b2, b1)}" fill="#1e3a5f" opacity="0.5"/>`);
    const mid1 = [(t1[0] + t2[0]) / 2, (t1[1] + t2[1]) / 2];
    const mid2 = [(b1[0] + b2[0]) / 2, (b1[1] + b2[1]) / 2];
    emit(`<line x1="${r1(mid1[0])}" y1="${r1(mid1[1])}" x2="${r1(mid2[0])}" y2="${r1(mid2[1])}" stroke="var(--border)" stroke-width="0.6"/>`);
    emit(`<line x1="${r1(t1[0])}" y1="${r1((t1[1] + b1[1]) / 2)}" x2="${r1(t2[0])}" y2="${r1((t2[1] + b2[1]) / 2)}" stroke="var(--border)" stroke-width="0.6"/>`);
    emit(`<polygon points="${pts(t1, t2, [t2[0], t2[1] + 12 * U], [t1[0], t1[1] + 12 * U])}" fill="#87ceeb" opacity="0.15"/>`);
  }
  wallWindow(2, 4);
  wallWindow(4, 6);

  // Presentation screen on the LEFT wall, over the lounge end. It stops a tile
  // short of GH: a fitting that runs to the very end of a wall lines up with the
  // point where the wall tapers out, and reads as hanging off the room.
  {
    const base1 = g2s(0, 6);
    const base2 = g2s(0, 8);
    const t1 = [base1[0], base1[1] - 92 * U];
    const t2 = [base2[0], base2[1] - 92 * U];
    const b1 = [base1[0], base1[1] - 32 * U];
    const b2 = [base2[0], base2[1] - 32 * U];
    emit(`<polygon points="${pts(t1, t2, b2, b1)}" fill="var(--view-bg)" stroke="var(--border)" stroke-width="1"/>`);
    const inset = 4;
    const it1 = [t1[0] + inset, t1[1] + inset];
    const it2 = [t2[0] - inset, t2[1] + inset];
    const ib1 = [b1[0] + inset, b1[1] - inset];
    const ib2 = [b2[0] - inset, b2[1] - inset];
    emit(`<polygon points="${pts(it1, it2, ib2, ib1)}" fill="#1a2a3a"/>`);
    for (let i = 0; i < 4; i++) {
      const y1 = it1[1] + (it2[1] - it1[1]) * (i + 1) / 5;
      const y2 = ib1[1] + (ib2[1] - ib1[1]) * (i + 1) / 5;
      const x1 = it1[0] + (ib1[0] - it1[0]) * (i + 1) / 5;
      const x2 = it2[0] + (ib2[0] - it2[0]) * (i + 1) / 5;
      emit(`<line x1="${r1(x1 + 4)}" y1="${r1((y1 + y2) / 2)}" x2="${r1(x2 - 4)}" y2="${r1((y1 + y2) / 2 + 2)}" stroke="#00ff88" stroke-width="0.8" opacity="0.7"/>`);
    }
    emit(`<polygon points="${pts(it1, [it2[0], it2[1]], [it2[0], it2[1] + 8], [it1[0], it1[1] + 8])}" fill="var(--accent)" opacity="0.7"/>`);
  }

  // Clock on the back wall, centred over the tile between desks and shelves
  {
    const base = g2s(6.5, 0);
    const cx = base[0];
    const cy = base[1] - 58 * U;
    const r = 14 * U;
    emit(`<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="#1e1a2e" stroke="#5040a0" stroke-width="1.5"/>`);
    emit(`<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r * 0.79)}" fill="#2a2444"/>`);
    emit(`<line x1="${r1(cx)}" y1="${r1(cy)}" x2="${r1(cx)}" y2="${r1(cy - r * 0.57)}" stroke="#c0b0e0" stroke-width="1.5" stroke-linecap="round"/>`);
    emit(`<line x1="${r1(cx)}" y1="${r1(cy)}" x2="${r1(cx + r * 0.43)}" y2="${r1(cy + r * 0.14)}" stroke="#c0b0e0" stroke-width="1" stroke-linecap="round"/>`);
    emit(`<circle cx="${r1(cx)}" cy="${r1(cy)}" r="1.5" fill="var(--accent)"/>`);
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 - 90) * Math.PI / 180;
      emit(`<circle cx="${r1(cx + Math.cos(angle) * r * 0.64)}" cy="${r1(cy + Math.sin(angle) * r * 0.64)}" r="0.8" fill="#7060a0"/>`);
    }
  }

  // ─── FLOOR TILES ────────────────────────────────────────────────────

  emit(`<g id="floor-tiles">`);
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const [tx, ty] = g2s(gx, gy);
      const [rx, ry] = g2s(gx + 1, gy);
      const [bx, by] = g2s(gx + 1, gy + 1);
      const [lx, ly] = g2s(gx, gy + 1);
      const even = (gx + gy) % 2 === 0;
      const color = even ? 'var(--tile-a, #7B6FA0)' : 'var(--tile-b, #6B5F90)';
      emit(`  <polygon points="${r1(tx)},${r1(ty)} ${r1(rx)},${r1(ry)} ${r1(bx)},${r1(by)} ${r1(lx)},${r1(ly)}" fill="${color}"/>`);
    }
  }
  // Tile grid lines (subtle)
  emit(`  <g stroke="var(--tile-line, #5a5080)" stroke-width="0.4" opacity="0.5">`);
  for (let gy = 0; gy <= GH; gy++) {
    const [ax, ay] = g2s(0, gy);
    const [bx, by] = g2s(GW, gy);
    emit(`    <line x1="${r1(ax)}" y1="${r1(ay)}" x2="${r1(bx)}" y2="${r1(by)}"/>`);
  }
  for (let gx = 0; gx <= GW; gx++) {
    const [ax, ay] = g2s(gx, 0);
    const [bx, by] = g2s(gx, GH);
    emit(`    <line x1="${r1(ax)}" y1="${r1(ay)}" x2="${r1(bx)}" y2="${r1(by)}"/>`);
  }
  emit(`  </g>`);
  emit(`</g>`);

  // ─── FLOOR LIGHTING OVERLAY ─────────────────────────────────────────
  emit(`<polygon points="${pts(g2s(0, 0), g2s(GW, 0), g2s(GW, GH), g2s(0, GH))}" fill="url(#floorLight)"/>`);

  // ─── CARPET / RUG ───────────────────────────────────────────────────
  {
    const rug = place('rug', 5, 6, 4, 3, { flat: true });
    const { i, j, w, d } = rug;
    emit(`<polygon points="${pts(g2s(i, j), g2s(i + w, j), g2s(i + w, j + d), g2s(i, j + d))}" fill="var(--rug-fill, #3d2060)" opacity="0.55"/>`);
    emit(`<polygon points="${pts(g2s(i + 0.25, j + 0.25), g2s(i + w - 0.25, j + 0.25), g2s(i + w - 0.25, j + d - 0.25), g2s(i + 0.25, j + d - 0.25))}" fill="none" stroke="var(--rug-line, #7030a0)" stroke-width="1.5" opacity="0.6"/>`);
  }

  // ─── FURNITURE ──────────────────────────────────────────────────────
  // Isometric box occupying (gx, gy) → (gx + w, gy + d), h SVG px tall.
  // Only the two faces the camera can actually see are drawn: the one at
  // gy + d (down-left on screen) and the one at gx + w (down-right).
  function isoBox(gx, gy, w, d, h, topColor, leftColor, rightColor, extra = '') {
    const tl = g2s(gx, gy);
    const tr = g2s(gx + w, gy);
    const br = g2s(gx + w, gy + d);
    const bl = g2s(gx, gy + d);

    const ftl = [tl[0], tl[1] - h];
    const ftr = [tr[0], tr[1] - h];
    const fbr = [br[0], br[1] - h];
    const fbl = [bl[0], bl[1] - h];

    const out = [];
    out.push(`<polygon points="${pts(fbl, fbr, br, bl)}" fill="${leftColor}"${extra}/>`);
    out.push(`<polygon points="${pts(ftr, fbr, br, tr)}" fill="${rightColor}"${extra}/>`);
    out.push(`<polygon points="${pts(ftl, ftr, fbr, fbl)}" fill="${topColor}"${extra}/>`);
    return out.join('\n');
  }

  // ─── BOOKSHELF (back wall, tiles 8-9) ───────────────────────────────
  emit(`<!-- Bookshelf -->`);
  function bookshelf(i, j, w) {
    const h = 80 * U;
    emit(isoBox(i, j, w, 1, h, '#6b4010', '#5a3510', '#4a2e08'));

    // Shelves + books sit on the front-left face (the one at j + 1).
    const faceL = g2s(i, j + 1);
    const faceR = g2s(i + w, j + 1);
    const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
    const bandH = h / 3;
    for (let s = 0; s < 3; s++) {
      const ledgeY = -h + (s + 1) * bandH;
      emit(`<line x1="${r1(faceL[0])}" y1="${r1(faceL[1] + ledgeY)}" x2="${r1(faceR[0])}" y2="${r1(faceR[1] + ledgeY)}" stroke="#7a4a10" stroke-width="1"/>`);
      const bookCount = 14 * w;
      for (let b = 0; b < bookCount; b++) {
        const t = (b + 0.6) / (bookCount + 0.2);
        const bx = faceL[0] + t * (faceR[0] - faceL[0]);
        const bh = bandH - 10 * U - (b % 3) * 2 * U;
        const by = faceL[1] + t * (faceR[1] - faceL[1]) + ledgeY - 3 - bh;
        // skewY shifts everything by x * tan, so take that back out of y.
        emit(`<rect x="${r1(bx)}" y="${r1(by - bx * SKEW_TAN)}" width="3" height="${r1(bh)}" fill="${colors[(s * 5 + b) % colors.length]}" transform="skewY(${Math.round(SKEW_DEG * 1000) / 1000})" opacity="0.85"/>`);
      }
    }
  }
  { const s = place('bookshelf', 8, 0, 2, 1); bookshelf(s.i, s.j, s.w); }

  // ─── WORKSTATION DESKS ──────────────────────────────────────────────
  emit(`<!-- Workstation desks -->`);

  const DESK_TOP = '#A07840';
  const DESK_LEFT = '#7A5020';
  const DESK_RIGHT = '#8B6030';
  const LEG_COLOR = '#4a3010';

  // A monitor standing on the desk surface, drawn as a flat quad between two
  // grid points. `a` and `b` are grid coords of the screen's bottom edge.
  function monitor(a, b, screenColor) {
    const p1 = g2s(a[0], a[1]);
    const p2 = g2s(b[0], b[1]);
    const bottom = [[p1[0], p1[1] - DESK_H - 3 * U], [p2[0], p2[1] - DESK_H - 3 * U]];
    const top = [[p1[0], p1[1] - DESK_H - 25 * U], [p2[0], p2[1] - DESK_H - 25 * U]];
    const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    emit(`<rect x="${r1(mid[0] - 1.5)}" y="${r1(mid[1] - DESK_H - 5 * U)}" width="3" height="${r1(6 * U)}" fill="#2a2a3a"/>`);
    emit(`<polygon points="${pts(top[0], top[1], bottom[1], bottom[0])}" fill="#1a2a3a"/>`);
    emit(`<polygon points="${pts([top[0][0] + 2, top[0][1] + 2], [top[1][0] - 2, top[1][1] + 2], [bottom[1][0] - 2, bottom[1][1] - 2], [bottom[0][0] + 2, bottom[0][1] - 2])}" fill="${screenColor}" opacity="0.5" filter="url(#screenGlow)"/>`);
    for (let sl = 0; sl < 3; sl++) {
      const t = (sl + 1) / 4;
      const sx1 = top[0][0] + t * (bottom[0][0] - top[0][0]) + 2;
      const sy1 = top[0][1] + t * (bottom[0][1] - top[0][1]);
      const sx2 = top[1][0] + t * (bottom[1][0] - top[1][0]) - 2;
      const sy2 = top[1][1] + t * (bottom[1][1] - top[1][1]);
      emit(`<line x1="${r1(sx1)}" y1="${r1(sy1)}" x2="${r1(sx2)}" y2="${r1(sy2)}" stroke="${screenColor}" stroke-width="0.6" opacity="0.4"/>`);
    }
    emit(`<polygon points="${pts(top[0], top[1], bottom[1], bottom[0])}" fill="none" stroke="var(--border)" stroke-width="0.8"/>`);
  }

  // Keyboards lie flat on the desk surface, so they are a single face at desk
  // height rather than a box standing on the floor.
  function keyboard(gx, gy, w, d) {
    const lift = DESK_H + 1;
    const a = g2s(gx, gy), b = g2s(gx + w, gy), c = g2s(gx + w, gy + d), e = g2s(gx, gy + d);
    const flat = [[a[0], a[1] - lift], [b[0], b[1] - lift], [c[0], c[1] - lift], [e[0], e[1] - lift]];
    emit(`<polygon points="${pts(...flat)}" fill="#cbd5e1" stroke="#8fa0b4" stroke-width="0.5"/>`);
    emit(`<polygon points="${pts(...flat)}" fill="#0f172a" opacity="0.25"/>`);
  }

  function mug(gx, gy) {
    const [cx, cy] = g2s(gx, gy);
    emit(`<ellipse cx="${r1(cx)}" cy="${r1(cy - DESK_H - 6 * U)}" rx="${r1(3.4 * U)}" ry="${r1(1.7 * U)}" fill="#fff" opacity="0.9"/>`);
    emit(`<rect x="${r1(cx - 2.6 * U)}" y="${r1(cy - DESK_H - 11 * U)}" width="${r1(5.2 * U)}" height="${r1(6 * U)}" fill="#fff" opacity="0.9" rx="1"/>`);
    emit(`<rect x="${r1(cx + 2 * U)}" y="${r1(cy - DESK_H - 9 * U)}" width="${r1(2.6 * U)}" height="${r1(3 * U)}" fill="none" stroke="#ccc" stroke-width="0.7" rx="1"/>`);
  }

  // One desk fills exactly one tile, so its front edge meets the agent's tile.
  function workstation(tile, orient, screenColor) {
    const [i, j] = tile;
    emit(isoBox(i, j, 1, 1, DESK_H, DESK_TOP, DESK_LEFT, DESK_RIGHT));

    // Legs at the two corners nearest the camera
    const legs = orient === 'front'
      ? [g2s(i, j + 1), g2s(i + 1, j + 1)]
      : [g2s(i + 1, j), g2s(i + 1, j + 1)];
    legs.forEach(([lx, ly]) => {
      emit(`<rect x="${r1(lx - 1.2)}" y="${r1(ly - 14 * U)}" width="2.4" height="${r1(14 * U)}" fill="${LEG_COLOR}"/>`);
    });

    if (orient === 'front') {
      // Monitor along the back edge, keyboard + mug on the agent's side
      monitor([i + 0.18, j + 0.22], [i + 0.82, j + 0.22], screenColor);
      keyboard(i + 0.24, j + 0.62, 0.52, 0.18);
      mug(i + 0.86, j + 0.68);
    } else {
      // Monitor down the far edge, keyboard + mug on the agent's side
      monitor([i + 0.22, j + 0.18], [i + 0.22, j + 0.82], screenColor);
      keyboard(i + 0.62, j + 0.24, 0.18, 0.52);
      mug(i + 0.68, j + 0.86);
    }
  }

  STATIONS.forEach(s => {
    place(`${s.agent}'s desk`, s.tile[0], s.tile[1], 1, 1);
    workstation(s.tile, s.orient, s.screen);
  });

  // ─── MEETING TABLE (2x2 tiles) ──────────────────────────────────────
  emit(`<!-- Meeting Table -->`);
  {
    const t = place('meeting table', 6, 6, 2, 2);
    const cx = t.i + 1, cy = t.j + 1, r = 1;   // centred on the shared tile corner
    const tableH = 18 * U;
    // Floor-plane outline of the table, then the same ring lifted to table
    // height. Everything else in the room is built by isoBox, which raises the
    // top face and drops the sides *to* the floor; this used to draw its top at
    // floor level and hang the skirt below it, which pushed the table through the
    // floor and out of the room at the front edge.
    const footprint = [
      g2s(cx - r / 2, cy - r), g2s(cx + r / 2, cy - r), g2s(cx + r, cy - r / 2), g2s(cx + r, cy + r / 2),
      g2s(cx + r / 2, cy + r), g2s(cx - r / 2, cy + r), g2s(cx - r, cy + r / 2), g2s(cx - r, cy - r / 2)
    ];
    const tableTopPts = footprint.map(([x, y]) => [x, y - tableH]);
    // Skirt on the four edges facing the camera, from the raised top down to the
    // floor the table actually stands on.
    for (let i = 3; i < 7; i++) {
      const top1 = tableTopPts[i];
      const top2 = tableTopPts[(i + 1) % tableTopPts.length];
      const base1 = footprint[i];
      const base2 = footprint[(i + 1) % footprint.length];
      emit(`<polygon points="${pts(top1, top2, base2, base1)}" fill="${i < 5 ? '#7a4820' : '#5a3010'}"/>`);
    }
    emit(`<polygon points="${pts(...tableTopPts)}" fill="#8B5E2A"/>`);
    emit(`<polygon points="${pts(...tableTopPts)}" fill="#A06830" opacity="0.6"/>`);
    emit(`<polygon points="${pts(...tableTopPts)}" fill="none" stroke="#c09040" stroke-width="1" opacity="0.5"/>`);
    const [tcx, tcy] = g2s(cx, cy);
    emit(`<ellipse cx="${r1(tcx)}" cy="${r1(tcy - tableH)}" rx="${r1(HW * 0.6)}" ry="${r1(HH * 0.6)}" fill="none" stroke="#c09040" stroke-width="0.8" opacity="0.4"/>`);

    const seats = [g2s(cx - 0.45, cy - 0.45), g2s(cx + 0.45, cy - 0.45), g2s(cx - 0.45, cy + 0.45), g2s(cx + 0.45, cy + 0.45)];
    const colors = ['var(--accent)', '#22c55e', '#f59e0b', '#ec4899'];
    seats.forEach(([lx, ly], i) => {
      const ty = ly - tableH;
      emit(`<rect x="${r1(lx - 5.5 * U)}" y="${r1(ty - 11 * U)}" width="${r1(11 * U)}" height="${r1(7.5 * U)}" fill="#1a2030" rx="1"/>`);
      emit(`<rect x="${r1(lx - 4.5 * U)}" y="${r1(ty - 10 * U)}" width="${r1(9 * U)}" height="${r1(5.5 * U)}" fill="${colors[i]}" opacity="0.35"/>`);
    });
  }

  // ─── SOFA ───────────────────────────────────────────────────────────
  emit(`<!-- Sofa -->`);
  {
    const s = place('sofa', 3, 7, 2, 1);
    const sx = s.i, sy = s.j;
    emit(isoBox(sx, sy, 2, 0.4, 30 * U, '#6b1d1d', '#5a1818', '#4a1010'));       // back
    emit(isoBox(sx, sy + 0.35, 2, 0.65, 16 * U, '#991b1b', '#7f1d1d', '#6b1010')); // seat
    emit(isoBox(sx, sy, 0.3, 1, 22 * U, '#7a1a1a', '#661414', '#551010'));        // armrest
    emit(isoBox(sx + 1.7, sy, 0.3, 1, 22 * U, '#7a1a1a', '#661414', '#551010'));  // armrest
    const [csx, csy] = g2s(sx + 1, sy + 0.35);
    const [cex, cey] = g2s(sx + 1, sy + 1);
    emit(`<line x1="${r1(csx)}" y1="${r1(csy - 16 * U)}" x2="${r1(cex)}" y2="${r1(cey - 16 * U)}" stroke="#c04040" stroke-width="1" opacity="0.5"/>`);
  }

  // ─── COFFEE TABLE ───────────────────────────────────────────────────
  emit(`<!-- Coffee Table -->`);
  {
    const { i, j } = place('coffee table', 4, 8, 1, 1);
    emit(isoBox(i + 0.1, j + 0.1, 0.8, 0.8, 10 * U, '#7a5030', '#5a3820', '#4a2810'));
    emit(`<polygon points="${pts(g2s(i + 0.3, j + 0.3), g2s(i + 0.7, j + 0.3), g2s(i + 0.7, j + 0.65), g2s(i + 0.3, j + 0.65))}" fill="#3b82f6" opacity="0.7"/>`);
  }

  // ─── SERVER RACKS (back wall, tiles 10 and 11) ──────────────────────
  emit(`<!-- Server racks -->`);
  function serverRack(i, j) {
    const h = 64 * U;
    emit(isoBox(i + 0.1, j + 0.1, 0.8, 0.8, h, '#334155', '#1e293b', '#0f172a'));
    const faceL = g2s(i + 0.1, j + 0.9);
    const faceR = g2s(i + 0.9, j + 0.9);
    for (let row = 0; row < 6; row++) {
      const y = -h + 8 * U + row * 9 * U;
      emit(`<line x1="${r1(faceL[0] + 4)}" y1="${r1(faceL[1] + y)}" x2="${r1(faceR[0] - 4)}" y2="${r1(faceR[1] + y)}" stroke="#0b1220" stroke-width="3"/>`);
      const t = 0.24 + (row % 3) * 0.22;
      emit(`<circle cx="${r1(faceL[0] + t * (faceR[0] - faceL[0]))}" cy="${r1(faceL[1] + t * (faceR[1] - faceL[1]) + y)}" r="1.1" fill="${row % 2 ? '#22c55e' : '#38bdf8'}"/>`);
    }
  }
  [10, 11].forEach((i, n) => {
    const s = place(`server rack ${n + 1}`, i, 0, 1, 1);
    serverRack(s.i, s.j);
  });

  // ─── WATER COOLER ───────────────────────────────────────────────────
  emit(`<!-- Water cooler -->`);
  {
    const { i, j } = place('water cooler', 7, 0, 1, 1);
    emit(isoBox(i + 0.3, j + 0.3, 0.4, 0.4, 26 * U, '#e2e8f0', '#94a3b8', '#cbd5e1'));
    const [bx, by] = g2s(i + 0.5, j + 0.5);
    emit(`<ellipse cx="${r1(bx)}" cy="${r1(by - 42 * U)}" rx="${r1(9 * U)}" ry="${r1(4.5 * U)}" fill="#7dd3fc" opacity="0.75"/>`);
    emit(`<rect x="${r1(bx - 9 * U)}" y="${r1(by - 42 * U)}" width="${r1(18 * U)}" height="${r1(16 * U)}" fill="#7dd3fc" opacity="0.6"/>`);
    emit(`<ellipse cx="${r1(bx)}" cy="${r1(by - 26 * U)}" rx="${r1(9 * U)}" ry="${r1(4.5 * U)}" fill="#38bdf8" opacity="0.7"/>`);
  }

  // ─── PRINTER (at the end of the island) ─────────────────────────────
  emit(`<!-- Printer -->`);
  {
    const { i, j } = place('printer', 11, 4, 1, 1);
    emit(isoBox(i + 0.1, j + 0.15, 0.8, 0.7, 24 * U, '#475569', '#1e293b', '#334155'));
    const tray = [g2s(i + 0.25, j + 0.3), g2s(i + 0.75, j + 0.3), g2s(i + 0.75, j + 0.7), g2s(i + 0.25, j + 0.7)]
      .map(([x, y]) => [x, y - 27 * U]);
    emit(`<polygon points="${pts(...tray)}" fill="#f8fafc" opacity="0.9"/>`);
    const [px, py] = g2s(i + 0.3, j + 0.85);
    emit(`<circle cx="${r1(px)}" cy="${r1(py - 12 * U)}" r="1.4" fill="#22c55e"/>`);
  }

  // ─── PLANTS ─────────────────────────────────────────────────────────
  // Each stands in the middle of its own tile.
  emit(`<!-- Plants -->`);
  function plant(i, j, size = 1) {
    place(`plant ${i},${j}`, i, j, 1, 1);
    const s = size * U;
    const [px, py] = g2s(i + 0.5, j + 0.5);
    emit(`<polygon points="${pts([px - 6 * s, py], [px + 6 * s, py + 3 * s], [px + 4 * s, py + 10 * s], [px - 4 * s, py + 7 * s])}" fill="#8B4513"/>`);
    emit(`<ellipse cx="${r1(px)}" cy="${r1(py - 8 * s)}" rx="${r1(14 * s)}" ry="${r1(8 * s)}" fill="#2D5A27"/>`);
    emit(`<ellipse cx="${r1(px - 6 * s)}" cy="${r1(py - 14 * s)}" rx="${r1(9 * s)}" ry="${r1(6 * s)}" fill="#3D7A35"/>`);
    emit(`<ellipse cx="${r1(px + 5 * s)}" cy="${r1(py - 16 * s)}" rx="${r1(10 * s)}" ry="${r1(7 * s)}" fill="#2D5A27"/>`);
    emit(`<ellipse cx="${r1(px)}" cy="${r1(py - 20 * s)}" rx="${r1(8 * s)}" ry="${r1(5 * s)}" fill="#4a8a3d"/>`);
    emit(`<ellipse cx="${r1(px - 3 * s)}" cy="${r1(py - 18 * s)}" rx="${r1(4 * s)}" ry="${r1(3 * s)}" fill="#5aaa4d" opacity="0.5"/>`);
    emit(`<ellipse cx="${r1(px)}" cy="${r1(py + 4 * s)}" rx="${r1(8 * s)}" ry="${r1(3 * s)}" fill="url(#shadowGrad)"/>`);
  }

  plant(6, 0, 1);      // back wall, under the clock
  plant(11, 1, 0.9);   // right of the shelves
  plant(0, 8, 0.85);   // front-left corner
  plant(11, 7, 0.9);   // front-right corner
  plant(2, 8, 0.85);   // lounge end

// ─── VALIDATE & RETURN ──────────────────────────────────────────────
  validateFloorPlan();

  // The viewBox is cropped to what the room actually covers — walls at the top,
  // the floor's front corner at the bottom — so the room fills its panel instead
  // of floating in dead space. A little padding keeps plants and shadows inside.
  const PAD = 10;
  const bounds = {
    minX: g2s(0, GH)[0] - 20,
    maxX: g2s(GW, 0)[0] + PAD,
    minY: OY - WALL_H - PAD,
    maxY: g2s(GW, GH)[1] + PAD,
  };
  const viewBox = {
    x: Math.round(bounds.minX),
    y: Math.round(bounds.minY),
    w: Math.round(bounds.maxX - bounds.minX),
    h: Math.round(bounds.maxY - bounds.minY),
  };

  return {
    svg: lines.join('\n'),
    geometry: { OX, OY, HW, HH, GW, GH, viewBox, ...minimumSize() },
    // agent id → the tile that agent works from, derived from their desk.
    stations: STATIONS.map(s => ({ agent: s.agent, ...agentTile(s) })),
  };
}

// Works as a CommonJS module under Node and as a global in the browser, so the
// build step and the live editor share one implementation.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildRoom, DEFAULTS };
}
if (typeof window !== 'undefined') {
  window.OfficeRoom = { buildRoom, DEFAULTS };
}
