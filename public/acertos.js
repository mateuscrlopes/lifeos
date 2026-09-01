// LifeOS — Acertos Financeiros v1
// Obrigações entre moradores, aprovação do recebedor e dados de Pix.

(() => {
  'use strict';

  const A = {
    client: null,
    profile: null,
    users: [],
    acertos: [],
    payments: [],
    rules: [],
    configs: [],
    notifications: [],
    loading: false,
  };

  const esc = (v = '') => String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const money = (v) => Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const date = (v) => {
    if (!v) return '—';
    const raw = String(v).slice(0, 10);
    const d = new Date(raw + 'T12:00:00');
    return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString('pt-BR');
  };

  const today = () => new Date().toISOString().slice(0, 10);
  const userById = (id) => A.users.find((u) => u.id === id) || null;
  const nameById = (id) => userById(id)?.nome || 'Pessoa';
  const configByUser = (id) => A.configs.find((c) => c.usuario_id === id && c.ativo) || null;
  const paymentsFor = (id) => A.payments.filter((p) => p.acerto_id === id);
  const remaining = (a) => Math.max(0, Number(a.valor_devido) - Number(a.valor_pago || 0));

  function context() {
    const ctx = window.lifeosContext;
    if (!ctx?.supa || !ctx?.usuario) return false;
    A.client = ctx.supa;
    A.profile = ctx.usuario;
    return true;
  }

  function addStyles() {
    if (document.querySelector('link[data-acertos]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/acertos.css?v=1';
    link.dataset.acertos = '1';
    document.head.appendChild(link);
  }

  function brand() {
    const logo = document.querySelector('.header-logo');
    if (logo && !logo.querySelector('.header-logo-by')) {
      const by = document.createElement('span');
      by.className = 'header-logo-by';
      by.textContent = 'by GhuMat';
      logo.appendChild(by);
    }
  }

  function bell() {
    const header = document.querySelector('.app-header');
    const avatar = document.getElementById('headerAvatar');
    if (!header || !avatar) return;

    let btn = document.getElementById('acBell');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'acBell';
      btn.className = 'ac-bell';
      btn.setAttribute('aria-label', 'Notificações');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span class="ac-bell-badge" style="display:none"></span>';
      header.insertBefore(btn, avatar);
      btn.addEventListener('click', showNotifications);
    }

    const unread = A.notifications.filter((n) => !n.lida).length;
    const badge = btn.querySelector('.ac-bell-badge');
    if (badge) {
      badge.textContent = unread > 9 ? '9+' : String(unread);
      badge.style.display = unread ? 'grid' : 'none';
    }
  }

  function statusInfo(acerto) {
    if (acerto.status === 'pago') return { text: 'Pago', cls: '' };
    if (acerto.status === 'parcial') return { text: 'Parcial', cls: 'warn' };
    if (acerto.status === 'cancelado') return { text: 'Cancelado', cls: 'muted' };
    if (acerto.vencimento < today()) return { text: 'Vencido', cls: 'danger' };

    const pending = paymentsFor(acerto.id).some((p) => p.status === 'aguardando_confirmacao');
    if (pending) return { text: 'Aguardando confirmação', cls: 'warn' };
    return { text: 'Pendente', cls: 'muted' };
  }

  function row(acerto) {
    const mineToPay = acerto.devedor_id === A.profile.id;
    const other = mineToPay ? nameById(acerto.credor_id) : nameById(acerto.devedor_id);
    const status = statusInfo(acerto);
    const pendingPayment = paymentsFor(acerto.id)
      .find((p) => p.status === 'aguardando_confirmacao');
    const approved = paymentsFor(acerto.id)
      .filter((p) => p.status === 'aprovado')
      .sort((a, b) => String(b.revisado_em || '').localeCompare(String(a.revisado_em || '')));

    const actions = [];
    if (mineToPay && !['pago', 'cancelado'].includes(acerto.status) && !pendingPayment) {
      actions.push('<button class="primary" data-ac-pay="' + acerto.id + '">Enviar comprovante</button>');
    }

    if (!mineToPay && pendingPayment) {
      actions.push('<button class="primary" data-ac-review="' + pendingPayment.id + '">Revisar pagamento</button>');
    }

    if (approved[0]) {
      actions.push('<button data-ac-receipt="' + approved[0].id + '">Recibo</button>');
      actions.push('<button data-ac-proof="' + approved[0].id + '">Comprovante</button>');
    }

    const parcel = Number(acerto.parcelas_total) > 1
      ? ' · parcela ' + acerto.parcela_numero + '/' + acerto.parcelas_total
      : '';

    const paid = Number(acerto.valor_pago || 0) > 0
      ? ' · ' + money(acerto.valor_pago) + ' confirmado'
      : '';

    return '<article class="ac-row">' +
      '<div class="ac-row-main">' +
        '<div class="ac-row-name">' + esc(acerto.titulo) +
          '<span class="ac-chip ' + status.cls + '">' + status.text + '</span></div>' +
        '<div class="ac-row-meta">' +
          (mineToPay ? 'Você → ' + esc(other) : esc(other) + ' → você') +
          parcel + ' · vence ' + date(acerto.vencimento) + paid +
        '</div>' +
        (actions.length ? '<div class="ac-actions">' + actions.join('') + '</div>' : '') +
      '</div>' +
      '<div class="ac-row-value"><strong>' + money(remaining(acerto)) + '</strong>' +
        '<small>' + (mineToPay ? 'a pagar' : 'a receber') + '</small></div>' +
    '</article>';
  }

  function renderCentral() {
    const section = document.querySelector('#subContas .secao');
    if (!section) return;

    let root = document.getElementById('acertosCentral');
    if (!root) {
      root = document.createElement('section');
      root.id = 'acertosCentral';
      root.className = 'ac-central';
      section.appendChild(root);
    }

    const open = A.acertos
      .filter((a) => !['pago', 'cancelado'].includes(a.status))
      .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));

    const owe = open
      .filter((a) => a.devedor_id === A.profile.id)
      .reduce((sum, a) => sum + remaining(a), 0);

    const receive = open
      .filter((a) => a.credor_id === A.profile.id)
      .reduce((sum, a) => sum + remaining(a), 0);

    const net = receive - owe;
    const rule = A.rules.find((r) => r.ativo) || A.rules[0] || null;
    const approvals = A.payments.filter((p) =>
      p.status === 'aguardando_confirmacao' &&
      A.acertos.some((a) => a.id === p.acerto_id && a.credor_id === A.profile.id)
    ).length;

    root.innerHTML =
      '<div class="ac-hero">' +
        '<p class="ac-eyebrow">Central Financeira</p>' +
        '<div class="ac-hero-line"><div><h2>Acertos da Casa</h2>' +
          '<p>Quem deve quanto para quem, com parcelas, comprovantes e confirmação do recebedor.</p></div>' +
          '<button type="button" class="ac-add" id="acNewExpense">+ Despesa</button></div>' +
      '</div>' +
      '<div class="ac-summary">' +
        '<div><span>Você deve</span><strong>' + money(owe) + '</strong></div>' +
        '<div><span>A receber</span><strong>' + money(receive) + '</strong></div>' +
        '<div><span>Saldo líquido</span><strong>' + (net === 0 ? money(0) : (net > 0 ? '+' : '−') + money(Math.abs(net))) + '</strong></div>' +
      '</div>' +
      '<div class="ac-body">' +
        (approvals ? '<p class="ac-note warn">' + approvals + ' pagamento' + (approvals === 1 ? '' : 's') + ' aguardando sua confirmação.</p>' : '') +
        (owe > 0 && receive > 0
          ? '<p class="ac-note" style="margin-top:8px">Se vocês compensarem os acertos em aberto, o saldo líquido hoje é ' +
            (net === 0 ? 'zero.' : (net > 0 ? money(net) + ' a receber.' : money(Math.abs(net)) + ' a pagar.')) + '</p>'
          : '') +
        '<div class="ac-section-title" style="margin-top:14px"><strong>Em aberto</strong><span>' + open.length + ' item(ns)</span></div>' +
        (open.length ? '<div class="ac-list">' + open.map(row).join('') + '</div>' : '<div class="ac-empty">Nenhum acerto em aberto.</div>') +
        (rule ? '<div class="ac-rule"><div class="ac-rule-line"><div><strong>' + esc(rule.titulo) + '</strong>' +
          '<span>' + esc(nameById(rule.devedor_id)) + ' → ' + esc(nameById(rule.credor_id)) +
          ' · ' + money(rule.valor) + ' por mês · gera dia ' + rule.gerar_dia +
          ' · vence no ' + rule.vencimento_valor + 'º ' + (rule.vencimento_tipo === 'dia_util' ? 'dia útil' : 'dia do mês') +
          '</span></div><button type="button" id="acEditRule">Configurar</button></div></div>' : '') +
      '</div>';

    root.querySelector('#acNewExpense')?.addEventListener('click', showNewExpense);
    root.querySelector('#acEditRule')?.addEventListener('click', () => showRule(rule));
    root.querySelectorAll('[data-ac-pay]').forEach((btn) =>
      btn.addEventListener('click', () => showPayment(btn.dataset.acPay)));
    root.querySelectorAll('[data-ac-review]').forEach((btn) =>
      btn.addEventListener('click', () => showReview(btn.dataset.acReview)));
    root.querySelectorAll('[data-ac-receipt]').forEach((btn) =>
      btn.addEventListener('click', () => downloadReceipt(btn.dataset.acReceipt)));
    root.querySelectorAll('[data-ac-proof]').forEach((btn) =>
      btn.addEventListener('click', () => openProof(btn.dataset.acProof)));
  }

  function maskKey(value) {
    const raw = String(value || '');
    if (!raw) return 'Não cadastrada';
    if (raw.length <= 5) return '•••••';
    return '••••••' + raw.slice(-4);
  }

  function renderConfig() {
    const section = document.querySelector('#secaoConfig .secao');
    if (!section) return;

    let root = document.getElementById('acReceiveConfig');
    if (!root) {
      root = document.createElement('div');
      root.id = 'acReceiveConfig';
      root.className = 'ac-config-card';
      section.prepend(root);
    }

    const cfg = configByUser(A.profile.id);
    root.innerHTML =
      '<h3>Dados para recebimento</h3>' +
      '<p>Usados nos acertos em que você é o recebedor. A chave não fica no código nem em ENV.</p>' +
      '<div class="ac-config-status"><div><strong>' + esc(cfg?.banco || 'Pix ainda não configurado') + '</strong>' +
      '<span>' + (cfg?.pix_tipo ? esc(cfg.pix_tipo.toUpperCase()) + ' · ' : '') + esc(maskKey(cfg?.pix_chave)) + '</span></div>' +
      '<button type="button" id="acEditReceive">' + (cfg ? 'Editar' : 'Cadastrar') + '</button></div>';

    root.querySelector('#acEditReceive')?.addEventListener('click', showReceiveConfig);
  }

  function modal(body) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.id = 'acModal';
    overlay.className = 'ac-overlay';
    overlay.innerHTML = '<section class="ac-sheet">' + body + '</section>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeModal();
    });
    overlay.querySelectorAll('[data-ac-close]').forEach((btn) =>
      btn.addEventListener('click', closeModal));
    return overlay;
  }

  function closeModal() {
    document.getElementById('acModal')?.remove();
  }

  function sheetHead(kicker, title) {
    return '<div class="ac-sheet-head"><div><p>' + esc(kicker) + '</p><h3>' + esc(title) +
      '</h3></div><button type="button" class="ac-sheet-close" data-ac-close>&times;</button></div>';
  }

  function showNewExpense() {
    const totalDefault = '';
    const userOptions = A.users.map((u) =>
      '<option value="' + u.id + '"' + (u.id === A.profile.id ? ' selected' : '') + '>' + esc(u.nome) + '</option>'
    ).join('');

    const fields = A.users.map((u) =>
      '<label class="ac-field"><span>Parte de ' + esc(u.nome) + '</span>' +
      '<input type="number" min="0" step="0.01" data-ac-share="' + u.id + '" value=""></label>'
    ).join('');

    const root = modal(
      sheetHead('Despesa compartilhada', 'Quem pagou esta compra?') +
      '<form class="ac-form" id="acExpenseForm">' +
        '<label class="ac-field"><span>Descrição</span><input name="title" required placeholder="Ex.: Hospedagem em Natal"></label>' +
        '<div class="ac-grid-2">' +
          '<label class="ac-field"><span>Valor total</span><input name="total" type="number" min="0.01" step="0.01" required value="' + totalDefault + '"></label>' +
          '<label class="ac-field"><span>Pago por</span><select name="payer">' + userOptions + '</select></label>' +
        '</div>' +
        '<div class="ac-split"><div class="ac-split-head"><strong>Divisão</strong><button type="button" id="acHalf">50% cada</button></div>' +
          '<div class="ac-grid-2">' + fields + '</div></div>' +
        '<div class="ac-grid-2">' +
          '<label class="ac-field"><span>Parcelas</span><input name="installments" type="number" min="1" max="60" value="1" required></label>' +
          '<label class="ac-field"><span>Vencimento da 1ª</span><input name="due" type="date" required value="' + today() + '"></label>' +
        '</div>' +
        '<label class="ac-field"><span>Forma usada</span><select name="method"><option value="credit_card">Cartão de crédito</option><option value="pix">Pix</option><option value="debit">Débito</option><option value="cash">Dinheiro</option><option value="other">Outro</option></select></label>' +
        '<label class="ac-field"><span>Observação</span><textarea name="notes" placeholder="Opcional"></textarea></label>' +
        '<p class="ac-note">O valor da pessoa que não pagou vira um acerto. Se houver parcelas, a obrigação acompanha os vencimentos mensais.</p>' +
        '<div id="acExpenseError"></div>' +
        '<div class="ac-form-actions"><button type="button" class="ac-secondary" data-ac-close>Cancelar</button><button class="ac-primary" type="submit">Criar despesa</button></div>' +
      '</form>'
    );

    const totalInput = root.querySelector('[name="total"]');
    const fillHalf = () => {
      const total = Math.max(0, Number(totalInput.value || 0));
      const values = [...root.querySelectorAll('[data-ac-share]')];
      if (values.length !== 2) return;
      const first = Math.round((total / 2) * 100) / 100;
      const second = Math.round((total - first) * 100) / 100;
      values[0].value = first ? first.toFixed(2) : '';
      values[1].value = second ? second.toFixed(2) : '';
    };

    root.querySelector('#acHalf')?.addEventListener('click', fillHalf);
    totalInput?.addEventListener('change', () => {
      const empty = [...root.querySelectorAll('[data-ac-share]')].every((i) => !i.value);
      if (empty) fillHalf();
    });

    root.querySelector('#acExpenseForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const total = Number(form.get('total'));
      const shares = [...root.querySelectorAll('[data-ac-share]')].map((input) => ({
        usuario_id: input.dataset.acShare,
        valor: Number(input.value || 0),
      }));
      const sum = shares.reduce((s, i) => s + i.valor, 0);
      const error = root.querySelector('#acExpenseError');

      if (Math.abs(sum - total) > 0.01) {
        error.innerHTML = '<p class="ac-note warn">A divisão precisa somar ' + money(total) + '.</p>';
        return;
      }

      const submit = event.currentTarget.querySelector('[type="submit"]');
      submit.disabled = true;
      submit.textContent = 'Salvando...';

      const result = await A.client.rpc('criar_despesa_compartilhada', {
        p_titulo: String(form.get('title') || '').trim(),
        p_valor_total: total,
        p_pago_por: String(form.get('payer')),
        p_partes: shares,
        p_parcelas: Number(form.get('installments') || 1),
        p_primeiro_vencimento: String(form.get('due')),
        p_meio_pagamento: String(form.get('method')),
        p_origem: 'manual',
        p_origem_externa_id: null,
        p_origem_url: null,
        p_observacoes: String(form.get('notes') || '').trim() || null,
      });

      if (result.error) {
        submit.disabled = false;
        submit.textContent = 'Criar despesa';
        error.innerHTML = '<p class="ac-note warn">' + esc(result.error.message) + '</p>';
        return;
      }

      closeModal();
      await load();
    });
  }

  function showPayment(acertoId) {
    const acerto = A.acertos.find((a) => a.id === acertoId);
    if (!acerto) return;

    const cfg = configByUser(acerto.credor_id);
    const rem = remaining(acerto);
    const receive = cfg
      ? '<div class="ac-receive"><span>Enviar para ' + esc(nameById(acerto.credor_id)) + '</span>' +
        '<strong>' + esc(cfg.banco || 'Pix') + '</strong><code>' + esc(maskKey(cfg.pix_chave)) + '</code>' +
        '<button type="button" class="ac-copy" id="acCopyPix">Copiar chave Pix</button></div>'
      : '<p class="ac-note warn">O recebedor ainda não cadastrou uma chave Pix no LifeOS. O comprovante pode ser enviado mesmo assim.</p>';

    const root = modal(
      sheetHead('Pagamento', acerto.titulo) +
      receive +
      '<form class="ac-form" id="acPayForm">' +
        '<div class="ac-payment-summary"><div><span>Saldo deste acerto</span><strong>' + money(rem) + '</strong></div>' +
        '<div><span>Vencimento</span><strong>' + date(acerto.vencimento) + '</strong></div></div>' +
        '<label class="ac-field"><span>Valor pago</span><input name="value" type="number" min="0.01" max="' + rem + '" step="0.01" value="' + rem.toFixed(2) + '" required></label>' +
        '<label class="ac-field"><span>Comprovante</span><input name="file" type="file" accept="application/pdf,image/png,image/jpeg" required></label>' +
        '<p class="ac-note">PDF: o LifeOS tenta identificar valor e data localmente, sem IA. Imagem: fica arquivada para conferência humana.</p>' +
        '<div id="acPayError"></div>' +
        '<div class="ac-form-actions"><button type="button" class="ac-secondary" data-ac-close>Cancelar</button><button class="ac-primary" type="submit">Enviar para confirmação</button></div>' +
      '</form>'
    );

    root.querySelector('#acCopyPix')?.addEventListener('click', async () => {
      if (!cfg?.pix_chave) return;
      await navigator.clipboard.writeText(cfg.pix_chave);
      root.querySelector('#acCopyPix').textContent = 'Copiado';
    });

    root.querySelector('#acPayForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const file = form.get('file');
      const value = Number(form.get('value'));
      const error = root.querySelector('#acPayError');

      if (!(file instanceof File) || !file.size) {
        error.innerHTML = '<p class="ac-note warn">Escolha um comprovante.</p>';
        return;
      }

      const { data: sessionData } = await A.client.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        error.innerHTML = '<p class="ac-note warn">Sua sessão expirou. Entre novamente.</p>';
        return;
      }

      const submit = event.currentTarget.querySelector('[type="submit"]');
      submit.disabled = true;
      submit.textContent = 'Enviando...';

      try {
        const response = await fetch('/api/acertos/' + acerto.id + '/comprovante', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': file.type || 'application/octet-stream',
            'x-lifeos-tipo': file.type || 'application/octet-stream',
            'x-lifeos-valor': String(value),
            'x-lifeos-arquivo': encodeURIComponent(file.name),
          },
          body: file,
        });

        const body = await response.json();
        if (!response.ok) throw new Error(body.erro || 'Não foi possível enviar o comprovante.');

        closeModal();
        await load();

        if (body?.leitura?.divergencia_valor) {
          alert('Comprovante enviado. O valor lido no PDF é diferente do informado; o recebedor verá esse aviso antes de confirmar.');
        }
      } catch (e) {
        submit.disabled = false;
        submit.textContent = 'Enviar para confirmação';
        error.innerHTML = '<p class="ac-note warn">' + esc(e.message) + '</p>';
      }
    });
  }

  function showReview(paymentId) {
    const p = A.payments.find((item) => item.id === paymentId);
    if (!p) return;
    const a = A.acertos.find((item) => item.id === p.acerto_id);
    if (!a) return;

    const extracted = p.valor_extraido != null ? money(p.valor_extraido) : 'Não identificado';
    const mismatch = p.dados_extraidos?.divergencia_valor;

    const root = modal(
      sheetHead('Confirmação do recebedor', a.titulo) +
      '<div class="ac-payment-summary"><div><span>Valor informado</span><strong>' + money(p.valor_informado) + '</strong></div>' +
      '<div><span>Valor lido</span><strong>' + extracted + '</strong></div></div>' +
      (mismatch ? '<p class="ac-note warn">O valor identificado no PDF é diferente do valor informado. Confira o documento antes de aprovar.</p>' : '') +
      '<div class="ac-actions" style="margin:10px 0 14px"><button type="button" id="acOpenProof">Ver comprovante original</button></div>' +
      '<label class="ac-field"><span>Motivo em caso de recusa</span><textarea id="acRejectReason" placeholder="Ex.: valor não recebido, comprovante incorreto..."></textarea></label>' +
      '<div id="acReviewError"></div>' +
      '<div class="ac-form-actions"><button type="button" class="ac-secondary" id="acReject">Recusar</button><button type="button" class="ac-primary" id="acApprove">Confirmar recebimento</button></div>'
    );

    root.querySelector('#acOpenProof')?.addEventListener('click', () => openProof(paymentId));

    const review = async (approve) => {
      const reason = String(root.querySelector('#acRejectReason')?.value || '').trim();
      const error = root.querySelector('#acReviewError');
      const buttons = root.querySelectorAll('#acReject,#acApprove');
      buttons.forEach((b) => { b.disabled = true; });

      const result = await A.client.rpc('revisar_pagamento_acerto', {
        p_pagamento_id: paymentId,
        p_aprovar: approve,
        p_motivo: approve ? null : reason || 'Pagamento não confirmado pelo recebedor.',
      });

      if (result.error) {
        buttons.forEach((b) => { b.disabled = false; });
        error.innerHTML = '<p class="ac-note warn">' + esc(result.error.message) + '</p>';
        return;
      }

      closeModal();
      await load();
      if (approve) await downloadReceipt(paymentId);
    };

    root.querySelector('#acApprove')?.addEventListener('click', () => review(true));
    root.querySelector('#acReject')?.addEventListener('click', () => review(false));
  }

  async function authFetch(url) {
    const { data } = await A.client.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error('Sessão expirada.');
    const response = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!response.ok) {
      let msg = 'Não foi possível abrir o arquivo.';
      try { msg = (await response.json()).erro || msg; } catch {}
      throw new Error(msg);
    }
    return response;
  }

  async function openProof(paymentId) {
    try {
      const response = await authFetch('/api/acertos/pagamentos/' + paymentId + '/comprovante');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      alert(e.message);
    }
  }

  async function downloadReceipt(paymentId) {
    try {
      const response = await authFetch('/api/acertos/pagamentos/' + paymentId + '/recibo');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'recibo-lifeos-' + paymentId + '.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      alert(e.message);
    }
  }

  function showRule(rule) {
    if (!rule) return;
    const options = A.users.map((u) => '<option value="' + u.id + '">' + esc(u.nome) + '</option>').join('');
    const root = modal(
      sheetHead('Regra recorrente', 'Contribuição da Casa') +
      '<form class="ac-form" id="acRuleForm">' +
        '<label class="ac-field"><span>Nome</span><input name="title" value="' + esc(rule.titulo) + '" required></label>' +
        '<div class="ac-grid-2"><label class="ac-field"><span>Valor mensal</span><input name="value" type="number" min="0.01" step="0.01" value="' + Number(rule.valor).toFixed(2) + '"></label>' +
        '<label class="ac-field"><span>Gerar no dia</span><input name="generate" type="number" min="1" max="28" value="' + rule.gerar_dia + '"></label></div>' +
        '<div class="ac-grid-2"><label class="ac-field"><span>Quem paga</span><select name="debtor">' + options + '</select></label>' +
        '<label class="ac-field"><span>Quem recebe</span><select name="creditor">' + options + '</select></label></div>' +
        '<div class="ac-grid-2"><label class="ac-field"><span>Regra de vencimento</span><select name="dueType"><option value="dia_util">Dia útil</option><option value="dia_mes">Dia do mês</option></select></label>' +
        '<label class="ac-field"><span>Número do dia</span><input name="dueValue" type="number" min="1" max="28" value="' + rule.vencimento_valor + '"></label></div>' +
        '<label class="ac-field"><span>Status</span><select name="active"><option value="true">Ativa</option><option value="false">Pausada</option></select></label>' +
        '<p class="ac-note">Mudanças atingem a regra e acertos do mês atual/futuros que ainda não receberam pagamento. Histórico pago não é alterado.</p>' +
        '<div id="acRuleError"></div>' +
        '<div class="ac-form-actions"><button type="button" class="ac-secondary" data-ac-close>Cancelar</button><button type="submit" class="ac-primary">Salvar regra</button></div>' +
      '</form>'
    );

    root.querySelector('[name="debtor"]').value = rule.devedor_id;
    root.querySelector('[name="creditor"]').value = rule.credor_id;
    root.querySelector('[name="dueType"]').value = rule.vencimento_tipo;
    root.querySelector('[name="active"]').value = String(rule.ativo);

    root.querySelector('#acRuleForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const result = await A.client.rpc('atualizar_regra_acerto', {
        p_regra_id: rule.id,
        p_titulo: String(form.get('title')),
        p_valor: Number(form.get('value')),
        p_devedor_id: String(form.get('debtor')),
        p_credor_id: String(form.get('creditor')),
        p_gerar_dia: Number(form.get('generate')),
        p_vencimento_tipo: String(form.get('dueType')),
        p_vencimento_valor: Number(form.get('dueValue')),
        p_ativo: String(form.get('active')) === 'true',
      });

      if (result.error) {
        root.querySelector('#acRuleError').innerHTML = '<p class="ac-note warn">' + esc(result.error.message) + '</p>';
        return;
      }

      closeModal();
      await load();
    });
  }

  function showReceiveConfig() {
    const cfg = configByUser(A.profile.id);
    const root = modal(
      sheetHead('Central Financeira', 'Dados para receber') +
      '<form class="ac-form" id="acReceiveForm">' +
        '<label class="ac-field"><span>Banco</span><input name="bank" value="' + esc(cfg?.banco || '') + '" placeholder="Ex.: Santander"></label>' +
        '<label class="ac-field"><span>Tipo da chave Pix</span><select name="type"><option value="cpf">CPF</option><option value="email">E-mail</option><option value="telefone">Telefone</option><option value="aleatoria">Aleatória</option><option value="outro">Outro</option></select></label>' +
        '<label class="ac-field"><span>Chave Pix</span><input name="key" autocomplete="off" value="' + esc(cfg?.pix_chave || '') + '" placeholder="Sua chave"></label>' +
        '<p class="ac-note">Este dado fica no banco privado do LifeOS e pode ser alterado sem redeploy. Ele não é gravado no GitHub nem em ENV.</p>' +
        '<div id="acReceiveError"></div>' +
        '<div class="ac-form-actions"><button type="button" class="ac-secondary" data-ac-close>Cancelar</button><button type="submit" class="ac-primary">Salvar</button></div>' +
      '</form>'
    );

    root.querySelector('[name="type"]').value = cfg?.pix_tipo || 'cpf';
    root.querySelector('#acReceiveForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const payload = {
        casa_id: A.profile.casa_id,
        usuario_id: A.profile.id,
        banco: String(form.get('bank') || '').trim() || null,
        pix_tipo: String(form.get('type')),
        pix_chave: String(form.get('key') || '').trim() || null,
        ativo: true,
        atualizado_em: new Date().toISOString(),
      };

      const result = await A.client
        .from('financeiro_recebimento_config')
        .upsert(payload, { onConflict: 'usuario_id' });

      if (result.error) {
        root.querySelector('#acReceiveError').innerHTML = '<p class="ac-note warn">' + esc(result.error.message) + '</p>';
        return;
      }

      closeModal();
      await load();
    });
  }

  function showNotifications() {
    const list = [...A.notifications].sort((a, b) => String(b.criada_em).localeCompare(String(a.criada_em)));
    const root = modal(
      sheetHead('LifeOS', 'Notificações') +
      (list.length
        ? '<div class="ac-notification-list">' + list.map((n) =>
          '<button type="button" class="ac-notification ' + (!n.lida ? 'unread' : '') + '" data-ac-notification="' + n.id + '">' +
          '<strong>' + esc(n.titulo) + '</strong><span>' + esc(n.mensagem || '') + '</span></button>'
        ).join('') + '</div>'
        : '<div class="ac-empty">Nenhuma notificação.</div>')
    );

    root.querySelectorAll('[data-ac-notification]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const n = A.notifications.find((item) => item.id === btn.dataset.acNotification);
        if (!n) return;

        if (!n.lida) {
          await A.client
            .from('notificacoes')
            .update({ lida: true, lida_em: new Date().toISOString() })
            .eq('id', n.id);
          n.lida = true;
          bell();
        }

        if (n.entidade === 'acerto_pagamentos' && n.entidade_id) {
          const p = A.payments.find((item) => item.id === n.entidade_id);
          if (p?.status === 'aguardando_confirmacao') {
            closeModal();
            showReview(p.id);
          }
        }
      });
    });
  }

  async function load() {
    if (A.loading || !context()) return;
    A.loading = true;

    try {
      await A.client.rpc('gerar_acertos_recorrentes', { p_data: today() });

      const [users, acertos, payments, rules, configs, notifications] = await Promise.all([
        A.client.from('usuarios').select('id,nome,casa_id').eq('casa_id', A.profile.casa_id).order('nome'),
        A.client.from('acertos').select('*').eq('casa_id', A.profile.casa_id).order('vencimento'),
        A.client.from('acerto_pagamentos').select('*').eq('casa_id', A.profile.casa_id).order('enviado_em', { ascending: false }),
        A.client.from('acerto_regras').select('*').eq('casa_id', A.profile.casa_id).order('criada_em'),
        A.client.from('financeiro_recebimento_config').select('*').eq('casa_id', A.profile.casa_id),
        A.client.from('notificacoes').select('*').eq('usuario_id', A.profile.id).order('criada_em', { ascending: false }).limit(30),
      ]);

      if (users.error) throw users.error;
      if (acertos.error) throw acertos.error;
      if (payments.error) throw payments.error;
      if (rules.error) throw rules.error;
      if (configs.error) throw configs.error;
      if (notifications.error) throw notifications.error;

      A.users = users.data || [];
      A.acertos = acertos.data || [];
      A.payments = payments.data || [];
      A.rules = rules.data || [];
      A.configs = configs.data || [];
      A.notifications = notifications.data || [];

      brand();
      bell();
      renderCentral();
      renderConfig();
    } catch (error) {
      console.error('[Acertos Financeiros]', error);
    } finally {
      A.loading = false;
    }
  }

  function start() {
    addStyles();
    brand();

    if (context()) load();

    window.addEventListener('lifeos:ready', load);
    window.addEventListener('lifeos:contas-atualizadas', () => window.setTimeout(load, 80));

    window.setInterval(() => {
      if (context()) load();
    }, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
