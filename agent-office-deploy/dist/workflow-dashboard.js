// Mission Control's workflow model, shared by the server and the browser.
//
// Mission Control used to be Penny's goal queue with schedule inventories
// pasted into goal cards. It now answers a different question: what do
// Penny/OpenClaw and ChatGPT deliver to Jason, when is it due, and did it
// arrive? This module owns the shape of that answer and nothing else — no
// storage, no network — so the same rules decide what the API returns and
// what the panel draws, and both are testable without a server.
//
// Three rules run through all of it:
//   - A schedule is kept exactly as the provider wrote it. `0 8 */2 * *` is
//     stored as `0 8 */2 * *` and described as day-of-month stepping, never
//     as "every 48 hours".
//   - A next run says where it came from: the provider reported it, it was
//     calculated here from the schedule, or it is unknown.
//   - Missing history is unknown, not failed. Only a run that reports a
//     failure is a failure, and a relay that stopped reporting is a stale
//     connection, not a broken workflow.
(function (root) {
  'use strict';

  const DISPLAY_ZONE = 'America/Vancouver';
  const PROVIDERS = { openclaw: 'OpenClaw', chatgpt: 'ChatGPT', claude: 'Claude', other: 'Other' };
  const CATEGORIES = ['reflection', 'brief', 'audit', 'rollup', 'report', 'reminder', 'maintenance', 'other'];
  const EXECUTION_STATES = ['succeeded', 'failed', 'running', 'skipped', 'unknown'];
  const DELIVERY_STATES = ['delivered', 'failed', 'pending', 'not_applicable', 'unknown'];
  const SCHEDULE_KINDS = ['cron', 'interval', 'once', 'provider'];
  const MAX_SEARCH_DAYS = 366 * 5;
  const MIN_INTERVAL_MS = 60 * 1000;

  // -- text ---------------------------------------------------------------

  function text(value, max) {
    return String(value == null ? '' : value).replace(/\u0000/g, '').trim().slice(0, max);
  }

  function normalizeName(value) {
    return text(value, 200).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // -- time zones ---------------------------------------------------------

  const formatters = new Map();
  function zoneFormatter(zone) {
    if (!formatters.has(zone)) {
      formatters.set(zone, new Intl.DateTimeFormat('en-CA', {
        timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }));
    }
    return formatters.get(zone);
  }

  function isValidZone(zone) {
    if (!zone || typeof zone !== 'string') return false;
    try { zoneFormatter(zone); return true; } catch { return false; }
  }

  function zoneParts(ms, zone) {
    const parts = {};
    for (const part of zoneFormatter(zone).formatToParts(ms)) {
      if (part.type !== 'literal') parts[part.type] = Number(part.value);
    }
    return parts;
  }

  // The instant a wall-clock time in `zone` happens, or null when that time
  // does not exist there (the hour skipped when clocks spring forward).
  function wallTime(year, month, day, hour, minute, zone) {
    const target = Date.UTC(year, month - 1, day, hour, minute);
    let value = target;
    for (let i = 0; i < 4; i++) {
      const p = zoneParts(value, zone);
      const delta = target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
      if (!delta) return value;
      value += delta;
    }
    return null;
  }

  // "2026-10-06T08:00" read as a wall-clock time in `zone`.
  function localToInstant(local, zone) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(local || ''));
    if (!match) return null;
    const [, y, mo, d, h, mi] = match.map(Number);
    if (new Date(Date.UTC(y, mo - 1, d, h, mi)).toISOString().slice(0, 16) !== local) return null;
    return wallTime(y, mo, d, h, mi, zone);
  }

  // -- cron -----------------------------------------------------------------

  const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const CRON_FIELDS = [
    { label: 'minute', min: 0, max: 59 },
    { label: 'hour', min: 0, max: 23 },
    { label: 'day of month', min: 1, max: 31 },
    { label: 'month', min: 1, max: 12, names: MONTH_NAMES, offset: 1 },
    { label: 'day of week', min: 0, max: 7, names: DAY_NAMES, offset: 0 },
  ];
  const CRON_MACROS = {
    '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *',
    '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *',
  };

  function cronValue(token, spec) {
    const upper = token.toUpperCase();
    if (spec.names && spec.names.includes(upper)) return spec.names.indexOf(upper) + spec.offset;
    if (!/^\d+$/.test(token)) throw new Error(`"${token}" is not a valid ${spec.label}.`);
    const value = Number(token);
    if (value < spec.min || value > spec.max) throw new Error(`${spec.label} ${value} is out of range.`);
    return value;
  }

  function parseCronField(field, spec) {
    const values = new Set();
    for (const part of field.split(',')) {
      if (!part) throw new Error(`Empty ${spec.label} entry.`);
      const [range, stepText, extra] = part.split('/');
      if (extra !== undefined) throw new Error(`"${part}" is not a valid ${spec.label}.`);
      let step = 1;
      if (stepText !== undefined) {
        if (!/^\d+$/.test(stepText) || Number(stepText) < 1) throw new Error(`"${part}" has an invalid step.`);
        step = Number(stepText);
      }
      let low;
      let high;
      if (range === '*' || range === '?') {
        low = spec.min; high = spec.max;
      } else if (range.includes('-')) {
        const [a, b] = range.split('-');
        low = cronValue(a, spec); high = cronValue(b, spec);
        if (low > high) throw new Error(`"${part}" is a backwards range.`);
      } else {
        low = cronValue(range, spec);
        high = stepText !== undefined ? spec.max : low;
      }
      for (let value = low; value <= high; value += step) values.add(value);
    }
    return [...values].sort((a, b) => a - b);
  }

  // Five fields, standard cron semantics. When day-of-month and day-of-week
  // are both restricted, a day matching either one runs (vixie-cron); a field
  // that starts with "*" counts as unrestricted, "*/2" included.
  function parseCron(expr) {
    const raw = text(expr, 120);
    const expanded = CRON_MACROS[raw.toLowerCase()] || raw;
    const fields = expanded.split(/\s+/).filter(Boolean);
    if (fields.length !== 5) throw new Error('A cron schedule needs five fields: minute hour day-of-month month day-of-week.');
    const [minutes, hours, doms, months, dowsRaw] = fields.map((field, i) => parseCronField(field, CRON_FIELDS[i]));
    const dows = [...new Set(dowsRaw.map(day => day % 7))].sort((a, b) => a - b);
    return {
      expr: raw, fields, minutes, hours, doms, months, dows,
      domStar: fields[2].startsWith('*') || fields[2] === '?',
      dowStar: fields[4].startsWith('*') || fields[4] === '?',
    };
  }

  function isValidCron(expr) {
    try { parseCron(expr); return true; } catch { return false; }
  }

  function cronDayMatches(cron, year, month, day) {
    if (!cron.months.includes(month)) return false;
    const domOk = cron.doms.includes(day);
    const dowOk = cron.dows.includes(new Date(Date.UTC(year, month - 1, day)).getUTCDay());
    if (cron.domStar || cron.dowStar) return domOk && dowOk;
    return domOk || dowOk;
  }

  // The first run strictly after `after`, walking the zone's calendar days.
  // A wall-clock time that does not exist on a DST day is skipped rather than
  // shifted, so a 02:30 job is not reported at 03:00 that day.
  function nextCronRun(exprOrCron, zone, after) {
    const cron = typeof exprOrCron === 'string' ? parseCron(exprOrCron) : exprOrCron;
    const start = zoneParts(after, zone);
    let cursor = Date.UTC(start.year, start.month - 1, start.day);
    for (let i = 0; i < MAX_SEARCH_DAYS; i++, cursor += 86400000) {
      const date = new Date(cursor);
      const y = date.getUTCFullYear(); const m = date.getUTCMonth() + 1; const d = date.getUTCDate();
      if (!cronDayMatches(cron, y, m, d)) continue;
      for (const hour of cron.hours) {
        for (const minute of cron.minutes) {
          const at = wallTime(y, m, d, hour, minute, zone);
          if (at !== null && at > after) return at;
        }
      }
    }
    return null;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  // "1, 3, 5 … 31" rather than sixteen numbers; "Mon–Fri" rather than five
  // names. Consecutive runs collapse to a range.
  function listText(values, names) {
    const label = v => (names ? names[v] : v);
    if (!names && values.length > 6) {
      return `${values.slice(0, 3).map(label).join(', ')} … ${label(values[values.length - 1])}`;
    }
    const ranges = [];
    for (const value of values) {
      const last = ranges[ranges.length - 1];
      if (last && value === last[1] + 1) last[1] = value; else ranges.push([value, value]);
    }
    return ranges.map(([a, b]) => (b - a >= 2 ? `${label(a)}–${label(b)}` : a === b ? `${label(a)}` : `${label(a)}, ${label(b)}`)).join(', ');
  }

  function stepOf(field) {
    const match = /^(\*|\d+(?:-\d+)?)\/(\d+)$/.exec(field);
    return match ? Number(match[2]) : null;
  }

  // Plain words for a cron expression, plus the caveats the words would hide.
  // Anything unusual falls back to the expression itself rather than a guess.
  function describeCron(expr) {
    let cron;
    try { cron = parseCron(expr); } catch (error) { return { text: `Invalid cron: ${error.message}`, notes: [] }; }
    const [minF, hourF, domF, monF, dowF] = cron.fields;
    const notes = [];
    let time;
    if (cron.minutes.length === 1 && cron.hours.length <= 4 && hourF !== '*') {
      time = 'at ' + cron.hours.map(h => `${pad(h)}:${pad(cron.minutes[0])}`).join(', ');
    } else if (cron.minutes.length === 1 && hourF === '*') {
      time = `every hour at :${pad(cron.minutes[0])}`;
    } else if (stepOf(minF) && minF.startsWith('*') && hourF === '*') {
      time = `every ${stepOf(minF)} minutes`;
    } else {
      time = `at minute ${minF}, hour ${hourF}`;
    }

    let days;
    const domStep = stepOf(domF);
    if (cron.domStar && cron.dowStar && !domStep) days = 'every day';
    else if (domStep && cron.dowStar) {
      days = `on days ${listText(cron.doms)} of each month`;
      notes.push(`Day-of-month step (${domF}): the count restarts at the start of every month, so runs are not always ${domStep * 24} hours apart — the last run of one month and the first of the next can be closer together.`);
    } else if (!cron.domStar && cron.dowStar) days = `on day${cron.doms.length > 1 ? 's' : ''} ${listText(cron.doms)} of the month`;
    else if (cron.domStar && !cron.dowStar) days = `on ${listText(cron.dows, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])}`;
    else {
      days = `on day ${listText(cron.doms)} of the month or on ${listText(cron.dows, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])}`;
      notes.push('Day-of-month and day-of-week are both set, so a day matching either one runs.');
    }
    if (cron.doms.some(d => d > 28) && !cron.domStar && cron.doms.length <= 3) {
      notes.push('Months without that date are skipped, not moved to the last day.');
    }
    const monthText = monF === '*' ? '' : ` in ${listText(cron.months.map(m => m - 1), ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])}`;
    return { text: `${time}, ${days}${monthText}`, notes };
  }

  // -- schedules --------------------------------------------------------------

  function durationText(ms) {
    const minutes = Math.round(ms / 60000);
    if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? '' : 's'}`;
    if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? '' : 's'}`;
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  function toIso(value) {
    if (value === null || value === undefined || value === '') return '';
    const ms = typeof value === 'number' ? value : Date.parse(value);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : '';
  }

  // Every schedule kind the providers use, without forcing any of them into
  // daily/weekly/monthly. `timezone` is the schedule's own zone; display is
  // always converted to Vancouver separately.
  function normalizeSchedule(raw) {
    const input = raw && typeof raw === 'object' ? raw : {};
    let kind = text(input.kind, 20).toLowerCase();
    if (kind === 'every') kind = 'interval';
    if (kind === 'at') kind = 'once';
    const timezone = text(input.timezone || input.tz, 80) || DISPLAY_ZONE;
    if (!isValidZone(timezone)) throw new Error(`Unknown time zone "${timezone}".`);
    const schedule = {
      kind, timezone,
      expr: '', every_ms: null, anchor: '', at: '', starts_at: '',
      text: text(input.text, 300), flexible: Boolean(input.flexible),
    };
    if (kind === 'cron') {
      schedule.expr = text(input.expr, 120);
      parseCron(schedule.expr);
      schedule.starts_at = toIso(input.starts_at);
    } else if (kind === 'interval') {
      const every = Number(input.every_ms || input.everyMs);
      if (!Number.isFinite(every) || every < MIN_INTERVAL_MS) throw new Error('An interval schedule needs an interval of at least one minute.');
      schedule.every_ms = Math.round(every);
      schedule.anchor = toIso(input.anchor || input.anchorMs);
    } else if (kind === 'once') {
      const at = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(input.at || ''))
        ? localToInstant(input.at, timezone)
        : Date.parse(input.at);
      if (!Number.isFinite(at)) throw new Error('A one-time schedule needs a valid date and time.');
      schedule.at = new Date(at).toISOString();
    } else if (kind === 'provider') {
      if (!schedule.text) throw new Error('Describe the schedule as the provider shows it.');
    } else {
      throw new Error('Schedule kind must be cron, interval, once, or provider.');
    }
    return schedule;
  }

  function describeSchedule(schedule) {
    if (!schedule) return { text: 'No schedule', notes: [] };
    const flexible = schedule.flexible ? ['Flexible timing: the provider may run this somewhat earlier or later than the stated time.'] : [];
    if (schedule.kind === 'cron') {
      const described = describeCron(schedule.expr);
      return { text: described.text, notes: [...described.notes, ...flexible] };
    }
    if (schedule.kind === 'interval') {
      return {
        text: `every ${durationText(schedule.every_ms)}`,
        notes: [...(schedule.anchor ? [] : ['No anchor time is known, so the next run cannot be calculated.']), ...flexible],
      };
    }
    if (schedule.kind === 'once') return { text: 'once', notes: flexible };
    return { text: schedule.text || 'Provider schedule', notes: flexible };
  }

  // Where the next run comes from, in order of trust: the provider's own
  // report, a calculation from an exact schedule, or nothing.
  function nextRun(workflow, now) {
    if (!workflow.enabled) return { at: null, basis: 'disabled' };
    const schedule = workflow.schedule || {};
    const reported = Number(workflow.provider_next_run_at) || null;
    const approximate = Boolean(schedule.flexible);
    if (reported && reported > now) return { at: reported, basis: 'provider', approximate };
    if (schedule.kind === 'cron') {
      const startsAt = Date.parse(schedule.starts_at);
      const after = Number.isFinite(startsAt) ? Math.max(now, startsAt - 1) : now;
      const at = nextCronRun(schedule.expr, schedule.timezone || DISPLAY_ZONE, after);
      return at ? { at, basis: 'calculated', approximate } : { at: null, basis: 'unknown', reason: 'No matching date in the next five years.' };
    }
    if (schedule.kind === 'interval') {
      const anchor = Date.parse(schedule.anchor);
      if (!Number.isFinite(anchor)) return { at: null, basis: 'unknown', reason: 'Interval has no known anchor time.' };
      const steps = anchor > now ? 0 : Math.floor((now - anchor) / schedule.every_ms) + 1;
      return { at: anchor + steps * schedule.every_ms, basis: 'calculated', approximate };
    }
    if (schedule.kind === 'once') {
      const at = Date.parse(schedule.at);
      if (at > now) return { at, basis: 'calculated', approximate };
      return { at: null, basis: 'past', past_at: at };
    }
    return { at: null, basis: 'unknown', reason: 'The provider has not reported a next run.' };
  }

  // -- records ----------------------------------------------------------------

  function providerKey(value) {
    const lowered = text(value, 40).toLowerCase().replace(/[^a-z]/g, '');
    if (lowered.startsWith('openclaw') || lowered === 'penny' || lowered === 'cron') return 'openclaw';
    if (lowered.startsWith('chatgpt') || lowered === 'openai') return 'chatgpt';
    if (lowered.startsWith('claude')) return 'claude';
    return 'other';
  }

  function inferCategory(name, purpose) {
    const haystack = `${name} ${purpose || ''}`.toLowerCase();
    if (/\baudit/.test(haystack)) return 'audit';
    if (/reflect|journal/.test(haystack)) return 'reflection';
    if (/roll-?up|digest|recap|wrap-?up/.test(haystack)) return 'rollup';
    if (/\bbrief/.test(haystack)) return 'brief';
    if (/report|newsroom|news/.test(haystack)) return 'report';
    if (/remind/.test(haystack)) return 'reminder';
    if (/backup|cleanup|clean-up|sync|heartbeat|health ?check|maintenance/.test(haystack)) return 'maintenance';
    return 'other';
  }

  function dedupeKey(record) {
    return record.provider_id
      ? `${record.provider}:id:${record.provider_id}`
      : `${record.provider}:name:${normalizeName(record.name)}`;
  }

  // A workflow definition. Runs are separate records (normalizeRun); this
  // holds only what the workflow is, where it came from, and how fresh that is.
  function normalizeWorkflow(raw, { now = Date.now() } = {}) {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid workflow.');
    const name = text(raw.name || raw.title, 180);
    if (!name) throw new Error('A workflow needs a name.');
    const provider = PROVIDERS[raw.provider] ? raw.provider : providerKey(raw.provider);
    const purpose = text(raw.purpose || raw.description, 1000);
    const category = CATEGORIES.includes(raw.category) ? raw.category : inferCategory(name, purpose);
    const source = ['imported', 'manual'].includes(raw.source) ? raw.source : 'manual';
    const nowIso = new Date(now).toISOString();
    return {
      id: text(raw.id, 160),
      provider,
      provider_id: text(raw.provider_id, 160),
      name,
      purpose,
      agent: text(raw.agent || raw.agent_id, 80),
      delivery: text(raw.delivery, 300),
      category,
      schedule: normalizeSchedule(raw.schedule),
      enabled: raw.enabled !== false,
      prompt: text(raw.prompt, 20000),
      source,
      source_label: text(raw.source_label, 200),
      synced_at: toIso(raw.synced_at) || nowIso,
      provider_next_run_at: Number(raw.provider_next_run_at) || null,
      archive_id: text(raw.archive_id, 160),
      created_at: toIso(raw.created_at) || nowIso,
      updated_at: toIso(raw.updated_at) || nowIso,
    };
  }

  function executionState(raw) {
    const value = text(raw, 40).toLowerCase();
    if (!value) return 'unknown';
    if (EXECUTION_STATES.includes(value)) return value;
    if (/^(ok|success|successful|completed?|done|finished|delivered)$/.test(value)) return 'succeeded';
    if (/error|fail|timeout|timed.?out|crash|abort/.test(value)) return 'failed';
    if (/running|progress|started|active/.test(value)) return 'running';
    if (/skip/.test(value)) return 'skipped';
    return 'unknown';
  }

  function deliveryState(raw) {
    const value = text(raw, 40).toLowerCase();
    if (DELIVERY_STATES.includes(value)) return value;
    if (/^(sent|ok|success|delivered|posted)$/.test(value)) return 'delivered';
    if (/fail|error|bounce|undeliver/.test(value)) return 'failed';
    if (/pending|queued|sending/.test(value)) return 'pending';
    if (/^(none|n\/a|not.?applicable)$/.test(value)) return 'not_applicable';
    return 'unknown';
  }

  // One execution of a workflow. Execution and delivery are separate: a run
  // can finish and still fail to reach Jason.
  function normalizeRun(raw, { now = Date.now() } = {}) {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid run.');
    const outputUrl = text(raw.output_url, 2000);
    if (outputUrl && !/^https?:\/\//i.test(outputUrl)) throw new Error('Output link must be an http or https URL.');
    const finishedAt = toIso(raw.finished_at);
    const startedAt = toIso(raw.started_at);
    const run = {
      id: text(raw.id, 160),
      workflow_id: text(raw.workflow_id, 160),
      scheduled_for: toIso(raw.scheduled_for),
      started_at: startedAt,
      finished_at: finishedAt,
      execution_status: executionState(raw.execution_status || raw.status),
      delivery_status: deliveryState(raw.delivery_status),
      output_title: text(raw.output_title, 200),
      output_url: outputUrl,
      summary: text(raw.summary, 4000),
      error: text(raw.error, 2000),
      source: ['reported', 'manual', 'openclaw'].includes(raw.source) ? raw.source : 'manual',
      recorded_at: toIso(raw.recorded_at) || new Date(now).toISOString(),
    };
    if (!run.finished_at && !run.started_at && !run.scheduled_for) run.finished_at = run.recorded_at;
    return run;
  }

  function runTime(run) {
    return Date.parse(run.finished_at || run.started_at || run.scheduled_for || run.recorded_at) || 0;
  }

  // -- OpenClaw ---------------------------------------------------------------

  function scheduleFromOpenClaw(job) {
    const schedule = job.schedule || {};
    const tz = isValidZone(schedule.tz) ? schedule.tz : DISPLAY_ZONE;
    try {
      if (schedule.expr && isValidCron(schedule.expr)) return normalizeSchedule({ kind: 'cron', expr: schedule.expr, timezone: tz });
      if (schedule.every_ms) {
        return normalizeSchedule({ kind: 'interval', every_ms: schedule.every_ms, timezone: tz, anchor: job.last_run_at_ms || '' });
      }
      if (schedule.at && Number.isFinite(Date.parse(schedule.at))) return normalizeSchedule({ kind: 'once', at: schedule.at, timezone: tz });
    } catch {}
    return {
      kind: 'provider', timezone: tz, expr: schedule.expr || '', every_ms: null, anchor: '', at: '', starts_at: '',
      text: [schedule.kind, schedule.expr || schedule.at].filter(Boolean).join(' ') || 'OpenClaw schedule', flexible: false,
    };
  }

  // The cron inventory the desktop relay reports (or the snapshot kept from
  // its last report), laid over any stored record for the same job. The
  // provider owns the schedule, enabled state and run times; the stored record
  // keeps only Jason's annotations (purpose, delivery, category).
  function mergeOpenClaw(records, snapshot) {
    const jobs = snapshot && Array.isArray(snapshot.jobs) ? snapshot.jobs : [];
    const byProviderId = new Map(records.filter(r => r.provider === 'openclaw' && r.provider_id).map(r => [r.provider_id, r]));
    const reported = new Set();
    const views = [];
    const liveRuns = [];
    for (const job of jobs) {
      if (!job || !job.id) continue;
      reported.add(job.id);
      const record = byProviderId.get(job.id) || null;
      const id = record ? record.id : `openclaw:${job.id}`;
      const name = job.name || (record && record.name) || job.id;
      const purpose = (record && record.purpose) || job.description || '';
      views.push({
        id,
        provider: 'openclaw',
        provider_id: job.id,
        name,
        purpose,
        agent: job.agent_id || (record && record.agent) || '',
        delivery: (record && record.delivery) || '',
        category: (record && record.category) || inferCategory(name, purpose),
        schedule: scheduleFromOpenClaw(job),
        enabled: job.enabled !== false,
        prompt: (record && record.prompt) || '',
        source: 'live',
        source_label: job.internal_name && job.internal_name !== name ? `OpenClaw job "${job.internal_name}"` : 'OpenClaw cron inventory',
        synced_at: snapshot.updated_at || '',
        live_fresh: Boolean(snapshot.fresh),
        provider_next_run_at: Number(job.next_run_at_ms) || null,
        has_record: Boolean(record),
        archive_id: (record && record.archive_id) || '',
        created_at: (record && record.created_at) || '',
        updated_at: (record && record.updated_at) || '',
      });
      if (job.last_run_at_ms) {
        liveRuns.push({
          id: `openclaw-last:${job.id}:${job.last_run_at_ms}`,
          workflow_id: id,
          scheduled_for: '',
          started_at: '',
          finished_at: new Date(job.last_run_at_ms).toISOString(),
          execution_status: executionState(job.last_run_status),
          delivery_status: 'unknown',
          output_title: '',
          output_url: '',
          summary: '',
          error: job.last_run_error || '',
          source: 'openclaw',
          recorded_at: snapshot.updated_at || '',
        });
      }
    }
    // Stored OpenClaw records the relay has not (or not yet) reported stay
    // visible as imported data rather than vanishing.
    const unreported = records.filter(r => !(r.provider === 'openclaw' && r.provider_id && reported.has(r.provider_id)))
      .map(r => ({ ...r, not_reported: r.provider === 'openclaw' && jobs.length > 0 }));
    return { views: [...views, ...unreported], liveRuns };
  }

  // -- health -----------------------------------------------------------------

  // What the dashboard can honestly say about a workflow. "unknown" covers
  // every case without evidence: no runs recorded, or a run with no status.
  function workflowHealth(view, latestRun) {
    if (!view.enabled) return 'disabled';
    if (latestRun && latestRun.execution_status === 'failed') return 'failed';
    if (latestRun && latestRun.delivery_status === 'failed') return 'delivery_failed';
    if (view.source === 'live' && !view.live_fresh) return 'stale';
    if (latestRun && latestRun.execution_status === 'running') return 'running';
    if (latestRun && latestRun.execution_status === 'succeeded') {
      return latestRun.delivery_status === 'delivered' ? 'delivered' : 'succeeded';
    }
    return 'unknown';
  }

  // Overlap is flagged, never acted on: same provider, same audit category,
  // more than one workflow. Jason decides what (if anything) to consolidate.
  function detectOverlaps(views, acknowledged) {
    const ack = new Set(acknowledged || []);
    const groups = new Map();
    for (const view of views) {
      if (view.category !== 'audit') continue;
      const key = `${view.provider}:audit`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(view);
    }
    const flags = [];
    for (const [key, members] of groups) {
      if (members.length < 2) continue;
      const ids = members.map(m => m.id).sort();
      const signature = `${key}:${ids.join('|')}`;
      flags.push({
        key: signature,
        provider: members[0].provider,
        category: 'audit',
        workflow_ids: ids,
        names: members.map(m => m.name),
        acknowledged: ack.has(signature),
      });
    }
    return flags;
  }

  function buildDashboard({ records = [], runs = [], snapshot = null, acknowledged = [], now = Date.now() } = {}) {
    const { views, liveRuns } = mergeOpenClaw(records, snapshot);
    const viewById = new Map(views.map(v => [v.id, v]));
    // A run recorded against a live job before it had a stored record carries
    // the id "openclaw:<job id>"; it still belongs to that job afterwards.
    const byLiveId = new Map(views.filter(v => v.provider === 'openclaw' && v.provider_id).map(v => [`openclaw:${v.provider_id}`, v]));
    const viewFor = run => viewById.get(run.workflow_id) || byLiveId.get(run.workflow_id) || null;
    const storedKeys = new Set(runs.map(run => `${run.workflow_id}:${run.finished_at}`));
    const allRuns = [...runs, ...liveRuns.filter(run => !storedKeys.has(`${run.workflow_id}:${run.finished_at}`))]
      .sort((a, b) => runTime(b) - runTime(a));
    const latestByWorkflow = new Map();
    for (const run of allRuns) {
      const view = viewFor(run);
      if (view && !latestByWorkflow.has(view.id)) latestByWorkflow.set(view.id, run);
    }

    const workflows = views.map(view => {
      const latest = latestByWorkflow.get(view.id) || null;
      const next = nextRun(view, now);
      const described = describeSchedule(view.schedule);
      return {
        ...view,
        provider_label: PROVIDERS[view.provider] || 'Other',
        schedule_text: described.text,
        schedule_notes: described.notes,
        next_run: next,
        latest_run: latest,
        health: workflowHealth(view, latest),
      };
    });

    const openclawCount = workflows.filter(w => w.source === 'live').length;
    const sources = {
      openclaw: {
        state: !snapshot || !snapshot.updated_at ? 'not_connected' : snapshot.fresh ? 'live' : 'stale',
        updated_at: (snapshot && snapshot.updated_at) || '',
        jobs: openclawCount,
      },
      chatgpt: {
        state: 'manual',
        workflows: workflows.filter(w => w.provider === 'chatgpt').length,
        updated_at: workflows.filter(w => w.provider === 'chatgpt').map(w => w.synced_at).sort().pop() || '',
      },
    };

    const attention = [];
    if (sources.openclaw.state === 'stale' && openclawCount) {
      attention.push({
        kind: 'stale_connection', provider: 'openclaw',
        title: 'OpenClaw relay is not reporting',
        detail: `Showing the snapshot from ${sources.openclaw.updated_at}. Schedules may have changed since; this is not evidence that any job failed.`,
      });
    }
    for (const workflow of workflows) {
      if (workflow.health === 'failed') {
        attention.push({ kind: 'failed', workflow_id: workflow.id, title: `${workflow.name} failed`, detail: (workflow.latest_run && workflow.latest_run.error) || 'The latest run reported a failure.' });
      } else if (workflow.health === 'delivery_failed') {
        attention.push({ kind: 'delivery_failed', workflow_id: workflow.id, title: `${workflow.name} ran but was not delivered`, detail: (workflow.latest_run && workflow.latest_run.error) || 'The latest run reported a delivery failure.' });
      }
    }

    const upcoming = workflows.filter(w => w.enabled && w.next_run.at)
      .sort((a, b) => a.next_run.at - b.next_run.at)
      .map(w => w.id);
    const unscheduled = workflows.filter(w => w.enabled && !w.next_run.at).map(w => w.id);
    const results = allRuns.filter(run => run.output_url || run.output_title || run.summary || run.execution_status !== 'unknown')
      .slice(0, 30)
      .map(run => {
        const view = viewFor(run);
        return { ...run, workflow_id: view ? view.id : run.workflow_id, workflow_name: view ? view.name : 'Removed workflow' };
      });

    return {
      generated_at: new Date(now).toISOString(),
      display_zone: DISPLAY_ZONE,
      workflows,
      upcoming,
      unscheduled,
      results,
      attention,
      overlaps: detectOverlaps(workflows, acknowledged),
      sources,
    };
  }

  // -- import -----------------------------------------------------------------

  // OpenClaw's own job shape (`openclaw cron list --json`, or the relay's
  // summary) rather than a Mission Control record: an `id` and a schedule in
  // OpenClaw's terms, no `provider_id` and no `timezone`.
  function looksLikeOpenClawJob(item, provider) {
    if (!item || typeof item !== 'object' || !item.id || 'provider_id' in item) return false;
    const schedule = item.schedule;
    if (!schedule || typeof schedule !== 'object' || 'timezone' in schedule) return false;
    if (provider === 'openclaw') return true;
    return Boolean(item.state || 'nextRunAtMs' in item || 'agentId' in item || 'displayName' in item ||
      'tz' in schedule || 'everyMs' in schedule || ['every', 'at'].includes(schedule.kind));
  }

  function fromOpenClawJob(item, provider) {
    const state = item.state && typeof item.state === 'object' ? item.state : {};
    const schedule = item.schedule || {};
    const job = {
      id: item.id,
      name: item.displayName || item.name,
      internal_name: item.name,
      description: item.description,
      agent_id: item.agentId || (item.owner && item.owner.agentId) || item.agent_id,
      enabled: item.enabled !== false,
      schedule: { kind: schedule.kind, expr: schedule.expr, tz: schedule.tz, every_ms: schedule.everyMs || schedule.every_ms, at: schedule.at },
      next_run_at_ms: Number(item.nextRunAtMs || state.nextRunAtMs || item.next_run_at_ms) || null,
      last_run_at_ms: Number(item.lastRunAtMs || state.lastRunAtMs || item.last_run_at_ms) || null,
    };
    return {
      provider: provider || 'openclaw',
      provider_id: job.id,
      name: job.name,
      purpose: job.description,
      agent: job.agent_id,
      enabled: job.enabled,
      schedule: scheduleFromOpenClaw(job),
      provider_next_run_at: job.next_run_at_ms,
      prompt: text(item.payload && (item.payload.message || item.payload.text || item.payload.prompt), 20000),
    };
  }

  const CRON_TOKEN = /^(?:\*|\?|[0-9A-Za-z]+(?:-[0-9A-Za-z]+)?)(?:\/\d+)?(?:,(?:\*|[0-9A-Za-z]+(?:-[0-9A-Za-z]+)?)(?:\/\d+)?)*$/;

  function findCron(block) {
    const quoted = [...block.matchAll(/`([^`\n]+)`/g)].map(m => m[1].trim());
    for (const candidate of quoted) if (candidate.split(/\s+/).length === 5 && isValidCron(candidate)) return candidate;
    const macro = /(^|\s)(@(?:yearly|annually|monthly|weekly|daily|midnight|hourly))\b/i.exec(block);
    if (macro) return macro[2].toLowerCase();
    for (const line of block.split('\n')) {
      const tokens = line.replace(/[`"'()[\]]/g, ' ').split(/\s+/).filter(Boolean);
      for (let i = 0; i + 5 <= tokens.length; i++) {
        const window = tokens.slice(i, i + 5);
        if (!window.every(t => CRON_TOKEN.test(t))) continue;
        if (!/\d|\*/.test(window[0]) || !/\d|\*/.test(window[1])) continue;
        const candidate = window.join(' ');
        if (isValidCron(candidate)) return candidate;
      }
    }
    return '';
  }

  const SCHEDULE_WORDS = /\b(daily|weekly|monthly|yearly|annually|every|each|weekdays?|weekends?|hourly|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?|\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.))\b/i;

  // One block of a pasted inventory → a draft record. Only what is plainly
  // there is taken: a cron expression that parses, a zone that exists, an id
  // labelled as an id. Everything else stays in the block text, which is kept
  // whole as the record's prompt/details. The panel previews every draft
  // before anything is saved.
  function draftFromBlock(block, provider) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    // Bold, code and heading marks go; a lone "*" stays, because it is half
    // of every cron expression.
    const strip = line => line.replace(/^(?:[-*•]|\d+[.)])\s+/, '').replace(/\*\*|__|`|^#+\s*/g, '').trim();
    const heading = strip(lines[0] || '');
    // "Daily reflection: every day at 9 PM" is a name and a schedule on one
    // line; "Morning brief — cron `0 8 * * *`" likewise.
    const split = /^(.+?)(?:\s+[—–|]\s+|:\s+)(.+)$/.exec(heading);
    const headingSchedule = split && (SCHEDULE_WORDS.test(split[2]) || findCron(split[2])) ? split[2] : '';
    const name = text((headingSchedule ? split[1] : heading).replace(/\s*\((?:disabled|paused|enabled|active|inactive)\)\s*$/i, ''), 180);
    const idMatch = /\b(?:job\s*id|automation\s*id|task\s*id|id)\s*[:=]\s*`?([A-Za-z0-9][\w.:-]{2,})`?/i.exec(block) ||
      /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i.exec(block);
    const zoneMatch = /\b((?:America|Europe|Asia|Africa|Australia|Pacific|Atlantic|Indian|Antarctica)\/[A-Za-z_]+(?:\/[A-Za-z_]+)?|UTC|Etc\/UTC)\b/.exec(block);
    const timezone = zoneMatch && isValidZone(zoneMatch[1]) ? zoneMatch[1] : DISPLAY_ZONE;
    const disabled = /\b(disabled|paused|inactive|turned off)\b|enabled\s*[:=]\s*(false|no)\b|\bstatus\s*[:=]\s*(off|disabled|paused)\b/i.test(block);
    const agentMatch = /\bagent\s*(?:id)?\s*[:=]\s*`?([\w-]{2,})`?/i.exec(block);
    const deliveryMatch = /\b(?:deliver(?:y|s|ed)?(?:\s+to)?|sends?\s+to|destination)\s*[:=]?\s*([^\n.;]{3,120})/i.exec(block);
    const cron = findCron(block);
    const everyMatch = /\bevery\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\b/i.exec(block);
    let schedule;
    if (cron) schedule = { kind: 'cron', expr: cron, timezone };
    else if (everyMatch && provider === 'openclaw') {
      const unit = everyMatch[2].toLowerCase();
      const factor = unit.startsWith('d') ? 86400000 : unit.startsWith('h') ? 3600000 : 60000;
      schedule = { kind: 'interval', every_ms: Number(everyMatch[1]) * factor, timezone };
    } else {
      const line = headingSchedule || lines.slice(1).map(strip).find(l => SCHEDULE_WORDS.test(l)) || (SCHEDULE_WORDS.test(heading) ? heading : '');
      schedule = { kind: 'provider', text: text(line, 300) || 'Schedule not stated in the inventory', timezone, flexible: provider === 'chatgpt' };
    }
    return {
      provider,
      provider_id: idMatch ? idMatch[1] : '',
      name: name || 'Unnamed workflow',
      purpose: text(lines.slice(1).map(strip).find(l => !SCHEDULE_WORDS.test(l) && l.length > 12) || '', 1000),
      agent: agentMatch ? agentMatch[1] : '',
      delivery: deliveryMatch ? text(deliveryMatch[1], 300) : '',
      enabled: !disabled,
      schedule,
      prompt: text(block, 20000),
    };
  }

  function splitBlocks(input) {
    const normalized = String(input).replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');
    const blocks = [];
    let current = [];
    const flush = () => { if (current.join('').trim()) blocks.push(current.join('\n').trim()); current = []; };
    const topLevelItem = /^(?:[-*•]|\d+[.)]|#{1,6})\s+\S/;
    for (const line of lines) {
      if (!line.trim()) { flush(); continue; }
      if (topLevelItem.test(line) && current.length) flush();
      current.push(line);
    }
    flush();
    // A heading line on its own ("OpenClaw cron jobs (17)") is a title for the
    // list, not a workflow.
    return blocks.filter(block => block.split('\n').length > 1 || findCron(block) || SCHEDULE_WORDS.test(block));
  }

  // Inventory text or JSON → draft records. Nothing here is saved; the server
  // dedupes and stores only what the panel confirms.
  function parseImport(input, { provider = 'other' } = {}) {
    const key = PROVIDERS[provider] ? provider : providerKey(provider);
    const raw = String(input || '').trim();
    const drafts = [];
    const errors = [];
    if (!raw) return { format: 'empty', drafts, errors: ['Paste an inventory to import.'] };
    let parsed;
    if (/^[[{]/.test(raw)) {
      try { parsed = JSON.parse(raw); } catch (error) { errors.push(`JSON could not be read: ${error.message}`); }
    }
    if (parsed !== undefined) {
      const items = Array.isArray(parsed) ? parsed
        : Array.isArray(parsed.jobs) ? parsed.jobs
          : Array.isArray(parsed.workflows) ? parsed.workflows
            : Array.isArray(parsed.automations) ? parsed.automations
              : Array.isArray(parsed.tasks) ? parsed.tasks : [parsed];
      items.forEach((item, index) => {
        try {
          const draft = looksLikeOpenClawJob(item, key) ? fromOpenClawJob(item, key === 'other' ? 'openclaw' : key) : { ...item, provider: item.provider || key };
          drafts.push(normalizeWorkflow({ ...draft, source: 'imported' }));
        } catch (error) {
          errors.push(`Item ${index + 1}: ${error.message}`);
        }
      });
      return { format: 'json', drafts, errors };
    }
    splitBlocks(raw).forEach((block, index) => {
      try { drafts.push(normalizeWorkflow({ ...draftFromBlock(block, key), source: 'imported' })); } catch (error) {
        errors.push(`Block ${index + 1}: ${error.message}`);
      }
    });
    if (!drafts.length && !errors.length) errors.push('No workflows were recognised. Put each workflow on its own line or block.');
    return { format: 'text', drafts, errors };
  }

  // Imported drafts laid onto the stored records, deduplicated by provider and
  // provider id (or by name when an inventory gives no id). Nothing missing
  // from an import is removed: a partial paste never deletes a workflow.
  function mergeImport(existing, drafts, { now = Date.now(), newId, sourceLabel = '', archiveId = '' } = {}) {
    const records = existing.map(record => ({ ...record }));
    const index = new Map(records.map((record, i) => [dedupeKey(record), i]));
    const summary = { created: 0, updated: 0, unchanged: 0 };
    const nowIso = new Date(now).toISOString();
    const comparable = record => JSON.stringify([record.name, record.purpose, record.agent, record.delivery, record.schedule, record.enabled, record.prompt, record.provider_next_run_at]);
    for (const draft of drafts) {
      const key = dedupeKey(draft);
      if (index.has(key)) {
        const at = index.get(key);
        const current = records[at];
        const next = {
          ...current,
          name: draft.name,
          purpose: draft.purpose || current.purpose,
          agent: draft.agent || current.agent,
          delivery: draft.delivery || current.delivery,
          schedule: draft.schedule,
          enabled: draft.enabled,
          prompt: draft.prompt || current.prompt,
          provider_next_run_at: draft.provider_next_run_at,
          synced_at: nowIso,
        };
        if (comparable(next) === comparable(current)) { summary.unchanged++; records[at] = { ...current, synced_at: nowIso }; continue; }
        records[at] = { ...next, updated_at: nowIso };
        summary.updated++;
      } else {
        records.push({
          ...draft, id: newId(), source: 'imported',
          source_label: sourceLabel || draft.source_label, archive_id: archiveId || draft.archive_id,
          synced_at: nowIso, created_at: nowIso, updated_at: nowIso,
        });
        index.set(key, records.length - 1);
        summary.created++;
      }
    }
    return { records, summary };
  }

  // The manual tracker Mission Control had before workflows: once/daily/
  // weekly/monthly at a local time. Each becomes an exact schedule.
  function fromLegacySchedule(item) {
    const zone = isValidZone(item.timezone) ? item.timezone : DISPLAY_ZONE;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(item.start || '');
    if (!match) throw new Error(`"${item.title}" has no valid start time.`);
    const [, , , d, h, mi] = match.map(Number);
    const startsAt = localToInstant(item.start, zone);
    let schedule;
    if (item.repeat === 'once') schedule = { kind: 'once', at: item.start, timezone: zone };
    else if (item.repeat === 'daily') schedule = { kind: 'cron', expr: `${mi} ${h} * * *`, timezone: zone };
    else if (item.repeat === 'weekly') {
      const weekday = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, d)).getUTCDay();
      schedule = { kind: 'cron', expr: `${mi} ${h} * * ${weekday}`, timezone: zone };
    } else if (item.repeat === 'monthly') schedule = { kind: 'cron', expr: `${mi} ${h} ${d} * *`, timezone: zone };
    else throw new Error(`"${item.title}" has an unknown repeat.`);
    if (schedule.kind === 'cron' && startsAt) schedule.starts_at = new Date(startsAt).toISOString();
    return {
      provider: providerKey(item.source),
      name: item.title,
      purpose: '',
      schedule,
      enabled: true,
      prompt: item.notes || '',
      source: 'manual',
      source_label: 'Tracked in the earlier Mission Control schedule list',
    };
  }

  // -- display ----------------------------------------------------------------

  function formatInZone(ms, zone = DISPLAY_ZONE) {
    if (!Number.isFinite(ms)) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    }).format(ms);
  }

  function relative(ms, now = Date.now()) {
    if (!Number.isFinite(ms)) return '';
    const diff = ms - now;
    const abs = Math.abs(diff);
    const minutes = Math.round(abs / 60000);
    let span;
    if (minutes < 1) span = 'under a minute';
    else if (minutes < 60) span = `${minutes}m`;
    else if (minutes < 48 * 60) span = `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    else span = `${Math.round(minutes / 1440)}d`;
    return diff >= 0 ? `in ${span}` : `${span} ago`;
  }

  const api = {
    DISPLAY_ZONE, PROVIDERS, CATEGORIES, EXECUTION_STATES, DELIVERY_STATES, SCHEDULE_KINDS,
    isValidZone, wallTime, localToInstant,
    parseCron, isValidCron, nextCronRun, describeCron,
    normalizeSchedule, describeSchedule, nextRun,
    normalizeWorkflow, normalizeRun, executionState, deliveryState, dedupeKey, inferCategory, providerKey,
    mergeOpenClaw, workflowHealth, detectOverlaps, buildDashboard,
    parseImport, mergeImport, fromLegacySchedule,
    formatInZone, relative,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WorkflowDashboard = api;
})(typeof window !== 'undefined' ? window : globalThis);
