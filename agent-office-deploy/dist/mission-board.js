(function () {
  const STATUSES = [
    ['inbox', 'Inbox'],
    ['idea', 'Idea'],
    ['researching', 'Researching'],
    ['coding', 'Coding'],
    ['reviewing', 'Reviewing'],
    ['ready_to_deploy', 'Ready to Deploy'],
    ['done', 'Done'],
    ['archived', 'Archived'],
  ];

  const AGENT_OPTIONS = [
    ['codex', 'Codex'],
    ['claude-code', 'Claude Code'],
    ['openclaw', 'OpenClaw'],
    ['reaper', 'Reaper'],
    ['traderclaw', 'TraderClaw'],
    ['webclaw', 'WebClaw'],
    ['researcher', 'Researcher'],
    ['guardian', 'Guardian'],
    ['farmbot', 'FarmBot'],
    ['rankforge', 'RankForge'],
    ['world-monitor', 'World Monitor'],
  ];

  function statusLabel(value) {
    return (STATUSES.find(item => item[0] === value) || [value, value || 'Idea'])[1];
  }

  function ensureMissionControls() {
    const title = document.querySelector('#dropbox-view .dropbox-toolbar h2');
    if (title) title.textContent = 'Mission Board';
    const save = document.getElementById('save-drop-btn');
    if (save) save.textContent = 'Save Task';
    const newBtn = document.getElementById('new-drop-btn');
    if (newBtn) newBtn.textContent = 'New Task';
    const content = document.getElementById('drop-content');
    if (content) content.placeholder = 'Capture the task, notes, links, acceptance details, or next action.';

    replaceOptions(document.getElementById('drop-status'), STATUSES, 'idea');
    replaceOptions(document.getElementById('drop-filter-status'), [['', 'All Statuses']].concat(STATUSES), '');

    if (!document.getElementById('drop-agent')) {
      const project = document.getElementById('drop-project');
      if (project) {
        const agent = document.createElement('select');
        agent.id = 'drop-agent';
        agent.innerHTML = '<option value="">Unassigned Agent</option>' + AGENT_OPTIONS.map(item => `<option value="${escAttr(item[0])}">${escHTML(item[1])}</option>`).join('');
        project.insertAdjacentElement('afterend', agent);
      }
    }

    const filters = document.querySelector('.dropbox-filters');
    if (filters && !document.getElementById('drop-filter-project')) {
      const projectFilter = document.createElement('select');
      projectFilter.id = 'drop-filter-project';
      projectFilter.innerHTML = '<option value="">All Projects</option>';
      filters.insertBefore(projectFilter, document.getElementById('drop-filter-priority'));
      projectFilter.addEventListener('change', e => {
        dropboxState.filters.project = e.target.value;
        renderDropbox();
      });
    }

    if (filters && !document.getElementById('drop-filter-agent')) {
      const agentFilter = document.createElement('select');
      agentFilter.id = 'drop-filter-agent';
      agentFilter.innerHTML = '<option value="">All Agents</option>' + AGENT_OPTIONS.map(item => `<option value="${escAttr(item[0])}">${escHTML(item[1])}</option>`).join('');
      filters.insertBefore(agentFilter, document.getElementById('drop-sort'));
      agentFilter.addEventListener('change', e => {
        dropboxState.filters.agent = e.target.value;
        renderDropbox();
      });
    }

    const main = document.querySelector('.dropbox-main');
    if (main && !document.getElementById('mission-pipeline')) {
      const pipeline = document.createElement('div');
      pipeline.id = 'mission-pipeline';
      pipeline.className = 'mission-pipeline';
      main.insertBefore(pipeline, document.getElementById('dropbox-table-wrap'));
    }
  }

  function replaceOptions(select, options, selected) {
    if (!select) return;
    select.innerHTML = options.map(item => `<option value="${escAttr(item[0])}">${escHTML(item[1])}</option>`).join('');
    select.value = selected;
  }

  function populateProjectFilter() {
    const select = document.getElementById('drop-filter-project');
    if (!select) return;
    const current = select.value;
    const projects = [...new Set(dropboxState.drops.map(d => d.project).filter(Boolean))].sort();
    select.innerHTML = '<option value="">All Projects</option>' + projects.map(project => `<option value="${escAttr(project)}">${escHTML(project)}</option>`).join('');
    select.value = projects.includes(current) ? current : '';
  }

  function filteredDrops() {
    let items = [...dropboxState.drops];
    const filters = dropboxState.filters || {};
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(drop => [drop.title, drop.subject, drop.project, drop.agent, drop.content, ...(drop.tags || []), ...(drop.links || [])].join(' ').toLowerCase().includes(q));
    }
    if (filters.subject) items = items.filter(drop => (drop.subject || '') === filters.subject);
    if (filters.status) items = items.filter(drop => (drop.status || '') === filters.status);
    if (filters.priority) items = items.filter(drop => (drop.priority || '') === filters.priority);
    if (filters.project) items = items.filter(drop => (drop.project || '') === filters.project);
    if (filters.agent) items = items.filter(drop => (drop.agent || '') === filters.agent);
    items.sort((a, b) => {
      if (filters.sort === 'updated_asc') return new Date(a.updated_at) - new Date(b.updated_at);
      if (filters.sort === 'priority_desc') {
        const rank = { urgent: 3, high: 2, normal: 1 };
        return (rank[b.priority] || 0) - (rank[a.priority] || 0);
      }
      if (filters.sort === 'title_asc') return (a.title || '').localeCompare(b.title || '');
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
    return items;
  }

  async function patchDrop(id, patch) {
    await requestJson(`${DROPS_API}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const drops = await loadDrops();
    if (drops !== null) dropboxState.drops = drops;
    renderDropbox();
  }

  function renderPipeline() {
    const wrap = document.getElementById('mission-pipeline');
    if (!wrap) return;
    const items = filteredDrops().filter(drop => drop.status !== 'archived');
    wrap.innerHTML = STATUSES.filter(item => item[0] !== 'archived').map(([status, label]) => {
      const columnItems = items.filter(drop => (drop.status || 'idea') === status).slice(0, 5);
      return `<section class="mission-column">
        <h3>${escHTML(label)} (${columnItems.length})</h3>
        ${columnItems.length ? columnItems.map(drop => `<article class="mission-ticket" data-drop-id="${escAttr(drop.id)}">
          <strong>${escHTML(drop.title || 'Untitled task')}</strong>
          <span>${escHTML(drop.project || 'No project')} / ${escHTML(agentLabel(drop.agent))}</span>
          <span>${escHTML(drop.priority || 'normal')}</span>
        </article>`).join('') : '<div class="ops-meta">No tasks</div>'}
      </section>`;
    }).join('');
    wrap.querySelectorAll('[data-drop-id]').forEach(el => {
      el.addEventListener('click', () => {
        dropboxState.selectedId = el.dataset.dropId;
        renderDropbox();
      });
    });
  }

  function agentLabel(id) {
    return (AGENT_OPTIONS.find(item => item[0] === id) || [id, id || 'Unassigned'])[1];
  }

  function selectHtml(id, value, options) {
    return `<select id="${escAttr(id)}" class="mission-inline-select">${options.map(item => `<option value="${escAttr(item[0])}" ${item[0] === value ? 'selected' : ''}>${escHTML(item[1])}</option>`).join('')}</select>`;
  }

  function renderMissionDetailPanel() {
    const panel = document.getElementById('drop-detail-panel');
    if (!panel) return;
    const drop = dropboxState.drops.find(d => d.id === dropboxState.selectedId);
    if (!drop) {
      panel.innerHTML = '<div class="drop-detail-empty">Select a task to view details.</div>';
      return;
    }
    const projects = [...new Set(dropboxState.drops.map(d => d.project).filter(Boolean))].sort();
    panel.innerHTML = `
      <div class="drop-detail">
        <h3>${escHTML(drop.title || 'Untitled task')}</h3>
        <div class="detail-badges">
          ${dropBadge(statusLabel(drop.status), 'status')}
          ${dropBadge(drop.priority, 'priority')}
          ${dropBadge(drop.subject, 'subject')}
        </div>
        <h4>Move Task</h4>
        ${selectHtml('mission-detail-status', drop.status || 'idea', STATUSES)}
        <h4>Assignment</h4>
        ${selectHtml('mission-detail-agent', drop.agent || '', [['', 'Unassigned Agent']].concat(AGENT_OPTIONS))}
        ${selectHtml('mission-detail-project', drop.project || '', [['', 'No Project']].concat(projects.map(p => [p, p])))}
        <p><strong>Created:</strong> ${dropFormatDate(drop.date)}</p>
        <p><strong>Updated:</strong> ${dropFormatDate(drop.updated_at || drop.date)}</p>
        <div class="detail-tags">${(drop.tags || []).map(t => dropBadge(t, 'tag')).join(' ')}</div>
        <h4>Content</h4>
        <pre class="drop-content-view">${escHTML(drop.content || '')}</pre>
        <div class="detail-actions">
          <button id="mission-done-btn" class="btn btn-primary">Mark Done</button>
          <button id="mission-archive-btn" class="btn btn-secondary">Archive</button>
          <button id="delete-drop-btn" class="btn btn-danger">Delete</button>
        </div>
      </div>`;
    document.getElementById('mission-detail-status').addEventListener('change', e => patchDrop(drop.id, { status: e.target.value }));
    document.getElementById('mission-detail-agent').addEventListener('change', e => patchDrop(drop.id, { agent: e.target.value }));
    document.getElementById('mission-detail-project').addEventListener('change', e => patchDrop(drop.id, { project: e.target.value }));
    document.getElementById('mission-done-btn').addEventListener('click', () => patchDrop(drop.id, { status: 'done' }));
    document.getElementById('mission-archive-btn').addEventListener('click', () => patchDrop(drop.id, { status: 'archived' }));
    document.getElementById('delete-drop-btn').addEventListener('click', async () => {
      if (!confirm('Delete this task?')) return;
      try {
        await requestJson(`${DROPS_API}/${drop.id}`, { method: 'DELETE' });
        dropboxState.selectedId = null;
        const drops = await loadDrops();
        if (drops !== null) dropboxState.drops = drops;
        renderDropbox();
      } catch (error) {
        handleDropboxRequestError(error, 'Failed to delete task.');
      }
    });
  }

  function installMissionBoard() {
    ensureMissionControls();
    if (dropboxState && dropboxState.filters) {
      dropboxState.filters.project = dropboxState.filters.project || '';
      dropboxState.filters.agent = dropboxState.filters.agent || '';
    }
    window.getFilteredDrops = getFilteredDrops = filteredDrops;
    const baseRender = renderDropbox;
    window.renderDropbox = renderDropbox = function () {
      ensureMissionControls();
      populateSubjectFilter();
      populateProjectFilter();
      renderPipeline();
      if (dropboxState.view === 'table') renderDropTable();
      else renderDropCards();
      renderMissionDetailPanel();
    };
    const baseSave = saveDrop;
    window.saveDrop = saveDrop = async function () {
      const agent = document.getElementById('drop-agent');
      if (agent) {
        const payloadAgent = agent.value;
        const originalRequestJson = requestJson;
        baseSave._agent = payloadAgent;
      }
      return baseSave();
    };
  }

  document.addEventListener('DOMContentLoaded', installMissionBoard);
})();
