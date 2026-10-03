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
    // The proposed week lives here and nowhere else until it is accepted.
    // Dropping a block, sending one back to the list or rescheduling it all
    // happen against this copy, which is what makes "review before it is final"
    // mean something.
    week: null,
    building: false,
    // Step 1. `workSchedule` is what is saved; `workDraft` is what is on screen
    // being corrected — a photo's reading or a hand-typed one, neither of them
    // real until Save.
    workSchedule: null,
    workSummary: null,
    workDraft: null,
    workNotes: '',
    workSource: 'manual',
    workReading: false,
    readerConfigured: false,
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

  function formatClock(date) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function formatDayHeading(date) {
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  }

  // ─── Server ────────────────────────────────────────────────────────────

  async function load() {
    try {
      const payload = await requestJson('/api/planning');
      state.items = Array.isArray(payload.items) ? payload.items : [];
      state.counts = payload.counts || state.counts;
      state.loaded = true;
      state.locked = false;
      await loadWorkSchedule();
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

  // ─── The week ──────────────────────────────────────────────────────────

  // Steps 4 and 5. The server does the placing; this only asks for it, and the
  // answer is a proposal — nothing here has touched the calendar.
  async function buildWeek() {
    if (state.building) return;
    state.building = true;
    render();
    await withErrors(async () => {
      state.week = await requestJson('/api/planning/week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    }, 'Could not build the week.');
    state.building = false;
    render();
  }

  function blockFor(planningItemId) {
    if (!state.week) return null;
    return (state.week.blocks || []).find(block => block.planning_item_id === planningItemId) || null;
  }

  function dropBlockLocally(planningItemId) {
    if (!state.week) return;
    state.week = {
      ...state.week,
      blocks: (state.week.blocks || []).filter(block => block.planning_item_id !== planningItemId),
    };
  }

  // Dropping a block leaves the item ticked: it is this placement that did not
  // work, not the intention behind it.
  function dropBlock(planningItemId) {
    dropBlockLocally(planningItemId);
    render();
  }

  // Sending something back to the list unticks it, which is the honest record of
  // "not this week" — and it stays on the list for the next one.
  async function sendBack(planningItemId) {
    dropBlockLocally(planningItemId);
    await patch(planningItemId, { schedule_this_week: false });
  }

  // Move one block without disturbing the rest: the others go back as pinned
  // commitments, so the new slot has to fit around the week you have already
  // agreed to.
  async function rescheduleBlock(planningItemId) {
    const current = blockFor(planningItemId);
    if (!current) return;
    await withErrors(async () => {
      const pinned = (state.week.blocks || [])
        .filter(block => block.planning_item_id !== planningItemId)
        .map(block => ({ title: block.title, start: block.start, end: block.end }));
      // The slot it is in now is pinned too, so "reschedule" cannot hand back
      // the same time it just gave.
      pinned.push({ title: current.title, start: current.start, end: current.end });

      const replacement = await requestJson('/api/planning/week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ only: [planningItemId], pinned }),
      });

      const placed = (replacement.blocks || [])[0];
      const blocks = (state.week.blocks || []).filter(block => block.planning_item_id !== planningItemId);
      const unscheduled = (state.week.unscheduled || []).filter(entry => entry.planning_item_id !== planningItemId);
      if (placed) blocks.push(placed);
      else unscheduled.push(...(replacement.unscheduled || []));

      blocks.sort((a, b) => new Date(a.start) - new Date(b.start));
      state.week = { ...state.week, blocks, unscheduled };
      render();
    }, 'Could not find another slot for that.');
  }

  function discardWeek() {
    state.week = null;
    render();
  }

  // Step 6's other half: the blocks that survived the review become real, through
  // the same endpoint every other scheduled block goes through.
  async function acceptWeek() {
    if (!state.week || !(state.week.blocks || []).length) return;
    await withErrors(async () => {
      await requestJson('/api/calendar/schedule/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: state.week.blocks }),
      });
      state.week = null;
      await load();
      render();
      alert('The week is on your calendar.');
    }, 'Could not add the week to your calendar.');
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

  function renderWeek() {
    const wrap = el('planning-week');
    const build = el('planning-build');
    if (build) {
      build.disabled = state.building || state.locked;
      build.textContent = state.building ? 'Building…' : (state.week ? 'Rebuild' : 'Build my week');
    }
    if (!wrap) return;

    if (state.building) {
      wrap.innerHTML = '<div class="planning-empty">Looking for time around everything else…</div>';
      return;
    }
    if (!state.week) {
      wrap.innerHTML = `<div class="planning-empty">${escHtml(
        state.counts.scheduled
          ? 'Nothing proposed yet. Build the week to see where the ticked items would go.'
          : 'Nothing is ticked, so there is nothing to place yet.'
      )}</div>`;
      return;
    }

    const blocks = state.week.blocks || [];
    const unscheduled = state.week.unscheduled || [];

    if (!blocks.length && !unscheduled.length) {
      wrap.innerHTML = '<div class="planning-empty">Nothing was ticked when this week was built.</div>';
      return;
    }

    const days = [];
    blocks.forEach(block => {
      const start = new Date(block.start);
      const key = start.toDateString();
      const day = days.find(entry => entry.key === key);
      if (day) day.blocks.push(block);
      else days.push({ key, date: start, blocks: [block] });
    });

    const dayMarkup = days.map(day => `<div class="planning-day-group">
      <div class="planning-day-head">${escHtml(formatDayHeading(day.date))}</div>
      ${day.blocks.map(block => {
        const id = escHtml(block.planning_item_id);
        const notes = [
          ...(block.reasons || []),
          block.duration_is_estimated ? 'Duration assumed — set one to place it better' : '',
        ].filter(Boolean);
        return `<div class="planning-block">
          <div class="planning-block-time">${escHtml(formatClock(new Date(block.start)))} – ${escHtml(formatClock(new Date(block.end)))}</div>
          <div class="planning-block-body">
            <div class="planning-block-title">${escHtml(block.title)}</div>
            ${notes.length ? `<div class="planning-block-why">${escHtml(notes.join(' · '))}</div>` : ''}
            ${(block.warnings || []).length ? `<div class="planning-block-warn">${escHtml(block.warnings.join(' · '))}</div>` : ''}
          </div>
          <div class="planning-item-actions">
            <button class="planning-btn planning-btn--sm" onclick="AOPlanning.rescheduleBlock('${id}')">Move</button>
            <button class="planning-btn planning-btn--sm" onclick="AOPlanning.dropBlock('${id}')">Not this week</button>
            <button class="planning-btn planning-btn--sm" onclick="AOPlanning.sendBack('${id}')">Back to list</button>
          </div>
        </div>`;
      }).join('')}
    </div>`).join('');

    const leftOver = unscheduled.length ? `<div class="planning-day-group">
      <div class="planning-day-head">No room found</div>
      ${unscheduled.map(entry => `<div class="planning-block planning-block--unplaced">
        <div class="planning-block-time">—</div>
        <div class="planning-block-body">
          <div class="planning-block-title">${escHtml(entry.title)}</div>
          <div class="planning-block-warn">${escHtml(entry.reason)}</div>
        </div>
      </div>`).join('')}
    </div>` : '';

    wrap.innerHTML = `${dayMarkup}${leftOver}
      <div class="planning-week-actions">
        <button class="planning-btn planning-btn--ghost planning-btn--sm" onclick="AOPlanning.discardWeek()">Discard</button>
        <button class="planning-btn planning-btn--primary planning-btn--sm"
          ${blocks.length ? '' : 'disabled'}
          onclick="AOPlanning.acceptWeek()">Accept &amp; add to calendar</button>
      </div>`;
  }

  function render() {
    const list = el('planning-list');
    renderSummary();
    renderWeek();
    // Drawn before the early returns below: the work schedule has its own
    // locked and empty states, and the list being unreadable is not a reason
    // to leave the panel above it blank.
    renderWorkSchedule();
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

  // ─── Work schedule (step 1) ────────────────────────────────────────────
  //
  // A photograph is a shortcut, never an authority. What comes back from the
  // reader goes into the same editable rows a typed schedule uses, and only
  // what is on screen when Save is pressed is stored — a rota nobody read back
  // is a week built on whatever the camera happened to catch.

  async function loadWorkSchedule() {
    try {
      const payload = await requestJson('/api/planning/work-schedule');
      state.workSchedule = payload.schedule || null;
      state.workSummary = payload.summary || null;
      state.readerConfigured = Boolean(payload.reader_configured);
      // Editing is only entered deliberately; loading does not interrupt it.
      if (!state.workDraft) state.workNotes = '';
    } catch (error) {
      if (error.status === 401) {
        state.workSchedule = null;
        state.workSummary = null;
        return;
      }
      throw error;
    }
  }

  function blankShift() {
    return {
      id: `draft-${Math.random().toString(36).slice(2, 8)}`,
      label: 'Work',
      days: [],
      start: '',
      end: '',
    };
  }

  function startWorkEdit(shifts) {
    state.workDraft = (shifts || []).map(shift => ({
      ...blankShift(),
      id: shift.id || `draft-${Math.random().toString(36).slice(2, 8)}`,
      label: shift.label || 'Work',
      days: Array.isArray(shift.days) ? shift.days.slice() : [],
      start: shift.start || '',
      end: shift.end || '',
    }));
    // Entering the form with nothing to edit is a form with nothing to fill in.
    // Adding it by hand should start you on the first row.
    if (!state.workDraft.length) state.workDraft.push(blankShift());
    renderWorkSchedule();
  }

  function editWorkSchedule() {
    startWorkEdit(state.workSchedule ? state.workSchedule.shifts : []);
  }

  // What a read photo does to the page, separated from the request that fetched
  // it so the correction form can be exercised without a model call.
  function applyWorkDraft(draft) {
    state.workNotes = (draft && draft.notes) || '';
    state.workSource = 'photo';
    startWorkEdit((draft && draft.shifts) || []);
  }

  function cancelWorkEdit() {
    state.workDraft = null;
    state.workNotes = '';
    state.workSource = 'manual';
    renderWorkSchedule();
  }

  function addWorkShift() {
    // Typed values on the rows already on screen are read back first, or adding
    // a second shift would blank the one being filled in.
    captureWorkDraft();
    if (!state.workDraft) state.workDraft = [];
    state.workDraft.push(blankShift());
    renderWorkSchedule();
  }

  function removeWorkShift(id) {
    if (!state.workDraft) return;
    captureWorkDraft();
    state.workDraft = state.workDraft.filter(shift => shift.id !== id);
    renderWorkSchedule();
  }

  // Typed values are read back out of the inputs before any re-render, so a
  // half-typed row survives toggling a day on another one.
  function captureWorkDraft() {
    if (!state.workDraft) return;
    state.workDraft.forEach(shift => {
      const label = el(`work-label-${shift.id}`);
      const start = el(`work-start-${shift.id}`);
      const end = el(`work-end-${shift.id}`);
      if (label) shift.label = label.value;
      if (start) shift.start = start.value;
      if (end) shift.end = end.value;
    });
  }

  function toggleWorkDay(id, day) {
    captureWorkDraft();
    const shift = (state.workDraft || []).find(entry => entry.id === id);
    if (!shift) return;
    const value = Number(day);
    shift.days = shift.days.includes(value)
      ? shift.days.filter(entry => entry !== value)
      : [...shift.days, value].sort((a, b) => a - b);
    renderWorkSchedule();
  }

  async function saveWorkSchedule() {
    captureWorkDraft();
    const shifts = (state.workDraft || []).map(shift => ({
      label: (shift.label || '').trim() || 'Work',
      days: shift.days,
      start: (shift.start || '').trim(),
      end: (shift.end || '').trim(),
    }));

    await withErrors(async () => {
      const payload = await requestJson('/api/planning/work-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shifts, source: state.workSource || 'manual' }),
      });
      state.workSchedule = payload.schedule;
      state.workSummary = payload.summary;
      state.workDraft = null;
      state.workNotes = '';
      state.workSource = 'manual';
      // The week was built around the old hours.
      if (state.week) state.week = null;
      render();
    }, 'Could not save your work schedule.');
  }

  async function clearWorkSchedule() {
    if (!confirm('Delete your saved work schedule?')) return;
    await withErrors(async () => {
      await requestJson('/api/planning/work-schedule', { method: 'DELETE' });
      state.workSchedule = null;
      state.workSummary = null;
      state.workDraft = null;
      render();
    }, 'Could not delete your work schedule.');
  }

  // The photo never reaches the server as a file: it is read in the browser,
  // posted as base64, and the draft that comes back is what gets corrected.
  async function readWorkPhoto(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    input.value = '';

    if (file.size > 5 * 1024 * 1024) {
      alert('That photo is larger than 5MB. Take it again at a smaller size.');
      return;
    }

    state.workReading = true;
    renderWorkSchedule();

    let dataUrl = '';
    try {
      dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('That photo could not be opened.'));
        reader.readAsDataURL(file);
      });
    } catch (error) {
      state.workReading = false;
      renderWorkSchedule();
      alert(error.message);
      return;
    }

    try {
      const draft = await requestJson('/api/planning/work-schedule/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, media_type: file.type }),
      });
      applyWorkDraft(draft);
      if (!draft.shifts || !draft.shifts.length) {
        alert('No shifts could be read from that photo. Add them by hand, or try a clearer picture.');
      }
    } catch (error) {
      if (error.status === 401) {
        state.locked = true;
        render();
        alert('Your Agent Office session expired. Log in again to read a schedule.');
        return;
      }
      alert(error.message || 'That photo could not be read.');
    } finally {
      state.workReading = false;
      renderWorkSchedule();
    }
  }

  function renderWorkDraft() {
    const rows = (state.workDraft || []).map(shift => {
      const id = escHtml(shift.id);
      const dayButtons = DAYS.map(day => `<button type="button" class="planning-day${shift.days.includes(day.value) ? ' is-on' : ''}"
        onclick="AOPlanning.toggleWorkDay('${id}', ${day.value})" aria-pressed="${shift.days.includes(day.value)}">${day.label}</button>`).join('');
      return `<div class="work-shift">
        <div class="planning-edit-row">
          <div class="planning-field">
            <label class="planning-label" for="work-label-${id}">Shift</label>
            <input class="planning-input" id="work-label-${id}" type="text" maxlength="80" value="${escHtml(shift.label)}"/>
          </div>
          <div class="planning-field">
            <label class="planning-label" for="work-start-${id}">Starts</label>
            <input class="planning-input" id="work-start-${id}" type="time" value="${escHtml(shift.start)}"/>
          </div>
          <div class="planning-field">
            <label class="planning-label" for="work-end-${id}">Ends</label>
            <input class="planning-input" id="work-end-${id}" type="time" value="${escHtml(shift.end)}"/>
          </div>
        </div>
        <div class="planning-field">
          <span class="planning-label">Days</span>
          <div class="planning-days">${dayButtons}</div>
        </div>
        <div class="planning-item-actions">
          <button class="planning-btn planning-btn--sm planning-btn--danger" onclick="AOPlanning.removeWorkShift('${id}')">Remove shift</button>
        </div>
      </div>`;
    }).join('');

    return `<div class="work-edit">
      ${state.workNotes ? `<div class="work-notice">Read from your photo — check it before you plan on it.<br/>${escHtml(state.workNotes)}</div>` : ''}
      ${rows || '<div class="planning-empty">No shifts yet. Add one, or read a photo of your rota.</div>'}
      <div class="planning-item-actions">
        <button class="planning-btn planning-btn--primary planning-btn--sm" onclick="AOPlanning.saveWorkSchedule()">Save schedule</button>
        <button class="planning-btn planning-btn--sm" onclick="AOPlanning.addWorkShift()">Add a shift</button>
        <button class="planning-btn planning-btn--ghost planning-btn--sm" onclick="AOPlanning.cancelWorkEdit()">Cancel</button>
      </div>
    </div>`;
  }

  function renderWorkSaved() {
    const schedule = state.workSchedule;
    const summary = state.workSummary || {};
    const shifts = (schedule && schedule.shifts) || [];

    if (!shifts.length) {
      return `<div class="planning-empty">No work schedule yet. Everything is treated as free time.</div>
        <div class="planning-item-actions">
          <button class="planning-btn planning-btn--sm" onclick="AOPlanning.editWorkSchedule()">Add it by hand</button>
        </div>`;
    }

    const rows = shifts.map(shift => `<div class="work-row">
      <span class="work-row-days">${escHtml(formatDays(shift.days))}</span>
      <span class="work-row-time">${escHtml(shift.start)} – ${escHtml(shift.end)}</span>
      <span class="work-row-label">${escHtml(shift.label)}</span>
    </div>`).join('');

    const off = Array.isArray(summary.days_off) ? summary.days_off : [];
    const hours = Math.round((summary.weekly_minutes || 0) / 6) / 10;

    return `<div class="work-rows">${rows}</div>
      <div class="planning-chips">
        <span class="planning-chip">${hours}h a week</span>
        <span class="planning-chip">${off.length ? `Off: ${escHtml(formatDays(off))}` : 'No days off'}</span>
      </div>
      <div class="planning-item-actions">
        <button class="planning-btn planning-btn--sm" onclick="AOPlanning.editWorkSchedule()">Edit</button>
        <button class="planning-btn planning-btn--sm planning-btn--danger" onclick="AOPlanning.clearWorkSchedule()">Delete</button>
      </div>`;
  }

  function renderWorkSchedule() {
    const wrap = el('planning-work');
    if (!wrap) return;

    if (state.locked) {
      wrap.innerHTML = '<div class="planning-empty">Your work schedule is behind the Agent Office passphrase.</div>';
      return;
    }

    const reading = state.workReading
      ? '<div class="planning-empty">Reading your photo…</div>'
      : '';
    const photo = state.readerConfigured
      ? `<label class="planning-btn planning-btn--sm work-photo">
          <input type="file" accept="image/*" capture="environment" hidden
            onchange="AOPlanning.readWorkPhoto(this)"/>
          Read a photo of my rota
        </label>`
      : '<span class="planning-chip">Photo reading is off — set ANTHROPIC_API_KEY on the server</span>';

    wrap.innerHTML = `<div class="work-head">${photo}</div>
      ${reading}
      ${state.workDraft ? renderWorkDraft() : renderWorkSaved()}`;
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
    buildWeek, rescheduleBlock, dropBlock, sendBack, discardWeek, acceptWeek,
    editWorkSchedule, cancelWorkEdit, addWorkShift, removeWorkShift, toggleWorkDay,
    saveWorkSchedule, clearWorkSchedule, readWorkPhoto, applyWorkDraft,
  };
})();

if (typeof VIEW_HANDLERS !== 'undefined') {
  VIEW_HANDLERS.planning = { enter: () => window.AOPlanning.init() };
}
