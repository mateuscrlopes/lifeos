// LifeOS — Histórico dos Acertos
// Complementa a Central Financeira sem duplicar a lógica de pagamentos:
// lê os mesmos acertos/lotes e usa os mesmos endpoints privados de comprovante/recibo.

(() => {
  'use strict';

  const H = {
    client: null,
    profile: null,
    users: [],
    acertos: [],
    payments: [],
    lots: [],
    lotItems: [],
    transactions: [],
    mode: 'month',
    month: localMonth(new Date()),
    year: new Date().getFullYear(),
    loading: false,
    mountTimer: null,
  };

  function localMonth(value) {
    const d = value instanceof Date ? value : new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function money(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  function dateBr(value, withTime = false) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('pt-BR', withTime
      ? { dateStyle: 'short', timeStyle: 'short' }
      : { dateStyle: 'short' });
  }

  function context() {
    const ctx = window.lifeosContext;
    if (!ctx?.supa || !ctx?.usuario) return false;
    H.client = ctx.supa;
    H.profile = ctx.usuario;
    return true;
  }

  function userName(id) {
    return H.users.find(user => user.id === id)?.nome || 'Pessoa';
  }

  function transactionDate(tx) {
    return new Date(tx.date);
  }

  function normalizeTransactions() {
    const acertoMap = new Map(H.acertos.map(item => [item.id, item]));
    const byLot = new Map();
    for (const item of H.lotItems) {
      if (!byLot.has(item.lote_id)) byLot.set(item.lote_id, []);
      byLot.get(item.lote_id).push(item);
    }

    const legacy = H.payments
      .filter(payment => payment.status === 'aprovado')
      .map(payment => {
        const acerto = acertoMap.get(payment.acerto_id);
        if (!acerto) return null;
        return {
          key: `payment:${payment.id}`,
          kind: 'payment',
          id: payment.id,
          payerId: acerto.devedor_id,
          receiverId: acerto.credor_id,
          value: Number(payment.valor_informado || payment.valor_extraido || 0),
          date: payment.revisado_em || payment.pago_em_extraido || payment.enviado_em,
          title: acerto.titulo || 'Acerto',
          proof: Boolean(payment.comprovante_path),
          receipt: true,
          items: [{
            title: acerto.titulo || 'Acerto',
            amount: Number(payment.valor_informado || 0),
            installment: Number(acerto.parcelas_total || 1) > 1
              ? `${acerto.parcela_numero}/${acerto.parcelas_total}`
              : null,
          }],
        };
      })
      .filter(Boolean);

    const lots = H.lots
      .filter(lot => lot.status === 'aprovado')
      .map(lot => {
        const items = [...(byLot.get(lot.id) || [])]
          .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
          .map(item => {
            const acerto = acertoMap.get(item.acerto_id);
            return {
              title: acerto?.titulo || 'Cobrança',
              amount: Number(item.valor_aplicado || item.valor_previsto || 0),
              installment: acerto && Number(acerto.parcelas_total || 1) > 1
                ? `${acerto.parcela_numero}/${acerto.parcelas_total}`
                : null,
            };
          });
        return {
          key: `lot:${lot.id}`,
          kind: 'lot',
          id: lot.id,
          payerId: lot.devedor_id,
          receiverId: lot.credor_id,
          value: Number(lot.valor_confirmado ?? lot.valor_informado ?? lot.valor_selecionado ?? 0),
          date: lot.revisado_em || lot.pago_em_extraido || lot.enviado_em,
          title: items.length === 1 ? items[0].title : `Pagamento de ${items.length} cobranças`,
          proof: Boolean(lot.comprovante_path),
          receipt: true,
          credit: Number(lot.saldo_gerado || 0),
          items,
        };
      });

    H.transactions = [...legacy, ...lots]
      .filter(tx => tx.date && Number.isFinite(tx.value) && tx.value > 0)
      .sort((a, b) => transactionDate(b) - transactionDate(a));
  }

  async function load() {
    if (H.loading || !context()) return;
    H.loading = true;
    try {
      const [users, acertos, payments, lots] = await Promise.all([
        H.client.from('usuarios').select('id,nome,casa_id').eq('casa_id', H.profile.casa_id).order('nome'),
        H.client.from('acertos').select('id,casa_id,titulo,devedor_id,credor_id,parcela_numero,parcelas_total,status').eq('casa_id', H.profile.casa_id),
        H.client.from('acerto_pagamentos').select('id,casa_id,acerto_id,valor_informado,valor_extraido,pago_em_extraido,comprovante_path,status,revisado_em,enviado_em').eq('casa_id', H.profile.casa_id).eq('status', 'aprovado').order('revisado_em', { ascending: false }),
        H.client.from('acerto_pagamento_lotes').select('id,casa_id,devedor_id,credor_id,valor_selecionado,valor_informado,valor_confirmado,saldo_gerado,pago_em_extraido,comprovante_path,status,revisado_em,enviado_em').eq('casa_id', H.profile.casa_id).eq('status', 'aprovado').order('revisado_em', { ascending: false }),
      ]);
      for (const result of [users, acertos, payments, lots]) {
        if (result.error) throw result.error;
      }

      H.users = users.data || [];
      H.acertos = acertos.data || [];
      H.payments = payments.data || [];
      H.lots = lots.data || [];

      const lotIds = H.lots.map(lot => lot.id);
      if (lotIds.length) {
        const itemResult = await H.client.from('acerto_pagamento_itens')
          .select('id,lote_id,acerto_id,ordem,valor_previsto,valor_aplicado,saldo_antes,saldo_depois')
          .in('lote_id', lotIds)
          .order('ordem');
        if (itemResult.error) throw itemResult.error;
        H.lotItems = itemResult.data || [];
      } else {
        H.lotItems = [];
      }

      normalizeTransactions();
      render();
    } catch (error) {
      console.error('[Acertos histórico]', error);
      renderError(error.message || 'Não foi possível carregar o histórico.');
    } finally {
      H.loading = false;
    }
  }

  function filteredTransactions() {
    return H.transactions.filter(tx => {
      const d = transactionDate(tx);
      if (H.mode === 'all') return true;
      if (H.mode === 'year') return d.getFullYear() === Number(H.year);
      return localMonth(d) === H.month;
    });
  }

  function directionTotals(list) {
    let sent = 0;
    let received = 0;
    for (const tx of list) {
      if (tx.payerId === H.profile.id) sent += tx.value;
      if (tx.receiverId === H.profile.id) received += tx.value;
    }
    return { sent, received, moved: sent + received, net: received - sent };
  }

  function availableYears() {
    const years = new Set([new Date().getFullYear()]);
    H.transactions.forEach(tx => years.add(transactionDate(tx).getFullYear()));
    return [...years].sort((a, b) => b - a);
  }

  function monthLabel(month) {
    const [year, m] = month.split('-').map(Number);
    return new Date(year, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  function periodLabel() {
    if (H.mode === 'all') return 'Todo o histórico';
    if (H.mode === 'year') return `Ano de ${H.year}`;
    return monthLabel(H.month);
  }

  function otherPersonLabel(prefix) {
    const others = H.users.filter(user => user.id !== H.profile.id && user.nome !== 'Casa');
    return others.length === 1 ? `${prefix} ${others[0].nome}` : prefix === 'Para' ? 'Você pagou' : 'Você recebeu';
  }

  function chartMarkup(list) {
    const totals = directionTotals(list);
    const max = Math.max(totals.sent, totals.received, 1);
    const sentWidth = Math.max(2, Math.round((totals.sent / max) * 100));
    const receivedWidth = Math.max(2, Math.round((totals.received / max) * 100));

    let monthly = '';
    if (H.mode === 'year') {
      const buckets = Array.from({ length: 12 }, (_, i) => ({ month: i, sent: 0, received: 0 }));
      list.forEach(tx => {
        const bucket = buckets[transactionDate(tx).getMonth()];
        if (tx.payerId === H.profile.id) bucket.sent += tx.value;
        if (tx.receiverId === H.profile.id) bucket.received += tx.value;
      });
      const monthlyMax = Math.max(1, ...buckets.flatMap(item => [item.sent, item.received]));
      monthly = `<div class="ach-month-chart" aria-label="Movimentação mês a mês">
        ${buckets.map(item => {
          const label = new Date(Number(H.year), item.month, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
          const s = item.sent ? Math.max(4, Math.round((item.sent / monthlyMax) * 62)) : 0;
          const r = item.received ? Math.max(4, Math.round((item.received / monthlyMax) * 62)) : 0;
          return `<div class="ach-month-col"><div class="ach-month-bars"><i class="sent" style="height:${s}px" title="Enviado: ${esc(money(item.sent))}"></i><i class="received" style="height:${r}px" title="Recebido: ${esc(money(item.received))}"></i></div><span>${esc(label)}</span></div>`;
        }).join('')}
      </div>`;
    }

    return `<div class="ach-chart-card">
      <div class="ach-chart-title"><strong>Fluxo no período</strong><span>${esc(periodLabel())}</span></div>
      <div class="ach-flow-row"><span>Enviado</span><div><i class="sent" style="width:${sentWidth}%"></i></div><b>${money(totals.sent)}</b></div>
      <div class="ach-flow-row"><span>Recebido</span><div><i class="received" style="width:${receivedWidth}%"></i></div><b>${money(totals.received)}</b></div>
      ${monthly}
      ${H.mode === 'year' ? '<div class="ach-legend"><span><i class="sent"></i>Enviado</span><span><i class="received"></i>Recebido</span></div>' : ''}
    </div>`;
  }

  function transactionRow(tx) {
    const mineOut = tx.payerId === H.profile.id;
    const mineIn = tx.receiverId === H.profile.id;
    const direction = mineOut
      ? `Você → ${userName(tx.receiverId)}`
      : mineIn
        ? `${userName(tx.payerId)} → você`
        : `${userName(tx.payerId)} → ${userName(tx.receiverId)}`;
    return `<button type="button" class="ach-row" data-ach-open="${esc(tx.key)}">
      <span class="ach-row-icon ${mineOut ? 'out' : 'in'}">${mineOut ? '↗' : '↙'}</span>
      <span class="ach-row-copy"><strong>${esc(tx.title)}</strong><small>${esc(direction)} · ${esc(dateBr(tx.date))}</small></span>
      <span class="ach-row-value"><strong>${money(tx.value)}</strong><small>Pago</small></span>
      <span class="ach-chevron">›</span>
    </button>`;
  }

  function render() {
    const host = document.getElementById('acertosCentral');
    const body = host?.querySelector('.ac-body');
    if (!body) return;

    let root = document.getElementById('acertosHistoryModule');
    if (!root) {
      root = document.createElement('section');
      root.id = 'acertosHistoryModule';
      root.className = 'ach-root';
      const recurring = body.querySelector('.ac-recurring-head');
      if (recurring) body.insertBefore(root, recurring);
      else body.appendChild(root);
    }

    const list = filteredTransactions();
    const totals = directionTotals(list);
    const years = availableYears();

    root.innerHTML = `
      <div class="ach-head"><div><strong>Histórico dos acertos</strong><span>Pagamentos confirmados, comprovantes e recibos.</span></div><span class="ach-count">${list.length}</span></div>
      <div class="ach-filters">
        <div class="ach-segmented" role="group" aria-label="Período do histórico">
          <button type="button" data-ach-mode="month" class="${H.mode === 'month' ? 'active' : ''}">Mês</button>
          <button type="button" data-ach-mode="year" class="${H.mode === 'year' ? 'active' : ''}">Ano</button>
          <button type="button" data-ach-mode="all" class="${H.mode === 'all' ? 'active' : ''}">Tudo</button>
        </div>
        ${H.mode === 'month'
          ? `<input class="ach-period-input" type="month" id="achMonth" value="${esc(H.month)}">`
          : H.mode === 'year'
            ? `<select class="ach-period-input" id="achYear">${years.map(year => `<option value="${year}" ${Number(H.year) === year ? 'selected' : ''}>${year}</option>`).join('')}</select>`
            : ''}
      </div>
      <div class="ach-summary">
        <div><span>${esc(otherPersonLabel('Para'))}</span><strong>${money(totals.sent)}</strong></div>
        <div><span>${esc(otherPersonLabel('De'))}</span><strong>${money(totals.received)}</strong></div>
        <div><span>Saldo do período</span><strong class="${totals.net < 0 ? 'negative' : ''}">${totals.net > 0 ? '+' : totals.net < 0 ? '−' : ''}${money(Math.abs(totals.net))}</strong></div>
      </div>
      ${chartMarkup(list)}
      <div class="ach-list-head"><strong>Movimentações</strong><span>${esc(periodLabel())}</span></div>
      <div class="ach-list">${list.length ? list.map(transactionRow).join('') : '<div class="ach-empty">Nenhum pagamento confirmado neste período.</div>'}</div>
    `;

    root.querySelectorAll('[data-ach-mode]').forEach(button => button.addEventListener('click', () => {
      H.mode = button.dataset.achMode;
      render();
    }));
    root.querySelector('#achMonth')?.addEventListener('change', event => {
      H.month = event.target.value || localMonth(new Date());
      H.year = Number(H.month.slice(0, 4));
      render();
    });
    root.querySelector('#achYear')?.addEventListener('change', event => {
      H.year = Number(event.target.value || new Date().getFullYear());
      render();
    });
    root.querySelectorAll('[data-ach-open]').forEach(button => button.addEventListener('click', () => {
      const tx = H.transactions.find(item => item.key === button.dataset.achOpen);
      if (tx) openDetail(tx);
    }));
  }

  function renderError(message) {
    const host = document.getElementById('acertosCentral');
    const body = host?.querySelector('.ac-body');
    if (!body) return;
    let root = document.getElementById('acertosHistoryModule');
    if (!root) {
      root = document.createElement('section');
      root.id = 'acertosHistoryModule';
      root.className = 'ach-root';
      body.appendChild(root);
    }
    root.innerHTML = `<div class="ach-head"><div><strong>Histórico dos acertos</strong><span>Não foi possível carregar agora.</span></div></div><div class="ach-empty">${esc(message)}</div>`;
  }

  async function authFetch(endpoint) {
    if (!context()) throw new Error('Sessão indisponível.');
    const { data } = await H.client.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error('Sessão expirada. Entre novamente.');
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      let message = 'Não foi possível abrir o documento.';
      try { message = (await response.json()).erro || message; } catch {}
      throw new Error(message);
    }
    return response;
  }

  async function openDocument(tx, documentType) {
    const base = tx.kind === 'lot' ? '/api/acertos/lotes/' : '/api/acertos/pagamentos/';
    const endpoint = `${base}${tx.id}/${documentType}`;
    const button = document.querySelector(`[data-ach-doc="${documentType}"]`);
    if (button) { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = 'Abrindo…'; }
    try {
      const response = await authFetch(endpoint);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, '_blank', 'noopener');
      if (!opened) {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${documentType}-lifeos-${tx.id}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      window.lifeosToast?.(error.message, 'erro');
      if (!window.lifeosToast) alert(error.message);
    } finally {
      if (button) { button.disabled = false; button.textContent = button.dataset.originalText || 'Abrir'; }
    }
  }

  function closeDetail() {
    document.getElementById('achDetailOverlay')?.remove();
    document.body.classList.remove('ui-modal-open');
  }

  function openDetail(tx) {
    closeDetail();
    const overlay = document.createElement('div');
    overlay.id = 'achDetailOverlay';
    overlay.className = 'ach-overlay';
    const payer = userName(tx.payerId);
    const receiver = userName(tx.receiverId);
    overlay.innerHTML = `<section class="ach-sheet" role="dialog" aria-modal="true" aria-label="Detalhes do pagamento">
      <div class="ach-sheet-head"><div><span>Pagamento confirmado</span><h3>${esc(tx.title)}</h3></div><button type="button" data-ach-close aria-label="Fechar">×</button></div>
      <div class="ach-detail-value"><span>Valor confirmado</span><strong>${money(tx.value)}</strong><small>${esc(payer)} → ${esc(receiver)}</small></div>
      <div class="ach-detail-grid"><div><span>Confirmado em</span><strong>${esc(dateBr(tx.date, true))}</strong></div><div><span>Identificador</span><strong>${esc(tx.id.slice(0, 8).toUpperCase())}</strong></div></div>
      ${tx.credit > 0 ? `<div class="ach-credit">Este pagamento gerou ${money(tx.credit)} de crédito a favor do pagador.</div>` : ''}
      <div class="ach-detail-items"><strong>${tx.items.length === 1 ? 'Cobrança quitada' : 'Cobranças incluídas'}</strong>${tx.items.map(item => `<div><span>${esc(item.title)}${item.installment ? ` · ${esc(item.installment)}` : ''}</span><b>${money(item.amount)}</b></div>`).join('')}</div>
      <div class="ach-doc-actions">
        <button type="button" data-ach-doc="proof" ${tx.proof ? '' : 'disabled'}>Ver comprovante original</button>
        <button type="button" class="primary" data-ach-doc="receipt">Ver recibo LifeOS</button>
      </div>
      ${tx.proof ? '' : '<p class="ach-doc-note">Este registro não possui arquivo de comprovante associado.</p>'}
    </section>`;
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-ach-close]')) closeDetail();
    });
    overlay.querySelector('[data-ach-doc="proof"]')?.addEventListener('click', () => openDocument(tx, 'comprovante'));
    overlay.querySelector('[data-ach-doc="receipt"]')?.addEventListener('click', () => openDocument(tx, 'recibo'));
    document.body.appendChild(overlay);
    document.body.classList.add('ui-modal-open');
  }

  function installStyles() {
    if (document.getElementById('acertosHistoryStyles')) return;
    const style = document.createElement('style');
    style.id = 'acertosHistoryStyles';
    style.textContent = `
      .ach-root{margin-top:24px;border-top:1px solid var(--linha);padding-top:20px}.ach-head,.ach-list-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.ach-head>div,.ach-list-head{min-width:0}.ach-head strong,.ach-list-head strong{display:block;font-size:15px;color:var(--texto)}.ach-head span:not(.ach-count),.ach-list-head span{display:block;font-size:12px;color:var(--muted);margin-top:3px}.ach-count{min-width:28px;height:28px;border-radius:999px;background:var(--sage-soft);color:var(--sage);display:grid;place-items:center;font-size:12px;font-weight:800}.ach-filters{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px}.ach-segmented{display:flex;background:var(--bg);border:1px solid var(--linha);border-radius:12px;padding:3px}.ach-segmented button{border:0;background:transparent;color:var(--muted);font-size:12px;font-weight:750;padding:7px 10px;border-radius:9px}.ach-segmented button.active{background:var(--paper);color:var(--sage);box-shadow:var(--shadow-soft)}.ach-period-input{min-width:0;max-width:160px;border:1px solid var(--linha);background:var(--paper);color:var(--texto);border-radius:10px;padding:8px 9px;font:inherit;font-size:12px}.ach-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.ach-summary>div{background:var(--bg);border:1px solid var(--linha);border-radius:12px;padding:10px;min-width:0}.ach-summary span{display:block;color:var(--muted);font-size:10px;line-height:1.25;min-height:25px}.ach-summary strong{display:block;font-size:14px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ach-summary strong.negative{color:var(--alert)}.ach-chart-card{margin-top:10px;border:1px solid var(--linha);border-radius:14px;padding:12px;background:var(--paper)}.ach-chart-title{display:flex;justify-content:space-between;gap:10px;align-items:baseline;margin-bottom:11px}.ach-chart-title strong{font-size:12px}.ach-chart-title span{font-size:10px;color:var(--muted)}.ach-flow-row{display:grid;grid-template-columns:58px 1fr auto;gap:8px;align-items:center;margin:7px 0}.ach-flow-row>span{font-size:10px;color:var(--muted)}.ach-flow-row>div{height:8px;border-radius:99px;background:var(--bg);overflow:hidden}.ach-flow-row i{display:block;height:100%;border-radius:99px}.ach-flow-row i.sent,.ach-month-bars i.sent,.ach-legend i.sent{background:var(--clay,#b6785e)}.ach-flow-row i.received,.ach-month-bars i.received,.ach-legend i.received{background:var(--sage,#47745b)}.ach-flow-row b{font-size:10px}.ach-month-chart{height:88px;display:grid;grid-template-columns:repeat(12,1fr);gap:3px;align-items:end;margin-top:12px;border-top:1px solid var(--linha);padding-top:9px}.ach-month-col{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:76px;min-width:0}.ach-month-bars{height:64px;display:flex;align-items:flex-end;gap:1px}.ach-month-bars i{display:block;width:3px;border-radius:3px 3px 0 0}.ach-month-col>span{font-size:8px;color:var(--muted);text-transform:capitalize;margin-top:3px}.ach-legend{display:flex;justify-content:center;gap:14px;margin-top:8px;font-size:9px;color:var(--muted)}.ach-legend span{display:flex;align-items:center;gap:4px}.ach-legend i{width:7px;height:7px;border-radius:50%}.ach-list-head{margin-top:16px;align-items:baseline}.ach-list{margin-top:6px}.ach-row{width:100%;display:grid;grid-template-columns:32px minmax(0,1fr) auto 12px;gap:8px;align-items:center;padding:11px 0;border:0;border-bottom:1px solid var(--linha);background:transparent;color:var(--texto);text-align:left}.ach-row:last-child{border-bottom:0}.ach-row-icon{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;font-size:16px;font-weight:800}.ach-row-icon.out{background:color-mix(in srgb,var(--clay,#b6785e) 13%,transparent);color:var(--clay,#b6785e)}.ach-row-icon.in{background:var(--sage-soft);color:var(--sage)}.ach-row-copy{min-width:0}.ach-row-copy strong,.ach-row-copy small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ach-row-copy strong{font-size:12px}.ach-row-copy small{font-size:10px;color:var(--muted);margin-top:3px}.ach-row-value{text-align:right}.ach-row-value strong,.ach-row-value small{display:block}.ach-row-value strong{font-size:12px}.ach-row-value small{font-size:9px;color:var(--sage);margin-top:2px}.ach-chevron{font-size:20px;color:var(--faint)}.ach-empty{text-align:center;color:var(--muted);font-size:12px;padding:18px 8px;background:var(--bg);border-radius:12px;margin-top:8px}.ach-overlay{position:fixed;inset:0;z-index:260;background:rgba(17,24,19,.55);display:grid;place-items:end center}.ach-sheet{width:min(100%,560px);max-height:90dvh;overflow:auto;background:var(--paper);color:var(--texto);border-radius:22px 22px 0 0;padding:18px 18px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -12px 40px rgba(0,0,0,.2)}.ach-sheet-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.ach-sheet-head span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--sage);font-weight:800}.ach-sheet-head h3{font-size:18px;margin:3px 0 0}.ach-sheet-head button{width:38px;height:38px;border:0;border-radius:12px;background:var(--bg);color:var(--texto);font-size:24px}.ach-detail-value{margin-top:14px;background:var(--sage-soft);border-radius:14px;padding:14px}.ach-detail-value span,.ach-detail-value small{display:block;color:var(--muted);font-size:10px}.ach-detail-value strong{display:block;font-size:25px;margin:3px 0}.ach-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.ach-detail-grid>div{background:var(--bg);border-radius:12px;padding:10px}.ach-detail-grid span,.ach-detail-grid strong{display:block}.ach-detail-grid span{font-size:9px;color:var(--muted)}.ach-detail-grid strong{font-size:11px;margin-top:3px}.ach-credit{margin-top:10px;padding:10px 12px;border-radius:10px;background:var(--sun-soft,#fff4d8);font-size:11px}.ach-detail-items{margin-top:16px}.ach-detail-items>strong{font-size:12px}.ach-detail-items>div{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--linha);font-size:11px}.ach-detail-items>div:last-child{border-bottom:0}.ach-detail-items span{color:var(--muted)}.ach-doc-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}.ach-doc-actions button{border:1px solid var(--linha);border-radius:12px;padding:11px 10px;background:var(--bg);color:var(--texto);font-size:11px;font-weight:750}.ach-doc-actions button.primary{background:var(--sage);border-color:var(--sage);color:#fff}.ach-doc-actions button:disabled{opacity:.45}.ach-doc-note{font-size:10px;color:var(--muted);margin:8px 0 0}
      @media(min-width:700px){.ach-overlay{place-items:center}.ach-sheet{border-radius:22px}.ach-summary strong{font-size:16px}}
      @media(max-width:380px){.ach-summary{grid-template-columns:1fr 1fr}.ach-summary>div:last-child{grid-column:1/-1}.ach-filters{align-items:stretch;flex-direction:column}.ach-period-input{max-width:none;width:100%}}
    `;
    document.head.appendChild(style);
  }

  // Não reinicia o relógio a cada mutação global. O comportamento anterior podia
  // ser adiado indefinidamente em telas com muitos MutationObservers (especialmente
  // no iOS), deixando o histórico destruído após um rerender da Central Financeira.
  function scheduleMount() {
    if (H.mountTimer) return;
    H.mountTimer = window.requestAnimationFrame(() => {
      H.mountTimer = null;
      installStyles();
      const host = document.getElementById('acertosCentral');
      if (!host) return;
      if (!document.getElementById('acertosHistoryModule')) load();
    });
  }

  function refreshHistory() {
    scheduleMount();
    if (document.getElementById('acertosHistoryModule')) load();
  }

  const observer = new MutationObserver(scheduleMount);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('lifeos:bootstrap-ready', scheduleMount);
  window.addEventListener('lifeos:financeiro-atualizar', refreshHistory);
  window.addEventListener('pageshow', refreshHistory);
  window.addEventListener('focus', refreshHistory);
  scheduleMount();
})();
