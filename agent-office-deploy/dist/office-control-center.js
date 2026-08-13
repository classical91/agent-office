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
  let missionGoals = [];
  let missionEditMode = false;

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
  }

  function stat(label, value, note) {
    return `<div class="control-stat"><span>${escape(label)}</span><strong>${escape(value || 'Unavailable')}</strong>${note ? `<small>${escape(note)}</small>` : ''}</div>`;
  }

  async function openAgent(id) {
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
      ${isPenny ? '<div class="control-callout"><strong>Penny owns this office.</strong> Goals go to Penny; specialists execute assigned domain work and report results back. Specialists do not command one another.</div>' : '<div class="control-callout">This specialist operates under Penny. New cross-agent goals should be sent to Mission Control.</div>'}
      <div class="control-stats">
        ${stat('Current task', task, live ? 'Live agent record' : 'Configured fallback')}
        ${stat('Model / provider', (live && live.model) || agent.model, (live && live.source) || 'Configured roster')}
        ${stat('Workspace', agent.workspace)}
        ${stat('Tokens today', live && live.cost_tokens_today ? Number(live.cost_tokens_today).toLocaleString() : 'Not reported')}
      </div>
      <div class="control-actions">
        ${isPenny ? '<button class="ao-btn ao-btn--primary" type="button" onclick="AOControlCenter.openMissionControl()">Give Penny a goal</button>' : ''}
        <a class="ao-btn" href="/memory.html?agent=${encodeURIComponent(agent.id)}">View memory</a>
        <a class="ao-btn" href="/agent-registry.html">Agent registry</a>
        <button class="ao-btn" type="button" onclick="AOControlCenter.customize('${escape(agent.id)}')">Edit appearance</button>
      </div>
      <div class="control-unavailable"><strong>Direct runtime controls</strong><span>Pause, stop, retry, logs, elapsed time, tools, and API cost will appear only when the OpenClaw gateway exposes verified control and telemetry endpoints.</span></div>`;
    openShell();
  }

  function workflowCounts() {
    const counts = { inbox: 0, assigned: 0, working: 0, review: 0, approval: 0, completed: 0 };
    (typeof agentState !== 'undefined' ? agentState : []).forEach(agent => {
      const state = typeof agentOperationalState === 'function' ? agentOperationalState(agent) : agent.status;
      if (state === 'working') counts.working += 1;
      if (state === 'blocked') counts.approval += 1;
    });
    if (typeof opsQueue !== 'undefined' && opsQueue.available) counts.inbox = opsQueue.open;
    return counts;
  }

  function openMissionControl() {
    selectedId = 'oss';
    const counts = workflowCounts();
    kicker.textContent = 'PENNY · SOLE ORCHESTRATOR';
    title.textContent = 'Mission Control';
    body.innerHTML = `
      <div class="control-callout control-callout--command"><strong>Give Penny one outcome.</strong> Penny owns delegation, routing, cron governance, approvals, failure handling, and the final operator report.</div>
      <form class="mission-goal" id="mission-goal-form">
        <label for="mission-goal-input">What should the office accomplish?</label>
        <textarea id="mission-goal-input" rows="4" placeholder="Example: Find the most useful improvement for Market Dashboard today." required></textarea>
        <label for="mission-goal-source">ChatGPT conversation link <span class="mission-optional">optional</span></label>
        <input id="mission-goal-source" type="url" inputmode="url" placeholder="https://chatgpt.com/share/...">
        <label for="mission-goal-priority">Priority</label>
        <select id="mission-goal-priority">
          <option value="normal">Normal — save only; Penny will not process it</option>
          <option value="urgent">Urgent — send to Penny for orchestration</option>
        </select>
        <div class="mission-goal-actions"><button class="ao-btn ao-btn--primary" type="submit">Send goal to Penny</button><span id="mission-goal-status">Saved to the Mission Board for orchestration.</span></div>
      </form>
      <div class="workflow-lane" aria-label="Office workflow">
        ${Object.entries(counts).map(([name, count]) => `<div><span>${escape(name.replace(/^./, char => char.toUpperCase()))}</span><strong>${count}</strong></div>`).join('<i>→</i>')}
      </div>
      <section class="mission-results" aria-live="polite">
        <div class="mission-results-heading"><div><strong>Goals and Outbox</strong><span>Drag active goals in edit mode to set Penny's order.</span></div><button class="ao-btn mission-order-toggle" type="button">Edit order</button></div>
        <div id="mission-results-list"><div class="control-unavailable">Loading goals…</div></div>
      </section>
      <div class="control-actions"><a class="ao-btn" href="/mission-board.html">Open Mission Board</a><a class="ao-btn" href="/project-rooms.html">Project rooms</a><a class="ao-btn" href="/agent-registry.html">Agent registry</a></div>`;
    body.querySelector('#mission-goal-form').addEventListener('submit', submitGoal);
    body.querySelector('.mission-order-toggle').addEventListener('click', toggleMissionEditMode);
    openShell();
    refreshMissionGoals();
  }

  async function refreshMissionGoals() {
    const list = body.querySelector('#mission-results-list');
    if (!list) return;
    try {
      const response = await fetch('/api/orchestration/goals', { credentials: 'same-origin' });
      if (response.status === 401) throw new Error('Unlock the Dropbox to see goal status.');
      if (!response.ok) throw new Error('Goal status is unavailable.');
      const goals = await response.json();
      missionGoals = goals;
      if (!goals.length) {
        list.innerHTML = '<div class="control-unavailable">No Mission Control goals yet.</div>';
        return;
      }
      const active = goals.filter(goal => goal.orchestration_status !== 'completed');
      const history = goals.filter(goal => goal.orchestration_status === 'completed');
      const renderGoal = goal => `
        <article class="mission-result mission-result--${escape(goal.orchestration_status)}${missionEditMode && goal.orchestration_status !== 'completed' ? ' mission-result--moveable' : ''}" data-goal-id="${escape(goal.id)}" draggable="${missionEditMode && goal.orchestration_status !== 'completed'}">
          <div><span class="mission-drag-handle" aria-hidden="true">⋮⋮</span><strong>${escape(goal.title)}</strong><span class="control-state">${goal.orchestration_status === 'running' ? 'Currently working' : escape(goal.orchestration_status)}</span></div>
          ${goal.orchestration_result ? `<p>${escape(goal.orchestration_result)}</p>` : ''}
          ${goal.links && goal.links[0] ? `<a class="mission-source-link" href="${escape(goal.links[0])}" target="_blank" rel="noopener noreferrer">Open ChatGPT context ↗</a>` : ''}
          ${goal.orchestration_error ? `<p class="mission-result-error">${escape(goal.orchestration_error)}</p>` : ''}
          ${goal.orchestration_status === 'needs_approval' ? `<button class="ao-btn ao-btn--primary mission-approve" type="button" data-goal-id="${escape(goal.id)}">Approve build</button>` : ''}
          ${missionEditMode && goal.orchestration_status !== 'completed' ? `<div class="mission-edit-actions"><button class="ao-btn mission-move" type="button" data-direction="up" data-goal-id="${escape(goal.id)}" aria-label="Move goal up">↑</button><button class="ao-btn mission-move" type="button" data-direction="down" data-goal-id="${escape(goal.id)}" aria-label="Move goal down">↓</button>${goal.orchestration_status !== 'running' ? `<button class="ao-btn mission-edit" type="button" data-goal-id="${escape(goal.id)}">Edit goal</button>` : ''}</div>` : ''}
          <small>${escape(new Date(goal.updated_at || goal.date).toLocaleString())}</small>
        </article>`;
      list.innerHTML = `${active.length ? '<div class="mission-list-label">Active goals</div>' + active.slice(0, 10).map(renderGoal).join('') : '<div class="control-unavailable">No active goals.</div>'}${history.length ? '<div class="mission-list-label">Completed history</div>' + history.slice(0, 10).map(renderGoal).join('') : ''}`;
      list.querySelectorAll('.mission-approve').forEach(button => {
        button.addEventListener('click', () => approveGoal(button.dataset.goalId));
      });
      list.querySelectorAll('.mission-edit').forEach(button => {
        button.addEventListener('click', () => editMissionGoal(button.dataset.goalId));
      });
      list.querySelectorAll('.mission-move').forEach(button => {
        button.addEventListener('click', () => moveMissionGoal(button.dataset.goalId, button.dataset.direction));
      });
      wireMissionDragging(list);
    } catch (error) {
      list.innerHTML = `<div class="control-unavailable">${escape(error.message)}</div>`;
    }
  }

  async function approveGoal(id) {
    if (!window.confirm('Approve Penny to build the proposed scope? Deployment still requires separate approval unless the proposal included it.')) return;
    try {
      const response = await fetch(`/api/orchestration/goals/${encodeURIComponent(id)}/approve`, {
        method: 'POST', credentials: 'same-origin'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Approval could not be saved.');
      await refreshMissionGoals();
    } catch (error) {
      window.alert(error.message);
    }
  }

  function toggleMissionEditMode() {
    missionEditMode = !missionEditMode;
    const toggle = body.querySelector('.mission-order-toggle');
    if (toggle) toggle.textContent = missionEditMode ? 'Done editing' : 'Edit order';
    refreshMissionGoals();
  }

  function wireMissionDragging(list) {
    if (!missionEditMode) return;
    let dragged = null;
    list.querySelectorAll('.mission-result--moveable').forEach(card => {
      card.addEventListener('dragstart', () => { dragged = card; card.classList.add('is-dragging'); });
      card.addEventListener('dragend', async () => {
        card.classList.remove('is-dragging');
        dragged = null;
        const ids = [...list.querySelectorAll('.mission-result--moveable')].map(item => item.dataset.goalId);
        await saveMissionOrder(ids);
      });
      card.addEventListener('dragover', event => {
        event.preventDefault();
        if (!dragged || dragged === card) return;
        const box = card.getBoundingClientRect();
        card.parentNode.insertBefore(dragged, event.clientY < box.top + box.height / 2 ? card : card.nextSibling);
      });
    });
  }

  async function saveMissionOrder(ids) {
    try {
      const response = await fetch('/api/orchestration/goals/order', {
        method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (!response.ok) throw new Error('The new goal order could not be saved.');
    } catch (error) {
      window.alert(error.message);
      refreshMissionGoals();
    }
  }

  async function moveMissionGoal(id, direction) {
    const list = body.querySelector('#mission-results-list');
    const card = list && list.querySelector(`.mission-result--moveable[data-goal-id="${CSS.escape(id)}"]`);
    if (!card) return;
    const sibling = direction === 'up' ? card.previousElementSibling : card.nextElementSibling;
    if (!sibling || !sibling.classList.contains('mission-result--moveable')) return;
    if (direction === 'up') card.parentNode.insertBefore(card, sibling);
    else card.parentNode.insertBefore(sibling, card);
    const ids = [...list.querySelectorAll('.mission-result--moveable')].map(item => item.dataset.goalId);
    await saveMissionOrder(ids);
  }

  async function editMissionGoal(id) {
    const goal = missionGoals.find(item => item.id === id);
    if (!goal) return;
    const content = window.prompt('Edit this mission goal:', goal.content || goal.title);
    if (content == null || !content.trim()) return;
    const sourceUrl = window.prompt('ChatGPT conversation link (optional):', (goal.links && goal.links[0]) || '');
    if (sourceUrl == null) return;
    const urgent = window.confirm('Should Penny process this goal? Choose Cancel to save it for later.');
    try {
      const response = await fetch(`/api/orchestration/goals/${encodeURIComponent(id)}/edit`, {
        method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: content.trim(), source_url: sourceUrl.trim(), priority: urgent ? 'urgent' : 'normal' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'The goal could not be updated.');
      refreshMissionGoals();
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function submitGoal(event) {
    event.preventDefault();
    const input = body.querySelector('#mission-goal-input');
    const priorityInput = body.querySelector('#mission-goal-priority');
    const sourceInput = body.querySelector('#mission-goal-source');
    const status = body.querySelector('#mission-goal-status');
    const goal = input.value.trim();
    const priority = priorityInput.value === 'urgent' ? 'urgent' : 'normal';
    const sourceUrl = sourceInput.value.trim();
    if (!goal) return;
    status.textContent = 'Sending…';
    try {
      const response = await fetch('/api/orchestration/goals', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, priority, source_url: sourceUrl, title: goal.split(/\n/)[0].slice(0, 120) })
      });
      if (response.status === 401) throw new Error('Unlock the Dropbox first, then try again.');
      if (!response.ok) throw new Error('The goal could not be saved.');
      input.value = '';
      sourceInput.value = '';
      status.textContent = priority === 'urgent'
        ? 'Urgent goal received. Penny will process it.'
        : 'Goal saved. Penny will ignore it unless it is marked urgent.';
      refreshMissionGoals();
      const penny = configuredAgent('oss');
      if (penny && typeof addFeedItem === 'function') addFeedItem(penny, `Goal received: ${goal.slice(0, 90)}`);
      if (typeof refreshOpsQueue === 'function') refreshOpsQueue();
    } catch (error) {
      status.textContent = error.message;
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

  window.AOControlCenter = { openAgent, openMissionControl, close, customize };

  // The sidebar's Mission Control row lives on every page, so it links back to
  // the office with ?panel=mission-control and the panel opens itself here.
  if (new URLSearchParams(location.search).get('panel') === 'mission-control') {
    openMissionControl();
  }
})();
