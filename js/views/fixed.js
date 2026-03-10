'use strict';

/* =============================================
   FIXED EXPENSES VIEW & CRUD
   ============================================= */

function renderFixed() {
  const el    = document.getElementById('view-fixed');
  const total = sum(state.data.fixed, i => i.amount);

  const sections = FIXED_CATEGORIES.map(cat => {
    const items = state.data.fixed.filter(i => i.category === cat.id);
    if (!items.length) return '';
    const catTotal = sum(items, i => i.amount);

    const rows = items.map(item => {
      const editFn     = item.type === 'mortgage' ? `editMortgage('${item.id}')` : `editFixed('${item.id}')`;
      const personBadge = item.person ? `<span class="badge badge-person">${h(PERSON_LABELS[item.person] ?? item.person)}</span>` : '';
      const shareBadge  = (item.share && item.share < 100) ? `<span class="badge badge-share">${item.share}%</span>` : '';
      const meta = item.type === 'mortgage'
        ? `${Math.round(item.loanAmount / 1000)}\u00a0kkr · ${(item.listRate - (item.rateDiscount || 0)).toFixed(2)}% · ${item.taxMode === 'after' ? 'inkl. skatterabatt' : 'exkl. skatterabatt'}`
        : `<span class="badge badge-${cat.id}">${h(cat.label)}</span> ${shareBadge} ${personBadge}`;
      return `
        <div class="item-row">
          <div class="item-icon" style="background:${cat.bg}">${cat.icon}</div>
          <div class="item-info">
            <div class="item-name">${h(item.name)}</div>
            <div class="item-meta">${meta}</div>
          </div>
          <div class="item-amount amount-expense">${fmt(item.amount)}</div>
          <div class="item-actions">
            <button class="btn-icon"        onclick="${editFn}"                         title="Redigera">${I.edit}</button>
            <button class="btn-icon danger" onclick="deleteItem('fixed','${item.id}')" title="Ta bort">${I.trash}</button>
          </div>
        </div>
      `;
    }).join('');

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
      <div><h1>Fasta kostnader</h1><p>Samma belopp varje månad</p></div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost" onclick="showAddMortgage()">🏠 Bolånekalkyl</button>
        <button class="btn btn-primary" onclick="showAddFixed()">${I.plus} Lägg till</button>
      </div>
    </div>

    ${total > 0 ? `
    <div class="summary-card sc-expense" style="margin-bottom:20px;">
      <div class="s-label">Totala fasta kostnader</div>
      <div class="s-amount">${fmt(total)}</div>
      <div class="s-sub">${state.data.fixed.length} poster &nbsp;·&nbsp; ${fmt(total * 12)} per år</div>
    </div>` : ''}

    ${sections || `<div class="card"><div class="item-list">${emptyState('📋', 'Inga fasta kostnader', 'Lägg till hyra, försäkringar, lån, streaming och annat som är fast.')}</div></div>`}
  `;
}

/* --- Fixed form helpers ------------------------------------------- */

function fixedForm(item) {
  const catOptions   = FIXED_CATEGORIES.map(c =>
    `<option value="${c.id}" ${item?.category === c.id ? 'selected' : ''}>${c.icon} ${c.label}</option>`
  ).join('');

  const storedShare  = item?.share  ?? 100;
  const storedPeriod = item?.period ?? 'month';
  const rawAmount    = item ? Math.round(item.amount / (storedShare / 100) * (storedPeriod === 'year' ? 12 : 1)) : '';

  return `
    <div class="form-group">
      <label class="form-label">Namn</label>
      <input type="text" id="f-name" class="form-input" placeholder="T.ex. Hemförsäkring, Billån" value="${h(item?.name ?? '')}">
    </div>

    <div class="form-row-2">
      <div class="form-group">
        <label class="form-label">Belopp (kr)</label>
        <input type="number" id="f-amount" class="form-input" placeholder="0" min="0" step="1" value="${rawAmount}">
      </div>
      <div class="form-group">
        <label class="form-label">Period</label>
        <select id="f-period" class="form-select">
          <option value="month" ${storedPeriod === 'month' ? 'selected' : ''}>Per månad</option>
          <option value="year"  ${storedPeriod === 'year'  ? 'selected' : ''}>Per år</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Min andel (%)</label>
      <div class="share-row">
        <input type="range"  id="f-share-range" min="1" max="100" step="1" value="${storedShare}" class="share-slider">
        <input type="number" id="f-share"       class="form-input share-input" min="1" max="100" step="1" value="${storedShare}">
        <span class="share-pct-label">%</span>
      </div>
      <div class="form-hint">Sätt lägre än 100% om du delar kostnaden med någon.</div>
    </div>

    <div id="fixed-preview" class="fixed-cost-preview" style="display:none;"></div>

    <div class="form-row-2">
      <div class="form-group">
        <label class="form-label">Kategori</label>
        <select id="f-cat" class="form-select">${catOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Gäller <span style="font-weight:400;color:var(--text-muted)">(valfritt)</span></label>
        <select id="f-person" class="form-select">
          <option value=""       ${!item?.person                ? 'selected' : ''}>— Välj person —</option>
          <option value="mig"    ${item?.person === 'mig'       ? 'selected' : ''}>👤 Mig</option>
          <option value="elias"  ${item?.person === 'elias'     ? 'selected' : ''}>👦 Elias</option>
          <option value="oliver" ${item?.person === 'oliver'    ? 'selected' : ''}>👦 Oliver</option>
          <option value="zoe"    ${item?.person === 'zoe'       ? 'selected' : ''}>🐶 Zoe</option>
          <option value="ovrigt" ${item?.person === 'ovrigt'    ? 'selected' : ''}>📦 Övrigt</option>
        </select>
      </div>
    </div>
  `;
}

function attachFixedPreview() {
  setTimeout(() => {
    function update() {
      const amount  = parseFloat(document.getElementById('f-amount')?.value)  || 0;
      const period  = document.getElementById('f-period')?.value  ?? 'month';
      const share   = parseFloat(document.getElementById('f-share')?.value)   || 100;
      const preview = document.getElementById('fixed-preview');
      if (!preview) return;

      const rangeEl = document.getElementById('f-share-range');
      if (rangeEl && document.activeElement !== rangeEl) rangeEl.value = share;

      if (amount > 0) {
        const monthly   = period === 'year' ? amount / 12 : amount;
        const myMonthly = monthly * (share / 100);
        const perYear   = period === 'year' ? amount : amount * 12;
        const myPerYear = perYear * (share / 100);
        preview.style.display = 'block';
        preview.innerHTML = `
          <div class="fcg-row"><span>Totalt ${period === 'year' ? 'per år' : 'per månad'}</span><span>${fmt(amount)}</span></div>
          ${share < 100 ? `<div class="fcg-row"><span>Din andel (${share}%)</span><span>${fmt(myMonthly)}/mån · ${fmt(myPerYear)}/år</span></div>` : ''}
          <div class="fcg-row highlight"><span>Din månadskostnad</span><span>${fmt(myMonthly)}</span></div>
        `;
      } else {
        preview.style.display = 'none';
      }
    }

    ['f-amount', 'f-period', 'f-share', 'f-share-range'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        if (id === 'f-share-range') {
          const n = document.getElementById('f-share');
          if (n) n.value = el.value;
        }
        if (id === 'f-share') {
          const r = document.getElementById('f-share-range');
          if (r) r.value = el.value;
        }
        update();
      });
    });
    update();
  }, 80);
}

function resolveFixedAmount() {
  const amount = parseFloat(document.getElementById('f-amount').value);
  const period = document.getElementById('f-period').value;
  const share  = parseFloat(document.getElementById('f-share').value) || 100;
  if (!(amount > 0)) return null;
  const monthly = period === 'year' ? amount / 12 : amount;
  return { monthly: Math.round(monthly * (share / 100) * 100) / 100, period, share };
}

function showAddFixed() {
  showModal('Lägg till fast kostnad', fixedForm(null), () => {
    const name     = document.getElementById('f-name').value.trim();
    const category = document.getElementById('f-cat').value;
    const person   = document.getElementById('f-person').value;
    const resolved = resolveFixedAmount();
    if (!name)     return notify('Ange ett namn.');
    if (!resolved) return notify('Ange ett giltigt belopp.');
    state.data.fixed.push({ id: genId(), name, amount: resolved.monthly, category, period: resolved.period, share: resolved.share, person });
    saveData(); closeModal(); renderFixed();
  });
  attachFixedPreview();
}

function editFixed(id) {
  const item = state.data.fixed.find(i => i.id === id);
  if (!item) return;
  showModal('Redigera fast kostnad', fixedForm(item), () => {
    const name     = document.getElementById('f-name').value.trim();
    const category = document.getElementById('f-cat').value;
    const resolved = resolveFixedAmount();
    const person   = document.getElementById('f-person').value;
    if (!name)     return notify('Ange ett namn.');
    if (!resolved) return notify('Ange ett giltigt belopp.');
    item.name = name; item.amount = resolved.monthly; item.category = category;
    item.period = resolved.period; item.share = resolved.share; item.person = person;
    saveData(); closeModal(); renderFixed();
  });
  attachFixedPreview();
}

/* --- Mortgage calculator ------------------------------------------- */

function mortgageForm(item) {
  return `
    <div class="form-group">
      <label class="form-label">Namn på lånet</label>
      <input type="text" id="f-name" class="form-input" placeholder="T.ex. Bolån Swedbank" value="${h(item?.name ?? '')}">
    </div>

    <div class="form-section-title">Låneuppgifter</div>
    <div class="form-row-2">
      <div class="form-group">
        <label class="form-label">Totalt lånebelopp (kr)</label>
        <input type="number" id="f-loan" class="form-input" placeholder="0" min="0" step="10000" value="${item?.loanAmount ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Värdering av bostad (kr)</label>
        <input type="number" id="f-valuation" class="form-input" placeholder="0" min="0" step="10000" value="${item?.valuation ?? ''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Kontantinsats (kr) <span style="font-weight:400;color:var(--text-muted)">(valfritt)</span></label>
      <input type="number" id="f-downpayment" class="form-input" placeholder="0" min="0" step="10000" value="${item?.downPayment ?? ''}">
      <div class="form-hint">Används för att visa total belåningsgrad av köpeskillingen.</div>
    </div>

    <div class="form-section-title">Ränteuppgifter</div>
    <div class="form-row-2">
      <div class="form-group">
        <label class="form-label">3 mån listränta (%)</label>
        <input type="number" id="f-listrate" class="form-input" placeholder="4.50" min="0" max="30" step="0.05" value="${item?.listRate ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Ränterabatt (%)</label>
        <input type="number" id="f-discount" class="form-input" placeholder="0.00" min="0" max="10" step="0.05" value="${item?.rateDiscount ?? '0'}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Buffertränta (%)</label>
      <input type="number" id="f-buffer" class="form-input" placeholder="1.00" min="0" max="10" step="0.05" value="${item?.bufferRate ?? '1'}">
      <div class="form-hint">Visar din kostnad om räntan höjs med detta antal procentenheter.</div>
    </div>

    <div id="mortgage-preview" class="mortgage-preview" style="display:none;"></div>

    <div id="tax-toggle-group" class="form-group" style="display:none;">
      <label class="form-label">Lägg till i månadsbudgeten som</label>
      <div class="radio-group">
        <label class="radio-label">
          <input type="radio" name="tax-mode" value="after" ${(!item || item.taxMode !== 'before') ? 'checked' : ''}>
          Inkl. skattereduktion <span style="font-weight:400;color:var(--text-muted)">(realistisk kostnad)</span>
        </label>
        <label class="radio-label">
          <input type="radio" name="tax-mode" value="before" ${item?.taxMode === 'before' ? 'checked' : ''}>
          Exkl. skattereduktion <span style="font-weight:400;color:var(--text-muted)">(försiktig kalkyl)</span>
        </label>
      </div>
    </div>
  `;
}

function attachMortgagePreview() {
  setTimeout(() => {
    const inputIds = ['f-loan', 'f-valuation', 'f-listrate', 'f-discount', 'f-buffer', 'f-downpayment'];

    function update() {
      const loan        = parseFloat(document.getElementById('f-loan')?.value)        || 0;
      const valuation   = parseFloat(document.getElementById('f-valuation')?.value)   || 0;
      const listRate    = parseFloat(document.getElementById('f-listrate')?.value)     || 0;
      const discount    = parseFloat(document.getElementById('f-discount')?.value)    || 0;
      const buffer      = parseFloat(document.getElementById('f-buffer')?.value)      || 0;
      const downPayment = parseFloat(document.getElementById('f-downpayment')?.value) || 0;
      const preview     = document.getElementById('mortgage-preview');
      const taxGroup    = document.getElementById('tax-toggle-group');
      if (!preview || !taxGroup) return;

      if (loan > 0 && valuation > 0 && listRate > 0) {
        const c = calcMortgage(loan, valuation, listRate, discount, buffer);
        const purchaseLtv = downPayment > 0 ? (loan / (loan + downPayment)) * 100 : null;
        const ltvRow = purchaseLtv !== null
          ? `<div class="mcg-row"><span>Belåningsgrad av köpeskilling</span><span>${purchaseLtv.toFixed(1)}%</span></div>`
          : '';
        preview.style.display = 'block';
        taxGroup.style.display = 'block';
        preview.innerHTML = `
          <div class="mcg-section">Beräknat</div>
          <div class="mcg-row"><span>Effektiv ränta</span><span><strong>${c.effectiveRate.toFixed(2)}%</strong></span></div>
          <div class="mcg-row"><span>Belåningsgrad mot värdering (LTV)</span><span>${c.ltv.toFixed(1)}%</span></div>
          ${ltvRow}
          <div class="mcg-row"><span>Amorteringskrav</span><span>${c.amortPct}% /år</span></div>
          <div class="mcg-section">Amortering</div>
          <div class="mcg-row highlight"><span>Amortering /mån</span><span>${fmt(c.monthlyAmort)}</span></div>
          <div class="mcg-section">Räntekostnad</div>
          <div class="mcg-row"><span>Ränta /mån (${c.effectiveRate.toFixed(2)}%)</span><span>${fmt(c.monthlyInterest)}</span></div>
          <div class="mcg-row success-row"><span>Skattereduktion /mån</span><span>− ${fmt(c.monthlyTaxReduction)}</span></div>
          <div class="mcg-row"><span>Ränta inkl. skattereduktion /mån</span><span>${fmt(c.monthlyInterestAfterTax)}</span></div>
          <div class="mcg-section">Total månadskostnad</div>
          <div class="mcg-row"><span>Exkl. skattereduktion</span><span><strong>${fmt(c.totalBeforeTax)}</strong></span></div>
          <div class="mcg-row em-row"><span>Inkl. skattereduktion</span><span>${fmt(c.totalAfterTax)}</span></div>
          <div class="mcg-row buffer-row"><span>Inkl. buffertränta (${c.bufferEffective.toFixed(2)}%)</span><span>${fmt(c.totalWithBuffer)}</span></div>
        `;
      } else {
        preview.style.display = 'none';
        taxGroup.style.display = 'none';
      }
    }

    inputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.addEventListener('input', update); el.addEventListener('change', update); }
    });
    update();
  }, 80);
}

function showAddMortgage() {
  showModal('Bolånekalkylator', mortgageForm(null), () => {
    const name         = document.getElementById('f-name').value.trim();
    const loanAmount   = parseFloat(document.getElementById('f-loan').value);
    const valuation    = parseFloat(document.getElementById('f-valuation').value);
    const listRate     = parseFloat(document.getElementById('f-listrate').value);
    const rateDiscount = parseFloat(document.getElementById('f-discount').value)     || 0;
    const bufferRate   = parseFloat(document.getElementById('f-buffer').value)       || 0;
    const downPayment  = parseFloat(document.getElementById('f-downpayment').value)  || 0;
    const taxMode      = document.querySelector('input[name="tax-mode"]:checked')?.value || 'after';

    if (!name)             return notify('Ange ett namn.');
    if (!(loanAmount > 0)) return notify('Ange lånebelopp.');
    if (!(valuation > 0))  return notify('Ange värdering av bostad.');
    if (!(listRate > 0))   return notify('Ange listränta.');

    const c      = calcMortgage(loanAmount, valuation, listRate, rateDiscount, bufferRate);
    const amount = Math.round(taxMode === 'after' ? c.totalAfterTax : c.totalBeforeTax);
    state.data.fixed.push({
      id: genId(), name, category: 'lan', type: 'mortgage',
      loanAmount, valuation, downPayment, listRate, rateDiscount, bufferRate, taxMode, amount,
    });
    saveData(); closeModal(); renderFixed();
  }, 'wide');
  attachMortgagePreview();
}

function editMortgage(id) {
  const item = state.data.fixed.find(i => i.id === id);
  if (!item) return;
  showModal('Redigera bolån', mortgageForm(item), () => {
    const name         = document.getElementById('f-name').value.trim();
    const loanAmount   = parseFloat(document.getElementById('f-loan').value);
    const valuation    = parseFloat(document.getElementById('f-valuation').value);
    const listRate     = parseFloat(document.getElementById('f-listrate').value);
    const rateDiscount = parseFloat(document.getElementById('f-discount').value)     || 0;
    const bufferRate   = parseFloat(document.getElementById('f-buffer').value)       || 0;
    const downPayment  = parseFloat(document.getElementById('f-downpayment').value)  || 0;
    const taxMode      = document.querySelector('input[name="tax-mode"]:checked')?.value || 'after';

    if (!name)             return notify('Ange ett namn.');
    if (!(loanAmount > 0)) return notify('Ange lånebelopp.');
    if (!(valuation > 0))  return notify('Ange värdering av bostad.');
    if (!(listRate > 0))   return notify('Ange listränta.');

    const c      = calcMortgage(loanAmount, valuation, listRate, rateDiscount, bufferRate);
    const amount = Math.round(taxMode === 'after' ? c.totalAfterTax : c.totalBeforeTax);
    Object.assign(item, { name, loanAmount, valuation, downPayment, listRate, rateDiscount, bufferRate, taxMode, amount });
    saveData(); closeModal(); renderFixed();
  }, 'wide');
  attachMortgagePreview();
}
