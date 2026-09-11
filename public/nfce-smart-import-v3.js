// LifeOS — NFC-e inteligente v3
// Nota fiscal = compra já realizada. O fluxo reconhece produtos por biblioteca
// fiscal, preserva a descrição original e registra a compra diretamente no
// histórico/conferência de estoque, sem voltar para o carrinho pendente.

(() => {
  'use strict';

  let processing = false;
  let contentObserver = null;

  const MODIFIERS = ['grego','integral','zero','light','diet','lactose','desnatado','semidesnatado','tradicional'];

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function normalize(value = '') {
    return String(value)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function tokens(value = '') {
    const stop = new Set(['de','da','do','das','dos','com','para','em','a','o','e','un','und','kg','g','ml','l','pc','pt','fr']);
    return normalize(value).split(' ').filter(token => token.length > 1 && !stop.has(token));
  }

  function modifierSet(value) {
    const text = normalize(value);
    return new Set(MODIFIERS.filter(modifier => text.includes(modifier)));
  }

  function compatibleModifiers(a, b) {
    const left = modifierSet(a), right = modifierSet(b);
    if (!left.size && !right.size) return true;
    if (left.size !== right.size) return false;
    return [...left].every(item => right.has(item));
  }

  function tokenMatch(a, b) {
    if (a === b) return true;
    if (Math.min(a.length, b.length) < 3) return false;
    return a.startsWith(b) || b.startsWith(a);
  }

  function similarity(a, b) {
    if (!compatibleModifiers(a, b)) return 0;
    const ta = tokens(a), tb = tokens(b);
    if (!ta.length || !tb.length) return 0;
    const ma = ta.filter(left => tb.some(right => tokenMatch(left, right))).length;
    const mb = tb.filter(right => ta.some(left => tokenMatch(left, right))).length;
    const first = tokenMatch(ta[0], tb[0]) ? 0.12 : 0;
    return Math.min(1, (ma / ta.length) * 0.42 + (mb / tb.length) * 0.46 + first);
  }

  function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
  }

  function round(value) {
    return Math.round(Number(value || 0) * 1000) / 1000;
  }

  function fiscalUnit(value = '') {
    const raw = String(value || '').trim().toUpperCase();
    const map = { UN:'un', UND:'un', UNID:'un', KG:'kg', G:'g', L:'L', LT:'L', ML:'ml', PC:'pacote', PCT:'pacote', PT:'pote', FR:'frasco', BD:'bandeja' };
    return map[raw] || raw.toLowerCase() || 'un';
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
    if (fileButton) {
      fileButton.textContent = 'Importar PDF da SEFAZ ou print';
      fileButton.classList.remove('secondary');
      fileButton.classList.add('primary');
    }
    const browserButton = content.querySelector('[data-nfb-browser]');
    if (browserButton) {
      browserButton.textContent = 'Tentar leitura direta (pode ser bloqueada)';
      browserButton.classList.remove('primary');
      browserButton.classList.add('secondary');
    }
  }

  function attachContentObserver(overlay) {
    contentObserver?.disconnect();
    const content = overlay.querySelector('#nfceContent');
    if (!content) return;
    enhanceBlockedCopy();
    contentObserver = new MutationObserver(enhanceBlockedCopy);
    contentObserver.observe(content, { childList: true });
  }

  async function fetchKnowledge(note) {
    const { client, profile } = await context();
    const [mappingResult, pendingResult, stockResult, duplicateResult] = await Promise.all([
      client.from('nfce_produto_mapeamentos')
        .select('id,emitente_cnpj,codigo_fiscal,descricao_fiscal,nome_canonico,estoque_id,categoria,acao_estoque,fator_quantidade,unidade_estoque,confirmado')
        .eq('casa_id', profile.casa_id),
      client.from('lista_compras')
        .select('id,nome,quantidade,unidade,quantidade_planejada,unidade_planejada,estoque_id')
        .eq('casa_id', profile.casa_id).eq('status', 'pendente'),
      client.from('estoque')
        .select('id,nome,unidade,categoria,tipo')
        .eq('casa_id', profile.casa_id),
      note.chave
        ? client.from('compras_sessoes').select('id').eq('casa_id', profile.casa_id).eq('origem', 'nfce').eq('origem_externa_id', note.chave).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (mappingResult.error) throw mappingResult.error;
    if (pendingResult.error) throw pendingResult.error;
    if (stockResult.error) throw stockResult.error;
    if (duplicateResult.error) throw duplicateResult.error;
    return {
      mappings: mappingResult.data || [], pending: pendingResult.data || [], stocks: stockResult.data || [],
      duplicateSessionId: duplicateResult.data?.id || null,
    };
  }

  function exactMapping(row, note, mappings) {
    const cnpj = String(note.cnpj || '').replace(/\D/g, '');
    const code = String(row.codigo || '').trim();
    if (code) {
      const byCode = mappings.find(item => String(item.codigo_fiscal || '') === code
        && (!item.emitente_cnpj || String(item.emitente_cnpj).replace(/\D/g, '') === cnpj));
      if (byCode) return byCode;
    }
    const desc = normalize(row.nome);
    return mappings.find(item => normalize(item.descricao_fiscal) === desc
      && (!item.emitente_cnpj || String(item.emitente_cnpj).replace(/\D/g, '') === cnpj)) || null;
  }

  function bestCandidate(name, candidates, used = new Set()) {
    const ranked = candidates
      .filter(item => !used.has(item.id))
      .map(item => ({ item, score: similarity(name, item.nome) }))
      .sort((a, b) => b.score - a.score);
    const first = ranked[0], second = ranked[1];
    return first && first.score >= 0.64 && (!second || first.score - second.score >= 0.10) ? first : null;
  }

  function resolveRows(note, knowledge) {
    const usedPending = new Set();
    return (note.itens || []).map((row, index) => {
      const mapping = exactMapping(row, note, knowledge.mappings);
      let canonical = mapping?.nome_canonico || null;
      let stock = mapping?.estoque_id ? knowledge.stocks.find(item => item.id === mapping.estoque_id) || null : null;
      let pending = null;
      let learnedFrom = mapping ? 'biblioteca' : null;

      if (canonical) {
        const exactPending = knowledge.pending.find(item => !usedPending.has(item.id) && normalize(item.nome) === normalize(canonical));
        const candidate = exactPending ? { item: exactPending, score: 1 } : bestCandidate(canonical, knowledge.pending, usedPending);
        if (candidate) { pending = candidate.item; usedPending.add(pending.id); }
        if (!stock) stock = knowledge.stocks.find(item => normalize(item.nome) === normalize(canonical)) || null;
      } else {
        const pendingCandidate = bestCandidate(row.nome, knowledge.pending, usedPending);
        if (pendingCandidate) {
          pending = pendingCandidate.item;
          usedPending.add(pending.id);
          canonical = pending.nome;
          learnedFrom = 'lista';
          stock = pending.estoque_id ? knowledge.stocks.find(item => item.id === pending.estoque_id) || null : null;
        }
        if (!canonical) {
          const stockCandidate = bestCandidate(row.nome, knowledge.stocks);
          if (stockCandidate) {
            stock = stockCandidate.item;
            canonical = stock.nome;
            learnedFrom = 'estoque';
          }
        }
      }

      const qFiscal = Number(row.quantidade) > 0 ? Number(row.quantidade) : 1;
      const uFiscal = fiscalUnit(row.unidade);
      const factor = Number(mapping?.fator_quantidade || 1) > 0 ? Number(mapping.fator_quantidade) : 1;
      const qStock = round(qFiscal * factor);
      const uStock = mapping?.unidade_estoque || stock?.unidade || uFiscal;
      const resolved = Boolean(canonical && (mapping?.confirmado !== false || learnedFrom));

      return {
        ...row, _index: index, _mapping: mapping, _pending: pending, _stock: stock,
        _canonical: canonical || row.nome, _resolved: resolved,
        _learn: !mapping && Boolean(learnedFrom), _learnedFrom: learnedFrom,
        _action: mapping?.acao_estoque || 'conferir', _category: mapping?.categoria || stock?.categoria || 'mercado',
        _fiscalQty: qFiscal, _fiscalUnit: uFiscal, _stockQty: qStock, _stockUnit: uStock,
      };
    });
  }

  async function saveLearning(rows, note) {
    const { client, profile } = await context();
    const cnpj = String(note.cnpj || '').replace(/\D/g, '') || null;
    for (const row of rows) {
      const inputName = String(row._canonical || '').trim();
      if (!inputName) continue;
      const shouldLearn = row._learn || row._edited || (!row._mapping && row._resolved);
      if (!shouldLearn) continue;
      const payload = {
        casa_id: profile.casa_id,
        emitente_cnpj: cnpj,
        codigo_fiscal: String(row.codigo || '').trim() || null,
        descricao_fiscal: row.nome,
        nome_canonico: inputName,
        estoque_id: row._stock?.id || null,
        categoria: row._category || 'mercado',
        acao_estoque: row._action || 'conferir',
        fator_quantidade: row._fiscalQty > 0 ? round(row._stockQty / row._fiscalQty) : 1,
        unidade_estoque: row._stockUnit || row._fiscalUnit,
        confirmado: true,
        criado_por: profile.id,
        atualizado_em: new Date().toISOString(),
      };
      let existing = null;
      if (payload.codigo_fiscal) {
        const result = await client.from('nfce_produto_mapeamentos').select('id')
          .eq('casa_id', profile.casa_id).eq('codigo_fiscal', payload.codigo_fiscal)
          .eq('emitente_cnpj', cnpj).maybeSingle();
        if (result.error) throw result.error;
        existing = result.data;
      }
      if (!existing) {
        const result = await client.from('nfce_produto_mapeamentos').select('id')
          .eq('casa_id', profile.casa_id).eq('descricao_fiscal', row.nome)
          .eq('emitente_cnpj', cnpj).maybeSingle();
        if (result.error) throw result.error;
        existing = result.data;
      }
      const write = existing?.id
        ? await client.from('nfce_produto_mapeamentos').update(payload).eq('id', existing.id)
        : await client.from('nfce_produto_mapeamentos').insert(payload);
      if (write.error) throw write.error;
    }
  }

  function renderReview(note, rows) {
    const content = document.querySelector('.nfce-overlay #nfceContent');
    if (!content) throw new Error('Leitor da nota não está aberto.');
    const unresolved = rows.filter(row => !row._resolved).length;
    const declared = Number(note.quantidade_itens_declarada || 0);
    const count = declared && declared !== rows.length ? `${rows.length} lidos de ${declared}` : `${rows.length} itens`;
    content.innerHTML = `
      <div class="nfce-note-card"><strong>${esc(note.emitente || 'NFC-e identificada')}</strong><small>${count} · ${money(note.total)}${note.desconto ? ` · desconto ${money(note.desconto)}` : ''}</small></div>
      <div class="nfce-browser-status">Compra já realizada: revise como o LifeOS entendeu os nomes. ${unresolved ? `${unresolved} ${unresolved === 1 ? 'item ainda precisa' : 'itens ainda precisam'} de revisão.` : 'Todos os itens foram reconhecidos.'}</div>
      <div class="nfs3-list">${rows.map((row, index) => `
        <article class="nfs3-item${row._resolved ? '' : ' unresolved'}" data-nfs3-row="${index}">
          <label class="nfs3-check"><input type="checkbox" data-nfs3-enabled checked><span></span></label>
          <div class="nfs3-main">
            <small class="nfs3-raw">Nota: ${esc(row.nome)}${row.codigo ? ` · cód. ${esc(row.codigo)}` : ''}</small>
            <input class="nfs3-name" data-nfs3-name value="${esc(row._canonical)}" aria-label="Nome entendido pelo LifeOS">
            <small>${esc(`${row._fiscalQty} ${row._fiscalUnit}`)} · ${money(row.valor_unitario)}/un. · total ${money(row.valor_total)}</small>
            <small class="nfs3-match">${row._mapping ? 'Aprendido pela biblioteca' : row._pending ? `Ligado à lista: ${esc(row._pending.nome)}` : row._stock ? `Ligado ao estoque: ${esc(row._stock.nome)}` : 'Nome ainda não aprendido'}</small>
          </div>
          <select data-nfs3-action aria-label="Tratamento no estoque"><option value="conferir" ${row._action === 'conferir' ? 'selected' : ''}>Conferir estoque</option><option value="ignorar" ${row._action === 'ignorar' ? 'selected' : ''}>Não controlar</option></select>
        </article>`).join('')}</div>
      <div class="nfce-footer"><button type="button" class="nfce-btn primary" style="width:100%" data-nfs3-register>Registrar compra</button><button type="button" class="nfce-btn ghost" style="width:100%;margin-top:8px" data-nfs3-other>Ler outra nota</button></div>`;

    content.querySelectorAll('[data-nfs3-row]').forEach((node, index) => {
      const row = rows[index];
      const name = node.querySelector('[data-nfs3-name]');
      const action = node.querySelector('[data-nfs3-action]');
      name.addEventListener('input', () => {
        row._canonical = name.value.trim(); row._edited = true; row._resolved = Boolean(row._canonical);
        node.classList.toggle('unresolved', !row._resolved);
      });
      action.addEventListener('change', () => { row._action = action.value; row._edited = true; });
    });

    content.querySelector('[data-nfs3-other]').addEventListener('click', () => window.lifeosAbrirNfce?.());
    content.querySelector('[data-nfs3-register]').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true; button.textContent = 'Registrando…';
      try {
        const selected = rows.filter((row, index) => content.querySelector(`[data-nfs3-row="${index}"] [data-nfs3-enabled]`)?.checked);
        if (!selected.length) throw new Error('Selecione pelo menos um item.');
        selected.forEach(row => {
          const input = content.querySelector(`[data-nfs3-row="${row._index}"] [data-nfs3-name]`);
          row._canonical = input?.value.trim() || row.nome;
          row._action = content.querySelector(`[data-nfs3-row="${row._index}"] [data-nfs3-action]`)?.value || row._action;
        });
        await saveLearning(selected, note);
        const { client } = await context();
        const payload = selected.map(row => ({
          lista_compra_id: row._pending?.id || null,
          estoque_id: row._stock?.id || null,
          codigo_fiscal: row.codigo || null,
          descricao_fiscal: row.nome,
          nome_canonico: row._canonical,
          quantidade_fiscal: row._fiscalQty,
          unidade_fiscal: row._fiscalUnit,
          quantidade_estoque: row._stockQty,
          unidade_estoque: row._stockUnit,
          preco_unitario: row.valor_unitario == null ? null : Number(row.valor_unitario),
          preco_total: row.valor_total == null ? null : Number(row.valor_total),
          acao_estoque: row._action,
          categoria: row._category,
        }));
        const result = await client.rpc('registrar_compra_nfce_v3', {
          p_chave: note.chave,
          p_emitente: note.emitente,
          p_cnpj: note.cnpj,
          p_emissao: note.emissao,
          p_total: note.total,
          p_total_bruto: note.total_itens_bruto,
          p_desconto: note.desconto,
          p_itens: payload,
        });
        if (result.error) throw result.error;
        document.querySelector('.nfce-overlay')?.remove();
        window.lifeosToast?.(`Compra registrada: ${selected.length} itens. Agora é só conferir o que entra no estoque.`, 'ok');
        window.dispatchEvent(new CustomEvent('lifeos:nfce-purchase-registered', { detail: { sessionId: result.data } }));
        window.dispatchEvent(new CustomEvent('lifeos:shopping-list-changed'));
      } catch (error) {
        button.disabled = false; button.textContent = 'Registrar compra';
        status(error.message || 'Não foi possível registrar a compra.', true);
      }
    });
  }

  async function prepareReview(note) {
    const knowledge = await fetchKnowledge(note);
    const content = document.querySelector('.nfce-overlay #nfceContent');
    if (knowledge.duplicateSessionId) {
      if (content) content.innerHTML = `<div class="nfce-note-card"><strong>Esta NFC-e já foi registrada.</strong><small>O LifeOS reconheceu a chave fiscal e não vai duplicar a compra.</small></div><button type="button" class="nfce-btn ghost" style="width:100%" data-nfs3-other>Ler outra nota</button>`;
      content?.querySelector('[data-nfs3-other]')?.addEventListener('click', () => window.lifeosAbrirNfce?.());
      return;
    }
    renderReview(note, resolveRows(note, knowledge));
  }

  async function processPdf(file) {
    if (processing) return;
    processing = true;
    try {
      status('Lendo o texto e reconhecendo os produtos…');
      const { token } = await context();
      const response = await fetch('/api/nfce/analisar-pdf', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf', 'X-LifeOS-Arquivo': encodeURIComponent(file.name || 'nfce.pdf') },
        body: file,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.erro || 'Não foi possível ler o PDF.');
      if (!data.nota?.itens?.length) throw new Error('O PDF foi lido, mas não encontrei produtos.');
      if (data.nota.quantidade_itens_declarada && Number(data.nota.quantidade_itens_declarada) !== data.nota.itens.length) {
        throw new Error(`A nota declara ${data.nota.quantidade_itens_declarada} itens, mas consegui ler ${data.nota.itens.length}. Não vou importar uma compra incompleta.`);
      }
      await prepareReview(data.nota);
    } catch (error) {
      status(error.message || 'Não foi possível ler esse PDF.', true);
      const button = document.querySelector('.nfce-overlay [data-nfb-file-button]');
      if (button) button.disabled = false;
    } finally { processing = false; }
  }

  function styles() {
    if (document.getElementById('nfceSmartV3Styles')) return;
    const style = document.createElement('style');
    style.id = 'nfceSmartV3Styles';
    style.textContent = `.nfs3-list{display:grid;gap:9px;margin:12px 0}.nfs3-item{display:grid;grid-template-columns:24px minmax(0,1fr);gap:8px;padding:11px;border:1px solid var(--linha,#ddd);border-radius:13px;background:var(--paper,#fff)}.nfs3-item.unresolved{border-color:#c8913d;background:#fffaf0}.nfs3-main{min-width:0}.nfs3-raw{display:block;color:var(--muted,#667);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nfs3-name{width:100%;border:0;border-bottom:1px solid var(--linha,#ddd);background:transparent;color:var(--texto,#172018);font-weight:800;font-size:14px;padding:5px 0;margin:2px 0 5px}.nfs3-main>small{display:block;color:var(--muted,#667);font-size:10px;line-height:1.35}.nfs3-main .nfs3-match{color:var(--sage,#47745b);margin-top:3px}.nfs3-check input{width:19px;height:19px;accent-color:var(--sage,#47745b)}.nfs3-item>select{grid-column:2;min-height:34px;border:1px solid var(--linha,#ddd);border-radius:9px;background:var(--bg,#f4f3ef);color:var(--texto,#172018);font-size:11px;padding:6px 8px}`;
    document.head.appendChild(style);
  }

  document.addEventListener('change', event => {
    const input = event.target.closest?.('[data-nfb-file]');
    if (!input) return;
    const file = input.files?.[0];
    if (!file || !(file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''))) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    processPdf(file).finally(() => { input.value = ''; });
  }, true);

  const bodyObserver = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node instanceof HTMLElement && node.matches?.('.nfce-overlay')) window.setTimeout(() => attachContentObserver(node), 0);
    }
  });

  styles();
  if (document.body) bodyObserver.observe(document.body, { childList: true });
  else document.addEventListener('DOMContentLoaded', () => bodyObserver.observe(document.body, { childList: true }), { once: true });
  const current = document.querySelector('.nfce-overlay'); if (current) attachContentObserver(current);
})();
