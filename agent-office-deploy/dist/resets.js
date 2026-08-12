// Countdown Timers — the page that counts down to usage-window resets, backups
// and recurring routines, and fires a per-card Pushcut webhook when one lands.
//
// A card is compact by default: icon, name, time left, when it lands, status.
// Tapping it expands the same card into its own editor, so the list stays
// readable on a phone and editing never leaves the page. Everything is held in
// localStorage — no card, and no webhook URL, leaves the browser except to the
// webhook the card itself names.
//
// This module used to live inside app-shared.js, which every page loads. It is
// only ever needed here, so it moved out alongside countdowns-page.js.

window.AOResets = (() => {
  const STORAGE_KEY = 'agent-office-per-card-countdowns-v2';
  const IPHONE_UPDATE_MIGRATION_KEY = 'agent-office-countdown-iphone-updates-v1';
  const SORT_KEY = 'ao-resets-sort';
  const FILTER_KEY = 'ao-resets-filter';
  const TICK_MS = 1000;
  const DAY_MS = 86400000;
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
    order: '',
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
    return {
      phase,
      target,
      title: `Happy Hour ${phase === 'tomorrow' ? 'Tomorrow' : 'Today'} \u2014 ${HAPPY_HOUR_DEALS[dealDate.getDay()]}`,
      message: `${dayName}: ${HAPPY_HOUR_DEALS[dealDate.getDay()]}. Happy Hour is 3:00\u20136:00 PM; the countdown starts at 2:30 PM. More Rewards card required; while quantities last.`,
    };
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
    return details;
  }

  function iconFor(title) {
    const match = ICONS.find(rule => rule[0].test(title || ''));
    return match ? { glyph: match[1], color: match[2] } : { glyph: '⏳', color: 'var(--accent)' };
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
    const cycle = nextShareBotCycle();
    const offset = (date, minutes) => new Date(date.getTime() + minutes * 60000).toISOString();
    return [
      {
        id: HAPPY_HOUR_ID,
        title: 'Happy Hour',
        resetAt: new Date().toISOString(),
        repeatDays: 0,
        message: '',
      },
      {
        id: 'sharebot-report-crypto-economics',
        title: 'ShareBot Report 1 - Crypto, Stocks, Economics',
        resetAt: cycle.toISOString(),
        repeatDays: 2,
        message: 'Starts at the next 8:00 AM ShareBot cycle.',
      },
      {
        id: 'sharebot-report-geopolitics',
        title: 'ShareBot Report 2 - Geopolitics',
        resetAt: offset(cycle, 20),
        repeatDays: 2,
        message: 'Estimated start after Report 1 posts.',
      },
      {
        id: 'sharebot-report-cycle-complete',
        title: 'ShareBot Full Cycle - Estimated Complete',
        resetAt: offset(cycle, 40),
        repeatDays: 2,
        message: 'Estimated completion window for both reports.',
      },
      {
        id: 'routine-beard-mustache-face-7d',
        title: 'Trim Beard + Mustache + Face',
        resetAt: daysFromNow(7),
        repeatDays: 7,
        message: 'Repeats every 7 days.',
      },
      {
        id: 'routine-haircut-14d',
        title: 'Haircut',
        resetAt: daysFromNow(14),
        repeatDays: 14,
        message: 'Repeats every 2 weeks.',
      },
      {
        id: 'routine-bedsheets-carpet-14d',
        title: 'Clean Bedsheets + Carpet',
        resetAt: daysFromNow(14),
        repeatDays: 14,
        message: 'Repeats every 2 weeks.',
      },
      {
        id: 'codex-usage-reset-2026-08-15-1328',
        title: 'Codex Usage Reset',
        resetAt: new Date(2026, 7, 15, 13, 28, 0, 0).toISOString(),
        repeatDays: 0,
        message: 'Resets Aug 15, 2026 at 1:28 PM.',
      },
      {
        id: 'claude-usage-reset-2026-08-14-1459',
        title: 'Claude Usage Reset',
        resetAt: new Date(2026, 7, 14, 14, 59, 0, 0).toISOString(),
        repeatDays: 0,
        message: 'Resets Friday, Aug 14, 2026 at 2:59 PM.',
      },
    ];
  }

  // ShareBot runs every second day at 8:00, counting from the Aug 2026 cycle.
  function nextShareBotCycle() {
    const now = Date.now();
    const base = new Date(2026, 7, 9, 8, 0, 0, 0);
    const cycle = new Date(base);
    while (cycle.getTime() <= now) cycle.setDate(cycle.getDate() + 2);
    return cycle;
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
      order: index,
    };
  }

  // A repeating card that has gone past its time rolls forward to its next
  // occurrence rather than sitting there expired, keeping the hour it was set
  // to. One-off cards are left alone: "Expired" is the right answer for those.
  function rollForward(card) {
    if (!card.repeatDays || card.status === 'completed') return false;
    const next = new Date(card.resetAt);
    if (Number.isNaN(next.getTime()) || next.getTime() > Date.now()) return false;
    while (next.getTime() <= Date.now()) next.setDate(next.getDate() + card.repeatDays);
    card.resetAt = next.toISOString();
    card.fired = false;
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
    const cards = source.map(normalizeCard).filter(Boolean);
    try {
      if (!localStorage.getItem(IPHONE_UPDATE_MIGRATION_KEY)) {
        if (!cards.some(card => card.id === 'routine-iphone-app-updates-7d')) {
          cards.unshift(normalizeCard({
            id: 'routine-iphone-app-updates-7d',
            title: 'Check iPhone App Updates',
            resetAt: nextWeekdayAt(0, 19),
            repeatDays: 7,
            message: 'Check the App Store for available updates every Sunday.',
            createdAt: Date.now(),
            status: 'active',
          }, 0));
        }
        localStorage.setItem(IPHONE_UPDATE_MIGRATION_KEY, '1');
      }
    } catch (err) {
      /* Storage may be blocked; the rest of the countdown page still works. */
    }
    let happyHour = cards.find(card => card.id === HAPPY_HOUR_ID);
    if (!happyHour) {
      happyHour = normalizeCard({ id: HAPPY_HOUR_ID, title: 'Happy Hour', resetAt: new Date().toISOString() }, cards.length);
      cards.push(happyHour);
    }
    syncHappyHourCard(happyHour);
    cards.forEach(rollForward);
    return cards;
  }

  function saveCards() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cards.filter(card => card.source !== 'office')));
    } catch (err) {
      /* A full or blocked localStorage should not take the page down. */
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
      const repeatDays = { daily: 1, weekday: 1, weekly: 7, biweekly: 14, monthly: 30 };
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
    return state.cards
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
    const open = state.openId === card.id;
    const bodyId = `rst-body-${escHtml(card.id)}`;

    if (card.source === 'office') return `
      <article class="rst-card${open ? ' is-open' : ''}" data-id="${escHtml(card.id)}" data-state="${view.state}" style="--rst-color: ${icon.color}">
        <button type="button" class="rst-head" data-action="toggle" aria-expanded="${open}" aria-controls="${bodyId}">
          <span class="rst-icon" aria-hidden="true">${icon.glyph}</span>
          <span class="rst-head-main"><span class="rst-head-top"><span class="rst-title">${escHtml(card.title)}</span><span class="ao-status ao-status--info rst-state">Shared</span></span><span class="rst-time" data-role="time">${escHtml(timeLabel(view))}</span><span class="rst-when" data-role="when">${escHtml(whenLabel(view))}</span></span>
          <span class="rst-chevron" aria-hidden="true">â–¾</span>
        </button>
        <div class="rst-body" id="${bodyId}"><div class="rst-body-inner"><div class="rst-message">${escHtml(card.message)}</div>${card.notes ? `<p>${escHtml(card.notes)}</p>` : ''}<div class="rst-footnote">Shared Agent Office countdown · managed by Penny</div></div></div>
      </article>`;

    return `
      <article class="rst-card${open ? ' is-open' : ''}${state.savedId === card.id ? ' is-saved' : ''}"
               data-id="${escHtml(card.id)}" data-state="${view.state}" style="--rst-color: ${icon.color}">
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

  function render() {
    const list = el('reset-cards');
    if (!list) return;

    const views = sortedViews();
    state.order = views.map(view => view.card.id).join('|');
    list.innerHTML = views.map(cardHtml).join('');

    const empty = el('rst-empty');
    if (empty) {
      const nothingAtAll = !state.cards.length;
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
      const live = state.cards.map(viewOf).filter(view => view.state === 'active').length;
      count.textContent = state.cards.length
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

    list.querySelectorAll('.rst-card').forEach(node => {
      const card = state.cards.find(item => item.id === node.dataset.id);
      if (!card) return;
      const view = viewOf(card);
      const meta = STATES[view.state];

      const title = node.querySelector('[data-role="title"]');
      if (title) title.textContent = card.title;

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

      if (view.state === 'expired' && !card.fired && card.webhookUrl) fireWebhook(card.id, true);
    });

    if (orderChanged) saveCards();
    // Re-sorting under a finger that is mid-edit is worse than a stale order,
    // so the list only re-flows once nothing is open.
    if (!state.openId && !isFormOpen()) {
      const next = sortedViews().map(view => view.card.id).join('|');
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

    const retimed = draft.resetAt !== card.resetAt;
    card.title = draft.title;
    card.resetAt = draft.resetAt;
    card.repeatDays = draft.repeatDays;
    card.webhookUrl = draft.webhookUrl;
    if (retimed) card.fired = false;
    card.message = retimed ? 'Saved. Webhook firing re-armed for the new time.' : 'Saved.';

    saveCards();
    state.savedId = id;
    state.openId = '';
    render();
  }

  function deleteCard(id) {
    const card = state.cards.find(item => item.id === id);
    if (!card) return;
    if (!window.confirm(`Delete "${card.title}"?`)) return;
    state.cards = state.cards.filter(item => item.id !== id);
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
    saveCards();
    render();
  }

  function toggleComplete(id) {
    const card = state.cards.find(item => item.id === id);
    if (!card) return;
    card.status = card.status === 'completed' ? 'active' : 'completed';
    card.message = card.status === 'completed' ? 'Marked done.' : 'Reopened.';
    saveCards();
    render();
  }

  function clearWebhook(id, node) {
    const input = node.querySelector('[data-field="webhookUrl"]');
    if (input) input.value = '';
    const card = state.cards.find(item => item.id === id);
    if (card) {
      card.webhookUrl = '';
      saveCards();
    }
    setMessage(id, 'Webhook cleared.');
  }

  // Pushcut is fire-and-forget: no-cors means the response is opaque, so a
  // resolved fetch is the most this can honestly claim.
  async function fireWebhook(id, auto, override) {
    const card = state.cards.find(item => item.id === id);
    if (!card) return;
    const url = (override == null ? card.webhookUrl : override).trim();
    if (!url) return setMessage(id, 'No Pushcut webhook URL on this card yet.');
    // Fired is set before the request so a slow network cannot queue up a
    // second send on the next tick.
    if (auto) card.fired = true;

    setMessage(id, auto ? 'Countdown landed — sending to Pushcut...' : 'Sending a test to Pushcut...');
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          title: card.title,
          resetAt: card.resetAt,
          event: auto ? 'countdown_reached_zero' : 'manual_test',
        }),
      });
      setMessage(id, auto ? 'Sent to Pushcut when the countdown landed.' : 'Test sent to Pushcut.');
    } catch (err) {
      if (auto) card.fired = false;
      setMessage(id, 'Could not reach the webhook. Check the URL and try again.');
    }
    saveCards();
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

  function addFromForm() {
    const title = el('rst-new-title').value.trim();
    const resetAt = fromDateTime(el('rst-new-date').value, el('rst-new-time').value);
    if (!title) return showFormError('Give the countdown a name.');
    if (!resetAt) return showFormError('Pick the date and time it lands.');

    const card = normalizeCard({
      id: randomId(),
      title,
      resetAt,
      repeatDays: Number(el('rst-new-repeat').value) || 0,
      webhookUrl: el('rst-new-webhook').value.trim(),
      status: 'active',
      createdAt: Date.now(),
      message: 'Added.',
    }, state.cards.length);

    state.cards.push(card);
    saveCards();
    closeForm();
    state.savedId = card.id;
    render();
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
        return fireWebhook(id, false, input ? input.value : undefined);
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
    }

    fillToolbar();
    render();
    if (!state.tickTimer) state.tickTimer = setInterval(tick, TICK_MS);
  }

  return { init, setSort, setFilter, openForm, closeForm, addFromForm, happyHourDetails };
})();
