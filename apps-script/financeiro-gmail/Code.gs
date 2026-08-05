/**
 * LifeOS — Captura de contas recebidas no Gmail
 *
 * Script Properties obrigatorias:
 * LIFEOS_URL          Ex.: https://seu-lifeos.onrender.com
 * LIFEOS_IMPORT_TOKEN O mesmo segredo configurado no Render
 */

const LIFEOS_REGRAS = [
  {
    fornecedor: 'Enel',
    query: 'newer_than:60d has:attachment {from:faturaporemail@riodejaneiro.enel.com from:naoresponder@enel.com}',
  },
  {
    fornecedor: 'EI Fiber',
    query: 'newer_than:60d has:attachment from:financeiro@eifiber.com.br',
  },
  {
    fornecedor: 'QuintoAndar',
    query: 'newer_than:60d has:attachment from:nao-responda@quintoandar.com.br',
  },
  {
    fornecedor: 'Naturgy',
    query: 'newer_than:60d has:attachment from:conta.inteligente@naturgy.com subject:"Naturgy - SUA CONTA DE GÁS CHEGOU"',
  },
];

function sincronizarContasLifeOS() {
  const propriedades = PropertiesService.getScriptProperties();
  const url = String(propriedades.getProperty('LIFEOS_URL') || '').replace(/\/+$/, '');
  const token = propriedades.getProperty('LIFEOS_IMPORT_TOKEN');

  if (!url || !token) {
    throw new Error('Configure LIFEOS_URL e LIFEOS_IMPORT_TOKEN nas propriedades do script.');
  }

  const unicos = new Map();

  LIFEOS_REGRAS.forEach(regra => {
    const threads = GmailApp.search(`${regra.query} -in:spam -in:trash`, 0, 50);

    threads.forEach(thread => {
      thread.getMessages().forEach(mensagem => {
        if (!mensagem.getAttachments().length) return;

        const id = mensagem.getId();
        if (unicos.has(id)) return;

        const anexos = mensagem.getAttachments().map(anexo => ({
          nome: anexo.getName(),
          tipo: anexo.getContentType(),
        }));

        const competencia = detectarCompetencia(
          regra.fornecedor,
          mensagem.getSubject(),
          anexos.map(anexo => anexo.nome),
          mensagem.getDate()
        );

        unicos.set(id, {
          fornecedor: regra.fornecedor,
          competencia,
          chave_cobranca: `${normalizarChave(regra.fornecedor)}:${competencia}`,
          email_message_id: id,
          email_thread_id: thread.getId(),
          remetente: mensagem.getFrom(),
          assunto: mensagem.getSubject(),
          recebido_em: mensagem.getDate().toISOString(),
          anexos,
        });
      });
    });
  });

  const itens = Array.from(unicos.values());

  if (!itens.length) {
    console.log('Nenhuma conta encontrada.');
    return;
  }

  const resposta = UrlFetchApp.fetch(`${url}/integracoes/gmail/contas`, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-LifeOS-Token': token,
    },
    payload: JSON.stringify({ itens }),
    muteHttpExceptions: true,
  });

  const codigo = resposta.getResponseCode();
  const corpo = resposta.getContentText();

  console.log(`LifeOS respondeu ${codigo}: ${corpo}`);

  if (codigo < 200 || codigo >= 300) {
    throw new Error(`Falha ao enviar contas para o LifeOS: ${codigo}`);
  }

  const etiqueta = obterOuCriarEtiqueta('LifeOS/Financeiro/Detectado');

  unicos.forEach(item => {
    const thread = GmailApp.getThreadById(item.email_thread_id);
    if (thread) thread.addLabel(etiqueta);
  });
}

function detectarCompetencia(fornecedor, assunto, nomesAnexos, recebidoEm) {
  const textos = [assunto].concat(nomesAnexos).join(' ');

  // Formatos recorrentes nos anexos do QuintoAndar: 2026_07 ou 2026-07.
  let resultado = textos.match(/\b(20\d{2})[_-](0[1-9]|1[0-2])\b/);
  if (resultado) return `${resultado[1]}-${resultado[2]}`;

  // Formato de nomes como Fatura_082026.
  resultado = textos.match(/\b(0[1-9]|1[0-2])(20\d{2})\b/);
  if (resultado) return `${resultado[2]}-${resultado[1]}`;

  // Formato de data no assunto: 07/08/2026.
  resultado = textos.match(/\b\d{1,2}\/(0?[1-9]|1[0-2])\/(20\d{2})\b/);
  if (resultado) {
    return `${resultado[2]}-${String(resultado[1]).padStart(2, '0')}`;
  }

  // Fallback: mes em que o e-mail foi recebido.
  return Utilities.formatDate(recebidoEm, Session.getScriptTimeZone(), 'yyyy-MM');
}

function normalizarChave(valor) {
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function obterOuCriarEtiqueta(nome) {
  return GmailApp.getUserLabelByName(nome) || GmailApp.createLabel(nome);
}

/**
 * Execute uma unica vez para criar o gatilho automatico de hora em hora.
 */
function instalarGatilhoHorario() {
  ScriptApp.getProjectTriggers()
    .filter(gatilho => gatilho.getHandlerFunction() === 'sincronizarContasLifeOS')
    .forEach(gatilho => ScriptApp.deleteTrigger(gatilho));

  ScriptApp.newTrigger('sincronizarContasLifeOS')
    .timeBased()
    .everyHours(1)
    .create();
}
