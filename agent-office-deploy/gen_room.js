// Habbo Hotel Isometric Room Generator
// Outputs SVG content to replace inside <svg id="officesvg" ...>
//
// Everything in here is laid out on the tile grid — never in raw pixels — so the
// room and the agents (positioned by app-shared.js) agree on where a tile is.
//   tile (i, j) corner  = (OX + (i - j) * HW, OY + (i + j) * HH)
//   tile (i, j) centre  = corner of (i + 0.5, j + 0.5)
// The camera looks from +gx/+gy, so a bigger (gx + gy) is nearer the viewer:
// every workstation puts the agent one tile *in front of* their desk, which is
// what keeps the avatars (plain DOM nodes stacked over this SVG) from covering
// furniture they are supposed to be standing behind.

const OX = 550;  // origin X (back corner)
const OY = 295;  // origin Y (back corner)
const HW = 40;   // half tile width
const HH = 20;   // half tile height
const GW = 12;   // grid width (tiles)
const GH = 9;    // grid height/depth (tiles)
const WALL_H = 110; // wall height in SVG px

// Skew angle of the +gx axis, used when placing flat details on a wall/shelf
// face. tan = HH / HW, and skewY() shifts by x * tan, so anything drawn with
// the transform has to subtract that shift back out of its y.
const SKEW_DEG = Math.atan2(HH, HW) * 180 / Math.PI;
const SKEW_TAN = HH / HW;

function g2s(gx, gy) {
  return [OX + (gx - gy) * HW, OY + (gx + gy) * HH];
}

function pts(...coords) {
  return coords.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(' ');
}

// ─── WORKSTATIONS ───────────────────────────────────────────────────
// The single source of truth for where desks go. `AGENT_STATIONS` in
// agent-office-deploy/dist/app-shared.js mirrors the agent tiles below; the two
// lists have to be edited together.
//
//   tile   — the desk's tile
//   orient — 'front': agent sits on (gx, gy + 1), desk faces the viewer
//            'side' : agent sits on (gx + 1, gy), desk faces right
const STATIONS = [
  // Back-wall bank (agents on row gy = 1)
  { tile: [0, 0], orient: 'front', screen: '#6366f1' }, // Devin
  { tile: [1, 0], orient: 'front', screen: '#94a3b8' }, // FatherClaw
  { tile: [2, 0], orient: 'front', screen: '#38bdf8' }, // Command
  { tile: [3, 0], orient: 'front', screen: '#8b5cf6' }, // Forge
  { tile: [4, 0], orient: 'front', screen: '#eab308' }, // Swarm
  { tile: [5, 0], orient: 'front', screen: '#f59e0b' }, // Penny
  // Left-wall bank (agents on column gx = 1)
  { tile: [0, 3], orient: 'side', screen: '#22c55e' },  // TraderClaw
  { tile: [0, 4], orient: 'side', screen: '#3b82f6' },  // WebClaw
  { tile: [0, 5], orient: 'side', screen: '#a855f7' },  // Lyra
  { tile: [0, 6], orient: 'side', screen: '#78716c' },  // Reaper
  // Right island (agents on row gy = 5)
  { tile: [8, 4], orient: 'front', screen: '#06b6d4' }, // X-Hunter
  { tile: [9, 4], orient: 'front', screen: '#ec4899' }, // XBot
  { tile: [10, 4], orient: 'front', screen: '#ef4444' }, // Guardian
];

const lines = [];

function emit(s) { lines.push(s); }

// ─── DEFS ────────────────────────────────────────────────────────────
emit('<defs>');

// Wall stripe pattern
emit(`  <pattern id="wallstripe" x="0" y="0" width="20" height="40" patternUnits="userSpaceOnUse" patternTransform="skewX(-26)">
    <rect width="20" height="40" fill="#C8B8E8"/>
    <rect x="0" y="0" width="8" height="40" fill="#BCA8DC" opacity="0.5"/>
  </pattern>`);

// Wall stripe pattern right side (skew other way)
emit(`  <pattern id="wallstripeR" x="0" y="0" width="20" height="40" patternUnits="userSpaceOnUse" patternTransform="skewX(26)">
    <rect width="20" height="40" fill="#B8A8D8"/>
    <rect x="0" y="0" width="8" height="40" fill="#AC9CCC" opacity="0.5"/>
  </pattern>`);

// Radial gradient for floor lighting
const [fcx, fcy] = g2s(GW / 2, GH / 2);
emit(`  <radialGradient id="floorLight" cx="${fcx}" cy="${fcy}" r="320" gradientUnits="userSpaceOnUse">
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
// Darker inner face
emit(`<polygon points="${pts(wlTL, wlBL, leftFront, backCorner)}" fill="#8878b8" opacity="0.28"/>`);

// North (back) wall face
const wnTR = [rightBack[0], rightBack[1] - WALL_H];
emit(`<polygon points="${pts(wlTL, wnTR, rightBack, backCorner)}" fill="url(#wallstripeR)"/>`);
// Slightly lighter shade
emit(`<polygon points="${pts(wlTL, wnTR, rightBack, backCorner)}" fill="#ffffff" opacity="0.06"/>`);

// Wall top edge lines
emit(`<line x1="${wlTL[0]}" y1="${wlTL[1]}" x2="${wlBL[0]}" y2="${wlBL[1]}" stroke="#a090c8" stroke-width="1.2"/>`);
emit(`<line x1="${wlTL[0]}" y1="${wlTL[1]}" x2="${wnTR[0]}" y2="${wnTR[1]}" stroke="#b0a0d0" stroke-width="1.2"/>`);
emit(`<line x1="${wlBL[0]}" y1="${wlBL[1]}" x2="${leftFront[0]}" y2="${leftFront[1]}" stroke="#7060a0" stroke-width="1"/>`);
emit(`<line x1="${wnTR[0]}" y1="${wnTR[1]}" x2="${rightBack[0]}" y2="${rightBack[1]}" stroke="#9080b8" stroke-width="1"/>`);

// Corner pillar line
emit(`<line x1="${backCorner[0]}" y1="${backCorner[1]}" x2="${wlTL[0]}" y2="${wlTL[1]}" stroke="#c0b0e0" stroke-width="1.5"/>`);

// ─── WALL DECORATIONS ───────────────────────────────────────────────

// Windows on the LEFT wall, above the left-hand desk bank
function wallWindow(gy_start) {
  const base1 = g2s(0, gy_start);
  const base2 = g2s(0, gy_start + 1.5);
  const t1 = [base1[0], base1[1] - 78];
  const t2 = [base2[0], base2[1] - 78];
  const b1 = [base1[0], base1[1] - 30];
  const b2 = [base2[0], base2[1] - 30];
  emit(`<polygon points="${pts(t1, t2, b2, b1)}" fill="var(--view-bg)" stroke="var(--border)" stroke-width="0.8"/>`);
  emit(`<polygon points="${pts(t1, t2, b2, b1)}" fill="#1e3a5f" opacity="0.5"/>`);
  const mid1 = [(t1[0] + t2[0]) / 2, (t1[1] + t2[1]) / 2];
  const mid2 = [(b1[0] + b2[0]) / 2, (b1[1] + b2[1]) / 2];
  emit(`<line x1="${mid1[0]}" y1="${mid1[1]}" x2="${mid2[0]}" y2="${mid2[1]}" stroke="var(--border)" stroke-width="0.6"/>`);
  emit(`<line x1="${t1[0]}" y1="${(t1[1] + b1[1]) / 2}" x2="${t2[0]}" y2="${(t2[1] + b2[1]) / 2}" stroke="var(--border)" stroke-width="0.6"/>`);
  // window highlight
  emit(`<polygon points="${pts(t1, t2, [t2[0], t2[1] + 12], [t1[0], t1[1] + 12])}" fill="#87ceeb" opacity="0.15"/>`);
}
wallWindow(2.9);
wallWindow(4.9);

// TV/Presentation screen on LEFT wall, above the lounge
{
  const tv_gy = 6.9;
  const base1 = g2s(0, tv_gy);
  const base2 = g2s(0, tv_gy + 1.8);
  const t1 = [base1[0], base1[1] - 92];
  const t2 = [base2[0], base2[1] - 92];
  const b1 = [base1[0], base1[1] - 32];
  const b2 = [base2[0], base2[1] - 32];
  // Screen frame
  emit(`<polygon points="${pts(t1, t2, b2, b1)}" fill="var(--view-bg)" stroke="var(--border)" stroke-width="1"/>`);
  // Screen inner
  const inset = 4;
  const it1 = [t1[0] + inset, t1[1] + inset];
  const it2 = [t2[0] - inset, t2[1] + inset];
  const ib1 = [b1[0] + inset, b1[1] - inset];
  const ib2 = [b2[0] - inset, b2[1] - inset];
  emit(`<polygon points="${pts(it1, it2, ib2, ib1)}" fill="#1a2a3a"/>`);
  // Screen content lines (presentation)
  for (let i = 0; i < 4; i++) {
    const y1 = it1[1] + (it2[1] - it1[1]) * (i + 1) / 5;
    const y2 = ib1[1] + (ib2[1] - ib1[1]) * (i + 1) / 5;
    const x1 = it1[0] + (ib1[0] - it1[0]) * (i + 1) / 5;
    const x2 = it2[0] + (ib2[0] - it2[0]) * (i + 1) / 5;
    emit(`<line x1="${x1 + 4}" y1="${(y1 + y2) / 2}" x2="${x2 - 4}" y2="${(y1 + y2) / 2 + 2}" stroke="#00ff88" stroke-width="0.8" opacity="0.7"/>`);
  }
  // Screen title bar
  emit(`<polygon points="${pts(it1, [it2[0], it2[1]], [it2[0], it2[1] + 8], [it1[0], it1[1] + 8])}" fill="var(--accent)" opacity="0.7"/>`);
}

// Clock on back wall, in the gap between the desk bank and the shelves
{
  const base = g2s(7, 0);
  const cx = base[0];
  const cy = base[1] - 58;
  emit(`<circle cx="${cx}" cy="${cy}" r="14" fill="#1e1a2e" stroke="#5040a0" stroke-width="1.5"/>`);
  emit(`<circle cx="${cx}" cy="${cy}" r="11" fill="#2a2444"/>`);
  // clock hands
  emit(`<line x1="${cx}" y1="${cy}" x2="${cx + 0}" y2="${cy - 8}" stroke="#c0b0e0" stroke-width="1.5" stroke-linecap="round"/>`);
  emit(`<line x1="${cx}" y1="${cy}" x2="${cx + 6}" y2="${cy + 2}" stroke="#c0b0e0" stroke-width="1" stroke-linecap="round"/>`);
  emit(`<circle cx="${cx}" cy="${cy}" r="1.5" fill="var(--accent)"/>`);
  // hour marks
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 - 90) * Math.PI / 180;
    const mx = cx + Math.cos(angle) * 9;
    const my = cy + Math.sin(angle) * 9;
    emit(`<circle cx="${mx}" cy="${my}" r="0.8" fill="#7060a0"/>`);
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
    const color = even ? '#7B6FA0' : '#6B5F90';
    emit(`  <polygon points="${tx},${ty} ${rx},${ry} ${bx},${by} ${lx},${ly}" fill="${color}"/>`);
  }
}
// Tile grid lines (subtle)
emit(`  <g stroke="#5a5080" stroke-width="0.4" opacity="0.5">`);
for (let gy = 0; gy <= GH; gy++) {
  const [ax, ay] = g2s(0, gy);
  const [bx, by] = g2s(GW, gy);
  emit(`    <line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`);
}
for (let gx = 0; gx <= GW; gx++) {
  const [ax, ay] = g2s(gx, 0);
  const [bx, by] = g2s(gx, GH);
  emit(`    <line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`);
}
emit(`  </g>`);
emit(`</g>`);

// ─── FLOOR LIGHTING OVERLAY ─────────────────────────────────────────
const floorPts = pts(g2s(0, 0), g2s(GW, 0), g2s(GW, GH), g2s(0, GH));
emit(`<polygon points="${floorPts}" fill="url(#floorLight)"/>`);

// ─── CARPET / RUG (under the meeting area) ──────────────────────────
{
  const rugCorners = [g2s(3.6, 5.3), g2s(6.8, 5.3), g2s(6.8, 8), g2s(3.6, 8)];
  emit(`<polygon points="${pts(...rugCorners)}" fill="#3d2060" opacity="0.55"/>`);
  const rugInner = [g2s(3.9, 5.6), g2s(6.5, 5.6), g2s(6.5, 7.7), g2s(3.9, 7.7)];
  emit(`<polygon points="${pts(...rugInner)}" fill="none" stroke="#7030a0" stroke-width="1.5" opacity="0.6"/>`);
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
  // Front-left face (constant gy + d)
  out.push(`<polygon points="${pts(fbl, fbr, br, bl)}" fill="${leftColor}"${extra}/>`);
  // Front-right face (constant gx + w)
  out.push(`<polygon points="${pts(ftr, fbr, br, tr)}" fill="${rightColor}"${extra}/>`);
  // Top face
  out.push(`<polygon points="${pts(ftl, ftr, fbr, fbl)}" fill="${topColor}"${extra}/>`);
  return out.join('\n');
}

// ─── BOOKSHELVES (back wall, right side) ────────────────────────────
emit(`<!-- Bookshelves -->`);
function bookshelf(gx, gy) {
  const w = 1.6, d = 0.45, h = 80;
  emit(isoBox(gx, gy, w, d, h, '#6b4010', '#5a3510', '#4a2e08'));

  // Shelves + books sit on the front-left face (the one at gy + d).
  const faceL = g2s(gx, gy + d);
  const faceR = g2s(gx + w, gy + d);
  const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
  const bandH = h / 3;
  for (let s = 0; s < 3; s++) {
    // Shelf ledge
    const ledgeY = -h + (s + 1) * bandH;
    emit(`<line x1="${faceL[0]}" y1="${faceL[1] + ledgeY}" x2="${faceR[0]}" y2="${faceR[1] + ledgeY}" stroke="#7a4a10" stroke-width="1"/>`);
    // Books standing on the shelf below the ledge
    const bookCount = 12;
    for (let b = 0; b < bookCount; b++) {
      const t = (b + 0.6) / (bookCount + 0.2);
      const bx = faceL[0] + t * (faceR[0] - faceL[0]);
      const bh = bandH - 12 - (b % 3) * 2;
      const by = faceL[1] + t * (faceR[1] - faceL[1]) + ledgeY - 4 - bh;
      const color = colors[(s * 5 + b) % colors.length];
      // skewY shifts everything by x * tan, so take that back out of y.
      emit(`<rect x="${Math.round(bx * 10) / 10}" y="${Math.round((by - bx * SKEW_TAN) * 10) / 10}" width="3.2" height="${Math.round(bh * 10) / 10}" fill="${color}" transform="skewY(${Math.round(SKEW_DEG * 1000) / 1000})" opacity="0.85"/>`);
    }
  }
}
bookshelf(8.3, 0.15);

// ─── WORKSTATION DESKS ──────────────────────────────────────────────
emit(`<!-- Workstation desks -->`);

const DESK_TOP = '#A07840';
const DESK_LEFT = '#7A5020';
const DESK_RIGHT = '#8B6030';
const LEG_COLOR = '#4a3010';

// A monitor standing on the desk surface, drawn as a flat quad between two
// grid points. `a` and `b` are grid coords of the screen's bottom edge.
function monitor(a, b, screenColor, deskH) {
  const p1 = g2s(a[0], a[1]);
  const p2 = g2s(b[0], b[1]);
  const bottom = [[p1[0], p1[1] - deskH - 3], [p2[0], p2[1] - deskH - 3]];
  const top = [[p1[0], p1[1] - deskH - 25], [p2[0], p2[1] - deskH - 25]];
  // Stand
  const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  emit(`<rect x="${Math.round((mid[0] - 1.5) * 10) / 10}" y="${Math.round((mid[1] - deskH - 5) * 10) / 10}" width="3" height="6" fill="#2a2a3a"/>`);
  // Screen body
  emit(`<polygon points="${pts(top[0], top[1], bottom[1], bottom[0])}" fill="#1a2a3a"/>`);
  // Glow
  emit(`<polygon points="${pts([top[0][0] + 2, top[0][1] + 2], [top[1][0] - 2, top[1][1] + 2], [bottom[1][0] - 2, bottom[1][1] - 2], [bottom[0][0] + 2, bottom[0][1] - 2])}" fill="${screenColor}" opacity="0.5" filter="url(#screenGlow)"/>`);
  // Scanlines
  for (let sl = 0; sl < 3; sl++) {
    const t = (sl + 1) / 4;
    const sx1 = top[0][0] + t * (bottom[0][0] - top[0][0]) + 2;
    const sy1 = top[0][1] + t * (bottom[0][1] - top[0][1]);
    const sx2 = top[1][0] + t * (bottom[1][0] - top[1][0]) - 2;
    const sy2 = top[1][1] + t * (bottom[1][1] - top[1][1]);
    emit(`<line x1="${Math.round(sx1 * 10) / 10}" y1="${Math.round(sy1 * 10) / 10}" x2="${Math.round(sx2 * 10) / 10}" y2="${Math.round(sy2 * 10) / 10}" stroke="${screenColor}" stroke-width="0.6" opacity="0.4"/>`);
  }
  // Bezel
  emit(`<polygon points="${pts(top[0], top[1], bottom[1], bottom[0])}" fill="none" stroke="var(--border)" stroke-width="0.8"/>`);
}

// Keyboards lie flat on the desk surface, so they are a single face at deck
// height rather than a box standing on the floor.
function keyboard(gx, gy, w, d, deskH) {
  const lift = deskH + 1;
  const a = g2s(gx, gy), b = g2s(gx + w, gy), c = g2s(gx + w, gy + d), e = g2s(gx, gy + d);
  const flat = [[a[0], a[1] - lift], [b[0], b[1] - lift], [c[0], c[1] - lift], [e[0], e[1] - lift]];
  emit(`<polygon points="${pts(...flat)}" fill="#cbd5e1" stroke="#8fa0b4" stroke-width="0.5"/>`);
  emit(`<polygon points="${pts(...flat)}" fill="#0f172a" opacity="0.25"/>`);
}

function mug(gx, gy, deskH) {
  const [cx, cy] = g2s(gx, gy);
  emit(`<ellipse cx="${Math.round(cx * 10) / 10}" cy="${Math.round((cy - deskH - 6) * 10) / 10}" rx="3.4" ry="1.7" fill="#fff" opacity="0.9"/>`);
  emit(`<rect x="${Math.round((cx - 2.6) * 10) / 10}" y="${Math.round((cy - deskH - 11) * 10) / 10}" width="5.2" height="6" fill="#fff" opacity="0.9" rx="1"/>`);
  emit(`<rect x="${Math.round((cx + 2) * 10) / 10}" y="${Math.round((cy - deskH - 9) * 10) / 10}" width="2.6" height="3" fill="none" stroke="#ccc" stroke-width="0.7" rx="1"/>`);
}

// Desk for one workstation. The agent tile is always the neighbouring tile
// towards the camera, so the monitor goes on the far edge of the desk.
function workstation(tile, orient, screenColor) {
  const [i, j] = tile;
  const deskH = 22;

  if (orient === 'front') {
    // Desk runs to the front edge of its tile so the agent on (i, j + 1) is
    // tucked right up against it instead of standing a gap away.
    const x0 = i + 0.05, y0 = j + 0.15, w = 0.9, d = 0.85;
    emit(isoBox(x0, y0, w, d, deskH, DESK_TOP, DESK_LEFT, DESK_RIGHT));
    // Legs at the two front corners
    const [l1x, l1y] = g2s(x0, y0 + d);
    const [l2x, l2y] = g2s(x0 + w, y0 + d);
    emit(`<rect x="${Math.round((l1x - 1) * 10) / 10}" y="${Math.round((l1y - 14) * 10) / 10}" width="2.5" height="14" fill="${LEG_COLOR}"/>`);
    emit(`<rect x="${Math.round((l2x - 1.5) * 10) / 10}" y="${Math.round((l2y - 14) * 10) / 10}" width="2.5" height="14" fill="${LEG_COLOR}"/>`);
    // Monitor across the back edge, keyboard + mug near the agent
    monitor([x0 + 0.16, y0 + 0.2], [x0 + 0.74, y0 + 0.2], screenColor, deskH);
    keyboard(x0 + 0.22, y0 + 0.56, 0.48, 0.16, deskH);
    mug(x0 + 0.82, y0 + 0.62, deskH);
  } else {
    // Desk runs to the right edge of its tile so the agent on (i + 1, j) is
    // tucked right up against it.
    const x0 = i + 0.15, y0 = j + 0.05, w = 0.85, d = 0.9;
    emit(isoBox(x0, y0, w, d, deskH, DESK_TOP, DESK_LEFT, DESK_RIGHT));
    const [l1x, l1y] = g2s(x0 + w, y0);
    const [l2x, l2y] = g2s(x0 + w, y0 + d);
    emit(`<rect x="${Math.round((l1x - 1.5) * 10) / 10}" y="${Math.round((l1y - 14) * 10) / 10}" width="2.5" height="14" fill="${LEG_COLOR}"/>`);
    emit(`<rect x="${Math.round((l2x - 1.5) * 10) / 10}" y="${Math.round((l2y - 14) * 10) / 10}" width="2.5" height="14" fill="${LEG_COLOR}"/>`);
    // Monitor down the far edge, keyboard + mug on the agent's side
    monitor([x0 + 0.2, y0 + 0.16], [x0 + 0.2, y0 + 0.74], screenColor, deskH);
    keyboard(x0 + 0.56, y0 + 0.22, 0.16, 0.48, deskH);
    mug(x0 + 0.62, y0 + 0.82, deskH);
  }
}

STATIONS.forEach(s => workstation(s.tile, s.orient, s.screen));

// ─── MEETING TABLE ──────────────────────────────────────────────────
emit(`<!-- Meeting Table -->`);
{
  const cx = 5.2, cy = 6.65, r = 1;
  const tableH = 18;
  const tableTopPts = [
    g2s(cx - r / 2, cy - r), g2s(cx + r / 2, cy - r), g2s(cx + r, cy - r / 2), g2s(cx + r, cy + r / 2),
    g2s(cx + r / 2, cy + r), g2s(cx - r / 2, cy + r), g2s(cx - r, cy + r / 2), g2s(cx - r, cy - r / 2)
  ];
  // Skirt below the front-facing half of the top
  for (let i = 3; i < 7; i++) {
    const p1 = tableTopPts[i];
    const p2 = tableTopPts[(i + 1) % tableTopPts.length];
    const shading = i < 5 ? '#7a4820' : '#5a3010';
    emit(`<polygon points="${pts(p1, p2, [p2[0], p2[1] + tableH], [p1[0], p1[1] + tableH])}" fill="${shading}"/>`);
  }
  emit(`<polygon points="${pts(...tableTopPts)}" fill="#8B5E2A"/>`);
  emit(`<polygon points="${pts(...tableTopPts)}" fill="#A06830" opacity="0.6"/>`);
  emit(`<polygon points="${pts(...tableTopPts)}" fill="none" stroke="#c09040" stroke-width="1" opacity="0.5"/>`);
  const [tcx2, tcy2] = g2s(cx, cy);
  emit(`<ellipse cx="${tcx2}" cy="${tcy2}" rx="${HW * 0.6}" ry="${HH * 0.6}" fill="none" stroke="#c09040" stroke-width="0.8" opacity="0.4"/>`);

  // Laptops on the table
  const seats = [g2s(cx - 0.45, cy - 0.45), g2s(cx + 0.45, cy - 0.45), g2s(cx - 0.45, cy + 0.45), g2s(cx + 0.45, cy + 0.45)];
  const colors = ['var(--accent)', '#22c55e', '#f59e0b', '#ec4899'];
  seats.forEach(([lx, ly], i) => {
    emit(`<rect x="${Math.round((lx - 6) * 10) / 10}" y="${Math.round((ly - 12) * 10) / 10}" width="12" height="8" fill="#1a2030" rx="1"/>`);
    emit(`<rect x="${Math.round((lx - 5) * 10) / 10}" y="${Math.round((ly - 11) * 10) / 10}" width="10" height="6" fill="${colors[i]}" opacity="0.35"/>`);
  });
}

// ─── SOFA (front-left lounge) ───────────────────────────────────────
emit(`<!-- Sofa -->`);
{
  const sx = 1.3, sy = 7.15;
  // Back
  emit(isoBox(sx, sy, 2, 0.35, 30, '#6b1d1d', '#5a1818', '#4a1010'));
  // Seat
  emit(isoBox(sx, sy + 0.3, 2, 0.55, 16, '#991b1b', '#7f1d1d', '#6b1010'));
  // Armrests
  emit(isoBox(sx, sy, 0.28, 0.85, 22, '#7a1a1a', '#661414', '#551010'));
  emit(isoBox(sx + 1.72, sy, 0.28, 0.85, 22, '#7a1a1a', '#661414', '#551010'));
  // Cushion seam
  const [csx, csy] = g2s(sx + 1, sy + 0.35);
  const [cex, cey] = g2s(sx + 1, sy + 0.85);
  emit(`<line x1="${csx}" y1="${csy - 16}" x2="${cex}" y2="${cey - 16}" stroke="#c04040" stroke-width="1" opacity="0.5"/>`);
}

// ─── COFFEE TABLE near sofa ─────────────────────────────────────────
emit(`<!-- Coffee Table -->`);
{
  emit(isoBox(1.7, 8.1, 1.1, 0.6, 10, '#7a5030', '#5a3820', '#4a2810'));
  emit(`<polygon points="${pts(g2s(1.95, 8.22), g2s(2.55, 8.22), g2s(2.55, 8.5), g2s(1.95, 8.5))}" fill="#3b82f6" opacity="0.7"/>`);
}

// ─── SERVER RACKS (back wall, right of the shelves) ─────────────────
emit(`<!-- Server rack -->`);
function serverRack(gx, gy) {
  const w = 0.75, d = 0.6, h = 64;
  emit(isoBox(gx, gy, w, d, h, '#334155', '#1e293b', '#0f172a'));
  // Blade LEDs down the front-left face
  const faceL = g2s(gx, gy + d);
  const faceR = g2s(gx + w, gy + d);
  for (let row = 0; row < 6; row++) {
    const y = -h + 8 + row * 9;
    emit(`<line x1="${Math.round((faceL[0] + 4) * 10) / 10}" y1="${Math.round((faceL[1] + y) * 10) / 10}" x2="${Math.round((faceR[0] - 4) * 10) / 10}" y2="${Math.round((faceR[1] + y) * 10) / 10}" stroke="#0b1220" stroke-width="3"/>`);
    const t = 0.24 + (row % 3) * 0.22;
    const lx = faceL[0] + t * (faceR[0] - faceL[0]);
    const ly = faceL[1] + t * (faceR[1] - faceL[1]) + y;
    emit(`<circle cx="${Math.round(lx * 10) / 10}" cy="${Math.round(ly * 10) / 10}" r="1.1" fill="${row % 2 ? '#22c55e' : '#38bdf8'}"/>`);
  }
}
serverRack(10.15, 0.18);
serverRack(11.05, 0.18);

// ─── WATER COOLER ───────────────────────────────────────────────────
emit(`<!-- Water cooler -->`);
{
  const gx = 7.55, gy = 0.25, w = 0.4, d = 0.4;
  emit(isoBox(gx, gy, w, d, 26, '#e2e8f0', '#94a3b8', '#cbd5e1'));
  // Bottle
  const [bx, by] = g2s(gx + w / 2, gy + d / 2);
  emit(`<ellipse cx="${Math.round(bx * 10) / 10}" cy="${Math.round((by - 42) * 10) / 10}" rx="9" ry="4.5" fill="#7dd3fc" opacity="0.75"/>`);
  emit(`<rect x="${Math.round((bx - 9) * 10) / 10}" y="${Math.round((by - 42) * 10) / 10}" width="18" height="16" fill="#7dd3fc" opacity="0.6"/>`);
  emit(`<ellipse cx="${Math.round(bx * 10) / 10}" cy="${Math.round((by - 26) * 10) / 10}" rx="9" ry="4.5" fill="#38bdf8" opacity="0.7"/>`);
}

// ─── PRINTER (end of the island) ────────────────────────────────────
emit(`<!-- Printer -->`);
{
  const gx = 11.0, gy = 4.15, w = 0.8, d = 0.7;
  emit(isoBox(gx, gy, w, d, 24, '#475569', '#1e293b', '#334155'));
  // Paper tray sticking out of the top
  emit(`<polygon points="${pts(
    [g2s(gx + 0.15, gy + 0.15)[0], g2s(gx + 0.15, gy + 0.15)[1] - 27],
    [g2s(gx + 0.65, gy + 0.15)[0], g2s(gx + 0.65, gy + 0.15)[1] - 27],
    [g2s(gx + 0.65, gy + 0.55)[0], g2s(gx + 0.65, gy + 0.55)[1] - 27],
    [g2s(gx + 0.15, gy + 0.55)[0], g2s(gx + 0.15, gy + 0.55)[1] - 27]
  )}" fill="#f8fafc" opacity="0.9"/>`);
  const [px, py] = g2s(gx + 0.2, gy + d);
  emit(`<circle cx="${Math.round(px * 10) / 10}" cy="${Math.round((py - 12) * 10) / 10}" r="1.4" fill="#22c55e"/>`);
}

// ─── PLANTS ─────────────────────────────────────────────────────────
emit(`<!-- Plants -->`);
function plant(gx, gy, size = 1) {
  const [px, py] = g2s(gx, gy);
  // Pot
  emit(`<polygon points="${pts([px - 6 * size, py], [px + 6 * size, py + 3 * size], [px + 4 * size, py + 10 * size], [px - 4 * size, py + 7 * size])}" fill="#8B4513"/>`);
  // Plant body - layered circles
  emit(`<ellipse cx="${px}" cy="${py - 8 * size}" rx="${14 * size}" ry="${8 * size}" fill="#2D5A27"/>`);
  emit(`<ellipse cx="${px - 6 * size}" cy="${py - 14 * size}" rx="${9 * size}" ry="${6 * size}" fill="#3D7A35"/>`);
  emit(`<ellipse cx="${px + 5 * size}" cy="${py - 16 * size}" rx="${10 * size}" ry="${7 * size}" fill="#2D5A27"/>`);
  emit(`<ellipse cx="${px}" cy="${py - 20 * size}" rx="${8 * size}" ry="${5 * size}" fill="#4a8a3d"/>`);
  // Highlight
  emit(`<ellipse cx="${px - 3 * size}" cy="${py - 18 * size}" rx="${4 * size}" ry="${3 * size}" fill="#5aaa4d" opacity="0.5"/>`);
  // Shadow under pot
  emit(`<ellipse cx="${px}" cy="${py + 4 * size}" rx="${8 * size}" ry="${3 * size}" fill="url(#shadowGrad)"/>`);
}

plant(6.7, 0.45, 1);      // between the desk bank and the shelves
plant(11.55, 2.4, 0.9);   // right-hand wall
plant(0.45, 8.45, 0.85);  // front-left corner
plant(11.4, 7.4, 0.9);    // front-right corner
plant(7.6, 8.4, 0.85);    // front edge

console.log(lines.join('\n'));
