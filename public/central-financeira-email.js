// Central Financeira — Caixa de entrada do Gmail v2

let cfeClient = null;
let cfeUsuario = null;
let cfeItens = [];
let cfeCarregando = false;
let cfeObservador = null;

const cfeEscapar = (valor = '') => String(valor)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function cfeContexto() {
  const contexto = window.lifeosContext;
  if (!contexto?.supa || !contexto?.usuario) return false;

  cfeClient = contexto.supa;
  cfeUsuario = contexto.usuario;
  return true;
}

function cfeData(valor) {
  if (!valor) return 'Data não informada';
  return new Date(valor).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function cfeNomePadrao(item) {
  const mapa = {
    Enel: 'Energia elétrica',
    'EI Fiber': 'Internet',
    QuintoAndar: 'Aluguel',
    Naturgy: 'Gás',
  };
  return mapa[item.fornecedor] || item.fornecedor;
}

function cfeCategoriaPadrao(item) {
  return item.fornecedor === 'QuintoAndar' ? 'moradia' : 'utilidades';
}

function cfeDataInput(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || '')) ? valor : '';
}

function cfeValorInput(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero)
    ? numero.toFixed(2).replace('.', ',')
    : '';
}

function cfeDataCompleta(valor) {
  const data = cfeDataInput(valor);
  if (!data) return null;

  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function cfeResumoExtracao(item) {
  const dados = item.dados_extraidos || {};
  const partes = [];

  if (dados.valor != null && Number.isFinite(Number(dados.valor))) {
    partes.push(`Valor R$ ${Number(dados.valor).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`);
  }

  const vencimento = cfeDataCompleta(dados.vencimento);
  if (vencimento) partes.push(`Vencimento ${vencimento}`);
  if (dados.linha_digitavel) partes.push('Código de pagamento encontrado');

  return partes;
}

async function cfeAbrirPdf(anexo, botao) {
  if (!anexo?.path || !cfeClient) return;

  const textoOriginal = botao.textContent;
  const aba = window.open('about:blank', '_blank');

  botao.disabled = true;
  botao.textContent = 'Abrindo…';

  try {
    const { data, error } = await cfeClient.storage
      .from('contas-email')
      .createSignedUrl(anexo.path, 300);

    if (error) throw error;

    const url = data?.signedUrl || data?.signedURL;
    if (!url) throw new Error('URL temporária não foi criada.');

    if (aba) {
      aba.opener = null;
      aba.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (erro) {
    if (aba) aba.close();
    console.error('[Caixa Financeira PDF]', erro);
    alert('Não foi possível abrir este PDF.');
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

async function cfeCarregar() {
  if (cfeCarregando || !cfeContexto()) return;

  cfeCarregando = true;

  try {
    const { data, error } = await cfeClient
      .from('contas_email_caixa')
      .select('id,fornecedor,competencia,email_message_id,remetente,assunto,recebido_em,anexos,status,dados_extraidos,extracao_status,extracao_erro')
      .eq('casa_id', cfeUsuario.casa_id)
      .eq('status', 'aguardando')
      .order('recebido_em', { ascending: false });

    if (error) throw error;
    cfeItens = data || [];
    cfeRenderizar();
  } catch (erro) {
    console.error('[Caixa Financeira]', erro);
  } finally {
    cfeCarregando = false;
  }
}

function cfeRenderizar() {
  const central = document.getElementById('cfCentral');
  if (!central) return;

  let painel = document.getElementById('cfeInbox');

  if (!painel) {
    painel = document.createElement('section');
    painel.id = 'cfeInbox';
    painel.className = 'cfe-inbox';

    const cabecalho = central.querySelector('.cf-central-cabecalho');
    if (cabecalho) cabecalho.insertAdjacentElement('afterend', painel);
    else central.prepend(painel);
  }

  painel.innerHTML = `
    <header class="cfe-cabecalho">
      <div>
        <span class="cfe-kicker">Gmail</span>
        <h3>Novas contas recebidas</h3>
        <p>${cfeItens.length
          ? `${cfeItens.length} ${cfeItens.length === 1 ? 'conta aguarda' : 'contas aguardam'} conferência`
          : 'Nenhuma conta nova aguardando conferência'}</p>
      </div>
      <button type="button" data-cfe-atualizar aria-label="Atualizar contas">Atualizar</button>
    </header>

    ${cfeItens.length ? `
      <div class="cfe-lista">
        ${cfeItens.map(item => `
          <article class="cfe-item">
            <div class="cfe-item-texto">
              <strong>${cfeEscapar(item.fornecedor)}</strong>
              <span>${cfeEscapar(item.assunto || 'Conta recebida por e-mail')}</span>
              <small>
                Recebida em ${cfeData(item.recebido_em)}
                ${item.competencia ? ` · competência ${cfeEscapar(item.competencia)}` : ''}
              </small>
            </div>
            <button type="button" data-cfe-conferir="${item.id}">Conferir</button>
          </article>
        `).join('')}
      </div>
    ` : ''}`;

  painel.querySelector('[data-cfe-atualizar]')?.addEventListener('click', cfeCarregar);

  painel.querySelectorAll('[data-cfe-conferir]').forEach(botao => {
    botao.addEventListener('click', () => {
      const item = cfeItens.find(registro => registro.id === botao.dataset.cfeConferir);
      if (item) cfeAbrirConferencia(item);
    });
  });
}

function cfeAbrirConferencia(item) {
  document.querySelector('.cfe-modal')?.remove();

  const anexos = Array.isArray(item.anexos) ? item.anexos : [];
  const modal = document.createElement('div');
  modal.className = 'cf-modal cfe-modal';

  modal.innerHTML = `
    <section class="cf-modal-conteudo cfe-modal-conteudo" role="dialog" aria-modal="true" aria-label="Conferir conta recebida">
      <header class="cf-modal-cabecalho">
        <div>
          <span class="cf-modal-kicker">Conta recebida por e-mail</span>
          <h3>${cfeEscapar(item.fornecedor)}</h3>
          <p>${cfeEscapar(item.assunto || '')}</p>
        </div>
        <button type="button" class="cf-modal-fechar" data-cfe-fechar aria-label="Fechar">×</button>
      </header>

      ${cfeResumoExtracao(item).length ? `
        <div class="cfe-leitura">
          <span>Leitura automática</span>
          <div>${cfeResumoExtracao(item).map(parte => `<strong>${cfeEscapar(parte)}</strong>`).join('')}</div>
          <small>Confira os dados antes de adicionar a conta.</small>
        </div>
      ` : item.extracao_status === 'falha' ? `
        <div class="cfe-leitura cfe-leitura-falha">
          <span>Leitura automática</span>
          <strong>Não foi possível preencher esta conta automaticamente.</strong>
          <small>O PDF continua disponível para conferência manual.</small>
        </div>
      ` : ''}

      ${anexos.length ? `
        <div class="cfe-anexos">
          <span>Documentos da conta</span>
          ${anexos.map((anexo, indice) => `
            <div class="cfe-anexo-linha">
              <div>
                <strong>${cfeEscapar(anexo.nome || `Anexo ${indice + 1}`)}</strong>
                <small>${anexo.path ? 'PDF disponível no LifeOS' : 'Arquivo aguardando envio pelo Gmail'}</small>
              </div>
              ${anexo.path
                ? `<button type="button" data-cfe-pdf="${indice}">Abrir PDF</button>`
                : '<span class="cfe-anexo-pendente">Pendente</span>'}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <form class="cfe-form" data-cfe-form>
        <label>
          <span>Nome da conta</span>
          <input name="nome" required maxlength="160" value="${cfeEscapar(cfeNomePadrao(item))}">
        </label>

        <label>
          <span>Categoria</span>
          <select name="categoria">
            <option value="utilidades" ${cfeCategoriaPadrao(item) === 'utilidades' ? 'selected' : ''}>Utilidades</option>
            <option value="moradia" ${cfeCategoriaPadrao(item) === 'moradia' ? 'selected' : ''}>Moradia</option>
            <option value="internet">Internet</option>
            <option value="outros">Outros</option>
          </select>
        </label>

        <div class="cfe-form-linha">
          <label>
            <span>Valor</span>
            <input name="valor" inputmode="decimal" placeholder="0,00" value="${cfeEscapar(cfeValorInput(item.dados_extraidos?.valor))}">
          </label>

          <label>
            <span>Vencimento</span>
            <input name="vencimento" type="date" required value="${cfeEscapar(cfeDataInput(item.dados_extraidos?.vencimento))}">
          </label>
        </div>

        <div class="cfe-acoes">
          <button type="button" class="cf-acao-secundaria" data-cfe-ignorar>Ignorar</button>
          <button type="submit" class="cf-acao-principal">Adicionar às contas</button>
        </div>
      </form>
    </section>`;

  modal.querySelectorAll('[data-cfe-pdf]').forEach(botao => {
    botao.addEventListener('click', () => {
      const anexo = anexos[Number(botao.dataset.cfePdf)];
      cfeAbrirPdf(anexo, botao);
    });
  });

  modal.addEventListener('click', evento => {
    if (evento.target === modal || evento.target.closest('[data-cfe-fechar]')) {
      evento.preventDefault();
      modal.remove();
    }
  });

  modal.querySelector('[data-cfe-ignorar]')?.addEventListener('click', async evento => {
    evento.preventDefault();
    const confirmar = confirm(`Ignorar esta conta da ${item.fornecedor}?`);
    if (!confirmar) return;

    const { error } = await cfeClient
      .from('contas_email_caixa')
      .update({ status: 'ignorado', atualizado_em: new Date().toISOString() })
      .eq('id', item.id);

    if (error) {
      alert('Não foi possível ignorar esta conta.');
      return;
    }

    modal.remove();
    await cfeCarregar();
  });

  const formulario = modal.querySelector('[data-cfe-form]');
  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();

    const botao = formulario.querySelector('[type="submit"]');
    const dados = new FormData(formulario);
    const valorTexto = String(dados.get('valor') || '').trim().replace(/\./g, '').replace(',', '.');

    botao.disabled = true;
    botao.textContent = 'Adicionando…';

    try {
      const novaConta = {
        casa_id: cfeUsuario.casa_id,
        nome: String(dados.get('nome') || '').trim(),
        categoria: String(dados.get('categoria') || '').trim() || null,
        valor: valorTexto ? Number(valorTexto) : null,
        vencimento: dados.get('vencimento'),
        paga: false,
        recorrente: false,
        criada_por: cfeUsuario.id,
        origem: 'email',
        fornecedor: item.fornecedor,
        email_message_id: item.email_message_id,
        email_assunto: item.assunto,
        importada_em: new Date().toISOString(),
        revisada: true,
        linha_digitavel: item.dados_extraidos?.linha_digitavel || null,
        atualizado_em: new Date().toISOString(),
      };

      const { data: conta, error: erroConta } = await cfeClient
        .from('contas')
        .insert(novaConta)
        .select('id')
        .single();

      if (erroConta) throw erroConta;

      const { error: erroCaixa } = await cfeClient
        .from('contas_email_caixa')
        .update({
          status: 'importado',
          conta_id: conta.id,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', item.id);

      if (erroCaixa) throw erroCaixa;

      modal.remove();
      await cfeCarregar();
      window.dispatchEvent(new CustomEvent('lifeos:financeiro-atualizar'));
    } catch (erro) {
      console.error('[Caixa Financeira]', erro);
      botao.disabled = false;
      botao.textContent = 'Adicionar às contas';
      alert('Não foi possível adicionar esta conta.');
    }
  });

  document.body.appendChild(modal);
  formulario.querySelector('[name="vencimento"]')?.focus();
}

function cfeGarantirPainel() {
  if (!document.getElementById('cfCentral')) return;
  if (!document.getElementById('cfeInbox')) cfeRenderizar();
}

function cfeIniciar() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/central-financeira-email.css?v=3';
  link.dataset.cfe = '1';
  document.head.appendChild(link);

  let tentativas = 0;
  const espera = window.setInterval(() => {
    if (cfeContexto()) {
      window.clearInterval(espera);
      cfeCarregar();
    }

    tentativas += 1;
    if (tentativas > 60) window.clearInterval(espera);
  }, 250);

  cfeObservador = new MutationObserver(cfeGarantirPainel);
  cfeObservador.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('lifeos:ready', cfeCarregar);
  window.setInterval(cfeCarregar, 60000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', cfeIniciar, { once: true });
} else {
  cfeIniciar();
}
