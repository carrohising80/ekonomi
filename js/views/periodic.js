'use strict';

/* =============================================
   PERIODIC COSTS VIEW & CRUD
   ============================================= */

function renderPeriodic() {
  const el           = document.getElementById('view-periodic');
  const monthlyTotal = sum(state.data.periodic, i => i.totalAmount / i.frequencyMonths);

  const rows = state.data.periodic.map(item => {
    const monthly = item.totalAmount / item.frequencyMonths;
    return `
      <div class="item-row">
        <div class="item-icon" style="background:var(--warning-bg)">📅</div>
        <div class="item-info">
          <div class="item-name">${h(item.name)}</div>
          <div class="item-meta">
            ${fmt(item.totalAmount)} · ${h(FREQ_LABELS[item.frequencyMonths] || 'periodiskt')}
            ${item.note ? ' · ' + h(item.note) : ''}
          </div>
        </div>
        <div style="text-align:right; margin-right:14px; white-space:nowrap;">
          <div style="font-size:14px; font-weight:600; color:var(--warning)">${fmt(monthly)}/mån</div>
          <div style="font-size:11px; color:var(--text-light)">avsätts</div>
        </div>
        <div class="item-actions">
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
  const freqOptions = [2, 3, 4, 6, 12, 24].map(m =>
    `<option value="${m}" ${item?.frequencyMonths === m ? 'selected' : m === 3 && !item ? 'selected' : ''}>${FREQ_LABELS[m]}</option>`
  ).join('');

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
    </div>
    <div class="form-group">
      <label class="form-label">Anteckning <span style="font-weight:400;color:var(--text-light)">(valfritt)</span></label>
      <input type="text" id="f-note" class="form-input" placeholder="T.ex. förfelodatum, period" value="${h(item?.note ?? '')}">
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
    const previewEl = document.getElementById('calc-preview');
    const spanEl    = document.getElementById('calc-amount');
    if (!amountEl || !freqEl) return;

    function update() {
      const a = parseFloat(amountEl.value);
      const f = parseInt(freqEl.value, 10);
      if (a > 0 && f > 0) {
        previewEl.style.display = 'block';
        spanEl.textContent = fmt(a / f);
      } else {
        previewEl.style.display = 'none';
      }
    }

    amountEl.addEventListener('input', update);
    freqEl.addEventListener('change', update);
    update();
  }, 80);
}

function showAddPeriodic() {
  showModal('Lägg till periodisk kostnad', periodicForm(null), () => {
    const name            = document.getElementById('f-name').value.trim();
    const totalAmount     = parseFloat(document.getElementById('f-amount').value);
    const frequencyMonths = parseInt(document.getElementById('f-freq').value, 10);
    const note            = document.getElementById('f-note').value.trim();
    if (!name)              return notify('Ange ett namn.');
    if (!(totalAmount > 0)) return notify('Ange ett giltigt belopp.');
    state.data.periodic.push({ id: genId(), name, totalAmount, frequencyMonths, note });
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
    const frequencyMonths = parseInt(document.getElementById('f-freq').value, 10);
    const note            = document.getElementById('f-note').value.trim();
    if (!name)              return notify('Ange ett namn.');
    if (!(totalAmount > 0)) return notify('Ange ett giltigt belopp.');
    item.name = name; item.totalAmount = totalAmount;
    item.frequencyMonths = frequencyMonths; item.note = note;
    saveData(); closeModal(); renderPeriodic();
  });
  attachPeriodicPreview();
}
