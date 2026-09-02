// LifeOS — Alimentação contextual v1
// Reutiliza planejamento_semana, planejamento_dias, refeicoes e ingredientes.
(() => {
  'use strict';

  const SVG = {
    meal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 3v8a3 3 0 0 0 3 3h1V3M6 3v8M8 3v8M15 3v18M15 8c3.2 0 5-1.8 5-5v9h-5"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m9 18 6-6-6-6"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  };

  const DIAS = [
    null,
    { curto: 'Seg', completo: 'Segunda-feira' },
    { curto: 'Ter', completo: 'Terça-feira' },
    { curto: 'Qua', completo: 'Quarta-feira' },
    { curto: 'Qui', completo: 'Quinta-feira' },
    { curto: 'Sex', completo: 'Sexta-feira' },
  ];

  let contexto = null;
  let planejamento = [];
  let assinaturaAtual = '';
  let carregamento = null;
  let timerMobile = null;
  let observerMobile = null;

  function ehTablet() {
    return Boolean(document.getElementById('painelCasa'));
  }

  function carregarCss() {
    const id = ehTablet()
      ? 'alimentacao-contextual-tablet-css'
      : 'alimentacao-contextual-mobile-css';

    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = ehTablet()
      ? '/alimentacao-contextual-tablet.css?v=1'
      : '/alimentacao-contextual-mobile.css?v=1';
    document.head.appendChild(link);
  }

  function obterContexto() {
    if (window.lifeosContext?.supa && window.lifeosContext?.usuario) {
      return window.lifeosContext;
    }

    if (
      typeof supa !== 'undefined'
      && typeof usuario !== 'undefined'
      && supa
      && usuario?.id
      && usuario?.casa_id
    ) {
      return { supa, usuario };
    }

    return null;
  }

  function escapar(valor = '') {
    const div = document.createElement('div');
    div.textContent = String(valor);
    return div.innerHTML;
  }

  function dataIsoLocal(data = new Date()) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  function inicioSemanaLocal(data = new Date()) {
    const inicio = new Date(data);
    inicio.setHours(12, 0, 0, 0);
    const dia = inicio.getDay();
    inicio.setDate(inicio.getDate() - (dia === 0 ? 6 : dia - 1));
    return inicio;
  }

  function tipoContextual(data = new Date()) {
    const hora = data.getHours();
    return hora >= 5 && hora < 15 ? 'almoco' : 'janta';
  }

  function rotuloTipo(tipo) {
    return tipo === 'almoco' ? 'Almoço' : 'Jantar';
  }

  function momentoContextual(data = new Date()) {
    const hora = data.getHours();
    if (hora >= 10 && hora < 15) return 'Agora';
    if (hora >= 18 && hora < 22) return 'Agora';
    if (hora >= 5 && hora < 10) return 'Mais tarde';
    if (hora >= 15 && hora < 18) return 'Próxima refeição';
    return 'Hoje';
  }

  function responsavelTexto(valor) {
    const mapa = {
      ambos: 'Mateus e Ghustavo',
      mateus: 'Mateus',
      ghustavo: 'Ghustavo',
      gustavo: 'Ghustavo',
    };
    return mapa[String(valor || '').toLowerCase()] || valor || '';
  }

  function nomeRefeicao(item) {
    return item?.refeicoes?.nome || item?.refeicao_nome || '';
  }

  function ingredientes(item) {
    const lista = item?.refeicoes?.refeicao_ingredientes;
    return Array.isArray(lista) ? lista : [];
  }

  function assinatura(lista) {
    return lista.map(item => [
      item.id,
      item.dia_semana,
      item.tipo,
      item.refeicao_id,
      item.refeicao_nome,
      item.observacao,
      nomeRefeicao(item),
      ingredientes(item).map(i => `${i.id}:${i.nome}:${i.quantidade}:${i.unidade}`).join(','),
    ].join('|')).join(';;');
  }

  async function buscarPlanejamento() {
    const semana = dataIsoLocal(inicioSemanaLocal());

    const { data, error } = await contexto.supa
      .from('planejamento_dias')
      .select(`
        id,
        dia_semana,
        tipo,
        refeicao_id,
        refeicao_nome,
        observacao,
        refeicoes(
          id,
          nome,
          tipo,
          porcoes,
          refeicao_ingredientes(id,nome,quantidade,unidade)
        ),
        planejamento_semana!inner(
          id,
          casa_id,
          semana_inicio,
          responsavel
        )
      `)
      .eq('planejamento_semana.casa_id', contexto.usuario.casa_id)
      .eq('planejamento_semana.semana_inicio', semana)
      .order('dia_semana', { ascending: true })
      .order('tipo', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function carregar(force = false) {
    if (!contexto) contexto = obterContexto();
    if (!contexto) return planejamento;
    if (carregamento && !force) return carregamento;

    carregamento = (async () => {
      try {
        const novos = await buscarPlanejamento();
        const novaAssinatura = assinatura(novos);
        planejamento = novos;

        if (force || novaAssinatura !== assinaturaAtual) {
          assinaturaAtual = novaAssinatura;
          renderizar();
        }

        return planejamento;
      } catch (erro) {
        console.error('[Alimentação contextual] Falha ao carregar:', erro);
        return planejamento;
      }
    })();

    try {
      return await carregamento;
    } finally {
      carregamento = null;
    }
  }

  function itemHoje(tipo = tipoContextual()) {
    const dia = new Date().getDay();
    if (dia < 1 || dia > 5) return null;
    return planejamento.find(item =>
      Number(item.dia_semana) === dia && item.tipo === tipo
    ) || null;
  }

  function cardapioDia(dia) {
    return {
      almoco: planejamento.find(item =>
        Number(item.dia_semana) === dia && item.tipo === 'almoco'
      ) || null,
      janta: planejamento.find(item =>
        Number(item.dia_semana) === dia && item.tipo === 'janta'
      ) || null,
    };
  }

  function formatarQuantidade(item) {
    const partes = [];
    if (item.quantidade !== null && item.quantidade !== undefined && item.quantidade !== '') {
      const numero = Number(item.quantidade);
      partes.push(Number.isFinite(numero)
        ? numero.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
        : String(item.quantidade));
    }
    if (item.unidade) partes.push(item.unidade);
    return partes.join(' ');
  }

  function inserirTablet(bloco) {
    const metricas = document.getElementById('metricasGrid');
    const pagina = document.getElementById('pag-inicio');
    if (!metricas || !pagina) return false;

    if (bloco.parentElement !== pagina || bloco.nextElementSibling !== metricas) {
      pagina.insertBefore(bloco, metricas);
    }

    return true;
  }

  function renderizarTablet() {
    const dia = new Date().getDay();

    let bloco = document.getElementById('acTabletDestaque');
    if (!bloco) {
      bloco = document.createElement('section');
      bloco.id = 'acTabletDestaque';
      bloco.className = 'ac-tablet-strip';
      bloco.setAttribute('aria-label', 'Alimentação de hoje');
    }

    if (dia < 1 || dia > 5) {
      bloco.remove();
      return;
    }

    if (!inserirTablet(bloco)) {
      window.setTimeout(renderizarTablet, 120);
      return;
    }

    const tipo = tipoContextual();
    const item = itemHoje(tipo);
    const nome = nomeRefeicao(item);
    const responsavel = responsavelTexto(
      item?.planejamento_semana?.responsavel
    );

    bloco.classList.toggle('ac-is-empty', !nome);
    bloco.innerHTML = `
      <button type="button" class="ac-tablet-strip-button" data-ac-open>
        <span class="ac-tablet-icon">${SVG.meal}</span>
        <span class="ac-tablet-main">
          <span class="ac-tablet-kicker">${escapar(momentoContextual())} · ${escapar(rotuloTipo(tipo))}</span>
          <strong>${escapar(nome || `${rotuloTipo(tipo)} ainda não definido`)}</strong>
          <small>${
            nome
              ? [
                  responsavel ? `Responsável: ${responsavel}` : '',
                  ingredientes(item).length
                    ? `${ingredientes(item).length} ingrediente${ingredientes(item).length === 1 ? '' : 's'} cadastrado${ingredientes(item).length === 1 ? '' : 's'}`
                    : 'Sem ingredientes cadastrados',
                ].filter(Boolean).map(escapar).join(' · ')
              : 'O planejamento desta semana ainda não tem uma refeição para este horário.'
          }</small>
        </span>
        <span class="ac-tablet-action">
          <span>${nome ? 'Ver detalhes' : 'Ver semana'}</span>
          ${SVG.chevron}
        </span>
      </button>`;
  }

  function removerCardapioPadraoMobile(area) {
    area.querySelectorAll('.card-hoje').forEach(card => {
      const titulo = card.querySelector('.card-hoje-titulo-txt')?.textContent?.trim();
      if (titulo === 'Cardápio de hoje') card.remove();
    });
  }

  function abrirCardapioMobile() {
    if (typeof window.trocarAba === 'function') {
      window.trocarAba('casa');
      window.setTimeout(() => window.trocarSub?.('cardapio', document.querySelector('.sub-aba[data-sub="cardapio"]')), 60);
    }
  }

  function renderizarMobile() {
    const area = document.getElementById('cardsHoje');
    if (!area) return;

    removerCardapioPadraoMobile(area);

    const dia = new Date().getDay();
    const atual = itemHoje(tipoContextual());
    const nome = nomeRefeicao(atual);

    let destaque = document.getElementById('acMobileDestaque');

    if (dia < 1 || dia > 5 || !nome) {
      destaque?.remove();
      return;
    }

    if (!destaque) {
      destaque = document.createElement('button');
      destaque.type = 'button';
      destaque.id = 'acMobileDestaque';
      destaque.className = 'ac-mobile-highlight';
      destaque.addEventListener('click', abrirCardapioMobile);
    }

    const responsavel = responsavelTexto(
      atual?.planejamento_semana?.responsavel
    );

    destaque.innerHTML = `
      <span class="ac-mobile-icon">${SVG.meal}</span>
      <span class="ac-mobile-text">
        <small>${escapar(rotuloTipo(atual.tipo))} de hoje</small>
        <strong>${escapar(nome)}</strong>
        ${responsavel ? `<span>Responsável: ${escapar(responsavel)}</span>` : ''}
      </span>
      <span class="ac-mobile-chevron">${SVG.chevron}</span>`;

    if (area.firstElementChild !== destaque) {
      area.prepend(destaque);
    }
  }

  function renderizar() {
    if (ehTablet()) renderizarTablet();
    else renderizarMobile();
  }

  function semanaHtml() {
    return [1, 2, 3, 4, 5].map(dia => {
      const cardapio = cardapioDia(dia);
      const almoco = nomeRefeicao(cardapio.almoco);
      const janta = nomeRefeicao(cardapio.janta);

      return `
        <article class="ac-week-day">
          <header>
            <span>${DIAS[dia].curto}</span>
            <strong>${DIAS[dia].completo}</strong>
          </header>
          <div class="ac-week-meal">
            <small>Almoço</small>
            <span class="${almoco ? '' : 'ac-week-empty'}">${escapar(almoco || 'Não definido')}</span>
          </div>
          <div class="ac-week-meal">
            <small>Jantar</small>
            <span class="${janta ? '' : 'ac-week-empty'}">${escapar(janta || 'Não definido')}</span>
          </div>
        </article>`;
    }).join('');
  }

  function detalhesHtml(item) {
    const nome = nomeRefeicao(item);
    const lista = ingredientes(item);
    const responsavel = responsavelTexto(
      item?.planejamento_semana?.responsavel
    );

    if (!nome) {
      return `
        <div class="ac-detail-empty">
          ${SVG.calendar}
          <strong>Refeição ainda não definida</strong>
          <span>Abra a aba Semana para conferir o restante do planejamento.</span>
        </div>`;
    }

    return `
      <div class="ac-meal-summary" data-ac-receita-id="${escapar(item?.refeicoes?.id || '')}">
        <span class="ac-meal-summary-icon">${SVG.meal}</span>
        <div>
          <small>${escapar(rotuloTipo(item.tipo))}</small>
          <h3>${escapar(nome)}</h3>
          <p>${[
            responsavel ? `Responsável: ${responsavel}` : '',
            item.refeicoes?.porcoes
              ? `${item.refeicoes.porcoes} porção${Number(item.refeicoes.porcoes) === 1 ? '' : 'ões'}`
              : '',
          ].filter(Boolean).map(escapar).join(' · ')}</p>
        </div>
      </div>

      ${item.observacao ? `
        <section class="ac-note">
          <small>Observação</small>
          <p>${escapar(item.observacao)}</p>
        </section>` : ''}

      <section class="ac-ingredients">
        <header>
          <span>Ingredientes</span>
          <small>${lista.length || 0} cadastrado${lista.length === 1 ? '' : 's'}</small>
        </header>
        ${lista.length ? `
          <div class="ac-ingredients-list">
            ${lista.map(ingrediente => `
              <div>
                <strong>${escapar(ingrediente.nome)}</strong>
                <span>${escapar(formatarQuantidade(ingrediente) || 'Quantidade não informada')}</span>
              </div>`).join('')}
          </div>` : `
          <div class="ac-ingredients-empty">
            Esta refeição ainda não tem ingredientes cadastrados.
          </div>`}
      </section>`;
  }

  function abrirModal() {
    if (!ehTablet()) {
      abrirCardapioMobile();
      return;
    }

    document.getElementById('acMealModal')?.remove();

    const tipo = tipoContextual();
    const atual = itemHoje(tipo);
    const modal = document.createElement('div');
    modal.id = 'acMealModal';
    modal.className = 'ac-modal';
    modal.innerHTML = `
      <section class="ac-dialog" role="dialog" aria-modal="true" aria-label="Cardápio da Casa">
        <header class="ac-dialog-head">
          <div>
            <span class="ac-dialog-kicker">Alimentação da Casa</span>
            <h2>${escapar(nomeRefeicao(atual) || 'Cardápio da semana')}</h2>
            <p>${escapar(DIAS[new Date().getDay()]?.completo || 'Hoje')} · ${escapar(rotuloTipo(tipo))}</p>
          </div>
          <button type="button" class="ac-close" data-ac-close aria-label="Fechar">${SVG.close}</button>
        </header>

        <nav class="ac-tabs" aria-label="Visualização do cardápio">
          <button type="button" class="ativo" data-ac-tab="hoje">Refeição atual</button>
          <button type="button" data-ac-tab="semana">Semana</button>
        </nav>

        <div class="ac-dialog-body">
          <section class="ac-tab-panel ativo" data-ac-panel="hoje">
            ${detalhesHtml(atual)}
          </section>
          <section class="ac-tab-panel" data-ac-panel="semana">
            <div class="ac-week-grid">${semanaHtml()}</div>
            <p class="ac-week-help">O cadastro e a edição do planejamento continuam disponíveis no celular nesta fase.</p>
          </section>
        </div>
      </section>`;

    modal.addEventListener('click', evento => {
      if (evento.target === modal || evento.target.closest('[data-ac-close]')) {
        modal.remove();
        return;
      }

      const aba = evento.target.closest('[data-ac-tab]');
      if (!aba) return;

      modal.querySelectorAll('[data-ac-tab]').forEach(botao => {
        botao.classList.toggle('ativo', botao === aba);
      });
      modal.querySelectorAll('[data-ac-panel]').forEach(painel => {
        painel.classList.toggle(
          'ativo',
          painel.dataset.acPanel === aba.dataset.acTab
        );
      });
    });

    document.body.appendChild(modal);
  }

  function tratarCliqueTablet(evento) {
    if (evento.target.closest?.('[data-ac-open]')) abrirModal();
  }

  function observarMobile() {
    const area = document.getElementById('cardsHoje');
    if (!area || observerMobile) return Boolean(area);

    observerMobile = new MutationObserver(() => {
      window.clearTimeout(timerMobile);
      timerMobile = window.setTimeout(renderizarMobile, 35);
    });

    observerMobile.observe(area, { childList: true });
    return true;
  }

  async function aguardarContexto() {
    const inicio = Date.now();

    while (Date.now() - inicio < 15000) {
      contexto = obterContexto();

      if (contexto) {
        await carregar(true);
        return true;
      }

      await new Promise(resolve => window.setTimeout(resolve, 60));
    }

    console.warn('[Alimentação contextual] Contexto não ficou pronto em 15 segundos.');
    return false;
  }

  function iniciar() {
    carregarCss();

    if (ehTablet()) {
      document.addEventListener('click', tratarCliqueTablet, true);
    } else {
      const tentarObserver = () => {
        if (!observarMobile()) window.setTimeout(tentarObserver, 150);
      };
      tentarObserver();
    }

    window.addEventListener('lifeos:ready', () => {
      contexto = obterContexto();
      carregar(true);
    });

    aguardarContexto();

    window.setInterval(() => {
      carregar(true);
    }, 5 * 60 * 1000);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) carregar(true);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
