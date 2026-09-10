// LifeOS — Mercado live v3
// Dono da atualização visual do carrinho durante a compra. Evita o antigo ciclo
// MutationObserver -> innerHTML -> MutationObserver que podia tornar taps inertes no iPhone.

(() => {
  'use strict';

  const busy = new Set();
  let client = null;
  let profile = null;
  let overlayObserver = null;
  let refreshing = false;
  let refreshQueued = false;

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function money(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? parsed.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
      : '—';
  }

  function quantity(value, unit) {
    if (value === null || value === undefined || value === '') return '';
    return `${number(value)}${unit ? ` ${unit}` : ''}`;
  }

  function context() {
    const ctx = window.lifeosContext;
    if (!ctx?.supa || !ctx?.usuario) return null;
    client = ctx.supa;
    profile = ctx.usuario;
    return { client, profile };
  }

  function toast(message, type = 'ok') {
    if (typeof window.lifeosToast === 'function') return window.lifeosToast(message, type);
    window.dispatchEvent(new CustomEvent('lifeos:toast', { detail: { message, type } }));
  }

  async function getItems() {
    const ctx = context();
    if (!ctx) return [];
    const [itemsResult, stockResult] = await Promise.all([
      ctx.client.from('lista_compras')
        .select('id,nome,quantidade,unidade,quantidade_planejada,unidade_planejada,quantidade_comprada,unidade_comprada,estoque_id,no_carrinho,preco_compra,preco_unitario_compra,status,destino_compra_id,compra_destinos(id,nome,entra_lista_mercado)')
        .eq('casa_id', ctx.profile.casa_id)
        .eq('status', 'pendente')
        .order('criado_em', { ascending: true }),
      ctx.client.from('estoque')
        .select('id,nome,critico')
        .eq('casa_id', ctx.profile.casa_id),
    ]);
    if (itemsResult.error) throw itemsResult.error;
    if (stockResult.error) throw stockResult.error;
    const stockMap = new Map((stockResult.data || []).map(item => [item.id, item]));
    return (itemsResult.data || [])
      .filter(item => !item.compra_destinos || item.compra_destinos.entra_lista_mercado !== false)
      .map(item => ({ ...item, stock: stockMap.get(item.estoque_id) || null }))
      .sort((a, b) => Number(Boolean(b.stock?.critico)) - Number(Boolean(a.stock?.critico)) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  }

  function row(item, inCart) {
    const plannedValue = item.quantidade_planejada ?? item.quantidade;
    const plannedUnit = item.unidade_planejada ?? item.unidade;
    const actualValue = item.quantidade_comprada ?? item.quantidade;
    const actualUnit = item.unidade_comprada ?? item.unidade;
    const planned = quantity(plannedValue, plannedUnit);
    const actual = quantity(actualValue, actualUnit);
    const meta = inCart
      ? `Planejado: ${esc(planned || '—')} · <strong>Peguei: ${esc(actual || '—')}</strong>`
      : `Comprar: <strong>${esc(planned || 'quantidade livre')}</strong>`;
    return `<article class="ui-market-item${inCart ? ' is-cart' : ''}${busy.has(item.id) ? ' is-updating' : ''}" data-market-id="${esc(item.id)}">
      <button type="button" class="ui-market-toggle" data-market-action="${inCart ? 'remove' : 'add'}" aria-label="${inCart ? 'Retirar do carrinho' : 'Marcar como peguei'}" ${busy.has(item.id) ? 'disabled' : ''}>${inCart ? '✓' : ''}</button>
      <div class="ui-market-item-info"><div class="ui-market-item-name">${esc(item.nome)} ${item.stock?.critico ? '<span class="ui-market-critical">Crítico</span>' : ''}</div><span class="mlv3-meta">${meta}</span></div>
      ${inCart ? `<button type="button" class="ui-market-price" data-market-action="price">${item.preco_compra == null ? 'Sem preço' : money(item.preco_compra)}</button>` : ''}
    </article>`;
  }

  async function refresh() {
    const overlay = document.querySelector('.ui-market-overlay');
    if (!overlay || !context()) return;
    if (refreshing) {
      refreshQueued = true;
      return;
    }
    refreshing = true;
    try {
      const items = await getItems();
      if (!overlay.isConnected) return;
      const waiting = items.filter(item => !item.no_carrinho);
      const cart = items.filter(item => item.no_carrinho);
      const total = cart.reduce((sum, item) => sum + Number(item.preco_compra || 0), 0);
      const withoutPrice = cart.filter(item => item.preco_compra == null).length;

      const heading = overlay.querySelector('.ui-market-heading span');
      if (heading) heading.textContent = `${waiting.length} restantes · ${cart.length} no carrinho`;
      const totalBox = overlay.querySelector('.ui-market-total');
      if (totalBox) totalBox.innerHTML = `<span>Total informado</span><strong>${money(total)}</strong><small>${withoutPrice ? `${withoutPrice} ${withoutPrice === 1 ? 'item sem preço' : 'itens sem preço'}` : 'Todos os itens com preço'}</small>`;
      const content = overlay.querySelector('.ui-market-content');
      if (content) content.innerHTML = `<section><h3>Para pegar</h3>${waiting.length ? waiting.map(item => row(item, false)).join('') : '<div class="vazio">Tudo que estava na lista já foi para o carrinho.</div>'}</section><section><h3>No carrinho</h3>${cart.length ? cart.map(item => row(item, true)).join('') : '<div class="vazio">Nenhum item no carrinho ainda.</div>'}</section>`;
      const finish = overlay.querySelector('[data-market-action="finish"]');
      if (finish) finish.disabled = !cart.length;
      window.dispatchEvent(new CustomEvent('lifeos:market-rendered'));
    } catch (error) {
      console.error('[Mercado live v3]', error);
    } finally {
      refreshing = false;
      if (refreshQueued) {
        refreshQueued = false;
        window.setTimeout(refresh, 0);
      }
    }
  }

  async function markPicked(id) {
    const ctx = context();
    if (!ctx || busy.has(id)) return;
    busy.add(id);
    const visibleRow = document.querySelector(`.ui-market-overlay [data-market-id="${CSS.escape(id)}"]`);
    visibleRow?.classList.add('is-updating');
    visibleRow?.querySelector('.ui-market-toggle')?.setAttribute('disabled', '');
    try {
      const itemResult = await ctx.client.from('lista_compras')
        .select('id,quantidade,unidade,quantidade_planejada,unidade_planejada')
        .eq('id', id)
        .eq('casa_id', ctx.profile.casa_id)
        .single();
      if (itemResult.error || !itemResult.data) throw itemResult.error || new Error('Item não encontrado.');
      const item = itemResult.data;
      const planned = Number(item.quantidade_planejada ?? item.quantidade ?? 1) || 1;
      const unit = item.unidade_planejada ?? item.unidade ?? 'un';
      const update = await ctx.client.from('lista_compras').update({
        quantidade_planejada: item.quantidade_planejada ?? item.quantidade ?? planned,
        unidade_planejada: item.unidade_planejada ?? item.unidade ?? unit,
        quantidade_comprada: planned,
        unidade_comprada: unit,
        no_carrinho: true,
      }).eq('id', id).eq('casa_id', ctx.profile.casa_id);
      if (update.error) throw update.error;
      await refresh();
      window.dispatchEvent(new CustomEvent('lifeos:market-item-updated', { detail: { id } }));
    } catch (error) {
      toast(error.message || 'Não foi possível marcar o item como pego.', 'erro');
    } finally {
      busy.delete(id);
      if (document.querySelector('.ui-market-overlay')) refresh();
    }
  }

  function bindOverlay(overlay) {
    overlayObserver?.disconnect();
    overlayObserver = new MutationObserver(records => {
      // shopping-flow-v3 sinaliza alterações de preço/itens inesperados com um
      // nó efêmero diretamente no overlay. Só esse sinal dispara atualização;
      // mudanças dentro do conteúdo não alimentam um novo ciclo de renderização.
      const pulse = records.some(record => [...record.addedNodes, ...record.removedNodes]
        .some(node => node instanceof HTMLElement && node.tagName === 'I'));
      if (pulse) window.setTimeout(refresh, 0);
    });
    overlayObserver.observe(overlay, { childList: true });
    window.setTimeout(refresh, 0);
  }

  function installStyles() {
    if (document.getElementById('marketLiveV3Styles')) return;
    const style = document.createElement('style');
    style.id = 'marketLiveV3Styles';
    style.textContent = `.mlv3-meta{display:block;margin-top:3px;color:var(--muted);font-size:10px}.mlv3-meta strong{color:var(--sage);font-weight:800}.ui-market-item.is-updating{opacity:.62;pointer-events:none}`;
    document.head.appendChild(style);
  }

  document.addEventListener('click', event => {
    const overlay = event.target.closest?.('.ui-market-overlay');
    if (!overlay) return;
    const actionNode = event.target.closest?.('[data-market-action]');
    if (actionNode?.dataset.marketAction !== 'add') return;
    const id = event.target.closest?.('[data-market-id]')?.dataset.marketId;
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    markPicked(id);
  }, true);

  const bodyObserver = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const overlay = node.matches?.('.ui-market-overlay') ? node : null;
        if (overlay) bindOverlay(overlay);
      }
    }
  });

  installStyles();
  if (document.body) bodyObserver.observe(document.body, { childList: true });
  else document.addEventListener('DOMContentLoaded', () => bodyObserver.observe(document.body, { childList: true }), { once: true });
  const existing = document.querySelector('.ui-market-overlay');
  if (existing) bindOverlay(existing);
  window.addEventListener('lifeos:nfce-browser-applied', refresh);
  window.addEventListener('lifeos:nfce-file-applied', refresh);
  window.addEventListener('lifeos:shopping-list-changed', refresh);
  window.addEventListener('pageshow', () => { if (document.querySelector('.ui-market-overlay')) refresh(); });
  window.lifeosRefreshMarketLive = refresh;
})();
