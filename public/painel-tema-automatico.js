// LifeOS — Tema automático do Painel da Casa
// Claro: 06:00–17:59 | Escuro: 18:00–05:59
(() => {
  'use strict';

  const THEME_KEY = 'lifeos:theme';
  const OVERRIDE_KEY = 'lifeos:tablet-theme-override';
  const OVERRIDE_UNTIL_KEY = 'lifeos:tablet-theme-override-until';

  const ICONS = {
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/></svg>',
  };

  function temaPeloHorario(data = new Date()) {
    const hora = data.getHours();
    return hora >= 6 && hora < 18 ? 'light' : 'dark';
  }

  function proximaTroca(data = new Date()) {
    const limite = new Date(data);
    limite.setSeconds(0, 0);

    if (data.getHours() < 6) {
      limite.setHours(6, 0, 0, 0);
      return limite;
    }

    if (data.getHours() < 18) {
      limite.setHours(18, 0, 0, 0);
      return limite;
    }

    limite.setDate(limite.getDate() + 1);
    limite.setHours(6, 0, 0, 0);
    return limite;
  }

  function overrideValido() {
    const tema = localStorage.getItem(OVERRIDE_KEY);
    const ate = Number(localStorage.getItem(OVERRIDE_UNTIL_KEY) || 0);

    if (!['light', 'dark'].includes(tema) || ate <= Date.now()) {
      localStorage.removeItem(OVERRIDE_KEY);
      localStorage.removeItem(OVERRIDE_UNTIL_KEY);
      return null;
    }

    return { tema, ate };
  }

  function formatarHora(timestamp) {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function atualizarBotao(tema, override) {
    const botao = document.getElementById('tabletThemeToggle');
    if (!botao) return;

    botao.innerHTML = ICONS[tema];
    botao.dataset.themeMode = tema;

    const oposto = tema === 'light' ? 'escuro' : 'claro';
    const atual = tema === 'light' ? 'Modo claro' : 'Modo escuro';

    if (override) {
      botao.title = `${atual} manual até ${formatarHora(override.ate)}. Toque para usar o modo ${oposto}.`;
    } else {
      const troca = proximaTroca();
      botao.title = `${atual} automático até ${formatarHora(troca.getTime())}. Toque para usar o modo ${oposto} temporariamente.`;
    }

    botao.setAttribute('aria-label', botao.title);
  }

  function aplicarTema() {
    const override = overrideValido();
    const tema = override?.tema || temaPeloHorario();

    document.documentElement.dataset.theme = tema;
    localStorage.setItem(THEME_KEY, tema);
    atualizarBotao(tema, override);

    return tema;
  }

  function alternarManual() {
    const atual = document.documentElement.dataset.theme || aplicarTema();
    const novo = atual === 'light' ? 'dark' : 'light';
    const ate = proximaTroca().getTime();

    localStorage.setItem(OVERRIDE_KEY, novo);
    localStorage.setItem(OVERRIDE_UNTIL_KEY, String(ate));
    aplicarTema();
  }

  function interceptarBotao(evento) {
    const botao = evento.target.closest?.('#tabletThemeToggle');
    if (!botao) return;

    evento.preventDefault();
    evento.stopPropagation();
    evento.stopImmediatePropagation?.();
    alternarManual();
  }

  function observarBotao() {
    const observer = new MutationObserver(() => atualizarBotao(
      document.documentElement.dataset.theme || temaPeloHorario(),
      overrideValido()
    ));

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function iniciar() {
    // Remove o antigo terceiro estado "seguir sistema".
    if (localStorage.getItem(THEME_KEY) === 'system') {
      localStorage.removeItem(THEME_KEY);
    }

    aplicarTema();
    document.addEventListener('click', interceptarBotao, true);
    observarBotao();

    // Mantém a troca correta mesmo se o painel ficar aberto por muitas horas.
    window.setInterval(aplicarTema, 30 * 1000);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) aplicarTema();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
