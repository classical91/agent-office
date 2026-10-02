(function () {
  'use strict';
  const API = '/api/reminder-categories';
  const DEFAULTS = ['Personal', 'Work', 'Subscriptions', 'Bills', 'Other'];
  let registry = null;
  let draft = [];
  let loading = false;
  let loaded = false;
  let saving = false;
  let retryAfter = 0;
  const el = id => document.getElementById(id);
  const ios = () => Boolean(el('dropbox-view')?.classList.contains('ios-mode'));
  const rawKey = drop => drop.category || drop.subject || 'uncategorized';

  function items() {
    const result = registry === null
      ? DEFAULTS.map(id => ({ id, label: id, deleted: false }))
      : registry.map(item => ({ ...item }));
    // Imported/iPhone reminders retain their existing category identifiers.
    // Tombstones prevent deleted categories from reappearing from old records.
    for (const drop of dropboxState.drops.filter(drop => drop.project === 'iOS')) {
      const id = rawKey(drop);
      if (id !== 'uncategorized' && !result.some(item => item.id === id)) {
        result.push({ id, label: id.slice(0, 60), deleted: false });
      }
    }
    return result;
  }
  function key(drop) {
    const id = rawKey(drop);
    return items().find(item => item.id === id)?.deleted ? 'uncategorized' : id;
  }
  function label(drop) {
    const id = key(drop);
    return items().find(item => item.id === id)?.label || 'Uncategorized';
  }
  function options() {
    return [['uncategorized', 'Uncategorized'], ...items().filter(item => !item.deleted).map(item => [item.id, item.label])];
  }
  function filterOptions(reminders) {
    const categories = items();
    const deleted = new Set(categories.filter(item => item.deleted).map(item => item.id));
    const counts = new Map();
    let total = 0;
    for (const drop of reminders) {
      if (drop.project !== 'iOS') continue;
      const raw = rawKey(drop);
      const id = deleted.has(raw) ? 'uncategorized' : raw;
      counts.set(id, (counts.get(id) || 0) + 1);
      total += 1;
    }
    return [['', `All categories (${total})`], ...options().map(([id, name]) => [id, `${name} (${counts.get(id) || 0})`])];
  }
  function fill(select, choices, selected) {
    select.innerHTML = choices.map(([id, name]) => `<option value="${escAttr(id)}">${escHTML(name)}</option>`).join('');
    select.value = choices.some(([id]) => id === selected) ? selected : choices[0][0];
  }
  async function load() {
    const result = await requestJson(API);
    registry = result.items;
    loaded = true;
  }
  function refresh() {
    if (!ios()) return;
    const select = el('drop-filter-subject');
    select.setAttribute('aria-label', 'Filter reminders by category');
    fill(select, filterOptions(getFilteredDrops({ ignoreCategory: true })), dropboxState.filters.subject);
    dropboxState.filters.subject = select.value;
    if (!el('reminder-category-manage')) {
      const button = document.createElement('button');
      button.id = 'reminder-category-manage';
      button.className = 'btn btn-secondary';
      button.textContent = 'Manage categories';
      button.addEventListener('click', open);
      select.after(button);
      const category = document.createElement('select');
      category.id = 'reminder-category';
      category.setAttribute('aria-label', 'Reminder category');
      el('reminder-when').before(category);
    }
    fill(el('reminder-category'), options(), el('reminder-category').value || 'uncategorized');
    if (!loaded && !loading && Date.now() > retryAfter) {
      loading = true;
      load().then(() => renderDropbox()).catch(() => { retryAfter = Date.now() + 5000; })
        .finally(() => { loading = false; });
    }
  }
  function readDraft() {
    el('reminder-category-rows').querySelectorAll('input').forEach(input => {
      draft.find(item => item.id === input.dataset.id).label = input.value.trim();
    });
  }
  function rows() {
    el('reminder-category-rows').innerHTML = draft.filter(item => !item.deleted).map(item => `
      <div class="reminder-category-row">
        <input aria-label="Category name" maxlength="60" data-id="${escAttr(item.id)}" value="${escAttr(item.label)}">
        <button type="button" class="btn btn-danger" data-delete="${escAttr(item.id)}" aria-label="Delete ${escAttr(item.label)}">Delete</button>
      </div>`).join('');
  }
  async function open() {
    if (!await ensureDropsSession(true)) return;
    if (!el('reminder-category-dialog')) {
      const dialog = document.createElement('dialog');
      dialog.id = 'reminder-category-dialog';
      dialog.className = 'reminder-category-dialog';
      dialog.setAttribute('aria-labelledby', 'reminder-category-heading');
      dialog.innerHTML = `<h2 id="reminder-category-heading">Manage categories</h2>
        <p>Add, rename, or delete reminder categories. Deleting a category keeps its reminders under Uncategorized.</p>
        <fieldset style="border:0;padding:0;margin:0" id="reminder-category-fields">
          <div id="reminder-category-rows"></div>
          <button type="button" class="btn btn-secondary" id="reminder-category-add">+ Add category</button>
          <p id="reminder-category-error" class="reminder-category-error" role="status"></p>
          <div class="dropbox-row">
            <button type="button" class="btn btn-secondary" id="reminder-category-cancel">Cancel</button>
            <button type="button" class="btn btn-primary" id="reminder-category-save">Save categories</button>
          </div>
        </fieldset>`;
      document.body.appendChild(dialog);
      dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
      el('reminder-category-cancel').onclick = () => dialog.close();
      el('reminder-category-add').onclick = () => {
        readDraft();
        draft.push({ id: `custom-${crypto.randomUUID()}`, label: '', deleted: false });
        rows();
        el('reminder-category-rows').querySelector('div:last-child input')?.focus();
      };
      el('reminder-category-rows').onclick = event => {
        const button = event.target.closest('[data-delete]');
        if (!button || saving) return;
        readDraft();
        const item = draft.find(item => item.id === button.dataset.delete);
        const original = items().find(entry => entry.id === item.id);
        if (original) { item.label = original.label; item.deleted = true; }
        else draft = draft.filter(entry => entry !== item);
        rows();
      };
      el('reminder-category-save').onclick = save;
    }
    el('reminder-category-dialog').showModal();
    el('reminder-category-fields').disabled = true;
    el('reminder-category-error').textContent = 'Loading categories…';
    try {
      await load();
      draft = items();
      rows();
      el('reminder-category-error').textContent = '';
      el('reminder-category-save').disabled = false;
    } catch (error) {
      el('reminder-category-error').textContent = error.message;
      el('reminder-category-save').disabled = true;
    } finally {
      el('reminder-category-fields').disabled = false;
    }
  }
  async function save() {
    if (saving) return;
    readDraft();
    saving = true;
    el('reminder-category-fields').disabled = true;
    try {
      const result = await requestJson(API, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: draft, previous: registry }),
      });
      registry = result.items;
      el('reminder-category-dialog').close();
      const editor = el('mission-reminder-category');
      if (editor) {
        const selected = editor.value;
        fill(editor, options(), selected);
        refresh();
      } else renderDropbox();
    } catch (error) {
      el('reminder-category-error').textContent = error.message;
    } finally {
      saving = false;
      el('reminder-category-fields').disabled = false;
    }
  }
  window.ReminderCategories = { refresh, key, label, options, filterOptions, open };
})();
