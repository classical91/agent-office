const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DROPS_FILE = path.join(__dirname, process.env.DROPS_FILE || 'drops.json');
const MAX_BODY_BYTES = 50 * 1024;
const SESSION_COOKIE = 'agent_office_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const ALLOWED_PRIORITIES = new Set(['normal', 'high', 'urgent']);
const ALLOWED_ORIGIN = process.env.APP_ORIGIN || process.env.PUBLIC_APP_URL || '';
const PASSPHRASE_HASH = resolvePassphraseHash();
const sessions = new Map();

let writeQueue = Promise.resolve();
const storageReady = createStorage();

function resolvePassphraseHash() {
  const configuredHash = normalizeHash(process.env.DROPS_PASSPHRASE_HASH || '');
  if (configuredHash) return configuredHash;

  const configuredPassphrase = process.env.DROPS_PASSPHRASE || '';
  return configuredPassphrase ? sha256(configuredPassphrase) : '';
}

function normalizeHash(value) {
  return String(value || '').trim().toLowerCase();
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function safeCompareHash(input, expectedHash) {
  const actual = Buffer.from(sha256(input), 'utf8');
  const expected = Buffer.from(expectedHash, 'utf8');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${value}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push('Secure');

  return parts.join('; ');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName) return cookies;
    cookies[rawName] = decodeURIComponent(rawValue.join('='));
    return cookies;
  }, {});
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (!session || session.expiresAt <= now) sessions.delete(token);
  }
}

function getSession(req) {
  cleanupExpiredSessions();
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return { token, session };
}

function destroySession(token) {
  if (token) sessions.delete(token);
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, '', {
      maxAge: 0,
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
      secure: process.env.NODE_ENV === 'production',
    })
  );
}

function issueSession(res) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
  res.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, token, {
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
      secure: process.env.NODE_ENV === 'production',
    })
  );
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let settled = false;

    const fail = (statusCode, message) => {
      if (settled) return;
      settled = true;
      const error = new Error(message);
      error.statusCode = statusCode;
      reject(error);
    };

    req.on('data', chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        fail(413, 'Request body too large');
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;

      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        error.statusCode = 400;
        error.message = 'Invalid JSON';
        reject(error);
      }
    });

    req.on('error', error => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

function validateDropInput(input) {
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const content = typeof input.content === 'string' ? input.content.trim() : '';
  const priority = typeof input.priority === 'string' ? input.priority.trim().toLowerCase() : '';

  if (!subject || subject.length > 100) {
    return { ok: false, error: 'Subject is required and must be 100 characters or fewer.' };
  }

  if (!content || content.length > 10000) {
    return { ok: false, error: 'Content is required and must be 10,000 characters or fewer.' };
  }

  if (!ALLOWED_PRIORITIES.has(priority)) {
    return { ok: false, error: 'Priority must be one of normal, high, or urgent.' };
  }

  return {
    ok: true,
    value: {
      subject,
      content,
      priority,
    },
  };
}

function validatePatchInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'PATCH body must be a JSON object.' };
  }

  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== 'done' || typeof input.done !== 'boolean') {
    return { ok: false, error: 'Only the "done" boolean can be updated.' };
  }

  return { ok: true, value: { done: input.done } };
}

function requireDropsAuth(res, req) {
  if (!PASSPHRASE_HASH) {
    sendJson(res, 503, {
      error: 'Dropbox auth is not configured. Set DROPS_PASSPHRASE_HASH or DROPS_PASSPHRASE.',
    });
    return null;
  }

  const activeSession = getSession(req);
  if (!activeSession) {
    sendJson(res, 401, { error: 'Dropbox is locked.' });
    return null;
  }

  res.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, activeSession.token, {
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
      secure: process.env.NODE_ENV === 'production',
    })
  );

  return activeSession;
}

function applyCorsHeaders(req, res) {
  if (!ALLOWED_ORIGIN) return;
  if (req.headers.origin !== ALLOWED_ORIGIN) return;

  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function toClientDrop(row) {
  return {
    id: row.id,
    subject: row.subject,
    content: row.content,
    priority: row.priority,
    done: Boolean(row.done),
    date: row.date || row.created_at || new Date().toISOString(),
  };
}

async function loadDropsFromFile() {
  try {
    const raw = await fs.readFile(DROPS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveDropsToFile(drops) {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(DROPS_FILE, JSON.stringify(drops, null, 2), 'utf8')
  );
  await writeQueue;
}

function createFileStorage() {
  return {
    async listDrops() {
      return loadDropsFromFile();
    },
    async createDrop(drop) {
      const drops = await loadDropsFromFile();
      drops.unshift(drop);
      await saveDropsToFile(drops);
      return drop;
    },
    async deleteDrop(id) {
      const drops = await loadDropsFromFile();
      const nextDrops = drops.filter(drop => drop.id !== id);
      const deleted = nextDrops.length !== drops.length;
      if (deleted) await saveDropsToFile(nextDrops);
      return deleted;
    },
    async updateDropDone(id, done) {
      const drops = await loadDropsFromFile();
      const drop = drops.find(item => item.id === id);
      if (!drop) return null;
      drop.done = done;
      await saveDropsToFile(drops);
      return drop;
    },
  };
}

async function createPostgresStorage() {
  if (!process.env.DATABASE_URL) return null;

  let Pool;
  try {
    ({ Pool } = require('pg'));
  } catch (error) {
    console.error('DATABASE_URL is set but the "pg" package is unavailable. Falling back to file storage.');
    return null;
  }

  const ssl =
    process.env.PGSSLMODE === 'disable'
      ? false
      : process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : undefined;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS drops (
      id TEXT PRIMARY KEY,
      subject VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      priority VARCHAR(16) NOT NULL,
      done BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const existingCount = await pool.query('SELECT COUNT(*)::int AS count FROM drops');
  if (existingCount.rows[0].count === 0) {
    const legacyDrops = await loadDropsFromFile();
    if (legacyDrops.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const drop of legacyDrops) {
          await client.query(
            `
              INSERT INTO drops (id, subject, content, priority, done, created_at)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (id) DO NOTHING
            `,
            [
              drop.id,
              drop.subject,
              drop.content,
              drop.priority,
              Boolean(drop.done),
              drop.date || new Date().toISOString(),
            ]
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  }

  return {
    async listDrops() {
      const result = await pool.query(`
        SELECT id, subject, content, priority, done, created_at AS date
        FROM drops
        ORDER BY created_at DESC
      `);
      return result.rows.map(toClientDrop);
    },
    async createDrop(drop) {
      const result = await pool.query(
        `
          INSERT INTO drops (id, subject, content, priority, done, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, subject, content, priority, done, created_at AS date
        `,
        [drop.id, drop.subject, drop.content, drop.priority, Boolean(drop.done), drop.date]
      );
      return toClientDrop(result.rows[0]);
    },
    async deleteDrop(id) {
      const result = await pool.query('DELETE FROM drops WHERE id = $1', [id]);
      return result.rowCount > 0;
    },
    async updateDropDone(id, done) {
      const result = await pool.query(
        `
          UPDATE drops
          SET done = $2
          WHERE id = $1
          RETURNING id, subject, content, priority, done, created_at AS date
        `,
        [id, done]
      );
      return result.rows[0] ? toClientDrop(result.rows[0]) : null;
    },
  };
}

async function createStorage() {
  try {
    return (await createPostgresStorage()) || createFileStorage();
  } catch (error) {
    console.error('Failed to initialize PostgreSQL storage. Falling back to file storage.', error);
    return createFileStorage();
  }
}

async function handleStatic(req, res, pathname) {
  const relativePath = pathname === '/' || pathname === '/index.html'
    ? 'index.html'
    : decodeURIComponent(pathname).replace(/^\/+/, '');
  const filePath = path.normalize(path.join(__dirname, relativePath));

  if (!filePath.startsWith(__dirname)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const mimeType = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
    }[ext] || 'text/plain; charset=utf-8';

    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  } catch (error) {
    try {
      const data = await fs.readFile(path.join(__dirname, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    } catch (fallbackError) {
      sendJson(res, 500, { error: 'Unable to load application shell.' });
    }
  }
}

const server = http.createServer(async (req, res) => {
  const pathname = req.url.split('?')[0];
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const storage = await storageReady;

    if (req.method === 'GET' && pathname === '/api/session') {
      sendJson(res, 200, {
        authenticated: Boolean(getSession(req)),
        configured: Boolean(PASSPHRASE_HASH),
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/session') {
      if (!PASSPHRASE_HASH) {
        sendJson(res, 503, {
          error: 'Dropbox auth is not configured. Set DROPS_PASSPHRASE_HASH or DROPS_PASSPHRASE.',
        });
        return;
      }

      const body = await readJsonBody(req);
      const passphrase = typeof body.passphrase === 'string' ? body.passphrase : '';
      if (!passphrase || !safeCompareHash(passphrase, PASSPHRASE_HASH)) {
        sendJson(res, 401, { error: 'Incorrect passphrase.' });
        return;
      }

      issueSession(res);
      sendJson(res, 200, { authenticated: true });
      return;
    }

    if (req.method === 'DELETE' && pathname === '/api/session') {
      const activeSession = getSession(req);
      destroySession(activeSession?.token);
      clearSessionCookie(res);
      sendJson(res, 200, { authenticated: false });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/drops') {
      if (!requireDropsAuth(res, req)) return;
      sendJson(res, 200, await storage.listDrops());
      return;
    }

    if (req.method === 'POST' && pathname === '/api/drops') {
      if (!requireDropsAuth(res, req)) return;

      const payload = validateDropInput(await readJsonBody(req));
      if (!payload.ok) {
        sendJson(res, 400, { error: payload.error });
        return;
      }

      const drop = await storage.createDrop({
        id: `drop-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now()}`,
        date: new Date().toISOString(),
        done: false,
        ...payload.value,
      });

      sendJson(res, 201, drop);
      return;
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/drops/')) {
      if (!requireDropsAuth(res, req)) return;

      const id = pathname.slice('/api/drops/'.length).trim();
      if (!id) {
        sendJson(res, 400, { error: 'Drop id is required.' });
        return;
      }

      const deleted = await storage.deleteDrop(id);
      if (!deleted) {
        sendJson(res, 404, { error: 'Drop not found.' });
        return;
      }

      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'PATCH' && pathname.startsWith('/api/drops/')) {
      if (!requireDropsAuth(res, req)) return;

      const id = pathname.slice('/api/drops/'.length).trim();
      if (!id) {
        sendJson(res, 400, { error: 'Drop id is required.' });
        return;
      }

      const payload = validatePatchInput(await readJsonBody(req));
      if (!payload.ok) {
        sendJson(res, 400, { error: payload.error });
        return;
      }

      const drop = await storage.updateDropDone(id, payload.value.done);
      if (!drop) {
        sendJson(res, 404, { error: 'Drop not found.' });
        return;
      }

      sendJson(res, 200, drop);
      return;
    }

    await handleStatic(req, res, pathname);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    sendJson(res, statusCode, { error: error.message || 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Agent Office running on port ${PORT}`);
  if (process.env.DATABASE_URL) {
    console.log('Dropbox storage: PostgreSQL');
  } else {
    console.log('Dropbox storage: JSON file fallback');
  }
});
