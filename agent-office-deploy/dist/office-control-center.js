(function () {
  'use strict';

  const shell = document.getElementById('control-center');
  const body = document.getElementById('control-center-body');
  const title = document.getElementById('control-center-title');
  const kicker = document.getElementById('control-center-kicker');
  const office = document.querySelector('.office-stage');
  if (!shell || !body || !office) return;

  let liveAgents = [];
  let selectedId = null;

  // -- ShareBot67 newsroom health ------------------------------
  //
  // ShareBot67's newsroom runs in the Market Dashboard. The office feed next
  // to this agent is scripted context — "ShareBot67 smoke check passed" says
  // the same thing on a morning the newsroom failed at 4am — so the panel
  // below is fetched, labelled as live, and says "Unavailable" rather than
  // anything reassuring when it cannot be read.
  //
  // The browser never holds the dashboard key: this reads Agent Office's own
  // adapter, which does the authenticated call server-side.
  const NEWSROOM_AGENT_ID = 'newsreporter';
  const NEWSROOM_ENDPOINT = '/api/sharebot/newsroom-health';
  const NEWSROOM_POLL_MS = 45000;
  const NEWSROOM_HEALTH_LABELS = {
    healthy: 'Healthy',
    running: 'Running',
    degraded: 'Degraded',
    failed: 'Failed',
    idle: 'No runs yet',
    unavailable: 'Unavailable',
  };
  const NEWSROOM_ROUTE_LABELS = { verified: 'Verified', warning: 'Warning', failed: 'Failed' };
  let newsroomTimer = null;
  let newsroomInFlight = false;

  const escape = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  function configuredAgent(id) {
    return (window.AGENTS || (typeof AGENTS !== 'undefined' ? AGENTS : [])).find(agent => agent.id === id);
  }

  function runtimeAgent(id) {
    return liveAgents.find(agent => agent.id === id) || null;
  }

  function roomAgent(id) {
    return (typeof agentState !== 'undefined' ? agentState : []).find(agent => agent.id === id) || configuredAgent(id);
  }

  function operationalState(agent, live) {
    if (typeof agentOperationalState === 'function') return agentOperationalState(agent);
    return (live && live.status) || agent.status || 'offline';
  }

  async function refreshLiveAgents() {
    try {
      const response = await fetch('/api/agents', { credentials: 'same-origin' });
      if (response.ok) liveAgents = await response.json();
    } catch (_) {
      liveAgents = [];
    }
  }

  function openShell() {
    shell.hidden = false;
    document.body.classList.add('control-center-open');
  }

  function close() {
    shell.hidden = true;
    document.body.classList.remove('control-center-open');
    selectedId = null;
    stopNewsroom();
    stopSchedules();
  }

  function stat(label, value, note) {
    return `<div class="control-stat"><span>${escape(label)}</span><strong>${escape(value || 'Unavailable')}</strong>${note ? `<small>${escape(note)}</small>` : ''}</div>`;
  }

  async function openAgent(id) {
    stopSchedules();
    selectedId = id;
    await refreshLiveAgents();
    const agent = roomAgent(id);
    if (!agent) return;
    const live = runtimeAgent(id);
    const state = operationalState(agent, live);
    const task = (live && (live.current_task_title || live.current_task_id)) || agent.currentTask || 'No task reported';
    const isPenny = agent.id === 'oss';
    kicker.textContent = isPenny ? 'SOLE ORCHESTRATOR' : 'SPECIALIST AGENT';
    title.textContent = agent.name;
    body.innerHTML = `
      <div class="control-agent-hero" style="--entity-color:${escape(agent.color)}">
        <div class="control-agent-avatar">${escape(agent.emoji)}</div>
        <div><strong>${escape(agent.role)}</strong><span class="control-state control-state--${escape(state)}">${escape(state)}</span><p>${escape(agent.desc)}</p></div>
      </div>
      ${isPenny ? '<div class="control-callout"><strong>Penny owns this office.</strong> Goals go to Penny; specialists execute assigned domain work and report results back. Specialists do not command one another.</div>' : '<div class="control-callout">This specialist operates under Penny. View upcoming jobs in Mission Control.</div>'}
      <div class="control-stats">
        ${stat('Current task', task, live ? 'Live agent record' : 'Configured fallback')}
        ${stat('Model / provider', (live && live.model) || agent.model, (live && live.source) || 'Configured roster')}
        ${stat('Workspace', agent.workspace)}
        ${stat('Tokens today', live && live.cost_tokens_today ? Number(live.cost_tokens_today).toLocaleString() : 'Not reported')}
      </div>
      ${agent.id === NEWSROOM_AGENT_ID ? newsroomPanelShell() : ''}
      <div class="control-actions">
        ${isPenny ? '<button class="ao-btn ao-btn--primary" type="button" onclick="AOControlCenter.openMissionControl()">Open Mission Control</button>' : ''}
        <a class="ao-btn" href="/memory.html?agent=${encodeURIComponent(agent.id)}">View memory</a>
        <a class="ao-btn" href="/agent-registry.html">Agent registry</a>
        <button class="ao-btn" type="button" onclick="AOControlCenter.customize('${escape(agent.id)}')">Edit appearance</button>
      </div>
      <div class="control-unavailable"><strong>Direct runtime controls</strong><span>Pause, stop, retry, logs, elapsed time, tools, and API cost will appear only when the OpenClaw gateway exposes verified control and telemetry endpoints.</span></div>`;
    openShell();
    if (agent.id === NEWSROOM_AGENT_ID) startNewsroom();
    else stopNewsroom();
  }

  function newsroomPanelShell() {
    return `
      <section class="newsroom-panel" id="newsroom-panel" aria-live="polite">
        <div class="newsroom-panel-head">
          <div>
            <strong>ShareBot67 Newsroom</strong>
            <span>Live from Market Dashboard. The office feed beside this agent is scripted context, not health.</span>
          </div>
          <button class="ao-btn ao-btn--sm newsroom-refresh" type="button">Refresh</button>
        </div>
        <div id="newsroom-panel-body"><div class="control-unavailable"><span>Reading newsroom health…</span></div></div>
      </section>`;
  }

  function newsroomStamp(value) {
    if (!value) return 'Not recorded';
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? 'Not recorded' : at.toLocaleString();
  }

  function newsroomRow(label, value, className) {
    return `<div class="newsroom-row"><span>${escape(label)}</span><strong${className ? ` class="${escape(className)}"` : ''}>${escape(value)}</strong></div>`;
  }

  function renderNewsroom(payload) {
    const target = body.querySelector('#newsroom-panel-body');
    if (!target) return;

    const health = (payload && payload.health) || 'unavailable';
    const healthLabel = NEWSROOM_HEALTH_LABELS[health] || 'Unavailable';
    const route = (payload && payload.agent_route) || {};
    const routeLabel = NEWSROOM_ROUTE_LABELS[route.route] || 'Warning';

    // A newsroom that cannot be read is never dressed up as one that is fine.
    if (!payload || payload.available !== true) {
      target.innerHTML = `
        <div class="newsroom-rows">
          ${newsroomRow('Health', healthLabel, `newsroom-health newsroom-health--${health}`)}
        </div>
        <div class="control-unavailable">
          <strong>Live newsroom health is unavailable</strong>
          <span>${escape((payload && payload.error) || 'Agent Office could not read newsroom health.')}</span>
          <span>This is not evidence that the newsroom is healthy — only that its status could not be read.</span>
        </div>`;
      return;
    }

    const attempt = payload.last_attempt;
    const generation = payload.generation || { generated: 0, expected: 0 };
    const delivery = payload.delivery || { succeeded: 0, failed: 0 };
    const error = payload.latest_error;

    target.innerHTML = `
      <div class="newsroom-rows">
        ${newsroomRow('Health', healthLabel, `newsroom-health newsroom-health--${health}`)}
        ${newsroomRow('Agent route', routeLabel, `newsroom-route newsroom-route--${route.route || 'warning'}`)}
        ${newsroomRow('Last successful cycle', payload.last_success ? newsroomStamp(payload.last_success.completed_at || payload.last_success.started_at) : 'None recorded')}
        ${newsroomRow('Last attempt', attempt ? `${String(attempt.status || 'unknown').replace(/_/g, ' ')} · ${newsroomStamp(attempt.completed_at || attempt.started_at)}` : 'None recorded')}
        ${newsroomRow('Next expected cycle', payload.next_expected_at ? newsroomStamp(payload.next_expected_at) : 'No schedule reported')}
        ${newsroomRow('Generation', `${generation.generated} / ${generation.expected} sections`)}
        ${newsroomRow('Delivery', `${delivery.succeeded} successful · ${delivery.failed} failed`)}
      </div>
      ${error ? `<div class="newsroom-error"><strong>Latest error</strong><span>${escape(error.message || error.reason || error.code || 'Reported without detail.')}</span><small>${escape([error.phase, error.code, error.retryable ? 'retryable' : 'not retryable'].filter(Boolean).join(' · '))}</small></div>` : ''}
      <small class="newsroom-checked">Checked ${escape(newsroomStamp(payload.checked_at))}</small>`;
  }

  async function refreshNewsroom() {
    // One request at a time. A slow upstream plus a 45s tick would otherwise
    // stack calls that all answer the same question.
    if (newsroomInFlight) return;
    if (!body.querySelector('#newsroom-panel-body')) {
      stopNewsroom();
      return;
    }
    newsroomInFlight = true;
    try {
      const response = await fetch(NEWSROOM_ENDPOINT, { credentials: 'same-origin' });
      if (response.status === 401) {
        renderNewsroom({ available: false, health: 'unavailable', error: 'Log in to Agent Office to read newsroom health.' });
        return;
      }
      if (!response.ok) {
        renderNewsroom({ available: false, health: 'unavailable', error: 'Agent Office could not read newsroom health.' });
        return;
      }
      renderNewsroom(await response.json());
    } catch (_) {
      renderNewsroom({ available: false, health: 'unavailable', error: 'Agent Office could not reach its own newsroom health adapter.' });
    } finally {
      newsroomInFlight = false;
    }
  }

  function startNewsroom() {
    stopNewsroom();
    const refresh = body.querySelector('.newsroom-refresh');
    if (refresh) refresh.addEventListener('click', refreshNewsroom);
    refreshNewsroom();
    // A hidden tab polls nothing: the tick still fires, and skips.
    newsroomTimer = setInterval(() => {
      if (document.hidden) return;
      refreshNewsroom();
    }, NEWSROOM_POLL_MS);
  }

  function stopNewsroom() {
    if (!newsroomTimer) return;
    clearInterval(newsroomTimer);
    newsroomTimer = null;
  }

  // Mission Control is workflow-first: the recurring things Penny/OpenClaw and
  // ChatGPT deliver, drawn by mission-control.js. Goals — one-off assignments
  // Penny executes — sit below it as a secondary section.
  let missionGoals = null;
  // Penny only claims urgent goals, so "active" is urgent and anything else is
  // parked where she will not pick it up.
  let goalFilter = 'active';
  let goalGeneration = 0;
  function stopSchedules() {
    goalGeneration++;
    shell.classList.remove('control-center--wide');
    if (window.AOMissionControl) window.AOMissionControl.stop();
  }
  function openMissionControl() {
    stopNewsroom(); stopSchedules(); selectedId = 'schedules'; missionGoals = null;
    shell.classList.add('control-center--wide');
    kicker.textContent = 'WORKFLOWS AND DELIVERIES'; title.textContent = 'Mission Control';
    body.innerHTML = `
      <p class="mc-subtitle">Your scheduled workflows and latest results.</p>
      <div id="mc-workflows"></div>
      <details class="mc-section mc-goals" id="mc-goals-section">
        <summary><strong>Goals and manual assignments</strong><span>One-off work for Penny to execute · <span id="mc-goal-count">loading…</span></span></summary>
        <div class="control-callout">Goals are assignments Penny claims and executes. Workflows above are never sent to Penny. A schedule inventory does not belong here — use <strong>Move to workflow reference</strong> to archive one where Penny cannot pick it up.</div>
        <section class="mission-results" aria-live="polite"><div class="mission-results-heading"><div><strong>Open goals</strong><span>The same goals shown on your Mission Control card</span></div><div class="mission-goal-filter" role="group" aria-label="Show goals"><button class="ao-btn ao-btn--sm" type="button" data-goal-filter="active">Active</button><button class="ao-btn ao-btn--sm" type="button" data-goal-filter="disabled">Disabled</button></div></div><div id="mission-goals-list">Loading goals…</div></section>
        <button class="ao-btn ao-btn--primary" id="goal-toggle" aria-expanded="false" aria-controls="goal-form" type="button">+ Add goal</button>
        <form class="mission-goal" id="goal-form" hidden style="display:none">
          <label for="goal-title">Goal title</label><input id="goal-title" maxlength="120" required>
          <label for="goal-content">Goal instructions</label><textarea id="goal-content" rows="5" maxlength="10000" required></textarea>
          <label for="goal-state">Status</label><select id="goal-state"><option value="active">Active — Penny picks it up</option><option value="disabled">Disabled — saved but not run</option></select>
          <p class="mission-optional">Queues a Mission Control goal for Penny.</p>
          <div class="mission-goal-actions"><button class="ao-btn ao-btn--primary" type="submit">Save goal</button><button class="ao-btn" id="goal-cancel" type="button">Cancel</button></div>
        </form>
        <p id="goal-status" role="status"></p>
      </details>`;
    body.querySelector('#goal-toggle').onclick = () => toggleGoalForm();
    body.querySelector('#goal-cancel').onclick = () => toggleGoalForm(false);
    body.querySelector('#goal-form').onsubmit = saveGoal;
    body.querySelectorAll('[data-goal-filter]').forEach(button => button.onclick = () => { goalFilter = button.dataset.goalFilter; renderMissionGoals(); });
    openShell();
    if (window.AOMissionControl) window.AOMissionControl.mount(body.querySelector('#mc-workflows'), { onArchiveChange: refreshGoals });
    else body.querySelector('#mc-workflows').innerHTML = '<div class="control-unavailable">The workflow view did not load. Reload the page.</div>';
    refreshGoals();
  }
  function toggleGoalForm(force) {
    const form = body.querySelector('#goal-form');
    const open = force === undefined ? form.hidden : force;
    form.hidden = !open; form.style.display = open ? '' : 'none';
    const button = body.querySelector('#goal-toggle');
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? 'Close goal form' : '+ Add goal';
    if (!open) form.reset();
    if (open) body.querySelector('#goal-title').focus();
  }
  async function saveGoal(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = body.querySelector('#goal-status');
    const submit = form.querySelector('button[type="submit"]');
    const title = form.querySelector('#goal-title').value.trim();
    const goal = form.querySelector('#goal-content').value.trim();
    const active = form.querySelector('#goal-state').value === 'active';
    if (!title || !goal) { status.textContent = 'Enter a title and goal instructions.'; return; }
    submit.disabled = true; status.textContent = 'Saving goal…';
    try {
      await missionRequest('/api/orchestration/goals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, goal, priority: active ? 'urgent' : 'normal' })
      });
      if (body.querySelector('#goal-form') !== form) return;
      toggleGoalForm(false);
      goalFilter = active ? 'active' : 'disabled';
      status.textContent = active ? 'Goal queued in Mission Control.' : 'Goal saved as disabled.';
      await refreshGoals();
    } catch (error) {
      status.textContent = error.message;
    } finally { submit.disabled = false; }
  }
  async function missionRequest(url, options) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load Mission Control. Log in and try again.');
    return data;
  }
  async function refreshGoals() {
    const generation = goalGeneration;
    let error = null;
    try { missionGoals = await missionRequest('/api/orchestration/goals'); } catch (failure) { missionGoals = null; error = failure; }
    if (generation !== goalGeneration || selectedId !== 'schedules') return;
    renderMissionGoals(error);
  }
  function isGoalActive(goal) { return goal.priority === 'urgent' || goal.orchestration_status === 'running'; }
  function renderMissionGoals(error) {
    const list = body.querySelector('#mission-goals-list'); if (!list) return;
    const count = body.querySelector('#mc-goal-count');
    if (error) { list.innerHTML = `<div class="control-unavailable">${escape(error.message)}</div>`; if (count) count.textContent = 'unavailable'; return; }
    const open = (missionGoals || []).filter(goal => goal.orchestration_status !== 'completed');
    const counts = { active: open.filter(isGoalActive).length, disabled: open.filter(goal => !isGoalActive(goal)).length };
    if (count) count.textContent = `${counts.active} active · ${counts.disabled} disabled`;
    body.querySelectorAll('[data-goal-filter]').forEach(button => {
      const key = button.dataset.goalFilter, selected = key === goalFilter;
      button.textContent = `${key === 'active' ? 'Active' : 'Disabled'} (${counts[key]})`;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('ao-btn--primary', selected);
    });
    const goals = open.filter(goal => isGoalActive(goal) === (goalFilter === 'active'));
    list.innerHTML = goals.length ? goals.map(goal => {
      const content = typeof goal.content === 'string' && goal.content.trim() !== (goal.title || '').trim() ? goal.content.trim() : '';
      const actions = goal.orchestration_status === 'running' ? '' : `<div class="control-actions"><button class="ao-btn" type="button" data-goal-toggle="${escape(goal.id)}" title="Penny only picks up active goals. This changes the goal only.">${goal.priority === 'urgent' ? 'Disable for Penny' : 'Enable for Penny'}</button><button class="ao-btn" type="button" data-goal-reference="${escape(goal.id)}" title="Archive this goal as reference data. Penny can never pick it up; it can be restored.">Move to workflow reference</button></div>`;
      return `<article class="mission-result mission-result--${escape(goal.orchestration_status || 'queued')}"><div class="mission-result-head"><strong class="mission-result-title">${escape(goal.title)}</strong><span class="control-state">${escape(goal.orchestration_status === 'running' ? 'Currently working' : goal.orchestration_status || 'queued')}</span></div>${content ? `<p class="mission-result-description">${escape(content)}</p>` : ''}<small>${escape(new Date(goal.updated_at || goal.date).toLocaleString('en-CA', { timeZone: 'America/Vancouver' }))}</small>${actions}</article>`;
    }).join('') : `<div class="control-unavailable">${goalFilter === 'active' ? 'No active Mission Control goals.' : 'No disabled Mission Control goals.'}</div>`;
    list.querySelectorAll('[data-goal-toggle]').forEach(button => button.onclick = () => setGoalActive(button));
    list.querySelectorAll('[data-goal-reference]').forEach(button => button.onclick = () => moveGoalToReference(button));
  }
  // Disabling is an edit to the goal's priority, so it goes through the same
  // route as any other edit and keeps the goal's title, instructions and link.
  async function setGoalActive(button) {
    const goal = (missionGoals || []).find(item => item.id === button.dataset.goalToggle); if (!goal) return;
    const status = body.querySelector('#goal-status');
    const enable = goal.priority !== 'urgent';
    button.disabled = true;
    try {
      await missionRequest(`/api/orchestration/goals/${encodeURIComponent(goal.id)}/edit`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: goal.title, goal: goal.content || goal.title, source_url: (goal.links || [])[0] || '', priority: enable ? 'urgent' : 'normal' })
      });
      status.textContent = enable ? `Enabled "${goal.title}".` : `Disabled "${goal.title}". Penny will not pick it up.`;
      await refreshGoals();
    } catch (error) {
      status.textContent = error.message; button.disabled = false;
    }
  }
  async function moveGoalToReference(button) {
    const goal = (missionGoals || []).find(item => item.id === button.dataset.goalReference); if (!goal) return;
    if (!confirm(`Move "${goal.title}" out of Penny's queue into the archived inventories? Its text is kept and it can be restored.`)) return;
    const status = body.querySelector('#goal-status');
    button.disabled = true;
    try {
      await missionRequest(`/api/orchestration/goals/${encodeURIComponent(goal.id)}/reference`, { method: 'POST' });
      status.textContent = `Moved "${goal.title}" to workflow reference. Import its workflows under Add, import and archived inventories.`;
      await refreshGoals();
      if (window.AOMissionControl) window.AOMissionControl.refresh();
    } catch (error) {
      status.textContent = error.message; button.disabled = false;
    }
  }

  function customize(id) {
    close();
    if (window.AOAvatarCustomizer) window.AOAvatarCustomizer.open(id);
  }

  function interceptAgentClick(event) {
    const character = event.target.closest && event.target.closest('.agent-char[data-agent-id]');
    if (!character) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openAgent(character.dataset.agentId);
  }

  office.addEventListener('click', interceptAgentClick, true);
  office.addEventListener('keydown', event => {
    const character = event.target.closest && event.target.closest('.agent-char[data-agent-id]');
    if (!character || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openAgent(character.dataset.agentId);
  }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !shell.hidden) close(); });
  // Coming back to a tab that skipped its ticks should not wait out another
  // full interval before showing something current.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && newsroomTimer) refreshNewsroom();
  });

  window.AOControlCenter = { openAgent, openMissionControl, close, customize };

  // The sidebar's Mission Control row lives on every page, so it links back to
  // the office with ?panel=mission-control and the panel opens itself here.
  if (new URLSearchParams(location.search).get('panel') === 'mission-control') {
    openMissionControl();
  }
})();
