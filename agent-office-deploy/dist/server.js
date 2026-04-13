const http = require('http');
const https = require('https');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

process.env.TZ = process.env.APP_TIMEZONE || 'America/Vancouver';

const PORT = process.env.PORT || 3000;
const DROPS_FILE = path.join(__dirname, process.env.DROPS_FILE || 'drops.json');
const MEMORIES_FILE = path.join(__dirname, process.env.MEMORIES_FILE || 'memories.json');
const CALENDAR_EVENTS_FILE = path.join(__dirname, process.env.CALENDAR_EVENTS_FILE || 'calendar-events.json');
const CALENDAR_DISABLED_RECURRING_FILE = path.join(__dirname, process.env.CALENDAR_DISABLED_RECURRING_FILE || 'calendar-disabled-recurring.json');
const CALENDAR_RECURRING_OVERRIDES_FILE = path.join(__dirname, process.env.CALENDAR_RECURRING_OVERRIDES_FILE || 'calendar-recurring-overrides.json');
const MAX_BODY_BYTES = 50 * 1024;
const SESSION_COOKIE = 'agent_office_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const ALLOWED_PRIORITIES = new Set(['normal', 'high', 'urgent']);
const ALLOWED_ORIGIN = process.env.APP_ORIGIN || process.env.PUBLIC_APP_URL || '';
const PASSPHRASE_HASH = resolvePassphraseHash();
const sessions = new Map();
const RECURRING_CALENDAR_EVENTS = [
  { seriesId: 'farmbot', title: 'Farmbot Morning Run', s: [9, 0], e: [9, 30], notes: 'Automated: Reaper runs CommentFarm discover + autopost. Posts to @DiamondHands811.', type: 'task', recurring: 'Daily' },
  { seriesId: 'farmbot_session_am', title: 'Farmbot Session', s: [11, 0], e: [11, 30], notes: 'Manual: Farmbot session.', type: 'task', recurring: 'Daily' },
  { seriesId: 'farmbot_session_pm', title: 'Farmbot Session', s: [16, 0], e: [16, 30], notes: 'Manual: Farmbot session.', type: 'task', recurring: 'Daily' },
];
const KNOWN_RECURRING_SERIES = new Set(RECURRING_CALENDAR_EVENTS.map(item => item.seriesId));

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

function validateMemoryInput(input) {
  const agent = typeof input.agent === 'string' ? input.agent.trim() : '';
  const content = typeof input.content === 'string' ? input.content.trim() : '';

  if (!agent || agent.length > 50) {
    return { ok: false, error: 'Agent is required and must be 50 characters or fewer.' };
  }
  if (!content || content.length > 50000) {
    return { ok: false, error: 'Content is required and must be 50,000 characters or fewer.' };
  }
  return { ok: true, value: { agent, content } };
}

function validateMemoryPatchInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'PATCH body must be a JSON object.' };
  }
  const content = typeof input.content === 'string' ? input.content.trim() : '';
  if (!content || content.length > 50000) {
    return { ok: false, error: 'Content is required and must be 50,000 characters or fewer.' };
  }
  return { ok: true, value: { content } };
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

async function loadMemoriesFromFile() {
  try {
    const raw = await fs.readFile(MEMORIES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveMemoriesToFile(memories) {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(MEMORIES_FILE, JSON.stringify(memories, null, 2), 'utf8')
  );
  await writeQueue;
}

function isValidRecurringSeriesId(seriesId) {
  return typeof seriesId === 'string' && /^[a-z0-9_]+$/i.test(seriesId);
}

function recurringEventId(dateStr, seriesId) {
  return `recur_${dateStr}_${seriesId}`;
}

function extractRecurringSeriesId(eventId) {
  const match = String(eventId || '').match(/^recur_\d{4}-\d{2}-\d{2}_(.+)$/);
  return match ? match[1] : null;
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function dateKeyForLocalDate(date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate())
  ].join('-');
}

function buildRecurringEventForDate(baseDate, definition) {
  const day = new Date(baseDate);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), definition.s[0], definition.s[1], 0, 0);
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), definition.e[0], definition.e[1], 0, 0);
  const dateStr = dateKeyForLocalDate(start);
  return {
    id: recurringEventId(dateStr, definition.seriesId),
    title: definition.title,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    notes: definition.notes,
    type: definition.type,
    done: false,
    recurring: definition.recurring,
    series_id: definition.seriesId,
  };
}

function applyRecurringOverride(definition, override) {
  if (!override) return Object.assign({}, definition);
  const merged = Object.assign({}, definition);
  if (override.title !== undefined && override.title !== null) merged.title = override.title;
  if (override.notes !== undefined && override.notes !== null) merged.notes = override.notes;
  if (override.type !== undefined && override.type !== null) merged.type = override.type;
  if (override.recurring !== undefined && override.recurring !== null) merged.recurring = override.recurring;
  if (override.start_hour !== undefined && override.start_hour !== null) {
    merged.s = [Number(override.start_hour), Number(override.start_min || 0)];
  }
  if (override.end_hour !== undefined && override.end_hour !== null) {
    merged.e = [Number(override.end_hour), Number(override.end_min || 0)];
  }
  return merged;
}

function mergeRecurringDefinitions(overrides) {
  const overrideMap = new Map(
    (overrides || [])
      .filter(item => isValidRecurringSeriesId(item.series_id || item.seriesId))
      .map(item => [item.series_id || item.seriesId, item])
  );
  return RECURRING_CALENDAR_EVENTS.map(definition =>
    applyRecurringOverride(definition, overrideMap.get(definition.seriesId))
  );
}

function buildRecurringEvents(disabledSeries, overrides) {
  const disabled = new Set((disabledSeries || []).filter(isValidRecurringSeriesId));
  const definitions = mergeRecurringDefinitions(overrides);
  const events = [];
  const now = new Date();
  for (let offset = 0; offset < 8; offset += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    for (const definition of definitions) {
      if (disabled.has(definition.seriesId)) continue;
      events.push(buildRecurringEventForDate(day, definition));
    }
  }
  return events.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

function toClientCalendarEvent(row) {
  const startValue = row.start_time instanceof Date ? row.start_time.toISOString() : new Date(row.start_time).toISOString();
  const endValue = row.end_time instanceof Date ? row.end_time.toISOString() : new Date(row.end_time).toISOString();
  const seriesId = row.series_id || extractRecurringSeriesId(row.id);
  return {
    id: row.id,
    summary: row.title,
    description: row.notes || '',
    type: row.type || 'meeting',
    done: Boolean(row.done),
    recurring: row.recurring || (seriesId ? 'Daily' : null),
    seriesId: seriesId || null,
    start: { dateTime: startValue, timeZone: 'America/Vancouver' },
    end: { dateTime: endValue, timeZone: 'America/Vancouver' }
  };
}

async function loadCalendarEventsFromFile() {
  try {
    const raw = await fs.readFile(CALENDAR_EVENTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveCalendarEventsToFile(events) {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(CALENDAR_EVENTS_FILE, JSON.stringify(events, null, 2), 'utf8')
  );
  await writeQueue;
}

async function loadDisabledRecurringSeriesFromFile() {
  try {
    const raw = await fs.readFile(CALENDAR_DISABLED_RECURRING_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidRecurringSeriesId) : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveDisabledRecurringSeriesToFile(seriesIds) {
  const uniqueSeries = Array.from(new Set((seriesIds || []).filter(isValidRecurringSeriesId))).sort();
  writeQueue = writeQueue.then(() =>
    fs.writeFile(CALENDAR_DISABLED_RECURRING_FILE, JSON.stringify(uniqueSeries, null, 2), 'utf8')
  );
  await writeQueue;
}

async function loadRecurringOverridesFromFile() {
  try {
    const raw = await fs.readFile(CALENDAR_RECURRING_OVERRIDES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(item => isValidRecurringSeriesId(item.series_id || item.seriesId)) : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveRecurringOverridesToFile(overrides) {
  const normalized = (overrides || [])
    .filter(item => isValidRecurringSeriesId(item.series_id || item.seriesId))
    .map(item => Object.assign({}, item, { series_id: item.series_id || item.seriesId }));
  writeQueue = writeQueue.then(() =>
    fs.writeFile(CALENDAR_RECURRING_OVERRIDES_FILE, JSON.stringify(normalized, null, 2), 'utf8')
  );
  await writeQueue;
}

function buildRecurringOverridePatch(body) {
  const patch = {};
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim();
  if (body.notes !== undefined) patch.notes = typeof body.notes === 'string' ? body.notes : '';
  if (typeof body.type === 'string' && body.type.trim()) patch.type = body.type.trim();
  if (typeof body.recurring === 'string' && body.recurring.trim()) patch.recurring = body.recurring.trim();
  if (body.start && body.end) {
    const start = new Date(body.start);
    const end = new Date(body.end);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      patch.start_hour = start.getHours();
      patch.start_min = start.getMinutes();
      patch.end_hour = end.getHours();
      patch.end_min = end.getMinutes();
    }
  }
  return patch;
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
    async listMemories() {
      return loadMemoriesFromFile();
    },
    async createMemory(mem) {
      const memories = await loadMemoriesFromFile();
      memories.unshift(mem);
      await saveMemoriesToFile(memories);
      return mem;
    },
    async updateMemory(id, content) {
      const memories = await loadMemoriesFromFile();
      const mem = memories.find(m => m.id === id);
      if (!mem) return null;
      mem.content = content;
      mem.updated_at = new Date().toISOString();
      await saveMemoriesToFile(memories);
      return mem;
    },
    async deleteMemory(id) {
      const memories = await loadMemoriesFromFile();
      const next = memories.filter(m => m.id !== id);
      const deleted = next.length !== memories.length;
      if (deleted) await saveMemoriesToFile(next);
      return deleted;
    },
    async listCalendarEvents() {
      const [events, disabledRecurring, recurringOverrides] = await Promise.all([
        loadCalendarEventsFromFile(),
        loadDisabledRecurringSeriesFromFile(),
        loadRecurringOverridesFromFile()
      ]);
      return buildRecurringEvents(disabledRecurring, recurringOverrides)
        .concat(events)
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
        .map(toClientCalendarEvent);
    },
    async createCalendarEvent(ev) {
      const events = await loadCalendarEventsFromFile();
      const id = 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      events.push({
        id,
        title: ev.title,
        start_time: new Date(ev.start).toISOString(),
        end_time: new Date(ev.end).toISOString(),
        notes: ev.notes || '',
        type: ev.type || 'meeting',
        done: false,
      });
      await saveCalendarEventsToFile(events);
      return id;
    },
    async deleteCalendarEvent(id) {
      const events = await loadCalendarEventsFromFile();
      const next = events.filter(event => event.id !== id);
      const deleted = next.length !== events.length;
      if (deleted) await saveCalendarEventsToFile(next);
      return deleted;
    },
    async deleteRecurringSeries(seriesId) {
      if (!KNOWN_RECURRING_SERIES.has(seriesId)) return false;
      const disabledRecurring = await loadDisabledRecurringSeriesFromFile();
      if (!disabledRecurring.includes(seriesId)) {
        disabledRecurring.push(seriesId);
        await saveDisabledRecurringSeriesToFile(disabledRecurring);
      }
      return true;
    },
    async patchRecurringSeries(seriesId, body) {
      if (!KNOWN_RECURRING_SERIES.has(seriesId)) return null;
      const patch = buildRecurringOverridePatch(body);
      const overrides = await loadRecurringOverridesFromFile();
      const existing = overrides.find(item => (item.series_id || item.seriesId) === seriesId) || { series_id: seriesId };
      const next = Object.assign({}, existing, patch, { series_id: seriesId });
      const remaining = overrides.filter(item => (item.series_id || item.seriesId) !== seriesId);
      remaining.push(next);
      await saveRecurringOverridesToFile(remaining);
      return next;
    },
    async patchCalendarEvent(id, body) {
      const events = await loadCalendarEventsFromFile();
      const event = events.find(item => item.id === id);
      if (!event) return null;
      if (body.done !== undefined) event.done = Boolean(body.done);
      if (body.title) event.title = body.title;
      if (body.notes !== undefined) event.notes = body.notes || '';
      if (body.start) event.start_time = new Date(body.start).toISOString();
      if (body.end) event.end_time = new Date(body.end).toISOString();
      if (body.type) event.type = body.type;
      await saveCalendarEventsToFile(events);
      return event;
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      agent VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ NOT NULL,
      notes TEXT,
      type VARCHAR(50) DEFAULT 'meeting',
      done BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendar_disabled_recurring_series (
      series_id TEXT PRIMARY KEY,
      disabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendar_recurring_series_overrides (
      series_id TEXT PRIMARY KEY,
      title VARCHAR(200),
      notes TEXT,
      type VARCHAR(50),
      recurring VARCHAR(50),
      start_hour INTEGER,
      start_min INTEGER,
      end_hour INTEGER,
      end_min INTEGER,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Recurring daily events - ensure today + next 7 days always have entries
  {
    const disabledResult = await pool.query('SELECT series_id FROM calendar_disabled_recurring_series');
    const disabledSeries = new Set(disabledResult.rows.map(row => row.series_id));
    const overrideResult = await pool.query('SELECT * FROM calendar_recurring_series_overrides');
    const recurringDefinitions = mergeRecurringDefinitions(overrideResult.rows).filter(item => !disabledSeries.has(item.seriesId));
    const pad = n => String(n).padStart(2,'0');
    const toISO = (dateStr, [h, m]) => `${dateStr}T${pad(h)}:${pad(m)}:00-07:00`;
    const now = new Date();
    for (let d = 0; d < 8; d++) {
      const day = new Date(now);
      day.setUTCDate(day.getUTCDate() + d);
      const dateStr = day.toISOString().slice(0, 10);
      for (const r of recurringDefinitions) {
        const id = recurringEventId(dateStr, r.seriesId);
        await pool.query(
          'INSERT INTO calendar_events (id,title,start_time,end_time,notes,type) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, notes = EXCLUDED.notes, type = EXCLUDED.type',
          [id, r.title, toISO(dateStr, r.s), toISO(dateStr, r.e), r.notes, r.type]
        );
      }
    }
    // Clean up old hardcoded seed events
    await pool.query("DELETE FROM calendar_events WHERE id IN ('seed_farmbot','seed_xam','seed_xpm','seed_xeve')");
    await pool.query("DELETE FROM calendar_events WHERE id ~ '^recur_.*_(xam|xpm|xeve|farmbot_session_night)$'");
  }

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
    async listMemories() {
      const result = await pool.query(`
        SELECT id, agent, content, created_at AS date, updated_at
        FROM memories
        ORDER BY created_at DESC
      `);
      return result.rows;
    },
    async createMemory(mem) {
      const result = await pool.query(
        `
          INSERT INTO memories (id, agent, content, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $4)
          RETURNING id, agent, content, created_at AS date, updated_at
        `,
        [mem.id, mem.agent, mem.content, mem.date]
      );
      return result.rows[0];
    },
    async updateMemory(id, content) {
      const result = await pool.query(
        `
          UPDATE memories
          SET content = $2, updated_at = NOW()
          WHERE id = $1
          RETURNING id, agent, content, created_at AS date, updated_at
        `,
        [id, content]
      );
      return result.rows[0] || null;
    },
    async deleteMemory(id) {
      const result = await pool.query('DELETE FROM memories WHERE id = $1', [id]);
      return result.rowCount > 0;
    },
    async listCalendarEvents() {
      const result = await pool.query('SELECT * FROM calendar_events ORDER BY start_time ASC');
      return result.rows.map(toClientCalendarEvent);
    },
    async createCalendarEvent(ev) {
      const id = 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
      await pool.query('INSERT INTO calendar_events (id,title,start_time,end_time,notes,type) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, ev.title, ev.start, ev.end, ev.notes || '', ev.type || 'meeting']);
      return id;
    },
    async deleteCalendarEvent(id) {
      const result = await pool.query('DELETE FROM calendar_events WHERE id=$1', [id]);
      return result.rowCount > 0;
    },
    async deleteRecurringSeries(seriesId) {
      if (!KNOWN_RECURRING_SERIES.has(seriesId)) return false;
      await pool.query(
        'INSERT INTO calendar_disabled_recurring_series (series_id) VALUES ($1) ON CONFLICT (series_id) DO NOTHING',
        [seriesId]
      );
      await pool.query(
        'DELETE FROM calendar_events WHERE id ~ $1',
        ['^recur_[0-9]{4}-[0-9]{2}-[0-9]{2}_' + seriesId + '$']
      );
      return true;
    },
    async patchRecurringSeries(seriesId, body) {
      if (!KNOWN_RECURRING_SERIES.has(seriesId)) return null;
      const patch = buildRecurringOverridePatch(body);
      const existingResult = await pool.query('SELECT * FROM calendar_recurring_series_overrides WHERE series_id = $1', [seriesId]);
      const currentOverride = existingResult.rows[0] || { series_id: seriesId };
      const nextOverride = Object.assign({}, currentOverride, patch, { series_id: seriesId });
      await pool.query(
        `
          INSERT INTO calendar_recurring_series_overrides
          (series_id, title, notes, type, recurring, start_hour, start_min, end_hour, end_min, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          ON CONFLICT (series_id) DO UPDATE SET
            title = EXCLUDED.title,
            notes = EXCLUDED.notes,
            type = EXCLUDED.type,
            recurring = EXCLUDED.recurring,
            start_hour = EXCLUDED.start_hour,
            start_min = EXCLUDED.start_min,
            end_hour = EXCLUDED.end_hour,
            end_min = EXCLUDED.end_min,
            updated_at = NOW()
        `,
        [
          seriesId,
          nextOverride.title || null,
          nextOverride.notes !== undefined ? nextOverride.notes : null,
          nextOverride.type || null,
          nextOverride.recurring || null,
          nextOverride.start_hour !== undefined ? nextOverride.start_hour : null,
          nextOverride.start_min !== undefined ? nextOverride.start_min : null,
          nextOverride.end_hour !== undefined ? nextOverride.end_hour : null,
          nextOverride.end_min !== undefined ? nextOverride.end_min : null
        ]
      );

      const mergedDefinition = applyRecurringOverride(
        RECURRING_CALENDAR_EVENTS.find(item => item.seriesId === seriesId),
        nextOverride
      );
      const idPattern = '^recur_[0-9]{4}-[0-9]{2}-[0-9]{2}_' + seriesId + '$';
      const existingRows = await pool.query('SELECT id FROM calendar_events WHERE id ~ $1', [idPattern]);
      const pad = n => String(n).padStart(2, '0');
      const toISO = (dateStr, pair) => `${dateStr}T${pad(pair[0])}:${pad(pair[1])}:00-07:00`;
      for (const row of existingRows.rows) {
        const dateStr = row.id.slice(6, 16);
        await pool.query(
          'UPDATE calendar_events SET title = $2, start_time = $3, end_time = $4, notes = $5, type = $6 WHERE id = $1',
          [row.id, mergedDefinition.title, toISO(dateStr, mergedDefinition.s), toISO(dateStr, mergedDefinition.e), mergedDefinition.notes, mergedDefinition.type]
        );
      }
      return nextOverride;
    },
    async patchCalendarEvent(id, body) {
      if (body.done !== undefined) await pool.query('UPDATE calendar_events SET done=$1 WHERE id=$2', [body.done, id]);
      if (body.title) await pool.query('UPDATE calendar_events SET title=$1 WHERE id=$2', [body.title, id]);
      if (body.notes !== undefined) await pool.query('UPDATE calendar_events SET notes=$1 WHERE id=$2', [body.notes || '', id]);
      if (body.start) await pool.query('UPDATE calendar_events SET start_time=$1 WHERE id=$2', [body.start, id]);
      if (body.end) await pool.query('UPDATE calendar_events SET end_time=$1 WHERE id=$2', [body.end, id]);
      if (body.type) await pool.query('UPDATE calendar_events SET type=$1 WHERE id=$2', [body.type, id]);
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

// -- GOOGLE CALENDAR INTEGRATION --------------------------------

let gcalToken = null; // { access_token, expires_at }

function isGcalConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

function gcalHttpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const bodyBuf = body ? Buffer.from(body) : null;
    const reqOptions = {
      ...options,
      headers: {
        ...options.headers,
        ...(bodyBuf ? { 'Content-Length': bodyBuf.length } : {})
      }
    };
    const req = https.request(reqOptions, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            const err = new Error(
              (parsed.error && (parsed.error.message || parsed.error)) ||
              `Google API HTTP ${res.statusCode}`
            );
            err.statusCode = res.statusCode;
            reject(err);
          } else {
            resolve(parsed);
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

async function getGcalToken() {
  if (gcalToken && gcalToken.expires_at > Date.now() + 60000) {
    return gcalToken.access_token;
  }
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  }).toString();
  const data = await gcalHttpsRequest({
    host: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, body);
  gcalToken = {
    access_token: data.access_token,
    expires_at: Date.now() + ((data.expires_in || 3600) - 60) * 1000
  };
  return gcalToken.access_token;
}

// ---------------------------------------------------------------

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

    // -- MEMORIES API -------------------------------------------
    if (req.method === 'GET' && pathname === '/api/memories') {
      if (!requireDropsAuth(res, req)) return;
      sendJson(res, 200, await storage.listMemories());
      return;
    }

    if (req.method === 'POST' && pathname === '/api/memories') {
      if (!requireDropsAuth(res, req)) return;

      const payload = validateMemoryInput(await readJsonBody(req));
      if (!payload.ok) {
        sendJson(res, 400, { error: payload.error });
        return;
      }

      const mem = await storage.createMemory({
        id: `mem-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now()}`,
        date: new Date().toISOString(),
        ...payload.value,
      });

      sendJson(res, 201, mem);
      return;
    }

    if (req.method === 'PATCH' && pathname.startsWith('/api/memories/')) {
      if (!requireDropsAuth(res, req)) return;

      const id = pathname.slice('/api/memories/'.length).trim();
      if (!id) {
        sendJson(res, 400, { error: 'Memory id is required.' });
        return;
      }

      const payload = validateMemoryPatchInput(await readJsonBody(req));
      if (!payload.ok) {
        sendJson(res, 400, { error: payload.error });
        return;
      }

      const mem = await storage.updateMemory(id, payload.value.content);
      if (!mem) {
        sendJson(res, 404, { error: 'Memory not found.' });
        return;
      }

      sendJson(res, 200, mem);
      return;
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/memories/')) {
      if (!requireDropsAuth(res, req)) return;

      const id = pathname.slice('/api/memories/'.length).trim();
      if (!id) {
        sendJson(res, 400, { error: 'Memory id is required.' });
        return;
      }

      const deleted = await storage.deleteMemory(id);
      if (!deleted) {
        sendJson(res, 404, { error: 'Memory not found.' });
        return;
      }

      sendJson(res, 200, { ok: true });
      return;
    }

    // -- GOOGLE CALENDAR API -------------------------------------


    if (req.method === 'GET' && pathname === '/api/calendar/oauth/callback') {
      const code = parsedUrl.searchParams.get('code');
      if (!code) { sendJson(res, 400, { error: 'Missing code' }); return; }
      const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
      const body = new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: 'https://focused-creativity-production.up.railway.app/api/calendar/oauth/callback',
        grant_type: 'authorization_code'
      }).toString();
      try {
        const data = await gcalHttpsRequest({ host: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, body);
        if (data.refresh_token) {
          process.env.GOOGLE_REFRESH_TOKEN = data.refresh_token;
          gcalToken = { access_token: data.access_token, expires_at: Date.now() + (data.expires_in * 1000) };
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body style="background:#0a0c11;color:#e2e8f0;font-family:sans-serif;padding:40px;text-align:center;"><h2 style="color:#22c55e;">? Google Calendar connected!</h2><p>Refresh token saved. Closing in 3 seconds...</p><script>setTimeout(()=>window.location="/"  ,3000)</script></body></html>');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body style="background:#0a0c11;color:#e2e8f0;font-family:sans-serif;padding:40px;"><h2>No refresh token returned.</h2><p>Go to myaccount.google.com/permissions, revoke access for this app, then try again.</p></body></html>');
        }
      } catch(e) { sendJson(res, 500, { error: e.message }); }
      return;
    }
    if (req.method === 'GET' && pathname === '/api/calendar/status') {
      sendJson(res, 200, { configured: true }); // always show calendar as configured
      return;
    }

    if (req.method === 'GET' && pathname === '/api/calendar/events') {
      const events = await storage.listCalendarEvents();
      sendJson(res, 200, { events });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/calendar/events') {
      const body = await readJsonBody(req);
      if (!body.title || !body.start || !body.end) { sendJson(res, 400, { error: 'title, start, end required' }); return; }
      const id = await storage.createCalendarEvent(body);
      sendJson(res, 200, { id });
      return;
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/calendar/series/')) {
      const seriesId = pathname.slice('/api/calendar/series/'.length).trim();
      if (!seriesId || !isValidRecurringSeriesId(seriesId)) {
        sendJson(res, 400, { error: 'Recurring series id is required.' });
        return;
      }
      const deleted = await storage.deleteRecurringSeries(seriesId);
      if (!deleted) {
        sendJson(res, 404, { error: 'Recurring series not found.' });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'PATCH' && pathname.startsWith('/api/calendar/series/')) {
      const seriesId = pathname.slice('/api/calendar/series/'.length).trim();
      if (!seriesId || !isValidRecurringSeriesId(seriesId)) {
        sendJson(res, 400, { error: 'Recurring series id is required.' });
        return;
      }
      const body = await readJsonBody(req);
      const updated = await storage.patchRecurringSeries(seriesId, body);
      if (!updated) {
        sendJson(res, 404, { error: 'Recurring series not found.' });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/calendar/events/')) {
      const id = pathname.split('/').pop();
      await storage.deleteCalendarEvent(id);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'PATCH' && pathname.startsWith('/api/calendar/events/')) {
      const id = pathname.split('/').pop();
      const body = await readJsonBody(req);
      await storage.patchCalendarEvent(id, body);
      sendJson(res, 200, { ok: true });
      return;
    }


    if (req.method === 'POST' && pathname === '/api/calendar/quick-add') {
      if (!isGcalConfigured()) {
        sendJson(res, 503, { error: 'Google Calendar not configured.' });
        return;
      }
      const body = await readJsonBody(req);
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) {
        sendJson(res, 400, { error: 'text is required.' });
        return;
      }
      const token = await getGcalToken();
      const qs = new URLSearchParams({ text });
      const created = await gcalHttpsRequest({
        host: 'www.googleapis.com',
        path: `/calendar/v3/calendars/primary/events/quickAdd?${qs}`,
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Length': '0' }
      });
      sendJson(res, 201, created);
      return;
    }

    // ------------------------------------------------------------

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
