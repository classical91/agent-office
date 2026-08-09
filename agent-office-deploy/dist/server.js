const http = require('http');
const https = require('https');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const agentMeta = require('./calendar-agent-meta.js');
const scheduling = require('./calendar-scheduling.js');
const googleSync = require('./calendar-google-sync.js');
const reminderTime = require('./reminder-time.js');
const countdowns = require('./countdowns.js');

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
const STREAKS_FILE = path.resolve(__dirname, process.env.STREAKS_FILE || 'streaks.json');
const STREAK_DAYS_FILE = path.resolve(__dirname, process.env.STREAK_DAYS_FILE || 'streak-days.json');
const COUNTDOWNS_FILE = path.resolve(__dirname, process.env.COUNTDOWNS_FILE || 'countdowns.json');
const VISITS_FILE = path.resolve(__dirname, process.env.VISITS_FILE || 'visits.json');
const MAX_BODY_BYTES = 50 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_COOKIE = 'agent_office_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const ALLOWED_PRIORITIES = new Set(['normal', 'high', 'urgent']);
const ALLOWED_STATUSES = new Set(['inbox', 'idea', 'researching', 'coding', 'reviewing', 'ready_to_deploy', 'done', 'archived']);
const LEGACY_STATUS_MAP = new Map([
  ['ready', 'ready_to_deploy'],
  ['building', 'coding'],
]);
const ALLOWED_AGENT_STATUSES = new Set(['idle', 'running', 'blocked', 'failed', 'needs_input', 'offline']);
const ALLOWED_APP_SETTING_KEYS = new Set(['ao-gateway-local', 'ao-gateway-lan']);
const DEFAULT_AGENTS = [
  { id: 'codex', name: 'Codex', role: 'Coding Agent', model: 'GPT-5', status: 'idle', source: 'Codex', notes: 'Repo work, reviews, implementation, and local verification.' },
  { id: 'claude-code', name: 'Claude Code', role: 'Coding Agent', model: 'Claude Sonnet', status: 'idle', source: 'CLI', notes: 'Parallel coding and refactor support.' },
  { id: 'openclaw', name: 'OpenClaw', role: 'Agent Harness', model: 'Mixed', status: 'idle', source: 'OpenClaw', notes: 'Routes low-cost and specialized agent runs.' },
  { id: 'reaper', name: 'Reaper', role: 'Farm Bot', model: 'GPT-4o-mini', status: 'idle', source: 'OpenClaw', notes: 'Legacy CommentFarm discover, posting, and engagement cycles.' },
  { id: 'traderclaw', name: 'TraderClaw', role: 'Trading Bot', model: 'Claude Sonnet', status: 'running', source: 'Railway', notes: 'BTC, market dashboard, and trading analysis.' },
  { id: 'webclaw', name: 'WebClaw', role: 'Web Developer', model: 'GPT-5.4', status: 'idle', source: 'Railway', notes: 'Demo sites, client landing pages, and pitch assets.' },
  { id: 'studioclaw', name: 'Studio Director', role: 'Studio Routing Lead', model: 'GPT-5.5', status: 'idle', source: 'OpenClaw', notes: 'Routes and reviews studio work under Penny, using YouTube Claw, CommentFarm, Nightwave Audio, News Reporter, and WebClaw; public output stays approval-gated.' },
  { id: 'nightwaveaudio', name: 'Nightwave Audio', role: 'Audio Specialist', model: 'GPT-5.5', status: 'idle', source: 'OpenClaw', notes: 'Nightwave music-maker app, prompts, track concepts, sound-bed workflow, sonic direction, and audio job reporting.' },
  { id: 'youtubeclaw', name: 'YouTube Claw', role: 'YouTube Packaging Specialist', model: 'GPT-5.5', status: 'idle', source: 'OpenClaw', notes: 'Turns video ideas and assets into titles, thumbnail direction, descriptions, tags, chapters, scripts, and publishing prep.' },
  { id: 'commentfarm', name: 'CommentFarm', role: 'Engagement Specialist', model: 'GPT-5.5', status: 'idle', source: 'OpenClaw', notes: 'Drafts concise, platform-aware comments, replies, hooks, and review queues for studio workflows.' },
  { id: 'newsreporter', name: 'News Reporter', role: 'News and Trend Specialist', model: 'GPT-5.5', status: 'idle', source: 'OpenClaw', notes: 'Turns market and news topics into sourced, claim-safe briefs, trend picks, content angles, and reporter-page workflow improvements.' },
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
  const body = await readRawBody(req);
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (error) {
    error.statusCode = 400;
    error.message = 'Invalid JSON';
    throw error;
  }
}

async function readRawBody(req) {
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
      resolve(body);
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

const MAX_DROP_TITLE = 200;

// Two notes called "Telegram Chats with Agents Commands" are two rows you
// cannot tell apart in a list. Every drop that goes in gets a title nothing
// else is using, by counting up: "… (2)", "… (3)".
//
// This is a single-user app, so the read-then-write is not guarded: two drops
// created in the same instant could still collide, and the loser keeps the
// duplicate.
async function uniqueDropTitle(storage, title) {
  const base = String(title || '').trim() || 'Untitled drop';
  const drops = await storage.listDrops();
  const taken = new Set(drops.map(drop => String(drop.title || '').trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;

  for (let n = 2; n <= 500; n += 1) {
    const suffix = ` (${n})`;
    const candidate = base.slice(0, MAX_DROP_TITLE - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  // 500 notes of the same name is not a naming problem any more.
  return base.slice(0, MAX_DROP_TITLE - 14) + ` (${Date.now() % 100000})`;
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

  // `remind`/`when` are the phone-friendly aliases; the form and the API both
  // send `remind_at`. All three take "tomorrow 9am" as happily as an ISO time.
  const reminder = reminderTime.parseReminderTime(
    input.remind_at !== undefined ? input.remind_at : input.remind !== undefined ? input.remind : input.when
  );
  if (!reminder.ok) return { ok: false, error: reminder.error };

  return {
    ok: true,
    value: {
      remind_at: reminder.at ? reminder.at.toISOString() : null,
      title,
      subject: category || subject || (project === 'iOS' ? '' : 'General'),
      category: category || subject || (project === 'iOS' ? '' : 'General'),
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

// ─── Streaks ─────────────────────────────────────────────────────────────────
// A streak is a habit you are keeping; a streak day is one date you kept it.
// Days are stored as plain YYYY-MM-DD keys in the server's timezone, never as
// timestamps: "did I run today" is a question about a calendar day, and a
// timestamp would move the answer across a timezone boundary.

const STREAK_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDayKey(value) {
  if (typeof value !== 'string' || !STREAK_DAY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function todayKey() {
  return dateKeyForLocalDate(new Date());
}

function shiftDayKey(dayKey, days) {
  const [year, month, day] = dayKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return dateKeyForLocalDate(date);
}

function normalizeStreakType(value) {
  const slug = normalizeIdPart(value).slice(0, 32);
  return slug || 'habit';
}

function normalizeStreakColor(value) {
  const color = cleanText(value, 7).toLowerCase();
  return /^#[0-9a-f]{6}$/.test(color) ? color : '';
}

function validateStreakInput(input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }

  const value = {};

  if (input.name !== undefined || !partial) {
    const name = cleanText(input.name, 120);
    if (!name) return { ok: false, error: 'A streak needs a name.' };
    value.name = name;
  }
  if (input.type !== undefined || !partial) value.type = normalizeStreakType(input.type);
  if (input.color !== undefined || !partial) value.color = normalizeStreakColor(input.color);
  if (input.notes !== undefined || !partial) value.notes = cleanText(input.notes, 500);
  if (input.archived !== undefined) value.archived = Boolean(input.archived);
  else if (!partial) value.archived = false;

  if (partial && Object.keys(value).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }
  return { ok: true, value };
}

/**
 * Turn a streak's marked days into the numbers the page shows.
 *
 * The current run is allowed to end on yesterday as well as today: a day you
 * have not finished yet is not a day you have missed, so a streak only breaks
 * once a full day has gone by unmarked.
 */
function computeStreakStats(dayKeys, today = todayKey()) {
  const marked = new Set(dayKeys);
  const sorted = [...marked].sort();
  const stats = {
    total_days: sorted.length,
    current: 0,
    longest: 0,
    first_day: sorted[0] || '',
    last_day: sorted[sorted.length - 1] || '',
    marked_today: marked.has(today),
  };

  let run = 0;
  let previous = '';
  sorted.forEach(day => {
    run = previous && shiftDayKey(previous, 1) === day ? run + 1 : 1;
    previous = day;
    if (run > stats.longest) stats.longest = run;
  });

  let cursor = marked.has(today) ? today : (marked.has(shiftDayKey(today, -1)) ? shiftDayKey(today, -1) : '');
  while (cursor && marked.has(cursor)) {
    stats.current += 1;
    cursor = shiftDayKey(cursor, -1);
  }

  return stats;
}

function toClientStreak(row, dayKeys = []) {
  return {
    id: row.id,
    name: row.name,
    type: row.type || 'habit',
    color: row.color || '',
    notes: row.notes || '',
    archived: Boolean(row.archived),
    created_at: toIsoOrEmpty(row.created_at),
    updated_at: toIsoOrEmpty(row.updated_at),
    stats: computeStreakStats(dayKeys),
  };
}

// ─── Countdowns ──────────────────────────────────────────────────────────────
// The rule for how a countdown repeats is stored as `repeat_rule` in Postgres
// and handed to the client as `repeat`; the column name keeps clear of SQL's
// repeat() and the client name matches what the page and countdowns.js use.

function toClientCountdown(row) {
  return {
    id: row.id,
    title: row.title || '',
    target_at: toIsoOrEmpty(row.target_at),
    category: countdowns.normalizeCategory(row.category),
    repeat: countdowns.normalizeRepeat(row.repeat_rule !== undefined ? row.repeat_rule : row.repeat),
    next_action: row.next_action || '',
    notes: row.notes || '',
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    created_at: toIsoOrEmpty(row.created_at),
    updated_at: toIsoOrEmpty(row.updated_at),
  };
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
  if (input.remind_at !== undefined || input.remind !== undefined) {
    const reminder = reminderTime.parseReminderTime(
      input.remind_at !== undefined ? input.remind_at : input.remind
    );
    if (!reminder.ok) return { ok: false, error: reminder.error };
    patch.remind_at = reminder.at ? reminder.at.toISOString() : null;
  }

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

// Postgres hands back a Date for TIMESTAMPTZ, the JSON file hands back a
// string, and a drop written before reminders existed has neither.
function toIsoOrEmpty(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function toClientDrop(row) {
  const content = row.content || '';
  const project = row.project || '';
  const subject = row.subject || row.category || (project === 'iOS' ? '' : 'General');
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
    project,
    agent: row.agent || '',
    tags,
    status: normalizeStatus(row.status || (row.done ? 'archived' : 'idea'), 'idea'),
    links,
    content,
    priority: row.priority,
    done: Boolean(row.done),
    remind_at: toIsoOrEmpty(row.remind_at),
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

async function loadStreaksFromFile() {
  try {
    const raw = await fs.readFile(STREAKS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveStreaksToFile(streaks) {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(STREAKS_FILE, JSON.stringify(streaks, null, 2), 'utf8')
  );
  await writeQueue;
}

async function loadCountdownsFromFile() {
  try {
    const raw = await fs.readFile(COUNTDOWNS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveCountdownsToFile(rows) {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(COUNTDOWNS_FILE, JSON.stringify(rows, null, 2), 'utf8')
  );
  await writeQueue;
}

async function loadStreakDaysFromFile() {
  try {
    const raw = await fs.readFile(STREAK_DAYS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveStreakDaysToFile(days) {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(STREAK_DAYS_FILE, JSON.stringify(days, null, 2), 'utf8')
  );
  await writeQueue;
}

async function loadVisitsFromFile() {
  try {
    const raw = await fs.readFile(VISITS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveVisitsToFile(visits) {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(VISITS_FILE, JSON.stringify(visits, null, 2), 'utf8')
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
    async listStreaks() {
      const [streaks, days] = await Promise.all([loadStreaksFromFile(), loadStreakDaysFromFile()]);
      return streaks.map(streak =>
        toClientStreak(streak, days.filter(day => day.streak_id === streak.id).map(day => day.day))
      );
    },
    async createStreak(streak) {
      const streaks = await loadStreaksFromFile();
      streaks.push(streak);
      await saveStreaksToFile(streaks);
      return toClientStreak(streak);
    },
    async updateStreak(id, patch) {
      const streaks = await loadStreaksFromFile();
      const streak = streaks.find(item => item.id === id);
      if (!streak) return null;
      Object.assign(streak, patch, { updated_at: new Date().toISOString() });
      await saveStreaksToFile(streaks);
      const days = await loadStreakDaysFromFile();
      return toClientStreak(streak, days.filter(day => day.streak_id === id).map(day => day.day));
    },
    async deleteStreak(id) {
      const streaks = await loadStreaksFromFile();
      const next = streaks.filter(item => item.id !== id);
      const deleted = next.length !== streaks.length;
      if (!deleted) return false;
      await saveStreaksToFile(next);
      const days = await loadStreakDaysFromFile();
      await saveStreakDaysToFile(days.filter(day => day.streak_id !== id));
      return true;
    },
    async listStreakDays(range = {}) {
      const days = await loadStreakDaysFromFile();
      return days
        .filter(day => (!range.from || day.day >= range.from) && (!range.to || day.day <= range.to))
        .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    },
    async listCountdowns() {
      return (await loadCountdownsFromFile()).map(toClientCountdown);
    },
    async createCountdown(countdown) {
      const rows = await loadCountdownsFromFile();
      rows.push(countdown);
      await saveCountdownsToFile(rows);
      return toClientCountdown(countdown);
    },
    async updateCountdown(id, patch) {
      const rows = await loadCountdownsFromFile();
      const row = rows.find(item => item.id === id);
      if (!row) return null;
      Object.assign(row, patch, { updated_at: new Date().toISOString() });
      await saveCountdownsToFile(rows);
      return toClientCountdown(row);
    },
    async deleteCountdown(id) {
      const rows = await loadCountdownsFromFile();
      const next = rows.filter(item => item.id !== id);
      const deleted = next.length !== rows.length;
      if (deleted) await saveCountdownsToFile(next);
      return deleted;
    },
    async markStreakDay(streakId, day, note) {
      const streaks = await loadStreaksFromFile();
      if (!streaks.some(item => item.id === streakId)) return null;
      const days = await loadStreakDaysFromFile();
      const existing = days.find(item => item.streak_id === streakId && item.day === day);
      const row = existing || { streak_id: streakId, day, note: '', created_at: new Date().toISOString() };
      row.note = note;
      if (!existing) days.push(row);
      await saveStreakDaysToFile(days);
      return row;
    },
    async unmarkStreakDay(streakId, day) {
      const days = await loadStreakDaysFromFile();
      const next = days.filter(item => !(item.streak_id === streakId && item.day === day));
      const deleted = next.length !== days.length;
      if (deleted) await saveStreakDaysToFile(next);
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
    async hasVisitor(visitorId) {
      const visits = await loadVisitsFromFile();
      return visits.some(visit => visit.visitor_id === visitorId);
    },
    async recordVisit(visit) {
      const visits = await loadVisitsFromFile();
      visits.unshift(visit);
      await saveVisitsToFile(visits);
      return visit;
    },
    async touchVisit(visitorId, sessionId, seenAt) {
      const visits = await loadVisitsFromFile();
      // The newest row wins: a ping means "still on the page I last opened".
      const visit = visits.find(item => item.visitor_id === visitorId && item.session_id === sessionId);
      if (!visit) return null;
      visit.last_seen_at = seenAt;
      await saveVisitsToFile(visits);
      return visit;
    },
    async listVisits({ since, site, limit }) {
      const visits = await loadVisitsFromFile();
      return visits
        .filter(visit => (!since || new Date(visit.last_seen_at || visit.created_at) >= since)
          && (!site || visit.site === site))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);
    },
    async listVisitSites() {
      const visits = await loadVisitsFromFile();
      return [...new Set(visits.map(visit => visit.site).filter(Boolean))].sort();
    },
    async pruneVisits(before) {
      const visits = await loadVisitsFromFile();
      const next = visits.filter(visit => new Date(visit.created_at) >= before);
      const removed = visits.length - next.length;
      if (removed) await saveVisitsToFile(next);
      return removed;
    },
    async clearVisits() {
      const visits = await loadVisitsFromFile();
      await saveVisitsToFile([]);
      return visits.length;
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
  await pool.query(`ALTER TABLE drops ADD COLUMN IF NOT EXISTS remind_at TIMESTAMPTZ`);
  // Pulling the due reminders is the hot path for the phone Shortcut.
  await pool.query(`CREATE INDEX IF NOT EXISTS drops_remind_at_idx ON drops (remind_at) WHERE remind_at IS NOT NULL`);

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
    CREATE TABLE IF NOT EXISTS streaks (
      id TEXT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      type VARCHAR(32) NOT NULL DEFAULT 'habit',
      color VARCHAR(7) NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      archived BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // The day is a calendar key (YYYY-MM-DD) rather than a DATE or a timestamp:
  // the app decides which day a mark belongs to, and storing it as text keeps
  // the driver from handing back a Date that a timezone can shift.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS streak_days (
      streak_id TEXT NOT NULL REFERENCES streaks(id) ON DELETE CASCADE,
      day CHAR(10) NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (streak_id, day)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS streak_days_day_idx ON streak_days (day)`);

  // `target_at` is the first time the countdown comes due, not the next one:
  // the next one is worked out on every read from the repeat rule, so a
  // repeating card never needs a write just because a day went by.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS countdowns (
      id TEXT PRIMARY KEY,
      title VARCHAR(160) NOT NULL,
      target_at TIMESTAMPTZ NOT NULL,
      category VARCHAR(32) NOT NULL DEFAULT 'deadline',
      repeat_rule VARCHAR(16) NOT NULL DEFAULT 'none',
      next_action TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      pinned BOOLEAN NOT NULL DEFAULT FALSE,
      archived BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS countdowns_target_idx ON countdowns (target_at)`);

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

  // One row per page view. `visitor_id` and `session_id` are random ids the
  // browser made up about itself - they are meaningless outside this table and
  // are never matched against anything.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      site VARCHAR(120) NOT NULL DEFAULT '',
      visitor_id VARCHAR(64) NOT NULL,
      session_id VARCHAR(64) NOT NULL,
      path TEXT NOT NULL DEFAULT '/',
      title VARCHAR(200) NOT NULL DEFAULT '',
      referrer TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      ip VARCHAR(64) NOT NULL DEFAULT '',
      screen VARCHAR(32) NOT NULL DEFAULT '',
      is_returning BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // The live view reads by recency and the "have I seen you before" check reads
  // by visitor, and both run on every page view.
  await pool.query(`CREATE INDEX IF NOT EXISTS visits_last_seen_idx ON visits (last_seen_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS visits_visitor_idx ON visits (visitor_id)`);

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
               content, priority, done, remind_at, created_at AS date, updated_at
        FROM drops
        ORDER BY updated_at DESC, created_at DESC
      `);
      return result.rows.map(toClientDrop);
    },
    async createDrop(drop) {
      const result = await pool.query(
        `
          INSERT INTO drops (id, title, subject, category, project, agent, status, tags, links,
                             content, priority, done, remind_at, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
          RETURNING id, title, subject, category, project, agent, status, tags, links,
                    content, priority, done, remind_at, created_at AS date, updated_at
        `,
        [
          drop.id, drop.title, drop.subject, drop.category, drop.project, drop.agent || '',
          normalizeStatus(drop.status, 'idea'), JSON.stringify(drop.tags || []), JSON.stringify(drop.links || []),
          drop.content, drop.priority, Boolean(drop.done), drop.remind_at || null, drop.date,
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
                    content, priority, done, remind_at, created_at AS date, updated_at
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
        remind_at: 'remind_at',
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
                    content, priority, done, remind_at, created_at AS date, updated_at
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
        `SELECT id, title, subject, category, project, agent, status, tags, links, content, priority, done, remind_at, created_at AS date, updated_at
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
    async listStreaks() {
      const streaksResult = await pool.query(`
        SELECT id, name, type, color, notes, archived, created_at, updated_at
        FROM streaks
        ORDER BY created_at ASC
      `);
      const daysResult = await pool.query('SELECT streak_id, day FROM streak_days');
      const byStreak = new Map();
      daysResult.rows.forEach(row => {
        const list = byStreak.get(row.streak_id) || [];
        list.push(row.day);
        byStreak.set(row.streak_id, list);
      });
      return streaksResult.rows.map(row => toClientStreak(row, byStreak.get(row.id) || []));
    },
    async createStreak(streak) {
      const result = await pool.query(
        `
          INSERT INTO streaks (id, name, type, color, notes, archived, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
          RETURNING id, name, type, color, notes, archived, created_at, updated_at
        `,
        [streak.id, streak.name, streak.type, streak.color, streak.notes, streak.archived, streak.created_at]
      );
      return toClientStreak(result.rows[0]);
    },
    async updateStreak(id, patch) {
      const result = await pool.query(
        `
          UPDATE streaks SET
            name = COALESCE($2, name),
            type = COALESCE($3, type),
            color = COALESCE($4, color),
            notes = COALESCE($5, notes),
            archived = COALESCE($6, archived),
            updated_at = NOW()
          WHERE id = $1
          RETURNING id, name, type, color, notes, archived, created_at, updated_at
        `,
        [
          id,
          patch.name === undefined ? null : patch.name,
          patch.type === undefined ? null : patch.type,
          patch.color === undefined ? null : patch.color,
          patch.notes === undefined ? null : patch.notes,
          patch.archived === undefined ? null : patch.archived,
        ]
      );
      if (!result.rows[0]) return null;
      const days = await pool.query('SELECT day FROM streak_days WHERE streak_id = $1', [id]);
      return toClientStreak(result.rows[0], days.rows.map(row => row.day));
    },
    async deleteStreak(id) {
      const result = await pool.query('DELETE FROM streaks WHERE id = $1', [id]);
      return result.rowCount > 0;
    },
    async listCountdowns() {
      const result = await pool.query(`
        SELECT id, title, target_at, category, repeat_rule, next_action, notes, pinned, archived, created_at, updated_at
        FROM countdowns
        ORDER BY target_at ASC
      `);
      return result.rows.map(toClientCountdown);
    },
    async createCountdown(countdown) {
      const result = await pool.query(
        `
          INSERT INTO countdowns
            (id, title, target_at, category, repeat_rule, next_action, notes, pinned, archived, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
          RETURNING id, title, target_at, category, repeat_rule, next_action, notes, pinned, archived, created_at, updated_at
        `,
        [
          countdown.id,
          countdown.title,
          countdown.target_at,
          countdown.category,
          countdown.repeat,
          countdown.next_action,
          countdown.notes,
          countdown.pinned,
          countdown.archived,
          countdown.created_at,
        ]
      );
      return toClientCountdown(result.rows[0]);
    },
    async updateCountdown(id, patch) {
      const result = await pool.query(
        `
          UPDATE countdowns SET
            title = COALESCE($2, title),
            target_at = COALESCE($3, target_at),
            category = COALESCE($4, category),
            repeat_rule = COALESCE($5, repeat_rule),
            next_action = COALESCE($6, next_action),
            notes = COALESCE($7, notes),
            pinned = COALESCE($8, pinned),
            archived = COALESCE($9, archived),
            updated_at = NOW()
          WHERE id = $1
          RETURNING id, title, target_at, category, repeat_rule, next_action, notes, pinned, archived, created_at, updated_at
        `,
        [
          id,
          patch.title === undefined ? null : patch.title,
          patch.target_at === undefined ? null : patch.target_at,
          patch.category === undefined ? null : patch.category,
          patch.repeat === undefined ? null : patch.repeat,
          patch.next_action === undefined ? null : patch.next_action,
          patch.notes === undefined ? null : patch.notes,
          patch.pinned === undefined ? null : patch.pinned,
          patch.archived === undefined ? null : patch.archived,
        ]
      );
      return result.rows[0] ? toClientCountdown(result.rows[0]) : null;
    },
    async deleteCountdown(id) {
      const result = await pool.query('DELETE FROM countdowns WHERE id = $1', [id]);
      return result.rowCount > 0;
    },
    async listStreakDays(range = {}) {
      const conditions = [];
      const params = [];
      if (range.from) { params.push(range.from); conditions.push(`day >= $${params.length}`); }
      if (range.to) { params.push(range.to); conditions.push(`day <= $${params.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(
        `SELECT streak_id, day, note, created_at FROM streak_days ${where} ORDER BY day ASC`,
        params
      );
      return result.rows;
    },
    async markStreakDay(streakId, day, note) {
      const exists = await pool.query('SELECT 1 FROM streaks WHERE id = $1', [streakId]);
      if (!exists.rowCount) return null;
      const result = await pool.query(
        `
          INSERT INTO streak_days (streak_id, day, note)
          VALUES ($1, $2, $3)
          ON CONFLICT (streak_id, day) DO UPDATE SET note = EXCLUDED.note
          RETURNING streak_id, day, note, created_at
        `,
        [streakId, day, note]
      );
      return result.rows[0];
    },
    async unmarkStreakDay(streakId, day) {
      const result = await pool.query('DELETE FROM streak_days WHERE streak_id = $1 AND day = $2', [streakId, day]);
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
    async hasVisitor(visitorId) {
      const result = await pool.query('SELECT 1 FROM visits WHERE visitor_id = $1 LIMIT 1', [visitorId]);
      return result.rowCount > 0;
    },
    async recordVisit(visit) {
      await pool.query(
        `INSERT INTO visits (id, site, visitor_id, session_id, path, title, referrer, user_agent, ip, screen, is_returning, created_at, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
        [visit.id, visit.site, visit.visitor_id, visit.session_id, visit.path, visit.title, visit.referrer,
          visit.user_agent, visit.ip, visit.screen, visit.is_returning, visit.created_at]
      );
      return visit;
    },
    async touchVisit(visitorId, sessionId, seenAt) {
      // The newest row wins: a ping means "still on the page I last opened".
      const result = await pool.query(
        `UPDATE visits SET last_seen_at = $3
         WHERE id = (
           SELECT id FROM visits WHERE visitor_id = $1 AND session_id = $2
           ORDER BY created_at DESC LIMIT 1
         )
         RETURNING id`,
        [visitorId, sessionId, seenAt]
      );
      return result.rows[0] || null;
    },
    async listVisits({ since, site, limit }) {
      const conditions = [];
      const params = [];
      if (since) {
        params.push(since.toISOString());
        conditions.push(`last_seen_at >= $${params.length}`);
      }
      if (site) {
        params.push(site);
        conditions.push(`site = $${params.length}`);
      }
      params.push(limit);
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(
        `SELECT id, site, visitor_id, session_id, path, title, referrer, user_agent, ip, screen, is_returning, created_at, last_seen_at
         FROM visits ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
        params
      );
      return result.rows;
    },
    async listVisitSites() {
      const result = await pool.query(`SELECT DISTINCT site FROM visits WHERE site <> '' ORDER BY site`);
      return result.rows.map(row => row.site);
    },
    async pruneVisits(before) {
      const result = await pool.query('DELETE FROM visits WHERE created_at < $1', [before.toISOString()]);
      return result.rowCount;
    },
    async clearVisits() {
      const result = await pool.query('DELETE FROM visits');
      return result.rowCount;
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

function nextShareBotCycle(now = new Date()) {
  const base = new Date(2026, 7, 9, 8, 0, 0, 0);
  const candidate = new Date(now);
  candidate.setHours(8, 0, 0, 0);

  for (let offset = 0; offset < 14; offset += 1) {
    const dayIndex = Math.floor((startOfLocalDay(candidate) - startOfLocalDay(base)) / DAY_MS);
    if (dayIndex < 0 || dayIndex % 2 !== 0) continue;
    if (candidate.getTime() > now.getTime()) return candidate;
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(8, 0, 0, 0);
  }

  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + 2);
  fallback.setHours(8, 0, 0, 0);
  return fallback;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function shareBotReportCountdowns(now = new Date()) {
  const cycle = nextShareBotCycle(now);
  const offset = minutes => new Date(cycle.getTime() + minutes * 60 * 1000).toISOString();
  return [
    {
      id: 'sharebot-report-crypto-economics',
      title: 'ShareBot Report 1 - Crypto, Stocks, Economics',
      target_at: offset(0),
      category: 'routine',
      repeat: 'none',
      next_action: 'Generate and post the crypto, stock, and economics report.',
      notes: 'Runs from the ShareBot news cycle at 8:00 AM Vancouver time every two days.',
      pinned: true,
      archived: false,
    },
    {
      id: 'sharebot-report-geopolitics',
      title: 'ShareBot Report 2 - Geopolitics',
      target_at: offset(20),
      category: 'routine',
      repeat: 'none',
      next_action: 'Generate and post the geopolitics report after Report 1 is done.',
      notes: 'Estimated start is about 20 minutes after the cycle begins.',
      pinned: true,
      archived: false,
    },
    {
      id: 'sharebot-report-cycle-complete',
      title: 'ShareBot Full Cycle - Estimated Complete',
      target_at: offset(40),
      category: 'routine',
      repeat: 'none',
      next_action: 'Confirm both reports posted or surface the failed target.',
      notes: 'Estimated completion window for both ShareBot reports.',
      pinned: true,
      archived: false,
    },
  ];
}

/**
 * Everything the Countdowns page draws, in one payload.
 *
 * The calendar half is best-effort on purpose: a countdown you typed in
 * yourself should still be readable when Google is down or was never
 * connected, so a failure there costs the events and nothing else.
 */
async function buildCountdownsPayload(options = {}) {
  const storage = await storageReady;
  const now = options.now instanceof Date ? options.now : new Date();
  const stored = await storage.listCountdowns();
  const storedIds = new Set(stored.map(item => item.id));
  const reportCountdowns = options.includeShareBotReports
    ? shareBotReportCountdowns(now).filter(item => !storedIds.has(item.id))
    : [];

  let events = [];
  let calendarState = 'disconnected';
  if (options.includeEvents !== false) {
    try {
      events = await currentCalendarEvents();
      calendarState = (await isGcalConnected()) ? 'connected' : (events.length ? 'local-only' : 'disconnected');
    } catch (error) {
      console.error('Countdowns: unable to load calendar events.', error);
      calendarState = 'error';
    }
  } else {
    calendarState = 'skipped';
  }

  return {
    ...countdowns.buildUpcoming({
      countdowns: reportCountdowns.concat(stored),
      events,
      now,
      includeArchived: Boolean(options.includeArchived),
    }),
    calendar: { state: calendarState, connected: calendarState === 'connected' },
    categories: countdowns.CATEGORIES,
    repeats: countdowns.REPEATS,
    timezone: process.env.TZ,
  };
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

// -- PHONE INBOX / iOS SHORTCUTS --------------------------------
//
// The Dropbox UI is gated by a passphrase and a session cookie, which a phone
// Shortcut cannot hold. These endpoints are the same Dropbox behind a static
// bearer token instead: one to drop something in from the phone, one to pull
// back whatever has come due, and two to clear or push out a reminder.
//
// The token is deliberately separate from the Dropbox passphrase - it lives on
// the phone in plain text, so losing it should not hand over the web session
// too. Rotate it by changing SHORTCUTS_TOKEN.

const SHORTCUTS_TOKEN = String(process.env.SHORTCUTS_TOKEN || '').trim();
const SHORTCUTS_TOKEN_MIN_LENGTH = 16;
const SHORTCUTS_DEFAULT_LIMIT = 25;
const SHORTCUTS_MAX_LIMIT = 100;
const SHORTCUTS_FAILURE_LIMIT = 10;
const SHORTCUTS_FAILURE_WINDOW_MS = 5 * 60 * 1000;
const REMINDER_SUBJECT = 'Reminder';
const shortcutsFailures = new Map();

function shortcutsClientKey(req) {
  return clientIp(req);
}

// A bearer token on the open internet invites guessing. Ten wrong tokens from
// one address buys a five-minute timeout - enough to make an online search
// pointless, short enough that a typo is not a lockout.
function shortcutsThrottled(key) {
  const entry = shortcutsFailures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > SHORTCUTS_FAILURE_WINDOW_MS) {
    shortcutsFailures.delete(key);
    return false;
  }
  return entry.count >= SHORTCUTS_FAILURE_LIMIT;
}

function recordShortcutsFailure(key) {
  const entry = shortcutsFailures.get(key);
  if (!entry || Date.now() - entry.first > SHORTCUTS_FAILURE_WINDOW_MS) {
    shortcutsFailures.set(key, { count: 1, first: Date.now() });
    return;
  }
  entry.count += 1;
}

function readShortcutsToken(req, url) {
  const bearer = /^bearer\s+(.+)$/i.exec(String(req.headers.authorization || '').trim());
  if (bearer) return bearer[1].trim();
  const header = req.headers['x-shortcuts-token'];
  if (header) return String(header).trim();
  return String(url.searchParams.get('token') || '').trim();
}

function requireShortcutsAuth(req, res, url) {
  if (!SHORTCUTS_TOKEN) {
    sendJson(res, 503, {
      error: 'The phone inbox is not configured. Set SHORTCUTS_TOKEN to a long random string.',
    });
    return false;
  }
  if (SHORTCUTS_TOKEN.length < SHORTCUTS_TOKEN_MIN_LENGTH) {
    sendJson(res, 503, {
      error: `SHORTCUTS_TOKEN must be at least ${SHORTCUTS_TOKEN_MIN_LENGTH} characters.`,
    });
    return false;
  }

  const key = shortcutsClientKey(req);
  if (shortcutsThrottled(key)) {
    sendJson(res, 429, { error: 'Too many bad tokens. Try again in a few minutes.' });
    return false;
  }

  const supplied = readShortcutsToken(req, url);
  if (!supplied || !safeCompareHash(supplied, sha256(SHORTCUTS_TOKEN))) {
    recordShortcutsFailure(key);
    sendJson(res, 401, { error: 'Invalid or missing token.' });
    return false;
  }

  shortcutsFailures.delete(key);
  return true;
}

// A Shortcut can send JSON, a form, or nothing at all with everything in the
// query string. All three end up as one flat object, with the body winning
// over the query when a field appears twice.
async function readShortcutsInput(req, url) {
  const fields = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (key !== 'token') fields[key] = value;
  }

  const raw = req.method === 'GET' ? '' : await readRawBody(req);
  if (!raw) return fields;

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('application/json')) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const error = new Error('Invalid JSON');
      error.statusCode = 400;
      throw error;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      const error = new Error('Body must be a JSON object.');
      error.statusCode = 400;
      throw error;
    }
    return { ...fields, ...parsed };
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    for (const [key, value] of new URLSearchParams(raw).entries()) fields[key] = value;
    return fields;
  }

  // Plain text: the whole body is the note. This is what the iOS share sheet
  // sends when a Shortcut passes its input straight through.
  return { ...fields, text: raw };
}

function firstDefined(input, keys) {
  for (const key of keys) {
    if (input[key] !== undefined && input[key] !== null && String(input[key]).trim() !== '') return input[key];
  }
  return undefined;
}

function isOpenDrop(drop) {
  return !drop.done && drop.status !== 'done' && drop.status !== 'archived';
}

function endOfToday(now) {
  const end = new Date(now.getTime());
  end.setHours(23, 59, 59, 999);
  return end;
}

function shortcutDropUrl(req, id) {
  return `${getRequestOrigin(req)}/mission-board.html?view=ios&task=${encodeURIComponent(id)}`;
}

function toShortcutItem(drop, now, req) {
  const reminder = reminderTime.describeReminder(drop.remind_at, now);
  return {
    id: drop.id,
    title: drop.title || 'Untitled drop',
    content: drop.content || '',
    subject: drop.subject || '',
    project: drop.project || '',
    priority: drop.priority || 'normal',
    status: drop.status || 'inbox',
    tags: drop.tags || [],
    created_at: drop.date,
    remind_at: drop.remind_at || '',
    due: reminder ? reminder.due : false,
    due_label: reminder ? reminder.label : '',
    due_relative: reminder ? reminder.relative : '',
    url: shortcutDropUrl(req, drop.id),
  };
}

// due=now (default) is what a "what did I put down for later?" Shortcut wants:
// reminders whose time has arrived. The other scopes are there so one Shortcut
// can show today's list, everything pending, or the whole open Dropbox.
function selectShortcutDrops(drops, scope, now) {
  const open = drops.filter(isOpenDrop);
  const withReminder = open.filter(drop => drop.remind_at);
  const byDue = (a, b) => new Date(a.remind_at) - new Date(b.remind_at);

  if (scope === 'any') {
    const rest = open.filter(drop => !drop.remind_at)
      .sort((a, b) => new Date(b.updated_at || b.date) - new Date(a.updated_at || a.date));
    return withReminder.sort(byDue).concat(rest);
  }
  if (scope === 'all' || scope === 'upcoming') {
    const pending = scope === 'upcoming'
      ? withReminder.filter(drop => new Date(drop.remind_at) > now)
      : withReminder;
    return pending.sort(byDue);
  }
  const cutoff = scope === 'today' ? endOfToday(now) : now;
  return withReminder.filter(drop => new Date(drop.remind_at) <= cutoff).sort(byDue);
}

function shortcutsTextReport(items, scope) {
  if (!items.length) {
    return scope === 'any' ? 'Dropbox is clear.' : 'Nothing due.';
  }
  const heading = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;
  const lines = items.map(item => {
    const when = item.due_relative ? ` — ${item.due_relative}` : '';
    return `• ${item.title}${when}`;
  });
  return [heading, ...lines].join('\n');
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

function buildShortcutDropPayload(input) {
  const content = String(firstDefined(input, ['content', 'text', 'note', 'body']) ?? '').trim();
  if (!content) {
    return { ok: false, error: 'Send some text: use "text" (or a plain-text body) for the note.' };
  }

  const when = firstDefined(input, ['remind_at', 'remind', 'when', 'due']);
  const explicitSubject = String(firstDefined(input, ['subject', 'category']) ?? '').trim();
  const explicitProject = String(firstDefined(input, ['project']) ?? '').trim();
  const url = String(firstDefined(input, ['url', 'link']) ?? '').trim();

  return {
    ok: true,
    value: {
      content: url && !content.includes(url) ? `${content}\n${url}` : content,
      // Titles come off the note itself. Left blank, deriveDropTitle would
      // reach for the subject and every phone drop would be called "Inbox".
      title: deriveDropTitle({ title: firstDefined(input, ['title']), content }),
      // Reminders are separated by project, not subject. Keep subject free
      // unless the caller explicitly uses it for their own grouping.
      subject: explicitSubject,
      project: explicitProject || 'iOS',
      agent: firstDefined(input, ['agent']) ?? '',
      tags: firstDefined(input, ['tags']) ?? '',
      priority: String(firstDefined(input, ['priority']) ?? 'normal').toLowerCase(),
      status: String(firstDefined(input, ['status']) ?? 'inbox').toLowerCase(),
      remind_at: when,
    },
  };
}

async function handleShortcutsRequest(req, res, url, storage) {
  const pathname = url.pathname;
  const now = new Date();

  if (req.method === 'GET' && pathname === '/api/shortcuts/status') {
    const drops = await storage.listDrops();
    const due = selectShortcutDrops(drops, 'now', now);
    const upcoming = selectShortcutDrops(drops, 'upcoming', now);
    sendJson(res, 200, {
      ok: true,
      due: due.length,
      upcoming: upcoming.length,
      next: upcoming.length ? toShortcutItem(upcoming[0], now, req) : null,
    });
    return true;
  }

  // The evening roll-up pulls this. It is the same selection the Countdowns
  // page leads with, as plain text a Shortcut can paste straight into a note.
  if (req.method === 'GET' && pathname === '/api/shortcuts/countdowns') {
    const payload = await buildCountdownsPayload({ now });
    const limit = Number.parseInt(url.searchParams.get('limit') || '', 10);
    if (String(url.searchParams.get('format') || 'text') === 'text') {
      sendText(res, 200, countdowns.formatRollupText(payload, limit));
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      now: payload.now,
      counts: payload.counts,
      items: countdowns.selectRollupItems(payload, limit),
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/shortcuts/drops') {
    const input = await readShortcutsInput(req, url);
    const built = buildShortcutDropPayload(input);
    if (!built.ok) {
      sendJson(res, 400, { error: built.error });
      return true;
    }

    const payload = validateDropInput(built.value);
    if (!payload.ok) {
      sendJson(res, 400, { error: payload.error });
      return true;
    }

    const drop = await storage.createDrop({
      id: `drop-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now()}`,
      date: new Date().toISOString(),
      done: false,
      ...payload.value,
      title: await uniqueDropTitle(storage, payload.value.title),
    });

    const item = toShortcutItem(drop, now, req);
    if (String(url.searchParams.get('format') || '') === 'text') {
      sendText(res, 201, item.due_relative ? `Saved: ${item.title} (${item.due_relative})` : `Saved: ${item.title}`);
      return true;
    }
    sendJson(res, 201, item);
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/shortcuts/drops') {
    const scope = String(url.searchParams.get('due') || 'now').toLowerCase();
    if (!['now', 'today', 'all', 'upcoming', 'any'].includes(scope)) {
      sendJson(res, 400, { error: 'due must be one of now, today, upcoming, all, or any.' });
      return true;
    }

    const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '', 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, SHORTCUTS_MAX_LIMIT)
      : SHORTCUTS_DEFAULT_LIMIT;

    const drops = await storage.listDrops();
    const selected = selectShortcutDrops(drops, scope, now).slice(0, limit);
    const items = selected.map(drop => toShortcutItem(drop, now, req));

    if (String(url.searchParams.get('format') || '') === 'text') {
      sendText(res, 200, shortcutsTextReport(items, scope));
      return true;
    }

    sendJson(res, 200, {
      scope,
      count: items.length,
      generated_at: now.toISOString(),
      items,
    });
    return true;
  }

  const action = /^\/api\/shortcuts\/drops\/(.+)\/(done|snooze)$/.exec(pathname);
  if (action && req.method === 'POST') {
    const id = decodeURIComponent(action[1]).trim();
    if (!id) {
      sendJson(res, 400, { error: 'Drop id is required.' });
      return true;
    }

    if (action[2] === 'done') {
      const drop = await storage.updateDrop(id, { status: 'done', done: true, remind_at: null });
      if (!drop) {
        sendJson(res, 404, { error: 'Drop not found.' });
        return true;
      }
      const item = toShortcutItem(drop, now, req);
      if (String(url.searchParams.get('format') || '') === 'text') {
        sendText(res, 200, `Done: ${item.title}`);
        return true;
      }
      sendJson(res, 200, item);
      return true;
    }

    const input = await readShortcutsInput(req, url);
    const until = firstDefined(input, ['until', 'remind_at', 'when']);
    const relative = firstDefined(input, ['for', 'snooze']);
    const parsed = reminderTime.parseReminderTime(until ?? relative ?? '1h');
    if (!parsed.ok) {
      sendJson(res, 400, { error: parsed.error });
      return true;
    }
    if (!parsed.at) {
      sendJson(res, 400, { error: 'Snoozing needs a time, e.g. for=1h or until=tomorrow 9am.' });
      return true;
    }

    const drop = await storage.updateDrop(id, { remind_at: parsed.at.toISOString() });
    if (!drop) {
      sendJson(res, 404, { error: 'Drop not found.' });
      return true;
    }
    const item = toShortcutItem(drop, now, req);
    if (String(url.searchParams.get('format') || '') === 'text') {
      sendText(res, 200, `Snoozed: ${item.title} (${item.due_relative})`);
      return true;
    }
    sendJson(res, 200, item);
    return true;
  }

  return false;
}

// -- WEBSITE VISITORS -------------------------------------------
//
// This is what a shop dashboard's live view actually is, minus the shop: a
// random id the browser keeps about itself, one row per page view, and a
// "still here" ping while the tab is open. That is enough to answer "is anyone
// on the site right now, what are they reading, and have they been before".
//
// It deliberately stops there. The id is generated in the browser and means
// nothing anywhere else, there is no lookup against any outside service, and
// nothing here tries to put a name to a visitor.
//
// The id lives in the visitor's own storage rather than in a cookie set here,
// because the tracker is meant to be dropped onto any site you run - a cookie
// from this origin would not survive the trip to a different domain.

const VISIT_LIVE_WINDOW_MS = 5 * 60 * 1000;
const VISIT_TRACK_LIMIT = 600;
const VISIT_TRACK_WINDOW_MS = 5 * 60 * 1000;
const VISIT_MAX_ROWS = 20000;
const VISIT_DEFAULT_DAYS = 7;
const VISIT_MAX_DAYS = 365;
const VISIT_PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const VISIT_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
// Almost nothing here runs JavaScript, so this catches the few that do rather
// than being the front line. The front line is that the tracker is a script.
const BOT_USER_AGENT = /bot|crawl|spider|slurp|headlesschrome|phantomjs|puppeteer|playwright|curl|wget|python-requests|axios|monitor|uptime|pingdom|semrush|ahrefs|facebookexternalhit|scrape/i;
const visitTrackCounts = new Map();

// An IP address is kept per view so a run of odd traffic can be told apart from
// a run of real traffic. Ninety days is long enough to compare a month against
// the one before it and short enough that this is not an archive.
const VISIT_RETENTION_DAYS = (() => {
  const configured = Number.parseInt(process.env.VISITS_RETENTION_DAYS || '', 10);
  if (!Number.isFinite(configured) || configured < 1) return 90;
  return Math.min(configured, 3650);
})();

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

// A tracker endpoint has to be open to the internet to do its job, so it gets
// the same treatment as the phone inbox: a ceiling per address, high enough
// that no real browsing session reaches it.
function visitTrackThrottled(key) {
  const now = Date.now();
  const entry = visitTrackCounts.get(key);
  if (!entry || now - entry.first > VISIT_TRACK_WINDOW_MS) {
    visitTrackCounts.set(key, { count: 1, first: now });
    return false;
  }
  entry.count += 1;
  return entry.count > VISIT_TRACK_LIMIT;
}

function isBotUserAgent(userAgent) {
  return BOT_USER_AGENT.test(String(userAgent || ''));
}

function trimTo(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

// The site a view belongs to is the hostname, whether the tracker sent it or
// the browser did. Everything else is a label on the row.
function normalizeVisitSite(input, req) {
  const candidate = trimTo(input.site, 200) || String(req.headers.origin || '') || '';
  if (!candidate) return '';
  try {
    return trimTo(new URL(candidate).hostname, 120);
  } catch {
    return trimTo(candidate.replace(/^https?:\/\//, '').split('/')[0], 120);
  }
}

function normalizeVisitPath(input) {
  const raw = trimTo(input.path, 600) || '/';
  try {
    const url = new URL(raw);
    return trimTo(url.pathname + url.search, 500) || '/';
  } catch {
    return trimTo(raw.startsWith('/') ? raw : `/${raw}`, 500);
  }
}

// Clicking from one page of a site to the next is not a referrer - it is the
// visitor still being on the site. Only somewhere else counts.
function normalizeVisitReferrer(input, site) {
  const raw = trimTo(input.referrer, 600);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (site && url.hostname === site) return '';
    return trimTo(url.hostname + url.pathname, 300);
  } catch {
    return trimTo(raw, 300);
  }
}

function normalizeVisitInput(input, req) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }

  const visitorId = trimTo(input.visitor_id || input.visitorId, 64);
  const sessionId = trimTo(input.session_id || input.sessionId, 64);
  if (!VISIT_ID_PATTERN.test(visitorId)) return { ok: false, error: 'A visitor id is required.' };
  if (!VISIT_ID_PATTERN.test(sessionId)) return { ok: false, error: 'A session id is required.' };

  const event = trimTo(input.event, 16) || 'view';
  if (event !== 'view' && event !== 'ping') {
    return { ok: false, error: 'Event must be view or ping.' };
  }

  const site = normalizeVisitSite(input, req);
  const screen = trimTo(input.screen, 32);

  return {
    ok: true,
    value: {
      event,
      site,
      visitor_id: visitorId,
      session_id: sessionId,
      path: normalizeVisitPath(input),
      title: trimTo(input.title, 200),
      referrer: normalizeVisitReferrer(input, site),
      screen: /^\d{1,5}x\d{1,5}$/.test(screen) ? screen : '',
      user_agent: trimTo(req.headers['user-agent'], 400),
      ip: clientIp(req),
    },
  };
}

function visitTimestamp(visit) {
  const value = visit.last_seen_at || visit.created_at;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function bumpCount(map, key, visitorId) {
  const entry = map.get(key) || { count: 0, visitors: new Set() };
  entry.count += 1;
  entry.visitors.add(visitorId);
  map.set(key, entry);
  return entry;
}

function rankedCounts(map, toRow, limit = 12) {
  return [...map.entries()]
    .map(([key, entry]) => toRow(key, entry))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

/**
 * Turn the raw rows into the numbers the page shows.
 *
 * Both storages hand back rows rather than aggregates so there is one copy of
 * this arithmetic instead of one per backend. The row cap is what keeps that
 * honest on a busy month.
 */
function summarizeVisits(rows, nowMs) {
  const liveCutoff = nowMs - VISIT_LIVE_WINDOW_MS;
  const visitors = new Set();
  const sessions = new Set();
  const returningVisitors = new Set();
  const pages = new Map();
  const referrers = new Map();
  const sites = new Map();
  const liveByVisitor = new Map();

  for (const row of rows) {
    visitors.add(row.visitor_id);
    sessions.add(row.session_id);
    if (row.is_returning) returningVisitors.add(row.visitor_id);

    bumpCount(pages, `${row.site}\u0000${row.path}`, row.visitor_id);
    bumpCount(sites, row.site, row.visitor_id);
    if (row.referrer) bumpCount(referrers, row.referrer, row.visitor_id);

    // Rows arrive newest first, so the first row seen for a visitor is the page
    // they are on now.
    if (visitTimestamp(row) >= liveCutoff && !liveByVisitor.has(row.visitor_id)) {
      liveByVisitor.set(row.visitor_id, row);
    }
  }

  return {
    totals: {
      visitors: visitors.size,
      sessions: sessions.size,
      pageviews: rows.length,
      returning: returningVisitors.size,
      new: visitors.size - returningVisitors.size,
      live: liveByVisitor.size,
    },
    live: [...liveByVisitor.values()].map(toClientVisit).sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at)),
    recent: rows.slice(0, 100).map(toClientVisit),
    top_pages: rankedCounts(pages, (key, entry) => {
      const [site, pagePath] = key.split('\u0000');
      return { site, path: pagePath, views: entry.count, visitors: entry.visitors.size };
    }),
    top_referrers: rankedCounts(referrers, (referrer, entry) => (
      { referrer, views: entry.count, visitors: entry.visitors.size }
    )),
    sites: rankedCounts(sites, (site, entry) => (
      { site, views: entry.count, visitors: entry.visitors.size }
    ), 50),
  };
}

function toClientVisit(row) {
  return {
    id: row.id,
    site: row.site || '',
    visitor_id: row.visitor_id,
    session_id: row.session_id,
    path: row.path || '/',
    title: row.title || '',
    referrer: row.referrer || '',
    ip: row.ip || '',
    screen: row.screen || '',
    device: describeDevice(row.user_agent),
    is_returning: Boolean(row.is_returning),
    created_at: toIsoOrEmpty(row.created_at),
    last_seen_at: toIsoOrEmpty(row.last_seen_at || row.created_at),
  };
}

// Enough of the user agent to tell a phone from a laptop on the dashboard, and
// nothing that would go looking for anything else.
function describeDevice(userAgent) {
  const ua = String(userAgent || '');
  if (!ua) return '';
  const platform = /iPhone|iPod/i.test(ua) ? 'iPhone'
    : /iPad/i.test(ua) ? 'iPad'
      : /Android/i.test(ua) ? 'Android'
        : /Macintosh|Mac OS X/i.test(ua) ? 'Mac'
          : /Windows/i.test(ua) ? 'Windows'
            : /Linux/i.test(ua) ? 'Linux'
              : '';
  const browser = /Edg\//i.test(ua) ? 'Edge'
    : /OPR\/|Opera/i.test(ua) ? 'Opera'
      : /Firefox\//i.test(ua) ? 'Firefox'
        : /Chrome\//i.test(ua) ? 'Chrome'
          : /Safari\//i.test(ua) ? 'Safari'
            : '';
  return [platform, browser].filter(Boolean).join(' · ');
}

function parseVisitDays(url) {
  const raw = Number.parseInt(url.searchParams.get('days') || '', 10);
  if (!Number.isFinite(raw) || raw < 1) return VISIT_DEFAULT_DAYS;
  return Math.min(raw, VISIT_MAX_DAYS);
}

async function pruneOldVisits(storage) {
  try {
    const before = new Date(Date.now() - VISIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const removed = await storage.pruneVisits(before);
    if (removed) console.log(`Visitors: pruned ${removed} view(s) older than ${VISIT_RETENTION_DAYS} days.`);
  } catch (error) {
    console.error('Visitors: prune failed.', error);
  }
}

// -- OPENCLAW GATEWAY -------------------------------------------
//
// "Is the gateway on my machine running?" has two answers depending on where
// this server is, and the page needs both because the honest answer differs.
//
//   Same machine  - this server can just ask. It has no CORS rules and no
//                   mixed-content rules, and it can read the reply, so it can
//                   tell OpenClaw apart from anything else on that port.
//   Deployed      - it cannot. `localhost` from a container is the container.
//                   Nothing reachable from here is the machine in question, so
//                   the machine has to report in instead.
//
// The browser cannot do either job. A cross-origin `no-cors` probe returns an
// opaque response: it resolves for a 404, for a 500, and for any unrelated
// server on that port, so it can only ever say "something answered". That is
// what the old check did, and why pointing it at this app's own port showed
// green.

const GATEWAY_PROBE_PATHS = ['/health', '/api/health', '/status', '/api/status', '/agents', '/api/agents', '/'];
const GATEWAY_PROBE_TIMEOUT_MS = 2500;
const GATEWAY_HEARTBEAT_STALE_MS = 90 * 1000;
const GATEWAY_MAX_PROBE_BYTES = 64 * 1024;
const GATEWAY_TOKEN = String(process.env.GATEWAY_TOKEN || '').trim();
const GATEWAY_TOKEN_MIN_LENGTH = 16;
const GATEWAY_LOCAL_SETTING_KEY = 'ao-gateway-local';
const DEFAULT_GATEWAY_URL = 'http://localhost:18789';

// Deliberately in memory. A beat every 30 seconds is not worth a database
// write, and a restart is corrected by the next one.
let lastGatewayHeartbeat = null;

// "localhost:18789" is a host and a port; "file:///etc/passwd" is a scheme.
// Both have a colon, so the two have to be told apart before anything is
// prepended - otherwise a rejected scheme becomes a fetchable http address.
function normalizeGatewayUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';

  let withScheme;
  const declared = value.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (declared) {
    if (!/^https?$/i.test(declared[1])) return '';
    withScheme = value;
  } else if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(value)) {
    // A scheme with no slashes - mailto:, javascript:, file: - is not an
    // address this is willing to fetch either.
    return '';
  } else {
    withScheme = `http://${value}`;
  }

  try {
    const url = new URL(withScheme);
    // Only ever speak HTTP. This server fetches whatever address the owner put
    // in Settings, so the scheme is pinned and the reply is read but never
    // forwarded anywhere.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.origin + url.pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

// What came back, in the loosest terms that are still useful: is it JSON, and
// does it look like a list of agents.
function describeGatewayBody(text) {
  const body = String(text || '').trim();
  if (!body) return { shape: 'empty', agents: [], openclaw: false };

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { shape: body.startsWith('<') ? 'html' : 'text', agents: [], openclaw: false };
  }

  const list = Array.isArray(parsed) ? parsed
    : Array.isArray(parsed && parsed.agents) ? parsed.agents
      : null;

  if (list && list.every(item => item && typeof item === 'object')) {
    return { shape: Array.isArray(parsed) ? 'json array' : 'json object with agents[]', agents: list, openclaw: true };
  }
  const openclaw = Boolean(parsed && parsed.ok === true && String(parsed.status || '').toLowerCase() === 'live');
  return { shape: Array.isArray(parsed) ? 'json array' : 'json object', agents: [], openclaw };
}

// An OpenClaw agent, whatever shape it arrived in. Unknown fields are dropped
// rather than guessed at, so a missing status reads as unknown, not as idle.
function toGatewayAgent(raw, index) {
  const pick = (...keys) => {
    for (const key of keys) {
      const value = raw[key];
      if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 120);
    }
    return '';
  };
  const id = pick('id', 'agent_id', 'agentId', 'slug', 'name') || `agent_${index + 1}`;
  return {
    id,
    name: pick('name', 'label', 'title') || id,
    role: pick('role', 'description', 'kind', 'type'),
    model: pick('model', 'engine'),
    status: pick('status', 'state') || 'unknown',
  };
}

// Node's fetch reports every connection-level failure as "fetch failed" and
// puts the reason - ECONNREFUSED, ENOTFOUND - on error.cause. Reading only the
// message loses exactly the detail that says "nothing is listening".
function probeFailureReason(error) {
  if (!error) return 'failed';
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'timed out';
  const code = (error.cause && error.cause.code) || error.code || '';
  return String(code || error.message || 'failed');
}

async function probeGatewayEndpoint(url) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    headers: { Accept: 'application/json, text/plain;q=0.9, */*;q=0.8' },
    signal: AbortSignal.timeout(GATEWAY_PROBE_TIMEOUT_MS),
  });

  const raw = await response.text();
  const text = raw.length > GATEWAY_MAX_PROBE_BYTES ? raw.slice(0, GATEWAY_MAX_PROBE_BYTES) : raw;
  const described = describeGatewayBody(text);
  return { status: response.status, ok: response.ok, ...described };
}

/**
 * Ask the gateway directly, and report what actually answered.
 *
 * The endpoint list is walked in full rather than stopped at the first hit,
 * because the point is as much "which paths does this gateway have" as
 * "is it up" - that is what turns an unknown API into a configured one.
 */
async function probeGateway(baseUrl) {
  const url = normalizeGatewayUrl(baseUrl);
  if (!url) {
    return { attempted: false, url: '', reachable: false, error: 'No gateway URL is set.', endpoints: [], agents: [], agents_endpoint: '' };
  }

  const endpoints = [];
  let reachable = false;
  let error = '';
  let agents = [];
  let agentsEndpoint = '';
  let openclaw = false;

  for (const path of GATEWAY_PROBE_PATHS) {
    const target = path === '/' ? url : url + path;
    try {
      const result = await probeGatewayEndpoint(target);
      reachable = true;
      if (result.openclaw) openclaw = true;
      endpoints.push({ path, status: result.status, shape: result.shape, agents: result.agents.length, openclaw: Boolean(result.openclaw) });

      if (!agents.length && result.ok && result.agents.length) {
        agents = result.agents.map(toGatewayAgent);
        agentsEndpoint = path;
      }
    } catch (probeError) {
      const reason = probeFailureReason(probeError);
      endpoints.push({ path, status: 0, shape: reason, agents: 0 });
      // Nothing listening on the port fails the same way for every path, so
      // there is no point walking the rest of the list.
      if (!reachable && /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|EHOSTUNREACH/i.test(reason)) {
        error = `Nothing is listening at ${url} (${reason}).`;
        break;
      }
      if (!error) error = reason;
    }
  }

  return {
    attempted: true,
    url,
    reachable,
    openclaw,
    error: reachable ? '' : (error || 'Not reachable.'),
    endpoints,
    agents,
    agents_endpoint: agentsEndpoint,
  };
}

function describeGatewayHeartbeat() {
  const configured = Boolean(GATEWAY_TOKEN) && GATEWAY_TOKEN.length >= GATEWAY_TOKEN_MIN_LENGTH;
  if (!lastGatewayHeartbeat) {
    return { configured, received: false, fresh: false, age_seconds: null, host: '', agents: [] };
  }
  const ageMs = Date.now() - lastGatewayHeartbeat.at;
  return {
    configured,
    received: true,
    fresh: ageMs <= GATEWAY_HEARTBEAT_STALE_MS,
    age_seconds: Math.round(ageMs / 1000),
    received_at: new Date(lastGatewayHeartbeat.at).toISOString(),
    host: lastGatewayHeartbeat.host,
    version: lastGatewayHeartbeat.version,
    agents: lastGatewayHeartbeat.agents,
  };
}

async function readJsonFileSafe(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function homePath(...parts) {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  return home ? path.join(home, ...parts) : '';
}

function sessionStatusFromRecords(records, now = Date.now()) {
  const sessions = Object.values(records || {}).filter(item => item && typeof item === 'object');
  if (!sessions.length) return { status: 'idle', updatedAt: 0 };

  let newest = 0;
  let running = false;
  for (const session of sessions) {
    const updatedAt = Number(session.updatedAt || session.lastInteractionAt || session.sessionStartedAt || 0);
    if (updatedAt > newest) newest = updatedAt;
    if (String(session.status || '').toLowerCase() === 'running') running = true;
  }

  const ageMs = newest ? now - newest : Infinity;
  if (running && ageMs <= 15 * 60 * 1000) return { status: 'running', updatedAt: newest };
  if (ageMs <= 2 * 60 * 60 * 1000) return { status: 'active', updatedAt: newest };
  return { status: 'idle', updatedAt: newest };
}

async function readLocalOpenClawAgents() {
  const configPath = process.env.OPENCLAW_CONFIG_PATH || homePath('.openclaw', 'openclaw.json');
  const config = await readJsonFileSafe(configPath, {});
  const configured = Array.isArray(config && config.agents && config.agents.list) ? config.agents.list : [];
  const now = Date.now();

  const agents = [];
  for (const agent of configured) {
    if (!agent || typeof agent !== 'object') continue;
    const id = String(agent.id || agent.name || '').trim();
    if (!id) continue;

    const sessionPaths = [];
    if (agent.agentDir) sessionPaths.push(path.join(path.dirname(agent.agentDir), 'sessions', 'sessions.json'));
    sessionPaths.push(homePath('.openclaw', 'agents', id, 'sessions', 'sessions.json'));

    let sessionState = { status: 'idle', updatedAt: 0 };
    for (const sessionPath of sessionPaths.filter(Boolean)) {
      const records = await readJsonFileSafe(sessionPath, null);
      if (records) {
        sessionState = sessionStatusFromRecords(records, now);
        break;
      }
    }

    agents.push({
      id,
      name: String(agent.name || (agent.identity && agent.identity.name) || id).trim(),
      role: String(agent.description || '').trim().slice(0, 180),
      model: String((agent.model && agent.model.primary) || '').trim(),
      status: sessionState.status,
      source: 'OpenClaw local config',
    });
  }

  return agents;
}

async function buildGatewayStatus(storage, requestedUrl) {
  const requested = String(requestedUrl || '').trim();
  const saved = await storage.getAppSetting(GATEWAY_LOCAL_SETTING_KEY);

  // An address that was asked for and cannot be used is reported as such.
  // Quietly falling back to the default would answer a question about a
  // different machine than the one that was typed in.
  const rejected = requested && !normalizeGatewayUrl(requested);
  const target = normalizeGatewayUrl(requested) || normalizeGatewayUrl(saved) || DEFAULT_GATEWAY_URL;

  const probe = rejected
    ? {
      attempted: false,
      url: '',
      reachable: false,
      error: 'That is not an http:// or https:// address.',
      endpoints: [],
      agents: [],
      agents_endpoint: '',
    }
    : await probeGateway(target);
  const heartbeat = describeGatewayHeartbeat();
  const localAgents = probe.reachable && probe.openclaw && !probe.agents.length
    ? await readLocalOpenClawAgents()
    : [];

  // A live probe is the stronger answer - it was true a second ago, from here.
  // A fresh heartbeat is the only answer available when the gateway is on a
  // machine this server cannot reach at all.
  const source = probe.reachable ? 'probe' : heartbeat.fresh ? 'heartbeat' : 'none';
  const agents = probe.agents.length ? probe.agents
    : localAgents.length ? localAgents
      : heartbeat.fresh && heartbeat.agents.length ? heartbeat.agents
      : [];

  return {
    alive: source !== 'none',
    source,
    agents,
    agents_source: probe.agents.length ? 'probe' : localAgents.length ? 'local-openclaw' : agents.length ? 'heartbeat' : '',
    heartbeat_stale_seconds: GATEWAY_HEARTBEAT_STALE_MS / 1000,
    probe,
    heartbeat,
  };
}

// ---------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, getRequestOrigin(req));
  const pathname = parsedUrl.pathname;
  applyCorsHeaders(req, res);

  // The tracker script runs on whichever sites you put it on, so its one
  // endpoint answers any origin. It carries no cookies and returns nothing
  // about anybody, so there is nothing here for another page to read back.
  if (pathname === '/api/visits/track') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

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

    // -- WEBSITE VISITORS ----------------------------------------

    // Open on purpose: the browsers reporting in are strangers by definition.
    // It never answers with anything, so it cannot be read as a data source.
    if (pathname === '/api/visits/track') {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Use POST.' });
        return;
      }
      if (visitTrackThrottled(clientIp(req))) {
        res.writeHead(429, { 'Cache-Control': 'no-store' });
        res.end();
        return;
      }

      // sendBeacon posts text/plain, which is what keeps this a simple request
      // with no preflight round trip on someone else's page load.
      const raw = await readRawBody(req);
      let parsed = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }

      const normalized = normalizeVisitInput(parsed, req);
      if (!normalized.ok || isBotUserAgent(normalized.value.user_agent)) {
        // A malformed or automated beacon is dropped without comment - there is
        // nothing on the other end that would do anything with an error.
        res.writeHead(204, { 'Cache-Control': 'no-store' });
        res.end();
        return;
      }

      const visit = normalized.value;
      const now = new Date().toISOString();
      if (visit.event === 'ping') {
        await storage.touchVisit(visit.visitor_id, visit.session_id, now);
      } else {
        const seenBefore = await storage.hasVisitor(visit.visitor_id);
        await storage.recordVisit({
          id: `vis_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`,
          site: visit.site,
          visitor_id: visit.visitor_id,
          session_id: visit.session_id,
          path: visit.path,
          title: visit.title,
          referrer: visit.referrer,
          user_agent: visit.user_agent,
          ip: visit.ip,
          screen: visit.screen,
          is_returning: seenBefore,
          created_at: now,
          last_seen_at: now,
        });
      }

      res.writeHead(204, { 'Cache-Control': 'no-store' });
      res.end();
      return;
    }

    if (req.method === 'GET' && pathname === '/api/visits/summary') {
      if (!requireDropsAuth(res, req)) return;
      const days = parseVisitDays(parsedUrl);
      const site = String(parsedUrl.searchParams.get('site') || '').trim();
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const rows = await storage.listVisits({ since, site, limit: VISIT_MAX_ROWS });
      sendJson(res, 200, {
        days,
        site,
        retention_days: VISIT_RETENTION_DAYS,
        live_window_minutes: VISIT_LIVE_WINDOW_MS / 60000,
        truncated: rows.length >= VISIT_MAX_ROWS,
        all_sites: await storage.listVisitSites(),
        ...summarizeVisits(rows, Date.now()),
      });
      return;
    }

    if (req.method === 'DELETE' && pathname === '/api/visits') {
      if (!requireDropsAuth(res, req)) return;
      const removed = await storage.clearVisits();
      sendJson(res, 200, { removed });
      return;
    }

    // -- OPENCLAW GATEWAY ----------------------------------------

    if (req.method === 'GET' && pathname === '/api/gateway/status') {
      if (!requireDropsAuth(res, req)) return;
      sendJson(res, 200, await buildGatewayStatus(storage, parsedUrl.searchParams.get('url')));
      return;
    }

    // The machine running OpenClaw reports in here when this server cannot
    // reach it. Token-authenticated rather than session-authenticated: it is a
    // script on a desktop, and it holds no cookie.
    if (req.method === 'POST' && pathname === '/api/gateway/heartbeat') {
      if (!GATEWAY_TOKEN || GATEWAY_TOKEN.length < GATEWAY_TOKEN_MIN_LENGTH) {
        sendJson(res, 503, {
          error: `Set GATEWAY_TOKEN on the server to a random string of at least ${GATEWAY_TOKEN_MIN_LENGTH} characters.`,
        });
        return;
      }

      const supplied = String(req.headers['x-gateway-token'] || '').trim();
      if (!supplied || !safeCompareHash(supplied, sha256(GATEWAY_TOKEN))) {
        sendJson(res, 401, { error: 'Invalid or missing gateway token.' });
        return;
      }

      const body = await readJsonBody(req);
      const rawAgents = Array.isArray(body.agents) ? body.agents.slice(0, 100) : [];
      lastGatewayHeartbeat = {
        at: Date.now(),
        host: String(body.host || '').trim().slice(0, 120),
        version: String(body.version || '').trim().slice(0, 60),
        agents: rawAgents.filter(agent => agent && typeof agent === 'object').map(toGatewayAgent),
      };

      sendJson(res, 200, { ok: true, agents: lastGatewayHeartbeat.agents.length });
      return;
    }

    // The Settings page needs to know whether the phone inbox is usable and
    // which URLs to paste into Shortcuts. It never returns the token itself.
    if (req.method === 'GET' && pathname === '/api/shortcuts/setup') {
      if (!requireDropsAuth(res, req)) return;
      const origin = getRequestOrigin(req);
      sendJson(res, 200, {
        configured: Boolean(SHORTCUTS_TOKEN) && SHORTCUTS_TOKEN.length >= SHORTCUTS_TOKEN_MIN_LENGTH,
        token_present: Boolean(SHORTCUTS_TOKEN),
        min_token_length: SHORTCUTS_TOKEN_MIN_LENGTH,
        send_url: `${origin}/api/shortcuts/drops`,
        pull_url: `${origin}/api/shortcuts/drops?due=now`,
        pull_text_url: `${origin}/api/shortcuts/drops?due=now&format=text`,
        status_url: `${origin}/api/shortcuts/status`,
        countdowns_url: `${origin}/api/shortcuts/countdowns?limit=5&format=text`,
        header: 'X-Shortcuts-Token',
      });
      return;
    }

    if (pathname.startsWith('/api/shortcuts/')) {
      if (!requireShortcutsAuth(req, res, parsedUrl)) return;
      if (await handleShortcutsRequest(req, res, parsedUrl, storage)) return;
      sendJson(res, 404, { error: 'Unknown phone inbox endpoint.' });
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
        title: await uniqueDropTitle(storage, payload.value.title),
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

    // -- STREAKS API --------------------------------------------
    // The calendar is read in one request: the streaks with their running
    // counts, plus every mark in the window being drawn.
    if (req.method === 'GET' && pathname === '/api/streaks') {
      if (!requireDropsAuth(res, req)) return;

      const from = parsedUrl.searchParams.get('from') || '';
      const to = parsedUrl.searchParams.get('to') || '';
      if ((from && !isDayKey(from)) || (to && !isDayKey(to))) {
        sendJson(res, 400, { error: 'from and to must be YYYY-MM-DD dates.' });
        return;
      }

      const [streaks, days] = await Promise.all([
        storage.listStreaks(),
        storage.listStreakDays({ from, to }),
      ]);
      sendJson(res, 200, { streaks, days, today: todayKey() });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/streaks') {
      if (!requireDropsAuth(res, req)) return;

      const payload = validateStreakInput(await readJsonBody(req));
      if (!payload.ok) {
        sendJson(res, 400, { error: payload.error });
        return;
      }

      const streak = await storage.createStreak({
        id: `streak-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...payload.value,
      });

      sendJson(res, 201, streak);
      return;
    }

    // A day is marked with PUT and cleared with DELETE, so a Shortcut that
    // fires twice on the same day cannot turn a kept day back off.
    {
      const dayRoute = /^\/api\/streaks\/([^/]+)\/days\/([^/]+)$/.exec(pathname);
      if (dayRoute && (req.method === 'PUT' || req.method === 'POST' || req.method === 'DELETE')) {
        if (!requireDropsAuth(res, req)) return;

        const streakId = decodeURIComponent(dayRoute[1]);
        const day = decodeURIComponent(dayRoute[2]);
        if (!isDayKey(day)) {
          sendJson(res, 400, { error: 'The day must be a YYYY-MM-DD date.' });
          return;
        }

        if (req.method === 'DELETE') {
          const deleted = await storage.unmarkStreakDay(streakId, day);
          sendJson(res, 200, { ok: true, marked: false, removed: deleted, day });
          return;
        }

        const body = await readJsonBody(req);
        const marked = await storage.markStreakDay(streakId, day, cleanText(body.note, 300));
        if (!marked) {
          sendJson(res, 404, { error: 'Streak not found.' });
          return;
        }

        sendJson(res, 200, { ok: true, marked: true, day: marked.day, note: marked.note || '' });
        return;
      }
    }

    if (req.method === 'PATCH' && pathname.startsWith('/api/streaks/')) {
      if (!requireDropsAuth(res, req)) return;

      const id = decodeURIComponent(pathname.slice('/api/streaks/'.length)).trim();
      if (!id) {
        sendJson(res, 400, { error: 'Streak id is required.' });
        return;
      }

      const payload = validateStreakInput(await readJsonBody(req), true);
      if (!payload.ok) {
        sendJson(res, 400, { error: payload.error });
        return;
      }

      const streak = await storage.updateStreak(id, payload.value);
      if (!streak) {
        sendJson(res, 404, { error: 'Streak not found.' });
        return;
      }

      sendJson(res, 200, streak);
      return;
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/streaks/')) {
      if (!requireDropsAuth(res, req)) return;

      const id = decodeURIComponent(pathname.slice('/api/streaks/'.length)).trim();
      const deleted = await storage.deleteStreak(id);
      if (!deleted) {
        sendJson(res, 404, { error: 'Streak not found.' });
        return;
      }

      sendJson(res, 200, { ok: true });
      return;
    }

    // -- COUNTDOWNS API -----------------------------------------
    // Reading is open, the same as the calendar this page shows alongside the
    // cards; writing sits behind the Dropbox passphrase like every other
    // personal record in here.
    if (req.method === 'GET' && pathname === '/api/countdowns/rollup') {
      const payload = await buildCountdownsPayload();
      const limit = Number.parseInt(parsedUrl.searchParams.get('limit') || '', 10);
      const items = countdowns.selectRollupItems(payload, limit);
      if (String(parsedUrl.searchParams.get('format') || '') === 'text') {
        sendText(res, 200, countdowns.formatRollupText(payload, limit));
        return;
      }
      sendJson(res, 200, { now: payload.now, counts: payload.counts, items });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/countdowns') {
      sendJson(res, 200, await buildCountdownsPayload({
        includeArchived: parsedUrl.searchParams.get('archived') === '1',
        includeEvents: parsedUrl.searchParams.get('events') !== '0',
        includeShareBotReports: parsedUrl.searchParams.get('sharebot') === '1',
      }));
      return;
    }

    if (req.method === 'POST' && pathname === '/api/countdowns') {
      if (!requireDropsAuth(res, req)) return;

      const payload = countdowns.validateCountdownInput(await readJsonBody(req));
      if (!payload.ok) {
        sendJson(res, 400, { error: payload.error });
        return;
      }

      const now = new Date().toISOString();
      const created = await storage.createCountdown({
        id: `countdown-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now()}`,
        created_at: now,
        updated_at: now,
        ...payload.value,
      });

      sendJson(res, 201, countdowns.decorateCountdown(created));
      return;
    }

    if (req.method === 'PATCH' && pathname.startsWith('/api/countdowns/')) {
      if (!requireDropsAuth(res, req)) return;

      const id = decodeURIComponent(pathname.slice('/api/countdowns/'.length)).trim();
      if (!id) {
        sendJson(res, 400, { error: 'Countdown id is required.' });
        return;
      }

      const payload = countdowns.validateCountdownInput(await readJsonBody(req), true);
      if (!payload.ok) {
        sendJson(res, 400, { error: payload.error });
        return;
      }

      const updated = await storage.updateCountdown(id, payload.value);
      if (!updated) {
        sendJson(res, 404, { error: 'Countdown not found.' });
        return;
      }

      sendJson(res, 200, countdowns.decorateCountdown(updated));
      return;
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/countdowns/')) {
      if (!requireDropsAuth(res, req)) return;

      const id = decodeURIComponent(pathname.slice('/api/countdowns/'.length)).trim();
      const deleted = await storage.deleteCountdown(id);
      if (!deleted) {
        sendJson(res, 404, { error: 'Countdown not found.' });
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

    // -- APP SETTINGS API ----------------------------------------
    if (pathname.startsWith('/api/settings/')) {
      const key = decodeURIComponent(pathname.slice('/api/settings/'.length).trim());
      if (!ALLOWED_APP_SETTING_KEYS.has(key)) {
        sendJson(res, 404, { error: 'Setting not found.' });
        return;
      }

      if (req.method === 'GET') {
        sendJson(res, 200, { key, value: await storage.getAppSetting(key) });
        return;
      }

      if (!requireDropsAuth(res, req)) return;

      if (req.method === 'PUT') {
        const body = await readJsonBody(req);
        const value = typeof body.value === 'string' ? body.value.trim() : '';
        if (value.length > 200) {
          sendJson(res, 400, { error: 'Setting value is too long.' });
          return;
        }
        await storage.setAppSetting(key, value);
        sendJson(res, 200, { key, value });
        return;
      }

      if (req.method === 'DELETE') {
        await storage.deleteAppSetting(key);
        sendJson(res, 200, { key, value: null });
        return;
      }
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
  console.log(`Visitors: keeping ${VISIT_RETENTION_DAYS} days of page views`);
  storageReady.then(storage => {
    pruneOldVisits(storage);
    // unref'd so an idle prune timer is never the reason the process stays up.
    setInterval(() => pruneOldVisits(storage), VISIT_PRUNE_INTERVAL_MS).unref();
  }).catch(error => console.error('Visitors: could not schedule pruning.', error));

  if (!SHORTCUTS_TOKEN) {
    console.log('Phone inbox: off (set SHORTCUTS_TOKEN to use /api/shortcuts/*)');
  } else if (SHORTCUTS_TOKEN.length < SHORTCUTS_TOKEN_MIN_LENGTH) {
    console.warn(`Phone inbox: disabled — SHORTCUTS_TOKEN is shorter than ${SHORTCUTS_TOKEN_MIN_LENGTH} characters.`);
  } else {
    console.log('Phone inbox: on at /api/shortcuts/*');
  }
});
