const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DROPS_FILE = process.env.DROPS_FILE || path.join('/data', 'drops.json');
const API_KEY = process.env.DROPS_API_KEY || 'devin-key';

function loadDrops() {
  try { return JSON.parse(fs.readFileSync(DROPS_FILE, 'utf8')); } catch(e) { return []; }
}
function saveDrops(drops) {
  fs.writeFileSync(DROPS_FILE, JSON.stringify(drops, null, 2));
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // GET /api/drops — fetch all drops
  if (req.method === 'GET' && url === '/api/drops') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadDrops()));
    return;
  }

  // POST /api/drops — add a drop (requires API key)
  if (req.method === 'POST' && url === '/api/drops') {
    if (req.headers['x-api-key'] !== API_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const drop = JSON.parse(body);
        drop.id = 'drop-' + Date.now();
        drop.date = drop.date || new Date().toISOString();
        drop.done = false;
        const drops = loadDrops();
        drops.unshift(drop);
        saveDrops(drops);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(drop));
      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // DELETE /api/drops/:id — delete a drop (requires API key)
  if (req.method === 'DELETE' && url.startsWith('/api/drops/')) {
    if (req.headers['x-api-key'] !== API_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    const id = url.split('/api/drops/')[1];
    const drops = loadDrops().filter(d => d.id !== id);
    saveDrops(drops);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // PATCH /api/drops/:id — toggle done (requires API key)
  if (req.method === 'PATCH' && url.startsWith('/api/drops/')) {
    if (req.headers['x-api-key'] !== API_KEY) {
      res.writeHead(401); res.end(); return;
    }
    const id = url.split('/api/drops/')[1];
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      const patch = JSON.parse(body || '{}');
      const drops = loadDrops();
      const drop = drops.find(d => d.id === id);
      if (!drop) { res.writeHead(404); res.end(); return; }
      Object.assign(drop, patch);
      saveDrops(drops);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(drop));
    });
    return;
  }

  // Static files
  let filePath = url === '/' || url === '/index.html'
    ? path.join(__dirname, 'index.html')
    : path.join(__dirname, url);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(__dirname, 'index.html'), (err2, data2) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(filePath);
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Agent Office running on port ${PORT}`));
