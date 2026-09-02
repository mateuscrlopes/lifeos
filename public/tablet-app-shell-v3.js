// Tablet App Shell v4 — keeps the tablet/iOS parity layer as the final stylesheet.
(() => {
  const ID = 'lifeos-tablet-app-shell-v3';
  let timer = null;
  let applying = false;

  function apply() {
    if (applying) return;
    applying = true;

    document.getElementById(ID)?.remove();

    const link = document.createElement('link');
    link.id = ID;
    link.rel = 'stylesheet';
    link.href = '/tablet-app-shell-v3.css?v=3';
    document.head.appendChild(link);
    document.body.classList.add('tablet-app-shell-v3');

    requestAnimationFrame(() => { applying = false; });
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(apply, 40);
  }

  function observeLateStyles() {
    const observer = new MutationObserver(records => {
      if (applying) return;
      const addedForeignStyle = records.some(record =>
        [...record.addedNodes].some(node =>
          node instanceof HTMLLinkElement &&
          node.rel === 'stylesheet' &&
          node.id !== ID
        )
      );
      if (addedForeignStyle) schedule();
    });

    observer.observe(document.head, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      apply();
      observeLateStyles();
    }, { once: true });
  } else {
    apply();
    observeLateStyles();
  }

  window.addEventListener('load', schedule, { once: true });
})();
