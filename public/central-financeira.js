// LifeOS — Central Financeira v5
// Integração estável com a tela Hoje, sem navegação involuntária.

let cfClient = null;
let cfProfile = null;
let cfContas = [];
let cfFiltro = 'pendentes';
let cfCarregando = false;
let cfObservadorHoje = null;
let cfRenderizandoHoje = false;
let cfAtualizacaoAgendada = false;
let cfAbaOrigem = null;
let cfBwipPromise = null;

const cfEscapar = (valor = '') => String(valor)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const cfDinheiro = valor => {
  if (valor === null || valor === undefined || valor === '') return 'Valor não informado';
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

const cfData = valor => {
  if (!valor) return 'Sem vencimento';
  return new Date(`${String(valor).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');
};

const cfDias = valor => {
  if (!valor) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(`${String(valor).slice(0, 10)}T00:00:00`);
  return Math.round((vencimento - hoje) / 86400000);
};

const cfSituacao = conta => {
  if (conta.paga) return { texto: 'Pago', classe: 'paga' };

  const dias = cfDias(conta.vencimento);
  if (dias === null) return { texto: 'Sem vencimento', classe: 'proxima' };

  if (dias < 0) {
    const quantidade = Math.abs(dias);
    return {
      texto: `${quantidade} ${quantidade === 1 ? 'dia vencida' : 'dias vencida'}`,
      classe: 'vencida',
    };
  }

  if (dias === 0) return { texto: 'Vence hoje', classe: 'hoje' };
  if (dias === 1) return { texto: 'Vence amanhã', classe: 'proxima' };
  return { texto: `Vence em ${dias} dias`, classe: 'proxima' };
};

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
  const botaoFinanceiro = document.querySelector('.tab-btn[data-tab="financeiro"]');

  if (botaoFinanceiro) {
    botaoFinanceiro.click();
  } else if (typeof window.trocarAba === 'function') {
    window.trocarAba('financeiro');
  }

  window.setTimeout(() => {
    document.getElementById('cfCentral')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, 80);
}

function cfRestaurarAbaOrigem() {
  if (cfAbaOrigem !== 'hoje') return;

  const ativa = document.querySelector('.tab-btn.ativa')?.dataset.tab;
  const hojeVisivel = document.getElementById('abaHoje')?.style.display !== 'none';

  if (ativa === 'hoje' && hojeVisivel) return;

  if (typeof window.trocarAba === 'function') {
    window.trocarAba('hoje');
    window.setTimeout(cfRenderizarHoje, 80);
  } else {
    document.querySelector('.tab-btn[data-tab="hoje"]')?.click();
  }
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

function cfValorCampo(valor) {
  return cfEscapar(valor || '');
}

async function cfSalvarDadosPagamento(conta, formulario, botao) {
  const dados = new FormData(formulario);
  const limpar = nome => {
    const valor = String(dados.get(nome) || '').trim();
    return valor || null;
  };

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

    document.querySelector('.cf-editor-modal')?.remove();
    await cfAtualizar();

    const atualizada = cfContas.find(item => String(item.id) === String(conta.id));
    if (atualizada) cfAbrirConta(atualizada);
  } catch (erro) {
    console.error('[Central Financeira]', erro);
    botao.disabled = false;
    botao.textContent = 'Salvar dados';
    alert('Não foi possível salvar os dados de pagamento.');
  }
}

function cfAbrirEditorPagamento(conta) {
  document.querySelector('.cf-editor-modal')?.remove();
  document.querySelector('.cf-modal:not(.cf-editor-modal)')?.remove();

  const modal = document.createElement('div');
  modal.className = 'cf-modal cf-editor-modal';

  modal.innerHTML = `
    <section class="cf-modal-conteudo cf-editor-conteudo" role="dialog" aria-modal="true" aria-label="Editar dados de pagamento">
      <header class="cf-modal-cabecalho">
        <div>
          <span class="cf-modal-kicker">Configuração da conta</span>
          <h3>Dados de pagamento</h3>
          <p>${cfEscapar(conta.nome)}</p>
        </div>
        <button type="button" class="cf-modal-fechar" data-cf-editor-fechar aria-label="Fechar">×</button>
      </header>

      <p class="cf-editor-intro">
        Preencha somente os dados usados nesta conta. Os campos vazios não aparecem no momento do pagamento.
      </p>

      <form class="cf-editor-form" data-cf-editor-form>
        <label class="cf-editor-campo">
          <span>Fornecedor ou beneficiário</span>
          <input name="fornecedor" type="text" maxlength="160" value="${cfValorCampo(conta.fornecedor)}" placeholder="Ex.: Enel, condomínio, imobiliária">
        </label>

        <label class="cf-editor-campo">
          <span>Pix copia e cola</span>
          <textarea name="pix_copia_cola" rows="3" placeholder="Cole aqui o código Pix completo">${cfValorCampo(conta.pix_copia_cola)}</textarea>
        </label>

        <label class="cf-editor-campo">
          <span>Linha digitável do boleto</span>
          <textarea name="linha_digitavel" rows="2" inputmode="numeric" placeholder="Cole a linha digitável">${cfValorCampo(conta.linha_digitavel)}</textarea>
        </label>

        <label class="cf-editor-campo">
          <span>Como pagar</span>
          <textarea name="descricao_pagamento" rows="3" placeholder="Ex.: pagar pelo aplicativo da administradora">${cfValorCampo(conta.descricao_pagamento)}</textarea>
        </label>

        <label class="cf-editor-campo">
          <span>Endereço da imagem do QR Code</span>
          <input name="qr_code_url" type="url" value="${cfValorCampo(conta.qr_code_url)}" placeholder="https://...">
          <small>Use quando a imagem do QR Code já estiver hospedada.</small>
        </label>

        <label class="cf-editor-campo">
          <span>Endereço do boleto ou documento</span>
          <input name="documento_url" type="url" value="${cfValorCampo(conta.documento_url)}" placeholder="https://...">
        </label>

        <div class="cf-editor-acoes">
          <button type="button" class="cf-acao-secundaria" data-cf-editor-cancelar>Cancelar</button>
          <button type="submit" class="cf-acao-principal">Salvar dados</button>
        </div>
      </form>
    </section>`;

  const fechar = () => {
    modal.remove();
    cfAbrirConta(conta);
  };

  modal.addEventListener('click', evento => {
    if (evento.target === modal || evento.target.closest('[data-cf-editor-fechar], [data-cf-editor-cancelar]')) {
      evento.preventDefault();
      evento.stopPropagation();
      fechar();
    }
  });

  const formulario = modal.querySelector('[data-cf-editor-form]');
  formulario.addEventListener('submit', evento => {
    evento.preventDefault();
    evento.stopPropagation();
    cfSalvarDadosPagamento(conta, formulario, formulario.querySelector('[type="submit"]'));
  });

  document.body.appendChild(modal);
  formulario.querySelector('[name="fornecedor"]')?.focus();
}


function cfSomenteDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function cfCodigoBarrasBoleto(linhaDigitavel) {
  const digitos = cfSomenteDigitos(linhaDigitavel);

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

    script.addEventListener('load', () => {
      if (window.bwipjs) resolve(window.bwipjs);
      else reject(new Error('Gerador visual não foi carregado.'));
    }, { once: true });

    script.addEventListener('error', () => {
      cfBwipPromise = null;
      reject(new Error('Não foi possível carregar o gerador visual.'));
    }, { once: true });

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
    ? `<div class="cf-visual-abas" role="tablist" aria-label="Forma de pagamento">
         <button type="button" class="ativo" data-cf-visual-tab="pix">Pix</button>
         <button type="button" data-cf-visual-tab="boleto">Código de barras</button>
       </div>`
    : '';

  return `
    <section class="cf-pagamento-visual" data-cf-visual-inicial="${inicial}">
      <div class="cf-visual-cabecalho">
        <div>
          <span>Pagamento visual</span>
          <strong>Escaneie com a câmera do banco</strong>
        </div>
        <small>Toque em ampliar para ocupar a tela inteira.</small>
      </div>

      ${abas}

      ${temPix ? `
        <div class="cf-visual-painel ${inicial === 'pix' ? 'ativo' : ''}" data-cf-visual-painel="pix">
          <div class="cf-codigo-moldura cf-codigo-pix">
            ${conta.qr_code_url
              ? `<img src="${cfEscapar(conta.qr_code_url)}" alt="QR Code Pix">`
              : '<canvas data-cf-canvas="pix" aria-label="QR Code Pix"></canvas>'}
            <div class="cf-codigo-status" data-cf-status="pix">Gerando QR Code…</div>
          </div>
          <div class="cf-visual-rodape">
            <span>Pix</span>
            <button type="button" data-cf-ampliar="pix">Ampliar QR Code</button>
          </div>
        </div>
      ` : ''}

      ${temBoleto ? `
        <div class="cf-visual-painel ${inicial === 'boleto' ? 'ativo' : ''}" data-cf-visual-painel="boleto">
          <div class="cf-codigo-moldura cf-codigo-boleto">
            <canvas data-cf-canvas="boleto" data-cf-codigo-barras="${codigoBarras}" aria-label="Código de barras do boleto"></canvas>
            <div class="cf-codigo-status" data-cf-status="boleto">Gerando código de barras…</div>
          </div>
          <div class="cf-visual-rodape">
            <span>Boleto</span>
            <button type="button" data-cf-ampliar="boleto">Ampliar código</button>
          </div>
        </div>
      ` : ''}
    </section>`;
}

function cfVincularPagamentoVisual(modal) {
  modal.querySelectorAll('[data-cf-visual-tab]').forEach(botao => {
    botao.addEventListener('click', evento => {
      evento.preventDefault();
      evento.stopPropagation();

      const tipo = botao.dataset.cfVisualTab;

      modal.querySelectorAll('[data-cf-visual-tab]').forEach(item => {
        item.classList.toggle('ativo', item === botao);
      });

      modal.querySelectorAll('[data-cf-visual-painel]').forEach(painel => {
        painel.classList.toggle('ativo', painel.dataset.cfVisualPainel === tipo);
      });
    });
  });

  modal.querySelectorAll('[data-cf-ampliar]').forEach(botao => {
    botao.addEventListener('click', evento => {
      evento.preventDefault();
      evento.stopPropagation();

      const painel = botao.closest('[data-cf-visual-painel]');
      const ampliado = painel.classList.toggle('ampliado');
      botao.textContent = ampliado ? 'Voltar ao pagamento' : (
        botao.dataset.cfAmpliar === 'pix' ? 'Ampliar QR Code' : 'Ampliar código'
      );
    });
  });
}

async function cfRenderizarPagamentoVisual(modal, conta) {
  const canvasPix = modal.querySelector('[data-cf-canvas="pix"]');
  const canvasBoleto = modal.querySelector('[data-cf-canvas="boleto"]');

  if (!canvasPix && !canvasBoleto) {
    modal.querySelector('[data-cf-status="pix"]')?.remove();
    return;
  }

  try {
    const bwipjs = await cfCarregarGeradorCodigos();

    if (canvasPix && conta.pix_copia_cola) {
      bwipjs.toCanvas(canvasPix, {
        bcid: 'qrcode',
        text: conta.pix_copia_cola,
        scale: 5,
        padding: 4,
        eclevel: 'M',
      });

      modal.querySelector('[data-cf-status="pix"]')?.remove();
    }

    if (canvasBoleto) {
      bwipjs.toCanvas(canvasBoleto, {
        bcid: 'interleaved2of5',
        text: canvasBoleto.dataset.cfCodigoBarras,
        scale: 2,
        height: 18,
        padding: 4,
      });

      modal.querySelector('[data-cf-status="boleto"]')?.remove();
    }
  } catch (erro) {
    console.error('[Pagamento Visual]', erro);

    modal.querySelectorAll('.cf-codigo-status').forEach(status => {
      status.textContent = 'Não foi possível gerar a imagem. Use o botão de copiar código abaixo.';
      status.classList.add('erro');
    });
  }
}

function cfAbrirConta(conta) {
  document.querySelector('.cf-modal')?.remove();

  const possuiMeioPagamento = conta.qr_code_url
    || conta.pix_copia_cola
    || conta.linha_digitavel
    || conta.documento_url;

  const modal = document.createElement('div');
  modal.className = 'cf-modal';

  modal.innerHTML = `
    <section class="cf-modal-conteudo cf-modal-pagamento" role="dialog" aria-modal="true" aria-label="${cfEscapar(conta.nome)}">
      <header class="cf-modal-cabecalho">
        <div>
          <span class="cf-modal-kicker">${conta.paga ? 'Conta paga' : 'Pagamento'}</span>
          <h3>${cfEscapar(conta.nome)}</h3>
          ${conta.fornecedor ? `<p>${cfEscapar(conta.fornecedor)}</p>` : ''}
        </div>
        <button type="button" class="cf-modal-fechar" data-cf-fechar aria-label="Fechar">×</button>
      </header>

      <div class="cf-modal-resumo">
        <div>
          <span>Valor</span>
          <strong>${cfDinheiro(conta.valor)}</strong>
        </div>
        <div>
          <span>Vencimento</span>
          <strong>${cfData(conta.vencimento)}</strong>
        </div>
      </div>

      ${cfPagamentoVisualHtml(conta)}

      ${conta.pix_copia_cola
        ? `<div class="cf-pagamento-bloco">
             <span>Pix copia e cola</span>
             <code>${cfEscapar(conta.pix_copia_cola)}</code>
             <button type="button" data-cf-copiar="${cfEscapar(conta.pix_copia_cola)}">Copiar código Pix</button>
           </div>`
        : ''}

      ${conta.linha_digitavel
        ? `<div class="cf-pagamento-bloco">
             <span>Linha digitável</span>
             <code>${cfEscapar(conta.linha_digitavel)}</code>
             <button type="button" data-cf-copiar="${cfEscapar(conta.linha_digitavel)}">Copiar linha digitável</button>
           </div>`
        : ''}

      ${conta.descricao_pagamento
        ? `<div class="cf-pagamento-bloco">
             <span>Como pagar</span>
             <p>${cfEscapar(conta.descricao_pagamento)}</p>
           </div>`
        : ''}

      ${!possuiMeioPagamento
        ? `<div class="cf-sem-pagamento">
             <strong>Pagamento externo</strong>
             <p>Use o boleto recebido fora do LifeOS e marque a conta como paga depois.</p>
           </div>`
        : ''}

      <div class="cf-modal-acoes">
        <button type="button" class="cf-acao-secundaria" data-cf-editar-pagamento>
          Editar dados de pagamento
        </button>
        ${conta.documento_url
          ? `<a href="${cfEscapar(conta.documento_url)}" target="_blank" rel="noopener" class="cf-acao-secundaria">Abrir documento</a>`
          : ''}
        ${!conta.paga
          ? `<button type="button" class="cf-acao-principal" data-cf-pago="${conta.id}">Marcar como pago</button>`
          : '<div class="cf-pago-confirmacao">Pagamento registrado no LifeOS.</div>'}
      </div>
    </section>`;

  modal.addEventListener('click', evento => {
    if (evento.target === modal || evento.target.closest('[data-cf-fechar]')) {
      evento.preventDefault();
      evento.stopPropagation();
      modal.remove();
      cfRestaurarAbaOrigem();
    }
  });

  modal.querySelector('[data-cf-editar-pagamento]')?.addEventListener('click', evento => {
    evento.preventDefault();
    evento.stopPropagation();
    cfAbrirEditorPagamento(conta);
  });

  modal.querySelectorAll('[data-cf-copiar]').forEach(botao => {
    botao.addEventListener('click', async evento => {
      evento.preventDefault();
      evento.stopPropagation();
      await navigator.clipboard.writeText(botao.dataset.cfCopiar);
      botao.textContent = 'Código copiado';
    });
  });

  modal.querySelector('[data-cf-pago]')?.addEventListener('click', async evento => {
    evento.preventDefault();
    evento.stopPropagation();

    const botao = evento.currentTarget;
    botao.disabled = true;
    botao.textContent = 'Registrando pagamento…';

    try {
      const resultado = await cfClient
        .from('contas')
        .update({
          paga: true,
          paga_em: new Date().toISOString(),
          pago_por: cfProfile.id,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', conta.id);

      if (resultado.error) throw resultado.error;

      modal.remove();
      await cfAtualizar();
      cfRestaurarAbaOrigem();

      window.dispatchEvent(new CustomEvent('lifeos:conta-paga', {
        detail: { contaId: conta.id },
      }));
    } catch (erro) {
      console.error('[Central Financeira]', erro);
      botao.disabled = false;
      botao.textContent = 'Marcar como pago';
      alert('Não foi possível registrar o pagamento.');
    }
  });

  document.body.appendChild(modal);
  cfVincularPagamentoVisual(modal);
  cfRenderizarPagamentoVisual(modal, conta);
}

function cfLinha(conta, contexto = 'central') {
  const situacao = cfSituacao(conta);
  const acao = conta.paga ? 'Ver' : 'Pagar';

  if (contexto === 'hoje') {
    return `
      <div class="cf-hoje-item">
        <button type="button" class="cf-hoje-conteudo" data-cf-abrir="${conta.id}">
          <span class="cf-hoje-nome">${cfEscapar(conta.nome)}</span>
          <span class="cf-hoje-meta">${cfDinheiro(conta.valor)} · ${cfEscapar(situacao.texto)}</span>
        </button>
        <button type="button" class="cf-hoje-acao ${situacao.classe}" data-cf-abrir="${conta.id}">
          ${acao}
        </button>
      </div>`;
  }

  return `
    <article class="cf-conta-item">
      <button type="button" class="cf-conta-conteudo" data-cf-abrir="${conta.id}">
        <span class="cf-conta-nome">${cfEscapar(conta.nome)}</span>
        <span class="cf-conta-meta">
          ${cfEscapar(situacao.texto)}
          ${conta.fornecedor ? ` · ${cfEscapar(conta.fornecedor)}` : ''}
          ${cfMeiosPagamento(conta).length ? ` · ${cfEscapar(cfMeiosPagamento(conta).join(' + '))}` : ''}
        </span>
      </button>
      <div class="cf-conta-lateral">
        <strong>${cfDinheiro(conta.valor)}</strong>
        <button type="button" data-cf-abrir="${conta.id}">${acao}</button>
      </div>
    </article>`;
}

function cfRemoverCartaoAntigo() {
  const area = document.getElementById('cardsHoje');
  if (!area) return;

  area.querySelectorAll('.card-hoje').forEach(cartao => {
    if (cartao.id === 'cfToday') return;

    const titulo = cartao.querySelector('.card-hoje-titulo-txt')?.textContent?.trim();
    if (titulo === 'Contas próximas') cartao.remove();
  });
}

function cfVincularCardHoje(cartao) {
  if (cartao.dataset.cfEventos === '1') return;
  cartao.dataset.cfEventos = '1';

  const bloquear = evento => {
    if (!evento.target.closest('[data-cf-abrir], [data-cf-ver-todas]')) return;
    evento.stopPropagation();
  };

  ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'].forEach(tipo => {
    cartao.addEventListener(tipo, bloquear, true);
  });

  cartao.addEventListener('click', evento => {
    const abrir = evento.target.closest('[data-cf-abrir]');

    if (abrir) {
      evento.preventDefault();
      evento.stopImmediatePropagation();

      cfAbaOrigem = 'hoje';
      const conta = cfContas.find(item => String(item.id) === String(abrir.dataset.cfAbrir));
      if (conta) cfAbrirConta(conta);
      return;
    }

    if (evento.target.closest('[data-cf-ver-todas]')) {
      evento.preventDefault();
      evento.stopImmediatePropagation();

      cfAbaOrigem = null;
      cfAbrirCentral();
    }
  }, true);
}

function cfRenderizarHoje() {
  const area = document.getElementById('cardsHoje');
  if (!area || cfRenderizandoHoje) return;

  cfRenderizandoHoje = true;

  try {
    cfRemoverCartaoAntigo();

    let cartao = document.getElementById('cfToday');

    if (!cartao) {
      cartao = document.createElement('section');
      cartao.id = 'cfToday';
      cartao.className = 'card-hoje cf-hoje-card';
      area.prepend(cartao);
    } else if (cartao.parentElement !== area) {
      area.prepend(cartao);
    }

    const proximas = cfContas
      .filter(conta => !conta.paga)
      .filter(conta => {
        const dias = cfDias(conta.vencimento);
        return dias !== null && dias <= 7;
      })
      .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)))
      .slice(0, 4);

    cartao.innerHTML = `
      <div class="cartao cf-hoje-interior">
        <div class="card-hoje-head">
          <div>
            <div class="card-hoje-title-row"><span class="card-hoje-head-icon"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></svg></span><div class="card-hoje-titulo-txt">Contas próximas</div></div>
            <div class="cf-hoje-subtitulo">
              ${proximas.length
                ? `${proximas.length} ${proximas.length === 1 ? 'conta precisa' : 'contas precisam'} da sua atenção`
                : 'Nenhum vencimento nos próximos 7 dias'}
            </div>
          </div>
          <button type="button" class="card-hoje-abrir cf-ver-todas" data-cf-ver-todas>
            Ver todas
          </button>
        </div>
        <div class="cf-hoje-lista">
          ${proximas.length
            ? proximas.map(conta => cfLinha(conta, 'hoje')).join('')
            : '<div class="cf-hoje-vazio">As contas da casa estão em dia.</div>'}
        </div>
      </div>`;

    cfVincularCardHoje(cartao);
  } finally {
    cfRenderizandoHoje = false;
  }
}

function cfListaFiltrada() {
  const agora = new Date();

  if (cfFiltro === 'pagas') return cfContas.filter(conta => conta.paga);

  if (cfFiltro === 'mes') {
    return cfContas.filter(conta => {
      if (!conta.vencimento) return false;

      const data = new Date(`${String(conta.vencimento).slice(0, 10)}T12:00:00`);
      return data.getMonth() === agora.getMonth()
        && data.getFullYear() === agora.getFullYear();
    });
  }

  return cfContas.filter(conta => !conta.paga);
}

function cfVincularCentral(central) {
  central.querySelectorAll('[data-cf-abrir]').forEach(botao => {
    botao.addEventListener('click', evento => {
      evento.preventDefault();
      evento.stopPropagation();

      cfAbaOrigem = 'financeiro';
      const conta = cfContas.find(item => String(item.id) === String(botao.dataset.cfAbrir));
      if (conta) cfAbrirConta(conta);
    });
  });

  central.querySelectorAll('[data-cf-filtro]').forEach(botao => {
    botao.addEventListener('click', evento => {
      evento.preventDefault();
      evento.stopPropagation();

      cfFiltro = botao.dataset.cfFiltro;
      cfRenderizarCentral();
    });
  });
}

function cfRenderizarCentral() {
  const secao = document.getElementById('lifeosFinanceiroContas')
    || document.querySelector('#subContas .secao');
  if (!secao) return;

  let central = document.getElementById('cfCentral');

  if (!central) {
    central = document.createElement('section');
    central.id = 'cfCentral';
    central.className = 'cf-central';
    secao.prepend(central);
  }

  const pendentes = cfContas.filter(conta => !conta.paga);
  const vencidas = pendentes.filter(conta => {
    const dias = cfDias(conta.vencimento);
    return dias !== null && dias < 0;
  });
  const proximas = pendentes.filter(conta => {
    const dias = cfDias(conta.vencimento);
    return dias !== null && dias >= 0 && dias <= 7;
  });
  const total = pendentes.reduce((soma, conta) => soma + Number(conta.valor || 0), 0);
  const lista = cfListaFiltrada();

  central.innerHTML = `
    <header class="cf-central-cabecalho">
      <div>
        <span class="cf-central-kicker">Casa</span>
        <h2>Central Financeira</h2>
        <p>Acompanhe vencimentos e acesse os meios de pagamento.</p>
      </div>
      <div class="cf-central-icone" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="3" y="5" width="18" height="14" rx="2"/>
          <path d="M7 9h4M15 15h2"/>
          <circle cx="12" cy="12" r="2"/>
        </svg>
      </div>
    </header>

    <div class="cf-resumo">
      <div class="cf-resumo-item">
        <strong>${vencidas.length}</strong>
        <span>Vencidas</span>
      </div>
      <div class="cf-resumo-item">
        <strong>${proximas.length}</strong>
        <span>Próximos 7 dias</span>
      </div>
      <div class="cf-resumo-item cf-resumo-valor">
        <strong>${cfDinheiro(total)}</strong>
        <span>Total em aberto</span>
      </div>
    </div>

    <nav class="cf-filtros" aria-label="Filtros da Central Financeira">
      <button type="button" class="${cfFiltro === 'pendentes' ? 'ativo' : ''}" data-cf-filtro="pendentes">Pendentes</button>
      <button type="button" class="${cfFiltro === 'mes' ? 'ativo' : ''}" data-cf-filtro="mes">Este mês</button>
      <button type="button" class="${cfFiltro === 'pagas' ? 'ativo' : ''}" data-cf-filtro="pagas">Pagas</button>
    </nav>

    <div class="cf-contas-lista">
      ${lista.length
        ? lista.map(conta => cfLinha(conta)).join('')
        : '<div class="cf-lista-vazia">Nenhuma conta neste filtro.</div>'}
    </div>`;

  cfVincularCentral(central);
}

async function cfAtualizar() {
  try {
    await cfCarregar();
    cfRenderizarCentral();
    cfRenderizarHoje();
  } catch (erro) {
    console.error('[Central Financeira]', erro);
  }
}

function cfAgendarAtualizacao() {
  if (cfAtualizacaoAgendada) return;

  cfAtualizacaoAgendada = true;

  window.setTimeout(() => {
    cfAtualizacaoAgendada = false;

    if (cfObterContexto()) {
      cfCarregar()
        .then(() => {
          cfRenderizarCentral();
          cfRenderizarHoje();
        })
        .catch(erro => console.error('[Central Financeira]', erro));
    }
  }, 80);
}

function cfObservarHoje() {
  const area = document.getElementById('cardsHoje');
  if (!area || cfObservadorHoje) return;

  cfObservadorHoje = new MutationObserver(() => {
    if (cfRenderizandoHoje) return;

    const existeNovo = document.getElementById('cfToday');
    const existeAntigo = [...area.querySelectorAll('.card-hoje-titulo-txt')]
      .some(titulo => titulo.textContent?.trim() === 'Contas próximas'
        && !titulo.closest('#cfToday'));

    if (!existeNovo || existeAntigo) cfAgendarAtualizacao();
  });

  cfObservadorHoje.observe(area, {
    childList: true,
  });
}

function cfCarregarEstilos() {
  document.querySelectorAll('link[data-cf]').forEach(link => link.remove());

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
      cfObservarHoje();
      cfAtualizar();
    }

    tentativas += 1;
    if (tentativas > 60) window.clearInterval(espera);
  }, 250);

  window.addEventListener('lifeos:ready', () => {
    cfObservarHoje();
    cfAtualizar();
  });

  window.addEventListener('lifeos:contas-atualizadas', cfAtualizar);

  window.setInterval(() => {
    if (cfObterContexto()) cfAtualizar();
  }, 60000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', cfIniciar, { once: true });
} else {
  cfIniciar();
}


window.addEventListener('lifeos:financeiro-abrir', () => {
  cfAtualizar().catch(erro => console.error('[Central Financeira]', erro));
});
