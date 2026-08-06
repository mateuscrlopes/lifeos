(() => {
  'use strict';

  const SCREENSAVER_AFTER_MS = 10 * 60 * 1000;
  let idleTimer = null;
  let clockTimer = null;
  let animationFrame = null;
  let wakeLock = null;
  let installPrompt = null;
  let suppressNextClick = false;
  let logoState = { x: 32, y: 32, vx: 0.22, vy: 0.18, last: 0 };

  const html = document.documentElement;

  function carregarDesignSystem() {
    if (document.getElementById('lifeos-design-system')) return;
    const link = document.createElement('link');
    link.id = 'lifeos-design-system';
    link.rel = 'stylesheet';
    link.href = '/design-system.css?v=1';
    document.head.appendChild(link);
    document.body.classList.add('tablet-mode');
  }

  function standalone() {
    return window.matchMedia('(display-mode: fullscreen)').matches
      || window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  function atualizarViewport() {
    html.style.setProperty('--tablet-vh', `${window.innerHeight * 0.01}px`);
  }

  function criarElementosAuxiliares() {
    carregarDesignSystem();

    if (!document.getElementById('lifeosScreensaver')) {
      const saver = document.createElement('div');
      saver.id = 'lifeosScreensaver';
      saver.setAttribute('aria-hidden', 'true');
      saver.innerHTML = `
        <img id="lifeosScreensaverLogo" src="/favicon.png" alt="">
        <time id="lifeosScreensaverClock"></time>`;
      document.body.appendChild(saver);
    }

    if (!document.getElementById('tabletOrientationAlert')) {
      const alerta = document.createElement('div');
      alerta.id = 'tabletOrientationAlert';
      alerta.className = 'tablet-orientation-alert';
      alerta.innerHTML = '<div><strong>Gire o tablet</strong><span>O painel da Casa foi organizado para funcionar na horizontal.</span></div>';
      document.body.appendChild(alerta);
    }

    if (!document.getElementById('tabletSetupActions')) {
      const acoes = document.createElement('div');
      acoes.id = 'tabletSetupActions';
      acoes.className = 'tablet-setup-actions';
      acoes.innerHTML = `
        <button type="button" class="tablet-setup-btn" id="tabletInstallBtn" hidden>Instalar painel</button>
        <button type="button" class="tablet-setup-btn" id="tabletFullscreenBtn">Tela cheia</button>`;
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
    acoes.classList.toggle('oculto', instalar.hidden && telaCheia.hidden);
  }

  async function instalarPwa() {
    if (!installPrompt) return;
    try { await installPrompt.prompt(); await installPrompt.userChoice; }
    catch (erro) { console.warn('[Tablet] Instalação não iniciada:', erro); }
    finally { installPrompt = null; atualizarAcoes(); }
  }

  async function bloquearOrientacao() {
    try { await screen.orientation?.lock?.('landscape'); } catch {}
  }

  async function entrarTelaCheia() {
    if (standalone() || document.fullscreenElement) return atualizarAcoes();
    try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); }
    catch { try { await document.documentElement.requestFullscreen(); } catch {} }
    await bloquearOrientacao();
    atualizarAcoes();
  }

  async function solicitarWakeLock() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    if (wakeLock && !wakeLock.released) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; }, { once: true });
    } catch (erro) { console.warn('[Tablet] Wake Lock indisponível:', erro?.message || erro); }
  }

  function atualizarRelogio() {
    const relogio = document.getElementById('lifeosScreensaverClock');
    if (!relogio) return;
    relogio.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function animarLogo(timestamp) {
    if (!html.classList.contains('lifeos-screensaver')) return;
    const logo = document.getElementById('lifeosScreensaverLogo');
    if (!logo) return;
    const delta = Math.min(32, timestamp - (logoState.last || timestamp));
    logoState.last = timestamp;
    logoState.x += logoState.vx * delta;
    logoState.y += logoState.vy * delta;
    const maxX = Math.max(0, window.innerWidth - logo.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - logo.offsetHeight);
    if (logoState.x <= 0 || logoState.x >= maxX) { logoState.vx *= -1; logoState.x = Math.max(0, Math.min(maxX, logoState.x)); }
    if (logoState.y <= 0 || logoState.y >= maxY) { logoState.vy *= -1; logoState.y = Math.max(0, Math.min(maxY, logoState.y)); }
    logo.style.transform = `translate3d(${logoState.x}px, ${logoState.y}px, 0)`;
    animationFrame = requestAnimationFrame(animarLogo);
  }

  function abrirProtetor() {
    if (html.classList.contains('lifeos-screensaver')) return;
    if (typeof window.voltarEspera === 'function') window.voltarEspera();
    html.classList.add('lifeos-screensaver');
    atualizarRelogio();
    clockTimer = window.setInterval(atualizarRelogio, 15000);
    logoState.last = 0;
    animationFrame = requestAnimationFrame(animarLogo);
  }

  function fecharProtetor() {
    if (!html.classList.contains('lifeos-screensaver')) return false;
    html.classList.remove('lifeos-screensaver');
    window.clearInterval(clockTimer);
    cancelAnimationFrame(animationFrame);
    suppressNextClick = true;
    return true;
  }

  function agendarProtetor() {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(abrirProtetor, SCREENSAVER_AFTER_MS);
  }

  function tratarAtividade(evento) {
    const acordou = fecharProtetor();
    if (acordou && evento.type === 'pointerdown') {
      evento.preventDefault();
      evento.stopPropagation();
      evento.stopImmediatePropagation?.();
    }
    solicitarWakeLock();
    agendarProtetor();
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
    agendarProtetor();

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
        agendarProtetor();
      }
    });
  }

  window.addEventListener('beforeinstallprompt', evento => { evento.preventDefault(); installPrompt = evento; atualizarAcoes(); });
  window.addEventListener('appinstalled', () => { installPrompt = null; atualizarAcoes(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
