'use strict';

// Agent Office metadata that rides along with a calendar event.
//
// A Google Calendar event only knows about a summary, a description and some
// times. Everything that makes a block an *Agent Office* block - which agent
// owns it, what project it belongs to, whether it may be moved, how the run is
// going - lives in this layer.
//
// Two stores back it:
//   * Google `extendedProperties.private`, so the data survives outside Agent
//     Office and comes back on the next sync.
//   * A local mapping table keyed by event id, which is authoritative. Google
//     writes are best effort; run status must not depend on a network round
//     trip succeeding.

const EVENT_KINDS = [
  'meeting',
  'task',
  'deadline',
  'reminder',
  'automation',
  'focus',
  'agent-run',
  'review',
];

const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const EXECUTION_MODES = ['manual', 'agent-run', 'assisted'];
const RUN_STATUSES = ['unscheduled', 'scheduled', 'running', 'needs_input', 'completed', 'failed'];

// Google caps each extended property at 1024 characters for the value.
const MAX_TEXT = 512;
const MAX_LIST_ITEMS = 12;

const FIELDS = {
  agentId: { kind: 'text' },
  projectId: { kind: 'text' },
  taskId: { kind: 'text' },
  eventKind: { kind: 'enum', values: EVENT_KINDS, fallback: '' },
  priority: { kind: 'enum', values: PRIORITIES, fallback: '' },
  executionMode: { kind: 'enum', values: EXECUTION_MODES, fallback: '' },
  movable: { kind: 'bool' },
  estimatedDuration: { kind: 'int', min: 0, max: 24 * 60 },
  prepMinutes: { kind: 'int', min: 0, max: 8 * 60 },
  followUpMinutes: { kind: 'int', min: 0, max: 8 * 60 },
  requiredInputs: { kind: 'list' },
  expectedOutput: { kind: 'text' },
  runStatus: { kind: 'enum', values: RUN_STATUSES, fallback: '' },
  resultUrl: { kind: 'text' },
  // Run bookkeeping. Not user-editable through the event form, but part of the
  // same record so a block can show live progress and its finished output.
  runStartedAt: { kind: 'text' },
  runEndedAt: { kind: 'text' },
  runHeartbeatAt: { kind: 'text' },
  runSummary: { kind: 'text' },
  runProgress: { kind: 'text' },
  runFindings: { kind: 'int', min: 0, max: 9999 },
  dependsOn: { kind: 'list' },
  energy: { kind: 'enum', values: ['low', 'medium', 'high'], fallback: '' },
  // Orchestration identifiers. A block never runs anything itself - it submits a
  // Mission Control goal to Penny and then mirrors that goal's state, so these
  // three point at the real execution rather than duplicating it.
  //   executionId    the Mission Control goal id Penny is working
  //   pennySessionId the OpenClaw session key, stable across an approval pause
  //   approvalId     the goal waiting on Jason, set only while that is true
  executionId: { kind: 'text' },
  pennySessionId: { kind: 'text' },
  approvalId: { kind: 'text' },
};

const FIELD_NAMES = Object.keys(FIELDS);

// Prefix keeps Agent Office keys from colliding with anything else that writes
// private properties onto the same Google event.
const GOOGLE_KEY_PREFIX = 'ao';

function googleKeyFor(field) {
  return GOOGLE_KEY_PREFIX + field.charAt(0).toUpperCase() + field.slice(1);
}

const GOOGLE_KEYS = FIELD_NAMES.reduce((acc, field) => {
  acc[googleKeyFor(field)] = field;
  return acc;
}, {});

function cleanString(value, max = MAX_TEXT) {
  if (value === null || value === undefined) return '';
  // Control characters would break the "a|b" list encoding and Google's
  // property values, so flatten them to spaces before trimming.
  return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function coerceBool(value) {
  if (value === true || value === false) return value;
  const text = cleanString(value).toLowerCase();
  if (text === 'true' || text === 'yes' || text === '1') return true;
  if (text === 'false' || text === 'no' || text === '0') return false;
  return null;
}

function coerceInt(value, spec) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(spec.max, Math.max(spec.min, parsed));
}

function coerceList(value) {
  const items = Array.isArray(value)
    ? value
    : cleanString(value, MAX_TEXT * 2).split(/\s*[|,\n]\s*/);
  return items
    .map(item => cleanString(item, 120))
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS);
}

function coerceField(field, value) {
  const spec = FIELDS[field];
  if (!spec) return undefined;
  switch (spec.kind) {
    case 'bool':
      return coerceBool(value);
    case 'int':
      return coerceInt(value, spec);
    case 'list': {
      const list = coerceList(value);
      return list.length ? list : null;
    }
    case 'enum': {
      // Callers write these as "agent-run", "agent_run" or "Agent Run"; the
      // allowed lists use both hyphens (event kinds) and underscores (run and
      // agent statuses), so try each spelling rather than picking one.
      const text = cleanString(value, 40).toLowerCase();
      const candidates = [
        text,
        text.replace(/[\s_]+/g, '-'),
        text.replace(/[\s-]+/g, '_'),
      ];
      const match = candidates.find(candidate => spec.values.includes(candidate));
      return match === undefined ? null : match;
    }
    default: {
      const text = cleanString(value);
      return text || null;
    }
  }
}

// Accepts a loose object (an API body, a Google property bag, an older record)
// and returns only the fields that carry a real value. Absent stays absent so
// that patches can be merged without clobbering.
function normalizeMeta(input) {
  if (!input || typeof input !== 'object') return {};
  const meta = {};
  FIELD_NAMES.forEach(field => {
    if (!Object.prototype.hasOwnProperty.call(input, field)) return;
    const coerced = coerceField(field, input[field]);
    if (coerced === null || coerced === undefined) return;
    meta[field] = coerced;
  });
  return meta;
}

// A patch may explicitly clear a field by sending null or an empty string.
function mergeMeta(base, patch) {
  const merged = { ...(base && typeof base === 'object' ? base : {}) };
  if (!patch || typeof patch !== 'object') return merged;
  FIELD_NAMES.forEach(field => {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) return;
    const raw = patch[field];
    if (raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0)) {
      delete merged[field];
      return;
    }
    const coerced = coerceField(field, raw);
    if (coerced === null || coerced === undefined) {
      delete merged[field];
      return;
    }
    merged[field] = coerced;
  });
  return merged;
}

function isEmptyMeta(meta) {
  return !meta || Object.keys(meta).length === 0;
}

// Google stores every private property as a string.
function metaToGooglePrivate(meta) {
  const normalized = normalizeMeta(meta);
  const bag = {};
  Object.keys(normalized).forEach(field => {
    const value = normalized[field];
    bag[googleKeyFor(field)] = Array.isArray(value) ? value.join('|') : String(value);
  });
  return bag;
}

function metaFromGooglePrivate(bag) {
  if (!bag || typeof bag !== 'object') return {};
  const raw = {};
  Object.keys(bag).forEach(key => {
    const field = GOOGLE_KEYS[key];
    if (field) raw[field] = bag[key];
  });
  // Events created before this layer existed only carry the old type key.
  if (!raw.eventKind && bag.agentOfficeType) raw.eventKind = bag.agentOfficeType;
  return normalizeMeta(raw);
}

// Local map wins: it is written synchronously, Google is written best effort.
function resolveMeta(googlePrivate, localMeta) {
  return { ...metaFromGooglePrivate(googlePrivate), ...normalizeMeta(localMeta) };
}

function isAgentOwned(meta) {
  if (isEmptyMeta(meta)) return false;
  return Boolean(meta.agentId) || meta.executionMode === 'agent-run' || meta.eventKind === 'agent-run';
}

// ── Run lifecycle ──────────────────────────────────────────────────────────
//
// scheduled → running → (needs_input → running)* → completed | failed
//
// Each transition returns the metadata patch for the event plus the patch the
// agent record needs, so the calendar block and the agent roster cannot drift.

const RUN_ACTIONS = ['schedule', 'start', 'progress', 'needs_input', 'complete', 'fail', 'reset'];

const ALLOWED_FROM = {
  schedule: ['unscheduled', 'scheduled', 'completed', 'failed'],
  start: ['unscheduled', 'scheduled', 'needs_input', 'failed'],
  progress: ['running'],
  needs_input: ['running'],
  complete: ['running', 'needs_input'],
  fail: ['running', 'needs_input', 'scheduled'],
  reset: RUN_STATUSES,
};

const AGENT_STATUS_FOR_RUN = {
  scheduled: 'idle',
  running: 'running',
  needs_input: 'needs_input',
  completed: 'idle',
  failed: 'failed',
};

function runTransition(meta, action, payload = {}, now = new Date()) {
  const current = normalizeMeta(meta);
  const from = current.runStatus || 'unscheduled';
  if (!RUN_ACTIONS.includes(action)) {
    return { ok: false, error: `Unknown run action "${action}".` };
  }
  if (!ALLOWED_FROM[action].includes(from)) {
    return { ok: false, error: `Cannot ${action} a run that is ${from}.` };
  }

  const stamp = (now instanceof Date ? now : new Date(now)).toISOString();
  const patch = {};
  let runStatus = from;

  switch (action) {
    case 'schedule':
      runStatus = 'scheduled';
      patch.runStartedAt = null;
      patch.runEndedAt = null;
      patch.runProgress = null;
      // Re-scheduling a finished block means the next run is a new execution.
      patch.executionId = null;
      patch.pennySessionId = null;
      patch.approvalId = null;
      break;
    case 'start':
      runStatus = 'running';
      // Resuming after an approval or an answer continues the same execution, so
      // the elapsed time on the block stays the elapsed time of the whole run.
      patch.runStartedAt = from === 'needs_input' && current.runStartedAt ? current.runStartedAt : stamp;
      patch.runHeartbeatAt = stamp;
      patch.runEndedAt = null;
      patch.approvalId = null;
      break;
    case 'progress':
      runStatus = 'running';
      patch.runHeartbeatAt = stamp;
      break;
    case 'needs_input':
      runStatus = 'needs_input';
      patch.runHeartbeatAt = stamp;
      break;
    case 'complete':
      runStatus = 'completed';
      patch.runEndedAt = stamp;
      patch.runHeartbeatAt = stamp;
      patch.approvalId = null;
      break;
    case 'fail':
      runStatus = 'failed';
      patch.runEndedAt = stamp;
      patch.runHeartbeatAt = stamp;
      patch.approvalId = null;
      break;
    case 'reset':
      runStatus = 'scheduled';
      patch.runStartedAt = null;
      patch.runEndedAt = null;
      patch.runHeartbeatAt = null;
      patch.runProgress = null;
      patch.runSummary = null;
      patch.runFindings = null;
      patch.resultUrl = null;
      patch.executionId = null;
      patch.pennySessionId = null;
      patch.approvalId = null;
      break;
    default:
      break;
  }

  patch.runStatus = runStatus;
  if (payload.progress !== undefined) patch.runProgress = payload.progress;
  if (payload.summary !== undefined) patch.runSummary = payload.summary;
  if (payload.resultUrl !== undefined) patch.resultUrl = payload.resultUrl;
  if (payload.findings !== undefined) patch.runFindings = payload.findings;

  const nextMeta = mergeMeta(current, patch);
  const agentPatch = {
    status: AGENT_STATUS_FOR_RUN[runStatus] || 'idle',
    current_task_id: runStatus === 'running' || runStatus === 'needs_input' ? (nextMeta.taskId || '') : '',
    current_project_id: runStatus === 'running' || runStatus === 'needs_input' ? (nextMeta.projectId || '') : '',
  };

  // `patch` carries the explicit nulls that clear a field; `meta` is what the
  // block looks like afterwards. A caller that persists `meta` alone would merge
  // it over the stored record and silently keep the values this run cleared, so
  // anything writing to storage wants `patch`.
  return { ok: true, from, to: runStatus, patch, meta: nextMeta, agentPatch, agentId: nextMeta.agentId || '' };
}

// A block only becomes a Penny execution when it says so itself. Anything else
// on the calendar - a meeting, a manual task, a review someone does by hand - is
// never dispatched, however much agent metadata it happens to carry.
function isExecutable(meta) {
  const normalized = normalizeMeta(meta);
  return normalized.executionMode === 'agent-run' && Boolean(normalized.agentId);
}

// A run whose heartbeat has aged out has not failed - nobody knows what it did.
// Matches the 20 minutes after which Mission Control lets a goal be re-claimed.
const RUN_STALE_MS = 20 * 60 * 1000;

function isRunStale(meta, now = new Date()) {
  const normalized = normalizeMeta(meta);
  if (normalized.runStatus !== 'running' || !normalized.runHeartbeatAt) return false;
  const beat = new Date(normalized.runHeartbeatAt);
  if (Number.isNaN(beat.getTime())) return false;
  const reference = now instanceof Date ? now : new Date(now);
  return reference.getTime() - beat.getTime() > RUN_STALE_MS;
}

// "Running · 18 minutes elapsed · 3 findings" - the line a block shows without
// the caller having to recompute durations everywhere.
function describeRun(meta, now = new Date()) {
  const normalized = normalizeMeta(meta);
  const status = normalized.runStatus || (isAgentOwned(normalized) ? 'scheduled' : '');
  if (!status) return '';
  const parts = [];
  const label = {
    unscheduled: 'Not scheduled',
    scheduled: 'Scheduled',
    running: isRunStale(normalized, now) ? 'Execution status unknown' : 'Running',
    // An approval and an answered question both park the run on Jason, but they
    // ask for different things, so they do not read the same.
    needs_input: normalized.approvalId ? 'Needs approval' : 'Needs input',
    completed: 'Completed',
    failed: 'Failed',
  }[status] || status;
  parts.push(label);

  const started = normalized.runStartedAt ? new Date(normalized.runStartedAt) : null;
  const ended = normalized.runEndedAt ? new Date(normalized.runEndedAt) : null;
  const reference = now instanceof Date ? now : new Date(now);
  if (started && !Number.isNaN(started.getTime())) {
    const until = status === 'running' || status === 'needs_input' ? reference : (ended || reference);
    const minutes = Math.max(0, Math.round((until.getTime() - started.getTime()) / 60000));
    parts.push(status === 'completed' || status === 'failed'
      ? `${minutes} minutes total`
      : `${minutes} minutes elapsed`);
  }
  if (normalized.runFindings) parts.push(`${normalized.runFindings} findings`);
  if (normalized.runProgress) parts.push(normalized.runProgress);
  return parts.join(' · ');
}

module.exports = {
  EVENT_KINDS,
  PRIORITIES,
  EXECUTION_MODES,
  RUN_STATUSES,
  RUN_ACTIONS,
  RUN_STALE_MS,
  FIELD_NAMES,
  normalizeMeta,
  mergeMeta,
  isEmptyMeta,
  metaToGooglePrivate,
  metaFromGooglePrivate,
  resolveMeta,
  isAgentOwned,
  isExecutable,
  isRunStale,
  runTransition,
  describeRun,
};
