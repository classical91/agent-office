// Planning Mode — the weekly planning checklist.
//
// The list is kept by hand and it survives the week. Ticking a box is a request
// to CoachClaw ("find time for this in the coming week"), not a claim that the
// thing is done; marking it Done is the claim. The server keeps the two as
// separate fields (see planning.js) and this page keeps them as separate
// gestures: a checkbox on the left, a Done button on the right, never the same
// control doing both.
//
// It leans on app-shared.js for the Office session (requestJson /
// ensureDropsSession), because the planning list sits behind the same
// passphrase as everything else personal in here.

window.AOPlanning = (() => {
  const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
  // ISO weekdays: Monday is 1, matching the scheduler.
  const DAYS = [
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
    { value: 7, label: 'Sun' },
  ];
  const TIME_CHOICES = [
    { value: '', label: 'Any time' },
    { value: 'morning', label: 'Morning' },
    { value: 'afternoon', label: 'Afternoon' },
    { value: 'evening', label: 'Evening' },
  ];

  const state = {
    items: [],
    counts: { total: 0, scheduled: 0, completed: 0, parked: 0 },
    editingId: '',
    draftDays: [],
    loaded: false,
    locked: false,
    initialized: false,
  };

  function el(id) { return document.getElementById(id); }

  function escHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDuration(minutes) {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }

  function formatDays(days) {
    if (!days || !days.length) return '';
    return days.map(day => (DAYS.find(entry => entry.value === day) || {}).label).filter(Boolean).join(' ');
  }

  function formatTime(value) {
    if (!value) return '';
    const choice = TIME_CHOICES.find(entry => entry.value === value);
    return choice ? choice.label : value;
  }

  // ─── Server ────────────────────────────────────────────────────────────

  async function load() {
    try {
      const payload = await requestJson('/api/planning');
      state.items = Array.isArray(payload.items) ? payload.items : [];
      state.counts = payload.counts || state.counts;
      state.loaded = true;
      state.locked = false;
    } catch (error) {
      if (error.status === 401) {
        state.locked = true;
        state.loaded = false;
        state.items = [];
        return;
      }
      throw error;
    }
  }

  async function unlock() {
    if (!(await ensureDropsSession(true))) return;
    await load();
    render();
  }

  async function withErrors(work, fallback) {
    try {
      await work();
    } catch (error) {
      if (error.status === 401) {
        state.locked = true;
        render();
        alert('Your Agent Office session expired. Log in again to keep planning.');
        return;
      }
      alert(error.message || fallback);
    }
  }

  // ─── Actions ───────────────────────────────────────────────────────────

  async function addItem() {
    const input = el('planning-new-title');
    const title = (input && input.value || '').trim();
    if (!title) return;
    await withErrors(async () => {
      await requestJson('/api/planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // New items arrive ticked: you are adding it because you want it in the
        // week. Untick it to park it instead.
        body: JSON.stringify({ title, schedule_this_week: true }),
      });
      input.value = '';
      await load();
      render();
      const refocus = el('planning-new-title');
      if (refocus) refocus.focus();
    }, 'Could not add that planning item.');
  }

  async function patch(id, body) {
    await withErrors(async () => {
      await requestJson(`/api/planning/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await load();
      render();
    }, 'Could not save that change.');
  }

  // The checkbox. Scheduling only — it never touches `completed`.
  function toggleSchedule(id, checked) {
    return patch(id, { schedule_this_week: Boolean(checked) });
  }

  // The Done button. Completion only — the server clears the scheduling request
  // when something is finished, and restores nothing when it is un-done, which
  // is what stops "done on Monday" from silently re-booking itself.
  function toggleCompleted(id) {
    const item = state.items.find(entry => entry.id === id);
    if (!item) return Promise.resolve();
    return patch(id, { completed: !item.completed });
  }

  async function removeItem(id) {
    const item = state.items.find(entry => entry.id === id);
    if (!item) return;
    if (!confirm(`Delete "${item.title}" from your planning list?`)) return;
    await withErrors(async () => {
      await requestJson(`/api/planning/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (state.editingId === id) state.editingId = '';
      await load();
      render();
    }, 'Could not delete that planning item.');
  }

  function openEditor(id) {
    state.editingId = id;
    const item = state.items.find(entry => entry.id === id);
    state.draftDays = item ? item.preferred_days.slice() : [];
    render();
  }

  function closeEditor() {
    state.editingId = '';
    state.draftDays = [];
    render();
  }

  function toggleDraftDay(day) {
    const value = Number(day);
    state.draftDays = state.draftDays.includes(value)
      ? state.draftDays.filter(entry => entry !== value)
      : [...state.draftDays, value].sort((a, b) => a - b);
    render();
  }

  async function saveEditor(id) {
    const title = (el(`planning-edit-title-${id}`) || {}).value || '';
    if (!title.trim()) {
      alert('A planning item needs a title.');
      return;
    }
    const durationRaw = ((el(`planning-edit-duration-${id}`) || {}).value || '').trim();
    await withErrors(async () => {
      await requestJson(`/api/planning/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          notes: (el(`planning-edit-notes-${id}`) || {}).value || '',
          estimated_duration: durationRaw === '' ? null : Number(durationRaw),
          priority: (el(`planning-edit-priority-${id}`) || {}).value || 'normal',
          preferred_time: (el(`planning-edit-time-${id}`) || {}).value || '',
          preferred_days: state.draftDays,
        }),
      });
      state.editingId = '';
      state.draftDays = [];
      await load();
      render();
    }, 'Could not save that planning item.');
  }

  // ─── Render ────────────────────────────────────────────────────────────

  function chipsFor(item) {
    const chips = [];
    if (item.estimated_duration) chips.push(`<span class="planning-chip">${escHtml(formatDuration(item.estimated_duration))}</span>`);
    if (item.priority && item.priority !== 'normal') {
      chips.push(`<span class="planning-chip planning-chip--priority-${escHtml(item.priority)}">${escHtml(item.priority)}</span>`);
    }
    if (item.preferred_time) chips.push(`<span class="planning-chip">${escHtml(formatTime(item.preferred_time))}</span>`);
    if (item.preferred_days && item.preferred_days.length) {
      chips.push(`<span class="planning-chip">${escHtml(formatDays(item.preferred_days))}</span>`);
    }
    if (item.completed) chips.push('<span class="planning-chip planning-chip--done">Done</span>');
    return chips.length ? `<div class="planning-chips">${chips.join('')}</div>` : '';
  }

  function renderEditor(item) {
    const id = escHtml(item.id);
    const priorityOptions = PRIORITIES
      .map(value => `<option value="${value}"${item.priority === value ? ' selected' : ''}>${value}</option>`)
      .join('');
    const timeOptions = TIME_CHOICES
      .map(choice => `<option value="${choice.value}"${item.preferred_time === choice.value ? ' selected' : ''}>${escHtml(choice.label)}</option>`)
      .join('');
    const dayButtons = DAYS.map(day => `<button type="button" class="planning-day${state.draftDays.includes(day.value) ? ' is-on' : ''}"
      onclick="AOPlanning.toggleDraftDay(${day.value})" aria-pressed="${state.draftDays.includes(day.value)}">${day.label}</button>`).join('');

    return `<div class="planning-edit">
      <div class="planning-field">
        <label class="planning-label" for="planning-edit-title-${id}">Title</label>
        <input class="planning-input" id="planning-edit-title-${id}" type="text" maxlength="200" value="${escHtml(item.title)}"/>
      </div>
      <div class="planning-edit-row">
        <div class="planning-field">
          <label class="planning-label" for="planning-edit-duration-${id}">How long (minutes)</label>
          <input class="planning-input" id="planning-edit-duration-${id}" type="number" min="5" max="1440" step="5"
            placeholder="Leave blank to let CoachClaw guess" value="${item.estimated_duration || ''}"/>
        </div>
        <div class="planning-field">
          <label class="planning-label" for="planning-edit-priority-${id}">Priority</label>
          <select class="planning-input" id="planning-edit-priority-${id}">${priorityOptions}</select>
        </div>
        <div class="planning-field">
          <label class="planning-label" for="planning-edit-time-${id}">Preferred time</label>
          <select class="planning-input" id="planning-edit-time-${id}">${timeOptions}</select>
        </div>
      </div>
      <div class="planning-field">
        <span class="planning-label">Preferred days</span>
        <div class="planning-days">${dayButtons}</div>
      </div>
      <div class="planning-field">
        <label class="planning-label" for="planning-edit-notes-${id}">Notes</label>
        <textarea class="planning-input" id="planning-edit-notes-${id}" maxlength="2000"
          placeholder="Anything CoachClaw should know when it places this.">${escHtml(item.notes)}</textarea>
      </div>
      <div class="planning-item-actions">
        <button class="planning-btn planning-btn--primary planning-btn--sm" onclick="AOPlanning.saveEditor('${id}')">Save</button>
        <button class="planning-btn planning-btn--ghost planning-btn--sm" onclick="AOPlanning.closeEditor()">Cancel</button>
      </div>
    </div>`;
  }

  function renderItem(item) {
    const id = escHtml(item.id);
    if (state.editingId === item.id) {
      return `<div class="planning-item${item.schedule_this_week ? ' is-scheduled' : ''}">${renderEditor(item)}</div>`;
    }
    const classes = ['planning-item'];
    if (item.schedule_this_week && !item.completed) classes.push('is-scheduled');
    if (item.completed) classes.push('is-completed');
    return `<div class="${classes.join(' ')}">
      <input class="planning-check" type="checkbox" id="planning-check-${id}"
        ${item.schedule_this_week ? 'checked' : ''}
        onchange="AOPlanning.toggleSchedule('${id}', this.checked)"
        aria-label="Schedule &quot;${escHtml(item.title)}&quot; this week"/>
      <div class="planning-item-body">
        <label class="planning-item-title" for="planning-check-${id}">${escHtml(item.title)}</label>
        ${item.notes ? `<div class="planning-item-notes">${escHtml(item.notes)}</div>` : ''}
        ${chipsFor(item)}
      </div>
      <div class="planning-item-actions">
        <button class="planning-btn planning-btn--sm" onclick="AOPlanning.toggleCompleted('${id}')">${item.completed ? 'Not done' : 'Done'}</button>
        <button class="planning-btn planning-btn--sm" onclick="AOPlanning.openEditor('${id}')">Edit</button>
        <button class="planning-btn planning-btn--sm planning-btn--danger" onclick="AOPlanning.removeItem('${id}')">Delete</button>
      </div>
    </div>`;
  }

  function renderGroup(title, note, items, emptyCopy) {
    return `<div class="planning-group">
      <div class="planning-group-head">${escHtml(title)} <span class="planning-group-note">${escHtml(note)}</span></div>
      ${items.length ? items.map(renderItem).join('') : `<div class="planning-empty">${escHtml(emptyCopy)}</div>`}
    </div>`;
  }

  function renderSummary() {
    const wrap = el('planning-summary');
    if (!wrap) return;
    const counts = state.counts || {};
    wrap.innerHTML = `
      <span class="planning-stat planning-stat--scheduled"><b>${counts.scheduled || 0}</b> to schedule</span>
      <span class="planning-stat"><b>${counts.parked || 0}</b> kept for later</span>
      <span class="planning-stat"><b>${counts.completed || 0}</b> done</span>`;
  }

  function renderBrief() {
    const wrap = el('planning-brief');
    if (!wrap) return;
    const scheduled = state.items.filter(item => item.schedule_this_week && !item.completed);
    if (!scheduled.length) {
      wrap.innerHTML = '<div class="planning-empty">Nothing is ticked, so CoachClaw would schedule nothing this week.</div>';
      return;
    }
    wrap.innerHTML = `<div class="planning-brief-list">${scheduled.map(item => {
      const bits = [
        formatDuration(item.estimated_duration) || '60 min (assumed)',
        item.priority,
        formatTime(item.preferred_time),
        formatDays(item.preferred_days),
      ].filter(Boolean);
      return `<div class="planning-brief-row">
        <span class="planning-brief-title">${escHtml(item.title)}</span>
        <span>${escHtml(bits.join(' · '))}</span>
      </div>`;
    }).join('')}</div>`;
  }

  function render() {
    const list = el('planning-list');
    renderSummary();
    if (!list) return;

    if (state.locked) {
      list.innerHTML = `<div class="planning-empty">Your planning list is behind the Agent Office passphrase.<br/>
        <button class="planning-btn planning-btn--primary planning-btn--sm" onclick="AOPlanning.unlock()">Unlock</button></div>`;
      renderBrief();
      return;
    }
    if (!state.loaded) {
      list.innerHTML = '<div class="planning-empty">Loading your planning list…</div>';
      return;
    }

    const scheduled = state.items.filter(item => item.schedule_this_week && !item.completed);
    const parked = state.items.filter(item => !item.schedule_this_week && !item.completed);
    const completed = state.items.filter(item => item.completed);

    list.innerHTML = [
      renderGroup('Scheduling this week', 'ticked — CoachClaw will try to find time', scheduled,
        'Nothing ticked yet. Tick an item to ask CoachClaw to fit it into the week.'),
      renderGroup('Kept for later', 'unticked — stays on the list, out of this week', parked,
        'Nothing parked.'),
      completed.length ? renderGroup('Done', 'finished — kept as a record', completed, '') : '',
    ].join('');
    renderBrief();
  }

  // ─── Init ──────────────────────────────────────────────────────────────

  async function init() {
    if (state.initialized) return;
    state.initialized = true;
    render();

    const input = el('planning-new-title');
    if (input) {
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          addItem();
        }
      });
    }

    try {
      await load();
    } catch (error) {
      state.loaded = true;
      const list = el('planning-list');
      if (list) list.innerHTML = `<div class="planning-empty">${escHtml(error.message || 'Could not load your planning list.')}</div>`;
      return;
    }
    render();
    if (state.locked) await unlock();
  }

  return {
    init, unlock, render,
    addItem, toggleSchedule, toggleCompleted, removeItem,
    openEditor, closeEditor, saveEditor, toggleDraftDay,
  };
})();

if (typeof VIEW_HANDLERS !== 'undefined') {
  VIEW_HANDLERS.planning = { enter: () => window.AOPlanning.init() };
}
