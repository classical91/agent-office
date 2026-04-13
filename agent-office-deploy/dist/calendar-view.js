(function () {
  const ROW_HEIGHT = 200;
  const HOUR_START = 7;
  const HOUR_END = 21;
  const MIN_WINDOW_MINUTES = 45;
  const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const PRIORITY_RANK = { normal: 1, high: 2, urgent: 3 };
  const TYPE_META = {
    meeting: {
      label: 'Meeting',
      color: '#a5b4fc',
      surface: 'rgba(99, 102, 241, 0.18)',
      border: 'rgba(129, 140, 248, 0.45)',
      dot: '#818cf8'
    },
    task: {
      label: 'Task',
      color: '#86efac',
      surface: 'rgba(34, 197, 94, 0.18)',
      border: 'rgba(74, 222, 128, 0.40)',
      dot: '#4ade80'
    },
    deadline: {
      label: 'Deadline',
      color: '#fdba74',
      surface: 'rgba(249, 115, 22, 0.18)',
      border: 'rgba(251, 146, 60, 0.42)',
      dot: '#fb923c'
    },
    reminder: {
      label: 'Reminder',
      color: '#67e8f9',
      surface: 'rgba(6, 182, 212, 0.18)',
      border: 'rgba(34, 211, 238, 0.40)',
      dot: '#22d3ee'
    },
    automation: {
      label: 'Automation',
      color: '#d8b4fe',
      surface: 'rgba(168, 85, 247, 0.18)',
      border: 'rgba(192, 132, 252, 0.40)',
      dot: '#c084fc'
    },
    focus: {
      label: 'Focus',
      color: '#93c5fd',
      surface: 'rgba(59, 130, 246, 0.18)',
      border: 'rgba(96, 165, 250, 0.40)',
      dot: '#60a5fa'
    }
  };

  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function withTime(date, hour, minute) {
    const d = startOfDay(date);
    d.setHours(hour, minute || 0, 0, 0);
    return d;
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
  }

  function startOfWeek(date) {
    const d = startOfDay(date);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d;
  }

  function formatLocalIso(date) {
    const d = new Date(date);
    const pad = value => String(value).padStart(2, '0');
    return [
      d.getFullYear(),
      pad(d.getMonth() + 1),
      pad(d.getDate())
    ].join('-') + 'T' + [pad(d.getHours()), pad(d.getMinutes())].join(':');
  }

  function parseLocalIso(value) {
    return new Date(value);
  }

  function dateKey(value) {
    const d = value instanceof Date ? value : parseLocalIso(value);
    return formatLocalIso(d).slice(0, 10);
  }

  function parseDateKey(value) {
    return new Date(value + 'T00:00');
  }

  function sameDay(a, b) {
    return dateKey(a) === dateKey(b);
  }

  function sameMonth(a, b) {
    const da = a instanceof Date ? a : parseLocalIso(a);
    const db = b instanceof Date ? b : parseLocalIso(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
  }

  function compareEvents(a, b) {
    return parseLocalIso(a.start) - parseLocalIso(b.start);
  }

  function compareTasks(a, b) {
    if (PRIORITY_RANK[b.priority] !== PRIORITY_RANK[a.priority]) {
      return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    }
    return parseLocalIso(a.due) - parseLocalIso(b.due);
  }

  function durationMinutes(item) {
    const start = parseLocalIso(item.start);
    const end = parseLocalIso(item.end);
    return Math.round((end - start) / 60000);
  }

  function formatTime(date) {
    return new Intl.DateTimeFormat('en-CA', {
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  }

  function formatShortDate(date) {
    return new Intl.DateTimeFormat('en-CA', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  function formatLongDate(date) {
    return new Intl.DateTimeFormat('en-CA', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).format(date);
  }

  function formatRange(start, end) {
    return formatTime(start) + ' - ' + formatTime(end);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function timezoneLabel() {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
    const sample = new Intl.DateTimeFormat('en-CA', {
      timeZoneName: 'short'
    }).formatToParts(new Date()).find(part => part.type === 'timeZoneName');
    return zone + (sample ? ' / ' + sample.value : '');
  }

  function relativeCountdown(date) {
    const diff = Math.round((date - new Date()) / 3600000);
    if (Math.abs(diff) < 1) return 'Soon';
    if (diff > 0 && diff < 24) return 'In ' + diff + 'h';
    if (diff <= 0 && diff > -24) return Math.abs(diff) + 'h ago';
    const days = Math.round(diff / 24);
    return days > 0 ? 'In ' + days + 'd' : Math.abs(days) + 'd ago';
  }

  let uidCount = 0;
  function uid(prefix) {
    uidCount += 1;
    return prefix + '_' + uidCount;
  }

  function makeEvent(baseDate, offsetDays, startHour, startMinute, endHour, endMinute, extra) {
    return Object.assign({
      id: uid('evt'),
      title: 'Untitled event',
      type: 'meeting',
      start: formatLocalIso(withTime(addDays(baseDate, offsetDays), startHour, startMinute)),
      end: formatLocalIso(withTime(addDays(baseDate, offsetDays), endHour, endMinute)),
      notes: '',
      attachments: []
    }, extra || {});
  }

  function makeTask(baseDate, offsetDays, hour, minute, extra) {
    return Object.assign({
      id: uid('tsk'),
      title: 'Untitled task',
      duration: 60,
      due: formatLocalIso(withTime(addDays(baseDate, offsetDays), hour, minute || 0)),
      priority: 'normal',
      done: false,
      notes: '',
      tags: []
    }, extra || {});
  }

  function seedState() {
    const today = startOfDay(new Date());
    const events = [];
    for (var d = -1; d <= 7; d++) {
      events.push(
        makeEvent(today, d, 9, 0, 9, 30, {
          id: 'evt_farmbot_' + d,
          title: 'Farmbot Morning Run',
          type: 'task',
          notes: 'Automated: Reaper runs CommentFarm discover + autopost. Posts to @DiamondHands811.',
          recurring: 'Daily'
        }),
        makeEvent(today, d, 9, 30, 10, 0, {
          id: 'evt_xam_' + d,
          title: 'X Morning Session',
          type: 'task',
          notes: 'Manual: 5 comments on trending crypto posts on X.',
          recurring: 'Daily'
        }),
        makeEvent(today, d, 13, 0, 13, 30, {
          id: 'evt_xpm_' + d,
          title: 'X Afternoon Session',
          type: 'task',
          notes: 'Manual: 5 comments on trending crypto posts on X.',
          recurring: 'Daily'
        }),
        makeEvent(today, d, 19, 0, 19, 30, {
          id: 'evt_xeve_' + d,
          title: 'X Evening Session',
          type: 'task',
          notes: 'Manual: 5 comments on trending crypto posts on X.',
          recurring: 'Daily'
        })
      );
    }
    events.sort(compareEvents);

    const tasks = [].sort(compareTasks);

    const upcoming = events.find(event => parseLocalIso(event.end) >= new Date());

    return {
      today,
      cursorDate: today,
      selectedDate: today,
      selectedEventId: upcoming ? upcoming.id : events[0].id,
      view: 'week',
      search: '',
      command: 'call client next Tuesday at 2pm',
      flash: null,
      flashTimer: null,
      draggedTaskId: null,
      filters: Object.keys(TYPE_META).reduce((acc, key) => {
        acc[key] = true;
        return acc;
      }, {}),
      events,
      tasks,
      gcalFetchStarted: false,
      gcalConfigured: false
    };
  }

  const state = seedState();
  function visibleEvents() {
    const term = state.search.trim().toLowerCase();
    return state.events.filter(event => {
      if (!state.filters[event.type]) return false;
      if (!term) return true;
      const haystack = [event.title, event.notes, event.location]
        .concat(event.attachments || [])
        .map(item => (typeof item === 'string' ? item : item && item.label ? item.label : ''))
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    }).sort(compareEvents);
  }

  function visibleTasks() {
    const term = state.search.trim().toLowerCase();
    return state.tasks.filter(task => {
      if (task.done) return false;
      if (!term) return true;
      return [task.title, task.notes].concat(task.tags || []).join(' ').toLowerCase().includes(term);
    }).sort(compareTasks);
  }

  function allEventsForDate(date) {
    return state.events.filter(event => sameDay(event.start, date)).sort(compareEvents);
  }

  function eventsForDate(date) {
    return visibleEvents().filter(event => sameDay(event.start, date));
  }

  function findEvent(id) {
    return state.events.find(event => event.id === id);
  }

  function findTask(id) {
    return state.tasks.find(task => task.id === id);
  }

  function ensureSelection() {
    if (findEvent(state.selectedEventId)) return;
    const next = visibleEvents().find(event => parseLocalIso(event.end) >= new Date()) || visibleEvents()[0] || state.events[0];
    state.selectedEventId = next ? next.id : null;
  }

  function overlapLayout(dayEvents) {
    const laidOut = dayEvents.map(event => ({ event, column: 0, columns: 1 }));
    const active = [];
    laidOut.forEach(current => {
      const currentStart = parseLocalIso(current.event.start);
      for (let i = active.length - 1; i >= 0; i -= 1) {
        const activeEnd = parseLocalIso(active[i].event.end);
        if (activeEnd <= currentStart) active.splice(i, 1);
      }
      const used = active.map(item => item.column);
      let column = 0;
      while (used.includes(column)) column += 1;
      current.column = column;
      active.push(current);
      const columns = Math.max.apply(null, active.map(item => item.column)) + 1;
      active.forEach(item => {
        item.columns = Math.max(item.columns, columns);
      });
    });
    return laidOut;
  }

  function freeWindows(date, minimumMinutes) {
    const minMinutes = minimumMinutes || MIN_WINDOW_MINUTES;
    const dayStart = withTime(date, 8, 0);
    const dayEnd = withTime(date, 18, 0);
    const busy = allEventsForDate(date)
      .map(event => ({
        start: new Date(Math.max(parseLocalIso(event.start), dayStart)),
        end: new Date(Math.min(parseLocalIso(event.end), dayEnd))
      }))
      .filter(slot => slot.end > dayStart && slot.start < dayEnd)
      .sort((a, b) => a.start - b.start);

    const merged = [];
    busy.forEach(slot => {
      const last = merged[merged.length - 1];
      if (!last || slot.start > last.end) {
        merged.push({ start: slot.start, end: slot.end });
      } else if (slot.end > last.end) {
        last.end = slot.end;
      }
    });

    const windows = [];
    let cursor = dayStart;
    merged.forEach(slot => {
      if (slot.start - cursor >= minMinutes * 60000) {
        windows.push({ start: cursor, end: slot.start });
      }
      if (slot.end > cursor) cursor = slot.end;
    });
    if (dayEnd - cursor >= minMinutes * 60000) {
      windows.push({ start: cursor, end: dayEnd });
    }
    return windows;
  }

  function nextUpcoming(limit) {
    const from = new Date();
    return state.events
      .filter(event => parseLocalIso(event.end) >= from)
      .sort(compareEvents)
      .slice(0, limit || 3);
  }

  function upcomingDeadlines(limit) {
    const deadlineEvents = state.events
      .filter(event => event.type === 'deadline' || event.type === 'reminder')
      .map(event => ({
        kind: 'event',
        id: event.id,
        title: event.title,
        due: event.start,
        type: event.type
      }));
    const taskDeadlines = state.tasks
      .filter(task => !task.done)
      .map(task => ({
        kind: 'task',
        id: task.id,
        title: task.title,
        due: task.due,
        type: 'task',
        priority: task.priority
      }));
    return deadlineEvents.concat(taskDeadlines)
      .sort((a, b) => parseLocalIso(a.due) - parseLocalIso(b.due))
      .slice(0, limit || 5);
  }

  function overdueItems() {
    const now = new Date();
    const missedEvents = state.events.filter(event => event.missed || (event.type === 'reminder' && parseLocalIso(event.end) < now));
    const overdueTasks = state.tasks.filter(task => !task.done && parseLocalIso(task.due) < now);
    return missedEvents.map(event => ({
      id: event.id,
      title: event.title,
      copy: event.notes || 'Missed reminder'
    })).concat(overdueTasks.map(task => ({
      id: task.id,
      title: task.title,
      copy: 'Task due ' + relativeCountdown(parseLocalIso(task.due))
    }))).slice(0, 4);
  }

  function buildSuggestions() {
    const suggestions = [];
    const tomorrow = addDays(state.today, 1);
    const tomorrowWindows = freeWindows(tomorrow, 90);
    if (tomorrowWindows.length >= 2) {
      suggestions.push({
        title: 'You have ' + tomorrowWindows.length + ' empty focus blocks tomorrow.',
        copy: 'The calendar can turn one of those windows into protected work with a single drop.',
        cta: 'Jump to tomorrow',
        action: "CAL.jumpToDate('" + dateKey(tomorrow) + "')"
      });
    }

    const urgentTask = visibleTasks().find(task => task.priority === 'urgent') || visibleTasks()[0];
    if (urgentTask) {
      suggestions.push({
        title: urgentTask.title + ' should be scheduled before ' + formatShortDate(parseLocalIso(urgentTask.due)) + '.',
        copy: 'It needs about ' + urgentTask.duration + ' minutes and currently has no time block.',
        cta: 'Block it now',
        action: "CAL.blockTask('" + urgentTask.id + "')"
      });
    }

    const focus = findEvent('evt_focus_tomorrow');
    const meeting = findEvent('evt_strategy_review');
    if (focus && meeting && parseLocalIso(focus.start) < parseLocalIso(meeting.end) && parseLocalIso(focus.end) > parseLocalIso(meeting.start)) {
      suggestions.push({
        title: 'Move strategy review? It overlaps with deep work.',
        copy: 'A slight shift preserves the focus block and keeps the review on the same day.',
        cta: 'Move 30m later',
        action: "CAL.shiftEvent('evt_strategy_review', 30)"
      });
    }

    const clientCall = findEvent('evt_client_call');
    if (clientCall) {
      suggestions.push({
        title: 'Northwind call can auto-create a recap task.',
        copy: 'That keeps the follow-up from slipping after the meeting ends.',
        cta: 'Add recap',
        action: "CAL.createRecapFor('evt_client_call')"
      });
    }

    return suggestions.slice(0, 4);
  }

  function priorityBanner() {
    const deadlines = upcomingDeadlines(2);
    const nextDeadline = deadlines[0];
    const selectedWindows = freeWindows(state.selectedDate, 45);
    const taskCount = visibleTasks().length;
    const automations = state.events.filter(event => event.type === 'automation').length;
    const deadlineDate = nextDeadline ? parseLocalIso(nextDeadline.due) : null;
    const isOverdue = deadlineDate ? deadlineDate < startOfDay(new Date()) : false;
    const headline = nextDeadline
      ? (isOverdue ? 'Clear the overdue item: ' + nextDeadline.title + '.' : 'Protect time before ' + nextDeadline.title + '.')
      : 'The day is clear enough to start a focus block.';
    const copy = nextDeadline
      ? (isOverdue
        ? nextDeadline.title + ' slipped past ' + formatShortDate(deadlineDate) + '. Use the next open window on ' + formatShortDate(state.selectedDate) + ' to catch up before stacking more meetings.'
        : 'You have ' + selectedWindows.length + ' open windows on ' + formatShortDate(state.selectedDate) + '. The best move is to schedule the highest priority task before ' + formatShortDate(deadlineDate) + '.')
      : 'No urgent deadlines are crowding the board, so the agent can aggressively protect deep work.';
    return {
      headline,
      copy,
      metrics: [
        { label: 'Free windows', value: selectedWindows.length },
        { label: 'Tasks to schedule', value: taskCount },
        { label: 'Automations', value: automations }
      ]
    };
  }

  function monthMatrix(anchor) {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    const days = [];
    for (let i = 0; i < 42; i += 1) {
      days.push(addDays(gridStart, i));
    }
    return days;
  }

  function currentRangeLabel() {
    if (state.view === 'month') {
      return new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric' }).format(state.cursorDate);
    }
    if (state.view === 'agenda') {
      const start = state.selectedDate;
      const end = addDays(start, 13);
      return formatShortDate(start) + ' - ' + formatShortDate(end);
    }
    if (state.view === 'day') {
      return formatLongDate(state.selectedDate);
    }
    const start = startOfWeek(state.cursorDate);
    const end = addDays(start, 6);
    return formatShortDate(start) + ' - ' + formatShortDate(end);
  }

  function renderLegend() {
    return Object.keys(TYPE_META).map(type => {
      const meta = TYPE_META[type];
      const count = state.events.filter(event => event.type === type).length;
      return '<span class="calendar-legend-chip"><span class="calendar-legend-swatch" style="background:' + meta.dot + '"></span>' + meta.label + ' <span class="calendar-badge">' + count + '</span></span>';
    }).join('');
  }

  function renderCommandExamples() {
    const samples = [
      'call client next Tuesday at 2pm',
      'focus block tomorrow at 9 for 90m',
      'remind me to send invoice Friday at 4pm'
    ];
    return samples.map(sample => '<button class="calendar-chip" onclick="CAL.loadCommand(\'' + sample + '\')">' + escapeHtml(sample) + '</button>').join('');
  }

  function renderMiniCalendar() {
    const days = monthMatrix(state.cursorDate);
    return '<div class="calendar-mini-month">'
      + '<div class="calendar-mini-header">'
      + '<div class="calendar-mini-title">' + escapeHtml(new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric' }).format(state.cursorDate)) + '</div>'
      + '<div class="calendar-nav">'
      + '<button class="calendar-nav-btn" onclick="CAL.navigate(-1)">Prev</button>'
      + '<button class="calendar-nav-btn" onclick="CAL.goToday()">Today</button>'
      + '<button class="calendar-nav-btn" onclick="CAL.navigate(1)">Next</button>'
      + '</div></div>'
      + '<div class="calendar-mini-labels">' + WEEKDAY_LABELS.map(label => '<div class="calendar-mini-label">' + label + '</div>').join('') + '</div>'
      + '<div class="calendar-mini-grid">'
      + days.map(day => {
        const classes = ['calendar-mini-cell'];
        if (!sameMonth(day, state.cursorDate)) classes.push('muted');
        if (sameDay(day, state.today)) classes.push('current');
        if (sameDay(day, state.selectedDate)) classes.push('selected');
        return '<button class="' + classes.join(' ') + '" onclick="CAL.jumpToDate(\'' + dateKey(day) + '\')">' + day.getDate() + '</button>';
      }).join('')
      + '</div></div>';
  }

  function renderFilters() {
    return Object.keys(TYPE_META).map(type => {
      const meta = TYPE_META[type];
      const count = state.events.filter(event => event.type === type).length;
      return '<button class="calendar-filter' + (state.filters[type] ? ' active' : '') + '" onclick="CAL.toggleFilter(\'' + type + '\')">'
        + '<span class="calendar-filter-meta"><span class="calendar-filter-swatch" style="background:' + meta.dot + '"></span>' + meta.label + '</span>'
        + '<span class="calendar-filter-count">' + count + '</span>'
        + '</button>';
    }).join('');
  }

  function renderFreeWindows() {
    const windows = freeWindows(state.selectedDate, 45);
    if (!windows.length) return '<div class="calendar-empty">No meaningful free windows on this day. The schedule is packed.</div>';
    return windows.slice(0, 4).map(window => {
      const minutes = Math.round((window.end - window.start) / 60000);
      return '<div class="calendar-window"><strong>' + formatRange(window.start, window.end) + '</strong><span>' + minutes + ' minutes open for focus or follow-up work.</span></div>';
    }).join('');
  }

  function renderOverdue() {
    const items = overdueItems();
    if (!items.length) return '<div class="calendar-empty">Nothing overdue right now.</div>';
    return items.map(item => '<div class="calendar-list-item"><div class="calendar-item-title">' + escapeHtml(item.title) + '</div><div class="calendar-item-meta">' + escapeHtml(item.copy) + '</div></div>').join('');
  }

  function renderLeftRail() {
    return '<div class="calendar-section">'
      + '<div class="calendar-section-head"><div class="calendar-section-title">Calendar search</div></div>'
      + '<input class="calendar-search" type="text" placeholder="Search meetings, tasks, notes..." value="' + escapeHtml(state.search) + '" oninput="CAL.setSearch(this.value)" />'
      + '</div>'
      + '<div class="calendar-section">'
      + '<div class="calendar-section-head"><div class="calendar-section-title">Mini calendar</div></div>'
      + renderMiniCalendar()
      + '</div>'
      + '<div class="calendar-section">'
      + '<div class="calendar-section-head"><div class="calendar-section-title">Event filters</div></div>'
      + '<div class="calendar-filter-list">' + renderFilters() + '</div>'
      + '</div>'
      + '<div class="calendar-section">'
      + '<div class="calendar-section-head"><div class="calendar-section-title">Free time windows</div><button class="calendar-section-link" onclick="CAL.blockTopTask()">Block top task</button></div>'
      + '<div class="calendar-window-list">' + renderFreeWindows() + '</div>'
      + '</div>'
      + '<div class="calendar-section">'
      + '<div class="calendar-section-head"><div class="calendar-section-title">Overdue / missed</div></div>'
      + '<div class="calendar-list">' + renderOverdue() + '</div>'
      + '</div>';
  }
  function renderPriorityBanner() {
    const banner = priorityBanner();
    return '<div class="calendar-priority-banner">'
      + '<div class="calendar-banner-copy">'
      + '<div class="calendar-banner-label">Daily priority</div>'
      + '<div class="calendar-banner-title">' + escapeHtml(banner.headline) + '</div>'
      + '<div class="calendar-banner-subtitle">' + escapeHtml(banner.copy) + '</div>'
      + '</div>'
      + '<div class="calendar-banner-metrics">'
      + banner.metrics.map(metric => '<div class="calendar-metric"><div class="calendar-metric-label">' + escapeHtml(metric.label) + '</div><div class="calendar-metric-value">' + escapeHtml(metric.value) + '</div></div>').join('')
      + '</div>'
      + '</div>';
  }

  function renderDeadlineStrip() {
    const deadlines = upcomingDeadlines(4);
    return '<div class="calendar-deadline-strip">' + deadlines.map(item => {
      const date = parseLocalIso(item.due);
      return '<button class="calendar-deadline-pill" onclick="' + (item.kind === 'event' ? 'CAL.selectEvent(\'' + item.id + '\')' : 'CAL.blockTask(\'' + item.id + '\')') + '">'
        + '<span class="calendar-chip-swatch" style="background:' + TYPE_META[item.type].dot + '"></span>'
        + escapeHtml(item.title)
        + '<span class="calendar-deadline-day">' + escapeHtml(formatShortDate(date)) + '</span>'
        + '</button>';
    }).join('') + '</div>';
  }

  function renderToolbar() {
    return '<div class="calendar-toolbar">'
      + '<div><div class="calendar-range-main">' + escapeHtml(currentRangeLabel()) + '</div><div class="calendar-range-sub">' + escapeHtml(timezoneLabel()) + ' / Sync status: local preview only</div></div>'
      + '<div class="calendar-toolbar-controls">'
      + '<div class="calendar-nav">'
      + '<button class="calendar-nav-btn" onclick="CAL.navigate(-1)">Prev</button>'
      + '<button class="calendar-nav-btn" onclick="CAL.goToday()">Today</button>'
      + '<button class="calendar-nav-btn" onclick="CAL.navigate(1)">Next</button>'
      + '</div>'
      + '<div class="calendar-view-switcher">'
      + ['day', 'week', 'month', 'agenda'].map(view => '<button class="calendar-view-btn' + (state.view === view ? ' active' : '') + '" onclick="CAL.changeView(\'' + view + '\')">' + view + '</button>').join('')
      + '</div>'
      + '<span class="calendar-status-chip">Google Calendar not connected yet</span>'
      + '</div></div>';
  }

  function renderMonthView() {
    const days = monthMatrix(state.cursorDate);
    const dayNames = WEEKDAY_LABELS.map(label => '<div class="calendar-month-weekday">' + label + '</div>').join('');
    const cells = days.map(day => {
      const dateEvents = eventsForDate(day);
      const dayEvents = dateEvents.slice(0, 3);
      const more = Math.max(0, dateEvents.length - dayEvents.length);
      const classes = ['calendar-month-cell'];
      if (!sameMonth(day, state.cursorDate)) classes.push('is-other');
      if (sameDay(day, state.today)) classes.push('is-today');
      if (sameDay(day, state.selectedDate)) classes.push('selected');
      return '<div class="' + classes.join(' ') + '" onclick="CAL.jumpToDate(\'' + dateKey(day) + '\')" ondragover="CAL.allowTaskDrop(event)" ondrop="CAL.dropTask(event, \'' + dateKey(day) + '\', 10)">'
        + '<div class="calendar-day-number">' + day.getDate() + '</div>'
        + '<div class="calendar-month-events">'
        + dayEvents.map(event => renderEventPill(event, true)).join('')
        + (more ? '<div class="calendar-more">+' + more + ' more</div>' : '')
        + '</div></div>';
    }).join('');
    return '<div class="calendar-month-grid">' + dayNames + cells + '</div>';
  }

  function renderEventPill(event, small) {
    const meta = TYPE_META[event.type];
    const start = parseLocalIso(event.start);
    const end = parseLocalIso(event.end);
    return '<button class="calendar-event' + (small ? ' small' : '') + (state.selectedEventId === event.id ? ' active' : '') + '" style="background:' + meta.surface + ';border-color:' + meta.border + ';color:' + meta.color + ';" onclick="CAL.selectEvent(\'' + event.id + '\')">'
      + '<span class="calendar-event-time">' + escapeHtml(formatTime(start)) + '</span>'
      + '<span class="calendar-event-title">' + escapeHtml(event.title) + '</span>'
      + (!small ? '<span class="calendar-event-meta">' + escapeHtml(formatRange(start, end)) + '</span>' : '')
      + '</button>';
  }

  function renderTimeGrid(days) {
    const totalHeight = (HOUR_END - HOUR_START) * ROW_HEIGHT;
    const head = '<div class="calendar-time-head" style="grid-template-columns:72px repeat(' + days.length + ', minmax(0, 1fr));">'
      + '<div class="calendar-time-head-spacer"></div>'
      + days.map(day => {
        const classes = ['calendar-time-day'];
        if (sameDay(day, state.today)) classes.push('current');
        return '<div class="' + classes.join(' ') + '"><strong>' + escapeHtml(new Intl.DateTimeFormat('en-CA', { weekday: 'short', day: 'numeric' }).format(day)) + '</strong><span>' + (sameDay(day, state.selectedDate) ? 'Selected' : escapeHtml(new Intl.DateTimeFormat('en-CA', { month: 'short' }).format(day))) + '</span></div>';
      }).join('')
      + '</div>';

    const axis = '<div class="calendar-time-axis" style="height:' + totalHeight + 'px;">'
      + Array.from({ length: HOUR_END - HOUR_START + 1 }).map((_, index) => {
        const hour = HOUR_START + index;
        return '<div class="calendar-time-label" style="top:' + (index * ROW_HEIGHT - 8) + 'px;">' + escapeHtml(formatTime(withTime(state.selectedDate, hour, 0))) + '</div>';
      }).join('')
      + '</div>';

    const columns = days.map(day => {
      const laidOut = overlapLayout(eventsForDate(day));
      return '<div class="calendar-day-column' + (sameDay(day, state.selectedDate) ? ' selected' : '') + '"><div class="calendar-day-track" style="height:' + totalHeight + 'px;">'
        + Array.from({ length: HOUR_END - HOUR_START }).map((_, index) => {
          const hour = HOUR_START + index;
          return '<div class="calendar-drop-slot" style="top:' + (index * ROW_HEIGHT) + 'px;height:' + ROW_HEIGHT + 'px;" ondragover="CAL.allowTaskDrop(event)" ondrop="CAL.dropTask(event, \'' + dateKey(day) + '\', ' + hour + ')" onclick="CAL.jumpToDate(\'' + dateKey(day) + '\')"></div>';
        }).join('')
        + laidOut.map(item => renderEventBlock(item)).join('')
        + '</div></div>';
    }).join('');

    return '<div class="calendar-time-shell">' + head + '<div class="calendar-time-grid" style="grid-template-columns:72px repeat(' + days.length + ', minmax(0, 1fr));">' + axis + columns + '</div></div>';
  }

  function renderEventBlock(layout) {
    const event = layout.event;
    const meta = TYPE_META[event.type];
    const start = parseLocalIso(event.start);
    const end = parseLocalIso(event.end);
    const top = ((start.getHours() + start.getMinutes() / 60) - HOUR_START) * ROW_HEIGHT + 6;
    const height = Math.max(48, durationMinutes(event) / 60 * ROW_HEIGHT - 4);
    const widthPct = 100 / layout.columns;
    const leftPct = widthPct * layout.column;
    return '<button class="calendar-event-block' + (state.selectedEventId === event.id ? ' active' : '') + '" style="top:' + top + 'px;height:' + height + 'px;left:calc(' + leftPct + '% + 6px);width:calc(' + widthPct + '% - 12px);background:' + meta.surface + ';border-color:' + meta.border + ';color:' + meta.color + ';" onclick="CAL.selectEvent(\'' + event.id + '\')">'
      + '<span class="calendar-event-time">' + escapeHtml(formatTime(start)) + '</span>'
      + '<span class="calendar-event-block-title">' + escapeHtml(event.title) + '</span>'
      + '</button>';
  }

  function renderAgendaView() {
    const start = state.selectedDate;
    const grouped = [];
    for (let i = 0; i <= 13; i += 1) {
      const day = addDays(start, i);
      const items = eventsForDate(day);
      if (items.length) grouped.push({ day, items });
    }
    if (!grouped.length) return '<div class="calendar-empty" style="margin:20px;">Nothing is scheduled in this range yet.</div>';
    return '<div class="calendar-agenda">' + grouped.map(group => '<div class="calendar-agenda-group"><div class="calendar-agenda-date">' + escapeHtml(formatLongDate(group.day)) + '</div><div class="calendar-agenda-list">' + group.items.map(event => {
      const meta = TYPE_META[event.type];
      const startDate = parseLocalIso(event.start);
      const endDate = parseLocalIso(event.end);
      return '<button class="calendar-agenda-row" onclick="CAL.selectEvent(\'' + event.id + '\')">'
        + '<div class="calendar-agenda-row-time">' + escapeHtml(formatRange(startDate, endDate)) + '</div>'
        + '<div class="calendar-agenda-row-copy"><strong>' + escapeHtml(event.title) + '</strong><span>' + escapeHtml(event.notes || meta.label) + '</span></div>'
        + '<span class="calendar-status-chip"><span class="calendar-chip-swatch" style="background:' + meta.dot + '"></span>' + meta.label + '</span>'
        + '</button>';
    }).join('') + '</div></div>').join('') + '</div>';
  }

  function renderMainBoard() {
    if (state.view === 'month') return renderMonthView();
    if (state.view === 'day') return renderTimeGrid([state.selectedDate]);
    if (state.view === 'agenda') return renderAgendaView();
    const weekStart = startOfWeek(state.cursorDate);
    const weekDays = Array.from({ length: 7 }).map((_, index) => addDays(weekStart, index));
    return renderTimeGrid(weekDays);
  }
  function renderTodayPanel() {
    const upcoming = nextUpcoming(3);
    if (!upcoming.length) return '<div class="calendar-empty">Your calendar is wide open.</div>';
    return upcoming.map(event => {
      const meta = TYPE_META[event.type];
      const start = parseLocalIso(event.start);
      return '<button class="calendar-next-item" onclick="CAL.selectEvent(\'' + event.id + '\')">'
        + '<div class="calendar-next-time">' + escapeHtml(formatShortDate(start)) + ' / ' + escapeHtml(formatTime(start)) + '</div>'
        + '<div class="calendar-next-title">' + escapeHtml(event.title) + '</div>'
        + '<div class="calendar-next-meta">' + escapeHtml(meta.label + ' / ' + (event.location || event.notes || 'Ready to run')) + '</div>'
        + '<div style="text-align:right;margin-top:4px;"><button onclick="event.stopPropagation();CAL.deleteEvent(\'' + event.id + '\')" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;">delete</button></div>'
        + '</button>';
    }).join('');
  }

  function renderTasks() {
    const tasks = visibleTasks();
    if (!tasks.length) return '<div class="calendar-empty">All tasks are scheduled.</div>';
    return tasks.map(task => '<div class="calendar-task-card" draggable="true" ondragstart="CAL.dragTaskStart(event, \'' + task.id + '\')">'
      + '<div class="calendar-task-header">'
      + '<div><div class="calendar-task-title">' + escapeHtml(task.title) + '</div><div class="calendar-task-meta">' + task.duration + ' min / due ' + escapeHtml(formatShortDate(parseLocalIso(task.due))) + ' / drag onto the calendar</div></div>'
      + '<span class="calendar-priority ' + task.priority + '">' + escapeHtml(task.priority) + '</span>'
      + '</div>'
      + '<div class="calendar-task-actions">'
      + '<button class="calendar-btn tiny" onclick="CAL.blockTask(\'' + task.id + '\')">Block time</button>'
      + '<button class="calendar-btn tiny ghost" onclick="CAL.markTaskDone(\'' + task.id + '\')">Done</button>'
      + '</div>'
      + '</div>').join('');
  }

  function renderSuggestions() {
    const suggestions = buildSuggestions();
    if (!suggestions.length) return '<div class="calendar-empty">No suggestions at the moment.</div>';
    return suggestions.map(item => '<div class="calendar-suggestion">'
      + '<div class="calendar-suggestion-title">' + escapeHtml(item.title) + '</div>'
      + '<div class="calendar-suggestion-copy">' + escapeHtml(item.copy) + '</div>'
      + '<div class="calendar-action-row"><button class="calendar-btn tiny" onclick="' + item.action + '">' + escapeHtml(item.cta) + '</button></div>'
      + '</div>').join('');
  }

  function selectedEvent() {
    ensureSelection();
    return state.selectedEventId ? findEvent(state.selectedEventId) : null;
  }

  function renderAttachments(event) {
    if (!event.attachments || !event.attachments.length) return '<div class="calendar-empty" style="margin-top:12px;">No attachments yet.</div>';
    return '<div class="calendar-attachment-list">' + event.attachments.map(item => {
      const href = item.href || '#';
      return '<a class="calendar-attachment" href="' + escapeHtml(href) + '" target="_blank">' + escapeHtml(item.label) + '</a>';
    }).join('') + '</div>';
  }

  function renderDetailCard() {
    const event = selectedEvent();
    if (!event) return '<div class="calendar-empty">Select an event to see notes and quick actions.</div>';
    const meta = TYPE_META[event.type];
    const start = parseLocalIso(event.start);
    const end = parseLocalIso(event.end);
    return '<div class="calendar-detail-card">'
      + '<div class="calendar-detail-label">' + (event.type === 'meeting' ? 'Meeting intelligence' : 'Selected event') + '</div>'
      + '<div class="calendar-detail-top">'
      + '<div><div class="calendar-detail-title">' + escapeHtml(event.title) + '</div><div class="calendar-detail-meta">' + escapeHtml(formatLongDate(start) + ' / ' + formatRange(start, end)) + (event.location ? ' / ' + escapeHtml(event.location) : '') + '</div></div>'
      + '<span class="calendar-status-chip"><span class="calendar-chip-swatch" style="background:' + meta.dot + '"></span>' + meta.label + '</span>'
      + '</div>'
      + '<textarea class="calendar-note-input" placeholder="Add notes for this meeting or reminder..." oninput="CAL.updateNotes(\'' + event.id + '\', this.value)">' + escapeHtml(event.notes || '') + '</textarea>'
      + renderAttachments(event)
      + '<div class="calendar-action-row">'
      + '<button class="calendar-btn tiny" onclick="CAL.snoozeSelected(15)">Snooze 15m</button>'
      + '<button class="calendar-btn tiny ghost" onclick="CAL.moveSelectedTomorrow()">Tomorrow 10:00</button>'
      + '<button class="calendar-btn tiny ghost" onclick="CAL.convertSelectedToTask()">Convert to task</button>'
      + (event.type === 'meeting' ? '<button class="calendar-btn tiny" onclick="CAL.prepareBrief()">Prepare brief</button><button class="calendar-btn tiny" onclick="CAL.createRecapFor(\'' + event.id + '\')">Summarize after</button>' : '')
      + '</div>'
      + '</div>';
  }

  function renderRightRail() {
    return '<div class="calendar-section">'
      + '<div class="calendar-section-head"><div class="calendar-section-title">Today</div></div>'
      + '<div class="calendar-today-list">' + renderTodayPanel() + '</div>'
      + '</div>'
      + '<div class="calendar-section">'
      + '<div class="calendar-section-head"><div class="calendar-section-title">Tasks to schedule</div><button class="calendar-section-link" onclick="CAL.blockTopTask()">Use best slot</button></div>'
      + '<div class="calendar-task-list">' + renderTasks() + '</div>'
      + '</div>'
      + '<div class="calendar-section">'
      + '<div class="calendar-section-head"><div class="calendar-section-title">Agent suggestions</div></div>'
      + '<div class="calendar-suggestion-list">' + renderSuggestions() + '</div>'
      + '</div>'
      + '<div class="calendar-section">'
      + '<div class="calendar-section-head"><div class="calendar-section-title">Meeting intelligence</div></div>'
      + renderDetailCard()
      + '</div>';
  }

  function renderFlash() {
    if (!state.flash) return '';
    return '<div class="calendar-flash' + (state.flash.tone === 'warn' ? ' warn' : '') + '">' + escapeHtml(state.flash.message) + '</div>';
  }

  function renderTop() {
    return '<div class="calendar-top-row">'
      + '<div>'
      + '<div class="calendar-kicker">Time command</div>'
      + '<div class="calendar-title">Calendar</div>'
      + '<div class="calendar-subtitle">Plan the day, protect focus, and let the agent turn plain language into scheduled actions without leaving the workspace.</div>'
      + '</div>'
      + '<div class="calendar-actions">'
      + '<button class="calendar-btn primary" onclick="CAL.quickAdd(\'event\')">Add event</button>'
      + '<button class="calendar-btn" onclick="CAL.quickAdd(\'reminder\')">Add reminder</button>'
      + '<button class="calendar-btn" onclick="CAL.quickAdd(\'focus\')">Add focus block</button>'
      + '<button class="calendar-btn warm" onclick="CAL.quickAdd(\'workflow\')">Add recurring workflow</button>'
      + '</div>'
      + '</div>'
      + '<div class="calendar-command">'
      + '<div class="calendar-input-wrap">'
      + '<div class="calendar-input-icon">AI</div>'
      + '<div class="calendar-input-group">'
      + '<label class="calendar-input-label" for="calendar-natural-input">Schedule with AI</label>'
      + '<input id="calendar-natural-input" class="calendar-input" type="text" value="' + escapeHtml(state.command) + '" oninput="CAL.updateCommand(this.value)" />'
      + '</div></div>'
      + '<button class="calendar-btn primary" onclick="CAL.scheduleWithAI()">Turn text into event</button>'
      + '</div>'
      + '<div class="calendar-command-examples">' + renderCommandExamples() + '</div>'
      + '<div class="calendar-legend">' + renderLegend() + '</div>';
  }

  function render() {
    const root = document.getElementById('calendar-app');
    if (!root) return;
    ensureSelection();
    if (!state.gcalFetchStarted) {
      state.gcalFetchStarted = true;
      loadGoogleEvents();
    }
    root.innerHTML = '<div class="calendar-shell">'
      + '<div class="calendar-top">' + renderTop() + '</div>'
      + '<div class="calendar-workspace calendar-view-' + state.view + '">'
      + '<aside class="calendar-rail calendar-rail-left">' + renderLeftRail() + '</aside>'
      + '<section class="calendar-stage">' + renderFlash() + renderPriorityBanner() + renderDeadlineStrip() + '<div class="calendar-board">' + renderToolbar() + renderMainBoard() + '</div></section>'
      + '<aside class="calendar-rail calendar-rail-right">' + renderRightRail() + '</aside>'
      + '</div></div>';
  }
  function jumpToDate(value) {
    const date = typeof value === 'string' ? parseDateKey(value) : startOfDay(value);
    state.selectedDate = date;
    state.cursorDate = date;
    if (state.view === 'agenda') state.view = 'day';
    render();
  }

  function goToday() {
    state.selectedDate = state.today;
    state.cursorDate = state.today;
    render();
  }

  function navigate(step) {
    if (state.view === 'month') {
      state.cursorDate = addMonths(state.cursorDate, step);
      state.selectedDate = startOfDay(new Date(state.cursorDate.getFullYear(), state.cursorDate.getMonth(), 1));
    } else if (state.view === 'week') {
      state.cursorDate = addDays(state.cursorDate, step * 7);
      state.selectedDate = addDays(state.selectedDate, step * 7);
    } else {
      state.cursorDate = addDays(state.cursorDate, step);
      state.selectedDate = addDays(state.selectedDate, step);
    }
    render();
  }

  function changeView(view) {
    state.view = view;
    render();
  }

  function selectEvent(id) {
    const event = findEvent(id);
    if (!event) return;
    state.selectedEventId = id;
    state.selectedDate = parseDateKey(dateKey(event.start));
    if (state.view === 'month') state.cursorDate = state.selectedDate;
    render();
  }

  function setSearch(value) {
    state.search = value;
    render();
  }

  function toggleFilter(type) {
    state.filters[type] = !state.filters[type];
    const activeFilters = Object.keys(state.filters).filter(key => state.filters[key]);
    if (!activeFilters.length) state.filters[type] = true;
    render();
  }

  function updateCommand(value) {
    state.command = value;
  }

  function loadCommand(value) {
    state.command = value;
    render();
  }

  function setFlash(message, tone) {
    state.flash = { message: message, tone: tone || 'info' };
    if (state.flashTimer) window.clearTimeout(state.flashTimer);
    state.flashTimer = window.setTimeout(function () {
      state.flash = null;
      const view = document.getElementById('view-calendar');
      if (view && view.classList.contains('active')) render();
    }, 3500);
  }

  function parseWeekdayToken(baseDate, token, forceNext) {
    const names = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    };
    const target = names[token];
    if (typeof target !== 'number') return startOfDay(baseDate);
    const current = startOfDay(baseDate);
    let diff = (target - current.getDay() + 7) % 7;
    if (diff === 0 || forceNext) diff += 7;
    return addDays(current, diff);
  }

  function parseTimeToken(text, fallbackHour) {
    const timeMatch = text.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!timeMatch) return { hour: fallbackHour, minute: 0 };
    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] || 0);
    const suffix = (timeMatch[3] || '').toLowerCase();
    if (suffix === 'pm' && hour < 12) hour += 12;
    if (suffix === 'am' && hour === 12) hour = 0;
    if (!suffix && hour < 7) hour += 12;
    return { hour, minute };
  }

  function parseDurationToken(text, fallback) {
    const durationMatch = text.match(/for\s+(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours)/i);
    if (!durationMatch) return fallback;
    const value = Number(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    return unit.startsWith('h') ? value * 60 : value;
  }

  function parseNaturalText(text) {
    const lower = text.toLowerCase();
    let type = 'meeting';
    if (lower.includes('focus')) type = 'focus';
    else if (lower.includes('remind')) type = 'reminder';
    else if (lower.includes('workflow') || lower.includes('recurring')) type = 'automation';
    else if (lower.includes('deadline')) type = 'deadline';
    else if (lower.includes('task')) type = 'task';

    let date = state.selectedDate;
    if (lower.includes('tomorrow')) date = addDays(state.today, 1);
    else if (lower.includes('today')) date = state.today;
    else {
      const weekdayMatch = lower.match(/(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
      if (weekdayMatch) {
        date = parseWeekdayToken(state.today, weekdayMatch[2], Boolean(weekdayMatch[1]));
      }
    }

    const defaults = {
      meeting: { hour: 14, minutes: 60 },
      focus: { hour: 9, minutes: 90 },
      reminder: { hour: 11, minutes: 20 },
      automation: { hour: 8, minutes: 30 },
      deadline: { hour: 16, minutes: 30 },
      task: { hour: 10, minutes: 60 }
    };
    const time = parseTimeToken(lower, defaults[type].hour);
    const duration = parseDurationToken(lower, defaults[type].minutes);

    const cleaned = text
      .replace(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/ig, '')
      .replace(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/ig, '')
      .replace(/at\s+\d{1,2}(?::\d{2})?\s*(am|pm)?/ig, '')
      .replace(/for\s+\d+\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours)/ig, '')
      .replace(/^remind me to\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    const title = cleaned
      ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
      : TYPE_META[type].label;

    const start = withTime(date, time.hour, time.minute);
    const end = addMinutes(start, duration);
    return { title, type, start, end };
  }

  function createEvent(data) {
    const event = Object.assign({
      id: uid('evt'),
      attachments: [],
      notes: ''
    }, data);
    state.events.push(event);
    state.events.sort(compareEvents);
    state.selectedEventId = event.id;
    state.selectedDate = parseDateKey(dateKey(event.start));
    state.cursorDate = state.selectedDate;
    // Sync to Google Calendar if configured (skip events already from gcal)
    if (state.gcalConfigured && !data.gcalId) {
      fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: event.title, start: event.start, end: event.end, notes: event.notes || '' })
      }).catch(function () {});
    }
    return event;
  }

  async function scheduleWithAI() {
    const input = state.command.trim();
    if (!input) return;

    if (state.gcalConfigured) {
      try {
        const resp = await fetch('/api/calendar/quick-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: input })
        });
        if (resp.ok) {
          const gEvent = await resp.json();
          const startRaw = gEvent.start && (gEvent.start.dateTime || gEvent.start.date + 'T00:00');
          const endRaw = gEvent.end && (gEvent.end.dateTime || gEvent.end.date + 'T23:59');
          if (startRaw) {
            const startDate = new Date(startRaw);
            const endDate = new Date(endRaw || startRaw);
            const event = Object.assign({
              id: uid('gcal'),
              attachments: [],
              notes: 'Created from natural language command. Synced to Google Calendar.'
            }, {
              title: gEvent.summary || input,
              type: 'meeting',
              start: formatLocalIso(startDate),
              end: formatLocalIso(endDate),
              gcalId: gEvent.id
            });
            state.events.push(event);
            state.events.sort(compareEvents);
            state.selectedEventId = event.id;
            state.selectedDate = parseDateKey(dateKey(event.start));
            state.cursorDate = state.selectedDate;
            const exactDate = new Intl.DateTimeFormat('en-CA', {
              weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
            }).format(startDate);
            setFlash('Scheduled "' + event.title + '" on Google Calendar for ' + exactDate + '.', 'info');
            render();
            return;
          }
        }
      } catch (_) {
        // Fall through to local parse
      }
    }

    // Local parse fallback (no Google Calendar configured or API error)
    const parsed = parseNaturalText(input);
    const created = createEvent({
      title: parsed.title,
      type: parsed.type,
      start: formatLocalIso(parsed.start),
      end: formatLocalIso(parsed.end),
      notes: 'Created from natural language command.'
    });
    const exactDate = new Intl.DateTimeFormat('en-CA', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(parsed.start);
    setFlash('Scheduled "' + created.title + '" for ' + exactDate + '.', 'info');
    render();
  }
  function quickAdd(kind) {
    const day = state.selectedDate;
    if (kind === 'event') {
      createEvent({
        title: 'New planning session',
        type: 'meeting',
        start: formatLocalIso(withTime(day, 14, 0)),
        end: formatLocalIso(withTime(day, 14, 45)),
        notes: 'Quick added from the calendar.'
      });
      setFlash('Added a planning session on ' + formatShortDate(day) + '.', 'info');
    } else if (kind === 'reminder') {
      createEvent({
        title: 'Quick reminder',
        type: 'reminder',
        start: formatLocalIso(withTime(day, 11, 0)),
        end: formatLocalIso(withTime(day, 11, 20)),
        notes: 'Use snooze or reschedule to tune this reminder.'
      });
      setFlash('Added a reminder on ' + formatShortDate(day) + '.', 'info');
    } else if (kind === 'focus') {
      createEvent({
        title: 'Protected focus block',
        type: 'focus',
        start: formatLocalIso(withTime(day, 9, 0)),
        end: formatLocalIso(withTime(day, 10, 30)),
        notes: 'A clean 90 minute block for high-value work.'
      });
      setFlash('Protected a focus block on ' + formatShortDate(day) + '.', 'info');
    } else {
      createEvent({
        title: 'Recurring workflow',
        type: 'automation',
        start: formatLocalIso(withTime(day, 8, 0)),
        end: formatLocalIso(withTime(day, 8, 30)),
        notes: 'Recurring routine ready for a future automation backend.',
        recurring: 'Weekly'
      });
      setFlash('Added a recurring workflow placeholder.', 'info');
    }
    render();
  }

  function bestSlotForTask(task) {
    const candidates = [state.selectedDate, parseDateKey(dateKey(task.due)), addDays(state.today, 1), addDays(state.today, 2)];
    for (let i = 0; i < candidates.length; i += 1) {
      const windows = freeWindows(candidates[i], task.duration);
      if (windows.length) return windows[0].start;
    }
    return withTime(state.selectedDate, 10, 0);
  }

  function blockTask(taskId, explicitDateKey, explicitHour) {
    const task = findTask(taskId);
    if (!task) return;
    let start;
    if (explicitDateKey) {
      const candidateDay = parseDateKey(explicitDateKey);
      start = withTime(candidateDay, Number(explicitHour), 0);
      const windows = freeWindows(candidateDay, task.duration);
      const matching = windows.find(window => window.start <= start && addMinutes(start, task.duration) <= window.end);
      if (!matching && windows.length) start = windows[0].start;
    } else {
      start = bestSlotForTask(task);
    }
    const end = addMinutes(start, task.duration);
    createEvent({
      title: task.title,
      type: task.tags && task.tags.includes('focus') ? 'focus' : 'task',
      start: formatLocalIso(start),
      end: formatLocalIso(end),
      notes: task.notes || 'Scheduled from the task list.'
    });
    state.tasks = state.tasks.filter(item => item.id !== taskId);
    setFlash('Blocked time for ' + task.title + ' on ' + formatShortDate(start) + ' at ' + formatTime(start) + '.', 'info');
    render();
  }

  function blockTopTask() {
    const task = visibleTasks()[0];
    if (!task) {
      setFlash('There are no unscheduled tasks left to block.', 'warn');
      render();
      return;
    }
    blockTask(task.id);
  }

  function markTaskDone(taskId) {
    const task = findTask(taskId);
    if (!task) return;
    task.done = true;
    setFlash('Marked ' + task.title + ' as done.', 'info');
    render();
  }

  function dragTaskStart(evt, taskId) {
    state.draggedTaskId = taskId;
    evt.dataTransfer.setData('text/plain', taskId);
    evt.dataTransfer.effectAllowed = 'move';
  }

  function allowTaskDrop(evt) {
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'move';
  }

  function dropTask(evt, dateStr, hour) {
    evt.preventDefault();
    const taskId = evt.dataTransfer.getData('text/plain') || state.draggedTaskId;
    if (!taskId) return;
    state.draggedTaskId = null;
    blockTask(taskId, dateStr, hour);
  }

  function updateNotes(eventId, value) {
    const event = findEvent(eventId);
    if (!event) return;
    event.notes = value;
  }

  function snoozeSelected(minutes) {
    const event = selectedEvent();
    if (!event) return;
    const start = addMinutes(parseLocalIso(event.start), minutes);
    const end = addMinutes(parseLocalIso(event.end), minutes);
    event.start = formatLocalIso(start);
    event.end = formatLocalIso(end);
    setFlash('Snoozed ' + event.title + ' by ' + minutes + ' minutes.', 'info');
    render();
  }

  function moveSelectedTomorrow() {
    const event = selectedEvent();
    if (!event) return;
    const duration = durationMinutes(event);
    const tomorrow = addDays(state.today, 1);
    const start = withTime(tomorrow, 10, 0);
    event.start = formatLocalIso(start);
    event.end = formatLocalIso(addMinutes(start, duration));
    state.selectedDate = tomorrow;
    state.cursorDate = tomorrow;
    setFlash('Moved ' + event.title + ' to tomorrow at 10:00.', 'info');
    render();
  }

  function convertSelectedToTask() {
    const event = selectedEvent();
    if (!event || event.type === 'automation') {
      setFlash('Automation routines stay on the calendar. Pick a different event to convert.', 'warn');
      render();
      return;
    }
    state.tasks.push({
      id: uid('tsk'),
      title: event.title,
      duration: durationMinutes(event),
      due: event.start,
      priority: event.type === 'deadline' ? 'urgent' : 'high',
      done: false,
      notes: event.notes || 'Converted from a scheduled event.',
      tags: [event.type]
    });
    state.tasks.sort(compareTasks);
    state.events = state.events.filter(item => item.id !== event.id);
    state.selectedEventId = null;
    setFlash('Converted ' + event.title + ' into an unscheduled task.', 'info');
    render();
  }

  function prepareBrief() {
    const event = selectedEvent();
    if (!event || event.type !== 'meeting') return;
    const alreadyExists = state.events.some(item => item.title === 'Prepare brief - ' + event.title);
    if (alreadyExists) {
      setFlash('A prep brief already exists for this meeting.', 'warn');
      render();
      return;
    }
    const start = addMinutes(parseLocalIso(event.start), -45);
    createEvent({
      title: 'Prepare brief - ' + event.title,
      type: 'task',
      start: formatLocalIso(start),
      end: formatLocalIso(addMinutes(start, 30)),
      notes: 'Auto-created prep task before the meeting.'
    });
    setFlash('Prep brief added before ' + event.title + '.', 'info');
    render();
  }

  function createRecapFor(eventId) {
    const event = findEvent(eventId);
    if (!event) return;
    const recapTitle = 'Recap - ' + event.title;
    if (state.events.some(item => item.title === recapTitle)) {
      setFlash('A recap task already exists for this meeting.', 'warn');
      render();
      return;
    }
    const start = addMinutes(parseLocalIso(event.end), 15);
    createEvent({
      title: recapTitle,
      type: 'task',
      start: formatLocalIso(start),
      end: formatLocalIso(addMinutes(start, 30)),
      notes: 'Auto-created follow-up task after the meeting.'
    });
    setFlash('Recap task added after ' + event.title + '.', 'info');
    render();
  }

  function shiftEvent(eventId, minutes) {
    const event = findEvent(eventId);
    if (!event) return;
    event.start = formatLocalIso(addMinutes(parseLocalIso(event.start), minutes));
    event.end = formatLocalIso(addMinutes(parseLocalIso(event.end), minutes));
    state.selectedEventId = eventId;
    setFlash('Moved ' + event.title + ' by ' + minutes + ' minutes.', 'info');
    render();
  }

  // -- GOOGLE CALENDAR SYNC ---------------------------------------

  function googleEventToInternal(gEvent) {
    const startRaw = gEvent.start.dateTime || (gEvent.start.date + 'T00:00');
    const endRaw = gEvent.end.dateTime || (gEvent.end.date + 'T23:59');
    const start = formatLocalIso(new Date(startRaw));
    const end = formatLocalIso(new Date(endRaw));
    const summary = (gEvent.summary || '').toLowerCase();
    let type = 'meeting';
    if (summary.includes('focus') || summary.includes('deep work')) type = 'focus';
    else if (summary.includes('deadline') || summary.includes('due')) type = 'deadline';
    else if (summary.includes('remind') || summary.includes('reminder')) type = 'reminder';
    else if (summary.includes('task') || summary.includes('todo')) type = 'task';
    return {
      id: 'gcal_' + gEvent.id,
      title: gEvent.summary || '(No title)',
      type,
      start,
      end,
      notes: gEvent.description || '',
      attachments: [],
      location: gEvent.location || null,
      gcalId: gEvent.id
    };
  }

  async function loadGoogleEvents() {
    try {
      const statusResp = await fetch('/api/calendar/status');
      if (!statusResp.ok) return;
      const status = await statusResp.json();
      if (!status.configured) return;
      state.gcalConfigured = true;

      const resp = await fetch('/api/calendar/events');
      if (!resp.ok) return;
      const data = await resp.json();
      const gEvents = (data.events || []).filter(e => e.start);
      if (gEvents.length === 0) return;

      const converted = gEvents.map(googleEventToInternal).sort(compareEvents);
      state.events = converted;

      const now = new Date();
      const upcoming = state.events.find(e => parseLocalIso(e.end) >= now);
      if (upcoming) {
        state.selectedEventId = upcoming.id;
        state.selectedDate = parseDateKey(dateKey(upcoming.start));
        state.cursorDate = state.selectedDate;
      }
      render();
    } catch (_) {
      // Keep seed data on any error
    }
  }

  // --------------------------------------------------------------


  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    try {
      const r = await fetch('/api/calendar/events/' + id, { method: 'DELETE', credentials: 'same-origin' });
      if (!r.ok) { alert('Delete failed - try again'); return; }
    } catch(e) { alert('Network error - delete failed'); return; }
    state.events = state.events.filter(function(e) { return e.id !== id; });
    if (state.selectedEventId === id) {
      state.selectedEventId = state.events.length ? state.events[0].id : null;
    }
    render();
  }
  window.CAL = {
    render,
    navigate,
    goToday,
    changeView,
    selectEvent,
    deleteEvent,
    toggleFilter,
    setSearch,
    updateCommand,
    loadCommand,
    scheduleWithAI,
    quickAdd,
    jumpToDate,
    blockTask,
    blockTopTask,
    markTaskDone,
    dragTaskStart,
    allowTaskDrop,
    dropTask,
    updateNotes,
    snoozeSelected,
    moveSelectedTomorrow,
    convertSelectedToTask,
    prepareBrief,
    createRecapFor,
    shiftEvent,
    loadGoogleEvents
  };
})();
