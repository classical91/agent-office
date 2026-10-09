// Mission Control's workflow view: what Penny/OpenClaw and ChatGPT deliver to
// Jason, when it is due, and whether it arrived.
//
// Everything drawn here comes from /api/workflows, which applies the rules in
// workflow-dashboard.js. This file only renders and submits. Every control is
// a dashboard record change: nothing here creates, enables, runs, deletes or
// reschedules an automation at OpenClaw or ChatGPT, and the labels say so.
(function () {
  'use strict';

  const W = window.WorkflowDashboard;
  // Each refresh re-renders, which also moves every "in 3h 12m" along.
  const REFRESH_MS = 60000;
  const UPCOMING_LIMIT = 8;
  const RESULTS_LIMIT = 8;

  const HEALTH = {
    delivered: { label: 'Delivered', tone: 'ok' },
    succeeded: { label: 'Ran · delivery unconfirmed', tone: 'ok' },
    running: { label: 'Running', tone: 'info' },
    failed: { label: 'Failed', tone: 'bad' },
    delivery_failed: { label: 'Delivery failed', tone: 'bad' },
    stale: { label: 'Stale data', tone: 'warn' },
    unknown: { label: 'No run history', tone: 'muted' },
    disabled: { label: 'Disabled', tone: 'muted' },
  };
  const EXECUTION_LABELS = { succeeded: 'Succeeded', failed: 'Failed', running: 'Running', skipped: 'Skipped', unknown: 'Unknown' };
  const DELIVERY_LABELS = { delivered: 'Delivered', failed: 'Failed', pending: 'Pending', not_applicable: 'Not applicable', unknown: 'Unknown' };
  const CATEGORY_LABELS = {
    reflection: 'Reflection', brief: 'Brief', audit: 'Audit', rollup: 'Roll-up', report: 'Report',
    reminder: 'Reminder', maintenance: 'Maintenance', other: 'Other',
  };

  let root = null;
  let data = null;
  let loadError = '';
  let refreshTimer = null;
  let generation = 0;
  let filters = { provider: 'all', state: 'enabled', category: 'all' };
  let showAllUpcoming = false;
  let expanded = new Set();
  let preview = null;
  let importArchiveId = '';
  let editingId = '';
  let onArchiveChange = null;

  const escape = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  async function request(url, options) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) throw new Error((body && body.error) || (response.status === 401 ? 'Log in to Agent Office to see your workflows.' : 'Mission Control could not load workflows.'));
    return body;
  }

  const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  function when(ms) {
    if (!Number.isFinite(ms)) return '';
    return `${W.formatInZone(ms)} · ${W.relative(ms)}`;
  }

  function stamp(iso) {
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? when(ms) : 'Not recorded';
  }

  function agentName(id) {
    if (!id) return '';
    const roster = window.AGENTS || (typeof AGENTS !== 'undefined' ? AGENTS : []);
    const agent = roster.find(item => item.id === id);
    return agent ? `${agent.name} (${id})` : id;
  }

  function workflowById(id) {
    return data ? data.workflows.find(w => w.id === id) : null;
  }

  function badge(text, tone) {
    return `<span class="mc-badge mc-badge--${escape(tone || 'muted')}">${escape(text)}</span>`;
  }

  function healthBadge(workflow) {
    const health = HEALTH[workflow.health] || HEALTH.unknown;
    return badge(health.label, health.tone);
  }

  function sourceText(workflow) {
    if (workflow.source === 'live') return workflow.live_fresh ? 'Live from OpenClaw' : 'OpenClaw snapshot (relay not reporting)';
    if (workflow.source === 'imported') return 'Imported inventory';
    return 'Tracked manually';
  }

  // Where the next run came from is part of the answer, not a footnote.
  function nextRunText(workflow) {
    const next = workflow.next_run || {};
    const approx = next.approximate ? '≈ ' : '';
    if (next.basis === 'provider') return { main: approx + when(next.at), note: `Reported by ${workflow.provider_label}` };
    if (next.basis === 'calculated') return { main: approx + when(next.at), note: 'Calculated from the schedule' };
    if (next.basis === 'disabled') return { main: 'Disabled', note: '' };
    if (next.basis === 'past') {
      return { main: 'One-time run already due', note: workflow.latest_run ? '' : `Was due ${W.formatInZone(next.past_at)} — outcome unknown` };
    }
    return { main: 'Next run unknown', note: next.reason || '' };
  }

  // -- rendering ---------------------------------------------------------------

  function render() {
    if (!root) return;
    // A re-render keeps whatever Jason had open.
    const openKeys = new Set([...root.querySelectorAll('details[data-mc-key]')].filter(d => d.open).map(d => d.dataset.mcKey));
    const openRuns = new Set([...root.querySelectorAll('[data-mc-run-form]')].filter(f => !f.hidden).map(f => f.dataset.mcRunForm));
    paint();
    root.querySelectorAll('details[data-mc-key]').forEach(d => { if (openKeys.has(d.dataset.mcKey)) d.open = true; });
    root.querySelectorAll('[data-mc-run-form]').forEach(f => { if (openRuns.has(f.dataset.mcRunForm)) f.hidden = false; });
  }

  function paint() {
    if (!data) {
      root.innerHTML = `<div class="control-unavailable">${escape(loadError || 'Loading workflows…')}</div>`;
      return;
    }
    root.innerHTML = `
      ${renderSources()}
      ${renderOverlaps()}
      <div class="mc-grid">
        <section class="mc-section mc-upcoming" aria-labelledby="mc-upcoming-title">
          <div class="mc-section-head"><h3 id="mc-upcoming-title">Upcoming</h3><span>Enabled workflows by next expected run · times in Vancouver</span></div>
          ${renderUpcoming()}
        </section>
        <div class="mc-side">
          <section class="mc-section mc-attention" aria-labelledby="mc-attention-title">
            <div class="mc-section-head"><h3 id="mc-attention-title">Needs attention</h3><span>Confirmed failures and stale connections only</span></div>
            ${renderAttention()}
          </section>
          <section class="mc-section mc-results" aria-labelledby="mc-results-title">
            <div class="mc-section-head"><h3 id="mc-results-title">Latest results</h3><span>Delivered reflections, briefs, audits and roll-ups</span></div>
            ${renderResults()}
          </section>
        </div>
      </div>
      <section class="mc-section mc-all" aria-labelledby="mc-all-title">
        <div class="mc-section-head"><h3 id="mc-all-title">All workflows</h3><span>${data.workflows.length} tracked · open one for its exact schedule, history and prompt</span></div>
        ${renderFilters()}
        <div class="mc-list" id="mc-all-list">${renderAll()}</div>
      </section>
      <details class="mc-section mc-manage" id="mc-manage" data-mc-key="manage"${preview || editingId || importArchiveId ? ' open' : ''}>
        <summary><strong>Add, import and archived inventories</strong><span>Dashboard records only — never changes OpenClaw or ChatGPT</span></summary>
        ${renderArchive()}
        ${renderImport()}
        ${renderWorkflowForm()}
      </details>`;
    bind();
  }

  function renderSources() {
    const openclaw = data.sources.openclaw;
    const chatgpt = data.sources.chatgpt;
    const openclawText = openclaw.state === 'live'
      ? `Live · ${openclaw.jobs} job${openclaw.jobs === 1 ? '' : 's'} · reported ${W.relative(Date.parse(openclaw.updated_at))}`
      : openclaw.state === 'stale'
        ? `Relay not reporting · showing the snapshot from ${W.formatInZone(Date.parse(openclaw.updated_at))}`
        : 'Not connected · the desktop relay has never reported its cron list';
    const chatgptText = chatgpt.workflows
      ? `Imported or tracked here · ${chatgpt.workflows} workflow${chatgpt.workflows === 1 ? '' : 's'} · last updated ${W.relative(Date.parse(chatgpt.updated_at))}`
      : 'Nothing imported yet';
    const tone = openclaw.state === 'live' ? 'ok' : openclaw.state === 'stale' ? 'warn' : 'muted';
    return `
      <div class="mc-sources" aria-label="Data sources">
        <div class="mc-source"><span class="mc-dot mc-dot--${tone}"></span><div><strong>OpenClaw</strong><span>${escape(openclawText)}</span></div></div>
        <div class="mc-source"><span class="mc-dot mc-dot--muted"></span><div><strong>ChatGPT</strong><span>${escape(chatgptText)}. Agent Office cannot read ChatGPT tasks directly; results arrive when recorded here or reported by a Shortcut.</span></div></div>
        <button class="ao-btn ao-btn--sm" type="button" data-mc-action="refresh">Refresh</button>
      </div>`;
  }

  function renderOverlaps() {
    const open = data.overlaps.filter(flag => !flag.acknowledged);
    if (!open.length) return '';
    return open.map(flag => `
      <div class="mc-review" role="note">
        <strong>Review: ${flag.names.length} ${escape(W.PROVIDERS[flag.provider] || 'Other')} audit workflows may overlap</strong>
        <span>${flag.names.map(escape).join(' · ')}</span>
        <small>All of them are kept and nothing has been changed. Decide in ${escape(W.PROVIDERS[flag.provider] || 'the provider')} whether to consolidate.</small>
        <button class="ao-btn ao-btn--sm" type="button" data-mc-ack="${escape(flag.key)}">Mark reviewed</button>
      </div>`).join('');
  }

  function upcomingRow(workflow) {
    const next = nextRunText(workflow);
    return `
      <button class="mc-row" type="button" data-mc-open="${escape(workflow.id)}">
        <span class="mc-row-time"><strong>${escape(next.main)}</strong><small>${escape(next.note)}</small></span>
        <span class="mc-row-main"><strong>${escape(workflow.name)}</strong><small>${escape(workflow.provider_label)} · ${escape(workflow.schedule_text)}</small></span>
        ${healthBadge(workflow)}
      </button>`;
  }

  function renderUpcoming() {
    const ids = showAllUpcoming ? data.upcoming : data.upcoming.slice(0, UPCOMING_LIMIT);
    const rows = ids.map(workflowById).filter(Boolean).map(upcomingRow).join('');
    const more = data.upcoming.length > UPCOMING_LIMIT
      ? `<button class="ao-btn ao-btn--sm" type="button" data-mc-action="toggle-upcoming">${showAllUpcoming ? 'Show fewer' : `Show all ${data.upcoming.length}`}</button>` : '';
    const unknown = data.unscheduled.map(workflowById).filter(Boolean);
    const unknownBlock = unknown.length ? `
      <details class="mc-unknown" data-mc-key="unknown"><summary>${unknown.length} enabled workflow${unknown.length === 1 ? ' has' : 's have'} no known next run</summary>
        <div class="mc-list">${unknown.map(upcomingRow).join('')}</div>
        <small>These are scheduled by their provider (for example ChatGPT's own timing) or have no anchor time. Unknown is not failed.</small>
      </details>` : '';
    if (!rows && !unknownBlock) {
      return '<div class="control-unavailable">No enabled workflows yet. Import an inventory below, or connect the OpenClaw relay to mirror its cron jobs.</div>';
    }
    return `<div class="mc-list">${rows || '<div class="control-unavailable">No upcoming run times are known.</div>'}</div>${more}${unknownBlock}`;
  }

  function renderAttention() {
    if (!data.attention.length) {
      return '<div class="mc-empty">Nothing confirmed as failing. Workflows with no run history show as unknown, not failed.</div>';
    }
    return `<div class="mc-list">${data.attention.map(item => `
      <div class="mc-alert mc-alert--${escape(item.kind)}">
        <strong>${escape(item.title)}</strong>
        <span>${escape(item.detail)}</span>
        ${item.workflow_id ? `<button class="ao-btn ao-btn--sm" type="button" data-mc-open="${escape(item.workflow_id)}">Open workflow</button>` : ''}
      </div>`).join('')}</div>`;
  }

  function resultRow(run) {
    const ms = Date.parse(run.finished_at || run.started_at || run.scheduled_for || run.recorded_at);
    const title = run.output_title || run.workflow_name;
    const link = run.output_url ? `<a href="${escape(run.output_url)}" target="_blank" rel="noopener noreferrer">${escape(title)}</a>` : `<strong>${escape(title)}</strong>`;
    return `
      <div class="mc-result">
        <div>${link}<small>${run.output_title ? `${escape(run.workflow_name)} · ` : ''}${escape(Number.isFinite(ms) ? when(ms) : 'time not recorded')}</small></div>
        <div class="mc-result-states">
          ${badge(`Run: ${EXECUTION_LABELS[run.execution_status] || 'Unknown'}`, run.execution_status === 'failed' ? 'bad' : run.execution_status === 'succeeded' ? 'ok' : 'muted')}
          ${badge(`Delivery: ${DELIVERY_LABELS[run.delivery_status] || 'Unknown'}`, run.delivery_status === 'failed' ? 'bad' : run.delivery_status === 'delivered' ? 'ok' : 'muted')}
        </div>
        ${run.error ? `<small class="mc-error">${escape(run.error)}</small>` : ''}
      </div>`;
  }

  function renderResults() {
    if (!data.results.length) {
      return '<div class="mc-empty">No results recorded yet. OpenClaw last-run status appears when the relay reports it; ChatGPT outputs appear when recorded here or by a Shortcut.</div>';
    }
    return `<div class="mc-list">${data.results.slice(0, RESULTS_LIMIT).map(resultRow).join('')}</div>`;
  }

  function filteredWorkflows() {
    return data.workflows.filter(w =>
      (filters.provider === 'all' || w.provider === filters.provider) &&
      (filters.state === 'all' || (filters.state === 'enabled') === w.enabled) &&
      (filters.category === 'all' || w.category === filters.category))
      .sort((a, b) => (a.next_run.at || Infinity) - (b.next_run.at || Infinity) || a.name.localeCompare(b.name));
  }

  function renderFilters() {
    const providers = ['all', ...Object.keys(W.PROVIDERS).filter(key => data.workflows.some(w => w.provider === key))];
    const categories = ['all', ...W.CATEGORIES.filter(key => data.workflows.some(w => w.category === key))];
    const group = (name, options, labels) => `
      <div class="mc-filter" role="group" aria-label="${escape(name)}">
        ${options.map(value => `<button class="ao-btn ao-btn--sm${filters[name] === value ? ' ao-btn--primary' : ''}" type="button" aria-pressed="${filters[name] === value}" data-mc-filter="${name}" data-value="${escape(value)}">${escape(labels(value))}</button>`).join('')}
      </div>`;
    return `<div class="mc-filters">
      ${group('provider', providers, v => (v === 'all' ? 'All providers' : W.PROVIDERS[v]))}
      ${group('state', ['enabled', 'disabled', 'all'], v => ({ enabled: 'Enabled', disabled: 'Disabled', all: 'Any state' })[v])}
      <label class="mc-filter-select">Category <select data-mc-filter-select="category">${categories.map(v => `<option value="${escape(v)}"${filters.category === v ? ' selected' : ''}>${escape(v === 'all' ? 'All' : CATEGORY_LABELS[v])}</option>`).join('')}</select></label>
    </div>`;
  }

  function detailRow(label, value) {
    return value ? `<div><dt>${escape(label)}</dt><dd>${value}</dd></div>` : '';
  }

  function scheduleExact(schedule) {
    if (schedule.kind === 'cron') return `<code>${escape(schedule.expr)}</code> (cron)`;
    if (schedule.kind === 'interval') return `Every ${escape(Math.round(schedule.every_ms / 60000))} minutes${schedule.anchor ? ` from ${escape(stamp(schedule.anchor))}` : ''}`;
    if (schedule.kind === 'once') return `Once at ${escape(stamp(schedule.at))}`;
    return `${escape(schedule.text)} (as the provider states it)`;
  }

  function workflowCard(workflow) {
    const open = expanded.has(workflow.id);
    const next = nextRunText(workflow);
    const latest = workflow.latest_run;
    const editable = workflow.source !== 'live';
    return `
      <article class="mc-workflow${open ? ' is-open' : ''}" id="mc-wf-${escape(workflow.id)}">
        <button class="mc-workflow-head" type="button" aria-expanded="${open}" data-mc-toggle="${escape(workflow.id)}">
          <span class="mc-row-main"><strong>${escape(workflow.name)}</strong><small>${escape(workflow.provider_label)} · ${escape(CATEGORY_LABELS[workflow.category] || 'Other')} · ${escape(workflow.schedule_text)}</small></span>
          <span class="mc-row-time"><strong>${escape(next.main)}</strong><small>${escape(next.note)}</small></span>
          ${healthBadge(workflow)}
        </button>
        ${open ? `
        <div class="mc-workflow-body">
          ${workflow.purpose ? `<p class="mc-purpose">${escape(workflow.purpose)}</p>` : ''}
          <dl class="mc-details">
            ${detailRow('Schedule', scheduleExact(workflow.schedule))}
            ${detailRow('Schedule timezone', escape(workflow.schedule.timezone))}
            ${detailRow('In words', escape(workflow.schedule_text))}
            ${workflow.schedule_notes.length ? detailRow('Timing notes', workflow.schedule_notes.map(escape).join('<br>')) : ''}
            ${detailRow('Next run', `${escape(next.main)}${next.note ? `<br><small>${escape(next.note)}</small>` : ''}`)}
            ${detailRow('Last run', latest ? `${escape(stamp(latest.finished_at || latest.started_at || latest.recorded_at))}<br>${badge(`Run: ${EXECUTION_LABELS[latest.execution_status]}`, latest.execution_status === 'failed' ? 'bad' : 'muted')} ${badge(`Delivery: ${DELIVERY_LABELS[latest.delivery_status]}`, latest.delivery_status === 'failed' ? 'bad' : 'muted')}${latest.error ? `<br><small class="mc-error">${escape(latest.error)}</small>` : ''}` : 'Unknown — no run recorded')}
            ${detailRow('Latest output', latest && latest.output_url ? `<a href="${escape(latest.output_url)}" target="_blank" rel="noopener noreferrer">${escape(latest.output_title || latest.output_url)}</a>` : '')}
            ${detailRow('Responsible agent', escape(agentName(workflow.agent)))}
            ${detailRow('Delivered to', escape(workflow.delivery))}
            ${detailRow('Provider', `${escape(workflow.provider_label)}${workflow.provider_id ? ` · id <code>${escape(workflow.provider_id)}</code>` : ' · no provider id recorded'}`)}
            ${detailRow('Source', `${escape(sourceText(workflow))}${workflow.source_label ? ` · ${escape(workflow.source_label)}` : ''}`)}
            ${detailRow('Last synchronised', escape(stamp(workflow.synced_at)))}
            ${workflow.not_reported ? detailRow('Note', 'Not in the latest OpenClaw report — it may have been removed there.') : ''}
            ${detailRow('Dashboard id', `<code>${escape(workflow.id)}</code>`)}
          </dl>
          ${workflow.prompt ? `<details class="mc-prompt" data-mc-key="prompt-${escape(workflow.id)}"><summary>Full prompt / inventory text</summary><pre>${escape(workflow.prompt)}</pre></details>` : ''}
          <div class="control-actions">
            <button class="ao-btn ao-btn--sm" type="button" data-mc-record="${escape(workflow.id)}">Record a result</button>
            <button class="ao-btn ao-btn--sm" type="button" data-mc-edit="${escape(workflow.id)}">${editable ? 'Edit dashboard record' : 'Edit notes'}</button>
            ${editable ? `<button class="ao-btn ao-btn--sm" type="button" data-mc-enable="${escape(workflow.id)}" title="Changes this dashboard record only; ${escape(workflow.provider_label)} is not touched.">${workflow.enabled ? 'Mark disabled here' : 'Mark enabled here'}</button>
            <button class="ao-btn ao-btn--sm" type="button" data-mc-delete="${escape(workflow.id)}">Remove from dashboard</button>` : ''}
          </div>
          <small class="mc-hint">${editable
    ? `These controls change Agent Office's record only. To change the real automation, edit it in ${escape(workflow.provider_label)}.`
    : 'Schedule and enabled state come from OpenClaw and update on its next report. Change them in OpenClaw.'}</small>
          <form class="mc-run-form" data-mc-run-form="${escape(workflow.id)}" hidden>
            <label>Run<select name="execution_status">${Object.entries(EXECUTION_LABELS).map(([v, l]) => `<option value="${v}"${v === 'succeeded' ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
            <label>Delivery<select name="delivery_status">${Object.entries(DELIVERY_LABELS).map(([v, l]) => `<option value="${v}"${v === 'delivered' ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
            <label>Output title<input name="output_title" maxlength="200" placeholder="Reflection — Oct 9"></label>
            <label>Output link<input name="output_url" type="url" placeholder="https://"></label>
            <label class="mc-wide">Error (if any)<input name="error" maxlength="2000"></label>
            <div class="mission-goal-actions"><button class="ao-btn ao-btn--primary ao-btn--sm" type="submit">Save result</button><button class="ao-btn ao-btn--sm" type="button" data-mc-run-cancel>Cancel</button></div>
          </form>
        </div>` : ''}
      </article>`;
  }

  function renderAll() {
    const list = filteredWorkflows();
    if (!list.length) return '<div class="control-unavailable">No workflows match these filters.</div>';
    return list.map(workflowCard).join('');
  }

  function renderArchive() {
    const entries = (data.archive || []).filter(entry => !entry.restored_at);
    if (!entries.length) return '';
    return `
      <div class="mc-subsection">
        <h4>Archived inventories</h4>
        <p class="mc-hint">Schedule inventories that were pasted into Penny's goal queue. They are kept word for word as reference and Penny can never pick them up. Import turns one into individual workflows; restore puts the goal back exactly as it was.</p>
        ${entries.map(entry => `
          <article class="mc-archive">
            <div class="mc-row-main"><strong>${escape(entry.title)}</strong><small>Archived ${escape(stamp(entry.archived_at))} · ${entry.imported_workflows} workflow${entry.imported_workflows === 1 ? '' : 's'} imported from it · was ${escape(entry.previous_priority === 'urgent' ? 'Active' : 'Disabled')} (${escape(entry.previous_status)})</small></div>
            <details data-mc-key="archive-${escape(entry.id)}"><summary>Original text</summary><pre>${escape(entry.content)}</pre></details>
            <div class="control-actions">
              <button class="ao-btn ao-btn--sm ao-btn--primary" type="button" data-mc-import-archive="${escape(entry.id)}">Import workflows from this</button>
              <button class="ao-btn ao-btn--sm" type="button" data-mc-restore="${escape(entry.id)}">Restore as goal</button>
            </div>
          </article>`).join('')}
      </div>`;
  }

  function guessProvider(title) {
    if (/openclaw|cron/i.test(title || '')) return 'openclaw';
    if (/chatgpt|openai/i.test(title || '')) return 'chatgpt';
    return 'other';
  }

  function renderImport() {
    const archive = importArchiveId ? (data.archive || []).find(entry => entry.id === importArchiveId) : null;
    const provider = archive ? guessProvider(archive.title) : 'chatgpt';
    const providerOptions = Object.entries(W.PROVIDERS).map(([key, label]) => `<option value="${key}"${key === provider ? ' selected' : ''}>${label}</option>`).join('');
    const previewBlock = preview ? `
      <div class="mc-preview" aria-live="polite">
        <strong>${preview.drafts.length} workflow${preview.drafts.length === 1 ? '' : 's'} recognised</strong>
        ${preview.errors.length ? `<ul class="mc-error">${preview.errors.map(e => `<li>${escape(e)}</li>`).join('')}</ul>` : ''}
        <div class="mc-preview-table" role="table">
          <div role="row" class="mc-preview-head"><span role="columnheader">Name</span><span role="columnheader">Schedule</span><span role="columnheader">Id</span><span role="columnheader">State</span></div>
          ${preview.drafts.map(d => `<div role="row"><span role="cell">${escape(d.name)}</span><span role="cell">${d.schedule.kind === 'cron' ? `<code>${escape(d.schedule.expr)}</code> ${escape(d.schedule.timezone)}` : escape(W.describeSchedule(d.schedule).text)}</span><span role="cell">${escape(d.provider_id || '—')}</span><span role="cell">${d.enabled ? 'Enabled' : 'Disabled'}</span></div>`).join('')}
        </div>
        <small>Workflows already tracked with the same provider and id (or the same name, when there is no id) are updated, not duplicated. Nothing is removed.</small>
        <div class="mission-goal-actions">
          <button class="ao-btn ao-btn--primary" type="button" data-mc-action="import-confirm"${preview.drafts.length ? '' : ' disabled'}>Import ${preview.drafts.length}</button>
          <button class="ao-btn" type="button" data-mc-action="import-cancel">Cancel</button>
        </div>
      </div>` : '';
    return `
      <form class="mc-subsection mission-goal" id="mc-import-form">
        <h4>Import an inventory</h4>
        <p class="mc-hint">Paste an inventory as text, or as JSON — including the output of <code>openclaw cron list --all --json</code>. You will see a preview first; nothing is saved until you confirm, and no automation is created or changed.</p>
        ${archive ? `<p class="mc-hint">Importing from the archived inventory <strong>${escape(archive.title)}</strong>.</p>` : ''}
        <label for="mc-import-provider">Provider</label><select id="mc-import-provider">${providerOptions}</select>
        <label for="mc-import-text">Inventory</label><textarea id="mc-import-text" rows="8">${archive && !preview ? escape(archive.content) : ''}</textarea>
        <div class="mission-goal-actions"><button class="ao-btn" type="submit">Preview import</button>${archive ? '<button class="ao-btn" type="button" data-mc-action="import-clear">Clear</button>' : ''}</div>
        <p role="status" id="mc-import-status"></p>
        ${previewBlock}
      </form>`;
  }

  function renderWorkflowForm() {
    const editing = editingId ? workflowById(editingId) : null;
    const live = editing && editing.source === 'live';
    const s = editing ? editing.schedule : { kind: 'cron', timezone: W.DISPLAY_ZONE };
    const value = key => escape(editing ? editing[key] || '' : '');
    const option = (current, v, label) => `<option value="${v}"${current === v ? ' selected' : ''}>${label}</option>`;
    return `
      <form class="mc-subsection mission-goal" id="mc-workflow-form">
        <h4>${editing ? `Edit “${escape(editing.name)}”` : 'Track a workflow by hand'}</h4>
        <p class="mc-hint">${live ? 'This job is mirrored from OpenClaw: only your notes are editable here.' : 'A dashboard record only. Copy the details from the provider; saving here does not create, enable or reschedule anything there.'}</p>
        <label for="mc-f-name">Name</label><input id="mc-f-name" maxlength="180" required value="${value('name')}"${live ? ' disabled' : ''}>
        ${live ? '' : `
        <div class="mc-form-row">
          <div><label for="mc-f-provider">Provider</label><select id="mc-f-provider">${Object.entries(W.PROVIDERS).map(([k, l]) => option(editing ? editing.provider : 'chatgpt', k, l)).join('')}</select></div>
          <div><label for="mc-f-provider-id">Provider job / automation id</label><input id="mc-f-provider-id" maxlength="160" value="${value('provider_id')}"></div>
        </div>
        <div class="mc-form-row">
          <div><label for="mc-f-kind">Schedule type</label><select id="mc-f-kind">${option(s.kind, 'cron', 'Cron expression')}${option(s.kind, 'interval', 'Fixed interval')}${option(s.kind, 'once', 'One time')}${option(s.kind, 'provider', 'As the provider describes it')}</select></div>
          <div><label for="mc-f-zone">Schedule timezone</label><input id="mc-f-zone" value="${escape(s.timezone || W.DISPLAY_ZONE)}"></div>
        </div>
        <label for="mc-f-expr">Cron expression</label><input id="mc-f-expr" placeholder="0 8 * * *" value="${escape(s.expr || '')}">
        <label for="mc-f-every">Interval in minutes</label><input id="mc-f-every" type="number" min="1" value="${s.every_ms ? Math.round(s.every_ms / 60000) : ''}">
        <label for="mc-f-at">One-time run / interval start (schedule timezone)</label><input id="mc-f-at" type="datetime-local">
        <label for="mc-f-text">Schedule as the provider shows it</label><input id="mc-f-text" maxlength="300" placeholder="Daily around 9 PM" value="${escape(s.text || '')}">
        <label class="mc-check"><input id="mc-f-flexible" type="checkbox"${s.flexible ? ' checked' : ''}> Flexible timing (the provider may run it a little earlier or later)</label>
        <label class="mc-check"><input id="mc-f-enabled" type="checkbox"${!editing || editing.enabled ? ' checked' : ''}> Enabled at the provider (recorded here only)</label>`}
        <div class="mc-form-row">
          <div><label for="mc-f-category">Category</label><select id="mc-f-category">${W.CATEGORIES.map(k => option(editing ? editing.category : 'other', k, CATEGORY_LABELS[k])).join('')}</select></div>
          <div><label for="mc-f-agent">Responsible agent</label><input id="mc-f-agent" maxlength="80" placeholder="oss" value="${value('agent')}"></div>
        </div>
        <label for="mc-f-delivery">Delivered to</label><input id="mc-f-delivery" maxlength="300" placeholder="Telegram, email, ChatGPT notification…" value="${value('delivery')}">
        <label for="mc-f-purpose">Purpose</label><textarea id="mc-f-purpose" rows="2" maxlength="1000">${value('purpose')}</textarea>
        <label for="mc-f-prompt">Full prompt (optional)</label><textarea id="mc-f-prompt" rows="4" maxlength="20000">${value('prompt')}</textarea>
        <div class="mission-goal-actions"><button class="ao-btn ao-btn--primary" type="submit">${editing ? 'Save changes' : 'Save workflow'}</button>${editing ? '<button class="ao-btn" type="button" data-mc-action="edit-cancel">Cancel</button>' : ''}</div>
        <p role="status" id="mc-form-status"></p>
      </form>`;
  }

  // -- behaviour -----------------------------------------------------------------

  function setStatus(id, message) {
    const node = root && root.querySelector(id);
    if (node) node.textContent = message;
  }

  function bind() {
    root.querySelectorAll('[data-mc-action="refresh"]').forEach(b => { b.onclick = () => refresh(); });
    root.querySelectorAll('[data-mc-action="toggle-upcoming"]').forEach(b => { b.onclick = () => { showAllUpcoming = !showAllUpcoming; render(); }; });
    root.querySelectorAll('[data-mc-open]').forEach(b => { b.onclick = () => openWorkflow(b.dataset.mcOpen); });
    root.querySelectorAll('[data-mc-toggle]').forEach(b => {
      b.onclick = () => { const id = b.dataset.mcToggle; expanded.has(id) ? expanded.delete(id) : expanded.add(id); render(); };
    });
    root.querySelectorAll('[data-mc-filter]').forEach(b => { b.onclick = () => { filters[b.dataset.mcFilter] = b.dataset.value; render(); }; });
    root.querySelectorAll('[data-mc-filter-select]').forEach(s => { s.onchange = () => { filters[s.dataset.mcFilterSelect] = s.value; render(); }; });
    root.querySelectorAll('[data-mc-ack]').forEach(b => { b.onclick = () => act(b, () => request('/api/workflows/overlaps/acknowledge', json('POST', { key: b.dataset.mcAck }))); });
    root.querySelectorAll('[data-mc-enable]').forEach(b => {
      b.onclick = () => { const w = workflowById(b.dataset.mcEnable); act(b, () => request(`/api/workflows/${encodeURIComponent(w.id)}`, json('PATCH', { enabled: !w.enabled }))); };
    });
    root.querySelectorAll('[data-mc-delete]').forEach(b => {
      b.onclick = () => {
        const w = workflowById(b.dataset.mcDelete);
        if (!confirm(`Remove "${w.name}" from the dashboard? The automation in ${w.provider_label} is not changed.`)) return;
        act(b, () => request(`/api/workflows/${encodeURIComponent(w.id)}`, { method: 'DELETE' }));
      };
    });
    root.querySelectorAll('[data-mc-edit]').forEach(b => {
      b.onclick = () => { editingId = b.dataset.mcEdit; render(); root.querySelector('#mc-workflow-form').scrollIntoView({ block: 'start' }); };
    });
    root.querySelectorAll('[data-mc-record]').forEach(b => {
      b.onclick = () => { const form = root.querySelector(`[data-mc-run-form="${CSS.escape(b.dataset.mcRecord)}"]`); form.hidden = !form.hidden; };
    });
    root.querySelectorAll('[data-mc-run-form]').forEach(form => {
      form.querySelector('[data-mc-run-cancel]').onclick = () => { form.hidden = true; };
      form.onsubmit = event => {
        event.preventDefault();
        const fields = Object.fromEntries(new FormData(form).entries());
        act(form.querySelector('[type="submit"]'), () => request(`/api/workflows/${encodeURIComponent(form.dataset.mcRunForm)}/runs`, json('POST', fields)));
      };
    });
    root.querySelectorAll('[data-mc-import-archive]').forEach(b => {
      b.onclick = () => { importArchiveId = b.dataset.mcImportArchive; preview = null; render(); root.querySelector('#mc-import-form').scrollIntoView({ block: 'start' }); };
    });
    root.querySelectorAll('[data-mc-restore]').forEach(b => {
      b.onclick = () => {
        const entry = data.archive.find(item => item.id === b.dataset.mcRestore);
        const warning = entry.previous_priority === 'urgent' ? ' It was Active, so Penny may pick it up and try to execute it.' : '';
        if (!confirm(`Restore "${entry.title}" to the goal queue exactly as it was?${warning}`)) return;
        act(b, async () => { await request(`/api/workflows/archive/${encodeURIComponent(entry.id)}/restore`, json('POST', {})); if (onArchiveChange) onArchiveChange(); });
      };
    });

    const importForm = root.querySelector('#mc-import-form');
    importForm.onsubmit = async event => {
      event.preventDefault();
      setStatus('#mc-import-status', 'Reading…');
      try {
        const text = root.querySelector('#mc-import-text').value;
        const provider = root.querySelector('#mc-import-provider').value;
        const result = await request('/api/workflows/import', json('POST', { text, provider, dry_run: true }));
        preview = { ...result, text, provider };
        render();
      } catch (error) { setStatus('#mc-import-status', error.message); }
    };
    root.querySelectorAll('[data-mc-action="import-cancel"]').forEach(b => { b.onclick = () => { preview = null; render(); }; });
    root.querySelectorAll('[data-mc-action="import-clear"]').forEach(b => { b.onclick = () => { importArchiveId = ''; preview = null; render(); }; });
    root.querySelectorAll('[data-mc-action="import-confirm"]').forEach(b => {
      b.onclick = async () => {
        b.disabled = true;
        try {
          const result = await request('/api/workflows/import', json('POST', { text: preview.text, provider: preview.provider, archive_id: importArchiveId }));
          preview = null; importArchiveId = '';
          await refresh();
          setStatus('#mc-import-status', `Imported: ${result.created} new, ${result.updated} updated, ${result.unchanged} unchanged.`);
        } catch (error) { b.disabled = false; setStatus('#mc-import-status', error.message); }
      };
    });

    const form = root.querySelector('#mc-workflow-form');
    root.querySelectorAll('[data-mc-action="edit-cancel"]').forEach(b => { b.onclick = () => { editingId = ''; render(); }; });
    const kind = form.querySelector('#mc-f-kind');
    if (kind) { showScheduleFields(form); kind.onchange = () => showScheduleFields(form); }
    form.onsubmit = event => { event.preventDefault(); saveWorkflow(form); };
  }

  function showScheduleFields(form) {
    const kind = form.querySelector('#mc-f-kind').value;
    const show = (id, visible) => {
      const input = form.querySelector(id);
      input.hidden = !visible; input.style.display = visible ? '' : 'none';
      const label = form.querySelector(`label[for="${id.slice(1)}"]`);
      if (label) { label.hidden = !visible; label.style.display = visible ? '' : 'none'; }
    };
    show('#mc-f-expr', kind === 'cron');
    show('#mc-f-every', kind === 'interval');
    show('#mc-f-at', kind === 'once' || kind === 'interval');
    show('#mc-f-text', kind === 'provider');
  }

  function readForm(form) {
    const get = id => { const node = form.querySelector(id); return node ? node.value.trim() : ''; };
    const payload = {
      category: get('#mc-f-category'), agent: get('#mc-f-agent'), delivery: get('#mc-f-delivery'),
      purpose: get('#mc-f-purpose'), prompt: get('#mc-f-prompt'),
    };
    if (!form.querySelector('#mc-f-kind')) return payload;
    const zone = get('#mc-f-zone') || W.DISPLAY_ZONE;
    const kind = get('#mc-f-kind');
    const at = get('#mc-f-at');
    const schedule = { kind, timezone: zone, flexible: form.querySelector('#mc-f-flexible').checked };
    if (kind === 'cron') schedule.expr = get('#mc-f-expr');
    if (kind === 'interval') {
      schedule.every_ms = Number(get('#mc-f-every')) * 60000;
      const anchor = at && W.isValidZone(zone) ? W.localToInstant(at, zone) : null;
      if (anchor) schedule.anchor = new Date(anchor).toISOString();
    }
    if (kind === 'once') schedule.at = at;
    if (kind === 'provider') schedule.text = get('#mc-f-text');
    return {
      ...payload, name: get('#mc-f-name'), provider: get('#mc-f-provider'), provider_id: get('#mc-f-provider-id'),
      enabled: form.querySelector('#mc-f-enabled').checked, schedule,
    };
  }

  async function saveWorkflow(form) {
    const submit = form.querySelector('[type="submit"]');
    const payload = readForm(form);
    submit.disabled = true;
    try {
      if (editingId) {
        await request(`/api/workflows/${encodeURIComponent(editingId)}`, json('PATCH', payload));
      } else {
        // Check the schedule in the browser first so a mistake is caught
        // before the round trip; the server applies the same rules.
        W.normalizeWorkflow({ ...payload, source: 'manual' });
        await request('/api/workflows', json('POST', payload));
      }
      editingId = '';
      await refresh();
      setStatus('#mc-form-status', 'Saved to the dashboard.');
    } catch (error) {
      submit.disabled = false;
      setStatus('#mc-form-status', error.message);
    }
  }

  async function act(button, fn) {
    if (button) button.disabled = true;
    try { await fn(); await refresh(); } catch (error) {
      if (button) button.disabled = false;
      alert(error.message);
    }
  }

  function openWorkflow(id) {
    expanded.add(id);
    filters = { provider: 'all', state: 'all', category: 'all' };
    render();
    const card = root.querySelector(`#mc-wf-${CSS.escape(id)}`);
    if (card) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  async function refresh() {
    const mine = generation;
    try {
      const payload = await request('/api/workflows');
      if (mine !== generation) return;
      data = payload; loadError = '';
    } catch (error) {
      if (mine !== generation) return;
      loadError = error.message;
    }
    // Typing in a form is never interrupted by a background refresh.
    const active = document.activeElement;
    if (root && active && root.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
    render();
  }

  function mount(target, options = {}) {
    stop();
    root = target; data = null; loadError = ''; preview = null; importArchiveId = ''; editingId = '';
    showAllUpcoming = false; expanded = new Set();
    onArchiveChange = options.onArchiveChange || null;
    render();
    refresh();
    refreshTimer = setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
  }

  function stop() {
    generation++;
    clearInterval(refreshTimer);
    refreshTimer = null; root = null;
  }

  window.AOMissionControl = { mount, stop, refresh };
})();
