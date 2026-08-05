(() => {
  'use strict';

  const DIM_AFTER_MS = 3 * 60 * 1000;
  let dimTimer = null;
  let wakeLock = null;
  let installPrompt = null;
  let suppressNextClick = false;

  const html = document.documentElement;

  function standalone() {
    return window.matchMedia('(display-mode: fullscreen)').matches
      || window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  function atualizarViewport() {
    html.style.setProperty('--tablet-vh', `${window.innerHeight * 0.01}px`);
  }

  function criarElementosAuxiliares() {
    if (!document.getElementById('tabletDimmer')) {
      const dimmer = document.createElement('div');
      dimmer.id = 'tabletDimmer';
      dimmer.className = 'tablet-dimmer';
      dimmer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(dimmer);
    }

    if (!document.getElementById('tabletOrientationAlert')) {
      const alerta = document.createElement('div');
      alerta.id = 'tabletOrientationAlert';
      alerta.className = 'tablet-orientation-alert';
      alerta.innerHTML = `
        <div>
          <strong>Gire o tablet</strong>
          <span>O painel da Casa foi organizado para funcionar na horizontal.</span>
        </div>`;
      document.body.appendChild(alerta);
    }

    if (!document.getElementById('tabletSetupActions')) {
      const acoes = document.createElement('div');
      acoes.id = 'tabletSetupActions';
      acoes.className = 'tablet-setup-actions';
      acoes.innerHTML = `
        <button type="button" class="tablet-setup-btn" id="tabletInstallBtn" hidden>
          Instalar painel
        </button>
        <button type="button" class="tablet-setup-btn" id="tabletFullscreenBtn">
          Tela cheia
        </button>`;
      document.body.appendChild(acoes);

      document.getElementById('tabletInstallBtn')?.addEventListener('click', instalarPwa);
      document.getElementById('tabletFullscreenBtn')?.addEventListener('click', entrarTelaCheia);
    }

    atualizarAcoes();
  }

  function atualizarAcoes() {
    const acoes = document.getElementById('tabletSetupActions');
    const instalar = document.getElementById('tabletInstallBtn');
    const telaCheia = document.getElementById('tabletFullscreenBtn');
    if (!acoes || !instalar || !telaCheia) return;

    instalar.hidden = !installPrompt || standalone();
    telaCheia.hidden = standalone() || Boolean(document.fullscreenElement);

    const existeAcao = !instalar.hidden || !telaCheia.hidden;
    acoes.classList.toggle('oculto', !existeAcao);
  }

  async function instalarPwa() {
    if (!installPrompt) return;

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch (erro) {
      console.warn('[Tablet] Instalação não iniciada:', erro);
    } finally {
      installPrompt = null;
      atualizarAcoes();
    }
  }

  async function bloquearOrientacao() {
    try {
      await screen.orientation?.lock?.('landscape');
    } catch {
      // A orientação pelo manifesto continua funcionando no app instalado.
    }
  }

  async function entrarTelaCheia() {
    if (standalone() || document.fullscreenElement) {
      atualizarAcoes();
      return;
    }

    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // O botão de instalação continua sendo a alternativa mais estável.
      }
    }

    await bloquearOrientacao();
    atualizarAcoes();
  }

  async function solicitarWakeLock() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    if (wakeLock && !wakeLock.released) return;

    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      }, { once: true });
    } catch (erro) {
      console.warn('[Tablet] Wake Lock indisponível:', erro?.message || erro);
    }
  }

  function alterarHint(texto) {
    const hint = document.querySelector('.espera-hint');
    if (hint) hint.textContent = texto;
  }

  function definirEscurecido(escurecido) {
    html.classList.toggle('tablet-dimmed', escurecido);

    if (escurecido) {
      if (typeof window.voltarEspera === 'function') window.voltarEspera();
      alterarHint('Toque para despertar');
    } else {
      alterarHint('Toque para abrir o LifeOS');
    }
  }

  function agendarEscurecimento() {
    window.clearTimeout(dimTimer);
    dimTimer = window.setTimeout(() => definirEscurecido(true), DIM_AFTER_MS);
  }

  function tratarAtividade(evento) {
    const estavaEscurecido = html.classList.contains('tablet-dimmed');

    if (estavaEscurecido) {
      suppressNextClick = true;
      evento.preventDefault();
      evento.stopPropagation();
      evento.stopImmediatePropagation?.();
      definirEscurecido(false);
    }

    solicitarWakeLock();
    agendarEscurecimento();
  }

  function suprimirCliqueDepoisDeAcordar(evento) {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    evento.preventDefault();
    evento.stopPropagation();
    evento.stopImmediatePropagation?.();
  }

  function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/tablet-sw.js', { scope: '/' })
      .catch(erro => console.warn('[Tablet] Service worker não registrado:', erro));
  }

  function iniciar() {
    atualizarViewport();
    criarElementosAuxiliares();
    registrarServiceWorker();
    solicitarWakeLock();
    agendarEscurecimento();

    const espera = document.getElementById('telaEspera');
    espera?.addEventListener('click', () => {
      if (!standalone() && !document.fullscreenElement) entrarTelaCheia();
    });

    window.addEventListener('resize', atualizarViewport);
    window.addEventListener('orientationchange', atualizarViewport);
    document.addEventListener('fullscreenchange', atualizarAcoes);

    document.addEventListener('pointerdown', tratarAtividade, true);
    document.addEventListener('keydown', tratarAtividade, true);
    document.addEventListener('click', suprimirCliqueDepoisDeAcordar, true);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        atualizarViewport();
        solicitarWakeLock();
        agendarEscurecimento();
      }
    });
  }

  window.addEventListener('beforeinstallprompt', evento => {
    evento.preventDefault();
    installPrompt = evento;
    atualizarAcoes();
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    atualizarAcoes();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
