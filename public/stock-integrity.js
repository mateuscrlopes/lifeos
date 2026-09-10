// LifeOS — integridade de interação do Estoque
// Corrige os controles de quantidade por unidade, exclusão atômica e a
// conferência pós-compra sem duplicar a renderização principal do app.

import { sincronizarItem } from './ponte-estoque.js';

(() => {
  'use strict';

  const S = {
    busy: new Set(),
    conference: new WeakMap(),
    decoratingConference: new WeakSet(),
    inventoryTimer: null,
  };

  function context() {
    const ctx = window.lifeosContext;
    if (!ctx?.supa || !ctx?.usuario) return null;
    return { client: ctx.supa, profile: ctx.usuario };
  }

  function toast(message, type = 'ok') {
    if (typeof window.lifeosToast === 'function') {
      window.lifeosToast(message, type);
      return;
    }
    const event = new CustomEvent('lifeos:toast', { detail: { message, type } });
    window.dispatchEvent(event);
  }

  async function confirmAction(options) {
    if (typeof window.lifeosConfirmAction === 'function') return window.lifeosConfirmAction(options);
    return window.confirm(options.message || options.title || 'Confirmar?');
  }

  function normalizeName(value = '') {
    return String(value)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim().replace(/\s+/g, ' ');
  }

  function normalizeUnit(value = '') {
    const unit = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    if (['un', 'und', 'unid', 'unidade', 'unidades'].includes(unit)) return 'un';
    if (['kg', 'quilo', 'quilos', 'quilograma', 'quilogramas'].includes(unit)) return 'kg';
    if (['g', 'gr', 'grama', 'gramas'].includes(unit)) return 'g';
    if (['l', 'lt', 'litro', 'litros'].includes(unit)) return 'l';
    if (['ml', 'mililitro', 'mililitros'].includes(unit)) return 'ml';
    return unit;
  }

  function roundQuantity(value) {
    return Math.round(Number(value || 0) * 1000) / 1000;
  }

  function quantityStep(item) {
    if (item?.tipo !== 'peso_volume') return 1;
    const unit = normalizeUnit(item?.unidade);
    if (unit === 'g' || unit === 'ml') return 100;
    if (unit === 'kg' || unit === 'l') return 1;
    return 1;
  }

  function rowName(row) {
    const node = row?.querySelector?.('.desc .nome, .nome');
    if (!node) return '';
    const text = [...node.childNodes]
      .filter(child => child.nodeType === Node.TEXT_NODE)
      .map(child => child.textContent || '')
      .join(' ')
      .trim();
    return text || node.textContent.trim();
  }

  async function findStockForRow(row) {
    const ctx = context();
    if (!ctx) throw new Error('Sessão indisponível.');
    const name = rowName(row);
    if (!name) throw new Error('Não consegui identificar este item do estoque.');

    let result = await ctx.client.from('estoque')
      .select('id,casa_id,nome,categoria,tipo,quantidade,unidade,minimo,nivel,minimo_nivel,local,critico,taxa_consumo,taxa_periodo,alerta_dias')
      .eq('casa_id', ctx.profile.casa_id)
      .eq('nome', name)
      .maybeSingle();

    if (!result.error && result.data) return result.data;

    result = await ctx.client.from('estoque')
      .select('id,casa_id,nome,categoria,tipo,quantidade,unidade,minimo,nivel,minimo_nivel,local,critico,taxa_consumo,taxa_periodo,alerta_dias')
      .eq('casa_id', ctx.profile.casa_id);
    if (result.error) throw result.error;
    const normalized = normalizeName(name);
    const item = (result.data || []).find(candidate => normalizeName(candidate.nome) === normalized);
    if (!item) throw new Error('Item do estoque não encontrado.');
    return item;
  }

  async function adjustStock(button, direction) {
    const row = button.closest('#itensEstoque .item');
    if (!row) return;
    const item = await findStockForRow(row);
    if (S.busy.has(item.id)) return;
    S.busy.add(item.id);
    button.disabled = true;

    try {
      const current = Number(item.quantidade);
      if (!Number.isFinite(current)) throw new Error('A quantidade atual deste item é inválida.');

      let next;
      if (item.tipo === 'presenca') {
        next = direction > 0 ? 1 : 0;
      } else {
        next = Math.max(0, roundQuantity(current + direction * quantityStep(item)));
      }

      const ctx = context();
      const result = await ctx.client.from('estoque')
        .update({ quantidade: next, atualizado_por: ctx.profile.id, atualizado_em: new Date().toISOString() })
        .eq('id', item.id)
        .eq('casa_id', ctx.profile.casa_id)
        .select('id,nome,categoria,tipo,quantidade,unidade,minimo,nivel,minimo_nivel')
        .single();
      if (result.error || !result.data) throw result.error || new Error('Não foi possível atualizar o estoque.');

      const quantity = row.querySelector('.est-qtd');
      if (quantity) quantity.textContent = String(result.data.quantidade);

      await sincronizarItem(ctx.client, ctx.profile, result.data);
      ctx.client.from('eventos').insert({
        tipo: 'estoque_ajustado',
        entidade: 'estoque',
        entidade_id: item.id,
        usuario_id: ctx.profile.id,
        valor_anterior: { quantidade: item.quantidade },
        valor_novo: { quantidade: result.data.quantidade },
        detalhe: `${ctx.profile.nome} ajustou ${item.nome} para ${result.data.quantidade}`,
      });
    } finally {
      S.busy.delete(item.id);
      if (button.isConnected) button.disabled = false;
    }
  }

  async function deleteStock(button) {
    const row = button.closest('#itensEstoque .item');
    if (!row) return;
    const item = await findStockForRow(row);
    if (S.busy.has(item.id)) return;

    const accepted = await confirmAction({
      title: 'Excluir do estoque',
      message: `Excluir “${item.nome}” do estoque? Itens já criados na lista e em projetos serão preservados, apenas sem este vínculo.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!accepted) return;

    S.busy.add(item.id);
    button.disabled = true;
    try {
      const ctx = context();
      const result = await ctx.client.rpc('excluir_item_estoque', { p_estoque_id: item.id });
      if (result.error) throw result.error;
      row.remove();
      toast(`${item.nome} foi removido.`, 'ok');
    } finally {
      S.busy.delete(item.id);
      if (button.isConnected) button.disabled = false;
    }
  }

  function convertQuantity(value, fromUnit, toUnit) {
    const quantity = Number(value);
    if (!Number.isFinite(quantity) || quantity < 0) return null;
    const from = normalizeUnit(fromUnit);
    const to = normalizeUnit(toUnit);
    if (from === to) return roundQuantity(quantity);
    if (!from && !to) return roundQuantity(quantity);
    if ((from === 'un' || !from) && (to === 'un' || !to)) return roundQuantity(quantity);
    if (from === 'kg' && to === 'g') return roundQuantity(quantity * 1000);
    if (from === 'g' && to === 'kg') return roundQuantity(quantity / 1000);
    if (from === 'l' && to === 'ml') return roundQuantity(quantity * 1000);
    if (from === 'ml' && to === 'l') return roundQuantity(quantity / 1000);
    return null;
  }

  function conferenceTitle(sheet) {
    return sheet.querySelector('.ui-sheet-title')?.textContent?.trim() || '';
  }

  async function findConferenceData(sheet) {
    if (S.conference.has(sheet)) return S.conference.get(sheet);
    const ctx = context();
    if (!ctx) throw new Error('Sessão indisponível.');
    const name = conferenceTitle(sheet);
    if (!name) throw new Error('Não consegui identificar a compra em conferência.');

    const listResult = await ctx.client.from('lista_compras')
      .select('id,nome,quantidade,unidade,quantidade_comprada,unidade_comprada,estoque_id,comprado_em,aguardando_conferencia,status')
      .eq('casa_id', ctx.profile.casa_id)
      .eq('nome', name)
      .eq('status', 'comprado')
      .eq('aguardando_conferencia', true)
      .order('comprado_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (listResult.error || !listResult.data) throw listResult.error || new Error('Compra pendente de conferência não encontrada.');

    const item = listResult.data;
    if (!item.estoque_id) throw new Error('Esta compra não está mais vinculada a um item do estoque.');
    const stockResult = await ctx.client.from('estoque')
      .select('id,nome,tipo,quantidade,unidade,minimo,nivel,minimo_nivel,categoria')
      .eq('id', item.estoque_id)
      .eq('casa_id', ctx.profile.casa_id)
      .single();
    if (stockResult.error || !stockResult.data) throw stockResult.error || new Error('Item do estoque não encontrado.');

    const stock = stockResult.data;
    const boughtQuantity = item.quantidade_comprada ?? item.quantidade ?? 1;
    const boughtUnit = item.unidade_comprada ?? item.unidade ?? null;
    const converted = stock.tipo === 'presenca'
      ? 1
      : convertQuantity(boughtQuantity, boughtUnit, stock.unidade);
    const data = { item, stock, boughtQuantity, boughtUnit, converted };
    S.conference.set(sheet, data);
    return data;
  }

  async function decorateConferenceSheet(sheet) {
    if (!sheet || S.decoratingConference.has(sheet)) return;
    S.decoratingConference.add(sheet);
    try {
      const data = await findConferenceData(sheet);
      const input = sheet.querySelector('#uiConferenceQuantity');
      if (!input) return;

      const label = input.closest('.campo')?.querySelector('label');
      if (label) {
        label.textContent = data.stock.tipo === 'presenca'
          ? 'Depois desta compra'
          : `Quantidade que entra no estoque${data.stock.unidade ? ` (${data.stock.unidade})` : ''}`;
      }

      if (data.stock.tipo === 'presenca') {
        input.value = '1';
        input.min = '0';
        input.max = '1';
        input.step = '1';
      } else {
        input.step = String(quantityStep(data.stock));
        if (data.converted !== null) input.value = String(data.converted);
        else input.value = '';
      }

      let note = input.closest('.campo')?.querySelector('.stock-integrity-note');
      if (!note) {
        note = document.createElement('small');
        note.className = 'stock-integrity-note';
        note.style.cssText = 'display:block;margin-top:7px;color:var(--muted);font-size:11px;line-height:1.4';
        input.closest('.campo')?.appendChild(note);
      }
      const bought = `${data.boughtQuantity}${data.boughtUnit ? ` ${data.boughtUnit}` : ''}`;
      note.textContent = data.converted === null && data.stock.tipo !== 'presenca'
        ? `A compra foi registrada como ${bought}, mas o estoque usa ${data.stock.unidade || 'outra unidade'}. Informe acima quanto isso representa no estoque.`
        : `Compra registrada: ${bought}. O valor acima já está na unidade usada pelo estoque.`;
    } catch (error) {
      console.warn('[Estoque] Não foi possível preparar a conferência:', error);
    }
  }

  async function confirmConference(button) {
    const sheet = button.closest('.ui-sheet');
    if (!sheet) return;
    const data = await findConferenceData(sheet);
    const ctx = context();
    let quantity = null;
    let level = null;

    if (data.stock.tipo === 'nivel_visual') {
      level = sheet.querySelector('#uiConferenceLevel')?.value || null;
    } else if (data.stock.tipo === 'presenca') {
      const raw = Number(sheet.querySelector('#uiConferenceQuantity')?.value ?? 1);
      quantity = Number.isFinite(raw) && raw > 0 ? 1 : 0;
    } else {
      const raw = Number(sheet.querySelector('#uiConferenceQuantity')?.value);
      if (!Number.isFinite(raw) || raw < 0) {
        throw new Error(`Informe quanto deve entrar no estoque${data.stock.unidade ? ` em ${data.stock.unidade}` : ''}.`);
      }
      quantity = roundQuantity(raw);
    }

    button.disabled = true;
    const result = await ctx.client.rpc('confirmar_reposicao_estoque', {
      p_lista_id: data.item.id,
      p_quantidade: quantity,
      p_nivel: level,
    });
    if (result.error) {
      button.disabled = false;
      throw result.error;
    }

    const updated = await ctx.client.from('estoque')
      .select('id,nome,categoria,tipo,quantidade,unidade,minimo,nivel,minimo_nivel')
      .eq('id', data.stock.id)
      .single();
    if (updated.data) await sincronizarItem(ctx.client, ctx.profile, updated.data);

    sheet.querySelector('.ui-sheet-close')?.click();
    toast('Estoque atualizado.', 'ok');
  }

  async function decorateInventory() {
    const root = document.getElementById('invItens');
    if (!root || !root.children.length) return;
    const ctx = context();
    if (!ctx) return;
    const result = await ctx.client.from('estoque')
      .select('id,nome,tipo,quantidade,unidade')
      .eq('casa_id', ctx.profile.casa_id);
    if (result.error) return;
    const byName = new Map((result.data || []).map(item => [normalizeName(item.nome), item]));

    [...root.children].forEach(block => {
      const name = block.querySelector('.nome')?.textContent?.trim() || '';
      const item = byName.get(normalizeName(name));
      const input = block.querySelector('input[type="number"]');
      if (!item || !input) return;
      input.step = String(quantityStep(item));
      if (item.tipo === 'presenca') {
        input.min = '0';
        input.max = '1';
        input.step = '1';
        input.value = Number(item.quantidade) > 0 ? '1' : '0';
      }
    });
  }

  function scheduleInventoryDecoration() {
    window.clearTimeout(S.inventoryTimer);
    S.inventoryTimer = window.setTimeout(() => decorateInventory().catch(() => {}), 60);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('#itensEstoque .est-controles button');
    if (button) {
      const label = String(button.textContent || '').trim();
      const isDelete = button.dataset.uiAction === 'delete' || /excluir/i.test(button.getAttribute('aria-label') || '');
      if (label === '+' || label === '−' || label === '-') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        adjustStock(button, label === '+' ? 1 : -1).catch(error => toast(error.message || 'Não foi possível atualizar o estoque.', 'erro'));
        return;
      }
      if (isDelete) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        deleteStock(button).catch(error => toast(error.message || 'Não foi possível excluir o item.', 'erro'));
        return;
      }
    }

    const conference = event.target.closest?.('#uiConferenceConfirm');
    if (conference) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      confirmConference(conference).catch(error => {
        conference.disabled = false;
        toast(error.message || 'Não foi possível atualizar o estoque.', 'erro');
      });
      return;
    }

    if (event.target.closest?.('#btnIniciarInventario')) scheduleInventoryDecoration();
  }, true);

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const sheet = node.matches?.('.ui-sheet-overlay') ? node.querySelector('.ui-sheet') : node.querySelector?.('.ui-sheet');
        if (sheet?.querySelector('#uiConferenceConfirm')) decorateConferenceSheet(sheet);
        if (node.id === 'invItens' || node.querySelector?.('#invItens')) scheduleInventoryDecoration();
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.lifeosStockIntegrity = Object.freeze({
    quantityStep,
    convertQuantity,
  });
})();
