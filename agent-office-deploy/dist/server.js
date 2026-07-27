const http = require('http');
const https = require('https');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const agentMeta = require('./calendar-agent-meta.js');
const scheduling = require('./calendar-scheduling.js');
const googleSync = require('./calendar-google-sync.js');

process.env.TZ = process.env.APP_TIMEZONE || 'America/Vancouver';

const PORT = process.env.PORT || 3000;
const DROPS_FILE = path.resolve(__dirname, process.env.DROPS_FILE || 'drops.json');
const MEMORIES_FILE = path.resolve(__dirname, process.env.MEMORIES_FILE || 'memories.json');
const PROJECTS_FILE = path.resolve(__dirname, process.env.PROJECTS_FILE || 'projects.json');
const AGENTS_FILE = path.resolve(__dirname, process.env.AGENTS_FILE || 'agents.json');
const CALENDAR_EVENTS_FILE = path.resolve(__dirname, process.env.CALENDAR_EVENTS_FILE || 'calendar-events.json');
const CALENDAR_DISABLED_RECURRING_FILE = path.resolve(__dirname, process.env.CALENDAR_DISABLED_RECURRING_FILE || 'calendar-disabled-recurring.json');
const CALENDAR_RECURRING_OVERRIDES_FILE = path.resolve(__dirname, process.env.CALENDAR_RECURRING_OVERRIDES_FILE || 'calendar-recurring-overrides.json');
const APP_SETTINGS_FILE = path.resolve(__dirname, process.env.APP_SETTINGS_FILE || '.app-settings.json');
const PROMPTS_FILE = path.resolve(__dirname, process.env.PROMPTS_FILE || 'prompts.json');
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
// Nothing is hardcoded here any more: the calendar reflects Google only.
const RECURRING_CALENDAR_EVENTS = [];
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

async function loadAppSettingsFromFile() {
  try {
    const raw = await fs.readFile(APP_SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function saveAppSettingsToFile(settings) {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(APP_SETTINGS_FILE, JSON.stringify(settings, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    })
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
    async getAppSetting(key) {
      const settings = await loadAppSettingsFromFile();
      return Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : null;
    },
    async setAppSetting(key, value) {
      const settings = await loadAppSettingsFromFile();
      settings[key] = String(value);
      await saveAppSettingsToFile(settings);
    },
    async deleteAppSetting(key) {
      const settings = await loadAppSettingsFromFile();
      const existed = Object.prototype.hasOwnProperty.call(settings, key);
      if (existed) {
        delete settings[key];
        await saveAppSettingsToFile(settings);
      }
      return existed;
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
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
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
    async getAppSetting(key) {
      const result = await pool.query('SELECT value FROM app_settings WHERE key = $1', [key]);
      return result.rows[0] ? result.rows[0].value : null;
    },
    async setAppSetting(key, value) {
      await pool.query(
        `
          INSERT INTO app_settings (key, value, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `,
        [key, String(value)]
      );
    },
    async deleteAppSetting(key) {
      const result = await pool.query('DELETE FROM app_settings WHERE key = $1', [key]);
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

    // Static assets carried no cache headers at all, so browsers fell back to
    // heuristic caching and the ?v= query was the only cache-buster — forget to
    // bump it and a stale stylesheet pairs with fresh markup. Revalidate
    // instead; these files are small and this app is single-user.
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch (error) {
    try {
      const data = await fs.readFile(path.join(__dirname, 'index.html'));
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    } catch (fallbackError) {
      sendJson(res, 500, { error: 'Unable to load application shell.' });
    }
  }
}

// -- GOOGLE CALENDAR INTEGRATION --------------------------------

const GOOGLE_REFRESH_TOKEN_SETTING = 'google_calendar_refresh_token';
const GOOGLE_ACCOUNT_SETTING = 'google_calendar_account';
const CALENDAR_EVENT_META_SETTING = 'calendar_event_meta';
const CALENDAR_PREFERENCES_SETTING = 'calendar_scheduling_preferences';
const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
];
let gcalToken = null; // { access_token, expires_at }

function hasGcalClientCredentials() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function requireCalendarSetupAuth(req, res) {
  if (!PASSPHRASE_HASH) return true;
  if (getSession(req)) return true;
  sendJson(res, 401, { error: 'Unlock Agent Office before changing the Google Calendar connection.' });
  return false;
}

function gcalEncryptionKey() {
  const material = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY || process.env.GOOGLE_CLIENT_SECRET || '';
  if (!material) {
    const error = new Error('Google Calendar token encryption is not configured.');
    error.statusCode = 503;
    throw error;
  }
  return crypto.createHash('sha256').update(`agent-office:gcal:${material}`, 'utf8').digest();
}

function encryptGcalSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', gcalEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decryptGcalSecret(value) {
  const [version, ivValue, tagValue, encryptedValue] = String(value || '').split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Stored Google Calendar credential is invalid.');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    gcalEncryptionKey(),
    Buffer.from(ivValue, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

async function getStoredGcalSecret(key) {
  const storage = await storageReady;
  const encrypted = await storage.getAppSetting(key);
  if (!encrypted) return '';
  return decryptGcalSecret(encrypted);
}

async function setStoredGcalSecret(key, value) {
  const storage = await storageReady;
  await storage.setAppSetting(key, encryptGcalSecret(value));
}

async function deleteStoredGcalSecret(key) {
  const storage = await storageReady;
  return storage.deleteAppSetting(key);
}

// ── Agent Office event metadata store ──────────────────────────────────────
//
// Keyed by the same event id the client uses ("gcal:<googleId>" for Google
// events, the local row id otherwise). This is the authoritative copy; Google
// extendedProperties are written best effort on top of it so the data survives
// outside Agent Office.

let eventMetaCache = null;

async function loadEventMetaMap() {
  if (eventMetaCache) return eventMetaCache;
  const storage = await storageReady;
  const raw = await storage.getAppSetting(CALENDAR_EVENT_META_SETTING);
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    eventMetaCache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.error('Calendar event metadata was unreadable; starting from empty.', error.message);
    eventMetaCache = {};
  }
  return eventMetaCache;
}

async function saveEventMetaMap(map) {
  eventMetaCache = map;
  const storage = await storageReady;
  await storage.setAppSetting(CALENDAR_EVENT_META_SETTING, JSON.stringify(map));
}

async function getEventMeta(eventId) {
  if (!eventId) return {};
  const map = await loadEventMetaMap();
  return agentMeta.normalizeMeta(map[eventId]);
}

async function patchEventMeta(eventId, patch) {
  if (!eventId) return {};
  const map = await loadEventMetaMap();
  const merged = agentMeta.mergeMeta(map[eventId], patch);
  if (agentMeta.isEmptyMeta(merged)) delete map[eventId];
  else map[eventId] = merged;
  await saveEventMetaMap(map);
  return merged;
}

async function deleteEventMeta(eventId) {
  if (!eventId) return;
  const map = await loadEventMetaMap();
  if (!Object.prototype.hasOwnProperty.call(map, eventId)) return;
  delete map[eventId];
  await saveEventMetaMap(map);
}

async function getSchedulingPreferences() {
  const storage = await storageReady;
  const raw = await storage.getAppSetting(CALENDAR_PREFERENCES_SETTING);
  try {
    return scheduling.normalizePreferences(raw ? JSON.parse(raw) : {});
  } catch (error) {
    console.error('Scheduling preferences were unreadable; using defaults.', error.message);
    return scheduling.normalizePreferences({});
  }
}

async function saveSchedulingPreferences(input) {
  const normalized = scheduling.normalizePreferences(input);
  const storage = await storageReady;
  await storage.setAppSetting(CALENDAR_PREFERENCES_SETTING, JSON.stringify(normalized));
  return normalized;
}

async function getGcalRefreshToken() {
  const environmentToken = String(process.env.GOOGLE_REFRESH_TOKEN || '').trim();
  if (environmentToken) return environmentToken;
  try {
    return await getStoredGcalSecret(GOOGLE_REFRESH_TOKEN_SETTING);
  } catch (error) {
    console.error('Unable to decrypt the stored Google Calendar refresh token.', error.message);
    return '';
  }
}

async function getGcalAccount() {
  try {
    const raw = await getStoredGcalSecret(GOOGLE_ACCOUNT_SETTING);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Google's own message is far more useful than a generic failure string, and
// the common causes have a clear next step.
function describeGcalError(error) {
  const raw = (error && error.message ? String(error.message) : '').trim();
  const lower = raw.toLowerCase();
  if (lower.includes('invalid_grant')) {
    return 'The saved Google refresh token is no longer valid (invalid_grant). Reconnect Google Calendar.';
  }
  if (lower.includes('invalid_client')) {
    return 'Google rejected the OAuth client (invalid_client). Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the deployment.';
  }
  if (lower.includes('insufficient') || lower.includes('scope')) {
    return raw + ' - reconnect and grant calendar access.';
  }
  if (lower.includes('has not been used') || lower.includes('is disabled')) {
    return raw + ' - enable the Google Calendar API for this project.';
  }
  return raw || 'Google Calendar could not be refreshed.';
}

async function isGcalConnected() {
  return hasGcalClientCredentials() && Boolean(await getGcalRefreshToken());
}

function safeWebOrigin(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : '';
  } catch {
    return '';
  }
}

function getRequestOrigin(req) {
  const configuredOrigin = safeWebOrigin(process.env.PUBLIC_APP_URL || process.env.APP_ORIGIN || '');
  if (configuredOrigin) return configuredOrigin;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto === 'https' ? 'https' : 'http';
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || req.headers.host || `localhost:${PORT}`;
  return safeWebOrigin(`${protocol}://${host}`) || `http://localhost:${PORT}`;
}

function getGcalRedirectUri(req) {
  const configured = String(process.env.GOOGLE_REDIRECT_URI || '').trim();
  if (configured) {
    const parsed = new URL(configured);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('GOOGLE_REDIRECT_URI must use http or https.');
    }
    return parsed.toString();
  }
  return `${getRequestOrigin(req)}/api/calendar/oauth/callback`;
}

function signGcalOAuthState(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', process.env.GOOGLE_CLIENT_SECRET)
    .update(encoded, 'utf8')
    .digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyGcalOAuthState(state) {
  const [encoded, signature] = String(state || '').split('.');
  if (!encoded || !signature) return null;
  const expected = crypto
    .createHmac('sha256', process.env.GOOGLE_CLIENT_SECRET)
    .update(encoded, 'utf8')
    .digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.expiresAt || payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function createGcalOAuthState(redirectUri) {
  return signGcalOAuthState({
    nonce: crypto.randomBytes(18).toString('base64url'),
    expiresAt: Date.now() + GOOGLE_OAUTH_STATE_TTL_MS,
    redirectUri,
  });
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
        if (!data) {
          if (res.statusCode >= 400) {
            const error = new Error(`Google API HTTP ${res.statusCode}`);
            error.statusCode = res.statusCode;
            reject(error);
          } else {
            resolve({});
          }
          return;
        }
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
  if (!hasGcalClientCredentials()) {
    const error = new Error('Google OAuth client credentials are not configured.');
    error.statusCode = 503;
    throw error;
  }
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  const refreshToken = await getGcalRefreshToken();
  if (!refreshToken) {
    const error = new Error('Google Calendar is not connected.');
    error.statusCode = 503;
    throw error;
  }
  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
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

async function gcalApiRequest(pathname, options = {}) {
  const token = options.accessToken || await getGcalToken();
  const body = options.body === undefined ? null : JSON.stringify(options.body);
  return gcalHttpsRequest({
    host: options.host || 'www.googleapis.com',
    path: pathname,
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
    },
  }, body);
}

async function fetchGcalAccount(accessToken) {
  const profile = await gcalApiRequest('/v1/userinfo', {
    host: 'openidconnect.googleapis.com',
    accessToken,
  });
  return {
    email: typeof profile.email === 'string' ? profile.email : '',
    name: typeof profile.name === 'string' ? profile.name : '',
    picture: typeof profile.picture === 'string' ? profile.picture : '',
  };
}

function toClientGoogleEvent(event, localMeta) {
  const privateFields = (event.extendedProperties && event.extendedProperties.private) || {};
  const meta = agentMeta.resolveMeta(privateFields, localMeta);
  return {
    id: `gcal:${event.id}`,
    gcalId: event.id,
    summary: event.summary || '(No title)',
    description: event.description || '',
    location: event.location || '',
    type: meta.eventKind || privateFields.agentOfficeType || 'meeting',
    source: 'google',
    htmlLink: event.htmlLink || '',
    start: event.start || {},
    end: event.end || {},
    recurringEventId: event.recurringEventId || '',
    updated: event.updated || '',
    meta,
  };
}

// ── Incremental Google sync ────────────────────────────────────────────────
//
// The state machine lives in calendar-google-sync.js so it can be driven by a
// scripted fake Google in tests; here it is just wired to the real HTTP call.

const gcalSync = googleSync.createGoogleSync({
  request: path => gcalApiRequest(path),
});

async function listGoogleCalendarEvents(options = {}) {
  const items = await gcalSync.list(options);
  const metaMap = await loadEventMetaMap();
  return items.map(event => toClientGoogleEvent(event, metaMap[`gcal:${event.id}`]));
}

function resetGcalSyncCache() {
  gcalSync.reset();
}

// ── Agent-aware calendar operations ────────────────────────────────────────

async function withLocalEventMeta(events) {
  const map = await loadEventMetaMap();
  return (Array.isArray(events) ? events : []).map(event => ({
    ...event,
    meta: agentMeta.normalizeMeta(map[event.id]),
  }));
}

// Every scheduling decision needs the same picture of the calendar: whatever is
// on it right now, plus the Agent Office metadata for each block. Times are
// flattened to plain ISO strings here so callers never have to care whether the
// event came from Google or from local storage.
function toSchedulingEvent(event) {
  const pick = side => {
    const value = event[side];
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.dateTime || value.date || '';
  };
  return {
    id: event.id,
    title: event.summary || event.title || '',
    start: pick('start'),
    end: pick('end'),
    meta: agentMeta.normalizeMeta(event.meta),
  };
}

async function currentCalendarEvents() {
  const storage = await storageReady;
  const source = await isGcalConnected()
    ? await listGoogleCalendarEvents()
    : await withLocalEventMeta(await storage.listCalendarEvents());
  return source.map(toSchedulingEvent).filter(event => event.start && event.end);
}

async function suggestScheduleSlots(body = {}) {
  const preferences = await getSchedulingPreferences();
  const events = await currentCalendarEvents();
  const request = body.request && typeof body.request === 'object' ? body.request : body;
  const slots = scheduling.suggestSlots({
    preferences,
    events,
    now: new Date(),
    horizonDays: body.horizonDays,
    limit: body.limit,
    request: {
      durationMinutes: request.durationMinutes,
      priority: request.priority,
      deadline: request.deadline,
      energy: request.energy,
      agentId: request.agentId,
      projectId: request.projectId,
      executionMode: request.executionMode,
      dependsOn: request.dependsOn,
      notBefore: request.notBefore,
    },
  });
  return { slots, preferences };
}

// Turn one sentence into a previewable plan. Nothing is written here - the
// caller shows the blocks, the conflicts, and only then commits.
async function buildSchedulePlan(text) {
  const storage = await storageReady;
  const [agents, projects, preferences, events] = await Promise.all([
    storage.listAgents(),
    storage.listProjects(),
    getSchedulingPreferences(),
    currentCalendarEvents(),
  ]);

  const parsed = scheduling.parseScheduleRequest(text, { agents, projects, now: new Date() });
  if (!parsed.ok) return parsed;
  const request = parsed.request;

  const notBefore = resolvePlanNotBefore(request, events);
  const primarySlots = scheduling.suggestSlots({
    preferences,
    events,
    now: new Date(),
    limit: 3,
    request: {
      durationMinutes: request.durationMinutes,
      priority: request.priority,
      energy: request.action === 'review' ? 'medium' : 'high',
      agentId: request.agent,
      projectId: request.project,
      executionMode: request.executionMode,
      notBefore,
    },
  });

  if (!primarySlots.length) {
    return {
      ok: true,
      request,
      blocks: [],
      conflicts: ['No window in the next two weeks fits that request under your current scheduling preferences.'],
    };
  }

  const primary = primarySlots[0];
  const blocks = [{
    title: scheduling.describeRequest(request),
    start: primary.start,
    end: primary.end,
    score: primary.score,
    reasons: primary.reasons,
    warnings: primary.warnings,
    meta: {
      agentId: request.agent || '',
      projectId: request.project || '',
      eventKind: request.executionMode === 'agent-run' ? 'agent-run' : 'task',
      executionMode: request.executionMode,
      priority: request.priority,
      movable: true,
      estimatedDuration: request.durationMinutes,
      runStatus: request.executionMode === 'agent-run' ? 'scheduled' : '',
    },
  }];

  if (request.followUp) {
    const followUp = request.followUp;
    const followSlots = scheduling.suggestSlots({
      preferences,
      // The follow-up must sit after the primary block, so it has to see it.
      events: events.concat([{ id: 'plan:primary', title: blocks[0].title, start: primary.start, end: primary.end, meta: blocks[0].meta }]),
      now: new Date(),
      limit: 1,
      request: {
        durationMinutes: followUp.durationMinutes,
        priority: request.priority,
        energy: 'medium',
        agentId: followUp.agent,
        projectId: request.project,
        executionMode: followUp.executionMode,
        notBefore: primary.end,
        dependsOn: ['plan:primary'],
      },
    });
    if (followSlots.length) {
      blocks.push({
        title: `${followUp.agentName || followUp.agent || 'Follow-up'} ${followUp.action}`,
        start: followSlots[0].start,
        end: followSlots[0].end,
        score: followSlots[0].score,
        reasons: followSlots[0].reasons,
        warnings: followSlots[0].warnings,
        meta: {
          agentId: followUp.agent || '',
          projectId: request.project || '',
          eventKind: 'review',
          executionMode: followUp.executionMode,
          priority: request.priority,
          movable: true,
          estimatedDuration: followUp.durationMinutes,
          runStatus: followUp.executionMode === 'agent-run' ? 'scheduled' : '',
        },
      });
    }
  }

  // Only genuine problems belong here - "inside a deep-work window" is a reason
  // the slot won, not something to warn about before confirming.
  const conflicts = [];
  blocks.forEach(block => {
    (block.warnings || []).forEach(warning => {
      if (!conflicts.includes(warning)) conflicts.push(warning);
    });
  });

  return { ok: true, request, blocks, conflicts, preferences };
}

function resolvePlanNotBefore(request, events) {
  const now = new Date();
  const day = request.day ? new Date(request.day) : null;
  if (request.constraint === 'after-last-appointment') {
    const reference = day || now;
    const dayKey = reference.toISOString().slice(0, 10);
    const sameDayEnds = events
      .map(event => new Date(event.end))
      .filter(end => !Number.isNaN(end.getTime()) && end.toISOString().slice(0, 10) === dayKey);
    if (sameDayEnds.length) return new Date(Math.max.apply(null, sameDayEnds)).toISOString();
  }
  if (day) {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    return (dayStart > now ? dayStart : now).toISOString();
  }
  return now.toISOString();
}

async function commitScheduleBlocks(blocks) {
  const storage = await storageReady;
  const connected = await isGcalConnected();
  const created = [];
  for (const block of blocks) {
    if (!block || !block.title || !block.start || !block.end) continue;
    const payload = {
      title: String(block.title).slice(0, 300),
      start: block.start,
      end: block.end,
      notes: typeof block.notes === 'string' ? block.notes : '',
      type: (block.meta && block.meta.eventKind) || 'task',
      meta: block.meta || {},
    };
    if (connected) {
      created.push(await createGoogleCalendarEvent(payload));
      continue;
    }
    const id = await storage.createCalendarEvent(payload);
    if (payload.meta && Object.keys(payload.meta).length) await patchEventMeta(id, payload.meta);
    created.push({ id, source: 'local', ...payload });
  }
  return created;
}

// Drive one calendar block through its run lifecycle and keep the agent roster,
// the block, and the agent's memory in step.
async function advanceEventRun(eventId, body = {}) {
  const storage = await storageReady;
  const action = String(body.action || '').trim().toLowerCase();
  if (!agentMeta.RUN_ACTIONS.includes(action)) {
    return { ok: false, statusCode: 400, error: `action must be one of: ${agentMeta.RUN_ACTIONS.join(', ')}.` };
  }

  const current = await getEventMeta(eventId);
  if (action === 'start' && current.executionMode === 'agent-run') {
    const preferences = await getSchedulingPreferences();
    const map = await loadEventMetaMap();
    const running = Object.keys(map).filter(key => key !== eventId && map[key] && map[key].runStatus === 'running').length;
    if (running >= preferences.maxConcurrentAgentRuns) {
      return {
        ok: false,
        statusCode: 409,
        error: `Already at the ${preferences.maxConcurrentAgentRuns} concurrent agent run limit.`,
      };
    }
  }

  const transition = agentMeta.runTransition(current, action, {
    progress: body.progress,
    summary: body.summary,
    resultUrl: body.resultUrl,
    findings: body.findings,
  });
  if (!transition.ok) return { ok: false, statusCode: 409, error: transition.error };

  const meta = await patchEventMeta(eventId, transition.meta);

  // Mirror the new run state onto the Google event when there is one, so the
  // status survives outside Agent Office. Best effort by design.
  const googleId = gcalEventIdFromRoute(eventId);
  if (googleId && await isGcalConnected()) {
    try {
      await patchGoogleCalendarEvent(googleId, { meta });
    } catch (error) {
      console.error('Could not mirror the run status onto Google Calendar.', error.message);
    }
  }

  let agent = null;
  if (transition.agentId) {
    agent = await storage.updateAgent(transition.agentId, transition.agentPatch);
    if (agent && (action === 'start' || action === 'progress')) {
      agent = await storage.heartbeatAgent(transition.agentId);
    }
  }

  // A finished run leaves a trace the agent can read back later.
  if ((action === 'complete' || action === 'fail') && transition.agentId) {
    const summary = [
      action === 'complete' ? 'Completed' : 'Failed',
      meta.projectId ? `project ${meta.projectId}` : '',
      meta.runSummary || '',
      meta.resultUrl || '',
    ].filter(Boolean).join(' - ');
    try {
      await storage.createMemory({
        id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        agent: transition.agentId,
        content: summary.slice(0, 1000),
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Could not record the run summary in agent memory.', error.message);
    }
  }

  return {
    ok: true,
    value: {
      eventId,
      from: transition.from,
      to: transition.to,
      meta,
      status: agentMeta.describeRun(meta),
      agent,
    },
  };
}

// "What are my agents doing today?" - one grouped answer instead of the whole
// calendar with agent work mixed into ordinary appointments.
async function buildAgentTimeline() {
  const storage = await storageReady;
  const [events, agents] = await Promise.all([currentCalendarEvents(), storage.listAgents()]);
  const now = new Date();
  const agentEvents = events.filter(event => agentMeta.isAgentOwned(event.meta));

  const byAgent = new Map();
  agentEvents.forEach(event => {
    const key = event.meta.agentId || 'unassigned';
    if (!byAgent.has(key)) byAgent.set(key, []);
    byAgent.get(key).push({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      projectId: event.meta.projectId || '',
      runStatus: event.meta.runStatus || 'scheduled',
      status: agentMeta.describeRun(event.meta, now),
      resultUrl: event.meta.resultUrl || '',
    });
  });

  return {
    generatedAt: now.toISOString(),
    agents: Array.from(byAgent.entries()).map(([agentId, blocks]) => {
      const record = agents.find(item => item.id === agentId) || null;
      return {
        agentId,
        name: record ? record.name : agentId,
        status: record ? record.status : 'unknown',
        lastHeartbeat: record ? record.last_heartbeat : null,
        blocks: blocks.sort((a, b) => new Date(a.start) - new Date(b.start)),
      };
    }),
    waitingForYou: agentEvents
      .filter(event => event.meta.runStatus === 'needs_input')
      .map(event => ({ id: event.id, title: event.title, agentId: event.meta.agentId || '' })),
    completedOutputs: agentEvents
      .filter(event => event.meta.runStatus === 'completed' && event.meta.resultUrl)
      .map(event => ({ id: event.id, title: event.title, resultUrl: event.meta.resultUrl })),
  };
}

function toGoogleDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error('Calendar event date/time is invalid.');
    error.statusCode = 400;
    throw error;
  }
  return date.toISOString();
}

async function createGoogleCalendarEvent(event) {
  const meta = agentMeta.normalizeMeta({ eventKind: event.type || 'meeting', ...(event.meta || {}) });
  const created = await gcalApiRequest('/calendar/v3/calendars/primary/events', {
    method: 'POST',
    body: {
      summary: event.title,
      description: event.notes || '',
      location: typeof event.location === 'string' ? event.location : undefined,
      start: { dateTime: toGoogleDateTime(event.start), timeZone: process.env.APP_TIMEZONE || 'America/Vancouver' },
      end: { dateTime: toGoogleDateTime(event.end), timeZone: process.env.APP_TIMEZONE || 'America/Vancouver' },
      extendedProperties: {
        private: {
          agentOfficeType: event.type || meta.eventKind || 'meeting',
          ...agentMeta.metaToGooglePrivate(meta),
        },
      },
    },
  });
  // Keep the local mapping table in step so a later Google write failure cannot
  // lose the Agent Office side of the event.
  const clientEvent = toClientGoogleEvent(created, meta);
  if (!agentMeta.isEmptyMeta(meta)) await patchEventMeta(clientEvent.id, meta);
  gcalSync.upsert(created);
  return clientEvent;
}

async function patchGoogleCalendarEvent(eventId, patch) {
  const body = {};
  if (typeof patch.title === 'string' && patch.title.trim()) body.summary = patch.title.trim();
  if (patch.notes !== undefined) body.description = typeof patch.notes === 'string' ? patch.notes : '';
  if (patch.location !== undefined) body.location = typeof patch.location === 'string' ? patch.location : '';
  if (patch.start) body.start = { dateTime: toGoogleDateTime(patch.start), timeZone: process.env.APP_TIMEZONE || 'America/Vancouver' };
  if (patch.end) body.end = { dateTime: toGoogleDateTime(patch.end), timeZone: process.env.APP_TIMEZONE || 'America/Vancouver' };

  const metaPatch = patch.meta && typeof patch.meta === 'object' ? { ...patch.meta } : {};
  if (patch.type) metaPatch.eventKind = String(patch.type);
  if (patch.type || Object.keys(metaPatch).length) {
    // Google replaces the whole private bag on a patch, so merge against what
    // Agent Office already knows rather than sending the delta alone.
    const merged = await patchEventMeta(`gcal:${eventId}`, metaPatch);
    body.extendedProperties = {
      private: {
        agentOfficeType: merged.eventKind || String(patch.type || 'meeting'),
        ...agentMeta.metaToGooglePrivate(merged),
      },
    };
  }
  if (Object.keys(body).length === 0) return {};
  const updated = await gcalApiRequest(`/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body,
  });
  if (updated && updated.id) gcalSync.upsert(updated);
  return updated;
}

async function deleteGoogleCalendarEvent(eventId) {
  const result = await gcalApiRequest(`/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  });
  gcalSync.remove(eventId);
  await deleteEventMeta(`gcal:${eventId}`);
  return result;
}

function gcalEventIdFromRoute(id) {
  return String(id || '').startsWith('gcal:') ? String(id).slice(5) : '';
}

function sendGcalOAuthResult(res, ok, message) {
  const safeMessage = String(message || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
  const eventName = ok ? 'ao-google-calendar-connected' : 'ao-google-calendar-error';
  res.writeHead(ok ? 200 : 400, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(`<!doctype html>
<html><head><meta charset="utf-8"><title>Google Calendar</title></head>
<body style="background:#0a0c11;color:#e2e8f0;font-family:system-ui,sans-serif;padding:40px;text-align:center">
  <h2 style="color:${ok ? '#22c55e' : '#ef4444'}">${ok ? 'Google Calendar connected' : 'Google Calendar connection failed'}</h2>
  <p>${safeMessage}</p>
  <script>
    if (window.opener) window.opener.postMessage({ type: ${JSON.stringify(eventName)} }, window.location.origin);
    setTimeout(function () { window.close(); }, 1200);
  </script>
</body></html>`);
}

// ---------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, getRequestOrigin(req));
  const pathname = parsedUrl.pathname;
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

    if (req.method === 'GET' && pathname === '/api/calendar/oauth/start') {
      if (!hasGcalClientCredentials()) {
        sendJson(res, 503, {
          error: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before connecting Google Calendar.',
        });
        return;
      }
      if (!requireCalendarSetupAuth(req, res)) return;

      const redirectUri = getGcalRedirectUri(req);
      const state = createGcalOAuthState(redirectUri);
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: GOOGLE_SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        state,
      });
      sendJson(res, 200, {
        url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
        redirectUri,
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/calendar/oauth/callback') {
      if (!hasGcalClientCredentials()) {
        sendGcalOAuthResult(res, false, 'Google OAuth client credentials are not configured.');
        return;
      }
      if (parsedUrl.searchParams.get('error')) {
        sendGcalOAuthResult(res, false, 'Google authorization was cancelled or denied.');
        return;
      }
      const code = parsedUrl.searchParams.get('code');
      const state = verifyGcalOAuthState(parsedUrl.searchParams.get('state'));
      if (!code || !state) {
        sendGcalOAuthResult(res, false, 'The authorization request expired or could not be verified.');
        return;
      }
      if (state.redirectUri !== getGcalRedirectUri(req)) {
        sendGcalOAuthResult(res, false, 'The Google OAuth redirect URI did not match the original request.');
        return;
      }

      const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
      const body = new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: state.redirectUri,
        grant_type: 'authorization_code'
      }).toString();
      try {
        const data = await gcalHttpsRequest({
          host: 'oauth2.googleapis.com',
          path: '/token',
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }, body);
        const existingRefreshToken = await getGcalRefreshToken();
        const refreshToken = data.refresh_token || existingRefreshToken;
        if (!refreshToken) {
          sendGcalOAuthResult(res, false, 'Google did not return offline access. Revoke the app in Google Account permissions, then connect again.');
          return;
        }
        if (data.refresh_token) {
          await setStoredGcalSecret(GOOGLE_REFRESH_TOKEN_SETTING, data.refresh_token);
        }
        // A newly authorized account invalidates any sync token from the old one.
        resetGcalSyncCache();
        gcalToken = {
          access_token: data.access_token,
          expires_at: Date.now() + ((data.expires_in || 3600) - 60) * 1000,
        };
        try {
          const account = await fetchGcalAccount(data.access_token);
          await setStoredGcalSecret(GOOGLE_ACCOUNT_SETTING, JSON.stringify(account));
        } catch (profileError) {
          console.warn('Google Calendar connected, but account profile lookup failed.', profileError.message);
        }
        sendGcalOAuthResult(res, true, 'Authorization is complete. You can return to Calendar.');
      } catch (error) {
        console.error('Google Calendar OAuth callback failed.', error);
        sendGcalOAuthResult(res, false, 'Google could not complete the token exchange. Check the OAuth client and redirect URI.');
      }
      return;
    }

    if (req.method === 'GET' && pathname === '/api/calendar/status') {
      const googleConfigured = hasGcalClientCredentials();
      const connected = googleConfigured && await isGcalConnected();
      const account = connected ? await getGcalAccount() : null;
      // A stored refresh token is not proof it still works - check it, so the
      // UI cannot report "connected" while every call is failing.
      let tokenValid = null;
      let tokenError = null;
      if (connected) {
        try {
          await getGcalToken();
          tokenValid = true;
        } catch (error) {
          tokenValid = false;
          tokenError = describeGcalError(error);
        }
      }
      // One canonical shape. Everything else in the app - the toolbar chip, the
      // connection bar, the tests - reads these six fields; the legacy keys
      // below stay only so older clients keep working.
      let syncState = 'disconnected';
      if (!googleConfigured) syncState = 'unconfigured';
      else if (!connected) syncState = 'disconnected';
      else if (tokenValid === false) syncState = 'auth-error';
      else syncState = 'healthy';

      sendJson(res, 200, {
        configured: googleConfigured,
        connected: connected && tokenValid !== false,
        accountEmail: (account && account.email) || null,
        lastSyncedAt: gcalSync.lastSyncedAt,
        syncState,
        error: tokenError || null,

        // Legacy fields.
        googleConfigured,
        tokenValid,
        tokenError,
        account,
        authRequired: Boolean(PASSPHRASE_HASH),
        authenticated: !PASSPHRASE_HASH || Boolean(getSession(req)),
        redirectUri: googleConfigured ? getGcalRedirectUri(req) : null,
      });
      return;
    }

    if (req.method === 'DELETE' && pathname === '/api/calendar/oauth/connection') {
      if (!requireCalendarSetupAuth(req, res)) return;
      if (String(process.env.GOOGLE_REFRESH_TOKEN || '').trim()) {
        sendJson(res, 409, {
          error: 'GOOGLE_REFRESH_TOKEN is set by the deployment. Remove that Railway variable to disconnect it.',
        });
        return;
      }
      await Promise.all([
        deleteStoredGcalSecret(GOOGLE_REFRESH_TOKEN_SETTING),
        deleteStoredGcalSecret(GOOGLE_ACCOUNT_SETTING),
      ]);
      gcalToken = null;
      resetGcalSyncCache();
      sendJson(res, 200, { connected: false, syncState: 'disconnected' });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/calendar/events') {
      // The client needs to tell "nothing is scheduled" apart from "the sync
      // broke" apart from "you never connected". One explicit state does that;
      // an empty array on its own never could.
      if (!await isGcalConnected()) {
        const localEvents = await withLocalEventMeta(await storage.listCalendarEvents());
        sendJson(res, 200, {
          events: localEvents,
          googleConnected: false,
          // Blocks created inside Agent Office still exist without Google, so
          // "disconnected" and "disconnected with local work" are not the same
          // thing to show the user.
          calendarState: localEvents.length ? 'local-only' : 'disconnected',
          syncState: hasGcalClientCredentials() ? 'disconnected' : 'unconfigured',
          lastSyncedAt: null,
        });
        return;
      }
      try {
        // Google is the single source of truth once connected - locally stored
        // events are not merged in, so the calendar mirrors Google exactly.
        const googleEvents = await listGoogleCalendarEvents({
          force: parsedUrl.searchParams.get('refresh') === 'full',
        });
        sendJson(res, 200, {
          events: googleEvents,
          googleConnected: true,
          calendarState: googleEvents.length ? 'connected-with-events' : 'connected-empty',
          syncState: 'healthy',
          lastSyncedAt: gcalSync.lastSyncedAt,
        });
      } catch (error) {
        console.error('Unable to load Google Calendar events.', error);
        sendJson(res, 200, {
          events: [],
          googleConnected: true,
          calendarState: 'sync-error',
          syncState: 'error',
          lastSyncedAt: gcalSync.lastSyncedAt,
          googleError: describeGcalError(error),
        });
      }
      return;
    }

    if (req.method === 'GET' && pathname === '/api/calendar/preferences') {
      sendJson(res, 200, { preferences: await getSchedulingPreferences() });
      return;
    }

    if (req.method === 'PUT' && pathname === '/api/calendar/preferences') {
      if (!requireCalendarSetupAuth(req, res)) return;
      const body = await readJsonBody(req);
      const preferences = await saveSchedulingPreferences(body.preferences || body);
      sendJson(res, 200, { preferences });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/calendar/schedule/suggest') {
      const body = await readJsonBody(req);
      sendJson(res, 200, await suggestScheduleSlots(body));
      return;
    }

    if (req.method === 'POST' && pathname === '/api/calendar/schedule/plan') {
      const body = await readJsonBody(req);
      const plan = await buildSchedulePlan(typeof body.text === 'string' ? body.text : '');
      if (!plan.ok) {
        sendJson(res, 400, { error: plan.error });
        return;
      }
      sendJson(res, 200, plan);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/calendar/schedule/commit') {
      if (!requireCalendarSetupAuth(req, res)) return;
      const body = await readJsonBody(req);
      const blocks = Array.isArray(body.blocks) ? body.blocks : [];
      if (!blocks.length) {
        sendJson(res, 400, { error: 'No blocks to schedule.' });
        return;
      }
      sendJson(res, 201, { created: await commitScheduleBlocks(blocks) });
      return;
    }

    if (req.method === 'POST' && /^\/api\/calendar\/events\/.+\/run$/.test(pathname)) {
      if (!requireCalendarSetupAuth(req, res)) return;
      const id = decodeURIComponent(pathname.slice('/api/calendar/events/'.length, -'/run'.length));
      const body = await readJsonBody(req);
      const result = await advanceEventRun(id, body);
      sendJson(res, result.ok ? 200 : (result.statusCode || 409), result.ok ? result.value : { error: result.error });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/calendar/agent-timeline') {
      sendJson(res, 200, await buildAgentTimeline());
      return;
    }

    if (req.method === 'POST' && pathname === '/api/calendar/events') {
      const body = await readJsonBody(req);
      if (!body.title || !body.start || !body.end) { sendJson(res, 400, { error: 'title, start, end required' }); return; }
      if (await isGcalConnected()) {
        const event = await createGoogleCalendarEvent(body);
        sendJson(res, 201, { id: event.id, gcalId: event.gcalId, event });
        return;
      }
      const id = await storage.createCalendarEvent(body);
      const meta = await patchEventMeta(id, agentMeta.normalizeMeta({
        eventKind: body.type || 'meeting',
        ...(body.meta || {}),
      }));
      sendJson(res, 201, { id, source: 'local', meta });
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
      const id = decodeURIComponent(pathname.slice('/api/calendar/events/'.length));
      const googleEventId = gcalEventIdFromRoute(id);
      if (googleEventId) {
        await deleteGoogleCalendarEvent(googleEventId);
        sendJson(res, 200, { ok: true, source: 'google' });
        return;
      }
      await storage.deleteCalendarEvent(id);
      await deleteEventMeta(id);
      sendJson(res, 200, { ok: true, source: 'local' });
      return;
    }

    if (req.method === 'PATCH' && pathname.startsWith('/api/calendar/events/')) {
      const id = decodeURIComponent(pathname.slice('/api/calendar/events/'.length));
      const body = await readJsonBody(req);
      const googleEventId = gcalEventIdFromRoute(id);
      if (googleEventId) {
        await patchGoogleCalendarEvent(googleEventId, body);
        sendJson(res, 200, { ok: true, source: 'google', meta: await getEventMeta(id) });
        return;
      }
      await storage.patchCalendarEvent(id, body);
      const metaPatch = body.meta && typeof body.meta === 'object' ? { ...body.meta } : {};
      if (body.type) metaPatch.eventKind = String(body.type);
      const meta = Object.keys(metaPatch).length ? await patchEventMeta(id, metaPatch) : await getEventMeta(id);
      sendJson(res, 200, { ok: true, source: 'local', meta });
      return;
    }


    if (req.method === 'POST' && pathname === '/api/calendar/quick-add') {
      if (!await isGcalConnected()) {
        sendJson(res, 503, { error: 'Google Calendar is not connected.' });
        return;
      }
      const body = await readJsonBody(req);
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) {
        sendJson(res, 400, { error: 'text is required.' });
        return;
      }
      const qs = new URLSearchParams({ text });
      const created = await gcalApiRequest(`/calendar/v3/calendars/primary/events/quickAdd?${qs}`, {
        method: 'POST',
      });
      if (created && created.id) gcalSync.upsert(created);
      // quickAdd events start as plain meetings; the Agent Assistant's planner
      // is what attaches agent/project metadata.
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
