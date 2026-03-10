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
    { id: 'streaming', label: 'Streaming & appar', icon: '📺', bg: '#FDF4FF' },
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
    data: newData(),
    userId: null,
};

function newData() {
    return { income: [], fixed: [], variable: [], periodic: [] };
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
        state.data = Object.assign(newData(), data.data);
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
        maximumFractionDigits: 0,
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
    const income = sum(state.data.income, i => i.amount);
    const fixed = sum(state.data.fixed, i => i.amount);
    const variable = sum(state.data.variable, i => i.budget);
    const periodicMonthly = sum(state.data.periodic, i => i.totalAmount / i.frequencyMonths);
    const totalOut = fixed + variable + periodicMonthly;
    const remaining = income - totalOut;
    return { income, fixed, variable, periodicMonthly, totalOut, remaining };
}

function sum(arr, fn) {
    return arr.reduce((s, x) => s + (fn(x) || 0), 0);
}
function calcMortgage(loanAmount, valuation, listRate, rateDiscount, bufferRate) {
  const effectiveRate = Math.max(0, listRate - rateDiscount);
  const ltv           = valuation > 0 ? (loanAmount / valuation) * 100 : 0;

  let amortPct = 0;
  if (ltv > 70)      amortPct = 2;
  else if (ltv > 50) amortPct = 1;

  const monthlyAmort            = (loanAmount * amortPct / 100) / 12;
  const yearlyInterest          = loanAmount * (effectiveRate / 100);
  const monthlyInterest         = yearlyInterest / 12;

  // Swedish tax reduction: 30% on first 100 000 kr/year, 21% above
  const yearlyTaxReduction      = yearlyInterest <= 100000
    ? yearlyInterest * 0.30
    : 100000 * 0.30 + (yearlyInterest - 100000) * 0.21;
  const monthlyTaxReduction     = yearlyTaxReduction / 12;
  const monthlyInterestAfterTax = monthlyInterest - monthlyTaxReduction;

  const bufferEffective         = effectiveRate + Math.max(0, bufferRate);
  const monthlyInterestBuffer   = loanAmount * (bufferEffective / 100) / 12;

  return {
    effectiveRate, ltv, amortPct,
    monthlyAmort, monthlyInterest, monthlyTaxReduction,
    monthlyInterestAfterTax, bufferEffective, monthlyInterestBuffer,
    totalBeforeTax:  monthlyAmort + monthlyInterest,
    totalAfterTax:   monthlyAmort + monthlyInterestAfterTax,
    totalWithBuffer: monthlyAmort + monthlyInterestBuffer,
  };
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
    const t = calcTotals();
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
    const rows = state.data.periodic.map(item => {
        const monthly = item.totalAmount / item.frequencyMonths;
        return `
      <div class="item-row" style="cursor:default;">
        <div class="item-icon" style="background:var(--warning-bg)">📅</div>
        <div class="item-info">
          <div class="item-name">${h(item.name)}</div>
          <div class="item-meta">${fmt(item.totalAmount)} · ${h(FREQ_LABELS[item.frequencyMonths] || 'periodiskt')}</div>
        </div>
        <div class="item-amount amount-periodic">${fmt(monthly)}/mån</div>
      </div>
    `;
    }).join('');

    return `
    <div class="card">
      <div class="card-header"><h2>Periodiska kostnader</h2></div>
      <div class="item-list">
        ${rows || emptySmall('Inga periodiska kostnader')}
      </div>
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
        <button class="btn-icon"        onclick="editIncome('${item.id}')"            title="Redigera">${I.edit}</button>
        <button class="btn-icon danger" onclick="deleteItem('income','${item.id}')"  title="Ta bort">${I.trash}</button>
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

/* =============================================
   FIXED EXPENSES VIEW
   ============================================= */

function renderFixed() {
    const el = document.getElementById('view-fixed');
    const total = sum(state.data.fixed, i => i.amount);

    const sections = FIXED_CATEGORIES.map(cat => {
        const items = state.data.fixed.filter(i => i.category === cat.id);
        if (!items.length) return '';
        const catTotal = sum(items, i => i.amount);

        const rows = items.map(item => {
      const PERSON_LABELS = { mig: '👤 Mig', elias: '👦 Elias', oliver: '👦 Oliver', zoe: '🐶 Zoe', ovrigt: '📦 Övrigt' };
      const editFn = item.type === 'mortgage' ? `editMortgage('${item.id}')` : `editFixed('${item.id}')`;
      const personBadge = item.person ? `<span class="badge badge-person">${h(PERSON_LABELS[item.person] ?? item.person)}</span>` : '';
      const shareBadge  = (item.share && item.share < 100) ? `<span class="badge badge-share">${item.share}%</span>` : '';
      const meta   = item.type === 'mortgage'
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

/* =============================================
   VARIABLE EXPENSES VIEW
   ============================================= */

function renderVariable() {
    const el = document.getElementById('view-variable');
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

/* =============================================
   PERIODIC COSTS VIEW
   ============================================= */

function renderPeriodic() {
    const el = document.getElementById('view-periodic');
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
  const modal   = document.getElementById('modal');
  modal.className = extraClass;

    modal.innerHTML = `
    <div class="modal-header">
      <h2>${h(title)}</h2>
      <button class="modal-close" onclick="closeModal()" aria-label="Stäng">×</button>
    </div>
    <div class="modal-body">${bodyHtml}</div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Avbryt</button>
      <button class="btn btn-primary" id="modal-save">Spara</button>
    </div>
  `;

    document.getElementById('modal-save').onclick = onSave;
    overlay.classList.remove('hidden');

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
        state.data.income.push({ id: genId(), name, amount });
        saveData(); closeModal(); renderIncome();
    });
}

function editIncome(id) {
    const item = state.data.income.find(i => i.id === id);
    if (!item) return;
    showModal('Redigera inkomst', incomeForm(item), () => {
        const name = document.getElementById('f-name').value.trim();
        const amount = parseFloat(document.getElementById('f-amount').value);
        if (!name) return notify('Ange ett namn.');
        if (!(amount > 0)) return notify('Ange ett giltigt belopp.');
        item.name = name; item.amount = amount;
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

  // When editing, back-calculate the entered amount from stored amount + share
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
        <input type="range" id="f-share-range" min="1" max="100" step="1" value="${storedShare}" class="share-slider">
        <input type="number" id="f-share" class="form-input share-input" min="1" max="100" step="1" value="${storedShare}">
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

      // Sync range ↔ number
      const rangeEl = document.getElementById('f-share-range');
      if (rangeEl && document.activeElement !== rangeEl) rangeEl.value = share;

      if (amount > 0) {
        const monthly     = period === 'year' ? amount / 12 : amount;
        const myMonthly   = monthly * (share / 100);
        const perYear     = period === 'year' ? amount : amount * 12;
        const myPerYear   = perYear * (share / 100);
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
        // Keep range and number in sync
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
    if (!name)      return notify('Ange ett namn.');
    if (!resolved)  return notify('Ange ett giltigt belopp.');
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
        const name = document.getElementById('f-name').value.trim();
        const budget = parseFloat(document.getElementById('f-budget').value);
        const category = document.getElementById('f-cat').value;
        if (!name) return notify('Ange ett namn.');
        if (!(budget > 0)) return notify('Ange ett giltigt belopp.');
        state.data.variable.push({ id: genId(), name, budget, category });
        saveData(); closeModal(); renderVariable();
    });
}

function editVariable(id) {
    const item = state.data.variable.find(i => i.id === id);
    if (!item) return;
    showModal('Redigera rörlig budget', variableForm(item), () => {
        const name = document.getElementById('f-name').value.trim();
        const budget = parseFloat(document.getElementById('f-budget').value);
        const category = document.getElementById('f-cat').value;
        if (!name) return notify('Ange ett namn.');
        if (!(budget > 0)) return notify('Ange ett giltigt belopp.');
        item.name = name; item.budget = budget; item.category = category;
        saveData(); closeModal(); renderVariable();
    });
}

/* =============================================
   PERIODIC COSTS CRUD
   ============================================= */

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
        const amountEl = document.getElementById('f-amount');
        const freqEl = document.getElementById('f-freq');
        const previewEl = document.getElementById('calc-preview');
        const spanEl = document.getElementById('calc-amount');
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
        update(); // Run once in case editing existing item
    }, 80);
}

function showAddPeriodic() {
    showModal('Lägg till periodisk kostnad', periodicForm(null), () => {
        const name = document.getElementById('f-name').value.trim();
        const totalAmount = parseFloat(document.getElementById('f-amount').value);
        const frequencyMonths = parseInt(document.getElementById('f-freq').value, 10);
        const note = document.getElementById('f-note').value.trim();
        if (!name) return notify('Ange ett namn.');
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
        const name = document.getElementById('f-name').value.trim();
        const totalAmount = parseFloat(document.getElementById('f-amount').value);
        const frequencyMonths = parseInt(document.getElementById('f-freq').value, 10);
        const note = document.getElementById('f-note').value.trim();
        if (!name) return notify('Ange ett namn.');
        if (!(totalAmount > 0)) return notify('Ange ett giltigt belopp.');
        item.name = name; item.totalAmount = totalAmount;
        item.frequencyMonths = frequencyMonths; item.note = note;
        saveData(); closeModal(); renderPeriodic();
    });
    attachPeriodicPreview();
}

/* =============================================
   DELETE
   ============================================= */

function deleteItem(collection, id) {
    if (!confirm('Ta bort posten?')) return;
    state.data[collection] = state.data[collection].filter(i => i.id !== id);
    saveData();
    render();
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

/* =============================================
   INIT
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
    // Rensa gammal localStorage-data från innan Supabase
    localStorage.removeItem('ekonomi_v1');

    // Login form
    document.getElementById('btn-login').addEventListener('click', handleLogin);
    document.getElementById('login-password').addEventListener('keydown', e => {
        if (e.key === 'Enter') handleLogin();
    });

    db.auth.onAuthStateChange(async (event, session) => {
        const loadingEl = document.getElementById('loading-screen');
        const loginEl   = document.getElementById('login-screen');

        if (session) {
            state.userId = session.user.id;
            loginEl.classList.add('hidden');
            try {
                await loadData();
            } catch (e) {
                console.warn('loadData misslyckades:', e);
            }
            if (loadingEl) loadingEl.classList.add('hidden');
            initApp();
        } else {
            state.userId = null;
            state.data   = newData();
            if (loadingEl) loadingEl.classList.add('hidden');
            loginEl.classList.remove('hidden');
        }
    });
});
