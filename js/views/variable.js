'use strict';

/* =============================================
   VARIABLE EXPENSES VIEW & CRUD
   ============================================= */

function renderVariable() {
  const el    = document.getElementById('view-variable');
  const total = sum(state.data.variable, i => i.budget);

  const sections = VARIABLE_CATEGORIES.map(cat => {
    const items = state.data.variable.filter(i => i.category === cat.id);
    if (!items.length) return '';
    const catTotal = sum(items, i => i.budget);

    const rows = items.map(item => `
      <div class="item-row">
        <div class="item-icon" style="background:${cat.bg}">${cat.icon}</div>
        <div class="item-info">
          <div class="item-name">${h(item.name)}</div>
          <div class="item-meta">Månadsbudget</div>
        </div>
        <div class="item-amount amount-expense">${fmt(item.budget)}</div>
        <div class="item-actions">
          <button class="btn-icon"        onclick="editVariable('${item.id}')"           title="Redigera">${I.edit}</button>
          <button class="btn-icon danger" onclick="deleteItem('variable','${item.id}')" title="Ta bort">${I.trash}</button>
        </div>
      </div>
    `).join('');

    return `
      <div class="cat-section">
        <div class="cat-header">
          <div class="cat-icon" style="background:${cat.bg}">${cat.icon}</div>
          <span class="cat-title">${h(cat.label)}</span>
          <span class="cat-count">${items.length} poster</span>
          <span class="cat-total">${fmt(catTotal)}</span>
        </div>
        <div class="card"><div class="item-list">${rows}</div></div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div class="view-header">
      <div><h1>Rörliga kostnader</h1><p>Sätt månadsbudgetar för rörliga utgifter</p></div>
      <button class="btn btn-primary" onclick="showAddVariable()">${I.plus} Lägg till</button>
    </div>

    ${total > 0 ? `
    <div class="summary-card sc-variable" style="margin-bottom:20px;">
      <div class="s-label">Total rörlig budget</div>
      <div class="s-amount">${fmt(total)}</div>
      <div class="s-sub">${state.data.variable.length} poster</div>
    </div>` : ''}

    ${sections || `<div class="card"><div class="item-list">${emptyState('🛒', 'Inga rörliga budgetar', 'Sätt budgetar för mat, bensin, nöje och annat som varierar.')}</div></div>`}
  `;
}

function variableForm(item) {
  const catOptions = VARIABLE_CATEGORIES.map(c =>
    `<option value="${c.id}" ${item?.category === c.id ? 'selected' : ''}>${c.icon} ${c.label}</option>`
  ).join('');

  return `
    <div class="form-group">
      <label class="form-label">Namn</label>
      <input type="text" id="f-name" class="form-input" placeholder="T.ex. Mat, Bensin, Restaurang" value="${h(item?.name ?? '')}">
    </div>
    <div class="form-group">
      <label class="form-label">Månadsbudget (kr)</label>
      <input type="number" id="f-budget" class="form-input" placeholder="0" min="0" step="1" value="${item?.budget ?? ''}">
    </div>
    <div class="form-group">
      <label class="form-label">Kategori</label>
      <select id="f-cat" class="form-select">${catOptions}</select>
    </div>
  `;
}

function showAddVariable() {
  showModal('Lägg till rörlig budget', variableForm(null), () => {
    const name     = document.getElementById('f-name').value.trim();
    const budget   = parseFloat(document.getElementById('f-budget').value);
    const category = document.getElementById('f-cat').value;
    if (!name)          return notify('Ange ett namn.');
    if (!(budget > 0))  return notify('Ange ett giltigt belopp.');
    state.data.variable.push({ id: genId(), name, budget, category });
    saveData(); closeModal(); renderVariable();
  });
}

function editVariable(id) {
  const item = state.data.variable.find(i => i.id === id);
  if (!item) return;
  showModal('Redigera rörlig budget', variableForm(item), () => {
    const name     = document.getElementById('f-name').value.trim();
    const budget   = parseFloat(document.getElementById('f-budget').value);
    const category = document.getElementById('f-cat').value;
    if (!name)         return notify('Ange ett namn.');
    if (!(budget > 0)) return notify('Ange ett giltigt belopp.');
    item.name = name; item.budget = budget; item.category = category;
    saveData(); closeModal(); renderVariable();
  });
}
