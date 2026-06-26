const http = require('http');
const https = require('https');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

process.env.TZ = process.env.APP_TIMEZONE || 'America/Vancouver';

const PORT = process.env.PORT || 3000;
const DROPS_FILE = path.join(__dirname, process.env.DROPS_FILE || 'drops.json');
const MEMORIES_FILE = path.join(__dirname, process.env.MEMORIES_FILE || 'memories.json');
const PROJECTS_FILE = path.join(__dirname, process.env.PROJECTS_FILE || 'projects.json');
const AGENTS_FILE = path.join(__dirname, process.env.AGENTS_FILE || 'agents.json');
const CALENDAR_EVENTS_FILE = path.join(__dirname, process.env.CALENDAR_EVENTS_FILE || 'calendar-events.json');
const CALENDAR_DISABLED_RECURRING_FILE = path.join(__dirname, process.env.CALENDAR_DISABLED_RECURRING_FILE || 'calendar-disabled-recurring.json');
const CALENDAR_RECURRING_OVERRIDES_FILE = path.join(__dirname, process.env.CALENDAR_RECURRING_OVERRIDES_FILE || 'calendar-recurring-overrides.json');
const PROMPTS_FILE = path.join(__dirname, process.env.PROMPTS_FILE || 'prompts.json');
const MAX_BODY_BYTES = 50 * 1024;
const SESSION_COOKIE = 'agent_office_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const ALLOWED_PRIORITIES = new Set(['normal', 'high', 'urgent']);
const ALLOWED_STATUSES = new Set(['inbox', 'idea', 'researching', 'coding', 'reviewing', 'ready_to_deploy', 'done', 'archived']);
const LEGACY_STATUS_MAP = new Map([
  ['ready', 'ready_to_deploy'],
  ['building', 'coding'],
]);
const ALLOWED_AGENT_STATUSES = new Set(['idle', 'running', 'blocked', 'failed', 'needs_input', 'offline']);
const DEFAULT_AGENTS = [
  { id: 'codex', name: 'Codex', role: 'Coding Agent', model: 'GPT-5', status: 'idle', source: 'Codex', notes: 'Repo work, reviews, implementation, and local verification.' },
  { id: 'claude-code', name: 'Claude Code', role: 'Coding Agent', model: 'Claude Sonnet', status: 'idle', source: 'CLI', notes: 'Parallel coding and refactor support.' },
  { id: 'openclaw', name: 'OpenClaw', role: 'Agent Harness', model: 'Mixed', status: 'idle', source: 'OpenClaw', notes: 'Routes low-cost and specialized agent runs.' },
  { id: 'reaper', name: 'Reaper', role: 'Farm Bot', model: 'GPT-4o-mini', status: 'idle', source: 'OpenClaw', notes: 'CommentFarm discover, posting, and engagement cycles.' },
  { id: 'traderclaw', name: 'TraderClaw', role: 'Trading Bot', model: 'Claude Sonnet', status: 'running', source: 'Railway', notes: 'BTC, market dashboard, and trading analysis.' },
  { id: 'webclaw', name: 'WebClaw', role: 'Web Developer', model: 'GPT-5.4', status: 'idle', source: 'Railway', notes: 'Demo sites, client landing pages, and pitch assets.' },
  { id: 'researcher', name: 'Researcher', role: 'Research Agent', model: 'GPT-5', status: 'idle', source: 'Manual', notes: 'Briefs, scans, and source gathering.' },
  { id: 'guardian', name: 'Guardian', role: 'Security Agent', model: 'Claude Sonnet', status: 'idle', source: 'Manual', notes: 'Security checklist, deployment risk, and auth review.' },
  { id: 'farmbot', name: 'FarmBot', role: 'Outreach Agent', model: 'Qwen', status: 'idle', source: 'OpenClaw', notes: 'Scheduled farm sessions and engagement automation.' },
  { id: 'rankforge', name: 'RankForge', role: 'SEO Agent', model: 'Claude Sonnet', status: 'idle', source: 'Railway', notes: 'SEO scans, local search, and content positioning.' },
  { id: 'world-monitor', name: 'World Monitor', role: 'Monitoring Agent', model: 'GPT-5', status: 'idle', source: 'Railway', notes: 'World events and geopolitical watch loops.' },
];
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

function normalizeTag(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

function normalizeTags(input) {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(',')
      : [];
  const tags = [];
  const seen = new Set();
  for (const item of raw) {
    const tag = normalizeTag(item);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 30) break;
  }
  return tags;
}

function normalizeStatus(value, fallback = 'idea') {
  const raw = String(value || '').trim().toLowerCase();
  const mapped = LEGACY_STATUS_MAP.get(raw) || raw || fallback;
  return ALLOWED_STATUSES.has(mapped) ? mapped : fallback;
}

function normalizeIdPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function cleanText(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function deriveDropTitle(input) {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (title) return title.slice(0, 200);
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  if (subject) return subject.slice(0, 200);
  const content = typeof input.content === 'string' ? input.content.trim() : '';
  if (!content) return 'Untitled drop';
  const firstLine = content.split('\n').find(Boolean) || content;
  return firstLine.slice(0, 120);
}

function extractDropLinks(content) {
  const text = typeof content === 'string' ? content : '';
  const matches = text.match(/\[\[(.*?)\]\]/g) || [];
  return matches
    .map(match => match.replace(/^\[\[/, '').replace(/\]\]$/, '').trim())
    .filter(Boolean)
    .slice(0, 50);
}

function validateDropInput(input) {
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const category = typeof input.category === 'string' ? input.category.trim() : subject;
  const project = typeof input.project === 'string' ? input.project.trim() : '';
  const agent = typeof input.agent === 'string' ? input.agent.trim() : '';
  const content = typeof input.content === 'string' ? input.content.trim() : '';
  const priority = typeof input.priority === 'string' ? input.priority.trim().toLowerCase() : '';
  const status = normalizeStatus(input.status, 'idea');
  const title = deriveDropTitle(input);
  const tags = normalizeTags(input.tags);

  if (!content || content.length > 10000) {
    return { ok: false, error: 'Content is required and must be 10,000 characters or fewer.' };
  }

  if (category && category.length > 100) {
    return { ok: false, error: 'Category/subject must be 100 characters or fewer.' };
  }

  if (project.length > 100) {
    return { ok: false, error: 'Project must be 100 characters or fewer.' };
  }

  if (agent.length > 100) {
    return { ok: false, error: 'Agent must be 100 characters or fewer.' };
  }

  if (!title || title.length > 200) {
    return { ok: false, error: 'Title is required and must be 200 characters or fewer.' };
  }

  if (!ALLOWED_PRIORITIES.has(priority)) {
    return { ok: false, error: 'Priority must be one of normal, high, or urgent.' };
  }

  if (!ALLOWED_STATUSES.has(status)) {
    return { ok: false, error: 'Status must be one of inbox, idea, researching, coding, reviewing, ready_to_deploy, done, or archived.' };
  }

  return {
    ok: true,
    value: {
      title,
      subject: category || subject || 'General',
      category: category || subject || 'General',
      project,
      agent,
      tags,
      status,
      links: extractDropLinks(content),
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

function validatePromptInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const subtitle = typeof input.subtitle === 'string' ? input.subtitle.trim() : '';
  const folder = typeof input.folder === 'string' ? input.folder.trim() : '';
  const instructions = typeof input.instructions === 'string' ? input.instructions.trim() : '';

  if (!instructions || instructions.length > 50000) {
    return { ok: false, error: 'Instructions are required and must be 50,000 characters or fewer.' };
  }
  if (name.length > 200) {
    return { ok: false, error: 'Name must be 200 characters or fewer.' };
  }
  if (subtitle.length > 300) {
    return { ok: false, error: 'Subtitle must be 300 characters or fewer.' };
  }
  if (folder.length > 200) {
    return { ok: false, error: 'Folder must be 200 characters or fewer.' };
  }
  return { ok: true, value: { name: name || 'Untitled Prompt', subtitle, folder, instructions } };
}

function validatePatchInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'PATCH body must be a JSON object.' };
  }

  const patch = {};
  if (input.done !== undefined) {
    if (typeof input.done !== 'boolean') return { ok: false, error: 'Done must be a boolean.' };
    patch.done = input.done;
  }
  if (input.title !== undefined) {
    const title = cleanText(input.title, 200);
    if (!title) return { ok: false, error: 'Title cannot be empty.' };
    patch.title = title;
  }
  if (input.subject !== undefined || input.category !== undefined) {
    const subject = cleanText(input.subject !== undefined ? input.subject : input.category, 100);
    patch.subject = subject || 'General';
    patch.category = patch.subject;
  }
  if (input.project !== undefined) patch.project = cleanText(input.project, 100);
  if (input.agent !== undefined) patch.agent = cleanText(input.agent, 100);
  if (input.content !== undefined) {
    const content = cleanText(input.content, 10000);
    if (!content) return { ok: false, error: 'Content cannot be empty.' };
    patch.content = content;
    patch.links = extractDropLinks(content);
  }
  if (input.priority !== undefined) {
    const priority = cleanText(input.priority, 16).toLowerCase();
    if (!ALLOWED_PRIORITIES.has(priority)) return { ok: false, error: 'Priority must be one of normal, high, or urgent.' };
    patch.priority = priority;
  }
  if (input.status !== undefined) {
    const status = normalizeStatus(input.status, '');
    if (!status) return { ok: false, error: 'Status must be one of inbox, idea, researching, coding, reviewing, ready_to_deploy, done, or archived.' };
    patch.status = status;
    patch.done = status === 'done' || status === 'archived';
  }
  if (input.tags !== undefined) patch.tags = normalizeTags(input.tags);

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'No supported fields were provided.' };
  }

  return { ok: true, value: patch };
}

function validateProjectInput(input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Project body must be a JSON object.' };
  const name = cleanText(input.name, 120);
  if (!partial && !name) return { ok: false, error: 'Project name is required.' };
  const value = {};
  if (name) {
    value.name = name;
    value.slug = cleanText(input.slug, 120) || normalizeIdPart(name);
  }
  ['description', 'github_repo', 'railway_url', 'local_path', 'status', 'current_branch', 'last_commit', 'next_action'].forEach(key => {
    if (input[key] !== undefined) value[key] = cleanText(input[key], key === 'description' ? 2000 : 500);
  });
  if (!partial && !value.slug) value.slug = normalizeIdPart(name);
  return { ok: true, value };
}

function validateAgentInput(input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Agent body must be a JSON object.' };
  const name = cleanText(input.name, 100);
  if (!partial && !name) return { ok: false, error: 'Agent name is required.' };
  const value = {};
  if (name) {
    value.name = name;
    value.id = cleanText(input.id, 100) || normalizeIdPart(name);
  }
  ['role', 'model', 'current_task_id', 'current_project_id', 'source', 'notes'].forEach(key => {
    if (input[key] !== undefined) value[key] = cleanText(input[key], key === 'notes' ? 2000 : 500);
  });
  if (input.status !== undefined) {
    const status = cleanText(input.status, 30).toLowerCase();
    if (!ALLOWED_AGENT_STATUSES.has(status)) return { ok: false, error: 'Agent status must be idle, running, blocked, failed, needs_input, or offline.' };
    value.status = status;
  }
  if (input.cost_tokens_today !== undefined) value.cost_tokens_today = Number(input.cost_tokens_today) || 0;
  if (!partial && !value.status) value.status = 'idle';
  if (!partial && !value.id) value.id = normalizeIdPart(name);
  return { ok: true, value };
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function toClientDrop(row) {
  const content = row.content || '';
  const subject = row.subject || row.category || 'General';
  const tags = Array.isArray(row.tags)
    ? row.tags
    : typeof row.tags === 'string'
      ? (() => { try { return JSON.parse(row.tags); } catch { return []; } })()
      : [];
  const links = Array.isArray(row.links)
    ? row.links
    : typeof row.links === 'string'
      ? (() => { try { return JSON.parse(row.links); } catch { return extractDropLinks(content); } })()
      : extractDropLinks(content);

  return {
    id: row.id,
    title: row.title || subject || deriveDropTitle({ content }),
    subject,
    category: row.category || subject,
    project: row.project || '',
    agent: row.agent || '',
    tags,
    status: normalizeStatus(row.status || (row.done ? 'archived' : 'idea'), 'idea'),
    links,
    content,
    priority: row.priority,
    done: Boolean(row.done),
    date: row.date || row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || row.date || row.created_at || new Date().toISOString(),
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

async function loadPromptsFromFile() {
  try {
    const raw = await fs.readFile(PROMPTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function loadProjectsFromFile() {
  try {
    const raw = await fs.readFile(PROJECTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function savePromptsToFile(prompts) {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(PROMPTS_FILE, JSON.stringify(prompts, null, 2), 'utf8')
  );
  await writeQueue;
}

async function saveProjectsToFile(projects) {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf8')
  );
  await writeQueue;
}

async function loadAgentsFromFile() {
  try {
    const raw = await fs.readFile(AGENTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return DEFAULT_AGENTS.map(agent => ({ ...agent }));
    throw error;
  }
}

async function saveAgentsToFile(agents) {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(AGENTS_FILE, JSON.stringify(agents, null, 2), 'utf8')
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

function toClientPrompt(row) {
  return {
    id: row.id,
    name: row.name || 'Untitled Prompt',
    subtitle: row.subtitle || '',
    folder: row.folder || '',
    instructions: row.instructions || '',
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: row.updatedAt || row.updated_at || row.createdAt || row.created_at || new Date().toISOString(),
  };
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
      const drops = await loadDropsFromFile();
      return drops.map(toClientDrop);
    },
    async createDrop(drop) {
      const drops = await loadDropsFromFile();
      drops.unshift(drop);
      await saveDropsToFile(drops);
      return toClientDrop(drop);
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
      drop.status = done ? 'archived' : (drop.status === 'archived' || drop.status === 'done' ? 'idea' : normalizeStatus(drop.status, 'idea'));
      drop.updated_at = new Date().toISOString();
      await saveDropsToFile(drops);
      return toClientDrop(drop);
    },
    async updateDrop(id, patch) {
      const drops = await loadDropsFromFile();
      const drop = drops.find(item => item.id === id);
      if (!drop) return null;
      Object.assign(drop, patch);
      if (patch.done !== undefined && patch.status === undefined) {
        drop.status = patch.done ? 'archived' : (drop.status === 'archived' || drop.status === 'done' ? 'idea' : normalizeStatus(drop.status, 'idea'));
      }
      drop.updated_at = new Date().toISOString();
      await saveDropsToFile(drops);
      return toClientDrop(drop);
    },
    async listProjects() {
      const projects = await loadProjectsFromFile();
      return projects.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    },
    async createProject(project) {
      const projects = await loadProjectsFromFile();
      const now = new Date().toISOString();
      const row = { id: `proj-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now()}`, created_at: now, updated_at: now, ...project };
      projects.unshift(row);
      await saveProjectsToFile(projects);
      return row;
    },
    async updateProject(id, patch) {
      const projects = await loadProjectsFromFile();
      const project = projects.find(item => item.id === id);
      if (!project) return null;
      Object.assign(project, patch, { updated_at: new Date().toISOString() });
      await saveProjectsToFile(projects);
      return project;
    },
    async deleteProject(id) {
      const projects = await loadProjectsFromFile();
      const next = projects.filter(item => item.id !== id);
      const deleted = next.length !== projects.length;
      if (deleted) await saveProjectsToFile(next);
      return deleted;
    },
    async getProjectOverview(id) {
      const projects = await loadProjectsFromFile();
      const project = projects.find(item => item.id === id || item.slug === id);
      if (!project) return null;
      const drops = (await loadDropsFromFile()).map(toClientDrop).filter(drop => drop.project === project.name || drop.project === project.slug);
      const memories = (await loadMemoriesFromFile()).filter(mem => String(mem.content || '').toLowerCase().includes(String(project.name || '').toLowerCase()));
      return { project, drops, memories, prompts: [], links: [project.github_repo, project.railway_url].filter(Boolean) };
    },
    async listAgents() {
      return loadAgentsFromFile();
    },
    async createAgent(agent) {
      const agents = await loadAgentsFromFile();
      const now = new Date().toISOString();
      const row = { created_at: now, updated_at: now, last_heartbeat: '', cost_tokens_today: 0, ...agent };
      agents.unshift(row);
      await saveAgentsToFile(agents);
      return row;
    },
    async updateAgent(id, patch) {
      const agents = await loadAgentsFromFile();
      const agent = agents.find(item => item.id === id);
      if (!agent) return null;
      Object.assign(agent, patch, { updated_at: new Date().toISOString() });
      await saveAgentsToFile(agents);
      return agent;
    },
    async heartbeatAgent(id) {
      return this.updateAgent(id, { last_heartbeat: new Date().toISOString(), status: 'running' });
    },
    async assignAgent(id, assignment) {
      return this.updateAgent(id, {
        current_task_id: cleanText(assignment.taskId || assignment.task_id, 200),
        current_project_id: cleanText(assignment.projectId || assignment.project_id, 200),
        status: cleanText(assignment.status, 30).toLowerCase() || 'running',
      });
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
    async listPrompts() {
      const prompts = await loadPromptsFromFile();
      return prompts.map(toClientPrompt);
    },
    async createPrompt(prompt) {
      const prompts = await loadPromptsFromFile();
      prompts.unshift(prompt);
      await savePromptsToFile(prompts);
      return toClientPrompt(prompt);
    },
    async updatePrompt(id, fields) {
      const prompts = await loadPromptsFromFile();
      const prompt = prompts.find(p => p.id === id);
      if (!prompt) return null;
      prompt.name = fields.name;
      prompt.subtitle = fields.subtitle;
      prompt.folder = fields.folder;
      prompt.instructions = fields.instructions;
      prompt.updatedAt = new Date().toISOString();
      await savePromptsToFile(prompts);
      return toClientPrompt(prompt);
    },
    async deletePrompt(id) {
      const prompts = await loadPromptsFromFile();
      const next = prompts.filter(p => p.id !== id);
      const deleted = next.length !== prompts.length;
      if (deleted) await savePromptsToFile(next);
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
  await pool.query(`ALTER TABLE drops ADD COLUMN IF NOT EXISTS title VARCHAR(200)`);
  await pool.query(`ALTER TABLE drops ADD COLUMN IF NOT EXISTS category VARCHAR(100)`);
  await pool.query(`ALTER TABLE drops ADD COLUMN IF NOT EXISTS project VARCHAR(100) NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE drops ADD COLUMN IF NOT EXISTS agent VARCHAR(100) NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE drops ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'idea'`);
  await pool.query(`ALTER TABLE drops ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE drops ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE drops ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      slug VARCHAR(120) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      github_repo TEXT NOT NULL DEFAULT '',
      railway_url TEXT NOT NULL DEFAULT '',
      local_path TEXT NOT NULL DEFAULT '',
      status VARCHAR(50) NOT NULL DEFAULT '',
      current_branch VARCHAR(120) NOT NULL DEFAULT '',
      last_commit TEXT NOT NULL DEFAULT '',
      next_action TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      role VARCHAR(120) NOT NULL DEFAULT '',
      model VARCHAR(120) NOT NULL DEFAULT '',
      status VARCHAR(30) NOT NULL DEFAULT 'idle',
      current_task_id TEXT NOT NULL DEFAULT '',
      current_project_id TEXT NOT NULL DEFAULT '',
      last_heartbeat TIMESTAMPTZ,
      source VARCHAR(120) NOT NULL DEFAULT '',
      cost_tokens_today NUMERIC NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      name VARCHAR(200) NOT NULL DEFAULT 'Untitled Prompt',
      subtitle VARCHAR(300) NOT NULL DEFAULT '',
      folder VARCHAR(200) NOT NULL DEFAULT '',
      instructions TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE prompts ADD COLUMN IF NOT EXISTS folder VARCHAR(200) NOT NULL DEFAULT ''`);

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
              INSERT INTO drops (id, title, subject, category, project, agent, status, tags, links,
                                 content, priority, done, created_at, updated_at)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
              ON CONFLICT (id) DO NOTHING
            `,
            [
              drop.id,
              drop.title || drop.subject || 'Untitled drop',
              drop.subject || 'General',
              drop.category || drop.subject || 'General',
              drop.project || '',
              drop.agent || '',
              normalizeStatus(drop.status || (drop.done ? 'archived' : 'idea'), 'idea'),
              JSON.stringify(Array.isArray(drop.tags) ? drop.tags : []),
              JSON.stringify(Array.isArray(drop.links) ? drop.links : extractDropLinks(drop.content || '')),
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

  for (const agent of DEFAULT_AGENTS) {
    await pool.query(
      `
        INSERT INTO agents (id, name, role, model, status, source, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO NOTHING
      `,
      [agent.id, agent.name, agent.role, agent.model, agent.status, agent.source, agent.notes]
    );
  }

  return {
    async listDrops() {
      const result = await pool.query(`
        SELECT id, title, subject, category, project, agent, status, tags, links,
               content, priority, done, created_at AS date, updated_at
        FROM drops
        ORDER BY updated_at DESC, created_at DESC
      `);
      return result.rows.map(toClientDrop);
    },
    async createDrop(drop) {
      const result = await pool.query(
        `
          INSERT INTO drops (id, title, subject, category, project, agent, status, tags, links,
                             content, priority, done, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
          RETURNING id, title, subject, category, project, agent, status, tags, links,
                    content, priority, done, created_at AS date, updated_at
        `,
        [
          drop.id, drop.title, drop.subject, drop.category, drop.project, drop.agent || '',
          normalizeStatus(drop.status, 'idea'), JSON.stringify(drop.tags || []), JSON.stringify(drop.links || []),
          drop.content, drop.priority, Boolean(drop.done), drop.date,
        ]
      );
      return toClientDrop(result.rows[0]);
    },
    async deleteDrop(id) {
      const result = await pool.query('DELETE FROM drops WHERE id = $1', [id]);
      return result.rowCount > 0;
    },
    async updateDropDone(id, done) {
      const nextStatus = done ? 'archived' : 'idea';
      const result = await pool.query(
        `
          UPDATE drops
          SET done = $2, status = $3, updated_at = NOW()
          WHERE id = $1
          RETURNING id, title, subject, category, project, agent, status, tags, links,
                    content, priority, done, created_at AS date, updated_at
        `,
        [id, done, nextStatus]
      );
      return result.rows[0] ? toClientDrop(result.rows[0]) : null;
    },
    async updateDrop(id, patch) {
      const allowed = {
        title: 'title',
        subject: 'subject',
        category: 'category',
        project: 'project',
        agent: 'agent',
        status: 'status',
        tags: 'tags',
        links: 'links',
        content: 'content',
        priority: 'priority',
        done: 'done',
      };
      const sets = [];
      const values = [id];
      for (const [key, column] of Object.entries(allowed)) {
        if (patch[key] === undefined) continue;
        values.push(key === 'tags' || key === 'links' ? JSON.stringify(patch[key] || []) : patch[key]);
        sets.push(`${column} = $${values.length}`);
      }
      if (!sets.length) return null;
      const result = await pool.query(
        `
          UPDATE drops
          SET ${sets.join(', ')}, updated_at = NOW()
          WHERE id = $1
          RETURNING id, title, subject, category, project, agent, status, tags, links,
                    content, priority, done, created_at AS date, updated_at
        `,
        values
      );
      return result.rows[0] ? toClientDrop(result.rows[0]) : null;
    },
    async listProjects() {
      const result = await pool.query('SELECT * FROM projects ORDER BY name ASC');
      return result.rows;
    },
    async createProject(project) {
      const id = `proj-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now()}`;
      const result = await pool.query(
        `
          INSERT INTO projects (id, name, slug, description, github_repo, railway_url, local_path, status, current_branch, last_commit, next_action)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          RETURNING *
        `,
        [
          id, project.name, project.slug, project.description || '', project.github_repo || '',
          project.railway_url || '', project.local_path || '', project.status || '',
          project.current_branch || '', project.last_commit || '', project.next_action || ''
        ]
      );
      return result.rows[0];
    },
    async updateProject(id, patch) {
      const allowed = ['name', 'slug', 'description', 'github_repo', 'railway_url', 'local_path', 'status', 'current_branch', 'last_commit', 'next_action'];
      const sets = [];
      const values = [id];
      for (const key of allowed) {
        if (patch[key] === undefined) continue;
        values.push(patch[key]);
        sets.push(`${key} = $${values.length}`);
      }
      if (!sets.length) return null;
      const result = await pool.query(`UPDATE projects SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`, values);
      return result.rows[0] || null;
    },
    async deleteProject(id) {
      const result = await pool.query('DELETE FROM projects WHERE id = $1', [id]);
      return result.rowCount > 0;
    },
    async getProjectOverview(id) {
      const projectResult = await pool.query('SELECT * FROM projects WHERE id = $1 OR slug = $1', [id]);
      const project = projectResult.rows[0];
      if (!project) return null;
      const dropsResult = await pool.query(
        `SELECT id, title, subject, category, project, agent, status, tags, links, content, priority, done, created_at AS date, updated_at
         FROM drops WHERE project = $1 OR project = $2 ORDER BY updated_at DESC`,
        [project.name, project.slug]
      );
      const memoriesResult = await pool.query(
        'SELECT id, agent, content, created_at AS date, updated_at FROM memories WHERE content ILIKE $1 ORDER BY created_at DESC LIMIT 25',
        [`%${project.name}%`]
      );
      return {
        project,
        drops: dropsResult.rows.map(toClientDrop),
        memories: memoriesResult.rows,
        prompts: [],
        links: [project.github_repo, project.railway_url].filter(Boolean),
      };
    },
    async listAgents() {
      const result = await pool.query('SELECT * FROM agents ORDER BY name ASC');
      return result.rows;
    },
    async createAgent(agent) {
      const result = await pool.query(
        `
          INSERT INTO agents (id, name, role, model, status, current_task_id, current_project_id, source, cost_tokens_today, notes)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          RETURNING *
        `,
        [
          agent.id, agent.name, agent.role || '', agent.model || '', agent.status || 'idle',
          agent.current_task_id || '', agent.current_project_id || '', agent.source || '',
          agent.cost_tokens_today || 0, agent.notes || ''
        ]
      );
      return result.rows[0];
    },
    async updateAgent(id, patch) {
      const allowed = ['name', 'role', 'model', 'status', 'current_task_id', 'current_project_id', 'source', 'cost_tokens_today', 'notes'];
      const sets = [];
      const values = [id];
      for (const key of allowed) {
        if (patch[key] === undefined) continue;
        values.push(patch[key]);
        sets.push(`${key} = $${values.length}`);
      }
      if (!sets.length) return null;
      const result = await pool.query(`UPDATE agents SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`, values);
      return result.rows[0] || null;
    },
    async heartbeatAgent(id) {
      const result = await pool.query(
        `UPDATE agents SET last_heartbeat = NOW(), status = 'running', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      return result.rows[0] || null;
    },
    async assignAgent(id, assignment) {
      const result = await pool.query(
        `
          UPDATE agents
          SET current_task_id = $2, current_project_id = $3, status = $4, updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [
          id,
          cleanText(assignment.taskId || assignment.task_id, 200),
          cleanText(assignment.projectId || assignment.project_id, 200),
          cleanText(assignment.status, 30).toLowerCase() || 'running'
        ]
      );
      return result.rows[0] || null;
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
    async listPrompts() {
      const result = await pool.query(`
        SELECT id, name, subtitle, folder, instructions, created_at, updated_at
        FROM prompts
        ORDER BY created_at DESC
      `);
      return result.rows.map(toClientPrompt);
    },
    async createPrompt(prompt) {
      const result = await pool.query(
        `
          INSERT INTO prompts (id, name, subtitle, folder, instructions, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $6)
          RETURNING id, name, subtitle, folder, instructions, created_at, updated_at
        `,
        [prompt.id, prompt.name, prompt.subtitle, prompt.folder, prompt.instructions, prompt.createdAt]
      );
      return toClientPrompt(result.rows[0]);
    },
    async updatePrompt(id, fields) {
      const result = await pool.query(
        `
          UPDATE prompts
          SET name = $2, subtitle = $3, folder = $4, instructions = $5, updated_at = NOW()
          WHERE id = $1
          RETURNING id, name, subtitle, folder, instructions, created_at, updated_at
        `,
        [id, fields.name, fields.subtitle, fields.folder, fields.instructions]
      );
      return result.rows[0] ? toClientPrompt(result.rows[0]) : null;
    },
    async deletePrompt(id) {
      const result = await pool.query('DELETE FROM prompts WHERE id = $1', [id]);
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

      const drop = await storage.updateDrop(id, payload.value);
      if (!drop) {
        sendJson(res, 404, { error: 'Drop not found.' });
        return;
      }

      sendJson(res, 200, drop);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/projects') {
      if (!requireDropsAuth(res, req)) return;
      sendJson(res, 200, await storage.listProjects());
      return;
    }

    if (req.method === 'POST' && pathname === '/api/projects') {
      if (!requireDropsAuth(res, req)) return;
      const payload = validateProjectInput(await readJsonBody(req));
      if (!payload.ok) {
        sendJson(res, 400, { error: payload.error });
        return;
      }
      sendJson(res, 201, await storage.createProject(payload.value));
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/api/projects/') && pathname.endsWith('/overview')) {
      if (!requireDropsAuth(res, req)) return;
      const id = pathname.slice('/api/projects/'.length, -'/overview'.length).trim();
      const overview = await storage.getProjectOverview(id);
      if (!overview) {
        sendJson(res, 404, { error: 'Project not found.' });
        return;
      }
      sendJson(res, 200, overview);
      return;
    }

    if (req.method === 'PATCH' && pathname.startsWith('/api/projects/')) {
      if (!requireDropsAuth(res, req)) return;
      const id = pathname.slice('/api/projects/'.length).trim();
      const payload = validateProjectInput(await readJsonBody(req), true);
      if (!payload.ok) {
        sendJson(res, 400, { error: payload.error });
        return;
      }
      const project = await storage.updateProject(id, payload.value);
      if (!project) {
        sendJson(res, 404, { error: 'Project not found.' });
        return;
      }
      sendJson(res, 200, project);
      return;
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/projects/')) {
      if (!requireDropsAuth(res, req)) return;
      const id = pathname.slice('/api/projects/'.length).trim();
      const deleted = await storage.deleteProject(id);
      if (!deleted) {
        sendJson(res, 404, { error: 'Project not found.' });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/agents') {
      if (!requireDropsAuth(res, req)) return;
      sendJson(res, 200, await storage.listAgents());
      return;
    }

    if (req.method === 'POST' && pathname === '/api/agents') {
      if (!requireDropsAuth(res, req)) return;
      const payload = validateAgentInput(await readJsonBody(req));
      if (!payload.ok) {
        sendJson(res, 400, { error: payload.error });
        return;
      }
      sendJson(res, 201, await storage.createAgent(payload.value));
      return;
    }

    if (req.method === 'POST' && pathname.startsWith('/api/agents/') && pathname.endsWith('/heartbeat')) {
      if (!requireDropsAuth(res, req)) return;
      const id = pathname.slice('/api/agents/'.length, -'/heartbeat'.length).trim();
      const agent = await storage.heartbeatAgent(id);
      if (!agent) {
        sendJson(res, 404, { error: 'Agent not found.' });
        return;
      }
      sendJson(res, 200, agent);
      return;
    }

    if (req.method === 'POST' && pathname.startsWith('/api/agents/') && pathname.endsWith('/assign')) {
      if (!requireDropsAuth(res, req)) return;
      const id = pathname.slice('/api/agents/'.length, -'/assign'.length).trim();
      const agent = await storage.assignAgent(id, await readJsonBody(req));
      if (!agent) {
        sendJson(res, 404, { error: 'Agent not found.' });
        return;
      }
      sendJson(res, 200, agent);
      return;
    }

    if (req.method === 'PATCH' && pathname.startsWith('/api/agents/')) {
      if (!requireDropsAuth(res, req)) return;
      const id = pathname.slice('/api/agents/'.length).trim();
      const payload = validateAgentInput(await readJsonBody(req), true);
      if (!payload.ok) {
        sendJson(res, 400, { error: payload.error });
        return;
      }
      const agent = await storage.updateAgent(id, payload.value);
      if (!agent) {
        sendJson(res, 404, { error: 'Agent not found.' });
        return;
      }
      sendJson(res, 200, agent);
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

    // -- PROMPTS API (open, shared across devices) --------------
    if (req.method === 'GET' && pathname === '/api/prompts') {
      sendJson(res, 200, await storage.listPrompts());
      return;
    }

    if (req.method === 'POST' && pathname === '/api/prompts') {
      const payload = validatePromptInput(await readJsonBody(req));
      if (!payload.ok) {
        sendJson(res, 400, { error: payload.error });
        return;
      }

      const now = new Date().toISOString();
      const prompt = await storage.createPrompt({
        id: `prompt-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now()}`,
        name: payload.value.name,
        subtitle: payload.value.subtitle,
        folder: payload.value.folder,
        instructions: payload.value.instructions,
        createdAt: now,
        updatedAt: now,
      });

      sendJson(res, 201, prompt);
      return;
    }

    if (req.method === 'PUT' && pathname.startsWith('/api/prompts/')) {
      const id = pathname.slice('/api/prompts/'.length).trim();
      if (!id) {
        sendJson(res, 400, { error: 'Prompt id is required.' });
        return;
      }

      const payload = validatePromptInput(await readJsonBody(req));
      if (!payload.ok) {
        sendJson(res, 400, { error: payload.error });
        return;
      }

      const prompt = await storage.updatePrompt(id, payload.value);
      if (!prompt) {
        sendJson(res, 404, { error: 'Prompt not found.' });
        return;
      }

      sendJson(res, 200, prompt);
      return;
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/prompts/')) {
      const id = pathname.slice('/api/prompts/'.length).trim();
      if (!id) {
        sendJson(res, 400, { error: 'Prompt id is required.' });
        return;
      }

      const deleted = await storage.deletePrompt(id);
      if (!deleted) {
        sendJson(res, 404, { error: 'Prompt not found.' });
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

    // ── Config files (per-agent workspace markdown) ────────────────
    if (req.method === 'GET' && pathname.startsWith('/api/config-files')) {
      const CONFIG_DIR = process.env.CONFIG_FILES_DIR || path.join(__dirname, 'config-files');
      const FILE_NAMES = ['SOUL.md','IDENTITY.md','USER.md','AGENTS.md','TOOLS.md','HEARTBEAT.md','MEMORY.md'];
      const agentParam = pathname.slice('/api/config-files'.length).replace(/^\//, '').split('/')[0];

      if (!agentParam) {
        // List available agents (subdirectories)
        try {
          const entries = await fs.readdir(CONFIG_DIR, { withFileTypes: true });
          const agents = entries.filter(e => e.isDirectory()).map(e => e.name);
          sendJson(res, 200, { agents });
        } catch { sendJson(res, 200, { agents: [] }); }
        return;
      }

      // Sanitize agent name
      const safeAgent = agentParam.replace(/[^a-zA-Z0-9_-]/g, '');
      const agentDir = path.join(CONFIG_DIR, safeAgent);
      const results = {};
      await Promise.all(FILE_NAMES.map(async name => {
        try { results[name] = await fs.readFile(path.join(agentDir, name), 'utf8'); }
        catch { results[name] = null; }
      }));
      sendJson(res, 200, results);
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
