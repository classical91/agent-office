(function () {
  'use strict';

  const STORAGE_KEY = 'agent-office-avatar-drafts-v2';
  const ROOM = { x: 206, y: 186, w: 786, h: 497, ox: 550, oy: 295, hw: 36, hh: 18, gridW: 12, gridH: 9 };
  const FOOT_OFFSET = 8;

  // Character art, the cast and the palettes all come from agent-avatars.js —
  // the same module the live office draws from — so a look approved here is the
  // look that ships rather than a lookalike that drifts.
  const { SKINS, HAIR_COLORS, OUTFIT_COLORS, CHOICES, ROSTER, drawAvatar } = window.AgentAvatars;
  const agents = ROSTER;

  let selectedId = agents[0].id;
  let selectedCategory = 'face';
  let officeReady = false;
  let assetsReady = false;
  let savedDrafts = readSavedDrafts();
  const looks = Object.fromEntries(agents.map((agent) => [agent.id, { ...agent.defaults, ...(savedDrafts[agent.id] || {}) }]));

  function readSavedDrafts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function currentAgent() { return agents.find((agent) => agent.id === selectedId); }

  function renderPreview() {
    drawAvatar(document.getElementById('avatar-preview'), looks[selectedId]);
    drawAvatar(document.getElementById('actual-preview'), looks[selectedId]);
    document.getElementById('editor-title').textContent = currentAgent().name;
    document.getElementById('editor-role').textContent = currentAgent().role;
  }

  function projection(agent, width) {
    const scale = width / ROOM.w;
    const tileWidth = 2 * ROOM.hw * scale;
    const tileHeight = 2 * ROOM.hh * scale;
    const originX = (ROOM.ox - ROOM.x) * scale;
    const originY = (ROOM.oy + ROOM.hh - ROOM.y) * scale;
    const x = originX + (agent.station.gx - agent.station.gy) * tileWidth / 2;
    const y = originY + (agent.station.gx + agent.station.gy) * tileHeight / 2 + FOOT_OFFSET * scale;
    const depth = (agent.station.gx + agent.station.gy) / (ROOM.gridW + ROOM.gridH);
    return { x, y, scale, z: 100 + Math.round(depth * 100) };
  }

  function renderOfficeAgents() {
    if (!officeReady || !assetsReady) return;
    const office = document.getElementById('customizer-office');
    office.querySelectorAll('.agent-char').forEach((element) => element.remove());
    const width = office.getBoundingClientRect().width;

    agents.forEach((agent, index) => {
      const point = projection(agent, width);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `agent-char${agent.id === selectedId ? ' selected' : ''}`;
      button.dataset.agent = agent.id;
      button.setAttribute('aria-label', `Customize ${agent.name}`);
      button.setAttribute('aria-pressed', String(agent.id === selectedId));
      button.style.left = `${point.x}px`;
      button.style.top = `${point.y}px`;
      button.style.setProperty('--agent-scale', point.scale.toFixed(3));
      button.style.setProperty('--agent-z', String(point.z));
      button.style.setProperty('--agent-color', agent.color);
      button.style.animationDelay = `${index * 45}ms`;
      button.innerHTML = '<span class="sprite-shadow"></span><canvas width="64" height="110"></canvas>';
      button.addEventListener('click', () => selectAgent(agent.id, true));
      office.appendChild(button);
      drawAvatar(button.querySelector('canvas'), looks[agent.id]);
    });

    document.getElementById('room-scale').textContent = `Room scale ${projection(agents[0], width).scale.toFixed(2)}×`;
  }

  function renderRoster() {
    const roster = document.getElementById('agent-roster');
    roster.innerHTML = agents.map((agent) => `
      <button type="button" class="roster-agent${agent.id === selectedId ? ' selected' : ''}"
        data-agent="${agent.id}" role="listitem" style="--agent-color:${agent.color}" aria-pressed="${agent.id === selectedId}">
        <canvas width="64" height="110" aria-hidden="true"></canvas>
        <span class="roster-copy"><strong>${agent.name}</strong><span>${agent.shortRole}</span></span>
      </button>`).join('');
    roster.querySelectorAll('.roster-agent').forEach((button) => {
      const agent = agents.find((candidate) => candidate.id === button.dataset.agent);
      drawAvatar(button.querySelector('canvas'), looks[agent.id]);
      button.addEventListener('click', () => selectAgent(agent.id, false));
    });
  }

  function renderCategoryTabs() {
    const tabs = document.getElementById('category-tabs');
    const labels = { face: 'Face', hair: 'Hair', outfit: 'Outfit', accessory: 'Extras' };
    tabs.innerHTML = Object.keys(labels).map((key) => `
      <button type="button" class="category-tab${selectedCategory === key ? ' active' : ''}"
        data-category="${key}" aria-pressed="${selectedCategory === key}">${labels[key]}</button>`).join('');
    tabs.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
      selectedCategory = button.dataset.category;
      renderCategoryTabs();
      renderOptions();
    }));
  }

  function choiceButtons(key, choices) {
    return `<div class="choice-grid">${choices.map((choice) => `
      <button type="button" class="choice-button${looks[selectedId][key] === choice.value ? ' selected' : ''}"
        data-look-key="${key}" data-look-value="${choice.value}">
        <span class="choice-icon">${choice.icon}</span><span>${choice.label}</span>
      </button>`).join('')}</div>`;
  }

  function swatches(key, colors) {
    return `<div class="swatch-row">${colors.map((color) => `
      <button type="button" class="swatch${looks[selectedId][key] === color ? ' selected' : ''}"
        data-look-key="${key}" data-look-value="${color}" style="--swatch:${color}" aria-label="Choose ${color}"></button>`).join('')}</div>`;
  }

  function renderOptions() {
    const look = looks[selectedId];
    const panel = document.getElementById('option-panel');
    const sections = {
      face: `
        <div class="control-group"><div class="control-label">Expression <span>${CHOICES.face.find((item) => item.value === look.face).label}</span></div>${choiceButtons('face', CHOICES.face)}</div>
        <div class="control-group"><div class="control-label">Skin tone</div>${swatches('skin', SKINS)}</div>`,
      hair: `
        <div class="control-group"><div class="control-label">Hair style <span>${CHOICES.hair.find((item) => item.value === look.hair).label}</span></div>${choiceButtons('hair', CHOICES.hair)}</div>
        <div class="control-group"><div class="control-label">Hair color</div>${swatches('hairColor', HAIR_COLORS)}</div>`,
      outfit: `
        <div class="control-group"><div class="control-label">Clothing <span>${CHOICES.outfit.find((item) => item.value === look.outfit).label}</span></div>${choiceButtons('outfit', CHOICES.outfit)}</div>
        <div class="control-group"><div class="control-label">Main color</div>${swatches('outfitColor', OUTFIT_COLORS)}</div>`,
      accessory: `
        <div class="control-group"><div class="control-label">Accessory <span>${CHOICES.accessory.find((item) => item.value === look.accessory).label}</span></div>${choiceButtons('accessory', CHOICES.accessory)}</div>`,
    };
    panel.innerHTML = sections[selectedCategory];
    panel.querySelectorAll('[data-look-key]').forEach((button) => button.addEventListener('click', () => {
      looks[selectedId][button.dataset.lookKey] = button.dataset.lookValue;
      markUnsaved();
      renderOptions();
      renderAllAvatars();
    }));
  }

  function renderAllAvatars() {
    renderPreview();
    renderOfficeAgents();
    renderRoster();
  }

  function selectAgent(id, scrollEditor) {
    selectedId = id;
    document.getElementById('office-title').textContent = `Editing ${currentAgent().name}`;
    renderPreview();
    renderOptions();
    renderOfficeAgents();
    renderRoster();
    if (scrollEditor && window.innerWidth <= 820) {
      document.querySelector('.avatar-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function markUnsaved() {
    const status = document.getElementById('save-status');
    status.className = 'save-status';
    status.textContent = `${currentAgent().name}'s look has unsaved changes.`;
  }

  function randomItem(items) { return items[Math.floor(Math.random() * items.length)]; }

  function randomizeCurrent() {
    looks[selectedId] = {
      face: randomItem(CHOICES.face).value,
      skin: randomItem(SKINS),
      hair: randomItem(CHOICES.hair).value,
      hairColor: randomItem(HAIR_COLORS),
      outfit: randomItem(CHOICES.outfit).value,
      outfitColor: randomItem(OUTFIT_COLORS),
      accessory: randomItem(CHOICES.accessory).value,
    };
    markUnsaved();
    renderOptions();
    renderAllAvatars();
  }

  function resetCurrent() {
    looks[selectedId] = { ...currentAgent().defaults };
    markUnsaved();
    renderOptions();
    renderAllAvatars();
  }

  function saveCurrent() {
    savedDrafts[selectedId] = { ...looks[selectedId] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedDrafts));
    const status = document.getElementById('save-status');
    status.className = 'save-status saved';
    status.textContent = `${currentAgent().name}'s draft look is saved in this browser. The live office is unchanged.`;
  }

  async function loadOfficeCopy() {
    const office = document.getElementById('customizer-office');
    try {
      const response = await fetch('/', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Office request returned ${response.status}`);
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      const source = page.getElementById('officesvg');
      if (!source) throw new Error('Existing office SVG was not found');
      const svg = source.cloneNode(true);
      svg.id = 'avatar-studio-office-svg';
      svg.removeAttribute('width');
      svg.setAttribute('aria-hidden', 'true');
      office.replaceChildren(svg);
      officeReady = true;
      renderOfficeAgents();
    } catch (error) {
      office.innerHTML = `<p class="office-loading">Could not load the office: ${error.message}</p>`;
    }
  }

  function wireActions() {
    document.getElementById('randomize-look').addEventListener('click', randomizeCurrent);
    document.getElementById('reset-look').addEventListener('click', resetCurrent);
    document.getElementById('save-look').addEventListener('click', saveCurrent);
    new ResizeObserver(() => renderOfficeAgents()).observe(document.getElementById('customizer-office'));
  }

  async function init() {
    renderCategoryTabs();
    renderOptions();
    renderRoster();
    wireActions();
    try {
      await Promise.all([window.AgentAvatars.ready(), loadOfficeCopy()]);
      assetsReady = true;
      renderAllAvatars();
    } catch (error) {
      document.getElementById('save-status').textContent = `Sprite assets could not load: ${error.message}`;
    }
  }

  init();
})();
