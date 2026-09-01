// Tablet product shell v2 loader — reapplies the final tablet layer
// after enhancement modules append their own stylesheets.
(() => {
  const ID = 'lifeos-tablet-product-shell-v2';

  function apply() {
    document.querySelectorAll('#' + ID).forEach(node => node.remove());
    const link = document.createElement('link');
    link.id = ID;
    link.rel = 'stylesheet';
    link.href = '/tablet-product-shell-v2.css?v=2';
    document.head.appendChild(link);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.setTimeout(apply, 80), { once: true });
  } else {
    window.setTimeout(apply, 80);
  }

  window.addEventListener('load', () => window.setTimeout(apply, 120), { once: true });
})();
