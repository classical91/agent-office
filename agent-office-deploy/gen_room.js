// Habbo Hotel Isometric Room Generator
// Outputs SVG content to replace inside <svg id="officesvg" ...>

const OX = 550;  // origin X (back corner)
const OY = 295;  // origin Y (back corner)
const HW = 40;   // half tile width
const HH = 20;   // half tile height
const GW = 12;   // grid width (tiles)
const GH = 9;    // grid height/depth (tiles)
const WALL_H = 110; // wall height in SVG px

function g2s(gx, gy) {
  return [OX + (gx - gy) * HW, OY + (gx + gy) * HH];
}

function pts(...coords) {
  return coords.map(([x,y]) => `${Math.round(x*10)/10},${Math.round(y*10)/10}`).join(' ');
}

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
const [fcx, fcy] = g2s(6, 4);
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
const rightBack  = g2s(GW, 0);
const leftFront  = g2s(0, GH);

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

// Window on LEFT wall (around gy=2..3, gx=0)
function wallWindow(gy_start) {
  const base1 = g2s(0, gy_start);
  const base2 = g2s(0, gy_start + 1.5);
  const t1 = [base1[0], base1[1] - 70];
  const t2 = [base2[0], base2[1] - 70];
  const b1 = [base1[0], base1[1] - 20];
  const b2 = [base2[0], base2[1] - 20];
  emit(`<polygon points="${pts(t1,t2,b2,b1)}" fill="#0f172a" stroke="#334155" stroke-width="0.8"/>`);
  emit(`<polygon points="${pts(t1,t2,b2,b1)}" fill="#1e3a5f" opacity="0.5"/>`);
  const mid1 = [(t1[0]+t2[0])/2, (t1[1]+t2[1])/2];
  const mid2 = [(b1[0]+b2[0])/2, (b1[1]+b2[1])/2];
  emit(`<line x1="${mid1[0]}" y1="${mid1[1]}" x2="${mid2[0]}" y2="${mid2[1]}" stroke="#334155" stroke-width="0.6"/>`);
  const frame_mid = [(t1[0]+t2[0]+b1[0]+b2[0])/4, (t1[1]+t2[1]+b1[1]+b2[1])/4];
  emit(`<line x1="${t1[0]}" y1="${(t1[1]+b1[1])/2}" x2="${t2[0]}" y2="${(t2[1]+b2[1])/2}" stroke="#334155" stroke-width="0.6"/>`);
  // window highlight
  emit(`<polygon points="${pts(t1,t2,[t2[0],t2[1]+12],[t1[0],t1[1]+12])}" fill="#87ceeb" opacity="0.15"/>`);
}
wallWindow(1.5);
wallWindow(4.5);

// TV/Presentation screen on LEFT wall
{
  const tv_gy = 6.8;
  const base1 = g2s(0, tv_gy);
  const base2 = g2s(0, tv_gy + 1.8);
  const t1 = [base1[0], base1[1] - 90];
  const t2 = [base2[0], base2[1] - 90];
  const b1 = [base1[0], base1[1] - 30];
  const b2 = [base2[0], base2[1] - 30];
  // Screen frame
  emit(`<polygon points="${pts(t1,t2,b2,b1)}" fill="#0a0a1a" stroke="#1e293b" stroke-width="1"/>`);
  // Screen inner
  const inset = 4;
  const it1 = [t1[0]+inset, t1[1]+inset];
  const it2 = [t2[0]-inset, t2[1]+inset];
  const ib1 = [b1[0]+inset, b1[1]-inset];
  const ib2 = [b2[0]-inset, b2[1]-inset];
  emit(`<polygon points="${pts(it1,it2,ib2,ib1)}" fill="#1a2a3a"/>`);
  // Screen content lines (presentation)
  for (let i=0; i<4; i++) {
    const y1 = it1[1] + (it2[1]-it1[1])*(i+1)/5;
    const y2 = ib1[1] + (ib2[1]-ib1[1])*(i+1)/5;
    const x1 = it1[0] + (ib1[0]-it1[0])*(i+1)/5;
    const x2 = it2[0] + (ib2[0]-it2[0])*(i+1)/5;
    emit(`<line x1="${x1+4}" y1="${(y1+y2)/2}" x2="${x2-4}" y2="${(y1+y2)/2+2}" stroke="#00ff88" stroke-width="0.8" opacity="0.7"/>`);
  }
  // Screen title bar
  emit(`<polygon points="${pts(it1,[it2[0],it2[1]],[it2[0],it2[1]+8],[it1[0],it1[1]+8])}" fill="#6366f1" opacity="0.7"/>`);
  // "TV" label above
  const labelX = (t1[0]+t2[0])/2;
  const labelY = t1[1] - 8;
  emit(`<text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="8" fill="#a090c8" style="font-family:sans-serif;">MAIN DISPLAY</text>`);
}

// Clock on back wall
{
  const gy_clock = 0;
  const clock_gx = 6;
  const base = g2s(clock_gx, gy_clock);
  const cx = base[0];
  const cy = base[1] - 55;
  emit(`<circle cx="${cx}" cy="${cy}" r="14" fill="#1e1a2e" stroke="#5040a0" stroke-width="1.5"/>`);
  emit(`<circle cx="${cx}" cy="${cy}" r="11" fill="#2a2444"/>`);
  // clock hands
  emit(`<line x1="${cx}" y1="${cy}" x2="${cx+0}" y2="${cy-8}" stroke="#c0b0e0" stroke-width="1.5" stroke-linecap="round"/>`);
  emit(`<line x1="${cx}" y1="${cy}" x2="${cx+6}" y2="${cy+2}" stroke="#c0b0e0" stroke-width="1" stroke-linecap="round"/>`);
  emit(`<circle cx="${cx}" cy="${cy}" r="1.5" fill="#6366f1"/>`);
  // hour marks
  for (let i=0; i<12; i++) {
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
    const [rx, ry] = g2s(gx+1, gy);
    const [bx, by] = g2s(gx+1, gy+1);
    const [lx, ly] = g2s(gx, gy+1);
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
const floorPts = pts(g2s(0,0), g2s(GW,0), g2s(GW,GH), g2s(0,GH));
emit(`<polygon points="${floorPts}" fill="url(#floorLight)"/>`);

// ─── CARPET / RUG ───────────────────────────────────────────────────
{
  // Central rug under meeting table at (5,4) to (7,6)
  const rugCorners = [g2s(4.5, 3.5), g2s(7.5, 3.5), g2s(7.5, 6.5), g2s(4.5, 6.5)];
  emit(`<polygon points="${pts(...rugCorners)}" fill="#3d2060" opacity="0.55"/>`);
  // Rug border
  const rugInner = [g2s(5, 4), g2s(7, 4), g2s(7, 6), g2s(5, 6)];
  emit(`<polygon points="${pts(...rugInner)}" fill="none" stroke="#7030a0" stroke-width="1.5" opacity="0.6"/>`);
}

// ─── FURNITURE ──────────────────────────────────────────────────────
// Helper: isometric box
// Draws a box at grid tile (gx,gy) with given height
// Returns SVG string
function isoBox(gx, gy, w, d, h, topColor, leftColor, rightColor, extra='') {
  // w=width in tiles, d=depth in tiles, h=height in SVG pixels
  // Top face corners
  const tl = g2s(gx, gy);
  const tr = g2s(gx+w, gy);
  const br = g2s(gx+w, gy+d);
  const bl = g2s(gx, gy+d);
  
  // Bottom face (shifted down by h... wait, in iso view we shift up)
  // In SVG the top of a box is h pixels ABOVE the floor position
  const ftl = [tl[0], tl[1]-h];
  const ftr = [tr[0], tr[1]-h];
  const fbr = [br[0], br[1]-h];
  const fbl = [bl[0], bl[1]-h];
  
  const out = [];
  // Top face
  out.push(`<polygon points="${pts(ftl,ftr,fbr,fbl)}" fill="${topColor}"${extra}/>`);
  // Left face (visible left side: from bl to tl on floor, going up)
  out.push(`<polygon points="${pts(fbl,ftl,tl,bl)}" fill="${leftColor}"${extra}/>`);
  // Right face (visible right side)
  out.push(`<polygon points="${pts(ftr,fbr,br,tr)}" fill="${rightColor}"${extra}/>`);
  return out.join('\n');
}

// ─── BOOKSHELVES (back wall, right side) ────────────────────────────
emit(`<!-- Bookshelves -->`);
// Shelf 1 at gx=8, gy=0.2, on back wall
function bookshelf(gx, gy) {
  const base = g2s(gx, gy);
  const base2 = g2s(gx+1.5, gy);
  // Shelf body (against north wall)
  const shelf_h = 80;
  const tl = [base[0], base[1] - shelf_h];
  const tr = [base2[0], base2[1] - shelf_h];
  const b = base;
  const br = base2;
  // Back (against wall) - not visible
  // Left face
  emit(`<polygon points="${pts([base[0],base[1]-shelf_h],[base[0],base[1]],[g2s(gx,gy+0.4)[0],g2s(gx,gy+0.4)[1]],[g2s(gx,gy+0.4)[0],g2s(gx,gy+0.4)[1]-shelf_h])}" fill="#4a2e08"/>`);
  // Top face  
  emit(`<polygon points="${pts([base[0],base[1]-shelf_h],[base2[0],base2[1]-shelf_h],[g2s(gx+1.5,gy+0.4)[0],g2s(gx+1.5,gy+0.4)[1]-shelf_h],[g2s(gx,gy+0.4)[0],g2s(gx,gy+0.4)[1]-shelf_h])}" fill="#6b4010"/>`);
  // Front face
  emit(`<polygon points="${pts([base2[0],base2[1]-shelf_h],[base2[0],base2[1]],[g2s(gx+1.5,gy+0.4)[0],g2s(gx+1.5,gy+0.4)[1]],[g2s(gx+1.5,gy+0.4)[0],g2s(gx+1.5,gy+0.4)[1]-shelf_h])}" fill="#5a3510"/>`);
  
  // Shelf dividers and books
  const colors = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#a855f7','#ec4899'];
  for (let s=0; s<3; s++) {
    const shelfY = base[1] - shelf_h + s*(shelf_h/3) + 4;
    const shelfY2 = base2[1] - shelf_h + s*(shelf_h/3) + 4;
    // shelf line
    emit(`<line x1="${base[0]}" y1="${shelfY+shelf_h/3-6}" x2="${base2[0]}" y2="${shelfY2+shelf_h/3-6}" stroke="#7a4a10" stroke-width="1"/>`);
    // books as small colored rects (skewed)
    for (let b=0; b<4; b++) {
      const t = b/3;
      const bx = base[0] + t*(base2[0]-base[0]) + 2;
      const by = shelfY + t*(shelfY2-shelfY);
      const color = colors[(s*4+b)%colors.length];
      emit(`<rect x="${bx}" y="${by}" width="6" height="${shelf_h/3-8}" fill="${color}" transform="skewY(${(base2[1]-base[1])/(base2[0]-base[0])*57})" opacity="0.85"/>`);
    }
  }
}
bookshelf(8, 0.3);
bookshelf(10, 0.5);

// ─── COMPUTER DESKS ─────────────────────────────────────────────────
emit(`<!-- Computer Desks -->`);

// Desk helper: gx,gy = grid pos, facing = 'right' or 'down'
function compDesk(gx, gy, screenColor, label) {
  // Desk surface
  const deskTop = '#A07840';
  const deskLeft = '#7A5020';
  const deskRight = '#8B6030';
  
  // Main desk body
  emit(isoBox(gx, gy, 1.2, 0.8, 22, deskTop, deskLeft, deskRight));
  
  // Desk legs (thin dark boxes at corners)
  const legH = 14;
  const legC = '#4a3010';
  // Front-left leg
  const [llx, lly] = g2s(gx, gy+0.7);
  emit(`<rect x="${llx-2}" y="${lly-legH}" width="3" height="${legH}" fill="${legC}"/>`);
  // Front-right leg
  const [lrx, lry] = g2s(gx+1.2, gy+0.7);
  emit(`<rect x="${lrx-2}" y="${lry-legH}" width="3" height="${legH}" fill="${legC}"/>`);
  
  // Monitor (isometric box)
  const [mx, my] = g2s(gx+0.3, gy+0.1);
  const mW = HW * 0.7;
  const mH = HH * 0.7;
  // Monitor base/stand
  emit(`<rect x="${mx-2}" y="${my-26}" width="3" height="8" fill="#2a2a3a"/>`);
  // Monitor screen (flat box tilted)
  const [m1] = [g2s(gx+0.2, gy)];
  const [m2] = [g2s(gx+0.9, gy)];
  const scTop = [[m1[0], m1[1]-38],[m2[0],m2[1]-38]];
  const scBot = [[m1[0], m1[1]-20],[m2[0],m2[1]-20]];
  // Screen body
  emit(`<polygon points="${pts(scTop[0],scTop[1],scBot[1],scBot[0])}" fill="#1a2a3a"/>`);
  // Screen glow content
  emit(`<polygon points="${pts([scTop[0][0]+2,scTop[0][1]+2],[scTop[1][0]-2,scTop[1][1]+2],[scBot[1][0]-2,scBot[1][1]-2],[scBot[0][0]+2,scBot[0][1]-2])}" fill="${screenColor}" opacity="0.5" filter="url(#screenGlow)"/>`);
  // Screen scanlines
  for (let sl=0; sl<3; sl++) {
    const t = (sl+1)/4;
    const sx1 = scTop[0][0] + t*(scBot[0][0]-scTop[0][0])+2;
    const sy1 = scTop[0][1] + t*(scBot[0][1]-scTop[0][1]);
    const sx2 = scTop[1][0] + t*(scBot[1][0]-scTop[1][0])-2;
    const sy2 = scTop[1][1] + t*(scBot[1][1]-scTop[1][1]);
    emit(`<line x1="${sx1}" y1="${sy1}" x2="${sx2}" y2="${sy2}" stroke="${screenColor}" stroke-width="0.6" opacity="0.4"/>`);
  }
  // Monitor frame
  emit(`<polygon points="${pts(scTop[0],scTop[1],scBot[1],scBot[0])}" fill="none" stroke="#334155" stroke-width="0.8"/>`);
  
  // Coffee cup on desk (tiny)
  const [cpx, cpy] = g2s(gx+0.9, gy+0.5);
  emit(`<ellipse cx="${cpx}" cy="${cpy-24}" rx="4" ry="2" fill="#fff" opacity="0.9"/>`);
  emit(`<rect x="${cpx-3}" y="${cpy-30}" width="6" height="8" fill="#fff" opacity="0.9" rx="1"/>`);
  emit(`<rect x="${cpx+2}" y="${cpy-27}" width="3" height="4" fill="none" stroke="#ccc" stroke-width="0.7" rx="1"/>`);
  // steam
  emit(`<path d="M${cpx-1} ${cpy-32} q2,-3 0,-5" stroke="#aaa" stroke-width="0.5" fill="none" opacity="0.6"/>`);
}

// 8 desks around the room
compDesk(1, 1, '#00ff88', 'Rig');
compDesk(1, 3, '#22c55e', 'Nova');
compDesk(1, 5, '#f97316', 'Trader');
compDesk(1, 7, '#3b82f6', 'Scout');
compDesk(9.5, 1, '#06b6d4', 'WebClaw');
compDesk(9.5, 3, '#a855f7', 'FX');
compDesk(9.5, 5, '#ef4444', 'Claw');
compDesk(9.5, 7, '#f59e0b', 'Data');

// ─── MEETING TABLE ──────────────────────────────────────────────────
emit(`<!-- Meeting Table -->`);
{
  // Diamond/hex table at center gx=5..7, gy=4..6
  const cx = g2s(6, 5);
  // Table top face (isometric ellipse-like with polygon)
  const tc = g2s(6, 4.5);
  const tl2 = g2s(5, 5);
  const tr2 = g2s(7, 5);
  const tb2 = g2s(6, 5.5);
  // Approximate the round table as 8-gon
  const tableH = 18;
  // Top face
  const tableTopPts = [
    g2s(5.5, 4), g2s(6.5, 4), g2s(7, 4.5), g2s(7, 5.5), g2s(6.5, 6), g2s(5.5, 6), g2s(5, 5.5), g2s(5, 4.5)
  ];
  emit(`<polygon points="${pts(...tableTopPts)}" fill="#8B5E2A"/>`);
  emit(`<polygon points="${pts(...tableTopPts)}" fill="#A06830" opacity="0.6"/>`);
  // Table edge (bottom shifted down by tableH)
  const tableEdgePts = tableTopPts.map(p => [p[0], p[1]+tableH]);
  // Draw visible left and bottom faces
  // Left/front visible: bottom-left side of the top
  for (let i=4; i<tableTopPts.length; i++) {
    const ni = (i+1) % tableTopPts.length;
    const p1 = tableTopPts[i];
    const p2 = tableTopPts[ni];
    const shading = i < 6 ? '#5a3010' : '#7a4820';
    emit(`<polygon points="${pts(p1,p2,[p2[0],p2[1]+tableH],[p1[0],p1[1]+tableH])}" fill="${shading}"/>`);
  }
  // Table top surface detail
  emit(`<polygon points="${pts(...tableTopPts)}" fill="none" stroke="#c09040" stroke-width="1" opacity="0.5"/>`);
  // Center accent
  const [tcx2, tcy2] = g2s(6, 5);
  emit(`<ellipse cx="${tcx2}" cy="${tcy2}" rx="${HW*0.6}" ry="${HH*0.6}" fill="none" stroke="#c09040" stroke-width="0.8" opacity="0.4"/>`);
  
  // Laptops/tablets on table
  const positions = [g2s(5.5, 4.5), g2s(6.5, 4.5), g2s(5.5, 5.5), g2s(6.5, 5.5)];
  positions.forEach(([lx, ly], i) => {
    const colors = ['#6366f1','#22c55e','#f59e0b','#ec4899'];
    emit(`<rect x="${lx-6}" y="${ly-12}" width="12" height="8" fill="#1a2030" rx="1"/>`);
    emit(`<rect x="${lx-5}" y="${ly-11}" width="10" height="6" fill="${colors[i]}" opacity="0.35"/>`);
  });
}

// ─── SOFA ───────────────────────────────────────────────────────────
emit(`<!-- Sofa -->`);
{
  const sx = 3, sy = 7.2;
  // Sofa back (tall part)
  emit(isoBox(sx, sy, 2, 0.4, 30, '#6b1d1d', '#4a1010', '#5a1818'));
  // Sofa seat (shorter, in front of back)
  emit(isoBox(sx, sy+0.35, 2, 0.5, 16, '#991b1b', '#6b1010', '#7f1d1d'));
  // Sofa armrests
  emit(isoBox(sx, sy, 0.3, 0.85, 22, '#7a1a1a', '#551010', '#661414'));
  emit(isoBox(sx+1.7, sy, 0.3, 0.85, 22, '#7a1a1a', '#551010', '#661414'));
  // Cushion detail
  const [csx, csy] = g2s(sx+0.6, sy+0.4);
  const [cex, cey] = g2s(sx+1.5, sy+0.4);
  emit(`<line x1="${csx}" y1="${csy-20}" x2="${cex}" y2="${cey-20}" stroke="#c04040" stroke-width="1" opacity="0.5"/>`);
}

// ─── COFFEE TABLE near sofa ─────────────────────────────────────────
emit(`<!-- Coffee Table -->`);
{
  emit(isoBox(4, 7, 1, 0.6, 10, '#7a5030', '#4a2810', '#5a3820'));
  // Magazine on table
  const [mx, my] = g2s(4.3, 7.1);
  emit(`<polygon points="${pts(g2s(4.2,7.1),g2s(4.8,7.1),g2s(4.8,7.4),g2s(4.2,7.4))}" fill="#3b82f6" opacity="0.7"/>`);
}

// ─── PLANTS ─────────────────────────────────────────────────────────
emit(`<!-- Plants -->`);
function plant(gx, gy, size=1) {
  const [px, py] = g2s(gx, gy);
  // Pot
  emit(`<polygon points="${pts([px-6*size,py],[px+6*size,py+3*size],[px+4*size,py+10*size],[px-4*size,py+7*size])}" fill="#8B4513"/>`);
  // Plant body - layered circles
  emit(`<ellipse cx="${px}" cy="${py-8*size}" rx="${14*size}" ry="${8*size}" fill="#2D5A27"/>`);
  emit(`<ellipse cx="${px-6*size}" cy="${py-14*size}" rx="${9*size}" ry="${6*size}" fill="#3D7A35"/>`);
  emit(`<ellipse cx="${px+5*size}" cy="${py-16*size}" rx="${10*size}" ry="${7*size}" fill="#2D5A27"/>`);
  emit(`<ellipse cx="${px}" cy="${py-20*size}" rx="${8*size}" ry="${5*size}" fill="#4a8a3d"/>`);
  // Highlight
  emit(`<ellipse cx="${px-3*size}" cy="${py-18*size}" rx="${4*size}" ry="${3*size}" fill="#5aaa4d" opacity="0.5"/>`);
  // Shadow under pot
  emit(`<ellipse cx="${px}" cy="${py+4*size}" rx="${8*size}" ry="${3*size}" fill="url(#shadowGrad)"/>`);
}

plant(0.3, 0.3, 1);       // back left corner
plant(11.5, 0.3, 1);     // back right corner  
plant(0.3, 8.5, 0.85);   // front left corner

// ─── FLOOR LABEL ────────────────────────────────────────────────────
const [flx, fly] = g2s(5, GH-0.1);
emit(`<text x="${flx}" y="${fly+8}" text-anchor="middle" font-size="10" fill="#5a5080" style="font-family:sans-serif; letter-spacing:0.08em; font-weight:500; text-transform:uppercase;">AGENT OFFICE / FLOOR 01</text>`);

console.log(lines.join('\n'));
