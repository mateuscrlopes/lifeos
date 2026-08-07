// LifeOS — Correção mobile da alimentação contextual
(() => {
  'use strict';

  function obterContexto() {
    return window.lifeosContext || null;
  }

  function tipoAtual() {
    const hora = new Date().getHours();
    return hora >= 5 && hora < 15 ? 'almoco' : 'janta';
  }

  function dataIsoLocal(data = new Date()) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  function inicioSemana(data = new Date()) {
    const d = new Date(data);
    d.setHours(12, 0, 0, 0);
    const dia = d.getDay();
    d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
    return d;
  }

  async function buscarRefeicaoAtual() {
    const contexto = obterContexto();
    if (!contexto?.supa || !contexto?.usuario?.casa_id) return null;

    const dia = new Date().getDay();
    if (dia < 1 || dia > 5) return null;

    const { data, error } = await contexto.supa
      .from('planejamento_dias')
      .select(`
        id,
        tipo,
        refeicao_nome,
        observacao,
        refeicoes(
          id,
          nome,
          porcoes,
          refeicao_ingredientes(id,nome,quantidade,unidade)
        ),
        planejamento_semana!inner(
          casa_id,
          semana_inicio,
          responsavel
        )
      `)
      .eq('planejamento_semana.casa_id', contexto.usuario.casa_id)
      .eq('planejamento_semana.semana_inicio', dataIsoLocal(inicioSemana()))
      .eq('dia_semana', dia)
      .eq('tipo', tipoAtual())
      .maybeSingle();

    if (error) {
      console.error('[Alimentação mobile] Não foi possível buscar a refeição atual:', error);
      return null;
    }

    return data || null;
  }

  function nomeRefeicao(item) {
    return item?.refeicoes?.nome || item?.refeicao_nome || '';
  }

  function responsavelTexto(valor) {
    const mapa = {
      mateus: 'Mateus',
      ghustavo: 'Ghustavo',
      gustavo: 'Ghustavo',
      ambos: 'Mateus e Ghustavo',
    };
    return mapa[String(valor || '').toLowerCase()] || valor || '';
  }

  function criarDestaque(item) {
    const area = document.getElementById('cardsHoje');
    if (!area) return;

    area.querySelectorAll('.card-hoje').forEach(card => {
      const titulo = card.querySelector('.card-hoje-titulo-txt')?.textContent?.trim();
      if (titulo === 'Cardápio de hoje') card.remove();
    });

    let destaque = document.getElementById('acMobileDestaque');
    const nome = nomeRefeicao(item);

    if (!nome) {
      destaque?.remove();
      return;
    }

    if (!destaque) {
      destaque = document.createElement('button');
      destaque.id = 'acMobileDestaque';
      destaque.type = 'button';
      destaque.className = 'ac-mobile-highlight';
      destaque.addEventListener('click', () => {
        document.querySelector('.tab-btn[data-tab="casa"]')?.click();
        window.setTimeout(() => {
          document.querySelector('.sub-aba[data-sub="cardapio"]')?.click();
        }, 100);
      });
    }

    const tipo = tipoAtual() === 'almoco' ? 'Almoço' : 'Jantar';
    const responsavel = responsavelTexto(item?.planejamento_semana?.responsavel);

    destaque.innerHTML = `
      <span class="ac-mobile-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 3v8a3 3 0 0 0 3 3h1V3M6 3v8M8 3v8M15 3v18M15 8c3.2 0 5-1.8 5-5v9h-5"/>
        </svg>
      </span>
      <span class="ac-mobile-text">
        <small>${tipo} de hoje</small>
        <strong>${nome}</strong>
        ${responsavel ? `<span>Responsável: ${responsavel}</span>` : ''}
      </span>
      <span class="ac-mobile-chevron">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </span>`;

    if (area.firstElementChild !== destaque) {
      area.prepend(destaque);
    }
  }

  function corrigirHero(item) {
    const titulo = document.getElementById('heroTitulo');
    const subtitulo = document.getElementById('heroSub');
    if (!titulo || !subtitulo) return;

    const nome = nomeRefeicao(item);

    // Só interfere se a lógica antiga tiver colocado cardápio no hero.
    if (subtitulo.textContent?.trim() !== 'Cardápio planejado para hoje') return;

    if (nome) {
      titulo.textContent = nome;
      subtitulo.textContent = `${tipoAtual() === 'almoco' ? 'Almoço' : 'Jantar'} planejado para este horário`;
      return;
    }

    titulo.textContent = 'Tudo em dia!';
    subtitulo.textContent = 'Nenhuma pendência para hoje';
  }

  let atualizando = false;
  let timer = null;

  async function atualizar() {
    if (atualizando) return;
    atualizando = true;

    try {
      const item = await buscarRefeicaoAtual();
      criarDestaque(item);
      corrigirHero(item);
    } finally {
      atualizando = false;
    }
  }

  function agendar() {
    window.clearTimeout(timer);
    timer = window.setTimeout(atualizar, 50);
  }

  function observarTelaHoje() {
    const area = document.getElementById('cardsHoje');
    if (!area) {
      window.setTimeout(observarTelaHoje, 150);
      return;
    }

    new MutationObserver(agendar).observe(area, {
      childList: true,
    });

    agendar();
  }

  function carregarCss() {
    if (document.getElementById('alimentacao-contextual-mobile-fix-css')) return;
    const link = document.createElement('link');
    link.id = 'alimentacao-contextual-mobile-fix-css';
    link.rel = 'stylesheet';
    link.href = '/alimentacao-contextual-mobile-fix.css?v=1';
    document.head.appendChild(link);
  }

  function iniciar() {
    carregarCss();
    window.addEventListener('lifeos:ready', agendar);
    observarTelaHoje();

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) agendar();
    });

    window.setInterval(atualizar, 5 * 60 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
