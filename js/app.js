'use strict';

/* =============================================
   SUPABASE CLIENT
   ============================================= */

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =============================================
   CONSTANTS & CONFIG
   ============================================= */

const FIXED_CATEGORIES = [
  { id: 'bostad', label: 'Bostad', icon: '🏠', bg: '#EFF6FF' },
  { id: 'forsakring', label: 'Försäkringar', icon: '🛡️', bg: '#F5F3FF' },
  { id: 'lan', label: 'Lån & krediter', icon: '💳', bg: '#FFF7ED' },
  { id: 'transport', label: 'Transport', icon: '🚗', bg: '#ECFDF5' },
  { id: 'streaming', label: 'Streaming & appar', icon: '📺', bg: '#FDF4FF' },
  { id: 'abonnemang', label: 'Övriga abonnemang', icon: '📱', bg: '#F0F9FF' },
  { id: 'sparande', label: 'Besparingar & investeringar', icon: '💰', bg: '#F0FDF4' },
  { id: 'annat', label: 'Övrigt fast', icon: '📌', bg: '#F3F4F6' },
];

const VARIABLE_CATEGORIES = [
  { id: 'mat', label: 'Mat & dagligvaror', icon: '🛒', bg: '#F0FDF4' },
  { id: 'transport', label: 'Transport & bil', icon: '🚗', bg: '#EFF6FF' },
  { id: 'noje', label: 'Nöje & fritid', icon: '🎭', bg: '#FDF4FF' },
  { id: 'halsa', label: 'Hälsa & träning', icon: '💪', bg: '#F0FDF4' },
  { id: 'klader', label: 'Kläder & skönhet', icon: '👗', bg: '#FFF7ED' },
  { id: 'barn', label: 'Barn', icon: '👶', bg: '#FFF7ED' },
  { id: 'annat', label: 'Övrigt rörligt', icon: '📦', bg: '#F3F4F6' },
];

const FREQ_LABELS = {
  1: 'varje månad',
  2: 'varannan månad',
  3: 'var 3:e månad',
  4: 'var 4:e månad',
  6: 'var 6:e månad',
  12: 'en gång per år',
  24: 'vartannat år',
};

/* =============================================
   STATE
   ============================================= */

const state = {
  view: 'dashboard',
  month: new Date().toISOString().substring(0, 7), // 'YYYY-MM'
  data: newData(),
  userId: null,
};

function newData() {
  return { months: {} };
}

function newMonthData() {
  return { income: [], fixed: [], variable: [], periodic: [] };
}

// Returns current month's data for reading. Falls back to empty placeholder.
function md() {
  return state.data.months[state.month] || newMonthData();
}

// Creates the current month if missing, returns it. Use before any write.
function ensureMonth() {
  if (!state.data.months[state.month]) {
    state.data.months[state.month] = newMonthData();
  }
  return state.data.months[state.month];
}

/* =============================================
   STORAGE (Supabase)
   ============================================= */

async function saveData() {
  if (!state.userId) return;
  const { error } = await db
    .from('budget')
    .upsert(
      { user_id: state.userId, data: state.data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) console.warn('Kunde inte spara data:', error.message);
}

async function loadData() {
  if (!state.userId) return;
  const { data, error } = await db
    .from('budget')
    .select('data')
    .eq('user_id', state.userId)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.warn('Kunde inte läsa data:', error.message);
    return;
  }
  if (data?.data) {
    const loaded = data.data;
    // Migration: convert old flat format { income, fixed, variable, periodic } → { months: { 'YYYY-MM': ... } }
    if (Array.isArray(loaded.income) && !loaded.months) {
      const m = new Date().toISOString().substring(0, 7);
      state.data = {
        months: {
          [m]: {
            income: loaded.income || [],
            fixed: loaded.fixed || [],
            variable: loaded.variable || [],
            periodic: loaded.periodic || [],
          }
        }
      };
    } else {
      state.data = { months: {}, ...loaded };
    }
  }
}

/* =============================================
   AUTH
   ============================================= */

let appInitialized = false;

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');

  if (!email || !password) {
    errEl.textContent = 'Fyll i e-post och lösenord.';
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Loggar in…';
  errEl.classList.add('hidden');

  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    errEl.textContent = 'Fel e-post eller lösenord.';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Logga in';
  }
}

function initApp() {
  if (appInitialized) { render(); return; }
  appInitialized = true;

  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });

  document.getElementById('btn-export').addEventListener('click', exportJSON);
  document.getElementById('btn-signout').addEventListener('click', () => db.auth.signOut());
  document.getElementById('btn-clear-month').addEventListener('click', clearCurrentMonth);

  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  render();
}

/* =============================================
   UTILITIES
   ============================================= */

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmt(n) {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n) + '\u00a0kr';
}

// Escape user-supplied strings before inserting as HTML
function h(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCat(list, id) {
  return list.find(c => c.id === id) || list[list.length - 1];
}

/* =============================================
   CALCULATIONS
   ============================================= */

function calcTotals() {
  const m = md();
  const income = sum(m.income, i => i.amount);
  const fixed = sum(m.fixed, i => i.amount);
  const variable = sum(m.variable, i => i.budget);
  const periodicMonthly = sum(m.periodic, i => {
    if (i.frequencyType === 'days' && i.frequencyDays) {
      return (i.totalAmount / i.frequencyDays) * 30.44;
    }
    return i.totalAmount / i.frequencyMonths;
  });
  const totalOut = fixed + variable + periodicMonthly;
  const remaining = income - totalOut;
  return { income, fixed, variable, periodicMonthly, totalOut, remaining };
}

/* Month helpers */
function fmtYYYYMM(d) {
  return d.toISOString().substring(0, 7);
}

function prevMonth() {
  const [y, m] = state.month.split('-').map(Number);
  state.month = fmtYYYYMM(new Date(y, m - 2, 15));
  render();
}

function nextMonth() {
  const [y, m] = state.month.split('-').map(Number);
  state.month = fmtYYYYMM(new Date(y, m, 15));
  render();
}

function periodicFallsInMonth(item, yyyyMm) {
  if (!item.paymentMonth) return false;
  const [ny, nm] = item.paymentMonth.split('-').map(Number);
  const [ty, tm] = yyyyMm.split('-').map(Number);
  const diff = (ty - ny) * 12 + (tm - nm);
  return diff % item.frequencyMonths === 0;
}

function calcMonthTotals(yyyyMm) {
  const m = state.data.months[yyyyMm] || newMonthData();
  const income = sum(m.income, i => i.amount);
  const fixed = sum(m.fixed, i => myShare(i.amount, i));
  const variable = sum(m.variable, i => myShare(i.budget, i));

  // Calculate total monthly savings for ALL periodic items (not just undated)
  const periodicMonthlySavings = sum(m.periodic, i => {
    const myAmount = i.totalAmount * ((i.share ?? 100) / 100);
    if (i.frequencyType === 'days' && i.frequencyDays) {
      return (myAmount / i.frequencyDays) * 30.44;
    }
    return myAmount / i.frequencyMonths;
  });

  // What's due this month specifically
  const datedItems = m.periodic.filter(i => i.paymentMonth);
  const periodicThisMonth = sum(datedItems.filter(i => periodicFallsInMonth(i, yyyyMm)), i => i.totalAmount * ((i.share ?? 100) / 100));

  // Total: only count the monthly savings (not both)
  const totalOut = fixed + variable + periodicMonthlySavings;
  const andreasNet = calcAndreasNet(m); // positive = you owe Andreas
  const remaining = income - totalOut - Math.max(0, andreasNet);
  return { income, fixed, variable, periodicThisMonth, periodicAverage: periodicMonthlySavings, totalOut, andreasNet, remaining };
}

// Returns the net amount owed between Carro and Andreas for a given month's data.
// Positive = Carro owes Andreas, negative = Andreas owes Carro.
function calcAndreasNet(m) {
  const fixedItems = (m.fixed || []).filter(i => i.splitWith);
  const variableItems = (m.variable || []).filter(i => i.splitWith);
  const allItems = [
    ...fixedItems.map(i => ({ splitWith: i.splitWith, splitShare: i.splitShare, _amount: i.amount })),
    ...variableItems.map(i => ({ splitWith: i.splitWith, splitShare: i.splitShare, _amount: i.budget })),
  ];
  const andreasOwes = sum(allItems.filter(i => i.splitWith !== 'andreas'), i => i._amount * ((i.splitShare ?? 100) / 100));
  const youOwe = sum(allItems.filter(i => i.splitWith === 'andreas'), i => i._amount * ((100 - (i.splitShare ?? 100)) / 100));
  return youOwe - andreasOwes;
}

function sum(arr, fn) {
  return arr.reduce((s, x) => s + (fn(x) || 0), 0);
}

// Returns the share of `amount` that I (Carro) pay, after accounting for Andreas's portion.
// splitShare = how much % Andreas pays. My share = remaining %.
function myShare(amount, item) {
  if (!item.splitWith) return amount;
  return amount * ((100 - (item.splitShare ?? 100)) / 100);
}

// Returns HTML for the debit day + month-offset control pair
function debitDayHtml(item) {
  const day = item?.debitDay ?? '';
  const off = item?.debitMonthOffset ?? 0;
  return `
    <div class="form-group">
      <label class="form-label">Dragningsdatum <span style="font-weight:400;color:var(--text-muted)">(valfritt)</span></label>
      <div class="form-row-2">
        <div>
          <input type="number" id="f-debit-day" class="form-input" placeholder="Dag, t.ex. 25" min="1" max="31" step="1" value="${day}">
        </div>
        <div>
          <select id="f-debit-offset" class="form-select">
            <option value="0"  ${off === 0 ? 'selected' : ''}>Samma månad</option>
            <option value="-1" ${off === -1 ? 'selected' : ''}>Månaden innan</option>
            <option value="-2" ${off === -2 ? 'selected' : ''}>2 månader innan</option>
          </select>
        </div>
      </div>
      <div class="form-hint">T.ex. dag 25 + månaden innan = dras 25 feb för mars-budgeten.</div>
    </div>`;
}

// Returns a display string like "Drag. 25 feb (för mar)" given the budget month "2026-03"
function debitStr(item, budgetMonth) {
  if (!item?.debitDay) return '';
  const day = item.debitDay;
  const off = item.debitMonthOffset ?? 0;
  if (off === 0) {
    const monthLabel = budgetMonth
      ? new Intl.DateTimeFormat('sv-SE', { month: 'long' }).format(new Date(budgetMonth + '-01'))
      : 'denna månad';
    return ` · Dras dag ${day} i ${monthLabel}`;
  }
  // Compute the actual calendar month from budgetMonth (YYYY-MM) + offset
  if (!budgetMonth) return ` · Dras dag ${day}${off < 0 ? ' (mån innan)' : ''}`;
  const [y, m] = budgetMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + off, 1);
  const label = new Intl.DateTimeFormat('sv-SE', { month: 'long' }).format(d);
  return ` · Dras ${day} ${label}`;
}


function calcMortgage(loanAmount, valuation, listRate, rateDiscount, bufferRate) {
  const effectiveRate = Math.max(0, listRate - rateDiscount);
  const ltv = valuation > 0 ? (loanAmount / valuation) * 100 : 0;

  let amortPct = 0;
  if (ltv > 70) amortPct = 2;
  else if (ltv > 50) amortPct = 1;

  const monthlyAmort = (loanAmount * amortPct / 100) / 12;
  const yearlyInterest = loanAmount * (effectiveRate / 100);
  const monthlyInterest = yearlyInterest / 12;

  // Swedish tax reduction: 30% on first 100 000 kr/year, 21% above
  const yearlyTaxReduction = yearlyInterest <= 100000
    ? yearlyInterest * 0.30
    : 100000 * 0.30 + (yearlyInterest - 100000) * 0.21;
  const monthlyTaxReduction = yearlyTaxReduction / 12;
  const monthlyInterestAfterTax = monthlyInterest - monthlyTaxReduction;

  const bufferEffective = effectiveRate + Math.max(0, bufferRate);
  const monthlyInterestBuffer = loanAmount * (bufferEffective / 100) / 12;

  return {
    effectiveRate, ltv, amortPct,
    monthlyAmort, monthlyInterest, monthlyTaxReduction,
    monthlyInterestAfterTax, bufferEffective, monthlyInterestBuffer,
    totalBeforeTax: monthlyAmort + monthlyInterest,
    totalAfterTax: monthlyAmort + monthlyInterestAfterTax,
    totalWithBuffer: monthlyAmort + monthlyInterestBuffer,
  };
}
/* =============================================
   MONTH HELPERS
   ============================================= */

function monthLabel(yyyyMm) {
  const label = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' })
    .format(new Date(yyyyMm + '-15'));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function monthNavHtml() {
  const isCurrentMonth = state.month === new Date().toISOString().substring(0, 7);
  return `
    <div class="month-nav">
      <button class="month-nav-btn" onclick="prevMonth()" title="Föregående månad">&#8249;</button>
      <span class="month-nav-label">${h(monthLabel(state.month))}</span>
      <button class="month-nav-btn" onclick="nextMonth()" title="Nästa månad">&#8250;</button>
      ${!isCurrentMonth ? `<button class="btn btn-ghost" style="padding:2px 10px;font-size:12px;" onclick="state.month=new Date().toISOString().substring(0,7);render()">Idag</button>` : ''}
    </div>`;
}

function isMonthEmpty() {
  const m = state.data.months[state.month];
  if (!m) return true;
  return !m.income.length && !m.fixed.length && !m.variable.length && !m.periodic.length;
}

function noMonthHtml() {
  const months = Object.keys(state.data.months).sort().reverse();
  const [y, mo] = state.month.split('-').map(Number);
  const prevM = fmtYYYYMM(new Date(y, mo - 2, 15));
  const hasPrev = !!state.data.months[prevM];
  const quickBtn = hasPrev
    ? `<button class="btn btn-primary" onclick="copyFromMonth('${prevM}')">Kopiera från ${monthLabel(prevM)}</button>`
    : '';
  const selectBtn = months.length > 0
    ? `<button class="btn btn-${hasPrev ? 'ghost' : 'primary'}" onclick="showCreateMonthModal()">📋 Välj vilken månad att kopiera</button>`
    : `<button class="btn btn-primary" onclick="createEmptyMonth()">+ Skapa tom månad</button>`;
  return `
    <div style="text-align:center; padding:48px 24px;">
      <div style="font-size:48px; margin-bottom:16px;">📅</div>
      <h2 style="margin-bottom:8px;">Ingen data för ${h(monthLabel(state.month))}</h2>
      <p style="color:var(--text-muted); margin-bottom:24px;">Skapa den här månaden för att börja lägga till inkomster och kostnader.</p>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
        ${quickBtn}
        ${selectBtn}
      </div>
    </div>`;
}

function showCreateMonthModal() {
  const months = Object.keys(state.data.months).sort().reverse();
  if (!months.length) { createEmptyMonth(); return; }
  const options = months.map(m =>
    `<option value="${m}">${monthLabel(m)}</option>`
  ).join('');
  showModal(`Skapa ${monthLabel(state.month)}`, `
    <p style="margin-bottom:16px;">Välj en månad att kopiera som startpunkt för <strong>${h(monthLabel(state.month))}</strong>:</p>
    <div class="form-group">
      <label class="form-label">Kopiera inkomster, kostnader och budgetar från</label>
      <select id="f-copy-from" class="form-select">
        <option value="">— Starta med tom månad —</option>
        ${options}
      </select>
    </div>`, () => {
    const from = document.getElementById('f-copy-from').value;
    from ? copyFromMonth(from) : createEmptyMonth();
    closeModal();
  });
}

function copyFromMonth(fromMonth) {
  const source = state.data.months[fromMonth];
  if (!source) return;
  const copy = JSON.parse(JSON.stringify(source));
  const [ty, tm] = state.month.split('-').map(Number);

  ['income', 'fixed', 'variable'].forEach(k => {
    copy[k] = copy[k].map(item => ({ ...item, id: genId() }));
  });

  // For periodic items: advance paymentMonth to next occurrence on or after toMonth
  copy.periodic = copy.periodic.map(item => {
    item = { ...item, id: genId() };
    if (!item.paymentMonth || !item.frequencyMonths) return item;
    const [py, pm] = item.paymentMonth.split('-').map(Number);
    const diff = (ty - py) * 12 + (tm - pm);
    if (diff <= 0) return item;
    const cyclesNeeded = Math.ceil(diff / item.frequencyMonths);
    const newMonthsAhead = cyclesNeeded * item.frequencyMonths;
    const newDate = new Date(py, pm - 1 + newMonthsAhead, 15);
    item.paymentMonth = fmtYYYYMM(newDate);
    return item;
  });

  state.data.months[state.month] = copy;
  saveData(); render();
}

function createEmptyMonth() {
  state.data.months[state.month] = newMonthData();
  saveData(); render();
}

function clearCurrentMonth() {
  const m = state.month;
  if (!m || !state.data.months || !state.data.months[m]) {
    notify('Ingen månad vald eller data saknas.');
    return;
  }

  // Safety: block deletion if this is the only month with data
  const monthsWithData = Object.keys(state.data.months).filter(key => {
    const md = state.data.months[key];
    return (md.income?.length || 0) + (md.fixed?.length || 0) +
           (md.variable?.length || 0) + (md.periodic?.length || 0) > 0;
  });
  if (monthsWithData.length === 1 && monthsWithData[0] === m) {
    const label = new Date(m + '-15').toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
    showModal('Kan inte tömma månad', `
      <p style="margin-bottom:16px;"><strong>${label}</strong> är den enda månaden med data.</p>
      <p style="color:var(--text-light);font-size:14px;margin-bottom:20px;">
        Du kan inte ta bort den sista månaden med data. Kopiera den till en ny månad först.
      </p>
      <div style="display:flex;justify-content:flex-end;">
        <button class="btn" onclick="closeModal()">OK</button>
      </div>
    `, () => {});
    return;
  }

  const monthData = state.data.months[m];
  const incomeCount = monthData.income?.length || 0;
  const fixedCount = monthData.fixed?.length || 0;
  const variableCount = monthData.variable?.length || 0;
  const periodicCount = monthData.periodic?.length || 0;
  const totalCount = incomeCount + fixedCount + variableCount + periodicCount;

  if (totalCount === 0) {
    notify('Det finns inga poster att ta bort för denna månad.');
    return;
  }

  const label = new Date(m + '-15').toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });

  showModal('Töm månad', `
    <p style="margin-bottom:16px;">Vill du verkligen ta bort alla poster för <strong>${label}</strong>?</p>
    <p style="color:var(--text-light);font-size:14px;margin-bottom:20px;">
      ${incomeCount} inkomster, ${fixedCount} fasta kostnader, ${variableCount} rörliga kostnader, ${periodicCount} periodiska kostnader kommer att raderas.
    </p>
    <div style="display:flex;gap:12px;">
      <button class="btn" onclick="closeModal()" style="flex:1;">Avbryt</button>
      <button class="btn btn-danger" onclick="confirmClearMonth()" style="flex:1;">Ja, ta bort</button>
    </div>
  `, () => { });
}

function confirmClearMonth() {
  const m = state.month;
  state.data.months[m] = newMonthData();
  saveData();
  closeModal();
  render();
  notify('Alla poster för denna månad har raderats.');
}

/* =============================================
   ICONS (inline SVGs)
   ============================================= */

const I = {
  plus: '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
};

/* =============================================
   RENDER ROUTER
   ============================================= */

function render() {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.remove('active'));

  document.getElementById('view-' + state.view).classList.add('active');
  const navBtn = document.querySelector('[data-view="' + state.view + '"]');
  if (navBtn) navBtn.classList.add('active');

  const renderers = {
    dashboard: renderDashboard,
    income: renderIncome,
    fixed: renderFixed,
    variable: renderVariable,
    periodic: renderPeriodic,
  };

  if (renderers[state.view]) renderers[state.view]();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* =============================================
   DASHBOARD
   ============================================= */

function renderDashboard() {
  const yyyyMm = state.month;
  const el = document.getElementById('view-dashboard');

  if (!state.data.months[yyyyMm] || isMonthEmpty()) {
    el.innerHTML = `
      <div class="view-header"><div><h1>Översikt</h1>${monthNavHtml()}</div></div>
      ${noMonthHtml()}`;
    return;
  }

  const t = calcMonthTotals(yyyyMm);
  const neg = t.remaining < 0;
  const isCurrentMonth = yyyyMm === new Date().toISOString().substring(0, 7);

  const monthLabel = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' })
    .format(new Date(yyyyMm + '-15'));
  const monthTitle = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  // Periodic breakdown row: show both what to pay this month AND what to save monthly
  const periodicPayRow = t.periodicThisMonth > 0 ? `
    <div class="rc-breakdown-row">
      <span class="rbl">Periodiskt att betala</span>
      <span class="rba">− ${fmt(t.periodicThisMonth)}</span>
    </div>` : '';
  const periodicSaveRow = t.periodicAverage > 0 ? `
    <div class="rc-breakdown-row">
      <span class="rbl">Periodiskt att spara</span>
      <span class="rba">− ${fmt(t.periodicAverage)}</span>
    </div>` : '';
  const andreasRow = t.andreasNet > 0 ? `
    <div class="rc-breakdown-row">
      <span class="rbl">Skuld till Andreas</span>
      <span class="rba">− ${fmt(t.andreasNet)}</span>
    </div>` : '';

  el.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Översikt</h1>
        <div class="month-nav">
          <button class="month-nav-btn" onclick="prevMonth()" title="Föregående månad">&#8249;</button>
          <span class="month-nav-label">${h(monthTitle)}</span>
          <button class="month-nav-btn" onclick="nextMonth()" title="Nästa månad">&#8250;</button>
          ${!isCurrentMonth ? `<button class="btn btn-ghost" style="padding:2px 10px;font-size:12px;" onclick="state.month=new Date().toISOString().substring(0,7);render()">Idag</button>` : ''}
        </div>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-card sc-income" style="cursor:pointer;" onclick="navigate('income')">
        <div class="s-label">Inkomster</div>
        <div class="s-amount">${fmt(t.income)}</div>
        <div class="s-sub">${md().income.length} källa${md().income.length !== 1 ? 'r' : ''}</div>
      </div>
      <div class="summary-card sc-expense" style="cursor:pointer;" onclick="navigate('fixed')">
        <div class="s-label">Fasta kostnader</div>
        <div class="s-amount">${fmt(t.fixed)}</div>
        <div class="s-sub">${md().fixed.length} poster</div>
      </div>
      <div class="summary-card sc-variable" style="cursor:pointer;" onclick="navigate('variable')">
        <div class="s-label">Rörliga (budget)</div>
        <div class="s-amount">${fmt(t.variable)}</div>
        <div class="s-sub">${md().variable.length} poster</div>
      </div>
      <div class="summary-card sc-periodic" style="cursor:pointer;" onclick="navigate('periodic')">
        <div class="s-label">Periodiskt denna mån</div>
        <div class="s-amount">${fmt(t.periodicThisMonth)}</div>
        <div class="s-sub">att betala nu</div>
      </div>
      <div class="summary-card" style="cursor:pointer;background:var(--warning-bg);" onclick="navigate('periodic')">
        <div class="s-label" style="color:var(--warning)">Periodiskt att spara</div>
        <div class="s-amount" style="color:var(--warning)">${fmt(t.periodicAverage)}</div>
        <div class="s-sub">denna månad</div>
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
        ${periodicPayRow}
        ${periodicSaveRow}
        ${andreasRow}
      </div>
    </div>

    <div class="dash-grid">
      ${dashFixedCard()}
      ${dashPeriodicCard(yyyyMm)}
    </div>
    ${dashAndreasCard()}
  `;
}

function dashFixedCard() {
  const grouped = FIXED_CATEGORIES.map(cat => {
    const items = md().fixed.filter(i => i.category === cat.id);
    if (!items.length) return null;
    return { ...cat, items, total: sum(items, i => i.amount) };
  }).filter(Boolean);

  const rows = grouped.map(g => `
    <div class="item-row" style="cursor:pointer;" onclick="navigateAndScroll('fixed','cat-fixed-${g.id}')" title="Visa ${h(g.label)}">
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

function dashAndreasCard() {
  const fixedItems = (md().fixed || []).filter(i => i.splitWith);
  const variableItems = (md().variable || []).filter(i => i.splitWith);
  const allItems = [
    ...fixedItems.map(i => ({ ...i, _amount: i.amount, _type: 'fixed' })),
    ...variableItems.map(i => ({ ...i, _amount: i.budget, _type: 'variable' })),
  ];
  if (!allItems.length) return '';

  const makeRow = (item) => {
    const isFixed = item._type === 'fixed';
    const cat = isFixed
      ? (FIXED_CATEGORIES.find(c => c.id === item.category) || FIXED_CATEGORIES[0])
      : (VARIABLE_CATEGORIES.find(c => c.id === item.category) || VARIABLE_CATEGORIES[0]);
    const andreasShare = item.splitShare ?? 100;
    const andreasAmount = item._amount * (andreasShare / 100);
    const yourAmount = item._amount - andreasAmount;
    const andreasLaysOut = item.splitWith === 'andreas';
    const rowBg = andreasLaysOut && yourAmount > 0
      ? 'background:var(--danger-bg);'
      : !andreasLaysOut && andreasAmount > 0
        ? 'background:var(--success-bg);'
        : '';
    const payerLabel = andreasLaysOut ? 'Andreas lägger ut' : 'Du lägger ut';
    const dest = isFixed ? 'fixed' : 'variable';
    return `
      <div class="item-row" style="cursor:pointer;${rowBg}" onclick="navigate('${dest}')">
        <div class="item-icon" style="background:${cat.bg}">${cat.icon}</div>
        <div class="item-info">
          <div class="item-name">${h(item.name)}</div>
          <div class="item-meta">${h(cat.label)} · ${payerLabel}${debitStr(item, state.month)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;min-width:110px;">
          <div style="font-size:12px;color:var(--success);font-weight:600;">Du: ${fmt(yourAmount)}</div>
          <div style="font-size:12px;color:var(--primary);font-weight:600;">Andreas: ${fmt(andreasAmount)}</div>
        </div>
      </div>`;
  };

  const fixedRows = fixedItems.length ? `<div style="padding:6px 16px 2px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">Fasta kostnader</div>${fixedItems.map(i => makeRow({ ...i, _amount: i.amount, _type: 'fixed' })).join('')}` : '';
  const variableRows = variableItems.length ? `<div style="padding:6px 16px 2px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">Rörliga kostnader</div>${variableItems.map(i => makeRow({ ...i, _amount: i.budget, _type: 'variable' })).join('')}` : '';

  // splitShare = Andreas's share in %
  // When you lay out (splitWith !== 'andreas'): Andreas owes you his share = splitShare%
  // When Andreas lays out (splitWith === 'andreas'): you owe Andreas your share = (100 - splitShare)%
  const net = calcAndreasNet(md());
  const summaryLabel = net > 0 ? 'Du är skyldig Andreas' : net < 0 ? 'Andreas är skyldig dig' : 'Ni är jämna';

  const netColor = net > 0 ? 'var(--danger)' : net < 0 ? 'var(--success)' : 'var(--text-muted)';
  return `
    <div class="card" style="margin-top:20px;">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
        <h2>Delat med Andreas</h2>
        <span style="font-size:13px;color:var(--text-muted)">denna månad</span>
      </div>
      <div class="item-list">${fixedRows}${variableRows}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid var(--border-light);font-weight:600;">
        <span>${summaryLabel}</span>
        <span style="color:${netColor};font-size:18px;">${fmt(Math.abs(net))}</span>
      </div>
    </div>`;
}

function dashPeriodicCard(yyyyMm) {
  if (!md().periodic.length) {
    return `<div class="card"><div class="card-header"><h2>Periodiska kostnader</h2></div><div class="item-list">${emptySmall('Inga periodiska kostnader')}</div></div>`;
  }

  const thisMonth = md().periodic.filter(i => i.paymentMonth && periodicFallsInMonth(i, yyyyMm));
  const undated = md().periodic.filter(i => !i.paymentMonth);
  const otherMonths = md().periodic.filter(i => i.paymentMonth && !periodicFallsInMonth(i, yyyyMm));

  const makeRow = (item, monthlyAmount, sub) => `
    <div class="item-row" style="cursor:pointer;" onclick="navigate('periodic')" title="Visa periodiska kostnader">
      <div class="item-icon" style="background:var(--warning-bg)">📅</div>
      <div class="item-info">
        <div class="item-name">${h(item.name)}</div>
        <div class="item-meta">${sub}</div>
      </div>
      <div class="item-amount amount-periodic">${fmt(monthlyAmount)}/mån</div>
    </div>`;

  const thisRows = thisMonth.map(i => {
    const myAmount = i.totalAmount * ((i.share ?? 100) / 100);
    let monthlyAmount;
    if (i.frequencyType === 'days' && i.frequencyDays) {
      monthlyAmount = (myAmount / i.frequencyDays) * 30.44;
    } else {
      monthlyAmount = myAmount / i.frequencyMonths;
    }
    return makeRow(i, monthlyAmount,
      `BETALA NU: ${fmt(myAmount)} · ${h(i.frequencyType === 'days' && i.frequencyDays ? 'var ' + i.frequencyDays + ':e dag' : FREQ_LABELS[i.frequencyMonths] || 'periodiskt')}`)
  }).join('');
  const avgRows = undated.map(i => {
    const myAmount = i.totalAmount * ((i.share ?? 100) / 100);
    let monthlyAmount;
    if (i.frequencyType === 'days' && i.frequencyDays) {
      monthlyAmount = (myAmount / i.frequencyDays) * 30.44;
    } else {
      monthlyAmount = myAmount / i.frequencyMonths;
    }
    return makeRow(i, monthlyAmount,
      `${fmt(myAmount)} · ${h(i.frequencyType === 'days' && i.frequencyDays ? 'var ' + i.frequencyDays + ':e dag' : FREQ_LABELS[i.frequencyMonths] || 'periodiskt')}`)
  }).join('');
  const otherRows = otherMonths.map(i => {
    const [py, pm] = i.paymentMonth.split('-').map(Number);
    const [ty, tm] = yyyyMm.split('-').map(Number);
    // Find next occurrence on or after yyyyMm by stepping forward from paymentMonth
    const diff = (ty - py) * 12 + (tm - pm);
    const cyclesPassed = diff > 0 ? Math.ceil(diff / i.frequencyMonths) : 0;
    const monthsAhead = cyclesPassed * i.frequencyMonths;
    const nextDate = new Date(py, pm - 1 + monthsAhead, 15);
    const nextLabel = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' }).format(nextDate);

    // Calculate monthly amount to set aside
    const myAmount = i.totalAmount * ((i.share ?? 100) / 100);
    let monthlyAmount;
    if (i.frequencyType === 'days' && i.frequencyDays) {
      monthlyAmount = (myAmount / i.frequencyDays) * 30.44;
    } else {
      monthlyAmount = myAmount / i.frequencyMonths;
    }

    return makeRow(i, monthlyAmount,
      `Nästa: ${nextLabel} · ${fmt(i.totalAmount)} · ${h(i.frequencyType === 'days' && i.frequencyDays ? 'var ' + i.frequencyDays + ':e dag' : FREQ_LABELS[i.frequencyMonths] || 'periodiskt')}`);
  }).join('');

  const sections = [
    thisRows && `<div class="dash-periodic-section"><div class="dash-periodic-label">📍 Förfaller nu</div>${thisRows}</div>`,
    avgRows && `<div class="dash-periodic-section"><div class="dash-periodic-label">📊 Löpande avsättning</div>${avgRows}</div>`,
    otherRows && `<div class="dash-periodic-section"><div class="dash-periodic-label">🗓 Kommande</div>${otherRows}</div>`,
  ].filter(Boolean).join('');

  return `
    <div class="card">
      <div class="card-header"><h2>Periodiska kostnader</h2></div>
      <div class="item-list">${sections}</div>
    </div>
  `;
}

function emptySmall(text) {
  return `<div style="padding:20px;text-align:center;color:var(--text-light);font-size:13px;">${h(text)}</div>`;
}

/* =============================================
   INCOME VIEW
   ============================================= */

function renderIncome() {
  const el = document.getElementById('view-income');
  if (!state.data.months[state.month]) {
    el.innerHTML = `<div class="view-header"><div><h1>Inkomster</h1>${monthNavHtml()}</div></div>${noMonthHtml()}`;
    return;
  }
  if (isMonthEmpty()) {
    el.innerHTML = `<div class="view-header"><div><h1>Inkomster</h1>${monthNavHtml()}</div></div>${noMonthHtml()}`;
    return;
  }
  const m = md();
  const total = sum(m.income, i => i.amount);

  const rows = m.income.map(item => `
    <div class="item-row" id="item-income-${item.id}">
      <div class="item-icon" style="background:var(--success-bg)">💰</div>
      <div class="item-info">
        <div class="item-name">${h(item.name)}</div>
        <div class="item-meta">Varje månad</div>
      </div>
      <div class="item-amount amount-income">${fmt(item.amount)}</div>
      <div class="item-actions">
        <button class="btn-icon"        onclick="editIncome('${item.id}')"            title="Redigera">${I.edit}</button>
        <button class="btn-icon danger" onclick="deleteItem('income','${item.id}')"  title="Ta bort">${I.trash}</button>
      </div>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="view-header">
      <div><h1>Inkomster</h1>${monthNavHtml()}</div>
      <button class="btn btn-primary" onclick="showAddIncome()">${I.plus} Lägg till</button>
    </div>

    ${total > 0 ? `
    <div class="summary-card sc-income" style="margin-bottom:20px;">
      <div class="s-label">Total inkomst per månad</div>
      <div class="s-amount">${fmt(total)}</div>
      <div class="s-sub">${m.income.length} inkomstkälla${m.income.length !== 1 ? 'r' : ''}</div>
    </div>` : ''}

    <div class="card">
      <div class="item-list">
        ${rows || emptyState('💰', 'Inga inkomster', 'Lägg till din lön, barnbidrag eller andra inkomstkällor.')}
      </div>
    </div>
  `;
}

/* =============================================
   FIXED EXPENSES VIEW
   ============================================= */

function renderFixed() {
  const el = document.getElementById('view-fixed');
  if (!state.data.months[state.month]) {
    el.innerHTML = `<div class="view-header"><div><h1>Fasta kostnader</h1>${monthNavHtml()}</div></div>${noMonthHtml()}`;
    return;
  }
  if (isMonthEmpty()) {
    el.innerHTML = `<div class="view-header"><div><h1>Fasta kostnader</h1>${monthNavHtml()}</div></div>${noMonthHtml()}`;
    return;
  }
  const m = md();
  const total = sum(m.fixed, i => myShare(i.amount, i));

  const sections = FIXED_CATEGORIES.map(cat => {
    const items = m.fixed.filter(i => i.category === cat.id);
    if (!items.length) return '';
    const catTotal = sum(items, i => myShare(i.amount, i));

    const rows = items.map(item => {
      const PERSON_LABELS = { mig: '👤 Mig', elias: '👦 Elias', oliver: '👦 Oliver', zoe: '🐶 Zoe', ovrigt: '📦 Övrigt' };
      const editFn = item.type === 'mortgage' ? `editMortgage('${item.id}')` : `editFixed('${item.id}')`;
      const personBadge = item.person ? `<span class="badge badge-person">${h(PERSON_LABELS[item.person] ?? item.person)}</span>` : '';
      const shareBadge = '';
      const fmtDate = s => s ? new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(new Date(s)) : null;
      const fromLbl = fmtDate(item.periodFrom);
      const toLbl = fmtDate(item.periodTo);
      const periodStr = fromLbl && toLbl ? ` · Avser ${fromLbl}–${toLbl}`
        : fromLbl ? ` · Från ${fromLbl}`
          : toLbl ? ` · Till ${toLbl}`
            : '';
      const companyStr = (!item.type && item.company) ? `${h(item.company)} · ` : '';
      const dStr = debitStr(item, state.month);
      const andreasBadge = item.splitWith
        ? ` <span class="badge badge-andreas">${item.splitWith === 'andreas' ? 'Andreas lägger ut' : 'Delas'} · Andreas andel ${item.splitShare ?? 100}%</span>`
        : '';
      const meta = item.type === 'mortgage'
        ? `${Math.round(item.loanAmount / 1000)}\u00a0kkr · ${(item.listRate - (item.rateDiscount || 0)).toFixed(2)}% · ${item.taxMode === 'after' ? 'inkl. skatterabatt' : 'exkl. skatterabatt'}${dStr}${andreasBadge}`
        : `${companyStr}<span class="badge badge-${cat.id}">${h(cat.label)}</span> ${shareBadge} ${personBadge}${periodStr}${dStr}${andreasBadge}`;
      return `
        <div class="item-row" id="item-fixed-${item.id}">
          <div class="item-icon" style="background:${cat.bg}">${cat.icon}</div>
          <div class="item-info">
            <div class="item-name">${h(item.name)}</div>
            <div class="item-meta">${meta}</div>
          </div>
          <div class="item-amount amount-expense">${fmt(myShare(item.amount, item))}</div>
          <div class="item-actions">
            <button class="btn-icon"        onclick="${editFn}"                         title="Redigera">${I.edit}</button>
            <button class="btn-icon danger" onclick="deleteItem('fixed','${item.id}')" title="Ta bort">${I.trash}</button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="cat-section" id="cat-fixed-${cat.id}">
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
      <div><h1>Fasta kostnader</h1>${monthNavHtml()}</div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost" onclick="showAddMortgage()">🏠 Bolånekalkyl</button>
        <button class="btn btn-primary" onclick="showAddFixed()">${I.plus} Lägg till</button>
      </div>
    </div>

    ${total > 0 ? `
    <div class="summary-card sc-expense" style="margin-bottom:20px;">
      <div class="s-label">Totala fasta kostnader</div>
      <div class="s-amount">${fmt(total)}</div>
      <div class="s-sub">${m.fixed.length} poster &nbsp;·&nbsp; ${fmt(total * 12)} per år</div>
    </div>` : ''}

    ${sections || `<div class="card"><div class="item-list">${emptyState('📋', 'Inga fasta kostnader', 'Lägg till hyra, försäkringar, lån, streaming och annat som är fast.')}</div></div>`}
  `;
}

/* =============================================
   VARIABLE EXPENSES VIEW
   ============================================= */

function renderVariable() {
  const el = document.getElementById('view-variable');
  if (!state.data.months[state.month]) {
    el.innerHTML = `<div class="view-header"><div><h1>Rörliga kostnader</h1>${monthNavHtml()}</div></div>${noMonthHtml()}`;
    return;
  }
  if (isMonthEmpty()) {
    el.innerHTML = `<div class="view-header"><div><h1>Rörliga kostnader</h1>${monthNavHtml()}</div></div>${noMonthHtml()}`;
    return;
  }
  const m = md();
  const total = sum(m.variable, i => myShare(i.budget, i));

  const sections = VARIABLE_CATEGORIES.map(cat => {
    const items = m.variable.filter(i => i.category === cat.id);
    if (!items.length) return '';
    const catTotal = sum(items, i => myShare(i.budget, i));

    const rows = items.map(item => {
      const fmtDate = s => s ? new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(new Date(s)) : null;
      const fromLbl = fmtDate(item.periodFrom);
      const toLbl = fmtDate(item.periodTo);
      const PERIOD_TYPE_LABELS = { week: '1 vecka', '2week': '2 veckor', month: '1 månad' };
      const periodMeta = item.periodType ? ` · Avser ${PERIOD_TYPE_LABELS[item.periodType] ?? item.periodType}`
        : fromLbl && toLbl ? ` · Avser ${fromLbl}–${toLbl}`
          : fromLbl ? ` · Fr\u00e5n ${fromLbl}`
            : toLbl ? ` · Till ${toLbl}`
              : '';
      return `
      <div class="item-row" id="item-variable-${item.id}">
        <div class="item-icon" style="background:${cat.bg}">${cat.icon}</div>
        <div class="item-info">
          <div class="item-name">${h(item.name)}</div>
          <div class="item-meta">${cat.label}${periodMeta}${item.note ? ' · ' + h(item.note) : ''}${debitStr(item, state.month)}${item.splitWith ? ` <span class="badge badge-andreas">${item.splitWith === 'andreas' ? 'Andreas lägger ut' : 'Delas'} · Andreas andel ${item.splitShare ?? 100}%</span>` : ''}</div>
        </div>
        <div class="item-amount amount-expense">${fmt(myShare(item.budget, item))}</div>
        <div class="item-actions">
          <button class="btn-icon"        onclick="editVariable('${item.id}')"           title="Redigera">${I.edit}</button>
          <button class="btn-icon danger" onclick="deleteItem('variable','${item.id}')" title="Ta bort">${I.trash}</button>
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
      <div><h1>Rörliga kostnader</h1>${monthNavHtml()}</div>
      <button class="btn btn-primary" onclick="showAddVariable()">${I.plus} Lägg till</button>
    </div>

    ${total > 0 ? `
    <div class="summary-card sc-variable" style="margin-bottom:20px;">
      <div class="s-label">Total rörlig budget</div>
      <div class="s-amount">${fmt(total)}</div>
      <div class="s-sub">${m.variable.length} poster</div>
    </div>` : ''}

    ${sections || `<div class="card"><div class="item-list">${emptyState('🛒', 'Inga rörliga budgetar', 'Sätt budgetar för mat, bensin, nöje och annat som varierar.')}</div></div>`}
  `;
}

/* =============================================
   PERIODIC COSTS VIEW
   ============================================= */

function renderPeriodic() {
  const el = document.getElementById('view-periodic');
  if (!state.data.months[state.month]) {
    el.innerHTML = `<div class="view-header"><div><h1>Periodiska kostnader</h1>${monthNavHtml()}</div></div>${noMonthHtml()}`;
    return;
  }
  if (isMonthEmpty()) {
    el.innerHTML = `<div class="view-header"><div><h1>Periodiska kostnader</h1>${monthNavHtml()}</div></div>${noMonthHtml()}`;
    return;
  }
  const m = md();

  function getMonthlyAmount(item) {
    const myAmount = item.totalAmount * ((item.share ?? 100) / 100);
    if (item.frequencyType === 'days' && item.frequencyDays) {
      return (myAmount / item.frequencyDays) * 30.44;
    }
    return myAmount / item.frequencyMonths;
  }

  function getFreqLabel(item) {
    if (item.frequencyType === 'days' && item.frequencyDays) {
      return 'var ' + item.frequencyDays + ':e dag';
    }
    return FREQ_LABELS[item.frequencyMonths] || 'periodiskt';
  }

  const monthlyTotal = sum(m.periodic, i => getMonthlyAmount(i));

  const PERSON_LABELS = { mig: '👤 Mig', elias: '👦 Elias', oliver: '👦 Oliver', zoe: '🐶 Zoe', ovrigt: '📦 Övrigt' };
  const rows = m.periodic.map(item => {
    const monthly = getMonthlyAmount(item);
    let nextInfo = '';
    if (item.paymentMonth) {
      const [py, pm] = item.paymentMonth.split('-').map(Number);
      const now = new Date();
      const [cy, cm] = [now.getFullYear(), now.getMonth() + 1];
      const diff = (cy - py) * 12 + (cm - pm);
      // How many full cycles have passed since paymentMonth?
      const cyclesPassed = diff > 0 ? Math.ceil(diff / item.frequencyMonths) : 0;
      const monthsAhead = cyclesPassed * item.frequencyMonths;
      const nextDate = new Date(py, pm - 1 + monthsAhead, 15);
      const nextLabel = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' }).format(nextDate);
      nextInfo = ` · Nästa: ${nextLabel}`;
    }
    return `
      <div class="item-row" id="item-periodic-${item.id}">
        <div class="item-icon" style="background:var(--warning-bg)">📅</div>
        <div class="item-info">
          <div class="item-name">${h(item.name)}</div>
          <div class="item-meta">
            ${fmt(item.totalAmount)} · ${getFreqLabel(item)}${nextInfo}
            ${(item.share && item.share < 100) ? ` · <span class="badge badge-share">${item.share}%</span>` : ''}
            ${item.note ? ' · ' + h(item.note) : ''}
            ${debitStr(item, state.month)}
            ${item.person ? ` · <span class="badge badge-person">${h(PERSON_LABELS[item.person] ?? item.person)}</span>` : ''}
          </div>
        </div>
        <div style="text-align:right; margin-right:14px; white-space:nowrap;">
          <div style="font-size:14px; font-weight:600; color:var(--warning)">${fmt(monthly)}/mån</div>
          <div style="font-size:11px; color:var(--text-light)">${item.paymentMonth ? 'avsätts' : 'avsätts (ingen månad angiven)'}</div>
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
      <div><h1>Periodiska kostnader</h1>${monthNavHtml()}</div>
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

    ${m.periodic.length > 0 ? `
    <div class="info-box" style="margin-top:16px;">
      <strong>Hur fungerar det?</strong>
      Appen räknar ut ditt periodiska sparande per månad. Det beloppet syns i Översikten och dras av
      från "Kvar att röra sig med" – så du alltid har pengar när den stora fakturan dyker upp.
    </div>` : ''}
  `;
}

/* =============================================
   EMPTY STATE
   ============================================= */

function emptyState(icon, title, desc) {
  return `
    <div class="empty-state">
      <span class="es-icon">${icon}</span>
      <h3>${h(title)}</h3>
      <p>${h(desc)}</p>
    </div>
  `;
}

/* =============================================
   MODAL ENGINE
   ============================================= */

function showModal(title, bodyHtml, onSave, extraClass = '') {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');
  modal.className = extraClass;

  modal.innerHTML = `
    <div class="modal-header">
      <h2>${h(title)}</h2>
      <button type="button" class="modal-close" onclick="closeModal()" aria-label="Stäng">×</button>
    </div>
    <div class="modal-body">${bodyHtml}</div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost" onclick="closeModal()">Avbryt</button>
      <button type="button" class="btn btn-primary" id="modal-save">Spara</button>
    </div>
  `;

  document.getElementById('modal-save').onclick = onSave;
  overlay.classList.remove('hidden');

  // Enter in any input/select triggers save (prevents default form submit + page scroll)
  modal.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      onSave();
    }
  });

  // Focus first input
  setTimeout(() => { modal.querySelector('input, select')?.focus(); }, 60);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function notify(msg) {
  // Lightweight inline validation feedback instead of alert()
  let el = document.getElementById('modal-error');
  if (!el) {
    el = document.createElement('p');
    el.id = 'modal-error';
    el.style.cssText = 'color:var(--danger);font-size:12px;margin-top:6px;font-weight:500;';
    document.querySelector('.modal-footer')?.prepend(el);
  }
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 3000);
}

/* =============================================
   INCOME CRUD
   ============================================= */

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
    const name = document.getElementById('f-name').value.trim();
    const amount = parseFloat(document.getElementById('f-amount').value);
    if (!name) return notify('Ange ett namn.');
    if (!(amount > 0)) return notify('Ange ett giltigt belopp.');
    ensureMonth().income.push({ id: genId(), name, amount });
    saveData(); closeModal(); renderIncome();
  });
}

function editIncome(id) {
  const item = findItemInAnyMonth('income', id);
  if (!item) return;
  const itemMonth = state.month;
  showModal('Redigera inkomst', incomeForm(item), () => {
    const name = document.getElementById('f-name').value.trim();
    const amount = parseFloat(document.getElementById('f-amount').value);
    if (!name) return notify('Ange ett namn.');
    if (!(amount > 0)) return notify('Ange ett giltigt belopp.');
    item.name = name; item.amount = amount;
    state.month = itemMonth;
    saveData(); closeModal(); renderIncome();
  });
}

/* =============================================
   FIXED EXPENSE CRUD
   ============================================= */

function fixedForm(item) {
  const catOptions = FIXED_CATEGORIES.map(c =>
    `<option value="${c.id}" ${item?.category === c.id ? 'selected' : ''}>${c.icon} ${c.label}</option>`
  ).join('');

  const storedPeriod = item?.period ?? 'month';
  const rawAmount = item ? Math.round(item.amount * (storedPeriod === 'year' ? 12 : 1)) : '';

  return `
    <div class="form-group">
      <label class="form-label">Namn</label>
      <input type="text" id="f-name" class="form-input" placeholder="T.ex. Hemförsäkring, Billån" value="${h(item?.name ?? '')}">
    </div>
    <div class="form-group">
      <label class="form-label">Bolag <span style="font-weight:400;color:var(--text-muted)">(valfritt)</span></label>
      <input type="text" id="f-company" class="form-input" placeholder="T.ex. Folksam, Avanza, Netflix" value="${h(item?.company ?? '')}">
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
          <option value="year"  ${storedPeriod === 'year' ? 'selected' : ''}>Per år</option>
        </select>
      </div>
    </div>

    <div id="fixed-preview" class="fixed-cost-preview" style="display:none;"></div>

    <div class="form-group">
      <label class="split-checkbox-label">
        <input type="checkbox" id="f-split-toggle" ${item?.splitWith ? 'checked' : ''}
          onchange="document.getElementById('f-split-panel').classList.toggle('split-panel-open', this.checked)">
        <span>Delas med Andreas</span>
      </label>
    </div>
    <div id="f-split-panel" class="split-panel ${item?.splitWith ? 'split-panel-open' : ''}">
      <div class="form-group" style="margin-bottom:10px;">
        <label class="form-label">Vem lägger ut?</label>
        <div class="radio-group">
          <label class="radio-label">
            <input type="radio" name="split-payer" value="jag" ${(!item?.splitWith || item.splitWith !== 'andreas') ? 'checked' : ''}>
            👤 Jag (Carro)
          </label>
          <label class="radio-label">
            <input type="radio" name="split-payer" value="andreas" ${item?.splitWith === 'andreas' ? 'checked' : ''}>
            👤 Andreas
          </label>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label">Andreas andel (%)</label>
        <div class="share-row">
          <input type="range" id="f-split-range" min="0" max="100" step="1"
            value="${item?.splitShare ?? 100}" class="share-slider"
            oninput="document.getElementById('f-split-share').value=this.value">
          <input type="number" id="f-split-share" class="form-input share-input" min="0" max="100" step="1"
            value="${item?.splitShare ?? 100}"
            oninput="document.getElementById('f-split-range').value=this.value">
          <span class="share-pct-label">%</span>
        </div>
        <div class="form-hint">Ange Andreas ekonomiska andel. 0% = du betalar allt, 50% = ni delar lika, 100% = han betalar allt.</div>
        <div id="split-share-preview" style="margin-top:6px;font-size:13px;font-weight:600;display:flex;gap:16px;">
          <span style="color:var(--success)">Du: <span id="split-my-pct">${100 - (item?.splitShare ?? 100)}</span>%</span>
          <span style="color:var(--primary)">Andreas: <span id="split-andreas-pct">${item?.splitShare ?? 100}</span>%</span>
        </div>
      </div>
    </div>

    <div class="form-row-2">
      <div class="form-group">
        <label class="form-label">Kategori</label>
        <select id="f-cat" class="form-select">${catOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Gäller <span style="font-weight:400;color:var(--text-muted)">(valfritt)</span></label>
        <select id="f-person" class="form-select">
          <option value=""       ${!item?.person ? 'selected' : ''}>— Välj person —</option>
          <option value="mig"    ${item?.person === 'mig' ? 'selected' : ''}>👤 Mig</option>
          <option value="elias"  ${item?.person === 'elias' ? 'selected' : ''}>👦 Elias</option>
          <option value="oliver" ${item?.person === 'oliver' ? 'selected' : ''}>👦 Oliver</option>
          <option value="zoe"    ${item?.person === 'zoe' ? 'selected' : ''}>🐶 Zoe</option>
          <option value="ovrigt" ${item?.person === 'ovrigt' ? 'selected' : ''}>📦 Övrigt</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Avser period <span style="font-weight:400;color:var(--text-light)">(valfritt)</span></label>
      <div class="form-row-2">
        <input type="date" id="f-period-from" class="form-input" value="${h(item?.periodFrom ?? '')}" placeholder="Från">
        <input type="date" id="f-period-to"   class="form-input" value="${h(item?.periodTo ?? '')}"   placeholder="Till">
      </div>
      <div class="form-hint">Valfritt – ange om kostnaden avser en specifik period.</div>
    </div>
    ${debitDayHtml(item)}
  `;
}

function attachFixedPreview() {
  setTimeout(() => {
    function update() {
      const amount = parseFloat(document.getElementById('f-amount')?.value) || 0;
      const period = document.getElementById('f-period')?.value ?? 'month';
      const preview = document.getElementById('fixed-preview');
      if (!preview) return;

      if (amount > 0) {
        const monthly = period === 'year' ? amount / 12 : amount;
        const perYear = period === 'year' ? amount : amount * 12;

        const splitEnabled = document.getElementById('f-split-toggle')?.checked;
        const andreasSharePct = splitEnabled ? (v => isNaN(v) ? 100 : v)(parseInt(document.getElementById('f-split-share')?.value, 10)) : 0;
        const mySharePct = 100 - andreasSharePct;
        const myMonthly = monthly * mySharePct / 100;
        const andreasMonthly = monthly * andreasSharePct / 100;

        preview.style.display = 'block';
        preview.innerHTML = `
          <div class="fcg-row"><span>Totalt ${period === 'year' ? 'per år' : 'per månad'}</span><span>${fmt(amount)}</span></div>
          <div class="fcg-row highlight"><span>Din månadskostnad</span><span>${fmt(myMonthly)}</span></div>
          ${splitEnabled && andreasSharePct > 0 ? `<div class="fcg-row" style="color:var(--primary)"><span>Andreas andel</span><span>${fmt(andreasMonthly)}</span></div>` : ''}
          ${period === 'year' ? '' : `<div class="fcg-row"><span>Per år (din andel)</span><span>${fmt(myMonthly * 12)}</span></div>`}
        `;
      } else {
        preview.style.display = 'none';
      }
    }

    // Synka slider ↔ sifferfält för delning, och uppdatera preview vid ändring
    const splitRange = document.getElementById('f-split-range');
    const splitShare = document.getElementById('f-split-share');
    function updateSharePct() {
      const v = parseInt(splitShare?.value, 10) || 0;
      const myPct = document.getElementById('split-my-pct');
      const andreasPct = document.getElementById('split-andreas-pct');
      if (myPct) myPct.textContent = 100 - v;
      if (andreasPct) andreasPct.textContent = v;
    }
    if (splitRange && splitShare) {
      splitRange.addEventListener('input', () => { splitShare.value = splitRange.value; update(); updateSharePct(); });
      splitShare.addEventListener('input', () => { splitRange.value = splitShare.value; update(); updateSharePct(); });
    }
    document.getElementById('f-split-toggle')?.addEventListener('change', update);
    document.querySelectorAll('input[name="split-payer"]').forEach(r => r.addEventListener('change', update));

    ['f-amount', 'f-period'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', update);
    });
    update();
  }, 80);
}

function resolveFixedAmount() {
  const amount = parseFloat(document.getElementById('f-amount').value);
  const period = document.getElementById('f-period').value;
  if (!(amount > 0)) return null;
  const monthly = period === 'year' ? amount / 12 : amount;
  return { monthly: Math.round(monthly * 100) / 100, period };
}

function showAddFixed() {
  showModal('Lägg till fast kostnad', fixedForm(null), () => {
    const name = document.getElementById('f-name').value.trim();
    const company = document.getElementById('f-company').value.trim() || null;
    const category = document.getElementById('f-cat').value;
    const person = document.getElementById('f-person').value;
    const periodFrom = document.getElementById('f-period-from').value || null;
    const periodTo = document.getElementById('f-period-to').value || null;
    const debitDay = parseInt(document.getElementById('f-debit-day').value, 10) || null;
    const debitMonthOffset = parseInt(document.getElementById('f-debit-offset').value, 10) || 0;
    const splitEnabled = document.getElementById('f-split-toggle').checked;
    const splitWith = splitEnabled ? (document.querySelector('input[name="split-payer"]:checked')?.value || 'jag') : null;
    const splitShare = splitEnabled ? (v => isNaN(v) ? 100 : v)(parseInt(document.getElementById('f-split-share').value, 10)) : null;
    const resolved = resolveFixedAmount();
    if (!name) return notify('Ange ett namn.');
    if (!resolved) return notify('Ange ett giltigt belopp.');
    ensureMonth().fixed.push({ id: genId(), name, company, amount: resolved.monthly, category, period: resolved.period, person, periodFrom, periodTo, debitDay, debitMonthOffset, splitWith, splitShare });
    saveData(); closeModal(); renderFixed();
  });
  attachFixedPreview();
}

function editFixed(id) {
  const item = findItemInAnyMonth('fixed', id);
  if (!item) return;
  const itemMonth = state.month;
  showModal('Redigera fast kostnad', fixedForm(item), () => {
    const name = document.getElementById('f-name').value.trim();
    const company = document.getElementById('f-company').value.trim() || null;
    const category = document.getElementById('f-cat').value;
    const resolved = resolveFixedAmount();
    const person = document.getElementById('f-person').value;
    const periodFrom = document.getElementById('f-period-from').value || null;
    const periodTo = document.getElementById('f-period-to').value || null;
    const debitDay = parseInt(document.getElementById('f-debit-day').value, 10) || null;
    const debitMonthOffset = parseInt(document.getElementById('f-debit-offset').value, 10) || 0;
    const splitEnabled = document.getElementById('f-split-toggle').checked;
    const splitWith = splitEnabled ? (document.querySelector('input[name="split-payer"]:checked')?.value || 'jag') : null;
    const splitShare = splitEnabled ? (v => isNaN(v) ? 100 : v)(parseInt(document.getElementById('f-split-share').value, 10)) : null;
    if (!name) return notify('Ange ett namn.');
    if (!resolved) return notify('Ange ett giltigt belopp.');
    item.name = name; item.company = company; item.category = category;
    item.amount = resolved.monthly; item.period = resolved.period; item.person = person;
    item.periodFrom = periodFrom; item.periodTo = periodTo; item.debitDay = debitDay; item.debitMonthOffset = debitMonthOffset;
    item.splitWith = splitWith; item.splitShare = splitShare;
    state.month = itemMonth;
    saveData(); closeModal(); renderFixed();
  });
  attachFixedPreview();
}

/* =============================================
   MORTGAGE CALCULATOR
   ============================================= */

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
    <div class="form-group">
      <label class="split-checkbox-label">
        <input type="checkbox" id="f-split-toggle" ${item?.splitWith ? 'checked' : ''}
          onchange="document.getElementById('f-split-panel').classList.toggle('split-panel-open', this.checked)">
        <span>Delas med Andreas</span>
      </label>
    </div>
    <div id="f-split-panel" class="split-panel ${item?.splitWith ? 'split-panel-open' : ''}">
      <div class="form-group" style="margin-bottom:10px;">
        <label class="form-label">Vem lägger ut?</label>
        <div class="radio-group">
          <label class="radio-label">
            <input type="radio" name="split-payer" value="jag" ${(!item?.splitWith || item.splitWith !== 'andreas') ? 'checked' : ''}>
            👤 Jag (Carro)
          </label>
          <label class="radio-label">
            <input type="radio" name="split-payer" value="andreas" ${item?.splitWith === 'andreas' ? 'checked' : ''}>
            👤 Andreas
          </label>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label">Andreas andel (%)</label>
        <div class="share-row">
          <input type="range" id="f-split-range" min="0" max="100" step="1"
            value="${item?.splitShare ?? 100}" class="share-slider"
            oninput="document.getElementById('f-split-share').value=this.value">
          <input type="number" id="f-split-share" class="form-input share-input" min="0" max="100" step="1"
            value="${item?.splitShare ?? 100}"
            oninput="document.getElementById('f-split-range').value=this.value">
          <span class="share-pct-label">%</span>
        </div>
        <div class="form-hint">Ange Andreas ekonomiska andel. 0% = du betalar allt, 50% = ni delar lika, 100% = han betalar allt.</div>
        <div id="split-share-preview" style="margin-top:6px;font-size:13px;font-weight:600;display:flex;gap:16px;">
          <span style="color:var(--success)">Du: <span id="split-my-pct">${100 - (item?.splitShare ?? 100)}</span>%</span>
          <span style="color:var(--primary)">Andreas: <span id="split-andreas-pct">${item?.splitShare ?? 100}</span>%</span>
        </div>
      </div>
    </div>
    ${debitDayHtml(item)}
  `;
}

function attachMortgagePreview() {
  setTimeout(() => {
    const inputIds = ['f-loan', 'f-valuation', 'f-listrate', 'f-discount', 'f-buffer', 'f-downpayment'];

    function update() {
      const loan = parseFloat(document.getElementById('f-loan')?.value) || 0;
      const valuation = parseFloat(document.getElementById('f-valuation')?.value) || 0;
      const listRate = parseFloat(document.getElementById('f-listrate')?.value) || 0;
      const discount = parseFloat(document.getElementById('f-discount')?.value) || 0;
      const buffer = parseFloat(document.getElementById('f-buffer')?.value) || 0;
      const downPayment = parseFloat(document.getElementById('f-downpayment')?.value) || 0;
      const preview = document.getElementById('mortgage-preview');
      const taxGroup = document.getElementById('tax-toggle-group');
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
    const name = document.getElementById('f-name').value.trim();
    const loanAmount = parseFloat(document.getElementById('f-loan').value);
    const valuation = parseFloat(document.getElementById('f-valuation').value);
    const listRate = parseFloat(document.getElementById('f-listrate').value);
    const rateDiscount = parseFloat(document.getElementById('f-discount').value) || 0;
    const bufferRate = parseFloat(document.getElementById('f-buffer').value) || 0;
    const downPayment = parseFloat(document.getElementById('f-downpayment').value) || 0;
    const taxMode = document.querySelector('input[name="tax-mode"]:checked')?.value || 'after';
    const debitDay = parseInt(document.getElementById('f-debit-day').value, 10) || null;
    const debitMonthOffset = parseInt(document.getElementById('f-debit-offset').value, 10) || 0;
    const splitEnabled = document.getElementById('f-split-toggle').checked;
    const splitWith = splitEnabled ? (document.querySelector('input[name="split-payer"]:checked')?.value || 'jag') : null;
    const splitShare = splitEnabled ? (v => isNaN(v) ? 100 : v)(parseInt(document.getElementById('f-split-share').value, 10)) : null;

    if (!name) return notify('Ange ett namn.');
    if (!(loanAmount > 0)) return notify('Ange lånebelopp.');
    if (!(valuation > 0)) return notify('Ange värdering av bostad.');
    if (!(listRate > 0)) return notify('Ange listränta.');

    const c = calcMortgage(loanAmount, valuation, listRate, rateDiscount, bufferRate);
    const amount = Math.round(taxMode === 'after' ? c.totalAfterTax : c.totalBeforeTax);
    ensureMonth().fixed.push({
      id: genId(), name, category: 'lan', type: 'mortgage',
      loanAmount, valuation, downPayment, listRate, rateDiscount, bufferRate, taxMode, amount, debitDay, debitMonthOffset, splitWith, splitShare,
    });
    saveData(); closeModal(); renderFixed();
  }, 'wide');
  attachMortgagePreview();
}

function editMortgage(id) {
  const item = md().fixed.find(i => i.id === id);
  if (!item) return;
  showModal('Redigera bolån', mortgageForm(item), () => {
    const name = document.getElementById('f-name').value.trim();
    const loanAmount = parseFloat(document.getElementById('f-loan').value);
    const valuation = parseFloat(document.getElementById('f-valuation').value);
    const listRate = parseFloat(document.getElementById('f-listrate').value);
    const rateDiscount = parseFloat(document.getElementById('f-discount').value) || 0;
    const bufferRate = parseFloat(document.getElementById('f-buffer').value) || 0;
    const downPayment = parseFloat(document.getElementById('f-downpayment').value) || 0;
    const taxMode = document.querySelector('input[name="tax-mode"]:checked')?.value || 'after';
    const debitDay = parseInt(document.getElementById('f-debit-day').value, 10) || null;
    const debitMonthOffset = parseInt(document.getElementById('f-debit-offset').value, 10) || 0;
    const splitEnabled = document.getElementById('f-split-toggle').checked;
    const splitWith = splitEnabled ? (document.querySelector('input[name="split-payer"]:checked')?.value || 'jag') : null;
    const splitShare = splitEnabled ? (v => isNaN(v) ? 100 : v)(parseInt(document.getElementById('f-split-share').value, 10)) : null;

    if (!name) return notify('Ange ett namn.');
    if (!(loanAmount > 0)) return notify('Ange lånebelopp.');
    if (!(valuation > 0)) return notify('Ange värdering av bostad.');
    if (!(listRate > 0)) return notify('Ange listränta.');

    const c = calcMortgage(loanAmount, valuation, listRate, rateDiscount, bufferRate);
    const amount = Math.round(taxMode === 'after' ? c.totalAfterTax : c.totalBeforeTax);
    Object.assign(item, { name, loanAmount, valuation, downPayment, listRate, rateDiscount, bufferRate, taxMode, amount, debitDay, debitMonthOffset, splitWith, splitShare });
    saveData(); closeModal(); renderFixed();
  }, 'wide');
  attachMortgagePreview();
}

/* =============================================
   VARIABLE EXPENSE CRUD
   ============================================= */

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
      <label class="form-label">Belopp (kr)</label>
      <input type="number" id="f-budget" class="form-input" placeholder="0" min="0" step="1" value="${item?.budget ?? ''}">
    </div>
    <div class="form-group">
      <label class="form-label">Kategori</label>
      <select id="f-cat" class="form-select">${catOptions}</select>
    </div>
    <div class="form-group">
      <label class="form-label">Avser period <span style="font-weight:400;color:var(--text-light)">(valfritt)</span></label>
      <select id="f-period-type" class="form-select" style="margin-bottom:8px;">
        <option value=""      ${!item?.periodType ? 'selected' : ''}>— Ange period (valfritt) —</option>
        <option value="week"  ${item?.periodType === 'week' ? 'selected' : ''}>1 vecka</option>
        <option value="2week" ${item?.periodType === '2week' ? 'selected' : ''}>2 veckor</option>
        <option value="month" ${item?.periodType === 'month' ? 'selected' : ''}>1 månad</option>
      </select>
      <div class="form-row-2">
        <input type="date" id="f-period-from" class="form-input" value="${h(item?.periodFrom ?? '')}" placeholder="Från">
        <input type="date" id="f-period-to"   class="form-input" value="${h(item?.periodTo ?? '')}"   placeholder="Till">
      </div>
      <div class="form-hint">Välj period i listan eller ange datum. T.ex. om vattenräkningen i mars gäller förbrukning jan–feb.</div>
    </div>
    <div class="form-group">
      <label class="form-label">Kommentar <span style="font-weight:400;color:var(--text-light)">(valfritt)</span></label>
      <input type="text" id="f-note" class="form-input" placeholder="T.ex. extrakostnad, engång" value="${h(item?.note ?? '')}">
    </div>
    <div class="form-group">
      <label class="split-checkbox-label">
        <input type="checkbox" id="f-split-toggle" ${item?.splitWith ? 'checked' : ''}
          onchange="document.getElementById('f-split-panel').classList.toggle('split-panel-open', this.checked)">
        <span>Delas med Andreas</span>
      </label>
    </div>
    <div id="f-split-panel" class="split-panel ${item?.splitWith ? 'split-panel-open' : ''}">
      <div class="form-group" style="margin-bottom:10px;">
        <label class="form-label">Vem lägger ut?</label>
        <div class="radio-group">
          <label class="radio-label">
            <input type="radio" name="split-payer" value="jag" ${(!item?.splitWith || item.splitWith !== 'andreas') ? 'checked' : ''}>
            👤 Jag (Carro)
          </label>
          <label class="radio-label">
            <input type="radio" name="split-payer" value="andreas" ${item?.splitWith === 'andreas' ? 'checked' : ''}>
            👤 Andreas
          </label>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label">Andreas andel (%)</label>
        <div class="share-row">
          <input type="range" id="f-split-range" min="0" max="100" step="1"
            value="${item?.splitShare ?? 100}" class="share-slider"
            oninput="document.getElementById('f-split-share').value=this.value">
          <input type="number" id="f-split-share" class="form-input share-input" min="0" max="100" step="1"
            value="${item?.splitShare ?? 100}"
            oninput="document.getElementById('f-split-range').value=this.value">
          <span class="share-pct-label">%</span>
        </div>
        <div class="form-hint">Ange Andreas ekonomiska andel. 0% = du betalar allt, 50% = ni delar lika, 100% = han betalar allt.</div>
        <div id="split-share-preview" style="margin-top:6px;font-size:13px;font-weight:600;display:flex;gap:16px;">
          <span style="color:var(--success)">Du: <span id="split-my-pct">${100 - (item?.splitShare ?? 100)}</span>%</span>
          <span style="color:var(--primary)">Andreas: <span id="split-andreas-pct">${item?.splitShare ?? 100}</span>%</span>
        </div>
      </div>
    </div>
    ${debitDayHtml(item)}
  `;
}

function showAddVariable() {
  showModal('Lägg till rörlig kostnad', variableForm(null), () => {
    const name = document.getElementById('f-name').value.trim();
    const budget = parseFloat(document.getElementById('f-budget').value);
    const category = document.getElementById('f-cat').value;
    const periodType = document.getElementById('f-period-type').value || null;
    const periodFrom = document.getElementById('f-period-from').value || null;
    const periodTo = document.getElementById('f-period-to').value || null;
    const note = document.getElementById('f-note').value.trim() || null;
    const debitDay = parseInt(document.getElementById('f-debit-day').value, 10) || null;
    const debitMonthOffset = parseInt(document.getElementById('f-debit-offset').value, 10) || 0;
    const splitEnabled = document.getElementById('f-split-toggle').checked;
    const splitWith = splitEnabled ? (document.querySelector('input[name="split-payer"]:checked')?.value || 'jag') : null;
    const splitShare = splitEnabled ? (v => isNaN(v) ? 100 : v)(parseInt(document.getElementById('f-split-share').value, 10)) : null;
    if (!name) return notify('Ange ett namn.');
    if (!(budget > 0)) return notify('Ange ett giltigt belopp.');
    ensureMonth().variable.push({ id: genId(), name, budget, category, periodType, periodFrom, periodTo, note, debitDay, debitMonthOffset, splitWith, splitShare });
    saveData(); closeModal(); renderVariable();
  });
  attachVariableSplitSync();
}

function editVariable(id) {
  const item = findItemInAnyMonth('variable', id);
  if (!item) return;
  const itemMonth = state.month;
  showModal('Redigera rörlig kostnad', variableForm(item), () => {
    const name = document.getElementById('f-name').value.trim();
    const budget = parseFloat(document.getElementById('f-budget').value);
    const category = document.getElementById('f-cat').value;
    const periodType = document.getElementById('f-period-type').value || null;
    const periodFrom = document.getElementById('f-period-from').value || null;
    const periodTo = document.getElementById('f-period-to').value || null;
    const note = document.getElementById('f-note').value.trim() || null;
    const debitDay = parseInt(document.getElementById('f-debit-day').value, 10) || null;
    const debitMonthOffset = parseInt(document.getElementById('f-debit-offset').value, 10) || 0;
    const splitEnabled = document.getElementById('f-split-toggle').checked;
    const splitWith = splitEnabled ? (document.querySelector('input[name="split-payer"]:checked')?.value || 'jag') : null;
    const splitShare = splitEnabled ? (v => isNaN(v) ? 100 : v)(parseInt(document.getElementById('f-split-share').value, 10)) : null;
    if (!name) return notify('Ange ett namn.');
    if (!(budget > 0)) return notify('Ange ett giltigt belopp.');
    item.name = name; item.budget = budget; item.category = category;
    item.periodType = periodType; item.periodFrom = periodFrom; item.periodTo = periodTo; item.note = note; item.debitDay = debitDay; item.debitMonthOffset = debitMonthOffset;
    item.splitWith = splitWith; item.splitShare = splitShare;
    state.month = itemMonth;
    saveData(); closeModal(); renderVariable();
  });
  attachVariableSplitSync();
}

function attachVariableSplitSync() {
  setTimeout(() => {
    const splitRange = document.getElementById('f-split-range');
    const splitShare = document.getElementById('f-split-share');
    function updateSharePct() {
      const v = parseInt(splitShare?.value, 10) || 0;
      const myPct = document.getElementById('split-my-pct');
      const andreasPct = document.getElementById('split-andreas-pct');
      if (myPct) myPct.textContent = 100 - v;
      if (andreasPct) andreasPct.textContent = v;
    }
    if (splitRange && splitShare) {
      splitRange.addEventListener('input', () => { splitShare.value = splitRange.value; updateSharePct(); });
      splitShare.addEventListener('input', () => { splitRange.value = splitShare.value; updateSharePct(); });
    }
  }, 80);
}

/* =============================================
   PERIODIC COSTS CRUD
   ============================================= */

function periodicForm(item) {
  const isCustomDays = item?.frequencyType === 'days';
  const freqOptions = `
    <option value="1" ${item?.frequencyMonths === 1 && !isCustomDays ? 'selected' : ''}>varje månad</option>
    <option value="2" ${item?.frequencyMonths === 2 ? 'selected' : ''}>varannan månad</option>
    <option value="3" ${item?.frequencyMonths === 3 && !isCustomDays ? 'selected' : ''}>var 3:e månad</option>
    <option value="4" ${item?.frequencyMonths === 4 && !isCustomDays ? 'selected' : ''}>var 4:e månad</option>
    <option value="6" ${item?.frequencyMonths === 6 ? 'selected' : ''}>var 6:e månad</option>
    <option value="12" ${item?.frequencyMonths === 12 && !isCustomDays ? 'selected' : ''}>en gång per år</option>
    <option value="24" ${item?.frequencyMonths === 24 ? 'selected' : ''}>vartannat år</option>
    <option value="custom" ${isCustomDays ? 'selected' : ''}>egen (antal dagar)</option>
  `.replace(/\n/g, '');

  const customDaysVal = item?.frequencyDays || '';

  return `
    <div class="form-group">
      <label class="form-label">Namn</label>
      <input type="text" id="f-name" class="form-input" placeholder="T.ex. Bilservice, Semesterkassa, Årsavgift" value="${h(item?.name ?? '')}">
    </div>
    <div class="form-group">
      <label class="form-label">Belopp per betalningstillfälle (kr)</label>
      <input type="number" id="f-amount" class="form-input" placeholder="0" min="0" step="1" value="${item?.totalAmount ?? ''}">
      <div class="form-hint">Hela summan du betalar varje gång — appen delar upp det i en månadsavsättning automatiskt.</div>
    </div>
    <div class="form-group">
      <label class="form-label">Hur ofta?</label>
      <select id="f-freq" class="form-select">${freqOptions}</select>
      <div id="custom-days-group" style="margin-top:8px;${isCustomDays ? '' : 'display:none;'}">
        <input type="number" id="f-days" class="form-input" placeholder="Antal dagar" min="1" value="${customDaysVal}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Min andel (%)</label>
      <div class="share-row">
        <input type="range" id="f-share-range" min="1" max="100" step="1" value="${item?.share ?? 100}" class="share-slider">
        <input type="number" id="f-share" class="form-input share-input" min="1" max="100" step="1" value="${item?.share ?? 100}">
        <span class="share-pct-label">%</span>
      </div>
      <div class="form-hint">Sätt lägre än 100% om du delar kostnaden med någon.</div>
    </div>
    <div class="form-group">
      <label class="form-label">Nästa betalningsmånad <span style="font-weight:400;color:var(--text-light)">(valfritt)</span></label>
      <input type="month" id="f-payment-month" class="form-input" value="${h(item?.paymentMonth ?? '')}">
      <div class="form-hint">Ange en månad då du vet att betalningen sker — appen räknar automatiskt ut nästa och kommande tillfällen utifrån hur ofta du valt ovan. Lämna tomt om du bara vill spara ihop månadsvis utan att koppla till en specifik månad.</div>
    </div>
    <div class="form-group">
      <label class="form-label">Gäller <span style="font-weight:400;color:var(--text-muted)">(valfritt)</span></label>
      <select id="f-person" class="form-select">
        <option value=""       ${!item?.person ? 'selected' : ''}>— Välj person —</option>
        <option value="mig"    ${item?.person === 'mig' ? 'selected' : ''}>👤 Mig</option>
        <option value="elias"  ${item?.person === 'elias' ? 'selected' : ''}>👦 Elias</option>
        <option value="oliver" ${item?.person === 'oliver' ? 'selected' : ''}>👦 Oliver</option>
        <option value="zoe"    ${item?.person === 'zoe' ? 'selected' : ''}>🐶 Zoe</option>
        <option value="ovrigt" ${item?.person === 'ovrigt' ? 'selected' : ''}>📦 Övrigt</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Anteckning <span style="font-weight:400;color:var(--text-light)">(valfritt)</span></label>
      <input type="text" id="f-note" class="form-input" placeholder="T.ex. kvartal, period" value="${h(item?.note ?? '')}">
    </div>
    ${debitDayHtml(item)}
    <div class="calc-preview" id="calc-preview">
      Sätt undan <span id="calc-amount">–</span> per månad
    </div>
  `;
}

function attachPeriodicPreview() {
  setTimeout(() => {
    const amountEl = document.getElementById('f-amount');
    const freqEl = document.getElementById('f-freq');
    const daysGroup = document.getElementById('custom-days-group');
    const daysEl = document.getElementById('f-days');
    const previewEl = document.getElementById('calc-preview');
    const spanEl = document.getElementById('calc-amount');
    if (!amountEl || !freqEl) return;

    const shareEl = document.getElementById('f-share');
    const shareRangeEl = document.getElementById('f-share-range');
    if (shareEl && shareRangeEl) {
      shareEl.addEventListener('input', () => { shareRangeEl.value = shareEl.value; update(); });
      shareRangeEl.addEventListener('input', () => { shareEl.value = shareRangeEl.value; update(); });
    }

    function update() {
      const a = parseFloat(amountEl.value);
      const f = freqEl.value;
      const s = parseFloat(document.getElementById('f-share')?.value) || 100;
      const isCustom = f === 'custom';
      const days = parseInt(daysEl?.value, 10);

      if (daysGroup) {
        daysGroup.style.display = isCustom ? 'block' : 'none';
      }

      if (a > 0) {
        let monthly;
        if (isCustom && days > 0) {
          monthly = (a * (s / 100) / days) * 30.44;
        } else if (!isCustom && parseInt(f, 10) > 0) {
          monthly = a * (s / 100) / parseInt(f, 10);
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
    update(); // Run once in case editing existing item
  }, 80);
}

function showAddPeriodic() {
  showModal('Lägg till periodisk kostnad', periodicForm(null), () => {
    const name = document.getElementById('f-name').value.trim();
    const totalAmount = parseFloat(document.getElementById('f-amount').value);
    const freqVal = document.getElementById('f-freq').value;
    const share = parseFloat(document.getElementById('f-share').value) || 100;
    const paymentMonth = document.getElementById('f-payment-month').value || null;
    const note = document.getElementById('f-note').value.trim();
    const person = document.getElementById('f-person').value;
    const debitDay = parseInt(document.getElementById('f-debit-day').value, 10) || null;
    const debitMonthOffset = parseInt(document.getElementById('f-debit-offset').value, 10) || 0;
    if (!name) return notify('Ange ett namn.');
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

    const myAmount = Math.round(totalAmount * (share / 100) * 100) / 100;
    ensureMonth().periodic.push({ id: genId(), name, totalAmount: myAmount, share, frequencyMonths, frequencyDays, frequencyType, paymentMonth, note, person, debitDay, debitMonthOffset });
    saveData(); closeModal(); renderPeriodic();
  });
  attachPeriodicPreview();
}

function editPeriodic(id) {
  const item = findItemInAnyMonth('periodic', id);
  if (!item) return;
  const itemMonth = state.month;
  showModal('Redigera periodisk kostnad', periodicForm(item), () => {
    const name = document.getElementById('f-name').value.trim();
    const totalAmount = parseFloat(document.getElementById('f-amount').value);
    const freqVal = document.getElementById('f-freq').value;
    const share = parseFloat(document.getElementById('f-share').value) || 100;
    const paymentMonth = document.getElementById('f-payment-month').value || null;
    const note = document.getElementById('f-note').value.trim();
    const person = document.getElementById('f-person').value;
    const debitDay = parseInt(document.getElementById('f-debit-day').value, 10) || null;
    const debitMonthOffset = parseInt(document.getElementById('f-debit-offset').value, 10) || 0;
    if (!name) return notify('Ange ett namn.');
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
    item.share = share;
    item.frequencyMonths = frequencyMonths;
    item.frequencyDays = frequencyDays;
    item.frequencyType = frequencyType;
    item.paymentMonth = paymentMonth;
    item.note = note;
    item.person = person;
    item.debitDay = debitDay;
    item.debitMonthOffset = debitMonthOffset;
    state.month = itemMonth;
    saveData(); closeModal(); renderPeriodic();
  });
  attachPeriodicPreview();
}

/* =============================================
   DELETE
   ============================================= */

function deleteItem(collection, id) {
  const m = state.data.months[state.month];
  if (!m || !m[collection]) return;
  const item = m[collection].find(i => i.id === id);
  const name = item?.name ?? 'posten';

  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');
  modal.className = 'modal-narrow';
  modal.innerHTML = `
    <div class="modal-header">
      <h2>Ta bort</h2>
      <button type="button" class="modal-close" onclick="closeModal()" aria-label="Stäng">×</button>
    </div>
    <div class="modal-body">
      <p style="margin:0;font-size:14px;color:var(--text)">Vill du ta bort <strong>${h(name)}</strong>?</p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost" onclick="closeModal()">Avbryt</button>
      <button type="button" class="btn btn-danger" id="modal-confirm-delete">Ta bort</button>
    </div>
  `;
  document.getElementById('modal-confirm-delete').onclick = () => {
    m[collection] = m[collection].filter(i => i.id !== id);
    saveData();
    closeModal();
    render();
  };
  overlay.classList.remove('hidden');
}

/* =============================================
   EXPORT
   ============================================= */

function exportJSON() {
  const json = JSON.stringify(state.data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ekonomi-export.json';
  a.click();
  URL.revokeObjectURL(url);
}

/* =============================================
   NAVIGATION
   ============================================= */

function navigate(view) {
  state.view = view;
  render();
}

function navigateAndScroll(view, anchorId) {
  state.view = view;
  render();
  setTimeout(() => {
    const el = document.getElementById(anchorId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

// Find an item by id in any month, switching state.month to the correct one.
// Returns the item, or null if not found anywhere.
function findItemInAnyMonth(type, id) {
  // Try current month first
  let item = (md()[type] || []).find(i => i.id === id);
  if (item) return item;
  // Search all months
  for (const [yyyyMm, m] of Object.entries(state.data.months || {})) {
    item = (m[type] || []).find(i => i.id === id);
    if (item) {
      state.month = yyyyMm;
      return item;
    }
  }
  return null;
}

/* =============================================
   SEARCH
   ============================================= */

function buildSearchIndex() {
  const results = [];
  const months = state.data.months || {};

  // Collect all unique items across all months (keyed by item.id to deduplicate)
  const seen = { fixed: new Set(), variable: new Set(), periodic: new Set(), income: new Set() };

  for (const [yyyyMm, m] of Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]))) {
    (m.fixed || []).forEach(item => {
      if (seen.fixed.has(item.id)) return;
      seen.fixed.add(item.id);
      const cat = FIXED_CATEGORIES.find(c => c.id === item.category) || { label: 'Fast', icon: '📄', id: item.category || 'other' };
      results.push({
        id: item.id, type: 'fixed',
        name: item.name,
        meta: [item.company, cat.label].filter(Boolean).join(' · '),
        amount: item.amount,
        icon: cat.icon,
        catId: cat.id,
        month: yyyyMm,
      });
    });

    (m.variable || []).forEach(item => {
      if (seen.variable.has(item.id)) return;
      seen.variable.add(item.id);
      const cat = VARIABLE_CATEGORIES.find(c => c.id === item.category) || { label: 'Rörlig', icon: '🛒', id: item.category || 'other' };
      results.push({
        id: item.id, type: 'variable',
        name: item.name,
        meta: cat.label,
        amount: item.budget,
        icon: cat.icon,
        month: yyyyMm,
      });
    });

    (m.periodic || []).forEach(item => {
      if (seen.periodic.has(item.id)) return;
      seen.periodic.add(item.id);
      results.push({
        id: item.id, type: 'periodic',
        name: item.name,
        meta: 'Periodisk',
        amount: item.totalAmount,
        icon: '📅',
        month: yyyyMm,
      });
    });

    (m.income || []).forEach(item => {
      if (seen.income.has(item.id)) return;
      seen.income.add(item.id);
      results.push({
        id: item.id, type: 'income',
        name: item.name,
        meta: 'Inkomst',
        amount: item.amount,
        icon: '💰',
        month: yyyyMm,
      });
    });
  }

  return results;
}

function handleSearch(query) {
  const resultsEl = document.getElementById('sidebar-search-results');
  const clearBtn  = document.getElementById('sidebar-search-clear');
  if (clearBtn) clearBtn.classList.toggle('hidden', !query);
  if (!query || query.trim() === '') {
    resultsEl.classList.add('hidden');
    return;
  }

  const q = query.toLowerCase().trim();
  const index = buildSearchIndex();
  const matches = index.filter(item =>
    item.name.toLowerCase().includes(q) ||
    item.meta.toLowerCase().includes(q) ||
    String(item.amount).includes(q)
  ).slice(0, 20);

  if (!matches.length) {
    resultsEl.innerHTML = `<div class="search-no-results">Inga resultat för "${h(query)}"</div>`;
    resultsEl.classList.remove('hidden');
    return;
  }

  const VIEW_LABELS = { fixed: 'Fasta', variable: 'Rörliga', periodic: 'Periodiska', income: 'Inkomster' };
  resultsEl.innerHTML = matches.map(item => {
    const monthLabel = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' })
      .format(new Date(item.month + '-15'));
    const monthTitle = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
    return `
    <div class="search-result-item" onclick="searchNavigateTo('${item.type}','${item.id}','${item.month}')">
      <span class="search-result-icon">${item.icon}</span>
      <span class="search-result-info">
        <span class="search-result-name">${h(item.name)}</span>
        <span class="search-result-amount">${fmt(item.amount)}</span>
        <span class="search-result-meta">${monthTitle}</span>
      </span>
    </div>
  `;
  }).join('');
  resultsEl.classList.remove('hidden');
}

function clearSearch() {
  const input = document.getElementById('sidebar-search-input');
  if (input) input.value = '';
  document.getElementById('sidebar-search-results').classList.add('hidden');
  document.getElementById('sidebar-search-clear').classList.add('hidden');
}

function showSearchResults() {
  const input = document.getElementById('sidebar-search-input');
  if (input && input.value.trim()) {
    document.getElementById('sidebar-search-results').classList.remove('hidden');
  }
}

function searchNavigateTo(type, id, month) {
  // Close search
  document.getElementById('sidebar-search-input').value = '';
  document.getElementById('sidebar-search-results').classList.add('hidden');
  document.getElementById('sidebar-search-clear').classList.add('hidden');

  // Switch to the right month if needed
  if (month && state.month !== month) {
    state.month = month;
  }

  // Navigate to view and scroll to item
  navigateAndScroll(type, `item-${type}-${id}`);

  // Highlight the row briefly
  setTimeout(() => {
    const el = document.getElementById(`item-${type}-${id}`);
    if (el) {
      el.classList.add('search-highlight');
      setTimeout(() => el.classList.remove('search-highlight'), 1800);
    }
  }, 120);
}

/* =============================================
   INIT
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
  // Rensa gammal localStorage-data från innan Supabase
  localStorage.removeItem('ekonomi_v1');

  // Stäng sökresultat vid klick utanför input-fältet
  document.addEventListener('click', e => {
    const inputEl  = document.getElementById('sidebar-search-input');
    const clearBtn = document.getElementById('sidebar-search-clear');
    const resultsEl = document.getElementById('sidebar-search-results');
    if (e.target !== inputEl && e.target !== clearBtn && !resultsEl.contains(e.target)) {
      resultsEl.classList.add('hidden');
    }
  });

  // Login form
  document.getElementById('btn-login').addEventListener('click', handleLogin);
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });

  // Säkerhets-timeout: om auth inte svarar inom 8 s, visa inloggning ändå
  const authTimeout = setTimeout(() => {
    const loadingEl = document.getElementById('loading-screen');
    const loginEl = document.getElementById('login-screen');
    if (loadingEl && !loadingEl.classList.contains('hidden')) {
      console.warn('Auth-timeout – visar inloggning');
      loadingEl.classList.add('hidden');
      loginEl.classList.remove('hidden');
    }
  }, 8000);

  db.auth.onAuthStateChange(async (event, session) => {
    // INITIAL_SESSION  = sidan laddas (session finns eller saknas)
    // SIGNED_IN        = bara vid faktisk ny inloggning (inte token-refresh i v2)
    // SIGNED_OUT       = användaren loggade ut
    // TOKEN_REFRESHED / USER_UPDATED / MFA_CHALLENGE_VERIFIED → ignoreras
    if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return;

    // Om appen redan är igång och det bara är en SIGNED_IN från token-refresh, ignorera
    if (appInitialized && event === 'SIGNED_IN') return;

    clearTimeout(authTimeout);
    const loadingEl = document.getElementById('loading-screen');
    const loginEl = document.getElementById('login-screen');

    if (session) {
      state.userId = session.user.id;
      loginEl.classList.add('hidden');
      try {
        await Promise.race([
          loadData(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
        ]);
      } catch (e) {
        console.warn('loadData misslyckades:', e.message);
      }
      if (loadingEl) loadingEl.classList.add('hidden');
      initApp();
    } else {
      state.userId = null;
      state.data = newData();
      appInitialized = false;
      if (loadingEl) loadingEl.classList.add('hidden');
      loginEl.classList.remove('hidden');
    }
  });
});
