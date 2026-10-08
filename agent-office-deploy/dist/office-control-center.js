(function () {
  'use strict';

  const shell = document.getElementById('control-center');
  const body = document.getElementById('control-center-body');
  const title = document.getElementById('control-center-title');
  const kicker = document.getElementById('control-center-kicker');
  const office = document.querySelector('.office-stage');
  if (!shell || !body || !office) return;

  let liveAgents = [];
  let selectedId = null;

  // -- ShareBot67 newsroom health ------------------------------
  //
  // ShareBot67's newsroom runs in the Market Dashboard. The office feed next
  // to this agent is scripted context — "ShareBot67 smoke check passed" says
  // the same thing on a morning the newsroom failed at 4am — so the panel
  // below is fetched, labelled as live, and says "Unavailable" rather than
  // anything reassuring when it cannot be read.
  //
  // The browser never holds the dashboard key: this reads Agent Office's own
  // adapter, which does the authenticated call server-side.
  const NEWSROOM_AGENT_ID = 'newsreporter';
  const NEWSROOM_ENDPOINT = '/api/sharebot/newsroom-health';
  const NEWSROOM_POLL_MS = 45000;
  const NEWSROOM_HEALTH_LABELS = {
    healthy: 'Healthy',
    running: 'Running',
    degraded: 'Degraded',
    failed: 'Failed',
    idle: 'No runs yet',
    unavailable: 'Unavailable',
  };
  const NEWSROOM_ROUTE_LABELS = { verified: 'Verified', warning: 'Warning', failed: 'Failed' };
  let newsroomTimer = null;
  let newsroomInFlight = false;

  const escape = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  function configuredAgent(id) {
    return (window.AGENTS || (typeof AGENTS !== 'undefined' ? AGENTS : [])).find(agent => agent.id === id);
  }

  function runtimeAgent(id) {
    return liveAgents.find(agent => agent.id === id) || null;
  }

  function roomAgent(id) {
    return (typeof agentState !== 'undefined' ? agentState : []).find(agent => agent.id === id) || configuredAgent(id);
  }

  function operationalState(agent, live) {
    if (typeof agentOperationalState === 'function') return agentOperationalState(agent);
    return (live && live.status) || agent.status || 'offline';
  }

  async function refreshLiveAgents() {
    try {
      const response = await fetch('/api/agents', { credentials: 'same-origin' });
      if (response.ok) liveAgents = await response.json();
    } catch (_) {
      liveAgents = [];
    }
  }

  function openShell() {
    shell.hidden = false;
    document.body.classList.add('control-center-open');
  }

  function close() {
    shell.hidden = true;
    document.body.classList.remove('control-center-open');
    selectedId = null;
    stopNewsroom();
    stopSchedules();
  }

  function stat(label, value, note) {
    return `<div class="control-stat"><span>${escape(label)}</span><strong>${escape(value || 'Unavailable')}</strong>${note ? `<small>${escape(note)}</small>` : ''}</div>`;
  }

  async function openAgent(id) {
    stopSchedules();
    selectedId = id;
    await refreshLiveAgents();
    const agent = roomAgent(id);
    if (!agent) return;
    const live = runtimeAgent(id);
    const state = operationalState(agent, live);
    const task = (live && (live.current_task_title || live.current_task_id)) || agent.currentTask || 'No task reported';
    const isPenny = agent.id === 'oss';
    kicker.textContent = isPenny ? 'SOLE ORCHESTRATOR' : 'SPECIALIST AGENT';
    title.textContent = agent.name;
    body.innerHTML = `
      <div class="control-agent-hero" style="--entity-color:${escape(agent.color)}">
        <div class="control-agent-avatar">${escape(agent.emoji)}</div>
        <div><strong>${escape(agent.role)}</strong><span class="control-state control-state--${escape(state)}">${escape(state)}</span><p>${escape(agent.desc)}</p></div>
      </div>
      ${isPenny ? '<div class="control-callout"><strong>Penny owns this office.</strong> Goals go to Penny; specialists execute assigned domain work and report results back. Specialists do not command one another.</div>' : '<div class="control-callout">This specialist operates under Penny. View upcoming jobs in Mission Control.</div>'}
      <div class="control-stats">
        ${stat('Current task', task, live ? 'Live agent record' : 'Configured fallback')}
        ${stat('Model / provider', (live && live.model) || agent.model, (live && live.source) || 'Configured roster')}
        ${stat('Workspace', agent.workspace)}
        ${stat('Tokens today', live && live.cost_tokens_today ? Number(live.cost_tokens_today).toLocaleString() : 'Not reported')}
      </div>
      ${agent.id === NEWSROOM_AGENT_ID ? newsroomPanelShell() : ''}
      <div class="control-actions">
        ${isPenny ? '<button class="ao-btn ao-btn--primary" type="button" onclick="AOControlCenter.openMissionControl()">Open Mission Control</button>' : ''}
        <a class="ao-btn" href="/memory.html?agent=${encodeURIComponent(agent.id)}">View memory</a>
        <a class="ao-btn" href="/agent-registry.html">Agent registry</a>
        <button class="ao-btn" type="button" onclick="AOControlCenter.customize('${escape(agent.id)}')">Edit appearance</button>
      </div>
      <div class="control-unavailable"><strong>Direct runtime controls</strong><span>Pause, stop, retry, logs, elapsed time, tools, and API cost will appear only when the OpenClaw gateway exposes verified control and telemetry endpoints.</span></div>`;
    openShell();
    if (agent.id === NEWSROOM_AGENT_ID) startNewsroom();
    else stopNewsroom();
  }

  function newsroomPanelShell() {
    return `
      <section class="newsroom-panel" id="newsroom-panel" aria-live="polite">
        <div class="newsroom-panel-head">
          <div>
            <strong>ShareBot67 Newsroom</strong>
            <span>Live from Market Dashboard. The office feed beside this agent is scripted context, not health.</span>
          </div>
          <button class="ao-btn ao-btn--sm newsroom-refresh" type="button">Refresh</button>
        </div>
        <div id="newsroom-panel-body"><div class="control-unavailable"><span>Reading newsroom health…</span></div></div>
      </section>`;
  }

  function newsroomStamp(value) {
    if (!value) return 'Not recorded';
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? 'Not recorded' : at.toLocaleString();
  }

  function newsroomRow(label, value, className) {
    return `<div class="newsroom-row"><span>${escape(label)}</span><strong${className ? ` class="${escape(className)}"` : ''}>${escape(value)}</strong></div>`;
  }

  function renderNewsroom(payload) {
    const target = body.querySelector('#newsroom-panel-body');
    if (!target) return;

    const health = (payload && payload.health) || 'unavailable';
    const healthLabel = NEWSROOM_HEALTH_LABELS[health] || 'Unavailable';
    const route = (payload && payload.agent_route) || {};
    const routeLabel = NEWSROOM_ROUTE_LABELS[route.route] || 'Warning';

    // A newsroom that cannot be read is never dressed up as one that is fine.
    if (!payload || payload.available !== true) {
      target.innerHTML = `
        <div class="newsroom-rows">
          ${newsroomRow('Health', healthLabel, `newsroom-health newsroom-health--${health}`)}
        </div>
        <div class="control-unavailable">
          <strong>Live newsroom health is unavailable</strong>
          <span>${escape((payload && payload.error) || 'Agent Office could not read newsroom health.')}</span>
          <span>This is not evidence that the newsroom is healthy — only that its status could not be read.</span>
        </div>`;
      return;
    }

    const attempt = payload.last_attempt;
    const generation = payload.generation || { generated: 0, expected: 0 };
    const delivery = payload.delivery || { succeeded: 0, failed: 0 };
    const error = payload.latest_error;

    target.innerHTML = `
      <div class="newsroom-rows">
        ${newsroomRow('Health', healthLabel, `newsroom-health newsroom-health--${health}`)}
        ${newsroomRow('Agent route', routeLabel, `newsroom-route newsroom-route--${route.route || 'warning'}`)}
        ${newsroomRow('Last successful cycle', payload.last_success ? newsroomStamp(payload.last_success.completed_at || payload.last_success.started_at) : 'None recorded')}
        ${newsroomRow('Last attempt', attempt ? `${String(attempt.status || 'unknown').replace(/_/g, ' ')} · ${newsroomStamp(attempt.completed_at || attempt.started_at)}` : 'None recorded')}
        ${newsroomRow('Next expected cycle', payload.next_expected_at ? newsroomStamp(payload.next_expected_at) : 'No schedule reported')}
        ${newsroomRow('Generation', `${generation.generated} / ${generation.expected} sections`)}
        ${newsroomRow('Delivery', `${delivery.succeeded} successful · ${delivery.failed} failed`)}
      </div>
      ${error ? `<div class="newsroom-error"><strong>Latest error</strong><span>${escape(error.message || error.reason || error.code || 'Reported without detail.')}</span><small>${escape([error.phase, error.code, error.retryable ? 'retryable' : 'not retryable'].filter(Boolean).join(' · '))}</small></div>` : ''}
      <small class="newsroom-checked">Checked ${escape(newsroomStamp(payload.checked_at))}</small>`;
  }

  async function refreshNewsroom() {
    // One request at a time. A slow upstream plus a 45s tick would otherwise
    // stack calls that all answer the same question.
    if (newsroomInFlight) return;
    if (!body.querySelector('#newsroom-panel-body')) {
      stopNewsroom();
      return;
    }
    newsroomInFlight = true;
    try {
      const response = await fetch(NEWSROOM_ENDPOINT, { credentials: 'same-origin' });
      if (response.status === 401) {
        renderNewsroom({ available: false, health: 'unavailable', error: 'Log in to Agent Office to read newsroom health.' });
        return;
      }
      if (!response.ok) {
        renderNewsroom({ available: false, health: 'unavailable', error: 'Agent Office could not read newsroom health.' });
        return;
      }
      renderNewsroom(await response.json());
    } catch (_) {
      renderNewsroom({ available: false, health: 'unavailable', error: 'Agent Office could not reach its own newsroom health adapter.' });
    } finally {
      newsroomInFlight = false;
    }
  }

  function startNewsroom() {
    stopNewsroom();
    const refresh = body.querySelector('.newsroom-refresh');
    if (refresh) refresh.addEventListener('click', refreshNewsroom);
    refreshNewsroom();
    // A hidden tab polls nothing: the tick still fires, and skips.
    newsroomTimer = setInterval(() => {
      if (document.hidden) return;
      refreshNewsroom();
    }, NEWSROOM_POLL_MS);
  }

  function stopNewsroom() {
    if (!newsroomTimer) return;
    clearInterval(newsroomTimer);
    newsroomTimer = null;
  }

  let scheduleTimer = null;
  let scheduleItems = [];
  let cronSnapshot = null;
  let missionGoals = null;
  let scheduleLoaded = false;
  let editingSchedule = -1;
  let scheduleGeneration = 0;
  function stopSchedules() {
    clearInterval(scheduleTimer); scheduleTimer = null; scheduleGeneration++;
  }
  function openMissionControl() {
    stopNewsroom(); stopSchedules(); selectedId = 'schedules';
    scheduleLoaded = false; editingSchedule = -1; cronSnapshot = null; missionGoals = null;
    kicker.textContent = 'GOALS AND TASK SCHEDULES'; title.textContent = 'Mission Control';
    body.innerHTML = `
      <div class="control-callout">See your open Mission Control goals plus upcoming cron jobs and ChatGPT or Claude schedules.</div>
      <section class="mission-results" aria-live="polite"><div class="mission-results-heading"><div><strong>Open goals</strong><span>The same goals shown on your Mission Control card</span></div></div><div id="mission-goals-list">Loading goals…</div></section>
      <button class="ao-btn ao-btn--primary" id="goal-toggle" aria-expanded="false" aria-controls="goal-form" type="button">+ Add goal</button>
      <form class="mission-goal" id="goal-form" hidden style="display:none">
        <label for="goal-title">Goal title</label><input id="goal-title" maxlength="120" required>
        <label for="goal-content">Goal instructions</label><textarea id="goal-content" rows="5" maxlength="10000" required></textarea>
        <p class="mission-optional">Queues a Mission Control goal for Penny.</p>
        <div class="mission-goal-actions"><button class="ao-btn ao-btn--primary" type="submit">Save goal</button><button class="ao-btn" id="goal-cancel" type="button">Cancel</button></div>
      </form>
      <p id="goal-status" role="status"></p>
      <button class="ao-btn ao-btn--primary" id="schedule-toggle" aria-expanded="false" aria-controls="schedule-form" type="button">+ Add task</button>
      <form class="mission-goal" id="schedule-form" hidden style="display:none">
        <label for="schedule-title">Task name</label><input id="schedule-title" maxlength="120" required>
        <label for="schedule-source">Source</label><select id="schedule-source"><option>ChatGPT</option><option>Claude</option><option>Other</option></select>
        <label for="schedule-start">First / next scheduled time</label><input id="schedule-start" type="datetime-local" required>
        <label for="schedule-repeat">Repeats</label><select id="schedule-repeat"><option value="once">Once</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly on this date</option></select>
        <details><summary>Notes and timezone</summary><label for="schedule-zone">Timezone</label><input id="schedule-zone" value="America/Vancouver" required><label for="schedule-notes">Notes (optional)</label><textarea id="schedule-notes" rows="2" maxlength="2000"></textarea></details>
        <p class="mission-optional">Copy the schedule from the source app. Saving here tracks it; it does not create or change that automation.</p>
        <div class="mission-goal-actions"><button class="ao-btn ao-btn--primary" type="submit">Save schedule</button><button class="ao-btn" id="schedule-cancel" type="button">Cancel</button></div>
      </form>
      <p id="schedule-status" role="status"></p>
      <section class="mission-results"><div class="mission-results-heading"><div><strong>Upcoming tasks</strong><span>Next runs shown in America/Vancouver · soonest first</span></div><button class="ao-btn" id="schedule-refresh" type="button">Refresh</button></div><p id="cron-status"></p><div id="schedule-list">Loading schedules…</div></section>`;
    body.querySelector('#goal-toggle').onclick = () => toggleGoalForm();
    body.querySelector('#goal-cancel').onclick = () => toggleGoalForm(false);
    body.querySelector('#goal-form').onsubmit = saveGoal;
    body.querySelector('#schedule-toggle').onclick = () => toggleScheduleForm();
    body.querySelector('#schedule-cancel').onclick = () => toggleScheduleForm(false);
    body.querySelector('#schedule-refresh').onclick = refreshSchedules;
    body.querySelector('#schedule-form').onsubmit = saveSchedule;
    openShell(); refreshSchedules();
    let ticks = 0;
    scheduleTimer = setInterval(() => {
      if (shell.hidden || selectedId !== 'schedules' || document.hidden) return;
      body.querySelectorAll('[data-schedule-next]').forEach(node => { node.textContent = MissionSchedules.countdown(Number(node.dataset.scheduleNext)); });
      if (++ticks % 30 === 0) refreshSchedules();
    }, 1000);
  }
  function toggleGoalForm(force) {
    const form = body.querySelector('#goal-form');
    const open = force === undefined ? form.hidden : force;
    form.hidden = !open; form.style.display = open ? '' : 'none';
    const button = body.querySelector('#goal-toggle');
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? 'Close goal form' : '+ Add goal';
    if (!open) form.reset();
    if (open) body.querySelector('#goal-title').focus();
  }
  async function saveGoal(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = body.querySelector('#goal-status');
    const submit = form.querySelector('button[type="submit"]');
    const title = form.querySelector('#goal-title').value.trim();
    const goal = form.querySelector('#goal-content').value.trim();
    if (!title || !goal) { status.textContent = 'Enter a title and goal instructions.'; return; }
    submit.disabled = true; status.textContent = 'Saving goal…';
    try {
      await scheduleRequest('/api/orchestration/goals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, goal })
      });
      if (body.querySelector('#goal-form') !== form) return;
      toggleGoalForm(false);
      status.textContent = 'Goal queued in Mission Control.';
      await refreshSchedules();
    } catch (error) {
      status.textContent = error.message;
    } finally { submit.disabled = false; }
  }
  function toggleScheduleForm(force, item) {
    const form = body.querySelector('#schedule-form');
    const open = force === undefined ? form.hidden : force;
    form.hidden = !open; form.style.display = open ? '' : 'none';
    const button = body.querySelector('#schedule-toggle');
    button.setAttribute('aria-expanded', String(open)); button.textContent = open ? 'Close form' : '+ Add task';
    if (!open) { form.reset(); editingSchedule = -1; }
    if (item) {
      for (const [field, key] of [['title','title'],['source','source'],['start','start'],['repeat','repeat'],['zone','timezone'],['notes','notes']]) body.querySelector('#schedule-'+field).value = item[key];
    }
    if (open) body.querySelector('#schedule-title').focus();
  }
  async function scheduleRequest(url, options) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load schedules. Log in and try again.');
    return data;
  }
  async function refreshSchedules() {
    const generation = scheduleGeneration;
    const results = await Promise.allSettled([scheduleRequest('/api/mission-schedules'), scheduleRequest('/api/cron-jobs'), scheduleRequest('/api/orchestration/goals')]);
    if (generation !== scheduleGeneration || selectedId !== 'schedules') return;
    if (results[0].status === 'fulfilled') { if (!scheduleLoaded || body.querySelector('#schedule-form').hidden) scheduleItems = results[0].value.items; scheduleLoaded = true; }
    else { scheduleLoaded = false; body.querySelector('#schedule-status').textContent = results[0].reason.message; }
    cronSnapshot = results[1].status === 'fulfilled' ? results[1].value : null;
    missionGoals = results[2].status === 'fulfilled' ? results[2].value : null;
    renderMissionGoals(results[2].status === 'rejected' ? results[2].reason : null);
    renderSchedules();
  }
  function renderMissionGoals(error) {
    const list = body.querySelector('#mission-goals-list'); if (!list) return;
    if (error) { list.innerHTML = `<div class="control-unavailable">${escape(error.message)}</div>`; return; }
    const goals = (missionGoals || []).filter(goal => goal.orchestration_status !== 'completed');
    list.innerHTML = goals.length ? goals.map(goal => {
      const content = typeof goal.content === 'string' && goal.content.trim() !== (goal.title || '').trim() ? goal.content.trim() : '';
      return `<article class="mission-result mission-result--${escape(goal.orchestration_status || 'queued')}"><div class="mission-result-head"><strong class="mission-result-title">${escape(goal.title)}</strong><span class="control-state">${escape(goal.orchestration_status === 'running' ? 'Currently working' : goal.orchestration_status || 'queued')}</span></div>${content ? `<p class="mission-result-description">${escape(content)}</p>` : ''}<small>${escape(new Date(goal.updated_at || goal.date).toLocaleString())}</small></article>`;
    }).join('') : '<div class="control-unavailable">No open Mission Control goals.</div>';
  }
  function renderSchedules() {
    const list = body.querySelector('#schedule-list'); if (!list) return;
    const now = Date.now(), date = ms => new Date(ms).toLocaleString('en-CA', { timeZone:'America/Vancouver', dateStyle:'medium', timeStyle:'short' });
    const fresh = cronSnapshot && cronSnapshot.fresh && now - Date.parse(cronSnapshot.updated_at) < 120000;
    body.querySelector('#cron-status').textContent = !cronSnapshot ? 'Cron feed unavailable.' : !fresh ? 'Cron feed stale or not yet connected — times may have changed.' : 'Cron feed connected';
    const rows = (scheduleLoaded ? scheduleItems : []).map((item,index) => ({ ...item, index, next: MissionSchedules.nextRun(item,now) }));
    for (const job of (cronSnapshot && cronSnapshot.jobs || [])) rows.push({ title:job.name, source:'OpenClaw cron', next:job.enabled ? job.next_run_at_ms : null, paused:!job.enabled, notes:job.description, repeat:job.schedule.expr || job.schedule.kind || 'cron', stale:!fresh, last:job.last_run_at_ms, lastStatus:job.last_run_status });
    rows.sort((a,b)=>(a.next || Infinity)-(b.next || Infinity));
    list.innerHTML = rows.length ? rows.map(item => `<article class="mission-result"><div class="mission-result-head"><strong class="mission-result-title">${escape(item.title)}</strong><span class="control-state">${escape(item.source)}</span></div><p><strong ${item.next && !item.paused ? `data-schedule-next="${item.next}"` : ''}>${escape(item.paused ? 'Paused' : MissionSchedules.countdown(item.next,now))}</strong></p><p>${item.next ? 'Next scheduled: '+escape(date(item.next)) : 'No next run reported'} · ${escape(item.repeat)}${item.stale ? ' · stale snapshot' : ''}</p>${item.notes ? `<details><summary>Details</summary><p>${escape(item.notes)}</p></details>` : ''}${item.last ? `<small>Last reported run: ${escape(date(item.last))} · ${escape(item.lastStatus || 'status unknown')}</small>` : ''}${item.index !== undefined ? `<div class="control-actions"><button class="ao-btn" data-schedule-edit="${item.index}">Edit</button><button class="ao-btn" data-schedule-delete="${item.index}">Delete</button></div>` : ''}</article>`).join('') : '<div class="control-unavailable">No schedules to display. Add a task to track its next run.</div>';
    list.querySelectorAll('[data-schedule-edit]').forEach(button => button.onclick = () => { editingSchedule = Number(button.dataset.scheduleEdit); toggleScheduleForm(true,scheduleItems[editingSchedule]); });
    list.querySelectorAll('[data-schedule-delete]').forEach(button => button.onclick = async () => {
      const index = Number(button.dataset.scheduleDelete);
      if (!confirm(`Remove "${scheduleItems[index].title}" from this list? The source automation will remain active.`)) return;
      try { await persistSchedules(scheduleItems.filter((_,i)=>i!==index)); toggleScheduleForm(false); } catch(error) { body.querySelector('#schedule-status').textContent=error.message; }
    });
  }
  async function persistSchedules(items) {
    if (!scheduleLoaded) throw new Error('Refresh schedules before saving.');
    scheduleGeneration++;
    const result = await scheduleRequest('/api/mission-schedules', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,previous:scheduleItems})});
    scheduleItems=result.items; renderSchedules();
  }
  async function saveSchedule(event) {
    event.preventDefault(); const button=event.target.querySelector('[type="submit"]'); button.disabled=true;
    try {
      const value = key => body.querySelector('#schedule-'+key).value;
      const item=MissionSchedules.validate({title:value('title'),source:value('source'),start:value('start'),repeat:value('repeat'),timezone:value('zone'),notes:value('notes')});
      const items=scheduleItems.slice(); if(editingSchedule<0)items.push(item);else items[editingSchedule]=item;
      await persistSchedules(items); toggleScheduleForm(false); body.querySelector('#schedule-status').textContent='Schedule saved.';
    } catch(error) { body.querySelector('#schedule-status').textContent=error.message; }
    finally { button.disabled=false; }
  }

  function customize(id) {
    close();
    if (window.AOAvatarCustomizer) window.AOAvatarCustomizer.open(id);
  }

  function interceptAgentClick(event) {
    const character = event.target.closest && event.target.closest('.agent-char[data-agent-id]');
    if (!character) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openAgent(character.dataset.agentId);
  }

  office.addEventListener('click', interceptAgentClick, true);
  office.addEventListener('keydown', event => {
    const character = event.target.closest && event.target.closest('.agent-char[data-agent-id]');
    if (!character || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openAgent(character.dataset.agentId);
  }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !shell.hidden) close(); });
  // Coming back to a tab that skipped its ticks should not wait out another
  // full interval before showing something current.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && newsroomTimer) refreshNewsroom();
  });

  window.AOControlCenter = { openAgent, openMissionControl, close, customize };

  // The sidebar's Mission Control row lives on every page, so it links back to
  // the office with ?panel=mission-control and the panel opens itself here.
  if (new URLSearchParams(location.search).get('panel') === 'mission-control') {
    openMissionControl();
  }
})();
