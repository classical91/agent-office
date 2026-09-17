'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const dist = path.resolve(__dirname, '../agent-office-deploy/dist');

function setup(drops, registry = null) {
  const elements = new Map();
  const document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', innerHTML: '', setAttribute() {}, classList: { contains: () => true },
    });
    return elements.get(id);
  }};
  const context = vm.createContext({
    window: {}, document, dropboxState: { drops, filters: { subject: 'Work' } },
    requestJson: async () => ({ items: registry }), renderDropbox() {},
    escAttr: String, escHTML: String,
    getFilteredDrops: options => {
      assert.equal(options.ignoreCategory, true);
      return drops;
    },
  });
  vm.runInContext(fs.readFileSync(path.join(dist, 'reminder-categories.js'), 'utf8'), context);
  return { api: context.window.ReminderCategories, context, elements };
}
const reminder = (category, extra = {}) => ({ project: 'iOS', category, ...extra });
const plain = value => JSON.parse(JSON.stringify(value));

test('counts include every reminder category, zero counts and Uncategorized, excluding tasks', () => {
  const drops = [reminder('Work'), reminder('Work'), reminder('Bills'), reminder(''), reminder('Imported'), { project: 'Other', category: 'Work' }];
  const { api } = setup(drops);
  const result = Object.fromEntries(plain(api.filterOptions(drops)));
  assert.equal(result[''], 'All categories (5)');
  assert.equal(result.Work, 'Work (2)');
  assert.equal(result.Bills, 'Bills (1)');
  assert.equal(result.Personal, 'Personal (0)');
  assert.equal(result.uncategorized, 'Uncategorized (1)');
  assert.equal(result.Imported, 'Imported (1)');
  assert.equal(Object.fromEntries(plain(api.options())).Work, 'Work', 'assignment choices have no counts');
});

test('counts use the supplied search/time-filtered subset and update after removal or reassignment', () => {
  const drops = [reminder('Work'), reminder('Bills')];
  const { api } = setup(drops);
  assert.equal(Object.fromEntries(plain(api.filterOptions([drops[1]]))).Work, 'Work (0)');
  drops[0].category = 'Bills';
  assert.equal(Object.fromEntries(plain(api.filterOptions(drops))).Bills, 'Bills (2)');
  drops.pop();
  assert.equal(Object.fromEntries(plain(api.filterOptions(drops)))[''], 'All categories (1)');
  assert.equal(Object.fromEntries(plain(api.filterOptions([])))[''], 'All categories (0)');
});

test('renames retain counts, deleted categories count as Uncategorized, selection is preserved', async () => {
  const drops = [reminder('Work'), reminder('Old'), reminder('')];
  const { api, context, elements } = setup(drops, [
    { id: 'Work', label: 'Office', deleted: false },
    { id: 'Old', label: 'Old category', deleted: true },
  ]);
  api.refresh();
  await new Promise(resolve => setImmediate(resolve));
  api.refresh();
  const result = Object.fromEntries(plain(api.filterOptions(drops)));
  assert.equal(result.Work, 'Office (1)');
  assert.equal(result.uncategorized, 'Uncategorized (2)');
  assert.equal(result.Old, undefined);
  assert.equal(context.dropboxState.filters.subject, 'Work');
  assert.match(elements.get('drop-filter-subject').innerHTML, /Office \(1\)/);
});

test('mission filter bypasses only category when computing counts, retaining search and time filters', () => {
  const source = fs.readFileSync(path.join(dist, 'mission-board.js'), 'utf8');
  const filterSource = source.slice(source.indexOf('  function filteredDrops('), source.indexOf('  async function patchDrop('));
  const work = reminder('Work', { title: 'Pay work bill', due: true });
  const bills = reminder('Bills', { title: 'Pay home bill', due: true });
  const context = vm.createContext({
    document: { getElementById: () => ({ classList: { contains: () => true } }) },
    dropboxState: {
      drops: [work, bills, reminder('Bills', { title: 'Pay future bill' }), reminder('Work', { title: 'Read', due: true }), { project: 'Other', title: 'Pay task', due: true }],
      filters: { subject: 'Work', search: 'pay', reminder: 'due' },
    },
    ReminderCategories: { key: drop => drop.category, label: drop => drop.category || '' },
    applyDropboxFolderFilter: rows => rows,
    applyReminderFilter: (rows, filter) => filter === 'due' ? rows.filter(drop => drop.due) : rows,
  });
  vm.runInContext(filterSource, context);
  assert.deepEqual(plain(context.filteredDrops()), [work]);
  assert.deepEqual(plain(context.filteredDrops({ ignoreCategory: true })), [work, bills]);
});
