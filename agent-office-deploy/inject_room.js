// Renders gen_room.js into the office page.
//
// gen_room.js owns the room: the tile grid, the viewBox, and which tile each
// agent works from. This script pushes all of that into the two files that
// have to agree with it —
//   dist/index.html      the <svg id="officesvg"> body and its viewBox
//   dist/app-shared.js   the geometry constants and AGENT_STATIONS
// — so the room and the agents standing in it cannot drift apart. Editing
// either generated block by hand will just be overwritten; edit gen_room.js.

const fs = require('fs');
const path = require('path');

const { buildRoom } = require('./dist/room-builder.js');

let room;
try {
  room = buildRoom();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
const { OX, OY, HW, HH, GW, GH, viewBox } = room.geometry;

const DIST = path.join(__dirname, 'dist');
const BEGIN = '// <<<BEGIN GENERATED ROOM GEOMETRY>>>';
const END = '// <<<END GENERATED ROOM GEOMETRY>>>';

// ─── dist/index.html: SVG body + viewBox ────────────────────────────
const htmlPath = path.join(DIST, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const svgOpenPattern = /<svg id="officesvg"[^>]*>/;
const match = svgOpenPattern.exec(html);
if (!match) {
  console.error('Could not find the <svg id="officesvg"> open tag in dist/index.html');
  process.exit(1);
}

const newOpenTag = match[0].replace(
  /viewBox="[^"]*"/,
  `viewBox="${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}"`
);
if (!/viewBox="/.test(match[0])) {
  console.error('The <svg id="officesvg"> tag has no viewBox attribute to update');
  process.exit(1);
}

const closeIndex = html.indexOf('</svg>', match.index);
if (closeIndex === -1) {
  console.error('Could not find the closing </svg> for #officesvg');
  process.exit(1);
}

html = html.slice(0, match.index) + newOpenTag + '\n' + room.svg + '\n        ' + html.slice(closeIndex);
fs.writeFileSync(htmlPath, html, 'utf8');

// ─── dist/app-shared.js: geometry + stations ────────────────────────
const jsPath = path.join(DIST, 'app-shared.js');
let js = fs.readFileSync(jsPath, 'utf8');

const stationLines = room.stations.map(s => {
  const key = (s.agent + ':').padEnd(12);
  return `  ${key} { gx: ${String(s.gx).padStart(2)}, gy: ${s.gy}, facing: '${s.facing}' },`;
}).join('\n');

const block = `${BEGIN}
// Written by agent-office-deploy/inject_room.js from dist/room-builder.js.
// DO NOT EDIT BY HAND — change the room builder and re-run:
//   node agent-office-deploy/inject_room.js
//
// These are \`let\`, not \`const\`: build mode rebuilds the room in the browser
// when it is resized, and applyRoomGeometry() reassigns them to match.

// Tile grid the room SVG was drawn with. Tiles are addressed 0..gridW-1 across
// and 0..gridH-1 deep; anything outside that is off the floor.
const OFFICE_SCENE = {
  gridW: ${GW},
  gridH: ${GH},
};

// The room is drawn in viewBox coords:
//   tile (gx, gy) top point = (${OX} + (gx - gy) * ${HW}, ${OY} + (gx + gy) * ${HH})
//   tile rhombus is ${HW * 2} wide x ${HH * 2} tall; centre = top + (0, ${HH})
// Agent <div>s are positioned in CSS px, so viewBox -> CSS px is
// (clientWidth / SVG_VB_W) after subtracting the viewBox origin.
let SVG_VB_X = ${viewBox.x};
let SVG_VB_Y = ${viewBox.y};
let SVG_VB_W = ${viewBox.w};
let SVG_VB_H = ${viewBox.h};
let SVG_OX = ${OX};   // viewBox x of tile (0,0) top
let SVG_OY = ${OY};   // viewBox y of tile (0,0) top
let SVG_HW = ${HW};    // half tile width  (viewBox)
let SVG_HH = ${HH};    // half tile height (viewBox)

// One whole tile per agent: the tile directly in front of that agent's desk.
// In *front* of the desk, because agents are DOM nodes layered over the room
// SVG and would otherwise paint straight over the desk they sit at.
let AGENT_STATIONS = {
${stationLines}
};
${END}`;

const beginIndex = js.indexOf(BEGIN);
const endIndex = js.indexOf(END);
if (beginIndex === -1 || endIndex === -1) {
  console.error(`Could not find the ${BEGIN} / ${END} markers in dist/app-shared.js`);
  process.exit(1);
}

js = js.slice(0, beginIndex) + block + js.slice(endIndex + END.length);
fs.writeFileSync(jsPath, js, 'utf8');

console.log(`Room injected: ${GW}x${GH} tiles at ${HW * 2}x${HH * 2}, viewBox "${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}"`);
console.log(`  dist/index.html    ${room.svg.length} chars of SVG`);
console.log(`  dist/app-shared.js ${room.stations.length} agent stations`);
