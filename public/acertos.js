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
    lots: [],
    lotItems: [],
    balances: [],
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
  const lotById = (id) => A.lots.find((l) => l.id === id) || null;
  const lotItemsFor = (id) => A.lotItems.filter((item) => item.lote_id === id);
  const lotsForAcerto = (acertoId, status = null) => {
    const ids = new Set(A.lotItems.filter((item) => item.acerto_id === acertoId).map((item) => item.lote_id));
    return A.lots
      .filter((lote) => ids.has(lote.id) && (!status || lote.status === status))
      .sort((a, b) => String(b.enviado_em || '').localeCompare(String(a.enviado_em || '')));
  };
  const pendingLotFor = (acertoId) => lotsForAcerto(acertoId, 'aguardando_confirmacao')[0] || null;
  const approvedLotFor = (acertoId) => lotsForAcerto(acertoId, 'aprovado')[0] || null;
  const creditForCurrentUser = () => A.balances
    .filter((saldo) => saldo.devedor_id === A.profile?.id)
    .reduce((sum, saldo) => sum + Number(saldo.saldo_credito || 0), 0);
  const remaining = (a) => Math.max(0, Number(a.valor_devido) - Number(a.valor_pago || 0));

  let ocrScriptPromise = null;
  let ocrWorkerPromise = null;

  function parseMoneyOcr(valor) {
    const limpo = String(valor || '').replace(/[^\d,.\-]/g, '').trim();
    if (!limpo) return null;
    let texto = limpo;
    if (texto.includes(',') && texto.includes('.')) {
      texto = texto.replace(/\./g, '').replace(',', '.');
    } else if (texto.includes(',')) {
      texto = texto.replace(',', '.');
    } else if ((texto.match(/\./g) || []).length > 1) {
      const partes = texto.split('.');
      const decimal = partes.pop();
      texto = partes.join('') + '.' + decimal;
    }
    const numero = Number(texto);
    return Number.isFinite(numero) && numero > 0 && numero < 1000000
      ? Math.round(numero * 100) / 100
      : null;
  }

  function extractPixValueFromOcr(textoRecebido) {
    const texto = String(textoRecebido || '').replace(/\r/g, '\n');
    const linhas = texto.split(/\n+/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const semAcentos = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const dinheiroRe = /(?:R\s*\$|RS|\$)?\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})|(?:R\s*\$|RS|\$)\s*\d+(?:[.,]\d{2})/ig;
    const rotulos = [
      'valor da transferencia',
      'valor da transacao',
      'valor transferido',
      'valor enviado',
      'valor do pix',
      'valor pago',
      'valor',
    ];
    const ignorar = ['saldo', 'limite', 'disponivel', 'taxa', 'tarifa', 'cashback'];

    for (let i = 0; i < linhas.length; i += 1) {
      const base = semAcentos(linhas[i]);
      if (!rotulos.some(rotulo => base.includes(rotulo))) continue;
      if (ignorar.some(rotulo => base.includes(rotulo))) continue;

      const janela = [linhas[i], linhas[i + 1] || ''].join(' ');
      const candidatos = janela.match(dinheiroRe) || [];
      for (const candidato of candidatos) {
        const valor = parseMoneyOcr(candidato);
        if (valor) return valor;
      }
    }

    const candidatos = [];
    for (const linha of linhas) {
      const base = semAcentos(linha);
      if (ignorar.some(rotulo => base.includes(rotulo))) continue;
      for (const candidato of (linha.match(dinheiroRe) || [])) {
        const valor = parseMoneyOcr(candidato);
        if (valor) candidatos.push(valor);
      }
    }

    const unicos = [...new Set(candidatos.map(v => v.toFixed(2)))].map(Number);
    return unicos.length === 1 ? unicos[0] : null;
  }

  function loadOcrScript() {
    if (window.Tesseract?.createWorker) return Promise.resolve(window.Tesseract);
    if (ocrScriptPromise) return ocrScriptPromise;

    ocrScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.min.js';
      script.async = true;
      script.onload = () => window.Tesseract?.createWorker
        ? resolve(window.Tesseract)
        : reject(new Error('OCR não ficou disponível.'));
      script.onerror = () => reject(new Error('Não foi possível carregar o leitor de imagens.'));
      document.head.appendChild(script);
    });

    return ocrScriptPromise;
  }

  async function ocrWorker() {
    if (!ocrWorkerPromise) {
      ocrWorkerPromise = loadOcrScript()
        .then(Tesseract => Tesseract.createWorker('por'))
        .catch(error => {
          ocrWorkerPromise = null;
          throw error;
        });
    }
    return ocrWorkerPromise;
  }

  async function readImageProof(file, onProgress = () => {}) {
    const worker = await ocrWorker();
    onProgress('Lendo o print…');
    const resultado = await worker.recognize(file);
    const texto = resultado?.data?.text || '';
    const confidence = Number(resultado?.data?.confidence);
    const value = extractPixValueFromOcr(texto);
    return {
      value,
      confidence: Number.isFinite(confidence) ? Math.round(confidence) : null,
      textLength: texto.length,
    };
  }

  function hasPaymentHistory(acerto) {
    const ids = acerto.despesa_id
      ? A.acertos.filter((item) => item.despesa_id === acerto.despesa_id).map((item) => item.id)
      : [acerto.id];

    return ids.some((id) =>
      A.payments.some((payment) => payment.acerto_id === id)
      || Number(A.acertos.find((item) => item.id === id)?.valor_pago || 0) > 0
    );
  }

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
    link.href = '/acertos.css?v=3';
    link.dataset.acertos = '1';
    document.head.appendChild(link);
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

    const pending = paymentsFor(acerto.id).some((p) => p.status === 'aguardando_confirmacao')
      || Boolean(pendingLotFor(acerto.id));
    if (pending) return { text: 'Aguardando confirmação', cls: 'warn' };
    return { text: 'Pendente', cls: 'muted' };
  }

  function row(acerto) {
    const mineToPay = acerto.devedor_id === A.profile.id;
    const other = mineToPay ? nameById(acerto.credor_id) : nameById(acerto.devedor_id);
    const status = statusInfo(acerto);
    const pendingPayment = paymentsFor(acerto.id)
      .find((p) => p.status === 'aguardando_confirmacao');
    const pendingLot = pendingLotFor(acerto.id);
    const approvedLegacy = paymentsFor(acerto.id)
      .filter((p) => p.status === 'aprovado')
      .sort((a, b) => String(b.revisado_em || '').localeCompare(String(a.revisado_em || '')))[0] || null;
    const approvedLot = approvedLotFor(acerto.id);

    const actions = [];
    if (mineToPay && !['pago', 'cancelado'].includes(acerto.status) && !pendingPayment && !pendingLot) {
      actions.push('<button class="primary" data-ac-pay="' + acerto.id + '">Pagar</button>');
    }

    if (!mineToPay && pendingPayment) {
      actions.push('<button class="primary" data-ac-review="' + pendingPayment.id + '">Revisar pagamento</button>');
    } else if (!mineToPay && pendingLot) {
      actions.push('<button class="primary" data-ac-review-lot="' + pendingLot.id + '">Revisar Pix</button>');
    }

    if (approvedLot) {
      actions.push('<button data-ac-lot-receipt="' + approvedLot.id + '">Recibo</button>');
      actions.push('<button data-ac-lot-proof="' + approvedLot.id + '">Comprovante</button>');
    } else if (approvedLegacy) {
      actions.push('<button data-ac-receipt="' + approvedLegacy.id + '">Recibo</button>');
      actions.push('<button data-ac-proof="' + approvedLegacy.id + '">Comprovante</button>');
    }

    const canDelete = !['pago', 'cancelado'].includes(acerto.status)
      && !hasPaymentHistory(acerto)
      && !pendingLot
      && (acerto.credor_id === A.profile.id || acerto.criado_por === A.profile.id);

    if (canDelete) {
      actions.push(
        '<button class="ac-icon-action danger" type="button" data-ac-delete="' + acerto.id + '" ' +
        'aria-label="Excluir acerto" title="Excluir">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
        '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></svg>' +
        '</button>'
      );
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
          '<span class="ac-chip ' + status.cls + '">' + status.text + '</span>' +
          (acerto.origem === 'nordestrip' ? '<span class="ac-chip source">Nordestrip</span>' : '') +
        '</div>' +
        '<div class="ac-row-meta">' +
          (mineToPay ? 'Você → ' + esc(other) : esc(other) + ' → você') +
          parcel + ' · vence ' + date(acerto.vencimento) + paid +
        '</div>' +
      '</div>' +
      '<div class="ac-row-side">' +
        '<div class="ac-row-value"><strong>' + money(remaining(acerto)) + '</strong>' +
          '<small>' + (mineToPay ? 'a pagar' : 'a receber') + '</small></div>' +
        (actions.length ? '<div class="ac-actions">' + actions.join('') + '</div>' : '') +
      '</div>' +
    '</article>';
  }

  function renderCentral() {
    const section = document.getElementById('lifeosFinanceiroAcertos')
      || document.querySelector('#subContas .secao');
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
    const credit = creditForCurrentUser();
    const rules = [...A.rules].sort((a, b) =>
      Number(Boolean(b.ativo)) - Number(Boolean(a.ativo))
      || String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR')
    );
    const legacyApprovals = A.payments.filter((p) =>
      p.status === 'aguardando_confirmacao' &&
      A.acertos.some((a) => a.id === p.acerto_id && a.credor_id === A.profile.id)
    ).length;
    const lotApprovals = A.lots.filter((lote) =>
      lote.status === 'aguardando_confirmacao' && lote.credor_id === A.profile.id
    ).length;
    const approvals = legacyApprovals + lotApprovals;

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
        '<div><span>Crédito a favor</span><strong>' + money(credit) + '</strong></div>' +
      '</div>' +
      '<div class="ac-body">' +
        (approvals ? '<p class="ac-note warn">' + approvals + ' pagamento' + (approvals === 1 ? '' : 's') + ' aguardando sua confirmação.</p>' : '') +
        (owe > 0 && receive > 0
          ? '<p class="ac-note" style="margin-top:8px">Se vocês compensarem os acertos em aberto, o saldo líquido hoje é ' +
            (net === 0 ? 'zero.' : (net > 0 ? money(net) + ' a receber.' : money(Math.abs(net)) + ' a pagar.')) + '</p>'
          : '') +
        '<div class="ac-section-title" style="margin-top:14px"><strong>Em aberto</strong><span>' + open.length + ' item(ns)</span></div>' +
        (open.length ? '<div class="ac-list">' + open.map(row).join('') + '</div>' : '<div class="ac-empty">Nenhum acerto em aberto.</div>') +
        '<div class="ac-recurring-head"><div><strong>Cobranças recorrentes</strong><span>Geradas automaticamente todos os meses.</span></div>' +
          '<button type="button" id="acNewRule">+ Recorrente</button></div>' +
        (rules.length
          ? '<div class="ac-rule-list">' + rules.map((rule) =>
              '<article class="ac-rule ' + (rule.ativo ? '' : 'is-paused') + '">' +
                '<div class="ac-rule-line"><div class="ac-rule-copy"><div class="ac-rule-title">' +
                  '<strong>' + esc(rule.titulo) + '</strong>' +
                  '<span class="ac-chip ' + (rule.ativo ? '' : 'muted') + '">' + (rule.ativo ? 'Ativa' : 'Pausada') + '</span>' +
                '</div><span>' + esc(nameById(rule.devedor_id)) + ' → ' + esc(nameById(rule.credor_id)) +
                  ' · ' + money(rule.valor) + '/mês</span>' +
                '<small>Gera dia ' + rule.gerar_dia + ' · vence no ' + rule.vencimento_valor + 'º ' +
                  (rule.vencimento_tipo === 'dia_util' ? 'dia útil' : 'dia do mês') + '</small></div>' +
                '<button type="button" data-ac-edit-rule="' + rule.id + '">Editar</button></div>' +
              '</article>'
            ).join('') + '</div>'
          : '<div class="ac-empty ac-empty-compact">Nenhuma cobrança recorrente cadastrada.</div>') +
      '</div>';

    root.querySelector('#acNewExpense')?.addEventListener('click', showNewExpense);
    root.querySelector('#acNewRule')?.addEventListener('click', () => showRule(null));
    root.querySelectorAll('[data-ac-edit-rule]').forEach((btn) =>
      btn.addEventListener('click', () => showRule(A.rules.find((rule) => rule.id === btn.dataset.acEditRule) || null)));
    root.querySelectorAll('[data-ac-pay]').forEach((btn) =>
      btn.addEventListener('click', () => showPayment(btn.dataset.acPay)));
    root.querySelectorAll('[data-ac-review]').forEach((btn) =>
      btn.addEventListener('click', () => showReview(btn.dataset.acReview)));
    root.querySelectorAll('[data-ac-review-lot]').forEach((btn) =>
      btn.addEventListener('click', () => showReviewLot(btn.dataset.acReviewLot)));
    root.querySelectorAll('[data-ac-receipt]').forEach((btn) =>
      btn.addEventListener('click', () => downloadReceipt(btn.dataset.acReceipt)));
    root.querySelectorAll('[data-ac-proof]').forEach((btn) =>
      btn.addEventListener('click', () => openProof(btn.dataset.acProof)));
    root.querySelectorAll('[data-ac-lot-receipt]').forEach((btn) =>
      btn.addEventListener('click', () => downloadLotReceipt(btn.dataset.acLotReceipt)));
    root.querySelectorAll('[data-ac-lot-proof]').forEach((btn) =>
      btn.addEventListener('click', () => openLotProof(btn.dataset.acLotProof)));
    root.querySelectorAll('[data-ac-delete]').forEach((btn) =>
      btn.addEventListener('click', () => deleteAcerto(btn.dataset.acDelete)));
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
    const currentIsParticipant = A.users.some((u) => u.id === A.profile.id);
    const userOptions =
      (currentIsParticipant ? '' : '<option value="" selected disabled>Selecione quem pagou</option>') +
      A.users.map((u) =>
        '<option value="' + u.id + '"' + (u.id === A.profile.id ? ' selected' : '') + '>' + esc(u.nome) + '</option>'
      ).join('');

    const fields = A.users.map((u) =>
      '<label class="ac-field"><span>Parte de ' + esc(u.nome) + '</span>' +
        '<div class="ac-money-input"><span>R$</span>' +
          '<input type="number" min="0" step="0.01" inputmode="decimal" data-ac-share="' + u.id + '" value="" readonly>' +
        '</div></label>'
    ).join('');

    const root = modal(
      sheetHead('Nova despesa', 'Registrar compra ou gasto') +
      '<form class="ac-form ac-expense-form" id="acExpenseForm">' +
        '<section class="ac-form-section"><div class="ac-form-section-head"><strong>Dados da compra</strong><span>O básico para identificar a despesa.</span></div>' +
          '<label class="ac-field"><span>Descrição</span><input name="title" required placeholder="Ex.: Hospedagem em Natal"></label>' +
          '<div class="ac-grid-2 ac-grid-responsive">' +
            '<label class="ac-field"><span>Valor total</span><div class="ac-money-input"><span>R$</span>' +
              '<input name="total" type="number" min="0.01" step="0.01" inputmode="decimal" required value="' + totalDefault + '" placeholder="0,00"></div></label>' +
            '<label class="ac-field"><span>Quem pagou</span><select name="payer" required>' + userOptions + '</select></label>' +
          '</div></section>' +
        '<section class="ac-form-section ac-split"><div class="ac-split-head"><div><strong>Quem deve o quê</strong><span id="acSplitHint">50% para cada pessoa.</span></div>' +
          '<label class="ac-split-toggle"><input type="checkbox" id="acHalf" checked><span>Dividir 50% / 50%</span></label></div>' +
          '<div class="ac-grid-2 ac-grid-responsive ac-share-grid">' + fields + '</div></section>' +
        '<section class="ac-form-section"><div class="ac-form-section-head"><strong>Pagamento e vencimento</strong><span>Como essa compra entra nos acertos.</span></div>' +
          '<div class="ac-grid-2 ac-grid-responsive">' +
            '<label class="ac-field"><span>Parcelas</span><input name="installments" type="number" min="1" max="60" value="1" required></label>' +
            '<label class="ac-field"><span>Vencimento da 1ª</span><input name="due" type="date" required value="' + today() + '"></label>' +
          '</div>' +
          '<label class="ac-field"><span>Forma usada</span><select name="method"><option value="credit_card">Cartão de crédito</option><option value="pix">Pix</option><option value="debit">Débito</option><option value="cash">Dinheiro</option><option value="other">Outro</option></select></label>' +
          '<label class="ac-field"><span>Observação</span><textarea name="notes" placeholder="Opcional"></textarea></label></section>' +
        '<p class="ac-note">O LifeOS cria a dívida de quem não pagou. Se houver parcelas, os acertos acompanham os vencimentos mensais.</p>' +
        '<div id="acExpenseError"></div>' +
        '<div class="ac-form-actions"><button type="button" class="ac-secondary" data-ac-close>Cancelar</button><button class="ac-primary" type="submit">Criar despesa</button></div>' +
      '</form>'
    );

    const totalInput = root.querySelector('[name="total"]');
    const halfToggle = root.querySelector('#acHalf');
    const shareInputs = [...root.querySelectorAll('[data-ac-share]')];
    const splitHint = root.querySelector('#acSplitHint');
    const payerInput = root.querySelector('[name="payer"]');
    let manualDirty = false;

    const fillHalf = () => {
      const total = Math.max(0, Number(totalInput.value || 0));
      if (shareInputs.length !== 2) return;
      const first = Math.round((total / 2) * 100) / 100;
      const second = Math.round((total - first) * 100) / 100;
      shareInputs[0].value = first ? first.toFixed(2) : '';
      shareInputs[1].value = second ? second.toFixed(2) : '';
    };

    const fillFullToNonPayer = () => {
      const total = Math.max(0, Number(totalInput.value || 0));
      const payerId = String(payerInput?.value || '');
      const debtors = shareInputs.filter((input) => input.dataset.acShare !== payerId);
      const payerShare = shareInputs.find((input) => input.dataset.acShare === payerId);
      if (payerShare) payerShare.value = total ? '0.00' : '';
      if (!debtors.length) return;
      const base = Math.round((total / debtors.length) * 100) / 100;
      let used = 0;
      debtors.forEach((input, index) => {
        const value = index === debtors.length - 1 ? Math.max(0, total - used) : base;
        input.value = total ? value.toFixed(2) : '';
        used += value;
      });
      manualDirty = false;
    };

    const syncSplitMode = () => {
      const half = Boolean(halfToggle?.checked);
      shareInputs.forEach((input) => {
        input.readOnly = half;
      });
      root.querySelector('.ac-split')?.classList.toggle('is-manual', !half);
      if (half) {
        fillHalf();
        if (splitHint) splitHint.textContent = '50% para cada pessoa.';
      } else {
        fillFullToNonPayer();
        const payerId = String(payerInput?.value || '');
        const devedor = A.users.find((u) => u.id !== payerId);
        if (splitHint) splitHint.textContent = devedor
          ? 'Como ' + nameById(payerId) + ' pagou, ' + devedor.nome + ' começa devendo o valor total. Você pode ajustar.'
          : 'O valor total foi atribuído a quem não pagou. Você pode ajustar.';
      }
    };

    shareInputs.forEach((input) => input.addEventListener('input', () => {
      if (!halfToggle?.checked) manualDirty = true;
    }));

    halfToggle?.addEventListener('change', syncSplitMode);
    payerInput?.addEventListener('change', () => {
      if (halfToggle?.checked) fillHalf();
      else fillFullToNonPayer();
    });
    totalInput?.addEventListener('input', () => {
      if (halfToggle?.checked) fillHalf();
      else if (!manualDirty) fillFullToNonPayer();
    });
    syncSplitMode();

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

  async function deleteAcerto(acertoId) {
    const acerto = A.acertos.find((item) => item.id === acertoId);
    if (!acerto) return;

    const group = acerto.despesa_id
      ? A.acertos.filter((item) => item.despesa_id === acerto.despesa_id)
      : [acerto];

    const openGroup = group.filter((item) => item.status !== 'cancelado');
    const fromNordestrip = acerto.origem === 'nordestrip';
    const installmentText = openGroup.length > 1
      ? '\n\nEsta compra possui ' + openGroup.length + ' parcelas/acertos. Todos serão removidos juntos.'
      : '';

    const sourceText = fromNordestrip
      ? '\n\nComo este acerto veio do Nordestrip, a compra também será arquivada lá.'
      : '\n\nO histórico técnico será preservado, mas o acerto sairá da sua lista.';

    if (!confirm('Excluir “' + acerto.titulo + '”?' + installmentText + sourceText)) return;

    const originalAcertos = A.acertos.map((item) => ({ ...item }));
    const idsToHide = new Set(openGroup.map((item) => item.id));

    // Atualização otimista: a ação responde no toque, como no Nordestrip.
    A.acertos = A.acertos.map((item) =>
      idsToHide.has(item.id)
        ? { ...item, status: 'cancelado', cancelado_em: new Date().toISOString() }
        : item
    );
    renderCentral();
    window.lifeosToast?.('Acerto removido.', 'ok');

    const { data } = await A.client.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) {
      A.acertos = originalAcertos;
      renderCentral();
      window.lifeosToast?.('Sua sessão expirou. Entre novamente.', 'erro');
      return;
    }

    try {
      const response = await fetch('/api/acertos/' + acerto.id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.erro || 'Não foi possível excluir este acerto.');

      // Revalida em segundo plano sem segurar a resposta visual.
      load();
    } catch (e) {
      A.acertos = originalAcertos;
      renderCentral();
      window.lifeosToast?.(e.message || 'Não foi possível excluir este acerto.', 'erro');
    }
  }

  function showPayment(acertoId) {
    const acertoInicial = A.acertos.find((a) => a.id === acertoId);
    if (!acertoInicial) return;

    const cfg = configByUser(acertoInicial.credor_id);
    const elegiveis = A.acertos
      .filter((a) =>
        a.devedor_id === A.profile.id &&
        a.credor_id === acertoInicial.credor_id &&
        !['pago','cancelado'].includes(a.status) &&
        remaining(a) > 0.005 &&
        !paymentsFor(a.id).some((p) => p.status === 'aguardando_confirmacao') &&
        !pendingLotFor(a.id)
      )
      .sort((a, b) => String(a.vencimento || '').localeCompare(String(b.vencimento || '')));

    if (!elegiveis.length) return;

    const receive = cfg
      ? '<div class="ac-receive"><span>Enviar para ' + esc(nameById(acertoInicial.credor_id)) + '</span>' +
        '<strong>' + esc(cfg.banco || 'Pix') + '</strong><code>' + esc(maskKey(cfg.pix_chave)) + '</code>' +
        '<button type="button" class="ac-copy" id="acCopyPix">Copiar chave Pix</button></div>'
      : '<p class="ac-note warn">O recebedor ainda não cadastrou uma chave Pix no LifeOS. O comprovante pode ser enviado mesmo assim.</p>';

    const escolhas = elegiveis.map((a) =>
      '<label class="ac-pay-choice">' +
        '<input type="checkbox" data-ac-batch-id="' + a.id + '" data-ac-batch-value="' + remaining(a).toFixed(2) + '"' +
          (a.id === acertoInicial.id ? ' checked' : '') + '>' +
        '<span class="ac-pay-choice-copy"><strong>' + esc(a.titulo) + '</strong>' +
          '<small>Vence ' + date(a.vencimento) + '</small></span>' +
        '<b>' + money(remaining(a)) + '</b>' +
      '</label>'
    ).join('');

    const root = modal(
      sheetHead('Pagamento', 'O que você quer pagar agora?') +
      receive +
      '<form class="ac-form" id="acPayForm">' +
        '<div class="ac-pay-selection">' + escolhas + '</div>' +
        '<div class="ac-pay-total"><span>Total selecionado</span><strong id="acSelectedTotal">' + money(0) + '</strong></div>' +
        '<label class="ac-field"><span>Comprovante do Pix</span><input name="file" type="file" accept="application/pdf,image/png,image/jpeg" required></label>' +
        '<div id="acOcrStatus"></div>' +
        '<label class="ac-field"><span>Valor do Pix</span><div class="ac-money-input"><span>R$</span>' +
          '<input name="value" type="number" min="0.01" step="0.01" inputmode="decimal" required></div>' +
          '<small>O LifeOS preenche pelo comprovante quando consegue. Você só precisa corrigir se a leitura estiver errada.</small></label>' +
        '<div id="acPayVariance"></div>' +
        '<p class="ac-note">PDF e print são conferidos automaticamente. O comprovante original continua disponível para a validação do recebedor.</p>' +
        '<div id="acPayError"></div>' +
        '<div class="ac-form-actions"><button type="button" class="ac-secondary" data-ac-close>Cancelar</button><button class="ac-primary" type="submit">Enviar para confirmação</button></div>' +
      '</form>'
    );

    root.querySelector('#acCopyPix')?.addEventListener('click', async () => {
      if (!cfg?.pix_chave) return;
      await navigator.clipboard.writeText(cfg.pix_chave);
      root.querySelector('#acCopyPix').textContent = 'Copiado';
    });

    const boxes = [...root.querySelectorAll('[data-ac-batch-id]')];
    const valueInput = root.querySelector('[name="value"]');
    const totalEl = root.querySelector('#acSelectedTotal');
    const variance = root.querySelector('#acPayVariance');
    const fileInput = root.querySelector('[name="file"]');
    const ocrStatus = root.querySelector('#acOcrStatus');
    let valueTouched = false;
    let ocrBusy = false;
    let ocrValue = null;
    let ocrConfidence = null;

    const selected = () => boxes.filter((box) => box.checked);
    const selectedTotal = () => selected().reduce((sum, box) => sum + Number(box.dataset.acBatchValue || 0), 0);

    const renderVariance = () => {
      const total = selectedTotal();
      const value = Number(valueInput.value || 0);
      const diff = Math.round((value - total) * 100) / 100;
      if (!selected().length) {
        variance.innerHTML = '<p class="ac-note warn">Selecione ao menos uma cobrança.</p>';
        return;
      }
      if (!Number.isFinite(value) || value <= 0) {
        variance.innerHTML = '';
        return;
      }
      if (diff > 0.01) {
        variance.innerHTML = '<p class="ac-note warn">Você está pagando <strong>' + money(diff) + ' a mais</strong>. Depois da confirmação, esse valor ficará como crédito a seu favor no LifeOS.</p>';
      } else if (diff < -0.01) {
        variance.innerHTML = '<p class="ac-note warn">O Pix está <strong>' + money(Math.abs(diff)) + ' abaixo</strong> do total selecionado. O que faltar continuará em aberto.</p>';
      } else {
        variance.innerHTML = '<p class="ac-note ok">O valor do Pix fecha exatamente as cobranças selecionadas.</p>';
      }
    };

    const syncTotal = () => {
      const total = selectedTotal();
      totalEl.textContent = money(total);
      if (!valueTouched) valueInput.value = total ? total.toFixed(2) : '';
      renderVariance();
    };

    boxes.forEach((box) => box.addEventListener('change', syncTotal));
    valueInput.addEventListener('input', () => {
      valueTouched = true;
      renderVariance();
    });

    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      ocrValue = null;
      ocrConfidence = null;
      ocrStatus.innerHTML = '';
      if (!file) return;

      if (file.type === 'application/pdf') {
        ocrStatus.innerHTML = '<p class="ac-note">O PDF será lido pelo LifeOS ao enviar.</p>';
        return;
      }

      if (!['image/png','image/jpeg'].includes(file.type)) return;

      ocrBusy = true;
      const submit = root.querySelector('#acPayForm [type="submit"]');
      if (submit) submit.disabled = true;
      ocrStatus.innerHTML = '<p class="ac-note ac-ocr-reading">Lendo o print e procurando o valor do Pix…</p>';

      try {
        const leitura = await readImageProof(file);
        ocrValue = leitura.value;
        ocrConfidence = leitura.confidence;

        if (ocrValue != null) {
          valueInput.value = ocrValue.toFixed(2);
          valueTouched = true;
          renderVariance();
          ocrStatus.innerHTML = '<p class="ac-note ok"><strong>' + money(ocrValue) +
            '</strong> identificado no print' +
            (ocrConfidence != null ? ' · confiança OCR ' + ocrConfidence + '%' : '') + '.</p>';
        } else {
          valueInput.value = '';
          valueTouched = true;
          renderVariance();
          ocrStatus.innerHTML = '<p class="ac-note warn">Não consegui identificar o valor com segurança neste print. Digite o valor do Pix para continuar.</p>';
        }
      } catch (error) {
        valueInput.value = '';
        valueTouched = true;
        renderVariance();
        ocrStatus.innerHTML = '<p class="ac-note warn">Não consegui ler este print automaticamente. Digite o valor do Pix para continuar.</p>';
      } finally {
        ocrBusy = false;
        if (submit) submit.disabled = false;
      }
    });

    syncTotal();

    root.querySelector('#acPayForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const file = form.get('file');
      const value = Number(form.get('value'));
      const escolhidos = selected();
      const total = selectedTotal();
      const error = root.querySelector('#acPayError');

      if (!escolhidos.length) {
        error.innerHTML = '<p class="ac-note warn">Selecione ao menos uma cobrança.</p>';
        return;
      }

      if (!(file instanceof File) || !file.size) {
        error.innerHTML = '<p class="ac-note warn">Escolha um comprovante.</p>';
        return;
      }

      if (ocrBusy) {
        error.innerHTML = '<p class="ac-note warn">Ainda estou lendo o print. Aguarde alguns segundos.</p>';
        return;
      }

      const diff = Math.round((value - total) * 100) / 100;
      if (diff > 0.01) {
        if (!confirm('O Pix está ' + money(diff) + ' acima do total selecionado. Esse valor ficará como crédito a seu favor. Deseja continuar?')) return;
      } else if (diff < -0.01) {
        if (!confirm('O Pix está ' + money(Math.abs(diff)) + ' abaixo do total selecionado. O restante continuará em aberto. Deseja continuar?')) return;
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
        const response = await fetch('/api/acertos/pagamentos/lote/comprovante', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': file.type || 'application/octet-stream',
            'x-lifeos-tipo': file.type || 'application/octet-stream',
            'x-lifeos-valor': String(value),
            'x-lifeos-ocr-valor': ocrValue != null ? String(ocrValue) : '',
            'x-lifeos-ocr-confidence': ocrConfidence != null ? String(ocrConfidence) : '',
            'x-lifeos-acertos': escolhidos.map((box) => box.dataset.acBatchId).join(','),
            'x-lifeos-arquivo': encodeURIComponent(file.name),
          },
          body: file,
        });

        const body = await response.json();
        if (!response.ok) throw new Error(body.erro || 'Não foi possível enviar o comprovante.');

        closeModal();
        await load();

        if (body?.leitura?.divergencia_valor_informado) {
          const lido = body.leitura.valor_extraido != null ? money(body.leitura.valor_extraido) : 'outro valor';
          alert('Comprovante enviado. A leitura automática parece indicar ' + lido + ', diferente do valor informado. O recebedor verá essa diferença antes de confirmar.');
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
      (mismatch ? '<p class="ac-note warn">O valor identificado no comprovante é diferente do valor informado. Confira o documento antes de aprovar.</p>' : '') +
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

  function showReviewLot(loteId) {
    const lote = lotById(loteId);
    if (!lote) return;
    const itens = lotItemsFor(lote.id)
      .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
      .map((item) => ({ ...item, acerto: A.acertos.find((a) => a.id === item.acerto_id) || null }));

    const valorLido = Number(lote.valor_extraido) > 0 ? Number(lote.valor_extraido) : null;
    const valorInicial = valorLido ?? Number(lote.valor_informado || 0);
    const mismatch = lote.dados_extraidos?.divergencia_valor_informado;
    const root = modal(
      sheetHead('Confirmação do recebedor', itens.length === 1 ? '1 cobrança neste Pix' : itens.length + ' cobranças neste Pix') +
      '<div class="ac-payment-summary"><div><span>Total selecionado</span><strong>' + money(lote.valor_selecionado) + '</strong></div>' +
      '<div><span>Valor informado</span><strong>' + money(lote.valor_informado) + '</strong></div>' +
      '<div><span>Valor lido no comprovante</span><strong>' + (valorLido != null ? money(valorLido) : 'Não identificado') + '</strong></div></div>' +
      (mismatch ? '<p class="ac-note warn">A leitura do comprovante e o valor informado não batem. Confirme abaixo quanto realmente entrou antes de aprovar.</p>' : '') +
      '<div class="ac-review-items">' + itens.map((item) =>
        '<div class="ac-review-item"><span><strong>' + esc(item.acerto?.titulo || 'Cobrança') + '</strong>' +
        '<small>Saldo selecionado</small></span><b>' + money(item.valor_previsto) + '</b></div>'
      ).join('') + '</div>' +
      '<label class="ac-field"><span>Valor que entrou</span><div class="ac-money-input"><span>R$</span>' +
        '<input id="acReviewLotValue" type="number" min="0.01" step="0.01" inputmode="decimal" value="' + valorInicial.toFixed(2) + '"></div></label>' +
      '<div id="acReviewLotVariance"></div>' +
      '<div class="ac-actions" style="margin:10px 0 14px"><button type="button" id="acOpenLotProof">Ver comprovante original</button></div>' +
      '<label class="ac-field"><span>Motivo em caso de recusa</span><textarea id="acRejectLotReason" placeholder="Ex.: valor não recebido, comprovante incorreto..."></textarea></label>' +
      '<div id="acReviewLotError"></div>' +
      '<div class="ac-form-actions"><button type="button" class="ac-secondary" id="acRejectLot">Recusar</button><button type="button" class="ac-primary" id="acApproveLot">Confirmar recebimento</button></div>'
    );

    const input = root.querySelector('#acReviewLotValue');
    const variance = root.querySelector('#acReviewLotVariance');
    const updateVariance = () => {
      const value = Number(input.value || 0);
      const diff = Math.round((value - Number(lote.valor_selecionado || 0)) * 100) / 100;
      if (!Number.isFinite(value) || value <= 0) {
        variance.innerHTML = '';
      } else if (diff > 0.01) {
        variance.innerHTML = '<p class="ac-note warn">Há ' + money(diff) + ' a mais. Ao confirmar, esse valor vira crédito a favor de ' + esc(nameById(lote.devedor_id)) + '.</p>';
      } else if (diff < -0.01) {
        variance.innerHTML = '<p class="ac-note warn">Faltarão ' + money(Math.abs(diff)) + ' nas cobranças selecionadas. O saldo restante continuará em aberto.</p>';
      } else {
        variance.innerHTML = '<p class="ac-note ok">O valor recebido quita exatamente o total selecionado.</p>';
      }
    };
    input.addEventListener('input', updateVariance);
    updateVariance();

    root.querySelector('#acOpenLotProof')?.addEventListener('click', () => openLotProof(lote.id));

    const review = async (approve) => {
      const reason = String(root.querySelector('#acRejectLotReason')?.value || '').trim();
      const error = root.querySelector('#acReviewLotError');
      const buttons = root.querySelectorAll('#acRejectLot,#acApproveLot');
      const value = Number(input.value || 0);

      if (approve && (!Number.isFinite(value) || value <= 0)) {
        error.innerHTML = '<p class="ac-note warn">Informe quanto realmente entrou.</p>';
        return;
      }

      buttons.forEach((b) => { b.disabled = true; });
      const result = await A.client.rpc('revisar_pagamento_lote', {
        p_lote_id: lote.id,
        p_aprovar: approve,
        p_valor_confirmado: approve ? value : null,
        p_motivo: approve ? null : reason || 'Pagamento não confirmado pelo recebedor.',
      });

      if (result.error) {
        buttons.forEach((b) => { b.disabled = false; });
        error.innerHTML = '<p class="ac-note warn">' + esc(result.error.message) + '</p>';
        return;
      }

      closeModal();
      await load();
      if (approve) await downloadLotReceipt(lote.id);
    };

    root.querySelector('#acApproveLot')?.addEventListener('click', () => review(true));
    root.querySelector('#acRejectLot')?.addEventListener('click', () => review(false));
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

  async function openLotProof(loteId) {
    try {
      const response = await authFetch('/api/acertos/lotes/' + loteId + '/comprovante');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      alert(e.message);
    }
  }

  async function downloadLotReceipt(loteId) {
    try {
      const response = await authFetch('/api/acertos/lotes/' + loteId + '/recibo');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'recibo-lifeos-' + loteId + '.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      alert(e.message);
    }
  }

  function showRule(rule = null) {
    const editing = Boolean(rule?.id);
    const options = A.users.map((u) => '<option value="' + u.id + '">' + esc(u.nome) + '</option>').join('');
    const other = A.users.find((u) => u.id !== A.profile.id) || A.users[0] || null;
    const defaults = rule || {
      titulo: '',
      valor: '',
      devedor_id: other?.id || A.profile.id,
      credor_id: A.profile.id,
      gerar_dia: 1,
      vencimento_tipo: 'dia_mes',
      vencimento_valor: 5,
      inicia_em: today(),
      ativo: true,
    };

    const root = modal(
      sheetHead('Cobrança recorrente', editing ? 'Editar recorrência' : 'Nova cobrança mensal') +
      '<form class="ac-form ac-recurring-form" id="acRuleForm">' +
        '<section class="ac-form-section"><div class="ac-form-section-head"><strong>Cobrança</strong><span>O LifeOS cria um acerto novo a cada mês.</span></div>' +
          '<label class="ac-field"><span>Nome</span><input name="title" value="' + esc(defaults.titulo || '') + '" required placeholder="Ex.: El Hub"></label>' +
          '<div class="ac-grid-2 ac-grid-responsive"><label class="ac-field"><span>Valor mensal</span><div class="ac-money-input"><span>R$</span>' +
            '<input name="value" type="number" min="0.01" step="0.01" inputmode="decimal" value="' + (defaults.valor !== '' ? Number(defaults.valor).toFixed(2) : '') + '" required placeholder="0,00"></div></label>' +
          '<label class="ac-field"><span>Gerar todo dia</span><input name="generate" type="number" min="1" max="28" value="' + defaults.gerar_dia + '"></label></div>' +
        '</section>' +
        '<section class="ac-form-section"><div class="ac-form-section-head"><strong>Pessoas</strong><span>Quem deve e quem recebe.</span></div>' +
          '<div class="ac-grid-2 ac-grid-responsive"><label class="ac-field"><span>Quem paga</span><select name="debtor">' + options + '</select></label>' +
          '<label class="ac-field"><span>Quem recebe</span><select name="creditor">' + options + '</select></label></div>' +
        '</section>' +
        '<section class="ac-form-section"><div class="ac-form-section-head"><strong>Vencimento</strong><span>Define quando a cobrança mensal vence.</span></div>' +
          '<div class="ac-grid-2 ac-grid-responsive"><label class="ac-field"><span>Tipo</span><select name="dueType"><option value="dia_mes">Dia do mês</option><option value="dia_util">Dia útil</option></select></label>' +
          '<label class="ac-field"><span>Dia</span><input name="dueValue" type="number" min="1" max="28" value="' + defaults.vencimento_valor + '"></label></div>' +
          (!editing ? '<label class="ac-field"><span>Começa em</span><input name="starts" type="date" value="' + esc(defaults.inicia_em || today()) + '" required></label>' : '') +
          (editing ? '<label class="ac-field"><span>Status</span><select name="active"><option value="true">Ativa</option><option value="false">Pausada</option></select></label>' : '') +
        '</section>' +
        '<p class="ac-note">' + (editing
          ? 'Mudanças ajustam a regra e cobranças do mês atual/futuras ainda sem pagamento. Histórico pago não muda.'
          : 'Depois de salvar, o LifeOS gera automaticamente a cobrança de cada mês quando chegar o dia configurado.') + '</p>' +
        '<div id="acRuleError"></div>' +
        '<div class="ac-form-actions"><button type="button" class="ac-secondary" data-ac-close>Cancelar</button><button type="submit" class="ac-primary">' +
          (editing ? 'Salvar regra' : 'Criar recorrência') + '</button></div>' +
      '</form>'
    );

    root.querySelector('[name="debtor"]').value = defaults.devedor_id;
    root.querySelector('[name="creditor"]').value = defaults.credor_id;
    root.querySelector('[name="dueType"]').value = defaults.vencimento_tipo || 'dia_mes';
    if (editing) root.querySelector('[name="active"]').value = String(Boolean(defaults.ativo));

    root.querySelector('#acRuleForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const debtor = String(form.get('debtor'));
      const creditor = String(form.get('creditor'));
      const error = root.querySelector('#acRuleError');

      if (debtor === creditor) {
        error.innerHTML = '<p class="ac-note warn">Quem paga e quem recebe precisam ser pessoas diferentes.</p>';
        return;
      }

      const submit = event.currentTarget.querySelector('[type="submit"]');
      submit.disabled = true;
      submit.textContent = editing ? 'Salvando…' : 'Criando…';

      const result = editing
        ? await A.client.rpc('atualizar_regra_acerto', {
            p_regra_id: rule.id,
            p_titulo: String(form.get('title')).trim(),
            p_valor: Number(form.get('value')),
            p_devedor_id: debtor,
            p_credor_id: creditor,
            p_gerar_dia: Number(form.get('generate')),
            p_vencimento_tipo: String(form.get('dueType')),
            p_vencimento_valor: Number(form.get('dueValue')),
            p_ativo: String(form.get('active')) === 'true',
          })
        : await A.client.rpc('criar_regra_acerto_recorrente', {
            p_titulo: String(form.get('title')).trim(),
            p_valor: Number(form.get('value')),
            p_devedor_id: debtor,
            p_credor_id: creditor,
            p_gerar_dia: Number(form.get('generate')),
            p_vencimento_tipo: String(form.get('dueType')),
            p_vencimento_valor: Number(form.get('dueValue')),
            p_inicia_em: String(form.get('starts') || today()),
          });

      if (result.error) {
        submit.disabled = false;
        submit.textContent = editing ? 'Salvar regra' : 'Criar recorrência';
        error.innerHTML = '<p class="ac-note warn">' + esc(result.error.message) + '</p>';
        return;
      }

      if (!editing) {
        await A.client.rpc('gerar_acertos_recorrentes', { p_data: today() });
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
        } else if (n.entidade === 'acerto_pagamento_lotes' && n.entidade_id) {
          const lote = lotById(n.entidade_id);
          if (lote?.status === 'aguardando_confirmacao') {
            closeModal();
            showReviewLot(lote.id);
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

      const [users, acertos, payments, lots, lotItems, balances, rules, configs, notifications] = await Promise.all([
        A.client.from('usuarios').select('id,nome,casa_id').eq('casa_id', A.profile.casa_id).order('nome'),
        A.client.from('acertos').select('*').eq('casa_id', A.profile.casa_id).order('vencimento'),
        A.client.from('acerto_pagamentos').select('*').eq('casa_id', A.profile.casa_id).order('enviado_em', { ascending: false }),
        A.client.from('acerto_pagamento_lotes').select('*').eq('casa_id', A.profile.casa_id).order('enviado_em', { ascending: false }),
        A.client.from('acerto_pagamento_itens').select('*').order('ordem'),
        A.client.from('acerto_saldos').select('*').eq('casa_id', A.profile.casa_id),
        A.client.from('acerto_regras').select('*').eq('casa_id', A.profile.casa_id).order('criada_em'),
        A.client.from('financeiro_recebimento_config').select('*').eq('casa_id', A.profile.casa_id),
        A.client.from('notificacoes').select('*').eq('usuario_id', A.profile.id).order('criada_em', { ascending: false }).limit(30),
      ]);

      if (users.error) throw users.error;
      if (acertos.error) throw acertos.error;
      if (payments.error) throw payments.error;
      if (lots.error) throw lots.error;
      if (lotItems.error) throw lotItems.error;
      if (balances.error) throw balances.error;
      if (rules.error) throw rules.error;
      if (configs.error) throw configs.error;
      if (notifications.error) throw notifications.error;

      A.users = (users.data || []).filter((u) =>
        String(u.nome || '').trim().toLocaleLowerCase('pt-BR') !== 'casa'
      );
      A.acertos = acertos.data || [];
      A.payments = payments.data || [];
      A.lots = lots.data || [];
      A.lotItems = lotItems.data || [];
      A.balances = balances.data || [];
      A.rules = rules.data || [];
      A.configs = configs.data || [];
      A.notifications = notifications.data || [];

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

    if (context()) load();

    window.addEventListener('lifeos:ready', load);
    window.addEventListener('lifeos:financeiro-abrir', load);
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
