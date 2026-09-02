// LifeOS — Painel da Casa v2
// Ajusta a experiência do tablet real sem alterar banco ou regras de negócio.
(() => {
  'use strict';

  const SVG = {
    task: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    bill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    plant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21v-9"/><path d="M12 13c-4 0-7-2-7-6 4 0 7 2 7 6Z"/><path d="M12 10c4 0 7-2 7-6-4 0-7 2-7 6Z"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M3 4h2l2.5 10h10l2-7H6"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/></svg>',
    system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4"/></svg>'
  };

  const DESTINOS = ['tarefas', 'compras', 'contas', 'estoque'];
  const VAZIOS = [
    'nenhuma tarefa pendente',
    'nenhum item pendente',
    'sem destaques no momento',
    'nenhuma conta próxima',
    'estoque em ordem',
    'todas as plantas em dia'
  ];

  function limparLayoutLegado() {
    document.getElementById('painel-casa-css')?.remove();
    document.getElementById('painelContextoCasa')?.remove();
    document.querySelector('.hero-banner')?.removeAttribute('hidden');
  }

  function escapar(texto = '') {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
  }

  function textoPrimeiro(seletor, vazio = '') {
    return document.querySelector(seletor)?.textContent?.trim() || vazio;
  }

  function periodoAtual() {
    const agora = new Date();
    const h = agora.getHours();
    const dia = agora.toLocaleDateString('pt-BR', { weekday: 'long' });
    const diaFormatado = dia.charAt(0).toUpperCase() + dia.slice(1);
    if (h >= 5 && h < 10) return { kicker: `${diaFormatado} de manhã`, apoio: 'Veja o essencial antes de a rotina ganhar ritmo.' };
    if (h >= 10 && h < 14) return { kicker: `${diaFormatado} em casa`, apoio: 'Alimentação e pequenas pendências para o meio do dia.' };
    if (h >= 14 && h < 18) return { kicker: `${diaFormatado} à tarde`, apoio: 'O que ainda merece atenção hoje, sem excesso de informação.' };
    if (h >= 18 && h < 22) return { kicker: `${diaFormatado} à noite`, apoio: 'Jantar, contas próximas e o que falta resolver sem pressa.' };
    return { kicker: 'Casa tranquila', apoio: 'O painel fica discreto e mostra apenas o que realmente importa.' };
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

  function tituloContextual() {
    const tituloHero = textoPrimeiro('#heroTitulo');
    if (tituloHero && !/carregando/i.test(tituloHero)) return tituloHero;
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia.';
    if (hora < 18) return 'Boa tarde.';
    return 'Boa noite.';
  }

  function subtituloContextual(periodo) {
    const subtituloHero = textoPrimeiro('#heroSub');
    if (subtituloHero && !/carregando/i.test(subtituloHero)) return subtituloHero;
    return periodo.apoio;
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
        <div class="pc-context-kicker">${escapar(periodo.kicker)}</div>
        <h2 class="pc-context-title">${escapar(tituloContextual())}</h2>
        <div class="pc-context-subtitle">${escapar(subtituloContextual(periodo))}</div>
      </div>
      <div class="pc-context-next">
        <div class="pc-context-next-label">${itens.length ? 'Próximo na Casa' : 'Casa agora'}</div>
        ${itens.length ? itens.map(item => `
          <div class="pc-context-next-item" data-pagina="${item.pagina}" role="button" tabindex="0">
            <div class="pc-context-next-icon">${SVG[item.tipo]}</div>
            <div>
              <div class="pc-context-next-title">${escapar(item.titulo)}</div>
              <div class="pc-context-next-meta">${escapar(item.meta)}</div>
            </div>
          </div>`).join('') : `
          <div class="pc-context-empty">
            <span>Tudo em ordem por enquanto.</span>
            <small>O painel volta a chamar atenção quando algo precisar de vocês.</small>
          </div>`}
      </div>`;
  }

  function aplicarTema(tema) {
    localStorage.setItem('lifeos:theme', tema);
    if (tema === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = tema;
    atualizarBotaoTema();
  }

  function temaAtual() {
    return localStorage.getItem('lifeos:theme') || 'system';
  }

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
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          window.mudarPagina?.('contas', null);
        }
      });
    });
  }

  function painelEstaVazio(panel) {
    if (!panel || panel.querySelector('.loading')) return false;
    if (panel.id === 'painelPlantasBox' && getComputedStyle(panel).display === 'none') return true;

    const texto = panel.textContent.trim().toLowerCase();
    if (VAZIOS.some(vazio => texto.includes(vazio))) return true;

    const titulo = panel.querySelector('.panel-titulo')?.textContent?.trim().toLowerCase() || '';
    const seletores = {
      'tarefas da casa': '.task-row',
      'lista de compras': '#painelCompras > div:not(.vazio):not(.loading)',
      'destaques': '.destaque',
      'plantas': '.planta-row',
      'contas próximas': '.conta-row',
      'estoque em atenção': '.estoque-row'
    };
    const seletor = seletores[titulo];
    return seletor ? panel.querySelectorAll(seletor).length === 0 : false;
  }

  function organizarConteudo() {
    const grade = document.querySelector('#pag-inicio .conteudo-grid');
    if (!grade) return;

    const colunas = [...grade.children].filter(coluna => coluna.matches('.col-esq, .col-mid, .col-dir'));
    let visiveis = 0;

    colunas.forEach(coluna => {
      const paineis = [...coluna.querySelectorAll(':scope > .panel')];
      paineis.forEach(panel => {
        const vazio = painelEstaVazio(panel);
        panel.classList.toggle('pc-is-empty', vazio);
        panel.hidden = false;
      });

      const colunaVisivel = paineis.length > 0;
      coluna.hidden = false;
      coluna.classList.remove('pc-first-visible', 'pc-visible-col');
      if (colunaVisivel) {
        visiveis += 1;
        coluna.classList.add('pc-visible-col');
      }
    });

    const primeira = colunas.find(coluna => !coluna.hidden);
    primeira?.classList.add('pc-first-visible');

    grade.classList.remove('pc-cols-0', 'pc-cols-1', 'pc-cols-2', 'pc-cols-3');
    grade.classList.add(`pc-cols-${visiveis}`);
    grade.hidden = visiveis === 0;

    const contas = document.getElementById('painelContas')?.closest('.panel');
    contas?.classList.toggle('pc-primary-panel', visiveis === 1 && !contas.hidden);
  }

  function ativarContextos() {
    document.querySelectorAll('#painelContextoCasa [data-pagina]').forEach(item => {
      if (item.dataset.pcBound) return;
      item.dataset.pcBound = '1';
      const abrir = () => window.mudarPagina?.(item.dataset.pagina, null);
      item.addEventListener('click', abrir);
      item.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          abrir();
        }
      });
    });
  }

  function renomearInicio() {
    const botao = document.querySelector('.sidebar-btn[data-pag="inicio"]');
    if (!botao) return;
    for (const no of botao.childNodes) {
      if (no.nodeType === Node.TEXT_NODE && no.textContent.trim()) no.textContent = ' Hoje';
    }
  }

  let agendamento = null;
  function atualizar() {
    window.clearTimeout(agendamento);
    agendamento = window.setTimeout(() => {
      tornarMetricasClicaveis();
      tornarContasClicaveis();
      organizarConteudo();
    }, 100);
  }

  function iniciar() {
    limparLayoutLegado();
    criarBotaoTema();
    renomearInicio();
    atualizar();

    const alvo = document.getElementById('pag-inicio');
    if (alvo) {
      new MutationObserver(atualizar).observe(alvo, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    window.setInterval(atualizar, 60 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
