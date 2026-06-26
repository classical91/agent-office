(function () {
  const API = '/api/projects';
  let projects = [];
  let drops = [];
  let selectedId = '';

  async function load() {
    if (!(await ensureDropsSession(true))) return false;
    projects = await requestJson(API);
    drops = await requestJson(DROPS_API).catch(() => []);
    if (!selectedId && projects[0]) selectedId = projects[0].id;
    return true;
  }

  function taskCount(project) {
    return drops.filter(drop => (drop.project || '') === project.name || (drop.project || '') === project.slug).length;
  }

  function activeTaskCount(project) {
    return drops.filter(drop => ((drop.project || '') === project.name || (drop.project || '') === project.slug) && !['done', 'archived'].includes(drop.status)).length;
  }

  function renderProjectCard(project) {
    const active = project.id === selectedId;
    return `<article class="ops-card" data-project-id="${escAttr(project.id)}" style="${active ? 'border-color:var(--accent);background:rgba(99,102,241,0.08);' : ''}">
      <h3>${escHTML(project.name)}</h3>
      <div class="ops-meta">${escHTML(project.status || 'No status')} / ${activeTaskCount(project)} active tasks</div>
      <div class="ops-meta">Branch: ${escHTML(project.current_branch || 'unknown')}</div>
      <div class="ops-meta">Next: ${escHTML(project.next_action || 'No next action set')}</div>
    </article>`;
  }

  function renderOverview(project) {
    if (!project) {
      return '<div class="ops-card"><div class="ops-meta">Create a project room to gather tasks, links, notes, and deployment context.</div></div>';
    }
    const related = drops.filter(drop => (drop.project || '') === project.name || (drop.project || '') === project.slug);
    const open = related.filter(drop => !['done', 'archived'].includes(drop.status));
    return `<div class="ops-card">
      <h3>${escHTML(project.name)} Overview</h3>
      <div class="ops-kpi-row">
        <div class="ops-kpi"><strong>${open.length}</strong><span>Open tasks</span></div>
        <div class="ops-kpi"><strong>${related.filter(d => d.priority === 'urgent').length}</strong><span>Urgent</span></div>
        <div class="ops-kpi"><strong>${related.filter(d => d.status === 'ready_to_deploy').length}</strong><span>Ready to deploy</span></div>
      </div>
      <div class="ops-meta">GitHub: ${project.github_repo ? `<a href="${escAttr(project.github_repo)}" target="_blank" style="color:var(--accent);">open repo</a>` : 'not set'}</div>
      <div class="ops-meta">Railway: ${project.railway_url ? `<a href="${escAttr(project.railway_url)}" target="_blank" style="color:var(--accent);">open deploy</a>` : 'not set'}</div>
      <div class="ops-meta">Local path: ${escHTML(project.local_path || 'not set')}</div>
      <div class="ops-meta">Last commit: ${escHTML(project.last_commit || 'unknown')}</div>
      <h3 style="margin-top:18px;">Open Tasks</h3>
      ${open.length ? open.slice(0, 8).map(drop => `<div class="mission-ticket" data-task-id="${escAttr(drop.id)}">
        <strong>${escHTML(drop.title || 'Untitled task')}</strong>
        <span>${escHTML(drop.status || 'idea')} / ${escHTML(drop.priority || 'normal')}</span>
      </div>`).join('') : '<div class="ops-meta">No open tasks linked to this project.</div>'}
    </div>`;
  }

  async function createProject() {
    const form = document.getElementById('project-room-form');
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name || !data.name.trim()) {
      alert('Project name is required.');
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

  async function render() {
    const root = document.getElementById('project-rooms-app');
    if (!root) return;
    root.innerHTML = '<div class="ops-shell"><div class="ops-meta">Loading project rooms...</div></div>';
    if (!(await load())) {
      root.innerHTML = '<div class="ops-shell"><div class="ops-card"><div class="ops-meta">Unlock the Mission Board to use Project Rooms.</div></div></div>';
      return;
    }
    const selected = projects.find(project => project.id === selectedId);
    root.innerHTML = `<div class="ops-shell">
      <div class="ops-toolbar">
        <div>
          <div class="ops-title">Project Rooms</div>
          <div class="ops-copy">Repo, deploy, tasks, notes, and next action per project.</div>
        </div>
        <button id="project-room-save" class="btn btn-primary">Create Room</button>
      </div>
      <form id="project-room-form" class="ops-form">
        <input name="name" placeholder="Project name" />
        <input name="github_repo" placeholder="GitHub repo URL" />
        <input name="railway_url" placeholder="Railway/deploy URL" />
        <input name="local_path" placeholder="Local folder path" />
        <input name="current_branch" placeholder="Active branch" />
        <input name="last_commit" placeholder="Last commit" />
        <input name="next_action" placeholder="Next action" />
        <input name="status" placeholder="Status" />
        <textarea name="description" placeholder="Project notes"></textarea>
      </form>
      <div class="ops-kpi-row">
        <div class="ops-kpi"><strong>${projects.length}</strong><span>Rooms</span></div>
        <div class="ops-kpi"><strong>${drops.filter(d => !['done', 'archived'].includes(d.status)).length}</strong><span>Active tasks</span></div>
        <div class="ops-kpi"><strong>${projects.reduce((sum, p) => sum + taskCount(p), 0)}</strong><span>Linked tasks</span></div>
      </div>
      <div style="display:grid;grid-template-columns:minmax(260px,360px) 1fr;gap:14px;align-items:start;">
        <div class="ops-grid" style="grid-template-columns:1fr;">${projects.length ? projects.map(renderProjectCard).join('') : '<div class="ops-card"><div class="ops-meta">No project rooms yet.</div></div>'}</div>
        ${renderOverview(selected)}
      </div>
    </div>`;
    document.getElementById('project-room-save').addEventListener('click', createProject);
    root.querySelectorAll('[data-project-id]').forEach(card => {
      card.addEventListener('click', () => {
        selectedId = card.dataset.projectId;
        render();
      });
    });
    root.querySelectorAll('[data-task-id]').forEach(card => {
      card.addEventListener('click', () => {
        switchView('dropbox');
        dropboxState.selectedId = card.dataset.taskId;
        renderDropbox();
      });
    });
  }

  window.ProjectRooms = { render };
})();
