const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { createGoogleSync, syncWindow, isSyncTokenExpired } = require(
  path.resolve(__dirname, '..', 'agent-office-deploy', 'dist', 'calendar-google-sync.js')
);

const DAY = 24 * 60 * 60 * 1000;

function event(id, startIso, extra = {}) {
  return {
    id,
    summary: id,
    start: { dateTime: startIso },
    end: { dateTime: new Date(new Date(startIso).getTime() + 3600000).toISOString() },
    ...extra,
  };
}

function cancelled(id) {
  return { id, status: 'cancelled' };
}

function googleError(statusCode, message = 'Google says no') {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * A scripted stand-in for the Google events endpoint. Each queued response is
 * returned in order; every request is recorded so a test can assert what was
 * actually asked for (syncToken vs timeMin, pageToken, and so on).
 */
function fakeGoogle(responses) {
  const calls = [];
  const queue = responses.slice();
  const request = async requestPath => {
    const params = new URL(`http://x${requestPath}`).searchParams;
    calls.push({
      path: requestPath,
      syncToken: params.get('syncToken'),
      pageToken: params.get('pageToken'),
      timeMin: params.get('timeMin'),
      timeMax: params.get('timeMax'),
      orderBy: params.get('orderBy'),
    });
    if (!queue.length) throw new Error(`Unexpected extra Google request: ${requestPath}`);
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next() : next;
  };
  return { request, calls, get remaining() { return queue.length; } };
}

test('the first call is a full sync over the window and keeps the sync token', async () => {
  const google = fakeGoogle([
    { items: [event('b', '2026-08-02T10:00:00Z'), event('a', '2026-08-01T09:00:00Z')], nextSyncToken: 'tok-1' },
  ]);
  const sync = createGoogleSync({ request: google.request, now: () => Date.parse('2026-07-27T12:00:00Z') });

  const items = await sync.list();

  assert.deepEqual(items.map(item => item.id), ['a', 'b'], 'results come back ordered by start time');
  assert.equal(sync.syncToken, 'tok-1');
  assert.equal(google.calls.length, 1);

  const call = google.calls[0];
  assert.equal(call.syncToken, null, 'a full sync must not send a syncToken');
  assert.ok(call.timeMin && call.timeMax, 'a full sync bounds the window');
  assert.equal(call.orderBy, 'startTime');
});

test('the second call sends the sync token and merges only what changed', async () => {
  const google = fakeGoogle([
    { items: [event('a', '2026-08-01T09:00:00Z'), event('b', '2026-08-02T10:00:00Z')], nextSyncToken: 'tok-1' },
    // Only the delta: 'a' moved, 'c' is new. 'b' is not mentioned at all.
    {
      items: [event('a', '2026-08-01T15:00:00Z'), event('c', '2026-08-03T11:00:00Z')],
      nextSyncToken: 'tok-2',
    },
  ]);
  const sync = createGoogleSync({ request: google.request, now: () => Date.parse('2026-07-27T12:00:00Z') });

  await sync.list();
  const items = await sync.list();

  assert.equal(google.calls[1].syncToken, 'tok-1', 'the stored token is sent back');
  assert.equal(google.calls[1].timeMin, null, 'a token request must not also bound the window');
  assert.equal(sync.syncToken, 'tok-2', 'the token rolls forward');

  assert.deepEqual(items.map(item => item.id), ['a', 'b', 'c']);
  // An event nobody mentioned survives untouched; the one that changed is updated.
  assert.equal(items.find(item => item.id === 'a').start.dateTime, '2026-08-01T15:00:00Z');
  assert.equal(items.find(item => item.id === 'b').start.dateTime, '2026-08-02T10:00:00Z');
});

test('a cancelled event in an incremental page is removed from the cache', async () => {
  const google = fakeGoogle([
    { items: [event('a', '2026-08-01T09:00:00Z'), event('b', '2026-08-02T10:00:00Z')], nextSyncToken: 'tok-1' },
    { items: [cancelled('a')], nextSyncToken: 'tok-2' },
  ]);
  const sync = createGoogleSync({ request: google.request, now: () => Date.parse('2026-07-27T12:00:00Z') });

  await sync.list();
  const items = await sync.list();

  assert.deepEqual(items.map(item => item.id), ['b'], 'a deletion in Google is a deletion here');
  assert.equal(sync.size, 1);
});

test('an event stripped of its times is treated as a removal, not a crash', async () => {
  const google = fakeGoogle([
    { items: [event('a', '2026-08-01T09:00:00Z')], nextSyncToken: 'tok-1' },
    { items: [{ id: 'a', summary: 'a', status: 'confirmed' }], nextSyncToken: 'tok-2' },
  ]);
  const sync = createGoogleSync({ request: google.request, now: () => Date.parse('2026-07-27T12:00:00Z') });

  await sync.list();
  assert.deepEqual((await sync.list()).map(item => item.id), []);
});

test('an expired sync token triggers a full resync instead of failing the request', async () => {
  const google = fakeGoogle([
    { items: [event('a', '2026-08-01T09:00:00Z'), event('stale', '2026-08-05T09:00:00Z')], nextSyncToken: 'tok-1' },
    googleError(410, 'Sync token is no longer valid'),
    { items: [event('a', '2026-08-01T09:00:00Z')], nextSyncToken: 'tok-fresh' },
  ]);
  const sync = createGoogleSync({ request: google.request, now: () => Date.parse('2026-07-27T12:00:00Z') });

  await sync.list();
  const items = await sync.list();

  assert.equal(google.calls.length, 3);
  assert.equal(google.calls[1].syncToken, 'tok-1', 'the doomed incremental attempt happened first');
  assert.equal(google.calls[2].syncToken, null, 'recovery is a full sync');
  assert.ok(google.calls[2].timeMin, 'the full resync bounds the window again');

  // The cache Google described is no longer trustworthy, so the event that is
  // absent from the fresh full sync must be gone rather than lingering.
  assert.deepEqual(items.map(item => item.id), ['a']);
  assert.equal(sync.syncToken, 'tok-fresh');
});

test('a non-410 error propagates and leaves the cached token intact', async () => {
  const google = fakeGoogle([
    { items: [event('a', '2026-08-01T09:00:00Z')], nextSyncToken: 'tok-1' },
    googleError(503, 'Backend error'),
  ]);
  const sync = createGoogleSync({ request: google.request, now: () => Date.parse('2026-07-27T12:00:00Z') });

  await sync.list();
  await assert.rejects(() => sync.list(), /Backend error/);

  // A transient Google outage must not throw away a token that is still good.
  assert.equal(sync.syncToken, 'tok-1');
  assert.equal(sync.size, 1);
});

test('a paginated full sync follows nextPageToken and takes the token from the last page', async () => {
  const google = fakeGoogle([
    { items: [event('a', '2026-08-01T09:00:00Z')], nextPageToken: 'page-2' },
    { items: [event('b', '2026-08-02T09:00:00Z')], nextPageToken: 'page-3' },
    { items: [event('c', '2026-08-03T09:00:00Z')], nextSyncToken: 'tok-final' },
  ]);
  const sync = createGoogleSync({ request: google.request, now: () => Date.parse('2026-07-27T12:00:00Z') });

  const items = await sync.list();

  assert.equal(google.calls.length, 3);
  assert.equal(google.calls[0].pageToken, null);
  assert.equal(google.calls[1].pageToken, 'page-2');
  assert.equal(google.calls[2].pageToken, 'page-3');
  assert.deepEqual(items.map(item => item.id), ['a', 'b', 'c'], 'every page lands in the cache');
  assert.equal(sync.syncToken, 'tok-final');
});

test('a full sync that yields no token forces the next call to sync fully again', async () => {
  const google = fakeGoogle([
    { items: [event('a', '2026-08-01T09:00:00Z')] },
    { items: [event('a', '2026-08-01T09:00:00Z')], nextSyncToken: 'tok-1' },
  ]);
  const sync = createGoogleSync({ request: google.request, now: () => Date.parse('2026-07-27T12:00:00Z') });

  await sync.list();
  assert.equal(sync.syncToken, null, 'no token means no incremental sync is possible');

  await sync.list();
  assert.equal(google.calls[1].syncToken, null, 'so the next call is another full sync');
  assert.ok(google.calls[1].timeMin);
});

test('an incremental page without a new token keeps the one already held', async () => {
  const google = fakeGoogle([
    { items: [event('a', '2026-08-01T09:00:00Z')], nextSyncToken: 'tok-1' },
    { items: [] },
    { items: [] },
  ]);
  const sync = createGoogleSync({ request: google.request, now: () => Date.parse('2026-07-27T12:00:00Z') });

  await sync.list();
  await sync.list();
  assert.equal(sync.syncToken, 'tok-1', '"nothing changed" must not clear the token');

  await sync.list();
  assert.equal(google.calls[2].syncToken, 'tok-1');
});

test('force bypasses the token and rebuilds the cache from scratch', async () => {
  const google = fakeGoogle([
    { items: [event('a', '2026-08-01T09:00:00Z'), event('b', '2026-08-02T09:00:00Z')], nextSyncToken: 'tok-1' },
    { items: [event('a', '2026-08-01T09:00:00Z')], nextSyncToken: 'tok-2' },
  ]);
  const sync = createGoogleSync({ request: google.request, now: () => Date.parse('2026-07-27T12:00:00Z') });

  await sync.list();
  const items = await sync.list({ force: true });

  assert.equal(google.calls[1].syncToken, null, 'a forced refresh ignores the token');
  assert.ok(google.calls[1].timeMin);
  assert.deepEqual(items.map(item => item.id), ['a'], 'the cache is rebuilt, not merged into');
});

test('the sync window moving to a new day invalidates the token', async () => {
  let clock = Date.parse('2026-07-27T12:00:00Z');
  const google = fakeGoogle([
    { items: [event('a', '2026-08-01T09:00:00Z')], nextSyncToken: 'tok-1' },
    { items: [event('a', '2026-08-01T09:00:00Z')], nextSyncToken: 'tok-2' },
  ]);
  const sync = createGoogleSync({ request: google.request, now: () => clock });

  await sync.list();
  // Same day, a few hours later: the window key is unchanged, so the token holds.
  clock += 6 * 60 * 60 * 1000;
  assert.equal(syncWindow(clock).key, syncWindow(Date.parse('2026-07-27T12:00:00Z')).key);

  clock += 2 * DAY;
  await sync.list();
  assert.equal(google.calls[1].syncToken, null, 'a shifted window cannot reuse the old token');
});

test('a same-day refresh reuses the token rather than re-fetching thirteen months', async () => {
  let clock = Date.parse('2026-07-27T08:00:00Z');
  const google = fakeGoogle([
    { items: [event('a', '2026-08-01T09:00:00Z')], nextSyncToken: 'tok-1' },
    { items: [], nextSyncToken: 'tok-2' },
  ]);
  const sync = createGoogleSync({ request: google.request, now: () => clock });

  await sync.list();
  clock += 4 * 60 * 60 * 1000;
  await sync.list();

  assert.equal(google.calls[1].syncToken, 'tok-1', 'this is the whole point of the token');
  assert.equal(google.calls[1].timeMin, null);
});

test('reset clears the cache so the next call starts over', async () => {
  const google = fakeGoogle([
    { items: [event('a', '2026-08-01T09:00:00Z')], nextSyncToken: 'tok-1' },
    { items: [event('b', '2026-08-02T09:00:00Z')], nextSyncToken: 'tok-2' },
  ]);
  const sync = createGoogleSync({ request: google.request, now: () => Date.parse('2026-07-27T12:00:00Z') });

  await sync.list();
  sync.reset();

  assert.equal(sync.syncToken, null);
  assert.equal(sync.size, 0);
  assert.equal(sync.lastSyncedAt, null);

  const items = await sync.list();
  assert.equal(google.calls[1].syncToken, null, 'after a disconnect the next sync is full');
  assert.deepEqual(items.map(item => item.id), ['b']);
});

test('local writes keep the cache coherent without waiting for a sync', async () => {
  const google = fakeGoogle([
    { items: [event('a', '2026-08-01T09:00:00Z')], nextSyncToken: 'tok-1' },
  ]);
  const sync = createGoogleSync({ request: google.request, now: () => Date.parse('2026-07-27T12:00:00Z') });

  await sync.list();

  sync.upsert(event('new', '2026-08-04T09:00:00Z'));
  assert.deepEqual(sync.snapshot().map(item => item.id), ['a', 'new']);

  sync.upsert(event('a', '2026-08-09T09:00:00Z'));
  assert.equal(sync.snapshot().find(item => item.id === 'a').start.dateTime, '2026-08-09T09:00:00Z');
  assert.deepEqual(sync.snapshot().map(item => item.id), ['new', 'a'], 'the re-sort follows the edit');

  sync.remove('new');
  assert.deepEqual(sync.snapshot().map(item => item.id), ['a']);

  // Guards, so a bad id cannot quietly poison the cache.
  sync.upsert(null);
  sync.upsert({ summary: 'no id' });
  sync.remove('');
  assert.equal(sync.size, 1);
});

test('lastSyncedAt advances on every successful sync and not on a failed one', async () => {
  let clock = Date.parse('2026-07-27T08:00:00Z');
  const google = fakeGoogle([
    { items: [event('a', '2026-08-01T09:00:00Z')], nextSyncToken: 'tok-1' },
    googleError(503, 'Backend error'),
  ]);
  const sync = createGoogleSync({ request: google.request, now: () => clock });

  await sync.list();
  const first = sync.lastSyncedAt;
  assert.equal(first, '2026-07-27T08:00:00.000Z');

  clock += 60000;
  await assert.rejects(() => sync.list());
  assert.equal(sync.lastSyncedAt, first, 'a failed sync must not claim to have synced');
});

test('empty and malformed Google responses are survivable', async () => {
  const google = fakeGoogle([
    {},
    { items: null, nextSyncToken: 'tok-1' },
    { items: [event('a', '2026-08-01T09:00:00Z'), null, { summary: 'no id' }], nextSyncToken: 'tok-2' },
  ]);
  const sync = createGoogleSync({ request: google.request, now: () => Date.parse('2026-07-27T12:00:00Z') });

  assert.deepEqual(await sync.list(), []);
  assert.deepEqual(await sync.list(), []);
  assert.deepEqual((await sync.list()).map(item => item.id), ['a'], 'junk entries are skipped, not fatal');
});

test('isSyncTokenExpired only matches 410, whichever field carries the status', () => {
  assert.equal(isSyncTokenExpired(googleError(410)), true);
  assert.equal(isSyncTokenExpired(Object.assign(new Error('x'), { status: 410 })), true);
  assert.equal(isSyncTokenExpired(googleError(404)), false);
  assert.equal(isSyncTokenExpired(googleError(401)), false);
  assert.equal(isSyncTokenExpired(new Error('no status')), false);
  assert.equal(isSyncTokenExpired(null), false);
});

test('the sync window spans a month back and a year forward', () => {
  const window = syncWindow(Date.parse('2026-07-27T12:00:00Z'));
  assert.equal(window.timeMin, '2026-06-27T12:00:00.000Z');
  assert.equal(window.timeMax, '2027-07-27T12:00:00.000Z');
  assert.equal(window.key, '2026-06-27..2027-07-27');
});
