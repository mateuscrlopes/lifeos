// LifeOS — Painel da Casa v1
// Reorganiza apenas a experiência visual do tablet usando os dados já renderizados.
(() => {
  'use strict';

  const SVG = {
    task: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    bill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    plant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21v-9"/><path d="M12 13c-4 0-7-2-7-6 4 0 7 2 7 6Z"/><path d="M12 10c4 0 7-2 7-6-4 0-7 2-7 6Z"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M3 4h2l2.5 10h10l2-7H6"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/></svg>',
    system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4"/></svg>'
  };

  const DESTINOS = ['tarefas', 'compras', 'contas', 'estoque'];

  function carregarCss() {
    if (document.getElementById('painel-casa-css')) return;
    const link = document.createElement('link');
    link.id = 'painel-casa-css';
    link.rel = 'stylesheet';
    link.href = '/painel-casa.css?v=1';
    document.head.appendChild(link);
  }

  function periodoAtual() {
    const h = new Date().getHours();
    if (h >= 5 && h < 10) return { kicker: 'Começo do dia', titulo: 'Bom dia.', subtitulo: 'Veja o essencial antes de a rotina ganhar ritmo.' };
    if (h >= 10 && h < 14) return { kicker: 'Meio do dia', titulo: 'Hora de cuidar do agora.', subtitulo: 'Alimentação, compromissos e pequenas pendências da Casa.' };
    if (h >= 14 && h < 18) return { kicker: 'Durante a tarde', titulo: 'A Casa segue no ritmo.', subtitulo: 'Confira o que ainda merece atenção hoje.' };
    if (h >= 18 && h < 22) return { kicker: 'Fim do dia', titulo: 'Boa noite.', subtitulo: 'Jantar, contas próximas e o que falta resolver sem pressa.' };
    return { kicker: 'Casa tranquila', titulo: 'Tudo no lugar.', subtitulo: 'O painel fica discreto e mostra apenas o que realmente importa.' };
  }

  function textoPrimeiro(seletor, vazio = '') {
    return document.querySelector(seletor)?.textContent?.trim() || vazio;
  }

  function itensContexto() {
    const itens = [];
    const tarefa = textoPrimeiro('#painelTarefas .task-nome');
    const conta = textoPrimeiro('#painelContas .conta-nome');
    const contaMeta = textoPrimeiro('#painelContas .conta-venc');
    const planta = textoPrimeiro('#painelPlantas .planta-nome');
    const compra = textoPrimeiro('#painelCompras span[style*="font-weight"]');
    if (tarefa) itens.push({ tipo: 'task', titulo: tarefa, meta: 'Tarefa pendente', pagina: 'tarefas' });
    if (conta) itens.push({ tipo: 'bill', titulo: conta, meta: contaMeta || 'Conta próxima', pagina: 'contas' });
    if (planta) itens.push({ tipo: 'plant', titulo: planta, meta: 'Cuidado de planta', pagina: 'inicio' });
    if (compra) itens.push({ tipo: 'cart', titulo: compra, meta: 'Item da lista', pagina: 'compras' });
    return itens.slice(0, 2);
  }

  function criarContexto() {
    const pagina = document.getElementById('pag-inicio');
    const metricas = document.getElementById('metricasGrid');
    if (!pagina || !metricas) return;
    let bloco = document.getElementById('painelContextoCasa');
    if (!bloco) {
      bloco = document.createElement('section');
      bloco.id = 'painelContextoCasa';
      bloco.setAttribute('aria-label', 'Contexto atual da Casa');
      pagina.insertBefore(bloco, metricas);
    }
    const periodo = periodoAtual();
    const itens = itensContexto();
    bloco.innerHTML = `
      <div class="pc-context-main">
        <div class="pc-context-kicker">${periodo.kicker}</div>
        <h2 class="pc-context-title">${periodo.titulo}</h2>
        <div class="pc-context-subtitle">${periodo.subtitulo}</div>
      </div>
      <div class="pc-context-next">
        <div class="pc-context-next-label">Próximo na Casa</div>
        ${itens.length ? itens.map(item => `
          <div class="pc-context-next-item" data-pagina="${item.pagina}" role="button" tabindex="0">
            <div class="pc-context-next-icon">${SVG[item.tipo]}</div>
            <div><div class="pc-context-next-title">${escapar(item.titulo)}</div><div class="pc-context-next-meta">${escapar(item.meta)}</div></div>
          </div>`).join('') : '<div class="pc-context-next-meta">Nada urgente por enquanto.</div>'}
      </div>`;
  }

  function escapar(texto = '') {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
  }

  function aplicarTema(tema) {
    localStorage.setItem('lifeos:theme', tema);
    if (tema === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = tema;
    atualizarBotaoTema();
  }

  function temaAtual() { return localStorage.getItem('lifeos:theme') || 'system'; }

  function atualizarBotaoTema() {
    const botao = document.getElementById('tabletThemeToggle');
    if (!botao) return;
    const tema = temaAtual();
    botao.innerHTML = SVG[tema === 'light' ? 'sun' : tema === 'dark' ? 'moon' : 'system'];
    botao.title = tema === 'light' ? 'Tema claro' : tema === 'dark' ? 'Tema escuro' : 'Seguir sistema';
    botao.setAttribute('aria-label', `${botao.title}. Toque para alterar.`);
  }

  function criarBotaoTema() {
    const area = document.querySelector('.header-right');
    if (!area || document.getElementById('tabletThemeToggle')) return;
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.id = 'tabletThemeToggle';
    botao.addEventListener('click', () => {
      const atual = temaAtual();
      aplicarTema(atual === 'system' ? 'light' : atual === 'light' ? 'dark' : 'system');
    });
    area.insertBefore(botao, area.firstElementChild);
    atualizarBotaoTema();
  }

  function tornarMetricasClicaveis() {
    document.querySelectorAll('#metricasGrid .metrica-card').forEach((card, indice) => {
      const destino = DESTINOS[indice];
      if (!destino || card.dataset.pcReady) return;
      card.dataset.pcReady = '1';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.addEventListener('click', event => {
        if (event.target.closest('.metrica-link')) return;
        window.mudarPagina?.(destino, null);
      });
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          window.mudarPagina?.(destino, null);
        }
      });
    });
  }

  function tornarContasClicaveis() {
    document.querySelectorAll('#painelContas .conta-row').forEach(row => {
      if (row.dataset.pcReady) return;
      row.dataset.pcReady = '1';
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.addEventListener('click', () => window.mudarPagina?.('contas', null));
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') window.mudarPagina?.('contas', null);
      });
    });
  }

  function renomearInicio() {
    const botao = document.querySelector('.sidebar-btn[data-pag="inicio"]');
    if (!botao) return;
    for (const no of botao.childNodes) {
      if (no.nodeType === Node.TEXT_NODE && no.textContent.trim()) no.textContent = ' Casa';
    }
  }

  let agendamento = null;
  function atualizar() {
    window.clearTimeout(agendamento);
    agendamento = window.setTimeout(() => {
      criarContexto();
      tornarMetricasClicaveis();
      tornarContasClicaveis();
    }, 80);
  }

  function iniciar() {
    carregarCss();
    criarBotaoTema();
    renomearInicio();
    atualizar();
    const alvo = document.getElementById('pag-inicio');
    if (alvo) new MutationObserver(atualizar).observe(alvo, { childList: true, subtree: true, characterData: true });
    window.setInterval(criarContexto, 60 * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
