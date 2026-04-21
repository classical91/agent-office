const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Generate the new SVG room content
const newContent = execSync('node gen_room.js', {
  cwd: __dirname,
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024
});

// Read the HTML file
const htmlPath = path.join(__dirname, 'dist', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Find the SVG open tag and closing tag
const svgOpenPattern = /<svg id="officesvg"[^>]*>/;
const match = svgOpenPattern.exec(html);
if (!match) {
  console.error('Could not find SVG open tag!');
  process.exit(1);
}

const svgStart = match.index + match[0].length;

// Find the matching </svg>
let depth = 1;
let pos = svgStart;
while (pos < html.length && depth > 0) {
  const nextOpen = html.indexOf('<svg', pos);
  const nextClose = html.indexOf('</svg>', pos);
  if (nextClose === -1) break;
  if (nextOpen !== -1 && nextOpen < nextClose) {
    depth++;
    pos = nextOpen + 4;
  } else {
    depth--;
    if (depth === 0) {
      // Replace content between svgStart and nextClose
      const before = html.substring(0, svgStart);
      const after = html.substring(nextClose);
      html = before + '\n' + newContent + '\n        ' + after;
      break;
    }
    pos = nextClose + 6;
  }
}

// Write back
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Successfully replaced SVG room content!');
console.log(`New SVG content: ${newContent.length} characters`);
