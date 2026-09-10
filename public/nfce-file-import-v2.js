// LifeOS — NFC-e por arquivo v2
// PDFs salvos da página oficial são lidos como texto no backend do LifeOS.
// Prints/imagens continuam no fallback OCR existente.

(() => {
  'use strict';

  let contentObserver = null;
  let processing = false;

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function money(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '—';
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
    const stop = new Set(['de','da','do','das','dos','com','para','em','a','o','e','un','und','kg','g','ml','l']);
    return normalize(value).split(' ').filter(token => token.length > 1 && !stop.has(token));
  }

  const MODIFIERS = ['grego','integral','zero','light','diet','lactose','desnatado','semidesnatado','tradicional'];

  function modifierSet(value) {
    const text = normalize(value);
    return new Set(MODIFIERS.filter(modifier => text.includes(modifier)));
  }

  function modifiersCompatible(a, b) {
    const ma = modifierSet(a), mb = modifierSet(b);
    if (!ma.size && !mb.size) return true;
    if (ma.size !== mb.size) return false;
    return [...ma].every(item => mb.has(item));
  }

  function tokenMatch(a, b) {
    if (a === b) return true;
    if (Math.min(a.length, b.length) < 3) return false;
    return a.startsWith(b) || b.startsWith(a);
  }

  function similarity(a, b) {
    if (!modifiersCompatible(a, b)) return 0;
    const ta = tokens(a), tb = tokens(b);
    if (!ta.length || !tb.length) return 0;
    let matches = 0;
    for (const left of ta) if (tb.some(right => tokenMatch(left, right))) matches += 1;
    const coverageA = matches / ta.length;
    const coverageB = tb.filter(right => ta.some(left => tokenMatch(left, right))).length / tb.length;
    const first = tokenMatch(ta[0], tb[0]) ? 0.12 : 0;
    return Math.min(1, coverageA * 0.42 + coverageB * 0.46 + first);
  }

  async function context() {
    const ctx = window.lifeosContext;
    if (!ctx?.supa || !ctx?.usuario) throw new Error('Sessão do LifeOS indisponível.');
    const { data } = await ctx.supa.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error('Faça login novamente para continuar.');
    return { client: ctx.supa, profile: ctx.usuario, token };
  }

  function status(message, error = false) {
    const node = document.querySelector('.nfce-overlay .nfce-browser-status, .nfce-overlay .nfce-status');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', error);
  }

  function enhanceBlockedCopy() {
    const content = document.querySelector('.nfce-overlay #nfceContent');
    if (!content) return;
    const fileButton = content.querySelector('[data-nfb-file-button]');
    if (!fileButton) return;
    fileButton.textContent = 'Importar PDF da SEFAZ ou print';
    fileButton.classList.remove('secondary');
    fileButton.classList.add('primary');
    const browserButton = content.querySelector('[data-nfb-browser]');
    if (browserButton) {
      browserButton.textContent = 'Tentar leitura direta (pode ser bloqueada)';
      browserButton.classList.remove('primary');
      browserButton.classList.add('secondary');
    }
    const note = [...content.querySelectorAll('p')].find(node => /arquivo é lido no próprio aparelho/i.test(node.textContent || ''));
    if (note) note.textContent = 'PDF: o LifeOS lê o texto temporariamente e não guarda o arquivo. Print: a leitura visual continua no aparelho.';
  }

  function attachContentObserver(overlay) {
    contentObserver?.disconnect();
    const content = overlay.querySelector('#nfceContent');
    if (!content) return;
    enhanceBlockedCopy();
    contentObserver = new MutationObserver(enhanceBlockedCopy);
    contentObserver.observe(content, { childList: true });
  }

  function bestMatches(rows, pending) {
    const used = new Set();
    return rows.map(row => {
      const candidates = pending
        .filter(item => !used.has(item.id))
        .map(item => ({ item, score: similarity(row.nome, item.nome) }))
        .sort((a, b) => b.score - a.score);
      const best = candidates[0];
      const second = candidates[1];
      const safe = best && best.score >= 0.62 && (!second || best.score - second.score >= 0.10);
      if (!safe) return { ...row, _match: null };
      used.add(best.item.id);
      return { ...row, _match: best };
    });
  }

  async function prepareReview(note) {
    const { client, profile } = await context();
    const pendingResult = await client.from('lista_compras')
      .select('id,nome,quantidade,unidade,quantidade_planejada,unidade_planejada,estoque_id')
      .eq('casa_id', profile.casa_id)
      .eq('status', 'pendente');
    if (pendingResult.error) throw pendingResult.error;
    const rows = bestMatches(note.itens || [], pendingResult.data || []);
    renderReview(note, rows);
  }

  function renderReview(note, rows) {
    const content = document.querySelector('.nfce-overlay #nfceContent');
    if (!content) throw new Error('Leitor da nota não está aberto.');
    const declared = Number(note.quantidade_itens_declarada || 0);
    const countText = declared && declared !== rows.length ? `${rows.length} lidos de ${declared} declarados` : `${rows.length} itens`;
    content.innerHTML = `
      <div class="nfce-note-card"><strong>${esc(note.emitente || 'NFC-e identificada')}</strong><small>${countText} · ${money(note.total)}${note.emissao ? ` · ${esc(note.emissao)}` : ''}</small></div>
      <div class="nfce-browser-status">O PDF tem texto selecionável e foi lido sem OCR. Confira as associações antes de aplicar.</div>
      <div class="nfce-list">${rows.map((row, index) => `<label class="nfce-item"><input type="checkbox" data-nff-row="${index}" checked><span><strong>${esc(row.nome)}</strong><small>${esc(`${row.quantidade ?? '—'} ${row.unidade || ''}`.trim())} · ${money(row.valor_unitario)}/un.</small><small class="nfce-match">${row._match ? `Lista: ${esc(row._match.item.nome)}` : 'Novo item no carrinho'}</small></span><span class="nfce-price">${money(row.valor_total)}</span></label>`).join('')}</div>
      <div class="nfce-footer"><button type="button" class="nfce-btn primary" style="width:100%" data-nff-apply>Aplicar ao carrinho</button><button type="button" class="nfce-btn ghost" style="width:100%;margin-top:8px" data-nff-other>Ler outra nota</button></div>`;

    content.querySelector('[data-nff-other]').addEventListener('click', () => window.lifeosAbrirNfce?.());
    content.querySelector('[data-nff-apply]').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'Aplicando…';
      try {
        const selected = rows.filter((row, index) => content.querySelector(`[data-nff-row="${index}"]`)?.checked);
        if (!selected.length) throw new Error('Selecione pelo menos um item.');
        await apply(selected, note);
        document.querySelector('.nfce-overlay')?.remove();
        window.dispatchEvent(new CustomEvent('lifeos:nfce-file-applied'));
        window.dispatchEvent(new CustomEvent('lifeos:nfce-browser-applied'));
        window.lifeosToast?.(`${selected.length} ${selected.length === 1 ? 'item foi aplicado' : 'itens foram aplicados'} ao carrinho.`, 'ok');
        window.lifeosRefreshMarketLive?.();
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Aplicar ao carrinho';
        status(error.message || 'Não foi possível aplicar a nota.', true);
      }
    });
  }

  async function apply(rows, note) {
    const { client, profile } = await context();
    const destinationResult = await client.from('compra_destinos')
      .select('id,nome,entra_lista_mercado,padrao,ativo,ordem')
      .eq('casa_id', profile.casa_id)
      .eq('ativo', true)
      .eq('entra_lista_mercado', true)
      .order('padrao', { ascending: false })
      .order('ordem')
      .limit(1)
      .maybeSingle();
    if (destinationResult.error) throw destinationResult.error;
    const destination = destinationResult.data || null;

    for (const row of rows) {
      const qty = Number(row.quantidade) > 0 ? Number(row.quantidade) : 1;
      const unit = String(row.unidade || 'un').trim() || 'un';
      const unitPrice = row.valor_unitario == null ? null : Number(row.valor_unitario);
      const lineTotal = row.valor_total == null ? null : Number(row.valor_total);
      const observation = `NFC-e PDF${note.chave ? ` ${note.chave}` : ''}: ${qty} ${unit}; total ${money(lineTotal)}`;

      if (row._match?.item?.id) {
        const current = row._match.item;
        const update = await client.from('lista_compras').update({
          quantidade_planejada: current.quantidade_planejada ?? current.quantidade,
          unidade_planejada: current.unidade_planejada ?? current.unidade,
          quantidade_comprada: qty,
          unidade_comprada: unit,
          preco_unitario_compra: unitPrice,
          preco_compra: lineTotal,
          no_carrinho: true,
          compra_observacao: observation,
        }).eq('id', current.id).eq('casa_id', profile.casa_id);
        if (update.error) throw update.error;
      } else {
        const insert = await client.from('lista_compras').insert({
          casa_id: profile.casa_id,
          nome: row.nome,
          quantidade: qty,
          unidade: unit,
          quantidade_comprada: qty,
          unidade_comprada: unit,
          preco_unitario_compra: unitPrice,
          preco_compra: lineTotal,
          status: 'pendente',
          origem: 'nfce',
          criado_por: profile.id,
          no_carrinho: true,
          compra_observacao: observation,
          destino_compra_id: destination?.id || null,
          categoria: 'mercado',
        });
        if (insert.error) throw insert.error;
      }
    }
  }

  async function processPdf(file) {
    if (processing) return;
    processing = true;
    try {
      status('Lendo o texto do PDF da SEFAZ…');
      const { token } = await context();
      const response = await fetch('/api/nfce/analisar-pdf', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/pdf',
          'X-LifeOS-Arquivo': encodeURIComponent(file.name || 'nfce.pdf'),
        },
        body: file,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.erro || 'Não foi possível ler o PDF.');
      if (!payload.nota?.itens?.length) throw new Error('O PDF foi lido, mas não encontrei produtos.');
      await prepareReview(payload.nota);
    } catch (error) {
      status(error.message || 'Não foi possível ler esse PDF.', true);
      const button = document.querySelector('.nfce-overlay [data-nfb-file-button]');
      if (button) button.disabled = false;
    } finally {
      processing = false;
    }
  }

  document.addEventListener('change', event => {
    const input = event.target.closest?.('[data-nfb-file]');
    if (!input) return;
    const file = input.files?.[0];
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if (!isPdf) return;
    // Intercepta somente PDF. Print/foto continua pertencendo ao fallback OCR atual.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    processPdf(file).finally(() => { input.value = ''; });
  }, true);

  const bodyObserver = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement) || !node.matches?.('.nfce-overlay')) continue;
        window.setTimeout(() => attachContentObserver(node), 0);
      }
    }
  });
  if (document.body) bodyObserver.observe(document.body, { childList: true });
  else document.addEventListener('DOMContentLoaded', () => bodyObserver.observe(document.body, { childList: true }), { once: true });
  const current = document.querySelector('.nfce-overlay');
  if (current) attachContentObserver(current);
})();
