// LifeOS Design System v1 — integração progressiva sem reescrever os módulos.
const DS_STYLE_ID = 'lifeos-design-system';

function carregarDesignSystem() {
  if (document.getElementById(DS_STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = DS_STYLE_ID;
  link.rel = 'stylesheet';
  link.href = '/design-system.css?v=1';
  document.head.appendChild(link);
}

function aplicarTema() {
  const tema = localStorage.getItem('lifeos:theme') || 'system';
  if (tema === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = tema;
}

const ICONES = {
  '✅': '<path d="m5 12 4 4L19 6"/>',
  '✓': '<path d="m5 12 4 4L19 6"/>',
  '✔': '<path d="m5 12 4 4L19 6"/>',
  '🪴': '<path d="M12 14V8"/><path d="M12 10c-4 0-6-2-6-5 4 0 6 2 6 5Z"/><path d="M12 8c4 0 6-2 6-5-4 0-6 2-6 5Z"/><path d="M6 14h12l-1 7H7Z"/>',
  '🌱': '<path d="M12 22V12"/><path d="M12 12C8 12 5 9 5 5c4 0 7 3 7 7Z"/><path d="M12 12c4 0 7-3 7-7-4 0-7 3-7 7Z"/>',
  '🏠': '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
  '🛒': '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L21 8H7"/>',
  '📦': '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  '💳': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  '📋': '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/>',
  '⚙️': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14v-4a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3h4a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10v4a1.7 1.7 0 0 0-1.6 1Z"/>',
};

function svgIcon(path) {
  return `<span class="ds-inline-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`;
}

function substituirEmojis(root = document) {
  const seletor = 'button, .tab-btn, .sub-aba, .filtro-btn, .metrica-label, .card-hoje-titulo-txt, .config-section-titulo, .secao-titulo, .badge';
  root.querySelectorAll?.(seletor).forEach(elemento => {
    if (elemento.dataset.dsEmojiDone) return;
    const texto = elemento.textContent || '';
    const emoji = Object.keys(ICONES).find(item => texto.includes(item));
    if (!emoji) return;
    const walker = document.createTreeWalker(elemento, NodeFilter.SHOW_TEXT);
    let no;
    while ((no = walker.nextNode())) {
      if (!no.nodeValue.includes(emoji)) continue;
      const partes = no.nodeValue.split(emoji);
      const fragmento = document.createDocumentFragment();
      partes.forEach((parte, indice) => {
        if (parte) fragmento.appendChild(document.createTextNode(parte));
        if (indice < partes.length - 1) {
          const span = document.createElement('span');
          span.innerHTML = svgIcon(ICONES[emoji]);
          fragmento.appendChild(span.firstElementChild);
        }
      });
      no.replaceWith(fragmento);
      break;
    }
    elemento.dataset.dsEmojiDone = '1';
  });
}

function estruturarInterface(root = document) {
  root.querySelectorAll?.('.secao').forEach(secao => secao.classList.add('ds-page-section'));
  root.querySelectorAll?.('.cartao').forEach(cartao => {
    if (cartao.previousElementSibling?.classList.contains('config-section-titulo')) cartao.classList.add('ds-section-divider');
  });
  substituirEmojis(root);
}

function observarInterface() {
  const observer = new MutationObserver(registros => {
    registros.forEach(registro => registro.addedNodes.forEach(no => {
      if (no instanceof HTMLElement) estruturarInterface(no);
    }));
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function iniciar() {
  carregarDesignSystem();
  aplicarTema();
  estruturarInterface();
  observarInterface();
  window.lifeosTheme = {
    set(tema = 'system') {
      if (!['light', 'dark', 'system'].includes(tema)) return;
      localStorage.setItem('lifeos:theme', tema);
      aplicarTema();
    },
    get() { return localStorage.getItem('lifeos:theme') || 'system'; },
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
else iniciar();
