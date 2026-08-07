// LifeOS — Contas no Painel da Casa v1
// Lista, dados para pagamento e confirmação de pagamento no tablet.
(() => {
  'use strict';

  const SELECT_CONTAS = [
    'id',
    'nome',
    'categoria',
    'valor',
    'vencimento',
    'paga',
    'paga_em',
    'recorrente',
    'dia_vencimento',
    'origem',
    'fornecedor',
    'descricao_pagamento',
    'linha_digitavel',
    'pix_copia_cola',
    'qr_code_url',
    'documento_url',
  ].join(',');

  const SVG = {
    bill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 10h20"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m9 18 6-6-6-6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3h7v7M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 12 4 4L19 6"/></svg>',
    pix: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="m12 3 4.5 4.5L12 12 7.5 7.5 12 3Z"/><path d="m12 12 4.5 4.5L12 21l-4.5-4.5L12 12Z"/><path d="m3 12 4.5-4.5L12 12l-4.5 4.5L3 12Z"/><path d="m21 12-4.5-4.5L12 12l4.5 4.5L21 12Z"/></svg>',
    barcode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5v14M7 5v14M10 5v14M14 5v14M17 5v14M21 5v14"/></svg>',
  };

  let contas = [];
  let filtro = 'pendentes';
  let carregando = false;
  let geradorPromise = null;
  let observer = null;
  let reloadTimer = null;

  function carregarCss() {
    if (document.getElementById('tablet-contas-css')) return;
    const link = document.createElement('link');
    link.id = 'tablet-contas-css';
    link.rel = 'stylesheet';
    link.href = '/tablet-contas.css?v=1';
    document.head.appendChild(link);
  }

  function contextoPronto() {
    return typeof supa !== 'undefined'
      && Boolean(supa)
      && typeof usuario !== 'undefined'
      && Boolean(usuario?.id && usuario?.casa_id);
  }

  function escapar(valor = '') {
    return String(valor)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function dinheiro(valor) {
    if (valor === null || valor === undefined || valor === '') return 'Valor não informado';
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return 'Valor não informado';
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function dataPt(valor) {
    if (!valor) return 'Sem vencimento';
    const texto = String(valor).slice(0, 10);
    return new Date(`${texto}T12:00:00`).toLocaleDateString('pt-BR');
  }

  function diasParaVencer(valor) {
    if (!valor) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(`${String(valor).slice(0, 10)}T00:00:00`);
    return Math.round((vencimento - hoje) / 86400000);
  }

  function situacao(conta) {
    if (conta.paga) return { texto: 'Paga', classe: 'paga' };
    const dias = diasParaVencer(conta.vencimento);
    if (dias === null) return { texto: 'Sem vencimento', classe: 'proxima' };
    if (dias < 0) {
      const atraso = Math.abs(dias);
      return { texto: `${atraso} ${atraso === 1 ? 'dia vencida' : 'dias vencida'}`, classe: 'vencida' };
    }
    if (dias === 0) return { texto: 'Vence hoje', classe: 'hoje' };
    if (dias === 1) return { texto: 'Vence amanhã', classe: 'proxima' };
    return { texto: `Vence em ${dias} dias`, classe: 'proxima' };
  }

  function meios(conta) {
    const lista = [];
    if (conta.pix_copia_cola || conta.qr_code_url) lista.push('Pix');
    if (conta.linha_digitavel) lista.push('Boleto');
    if (conta.documento_url) lista.push('Documento');
    if (conta.descricao_pagamento && !lista.length) lista.push('Instruções');
    return lista;
  }

  function ordenar(lista) {
    return [...lista].sort((a, b) => {
      if (a.paga !== b.paga) return Number(a.paga) - Number(b.paga);
      if (!a.vencimento && !b.vencimento) return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
      if (!a.vencimento) return 1;
      if (!b.vencimento) return -1;
      return String(a.vencimento).localeCompare(String(b.vencimento));
    });
  }

  async function carregarContas(force = false) {
    if (carregando && !force) return contas;
    if (!contextoPronto()) return contas;

    carregando = true;
    try {
      const { data, error } = await supa
        .from('contas')
        .select(SELECT_CONTAS)
        .eq('casa_id', usuario.casa_id)
        .order('paga')
        .order('vencimento', { nullsFirst: false });

      if (error) throw error;
      contas = ordenar(data || []);
      return contas;
    } finally {
      carregando = false;
    }
  }

  function listaFiltrada() {
    if (filtro === 'pagas') return contas.filter(conta => conta.paga);
    return contas.filter(conta => !conta.paga);
  }

  function resumoPendentes() {
    const pendentes = contas.filter(conta => !conta.paga);
    const total = pendentes.reduce((soma, conta) => {
      const valor = Number(conta.valor);
      return soma + (Number.isFinite(valor) ? valor : 0);
    }, 0);
    return { quantidade: pendentes.length, total };
  }

  function htmlMeios(conta) {
    const itens = meios(conta);
    if (!itens.length) return '<span class="tcf-meio tcf-meio-vazio">Sem dados de pagamento</span>';
    return itens.map(item => `<span class="tcf-meio">${escapar(item)}</span>`).join('');
  }

  function renderizarLista() {
    const area = document.getElementById('pagContasLista');
    if (!area) return;

    const lista = listaFiltrada();
    const resumo = resumoPendentes();
    const pagas = contas.filter(conta => conta.paga).length;

    area.innerHTML = `
      <section class="tcf-root" data-tcf-root>
        <header class="tcf-page-head">
          <div>
            <span class="tcf-kicker">Central Financeira</span>
            <h2>Contas da Casa</h2>
            <p>Abra uma conta para exibir os dados de pagamento no tablet.</p>
          </div>
          <div class="tcf-summary">
            <span>${resumo.quantidade} ${resumo.quantidade === 1 ? 'pendente' : 'pendentes'}</span>
            <strong>${dinheiro(resumo.total)}</strong>
          </div>
        </header>

        <nav class="tcf-filters" aria-label="Filtro de contas">
          <button type="button" class="${filtro === 'pendentes' ? 'ativo' : ''}" data-tcf-filter="pendentes">
            Pendentes <span>${resumo.quantidade}</span>
          </button>
          <button type="button" class="${filtro === 'pagas' ? 'ativo' : ''}" data-tcf-filter="pagas">
            Pagas <span>${pagas}</span>
          </button>
        </nav>

        <div class="tcf-list">
          ${lista.length ? lista.map(conta => {
            const status = situacao(conta);
            return `
              <button type="button" class="tcf-row" data-tcf-id="${escapar(conta.id)}">
                <span class="tcf-row-icon">${SVG.bill}</span>
                <span class="tcf-row-main">
                  <span class="tcf-row-name">${escapar(conta.nome || 'Conta')}</span>
                  <span class="tcf-row-meta">
                    ${escapar(conta.fornecedor || conta.categoria || 'Conta da Casa')}
                    <span aria-hidden="true">·</span>
                    ${escapar(dataPt(conta.vencimento))}
                  </span>
                  <span class="tcf-row-meios">${htmlMeios(conta)}</span>
                </span>
                <span class="tcf-row-value">
                  <strong>${escapar(dinheiro(conta.valor))}</strong>
                  <small class="${status.classe}">${escapar(status.texto)}</small>
                </span>
                <span class="tcf-row-chevron">${SVG.chevron}</span>
              </button>`;
          }).join('') : `
            <div class="tcf-empty">
              ${SVG.check}
              <strong>${filtro === 'pendentes' ? 'Nenhuma conta pendente' : 'Nenhuma conta paga'}</strong>
              <span>${filtro === 'pendentes' ? 'Quando houver um vencimento, ele aparecerá aqui.' : 'As contas marcadas como pagas aparecerão aqui.'}</span>
            </div>`}
        </div>
      </section>`;

    area.querySelectorAll('[data-tcf-filter]').forEach(botao => {
      botao.addEventListener('click', () => {
        filtro = botao.dataset.tcfFilter;
        renderizarLista();
      });
    });

    area.querySelectorAll('[data-tcf-id]').forEach(botao => {
      botao.addEventListener('click', () => {
        const conta = contas.find(item => String(item.id) === String(botao.dataset.tcfId));
        if (conta) abrirConta(conta);
      });
    });
  }

  async function abrirPaginaContas() {
    if (!document.getElementById('pag-contas')?.classList.contains('ativa')) return;
    const area = document.getElementById('pagContasLista');
    if (!area) return;

    if (!area.querySelector('[data-tcf-root]')) {
      area.innerHTML = '<div class="tcf-loading">Carregando contas…</div>';
    }

    try {
      await carregarContas(true);
      if (document.getElementById('pag-contas')?.classList.contains('ativa')) renderizarLista();
      prepararContasHome();
    } catch (erro) {
      console.error('[Contas Tablet] Falha ao carregar:', erro);
      area.innerHTML = `
        <div class="tcf-error">
          <strong>Não foi possível carregar as contas.</strong>
          <button type="button" data-tcf-retry>Tentar novamente</button>
        </div>`;
      area.querySelector('[data-tcf-retry]')?.addEventListener('click', abrirPaginaContas);
    }
  }

  function somenteDigitos(valor) {
    return String(valor || '').replace(/\D/g, '');
  }

  function codigoBarrasBoleto(linhaDigitavel) {
    const digitos = somenteDigitos(linhaDigitavel);
    if (digitos.length === 44) return digitos;
    if (digitos.length === 47) {
      return [
        digitos.slice(0, 4),
        digitos.slice(32, 33),
        digitos.slice(33, 47),
        digitos.slice(4, 9),
        digitos.slice(10, 20),
        digitos.slice(21, 31),
      ].join('');
    }
    if (digitos.length === 48) {
      return [
        digitos.slice(0, 11),
        digitos.slice(12, 23),
        digitos.slice(24, 35),
        digitos.slice(36, 47),
      ].join('');
    }
    return null;
  }

  function carregarGerador() {
    if (window.bwipjs) return Promise.resolve(window.bwipjs);
    if (geradorPromise) return geradorPromise;

    geradorPromise = new Promise((resolve, reject) => {
      const existente = document.querySelector('script[data-tcf-bwip]');
      if (existente) {
        existente.addEventListener('load', () => resolve(window.bwipjs), { once: true });
        existente.addEventListener('error', () => reject(new Error('Gerador indisponível.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/bwip-js@4.10.2/dist/bwip-js-min.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.tcfBwip = '1';
      script.addEventListener('load', () => window.bwipjs ? resolve(window.bwipjs) : reject(new Error('Gerador não carregado.')), { once: true });
      script.addEventListener('error', () => {
        geradorPromise = null;
        reject(new Error('Não foi possível carregar o gerador.'));
      }, { once: true });
      document.head.appendChild(script);
    });

    return geradorPromise;
  }

  async function desenharCodigos(modal, conta) {
    const canvasPix = modal.querySelector('[data-tcf-canvas="pix"]');
    const canvasBoleto = modal.querySelector('[data-tcf-canvas="boleto"]');

    if (!canvasPix && !canvasBoleto) return;

    try {
      const bwipjs = await carregarGerador();

      if (canvasPix && conta.pix_copia_cola) {
        bwipjs.toCanvas(canvasPix, {
          bcid: 'qrcode',
          text: conta.pix_copia_cola,
          scale: 5,
          padding: 4,
          eclevel: 'M',
        });
        modal.querySelector('[data-tcf-status="pix"]')?.remove();
      }

      if (canvasBoleto) {
        bwipjs.toCanvas(canvasBoleto, {
          bcid: 'interleaved2of5',
          text: canvasBoleto.dataset.codigo,
          scale: 2,
          height: 18,
          padding: 4,
        });
        modal.querySelector('[data-tcf-status="boleto"]')?.remove();
      }
    } catch (erro) {
      console.error('[Contas Tablet] Código visual indisponível:', erro);
      modal.querySelectorAll('.tcf-code-status').forEach(status => {
        status.textContent = 'Código visual indisponível. Use o botão de copiar.';
        status.classList.add('erro');
      });
    }
  }

  function pagamentoHtml(conta) {
    const codigoBarras = codigoBarrasBoleto(conta.linha_digitavel);
    const temPix = Boolean(conta.pix_copia_cola || conta.qr_code_url);
    const temBoleto = Boolean(conta.linha_digitavel);
    const temDocumento = Boolean(conta.documento_url);
    const temInstrucao = Boolean(conta.descricao_pagamento);

    if (!temPix && !temBoleto && !temDocumento && !temInstrucao) {
      return `
        <div class="tcf-no-payment">
          ${SVG.bill}
          <strong>Dados de pagamento não cadastrados</strong>
          <span>Adicione Pix, boleto ou instruções pela Central Financeira no celular.</span>
        </div>`;
    }

    return `
      <div class="tcf-payment-tabs" role="tablist" aria-label="Forma de pagamento">
        ${temPix ? '<button type="button" class="ativo" data-tcf-tab="pix">Pix</button>' : ''}
        ${temBoleto ? `<button type="button" class="${temPix ? '' : 'ativo'}" data-tcf-tab="boleto">Boleto</button>` : ''}
        ${(temInstrucao || temDocumento) ? `<button type="button" class="${!temPix && !temBoleto ? 'ativo' : ''}" data-tcf-tab="instrucoes">Instruções</button>` : ''}
      </div>

      ${temPix ? `
        <section class="tcf-payment-panel ativo" data-tcf-panel="pix">
          <div class="tcf-code-box tcf-qr-box">
            ${conta.qr_code_url
              ? `<img src="${escapar(conta.qr_code_url)}" alt="QR Code Pix">`
              : '<canvas data-tcf-canvas="pix" aria-label="QR Code Pix"></canvas>'}
            <div class="tcf-code-status" data-tcf-status="pix">Gerando QR Code…</div>
          </div>
          <p>Abra o aplicativo do banco no celular e escaneie este QR Code.</p>
          ${conta.pix_copia_cola ? `<button type="button" class="tcf-secondary-action" data-tcf-copy="${escapar(conta.pix_copia_cola)}">${SVG.copy}<span>Copiar Pix</span></button>` : ''}
        </section>` : ''}

      ${temBoleto ? `
        <section class="tcf-payment-panel ${temPix ? '' : 'ativo'}" data-tcf-panel="boleto">
          ${codigoBarras ? `
            <div class="tcf-code-box tcf-barcode-box">
              <canvas data-tcf-canvas="boleto" data-codigo="${escapar(codigoBarras)}" aria-label="Código de barras do boleto"></canvas>
              <div class="tcf-code-status" data-tcf-status="boleto">Gerando código de barras…</div>
            </div>` : `
            <div class="tcf-code-warning">A linha digitável pode ser copiada, mas não tem um formato compatível com a geração do código de barras.</div>`}
          <div class="tcf-line-code">${escapar(conta.linha_digitavel || '')}</div>
          <button type="button" class="tcf-secondary-action" data-tcf-copy="${escapar(conta.linha_digitavel || '')}">${SVG.copy}<span>Copiar linha digitável</span></button>
        </section>` : ''}

      ${(temInstrucao || temDocumento) ? `
        <section class="tcf-payment-panel ${!temPix && !temBoleto ? 'ativo' : ''}" data-tcf-panel="instrucoes">
          ${temInstrucao ? `<div class="tcf-instructions">${escapar(conta.descricao_pagamento)}</div>` : ''}
          ${temDocumento ? `<button type="button" class="tcf-secondary-action" data-tcf-open="${escapar(conta.documento_url)}">${SVG.external}<span>Abrir documento</span></button>` : ''}
        </section>` : ''}`;
  }

  function abrirConta(conta) {
    fecharModal();

    const status = situacao(conta);
    const modal = document.createElement('div');
    modal.id = 'tabletContaModal';
    modal.className = 'tcf-modal';
    modal.dataset.contaId = conta.id;

    modal.innerHTML = `
      <section class="tcf-dialog" role="dialog" aria-modal="true" aria-label="Detalhes da conta">
        <header class="tcf-dialog-head">
          <div>
            <span class="tcf-kicker">${conta.paga ? 'Conta paga' : 'Conta pendente'}</span>
            <h2>${escapar(conta.nome || 'Conta')}</h2>
            <p>${escapar(conta.fornecedor || conta.categoria || 'Conta da Casa')}</p>
          </div>
          <button type="button" class="tcf-close" data-tcf-close aria-label="Fechar">${SVG.close}</button>
        </header>

        <div class="tcf-dialog-body">
          <aside class="tcf-account-details">
            <div class="tcf-amount">${escapar(dinheiro(conta.valor))}</div>
            <span class="tcf-status ${status.classe}">${escapar(status.texto)}</span>

            <dl>
              <div><dt>Vencimento</dt><dd>${escapar(dataPt(conta.vencimento))}</dd></div>
              ${conta.categoria ? `<div><dt>Categoria</dt><dd>${escapar(conta.categoria)}</dd></div>` : ''}
              ${conta.recorrente ? '<div><dt>Recorrência</dt><dd>Conta recorrente</dd></div>' : ''}
              ${conta.paga_em ? `<div><dt>Pagamento</dt><dd>${escapar(new Date(conta.paga_em).toLocaleString('pt-BR'))}</dd></div>` : ''}
            </dl>

            ${!conta.paga ? `
              <div class="tcf-payment-note">O LifeOS não realiza o pagamento. Use o banco e confirme aqui depois.</div>
              <div class="tcf-paid-actions">
                <button type="button" class="tcf-mark-paid" data-tcf-mark-paid>${SVG.check}<span>Marcar como paga</span></button>
                <button type="button" class="tcf-cancel-confirm" data-tcf-cancel-confirm hidden>Cancelar</button>
              </div>` : `
              <div class="tcf-paid-ok">${SVG.check}<span>Pagamento registrado no LifeOS</span></div>`}
          </aside>

          <main class="tcf-payment-area">
            <span class="tcf-payment-label">Dados para pagamento</span>
            ${pagamentoHtml(conta)}
            <div class="tcf-feedback" role="status" aria-live="polite"></div>
          </main>
        </div>
      </section>`;

    modal.addEventListener('click', evento => {
      if (evento.target === modal || evento.target.closest('[data-tcf-close]')) {
        fecharModal();
        return;
      }

      const aba = evento.target.closest('[data-tcf-tab]');
      if (aba) {
        modal.querySelectorAll('[data-tcf-tab]').forEach(item => item.classList.toggle('ativo', item === aba));
        modal.querySelectorAll('[data-tcf-panel]').forEach(painel => painel.classList.toggle('ativo', painel.dataset.tcfPanel === aba.dataset.tcfTab));
        return;
      }

      const copiar = evento.target.closest('[data-tcf-copy]');
      if (copiar) {
        copiarTexto(copiar.dataset.tcfCopy, modal);
        return;
      }

      const abrir = evento.target.closest('[data-tcf-open]');
      if (abrir) {
        window.open(abrir.dataset.tcfOpen, '_blank', 'noopener,noreferrer');
        return;
      }

      const cancelar = evento.target.closest('[data-tcf-cancel-confirm]');
      if (cancelar) {
        cancelarConfirmacao(modal);
        return;
      }

      const marcar = evento.target.closest('[data-tcf-mark-paid]');
      if (marcar) tratarMarcarPaga(conta, modal, marcar);
    });

    document.body.appendChild(modal);
    desenharCodigos(modal, conta);
  }

  function fecharModal() {
    document.getElementById('tabletContaModal')?.remove();
  }

  async function copiarTexto(texto, modal) {
    if (!texto) return;
    const feedback = modal.querySelector('.tcf-feedback');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const campo = document.createElement('textarea');
        campo.value = texto;
        campo.style.position = 'fixed';
        campo.style.opacity = '0';
        document.body.appendChild(campo);
        campo.select();
        document.execCommand('copy');
        campo.remove();
      }
      feedback.textContent = 'Copiado.';
      feedback.classList.remove('erro');
    } catch {
      feedback.textContent = 'Não foi possível copiar. Toque e segure o código para selecioná-lo.';
      feedback.classList.add('erro');
    }
  }

  function cancelarConfirmacao(modal) {
    const marcar = modal.querySelector('[data-tcf-mark-paid]');
    const cancelar = modal.querySelector('[data-tcf-cancel-confirm]');
    if (!marcar || !cancelar) return;
    marcar.dataset.confirming = '';
    marcar.innerHTML = `${SVG.check}<span>Marcar como paga</span>`;
    cancelar.hidden = true;
  }

  async function tratarMarcarPaga(conta, modal, botao) {
    const cancelar = modal.querySelector('[data-tcf-cancel-confirm]');
    const feedback = modal.querySelector('.tcf-feedback');

    if (botao.dataset.confirming !== '1') {
      botao.dataset.confirming = '1';
      botao.innerHTML = `${SVG.check}<span>Confirmar: já paguei</span>`;
      cancelar.hidden = false;
      feedback.textContent = 'Confirme somente depois de concluir o pagamento no banco.';
      feedback.classList.remove('erro');
      return;
    }

    botao.disabled = true;
    cancelar.disabled = true;
    botao.innerHTML = '<span>Registrando…</span>';

    try {
      const agora = new Date().toISOString();
      const { error } = await supa
        .from('contas')
        .update({
          paga: true,
          paga_em: agora,
          pago_por: usuario.id,
          atualizado_em: agora,
        })
        .eq('id', conta.id)
        .eq('casa_id', usuario.casa_id);

      if (error) throw error;

      conta.paga = true;
      conta.paga_em = agora;
      fecharModal();
      await carregarContas(true);
      renderizarLista();

      if (typeof atualizarDadosTablet === 'function') await atualizarDadosTablet();
      else if (typeof carregarTudo === 'function') await carregarTudo();
    } catch (erro) {
      console.error('[Contas Tablet] Falha ao marcar pagamento:', erro);
      botao.disabled = false;
      cancelar.disabled = false;
      feedback.textContent = 'Não foi possível registrar o pagamento. Tente novamente.';
      feedback.classList.add('erro');
      cancelarConfirmacao(modal);
    }
  }

  function prepararContasHome() {
    const rows = [...document.querySelectorAll('#painelContas .conta-row')];
    if (!rows.length) return;

    const limite = new Date(Date.now() + 15 * 86400000);
    limite.setHours(23, 59, 59, 999);

    const proximas = contas
      .filter(conta => !conta.paga && conta.vencimento)
      .filter(conta => new Date(`${String(conta.vencimento).slice(0, 10)}T12:00:00`) <= limite)
      .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)))
      .slice(0, rows.length);

    rows.forEach((row, indice) => {
      const conta = proximas[indice];
      if (!conta) return;
      row.dataset.tcfHomeId = conta.id;
      row.setAttribute('aria-label', `Abrir ${conta.nome}`);
    });
  }

  function interceptarContaHome(evento) {
    const row = evento.target.closest?.('#painelContas .conta-row[data-tcf-home-id]');
    if (!row) return;
    const conta = contas.find(item => String(item.id) === String(row.dataset.tcfHomeId));
    if (!conta) return;

    evento.preventDefault();
    evento.stopPropagation();
    evento.stopImmediatePropagation?.();
    abrirConta(conta);
  }

  function agendarReload() {
    window.clearTimeout(reloadTimer);
    reloadTimer = window.setTimeout(() => {
      const ativa = document.getElementById('pag-contas')?.classList.contains('ativa');
      const area = document.getElementById('pagContasLista');
      if (ativa && area && !area.querySelector('[data-tcf-root]')) abrirPaginaContas();
      if (contextoPronto() && !contas.length) {
        carregarContas().then(prepararContasHome).catch(() => {});
      }
    }, 140);
  }

  function iniciarObserver() {
    const pagina = document.getElementById('pag-contas');
    const lista = document.getElementById('pagContasLista');
    if (!pagina || !lista) return false;

    observer = new MutationObserver(agendarReload);
    observer.observe(pagina, { attributes: true, attributeFilter: ['class'] });
    observer.observe(lista, { childList: true, subtree: true });
    return true;
  }

  function iniciar() {
    carregarCss();
    document.addEventListener('click', interceptarContaHome, true);

    const tentar = () => {
      if (!iniciarObserver()) {
        window.setTimeout(tentar, 250);
        return;
      }

      carregarContas()
        .then(() => {
          prepararContasHome();
          if (document.getElementById('pag-contas')?.classList.contains('ativa')) renderizarLista();
        })
        .catch(erro => console.error('[Contas Tablet] Inicialização:', erro));

      agendarReload();
    };

    tentar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
