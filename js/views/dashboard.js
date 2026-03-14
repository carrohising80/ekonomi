'use strict';

/* =============================================
   DASHBOARD VIEW
   ============================================= */

function renderDashboard() {
  const t  = calcTotals();
  const el = document.getElementById('view-dashboard');
  const neg = t.remaining < 0;

  const monthLabel = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' }).format(new Date());

  el.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Översikt</h1>
        <p>${h(monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1))}</p>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-card sc-income">
        <div class="s-label">Inkomster</div>
        <div class="s-amount">${fmt(t.income)}</div>
        <div class="s-sub">${state.data.income.length} källa${state.data.income.length !== 1 ? 'r' : ''}</div>
      </div>
      <div class="summary-card sc-expense">
        <div class="s-label">Fasta kostnader</div>
        <div class="s-amount">${fmt(t.fixed)}</div>
        <div class="s-sub">${state.data.fixed.length} poster</div>
      </div>
      <div class="summary-card sc-variable">
        <div class="s-label">Rörliga (budget)</div>
        <div class="s-amount">${fmt(t.variable)}</div>
        <div class="s-sub">${state.data.variable.length} poster</div>
      </div>
      <div class="summary-card sc-periodic">
        <div class="s-label">Periodiskt sparande</div>
        <div class="s-amount">${fmt(t.periodicMonthly)}</div>
        <div class="s-sub">avsätts/mån</div>
      </div>
    </div>

    <div class="result-card ${neg ? 'negative' : ''}">
      <div>
        <div class="rc-label">Kvar att röra sig med</div>
        <div class="rc-amount">${fmt(t.remaining)}</div>
        <div class="rc-status">${neg ? '⚠️ Underskott – kostnader överstiger inkomst' : '✓ Du går plus denna månad'}</div>
      </div>
      <div class="rc-breakdown">
        <div class="rc-breakdown-row"><span class="rbl">Inkomst</span><span class="rba" style="color:var(--success)">+ ${fmt(t.income)}</span></div>
        <div class="rc-breakdown-row"><span class="rbl">Fasta</span><span class="rba">− ${fmt(t.fixed)}</span></div>
        <div class="rc-breakdown-row"><span class="rbl">Rörliga</span><span class="rba">− ${fmt(t.variable)}</span></div>
        <div class="rc-breakdown-row"><span class="rbl">Periodiskt</span><span class="rba">− ${fmt(t.periodicMonthly)}</span></div>
      </div>
    </div>

    <div class="dash-grid">
      ${dashFixedCard()}
      ${dashPeriodicCard()}
    </div>
  `;
}

function dashFixedCard() {
  const grouped = FIXED_CATEGORIES.map(cat => {
    const items = state.data.fixed.filter(i => i.category === cat.id);
    if (!items.length) return null;
    return { ...cat, items, total: sum(items, i => i.amount) };
  }).filter(Boolean);

  const rows = grouped.map(g => `
    <div class="item-row" style="cursor:default;">
      <div class="item-icon" style="background:${g.bg}">${g.icon}</div>
      <div class="item-info">
        <div class="item-name">${h(g.label)}</div>
        <div class="item-meta">${g.items.length} ${g.items.length === 1 ? 'post' : 'poster'}</div>
      </div>
      <div class="item-amount amount-expense">${fmt(g.total)}</div>
    </div>
  `).join('');

  return `
    <div class="card">
      <div class="card-header"><h2>Fasta kostnader per kategori</h2></div>
      <div class="item-list">
        ${rows || emptySmall('Inga fasta kostnader tillagda')}
      </div>
    </div>
  `;
}

function dashPeriodicCard() {
  function getMonthlyAmount(item) {
    if (item.frequencyType === 'days' && item.frequencyDays) {
      return (item.totalAmount / item.frequencyDays) * 30.44;
    }
    return item.totalAmount / item.frequencyMonths;
  }
  
  function getFreqLabel(item) {
    if (item.frequencyType === 'days' && item.frequencyDays) {
      return 'var ' + item.frequencyDays + ':e dag';
    }
    return FREQ_LABELS[item.frequencyMonths] || 'periodiskt';
  }
  
  const rows = state.data.periodic.map(item => {
    const monthly = getMonthlyAmount(item);
    const available = calcPeriodicAvailable(item);
    const canWithdraw = available > 0;
    return `
      <div class="item-row" style="cursor:default;">
        <div class="item-icon" style="background:var(--warning-bg)">📅</div>
        <div class="item-info">
          <div class="item-name">${h(item.name)}</div>
          <div class="item-meta">${fmt(item.totalAmount)} · ${getFreqLabel(item)}</div>
        </div>
        <div class="item-amount amount-periodic">${fmt(monthly)}/mån</div>
        ${canWithdraw ? `
        <div class="item-amount" style="color:var(--success);font-weight:600;">${fmt(available)}</div>
        ` : ''}
      </div>
    `;
  }).join('');

  const availableTotal = sum(state.data.periodic, i => calcPeriodicAvailable(i));

  return `
    <div class="card">
      <div class="card-header">
        <h2>Periodiska kostnader</h2>
        ${availableTotal > 0 ? `<span style="color:var(--success);font-weight:600;">${fmt(availableTotal)} tillgängligt</span>` : ''}
      </div>
      <div class="item-list">
        ${rows || emptySmall('Inga periodiska kostnader')}
      </div>
    </div>
  `;
}
