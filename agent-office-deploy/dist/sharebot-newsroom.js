'use strict';

// -- SHAREBOT67 NEWSROOM HEALTH ---------------------------------
//
// ShareBot67's newsroom runs in the Market Dashboard, not here. Agent Office
// knew nothing about it: the roster carried a scripted feed ("ShareBot67 smoke
// check passed") that reads like a status and is not one — it says the same
// thing on a morning when the newsroom failed at 4am.
//
// Market Dashboard exposes `GET /api/newsroom/health`, a read-only operational
// summary carrying identifiers, statuses, counts and its own error text — no
// credential, no prompt body, no report content. Reading it needs an
// `x-admin-key`, which is exactly why the browser cannot do this: a key in
// page JavaScript is a published key. So this module reads it from Agent
// Office's own process and hands the browser a normalized summary.
//
// Everything about the request is fixed by server configuration:
//
//   - the target comes from MARKET_DASHBOARD_URL and nothing else. No request
//     parameter picks a host, so this can never be pointed at an arbitrary
//     address by whoever loads the page;
//   - the key travels in a header, server to server, and never comes back out;
//   - redirects are not followed, so a moved endpoint cannot forward the key
//     to another origin;
//   - a deployment must use HTTPS. Plain HTTP is allowed only against
//     loopback, for a developer running both apps locally.
//
// A failure never gets to look like health. Each distinct way this can fail
// has its own state, so the panel can say what is actually wrong instead of
// showing a hopeful blank.

const HEALTH_PATH = '/api/newsroom/health';
const DEFAULT_TIMEOUT_MS = 6000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 20000;
// Health is a few kilobytes. Anything vastly larger is not the endpoint this
// is configured for, and is not worth buffering to find out.
const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_TEXT = 300;

// Every way this read can end. `ok` is the only one that carries newsroom
// state; the rest each name a different thing to fix.
const STATES = {
  OK: 'ok',
  NOT_CONFIGURED: 'not_configured',
  AUTH_ERROR: 'auth_error',
  UNREACHABLE: 'unreachable',
  INVALID_RESPONSE: 'invalid_response',
  UPSTREAM_ERROR: 'upstream_error',
};

// What the panel shows on its Health row. `idle` is deliberately not folded
// into `unavailable`: a newsroom that is reachable and has simply not run yet
// is a different fact from one that cannot be read at all.
const HEALTH = {
  HEALTHY: 'healthy',
  RUNNING: 'running',
  DEGRADED: 'degraded',
  FAILED: 'failed',
  IDLE: 'idle',
  UNAVAILABLE: 'unavailable',
};

// Market Dashboard cycle statuses, mapped to the five the panel speaks.
const STATUS_HEALTH = new Map([
  ['completed', HEALTH.HEALTHY],
  ['queued', HEALTH.RUNNING],
  ['generating', HEALTH.RUNNING],
  ['delivering', HEALTH.RUNNING],
  ['running', HEALTH.RUNNING],
  ['delivery_partial', HEALTH.DEGRADED],
  ['delivery_failed', HEALTH.FAILED],
  ['generation_failed', HEALTH.FAILED],
  ['preflight_failed', HEALTH.FAILED],
  ['idle', HEALTH.IDLE],
]);

function text(value, max = MAX_TEXT) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, max);
}

function isoOrNull(value) {
  if (!value) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

function countOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function isLoopback(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

/**
 * The configured upstream, or the reason there isn't one.
 *
 * Returns `{ ok: false, reason }` rather than throwing, because "not
 * configured" is a state the panel shows, not an error the server hits.
 */
function resolveConfig(env = process.env, { deployed = false } = {}) {
  const rawUrl = String(env.MARKET_DASHBOARD_URL || '').trim();
  const key = String(env.MARKET_DASHBOARD_ADMIN_API_KEY || '').trim();

  if (!rawUrl && !key) {
    return {
      ok: false,
      reason: 'Set MARKET_DASHBOARD_URL and MARKET_DASHBOARD_ADMIN_API_KEY on this server to show live newsroom health.',
    };
  }
  if (!rawUrl) return { ok: false, reason: 'Set MARKET_DASHBOARD_URL on this server.' };
  if (!key) return { ok: false, reason: 'Set MARKET_DASHBOARD_ADMIN_API_KEY on this server.' };

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'MARKET_DASHBOARD_URL is not a valid URL.' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: 'MARKET_DASHBOARD_URL must be an http or https address.' };
  }
  // Plain HTTP would put the key on the wire in clear text. Loopback is the
  // one place that cannot happen, and is where both apps run side by side
  // during development.
  if (deployed && url.protocol !== 'https:' && !isLoopback(url.hostname)) {
    return { ok: false, reason: 'MARKET_DASHBOARD_URL must use HTTPS in a deployed environment.' };
  }

  const timeout = Number(env.MARKET_DASHBOARD_TIMEOUT_MS);
  return {
    ok: true,
    // Any path on the configured URL is discarded: the endpoint is fixed here,
    // so configuration names a host, not a route.
    endpoint: `${url.origin}${HEALTH_PATH}`,
    key,
    timeoutMs: Number.isFinite(timeout)
      ? Math.min(Math.max(timeout, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS)
      : DEFAULT_TIMEOUT_MS,
  };
}

/** One cycle from the upstream payload, reduced to what the panel shows. */
function summarizeCycle(cycle) {
  if (!cycle || typeof cycle !== 'object') return null;
  return {
    id: text(cycle.id, 120) || null,
    status: text(cycle.status, 40) || null,
    scheduled_at: isoOrNull(cycle.scheduledAt),
    started_at: isoOrNull(cycle.startedAt),
    completed_at: isoOrNull(cycle.completedAt),
    sections_expected: Array.isArray(cycle.sectionsExpected) ? cycle.sectionsExpected.length : 0,
    sections_generated: countOrZero(cycle.generatedSectionCount),
    delivery_succeeded: countOrZero(cycle.deliverySucceeded),
    delivery_failed: countOrZero(cycle.deliveryFailed),
  };
}

/**
 * Turn a Market Dashboard health payload into the panel's shape.
 *
 * Deliberately a whitelist rather than a passthrough: the panel shows
 * operational state, and nothing about a report's text should be able to reach
 * a browser through here even if the upstream response grows a field for it.
 */
function normalizeHealth(payload, { now = new Date() } = {}) {
  const upstreamStatus = text(payload.status, 40) || 'idle';
  const current = summarizeCycle(payload.currentCycle);
  const lastAttempt = summarizeCycle(payload.lastAttemptedCycle);
  const lastSuccess = summarizeCycle(payload.lastSuccessfulCycle);

  const health = current ? HEALTH.RUNNING : STATUS_HEALTH.get(upstreamStatus) || HEALTH.IDLE;

  const route = payload.agentRoute && typeof payload.agentRoute === 'object' ? payload.agentRoute : null;
  const routeStatus = text(route && route.status, 20) || 'warn';
  const error = payload.lastError && typeof payload.lastError === 'object' ? payload.lastError : null;

  const generatedFrom = current || lastAttempt;
  return {
    state: STATES.OK,
    checked_at: now.toISOString(),
    available: true,
    health,
    upstream_status: upstreamStatus,
    current_cycle: current,
    last_attempt: lastAttempt,
    last_success: lastSuccess,
    next_expected_at: isoOrNull(payload.nextExpectedRunAt),
    generation: {
      generated: generatedFrom ? generatedFrom.sections_generated : 0,
      expected: generatedFrom ? generatedFrom.sections_expected : (Array.isArray(payload.sections) ? payload.sections.length : 0),
    },
    delivery: {
      succeeded: generatedFrom ? generatedFrom.delivery_succeeded : 0,
      failed: generatedFrom ? generatedFrom.delivery_failed : 0,
    },
    agent_route: {
      // pass / warn / fail, as Market Dashboard reports it. `verified` is only
      // ever true for a route that actually answered — an unconfigured check
      // is a warning, never a pass.
      status: routeStatus,
      verified: Boolean(route && route.verified),
      route: routeStatus === 'pass' ? 'verified' : routeStatus === 'fail' ? 'failed' : 'warning',
      detail: text(route && route.detail) || null,
      code: text(route && route.code, 60) || null,
    },
    latest_error: error
      ? {
          at: isoOrNull(error.at),
          phase: text(error.phase, 40) || null,
          code: text(error.code, 60) || null,
          class: text(error.class, 40) || null,
          retryable: Boolean(error.retryable),
          message: text(error.message) || null,
          reason: text(error.reason) || null,
        }
      : null,
    reporter_model: text(payload.reporter && payload.reporter.model, 80) || null,
    error: null,
  };
}

/**
 * A read that did not produce newsroom state.
 *
 * The message is written here, from the state and at most an HTTP status
 * code. No upstream body text and no request detail travels into it: an
 * upstream that echoes a rejected credential back in its error body must not
 * be able to relay it into this response.
 */
function failure(state, message, { now = new Date(), httpStatus = null } = {}) {
  return {
    state,
    checked_at: now.toISOString(),
    available: false,
    health: HEALTH.UNAVAILABLE,
    upstream_status: null,
    upstream_http_status: httpStatus,
    current_cycle: null,
    last_attempt: null,
    last_success: null,
    next_expected_at: null,
    generation: { generated: 0, expected: 0 },
    delivery: { succeeded: 0, failed: 0 },
    agent_route: { status: 'warn', verified: false, route: 'warning', detail: null, code: null },
    latest_error: null,
    reporter_model: null,
    error: message,
  };
}

/**
 * Read newsroom health from the configured Market Dashboard.
 *
 * Never throws and never returns a hopeful default: every path out of here is
 * either real upstream state or a named failure.
 */
async function readNewsroomHealth({
  env = process.env,
  deployed = false,
  fetchImpl = globalThis.fetch,
  now = new Date(),
} = {}) {
  const config = resolveConfig(env, { deployed });
  if (!config.ok) return failure(STATES.NOT_CONFIGURED, config.reason, { now });

  let response;
  try {
    response = await fetchImpl(config.endpoint, {
      method: 'GET',
      // A redirect is not followed: the key is already on this request, and
      // following a 3xx would hand it to whatever origin the redirect names.
      redirect: 'manual',
      headers: {
        'x-admin-key': config.key,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    const timedOut = error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return failure(
      STATES.UNREACHABLE,
      timedOut
        ? `Market Dashboard did not answer within ${Math.round(config.timeoutMs / 1000)}s.`
        : 'Market Dashboard could not be reached.',
      { now },
    );
  }

  if (response.status === 401 || response.status === 403) {
    return failure(
      STATES.AUTH_ERROR,
      'Market Dashboard rejected this server\'s key. Check MARKET_DASHBOARD_ADMIN_API_KEY against the dashboard\'s ADMIN_API_KEY.',
      { now, httpStatus: response.status },
    );
  }
  if (response.status >= 300 && response.status < 400) {
    return failure(
      STATES.UPSTREAM_ERROR,
      'Market Dashboard redirected the health request, which is not followed. Check MARKET_DASHBOARD_URL.',
      { now, httpStatus: response.status },
    );
  }
  if (response.status >= 500) {
    return failure(STATES.UPSTREAM_ERROR, 'Market Dashboard returned a server error.', {
      now,
      httpStatus: response.status,
    });
  }
  if (!response.ok) {
    return failure(STATES.UPSTREAM_ERROR, 'Market Dashboard did not return newsroom health.', {
      now,
      httpStatus: response.status,
    });
  }

  let payload;
  try {
    const raw = await response.text();
    if (raw.length > MAX_RESPONSE_BYTES) {
      return failure(STATES.INVALID_RESPONSE, 'Market Dashboard returned an unexpectedly large response.', {
        now,
        httpStatus: response.status,
      });
    }
    payload = JSON.parse(raw);
  } catch {
    return failure(STATES.INVALID_RESPONSE, 'Market Dashboard returned a response that is not newsroom health JSON.', {
      now,
      httpStatus: response.status,
    });
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !('status' in payload)) {
    return failure(STATES.INVALID_RESPONSE, 'Market Dashboard returned a response that is not newsroom health JSON.', {
      now,
      httpStatus: response.status,
    });
  }

  return normalizeHealth(payload, { now });
}

module.exports = {
  readNewsroomHealth,
  resolveConfig,
  normalizeHealth,
  HEALTH_PATH,
  STATES,
  HEALTH,
};
