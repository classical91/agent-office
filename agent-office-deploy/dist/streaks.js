// Streaks — plots the days you kept something up on a month grid.
//
// This is deliberately not the Calendar. Nothing here has a start time, an end
// time or an agent attached; a day is either kept or it is not, and the grid
// exists so a run of kept days is visible as a run. It leans on app-shared.js
// for the Dropbox session (requestJson / ensureDropsSession), because the
// streaks API sits behind the same passphrase as the drops.

window.AOStreaks = (() => {
  // The curated types. A streak may carry any type slug the server accepts —
  // the "Custom" option writes one — but these are the ones with a colour and
  // a label, and they are what the filter is built from.
  const TYPES = [
    { id: 'habit',    label: 'Habit',     color: '#6366f1' },
    { id: 'health',   label: 'Health',    color: '#22c55e' },
    { id: 'focus',    label: 'Deep Work', color: '#38bdf8' },
    { id: 'learning', label: 'Learning',  color: '#a855f7' },
    { id: 'creative', label: 'Creative',  color: '#ec4899' },
    { id: 'money',    label: 'Money',     color: '#f59e0b' },
    { id: 'avoid',    label: 'Avoid',     color: '#ef4444' },
    { id: 'other',    label: 'Other',     color: '#94a3b8' },
  ];
  const FALLBACK_COLOR = '#6366f1';
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const state = {
    streaks: [],
    marks: new Map(),      // day key -> Map(streak id -> note)
    today: '',
    month: new Date(),
    filterStreak: '',
    filterType: '',
    showArchived: false,
    openDay: '',
    editingId: '',
    formOpen: false,
    formType: 'habit',
    loaded: false,
    locked: false,
    initialized: false,
  };

  // ─── Small helpers ─────────────────────────────────────────────────────

  function escHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function pad(value) { return String(value).padStart(2, '0'); }

  function dayKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function dateFromKey(key) {
    const [year, month, day] = String(key).split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function shiftKey(key, days) {
    const date = dateFromKey(key);
    date.setDate(date.getDate() + days);
    return dayKey(date);
  }

  function typeLabel(type) {
    const known = TYPES.find(item => item.id === type);
    if (known) return known.label;
    return String(type || 'habit').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function typeColor(type) {
    const known = TYPES.find(item => item.id === type);
    return known ? known.color : FALLBACK_COLOR;
  }

  function streakColor(streak) {
    return streak.color || typeColor(streak.type);
  }

  function el(id) { return document.getElementById(id); }

  // ─── Data ──────────────────────────────────────────────────────────────

  function indexMarks(days) {
    const marks = new Map();
    days.forEach(day => {
      if (!marks.has(day.day)) marks.set(day.day, new Map());
      marks.get(day.day).set(day.streak_id, day.note || '');
    });
    return marks;
  }

  async function load() {
    try {
      const payload = await requestJson('/api/streaks');
      state.streaks = Array.isArray(payload.streaks) ? payload.streaks : [];
      state.marks = indexMarks(Array.isArray(payload.days) ? payload.days : []);
      state.today = payload.today || dayKey(new Date());
      state.loaded = true;
      state.locked = false;
    } catch (error) {
      if (error.status === 401) {
        state.locked = true;
        state.loaded = false;
        state.streaks = [];
        state.marks = new Map();
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
        alert('Your Agent Office session expired. Log in again to keep your streaks.');
        return;
      }
      alert(error.message || fallback);
    }
  }

  // ─── Filtering ─────────────────────────────────────────────────────────

  function visibleStreaks() {
    return state.streaks.filter(streak => {
      if (!state.showArchived && streak.archived) return false;
      if (state.filterStreak && streak.id !== state.filterStreak) return false;
      if (state.filterType && streak.type !== state.filterType) return false;
      return true;
    });
  }

  // The single streak a solid cell would mean; empty when several are in view.
  function soloStreak() {
    const visible = visibleStreaks();
    return visible.length === 1 ? visible[0] : null;
  }

  function marksOn(key, streaks) {
    const dayMarks = state.marks.get(key);
    if (!dayMarks) return [];
    return streaks.filter(streak => dayMarks.has(streak.id));
  }

  // ─── Mutations ─────────────────────────────────────────────────────────

  function isMarked(streakId, key) {
    const dayMarks = state.marks.get(key);
    return Boolean(dayMarks && dayMarks.has(streakId));
  }

  async function setDay(streakId, key, on, note) {
    // A day you have not reached yet cannot be a day you kept. Back-filling is
    // the whole point of the grid, so only the future is closed off, and only
    // here on the client: the server takes any valid date so a phone in
    // another timezone is never told its own "today" is impossible.
    if (on && key > state.today) return;
    await withErrors(async () => {
      if (on) {
        await requestJson(`/api/streaks/${encodeURIComponent(streakId)}/days/${key}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: note || '' }),
        });
      } else {
        await requestJson(`/api/streaks/${encodeURIComponent(streakId)}/days/${key}`, { method: 'DELETE' });
      }
      await load();
      render();
    }, 'Could not save that day.');
  }

  function toggleDay(streakId, key) {
    const marked = isMarked(streakId, key);
    return setDay(streakId, key, !marked, marked ? '' : (state.marks.get(key) || new Map()).get(streakId));
  }

  function markToday(streakId) {
    return toggleDay(streakId, state.today);
  }

  function saveNote(streakId, key, note) {
    if (!isMarked(streakId, key)) return;
    return setDay(streakId, key, true, note);
  }

  async function saveStreak() {
    const name = (el('streak-form-name').value || '').trim();
    if (!name) {
      el('streak-form-name').focus();
      return;
    }
    const custom = (el('streak-form-custom').value || '').trim();
    const body = {
      name,
      type: state.formType === '__custom' ? (custom || 'other') : state.formType,
      color: el('streak-form-color').value || '',
      notes: (el('streak-form-notes').value || '').trim(),
    };

    await withErrors(async () => {
      if (state.editingId) {
        await requestJson(`/api/streaks/${encodeURIComponent(state.editingId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await requestJson('/api/streaks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      state.formOpen = false;
      state.editingId = '';
      await load();
      render();
    }, 'Could not save the streak.');
  }

  async function removeStreak(id) {
    const streak = state.streaks.find(item => item.id === id);
    if (!streak) return;
    if (!confirm(`Delete "${streak.name}" and every day marked on it? This cannot be undone.`)) return;
    await withErrors(async () => {
      await requestJson(`/api/streaks/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (state.filterStreak === id) state.filterStreak = '';
      await load();
      render();
    }, 'Could not delete the streak.');
  }

  async function toggleArchived(id) {
    const streak = state.streaks.find(item => item.id === id);
    if (!streak) return;
    await withErrors(async () => {
      await requestJson(`/api/streaks/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !streak.archived }),
      });
      await load();
      render();
    }, 'Could not update the streak.');
  }

  // ─── Form ──────────────────────────────────────────────────────────────

  function openForm(id) {
    state.formOpen = true;
    state.editingId = id || '';
    const streak = id ? state.streaks.find(item => item.id === id) : null;
    state.formType = streak
      ? (TYPES.some(type => type.id === streak.type) ? streak.type : '__custom')
      : 'habit';
    render();
    const name = el('streak-form-name');
    if (name) {
      name.value = streak ? streak.name : '';
      el('streak-form-notes').value = streak ? streak.notes : '';
      el('streak-form-custom').value = streak && state.formType === '__custom' ? streak.type : '';
      el('streak-form-color').value = streak && streak.color ? streak.color : typeColor(state.formType);
      name.focus();
    }
  }

  function closeForm() {
    state.formOpen = false;
    state.editingId = '';
    render();
  }

  function pickType(type) {
    state.formType = type;
    const color = el('streak-form-color');
    // Only follow the type's colour while the field still holds a type colour;
    // a colour picked by hand is left alone.
    if (color && (!color.value || TYPES.some(item => item.color === color.value))) {
      color.value = type === '__custom' ? FALLBACK_COLOR : typeColor(type);
    }
    renderForm();
  }

  // ─── Rendering ─────────────────────────────────────────────────────────

  function render() {
    renderSummary();
    renderFilters();
    renderList();
    renderForm();
    renderCalendar();
    renderYear();
    renderDayModal();
  }

  function lockedNotice(message) {
    return `<div class="streaks-empty">${message}<br/><button class="streaks-btn primary streaks-btn--spaced" onclick="AOStreaks.unlock()">Unlock</button></div>`;
  }

  function renderSummary() {
    const wrap = el('streaks-summary');
    if (!wrap) return;
    const visible = visibleStreaks();
    const monthPrefix = `${state.month.getFullYear()}-${pad(state.month.getMonth() + 1)}`;
    let markedThisMonth = 0;
    state.marks.forEach((dayMarks, key) => {
      if (!key.startsWith(monthPrefix)) return;
      if (visible.some(streak => dayMarks.has(streak.id))) markedThisMonth += 1;
    });
    const best = visible.reduce((max, streak) => Math.max(max, streak.stats.current), 0);
    const record = visible.reduce((max, streak) => Math.max(max, streak.stats.longest), 0);
    const keptToday = visible.filter(streak => streak.stats.marked_today).length;

    const stats = [
      [visible.length, visible.length === 1 ? 'Streak' : 'Streaks'],
      [best, 'Best run now'],
      [record, 'Longest ever'],
      [`${keptToday}/${visible.length}`, 'Kept today'],
      [markedThisMonth, 'Days this month'],
    ];
    wrap.innerHTML = stats.map(([value, label]) => `
      <div class="streak-stat">
        <div class="streak-stat-value">${escHtml(value)}</div>
        <div class="streak-stat-label">${escHtml(label)}</div>
      </div>`).join('');
  }

  function renderFilters() {
    const streakFilter = el('streak-filter-streak');
    if (streakFilter) {
      const options = ['<option value="">All streaks</option>'].concat(
        state.streaks
          .filter(streak => state.showArchived || !streak.archived)
          .map(streak => `<option value="${escHtml(streak.id)}">${escHtml(streak.name)}</option>`)
      );
      streakFilter.innerHTML = options.join('');
      streakFilter.value = state.filterStreak;
    }

    const typeFilter = el('streak-filter-type');
    if (typeFilter) {
      // Every type in use, plus the curated ones, so a custom type is filterable too.
      const used = [...new Set(state.streaks.map(streak => streak.type))];
      const ids = [...new Set(TYPES.map(type => type.id).concat(used))];
      typeFilter.innerHTML = ['<option value="">All types</option>']
        .concat(ids.map(id => `<option value="${escHtml(id)}">${escHtml(typeLabel(id))}</option>`))
        .join('');
      typeFilter.value = state.filterType;
    }

    const archived = el('streak-show-archived');
    if (archived) archived.textContent = state.showArchived ? 'Hide archived' : 'Show archived';

    const label = el('streak-month-label');
    if (label) {
      label.textContent = state.month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
  }

  function sparkline(streak) {
    const cells = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const key = shiftKey(state.today, -offset);
      cells.push(`<div class="streak-spark-dot${isMarked(streak.id, key) ? ' on' : ''}" title="${escHtml(key)}"></div>`);
    }
    return `<div class="streak-spark">${cells.join('')}</div>`;
  }

  function renderList() {
    const wrap = el('streaks-list');
    if (!wrap) return;

    if (state.locked) {
      wrap.innerHTML = lockedNotice('Your streaks are behind the Dropbox passphrase.');
      return;
    }
    if (!state.loaded) {
      wrap.innerHTML = '<div class="streaks-empty">Loading…</div>';
      return;
    }

    const visible = visibleStreaks();
    if (!visible.length) {
      const onlyArchivedLeft = state.streaks.length && state.streaks.every(streak => streak.archived);
      wrap.innerHTML = !state.streaks.length
        ? '<div class="streaks-empty">No streaks yet.<br/>Add one and every day you keep it lands on the calendar.</div>'
        : onlyArchivedLeft
          ? '<div class="streaks-empty">Every streak is archived.<br/><button class="streaks-btn streaks-btn--spaced" onclick="AOStreaks.toggleShowArchived()">Show archived</button></div>'
          : '<div class="streaks-empty">No streak matches this filter.</div>';
      return;
    }

    wrap.innerHTML = visible.map(streak => {
      const color = streakColor(streak);
      const marked = streak.stats.marked_today;
      return `
        <div class="streak-card${streak.archived ? ' dimmed' : ''}" style="--streak-color:${escHtml(color)};">
          <div class="streak-card-head">
            <div>
              <div class="streak-card-name">${escHtml(streak.name)}</div>
              <span class="streak-type-chip">${escHtml(typeLabel(streak.type))}</span>
            </div>
            <div class="streak-card-count">${streak.stats.current}<span class="streak-card-unit"> day${streak.stats.current === 1 ? '' : 's'}</span></div>
          </div>
          ${sparkline(streak)}
          <div class="streak-card-meta">Longest ${streak.stats.longest} · ${streak.stats.total_days} day${streak.stats.total_days === 1 ? '' : 's'} total${streak.stats.last_day ? ` · last ${escHtml(streak.stats.last_day)}` : ''}</div>
          ${streak.notes ? `<div class="streak-card-notes">${escHtml(streak.notes)}</div>` : ''}
          <div class="streak-card-actions">
            <button class="streaks-btn mark${marked ? ' marked' : ''}" onclick="AOStreaks.markToday('${escHtml(streak.id)}')">${marked ? '✓ Kept today' : 'Mark today'}</button>
            <button class="streaks-btn ghost" onclick="AOStreaks.openForm('${escHtml(streak.id)}')">Edit</button>
            <button class="streaks-btn ghost" onclick="AOStreaks.toggleArchived('${escHtml(streak.id)}')">${streak.archived ? 'Restore' : 'Archive'}</button>
            <button class="streaks-btn ghost danger" onclick="AOStreaks.removeStreak('${escHtml(streak.id)}')">Delete</button>
          </div>
        </div>`;
    }).join('');
  }

  function renderForm() {
    const wrap = el('streak-form');
    if (!wrap) return;
    if (!state.formOpen) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;

    const picker = el('streak-type-picker');
    if (picker) {
      picker.innerHTML = TYPES.concat([{ id: '__custom', label: 'Custom', color: FALLBACK_COLOR }])
        .map(type => `<button type="button" class="streak-type-option${state.formType === type.id ? ' on' : ''}" style="--streak-color:${escHtml(type.color)};" onclick="AOStreaks.pickType('${escHtml(type.id)}')">${escHtml(type.label)}</button>`)
        .join('');
    }

    const customField = el('streak-form-custom-field');
    if (customField) customField.hidden = state.formType !== '__custom';

    const title = el('streak-form-title');
    if (title) title.textContent = state.editingId ? 'Edit streak' : 'New streak';
    const save = el('streak-form-save');
    if (save) save.textContent = state.editingId ? 'Save changes' : 'Add streak';
  }

  function renderCalendar() {
    const grid = el('streak-calendar-grid');
    if (!grid) return;

    if (state.locked || !state.loaded) {
      grid.innerHTML = '';
      return;
    }

    const year = state.month.getFullYear();
    const month = state.month.getMonth();
    const visible = visibleStreaks();
    const solo = soloStreak();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = DAY_NAMES.map(name => `<div class="streak-day-name">${name}</div>`);
    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push('<div class="streak-day blank"></div>');
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${year}-${pad(month + 1)}-${pad(day)}`;
      const kept = marksOn(key, visible);
      const classes = ['streak-day'];
      if (key === state.today) classes.push('today');
      if (key > state.today) classes.push('future');
      if (solo && kept.length) classes.push('solo-on');
      const color = solo ? streakColor(solo) : (kept.length ? streakColor(kept[0]) : '');
      const dots = solo
        ? ''
        : kept.map(streak => `<span class="streak-mark" style="--streak-color:${escHtml(streakColor(streak))};" title="${escHtml(streak.name)}"></span>`).join('');
      const title = kept.length ? `${key}: ${kept.map(streak => streak.name).join(', ')}` : key;
      cells.push(`
        <button type="button" class="${classes.join(' ')}"${color ? ` style="--streak-color:${escHtml(color)};"` : ''} title="${escHtml(title)}" onclick="AOStreaks.openDay('${key}')">
          <span class="streak-day-number">${day}</span>
          <span class="streak-day-marks">${dots}</span>
          ${kept.length && solo ? '<span class="streak-day-note">✓</span>' : ''}
          ${kept.length && !solo ? `<span class="streak-day-note">${kept.length}</span>` : ''}
        </button>`);
    }
    grid.innerHTML = cells.join('');

    const legend = el('streak-legend');
    if (legend) {
      legend.innerHTML = visible.length
        ? visible.map(streak => `<div class="streak-legend-item" style="--streak-color:${escHtml(streakColor(streak))};"><span class="streak-legend-swatch"></span>${escHtml(streak.name)}</div>`).join('')
        : '<div class="streak-legend-item">Nothing to plot yet.</div>';
    }
  }

  // A year of days, one column per week, so the whole run is visible at once.
  function renderYear() {
    const grid = el('streak-year-grid');
    const months = el('streak-year-months');
    if (!grid) return;

    if (state.locked || !state.loaded) {
      grid.innerHTML = '';
      if (months) months.innerHTML = '';
      return;
    }

    const visible = visibleStreaks();
    const solo = soloStreak();
    const end = dateFromKey(state.today);
    end.setDate(end.getDate() + (6 - end.getDay())); // finish the current week
    const start = new Date(end);
    start.setDate(start.getDate() - (53 * 7 - 1));

    const cells = [];
    const monthLabels = [];
    let lastMonth = -1;
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const key = dayKey(cursor);
      const kept = marksOn(key, visible);
      if (cursor.getDay() === 0) {
        const label = cursor.getMonth() !== lastMonth ? cursor.toLocaleDateString(undefined, { month: 'short' }) : '';
        lastMonth = cursor.getMonth();
        monthLabels.push(`<span class="streak-month-label">${escHtml(label)}</span>`);
      }
      if (!kept.length || key > state.today) {
        cells.push(`<div class="streak-year-cell" title="${escHtml(key)}"></div>`);
        continue;
      }
      const color = solo ? streakColor(solo) : streakColor(kept[0]);
      // With several streaks in view, more kept on one day means a stronger cell.
      const strength = solo ? 1 : Math.min(1, 0.35 + (kept.length / Math.max(visible.length, 1)) * 0.65);
      cells.push(`<div class="streak-year-cell" style="background:color-mix(in srgb, ${escHtml(color)} ${Math.round(strength * 100)}%, transparent);" title="${escHtml(key)}: ${escHtml(kept.map(streak => streak.name).join(', '))}"></div>`);
    }

    grid.innerHTML = cells.join('');
    if (months) months.innerHTML = monthLabels.join('');
  }

  // ─── The day editor ────────────────────────────────────────────────────

  function openDay(key) {
    state.openDay = key;
    renderDayModal();
  }

  function closeDay() {
    state.openDay = '';
    renderDayModal();
  }

  function renderDayModal() {
    const modal = el('streak-day-modal');
    if (!modal) return;
    if (!state.openDay) {
      modal.classList.remove('open');
      return;
    }
    modal.classList.add('open');

    const key = state.openDay;
    const date = dateFromKey(key);
    el('streak-day-title').textContent = date.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const kept = marksOn(key, visibleStreaks()).length;
    el('streak-day-sub').textContent = key > state.today
      ? 'Still to come'
      : key === state.today
        ? (kept ? `Today · ${kept} kept` : 'Today · nothing marked yet')
        : (kept ? `${kept} kept` : 'Nothing marked');

    const rows = el('streak-day-rows');
    if (key > state.today) {
      rows.innerHTML = '<div class="streaks-empty">This day has not happened yet.<br/>Come back and mark it once it has.</div>';
      return;
    }

    const streaks = visibleStreaks().filter(streak => !streak.archived);
    if (!streaks.length) {
      rows.innerHTML = '<div class="streaks-empty">No streak in view. Add one, or clear the filters.</div>';
      return;
    }

    rows.innerHTML = streaks.map(streak => {
      const on = isMarked(streak.id, key);
      const note = on ? (state.marks.get(key) || new Map()).get(streak.id) || '' : '';
      return `
        <div style="--streak-color:${escHtml(streakColor(streak))};">
          <div class="streak-modal-row${on ? ' on' : ''}" onclick="AOStreaks.toggleDay('${escHtml(streak.id)}','${key}')">
            <div class="streak-modal-check">${on ? '✓' : ''}</div>
            <div class="streak-modal-row-name">${escHtml(streak.name)}
              <div class="streak-modal-row-meta">${escHtml(typeLabel(streak.type))} · ${streak.stats.current} day run</div>
            </div>
          </div>
          ${on ? `<input type="text" class="streaks-input" style="margin:-4px 0 8px;" placeholder="Note (optional)" value="${escHtml(note)}" onchange="AOStreaks.saveNote('${escHtml(streak.id)}','${key}', this.value)" />` : ''}
        </div>`;
    }).join('');
  }

  // ─── Month navigation ──────────────────────────────────────────────────

  function changeMonth(direction) {
    state.month = new Date(state.month.getFullYear(), state.month.getMonth() + direction, 1);
    render();
  }

  function goToday() {
    const today = dateFromKey(state.today || dayKey(new Date()));
    state.month = new Date(today.getFullYear(), today.getMonth(), 1);
    render();
  }

  function setFilter(kind, value) {
    if (kind === 'streak') state.filterStreak = value;
    if (kind === 'type') state.filterType = value;
    render();
  }

  function toggleShowArchived() {
    state.showArchived = !state.showArchived;
    render();
  }

  // ─── Init ──────────────────────────────────────────────────────────────

  async function init() {
    if (state.initialized) return;
    state.initialized = true;
    state.today = dayKey(new Date());
    state.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    render();

    try {
      await load();
    } catch (error) {
      state.loaded = true;
      const list = el('streaks-list');
      if (list) list.innerHTML = `<div class="streaks-empty">${escHtml(error.message || 'Could not load your streaks.')}</div>`;
      return;
    }
    render();
    if (state.locked) await unlock();
  }

  return {
    init, unlock, render,
    changeMonth, goToday, setFilter, toggleShowArchived,
    openForm, closeForm, pickType, saveStreak,
    markToday, toggleDay, saveNote, removeStreak, toggleArchived,
    openDay, closeDay,
    TYPES,
  };
})();

if (typeof VIEW_HANDLERS !== 'undefined') {
  VIEW_HANDLERS.streaks = { enter: () => window.AOStreaks.init() };
}
