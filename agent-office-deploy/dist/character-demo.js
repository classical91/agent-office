(function () {
  'use strict';

  const STORAGE_KEY = 'agent-office-avatar-drafts-v1';
  const ROOM = { x: 206, y: 186, w: 786, h: 497, ox: 550, oy: 295, hw: 36, hh: 18, gridW: 12, gridH: 9 };
  const FOOT_OFFSET = 8;

  const SKINS = ['#f6d0b1', '#dfad83', '#bd7e56', '#8a5238', '#563323'];
  const HAIR_COLORS = ['#17191f', '#3a241b', '#714229', '#b96d33', '#d7b066', '#7857a8'];
  const OUTFIT_COLORS = ['#172554', '#2563eb', '#0f766e', '#16803a', '#7c3aed', '#be185d', '#343948', '#e7e7e2'];

  const CHOICES = {
    face: [
      { value: 'friendly', label: 'Friendly', icon: '☺' },
      { value: 'focused', label: 'Focused', icon: '⌁' },
      { value: 'bright', label: 'Bright', icon: '◉' },
      { value: 'stoic', label: 'Stoic', icon: '—' },
    ],
    hair: [
      { value: 'crop', label: 'Crop', icon: '▰' },
      { value: 'swept', label: 'Swept', icon: '◢' },
      { value: 'curls', label: 'Curls', icon: '●' },
      { value: 'bob', label: 'Bob', icon: '◒' },
      { value: 'buzz', label: 'Buzz', icon: '▱' },
      { value: 'bald', label: 'Bald', icon: '○' },
    ],
    outfit: [
      { value: 'lead', label: 'Lead jacket', icon: '◆' },
      { value: 'hoodie', label: 'Hoodie', icon: '⌂' },
      { value: 'overshirt', label: 'Overshirt', icon: '║' },
      { value: 'utility', label: 'Utility', icon: '▦' },
      { value: 'director', label: 'Director', icon: '◇' },
    ],
    accessory: [
      { value: 'none', label: 'None', icon: '×' },
      { value: 'glasses', label: 'Glasses', icon: '▭' },
      { value: 'headset', label: 'Headset', icon: '◖' },
      { value: 'earpiece', label: 'Earpiece', icon: '·)' },
      { value: 'cap', label: 'Cap', icon: '⌒' },
      { value: 'pin', label: 'Role pin', icon: '✦' },
    ],
  };

  const agents = [
    {
      id: 'oss', name: 'Penny', shortRole: 'Team lead', role: 'Orchestrator / team lead', color: '#f59e0b',
      station: { gx: 5, gy: 1 },
      defaults: { face: 'friendly', skin: '#dfad83', hair: 'crop', hairColor: '#3a241b', outfit: 'lead', outfitColor: '#172554', accessory: 'earpiece' },
    },
    {
      id: 'webclaw', name: 'WebClaw', shortRole: 'Web agency', role: 'Web agency specialist', color: '#3b82f6',
      station: { gx: 1, gy: 4 },
      defaults: { face: 'focused', skin: '#f6d0b1', hair: 'swept', hairColor: '#17191f', outfit: 'hoodie', outfitColor: '#2563eb', accessory: 'glasses' },
    },
    {
      id: 'nutrimind', name: 'NutriMind', shortRole: 'Nutrition app', role: 'Nutrition app specialist', color: '#22c55e',
      station: { gx: 8, gy: 5 },
      defaults: { face: 'bright', skin: '#8a5238', hair: 'curls', hairColor: '#3a241b', outfit: 'overshirt', outfitColor: '#16803a', accessory: 'pin' },
    },
    {
      id: 'pc', name: 'PC', shortRole: 'Windows', role: 'Windows workstation specialist', color: '#10b981',
      station: { gx: 10, gy: 5 },
      defaults: { face: 'stoic', skin: '#bd7e56', hair: 'buzz', hairColor: '#17191f', outfit: 'utility', outfitColor: '#0f766e', accessory: 'headset' },
    },
    {
      id: 'studioclaw', name: 'StudioClaw', shortRole: 'Studio director', role: 'Studio director', color: '#8b5cf6',
      station: { gx: 7, gy: 1 },
      defaults: { face: 'friendly', skin: '#f6d0b1', hair: 'bob', hairColor: '#17191f', outfit: 'director', outfitColor: '#7c3aed', accessory: 'glasses' },
    },
  ];

  let selectedId = agents[0].id;
  let selectedCategory = 'face';
  let officeReady = false;
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

  function shade(hex, amount) {
    const raw = String(hex).replace('#', '');
    const value = parseInt(raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw, 16);
    const channel = (shift) => Math.max(0, Math.min(255, ((value >> shift) & 255) + Math.round(255 * amount)));
    return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
  }

  function drawAvatar(canvas, look) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.scale(canvas.width / 32, canvas.height / 55);

    const ink = '#12141b';
    const skin = look.skin;
    const skinDark = shade(skin, -0.13);
    const hair = look.hairColor;
    const hairLight = shade(hair, 0.12);
    const cloth = look.outfitColor;
    const clothDark = shade(cloth, -0.18);
    const clothLight = shade(cloth, 0.12);
    const pants = look.outfit === 'director' ? '#171923' : '#252b3a';
    const shoe = look.outfit === 'overshirt' ? '#e9ede7' : '#12151e';
    const box = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
    const pixel = (x, y, color) => box(x, y, 1, 1, color);

    // Legs and shoes.
    box(9, 38, 7, 13, ink); box(17, 38, 7, 13, ink);
    box(10, 39, 5, 10, pants); box(18, 39, 5, 10, pants);
    box(10, 39, 5, 2, shade(pants, 0.08)); box(18, 39, 5, 2, shade(pants, 0.08));
    box(8, 48, 8, 5, ink); box(17, 48, 8, 5, ink);
    box(9, 49, 7, 3, shoe); box(18, 49, 6, 3, shoe);
    box(10, 49, 5, 1, shade(shoe, 0.15)); box(19, 49, 4, 1, shade(shoe, 0.15));

    // Arms, hands, and body silhouette.
    box(5, 25, 5, 15, ink); box(23, 25, 5, 15, ink);
    box(6, 27, 3, 11, clothDark); box(24, 27, 3, 11, clothDark);
    box(6, 37, 4, 5, ink); box(23, 37, 4, 5, ink);
    box(7, 38, 3, 3, skin); box(23, 38, 3, 3, skin);
    box(8, 22, 17, 19, ink);
    box(9, 23, 15, 17, cloth);

    if (look.outfit === 'lead') {
      box(9, 23, 15, 3, clothLight);
      box(15, 23, 2, 17, '#d29b2e');
      box(11, 26, 4, 1, shade(cloth, 0.2));
      pixel(20, 27, '#e2b54f'); pixel(21, 27, '#e2b54f');
    } else if (look.outfit === 'hoodie') {
      box(10, 22, 13, 4, clothDark);
      box(13, 25, 7, 3, shade(cloth, -0.05));
      box(15, 28, 1, 7, '#e8edf8'); box(18, 28, 1, 7, '#e8edf8');
      box(12, 35, 10, 3, clothDark);
    } else if (look.outfit === 'overshirt') {
      box(9, 23, 15, 4, clothLight);
      box(15, 23, 3, 17, '#f0eee8');
      box(10, 30, 4, 3, clothDark); box(19, 30, 4, 3, clothDark);
      pixel(16, 28, '#7ebd56'); pixel(16, 31, '#7ebd56');
    } else if (look.outfit === 'utility') {
      box(9, 23, 15, 4, clothLight);
      box(15, 23, 2, 17, '#303746');
      box(10, 29, 5, 5, clothDark); box(18, 29, 5, 5, clothDark);
      box(11, 30, 3, 1, '#8ca1aa'); box(19, 30, 3, 1, '#8ca1aa');
    } else if (look.outfit === 'director') {
      box(9, 23, 15, 17, '#1b1c24');
      box(9, 23, 4, 17, cloth); box(21, 23, 3, 17, cloth);
      box(15, 23, 2, 17, clothLight);
      box(12, 26, 3, 1, '#ded8ef');
    }

    // Neck and ears.
    box(13, 19, 8, 7, ink); box(14, 19, 6, 6, skinDark);
    box(7, 10, 3, 8, ink); box(8, 11, 2, 6, skinDark);
    box(22, 10, 3, 8, ink); box(22, 11, 2, 6, skinDark);

    // Head with a stepped, Habbo-like silhouette.
    box(9, 5, 14, 16, ink); box(8, 8, 16, 10, ink); box(10, 4, 12, 18, ink);
    box(10, 6, 12, 14, skin); box(9, 9, 14, 8, skin); box(11, 5, 10, 16, skin);
    box(10, 17, 2, 2, skinDark); box(20, 17, 2, 2, skinDark);

    // Facial features.
    if (look.face === 'bright') {
      box(11, 11, 4, 3, '#f7fbff'); box(18, 11, 4, 3, '#f7fbff');
      pixel(13, 12, '#1a2430'); pixel(19, 12, '#1a2430');
      box(14, 17, 5, 1, '#7a3028'); pixel(13, 16, skinDark); pixel(19, 16, skinDark);
    } else if (look.face === 'focused') {
      box(11, 10, 4, 1, hair); box(18, 10, 4, 1, hair);
      box(12, 12, 2, 1, '#151820'); box(19, 12, 2, 1, '#151820');
      box(15, 17, 4, 1, '#71352e'); pixel(16, 14, skinDark);
    } else if (look.face === 'stoic') {
      box(11, 11, 4, 1, hair); box(18, 11, 4, 1, hair);
      pixel(13, 13, '#151820'); pixel(20, 13, '#151820');
      box(15, 17, 4, 1, '#5f302b'); pixel(16, 14, skinDark);
    } else {
      box(12, 12, 2, 2, '#f7fbff'); box(19, 12, 2, 2, '#f7fbff');
      pixel(13, 13, '#151820'); pixel(19, 13, '#151820');
      pixel(15, 17, '#7a3028'); box(16, 18, 3, 1, '#7a3028'); pixel(19, 17, '#7a3028');
    }

    // Hair sits above the face and changes the head silhouette.
    if (look.hair === 'crop') {
      box(9, 4, 14, 4, ink); box(10, 4, 12, 3, hair); box(9, 7, 4, 2, hair); box(20, 7, 3, 2, hair);
      box(12, 4, 6, 1, hairLight);
    } else if (look.hair === 'swept') {
      box(8, 4, 15, 5, ink); box(10, 3, 13, 4, ink);
      box(9, 5, 13, 3, hair); box(12, 4, 10, 2, hair); box(18, 3, 5, 2, hair);
      box(21, 7, 3, 5, hair); box(14, 4, 5, 1, hairLight);
    } else if (look.hair === 'curls') {
      [[9,5],[12,3],[16,3],[20,5],[8,8],[22,8]].forEach(([x,y], i) => {
        box(x - 1, y - 1, 5, 5, ink); box(x, y, 3, 3, i % 2 ? hairLight : hair);
      });
    } else if (look.hair === 'bob') {
      box(8, 4, 16, 6, ink); box(7, 8, 5, 14, ink); box(21, 8, 5, 14, ink);
      box(9, 5, 14, 4, hair); box(8, 9, 3, 12, hair); box(22, 9, 3, 12, hair);
      box(11, 5, 7, 1, hairLight);
    } else if (look.hair === 'buzz') {
      box(9, 4, 14, 5, ink); box(10, 5, 12, 3, hair); box(11, 5, 7, 1, hairLight);
    } else {
      box(13, 5, 5, 1, shade(skin, 0.08));
    }

    // Accessories are a final independent layer.
    if (look.accessory === 'glasses') {
      box(10, 11, 6, 1, '#141823'); box(18, 11, 5, 1, '#141823'); box(15, 12, 4, 1, '#141823');
      box(10, 12, 1, 3, '#141823'); box(15, 12, 1, 3, '#141823'); box(18, 12, 1, 3, '#141823'); box(22, 12, 1, 3, '#141823');
    } else if (look.accessory === 'headset') {
      box(7, 8, 2, 10, '#171b28'); box(23, 8, 2, 10, '#171b28'); box(9, 4, 14, 2, '#252b3a');
      box(6, 12, 3, 6, clothLight); box(23, 12, 3, 6, clothLight);
      box(23, 18, 5, 1, '#252b3a'); pixel(27, 19, clothLight);
    } else if (look.accessory === 'earpiece') {
      box(23, 12, 2, 4, '#2a3344'); pixel(24, 13, '#7dd3fc'); box(24, 16, 3, 1, '#2a3344');
    } else if (look.accessory === 'cap') {
      box(8, 3, 16, 5, ink); box(9, 4, 14, 3, cloth); box(20, 7, 7, 2, ink); box(21, 7, 6, 1, clothLight);
    } else if (look.accessory === 'pin') {
      pixel(21, 27, '#d9f99d'); pixel(20, 28, '#86efac'); pixel(21, 28, '#4ade80');
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
    if (!officeReady) return;
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
        <div class="control-group"><div class="control-label">Face <span>${CHOICES.face.find((item) => item.value === look.face).label}</span></div>${choiceButtons('face', CHOICES.face)}</div>
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

  renderCategoryTabs();
  renderOptions();
  renderPreview();
  renderRoster();
  wireActions();
  loadOfficeCopy();
})();
