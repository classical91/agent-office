'use strict';

// How the Countdown Timers page reconciles its own copy of the timers with the
// one on the server.
//
// The old sync handed the remote array straight to the page, which meant an
// edit made offline was lost the next time the page loaded and a timer deleted
// on the phone came back. These pin down the replacement: newest wins per
// record, both sides keep what only they have, and a deletion is a record in
// its own right rather than an absence.
//
// resets.js is browser code, so it is evaluated the same way
// resets-happy-hour.test.js does it: in a VM with a window to hang itself off.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'agent-office-deploy', 'dist', 'resets.js'),
  'utf8'
);
const context = { window: {}, Date, console, setInterval, clearInterval };
vm.runInNewContext(source, context);
const { mergeCardLists, normalizeCard } = context.window.AOResets;

function at(minutesAgo) {
  return new Date(Date.now() - minutesAgo * 60000).toISOString();
}

function card(fields) {
  return normalizeCard({
    id: 'timer-1',
    title: 'Claude Usage Reset',
    resetAt: new Date(Date.now() + 3600000).toISOString(),
    status: 'active',
    ...fields,
  }, 0);
}

function byId(cards) {
  return new Map(cards.map(item => [item.id, item]));
}

test('the newer edit wins, whichever side made it', () => {
  const base = { id: 'timer-1', resetAt: '2026-09-01T09:00:00.000Z' };

  const localNewer = mergeCardLists(
    [card({ ...base, title: 'Renamed here', updatedAt: at(1) })],
    [card({ ...base, title: 'Stale on the server', updatedAt: at(60) })]
  );
  assert.equal(localNewer.length, 1);
  assert.equal(localNewer[0].title, 'Renamed here');

  const remoteNewer = mergeCardLists(
    [card({ ...base, title: 'Stale in this browser', updatedAt: at(60) })],
    [card({ ...base, title: 'Renamed on the phone', updatedAt: at(1) })]
  );
  assert.equal(remoteNewer[0].title, 'Renamed on the phone');
});

test('a stamped record beats an unstamped one', () => {
  // Records written before updatedAt existed cannot be reasoned about, so the
  // side that can say when it changed is the side to believe.
  const merged = mergeCardLists(
    [card({ id: 'timer-1', title: 'Pre-merge copy', updatedAt: '' })],
    [card({ id: 'timer-1', title: 'Stamped copy', updatedAt: at(120) })]
  );
  assert.equal(merged[0].title, 'Stamped copy');
});

test('timers only one side has ever seen survive the merge', () => {
  const merged = byId(mergeCardLists(
    [
      card({ id: 'local-only', title: 'Added offline', updatedAt: at(2) }),
      card({ id: 'shared', title: 'On both', updatedAt: at(90) }),
    ],
    [
      card({ id: 'remote-only', title: 'Added on the phone', updatedAt: at(3) }),
      card({ id: 'shared', title: 'On both, newer', updatedAt: at(5) }),
    ]
  ));

  assert.equal(merged.size, 3);
  assert.equal(merged.get('local-only').title, 'Added offline');
  assert.equal(merged.get('remote-only').title, 'Added on the phone');
  assert.equal(merged.get('shared').title, 'On both, newer');
});

test('a deleted timer does not come back from the other side', () => {
  const deletedHere = mergeCardLists(
    [card({ id: 'timer-1', title: 'Gone', deleted: true, updatedAt: at(1) })],
    [card({ id: 'timer-1', title: 'Gone', deleted: false, updatedAt: at(30) })]
  );
  assert.equal(deletedHere[0].deleted, true, 'the newer deletion holds');

  const deletedThere = mergeCardLists(
    [card({ id: 'timer-1', title: 'Gone', deleted: false, updatedAt: at(30) })],
    [card({ id: 'timer-1', title: 'Gone', deleted: true, updatedAt: at(1) })]
  );
  assert.equal(deletedThere[0].deleted, true);

  // A deletion is not permanent against a later edit: re-creating or reopening
  // a timer after deleting it is still the newest thing that happened to it.
  const undeleted = mergeCardLists(
    [card({ id: 'timer-1', title: 'Back again', deleted: false, updatedAt: at(1) })],
    [card({ id: 'timer-1', title: 'Gone', deleted: true, updatedAt: at(30) })]
  );
  assert.equal(undeleted[0].deleted, false);
});

test('a send the server already made survives a newer local edit', () => {
  const resetAt = '2026-09-01T09:00:00.000Z';
  const merged = mergeCardLists(
    // Renamed in this browser, which never knew the notification went out.
    [card({ id: 'timer-1', title: 'Renamed offline', resetAt, updatedAt: at(1) })],
    [card({
      id: 'timer-1',
      title: 'Claude Usage Reset',
      resetAt,
      updatedAt: at(20),
      fired: true,
      firedAt: at(20),
      firedForResetAt: resetAt,
    })]
  );

  assert.equal(merged[0].title, 'Renamed offline', 'the newer edit still wins');
  assert.equal(merged[0].firedForResetAt, resetAt, 'but the occurrence stays marked as sent');
  assert.equal(merged[0].fired, true);
});

test('notification metadata is carried through normalization untouched', () => {
  const stored = {
    id: 'timer-1',
    title: 'Claude Usage Reset',
    resetAt: '2026-09-01T09:00:00.000Z',
    webhookUrl: 'https://api.pushcut.io/secret/notifications/Timer',
    fired: true,
    firedAt: '2026-09-01T09:00:04.000Z',
    firedForResetAt: '2026-09-01T09:00:00.000Z',
    lastNotificationAttemptAt: '2026-09-01T09:00:04.000Z',
    lastNotificationError: '',
    notificationAttempts: 2,
    notificationOccurrence: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:04.000Z',
  };

  // Round-tripping through the page must not drop what the server wrote, or
  // the next save would re-arm an occurrence that has already been sent.
  const normalized = normalizeCard(stored, 0);
  ['fired', 'firedAt', 'firedForResetAt', 'lastNotificationAttemptAt',
    'notificationAttempts', 'notificationOccurrence', 'updatedAt'].forEach(field => {
    assert.deepEqual(normalized[field], stored[field], `${field} survives`);
  });
});
