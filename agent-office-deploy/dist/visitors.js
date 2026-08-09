// Visitors — is anyone on the sites right now, what are they reading, and have
// they been before.
//
// This is the reading end of visit-tracker.js. The tracker posts a row per page
// view; this page groups those rows and shows them. It leans on app-shared.js
// for the Dropbox session (requestJson / ensureDropsSession), because the
// summary sits behind the same passphrase as everything else.
//
// The visitor "id" shown on a row is the first characters of a random string
// the browser made up about itself. It is here so the same visitor can be
// recognised twice in one list, and it is deliberately good for nothing else.

window.AOVisitors = (() => {
  const RANGES = [
    { days: 1,   label: 'Last 24 hours' },
    { days: 7,   label: 'Last 7 days' },
    { days: 30,  label: 'Last 30 days' },
    { days: 90,  label: 'Last 90 days' },
  ];
  const REFRESH_MS = 20000;

  const state = {
    days: 7,
    site: '',
    data: null,
    loaded: false,
    locked: false,
    initialized: false,
    autoRefresh: true,
    refreshing: false,
    timer: null,
  };

  // ─── Small helpers ─────────────────────────────────────────────────────

  function escHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function el(id) { return document.getElementById(id); }

  function num(value) { return Number(value || 0).toLocaleString(); }

  // "just now" reads better than a timestamp for something that is happening.
  function timeAgo(iso) {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '';
    const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (seconds < 45) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return days === 1 ? 'yesterday' : `${days}d ago`;
  }

  // The badge colour is derived from the id so the same visitor keeps the same
  // swatch down a list. It carries no meaning beyond that.
  function badgeColor(visitorId) {
    let hash = 0;
    for (let i = 0; i < visitorId.length; i += 1) {
      hash = (hash * 31 + visitorId.charCodeAt(i)) % 360;
    }
    return `hsl(${hash}, 58%, 48%)`;
  }

  function shortId(visitorId) {
    return String(visitorId || '').slice(0, 4).toUpperCase();
  }

  function pageLabel(visit) {
    if (visit.title) return visit.title;
    return visit.path || '/';
  }

  // ─── Rendering ─────────────────────────────────────────────────────────

  function renderSummary() {
    const box = el('visitors-summary');
    if (!box) return;
    const totals = (state.data && state.data.totals) || {};
    const live = totals.live || 0;

    box.innerHTML = `
      <div class="visitor-stat live">
        <div class="visitor-stat-value">
          <span class="live-dot${live ? '' : ' idle'}"></span>${num(live)}
        </div>
        <div class="visitor-stat-label">On the site now</div>
      </div>
      <div class="visitor-stat">
        <div class="visitor-stat-value">${num(totals.visitors)}</div>
        <div class="visitor-stat-label">Visitors</div>
      </div>
      <div class="visitor-stat">
        <div class="visitor-stat-value">${num(totals.sessions)}</div>
        <div class="visitor-stat-label">Sessions</div>
      </div>
      <div class="visitor-stat">
        <div class="visitor-stat-value">${num(totals.pageviews)}</div>
        <div class="visitor-stat-label">Page views</div>
      </div>
      <div class="visitor-stat">
        <div class="visitor-stat-value">${num(totals.new)}</div>
        <div class="visitor-stat-label">First time</div>
      </div>
      <div class="visitor-stat">
        <div class="visitor-stat-value">${num(totals.returning)}</div>
        <div class="visitor-stat-label">Been before</div>
      </div>
    `;
  }

  function visitorRow(visit, options = {}) {
    const bits = [];
    if (options.showSite && visit.site) bits.push(escHtml(visit.site));
    if (visit.title && visit.path) bits.push(`<code>${escHtml(visit.path)}</code>`);
    if (visit.device) bits.push(escHtml(visit.device));
    if (visit.referrer) bits.push(`from ${escHtml(visit.referrer)}`);
    if (options.showIp && visit.ip) bits.push(`<code>${escHtml(visit.ip)}</code>`);

    const tag = visit.is_returning
      ? '<span class="visitor-tag returning">Been before</span>'
      : '<span class="visitor-tag fresh">First time</span>';

    return `
      <div class="visitor-row">
        <div class="visitor-badge" style="background:${badgeColor(visit.visitor_id)};">${escHtml(shortId(visit.visitor_id))}</div>
        <div class="visitor-main">
          <div class="visitor-page">${escHtml(pageLabel(visit))}</div>
          <div class="visitor-meta">${tag}${bits.map(bit => `<span>${bit}</span>`).join('')}</div>
        </div>
        <div class="visitor-when">${escHtml(timeAgo(options.useCreated ? visit.created_at : visit.last_seen_at))}</div>
      </div>
    `;
  }

  function renderLive() {
    const box = el('visitors-live');
    const count = el('visitors-live-count');
    if (!box) return;
    const live = (state.data && state.data.live) || [];
    if (count) count.textContent = num(live.length);

    if (!live.length) {
      box.innerHTML = `<div class="visitors-empty">Nobody is on the sites right now.<br/>
        Anyone who opened a page in the last ${escHtml(String((state.data && state.data.live_window_minutes) || 5))} minutes shows up here.</div>`;
      return;
    }
    box.innerHTML = live.map(visit => visitorRow(visit, { showSite: true, showIp: true })).join('');
  }

  function renderRecent() {
    const box = el('visitors-recent');
    if (!box) return;
    const recent = (state.data && state.data.recent) || [];
    if (!recent.length) {
      box.innerHTML = '<div class="visitors-empty">No page views in this range yet.</div>';
      return;
    }
    box.innerHTML = recent.map(visit => visitorRow(visit, { showSite: true, showIp: true, useCreated: true })).join('');
  }

  function renderBars(boxId, rows, toLabel, emptyText) {
    const box = el(boxId);
    if (!box) return;
    if (!rows.length) {
      box.innerHTML = `<div class="visitors-empty">${escHtml(emptyText)}</div>`;
      return;
    }
    const top = rows[0].views || 1;
    box.innerHTML = rows.map(row => `
      <div class="visitors-bar-row">
        <div class="visitors-bar-fill" style="width:${Math.max(4, Math.round((row.views / top) * 100))}%;"></div>
        <div class="visitors-bar-content">
          <span class="visitors-bar-label">${escHtml(toLabel(row))}</span>
          <span class="visitors-bar-value">${num(row.views)} views · ${num(row.visitors)} visitors</span>
        </div>
      </div>
    `).join('');
  }

  function renderSiteFilter() {
    const select = el('visitors-site');
    if (!select) return;
    const sites = (state.data && state.data.all_sites) || [];
    const options = ['<option value="">All sites</option>']
      .concat(sites.map(site => `<option value="${escHtml(site)}"${site === state.site ? ' selected' : ''}>${escHtml(site)}</option>`));
    select.innerHTML = options.join('');
    select.value = state.site;
  }

  function renderRangeFilter() {
    const select = el('visitors-range');
    if (!select || select.options.length) return;
    select.innerHTML = RANGES
      .map(range => `<option value="${range.days}"${range.days === state.days ? ' selected' : ''}>${escHtml(range.label)}</option>`)
      .join('');
  }

  function renderSetup() {
    const box = el('visitors-snippet');
    if (!box) return;
    box.textContent = `<script src="${location.origin}/visit-tracker.js" defer><\/script>`;
  }

  function renderFooterNote() {
    const note = el('visitors-retention');
    if (!note || !state.data) return;
    note.textContent = `Page views are kept for ${state.data.retention_days} days and then deleted automatically.`;
  }

  function render() {
    const lockedBox = el('visitors-locked');
    const body = el('visitors-body');
    if (lockedBox) lockedBox.hidden = !state.locked;
    if (body) body.hidden = state.locked;

    renderRangeFilter();
    renderSetup();
    if (state.locked || !state.data) return;

    renderSummary();
    renderSiteFilter();
    renderLive();
    renderRecent();
    renderBars('visitors-pages', state.data.top_pages || [],
      row => `${row.site ? row.site : ''}${row.path}`, 'No pages yet.');
    renderBars('visitors-referrers', state.data.top_referrers || [],
      row => row.referrer, 'Nobody arrived from another site yet.');
    renderFooterNote();

    const truncated = el('visitors-truncated');
    if (truncated) truncated.hidden = !state.data.truncated;
  }

  // ─── Data ──────────────────────────────────────────────────────────────

  async function load() {
    const params = new URLSearchParams({ days: String(state.days) });
    if (state.site) params.set('site', state.site);
    try {
      state.data = await requestJson(`/api/visits/summary?${params}`);
      state.loaded = true;
      state.locked = false;
    } catch (error) {
      if (error.status === 401) {
        state.locked = true;
        state.loaded = false;
        state.data = null;
        return;
      }
      throw error;
    }
  }

  async function refresh(showSpinner = true) {
    if (state.refreshing) return;
    state.refreshing = true;
    const button = el('visitors-refresh');
    if (button && showSpinner) button.textContent = 'Refreshing…';
    try {
      await load();
      render();
    } catch (error) {
      const box = el('visitors-live');
      if (box) box.innerHTML = `<div class="visitors-empty">${escHtml(error.message || 'Could not load visitors.')}</div>`;
    } finally {
      state.refreshing = false;
      if (button) button.textContent = 'Refresh';
    }
  }

  async function unlock() {
    if (!(await ensureDropsSession(true))) return;
    await refresh();
  }

  // A dashboard nobody is looking at should not be asking for anything, so the
  // poll stops with the tab.
  function scheduleRefresh() {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(() => {
      if (!state.autoRefresh || state.locked) return;
      if (document.visibilityState !== 'visible') return;
      refresh(false);
    }, REFRESH_MS);
  }

  // ─── Actions ───────────────────────────────────────────────────────────

  function setRange(days) {
    state.days = Number(days) || 7;
    refresh();
  }

  function setSite(site) {
    state.site = String(site || '');
    refresh();
  }

  function toggleAutoRefresh() {
    state.autoRefresh = !state.autoRefresh;
    const button = el('visitors-auto');
    if (button) {
      button.classList.toggle('on', state.autoRefresh);
      button.textContent = state.autoRefresh ? 'Live: on' : 'Live: off';
    }
    if (state.autoRefresh) refresh(false);
  }

  async function copySnippet() {
    const box = el('visitors-snippet');
    const button = el('visitors-copy');
    if (!box) return;
    try {
      await navigator.clipboard.writeText(box.textContent);
      if (button) {
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = 'Copy'; }, 1500);
      }
    } catch (error) {
      // Clipboard access is refused often enough that selecting the text is a
      // real fallback rather than a courtesy.
      const range = document.createRange();
      range.selectNodeContents(box);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  async function clearAll() {
    if (!confirm('Delete every recorded page view? This cannot be undone.')) return;
    try {
      await requestJson('/api/visits', { method: 'DELETE' });
      await refresh();
    } catch (error) {
      if (error.status === 401) {
        state.locked = true;
        render();
        return;
      }
      alert(error.message || 'Could not clear the visits.');
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────────

  async function init() {
    if (state.initialized) {
      refresh(false);
      return;
    }
    state.initialized = true;
    render();

    try {
      await load();
    } catch (error) {
      state.loaded = true;
      const box = el('visitors-live');
      if (box) box.innerHTML = `<div class="visitors-empty">${escHtml(error.message || 'Could not load visitors.')}</div>`;
      return;
    }
    render();
    scheduleRefresh();
    if (state.locked) await unlock();
  }

  return { init, unlock, refresh, render, setRange, setSite, toggleAutoRefresh, copySnippet, clearAll };
})();

if (typeof VIEW_HANDLERS !== 'undefined') {
  VIEW_HANDLERS.visitors = { enter: () => window.AOVisitors.init() };
}
