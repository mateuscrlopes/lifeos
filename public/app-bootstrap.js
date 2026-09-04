// LifeOS — único ponto de inicialização do frontend mobile.
// Camadas legadas permanecem listadas aqui apenas durante a consolidação.

const LEGACY_MODULES = Object.freeze([
  './design-system.js?v=1',
  './theme.js?v=1',
  './ui-refinements.js?v=8',
  './central-financeira.js?v=7',
  './central-financeira-email.js?v=5',
  './acertos.js?v=5',
  './purchase-destination-create.js?v=2',
  './mobile-shell-v3.js?v=4',
  './product-polish-v4.js?v=4',
  './phase3-polish.js?v=1',
  './phase4-polish.js?v=1',
  './audit-qa-polish.js?v=3',
  './ritmo-food-v2-loader.js?v=1',
  './mobile-qa-v5.js?v=1',
  './mobile-qa-v5-1.js?v=2',
]);

function waitForStyles(timeoutMs = 4500) {
  const links = [...document.querySelectorAll('link[rel="stylesheet"]')];
  const pending = links.filter(link => !link.sheet);
  if (!pending.length) return Promise.resolve();

  return Promise.all(pending.map(link => new Promise(resolve => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      link.removeEventListener('load', finish);
      link.removeEventListener('error', finish);
      resolve();
    };
    link.addEventListener('load', finish, { once: true });
    link.addEventListener('error', finish, { once: true });
    window.setTimeout(finish, timeoutMs);
  })));
}

async function bootstrap() {
  if (window.__LIFEOS_BOOTSTRAP_STARTED__) return;
  window.__LIFEOS_BOOTSTRAP_STARTED__ = true;
  document.documentElement.dataset.lifeosBoot = 'loading';

  // Importação sequencial torna a precedência temporária das camadas legadas explícita.
  for (const modulePath of LEGACY_MODULES) {
    await import(modulePath);
  }

  // Evita que a aplicação comece a renderizar enquanto folhas recém-solicitadas
  // ainda estão chegando, reduzindo flashes de layout entre navegações.
  await waitForStyles();

  // A UI oficial entra depois da compatibilidade para ser a dona final dos globais
  // compartilhados (confirm, toast, modal, ícones).
  await import('./ui/index.js?v=1');

  // O app é sempre a última unidade funcional a iniciar.
  await import('./app.js?v=14');

  document.documentElement.dataset.lifeosBoot = 'ready';
  window.dispatchEvent(new CustomEvent('lifeos:bootstrap-ready'));
}

bootstrap().catch(error => {
  document.documentElement.dataset.lifeosBoot = 'error';
  console.error('[LifeOS bootstrap] Falha ao iniciar a aplicação.', error);
  const warning = document.getElementById('avisoLogin');
  if (warning) {
    warning.textContent = 'Não foi possível iniciar o LifeOS. Atualize a página e tente novamente.';
    warning.className = 'aviso erro';
  }
});
