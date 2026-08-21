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
    ['studioclaw', 'Studio Director'],
    ['nightwaveaudio', 'Nightwave Audio'],
    ['youtubeclaw', 'YouTube Claw'],
    ['commentfarm', 'CommentFarm'],
    ['newsreporter', 'ShareBot67'],
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
    const view = document.getElementById('dropbox-view');
    const title = document.querySelector('#dropbox-view .dropbox-toolbar h2');
    if (title) title.textContent = view && view.classList.contains('ios-mode') ? 'Reminders' : 'Dropbox';
    const save = document.getElementById('save-drop-btn');
    if (save) save.textContent = 'Save Note';
    const newBtn = document.getElementById('new-drop-btn');
    if (newBtn) newBtn.textContent = view && view.classList.contains('ios-mode') ? 'New Reminder' : 'New Note';
    const content = document.getElementById('drop-content');
    if (content) content.placeholder = 'Capture the note, links, details, or next action.';

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

    // Project and Agent belong with the rest of the secondary filters, which
    // are the ones a phone keeps behind the More filters button.
    const filters = document.getElementById('dropbox-filters-more') || document.querySelector('.dropbox-filters');
    if (filters && !document.getElementById('drop-filter-project')) {
      const projectFilter = document.createElement('select');
      projectFilter.id = 'drop-filter-project';
      projectFilter.innerHTML = '<option value="">All Projects</option>';
      filters.insertBefore(projectFilter, document.getElementById('drop-filter-reminder'));
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
      pipeline.className = 'mission-pipeline hidden';
      main.insertBefore(pipeline, document.getElementById('dropbox-table-wrap'));
    }

    // The board is a third way to look at the same drops, so it sits behind the
    // view switch with Table and Cards rather than on top of whichever is on.
    const cardsBtn = document.getElementById('dropbox-view-detail');
    if (cardsBtn && !document.getElementById('dropbox-view-board')) {
      const boardBtn = document.createElement('button');
      boardBtn.id = 'dropbox-view-board';
      boardBtn.className = 'btn btn-secondary';
      boardBtn.textContent = 'Board';
      cardsBtn.insertAdjacentElement('afterend', boardBtn);
      boardBtn.addEventListener('click', () => {
        dropboxState.view = 'board';
        renderDropbox();
      });
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
    const current = dropboxState.filters.project || select.value;
    const projects = [...new Set(dropboxState.drops.map(d => d.project).filter(Boolean))].sort();
    select.innerHTML = '<option value="">All Projects</option>' + projects.map(project => `<option value="${escAttr(project)}">${escHTML(project)}</option>`).join('');
    select.value = projects.includes(current) ? current : '';
  }

  function filteredDrops() {
    let items = [...dropboxState.drops];
    const filters = dropboxState.filters || {};
    const iosMode = Boolean(document.getElementById('dropbox-view')?.classList.contains('ios-mode'));
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(drop => [drop.title, drop.subject, drop.project, drop.agent, drop.content, ...(drop.tags || []), ...(drop.links || [])].join(' ').toLowerCase().includes(q));
    }
    if (filters.subject) items = items.filter(drop => (drop.subject || '') === filters.subject);
    if (filters.status) items = items.filter(drop => (drop.status || '') === filters.status);
    if (filters.project) items = items.filter(drop => (drop.project || '') === filters.project);
    else items = items.filter(drop => iosMode ? (drop.project || '') === 'iOS' : (drop.project || '') !== 'iOS');
    if (filters.agent) items = items.filter(drop => (drop.agent || '') === filters.agent);
    items = applyDropboxFolderFilter(items);
    items = applyReminderFilter(items, filters.reminder);
    items.sort((a, b) => {
      if (filters.sort === 'remind_asc') return compareReminders(a, b);
      if (filters.sort === 'updated_asc') return new Date(a.updated_at) - new Date(b.updated_at);
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
      // Every task in the column, and a count that says how many that is.
      const columnItems = items.filter(drop => (drop.status || 'idea') === status);
      return `<section class="mission-column">
        <h3>${escHTML(label)} (${columnItems.length})</h3>
        ${columnItems.length ? columnItems.map(drop => `<article class="mission-ticket" data-drop-id="${escAttr(drop.id)}">
          <strong>${escHTML(drop.title || 'Untitled task')}</strong>
          <span>${escHTML(drop.project || 'No project')} / ${escHTML(agentLabel(drop.agent))}</span>
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

  // Opening a task gives it the page, the way opening a note does: the list and
  // its toolbar step aside and the task is what is on screen, with a way back.
  function renderMissionNoteView() {
    const view   = document.getElementById('view-dropbox');
    const listEl = document.getElementById('dropbox-view');
    if (!view || !listEl) return;

    document.getElementById('note-view-section')?.remove();
    const drop = dropboxState.drops.find(d => d.id === dropboxState.selectedId);
    if (!drop) {
      listEl.style.display = '';
      return;
    }
    const iosMode = listEl.classList.contains('ios-mode');
    listEl.style.display = 'none';

    // Reading a note is the common case, so the note reads as a note: title,
    // when it was written, and the text. Moving it between statuses is a rarer,
    // deliberate act and waits behind Edit.
    const section = document.createElement('section');
    section.id = 'note-view-section';
    section.style.cssText = 'width:100%;max-width:720px;margin:0 auto;padding:24px 20px 60px;box-sizing:border-box;';
    section.innerHTML = `
      <div class="drop-detail">
        <button type="button" id="mission-detail-back" class="drop-detail-back">← All tasks</button>
        <div class="drop-detail-header">
          <h2 class="drop-detail-title">${escHTML(drop.title || 'Untitled task')}</h2>
          <div class="drop-detail-meta-row">
            <span>${dropFormatDate(drop.updated_at || drop.date)}</span>
            <span class="sep">·</span>
            ${dropBadge(statusLabel(drop.status), 'status')}
            ${iosMode || !drop.subject ? '' : dropBadge(drop.subject, 'subject')}
            <span>${escHTML(drop.project || 'No project')} / ${escHTML(agentLabel(drop.agent))}</span>
          </div>
        </div>
        <button type="button" id="mission-detail-edit" class="btn btn-secondary mission-edit-toggle">Edit</button>
        <div id="mission-detail-edit-fields" class="mission-edit-fields is-collapsed">
          <h4>Move Task</h4>
          ${selectHtml('mission-detail-status', drop.status || 'idea', STATUSES)}
        </div>
        <div class="drop-detail-content">${escHTML(drop.content || '')}</div>
        ${(drop.tags || []).length ? `<div class="drop-detail-section-label">Tags</div><div class="detail-tags">${drop.tags.map(t => dropBadge(t, 'tag')).join(' ')}</div>` : ''}
        <p><strong>Created:</strong> ${dropFormatDate(drop.date)}</p>
        <div class="detail-actions">
          <button id="mission-done-btn" class="btn btn-primary">Mark Done</button>
          <button id="mission-archive-btn" class="btn btn-secondary">Archive</button>
          <button id="delete-drop-btn" class="btn btn-danger">Delete</button>
        </div>
      </div>`;

    view.appendChild(section);
    view.scrollTop = 0;

    document.getElementById('mission-detail-back').addEventListener('click', () => {
      dropboxState.selectedId = null;
      renderDropbox();
      view.scrollTop = 0;
    });

    const editToggle = document.getElementById('mission-detail-edit');
    editToggle.addEventListener('click', () => {
      const fields = document.getElementById('mission-detail-edit-fields');
      const open = fields.classList.toggle('is-collapsed') === false;
      editToggle.textContent = open ? 'Done editing' : 'Edit';
    });
    document.getElementById('mission-detail-status').addEventListener('change', e => patchDrop(drop.id, { status: e.target.value }));
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
      dropboxState.filters.reminder = dropboxState.filters.reminder || '';
    }
    window.getFilteredDrops = getFilteredDrops = filteredDrops;
    const baseRender = renderDropbox;
    window.renderDropbox = renderDropbox = function () {
      ensureMissionControls();
      populateSubjectFilter();
      populateProjectFilter();
      syncDropboxChrome();
      // The folder wall comes before any of the three note views: nothing is
      // listed until a folder is open or a search has been typed.
      if (isDropboxGridOpen()) renderDropFolders();
      else if (dropboxState.view === 'board') renderPipeline();
      else if (dropboxState.view === 'cards') renderDropCards();
      else renderDropTable();
      renderMissionNoteView();
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
    if (currentView === 'dropbox') renderDropbox();
  }

  document.addEventListener('DOMContentLoaded', installMissionBoard);
})();
