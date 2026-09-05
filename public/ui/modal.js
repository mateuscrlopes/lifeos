const OPEN_OVERLAYS = new Set();
const RETURN_FOCUS = new WeakMap();

function updateBodyState() {
  document.body.classList.toggle('lifeos-modal-open', OPEN_OVERLAYS.size > 0);
}

function focusable(root) {
  return [...root.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
    .filter(node => !node.hidden && node.getAttribute('aria-hidden') !== 'true');
}

export function openModalElement(overlay, { initialFocus = null } = {}) {
  if (!(overlay instanceof HTMLElement)) return false;
  RETURN_FOCUS.set(overlay, document.activeElement instanceof HTMLElement ? document.activeElement : null);
  overlay.hidden = false;
  overlay.classList.add('aberto');
  overlay.dataset.lifeosModalOpen = '1';
  OPEN_OVERLAYS.add(overlay);
  updateBodyState();
  window.requestAnimationFrame(() => {
    const target = initialFocus instanceof HTMLElement
      ? initialFocus
      : overlay.querySelector('[autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
    target?.focus?.({ preventScroll: true });
  });
  return true;
}

export function closeModalElement(overlay) {
  if (!(overlay instanceof HTMLElement)) return false;
  overlay.classList.remove('aberto');
  overlay.hidden = true;
  delete overlay.dataset.lifeosModalOpen;
  OPEN_OVERLAYS.delete(overlay);
  updateBodyState();
  const returnFocus = RETURN_FOCUS.get(overlay);
  RETURN_FOCUS.delete(overlay);
  window.requestAnimationFrame(() => returnFocus?.focus?.({ preventScroll: true }));
  return true;
}

export function closeTopModal() {
  const overlay = [...OPEN_OVERLAYS].at(-1);
  return overlay ? closeModalElement(overlay) : false;
}

function handleKeydown(event) {
  const overlay = [...OPEN_OVERLAYS].at(-1);
  if (!overlay) return;
  if (event.key === 'Escape') {
    const close = overlay.querySelector('[data-lifeos-close], [data-fechar-ritmo], .modal-fechar, .ui-sheet-close');
    if (close) {
      event.preventDefault();
      close.click();
    }
    return;
  }
  if (event.key !== 'Tab') return;
  const items = focusable(overlay);
  if (!items.length) return;
  const first = items[0];
  const last = items.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

document.addEventListener('keydown', handleKeydown);

window.LifeOSModal = Object.freeze({ open: openModalElement, close: closeModalElement, closeTop: closeTopModal });
