// Countdown Timers — the page that counts down to usage-window resets, backups
// and recurring routines, and fires a per-card Pushcut webhook when one lands.
//
// A card is compact by default: icon, name, time left, when it lands, status.
// Tapping it expands the same card into its own editor, so the list stays
// readable on a phone and editing never leaves the page.
//
// The page is a client of the timer service, not the thing keeping it alive.
// Cards live in localStorage and in the owner's own storage behind
// /api/reset-timers, and the notification when a countdown lands is sent by the
// server — it has to arrive whether or not this page is open, and only the
// server can read Pushcut's answer. What is left here is the list, the editor,
// and the manual "Test webhook" button.
//
// This module used to live inside app-shared.js, which every page loads. It is
// only ever needed here, so it moved out alongside countdowns-page.js.

window.AOResets = (() => {
  const STORAGE_KEY = 'agent-office-per-card-countdowns-v2';
  const IPHONE_UPDATE_MIGRATION_KEY = 'agent-office-countdown-iphone-updates-v1';
  const SORT_KEY = 'ao-resets-sort';
  const FILTER_KEY = 'ao-resets-filter';
  const TICK_MS = 1000;
  // The server advances repeating timers and records Pushcut deliveries, so the
  // page pulls those back periodically instead of only on load.
  const SYNC_MS = 60000;
  const TOMBSTONE_TTL_MS = 30 * 86400000;
  const DAY_MS = 86400000;
  const DUE_SOON_COLOR = 'var(--yellow)';
  const HAPPY_HOUR_ID = 'routine-happy-hour-daily';
  const HAPPY_HOUR_DEALS = [
    '50% off Burger Patties',
    '50% off Marinated Chicken Kebobs',
    '50% off Marinated Chicken Kebobs',
    '50\u00a2 each Marinated Split Chicken Wings',
    '50% off Fresh Appetizers',
    '50% off Fresh Appetizers',
    '50% off Burger Patties',
  ];

  const REPEAT_OPTIONS = [
    { value: 0, label: 'Does not repeat' },
    { value: 1, label: 'Every day' },
    { value: 2, label: 'Every 2 days' },
    { value: 7, label: 'Every week' },
    { value: 14, label: 'Every 2 weeks' },
    { value: 30, label: 'Every 30 days' },
  ];

  // The list order. "soonest" is the default and the one this page is for:
  // whatever lands next sits at the top, the long waits sink to the bottom.
  // Finished timers always fall below the live ones — a list of what is coming
  // should not open on things that already happened.
  const SORTS = {
    soonest: { label: 'Finishing soonest', group: true, compare: (a, b) => a.remaining - b.remaining },
    latest: { label: 'Finishing last', group: true, compare: (a, b) => b.remaining - a.remaining },
    added: { label: 'Recently added', group: false, compare: (a, b) => b.card.createdAt - a.card.createdAt },
    name: { label: 'Name (A–Z)', group: false, compare: (a, b) => a.card.title.localeCompare(b.card.title) },
  };

  const FILTERS = {
    all: { label: 'All timers', keep: () => true },
    active: { label: 'Active only', keep: view => view.state === 'active' },
    paused: { label: 'Paused', keep: view => view.state === 'paused' },
    finished: { label: 'Finished', keep: view => view.state === 'expired' || view.state === 'completed' },
  };

  // The same destination rule the server enforces in reset-timers.js, so a URL
  // the processor will refuse to send to cannot be saved here in the first
  // place. The server is where it matters - this is the version that can say so
  // while the URL is still in front of the person who pasted it.
  const PUSHCUT_WEBHOOK_HOSTS = ['api.pushcut.io'];
  const WEBHOOK_HELP = 'Only Pushcut webhooks are supported (https://api.pushcut.io/…).';

  const STATES = {
    active: { label: 'Active', dot: 'active', tone: 'active' },
    paused: { label: 'Paused', dot: 'idle', tone: 'idle' },
    expired: { label: 'Expired', dot: 'blocked', tone: 'blocked' },
    completed: { label: 'Completed', dot: 'queued', tone: 'queued' },
  };

  // A countdown with a face on it. First rule that matches the name wins, and
  // the colour lands on the icon tile and the time, nowhere else.
  const ICONS = [
    [/happy hour|kebob|chicken|burger|appetizer/i, '\u{1F37D}\uFE0F', 'var(--orange)'],
    [/claude|anthropic/i, '\u{1F9E0}', 'var(--purple)'],
    [/openai|chatgpt|\bgpt\b|codex/i, '⚡', 'var(--green)'],
    [/gemini|google/i, '✨', 'var(--blue)'],
    [/backup|database|\bdb\b/i, '\u{1F5C4}️', 'var(--orange)'],
    [/server|deploy|maintenance|uptime/i, '☁️', 'var(--blue)'],
    [/report|news|sharebot|trend/i, '\u{1F4F0}', 'var(--cyan)'],
    [/beard|hair|trim|shave|nails/i, '✂️', 'var(--pink)'],
    [/clean|sheets|carpet|laundry|wash/i, '\u{1F9FA}', 'var(--cyan)'],
    [/rent|bill|pay|invoice|subscription|renew/i, '\u{1F4B3}', 'var(--yellow)'],
    [/meeting|call|standup|review/i, '\u{1F4DE}', 'var(--purple)'],
    [/reset|usage|quota|limit|api/i, '\u{1F504}', 'var(--accent)'],
  ];

  const state = {
    initialized: false,
    cards: [],
    sort: 'soonest',
    filter: 'all',
    openId: '',
    savedId: '',
    tickTimer: null,
    syncTimer: null,
    order: '',
    happyHourTrigger: null,
  };

  // ─── Helpers ───────────────────────────────────────────────────────────

  function el(id) { return document.getElementById(id); }

  function pad(value) { return String(value).padStart(2, '0'); }

  function escHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function randomId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'reset-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  function atHour(date, hour, minute) {
    const copy = new Date(date);
    copy.setHours(hour, minute || 0, 0, 0);
    return copy;
  }

  function daysFromNow(days, hour) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return atHour(date, hour == null ? 9 : hour, 0).toISOString();
  }

  function nextWeekdayAt(weekday, hour) {
    const date = new Date();
    const daysAhead = (weekday - date.getDay() + 7) % 7 || 7;
    date.setDate(date.getDate() + daysAhead);
    return atHour(date, hour == null ? 9 : hour, 0).toISOString();
  }

  function happyHourDetails(now = new Date()) {
    const current = new Date(now);
    const reminder = atHour(current, 14, 30);
    const starts = atHour(current, 15, 0);
    const ends = atHour(current, 18, 0);
    let dealDate = current;
    let target = reminder;
    let phase = 'upcoming';

    if (current >= ends) {
      dealDate = new Date(current);
      dealDate.setDate(dealDate.getDate() + 1);
      target = atHour(dealDate, 14, 30);
      phase = 'tomorrow';
    } else if (current >= starts) {
      target = ends;
      phase = 'open';
    } else if (current >= reminder) {
      target = starts;
      phase = 'starting';
    }

    const dayName = dealDate.toLocaleDateString([], { weekday: 'long' });
    const deal = HAPPY_HOUR_DEALS[dealDate.getDay()];
    return {
      phase,
      target,
      dayName,
      deal,
      meal: happyHourMeal(deal),
      title: `Happy Hour ${phase === 'tomorrow' ? 'Tomorrow' : 'Today'} \u2014 ${deal}`,
      message: `${dayName}: ${deal}. Happy Hour is 3:00\u20136:00 PM; the countdown starts at 2:30 PM. More Rewards card required; while quantities last.`,
    };
  }

  function happyHourMeal(deal) {
    return String(deal || '')
      .replace(/^50% off\s+/i, '')
      .replace(/^50\u00a2 each\s+/i, '');
  }

  function syncHappyHourCard(card, now = new Date()) {
    const details = happyHourDetails(now);
    card.title = details.title;
    card.resetAt = details.target.toISOString();
    card.repeatDays = 0;
    card.message = details.message;
    card.status = 'active';
    card.fired = false;
    card.happyHourPhase = details.phase;
    card.happyHourDeal = details.deal;
    card.happyHourMeal = details.meal;
    card.happyHourDay = details.dayName;
    return details;
  }

  function iconFor(title) {
    const match = ICONS.find(rule => rule[0].test(title || ''));
    return match ? { glyph: match[1], color: match[2] } : { glyph: '⏳', color: 'var(--accent)' };
  }

  function isDueSoon(view) {
    return Boolean(view && view.state === 'active' && view.remaining >= 0 && view.remaining <= DAY_MS);
  }

  function colorForView(view) {
    return isDueSoon(view) ? DUE_SOON_COLOR : iconFor(view.card.title).color;
  }

  // "1 Day & 21h" while there are still days on the clock, then progressively
  // finer, so the last hour actually ticks instead of sitting on "0h 0m".
  //
  // The leading unit is never zero-padded — "01d" read as a stutter rather
  // than a duration — and at day range the days are spelled out, because that
  // is the part you actually read. Minutes are dropped once there is a day on
  // the clock: they are noise at that distance and they cost the label the
  // room to say "Day". Units after the first stay padded, so a readout ticks
  // down in place instead of jittering between "1h 9m" and "1h 10m".
  function formatRemaining(ms) {
    if (ms <= 0) return 'Finished';
    const days = Math.floor(ms / DAY_MS);
    const hours = Math.floor((ms % DAY_MS) / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    if (days > 0) {
      const label = `${days} Day${days === 1 ? '' : 's'}`;
      // "1 Day & 0h" is a worse read than "1 Day".
      return hours > 0 ? `${label} & ${hours}h` : label;
    }
    if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
    return `${minutes}m ${pad(seconds)}s`;
  }

  function formatWhen(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  // A timer that has been ticked off is not counting down any more, so the big
  // number stands down rather than carrying on in the background.
  function timeLabel(view) {
    if (view.card.id === HAPPY_HOUR_ID) {
      const prefix = view.card.happyHourPhase === 'open'
        ? 'Open now \u00b7 ends in '
        : view.card.happyHourPhase === 'starting'
          ? 'Starts in '
          : 'Heads-up in ';
      return prefix + formatRemaining(view.remaining);
    }
    return view.state === 'completed' ? 'Done' : formatRemaining(view.remaining);
  }

  function whenLabel(view) {
    if (view.card.id === HAPPY_HOUR_ID) return 'Happy Hour 3:00\u20136:00 PM \u00b7 heads-up begins 2:30 PM';
    const when = formatWhen(view.card.resetAt);
    if (!when) return '';
    if (view.state === 'completed') return `Marked done — was set for ${when}`;
    if (view.state === 'expired') return `Landed ${when}`;
    if (view.state === 'paused') return `Paused at ${formatRemaining(view.remaining)} — ${when}`;
    return `Resets ${when}`;
  }

  // <input type="date"> and <input type="time"> speak local wall-clock time and
  // the store speaks ISO instants. These three convert between them.
  function toDateValue(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function toTimeValue(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function fromDateTime(dateValue, timeValue) {
    if (!dateValue) return '';
    const date = new Date(`${dateValue}T${timeValue || '09:00'}`);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  // ─── Storage ───────────────────────────────────────────────────────────

  // The cards a fresh browser starts life with. They are laid down once, on the
  // first visit, and never re-applied: the old page rebuilt them on every load,
  // which quietly undid every rename, re-time and delete the user made.
  function seedCards() {
    return [];
  }

  function toIso(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  function normalizeCard(raw, index) {
    if (!raw || typeof raw !== 'object') return null;
    const target = new Date(raw.resetAt);
    const repeatDays = Number(raw.repeatDays);
    const status = raw.status === 'paused' || raw.status === 'completed' ? raw.status : 'active';
    return {
      id: String(raw.id || randomId()),
      title: String(raw.title || 'Untitled countdown').slice(0, 160),
      resetAt: Number.isNaN(target.getTime()) ? daysFromNow(1) : target.toISOString(),
      webhookUrl: String(raw.webhookUrl || ''),
      repeatDays: Number.isFinite(repeatDays) && repeatDays > 0 ? Math.round(repeatDays) : 0,
      status,
      fired: Boolean(raw.fired),
      message: String(raw.message || ''),
      source: raw.source === 'office' ? 'office' : 'browser',
      notes: String(raw.notes || ''),
      createdAt: Number(raw.createdAt) || 0,
      // A deleted card is kept as a tombstone rather than dropped, so the
      // deletion can win a merge instead of the other side handing the card
      // back. loadCards() sweeps them once they are old enough to be safe.
      deleted: Boolean(raw.deleted),
      // When this record was last materially changed. Merges are decided on it,
      // so anything that edits a card must call touch().
      updatedAt: toIso(raw.updatedAt),
      // Written by the server's notification processor, read by nobody here
      // except the merge. Carried through untouched: this is the record of what
      // has already been sent to Pushcut, and dropping it sends it again.
      firedAt: toIso(raw.firedAt),
      firedForResetAt: toIso(raw.firedForResetAt),
      lastNotificationAttemptAt: toIso(raw.lastNotificationAttemptAt),
      lastNotificationError: String(raw.lastNotificationError || ''),
      notificationAttempts: Number(raw.notificationAttempts) || 0,
      notificationOccurrence: toIso(raw.notificationOccurrence),
      order: index,
    };
  }

  // Every material edit stamps the card. Without this the merge below has
  // nothing to compare and the newest version is whichever side saved last.
  function touch(card) {
    if (card) card.updatedAt = new Date().toISOString();
    return card;
  }

  // Cards that still exist. Tombstones are stored and synced but are not part
  // of the list, the counts or the clock.
  function liveCards() {
    return state.cards.filter(card => !card.deleted);
  }

  /**
   * Merge the browser's timers with the server's, by id and then by updatedAt.
   *
   * The old sync replaced the local array with the remote one wholesale, which
   * threw away anything edited while offline and resurrected anything deleted
   * on another device. This keeps the newer of the two versions of each card
   * and keeps cards that only one side has ever seen.
   *
   * A record with no updatedAt is pre-merge data, and loses to one that has it:
   * the stamped side is the only one that can be reasoned about.
   */
  function mergeCardLists(local, remote) {
    const merged = new Map();
    const stamp = card => (card.updatedAt ? Date.parse(card.updatedAt) || 0 : 0);

    local.forEach(card => merged.set(card.id, card));
    remote.forEach(card => {
      const mine = merged.get(card.id);
      if (!mine) return merged.set(card.id, card);
      const winner = stamp(card) > stamp(mine) ? card : mine;
      const loser = winner === card ? mine : card;
      // Whichever version wins, a send that has already happened for the
      // occurrence it still points at must survive: a stale local copy that
      // has been renamed offline should not re-arm a notification the server
      // has already delivered.
      if (winner.resetAt === loser.resetAt
        && loser.firedForResetAt === loser.resetAt
        && winner.firedForResetAt !== winner.resetAt) {
        winner.fired = loser.fired;
        winner.firedAt = loser.firedAt;
        winner.firedForResetAt = loser.firedForResetAt;
      }
      merged.set(card.id, winner);
    });

    return [...merged.values()].map((card, index) => ({ ...card, order: index }));
  }

  // Two lists hold the same timers when they hold the same records, whatever
  // order they are in. `order` is a rendering detail and `message` is the
  // one-line status under an open card, so neither counts as a difference.
  function cardsSignature(cards) {
    return JSON.stringify(
      cards.slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(({ order, message, ...rest }) => rest)
    );
  }

  // A repeating card that has gone past its time rolls forward to its next
  // occurrence rather than sitting there expired, keeping the hour it was set
  // to. One-off cards are left alone: "Expired" is the right answer for those.
  //
  // A card with a webhook waits. Its occurrence belongs to the server's
  // notification processor now, and rolling it forward in the browser would
  // hide the very moment the processor is looking for - the notification would
  // simply never be sent. The server advances it once Pushcut has taken it.
  function rollForward(card) {
    if (card.deleted || !card.repeatDays || card.status === 'completed') return false;
    const next = new Date(card.resetAt);
    if (Number.isNaN(next.getTime()) || next.getTime() > Date.now()) return false;
    if (card.webhookUrl && card.firedForResetAt !== card.resetAt) return false;
    while (next.getTime() <= Date.now()) next.setDate(next.getDate() + card.repeatDays);
    card.resetAt = next.toISOString();
    card.fired = false;
    touch(card);
    return true;
  }

  function loadCards() {
    const raw = localStorage.getItem(STORAGE_KEY);
    let stored = null;
    try {
      const parsed = JSON.parse(raw || 'null');
      if (Array.isArray(parsed)) stored = parsed;
    } catch (err) {
      stored = null;
    }

    // No store at all means a browser that has never seen this page: hand it
    // the starter set. An empty store is a user who deleted everything, and
    // that stays deleted.
    const source = stored || seedCards().map(seed => ({ ...seed, createdAt: Date.now(), status: 'active' }));
    const cutoff = Date.now() - TOMBSTONE_TTL_MS;
    const cards = source.map(normalizeCard).filter(Boolean)
      // A tombstone only has to outlive the other copies of the card. Keeping
      // them forever would grow the record without bound.
      .filter(card => !card.deleted || (Date.parse(card.updatedAt) || 0) > cutoff);
    cards.forEach(card => {
      if (card.id === HAPPY_HOUR_ID) syncHappyHourCard(card);
      else rollForward(card);
    });
    return cards;
  }

  function writeLocalCards() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(browserCards()));
    } catch (err) {
      /* A full or blocked localStorage should not take the page down. */
    }
  }

  function saveCards() {
    writeLocalCards();
    if (state.initialized) persistServerCards(false);
  }

  function browserCards() {
    return state.cards.filter(card => card.source !== 'office');
  }

  async function syncServerCards(interactive) {
    if (typeof ensureDropsSession !== 'function' || !(await ensureDropsSession(Boolean(interactive)))) return false;
    try {
      const response = await fetch('/api/reset-timers', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Could not load shared timer storage.');
      const payload = await response.json();
      const remote = Array.isArray(payload.items) ? payload.items.map(normalizeCard).filter(Boolean) : [];
      const local = browserCards();
      if (!remote.length && local.length) {
        const saved = await fetch('/api/reset-timers', {
          method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: local }),
        });
        if (!saved.ok) throw new Error('Could not migrate browser timers to persistent storage.');
      } else if (remote.length) {
        const merged = mergeCardLists(local, remote);
        state.cards = [...state.cards.filter(card => card.source === 'office'), ...merged];
        // saveCards() writes both sides, so a merge that took anything from
        // this browser reaches the server too - a deletion included. It is
        // skipped only when all three copies already agree, so an open tab is
        // not writing to storage once a minute for nothing.
        if (cardsSignature(merged) !== cardsSignature(local)
          || cardsSignature(merged) !== cardsSignature(remote)) {
          saveCards();
        }
        render();
      }
      return true;
    } catch (error) {
      const count = el('rst-count');
      if (count) count.textContent = error.message;
      return false;
    }
  }

  /**
   * Write this browser's timers to the shared store.
   *
   * The store is read again first. The server's notification processor edits
   * these same records — it marks an occurrence sent and rolls a repeating
   * timer on to the next one — and a page that has been open a while would
   * otherwise overwrite that with its own older copy, which does not just lose
   * the edit: the occurrence would read as unsent and go out to Pushcut twice.
   */
  async function persistServerCards(interactive) {
    if (typeof ensureDropsSession !== 'function' || !(await ensureDropsSession(Boolean(interactive)))) return false;
    try {
      let items = browserCards();
      const current = await fetch('/api/reset-timers', { credentials: 'same-origin' });
      if (current.ok) {
        const payload = await current.json();
        const remote = Array.isArray(payload.items) ? payload.items.map(normalizeCard).filter(Boolean) : [];
        if (remote.length) {
          items = mergeCardLists(items, remote);
          state.cards = [...state.cards.filter(card => card.source === 'office'), ...items];
          writeLocalCards();
        }
      }

      const response = await fetch('/api/reset-timers', {
        method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function loadOfficeCards() {
    try {
      const response = await fetch('/api/countdowns?events=0', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Shared countdowns are unavailable.');
      const payload = await response.json();
      const items = ['today', 'week', 'later', 'past']
        .flatMap(group => (payload.groups && payload.groups[group]) || [])
        .filter(item => item.kind === 'countdown');
      const repeatDays = { daily: 1, every2days: 2, weekday: 1, weekly: 7, biweekly: 14, monthly: 30 };
      const shared = items.map((item, index) => normalizeCard({
        id: item.id,
        title: item.title,
        resetAt: item.occurs_at || item.target_at,
        repeatDays: repeatDays[item.repeat] || 0,
        status: item.archived ? 'completed' : 'active',
        message: item.next_action || 'Managed in Agent Office.',
        notes: item.notes || '',
        source: 'office',
        createdAt: new Date(item.created_at || 0).getTime(),
      }, index)).filter(Boolean);
      const browserCards = state.cards.filter(card => card.source !== 'office');
      state.cards = [...shared, ...browserCards];
      render();
    } catch (error) {
      const count = el('rst-count');
      if (count) count.textContent = error.message;
    }
  }

  function readPreference(key, allowed, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value && allowed[value] ? value : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writePreference(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      /* the list still sorts, it just will not remember next time */
    }
  }

  // ─── Deriving what a card is doing right now ───────────────────────────

  function viewOf(card) {
    const target = new Date(card.resetAt).getTime();
    const remaining = Number.isNaN(target) ? 0 : target - Date.now();
    let cardState = 'active';
    if (card.status === 'completed') cardState = 'completed';
    else if (card.status === 'paused') cardState = 'paused';
    else if (remaining <= 0) cardState = 'expired';
    return { card, target, remaining, state: cardState, finished: cardState === 'expired' || cardState === 'completed' };
  }

  function sortedViews() {
    const sort = SORTS[state.sort] || SORTS.soonest;
    const filter = FILTERS[state.filter] || FILTERS.all;
    return liveCards()
      .map(viewOf)
      .filter(filter.keep)
      .sort((a, b) => {
        // Finished timers sink under the live ones for the two time-based
        // sorts; within that group the most recently finished comes first.
        if (sort.group && a.finished !== b.finished) return a.finished ? 1 : -1;
        if (sort.group && a.finished && b.finished) return b.target - a.target;
        const result = sort.compare(a, b);
        return result || a.card.order - b.card.order;
      });
  }

  function isListView(view) {
    return Boolean(view && view.card && view.card.id !== HAPPY_HOUR_ID);
  }

  function listedViews() {
    return sortedViews().filter(isListView);
  }

  // ─── Rendering ─────────────────────────────────────────────────────────

  function optionsHtml(options, selected) {
    return options
      .map(item => `<option value="${escHtml(item.value)}"${item.value === selected ? ' selected' : ''}>${escHtml(item.label)}</option>`)
      .join('');
  }

  function cardHtml(view) {
    const card = view.card;
    const meta = STATES[view.state];
    const icon = iconFor(card.title);
    const color = colorForView(view);
    const open = state.openId === card.id;
    const bodyId = `rst-body-${escHtml(card.id)}`;

    if (card.source === 'office') return `
      <article class="rst-card${open ? ' is-open' : ''}${isDueSoon(view) ? ' is-due-soon' : ''}" data-id="${escHtml(card.id)}" data-state="${view.state}" style="--rst-color: ${color}">
        <button type="button" class="rst-head" data-action="toggle" aria-expanded="${open}" aria-controls="${bodyId}">
          <span class="rst-icon" aria-hidden="true">${icon.glyph}</span>
          <span class="rst-head-main"><span class="rst-head-top"><span class="rst-title">${escHtml(card.title)}</span><span class="ao-status ao-status--info rst-state">Shared</span></span><span class="rst-time" data-role="time">${escHtml(timeLabel(view))}</span><span class="rst-when" data-role="when">${escHtml(whenLabel(view))}</span></span>
          <span class="rst-chevron" aria-hidden="true">â–¾</span>
        </button>
        <div class="rst-body" id="${bodyId}"><div class="rst-body-inner"><div class="rst-message">${escHtml(card.message)}</div>${card.notes ? `<p>${escHtml(card.notes)}</p>` : ''}<div class="rst-footnote">Shared Agent Office countdown · managed by Penny</div></div></div>
      </article>`;

    return `
      <article class="rst-card${open ? ' is-open' : ''}${state.savedId === card.id ? ' is-saved' : ''}${isDueSoon(view) ? ' is-due-soon' : ''}"
               data-id="${escHtml(card.id)}" data-state="${view.state}" style="--rst-color: ${color}">
        <button type="button" class="rst-head" data-action="toggle" aria-expanded="${open}" aria-controls="${bodyId}">
          <span class="rst-icon" aria-hidden="true">${icon.glyph}</span>
          <span class="rst-head-main">
            <span class="rst-head-top">
              <span class="rst-title" data-role="title">${escHtml(card.title)}</span>
              <span class="ao-status ao-status--${meta.tone} rst-state" data-role="status">
                <span class="ao-dot ao-dot--${meta.dot}"></span>${meta.label}
              </span>
            </span>
            <span class="rst-time" data-role="time">${escHtml(timeLabel(view))}</span>
            <span class="rst-when" data-role="when">${escHtml(whenLabel(view))}</span>
          </span>
          <span class="rst-chevron" aria-hidden="true">▾</span>
        </button>

        <div class="rst-body" id="${bodyId}">
          <div class="rst-body-inner">
            <div class="ao-field">
              <label class="ao-label" for="rst-name-${escHtml(card.id)}">Countdown name</label>
              <input class="ao-input" id="rst-name-${escHtml(card.id)}" data-field="title"
                     maxlength="160" value="${escHtml(card.title)}" />
            </div>

            <div class="rst-field-row">
              <div class="ao-field">
                <label class="ao-label" for="rst-date-${escHtml(card.id)}">Reset date</label>
                <input class="ao-input" id="rst-date-${escHtml(card.id)}" type="date" data-field="date"
                       value="${escHtml(toDateValue(card.resetAt))}" />
              </div>
              <div class="ao-field">
                <label class="ao-label" for="rst-time-${escHtml(card.id)}">Time</label>
                <input class="ao-input" id="rst-time-${escHtml(card.id)}" type="time" data-field="time"
                       value="${escHtml(toTimeValue(card.resetAt))}" />
              </div>
            </div>

            <div class="ao-field">
              <label class="ao-label" for="rst-repeat-${escHtml(card.id)}">Repeats</label>
              <select class="ao-select" id="rst-repeat-${escHtml(card.id)}" data-field="repeatDays">
                ${optionsHtml(REPEAT_OPTIONS, card.repeatDays)}
              </select>
            </div>

            <div class="ao-field">
              <label class="ao-label" for="rst-hook-${escHtml(card.id)}">Pushcut webhook</label>
              <input class="ao-input" id="rst-hook-${escHtml(card.id)}" data-field="webhookUrl" inputmode="url"
                     placeholder="https://api.pushcut.io/..." value="${escHtml(card.webhookUrl)}" />
              <div class="rst-hook-row">
                <button type="button" class="rst-link" data-action="test">Test webhook</button>
                <button type="button" class="rst-link" data-action="clear-hook">Clear webhook</button>
              </div>
            </div>

            <div class="rst-message" data-role="message">${escHtml(card.message)}</div>

            <div class="rst-actions">
              <button type="button" class="ao-btn ao-btn--danger" data-action="delete">Delete</button>
              <button type="button" class="ao-btn" data-action="pause">${card.status === 'paused' ? 'Resume' : 'Pause'}</button>
              <button type="button" class="ao-btn" data-action="complete">${card.status === 'completed' ? 'Reopen' : 'Mark done'}</button>
              <button type="button" class="ao-btn ao-btn--primary" data-action="save">Save changes</button>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function happyHourShortcutTime(view) {
    const remaining = formatRemaining(view.remaining);
    if (view.card.happyHourPhase === 'open') return `Ends in ${remaining}`;
    if (view.card.happyHourPhase === 'starting') return `Starts in ${remaining}`;
    return `Heads-up in ${remaining}`;
  }

  function renderHappyHourShortcut() {
    const shortcut = el('rst-happy-shortcut');
    if (!shortcut) return;
    const card = state.cards.find(item => item.id === HAPPY_HOUR_ID);
    shortcut.hidden = !card;
    if (!card) return;

    const view = viewOf(card);
    const compactTime = happyHourShortcutTime(view);
    shortcut.style.setProperty('--rst-color', colorForView(view));
    shortcut.querySelector('[data-role="happy-shortcut-meal"]').textContent = card.happyHourMeal;
    shortcut.querySelector('[data-role="happy-shortcut-time"]').textContent = compactTime;
    shortcut.setAttribute(
      'aria-label',
      `${card.happyHourMeal}, ${timeLabel(view)}. Open Happy Hour details`
    );
  }

  function render() {
    const list = el('reset-cards');
    if (!list) return;

    renderHappyHourShortcut();
    const views = listedViews();
    state.order = views.map(view => view.card.id).join('|');
    list.innerHTML = views.map(cardHtml).join('');

    const empty = el('rst-empty');
    if (empty) {
      const nothingAtAll = !liveCards().some(card => card.id !== HAPPY_HOUR_ID);
      empty.hidden = views.length > 0;
      empty.querySelector('[data-role="empty-title"]').textContent =
        nothingAtAll ? 'No countdowns yet' : 'Nothing matches this filter';
      empty.querySelector('[data-role="empty-body"]').textContent =
        nothingAtAll
          ? 'Create your first countdown and it will show up here, ticking.'
          : 'Try "All timers" to see the rest of the list.';
      empty.querySelector('[data-role="empty-new"]').hidden = !nothingAtAll;
    }

    const count = el('rst-count');
    if (count) {
      const live = liveCards().map(viewOf).filter(view => isListView(view) && view.state === 'active').length;
      count.textContent = liveCards().some(card => card.id !== HAPPY_HOUR_ID)
        ? `${views.length} shown · ${live} counting down`
        : '';
    }

    // The save flash is a one-shot: clear it so the next render is calm.
    if (state.savedId) {
      const saved = state.savedId;
      state.savedId = '';
      setTimeout(() => {
        const node = list.querySelector(`.rst-card[data-id="${CSS.escape(saved)}"]`);
        if (node) node.classList.remove('is-saved');
      }, 1200);
    }
  }

  // The list is only redrawn when the data changes. Between those, the tick
  // moves the clocks in place, so typing in an expanded card is never
  // interrupted by a re-render.
  function tick() {
    const list = el('reset-cards');
    if (!list) return;

    let orderChanged = false;
    state.cards.forEach(card => {
      if (card.id === HAPPY_HOUR_ID) {
        const before = `${card.title}|${card.resetAt}|${card.happyHourPhase}`;
        syncHappyHourCard(card);
        if (`${card.title}|${card.resetAt}|${card.happyHourPhase}` !== before) orderChanged = true;
      } else if (rollForward(card)) orderChanged = true;
    });

    renderHappyHourShortcut();
    const happyHourCard = state.cards.find(card => card.id === HAPPY_HOUR_ID);
    if (happyHourCard && isHappyHourOpen()) updateHappyHourModal(viewOf(happyHourCard));

    list.querySelectorAll('.rst-card').forEach(node => {
      const card = state.cards.find(item => item.id === node.dataset.id);
      if (!card) return;
      const view = viewOf(card);
      const meta = STATES[view.state];

      const title = node.querySelector('[data-role="title"]');
      if (title) title.textContent = card.title;
      node.style.setProperty('--rst-color', colorForView(view));
      node.classList.toggle('is-due-soon', isDueSoon(view));

      const time = node.querySelector('[data-role="time"]');
      if (time) time.textContent = timeLabel(view);
      const when = node.querySelector('[data-role="when"]');
      if (when) when.textContent = whenLabel(view);

      if (node.dataset.state !== view.state) {
        node.dataset.state = view.state;
        const status = node.querySelector('[data-role="status"]');
        if (status) {
          status.className = `ao-status ao-status--${meta.tone} rst-state`;
          status.innerHTML = `<span class="ao-dot ao-dot--${meta.dot}"></span>${escHtml(meta.label)}`;
        }
        orderChanged = true;
      }
    });

    if (orderChanged) saveCards();
    // Re-sorting under a finger that is mid-edit is worse than a stale order,
    // so the list only re-flows once nothing is open.
    if (!state.openId && !isFormOpen() && !isHappyHourOpen()) {
      const next = listedViews().map(view => view.card.id).join('|');
      if (next !== state.order) render();
    }
  }

  // ─── Expanding a card ──────────────────────────────────────────────────

  function openCard(id) {
    if (state.openId === id) return closeCard();
    state.openId = id;
    render();
    const node = el('reset-cards').querySelector(`.rst-card[data-id="${CSS.escape(id)}"]`);
    if (node && node.scrollIntoView) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function closeCard() {
    if (!state.openId) return;
    state.openId = '';
    render();
  }

  function isHappyHourOpen() {
    const modal = el('rst-happy-modal');
    return Boolean(modal) && !modal.hidden;
  }

  function updateHappyHourModal(view) {
    if (!view) return;
    const card = view.card;
    const tomorrow = card.happyHourPhase === 'tomorrow';
    const setText = (role, value) => {
      const node = document.querySelector(`#rst-happy-modal [data-role="${role}"]`);
      if (node) node.textContent = value;
    };
    setText('happy-day', `Happy Hour ${tomorrow ? 'Tomorrow' : 'Today'}`);
    setText('happy-offer', card.happyHourDeal);
    setText('happy-modal-time', timeLabel(view));
    setText('happy-weekday', card.happyHourDay);
  }

  function openHappyHour(trigger) {
    const modal = el('rst-happy-modal');
    const card = state.cards.find(item => item.id === HAPPY_HOUR_ID);
    if (!modal || !card) return;
    state.openId = '';
    state.happyHourTrigger = trigger || null;
    updateHappyHourModal(viewOf(card));
    modal.hidden = false;
    const close = modal.querySelector('[data-action="close-happy-hour"]');
    if (close) close.focus();
  }

  function closeHappyHour() {
    const modal = el('rst-happy-modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (state.happyHourTrigger && document.contains(state.happyHourTrigger)) {
      state.happyHourTrigger.focus();
    }
    state.happyHourTrigger = null;
  }

  function draftFrom(node) {
    const read = field => {
      const input = node.querySelector(`[data-field="${field}"]`);
      return input ? input.value.trim() : '';
    };
    return {
      title: read('title'),
      resetAt: fromDateTime(read('date'), read('time')),
      repeatDays: Number(read('repeatDays')) || 0,
      webhookUrl: read('webhookUrl'),
    };
  }

  /**
   * '' when this webhook URL is one a notification may be sent to, otherwise
   * the sentence to show whoever typed it.
   *
   * An empty URL is fine: a timer without a webhook is just a countdown.
   */
  function webhookTargetError(url) {
    const value = String(url == null ? '' : url).trim();
    if (!value) return '';
    let parsed;
    try {
      parsed = new URL(value);
    } catch (err) {
      return `That is not a valid URL. ${WEBHOOK_HELP}`;
    }
    const allowed = parsed.protocol === 'https:'
      && !parsed.username && !parsed.password && !parsed.port
      && PUSHCUT_WEBHOOK_HOSTS.indexOf(parsed.hostname.toLowerCase()) !== -1;
    return allowed ? '' : WEBHOOK_HELP;
  }

  function setMessage(id, text) {
    const card = state.cards.find(item => item.id === id);
    if (card) card.message = text;
    const node = el('reset-cards').querySelector(`.rst-card[data-id="${CSS.escape(id)}"] [data-role="message"]`);
    if (node) node.textContent = text;
  }

  // ─── Card actions ──────────────────────────────────────────────────────

  function saveCard(id, node) {
    const card = state.cards.find(item => item.id === id);
    if (!card) return;
    const draft = draftFrom(node);
    if (!draft.title) return setMessage(id, 'Give the countdown a name before saving.');
    if (!draft.resetAt) return setMessage(id, 'Pick a date and time before saving.');
    const hookError = webhookTargetError(draft.webhookUrl);
    if (hookError) return setMessage(id, hookError);

    const retimed = draft.resetAt !== card.resetAt;
    card.title = draft.title;
    card.resetAt = draft.resetAt;
    card.repeatDays = draft.repeatDays;
    card.webhookUrl = draft.webhookUrl;
    if (retimed) {
      // A new time is a new occurrence, so the server's record of the last one
      // must not read as "already sent" against it.
      card.fired = false;
      card.firedForResetAt = '';
      card.notificationAttempts = 0;
      card.notificationOccurrence = '';
      card.lastNotificationError = '';
    }
    card.message = retimed ? 'Saved. Webhook firing re-armed for the new time.' : 'Saved.';
    touch(card);

    saveCards();
    state.savedId = id;
    state.openId = '';
    render();
  }

  // Deleting leaves a tombstone rather than removing the record. The card is
  // gone from the page immediately, but the deletion has to be able to travel:
  // dropping it outright would let the next sync hand the card straight back
  // from the server's copy.
  function deleteCard(id) {
    const card = state.cards.find(item => item.id === id);
    if (!card) return;
    if (!window.confirm(`Delete "${card.title}"?`)) return;
    card.deleted = true;
    card.status = 'completed';
    card.webhookUrl = '';
    touch(card);
    saveCards();
    if (state.openId === id) state.openId = '';
    render();
  }

  function togglePause(id) {
    const card = state.cards.find(item => item.id === id);
    if (!card) return;
    card.status = card.status === 'paused' ? 'active' : 'paused';
    card.message = card.status === 'paused'
      ? 'Paused. The clock still runs; the webhook will not fire.'
      : 'Running again.';
    touch(card);
    saveCards();
    render();
  }

  function toggleComplete(id) {
    const card = state.cards.find(item => item.id === id);
    if (!card) return;
    card.status = card.status === 'completed' ? 'active' : 'completed';
    card.message = card.status === 'completed' ? 'Marked done.' : 'Reopened.';
    touch(card);
    saveCards();
    render();
  }

  function clearWebhook(id, node) {
    const input = node.querySelector('[data-field="webhookUrl"]');
    if (input) input.value = '';
    const card = state.cards.find(item => item.id === id);
    if (card) {
      card.webhookUrl = '';
      touch(card);
      saveCards();
    }
    setMessage(id, 'Webhook cleared.');
  }

  // The manual test, and only the manual test.
  //
  // Automatic delivery when a countdown lands belongs to the server now: it
  // runs whether or not this page is open, and it can read Pushcut's status
  // code instead of guessing. This still uses `no-cors`, so all it can honestly
  // report is that the request left the browser.
  async function fireWebhook(id, override) {
    const card = state.cards.find(item => item.id === id);
    if (!card) return;
    const url = (override == null ? card.webhookUrl : override).trim();
    if (!url) return setMessage(id, 'No Pushcut webhook URL on this card yet.');
    const hookError = webhookTargetError(url);
    if (hookError) return setMessage(id, hookError);

    setMessage(id, 'Sending a test to Pushcut...');
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          title: card.title,
          resetAt: card.resetAt,
          event: 'manual_test',
        }),
      });
      setMessage(id, 'Test sent to Pushcut.');
    } catch (err) {
      setMessage(id, 'Could not reach the webhook. Check the URL and try again.');
    }
  }

  // ─── The add form ──────────────────────────────────────────────────────

  function isFormOpen() {
    const modal = el('rst-modal');
    return Boolean(modal) && !modal.hidden;
  }

  function openForm() {
    const modal = el('rst-modal');
    if (!modal) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    el('rst-new-title').value = '';
    el('rst-new-date').value = toDateValue(atHour(tomorrow, 9, 0).toISOString());
    el('rst-new-time').value = '09:00';
    el('rst-new-repeat').value = '0';
    el('rst-new-webhook').value = '';
    showFormError('');
    modal.hidden = false;
    el('rst-new-title').focus();
  }

  function closeForm() {
    const modal = el('rst-modal');
    if (modal) modal.hidden = true;
  }

  function showFormError(text) {
    const box = el('rst-form-error');
    if (!box) return;
    box.textContent = text;
    box.hidden = !text;
  }

  async function addFromForm() {
    const title = el('rst-new-title').value.trim();
    const resetAt = fromDateTime(el('rst-new-date').value, el('rst-new-time').value);
    const webhookUrl = el('rst-new-webhook').value.trim();
    if (!title) return showFormError('Give the countdown a name.');
    if (!resetAt) return showFormError('Pick the date and time it lands.');
    const hookError = webhookTargetError(webhookUrl);
    if (hookError) return showFormError(hookError);

    const card = normalizeCard({
      id: randomId(),
      title,
      resetAt,
      repeatDays: Number(el('rst-new-repeat').value) || 0,
      webhookUrl,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: new Date().toISOString(),
      message: 'Added.',
    }, state.cards.length);

    state.cards.push(card);
    saveCards();
    closeForm();
    state.savedId = card.id;
    render();
    await persistServerCards(true);
  }

  // ─── Toolbar ───────────────────────────────────────────────────────────

  function setSort(value) {
    state.sort = SORTS[value] ? value : 'soonest';
    writePreference(SORT_KEY, state.sort);
    render();
  }

  function setFilter(value) {
    state.filter = FILTERS[value] ? value : 'all';
    writePreference(FILTER_KEY, state.filter);
    render();
  }

  function fillToolbar() {
    const sort = el('rst-sort');
    if (sort && !sort.options.length) {
      sort.innerHTML = Object.entries(SORTS)
        .map(([value, item]) => `<option value="${value}">${escHtml(item.label)}</option>`).join('');
    }
    if (sort) sort.value = state.sort;

    const filter = el('rst-filter');
    if (filter && !filter.options.length) {
      filter.innerHTML = Object.entries(FILTERS)
        .map(([value, item]) => `<option value="${value}">${escHtml(item.label)}</option>`).join('');
    }
    if (filter) filter.value = state.filter;

    const repeat = el('rst-new-repeat');
    if (repeat && !repeat.options.length) repeat.innerHTML = optionsHtml(REPEAT_OPTIONS, 0);
  }

  // ─── Wiring ────────────────────────────────────────────────────────────

  function onListClick(event) {
    const trigger = event.target.closest('[data-action]');
    const node = event.target.closest('.rst-card');
    if (!trigger || !node) return;
    const id = node.dataset.id;

    switch (trigger.dataset.action) {
      case 'toggle': return openCard(id);
      case 'save': return saveCard(id, node);
      case 'delete': return deleteCard(id);
      case 'pause': return togglePause(id);
      case 'complete': return toggleComplete(id);
      case 'clear-hook': return clearWebhook(id, node);
      case 'test': {
        const input = node.querySelector('[data-field="webhookUrl"]');
        return fireWebhook(id, input ? input.value : undefined);
      }
      default: return undefined;
    }
  }

  // Tapping anywhere off the expanded card closes it, which is how the rest of
  // the app's popovers behave.
  function onDocumentClick(event) {
    if (!state.openId) return;
    if (event.target.closest('.rst-card') || event.target.closest('.ao-modal')) return;
    closeCard();
  }

  function onKeyDown(event) {
    if (event.key !== 'Escape') return;
    if (isHappyHourOpen()) return closeHappyHour();
    if (isFormOpen()) return closeForm();
    closeCard();
  }

  function init() {
    if (!state.initialized) {
      state.sort = readPreference(SORT_KEY, SORTS, 'soonest');
      state.filter = readPreference(FILTER_KEY, FILTERS, 'all');
      state.cards = loadCards();
      saveCards();

      const list = el('reset-cards');
      if (list) list.addEventListener('click', onListClick);
      document.addEventListener('click', onDocumentClick);
      document.addEventListener('keydown', onKeyDown);
      state.initialized = true;
      loadOfficeCards();
      syncServerCards(false);
    }

    fillToolbar();
    render();
    if (!state.tickTimer) state.tickTimer = setInterval(tick, TICK_MS);
    // Repeating timers are advanced by the server once Pushcut has taken the
    // notification, so the page has to come back and look rather than assume
    // its own copy is the current one.
    if (!state.syncTimer) state.syncTimer = setInterval(() => syncServerCards(false), SYNC_MS);
  }

  return {
    init,
    mergeCardLists,
    normalizeCard,
    setSort,
    setFilter,
    openForm,
    closeForm,
    addFromForm,
    openHappyHour,
    closeHappyHour,
    happyHourDetails,
    happyHourMeal,
    happyHourShortcutTime,
    isListView,
    isDueSoon,
    colorForView,
    webhookTargetError,
  };
})();
