(function () {
  'use strict';

  const STORAGE_KEY = 'agent-office-avatar-looks-v1';
  const CATEGORY_LABELS = { face: 'Face', hair: 'Hair', outfit: 'Clothes', accessory: 'Extras' };
  const avatars = window.AgentAvatars;
  const officeSvg = document.getElementById('officesvg');
  const office = officeSvg ? officeSvg.parentElement : null;
  if (!avatars || !office || typeof agentState === 'undefined') return;

  let savedLooks = readSavedLooks();
  let selectedAgent = null;
  let selectedCategory = 'face';
  let draftLook = null;
  let previewUsesCustomizer = false;
  let lastFocus = null;

  function readSavedLooks() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function persistSavedLooks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLooks));
  }

  function findAgent(id) {
    return agentState.find((agent) => agent.id === id) || null;
  }

  function applySavedLooks() {
    agentState.forEach((agent) => {
      if (!savedLooks[agent.id] || !avatars.DEFAULT_LOOKS[agent.id]) return;
      agent.lookState = {
        ...agent.lookState,
        avatar: { ...avatars.DEFAULT_LOOKS[agent.id], ...savedLooks[agent.id] },
      };
      syncAgentElement(agent);
    });
  }

  function createEditor() {
    const shell = document.createElement('div');
    shell.id = 'office-avatar-editor';
    shell.className = 'office-avatar-editor';
    shell.hidden = true;
    shell.innerHTML = `
      <button class="avatar-editor-backdrop" type="button" aria-label="Close character editor"></button>
      <section class="avatar-editor-sheet" role="dialog" aria-modal="true" aria-labelledby="avatar-editor-title">
        <header class="avatar-editor-header">
          <div>
            <p>Character editor</p>
            <h2 id="avatar-editor-title">Agent</h2>
            <span id="avatar-editor-role"></span>
          </div>
          <button class="avatar-editor-close" type="button" aria-label="Close character editor">&times;</button>
        </header>
        <div class="avatar-editor-body">
          <div class="avatar-editor-preview" aria-label="Character preview">
            <div class="avatar-preview-grid"></div>
            <div class="avatar-preview-shadow"></div>
            <canvas id="office-avatar-preview" width="64" height="110"></canvas>
            <small>In-office sprite preview</small>
          </div>
          <div class="avatar-editor-controls">
            <nav id="avatar-editor-tabs" class="avatar-editor-tabs" aria-label="Appearance category"></nav>
            <div id="avatar-editor-options" class="avatar-editor-options"></div>
          </div>
        </div>
        <footer class="avatar-editor-footer">
          <p id="avatar-editor-status" aria-live="polite">Choose a look, then save it.</p>
          <div>
            <button type="button" class="avatar-editor-reset">Reset original</button>
            <button type="button" class="avatar-editor-cancel">Cancel</button>
            <button type="button" class="avatar-editor-save">Save look</button>
          </div>
        </footer>
      </section>`;
    document.body.appendChild(shell);

    shell.querySelector('.avatar-editor-backdrop').addEventListener('click', closeEditor);
    shell.querySelector('.avatar-editor-close').addEventListener('click', closeEditor);
    shell.querySelector('.avatar-editor-cancel').addEventListener('click', closeEditor);
    shell.querySelector('.avatar-editor-reset').addEventListener('click', resetOriginal);
    shell.querySelector('.avatar-editor-save').addEventListener('click', saveLook);
    shell.querySelector('.avatar-editor-tabs').addEventListener('click', handleTabClick);
    shell.querySelector('.avatar-editor-options').addEventListener('click', handleOptionClick);
    return shell;
  }

  const editor = createEditor();

  function setStatus(message, saved) {
    const status = document.getElementById('avatar-editor-status');
    status.textContent = message;
    status.classList.toggle('saved', Boolean(saved));
  }

  function drawPreview() {
    if (!selectedAgent || !draftLook) return;
    const canvas = document.getElementById('office-avatar-preview');
    if (previewUsesCustomizer) {
      avatars.ready().then(() => avatars.drawAvatar(canvas, draftLook)).catch(() => {
        setStatus('The character art could not load. Try again.', false);
      });
      return;
    }
    drawPixelAgent(canvas, getAgentLook(selectedAgent), selectedAgent);
  }

  function choiceButtons(key, choices) {
    return `<div class="avatar-choice-grid">${choices.map((choice) => `
      <button type="button" class="avatar-choice${draftLook[key] === choice.value ? ' selected' : ''}"
        data-look-key="${key}" data-look-value="${choice.value}" aria-pressed="${draftLook[key] === choice.value}">
        <span>${choice.icon}</span><strong>${choice.label}</strong>
      </button>`).join('')}</div>`;
  }

  function swatches(key, colors, label) {
    return `<div class="avatar-control-group"><div class="avatar-control-label">${label}</div>
      <div class="avatar-swatch-row">${colors.map((color) => `
        <button type="button" class="avatar-swatch${draftLook[key] === color ? ' selected' : ''}"
          data-look-key="${key}" data-look-value="${color}" style="--swatch:${color}"
          aria-label="Choose ${label.toLowerCase()} ${color}" aria-pressed="${draftLook[key] === color}"></button>`).join('')}</div></div>`;
  }

  function renderTabs() {
    const tabs = document.getElementById('avatar-editor-tabs');
    tabs.innerHTML = Object.entries(CATEGORY_LABELS).map(([key, label]) => `
      <button type="button" data-category="${key}" class="${selectedCategory === key ? 'active' : ''}"
        aria-pressed="${selectedCategory === key}">${label}</button>`).join('');
  }

  function renderOptions() {
    const options = document.getElementById('avatar-editor-options');
    if (selectedCategory === 'face') {
      options.innerHTML = `<div class="avatar-control-group"><div class="avatar-control-label">Expression</div>${choiceButtons('face', avatars.CHOICES.face)}</div>${swatches('skin', avatars.SKINS, 'Skin tone')}`;
    } else if (selectedCategory === 'hair') {
      options.innerHTML = `<div class="avatar-control-group"><div class="avatar-control-label">Hair style</div>${choiceButtons('hair', avatars.CHOICES.hair)}</div>${swatches('hairColor', avatars.HAIR_COLORS, 'Hair color')}`;
    } else if (selectedCategory === 'outfit') {
      options.innerHTML = `<div class="avatar-control-group"><div class="avatar-control-label">Clothing</div>${choiceButtons('outfit', avatars.CHOICES.outfit)}</div>${swatches('outfitColor', avatars.OUTFIT_COLORS, 'Clothing color')}`;
    } else {
      options.innerHTML = `<div class="avatar-control-group"><div class="avatar-control-label">Accessory</div>${choiceButtons('accessory', avatars.CHOICES.accessory)}</div>`;
    }
  }

  function renderEditor() {
    document.getElementById('avatar-editor-title').textContent = selectedAgent.name;
    document.getElementById('avatar-editor-role').textContent = selectedAgent.role;
    renderTabs();
    renderOptions();
    drawPreview();
  }

  function openEditor(agentId) {
    const agent = findAgent(agentId);
    if (!agent || !avatars.DEFAULT_LOOKS[agentId]) return;
    selectedAgent = agent;
    selectedCategory = 'face';
    draftLook = { ...avatars.DEFAULT_LOOKS[agentId], ...(savedLooks[agentId] || {}) };
    previewUsesCustomizer = Boolean(savedLooks[agentId]);
    lastFocus = document.activeElement;
    editor.hidden = false;
    document.body.classList.add('avatar-customizer-open');
    requestAnimationFrame(() => editor.classList.add('open'));
    setStatus(savedLooks[agentId] ? 'This look is saved on this device.' : 'Current original sprite. Choose an option to customize it.', Boolean(savedLooks[agentId]));
    renderEditor();
    editor.querySelector('.avatar-editor-close').focus();
  }

  function closeEditor() {
    editor.classList.remove('open');
    document.body.classList.remove('avatar-customizer-open');
    window.setTimeout(() => { editor.hidden = true; }, 160);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function handleTabClick(event) {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    selectedCategory = button.dataset.category;
    renderTabs();
    renderOptions();
  }

  function handleOptionClick(event) {
    const button = event.target.closest('[data-look-key]');
    if (!button || !draftLook) return;
    draftLook[button.dataset.lookKey] = button.dataset.lookValue;
    previewUsesCustomizer = true;
    setStatus(`${selectedAgent.name}'s new look is ready to save.`, false);
    renderOptions();
    drawPreview();
  }

  function saveLook() {
    if (!selectedAgent || !draftLook) return;
    savedLooks[selectedAgent.id] = { ...draftLook };
    persistSavedLooks();
    selectedAgent.lookState = { ...selectedAgent.lookState, avatar: { ...draftLook } };
    avatars.ready().then(() => {
      syncAgentElement(selectedAgent);
      setStatus(`${selectedAgent.name}'s look is saved on this device.`, true);
    }).catch(() => setStatus('The character art could not load. Try again.', false));
  }

  function resetOriginal() {
    if (!selectedAgent) return;
    delete savedLooks[selectedAgent.id];
    persistSavedLooks();
    if (selectedAgent.lookState) delete selectedAgent.lookState.avatar;
    draftLook = { ...avatars.DEFAULT_LOOKS[selectedAgent.id] };
    previewUsesCustomizer = false;
    syncAgentElement(selectedAgent);
    setStatus(`${selectedAgent.name} is back to the original sprite.`, true);
    renderOptions();
    drawPreview();
  }

  // Character boxes overlap in an isometric room, especially on a phone. Let
  // taps land on the room and inspect the actual canvas pixel under the finger;
  // transparent parts of a nearer character can no longer steal the tap from a
  // visible character behind it.
  function characterAtPoint(clientX, clientY) {
    const hits = [];
    document.querySelectorAll('.agent-char[data-agent-id]').forEach((character) => {
      const canvas = character.querySelector('.agent-pixel');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;
      const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((clientX - rect.left) * canvas.width / rect.width)));
      const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((clientY - rect.top) * canvas.height / rect.height)));
      let alpha = 0;
      try {
        const sampleX = Math.max(0, x - 2);
        const sampleY = Math.max(0, y - 2);
        const sample = canvas.getContext('2d').getImageData(
          sampleX,
          sampleY,
          Math.min(5, canvas.width - sampleX),
          Math.min(5, canvas.height - sampleY)
        ).data;
        for (let index = 3; index < sample.length; index += 4) alpha = Math.max(alpha, sample[index]);
      } catch (_) { alpha = 255; }
      if (alpha < 18) return;
      hits.push({
        character,
        z: Number.parseInt(getComputedStyle(character).zIndex, 10) || 0,
      });
    });
    hits.sort((a, b) => b.z - a.z);
    return hits.length ? hits[0].character : null;
  }

  function updateCharacterHover(event) {
    const hit = characterAtPoint(event.clientX, event.clientY);
    document.querySelectorAll('.agent-char.avatar-hover').forEach((character) => {
      character.classList.toggle('avatar-hover', character === hit);
    });
    if (hit) hit.classList.add('avatar-hover');
    office.style.cursor = hit ? 'pointer' : '';
  }

  office.addEventListener('click', (event) => {
    const character = characterAtPoint(event.clientX, event.clientY);
    if (character) openEditor(character.dataset.agentId);
  });

  office.addEventListener('mousemove', updateCharacterHover);
  office.addEventListener('mouseleave', () => {
    document.querySelectorAll('.agent-char.avatar-hover').forEach((character) => character.classList.remove('avatar-hover'));
    office.style.cursor = '';
  });

  office.addEventListener('keydown', (event) => {
    const character = event.target.closest('.agent-char[data-agent-id]');
    if (!character || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    openEditor(character.dataset.agentId);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !editor.hidden) closeEditor();
  });

  applySavedLooks();
  window.AOAvatarCustomizer = { open: openEditor, close: closeEditor };
})();
