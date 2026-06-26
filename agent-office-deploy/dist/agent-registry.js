(function () {
  const API = '/api/agents';
  const STATUSES = ['idle', 'running', 'blocked', 'failed', 'needs_input', 'offline'];
  let agents = [];
  let drops = [];

  async function load() {
    if (!(await ensureDropsSession(true))) return false;
    agents = await requestJson(API);
    drops = await requestJson(DROPS_API).catch(() => []);
    return true;
  }

  function taskTitle(id) {
    const drop = drops.find(item => item.id === id);
    return drop ? drop.title : '';
  }

  function projectForAgent(agent) {
    if (agent.current_project_id) return agent.current_project_id;
    const task = drops.find(item => item.id === agent.current_task_id);
    return task ? task.project : '';
  }

  async function patchAgent(id, patch) {
    await requestJson(`${API}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await render();
  }

  async function heartbeat(id) {
    await requestJson(`${API}/${id}/heartbeat`, { method: 'POST' });
    await render();
  }

  async function createAgent() {
    const form = document.getElementById('agent-registry-form');
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name || !data.name.trim()) {
      alert('Agent name is required.');
      return;
    }
    await requestJson(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    form.reset();
    await render();
  }

  function renderAgent(agent) {
    const project = projectForAgent(agent);
    const task = taskTitle(agent.current_task_id) || agent.current_task_id || 'No active task';
    return `<article class="ops-card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px;">
        <div>
          <h3>${escHTML(agent.name)}</h3>
          <div class="ops-meta">${escHTML(agent.role || 'Agent')} / ${escHTML(agent.model || 'unknown model')}</div>
        </div>
        <span class="agent-status-pill agent-status-${escAttr(agent.status || 'idle')}">${escHTML(agent.status || 'idle')}</span>
      </div>
      <div class="ops-meta">Task: ${escHTML(task)}</div>
      <div class="ops-meta">Project: ${escHTML(project || 'Unassigned')}</div>
      <div class="ops-meta">Source: ${escHTML(agent.source || 'Manual')}</div>
      <div class="ops-meta">Last heartbeat: ${agent.last_heartbeat ? dropFormatDate(agent.last_heartbeat) : 'never'}</div>
      <div class="ops-actions" style="margin-top:12px;">
        <select class="mission-inline-select" data-agent-status="${escAttr(agent.id)}">
          ${STATUSES.map(status => `<option value="${status}" ${status === agent.status ? 'selected' : ''}>${status}</option>`).join('')}
        </select>
        <button class="btn btn-secondary" data-agent-heartbeat="${escAttr(agent.id)}">Heartbeat</button>
      </div>
      ${agent.notes ? `<div class="ops-meta" style="margin-top:10px;">${escHTML(agent.notes)}</div>` : ''}
    </article>`;
  }

  async function render() {
    const root = document.getElementById('agent-registry-app');
    if (!root) return;
    root.innerHTML = '<div class="ops-shell"><div class="ops-meta">Loading agent registry...</div></div>';
    if (!(await load())) {
      root.innerHTML = '<div class="ops-shell"><div class="ops-card"><div class="ops-meta">Unlock the Mission Board to use Agent Registry.</div></div></div>';
      return;
    }
    const running = agents.filter(agent => agent.status === 'running').length;
    const blocked = agents.filter(agent => ['blocked', 'failed', 'needs_input'].includes(agent.status)).length;
    root.innerHTML = `<div class="ops-shell">
      <div class="ops-toolbar">
        <div>
          <div class="ops-title">Agent Registry</div>
          <div class="ops-copy">Persistent agent state for assignments, current work, heartbeat, and operating status.</div>
        </div>
        <button id="agent-registry-save" class="btn btn-primary">Add Agent</button>
      </div>
      <form id="agent-registry-form" class="ops-form">
        <input name="name" placeholder="Agent name" />
        <input name="role" placeholder="Role" />
        <input name="model" placeholder="Model" />
        <select name="status">${STATUSES.map(status => `<option value="${status}">${status}</option>`).join('')}</select>
        <input name="source" placeholder="Source/system" />
        <textarea name="notes" placeholder="Notes or memory link"></textarea>
      </form>
      <div class="ops-kpi-row">
        <div class="ops-kpi"><strong>${agents.length}</strong><span>Registered</span></div>
        <div class="ops-kpi"><strong>${running}</strong><span>Running</span></div>
        <div class="ops-kpi"><strong>${blocked}</strong><span>Needs attention</span></div>
      </div>
      <div class="ops-grid">${agents.map(renderAgent).join('')}</div>
    </div>`;
    document.getElementById('agent-registry-save').addEventListener('click', createAgent);
    root.querySelectorAll('[data-agent-status]').forEach(select => {
      select.addEventListener('change', () => patchAgent(select.dataset.agentStatus, { status: select.value }));
    });
    root.querySelectorAll('[data-agent-heartbeat]').forEach(button => {
      button.addEventListener('click', () => heartbeat(button.dataset.agentHeartbeat));
    });
  }

  window.AgentRegistry = { render };
})();
