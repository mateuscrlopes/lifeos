// LifeOS — Compras e Estoque v3
// Regra de produto: estoque = saldo real; lista = planejamento; carrinho = comprado.
// Esta camada consolida a experiência enquanto os módulos legados são retirados.

import { sincronizarItem } from './ponte-estoque.js';

(() => {
  'use strict';

  const S = {
    client: null,
    profile: null,
    stocks: [],
    pending: [],
    catalogAt: 0,
    renderTimer: null,
    busyStock: new Set(),
    selectedUnexpectedStockId: null,
  };

  const SVG = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L21 8H7"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  };

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalize(value = '') {
    return String(value)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokens(value = '') {
    return normalize(value).split(' ').filter(Boolean);
  }

  function score(query, candidate) {
    const q = normalize(query);
    const c = normalize(candidate);
    if (!q || !c) return 0;
    if (q === c) return 100;
    if (c.startsWith(q)) return 90;
    if (c.includes(q)) return 82;
    const qt = tokens(q);
    const ct = tokens(c);
    if (!qt.length || !ct.length) return 0;
    const matched = qt.filter(token => ct.some(word => word.startsWith(token) || word.includes(token))).length;
    return matched === qt.length ? 60 + Math.min(15, matched * 3) : 0;
  }

  function fmtNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  }

  function fmtQuantity(value, unit) {
    if (value === null || value === undefined || value === '') return '—';
    return `${fmtNumber(value)}${unit ? ` ${unit}` : ''}`;
  }

  function money(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function roundQty(value) {
    return Math.round(Number(value || 0) * 1000) / 1000;
  }

  function context() {
    const ctx = window.lifeosContext;
    if (!ctx?.supa || !ctx?.usuario) return null;
    S.client = ctx.supa;
    S.profile = ctx.usuario;
    return { client: S.client, profile: S.profile };
  }

  function toast(message, type = 'ok') {
    if (typeof window.lifeosToast === 'function') {
      window.lifeosToast(message, type);
      return;
    }
    window.dispatchEvent(new CustomEvent('lifeos:toast', { detail: { message, type } }));
  }

  function installStyles() {
    if (document.getElementById('shoppingFlowV3Styles')) return;
    const style = document.createElement('style');
    style.id = 'shoppingFlowV3Styles';
    style.textContent = `
      .nfce-overlay{z-index:470!important}
      .sfv3-search{position:relative;margin:0 0 12px}.sfv3-search svg{position:absolute;left:13px;top:13px;width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;color:var(--muted);pointer-events:none}.sfv3-search input{width:100%;min-height:44px;padding:10px 38px 10px 42px;border:1.5px solid var(--linha);border-radius:13px;background:var(--bg);color:var(--texto);font-size:14px}.sfv3-search input:focus{outline:none;border-color:var(--sage);background:var(--paper)}
      .sfv3-stock-toolbar{margin:0 0 14px}.sfv3-stock-toolbar small{display:block;margin-top:6px;color:var(--muted);font-size:11px;line-height:1.4}.sfv3-stock-hidden{display:none!important}
      .sfv3-stock-add{width:38px!important;height:38px!important;min-width:38px!important;padding:0!important;border:0!important;border-radius:10px!important;display:grid!important;place-items:center!important;background:var(--sage-soft)!important;color:var(--sage)!important}.sfv3-stock-add svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .sfv3-suggestions{display:grid;gap:6px;margin-top:8px}.sfv3-suggestions:empty{display:none}.sfv3-suggestion{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--linha);border-radius:11px;background:var(--paper);color:var(--texto);text-align:left}.sfv3-suggestion strong{display:block;font-size:13px}.sfv3-suggestion small{display:block;margin-top:2px;color:var(--muted);font-size:10px}.sfv3-suggestion span{flex:none;color:var(--sage);font-size:11px;font-weight:800}
      .sfv3-market-search{position:sticky;top:0;z-index:4;padding:10px 0 8px;background:var(--paper)}.sfv3-market-search .sfv3-search{margin:0}.sfv3-market-empty{padding:18px 8px;color:var(--muted);font-size:13px;text-align:center}
      .sfv3-overlay{position:fixed;inset:0;z-index:440;background:rgba(17,24,19,.58);display:flex;align-items:flex-end;justify-content:center}.sfv3-sheet{width:min(100%,560px);max-height:92dvh;overflow:auto;background:var(--paper);color:var(--texto);border-radius:24px 24px 0 0;padding:18px 18px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -12px 42px rgba(0,0,0,.22)}.sfv3-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.sfv3-head h3{margin:0;font-size:20px}.sfv3-head p{margin:4px 0 0;color:var(--muted);font-size:11px;line-height:1.4}.sfv3-close{width:40px;height:40px;min-width:40px;border:0;border-radius:12px;background:var(--bg);color:var(--texto);display:grid;place-items:center}.sfv3-close svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2}
      .sfv3-info{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 14px}.sfv3-info>div{padding:10px 12px;border-radius:12px;background:var(--bg)}.sfv3-info span,.sfv3-info strong{display:block}.sfv3-info span{font-size:10px;color:var(--muted)}.sfv3-info strong{margin-top:3px;font-size:14px}.sfv3-field{margin:13px 0}.sfv3-field label{display:block;margin-bottom:6px;color:var(--muted);font-size:11px;font-weight:700}.sfv3-field input,.sfv3-field select{width:100%;min-height:46px;padding:10px 12px;border:1.5px solid var(--linha);border-radius:12px;background:var(--bg);color:var(--texto);font:inherit}.sfv3-field input:focus,.sfv3-field select:focus{outline:none;border-color:var(--sage)}
      .sfv3-stepper{display:grid;grid-template-columns:46px 1fr 46px 92px;gap:7px}.sfv3-stepper button{min-height:46px;border:1px solid var(--linha);border-radius:12px;background:var(--sage-soft);color:var(--sage);font-size:21px;font-weight:800}.sfv3-stepper input{text-align:center;font-size:17px;font-weight:800}.sfv3-stepper select{font-size:12px}
      .sfv3-money{display:grid;grid-template-columns:42px 1fr;border:1.5px solid var(--linha);border-radius:12px;overflow:hidden;background:var(--bg)}.sfv3-money>span{display:grid;place-items:center;color:var(--muted);font-size:12px}.sfv3-money input{border:0!important;border-radius:0!important;text-align:right;font-size:18px;font-weight:800}.sfv3-subtotal{display:flex;justify-content:space-between;gap:12px;margin:9px 0 0;padding:10px 12px;border-radius:11px;background:var(--sage-soft);font-size:12px}.sfv3-subtotal strong{color:var(--sage)}
      .sfv3-actions{display:grid;gap:8px;margin-top:16px}.sfv3-actions.two{grid-template-columns:1fr 1fr}.sfv3-actions button{min-height:46px;border:0;border-radius:12px;padding:11px 14px;font-size:13px;font-weight:800}.sfv3-primary{background:var(--sage);color:white}.sfv3-secondary{background:var(--sage-soft);color:var(--sage)}.sfv3-quiet{background:var(--bg);color:var(--texto)}.sfv3-actions button:disabled{opacity:.55}.sfv3-link-state{margin:8px 0 0;padding:9px 11px;border-radius:10px;background:var(--sage-soft);color:var(--sage);font-size:11px;font-weight:700}
      @media(min-width:700px){.sfv3-overlay{align-items:center}.sfv3-sheet{border-radius:24px;max-height:86dvh}}
    `;
    document.head.appendChild(style);
  }

  function closeSheet() {
    document.querySelector('.sfv3-overlay')?.remove();
  }

  function openSheet({ title, subtitle = '', body = '' }) {
    closeSheet();
    const overlay = document.createElement('div');
    overlay.className = 'sfv3-overlay';
    overlay.innerHTML = `<section class="sfv3-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sfv3-head"><div><h3>${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div><button type="button" class="sfv3-close" data-sfv3-close aria-label="Fechar">${SVG.close}</button></div><div class="sfv3-body">${body}</div></section>`;
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-sfv3-close]')) closeSheet();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function pulseMarket() {
    const overlay = document.querySelector('.ui-market-overlay');
    if (!overlay) return;
    const pulse = document.createElement('i');
    pulse.hidden = true;
    overlay.appendChild(pulse);
    pulse.remove();
  }

  async function loadCatalog(force = false) {
    const ctx = context();
    if (!ctx) return { stocks: [], pending: [] };
    if (!force && Date.now() - S.catalogAt < 10000 && (S.stocks.length || S.pending.length)) {
      return { stocks: S.stocks, pending: S.pending };
    }
    const [stocksResult, pendingResult] = await Promise.all([
      ctx.client.from('estoque')
        .select('id,nome,categoria,tipo,quantidade,unidade,minimo,quantidade_ideal,passo_ajuste,local,critico')
        .eq('casa_id', ctx.profile.casa_id)
        .order('nome'),
      ctx.client.from('lista_compras')
        .select('id,nome,quantidade,unidade,quantidade_planejada,unidade_planejada,quantidade_comprada,unidade_comprada,estoque_id,no_carrinho,preco_compra,preco_unitario_compra,status')
        .eq('casa_id', ctx.profile.casa_id)
        .eq('status', 'pendente'),
    ]);
    if (stocksResult.error) throw stocksResult.error;
    if (pendingResult.error) throw pendingResult.error;
    S.stocks = stocksResult.data || [];
    S.pending = pendingResult.data || [];
    S.catalogAt = Date.now();
    return { stocks: S.stocks, pending: S.pending };
  }

  function rowName(row) {
    const name = row?.querySelector('.desc .nome, .nome');
    if (!name) return '';
    const direct = [...name.childNodes]
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent || '')
      .join(' ')
      .trim();
    return direct || name.textContent.trim();
  }

  async function stockForRow(row) {
    const name = rowName(row);
    if (!name) throw new Error('Não consegui identificar este item.');
    await loadCatalog();
    const normalized = normalize(name);
    const stock = S.stocks.find(item => normalize(item.nome) === normalized);
    if (!stock) {
      await loadCatalog(true);
      return S.stocks.find(item => normalize(item.nome) === normalized) || null;
    }
    return stock;
  }

  async function adjustStock(button, direction) {
    const ctx = context();
    const row = button.closest('#itensEstoque .item');
    if (!ctx || !row) return;
    const stock = await stockForRow(row);
    if (!stock) throw new Error('Item do estoque não encontrado.');
    if (S.busyStock.has(stock.id)) return;
    S.busyStock.add(stock.id);
    button.disabled = true;
    try {
      const current = Number(stock.quantidade);
      if (!Number.isFinite(current)) throw new Error('Quantidade atual inválida.');
      const step = Number(stock.passo_ajuste) > 0 ? Number(stock.passo_ajuste) : 1;
      const next = stock.tipo === 'presenca'
        ? (direction > 0 ? 1 : 0)
        : Math.max(0, roundQty(current + direction * step));
      const result = await ctx.client.from('estoque')
        .update({ quantidade: next, atualizado_por: ctx.profile.id, atualizado_em: new Date().toISOString() })
        .eq('id', stock.id)
        .eq('casa_id', ctx.profile.casa_id)
        .select('id,nome,categoria,tipo,quantidade,unidade,minimo,nivel,minimo_nivel')
        .single();
      if (result.error || !result.data) throw result.error || new Error('Não foi possível atualizar o estoque.');
      const quantity = row.querySelector('.est-qtd');
      if (quantity) quantity.textContent = fmtNumber(result.data.quantidade);
      await sincronizarItem(ctx.client, ctx.profile, result.data);
      ctx.client.from('eventos').insert({
        tipo: 'estoque_ajustado', entidade: 'estoque', entidade_id: stock.id, usuario_id: ctx.profile.id,
        valor_anterior: { quantidade: stock.quantidade }, valor_novo: { quantidade: result.data.quantidade },
        detalhe: `${ctx.profile.nome} ajustou ${stock.nome} de ${stock.quantidade} para ${result.data.quantidade}`,
      });
      S.catalogAt = 0;
      await loadCatalog(true);
    } finally {
      S.busyStock.delete(stock.id);
      if (button.isConnected) button.disabled = false;
    }
  }

  function ensureStockSearch() {
    const list = document.getElementById('itensEstoque');
    const card = list?.closest('.cartao');
    if (!list || !card || card.querySelector('#sfv3StockSearch')) return;
    const toolbar = document.createElement('div');
    toolbar.className = 'sfv3-stock-toolbar';
    toolbar.innerHTML = `<div class="sfv3-search">${SVG.search}<input id="sfv3StockSearch" type="search" autocomplete="off" placeholder="Buscar no estoque…" aria-label="Buscar no estoque"></div><small>Busque pelo nome e use o carrinho para preparar a próxima compra.</small>`;
    const header = card.firstElementChild;
    if (header) header.insertAdjacentElement('afterend', toolbar);
    else card.prepend(toolbar);
    toolbar.querySelector('input').addEventListener('input', filterStock);
  }

  function filterStock() {
    const input = document.getElementById('sfv3StockSearch');
    const query = normalize(input?.value || '');
    document.querySelectorAll('#itensEstoque .item').forEach(row => {
      const visible = !query || score(query, rowName(row)) > 0;
      row.classList.toggle('sfv3-stock-hidden', !visible);
    });
  }

  function decorateStockRows() {
    document.querySelectorAll('#itensEstoque .item').forEach(row => {
      const controls = row.querySelector('.est-controles');
      if (!controls || controls.querySelector('[data-sfv3-add-list]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sfv3-stock-add';
      button.dataset.sfv3AddList = '1';
      button.setAttribute('aria-label', 'Adicionar este item à lista de compras');
      button.title = 'Adicionar à lista';
      button.innerHTML = SVG.cart;
      const deleteButton = [...controls.querySelectorAll('button')].find(item => /excluir|remover/i.test(item.getAttribute('aria-label') || ''));
      if (deleteButton) controls.insertBefore(button, deleteButton);
      else controls.appendChild(button);
    });
    filterStock();
  }

  async function openStockPlan(stock) {
    const ctx = context();
    if (!ctx) return;
    await loadCatalog(true);
    const pending = S.pending.find(item => item.estoque_id === stock.id) || null;
    const current = Number(stock.quantidade) || 0;
    const ideal = stock.quantidade_ideal == null ? null : Number(stock.quantidade_ideal);
    const suggested = ideal != null && ideal > current ? roundQty(ideal - current) : 1;
    const initial = pending
      ? Number(pending.quantidade_planejada ?? pending.quantidade ?? 1)
      : Math.max(Number(stock.passo_ajuste) || 1, suggested || 1);
    const unit = pending?.unidade_planejada ?? pending?.unidade ?? stock.unidade ?? 'un';
    const root = openSheet({
      title: stock.nome,
      subtitle: pending ? 'Este item já está na lista. Ajuste o planejamento sem criar duplicata.' : 'Defina quanto quer comprar.',
      body: `<div class="sfv3-info"><div><span>Em casa agora</span><strong>${esc(fmtQuantity(stock.quantidade, stock.unidade))}</strong></div><div><span>Quantidade ideal</span><strong>${ideal == null ? 'Não definida' : esc(fmtQuantity(ideal, stock.unidade))}</strong></div></div><div class="sfv3-field"><label>Quanto comprar</label><div class="sfv3-stepper"><button type="button" data-sfv3-plan-minus>−</button><input id="sfv3PlanQty" type="number" inputmode="decimal" min="0" step="any" value="${esc(initial)}"><button type="button" data-sfv3-plan-plus>+</button><select id="sfv3PlanUnit" aria-label="Unidade"><option value="${esc(unit)}">${esc(unit)}</option></select></div></div><div class="sfv3-actions"><button class="sfv3-primary" id="sfv3PlanSave">${pending ? 'Atualizar lista' : 'Adicionar à lista'}</button></div>`,
    });
    const qty = root.querySelector('#sfv3PlanQty');
    const step = Number(stock.passo_ajuste) > 0 ? Number(stock.passo_ajuste) : 1;
    const adjust = direction => {
      qty.value = String(Math.max(step, roundQty((Number(qty.value) || 0) + direction * step)));
    };
    root.querySelector('[data-sfv3-plan-minus]').addEventListener('click', () => adjust(-1));
    root.querySelector('[data-sfv3-plan-plus]').addEventListener('click', () => adjust(1));
    root.querySelector('#sfv3PlanSave').addEventListener('click', async event => {
      const amount = Number(qty.value);
      if (!Number.isFinite(amount) || amount <= 0) {
        toast('Informe uma quantidade maior que zero.', 'erro');
        return;
      }
      const button = event.currentTarget;
      button.disabled = true;
      try {
        let result;
        const payload = {
          quantidade: roundQty(amount), unidade: unit,
          quantidade_planejada: roundQty(amount), unidade_planejada: unit,
          estoque_id: stock.id, categoria: stock.categoria,
        };
        if (pending) {
          result = await ctx.client.from('lista_compras').update(payload).eq('id', pending.id).eq('casa_id', ctx.profile.casa_id);
        } else {
          result = await ctx.client.from('lista_compras').insert({
            casa_id: ctx.profile.casa_id, nome: stock.nome, status: 'pendente', origem: 'estoque_manual',
            criado_por: ctx.profile.id, ciclo_compra: 'semanal', ...payload,
          });
        }
        if (result.error) throw result.error;
        S.catalogAt = 0;
        await loadCatalog(true);
        closeSheet();
        toast(pending ? 'Quantidade da lista atualizada.' : 'Item adicionado à lista.');
        window.dispatchEvent(new CustomEvent('lifeos:shopping-list-changed'));
      } catch (error) {
        button.disabled = false;
        toast(error.message || 'Não foi possível atualizar a lista.', 'erro');
      }
    });
  }

  function ensurePurchaseSuggestions() {
    const input = document.getElementById('novoItem');
    if (!input || input.dataset.sfv3 === '1') return;
    input.dataset.sfv3 = '1';
    input.placeholder = 'Buscar ou adicionar item';
    const holder = document.createElement('div');
    holder.id = 'sfv3PurchaseSuggestions';
    holder.className = 'sfv3-suggestions';
    input.closest('.linha-add')?.insertAdjacentElement('afterend', holder);
    input.addEventListener('focus', () => loadCatalog(true).then(renderPurchaseSuggestions).catch(() => {}));
    input.addEventListener('input', renderPurchaseSuggestions);
  }

  async function renderPurchaseSuggestions() {
    const input = document.getElementById('novoItem');
    const holder = document.getElementById('sfv3PurchaseSuggestions');
    if (!input || !holder) return;
    const query = input.value.trim();
    if (!query) { holder.innerHTML = ''; return; }
    try { await loadCatalog(); } catch { return; }
    const matches = [];
    S.pending.forEach(item => {
      const rank = score(query, item.nome);
      if (rank) matches.push({ kind: 'pending', rank: rank + 20, item });
    });
    S.stocks.forEach(item => {
      const rank = score(query, item.nome);
      if (rank && !S.pending.some(pending => pending.estoque_id === item.id)) matches.push({ kind: 'stock', rank, item });
    });
    matches.sort((a, b) => b.rank - a.rank || a.item.nome.localeCompare(b.item.nome, 'pt-BR'));
    holder.innerHTML = matches.slice(0, 5).map(match => {
      if (match.kind === 'pending') {
        const qty = match.item.quantidade_planejada ?? match.item.quantidade;
        const unit = match.item.unidade_planejada ?? match.item.unidade;
        return `<button type="button" class="sfv3-suggestion" data-sfv3-pending="${match.item.id}"><div><strong>${esc(match.item.nome)}</strong><small>${esc(fmtQuantity(qty, unit))}</small></div><span>Já na lista</span></button>`;
      }
      return `<button type="button" class="sfv3-suggestion" data-sfv3-stock="${match.item.id}"><div><strong>${esc(match.item.nome)}</strong><small>Em casa: ${esc(fmtQuantity(match.item.quantidade, match.item.unidade))}</small></div><span>Usar item</span></button>`;
    }).join('');
  }

  function ensureMarketSearch() {
    const overlay = document.querySelector('.ui-market-overlay');
    const content = overlay?.querySelector('.ui-market-content');
    if (!overlay || !content || overlay.querySelector('#sfv3MarketSearch')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'sfv3-market-search';
    wrapper.innerHTML = `<div class="sfv3-search">${SVG.search}<input id="sfv3MarketSearch" type="search" autocomplete="off" placeholder="Buscar na compra…" aria-label="Buscar na lista do mercado"></div><div class="sfv3-market-empty" hidden>Nenhum item encontrado.</div>`;
    content.insertAdjacentElement('beforebegin', wrapper);
    wrapper.querySelector('input').addEventListener('input', applyMarketSearch);
  }

  function applyMarketSearch() {
    const overlay = document.querySelector('.ui-market-overlay');
    const input = overlay?.querySelector('#sfv3MarketSearch');
    if (!overlay || !input) return;
    const query = input.value.trim();
    let visible = 0;
    overlay.querySelectorAll('.ui-market-content .ui-market-item').forEach(row => {
      const name = row.querySelector('.ui-market-item-name')?.textContent || row.textContent || '';
      const show = !query || score(query, name) > 0;
      row.hidden = !show;
      if (show) visible += 1;
    });
    const empty = overlay.querySelector('.sfv3-market-empty');
    if (empty) empty.hidden = !query || visible > 0;
  }

  async function fetchPendingItem(id) {
    const ctx = context();
    if (!ctx) throw new Error('Sessão indisponível.');
    const result = await ctx.client.from('lista_compras')
      .select('id,nome,quantidade,unidade,quantidade_planejada,unidade_planejada,quantidade_comprada,unidade_comprada,preco_compra,preco_unitario_compra,estoque_id,no_carrinho,status')
      .eq('id', id).eq('casa_id', ctx.profile.casa_id).single();
    if (result.error || !result.data) throw result.error || new Error('Item não encontrado.');
    return result.data;
  }

  async function quickAddMarket(id) {
    const ctx = context();
    if (!ctx) return;
    const item = await fetchPendingItem(id);
    const plannedQty = Number(item.quantidade_planejada ?? item.quantidade ?? 1) || 1;
    const plannedUnit = item.unidade_planejada ?? item.unidade ?? 'un';
    const result = await ctx.client.from('lista_compras').update({
      quantidade_planejada: item.quantidade_planejada ?? item.quantidade ?? plannedQty,
      unidade_planejada: item.unidade_planejada ?? item.unidade ?? plannedUnit,
      quantidade_comprada: roundQty(plannedQty), unidade_comprada: plannedUnit, no_carrinho: true,
    }).eq('id', item.id).eq('casa_id', ctx.profile.casa_id);
    if (result.error) throw result.error;
    S.catalogAt = 0;
    pulseMarket();
  }

  function setMoneyInput(input, value) {
    const cents = value === null || value === undefined || value === '' ? 0 : Math.max(0, Math.round(Number(value) * 100));
    input.dataset.cents = String(cents);
    input.value = cents ? (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  }

  function bindMoneyInput(input, onChange) {
    input.addEventListener('focus', () => input.select());
    input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '');
      const cents = digits ? Number(digits) : 0;
      input.dataset.cents = String(cents);
      input.value = cents ? (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
      onChange?.();
    });
  }

  function moneyValue(input) {
    const cents = Number(input?.dataset.cents || 0);
    return Number.isFinite(cents) ? cents / 100 : 0;
  }

  function unitOptions(current) {
    const units = ['un', 'pacote', 'kg', 'g', 'L', 'ml'];
    if (current && !units.some(unit => normalize(unit) === normalize(current))) units.unshift(current);
    return [...new Set(units)].map(unit => `<option value="${esc(unit)}" ${String(unit) === String(current) ? 'selected' : ''}>${esc(unit)}</option>`).join('');
  }

  async function openMarketEditor(id) {
    const ctx = context();
    if (!ctx) return;
    const item = await fetchPendingItem(id);
    const plannedQty = Number(item.quantidade_planejada ?? item.quantidade ?? 1) || 1;
    const plannedUnit = item.unidade_planejada ?? item.unidade ?? 'un';
    const actualQty = Number(item.quantidade_comprada ?? plannedQty) || 1;
    const actualUnit = item.unidade_comprada ?? plannedUnit;
    const initialUnitPrice = item.preco_unitario_compra != null ? Number(item.preco_unitario_compra) : Number(item.preco_compra || 0);
    const root = openSheet({
      title: item.nome,
      subtitle: `Planejado: ${fmtQuantity(plannedQty, plannedUnit)}. Ajuste só se o que você pegou for diferente.`,
      body: `<div class="sfv3-field"><label>Quanto você pegou</label><div class="sfv3-stepper"><button type="button" data-sfv3-market-minus>−</button><input id="sfv3MarketQty" type="number" inputmode="decimal" min="0" step="any" value="${esc(actualQty)}"><button type="button" data-sfv3-market-plus>+</button><select id="sfv3MarketUnit">${unitOptions(actualUnit)}</select></div></div><div class="sfv3-field"><label>Preço por unidade</label><div class="sfv3-money"><span>R$</span><input id="sfv3MarketPrice" inputmode="numeric" autocomplete="off" placeholder="0,00"></div><div class="sfv3-subtotal"><span>Subtotal</span><strong id="sfv3MarketSubtotal">R$ 0,00</strong></div></div><div class="sfv3-actions two"><button class="sfv3-secondary" id="sfv3MarketNoPrice">Sem preço</button><button class="sfv3-primary" id="sfv3MarketSave">Salvar</button></div>`,
    });
    const qty = root.querySelector('#sfv3MarketQty');
    const price = root.querySelector('#sfv3MarketPrice');
    const subtotal = root.querySelector('#sfv3MarketSubtotal');
    const updateSubtotal = () => { subtotal.textContent = money((Number(qty.value) || 0) * moneyValue(price)); };
    setMoneyInput(price, initialUnitPrice || null);
    bindMoneyInput(price, updateSubtotal);
    qty.addEventListener('input', updateSubtotal);
    const adjust = direction => {
      qty.value = String(Math.max(1, roundQty((Number(qty.value) || 0) + direction)));
      updateSubtotal();
    };
    root.querySelector('[data-sfv3-market-minus]').addEventListener('click', () => adjust(-1));
    root.querySelector('[data-sfv3-market-plus]').addEventListener('click', () => adjust(1));
    updateSubtotal();

    const save = async noPrice => {
      const amount = Number(qty.value);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Informe uma quantidade maior que zero.');
      const unit = root.querySelector('#sfv3MarketUnit').value || 'un';
      const unitPrice = noPrice ? null : moneyValue(price);
      const lineTotal = unitPrice == null ? null : Math.round(unitPrice * amount * 100) / 100;
      const result = await ctx.client.from('lista_compras').update({
        quantidade_planejada: item.quantidade_planejada ?? item.quantidade ?? plannedQty,
        unidade_planejada: item.unidade_planejada ?? item.unidade ?? plannedUnit,
        quantidade_comprada: roundQty(amount), unidade_comprada: unit,
        preco_unitario_compra: unitPrice, preco_compra: lineTotal, no_carrinho: true,
      }).eq('id', item.id).eq('casa_id', ctx.profile.casa_id);
      if (result.error) throw result.error;
      S.catalogAt = 0;
      closeSheet();
      pulseMarket();
    };
    root.querySelector('#sfv3MarketSave').addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try { await save(false); } catch (error) { event.currentTarget.disabled = false; toast(error.message, 'erro'); }
    });
    root.querySelector('#sfv3MarketNoPrice').addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try { await save(true); } catch (error) { event.currentTarget.disabled = false; toast(error.message, 'erro'); }
    });
  }

  async function openUnexpectedItem() {
    const ctx = context();
    if (!ctx) return;
    await loadCatalog(true);
    S.selectedUnexpectedStockId = null;
    const root = openSheet({
      title: 'Adicionar item',
      subtitle: 'Primeiro procuro na lista e no estoque para evitar duplicatas.',
      body: `<div class="sfv3-field"><label>Item</label><input id="sfv3UnexpectedName" type="text" autocomplete="off" placeholder="Ex.: iogurte"><div id="sfv3UnexpectedSuggestions" class="sfv3-suggestions"></div><div id="sfv3UnexpectedLink" class="sfv3-link-state" hidden></div></div><div class="sfv3-field"><label>Quantidade</label><div class="sfv3-stepper"><button type="button" data-sfv3-unexpected-minus>−</button><input id="sfv3UnexpectedQty" type="number" inputmode="decimal" min="0" step="any" value="1"><button type="button" data-sfv3-unexpected-plus>+</button><select id="sfv3UnexpectedUnit">${unitOptions('un')}</select></div></div><div class="sfv3-field"><label>Preço por unidade</label><div class="sfv3-money"><span>R$</span><input id="sfv3UnexpectedPrice" inputmode="numeric" autocomplete="off" placeholder="0,00"></div><div class="sfv3-subtotal"><span>Subtotal</span><strong id="sfv3UnexpectedSubtotal">R$ 0,00</strong></div></div><div class="sfv3-actions two"><button class="sfv3-secondary" id="sfv3UnexpectedNoPrice">Sem preço</button><button class="sfv3-primary" id="sfv3UnexpectedSave">Adicionar ao carrinho</button></div>`,
    });
    const name = root.querySelector('#sfv3UnexpectedName');
    const qty = root.querySelector('#sfv3UnexpectedQty');
    const unit = root.querySelector('#sfv3UnexpectedUnit');
    const price = root.querySelector('#sfv3UnexpectedPrice');
    const subtotal = root.querySelector('#sfv3UnexpectedSubtotal');
    const link = root.querySelector('#sfv3UnexpectedLink');
    const updateSubtotal = () => { subtotal.textContent = money((Number(qty.value) || 0) * moneyValue(price)); };
    bindMoneyInput(price, updateSubtotal);
    qty.addEventListener('input', updateSubtotal);
    const adjust = direction => {
      qty.value = String(Math.max(1, roundQty((Number(qty.value) || 0) + direction)));
      updateSubtotal();
    };
    root.querySelector('[data-sfv3-unexpected-minus]').addEventListener('click', () => adjust(-1));
    root.querySelector('[data-sfv3-unexpected-plus]').addEventListener('click', () => adjust(1));

    const renderSuggestions = () => {
      const query = name.value.trim();
      const holder = root.querySelector('#sfv3UnexpectedSuggestions');
      if (!query) { holder.innerHTML = ''; link.hidden = true; S.selectedUnexpectedStockId = null; return; }
      const matches = [];
      S.pending.forEach(item => { const rank = score(query, item.nome); if (rank) matches.push({ kind: 'pending', rank: rank + 20, item }); });
      S.stocks.forEach(item => { const rank = score(query, item.nome); if (rank) matches.push({ kind: 'stock', rank, item }); });
      matches.sort((a, b) => b.rank - a.rank);
      holder.innerHTML = matches.slice(0, 4).map(match => match.kind === 'pending'
        ? `<button type="button" class="sfv3-suggestion" data-sfv3-use-pending="${match.item.id}"><div><strong>${esc(match.item.nome)}</strong><small>Use o item que já estava planejado.</small></div><span>Na lista</span></button>`
        : `<button type="button" class="sfv3-suggestion" data-sfv3-use-stock="${match.item.id}"><div><strong>${esc(match.item.nome)}</strong><small>Em casa: ${esc(fmtQuantity(match.item.quantidade, match.item.unidade))}</small></div><span>Vincular</span></button>`).join('');
    };
    name.addEventListener('input', renderSuggestions);
    root.querySelector('#sfv3UnexpectedSuggestions').addEventListener('click', async event => {
      const pendingButton = event.target.closest('[data-sfv3-use-pending]');
      if (pendingButton) {
        closeSheet();
        await openMarketEditor(pendingButton.dataset.sfv3UsePending);
        return;
      }
      const stockButton = event.target.closest('[data-sfv3-use-stock]');
      if (!stockButton) return;
      const stock = S.stocks.find(item => item.id === stockButton.dataset.sfv3UseStock);
      if (!stock) return;
      S.selectedUnexpectedStockId = stock.id;
      name.value = stock.nome;
      unit.innerHTML = unitOptions(stock.unidade || 'un');
      unit.value = stock.unidade || 'un';
      link.textContent = `Vinculado ao estoque: ${stock.nome}`;
      link.hidden = false;
      root.querySelector('#sfv3UnexpectedSuggestions').innerHTML = '';
    });

    const save = async noPrice => {
      const itemName = name.value.trim();
      const amount = Number(qty.value);
      if (!itemName) throw new Error('Digite o nome do item.');
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Informe uma quantidade maior que zero.');
      await loadCatalog(true);
      const exactPending = S.pending.find(item => normalize(item.nome) === normalize(itemName));
      const exactStock = S.stocks.find(item => normalize(item.nome) === normalize(itemName));
      const actualUnit = unit.value || exactStock?.unidade || 'un';
      const unitPrice = noPrice ? null : moneyValue(price);
      const lineTotal = unitPrice == null ? null : Math.round(unitPrice * amount * 100) / 100;
      let result;
      if (exactPending) {
        result = await ctx.client.from('lista_compras').update({
          quantidade_comprada: roundQty(amount), unidade_comprada: actualUnit,
          preco_unitario_compra: unitPrice, preco_compra: lineTotal, no_carrinho: true,
        }).eq('id', exactPending.id).eq('casa_id', ctx.profile.casa_id);
      } else {
        const stockId = S.selectedUnexpectedStockId || exactStock?.id || null;
        result = await ctx.client.from('lista_compras').insert({
          casa_id: ctx.profile.casa_id, nome: itemName, quantidade: roundQty(amount), unidade: actualUnit,
          quantidade_comprada: roundQty(amount), unidade_comprada: actualUnit,
          preco_unitario_compra: unitPrice, preco_compra: lineTotal,
          status: 'pendente', origem: 'mercado_inesperado', criado_por: ctx.profile.id,
          no_carrinho: true, estoque_id: stockId, categoria: exactStock?.categoria || null,
        });
      }
      if (result.error) throw result.error;
      S.catalogAt = 0;
      closeSheet();
      pulseMarket();
    };
    root.querySelector('#sfv3UnexpectedSave').addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try { await save(false); } catch (error) { event.currentTarget.disabled = false; toast(error.message, 'erro'); }
    });
    root.querySelector('#sfv3UnexpectedNoPrice').addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try { await save(true); } catch (error) { event.currentTarget.disabled = false; toast(error.message, 'erro'); }
    });
    name.focus();
  }

  async function handleClick(event) {
    const stockControl = event.target.closest?.('#itensEstoque .est-controles button');
    if (stockControl) {
      if (stockControl.matches('[data-sfv3-add-list]')) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        try {
          const stock = await stockForRow(stockControl.closest('.item'));
          if (!stock) throw new Error('Item do estoque não encontrado.');
          await openStockPlan(stock);
        } catch (error) { toast(error.message, 'erro'); }
        return;
      }
      const label = String(stockControl.textContent || '').trim();
      const aria = stockControl.getAttribute('aria-label') || '';
      const direction = label === '+' || /aument|adicionar/i.test(aria) ? 1
        : (label === '−' || label === '-' || /diminu|reduzir/i.test(aria) ? -1 : 0);
      if (direction) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        adjustStock(stockControl, direction).catch(error => toast(error.message || 'Não foi possível atualizar o estoque.', 'erro'));
        return;
      }
    }

    const stockSuggestion = event.target.closest?.('[data-sfv3-stock]');
    if (stockSuggestion) {
      event.preventDefault();
      try {
        await loadCatalog();
        const stock = S.stocks.find(item => item.id === stockSuggestion.dataset.sfv3Stock);
        if (stock) await openStockPlan(stock);
      } catch (error) { toast(error.message, 'erro'); }
      return;
    }

    const pendingSuggestion = event.target.closest?.('[data-sfv3-pending]');
    if (pendingSuggestion) {
      event.preventDefault();
      try {
        await loadCatalog();
        const pending = S.pending.find(item => item.id === pendingSuggestion.dataset.sfv3Pending);
        const stock = pending?.estoque_id ? S.stocks.find(item => item.id === pending.estoque_id) : null;
        if (stock) await openStockPlan(stock);
        else toast('Este item já está na lista.');
      } catch (error) { toast(error.message, 'erro'); }
      return;
    }

    const addButton = event.target.closest?.('#btnAdd');
    if (addButton) {
      const input = document.getElementById('novoItem');
      const typed = input?.value.trim() || '';
      if (typed) {
        try {
          await loadCatalog();
          const pending = S.pending.find(item => normalize(item.nome) === normalize(typed));
          const stock = S.stocks.find(item => normalize(item.nome) === normalize(typed));
          if (pending || stock) {
            event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
            if (stock) await openStockPlan(stock);
            else toast('Este item já está na lista.');
            return;
          }
        } catch {}
      }
    }

    const marketOverlay = event.target.closest?.('.ui-market-overlay');
    if (!marketOverlay) return;
    const actionNode = event.target.closest('[data-market-action]');
    const action = actionNode?.dataset.marketAction;
    if (action === 'extra') {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      try { await openUnexpectedItem(); } catch (error) { toast(error.message, 'erro'); }
      return;
    }
    if (!['add', 'price'].includes(action)) return;
    const row = event.target.closest('[data-market-id]');
    if (!row?.dataset.marketId) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    try {
      if (action === 'add') await quickAddMarket(row.dataset.marketId);
      else await openMarketEditor(row.dataset.marketId);
    } catch (error) { toast(error.message || 'Não foi possível atualizar a compra.', 'erro'); }
  }

  function enhance() {
    ensureStockSearch();
    decorateStockRows();
    ensurePurchaseSuggestions();
    ensureMarketSearch();
    applyMarketSearch();
  }

  function scheduleEnhance() {
    window.clearTimeout(S.renderTimer);
    S.renderTimer = window.setTimeout(enhance, 70);
  }

  installStyles();
  // Captura precisa ser registrada antes do Mercado v2 para transformar o caminho
  // normal em um toque e deixar o editor apenas para exceções.
  document.addEventListener('click', handleClick, true);
  new MutationObserver(scheduleEnhance).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('lifeos:bootstrap-ready', scheduleEnhance);
  window.addEventListener('lifeos:shopping-list-changed', () => { S.catalogAt = 0; scheduleEnhance(); });
  scheduleEnhance();
})();
