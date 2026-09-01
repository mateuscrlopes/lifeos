// Tablet App Shell v3 — guarantees the tablet/iOS parity layer wins over legacy CSS.
(() => {
  const ID = 'lifeos-tablet-app-shell-v3';

  function apply() {
    document.getElementById(ID)?.remove();
    const link = document.createElement('link');
    link.id = ID;
    link.rel = 'stylesheet';
    link.href = '/tablet-app-shell-v3.css?v=1';
    document.head.appendChild(link);
    document.body.classList.add('tablet-app-shell-v3');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(apply, 90), { once: true });
  } else {
    setTimeout(apply, 90);
  }

  window.addEventListener('load', () => setTimeout(apply, 160), { once: true });
})();
