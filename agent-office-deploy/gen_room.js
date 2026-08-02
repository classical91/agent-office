// Prints the office room's SVG on stdout.
//
// The generator itself lives in dist/room-builder.js so the browser can load it
// too — build mode rebuilds the room live when the room is resized, and running
// one implementation in both places is what stops them drifting apart.
//
//   node gen_room.js            # print the default room
//   node inject_room.js         # render it into dist/ (what you usually want)

const { buildRoom, DEFAULTS } = require('./dist/room-builder.js');

module.exports = { buildRoom, DEFAULTS };

if (require.main === module) {
  try {
    console.log(buildRoom().svg);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
