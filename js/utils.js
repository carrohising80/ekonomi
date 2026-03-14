'use strict';

/* =============================================
   GENERAL UTILITIES
   ============================================= */

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmt(n) {
  return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(n) + '\u00a0kr';
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

function sum(arr, fn) {
  return arr.reduce((s, x) => s + (fn(x) || 0), 0);
}

function emptyState(icon, title, desc) {
  return `
    <div class="empty-state">
      <span class="es-icon">${icon}</span>
      <h3>${h(title)}</h3>
      <p>${h(desc)}</p>
    </div>
  `;
}

function emptySmall(text) {
  return `<div style="padding:20px;text-align:center;color:var(--text-light);font-size:13px;">${h(text)}</div>`;
}

/* =============================================
   CALCULATIONS
   ============================================= */

function calcTotals() {
  const income          = sum(state.data.income,   i => i.amount);
  const fixed           = sum(state.data.fixed,    i => i.amount);
  const variable        = sum(state.data.variable, i => i.budget);
  const periodicMonthly = sum(state.data.periodic, i => {
    if (i.frequencyType === 'days' && i.frequencyDays) {
      return (i.totalAmount / i.frequencyDays) * 30.44;
    }
    return i.totalAmount / i.frequencyMonths;
  });
  const totalOut        = fixed + variable + periodicMonthly;
  const remaining       = income - totalOut;
  return { income, fixed, variable, periodicMonthly, totalOut, remaining };
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
