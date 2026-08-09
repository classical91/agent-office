// Countdowns page — the cards, the three sections and the add/edit form.
//
// The arithmetic that decides what a card says lives on the server
// (countdowns.js), so a phone and a browser agree about what is due. This file
// draws what the server worked out and re-counts only the "time left" label
// between refreshes, because a clock that does not move does not read as a
// countdown.
//
// Reading is open; adding, editing and deleting sit behind the same passphrase
// as the Dropbox, so writes go through ensureDropsSession first.

window.AOCountdowns = (() => {
  const REFRESH_MS = 5 * 60 * 1000;
  const TICK_MS = 1000;

  const SECTIONS = [
    { key: 'today', title: 'Today', hint: 'Due before midnight' },
    { key: 'week', title: 'This Week', hint: 'The next seven days' },
    { key: 'later', title: 'Later', hint: 'Everything further out' },
  ];

  const REPEAT_LABELS = {
    none: 'One-off',
    daily: 'Daily',
    weekday: 'Weekdays',
    weekly: 'Weekly',
    monthly: 'Monthly',
  };

  const state = {
    payload: null,
    categories: [],
    repeats: [],
    filterCategory: '',
    showEvents: true,
    loaded: false,
    error: '',
    editingId: '',
    formCategory: 'deadline',
    formRepeat: 'none',
    refreshTimer: null,
    tickTimer: null,
    initialized: false,
  };

  // ─── Helpers ───────────────────────────────────────────────────────────

  function escHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function el(id) { return document.getElementById(id); }

  function pad(value) { return String(value).padStart(2, '0'); }

  function categoryColor(id) {
    const known = state.categories.find(item => item.id === id);
    return known ? known.color : '#94a3b8';
  }

  // Mirrors describeRemaining() in countdowns.js. The server's copy is what the
  // roll-up and the phone see; this one only has to keep the label moving
  // between refreshes.
  function describeRemaining(ms) {
    const overdue = ms < 0;
    const abs = Math.abs(ms);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor((abs % 86400000) / 3600000);
    const minutes = Math.floor((abs % 3600000) / 60000);
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

    let label;
    if (days > 0) label = hours > 0 ? `${plural(days, 'day')} ${plural(hours, 'hr')}` : plural(days, 'day');
    else if (hours > 0) label = minutes > 0 ? `${plural(hours, 'hr')} ${plural(minutes, 'min')}` : plural(hours, 'hr');
    else if (minutes > 0) label = plural(minutes, 'min');
    else label = 'now';

    return overdue ? (label === 'now' ? 'now' : `${label} ago`) : label;
  }

  function formatWhen(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  // <input type="datetime-local"> wants local wall-clock time with no zone, and
  // the API speaks ISO instants. These two convert between them.
  function toLocalInputValue(iso) {
    const date = iso ? new Date(iso) : new Date();
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function fromLocalInputValue(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  function defaultTarget() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    return date;
  }

  // ─── Data ──────────────────────────────────────────────────────────────

  async function load() {
    try {
      const payload = await requestJson('/api/countdowns');
      state.payload = payload;
      state.categories = Array.isArray(payload.categories) ? payload.categories : [];
      state.repeats = Array.isArray(payload.repeats) ? payload.repeats : [];
      state.loaded = true;
      state.error = '';
    } catch (error) {
      state.error = error.message || 'Could not load countdowns.';
    }
    render();
  }

  // Every write needs the passphrase. Asking for it once, before the request,
  // beats letting the request 401 and guessing what to do with the half-typed
  // form behind the modal.
  async function writeJson(url, options) {
    if (!(await ensureDropsSession(true))) return null;
    return requestJson(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  }

  // ─── Rendering ─────────────────────────────────────────────────────────

  function visibleItems(items) {
    return items.filter(item => {
      if (!state.showEvents && item.kind === 'event') return false;
      if (state.filterCategory && item.category !== state.filterCategory) return false;
      return true;
    });
  }

  function renderSummary() {
    const target = el('cd-summary');
    if (!target) return;
    const counts = (state.payload && state.payload.counts) || {};
    const stats = [
      { label: 'Today', value: counts.today || 0 },
      { label: 'This week', value: counts.week || 0 },
      { label: 'Countdowns', value: counts.countdowns || 0 },
      { label: 'Calendar', value: counts.events || 0 },
      { label: 'Overdue', value: counts.overdue || 0, alert: (counts.overdue || 0) > 0 },
    ];
    target.innerHTML = stats.map(stat => `
      <div class="cd-stat${stat.alert ? ' alert' : ''}">
        <div class="cd-stat-value">${stat.value}</div>
        <div class="cd-stat-label">${escHtml(stat.label)}</div>
      </div>
    `).join('');
  }

  function renderBanner() {
    const target = el('cd-banner');
    if (!target) return;
    const calendar = (state.payload && state.payload.calendar) || {};

    if (state.error) {
      target.className = 'cd-banner warn';
      target.style.display = 'block';
      target.textContent = state.error;
      return;
    }
    if (calendar.state === 'error') {
      target.className = 'cd-banner warn';
      target.style.display = 'block';
      target.textContent = 'Google Calendar could not be read, so only your own countdowns are shown. The cards below are still live.';
      return;
    }
    if (calendar.state === 'disconnected') {
      target.className = 'cd-banner';
      target.style.display = 'block';
      target.innerHTML = 'Google Calendar is not connected, so this page is showing countdowns only. '
        + 'Connect it in <a href="/settings.html" style="color:var(--accent);">Settings</a> to see upcoming events here too.';
      return;
    }
    target.style.display = 'none';
  }

  function renderFilters() {
    const select = el('cd-filter-category');
    if (!select) return;
    const options = ['<option value="">All categories</option>']
      .concat(state.categories.map(item =>
        `<option value="${escHtml(item.id)}">${escHtml(item.label)}</option>`
      ));
    select.innerHTML = options.join('');
    select.value = state.filterCategory;

    const eventsBtn = el('cd-toggle-events');
    if (eventsBtn) {
      eventsBtn.textContent = state.showEvents ? 'Hide calendar events' : 'Show calendar events';
      eventsBtn.classList.toggle('ghost', !state.showEvents);
    }
  }

  function cardHtml(item) {
    const classes = ['cd-card'];
    if (item.kind === 'event') classes.push('event');
    if (item.overdue) classes.push('overdue');
    else if (item.urgent) classes.push('urgent');
    if (item.weekendQuiet) classes.push('quiet');

    const chips = [`<span class="cd-chip">${escHtml(item.categoryLabel)}</span>`];
    if (item.repeat && item.repeat !== 'none') {
      chips.push(`<span class="cd-chip plain">${escHtml(REPEAT_LABELS[item.repeat] || item.repeat)}</span>`);
    }
    if (item.pinned) chips.push('<span class="cd-chip plain">Pinned</span>');
    if (item.inProgress) chips.push('<span class="cd-chip plain">Happening now</span>');
    if (item.weekendQuiet) chips.push('<span class="cd-chip plain">Weekend — no pressure</span>');

    const when = item.overdue
      ? `Was due ${escHtml(formatWhen(item.occurrence_at))}`
      : escHtml(formatWhen(item.occurrence_at));

    const action = item.next_action
      ? `<div class="cd-card-action"><b>Next action</b>${escHtml(item.next_action)}</div>`
      : '';
    const notes = item.notes ? `<div class="cd-card-notes">${escHtml(item.notes)}</div>` : '';

    // Calendar events are owned by the calendar. Editing one here would mean
    // two places to change the same thing, so an event card links out instead.
    const actions = item.kind === 'event'
      ? '<div class="cd-card-actions"><a class="cd-btn ghost" style="text-align:center; text-decoration:none;" href="/calendar-v3.html">Open calendar</a></div>'
      : `<div class="cd-card-actions">
           <button class="cd-btn" onclick="AOCountdowns.openForm('${escHtml(item.id)}')">Edit</button>
           <button class="cd-btn ghost" onclick="AOCountdowns.togglePinned('${escHtml(item.id)}')">${item.pinned ? 'Unpin' : 'Pin'}</button>
           <button class="cd-btn danger" onclick="AOCountdowns.remove('${escHtml(item.id)}')">Delete</button>
         </div>`;

    return `
      <article class="${classes.join(' ')}" style="--cd-color:${escHtml(item.color)}">
        <div class="cd-card-head">
          <div class="cd-card-title">${escHtml(item.title)}</div>
          <div class="cd-card-left" data-occurrence="${escHtml(item.occurrence_at || '')}">${escHtml(item.remaining ? item.remaining.label : '')}</div>
        </div>
        <div class="cd-chip-row">${chips.join('')}</div>
        <div class="cd-card-when">${when}</div>
        ${action}
        ${notes}
        ${actions}
      </article>
    `;
  }

  function renderSections() {
    const target = el('cd-sections');
    if (!target) return;

    if (!state.loaded) {
      target.innerHTML = '<div class="cd-empty">Loading…</div>';
      return;
    }

    const groups = (state.payload && state.payload.groups) || { today: [], week: [], later: [] };
    const total = SECTIONS.reduce((sum, section) => sum + visibleItems(groups[section.key] || []).length, 0);

    if (!total) {
      target.innerHTML = `
        <div class="cd-empty">
          Nothing on the clock yet.<br/>
          Add a deadline, a shift, a weekly routine or a trading date and it will show up here.
        </div>`;
      return;
    }

    target.innerHTML = SECTIONS.map(section => {
      const items = visibleItems(groups[section.key] || []);
      const body = items.length
        ? `<div class="cd-grid">${items.map(cardHtml).join('')}</div>`
        : `<div class="cd-empty">Nothing ${escHtml(section.title.toLowerCase())}.</div>`;
      return `
        <section class="cd-section">
          <div class="cd-section-head">
            <div class="cd-section-title">${escHtml(section.title)}</div>
            <div class="cd-section-count">${items.length}</div>
            <div class="cd-section-hint">${escHtml(section.hint)}</div>
          </div>
          ${body}
        </section>
      `;
    }).join('');
  }

  function render() {
    renderSummary();
    renderBanner();
    renderFilters();
    renderSections();
  }

  // Only the "time left" labels move between refreshes; re-rendering the whole
  // page every second would throw away scroll position and any open menu.
  function tick() {
    const now = Date.now();
    document.querySelectorAll('.cd-card-left[data-occurrence]').forEach(node => {
      const iso = node.getAttribute('data-occurrence');
      if (!iso) return;
      const at = Date.parse(iso);
      if (Number.isNaN(at)) return;
      node.textContent = describeRemaining(at - now);
    });
  }

  // ─── The form ──────────────────────────────────────────────────────────

  function findCountdown(id) {
    const items = (state.payload && state.payload.items) || [];
    return items.find(item => item.id === id && item.kind === 'countdown') || null;
  }

  function renderPickers() {
    const categoryPicker = el('cd-form-category');
    if (categoryPicker) {
      categoryPicker.innerHTML = state.categories.map(item => `
        <button type="button"
          class="cd-picker-option${item.id === state.formCategory ? ' on' : ''}"
          style="--cd-color:${escHtml(item.color)}"
          onclick="AOCountdowns.setFormCategory('${escHtml(item.id)}')">${escHtml(item.label)}</button>
      `).join('');
    }

    const repeatPicker = el('cd-form-repeat');
    if (repeatPicker) {
      repeatPicker.innerHTML = state.repeats.map(id => `
        <button type="button"
          class="cd-picker-option${id === state.formRepeat ? ' on' : ''}"
          onclick="AOCountdowns.setFormRepeat('${escHtml(id)}')">${escHtml(REPEAT_LABELS[id] || id)}</button>
      `).join('');
    }

    const hint = el('cd-form-hint');
    if (hint) {
      hint.textContent = state.formCategory === 'trading'
        ? 'Trading countdowns skip Saturday and Sunday, and go quiet on the weekend.'
        : (state.formRepeat === 'weekday' ? 'Weekday routines skip Saturday and Sunday.' : '');
    }
  }

  function setFormError(message) {
    const node = el('cd-form-error');
    if (!node) return;
    node.textContent = message || '';
    node.style.display = message ? 'block' : 'none';
  }

  function openForm(id) {
    const existing = id ? findCountdown(id) : null;
    state.editingId = existing ? existing.id : '';
    state.formCategory = existing ? existing.category : 'deadline';
    state.formRepeat = existing ? existing.repeat : 'none';

    el('cd-modal-title').textContent = existing ? 'Edit countdown' : 'New countdown';
    el('cd-form-title-input').value = existing ? existing.title : '';
    el('cd-form-target').value = toLocalInputValue(existing ? existing.target_at : defaultTarget().toISOString());
    el('cd-form-action').value = existing ? existing.next_action : '';
    el('cd-form-notes').value = existing ? existing.notes : '';
    el('cd-form-save').textContent = existing ? 'Save changes' : 'Add countdown';

    setFormError('');
    renderPickers();
    el('cd-modal').classList.add('open');
    setTimeout(() => el('cd-form-title-input').focus(), 60);
  }

  function closeForm() {
    el('cd-modal').classList.remove('open');
    state.editingId = '';
  }

  function setFormCategory(id) {
    state.formCategory = id;
    renderPickers();
  }

  function setFormRepeat(id) {
    state.formRepeat = id;
    renderPickers();
  }

  async function save() {
    const title = el('cd-form-title-input').value.trim();
    const targetAt = fromLocalInputValue(el('cd-form-target').value);
    if (!title) { setFormError('Give the countdown a title.'); return; }
    if (!targetAt) { setFormError('Pick the date and time it is due.'); return; }

    const body = {
      title,
      target_at: targetAt,
      category: state.formCategory,
      repeat: state.formRepeat,
      next_action: el('cd-form-action').value.trim(),
      notes: el('cd-form-notes').value.trim(),
    };

    const button = el('cd-form-save');
    button.disabled = true;
    try {
      const result = state.editingId
        ? await writeJson(`/api/countdowns/${encodeURIComponent(state.editingId)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : await writeJson('/api/countdowns', { method: 'POST', body: JSON.stringify(body) });
      // A null result means the passphrase prompt was cancelled — the form
      // stays open with everything still typed in.
      if (!result) return;
      closeForm();
      await load();
    } catch (error) {
      setFormError(error.message || 'Could not save the countdown.');
    } finally {
      button.disabled = false;
    }
  }

  async function togglePinned(id) {
    const existing = findCountdown(id);
    if (!existing) return;
    try {
      const result = await writeJson(`/api/countdowns/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ pinned: !existing.pinned }),
      });
      if (result) await load();
    } catch (error) {
      alert(error.message || 'Could not update the countdown.');
    }
  }

  async function remove(id) {
    const existing = findCountdown(id);
    if (!existing) return;
    if (!confirm(`Delete "${existing.title}"?`)) return;
    try {
      const result = await writeJson(`/api/countdowns/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (result) await load();
    } catch (error) {
      alert(error.message || 'Could not delete the countdown.');
    }
  }

  // ─── Filters ───────────────────────────────────────────────────────────

  function setCategoryFilter(value) {
    state.filterCategory = value || '';
    render();
  }

  function toggleEvents() {
    state.showEvents = !state.showEvents;
    render();
  }

  // ─── Wiring ────────────────────────────────────────────────────────────

  function enter() {
    if (!state.initialized) {
      state.initialized = true;
      load();
      state.refreshTimer = setInterval(load, REFRESH_MS);
      state.tickTimer = setInterval(tick, TICK_MS);
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && el('cd-modal').classList.contains('open')) closeForm();
      });
      return;
    }
    load();
  }

  return {
    enter,
    refresh: load,
    openForm,
    closeForm,
    setFormCategory,
    setFormRepeat,
    save,
    remove,
    togglePinned,
    setCategoryFilter,
    toggleEvents,
  };
})();

if (typeof VIEW_HANDLERS !== 'undefined') {
  VIEW_HANDLERS.countdowns = { enter: () => window.AOCountdowns.enter() };
}
