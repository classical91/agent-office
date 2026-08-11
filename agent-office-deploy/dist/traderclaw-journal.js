'use strict';

(function () {
  const state = { payload: null };
  const esc = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const text = value => value === undefined || value === null || value === '' ? '—' : String(value);
  const metric = (label, value) => `<div class="ao-card journal-metric"><span class="ao-muted">${esc(label)}</span><strong>${esc(value)}</strong></div>`;

  function renderMetrics(payload) {
    const entries = payload.entries || [];
    const latest = entries[0] ? new Date(entries[0].timestamp_utc).toLocaleString() : 'No entries';
    document.getElementById('journal-metrics').innerHTML = [
      metric('Synced entries', payload.counts?.entries || 0),
      metric('Validated candidates', payload.counts?.validated || 0),
      metric('Rejected / failed', payload.counts?.rejected || 0),
      metric('Latest record', latest),
    ].join('');
    document.getElementById('journal-sync').textContent = payload.synced_at ? `Last synced ${new Date(payload.synced_at).toLocaleString()}` : 'Waiting for first local sync';
  }

  function entryCard(entry) {
    const lesson = entry.lesson || {};
    const gate = entry.promotion_gate || {};
    const result = entry.result || {};
    return `<article class="ao-card journal-entry">
      <div class="journal-entry-head"><div class="journal-entry-title">${esc(text(entry.asset))} ${esc(text(entry.direction))} · ${esc(text(entry.strategy?.name))} ${esc(text(entry.strategy?.version))}</div><time>${esc(new Date(entry.timestamp_utc).toLocaleString())}</time></div>
      <div class="journal-tags"><span class="journal-tag">${esc(text(entry.record_type))}</span><span class="journal-tag">${esc(text(entry.timeframe))}</span><span class="journal-tag">${esc(text(entry.regime))}</span><span class="journal-tag">Gate: ${esc(text(gate.status))}</span></div>
      <div class="journal-grid"><div class="journal-detail"><b>Result</b>${esc(text(result.status))} · ${esc(text(result.r_multiple))}R<br>Expectancy ${esc(text(result.expectancy_r))} · PF ${esc(text(result.profit_factor))}</div><div class="journal-detail"><b>Evidence lesson</b>${esc(text(lesson.evidence_based_lesson))}</div><div class="journal-detail"><b>Promotion gate</b>${esc(text(gate.reason))}<br>Sample ${esc(text(gate.sample_size))} · OOS ${esc(text(gate.out_of_sample))} · WF ${esc(text(gate.walk_forward))}</div></div>
    </article>`;
  }

  function renderEntries() {
    const query = document.getElementById('journal-search').value.trim().toLowerCase();
    const type = document.getElementById('journal-type').value;
    const entries = (state.payload?.entries || []).filter(entry => {
      if (type && entry.record_type !== type) return false;
      if (!query) return true;
      return JSON.stringify(entry).toLowerCase().includes(query);
    });
    document.getElementById('journal-list').innerHTML = entries.length ? entries.map(entryCard).join('') : '<div class="ao-card journal-empty">No journal records match this view.</div>';
  }

  function renderSummaries() {
    const summaries = state.payload?.weekly_summaries || [];
    document.getElementById('journal-summaries').innerHTML = summaries.length ? summaries.map(item => `<section class="ao-card journal-summary"><strong>${esc(item.name)}</strong><div class="ao-muted">${esc(item.updated_at || '')}</div><p>${esc(item.content)}</p></section>`).join('') : '<div class="ao-card journal-empty">No weekly summaries yet.</div>';
  }

  async function load() {
    const response = await fetch('/api/traderclaw-journal', { credentials: 'same-origin' });
    if (response.status === 401) {
      document.getElementById('journal-list').innerHTML = '<div class="ao-card journal-empty">Unlock Agent Office to view TraderClaw’s journal.</div>';
      return;
    }
    if (!response.ok) throw new Error(`Journal request failed (${response.status})`);
    state.payload = await response.json();
    renderMetrics(state.payload); renderEntries(); renderSummaries();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('journal-search').addEventListener('input', renderEntries);
    document.getElementById('journal-type').addEventListener('change', renderEntries);
    load().catch(error => { document.getElementById('journal-list').innerHTML = `<div class="ao-card journal-empty">${esc(error.message)}</div>`; });
  });
})();
