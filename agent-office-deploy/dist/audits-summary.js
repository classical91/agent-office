'use strict';

// A read-only summary of the Audit Log for other services (Main Hub's System
// Logs widget). audits-data.js stays the one source of truth: this reads that
// file, never a copy, so a new record shows up wherever the summary is read
// without anyone maintaining a second history.
//
//   GET /api/integrations/audits/summary
//   Authorization: Bearer <AUDITS_SUMMARY_TOKEN>
//
// The file is a browser script (`window.AUDITS = [...]`). It is never run:
// the array is cut out of it and read with JSON.parse, so nothing in it can
// execute here. A file that is not plain JSON after the assignment is
// reported as unreadable rather than guessed at.
//
// What the summary promises:
// - Current counts per repository come from that repository's latest audit
//   only. Re-auditing FarmBot every week does not multiply its findings, and
//   an older audit's findings are history, not assumed to be still open.
// - A record with no findings section says so (`findingsState: "missing"`,
//   `counts: null`). It is never reported as zero findings.
// - Only what the widget needs leaves this server: no scope essays, no
//   recommended-fix lists, short trimmed text, https links only.

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const ROUTE = '/api/integrations/audits/summary';
const DEFAULT_FILE = path.join(__dirname, 'audits-data.js');
const MIN_TOKEN_LENGTH = 32;
const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const MAX_RECENT = 10;
const MAX_REPOSITORIES = 50;
const MAX_HISTORY = 12;
const MAX_TOP_FINDINGS = 5;
const MAX_REFERENCES = 5;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function text(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

function slug(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'audit';
}

function httpsUrl(value) {
  if (typeof value !== 'string' || value.length > 500) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

/** auditedAt as an ISO string and its sortable time, or nulls when it is not a date. */
function auditTime(value) {
  if (typeof value !== 'string') return { iso: null, time: null, date: null };
  const trimmed = value.trim();
  // A bare date is a day, not midnight UTC: noon keeps it on the same day in
  // every timezone the widget might be read in.
  const time = Date.parse(DATE_ONLY.test(trimmed) ? `${trimmed}T12:00:00Z` : trimmed);
  if (!Number.isFinite(time)) return { iso: null, time: null, date: null };
  return { iso: trimmed, time, date: new Date(time).toISOString().slice(0, 10) };
}

/**
 * The records in audits-data.js, without executing it. Throws a plain Error
 * whose message is safe to show when the file is not the shape it should be.
 */
function parseAuditsSource(source) {
  const match = /window\.AUDITS\s*=\s*/.exec(String(source || ''));
  if (!match) throw new Error('audits-data.js does not assign window.AUDITS.');
  const body = String(source).slice(match.index + match[0].length).trim().replace(/;\s*$/, '');
  let records;
  try {
    records = JSON.parse(body);
  } catch {
    throw new Error('audits-data.js is not a plain JSON array after window.AUDITS =.');
  }
  if (!Array.isArray(records)) throw new Error('window.AUDITS is not an array.');
  return records;
}

/**
 * Findings, counted. "reported" means every severity is a list; "unverified"
 * means a findings section exists but is not in that shape, so its counts
 * cannot be trusted; "missing" means the record has none at all.
 */
function readFindings(findings) {
  if (findings === undefined || findings === null) return { state: 'missing', counts: null, top: [] };
  if (typeof findings !== 'object' || Array.isArray(findings)) return { state: 'unverified', counts: null, top: [] };
  const complete = SEVERITIES.every(level => Array.isArray(findings[level]));
  const counts = {};
  for (const level of SEVERITIES) counts[level] = Array.isArray(findings[level]) ? findings[level].length : null;
  const top = [];
  for (const level of SEVERITIES) {
    if (!Array.isArray(findings[level])) continue;
    for (const item of findings[level]) {
      if (top.length >= MAX_TOP_FINDINGS) break;
      if (!item || typeof item !== 'object') continue;
      const summary = text(item.summary, 280);
      if (!summary) continue;
      top.push({
        id: text(item.id, 40),
        severity: level,
        summary,
        classification: text(item.classification, 140),
        evidence: httpsUrl(item.evidence),
      });
    }
  }
  return { state: complete ? 'reported' : 'unverified', counts, top };
}

function productionCheck(checks) {
  if (!checks || typeof checks !== 'object' || Array.isArray(checks)) return null;
  return text(checks.production, 80);
}

/** One record as the widget sees it, or null for a record with no project. */
function summarizeRecord(record, index) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const project = text(record.project, 120);
  if (!project) return null;
  const when = auditTime(record.auditedAt);
  const type = text(record.type, 120);
  const repository = typeof record.repository === 'string' && REPOSITORY.test(record.repository.trim())
    ? record.repository.trim() : null;
  // Older records carry no id. Their derived id comes from what they say,
  // not where they sit, so it stays stable when new records are added above.
  const id = text(record.id, 120)
    || `${slug(project)}-${slug(type)}-${when.iso ? slug(when.iso) : `undated-${index}`}`;
  const findings = readFindings(record.findings);
  const references = Array.isArray(record.references)
    ? record.references.map(httpsUrl).filter(Boolean).slice(0, MAX_REFERENCES)
    : [];
  return {
    id,
    project,
    repository,
    type,
    auditedAt: when.iso,
    date: when.date,
    status: text(record.overallStatus, 120),
    note: text(record.note, 400),
    commit: typeof record.commit === 'string' && /^[0-9a-f]{7,40}$/i.test(record.commit) ? record.commit.toLowerCase() : null,
    findingsState: findings.state,
    counts: findings.counts,
    topFindings: findings.top,
    productionCheck: productionCheck(record.checks),
    references,
    _time: when.time,
    _index: index,
  };
}

function newestFirst(a, b) {
  if (a._time !== b._time) {
    if (a._time === null) return 1;
    if (b._time === null) return -1;
    return b._time - a._time;
  }
  return a._index - b._index;
}

function publicAudit(audit) {
  const { _time, _index, ...rest } = audit;
  return rest;
}

function briefAudit(audit) {
  return {
    id: audit.id,
    project: audit.project,
    repository: audit.repository,
    type: audit.type,
    auditedAt: audit.auditedAt,
    date: audit.date,
    status: audit.status,
    findingsState: audit.findingsState,
    counts: audit.counts,
  };
}

/**
 * The summary of a list of raw records. Pure: `now` only stamps the answer.
 */
function summarizeAudits(records, { now = new Date() } = {}) {
  const list = Array.isArray(records) ? records : [];
  const audits = [];
  const seen = new Set();
  let skipped = 0;
  let duplicates = 0;
  list.forEach((record, index) => {
    const audit = summarizeRecord(record, index);
    if (!audit) { skipped += 1; return; }
    if (seen.has(audit.id)) { duplicates += 1; return; }
    seen.add(audit.id);
    audits.push(audit);
  });

  // A project audited with a repository named elsewhere is that repository,
  // even in the records that left it out - otherwise FarmBot's older reports
  // would count as a second project.
  const repositoryByProject = new Map();
  for (const audit of audits) {
    if (audit.repository && !repositoryByProject.has(audit.project.toLowerCase())) {
      repositoryByProject.set(audit.project.toLowerCase(), audit.repository);
    }
  }
  const keyFor = audit => {
    const repository = audit.repository || repositoryByProject.get(audit.project.toLowerCase());
    return repository ? `repo:${repository.toLowerCase()}` : `project:${slug(audit.project)}`;
  };

  audits.sort(newestFirst);
  const groups = new Map();
  for (const audit of audits) {
    const key = keyFor(audit);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(audit);
  }

  const repositories = [];
  for (const [key, group] of groups) {
    const latest = group[0];
    const repository = group.find(audit => audit.repository)?.repository
      || repositoryByProject.get(latest.project.toLowerCase()) || null;
    repositories.push({
      key,
      project: latest.project,
      repository,
      auditCount: group.length,
      latest: publicAudit(latest),
      history: group.slice(0, MAX_HISTORY).map(briefAudit),
    });
  }
  // Most recently audited first; the order a reader scans for what is new.
  repositories.sort((a, b) => newestFirst(groups.get(a.key)[0], groups.get(b.key)[0]));

  const latest = audits[0] || null;
  return {
    version: 1,
    generatedAt: now.toISOString(),
    auditLogPath: '/audits.html',
    totals: {
      records: audits.length,
      projects: groups.size,
      repositories: new Set(repositories.map(entry => entry.repository).filter(Boolean)).size,
      skipped,
      duplicates,
    },
    latest: latest ? publicAudit(latest) : null,
    repositories: repositories.slice(0, MAX_REPOSITORIES),
    recent: audits.slice(0, MAX_RECENT).map(briefAudit),
  };
}

/**
 * Reads and summarizes the file, reusing the last answer until the file
 * changes. A deploy replaces the file, so in practice this parses once.
 */
function createAuditsSummarySource({ file = DEFAULT_FILE, now = () => new Date() } = {}) {
  let cached = null;
  return {
    async read() {
      const stat = await fs.stat(file);
      const stamp = `${stat.mtimeMs}:${stat.size}`;
      if (cached && cached.stamp === stamp) return cached.records;
      const records = parseAuditsSource(await fs.readFile(file, 'utf8'));
      cached = { stamp, records };
      return records;
    },
    async summary() {
      return summarizeAudits(await this.read(), { now: now() });
    },
  };
}

function tokenMatches(header, expected) {
  const supplied = /^Bearer\s+(.+)$/i.exec(String(header || '').trim());
  if (!supplied) return false;
  // Hashed first so the comparison is constant-time whatever the lengths.
  const left = crypto.createHash('sha256').update(supplied[1].trim()).digest();
  const right = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(left, right);
}

const defaultSource = createAuditsSummarySource();

/**
 * True when the request was for this route and has been answered. Read-only:
 * GET and HEAD only, and nothing here writes to the audit history.
 */
async function handleAuditsSummaryIntegration({ req, res, pathname, sendJson,
  token = process.env.AUDITS_SUMMARY_TOKEN || '', source = defaultSource, log = console }) {
  if (pathname !== ROUTE) return false;
  res.setHeader('Cache-Control', 'no-store');
  const expected = String(token || '').trim();
  if (expected.length < MIN_TOKEN_LENGTH) {
    sendJson(res, 503, { error: 'Audit summary integration is disabled.' });
    return true;
  }
  if (!tokenMatches(req.headers.authorization, expected)) {
    sendJson(res, 401, { error: 'Unauthorized.' });
    return true;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'The audit summary is read-only.' }, { Allow: 'GET, HEAD' });
    return true;
  }
  let summary;
  try {
    summary = await source.summary();
  } catch (error) {
    if (log && log.error) log.error('Audit summary: could not read audits-data.js:', error.message);
    sendJson(res, 500, { error: 'The audit history could not be read.' });
    return true;
  }
  sendJson(res, 200, summary);
  return true;
}

module.exports = {
  ROUTE,
  MIN_TOKEN_LENGTH,
  createAuditsSummarySource,
  handleAuditsSummaryIntegration,
  parseAuditsSource,
  summarizeAudits,
};
