(function () {
  'use strict';

  // Which agents are in the 3D office.
  //
  // Clicking a character in the room opens the appearance editor — that is a
  // different question from who is standing in the room at all, and until now
  // nothing answered the second one. This is that control.
  //
  // The cast here is `agentState`, which app-shared.js builds straight from the
  // canonical AGENTS list, so the panel shows the eleven agents the office
  // actually has, under the names and roles AGENTS gives them, drawn with the
  // room's own renderer. There is deliberately no roster literal in this file:
  // a second hardcoded cast is exactly how a screen ends up advertising agents
  // that do not exist.
  //
  // Leaving an agent out hides them from the room and nothing else. Their
  // AGENTS entry, their station, their tasks and their saved character look are
  // all untouched, and putting them back restores the character they had.

  const STORAGE_KEY = 'agent-office-room-roster-v1';
  // The office holds ten desks' worth of attention. Eleven agents on the roster
  // means the cap is a real choice rather than a formality.
  const MAX_IN_ROOM = 10;

  const officeSvg = document.getElementById('officesvg');
  if (!officeSvg || typeof agentState === 'undefined' || typeof renderAgents !== 'function') return;

  // null means no choice has been made and the whole roster is in the room —
  // the office's behaviour before this panel existed. An empty array is a
  // choice: an empty room.
  let selection = readSelection();

  function rosterIds() {
    return agentState.map((agent) => agent.id);
  }

  function readSelection() {
    let parsed;
    try {
      parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (_) {
      return null;
    }
    if (!parsed || !Array.isArray(parsed.selected)) return null;
    // Ids are filtered against the live roster on the way in, so an agent
    // removed from AGENTS cannot linger in a saved selection, and a saved id
    // that was never real cannot conjure a character.
    const known = new Set(rosterIds());
    const kept = [];
    parsed.selected.forEach((id) => {
      if (known.has(id) && !kept.includes(id) && kept.length < MAX_IN_ROOM) kept.push(id);
    });
    return kept;
  }

  function persist() {
    try {
      if (selection === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify({ selected: selection }));
    } catch (_) { /* private browsing — the choice still holds for this visit */ }
  }

  function isSelected(id) {
    return selection !== null && selection.includes(id);
  }

  function isInRoom(id) {
    return selection === null || selection.includes(id);
  }

  function selectedCount() {
    return selection === null ? 0 : selection.length;
  }

  function atCapacity() {
    return selectedCount() >= MAX_IN_ROOM;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function createPanel() {
    const shell = document.createElement('div');
    shell.id = 'office-roster-selector';
    shell.className = 'office-roster-selector';
    shell.hidden = true;
    shell.innerHTML = `
      <button class="roster-selector-backdrop" type="button" aria-label="Close the agent roster"></button>
      <section class="roster-selector-sheet" role="dialog" aria-modal="true" aria-labelledby="roster-selector-title">
        <header class="roster-selector-header">
          <div class="roster-selector-heading">
            <span class="roster-selector-mark" aria-hidden="true">▚</span>
            <div>
              <h2 id="roster-selector-title">Agent roster</h2>
              <p>Who stands in the office</p>
            </div>
          </div>
          <div class="roster-selector-count">
            <strong id="roster-selector-selected">0 / ${MAX_IN_ROOM} selected</strong>
            <span id="roster-selector-available"></span>
          </div>
          <button class="roster-selector-close" type="button" aria-label="Close the agent roster">&times;</button>
        </header>
        <div id="roster-selector-grid" class="roster-selector-grid" role="group" aria-label="Agents on the roster"></div>
        <footer class="roster-selector-footer">
          <p id="roster-selector-status" aria-live="polite"></p>
          <div class="roster-selector-actions">
            <button type="button" class="roster-selector-everyone">Show everyone</button>
            <button type="button" class="roster-selector-empty">Empty the room</button>
            <button type="button" class="roster-selector-done">Done</button>
          </div>
        </footer>
      </section>`;
    document.body.appendChild(shell);

    shell.querySelector('.roster-selector-backdrop').addEventListener('click', close);
    shell.querySelector('.roster-selector-close').addEventListener('click', close);
    shell.querySelector('.roster-selector-done').addEventListener('click', close);
    shell.querySelector('.roster-selector-everyone').addEventListener('click', showEveryone);
    shell.querySelector('.roster-selector-empty').addEventListener('click', emptyTheRoom);
    shell.querySelector('#roster-selector-grid').addEventListener('click', handleCardClick);
    return shell;
  }

  const panel = createPanel();
  let lastFocus = null;

  function renderCounts() {
    const count = document.getElementById('roster-selector-selected');
    const available = document.getElementById('roster-selector-available');
    // Both numbers are read off the live roster. Nothing here is a literal
    // total that could go on claiming twelve agents after one is removed.
    count.textContent = `${selectedCount()} / ${MAX_IN_ROOM} selected`;
    available.textContent = `${agentState.length} available`;
  }

  function renderStatus() {
    const status = document.getElementById('roster-selector-status');
    if (selection === null) {
      status.textContent = `No roster set — all ${agentState.length} agents are in the office.`;
    } else if (selection.length === 0) {
      status.textContent = 'The office is empty. Pick anyone to bring them back in.';
    } else if (atCapacity()) {
      status.textContent = `The office is full at ${MAX_IN_ROOM}. Take someone out to swap another in.`;
    } else {
      status.textContent = `${selection.length} of ${agentState.length} agents are in the office.`;
    }
  }

  function drawCard(agent, canvas) {
    // The room's renderer, on the room's own look for this agent, so the roster
    // shows the character the office actually draws — saved customization and
    // all — rather than a second idea of what they look like.
    drawPixelAgent(canvas, getAgentLook(agent), agent);
  }

  function renderGrid() {
    const grid = document.getElementById('roster-selector-grid');
    grid.innerHTML = agentState.map((agent) => {
      const selected = isSelected(agent.id);
      const locked = !selected && selection !== null && atCapacity();
      const classes = ['roster-card'];
      if (selected) classes.push('selected');
      if (isInRoom(agent.id)) classes.push('in-room');
      if (locked) classes.push('locked');
      return `
        <button type="button" class="${classes.join(' ')}" data-agent-id="${escapeHtml(agent.id)}"
          role="checkbox" aria-checked="${selected}" ${locked ? 'aria-disabled="true"' : ''}>
          <span class="roster-card-figure">
            <span class="roster-card-shadow" aria-hidden="true"></span>
            <canvas class="roster-card-pixel" width="78" height="108" aria-hidden="true"></canvas>
          </span>
          <span class="roster-card-name">
            <span class="roster-card-dot" style="--dot:${escapeHtml(agent.color)}" aria-hidden="true"></span>
            ${escapeHtml(agent.name)}
          </span>
          <span class="roster-card-role" style="--role:${escapeHtml(agent.color)}">${escapeHtml(agent.role)}</span>
          <span class="roster-card-check" aria-hidden="true">✓</span>
        </button>`;
    }).join('');

    grid.querySelectorAll('.roster-card').forEach((card) => {
      const agent = agentState.find((entry) => entry.id === card.dataset.agentId);
      if (agent) drawCard(agent, card.querySelector('.roster-card-pixel'));
    });
  }

  function render() {
    renderCounts();
    renderStatus();
    renderGrid();
  }

  function applyToRoom() {
    persist();
    renderAgents();
  }

  function toggle(id) {
    if (selection === null) {
      // The first pick turns "everyone" into a chosen roster, starting from
      // that one agent rather than from all eleven — eleven would be over the
      // cap the moment it was written down.
      selection = [id];
    } else if (selection.includes(id)) {
      selection = selection.filter((entry) => entry !== id);
    } else {
      if (atCapacity()) {
        const status = document.getElementById('roster-selector-status');
        status.textContent = `The office holds ${MAX_IN_ROOM}. Take someone out before adding another.`;
        return;
      }
      selection = selection.concat(id);
    }
    applyToRoom();
    render();
  }

  function handleCardClick(event) {
    const card = event.target.closest('.roster-card[data-agent-id]');
    if (!card) return;
    toggle(card.dataset.agentId);
  }

  function showEveryone() {
    selection = null;
    applyToRoom();
    render();
  }

  function emptyTheRoom() {
    selection = [];
    applyToRoom();
    render();
  }

  function open() {
    lastFocus = document.activeElement;
    selection = readSelection();
    panel.hidden = false;
    document.body.classList.add('roster-selector-open');
    requestAnimationFrame(() => panel.classList.add('open'));
    render();
    panel.querySelector('.roster-selector-close').focus();
  }

  function close() {
    panel.classList.remove('open');
    document.body.classList.remove('roster-selector-open');
    window.setTimeout(() => { panel.hidden = true; }, 160);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) close();
  });

  // The composited characters load their sprite sheets asynchronously. The
  // first paint of a card can land before they are ready, so repaint once they
  // are rather than leaving the panel on the fallback art.
  if (window.AgentAvatars && typeof window.AgentAvatars.ready === 'function') {
    window.AgentAvatars.ready().then(() => { if (!panel.hidden) renderGrid(); }).catch(() => { /* keep the sprites */ });
  }

  window.AORoomRoster = {
    open,
    close,
    // renderAgents() asks this on every repaint. null means no choice has been
    // made, and the whole roster stands in the room.
    selectedIds: () => (selection === null ? null : selection.slice()),
    max: MAX_IN_ROOM,
  };

  // The office renders once on load, before this file has read the saved
  // choice. Repaint so a saved roster is in force from the first frame.
  if (selection !== null) renderAgents();
})();
