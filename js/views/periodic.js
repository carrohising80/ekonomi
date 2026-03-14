'use strict';

/* =============================================
   PERIODIC COSTS VIEW & CRUD
   ============================================= */

function renderPeriodic() {
  const el           = document.getElementById('view-periodic');
  
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
  
  const monthlyTotal = sum(state.data.periodic, i => getMonthlyAmount(i));
  const availableTotal = sum(state.data.periodic, i => calcPeriodicAvailable(i));

  const rows = state.data.periodic.map(item => {
    const monthly = getMonthlyAmount(item);
    const available = calcPeriodicAvailable(item);
    const monthsUntil = item.nextPayment ? getMonthsUntil(item.nextPayment) : 0;
    const canWithdraw = available > 0;
    
    return `
      <div class="item-row">
        <div class="item-icon" style="background:var(--warning-bg)">📅</div>
        <div class="item-info">
          <div class="item-name">${h(item.name)}</div>
          <div class="item-meta">
            ${fmt(item.totalAmount)} · ${getFreqLabel(item)}
            ${item.nextPayment ? ' · Nästa: ' + new Date(item.nextPayment).toLocaleDateString('sv-SE') : ''}
            ${item.note ? ' · ' + h(item.note) : ''}
          </div>
        </div>
        <div style="text-align:right; margin-right:14px; white-space:nowrap;">
          <div style="font-size:14px; font-weight:600; color:var(--warning)">${fmt(monthly)}/mån</div>
          <div style="font-size:11px; color:var(--text-light)">avsätts</div>
        </div>
        ${canWithdraw ? `
        <div style="text-align:right; margin-right:14px; white-space:nowrap;">
          <div style="font-size:14px; font-weight:600; color:var(--success)">${fmt(available)}</div>
          <div style="font-size:11px; color:var(--text-light)">kan ta ut</div>
        </div>
        ` : ''}
        <div class="item-actions">
          ${monthsUntil <= 0 ? `
          <button class="btn-icon" style="color:var(--success);" onclick="markPeriodicPaid('${item.id}')" title="Markera som betald">${I.check}</button>
          ` : ''}
          <button class="btn-icon"        onclick="editPeriodic('${item.id}')"           title="Redigera">${I.edit}</button>
          <button class="btn-icon danger" onclick="deleteItem('periodic','${item.id}')" title="Ta bort">${I.trash}</button>
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div class="view-header">
      <div><h1>Periodiska kostnader</h1><p>Kostnader som inte dyker upp varje månad</p></div>
      <button class="btn btn-primary" onclick="showAddPeriodic()">${I.plus} Lägg till</button>
    </div>

    ${monthlyTotal > 0 ? `
    <div class="savings-banner">
      <span class="sb-icon">💡</span>
      <span class="sb-text">Sätt undan totalt <strong>${fmt(monthlyTotal)}</strong> per månad för att täcka alla periodiska kostnader.</span>
    </div>` : ''}

    ${availableTotal > 0 ? `
    <div class="savings-banner" style="background:var(--success-bg);color:var(--success);">
      <span class="sb-icon">💰</span>
      <span class="sb-text">Du har <strong>${fmt(availableTotal)}</strong> tillgängligt att ta ut från dina periodiska sparkonton.</span>
    </div>` : ''}

    <div class="card">
      <div class="item-list">
        ${rows || emptyState('📅', 'Inga periodiska kostnader', 'Lägg till kostnader som inte är varje månad – t.ex. bilservice, semester, årsavgifter och kvartalsskattar.')}
      </div>
    </div>

    ${state.data.periodic.length > 0 ? `
    <div class="info-box" style="margin-top:16px;">
      <strong>Hur fungerar det?</strong>
      Appen räknar ut ditt periodiska sparande per månad. Det beloppet syns i Översikten och dras av
      från "Kvar att röra sig med" – så du alltid har pengar när den stora fakturan dyker upp.
    </div>` : ''}
  `;
}

function periodicForm(item) {
  const isCustomDays = item?.frequencyType === 'days';
  const freqOptions = `
    <option value="2" ${item?.frequencyMonths === 2 ? 'selected' : ''}>varannan månad</option>
    <option value="3" ${item?.frequencyMonths === 3 ? 'selected' : ''}>var 3:e månad</option>
    <option value="4" ${item?.frequencyMonths === 4 && !isCustomDays ? 'selected' : ''}>var 4:e månad</option>
    <option value="6" ${item?.frequencyMonths === 6 ? 'selected' : ''}>var 6:e månad</option>
    <option value="12" ${item?.frequencyMonths === 12 && !isCustomDays ? 'selected' : ''}>en gång per år</option>
    <option value="24" ${item?.frequencyMonths === 24 ? 'selected' : ''}>vartannat år</option>
    <option value="custom" ${isCustomDays ? 'selected' : ''}>egen (antal dagar)</option>
  `.replace(/\n/g, '');

  const nextPaymentVal = item?.nextPayment 
    ? item.nextPayment.slice(0, 10) 
    : new Date().toISOString().slice(0, 10);

  const customDaysVal = item?.frequencyDays || '';

  return `
    <div class="form-group">
      <label class="form-label">Namn</label>
      <input type="text" id="f-name" class="form-input" placeholder="T.ex. Bilservice, Semesterkassa, Årsavgift" value="${h(item?.name ?? '')}">
    </div>
    <div class="form-group">
      <label class="form-label">Belopp per tillfälle (kr)</label>
      <input type="number" id="f-amount" class="form-input" placeholder="0" min="0" step="1" value="${item?.totalAmount ?? ''}">
    </div>
    <div class="form-group">
      <label class="form-label">Hur ofta?</label>
      <select id="f-freq" class="form-select">${freqOptions}</select>
      <div id="custom-days-group" style="margin-top:8px;${isCustomDays ? '' : 'display:none;'}">
        <input type="number" id="f-days" class="form-input" placeholder="Antal dagar" min="1" value="${customDaysVal}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Nästa betalning <span style="font-weight:400;color:var(--text-light)">(datum)</span></label>
      <input type="date" id="f-next" class="form-input" value="${nextPaymentVal}">
    </div>
    <div class="form-group">
      <label class="form-label">Anteckning <span style="font-weight:400;color:var(--text-light)">(valfritt)</span></label>
      <input type="text" id="f-note" class="form-input" placeholder="T.ex. förfalodatum, period" value="${h(item?.note ?? '')}">
    </div>
    <div class="calc-preview" id="calc-preview">
      Sätt undan <span id="calc-amount">–</span> per månad
    </div>
  `;
}

function attachPeriodicPreview() {
  setTimeout(() => {
    const amountEl  = document.getElementById('f-amount');
    const freqEl    = document.getElementById('f-freq');
    const daysGroup = document.getElementById('custom-days-group');
    const daysEl    = document.getElementById('f-days');
    const previewEl = document.getElementById('calc-preview');
    const spanEl    = document.getElementById('calc-amount');
    if (!amountEl || !freqEl) return;

    function update() {
      const a = parseFloat(amountEl.value);
      const f = freqEl.value;
      const isCustom = f === 'custom';
      const days = parseInt(daysEl?.value, 10);
      
      if (daysGroup) {
        daysGroup.style.display = isCustom ? 'block' : 'none';
      }
      
      if (a > 0) {
        let monthly;
        if (isCustom && days > 0) {
          monthly = (a / days) * 30.44;
        } else if (!isCustom && parseInt(f, 10) > 0) {
          monthly = a / parseInt(f, 10);
        }
        
        if (monthly !== undefined) {
          previewEl.style.display = 'block';
          spanEl.textContent = fmt(monthly);
        } else {
          previewEl.style.display = 'none';
        }
      } else {
        previewEl.style.display = 'none';
      }
    }

    amountEl.addEventListener('input', update);
    freqEl.addEventListener('change', update);
    if (daysEl) daysEl.addEventListener('input', update);
    update();
  }, 80);
}

function showAddPeriodic() {
  showModal('Lägg till periodisk kostnad', periodicForm(null), () => {
    const name            = document.getElementById('f-name').value.trim();
    const totalAmount     = parseFloat(document.getElementById('f-amount').value);
    const freqVal        = document.getElementById('f-freq').value;
    const nextPayment    = document.getElementById('f-next').value;
    const note           = document.getElementById('f-note').value.trim();
    
    if (!name)              return notify('Ange ett namn.');
    if (!(totalAmount > 0)) return notify('Ange ett giltigt belopp.');
    
    let frequencyMonths, frequencyDays, frequencyType;
    if (freqVal === 'custom') {
      frequencyDays = parseInt(document.getElementById('f-days').value, 10);
      if (!frequencyDays || frequencyDays < 1) return notify('Ange antal dagar.');
      frequencyMonths = Math.round(frequencyDays / 30.44);
      frequencyType = 'days';
    } else {
      frequencyMonths = parseInt(freqVal, 10);
      frequencyDays = null;
      frequencyType = 'months';
    }
    
    state.data.periodic.push({ id: genId(), name, totalAmount, frequencyMonths, frequencyDays, frequencyType, nextPayment, note });
    saveData(); closeModal(); renderPeriodic();
  });
  attachPeriodicPreview();
}

function editPeriodic(id) {
  const item = state.data.periodic.find(i => i.id === id);
  if (!item) return;
  showModal('Redigera periodisk kostnad', periodicForm(item), () => {
    const name            = document.getElementById('f-name').value.trim();
    const totalAmount     = parseFloat(document.getElementById('f-amount').value);
    const freqVal        = document.getElementById('f-freq').value;
    const nextPayment    = document.getElementById('f-next').value;
    const note           = document.getElementById('f-note').value.trim();
    
    if (!name)              return notify('Ange ett namn.');
    if (!(totalAmount > 0)) return notify('Ange ett giltigt belopp.');
    
    let frequencyMonths, frequencyDays, frequencyType;
    if (freqVal === 'custom') {
      frequencyDays = parseInt(document.getElementById('f-days').value, 10);
      if (!frequencyDays || frequencyDays < 1) return notify('Ange antal dagar.');
      frequencyMonths = Math.round(frequencyDays / 30.44);
      frequencyType = 'days';
    } else {
      frequencyMonths = parseInt(freqVal, 10);
      frequencyDays = null;
      frequencyType = 'months';
    }
    
    item.name = name; 
    item.totalAmount = totalAmount;
    item.frequencyMonths = frequencyMonths; 
    item.frequencyDays = frequencyDays;
    item.frequencyType = frequencyType;
    item.nextPayment = nextPayment;
    item.note = note;
    saveData(); closeModal(); renderPeriodic();
  });
  attachPeriodicPreview();
}

function calcPeriodicAvailable(item) {
  if (!item.nextPayment) return 0;
  
  const now = new Date();
  const next = new Date(item.nextPayment);
  
  let monthly, frequencyDays;
  if (item.frequencyType === 'days' && item.frequencyDays) {
    frequencyDays = item.frequencyDays;
    monthly = item.totalAmount / frequencyDays * 30.44;
  } else {
    frequencyDays = item.frequencyMonths * 30.44;
    monthly = item.totalAmount / item.frequencyMonths;
  }
  
  const daysUntil = (next - now) / (1000 * 60 * 60 * 24);
  const daysSinceStart = frequencyDays - daysUntil;
  if (daysSinceStart <= 0) return 0;
  
  const available = Math.min(daysSinceStart / frequencyDays * item.totalAmount, item.totalAmount);
  return Math.max(0, available);
}

function getMonthsUntil(dateStr) {
  const now = new Date();
  const target = new Date(dateStr);
  return (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
}

function markPeriodicPaid(id) {
  const item = state.data.periodic.find(i => i.id === id);
  if (!item) return;
  
  const next = new Date(item.nextPayment);
  
  if (item.frequencyType === 'days' && item.frequencyDays) {
    next.setDate(next.getDate() + item.frequencyDays);
  } else {
    next.setMonth(next.getMonth() + item.frequencyMonths);
  }
  
  item.nextPayment = next.toISOString().slice(0, 10);
  saveData();
  renderPeriodic();
  notify('Nästa betalning satt till ' + next.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' }));
}
