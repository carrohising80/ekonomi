'use strict';

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
