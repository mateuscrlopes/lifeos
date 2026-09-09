// LifeOS — Mercado v2: planejado x comprado
// A lista continua dizendo o que a Casa precisa. No carrinho registramos o que
// realmente foi comprado, com quantidade/unidade ajustáveis e preço em centavos.

(() => {
  'use strict';

  const M = {
    client: null,
    profile: null,
    renderTimer: null,
    busy: false,
  };

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function money(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function context() {
    const ctx = window.lifeosContext;
    if (!ctx?.supa || !ctx?.usuario) return false;
    M.client = ctx.supa;
    M.profile = ctx.usuario;
    return true;
  }

  function formatNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  }

  function formatQuantity(value, unit) {
    if (value === null || value === undefined || value === '') return '';
    return `${formatNumber(value)}${unit ? ` ${unit}` : ''}`;
  }

  function unitStep(unit) {
    const u = String(unit || '').toLowerCase();
    return ['kg', 'l', 'litro', 'litros'].includes(u) ? 0.1 : 1;
  }

  function roundQuantity(value) {
    return Math.round(Number(value || 0) * 1000) / 1000;
  }

  function unitOptions(current) {
    const base = ['un', 'unidades', 'kg', 'g', 'L', 'ml', 'pacote'];
    const options = current && !base.some(item => item.toLowerCase() === String(current).toLowerCase())
      ? [current, ...base]
      : base;
    return [...new Set(options)].map(unit => `<option value="${esc(unit)}" ${String(unit) === String(current) ? 'selected' : ''}>${esc(unit)}</option>`).join('');
  }

  function parseCentsInput(input) {
    const cents = Number(input?.dataset?.cents || 0);
    return Number.isFinite(cents) ? cents / 100 : null;
  }

  function setCentsInput(input, value) {
    const cents = value === null || value === undefined || value === ''
      ? 0
      : Math.max(0, Math.round(Number(value) * 100));
    input.dataset.cents = String(cents);
    input.value = cents ? (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  }

  function bindCentsInput(input) {
    input.addEventListener('focus', () => input.select());
    input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '');
      const cents = digits ? Number(digits) : 0;
      input.dataset.cents = String(cents);
      input.value = cents ? (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    });
  }

  function installStyles() {
    if (document.getElementById('marketPurchaseV2Styles')) return;
    const style = document.createElement('style');
    style.id = 'marketPurchaseV2Styles';
    style.textContent = `
      .mpx-plan-meta{display:block;margin-top:3px;font-size:10px;color:var(--muted)}
      .mpx-plan-meta strong{color:var(--texto);font-weight:700}.mpx-plan-meta .actual{color:var(--sage)}
      .mpx-overlay{position:fixed;inset:0;z-index:285;background:rgba(17,24,19,.58);display:grid;place-items:end center}
      .mpx-sheet{width:min(100%,560px);max-height:92dvh;overflow:auto;background:var(--paper);color:var(--texto);border-radius:22px 22px 0 0;padding:18px 18px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -12px 42px rgba(0,0,0,.22)}
      .mpx-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.mpx-head span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--sage);font-weight:800}.mpx-head h3{font-size:19px;margin:3px 0 0}.mpx-close{width:38px;height:38px;border:0;border-radius:12px;background:var(--bg);color:var(--texto);font-size:24px}
      .mpx-planned{margin:13px 0;padding:10px 12px;border-radius:12px;background:var(--sage-soft);font-size:11px;color:var(--muted)}.mpx-planned strong{color:var(--texto)}
      .mpx-label{display:block;font-size:11px;font-weight:750;margin:14px 0 7px}.mpx-qty-row{display:grid;grid-template-columns:42px minmax(0,1fr) 42px 92px;gap:7px;align-items:stretch}
      .mpx-qty-row button{border:1px solid var(--linha);border-radius:11px;background:var(--bg);color:var(--sage);font-size:22px;font-weight:750}.mpx-qty-row input,.mpx-qty-row select,.mpx-money input{min-width:0;width:100%;border:1px solid var(--linha);border-radius:11px;background:var(--paper);color:var(--texto);font:inherit;padding:11px;text-align:center}.mpx-qty-row select{font-size:12px}.mpx-qty-row input{font-size:16px;font-weight:750}
      .mpx-money{display:grid;grid-template-columns:38px 1fr;align-items:center;border:1px solid var(--linha);border-radius:11px;overflow:hidden;background:var(--paper)}.mpx-money span{font-size:12px;color:var(--muted);text-align:center}.mpx-money input{border:0;border-radius:0;text-align:right;font-size:18px;font-weight:800;padding-left:0}
      .mpx-actions{display:grid;gap:8px;margin-top:18px}.mpx-actions.two{grid-template-columns:1fr 1fr}.mpx-actions button{border:0;border-radius:12px;padding:12px 14px;font-size:12px;font-weight:800}.mpx-primary{background:var(--sage);color:#fff}.mpx-secondary{background:var(--sage-soft);color:var(--sage)}.mpx-quiet{background:var(--bg);color:var(--texto)}.mpx-actions button:disabled{opacity:.5}
      .mpx-finish-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}.mpx-finish-summary>div{background:var(--bg);border-radius:12px;padding:12px}.mpx-finish-summary span,.mpx-finish-summary strong{display:block}.mpx-finish-summary span{font-size:10px;color:var(--muted)}.mpx-finish-summary strong{font-size:17px;margin-top:3px}.mpx-note{font-size:11px;line-height:1.45;color:var(--muted);margin:12px 0 0}
      @media(min-width:700px){.mpx-overlay{place-items:center}.mpx-sheet{border-radius:22px}}
    `;
    document.head.appendChild(style);
  }

  function closeSheet() {
    document.getElementById('mpxOverlay')?.remove();
  }

  function sheet(title, kicker, content) {
    closeSheet();
    const overlay = document.createElement('div');
    overlay.id = 'mpxOverlay';
    overlay.className = 'mpx-overlay';
    overlay.innerHTML = `<section class="mpx-sheet" role="dialog" aria-modal="true"><div class="mpx-head"><div><span>${esc(kicker)}</span><h3>${esc(title)}</h3></div><button type="button" class="mpx-close" data-mpx-close aria-label="Fechar">×</button></div>${content}</section>`;
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-mpx-close]')) closeSheet();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  async function fetchItem(id) {
    if (!context()) throw new Error('Sessão indisponível.');
    const result = await M.client.from('lista_compras')
      .select('id,casa_id,nome,quantidade,unidade,quantidade_planejada,unidade_planejada,quantidade_comprada,unidade_comprada,preco_compra,no_carrinho,status')
      .eq('id', id)
      .eq('casa_id', M.profile.casa_id)
      .single();
    if (result.error || !result.data) throw result.error || new Error('Item não encontrado.');
    return result.data;
  }

  async function openItemEditor(id) {
    try {
      const item = await fetchItem(id);
      const plannedQuantity = item.quantidade_planejada ?? item.quantidade;
      const plannedUnit = item.unidade_planejada ?? item.unidade ?? 'un';
      const initialQuantity = item.quantidade_comprada ?? item.quantidade ?? 1;
      const initialUnit = item.unidade_comprada ?? item.unidade ?? 'un';
      const root = sheet(item.nome, item.no_carrinho ? 'Item no carrinho' : 'Adicionar ao carrinho', `
        <div class="mpx-planned">Planejado: <strong>${esc(formatQuantity(plannedQuantity, plannedUnit) || 'sem quantidade definida')}</strong></div>
        <label class="mpx-label" for="mpxQuantity">Quanto você pegou</label>
        <div class="mpx-qty-row"><button type="button" data-mpx-minus aria-label="Diminuir quantidade">−</button><input id="mpxQuantity" inputmode="decimal" type="number" min="0" step="any" value="${esc(initialQuantity)}"><button type="button" data-mpx-plus aria-label="Aumentar quantidade">+</button><select id="mpxUnit" aria-label="Unidade">${unitOptions(initialUnit)}</select></div>
        <label class="mpx-label" for="mpxPrice">Valor do item</label>
        <div class="mpx-money"><span>R$</span><input id="mpxPrice" inputmode="numeric" autocomplete="off" placeholder="0,00"></div>
        <p class="mpx-note">A quantidade da lista continua guardada como planejamento. Aqui entra somente o que foi realmente comprado.</p>
        <div class="mpx-actions two"><button type="button" class="mpx-secondary" id="mpxNoPrice">Sem preço</button><button type="button" class="mpx-primary" id="mpxSave">${item.no_carrinho ? 'Atualizar' : 'Colocar no carrinho'}</button></div>`);

      const quantity = root.querySelector('#mpxQuantity');
      const unit = root.querySelector('#mpxUnit');
      const price = root.querySelector('#mpxPrice');
      setCentsInput(price, item.preco_compra);
      bindCentsInput(price);

      const adjust = direction => {
        const step = unitStep(unit.value);
        const current = Number(quantity.value || 0);
        quantity.value = String(Math.max(0, roundQuantity(current + direction * step)));
      };
      root.querySelector('[data-mpx-minus]').addEventListener('click', () => adjust(-1));
      root.querySelector('[data-mpx-plus]').addEventListener('click', () => adjust(1));
      unit.addEventListener('change', () => {
        const current = Number(quantity.value || 0);
        if (!Number.isFinite(current) || current <= 0) quantity.value = String(unitStep(unit.value));
      });

      const save = async noPrice => {
        const actualQuantity = Number(quantity.value);
        if (!Number.isFinite(actualQuantity) || actualQuantity <= 0) {
          window.lifeosToast?.('Informe uma quantidade maior que zero.', 'erro');
          quantity.focus();
          return;
        }
        const actualUnit = String(unit.value || 'un');
        const value = noPrice ? null : parseCentsInput(price);
        const button = root.querySelector('#mpxSave');
        button.disabled = true;
        const result = await M.client.from('lista_compras').update({
          quantidade_planejada: item.quantidade_planejada ?? item.quantidade,
          unidade_planejada: item.unidade_planejada ?? item.unidade,
          quantidade_comprada: roundQuantity(actualQuantity),
          unidade_comprada: actualUnit,
          preco_compra: value,
          no_carrinho: true,
        }).eq('id', item.id).eq('casa_id', M.profile.casa_id);
        if (result.error) {
          button.disabled = false;
          throw result.error;
        }
        closeSheet();
        await refreshOverlay();
      };

      root.querySelector('#mpxSave').addEventListener('click', async () => {
        try { await save(false); }
        catch (error) { window.lifeosToast?.(error.message, 'erro'); }
      });
      root.querySelector('#mpxNoPrice').addEventListener('click', async () => {
        try { await save(true); }
        catch (error) { window.lifeosToast?.(error.message, 'erro'); }
      });
    } catch (error) {
      window.lifeosToast?.(error.message || 'Não foi possível abrir o item.', 'erro');
    }
  }

  async function removeItem(id) {
    if (!context()) return;
    const result = await M.client.from('lista_compras').update({
      no_carrinho: false,
      preco_compra: null,
      quantidade_comprada: null,
      unidade_comprada: null,
    }).eq('id', id).eq('casa_id', M.profile.casa_id);
    if (result.error) throw result.error;
    await refreshOverlay();
  }

  function marketRow(item, inCart, stock) {
    const plannedQuantity = item.quantidade_planejada ?? item.quantidade;
    const plannedUnit = item.unidade_planejada ?? item.unidade;
    const actualQuantity = item.quantidade_comprada ?? item.quantidade;
    const actualUnit = item.unidade_comprada ?? item.unidade;
    const planned = formatQuantity(plannedQuantity, plannedUnit);
    const actual = formatQuantity(actualQuantity, actualUnit);
    const meta = inCart
      ? `<span class="mpx-plan-meta">Planejado: ${esc(planned || '—')} · <strong class="actual">Peguei: ${esc(actual || '—')}</strong></span>`
      : `<span class="mpx-plan-meta">Comprar: <strong>${esc(planned || 'quantidade livre')}</strong></span>`;
    return `<article class="ui-market-item${inCart ? ' is-cart' : ''}" data-market-id="${item.id}">
      <button type="button" class="ui-market-toggle" data-market-action="${inCart ? 'remove' : 'add'}" aria-label="${inCart ? 'Retirar do carrinho' : 'Adicionar ao carrinho'}">${inCart ? '✓' : ''}</button>
      <div class="ui-market-item-info"><div class="ui-market-item-name">${esc(item.nome)} ${stock?.critico ? '<span class="ui-market-critical">Crítico</span>' : ''}</div>${meta}</div>
      ${inCart ? `<button type="button" class="ui-market-price" data-market-action="price">${item.preco_compra == null ? 'Sem preço' : money(item.preco_compra)}</button>` : ''}
    </article>`;
  }

  async function marketItems() {
    if (!context()) return [];
    const [itemsResult, stockResult] = await Promise.all([
      M.client.from('lista_compras')
        .select('id,nome,quantidade,unidade,quantidade_planejada,unidade_planejada,quantidade_comprada,unidade_comprada,categoria,estoque_id,no_carrinho,preco_compra,status,destino_compra_id,compra_destinos(id,nome,entra_lista_mercado)')
        .eq('casa_id', M.profile.casa_id).eq('status', 'pendente').order('criado_em', { ascending: true }),
      M.client.from('estoque').select('id,nome,critico,local').eq('casa_id', M.profile.casa_id),
    ]);
    if (itemsResult.error) throw itemsResult.error;
    if (stockResult.error) throw stockResult.error;
    const stocks = new Map((stockResult.data || []).map(stock => [stock.id, stock]));
    return (itemsResult.data || [])
      .filter(item => !item.compra_destinos || item.compra_destinos.entra_lista_mercado !== false)
      .map(item => ({ ...item, stock: stocks.get(item.estoque_id) || null }))
      .sort((a, b) => Number(Boolean(b.stock?.critico)) - Number(Boolean(a.stock?.critico)) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  }

  async function refreshOverlay() {
    const overlay = document.querySelector('.ui-market-overlay');
    if (!overlay || !context()) return;
    try {
      const items = await marketItems();
      const waiting = items.filter(item => !item.no_carrinho);
      const cart = items.filter(item => item.no_carrinho);
      const total = cart.reduce((sum, item) => sum + Number(item.preco_compra || 0), 0);
      const withoutPrice = cart.filter(item => item.preco_compra === null || item.preco_compra === undefined).length;

      const heading = overlay.querySelector('.ui-market-heading span');
      if (heading) heading.textContent = `${waiting.length} restantes · ${cart.length} no carrinho`;
      const totalBox = overlay.querySelector('.ui-market-total');
      if (totalBox) totalBox.innerHTML = `<span>Total informado</span><strong>${money(total)}</strong><small>${withoutPrice ? `${withoutPrice} ${withoutPrice === 1 ? 'item sem preço' : 'itens sem preço'}` : 'Todos os itens com preço'}</small>`;
      const content = overlay.querySelector('.ui-market-content');
      if (content) content.innerHTML = `<section><h3>Para pegar</h3>${waiting.length ? waiting.map(item => marketRow(item, false, item.stock)).join('') : '<div class="vazio">Tudo que estava na lista já foi para o carrinho.</div>'}</section><section><h3>No carrinho</h3>${cart.length ? cart.map(item => marketRow(item, true, item.stock)).join('') : '<div class="vazio">Nenhum item no carrinho ainda.</div>'}</section>`;
      const finish = overlay.querySelector('[data-market-action="finish"]');
      if (finish) finish.disabled = !cart.length;
    } catch (error) {
      console.error('[Mercado v2]', error);
    }
  }

  async function currentMarketLocation() {
    if (!context()) return { id: null, name: 'Mercado não informado' };
    const name = document.querySelector('.ui-market-overlay .ui-market-heading strong')?.textContent?.trim() || 'Mercado não informado';
    if (!name || name === 'Lista do mercado') return { id: null, name: 'Mercado não informado' };
    const result = await M.client.from('locais_compra').select('id,nome').eq('casa_id', M.profile.casa_id).eq('nome', name).maybeSingle();
    return { id: result.data?.id || null, name };
  }

  async function openFinish() {
    if (!context() || M.busy) return;
    const items = await marketItems();
    const cart = items.filter(item => item.no_carrinho);
    if (!cart.length) return;
    const total = cart.reduce((sum, item) => sum + Number(item.preco_compra || 0), 0);
    const withoutPrice = cart.filter(item => item.preco_compra == null).length;
    const root = sheet('Finalizar compra', 'Conferência rápida', `
      <div class="mpx-finish-summary"><div><span>Itens no carrinho</span><strong>${cart.length}</strong></div><div><span>Total informado</span><strong>${money(total)}</strong></div></div>
      ${withoutPrice ? `<p class="mpx-note">${withoutPrice} ${withoutPrice === 1 ? 'item está' : 'itens estão'} sem preço. Isso não impede a finalização.</p>` : '<p class="mpx-note">As quantidades reais serão usadas na conferência do estoque; o planejado continua preservado no histórico.</p>'}
      <div class="mpx-actions two"><button type="button" class="mpx-secondary" data-mpx-close>Voltar</button><button type="button" class="mpx-primary" id="mpxFinishConfirm">Finalizar compra</button></div>`);
    root.querySelector('#mpxFinishConfirm').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'Finalizando…';
      M.busy = true;
      try {
        const local = await currentMarketLocation();
        const result = await M.client.rpc('finalizar_compra_mercado_v2', {
          p_local_compra_id: local.id,
          p_local_nome: local.name,
        });
        if (result.error) throw result.error;
        closeSheet();
        document.querySelector('.ui-market-overlay')?.remove();
        document.body.classList.remove('ui-modal-open');
        window.lifeosToast?.('Compra finalizada. Quantidades reais salvas para conferir o estoque.', 'ok');
        window.dispatchEvent(new CustomEvent('lifeos:market-purchase-finished', { detail: { sessionId: result.data } }));
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Finalizar compra';
        window.lifeosToast?.(error.message || 'Não foi possível finalizar a compra.', 'erro');
      } finally {
        M.busy = false;
      }
    });
  }

  async function handleMarketClick(event) {
    const overlay = event.target.closest('.ui-market-overlay');
    if (!overlay) return;
    const actionElement = event.target.closest('[data-market-action]');
    const action = actionElement?.dataset.marketAction;
    if (!['add', 'price', 'remove', 'finish'].includes(action)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (action === 'finish') {
      try { await openFinish(); }
      catch (error) { window.lifeosToast?.(error.message, 'erro'); }
      return;
    }

    const row = event.target.closest('[data-market-id]');
    const id = row?.dataset.marketId;
    if (!id) return;
    if (action === 'add' || action === 'price') {
      await openItemEditor(id);
      return;
    }
    if (action === 'remove') {
      try { await removeItem(id); }
      catch (error) { window.lifeosToast?.(error.message, 'erro'); }
    }
  }

  function scheduleOverlayRefresh() {
    window.clearTimeout(M.renderTimer);
    M.renderTimer = window.setTimeout(() => {
      if (document.querySelector('.ui-market-overlay')) refreshOverlay();
    }, 100);
  }

  installStyles();
  document.addEventListener('click', handleMarketClick, true);
  new MutationObserver(scheduleOverlayRefresh).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('lifeos:bootstrap-ready', scheduleOverlayRefresh);
})();
