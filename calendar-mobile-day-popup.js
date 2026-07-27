(function () {
  'use strict';

  const MOBILE_QUERY = '(max-width: 640px)';
  const POPUP_ID = 'calendar-mobile-day-popup';
  const STYLE_ID = 'calendar-mobile-day-popup-style';
  const TYPE_COLORS = {
    meeting: '#a5b4fc',
    task: '#86efac',
    deadline: '#fdba74',
    reminder: '#67e8f9',
    automation: '#d8b4fe',
    focus: '#93c5fd'
  };
  let eventCache = { loadedAt: 0, events: [] };

  function isMobile() {
    return Boolean(window.matchMedia && window.matchMedia(MOBILE_QUERY).matches);
  }

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
      .calendar-mobile-day-popup {
        position: fixed;
        inset: 0;
        z-index: 12000;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        background: rgba(2, 6, 23, 0.68);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }
      .calendar-mobile-day-sheet {
        width: 100%;
        max-height: min(74dvh, 680px);
        overflow-y: auto;
        overscroll-behavior: contain;
        box-sizing: border-box;
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-bottom: 0;
        border-radius: 24px 24px 0 0;
        padding: 12px 14px calc(18px + env(safe-area-inset-bottom, 0px));
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.99), rgba(8, 12, 20, 0.99));
        box-shadow: 0 -24px 60px rgba(2, 6, 23, 0.58);
        color: #e2e8f0;
      }
      .calendar-mobile-day-grabber {
        width: 42px;
        height: 4px;
        margin: 0 auto 12px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.38);
      }
      .calendar-mobile-day-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      .calendar-mobile-day-title {
        color: #f8fafc;
        font-size: 18px;
        line-height: 1.25;
        font-weight: 750;
        letter-spacing: -0.02em;
      }
      .calendar-mobile-day-count {
        margin-top: 4px;
        color: #94a3b8;
        font-size: 12px;
      }
      .calendar-mobile-day-close {
        flex: 0 0 34px;
        width: 34px;
        height: 34px;
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 999px;
        background: rgba(30, 41, 59, 0.78);
        color: #e2e8f0;
        font-size: 19px;
        line-height: 32px;
        cursor: pointer;
      }
      .calendar-mobile-day-list {
        display: flex;
        flex-direction: column;
        gap: 9px;
      }
      .calendar-mobile-day-event {
        display: block;
        width: 100%;
        box-sizing: border-box;
        border: 1px solid rgba(148, 163, 184, 0.14);
        border-left: 4px solid var(--calendar-event-color, #38bdf8);
        border-radius: 15px;
        padding: 11px 12px;
        background: rgba(30, 41, 59, 0.68);
        color: #e2e8f0;
        text-align: left;
      }
      .calendar-mobile-day-event-time {
        display: block;
        color: var(--calendar-event-color, #7dd3fc);
        font-size: 11px;
        line-height: 1.35;
        font-weight: 750;
        letter-spacing: 0.07em;
        text-transform: uppercase;
      }
      .calendar-mobile-day-event-title {
        display: block;
        margin-top: 4px;
        color: #f8fafc;
        font-size: 14px;
        line-height: 1.35;
        font-weight: 750;
      }
      .calendar-mobile-day-event-meta {
        display: block;
        margin-top: 5px;
        color: #94a3b8;
        font-size: 12px;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }
      .calendar-mobile-day-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-top: 10px;
      }
      .calendar-mobile-day-open,
      .calendar-mobile-day-delete {
        min-height: 34px;
        border-radius: 10px;
        padding: 7px 10px;
        box-sizing: border-box;
        font: 700 11px/18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-decoration: none;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .calendar-mobile-day-open {
        display: inline-flex;
        align-items: center;
        border: 1px solid rgba(56, 189, 248, 0.24);
        background: rgba(56, 189, 248, 0.08);
        color: #7dd3fc;
      }
      .calendar-mobile-day-delete {
        margin-left: auto;
        border: 1px solid rgba(248, 113, 113, 0.34);
        background: rgba(239, 68, 68, 0.10);
        color: #fca5a5;
      }
      .calendar-mobile-day-delete:disabled {
        opacity: 0.55;
        cursor: wait;
      }
      .calendar-mobile-day-error {
        margin-top: 8px;
        color: #fca5a5;
        font-size: 12px;
        line-height: 1.4;
      }
      .calendar-mobile-day-empty,
      .calendar-mobile-day-loading {
        padding: 18px 14px;
        border: 1px dashed rgba(148, 163, 184, 0.22);
        border-radius: 15px;
        color: #94a3b8;
        font-size: 13px;
        line-height: 1.5;
        text-align: center;
      }
      @media (min-width: 641px) {
        .calendar-mobile-day-popup { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function localDateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = amount => String(amount).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function eventDateKey(event) {
    const start = event && event.start;
    if (!start) return '';
    if (typeof start === 'string') {
      return /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : localDateKey(start);
    }
    if (start.date) return start.date;
    return start.dateTime ? localDateKey(start.dateTime) : '';
  }

  function eventIdentifier(event) {
    return String((event && (event.id || event.serverId)) || '');
  }

  function eventType(event) {
    const requested = String(event.type || '').toLowerCase();
    if (TYPE_COLORS[requested]) return requested;
    const title = String(event.summary || event.title || '').toLowerCase();
    if (title.includes('focus') || title.includes('deep work')) return 'focus';
    if (title.includes('deadline') || title.includes('due')) return 'deadline';
    if (title.includes('remind')) return 'reminder';
    if (title.includes('task') || title.includes('todo')) return 'task';
    return 'meeting';
  }

  function eventTimeLabel(event) {
    const start = event.start || {};
    const end = event.end || {};
    if (start.date || (typeof start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start))) return 'All day';
    const startRaw = typeof start === 'string' ? start : start.dateTime;
    const endRaw = typeof end === 'string' ? end : end.dateTime;
    const startDate = new Date(startRaw);
    const endDate = new Date(endRaw || startRaw);
    if (Number.isNaN(startDate.getTime())) return '';
    const formatter = new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit' });
    return formatter.format(startDate) + (Number.isNaN(endDate.getTime()) ? '' : ' – ' + formatter.format(endDate));
  }

  function popupDateLabel(dateKey) {
    const date = new Date(dateKey + 'T00:00:00');
    return new Intl.DateTimeFormat('en-CA', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).format(date);
  }

  function dateFromCell(cell) {
    const inline = cell && cell.getAttribute('onclick');
    const match = inline && inline.match(/CAL\.jumpToDate\('([^']+)'\)/);
    return match ? match[1] : '';
  }

  function fallbackEventsFromCell(cell) {
    if (!cell) return [];
    return Array.from(cell.querySelectorAll('.calendar-event.small')).map(button => ({
      summary: (button.querySelector('.calendar-event-title') || {}).textContent || 'Event',
      startLabel: (button.querySelector('.calendar-event-time') || {}).textContent || '',
      type: 'meeting',
      description: '',
      location: '',
      htmlLink: ''
    }));
  }

  async function allCalendarEvents(forceRefresh) {
    if (!forceRefresh && Date.now() - eventCache.loadedAt < 30000) return eventCache.events;
    const response = await fetch('/api/calendar/events', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Calendar request failed');
    const payload = await response.json();
    const events = Array.isArray(payload.events) ? payload.events : [];
    eventCache = { loadedAt: Date.now(), events };
    return events;
  }

  function closePopup() {
    const existing = document.getElementById(POPUP_ID);
    if (existing) existing.remove();
  }

  function eventRows(events) {
    if (!events.length) {
      return '<div class="calendar-mobile-day-empty">Nothing is scheduled on this date.</div>';
    }
    return events.map(event => {
      const type = eventType(event);
      const color = TYPE_COLORS[type] || TYPE_COLORS.meeting;
      const title = event.summary || event.title || 'Untitled event';
      const time = event.startLabel || eventTimeLabel(event) || 'Scheduled';
      const detail = event.location || event.description || type.charAt(0).toUpperCase() + type.slice(1);
      const id = eventIdentifier(event);
      const openAction = event.htmlLink
        ? '<a class="calendar-mobile-day-open" href="' + escapeHtml(event.htmlLink) + '" target="_blank" rel="noopener noreferrer">Open in Google Calendar ↗</a>'
        : '';
      const deleteAction = id
        ? '<button class="calendar-mobile-day-delete" type="button" data-event-id="' + escapeHtml(id) + '" data-event-title="' + escapeHtml(title) + '">Delete</button>'
        : '';
      const actions = openAction || deleteAction
        ? '<div class="calendar-mobile-day-actions">' + openAction + deleteAction + '</div>'
        : '';

      return '<article class="calendar-mobile-day-event" style="--calendar-event-color:' + color + ';" data-event-id="' + escapeHtml(id) + '">'
        + '<span class="calendar-mobile-day-event-time">' + escapeHtml(time) + ' · ' + escapeHtml(type) + '</span>'
        + '<span class="calendar-mobile-day-event-title">' + escapeHtml(title) + '</span>'
        + '<span class="calendar-mobile-day-event-meta">' + escapeHtml(detail) + '</span>'
        + actions
        + '</article>';
    }).join('');
  }

  function updatePopupEvents(popup, dateKey, events) {
    if (!popup || !document.body.contains(popup)) return;
    const visibleEvents = events.filter(event => eventDateKey(event) === dateKey);
    const count = visibleEvents.length;
    const countNode = popup.querySelector('.calendar-mobile-day-count');
    const listNode = popup.querySelector('.calendar-mobile-day-list');
    countNode.textContent = count === 1 ? '1 event' : count + ' events';
    listNode.innerHTML = eventRows(visibleEvents);
  }

  async function deleteEventFromPopup(button, popup) {
    const eventId = button.getAttribute('data-event-id');
    const title = button.getAttribute('data-event-title') || 'this event';
    if (!eventId || !window.confirm('Delete "' + title + '" from Google Calendar?')) return;

    button.disabled = true;
    button.textContent = 'Deleting…';
    const card = button.closest('.calendar-mobile-day-event');
    let errorNode = card && card.querySelector('.calendar-mobile-day-error');

    try {
      const response = await fetch('/api/calendar/events/' + encodeURIComponent(eventId), {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!response.ok) {
        let message = 'Delete failed (' + response.status + ').';
        try {
          const payload = await response.json();
          if (payload && payload.error) message = payload.error;
        } catch (error) {}
        throw new Error(message);
      }

      eventCache.events = eventCache.events.filter(event => eventIdentifier(event) !== eventId);
      eventCache.loadedAt = Date.now();

      const dateKey = popup.getAttribute('data-date-key');
      updatePopupEvents(popup, dateKey, eventCache.events);

      if (window.CAL && typeof window.CAL.loadGoogleEvents === 'function') {
        window.CAL.loadGoogleEvents();
      }
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Delete';
      if (!errorNode && card) {
        errorNode = document.createElement('div');
        errorNode.className = 'calendar-mobile-day-error';
        card.appendChild(errorNode);
      }
      if (errorNode) {
        errorNode.textContent = error && error.message ? error.message : 'Could not delete this event.';
      }
    }
  }

  function createPopup(dateKey) {
    closePopup();
    ensureStyles();
    const popup = document.createElement('div');
    popup.id = POPUP_ID;
    popup.className = 'calendar-mobile-day-popup';
    popup.setAttribute('role', 'presentation');
    popup.setAttribute('data-date-key', dateKey);
    popup.innerHTML = '<section class="calendar-mobile-day-sheet" role="dialog" aria-modal="true" aria-label="Events for selected date">'
      + '<div class="calendar-mobile-day-grabber"></div>'
      + '<div class="calendar-mobile-day-head">'
      + '<div><div class="calendar-mobile-day-title">' + escapeHtml(popupDateLabel(dateKey)) + '</div>'
      + '<div class="calendar-mobile-day-count">Loading events…</div></div>'
      + '<button class="calendar-mobile-day-close" type="button" aria-label="Close">×</button>'
      + '</div>'
      + '<div class="calendar-mobile-day-list"><div class="calendar-mobile-day-loading">Loading events…</div></div>'
      + '</section>';
    popup.addEventListener('click', event => {
      const deleteButton = event.target.closest && event.target.closest('.calendar-mobile-day-delete');
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        deleteEventFromPopup(deleteButton, popup);
        return;
      }
      if (event.target === popup || event.target.closest('.calendar-mobile-day-close')) closePopup();
    });
    document.body.appendChild(popup);
    return popup;
  }

  async function openPopup(dateKey, sourceCell) {
    if (!isMobile() || !dateKey) return;
    const popup = createPopup(dateKey);
    let events;
    try {
      events = (await allCalendarEvents()).filter(event => eventDateKey(event) === dateKey);
    } catch (error) {
      events = fallbackEventsFromCell(sourceCell);
    }
    if (!document.body.contains(popup)) return;
    const count = events.length;
    const countNode = popup.querySelector('.calendar-mobile-day-count');
    const listNode = popup.querySelector('.calendar-mobile-day-list');
    countNode.textContent = count === 1 ? '1 event' : count + ' events';
    listNode.innerHTML = eventRows(events);
  }

  document.addEventListener('click', event => {
    if (!isMobile()) return;
    const cell = event.target.closest && event.target.closest('.calendar-month-cell');
    if (!cell) return;
    const dateKey = dateFromCell(cell);
    if (!dateKey) return;
    window.setTimeout(() => openPopup(dateKey, cell), 0);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closePopup();
  });

  window.addEventListener('resize', () => {
    if (!isMobile()) closePopup();
  });
})();
