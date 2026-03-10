'use strict';

/* =============================================
   INCOME VIEW & CRUD
   ============================================= */

function renderIncome() {
  const el    = document.getElementById('view-income');
  const total = sum(state.data.income, i => i.amount);

  const rows = state.data.income.map(item => `
    <div class="item-row">
      <div class="item-icon" style="background:var(--success-bg)">💰</div>
      <div class="item-info">
        <div class="item-name">${h(item.name)}</div>
        <div class="item-meta">Varje månad</div>
      </div>
      <div class="item-amount amount-income">${fmt(item.amount)}</div>
      <div class="item-actions">
        <button class="btn-icon"        onclick="editIncome('${item.id}')"           title="Redigera">${I.edit}</button>
        <button class="btn-icon danger" onclick="deleteItem('income','${item.id}')" title="Ta bort">${I.trash}</button>
      </div>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="view-header">
      <div><h1>Inkomster</h1><p>Din månadsinkomst</p></div>
      <button class="btn btn-primary" onclick="showAddIncome()">${I.plus} Lägg till</button>
    </div>

    ${total > 0 ? `
    <div class="summary-card sc-income" style="margin-bottom:20px;">
      <div class="s-label">Total inkomst per månad</div>
      <div class="s-amount">${fmt(total)}</div>
      <div class="s-sub">${state.data.income.length} inkomstkälla${state.data.income.length !== 1 ? 'r' : ''}</div>
    </div>` : ''}

    <div class="card">
      <div class="item-list">
        ${rows || emptyState('💰', 'Inga inkomster', 'Lägg till din lön, barnbidrag eller andra inkomstkällor.')}
      </div>
    </div>
  `;
}

function incomeForm(item) {
  return `
    <div class="form-group">
      <label class="form-label">Namn</label>
      <input type="text" id="f-name" class="form-input" placeholder="T.ex. Lön, Barnbidrag" value="${h(item?.name ?? '')}">
    </div>
    <div class="form-group">
      <label class="form-label">Belopp (kr/månad)</label>
      <input type="number" id="f-amount" class="form-input" placeholder="0" min="0" step="1" value="${item?.amount ?? ''}">
    </div>
  `;
}

function showAddIncome() {
  showModal('Lägg till inkomst', incomeForm(null), () => {
    const name   = document.getElementById('f-name').value.trim();
    const amount = parseFloat(document.getElementById('f-amount').value);
    if (!name)          return notify('Ange ett namn.');
    if (!(amount > 0))  return notify('Ange ett giltigt belopp.');
    state.data.income.push({ id: genId(), name, amount });
    saveData(); closeModal(); renderIncome();
  });
}

function editIncome(id) {
  const item = state.data.income.find(i => i.id === id);
  if (!item) return;
  showModal('Redigera inkomst', incomeForm(item), () => {
    const name   = document.getElementById('f-name').value.trim();
    const amount = parseFloat(document.getElementById('f-amount').value);
    if (!name)         return notify('Ange ett namn.');
    if (!(amount > 0)) return notify('Ange ett giltigt belopp.');
    item.name = name; item.amount = amount;
    saveData(); closeModal(); renderIncome();
  });
}
