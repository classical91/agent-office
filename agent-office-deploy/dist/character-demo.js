(function () {
  'use strict';

  const SPRITE_BUFFER_W = 78;
  const SPRITE_BUFFER_H = 108;
  const AGENT_FOOT_OFFSET_PX = 8;
  const ROOM = { x: 206, y: 186, w: 786, h: 497, ox: 550, oy: 295, hw: 36, hh: 18, gridW: 12, gridH: 9 };

  const characters = [
    {
      id: 'oss', asset: 'penny', name: 'Penny', role: 'Orchestrator / team lead', color: '#f59e0b',
      station: { gx: 5, gy: 1 }, cue: 'Navy command jacket · amber trim · earpiece + tablet',
    },
    {
      id: 'webclaw', asset: 'webclaw', name: 'WebClaw', role: 'Web agency specialist', color: '#3b82f6',
      station: { gx: 1, gy: 4 }, cue: 'Cobalt hoodie · charcoal layers · glasses + code mark',
    },
    {
      id: 'nutrimind', asset: 'nutrimind', name: 'NutriMind', role: 'Nutrition app specialist', color: '#22c55e',
      station: { gx: 8, gy: 5 }, cue: 'Fresh green overshirt · neutral base · leaf pin',
    },
    {
      id: 'pc', asset: 'pc', name: 'PC', role: 'Windows workstation specialist', color: '#10b981',
      station: { gx: 10, gy: 5 }, cue: 'Emerald utility jacket · cool gray panels · support headset',
    },
    {
      id: 'studioclaw', asset: 'studioclaw', name: 'StudioClaw', role: 'Studio director', color: '#8b5cf6',
      station: { gx: 7, gy: 5 }, cue: 'Violet director jacket · magenta detail · monitor headset',
    },
  ];

  let officeMode = 'proposed';
  let officeReady = false;

  function paintImage(canvas, source) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / image.width, canvas.height / image.height, 1);
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      const x = Math.round((canvas.width - width) / 2);
      context.imageSmoothingEnabled = false;
      context.drawImage(image, x, canvas.height - height, width, height);
    };
    image.src = source;
  }

  function paintCurrentFallback(canvas, character) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = false;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(canvas.width / 26, 0, 0, canvas.height / 36, 0, 0);
    const box = (x, y, width, height, color) => {
      context.fillStyle = color;
      context.fillRect(x, y, width, height);
    };
    box(8, 2, 10, 10, '#d9ab89');
    box(6, 12, 14, 10, character.color);
    box(8, 22, 5, 8, '#1f2937');
    box(13, 22, 5, 8, '#1f2937');
    box(5, 2, 16, 5, '#334155');
  }

  function paintCharacter(canvas, character, mode) {
    if (mode === 'current' && character.id === 'studioclaw') {
      paintCurrentFallback(canvas, character);
      return;
    }
    const prefix = mode === 'current' ? 'current-' : '';
    paintImage(canvas, `assets/character-demo/${prefix}${character.asset}.png`);
  }

  function avatarMarkup(extraClass = '') {
    return `
      <div class="agent-avatar ${extraClass}">
        <div class="agent-shadow"></div>
        <canvas class="agent-pixel" width="${SPRITE_BUFFER_W}" height="${SPRITE_BUFFER_H}"></canvas>
      </div>`;
  }

  function renderComparison() {
    const strip = document.getElementById('comparison-strip');
    strip.innerHTML = characters.map((character) => `
      <article class="character-comparison" style="--role-color:${character.color}">
        <h3 class="character-name">${character.name}</h3>
        <p class="character-role">${character.role}</p>
        <div class="sprite-pair">
          <figure>
            <div class="actual-avatar" data-character="${character.id}" data-mode="current">${avatarMarkup()}</div>
            <figcaption>Current</figcaption>
          </figure>
          <figure>
            <div class="actual-avatar" data-character="${character.id}" data-mode="proposed">${avatarMarkup()}</div>
            <figcaption>Proposed</figcaption>
          </figure>
        </div>
        <p class="character-cue">${character.cue}</p>
      </article>`).join('');

    strip.querySelectorAll('.actual-avatar').forEach((element) => {
      const character = characters.find((item) => item.id === element.dataset.character);
      paintCharacter(element.querySelector('canvas'), character, element.dataset.mode);
    });
  }

  function projection(character, width) {
    const scale = width / ROOM.w;
    const tileWidth = 2 * ROOM.hw * scale;
    const tileHeight = 2 * ROOM.hh * scale;
    const originX = (ROOM.ox - ROOM.x) * scale;
    const originY = (ROOM.oy + ROOM.hh - ROOM.y) * scale;
    const x = originX + (character.station.gx - character.station.gy) * tileWidth / 2;
    const y = originY + (character.station.gx + character.station.gy) * tileHeight / 2 + AGENT_FOOT_OFFSET_PX * scale;
    const depth = (character.station.gx + character.station.gy) / (ROOM.gridW + ROOM.gridH);
    return { x, y, scale, z: 100 + Math.round(depth * 100) };
  }

  function renderOfficeCharacters() {
    if (!officeReady) return;
    const office = document.getElementById('demo-office');
    office.querySelectorAll('.agent-char').forEach((element) => element.remove());
    const width = office.getBoundingClientRect().width;

    characters.forEach((character, index) => {
      const point = projection(character, width);
      const element = document.createElement('div');
      element.className = 'agent-char';
      element.style.left = `${point.x}px`;
      element.style.top = `${point.y}px`;
      element.style.setProperty('--agent-scale', point.scale.toFixed(3));
      element.style.setProperty('--agent-z', String(point.z));
      element.style.animationDelay = `${70 + index * 55}ms`;
      element.innerHTML = `
        <div class="agent-label">
          <span class="agent-status-dot" style="background:#22c55e"></span>
          <div class="agent-label-text"><strong>${character.name}</strong></div>
        </div>
        ${avatarMarkup('motion-monitoring')}`;
      office.appendChild(element);
      paintCharacter(element.querySelector('canvas'), character, officeMode);
    });

    document.getElementById('scale-readout').textContent = `Room scale ${projection(characters[0], width).scale.toFixed(2)}×`;
  }

  async function loadOfficeCopy() {
    const office = document.getElementById('demo-office');
    try {
      const response = await fetch('/', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Office request returned ${response.status}`);
      const documentCopy = new DOMParser().parseFromString(await response.text(), 'text/html');
      const sourceSvg = documentCopy.getElementById('officesvg');
      if (!sourceSvg) throw new Error('Existing office SVG was not found');
      const svg = sourceSvg.cloneNode(true);
      svg.id = 'character-demo-office-svg';
      svg.removeAttribute('width');
      svg.setAttribute('aria-hidden', 'true');
      office.replaceChildren(svg);
      officeReady = true;
      renderOfficeCharacters();
    } catch (error) {
      office.innerHTML = `<p class="office-loading">Could not load the office copy: ${error.message}</p>`;
    }
  }

  function wireControls() {
    document.querySelectorAll('.view-toggle button').forEach((button) => {
      button.addEventListener('click', () => {
        officeMode = button.dataset.mode;
        document.querySelectorAll('.view-toggle button').forEach((candidate) => {
          const selected = candidate === button;
          candidate.classList.toggle('active', selected);
          candidate.setAttribute('aria-pressed', String(selected));
        });
        renderOfficeCharacters();
      });
    });

    const observer = new ResizeObserver(() => renderOfficeCharacters());
    observer.observe(document.getElementById('demo-office'));
  }

  renderComparison();
  wireControls();
  loadOfficeCopy();
})();
