import { icon } from './icons.js';

let active = null;

function finish(value) {
  if (!active) return;
  const { overlay, resolve, returnFocus, keydown } = active;
  document.removeEventListener('keydown', keydown);
  overlay.remove();
  document.body.classList.remove('lifeos-confirm-open');
  active = null;
  window.requestAnimationFrame(() => returnFocus?.focus?.({ preventScroll: true }));
  resolve(value);
}

export function confirmAction({ title = 'Confirmar ação', message = '', confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false } = {}) {
  if (active) finish(false);
  return new Promise(resolve => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overlay = document.createElement('div');
    overlay.className = 'lifeos-confirm-overlay';
    overlay.innerHTML = `
      <section class="lifeos-confirm" role="alertdialog" aria-modal="true" aria-labelledby="lifeosConfirmTitle" aria-describedby="lifeosConfirmMessage">
        <header class="lifeos-confirm__head">
          <div>
            <h2 id="lifeosConfirmTitle">${escapeHtml(title)}</h2>
            ${message ? `<p id="lifeosConfirmMessage">${escapeHtml(message)}</p>` : '<p id="lifeosConfirmMessage"></p>'}
          </div>
          <button type="button" class="lifeos-icon-button" data-confirm-cancel aria-label="Fechar">${icon('close', 18)}</button>
        </header>
        <footer class="lifeos-confirm__actions">
          <button type="button" class="lifeos-btn lifeos-btn--secondary" data-confirm-cancel>${escapeHtml(cancelLabel)}</button>
          <button type="button" class="lifeos-btn ${danger ? 'lifeos-btn--danger' : 'lifeos-btn--primary'}" data-confirm-ok>${escapeHtml(confirmLabel)}</button>
        </footer>
      </section>`;
    const keydown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    };
    active = { overlay, resolve, returnFocus, keydown };
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-confirm-cancel]')) finish(false);
      else if (event.target.closest('[data-confirm-ok]')) finish(true);
    });
    document.addEventListener('keydown', keydown);
    document.body.appendChild(overlay);
    document.body.classList.add('lifeos-confirm-open');
    window.requestAnimationFrame(() => overlay.querySelector('[data-confirm-ok]')?.focus({ preventScroll: true }));
  });
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

window.lifeosConfirmAction = confirmAction;
