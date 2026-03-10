'use strict';

/* =============================================
   SUPABASE CLIENT
   ============================================= */

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  const email   = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl   = document.getElementById('login-error');
  const btn     = document.getElementById('btn-login');

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
