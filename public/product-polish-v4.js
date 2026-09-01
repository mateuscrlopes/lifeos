// Product polish v4 loader — keeps the final visual layer after functional module CSS.
(() => {
  const ID = 'lifeos-product-polish-v4';

  function load() {
    let link = document.getElementById(ID);
    if (link) link.remove();

    link = document.createElement('link');
    link.id = ID;
    link.rel = 'stylesheet';
    link.href = '/product-polish-v4.css?v=1';
    document.head.appendChild(link);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load, { once: true });
  } else {
    load();
  }

  window.addEventListener('lifeos:ready', () => {
    window.setTimeout(load, 120);
  }, { once: true });
})();
