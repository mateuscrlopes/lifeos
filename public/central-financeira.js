// LifeOS — Central Financeira
// Owner oficial da superfície financeira mobile. Não renderiza nem observa a tela Hoje.

let cfClient = null;
let cfProfile = null;
let cfContas = [];
let cfFiltro = 'pendentes';
let cfCarregando = false;
let cfBwipPromise = null;

const cfEscapar = (valor = '') => String(valor)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const cfDinheiro = valor => valor === null || valor === undefined || valor === ''
  ? 'Valor não informado'
  : Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const cfData = valor => valor
  ? new Date(`${String(valor).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
  : 'Sem vencimento';

function cfToast(mensagem, tipo = 'ok') {
  if (typeof window.lifeosToast === 'function') window.lifeosToast(mensagem, tipo);
  else console[tipo === 'erro' ? 'error' : 'info'](`[Central Financeira] ${mensagem}`);
}

function cfDias(valor) {
  if (!valor) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(`${String(valor).slice(0, 10)}T00:00:00`);
  return Math.round((vencimento - hoje) / 86400000);
}

function cfSituacao(conta) {
  if (conta.paga) return { texto: 'Pago', classe: 'paga' };
  const dias = cfDias(conta.vencimento);
  if (dias === null) return { texto: 'Sem vencimento', classe: 'proxima' };
  if (dias < 0) {
    const quantidade = Math.abs(dias);
    return { texto: `${quantidade} ${quantidade === 1 ? 'dia vencida' : 'dias vencida'}`, classe: 'vencida' };
  }
  if (dias === 0) return { texto: 'Vence hoje', classe: 'hoje' };
  if (dias === 1) return { texto: 'Vence amanhã', classe: 'proxima' };
  return { texto: `Vence em ${dias} dias`, classe: 'proxima' };
}

function cfObterContexto() {
  const contexto = window.lifeosContext;
  if (!contexto?.supa || !contexto?.usuario) return false;
  cfClient = contexto.supa;
  cfProfile = contexto.usuario;
  return true;
}

async function cfCarregar() {
  if (cfCarregando) return cfContas;
  if (!cfObterContexto()) return cfContas;
  cfCarregando = true;
  try {
    const resultado = await cfClient
      .from('contas')
      .select([
        'id', 'nome', 'categoria', 'valor', 'vencimento', 'paga', 'paga_em',
        'recorrente', 'dia_vencimento', 'origem', 'fornecedor', 'descricao_pagamento',
        'linha_digitavel', 'pix_copia_cola', 'qr_code_url', 'documento_url',
      ].join(','))
      .eq('casa_id', cfProfile.casa_id)
      .order('paga')
      .order('vencimento');
    if (resultado.error) throw resultado.error;
    cfContas = resultado.data || [];
    return cfContas;
  } finally {
    cfCarregando = false;
  }
}

function cfAbrirCentral() {
  if (typeof window.trocarAba === 'function') window.trocarAba('financeiro');
  else document.querySelector('.tab-btn[data-tab="financeiro"]')?.click();
  window.setTimeout(() => document.getElementById('cfCentral')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

function cfMeiosPagamento(conta) {
  const meios = [];
  if (conta.pix_copia_cola) meios.push('Pix');
  if (conta.linha_digitavel) meios.push('Boleto');
  if (conta.qr_code_url) meios.push('QR Code');
  if (conta.documento_url) meios.push('Documento');
  if (conta.descricao_pagamento && !meios.length) meios.push('Instruções');
  return meios;
}

function cfCriarOverlay(html, { onClose = null, initialSelector = null } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'cf-modal';
  overlay.hidden = true;
  overlay.innerHTML = html;

  const fechar = () => {
    if (window.LifeOSModal?.close) window.LifeOSModal.close(overlay);
    else overlay.hidden = true;
    overlay.remove();
    onClose?.();
  };

  overlay.addEventListener('click', evento => {
    if (evento.target === overlay || evento.target.closest('[data-lifeos-close]')) {
      evento.preventDefault();
      evento.stopPropagation();
      fechar();
    }
  });

  document.body.appendChild(overlay);
  const initialFocus = initialSelector ? overlay.querySelector(initialSelector) : null;
  if (window.LifeOSModal?.open) window.LifeOSModal.open(overlay, { initialFocus });
  else {
    overlay.hidden = false;
    initialFocus?.focus?.();
  }
  return { overlay, fechar };
}

function cfValorCampo(valor) {
  return cfEscapar(valor || '');
}

async function cfSalvarDadosPagamento(conta, formulario, botao) {
  const dados = new FormData(formulario);
  const limpar = nome => String(dados.get(nome) || '').trim() || null;
  botao.disabled = true;
  botao.textContent = 'Salvando…';
  try {
    const resultado = await cfClient
      .from('contas')
      .update({
        fornecedor: limpar('fornecedor'),
        pix_copia_cola: limpar('pix_copia_cola'),
        linha_digitavel: limpar('linha_digitavel'),
        descricao_pagamento: limpar('descricao_pagamento'),
        qr_code_url: limpar('qr_code_url'),
        documento_url: limpar('documento_url'),
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', conta.id);
    if (resultado.error) throw resultado.error;
    await cfAtualizar();
    cfToast('Dados de pagamento salvos.');
    return cfContas.find(item => String(item.id) === String(conta.id)) || conta;
  } catch (erro) {
    console.error('[Central Financeira]', erro);
    cfToast('Não foi possível salvar os dados de pagamento.', 'erro');
    return null;
  } finally {
    botao.disabled = false;
    botao.textContent = 'Salvar dados';
  }
}

function cfAbrirEditorPagamento(conta) {
  const html = `
    <section class="cf-modal-conteudo cf-editor-conteudo" role="dialog" aria-modal="true" aria-label="Editar dados de pagamento">
      <header class="cf-modal-cabecalho">
        <div><span class="cf-modal-kicker">Configuração da conta</span><h3>Dados de pagamento</h3><p>${cfEscapar(conta.nome)}</p></div>
        <button type="button" class="cf-modal-fechar" data-lifeos-close aria-label="Fechar">×</button>
      </header>
      <p class="cf-editor-intro">Preencha somente os dados usados nesta conta. Os campos vazios não aparecem no momento do pagamento.</p>
      <form class="cf-editor-form" data-cf-editor-form>
        <label class="cf-editor-campo"><span>Fornecedor ou beneficiário</span><input name="fornecedor" type="text" maxlength="160" value="${cfValorCampo(conta.fornecedor)}" placeholder="Ex.: Enel, condomínio, imobiliária"></label>
        <label class="cf-editor-campo"><span>Pix copia e cola</span><textarea name="pix_copia_cola" rows="3" placeholder="Cole aqui o código Pix completo">${cfValorCampo(conta.pix_copia_cola)}</textarea></label>
        <label class="cf-editor-campo"><span>Linha digitável do boleto</span><textarea name="linha_digitavel" rows="2" inputmode="numeric" placeholder="Cole a linha digitável">${cfValorCampo(conta.linha_digitavel)}</textarea></label>
        <label class="cf-editor-campo"><span>Como pagar</span><textarea name="descricao_pagamento" rows="3" placeholder="Ex.: pagar pelo aplicativo da administradora">${cfValorCampo(conta.descricao_pagamento)}</textarea></label>
        <label class="cf-editor-campo"><span>Endereço da imagem do QR Code</span><input name="qr_code_url" type="url" value="${cfValorCampo(conta.qr_code_url)}" placeholder="https://..."><small>Use quando a imagem do QR Code já estiver hospedada.</small></label>
        <label class="cf-editor-campo"><span>Endereço do boleto ou documento</span><input name="documento_url" type="url" value="${cfValorCampo(conta.documento_url)}" placeholder="https://..."></label>
        <div class="cf-editor-acoes"><button type="button" class="cf-acao-secundaria" data-lifeos-close>Cancelar</button><button type="submit" class="cf-acao-principal">Salvar dados</button></div>
      </form>
    </section>`;

  const { overlay, fechar } = cfCriarOverlay(html, { onClose: () => cfAbrirConta(conta), initialSelector: '[name="fornecedor"]' });
  const formulario = overlay.querySelector('[data-cf-editor-form]');
  formulario?.addEventListener('submit', async evento => {
    evento.preventDefault();
    const botao = formulario.querySelector('[type="submit"]');
    const atualizada = await cfSalvarDadosPagamento(conta, formulario, botao);
    if (!atualizada) return;
    fechar();
  });
}

function cfSomenteDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function cfCodigoBarrasBoleto(linhaDigitavel) {
  const digitos = cfSomenteDigitos(linhaDigitavel);
  if (digitos.length === 44) return digitos;
  if (digitos.length === 47) {
    return [digitos.slice(0, 4), digitos.slice(32, 33), digitos.slice(33, 47), digitos.slice(4, 9), digitos.slice(10, 20), digitos.slice(21, 31)].join('');
  }
  if (digitos.length === 48) return [digitos.slice(0, 11), digitos.slice(12, 23), digitos.slice(24, 35), digitos.slice(36, 47)].join('');
  return null;
}

function cfCarregarGeradorCodigos() {
  if (window.bwipjs) return Promise.resolve(window.bwipjs);
  if (cfBwipPromise) return cfBwipPromise;
  cfBwipPromise = new Promise((resolve, reject) => {
    const existente = document.querySelector('script[data-cf-bwip]');
    if (existente) {
      existente.addEventListener('load', () => resolve(window.bwipjs), { once: true });
      existente.addEventListener('error', () => reject(new Error('Gerador visual indisponível.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/bwip-js@4.10.2/dist/bwip-js-min.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.cfBwip = '1';
    script.addEventListener('load', () => window.bwipjs ? resolve(window.bwipjs) : reject(new Error('Gerador visual não foi carregado.')), { once: true });
    script.addEventListener('error', () => { cfBwipPromise = null; reject(new Error('Não foi possível carregar o gerador visual.')); }, { once: true });
    document.head.appendChild(script);
  });
  return cfBwipPromise;
}

function cfPagamentoVisualHtml(conta) {
  const codigoBarras = cfCodigoBarrasBoleto(conta.linha_digitavel);
  const temPix = Boolean(conta.pix_copia_cola || conta.qr_code_url);
  const temBoleto = Boolean(codigoBarras);
  if (!temPix && !temBoleto) return '';
  const inicial = temPix ? 'pix' : 'boleto';
  const abas = temPix && temBoleto
    ? '<div class="cf-visual-abas" role="tablist" aria-label="Forma de pagamento"><button type="button" class="ativo" data-cf-visual-tab="pix">Pix</button><button type="button" data-cf-visual-tab="boleto">Código de barras</button></div>'
    : '';
  return `
    <section class="cf-pagamento-visual" data-cf-visual-inicial="${inicial}">
      <div class="cf-visual-cabecalho"><div><span>Pagamento visual</span><strong>Escaneie com a câmera do banco</strong></div><small>Toque em ampliar para ocupar a tela inteira.</small></div>
      ${abas}
      ${temPix ? `<div class="cf-visual-painel ${inicial === 'pix' ? 'ativo' : ''}" data-cf-visual-painel="pix"><div class="cf-codigo-moldura cf-codigo-pix">${conta.qr_code_url ? `<img src="${cfEscapar(conta.qr_code_url)}" alt="QR Code Pix">` : '<canvas data-cf-canvas="pix" aria-label="QR Code Pix"></canvas>'}<div class="cf-codigo-status" data-cf-status="pix">Gerando QR Code…</div></div><div class="cf-visual-rodape"><span>Pix</span><button type="button" data-cf-ampliar="pix">Ampliar QR Code</button></div></div>` : ''}
      ${temBoleto ? `<div class="cf-visual-painel ${inicial === 'boleto' ? 'ativo' : ''}" data-cf-visual-painel="boleto"><div class="cf-codigo-moldura cf-codigo-boleto"><canvas data-cf-canvas="boleto" data-cf-codigo-barras="${codigoBarras}" aria-label="Código de barras do boleto"></canvas><div class="cf-codigo-status" data-cf-status="boleto">Gerando código de barras…</div></div><div class="cf-visual-rodape"><span>Boleto</span><button type="button" data-cf-ampliar="boleto">Ampliar código</button></div></div>` : ''}
    </section>`;
}

function cfVincularPagamentoVisual(overlay) {
  overlay.querySelectorAll('[data-cf-visual-tab]').forEach(botao => {
    botao.addEventListener('click', () => {
      const tipo = botao.dataset.cfVisualTab;
      overlay.querySelectorAll('[data-cf-visual-tab]').forEach(item => item.classList.toggle('ativo', item === botao));
      overlay.querySelectorAll('[data-cf-visual-painel]').forEach(painel => painel.classList.toggle('ativo', painel.dataset.cfVisualPainel === tipo));
    });
  });
  overlay.querySelectorAll('[data-cf-ampliar]').forEach(botao => {
    botao.addEventListener('click', () => {
      const painel = botao.closest('[data-cf-visual-painel]');
      const ampliado = painel?.classList.toggle('ampliado');
      botao.textContent = ampliado ? 'Voltar ao pagamento' : (botao.dataset.cfAmpliar === 'pix' ? 'Ampliar QR Code' : 'Ampliar código');
    });
  });
}

async function cfRenderizarPagamentoVisual(overlay, conta) {
  const canvasPix = overlay.querySelector('[data-cf-canvas="pix"]');
  const canvasBoleto = overlay.querySelector('[data-cf-canvas="boleto"]');
  if (!canvasPix && !canvasBoleto) {
    overlay.querySelector('[data-cf-status="pix"]')?.remove();
    return;
  }
  try {
    const bwipjs = await cfCarregarGeradorCodigos();
    if (canvasPix && conta.pix_copia_cola) {
      bwipjs.toCanvas(canvasPix, { bcid: 'qrcode', text: conta.pix_copia_cola, scale: 5, padding: 4, eclevel: 'M' });
      overlay.querySelector('[data-cf-status="pix"]')?.remove();
    }
    if (canvasBoleto) {
      bwipjs.toCanvas(canvasBoleto, { bcid: 'interleaved2of5', text: canvasBoleto.dataset.cfCodigoBarras, scale: 2, height: 18, padding: 4 });
      overlay.querySelector('[data-cf-status="boleto"]')?.remove();
    }
  } catch (erro) {
    console.error('[Pagamento Visual]', erro);
    overlay.querySelectorAll('.cf-codigo-status').forEach(status => {
      status.textContent = 'Não foi possível gerar a imagem. Use o botão de copiar código abaixo.';
      status.classList.add('erro');
    });
  }
}

function cfAbrirConta(conta) {
  if (!conta) return;
  document.querySelectorAll('.cf-modal').forEach(modal => modal.remove());
  const possuiMeioPagamento = conta.qr_code_url || conta.pix_copia_cola || conta.linha_digitavel || conta.documento_url;
  const html = `
    <section class="cf-modal-conteudo cf-modal-pagamento" role="dialog" aria-modal="true" aria-label="${cfEscapar(conta.nome)}">
      <header class="cf-modal-cabecalho"><div><span class="cf-modal-kicker">${conta.paga ? 'Conta paga' : 'Pagamento'}</span><h3>${cfEscapar(conta.nome)}</h3>${conta.fornecedor ? `<p>${cfEscapar(conta.fornecedor)}</p>` : ''}</div><button type="button" class="cf-modal-fechar" data-lifeos-close aria-label="Fechar">×</button></header>
      <div class="cf-modal-resumo"><div><span>Valor</span><strong>${cfDinheiro(conta.valor)}</strong></div><div><span>Vencimento</span><strong>${cfData(conta.vencimento)}</strong></div></div>
      ${cfPagamentoVisualHtml(conta)}
      ${conta.pix_copia_cola ? `<div class="cf-pagamento-bloco"><span>Pix copia e cola</span><code>${cfEscapar(conta.pix_copia_cola)}</code><button type="button" data-cf-copiar="${cfEscapar(conta.pix_copia_cola)}">Copiar código Pix</button></div>` : ''}
      ${conta.linha_digitavel ? `<div class="cf-pagamento-bloco"><span>Linha digitável</span><code>${cfEscapar(conta.linha_digitavel)}</code><button type="button" data-cf-copiar="${cfEscapar(conta.linha_digitavel)}">Copiar linha digitável</button></div>` : ''}
      ${conta.descricao_pagamento ? `<div class="cf-pagamento-bloco"><span>Como pagar</span><p>${cfEscapar(conta.descricao_pagamento)}</p></div>` : ''}
      ${!possuiMeioPagamento ? '<div class="cf-sem-pagamento"><strong>Pagamento externo</strong><p>Use o boleto recebido fora do LifeOS e marque a conta como paga depois.</p></div>' : ''}
      <div class="cf-modal-acoes"><button type="button" class="cf-acao-secundaria" data-cf-editar-pagamento>Editar dados de pagamento</button>${conta.documento_url ? `<a href="${cfEscapar(conta.documento_url)}" target="_blank" rel="noopener" class="cf-acao-secundaria">Abrir documento</a>` : ''}${!conta.paga ? `<button type="button" class="cf-acao-principal" data-cf-pago="${conta.id}">Marcar como pago</button>` : '<div class="cf-pago-confirmacao">Pagamento registrado no LifeOS.</div>'}</div>
    </section>`;

  const { overlay, fechar } = cfCriarOverlay(html);
  overlay.querySelector('[data-cf-editar-pagamento]')?.addEventListener('click', () => { fechar(); cfAbrirEditorPagamento(conta); });
  overlay.querySelectorAll('[data-cf-copiar]').forEach(botao => botao.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(botao.dataset.cfCopiar);
      botao.textContent = 'Código copiado';
      cfToast('Código copiado.');
    } catch (erro) {
      console.error('[Central Financeira]', erro);
      cfToast('Não foi possível copiar o código.', 'erro');
    }
  }));
  overlay.querySelector('[data-cf-pago]')?.addEventListener('click', async evento => {
    const botao = evento.currentTarget;
    botao.disabled = true;
    botao.textContent = 'Registrando pagamento…';
    try {
      const resultado = await cfClient.from('contas').update({ paga: true, paga_em: new Date().toISOString(), pago_por: cfProfile.id, atualizado_em: new Date().toISOString() }).eq('id', conta.id);
      if (resultado.error) throw resultado.error;
      fechar();
      await cfAtualizar();
      cfToast('Pagamento registrado.');
      window.dispatchEvent(new CustomEvent('lifeos:conta-paga', { detail: { contaId: conta.id } }));
    } catch (erro) {
      console.error('[Central Financeira]', erro);
      botao.disabled = false;
      botao.textContent = 'Marcar como pago';
      cfToast('Não foi possível registrar o pagamento.', 'erro');
    }
  });
  cfVincularPagamentoVisual(overlay);
  cfRenderizarPagamentoVisual(overlay, conta);
}

function cfLinha(conta) {
  const situacao = cfSituacao(conta);
  const acao = conta.paga ? 'Ver' : 'Pagar';
  return `
    <article class="cf-conta-item">
      <button type="button" class="cf-conta-conteudo" data-cf-abrir="${conta.id}"><span class="cf-conta-nome">${cfEscapar(conta.nome)}</span><span class="cf-conta-meta">${cfEscapar(situacao.texto)}${conta.fornecedor ? ` · ${cfEscapar(conta.fornecedor)}` : ''}${cfMeiosPagamento(conta).length ? ` · ${cfEscapar(cfMeiosPagamento(conta).join(' + '))}` : ''}</span></button>
      <div class="cf-conta-lateral"><strong>${cfDinheiro(conta.valor)}</strong><button type="button" data-cf-abrir="${conta.id}">${acao}</button></div>
    </article>`;
}

function cfListaFiltrada() {
  const agora = new Date();
  if (cfFiltro === 'pagas') return cfContas.filter(conta => conta.paga);
  if (cfFiltro === 'mes') return cfContas.filter(conta => {
    if (!conta.vencimento) return false;
    const data = new Date(`${String(conta.vencimento).slice(0, 10)}T12:00:00`);
    return data.getMonth() === agora.getMonth() && data.getFullYear() === agora.getFullYear();
  });
  return cfContas.filter(conta => !conta.paga);
}

function cfVincularCentral(central) {
  central.querySelectorAll('[data-cf-abrir]').forEach(botao => botao.addEventListener('click', () => {
    const conta = cfContas.find(item => String(item.id) === String(botao.dataset.cfAbrir));
    cfAbrirConta(conta);
  }));
  central.querySelectorAll('[data-cf-filtro]').forEach(botao => botao.addEventListener('click', () => {
    cfFiltro = botao.dataset.cfFiltro;
    cfRenderizarCentral();
  }));
}

function cfRenderizarCentral() {
  const secao = document.getElementById('lifeosFinanceiroContas') || document.querySelector('#subContas .secao');
  if (!secao) return;
  let central = document.getElementById('cfCentral');
  if (!central) {
    central = document.createElement('section');
    central.id = 'cfCentral';
    central.className = 'cf-central';
    secao.prepend(central);
  }
  const pendentes = cfContas.filter(conta => !conta.paga);
  const vencidas = pendentes.filter(conta => (cfDias(conta.vencimento) ?? 0) < 0);
  const proximas = pendentes.filter(conta => {
    const dias = cfDias(conta.vencimento);
    return dias !== null && dias >= 0 && dias <= 7;
  });
  const total = pendentes.reduce((soma, conta) => soma + Number(conta.valor || 0), 0);
  const lista = cfListaFiltrada();
  central.innerHTML = `
    <header class="cf-central-cabecalho"><div><span class="cf-central-kicker">Casa</span><h2>Central Financeira</h2><p>Acompanhe vencimentos e acesse os meios de pagamento.</p></div><div class="cf-central-icone" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h4M15 15h2"/><circle cx="12" cy="12" r="2"/></svg></div></header>
    <div class="cf-resumo"><div class="cf-resumo-item"><strong>${vencidas.length}</strong><span>Vencidas</span></div><div class="cf-resumo-item"><strong>${proximas.length}</strong><span>Próximos 7 dias</span></div><div class="cf-resumo-item cf-resumo-valor"><strong>${cfDinheiro(total)}</strong><span>Total em aberto</span></div></div>
    <nav class="cf-filtros" aria-label="Filtros da Central Financeira"><button type="button" class="${cfFiltro === 'pendentes' ? 'ativo' : ''}" data-cf-filtro="pendentes">Pendentes</button><button type="button" class="${cfFiltro === 'mes' ? 'ativo' : ''}" data-cf-filtro="mes">Este mês</button><button type="button" class="${cfFiltro === 'pagas' ? 'ativo' : ''}" data-cf-filtro="pagas">Pagas</button></nav>
    <div class="cf-contas-lista">${lista.length ? lista.map(cfLinha).join('') : '<div class="cf-lista-vazia">Nenhuma conta neste filtro.</div>'}</div>`;
  cfVincularCentral(central);
}

async function cfAtualizar() {
  try {
    await cfCarregar();
    cfRenderizarCentral();
  } catch (erro) {
    console.error('[Central Financeira]', erro);
    cfToast('Não foi possível atualizar a Central Financeira.', 'erro');
  }
}

async function cfAbrirContaDoHoje(contaId) {
  if (!contaId || !cfObterContexto()) return;
  if (!cfContas.length) await cfCarregar();
  let conta = cfContas.find(item => String(item.id) === String(contaId));
  if (!conta) {
    await cfCarregar();
    conta = cfContas.find(item => String(item.id) === String(contaId));
  }
  if (conta) cfAbrirConta(conta);
  else cfToast('Conta não encontrada.', 'erro');
}

function cfCarregarEstilos() {
  if (document.querySelector('link[data-cf="5"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/central-financeira.css?v=5';
  link.dataset.cf = '5';
  document.head.appendChild(link);
}

function cfIniciar() {
  cfCarregarEstilos();
  let tentativas = 0;
  const espera = window.setInterval(() => {
    if (cfObterContexto()) {
      window.clearInterval(espera);
      cfAtualizar();
    }
    tentativas += 1;
    if (tentativas > 60) window.clearInterval(espera);
  }, 250);
}

window.addEventListener('lifeos:ready', cfAtualizar);
window.addEventListener('lifeos:contas-atualizadas', cfAtualizar);
window.addEventListener('lifeos:financeiro-abrir', cfAtualizar);
window.addEventListener('lifeos:hoje-abrir-conta', evento => cfAbrirContaDoHoje(evento.detail?.contaId));
window.addEventListener('lifeos:financeiro-ir', cfAbrirCentral);

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cfIniciar, { once: true });
else cfIniciar();
