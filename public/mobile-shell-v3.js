// LifeOS Mobile Shell v3 — linguagem visual alinhada ao Nordestrip
// Camada final de interface. Não altera regras de negócio nem dados.

(() => {
  'use strict';

  const STYLE_ID = 'lifeos-mobile-shell-v3';

  const ICONS = {
    finance: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
    house: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
    plant: '<path d="M12 14V8"/><path d="M12 10c-4 0-6-2-6-5 4 0 6 2 6 5Z"/><path d="M12 8c4 0 6-2 6-5-4 0-6 2-6 5Z"/><path d="M6 14h12l-1 7H7Z"/>',
    folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14v-4a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3h4a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10v4a1.7 1.7 0 0 0-1.6 1Z"/>',
    ritual: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4"/>',
  };

  function svg(name, size = 19) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || '') + '</svg>';
  }

  function loadStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = '/mobile-shell-v3.css?v=3';
    document.head.appendChild(link);
  }

  function toast(message, type = 'ok', duration = 2600) {
    let region = document.getElementById('lifeosToastRegion');
    if (!region) {
      region = document.createElement('div');
      region.id = 'lifeosToastRegion';
      region.className = 'lifeos-toast-region';
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }

    const item = document.createElement('div');
    item.className = 'lifeos-toast ' + (type === 'erro' ? 'is-error' : 'is-ok');
    item.textContent = message;
    region.appendChild(item);
    window.setTimeout(() => item.remove(), duration);
  }

  window.lifeosToast = toast;

  function addPageHeader(targetId, kicker, title, description) {
    const target = document.getElementById(targetId);
    if (!target || target.querySelector(':scope > .lifeos-page-head')) return;

    const head = document.createElement('header');
    head.className = 'lifeos-page-head';
    head.innerHTML =
      '<span class="lifeos-page-kicker">' + kicker + '</span>' +
      '<h1>' + title + '</h1>' +
      '<p>' + description + '</p>';
    target.prepend(head);
  }

  function installPageHeaders() {
    addPageHeader('abaCasa', 'LifeOS', 'Casa', 'Compras, estoque, tarefas, contas e alimentação.');
    addPageHeader('abaPlantas', 'Casa', 'Plantas', 'Cuidados, rotinas e histórico das plantas.');
    addPageHeader('abaMais', 'LifeOS', 'Mais', 'Projetos, rituais e configurações.');
  }

  function navigate(type, value) {
    if (type === 'tab' && typeof window.trocarAba === 'function') {
      window.trocarAba(value);
      return;
    }
    if (type === 'section' && typeof window.abrirSecao === 'function') {
      window.abrirSecao(value);
    }
  }

  function removeLegacyHomeShortcuts() {
    document.getElementById('lifeosHomeShortcuts')?.remove();
  }

  function iconizeDeleteButton(button) {
    if (!(button instanceof HTMLButtonElement) || button.dataset.lifeosDeleteIcon === '1') return;

    const label = (button.textContent || '').replace(/\s+/g, ' ').trim();
    const aria = button.getAttribute('aria-label') || '';
    const title = button.title || '';
    const destructive = /^(Excluir|Remover)(\s|$)/i.test(label)
      || /excluir|remover/i.test(aria)
      || /excluir|remover/i.test(title);

    if (!destructive) return;

    // Não converte botões que representam uma confirmação final dentro de uma folha própria.
    if (button.id === 'uiConfirmAction' || button.matches('[type="submit"]')) return;

    const accessible = label || aria || title || 'Excluir';
    button.classList.add('lifeos-icon-action', 'is-danger');
    button.setAttribute('aria-label', accessible);
    button.title = accessible;
    button.innerHTML = svg('trash', 17);
    button.dataset.lifeosDeleteIcon = '1';
  }

  function normalizeActions(root = document) {
    root.querySelectorAll?.('button').forEach(iconizeDeleteButton);
    root.querySelectorAll?.('.lista-item-acoes, .est-controles, .ui-row-actions, .ac-actions')
      .forEach(row => row.classList.add('lifeos-action-row'));
  }

  function normalizeMoreMenu() {
    const map = {
      'Projetos pessoais': 'folder',
      'Rituais': 'ritual',
      'Configurações': 'settings',
    };

    document.querySelectorAll('#abaMais .cartao.clicavel').forEach(card => {
      const text = card.textContent || '';
      const entry = Object.entries(map).find(([label]) => text.includes(label));
      if (!entry) return;

      card.classList.add('lifeos-module-card');
      const row = card.querySelector(':scope > div');
      if (!row) return;

      let icon = card.querySelector('.lifeos-module-icon');
      if (!icon) {
        const legacyIcon = card.querySelector('.ui-menu-icon');
        if (legacyIcon) {
          legacyIcon.classList.remove('ui-menu-icon');
          legacyIcon.classList.add('lifeos-module-icon');
          legacyIcon.removeAttribute('style');
          icon = legacyIcon;
        } else {
          icon = document.createElement('span');
          icon.className = 'lifeos-module-icon';
          icon.innerHTML = svg(entry[1]);
          row.insertBefore(icon, row.firstElementChild);
        }
      }
    });
  }

  function alignFinanceStatus() {
    document.querySelectorAll(
      '.cf-conta-item, .cf-hoje-item, .ac-row, .config-item, .ui-settings-row, .evento-linha'
    ).forEach(row => row.classList.add('lifeos-aligned-row'));
  }

  function enhanceAll(root = document) {
    installPageHeaders();
    removeLegacyHomeShortcuts();
    normalizeActions(root);
    normalizeMoreMenu();
    alignFinanceStatus();
  }

  function installObserver() {
    let scheduled = false;
    const observer = new MutationObserver(records => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        records.forEach(record => record.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) normalizeActions(node);
        }));
        enhanceAll();
        scheduled = false;
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    loadStyles();
    enhanceAll();
    installObserver();

    window.addEventListener('lifeos:ready', () => window.setTimeout(enhanceAll, 40));
    window.addEventListener('lifeos:financeiro-abrir', () => window.setTimeout(enhanceAll, 40));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
