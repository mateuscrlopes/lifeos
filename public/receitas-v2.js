// LifeOS — Receitas v2 / Fase 3B
// Detalhes, edição e envio seletivo de ingredientes para a lista.
(() => {
  'use strict';

  const SVG = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.5 11h10l2-7H7"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3h7v7M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
  };

  let contexto = null;
  let observerMobile = null;

  const ehTablet = () => Boolean(document.getElementById('painelCasa'));
  const obterContexto = () => window.lifeosContext || null;

  function escapar(valor = '') {
    const div = document.createElement('div');
    div.textContent = String(valor);
    return div.innerHTML;
  }

  function urlSegura(valor) {
    if (!valor) return null;
    try {
      const url = new URL(valor);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  }

  function carregarCss() {
    if (document.getElementById('receitas-v2-css')) return;
    const link = document.createElement('link');
    link.id = 'receitas-v2-css';
    link.rel = 'stylesheet';
    link.href = '/receitas-v2.css?v=1';
    document.head.appendChild(link);
  }

  async function buscarReceita(id) {
    contexto ||= obterContexto();
    if (!contexto?.supa || !id) return null;
    const { data, error } = await contexto.supa
      .from('refeicoes')
      .select(`id,casa_id,nome,tipo,porcoes,tempo_minutos,modo_preparo,observacoes,fonte_url,refeicao_ingredientes(id,nome,quantidade,unidade)`)
      .eq('id', id)
      .eq('casa_id', contexto.usuario.casa_id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  function formatarQuantidade(item) {
    const partes = [];
    if (item.quantidade !== null && item.quantidade !== undefined && item.quantidade !== '') {
      const numero = Number(item.quantidade);
      partes.push(Number.isFinite(numero) ? numero.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : String(item.quantidade));
    }
    if (item.unidade) partes.push(item.unidade);
    return partes.join(' ');
  }

  function tipoTexto(tipo) {
    return ({ almoco: 'Almoço', janta: 'Jantar', ambos: 'Almoço e jantar' })[tipo] || tipo || 'Refeição';
  }

  function injetarCamposCadastro() {
    if (ehTablet() || document.getElementById('rv2CamposCadastro')) return;
    const ingredientes = document.getElementById('refIngredientes');
    const card = ingredientes?.closest('.cartao');
    if (!ingredientes || !card) return;

    const tituloIngredientes = [...card.children].find(el => el !== ingredientes && /ingredientes/i.test(el.textContent || ''));
    const bloco = document.createElement('div');
    bloco.id = 'rv2CamposCadastro';
    bloco.className = 'rv2-form-extra';
    bloco.innerHTML = `
      <div class="rv2-form-grid">
        <div class="campo"><label>Tempo de preparo</label><div class="rv2-time-input"><input id="refTempo" type="number" min="1" max="1440" inputmode="numeric" placeholder="Ex.: 40"><span>min</span></div></div>
        <div class="campo"><label>Fonte da receita</label><input id="refFonte" type="url" inputmode="url" placeholder="https://..."></div>
      </div>
      <div class="campo"><label>Observações</label><textarea id="refObservacoes" rows="2" placeholder="Ex.: usar fogo baixo, rende bem para marmita..."></textarea></div>
      <div class="campo"><label>Modo de preparo</label><textarea id="refPreparo" rows="5" placeholder="Descreva o passo a passo da receita"></textarea></div>`;
    card.insertBefore(bloco, tituloIngredientes || ingredientes);
  }

  function checksIngredientes(receita) {
    const lista = receita.refeicao_ingredientes || [];
    if (!lista.length) return '<div class="rv2-empty-small">Nenhum ingrediente cadastrado.</div>';
    return lista.map(item => `
      <label class="rv2-shop-row">
        <input type="checkbox" value="${escapar(item.id)}" checked>
        <span><strong>${escapar(item.nome)}</strong><small>${escapar(formatarQuantidade(item) || 'Quantidade não informada')}</small></span>
      </label>`).join('');
  }

  function detalheHtml(receita, editavel = false) {
    const fonte = urlSegura(receita.fonte_url);
    const lista = receita.refeicao_ingredientes || [];
    return `
      <div class="rv2-recipe-meta">
        <span>${escapar(tipoTexto(receita.tipo))}</span>
        <span>${Number(receita.porcoes) || 2} porções</span>
        ${receita.tempo_minutos ? `<span>${SVG.clock}${Number(receita.tempo_minutos)} min</span>` : ''}
      </div>
      ${receita.observacoes ? `<section class="rv2-section"><h4>Observações</h4><p>${escapar(receita.observacoes)}</p></section>` : ''}
      <section class="rv2-section"><h4>Ingredientes</h4>${lista.length ? `<div class="rv2-ingredient-list">${lista.map(item => `<div><strong>${escapar(item.nome)}</strong><span>${escapar(formatarQuantidade(item) || 'Quantidade não informada')}</span></div>`).join('')}</div>` : '<div class="rv2-empty-small">Nenhum ingrediente cadastrado.</div>'}</section>
      ${receita.modo_preparo ? `<section class="rv2-section"><h4>Modo de preparo</h4><div class="rv2-preparo">${escapar(receita.modo_preparo)}</div></section>` : `<section class="rv2-section rv2-section-muted"><h4>Modo de preparo</h4><p>Ainda não cadastrado.</p></section>`}
      ${fonte ? `<a class="rv2-source" href="${escapar(fonte)}" target="_blank" rel="noopener noreferrer">${SVG.external}<span>Abrir fonte da receita</span></a>` : ''}
      ${lista.length ? `<section class="rv2-shopping"><div class="rv2-shopping-head"><div><h4>O que falta comprar?</h4><p>Desmarque o que vocês já têm em casa.</p></div>${SVG.cart}</div><div class="rv2-shop-list">${checksIngredientes(receita)}</div><button type="button" class="rv2-primary" data-rv2-add-list data-rv2-receita-id="${escapar(receita.id)}">Adicionar selecionados à lista</button><div class="rv2-feedback" role="status" aria-live="polite"></div></section>` : ''}
      ${editavel ? '<button type="button" class="rv2-secondary" data-rv2-edit>Editar detalhes da receita</button>' : ''}`;
  }

  async function abrirReceitaMobile(id) {
    try {
      const receita = await buscarReceita(id);
      if (!receita) return;
      document.getElementById('rv2RecipeModal')?.remove();
      const modal = document.createElement('div');
      modal.id = 'rv2RecipeModal';
      modal.className = 'rv2-modal';
      modal.innerHTML = `<section class="rv2-dialog" role="dialog" aria-modal="true" aria-label="Receita"><header class="rv2-dialog-head"><div><span>Receita da Casa</span><h2>${escapar(receita.nome)}</h2></div><button type="button" data-rv2-close aria-label="Fechar">${SVG.close}</button></header><div class="rv2-dialog-body">${detalheHtml(receita, true)}</div></section>`;
      modal.addEventListener('click', ev => {
        if (ev.target === modal || ev.target.closest('[data-rv2-close]')) modal.remove();
        else if (ev.target.closest('[data-rv2-edit]')) renderizarEdicao(receita);
      });
      document.body.appendChild(modal);
    } catch (erro) { console.error('[Receitas] Falha ao abrir:', erro); }
  }

  function renderizarEdicao(receita) {
    const corpo = document.querySelector('#rv2RecipeModal .rv2-dialog-body');
    if (!corpo) return;
    corpo.innerHTML = `
      <form class="rv2-edit-form" data-rv2-edit-form>
        <div class="rv2-form-grid">
          <label><span>Tempo de preparo</span><div class="rv2-time-input"><input name="tempo" type="number" min="1" max="1440" value="${escapar(receita.tempo_minutos || '')}"><span>min</span></div></label>
          <label><span>Fonte</span><input name="fonte" type="url" value="${escapar(receita.fonte_url || '')}" placeholder="https://..."></label>
        </div>
        <label><span>Observações</span><textarea name="observacoes" rows="3">${escapar(receita.observacoes || '')}</textarea></label>
        <label><span>Modo de preparo</span><textarea name="preparo" rows="7">${escapar(receita.modo_preparo || '')}</textarea></label>
        <div class="rv2-edit-actions"><button type="button" class="rv2-secondary" data-rv2-cancel-edit>Cancelar</button><button type="submit" class="rv2-primary">Salvar detalhes</button></div>
        <div class="rv2-feedback" role="status" aria-live="polite"></div>
      </form>`;
    corpo.querySelector('[data-rv2-cancel-edit]')?.addEventListener('click', () => { corpo.innerHTML = detalheHtml(receita, true); });
    corpo.querySelector('[data-rv2-edit-form]')?.addEventListener('submit', async ev => {
      ev.preventDefault();
      const form = ev.currentTarget;
      const botao = form.querySelector('[type="submit"]');
      const feedback = form.querySelector('.rv2-feedback');
      const dados = new FormData(form);
      botao.disabled = true; botao.textContent = 'Salvando…';
      try {
        const tempo = Number(dados.get('tempo'));
        const atualizacao = {
          tempo_minutos: Number.isFinite(tempo) && tempo > 0 ? tempo : null,
          fonte_url: String(dados.get('fonte') || '').trim() || null,
          observacoes: String(dados.get('observacoes') || '').trim() || null,
          modo_preparo: String(dados.get('preparo') || '').trim() || null,
          atualizado_em: new Date().toISOString(),
        };
        const { error } = await contexto.supa.from('refeicoes').update(atualizacao).eq('id', receita.id).eq('casa_id', contexto.usuario.casa_id);
        if (error) throw error;
        receita = { ...receita, ...atualizacao };
        corpo.innerHTML = detalheHtml(receita, true);
        window.dispatchEvent(new CustomEvent('lifeos:receitas-atualizar'));
      } catch (erro) {
        console.error('[Receitas] Falha ao salvar:', erro);
        botao.disabled = false; botao.textContent = 'Salvar detalhes';
        feedback.textContent = 'Não foi possível salvar.'; feedback.classList.add('erro');
      }
    });
  }

  async function adicionarSelecionados(container, receitaId) {
    contexto ||= obterContexto();
    if (!contexto) return;
    const selecionados = [...container.querySelectorAll('.rv2-shop-row input:checked')].map(input => input.value);
    const feedback = container.querySelector('.rv2-feedback');
    const botao = container.querySelector('[data-rv2-add-list]');
    if (!selecionados.length) { feedback.textContent = 'Selecione pelo menos um ingrediente.'; return; }
    botao.disabled = true; botao.textContent = 'Adicionando…';
    try {
      const { data, error } = await contexto.supa.rpc('adicionar_ingredientes_receita_lista', { p_refeicao_id: receitaId, p_usuario_id: contexto.usuario.id, p_ingrediente_ids: selecionados });
      if (error) throw error;
      const resultado = Array.isArray(data) ? data[0] : data;
      const adicionados = Number(resultado?.adicionados || 0);
      const existentes = Number(resultado?.ja_existiam || 0);
      feedback.textContent = [
        adicionados ? `${adicionados} adicionado${adicionados === 1 ? '' : 's'} à lista.` : '',
        existentes ? `${existentes} já ${existentes === 1 ? 'estava' : 'estavam'} pendente${existentes === 1 ? '' : 's'}.` : '',
      ].filter(Boolean).join(' ') || 'Lista já estava atualizada.';
      feedback.classList.remove('erro');
      window.dispatchEvent(new CustomEvent('lifeos:lista-atualizar'));
    } catch (erro) {
      console.error('[Receitas] Falha ao adicionar ingredientes:', erro);
      feedback.textContent = 'Não foi possível atualizar a lista.'; feedback.classList.add('erro');
    } finally { botao.disabled = false; botao.textContent = 'Adicionar selecionados à lista'; }
  }

  async function enriquecerModalTablet() {
    const modal = document.getElementById('acMealModal');
    const resumo = modal?.querySelector('.ac-meal-summary[data-ac-receita-id]');
    const painel = resumo?.closest('[data-ac-panel="hoje"]');
    if (!modal || !resumo || !painel || painel.querySelector('[data-rv2-tablet-extra]')) return;
    const id = resumo.dataset.acReceitaId;
    if (!id) return;
    try {
      const receita = await buscarReceita(id);
      if (!receita || !document.body.contains(modal)) return;
      const extra = document.createElement('div');
      extra.dataset.rv2TabletExtra = '1'; extra.className = 'rv2-tablet-extra';
      extra.innerHTML = detalheHtml(receita, false);
      painel.appendChild(extra);
    } catch (erro) { console.error('[Receitas] Falha ao enriquecer tablet:', erro); }
  }

  function ligarListaMobile() {
    if (ehTablet() || observerMobile) return;
    const lista = document.getElementById('listaRefeicoes');
    if (!lista) { window.setTimeout(ligarListaMobile, 150); return; }
    const marcar = () => lista.querySelectorAll('.card-refeicao[data-receita-id]').forEach(l => l.classList.add('rv2-clickable'));
    observerMobile = new MutationObserver(marcar);
    observerMobile.observe(lista, { childList: true });
    marcar();
  }

  function tratarClique(ev) {
    const adicionar = ev.target.closest?.('[data-rv2-add-list]');
    if (adicionar) {
      const container = adicionar.closest('.rv2-shopping');
      adicionarSelecionados(container, adicionar.dataset.rv2ReceitaId);
      return;
    }
    if (ehTablet()) {
      if (ev.target.closest?.('[data-ac-open]') || ev.target.closest?.('[data-ac-tab="hoje"]')) window.setTimeout(enriquecerModalTablet, 80);
      return;
    }
    const linha = ev.target.closest?.('.card-refeicao[data-receita-id]');
    if (linha && !ev.target.closest('button')) abrirReceitaMobile(linha.dataset.receitaId);
  }

  function iniciar() {
    contexto = obterContexto();
    carregarCss();
    injetarCamposCadastro();
    ligarListaMobile();
    document.addEventListener('click', tratarClique, true);
    window.addEventListener('lifeos:ready', () => { contexto = obterContexto(); injetarCamposCadastro(); ligarListaMobile(); });
    window.addEventListener('lifeos:receitas-atualizar', () => { if (ehTablet()) window.setTimeout(enriquecerModalTablet, 60); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
