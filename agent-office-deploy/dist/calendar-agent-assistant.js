(function () {
  'use strict';

  // The Agent Assistant drawer.
  //
  // Calendar v3 deliberately renders only the toolbar and the board, which
  // keeps it clean but also hid every piece of agent intelligence the base
  // calendar already had. Rather than bringing back the desktop sidebars, all
  // of it lives behind one button: a bottom sheet on mobile, a right-hand
  // drawer on desktop.

  const ROOT_ID = 'calendar-agent-assistant';
  const STYLE_ID = 'calendar-agent-assistant-style';
  const MOBILE_QUERY = '(max-width: 860px)';

  const ACTIONS = [
    { id: 'next', label: 'What should I do next?' },
    { id: 'top-task', label: 'Schedule my highest-priority task' },
    { id: 'protect', label: 'Protect two hours for Agent Office' },
    { id: 'prepare', label: 'Prepare me for my next meeting' },
    { id: 'conflicts', label: 'Show conflicts and overdue work' }
  ];

  let open = false;
  let busy = false;
  let pendingPlan = null;
  let resultHtml = '';

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
      .aoa-fab {
        position: fixed;
        right: 18px;
        bottom: 22px;
        z-index: 60;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 46px;
        padding: 0 16px;
        border: 1px solid rgba(129, 140, 248, 0.45);
        border-radius: 999px;
        background: linear-gradient(180deg, rgba(99, 102, 241, 0.95), rgba(79, 70, 229, 0.95));
        color: #eef2ff;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.02em;
        cursor: pointer;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.55);
        -webkit-tap-highlight-color: transparent;
      }
      .aoa-fab:focus-visible { outline: 2px solid #a5b4fc; outline-offset: 2px; }
      .aoa-scrim {
        position: fixed;
        inset: 0;
        z-index: 61;
        background: rgba(2, 6, 23, 0.55);
        border: 0;
        padding: 0;
        cursor: pointer;
      }
      .aoa-panel {
        position: fixed;
        z-index: 62;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        background: rgba(15, 23, 42, 0.98);
        border: 1px solid rgba(148, 163, 184, 0.2);
        color: #e2e8f0;
        overflow-y: auto;
        overscroll-behavior: contain;
      }
      /* Desktop: right drawer. */
      .aoa-panel {
        top: 0;
        right: 0;
        bottom: 0;
        width: min(400px, 92vw);
        border-radius: 18px 0 0 18px;
      }
      /* Mobile: bottom sheet. */
      @media ${MOBILE_QUERY} {
        .aoa-panel {
          top: auto;
          left: 0;
          right: 0;
          bottom: 0;
          width: auto;
          max-height: 82vh;
          border-radius: 18px 18px 0 0;
        }
        .aoa-fab { right: 14px; bottom: 16px; }
      }
      .aoa-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .aoa-title { font-size: 15px; font-weight: 800; letter-spacing: 0.01em; }
      .aoa-sub { color: #94a3b8; font-size: 11px; margin-top: 2px; }
      .aoa-close {
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 10px;
        background: transparent;
        color: #cbd5e1;
        min-width: 34px;
        min-height: 34px;
        font-size: 16px;
        cursor: pointer;
      }
      .aoa-actions { display: grid; gap: 8px; }
      .aoa-action {
        text-align: left;
        min-height: 42px;
        padding: 10px 12px;
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 12px;
        background: rgba(30, 41, 59, 0.7);
        color: #e2e8f0;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
      .aoa-action:hover { border-color: rgba(129, 140, 248, 0.5); }
      .aoa-action[disabled] { opacity: 0.5; cursor: progress; }
      .aoa-field { display: grid; gap: 6px; }
      .aoa-label { color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
      .aoa-input {
        width: 100%;
        min-height: 42px;
        padding: 9px 11px;
        border: 1px solid rgba(148, 163, 184, 0.26);
        border-radius: 11px;
        background: rgba(2, 6, 23, 0.6);
        color: #e2e8f0;
        font-size: 13px;
        box-sizing: border-box;
      }
      .aoa-result {
        border-top: 1px solid rgba(148, 163, 184, 0.16);
        padding-top: 12px;
        font-size: 13px;
        line-height: 1.5;
      }
      .aoa-result h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; }
      .aoa-item {
        padding: 9px 10px;
        margin-bottom: 7px;
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 11px;
        background: rgba(30, 41, 59, 0.55);
      }
      .aoa-item strong { display: block; font-size: 13px; }
      .aoa-item span { display: block; color: #94a3b8; font-size: 11px; margin-top: 2px; }
      .aoa-empty { color: #94a3b8; font-size: 12px; }
      .aoa-warn { color: #fca5a5; font-size: 12px; }
      .aoa-ok { color: #86efac; font-size: 12px; }
      .aoa-confirm-row { display: flex; gap: 8px; margin-top: 8px; }
      .aoa-btn {
        flex: 1;
        min-height: 40px;
        border-radius: 11px;
        border: 1px solid rgba(148, 163, 184, 0.28);
        background: rgba(30, 41, 59, 0.7);
        color: #e2e8f0;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }
      .aoa-btn.primary {
        border-color: rgba(99, 102, 241, 0.55);
        background: linear-gradient(180deg, rgba(99, 102, 241, 0.9), rgba(79, 70, 229, 0.9));
        color: #eef2ff;
      }
    `;
    document.head.appendChild(style);
  }

  function cal() {
    return window.CAL && typeof window.CAL.getState === 'function' ? window.CAL : null;
  }

  function fmtRange(startIso, endIso) {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
    const day = new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'short', day: 'numeric' }).format(start);
    const time = value => new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit' }).format(value);
    return `${day}, ${time(start)}–${time(end)}`;
  }

  async function api(path, options) {
    const response = await fetch(path, Object.assign({ credentials: 'same-origin' }, options || {}));
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Request failed (HTTP ${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function postJson(path, body) {
    return api(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  function slotList(slots, heading) {
    if (!slots.length) return `<div class="aoa-empty">${escapeHtml(heading)}: nothing fits under your current scheduling preferences.</div>`;
    return `<h4>${escapeHtml(heading)}</h4>` + slots.map(slot => `
      <div class="aoa-item">
        <strong>${escapeHtml(fmtRange(slot.start, slot.end))}</strong>
        <span>Score ${escapeHtml(String(slot.score))}${slot.reasons && slot.reasons.length ? ' · ' + escapeHtml(slot.reasons.join(' · ')) : ''}</span>
        ${(slot.warnings || []).length ? `<span class="aoa-warn">${escapeHtml(slot.warnings.join(' · '))}</span>` : ''}
      </div>
    `).join('');
  }

  async function actionNext() {
    const calendar = cal();
    const events = calendar ? calendar.getEvents() : [];
    const now = new Date();
    const running = events.filter(event => event.meta && event.meta.runStatus === 'running');
    const waiting = events.filter(event => event.meta && event.meta.runStatus === 'needs_input');
    const upcoming = events
      .filter(event => new Date(event.end) >= now)
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, 3);

    let html = '';
    if (waiting.length) {
      html += '<h4>Waiting on you</h4>' + waiting.map(event => `
        <div class="aoa-item"><strong>${escapeHtml(event.title)}</strong>
        <span>${escapeHtml((event.meta.agentId || 'An agent') + ' needs input before it can continue.')}</span></div>
      `).join('');
    }
    if (running.length) {
      html += '<h4>Running now</h4>' + running.map(event => `
        <div class="aoa-item"><strong>${escapeHtml(event.title)}</strong>
        <span>${escapeHtml(event.meta.agentId || 'agent')}${event.meta.runProgress ? ' · ' + escapeHtml(event.meta.runProgress) : ''}</span></div>
      `).join('');
    }
    html += upcoming.length
      ? '<h4>Next up</h4>' + upcoming.map(event => `
          <div class="aoa-item"><strong>${escapeHtml(event.title)}</strong>
          <span>${escapeHtml(fmtRange(event.start, event.end))}</span></div>
        `).join('')
      : '<div class="aoa-empty">Nothing is scheduled ahead of you.</div>';
    return html;
  }

  async function actionTopTask() {
    const suggestion = await postJson('/api/calendar/schedule/suggest', {
      request: { durationMinutes: 90, priority: 'high', energy: 'high', executionMode: 'agent-run' },
      limit: 3,
    });
    return slotList(suggestion.slots || [], 'Best windows for your highest-priority work');
  }

  async function actionProtect() {
    const suggestion = await postJson('/api/calendar/schedule/suggest', {
      request: { durationMinutes: 120, priority: 'high', energy: 'high' },
      limit: 3,
    });
    const slots = suggestion.slots || [];
    if (!slots.length) return slotList(slots, 'Two-hour Agent Office block');
    pendingPlan = [{
      title: 'Agent Office',
      start: slots[0].start,
      end: slots[0].end,
      meta: { eventKind: 'focus', priority: 'high', movable: true, estimatedDuration: 120 },
    }];
    return slotList(slots, 'Two-hour Agent Office block') + confirmRow('Protect this block');
  }

  async function actionPrepare() {
    const calendar = cal();
    const events = calendar ? calendar.getEvents() : [];
    const now = new Date();
    const next = events
      .filter(event => new Date(event.start) >= now && (event.type === 'meeting' || (event.meta && event.meta.eventKind === 'meeting')))
      .sort((a, b) => new Date(a.start) - new Date(b.start))[0];
    if (!next) return '<div class="aoa-empty">No upcoming meeting to prepare for.</div>';

    const meta = next.meta || {};
    const prepMinutes = meta.prepMinutes || 15;
    const start = new Date(next.start);
    const prepStart = new Date(start.getTime() - prepMinutes * 60000);
    pendingPlan = [{
      title: `Prep: ${next.title}`,
      start: prepStart.toISOString(),
      end: start.toISOString(),
      notes: next.notes || '',
      meta: {
        eventKind: 'focus',
        projectId: meta.projectId || '',
        agentId: meta.agentId || '',
        prepMinutes,
        movable: false,
      },
    }];
    return `<h4>Next meeting</h4>
      <div class="aoa-item"><strong>${escapeHtml(next.title)}</strong>
      <span>${escapeHtml(fmtRange(next.start, next.end))}</span>
      ${meta.requiredInputs && meta.requiredInputs.length ? `<span>Bring: ${escapeHtml(meta.requiredInputs.join(', '))}</span>` : ''}
      ${meta.expectedOutput ? `<span>Expected output: ${escapeHtml(meta.expectedOutput)}</span>` : ''}</div>
      <div class="aoa-empty">A ${prepMinutes}-minute prep block can go right before it.</div>
      ${confirmRow('Add the prep block')}`;
  }

  async function actionConflicts() {
    const calendar = cal();
    const events = calendar ? calendar.getEvents() : [];
    const now = new Date();
    const sorted = events.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
    const overlaps = [];
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (new Date(current.start) < new Date(previous.end)) {
        overlaps.push(`${previous.title} overlaps ${current.title}`);
      }
    }
    const overdue = events.filter(event => {
      const meta = event.meta || {};
      if (meta.runStatus === 'failed') return true;
      if (meta.runStatus === 'scheduled' && new Date(event.end) < now) return true;
      return event.type === 'deadline' && new Date(event.end) < now;
    });

    let timeline = null;
    try {
      timeline = await api('/api/calendar/agent-timeline');
    } catch (error) {
      timeline = null;
    }

    let html = overlaps.length
      ? '<h4>Conflicts</h4>' + overlaps.map(text => `<div class="aoa-item"><strong>${escapeHtml(text)}</strong></div>`).join('')
      : '<div class="aoa-ok">No overlapping events in the loaded range.</div>';
    html += overdue.length
      ? '<h4>Overdue</h4>' + overdue.map(event => `<div class="aoa-item"><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(fmtRange(event.start, event.end))}</span></div>`).join('')
      : '<div class="aoa-ok">Nothing overdue.</div>';
    if (timeline && timeline.waitingForYou && timeline.waitingForYou.length) {
      html += '<h4>Agents waiting for you</h4>' + timeline.waitingForYou
        .map(item => `<div class="aoa-item"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.agentId || 'agent')}</span></div>`)
        .join('');
    }
    return html;
  }

  function confirmRow(label) {
    return `<div class="aoa-confirm-row">
      <button class="aoa-btn" type="button" data-aoa-cancel>Cancel</button>
      <button class="aoa-btn primary" type="button" data-aoa-confirm>${escapeHtml(label)}</button>
    </div>`;
  }

  // Natural language: parse, preview, confirm. Nothing is written to the
  // calendar until the preview has been shown and accepted.
  async function planFromText(text) {
    const plan = await postJson('/api/calendar/schedule/plan', { text });
    if (!plan.blocks || !plan.blocks.length) {
      pendingPlan = null;
      return `<div class="aoa-warn">${escapeHtml((plan.conflicts && plan.conflicts[0]) || 'Nothing could be scheduled for that request.')}</div>`;
    }
    pendingPlan = plan.blocks;
    const blocks = plan.blocks.map(block => `
      <div class="aoa-item">
        <strong>${escapeHtml(block.title)}</strong>
        <span>${escapeHtml(fmtRange(block.start, block.end))}</span>
        ${block.meta && block.meta.agentId ? `<span>Agent: ${escapeHtml(block.meta.agentId)}${block.meta.projectId ? ' · ' + escapeHtml(block.meta.projectId) : ''}</span>` : ''}
      </div>
    `).join('');
    const conflicts = (plan.conflicts || []).length
      ? `<div class="aoa-warn">${escapeHtml(plan.conflicts.join(' · '))}</div>`
      : '<div class="aoa-ok">No conflicts found</div>';
    return `<h4>Preview</h4>${blocks}${conflicts}${confirmRow('Confirm schedule')}`;
  }

  async function commitPendingPlan() {
    if (!pendingPlan || !pendingPlan.length) return;
    const blocks = pendingPlan;
    pendingPlan = null;
    const result = await postJson('/api/calendar/schedule/commit', { blocks });
    const created = (result.created || []).length;
    resultHtml = `<div class="aoa-ok">Scheduled ${created} block${created === 1 ? '' : 's'}.</div>`;
    if (window.CAL && window.CAL.loadGoogleEvents) window.CAL.loadGoogleEvents({ force: true });
  }

  const HANDLERS = {
    next: actionNext,
    'top-task': actionTopTask,
    protect: actionProtect,
    prepare: actionPrepare,
    conflicts: actionConflicts,
  };

  // ── Rendering ─────────────────────────────────────────────────────────────

  function panelHtml() {
    const state = cal() ? cal().getState() : null;
    const lastSynced = state && state.lastSyncedAt ? new Date(state.lastSyncedAt) : null;
    return `
      <div class="aoa-head">
        <div>
          <div class="aoa-title">Agent Assistant</div>
          <div class="aoa-sub">${escapeHtml(lastSynced ? 'Calendar synced ' + lastSynced.toLocaleTimeString() : 'Calendar not synced yet')}</div>
        </div>
        <button class="aoa-close" type="button" data-aoa-close aria-label="Close">×</button>
      </div>
      <div class="aoa-actions">
        ${ACTIONS.map(action => `<button class="aoa-action" type="button" data-aoa-action="${action.id}"${busy ? ' disabled' : ''}>${escapeHtml(action.label)}</button>`).join('')}
      </div>
      <div class="aoa-field">
        <label class="aoa-label" for="aoa-nl">Ask for a schedule</label>
        <input class="aoa-input" id="aoa-nl" type="text" placeholder="Have Codex work on Flashcards tomorrow for 90 minutes" />
        <button class="aoa-btn primary" type="button" data-aoa-plan${busy ? ' disabled' : ''}>Preview schedule</button>
      </div>
      <div class="aoa-result">${busy ? '<div class="aoa-empty">Working…</div>' : (resultHtml || '<div class="aoa-empty">Pick an action, or describe what you want scheduled.</div>')}</div>
    `;
  }

  function render() {
    ensureStyles();
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }
    root.innerHTML = `
      <button class="aoa-fab" type="button" data-aoa-open aria-expanded="${open ? 'true' : 'false'}">
        <span aria-hidden="true">✨</span> Assistant
      </button>
      ${open ? '<button class="aoa-scrim" type="button" data-aoa-close aria-label="Close assistant"></button>' : ''}
      ${open ? `<aside class="aoa-panel" role="dialog" aria-label="Agent Assistant">${panelHtml()}</aside>` : ''}
    `;
  }

  async function runHandler(id) {
    const handler = HANDLERS[id];
    if (!handler) return;
    busy = true;
    pendingPlan = null;
    render();
    try {
      resultHtml = await handler();
    } catch (error) {
      resultHtml = `<div class="aoa-warn">${escapeHtml(error.message || 'That did not work.')}</div>`;
    }
    busy = false;
    render();
  }

  document.addEventListener('click', async event => {
    const target = event.target.closest('[data-aoa-open], [data-aoa-close], [data-aoa-action], [data-aoa-plan], [data-aoa-confirm], [data-aoa-cancel]');
    if (!target) return;

    if (target.hasAttribute('data-aoa-open')) {
      open = !open;
      render();
      return;
    }
    if (target.hasAttribute('data-aoa-close')) {
      open = false;
      render();
      return;
    }
    if (target.hasAttribute('data-aoa-cancel')) {
      pendingPlan = null;
      resultHtml = '<div class="aoa-empty">Cancelled - nothing was scheduled.</div>';
      render();
      return;
    }
    if (target.hasAttribute('data-aoa-confirm')) {
      busy = true;
      render();
      try {
        await commitPendingPlan();
      } catch (error) {
        resultHtml = `<div class="aoa-warn">${escapeHtml(error.message || 'Could not schedule that.')}</div>`;
      }
      busy = false;
      render();
      return;
    }
    if (target.hasAttribute('data-aoa-plan')) {
      const input = document.getElementById('aoa-nl');
      const text = input ? input.value.trim() : '';
      if (!text) return;
      busy = true;
      render();
      try {
        resultHtml = await planFromText(text);
      } catch (error) {
        resultHtml = `<div class="aoa-warn">${escapeHtml(error.message || 'Could not read that request.')}</div>`;
      }
      busy = false;
      render();
      return;
    }
    const actionId = target.getAttribute('data-aoa-action');
    if (actionId) await runHandler(actionId);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) {
      open = false;
      render();
    }
  });

  function boot() {
    if (!document.getElementById('calendar-app')) return;
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.AOAgentAssistant = {
    open: () => { open = true; render(); },
    close: () => { open = false; render(); },
    run: runHandler,
  };
})();
