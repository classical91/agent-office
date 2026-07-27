(function () {
  'use strict';

  const POPUP_ID = 'calendar-mobile-day-popup';
  const STYLE_ID = 'calendar-mobile-event-add-style';
  const ENHANCED_ATTR = 'data-add-event-enhanced';
  const TYPE_COLORS = {
    meeting: '#60a5fa',
    task: '#4ade80',
    deadline: '#fb923c',
    reminder: '#22d3ee',
    automation: '#c084fc',
    focus: '#818cf8'
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .calendar-mobile-add-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 42px;
        margin: 0 0 12px;
        border: 1px solid rgba(56, 189, 248, 0.34);
        border-radius: 13px;
        background: linear-gradient(180deg, rgba(14, 165, 233, 0.22), rgba(2, 132, 199, 0.14));
        color: #bae6fd;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.03em;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .calendar-mobile-add-form {
        display: none;
        margin: 0 0 12px;
        padding: 13px;
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 16px;
        background: rgba(15, 23, 42, 0.78);
      }
      .calendar-mobile-add-form.open { display: block; }
      .calendar-mobile-add-advanced-toggle {
        width: 100%;
        min-height: 36px;
        margin: 0 0 11px;
        border: 1px dashed rgba(148, 163, 184, 0.32);
        border-radius: 11px;
        background: transparent;
        color: #94a3b8;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .calendar-mobile-add-advanced { display: none; }
      .calendar-mobile-add-advanced.open { display: block; }
      .calendar-mobile-add-check {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        color: #cbd5e1;
        font-size: 12px;
      }
      .calendar-mobile-add-field { margin-bottom: 11px; }
      .calendar-mobile-add-label {
        display: block;
        margin-bottom: 5px;
        color: #94a3b8;
        font-size: 11px;
        font-weight: 750;
        letter-spacing: 0.07em;
        text-transform: uppercase;
      }
      .calendar-mobile-add-input,
      .calendar-mobile-add-textarea {
        width: 100%;
        min-height: 44px;
        box-sizing: border-box;
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 12px;
        padding: 10px 11px;
        background: rgba(2, 6, 23, 0.62);
        color: #f8fafc;
        font: 600 16px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        outline: none;
      }
      .calendar-mobile-add-input:focus,
      .calendar-mobile-add-textarea:focus {
        border-color: rgba(56, 189, 248, 0.72);
        box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.12);
      }
      .calendar-mobile-add-textarea {
        min-height: 78px;
        resize: vertical;
      }
      .calendar-mobile-add-time-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 10px;
      }
      .calendar-mobile-add-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 9px;
        margin-top: 4px;
      }
      .calendar-mobile-add-cancel,
      .calendar-mobile-add-save {
        min-height: 40px;
        border-radius: 11px;
        padding: 9px 13px;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }
      .calendar-mobile-add-cancel {
        border: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(30, 41, 59, 0.68);
        color: #cbd5e1;
      }
      .calendar-mobile-add-save {
        border: 1px solid rgba(56, 189, 248, 0.46);
        background: #0284c7;
        color: white;
      }
      .calendar-mobile-add-save:disabled { opacity: 0.58; cursor: wait; }
      .calendar-mobile-add-message {
        min-height: 18px;
        margin-top: 9px;
        color: #94a3b8;
        font-size: 12px;
        line-height: 1.4;
      }
      .calendar-mobile-add-message.error { color: #fca5a5; }
      .calendar-mobile-add-message.success { color: #86efac; }
    `;
    document.head.appendChild(style);
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function timeValue(date) {
    return pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function defaultTimes(dateKey) {
    const now = new Date();
    const todayKey = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    let start;
    if (dateKey === todayKey) {
      start = new Date(now);
      start.setSeconds(0, 0);
      const remainder = start.getMinutes() % 30;
      start.setMinutes(start.getMinutes() + (remainder ? 30 - remainder : 30));
    } else {
      start = new Date(dateKey + 'T09:00:00');
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { start: timeValue(start), end: timeValue(end) };
  }

  function eventDateKey(event) {
    const start = event && event.start;
    if (!start) return '';
    if (typeof start === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return start;
      const parsed = new Date(start);
      return Number.isNaN(parsed.getTime()) ? '' : parsed.getFullYear() + '-' + pad(parsed.getMonth() + 1) + '-' + pad(parsed.getDate());
    }
    if (start.date) return start.date;
    if (start.dateTime) return eventDateKey({ start: start.dateTime });
    return '';
  }

  function eventTimeLabel(event) {
    const start = event.start || {};
    const end = event.end || {};
    if (start.date || (typeof start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start))) return 'All day';
    const startRaw = typeof start === 'string' ? start : start.dateTime;
    const endRaw = typeof end === 'string' ? end : end.dateTime;
    const startDate = new Date(startRaw);
    const endDate = new Date(endRaw || startRaw);
    if (Number.isNaN(startDate.getTime())) return 'Scheduled';
    const formatter = new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit' });
    return formatter.format(startDate) + (Number.isNaN(endDate.getTime()) ? '' : ' – ' + formatter.format(endDate));
  }

  function eventType(event) {
    const requested = String(event.type || '').toLowerCase();
    if (TYPE_COLORS[requested]) return requested;
    const title = String(event.summary || event.title || '').toLowerCase();
    if (title.includes('focus')) return 'focus';
    if (title.includes('deadline') || title.includes('due')) return 'deadline';
    if (title.includes('remind')) return 'reminder';
    if (title.includes('task') || title.includes('todo')) return 'task';
    return 'meeting';
  }

  function renderEvents(events) {
    if (!events.length) {
      return '<div class="calendar-mobile-day-empty">Nothing is scheduled on this date.</div>';
    }
    return events.map(event => {
      const type = eventType(event);
      const color = TYPE_COLORS[type] || TYPE_COLORS.meeting;
      const title = event.summary || event.title || 'Untitled event';
      const detail = event.location || event.description || event.notes || type.charAt(0).toUpperCase() + type.slice(1);
      const id = String(event.id || event.serverId || '');
      const link = event.htmlLink || event.link || '';
      const openAction = link
        ? '<a class="calendar-mobile-day-open" href="' + escapeHtml(link) + '" target="_blank" rel="noopener noreferrer">Open in Google Calendar ↗</a>'
        : '';
      const deleteAction = id
        ? '<button class="calendar-mobile-day-delete" type="button" data-event-id="' + escapeHtml(id) + '" data-event-title="' + escapeHtml(title) + '">Delete</button>'
        : '';
      const actions = openAction || deleteAction
        ? '<div class="calendar-mobile-day-actions">' + openAction + deleteAction + '</div>'
        : '';
      return '<article class="calendar-mobile-day-event" style="--calendar-event-color:' + color + ';" data-event-id="' + escapeHtml(id) + '">'
        + '<span class="calendar-mobile-day-event-time">' + escapeHtml(eventTimeLabel(event)) + ' · ' + escapeHtml(type) + '</span>'
        + '<span class="calendar-mobile-day-event-title">' + escapeHtml(title) + '</span>'
        + '<span class="calendar-mobile-day-event-meta">' + escapeHtml(detail) + '</span>'
        + actions
        + '</article>';
    }).join('');
  }

  async function refreshPopup(popup) {
    if (!popup || !document.body.contains(popup)) return;
    const dateKey = popup.getAttribute('data-date-key');
    if (!dateKey) return;
    try {
      const response = await fetch('/api/calendar/events?mobileRefresh=' + Date.now(), {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!response.ok) return;
      const payload = await response.json();
      const events = (Array.isArray(payload.events) ? payload.events : []).filter(event => eventDateKey(event) === dateKey);
      const countNode = popup.querySelector('.calendar-mobile-day-count');
      const listNode = popup.querySelector('.calendar-mobile-day-list');
      if (countNode) countNode.textContent = events.length === 1 ? '1 event' : events.length + ' events';
      if (listNode) listNode.innerHTML = renderEvents(events);
    } catch (error) {
      // The original popup remains usable if a refresh fails.
    }
  }

  function setMessage(form, message, tone) {
    const node = form.querySelector('.calendar-mobile-add-message');
    node.className = 'calendar-mobile-add-message' + (tone ? ' ' + tone : '');
    node.textContent = message || '';
  }

  const EVENT_KINDS = [
    { id: 'meeting', label: 'Meeting' },
    { id: 'task', label: 'Task' },
    { id: 'focus', label: 'Focus' },
    { id: 'deadline', label: 'Deadline' },
    { id: 'reminder', label: 'Reminder' },
    { id: 'automation', label: 'Automation' },
    { id: 'agent-run', label: 'Agent run' },
    { id: 'review', label: 'Review' }
  ];

  // Only send what was actually filled in - an empty string clears the field
  // server-side, which is not what leaving a box untouched should mean.
  function collectMeta(form) {
    const meta = {};
    const text = name => (form.elements[name] ? form.elements[name].value.trim() : '');
    if (text('agentId')) meta.agentId = text('agentId');
    if (text('projectId')) meta.projectId = text('projectId');
    if (text('expectedOutput')) meta.expectedOutput = text('expectedOutput');
    meta.eventKind = form.elements.eventKind.value;
    meta.priority = form.elements.priority.value;
    meta.movable = Boolean(form.elements.movable.checked);
    if (form.elements.agentRun.checked) {
      meta.executionMode = 'agent-run';
      meta.runStatus = 'scheduled';
    }
    const startMinutes = form.elements.start.value.split(':');
    const endMinutes = form.elements.end.value.split(':');
    if (startMinutes.length === 2 && endMinutes.length === 2) {
      const minutes = (Number(endMinutes[0]) * 60 + Number(endMinutes[1]))
        - (Number(startMinutes[0]) * 60 + Number(startMinutes[1]));
      if (minutes > 0) meta.estimatedDuration = minutes;
    }
    return meta;
  }

  function buildForm(dateKey) {
    const defaults = defaultTimes(dateKey);
    const form = document.createElement('form');
    form.className = 'calendar-mobile-add-form';
    form.innerHTML = '<div class="calendar-mobile-add-field">'
      + '<label class="calendar-mobile-add-label">Title</label>'
      + '<input class="calendar-mobile-add-input" name="title" type="text" maxlength="200" autocomplete="off" placeholder="Event title" required>'
      + '</div>'
      + '<div class="calendar-mobile-add-time-row">'
      + '<div class="calendar-mobile-add-field"><label class="calendar-mobile-add-label">Starts</label><input class="calendar-mobile-add-input" name="start" type="time" value="' + defaults.start + '" required></div>'
      + '<div class="calendar-mobile-add-field"><label class="calendar-mobile-add-label">Ends</label><input class="calendar-mobile-add-input" name="end" type="time" value="' + defaults.end + '" required></div>'
      + '</div>'
      + '<div class="calendar-mobile-add-field">'
      + '<label class="calendar-mobile-add-label">Notes</label>'
      + '<textarea class="calendar-mobile-add-textarea" name="notes" maxlength="2000" placeholder="Optional notes"></textarea>'
      + '</div>'
      // The first four fields stay the whole form for a quick entry; everything
      // that makes a block an Agent Office block lives behind this disclosure.
      + '<button class="calendar-mobile-add-advanced-toggle" type="button">More options</button>'
      + '<div class="calendar-mobile-add-advanced">'
      + '<div class="calendar-mobile-add-time-row">'
      + '<div class="calendar-mobile-add-field"><label class="calendar-mobile-add-label">Type</label>'
      + '<select class="calendar-mobile-add-input" name="eventKind">'
      + EVENT_KINDS.map(kind => '<option value="' + kind.id + '">' + escapeHtml(kind.label) + '</option>').join('')
      + '</select></div>'
      + '<div class="calendar-mobile-add-field"><label class="calendar-mobile-add-label">Priority</label>'
      + '<select class="calendar-mobile-add-input" name="priority">'
      + ['normal', 'low', 'high', 'urgent'].map(value => '<option value="' + value + '">' + value + '</option>').join('')
      + '</select></div>'
      + '</div>'
      + '<div class="calendar-mobile-add-time-row">'
      + '<div class="calendar-mobile-add-field"><label class="calendar-mobile-add-label">Agent</label>'
      + '<input class="calendar-mobile-add-input" name="agentId" type="text" maxlength="60" autocomplete="off" placeholder="codex"></div>'
      + '<div class="calendar-mobile-add-field"><label class="calendar-mobile-add-label">Project</label>'
      + '<input class="calendar-mobile-add-input" name="projectId" type="text" maxlength="60" autocomplete="off" placeholder="flashcards"></div>'
      + '</div>'
      + '<div class="calendar-mobile-add-field"><label class="calendar-mobile-add-label">Location or meeting link</label>'
      + '<input class="calendar-mobile-add-input" name="location" type="text" maxlength="300" autocomplete="off" placeholder="Optional"></div>'
      + '<div class="calendar-mobile-add-field"><label class="calendar-mobile-add-label">Expected output</label>'
      + '<input class="calendar-mobile-add-input" name="expectedOutput" type="text" maxlength="200" autocomplete="off" placeholder="Draft pull request"></div>'
      + '<label class="calendar-mobile-add-check"><input type="checkbox" name="movable" checked> Flexible - Agent Office may move this</label>'
      + '<label class="calendar-mobile-add-check"><input type="checkbox" name="agentRun"> Run automatically at this time</label>'
      + '</div>'
      + '<div class="calendar-mobile-add-actions">'
      + '<button class="calendar-mobile-add-cancel" type="button">Cancel</button>'
      + '<button class="calendar-mobile-add-save" type="submit">Add event</button>'
      + '</div>'
      + '<div class="calendar-mobile-add-message" aria-live="polite"></div>';
    return form;
  }

  function enhancePopup(popup) {
    if (!popup || popup.hasAttribute(ENHANCED_ATTR)) return;
    popup.setAttribute(ENHANCED_ATTR, 'true');
    ensureStyles();

    const sheet = popup.querySelector('.calendar-mobile-day-sheet');
    const head = popup.querySelector('.calendar-mobile-day-head');
    const list = popup.querySelector('.calendar-mobile-day-list');
    const dateKey = popup.getAttribute('data-date-key');
    if (!sheet || !head || !list || !dateKey) return;

    const toggle = document.createElement('button');
    toggle.className = 'calendar-mobile-add-toggle';
    toggle.type = 'button';
    toggle.textContent = '+ Add event';

    const form = buildForm(dateKey);
    head.insertAdjacentElement('afterend', toggle);
    toggle.insertAdjacentElement('afterend', form);

    toggle.addEventListener('click', () => {
      const opening = !form.classList.contains('open');
      form.classList.toggle('open', opening);
      toggle.textContent = opening ? '− Hide add form' : '+ Add event';
      setMessage(form, '', '');
      if (opening) window.setTimeout(() => form.elements.title.focus(), 40);
    });

    const advancedToggle = form.querySelector('.calendar-mobile-add-advanced-toggle');
    const advanced = form.querySelector('.calendar-mobile-add-advanced');
    advancedToggle.addEventListener('click', () => {
      const opening = !advanced.classList.contains('open');
      advanced.classList.toggle('open', opening);
      advancedToggle.textContent = opening ? 'Fewer options' : 'More options';
    });

    form.querySelector('.calendar-mobile-add-cancel').addEventListener('click', () => {
      form.classList.remove('open');
      toggle.textContent = '+ Add event';
      setMessage(form, '', '');
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const title = form.elements.title.value.trim();
      const startTime = form.elements.start.value;
      const endTime = form.elements.end.value;
      const notes = form.elements.notes.value.trim();
      const save = form.querySelector('.calendar-mobile-add-save');

      if (!title) {
        setMessage(form, 'Add a title first.', 'error');
        form.elements.title.focus();
        return;
      }
      if (!startTime || !endTime || endTime <= startTime) {
        setMessage(form, 'The end time must be later than the start time.', 'error');
        return;
      }

      save.disabled = true;
      save.textContent = 'Adding…';
      setMessage(form, 'Saving to Google Calendar…', '');

      try {
        const response = await fetch('/api/calendar/events', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title,
            start: dateKey + 'T' + startTime,
            end: dateKey + 'T' + endTime,
            notes: notes,
            location: form.elements.location.value.trim(),
            type: form.elements.eventKind.value,
            meta: collectMeta(form)
          })
        });
        let payload = {};
        try { payload = await response.json(); } catch (error) {}
        if (!response.ok) throw new Error(payload.error || 'Could not add this event.');

        setMessage(form, 'Event added.', 'success');
        form.elements.title.value = '';
        form.elements.notes.value = '';
        if (window.CAL && typeof window.CAL.loadGoogleEvents === 'function') {
          try { await window.CAL.loadGoogleEvents(); } catch (error) {}
        }
        await refreshPopup(popup);
        window.setTimeout(() => {
          form.classList.remove('open');
          toggle.textContent = '+ Add event';
          setMessage(form, '', '');
        }, 700);
      } catch (error) {
        setMessage(form, error && error.message ? error.message : 'Could not add this event.', 'error');
      } finally {
        save.disabled = false;
        save.textContent = 'Add event';
      }
    });

    window.setTimeout(() => refreshPopup(popup), 500);
  }

  function scan() {
    const popup = document.getElementById(POPUP_ID);
    if (popup) enhancePopup(popup);
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
