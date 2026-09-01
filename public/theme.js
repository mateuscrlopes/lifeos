// LifeOS — aparência GhuMat
(() => {
  'use strict';

  const KEY = 'lifeos-theme';
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function preferred() {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return media.matches ? 'dark' : 'light';
  }

  function apply(mode) {
    const effective = mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;
    document.documentElement.dataset.theme = effective;
    document.documentElement.dataset.themeMode = mode;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', effective === 'dark' ? '#111A17' : '#F4F2ED');

    document.querySelectorAll('[data-ghumat-theme]').forEach((button) => {
      button.classList.toggle('ativo', button.dataset.ghumatTheme === mode);
    });
  }

  function set(mode) {
    if (mode === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
    apply(mode);
  }

  function currentMode() {
    return localStorage.getItem(KEY) || 'system';
  }

  function renderSettings() {
    const section = document.querySelector('#secaoConfig .secao');
    if (!section) return;

    let card = document.getElementById('ghumatThemeCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'ghumatThemeCard';
      card.className = 'ghumat-theme-card';
      const acertos = document.getElementById('acReceiveConfig');
      if (acertos?.parentNode === section) acertos.after(card);
      else section.prepend(card);
    }

    card.innerHTML =
      '<h3>Aparência</h3>' +
      '<p>O tema muda a luz da interface sem alterar a estrutura do LifeOS.</p>' +
      '<div class="ghumat-theme-options">' +
        '<button type="button" data-ghumat-theme="light">Claro</button>' +
        '<button type="button" data-ghumat-theme="dark">Escuro</button>' +
        '<button type="button" data-ghumat-theme="system">Automático</button>' +
      '</div>';

    card.querySelectorAll('[data-ghumat-theme]').forEach((button) => {
      button.addEventListener('click', () => set(button.dataset.ghumatTheme));
    });

    apply(currentMode());
  }

  media.addEventListener?.('change', () => {
    if (currentMode() === 'system') apply('system');
  });

  window.addEventListener('lifeos:ready', renderSettings);
  document.addEventListener('DOMContentLoaded', () => {
    apply(currentMode());
    renderSettings();
  }, { once: true });

  apply(currentMode());
})();
