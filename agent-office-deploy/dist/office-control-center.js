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
        <div class="mission-goal-actions"><button class="ao-btn ao-btn--primary" type="submit">Send goal to Penny</button><span id="mission-goal-status">Saved to the Mission Board for orchestration.</span></div>
      </form>
      <div class="workflow-lane" aria-label="Office workflow">
        ${Object.entries(counts).map(([name, count]) => `<div><span>${escape(name.replace(/^./, char => char.toUpperCase()))}</span><strong>${count}</strong></div>`).join('<i>→</i>')}
      </div>
      <section class="mission-results" aria-live="polite">
        <div class="mission-results-heading"><strong>Goals and Outbox</strong><span>Results are also delivered to Jason in Telegram.</span></div>
        <div id="mission-results-list"><div class="control-unavailable">Loading goals…</div></div>
      </section>
      <div class="control-actions"><a class="ao-btn" href="/mission-board.html">Open Mission Board</a><a class="ao-btn" href="/project-rooms.html">Project rooms</a><a class="ao-btn" href="/agent-registry.html">Agent registry</a></div>`;
    body.querySelector('#mission-goal-form').addEventListener('submit', submitGoal);
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
      if (!goals.length) {
        list.innerHTML = '<div class="control-unavailable">No Mission Control goals yet.</div>';
        return;
      }
      list.innerHTML = goals.slice(0, 10).map(goal => `
        <article class="mission-result mission-result--${escape(goal.orchestration_status)}">
          <div><strong>${escape(goal.title)}</strong><span class="control-state">${escape(goal.orchestration_status)}</span></div>
          ${goal.orchestration_result ? `<p>${escape(goal.orchestration_result)}</p>` : ''}
          ${goal.orchestration_error ? `<p class="mission-result-error">${escape(goal.orchestration_error)}</p>` : ''}
          <small>${escape(new Date(goal.updated_at || goal.date).toLocaleString())}</small>
        </article>`).join('');
    } catch (error) {
      list.innerHTML = `<div class="control-unavailable">${escape(error.message)}</div>`;
    }
  }

  async function submitGoal(event) {
    event.preventDefault();
    const input = body.querySelector('#mission-goal-input');
    const status = body.querySelector('#mission-goal-status');
    const goal = input.value.trim();
    if (!goal) return;
    status.textContent = 'Sending…';
    try {
      const response = await fetch('/api/orchestration/goals', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, title: goal.split(/\n/)[0].slice(0, 120) })
      });
      if (response.status === 401) throw new Error('Unlock the Dropbox first, then try again.');
      if (!response.ok) throw new Error('The goal could not be saved.');
      input.value = '';
      status.textContent = 'Goal received. Penny owns the next routing decision.';
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
})();
