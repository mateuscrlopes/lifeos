var LIFEOS_REGRAS = [
  {
    fornecedor: 'Enel',
    query: 'newer_than:60d has:attachment {from:faturaporemail@riodejaneiro.enel.com from:naoresponder@enel.com}'
  },
  {
    fornecedor: 'EI Fiber',
    query: 'newer_than:60d has:attachment from:financeiro@eifiber.com.br'
  },
  {
    fornecedor: 'QuintoAndar',
    query: 'newer_than:60d has:attachment from:nao-responda@quintoandar.com.br'
  },
  {
    fornecedor: 'Naturgy',
    query: 'newer_than:180d has:attachment from:conta.inteligente@naturgy.com'
  }
];

var LIFEOS_LIMITE_PDF = 12 * 1024 * 1024;

function sincronizarContasLifeOS() {
  var propriedades = PropertiesService.getScriptProperties();
  var url = String(propriedades.getProperty('LIFEOS_URL') || '').replace(/\/+$/, '');
  var token = propriedades.getProperty('LIFEOS_IMPORT_TOKEN');

  if (!url || !token) {
    throw new Error('Configure LIFEOS_URL e LIFEOS_IMPORT_TOKEN nas propriedades do script.');
  }

  var unicos = {};
  var anexosBrutos = {};

  LIFEOS_REGRAS.forEach(function(regra) {
    var threads = GmailApp.search(regra.query + ' -in:spam -in:trash', 0, 50);

    threads.forEach(function(thread) {
      thread.getMessages().forEach(function(mensagem) {
        var anexosMensagem = filtrarAnexosFinanceiros(regra.fornecedor, mensagem.getAttachments());
        if (!anexosMensagem.length) return;

        var id = mensagem.getId();
        if (unicos[id]) return;

        var anexos = anexosMensagem.map(function(anexo, indice) {
          return {
            indice: indice,
            nome: anexo.getName(),
            tipo: anexo.getContentType(),
            tamanho: anexo.getSize()
          };
        });

        var nomesAnexos = anexos.map(function(anexo) {
          return anexo.nome;
        });

        var competencia = detectarCompetencia(
          regra.fornecedor,
          mensagem.getSubject(),
          nomesAnexos,
          mensagem.getDate()
        );

        unicos[id] = {
          fornecedor: regra.fornecedor,
          competencia: competencia,
          chave_cobranca: normalizarChave(regra.fornecedor) + ':' + competencia,
          email_message_id: id,
          email_thread_id: thread.getId(),
          remetente: mensagem.getFrom(),
          assunto: mensagem.getSubject(),
          recebido_em: mensagem.getDate().toISOString(),
          corpo_texto: limitarTexto(mensagem.getPlainBody(), 20000),
          anexos: anexos
        };

        anexosBrutos[id] = anexosMensagem;
      });
    });
  });

  var ids = Object.keys(unicos);
  var itens = ids.map(function(id) {
    return unicos[id];
  });

  if (!itens.length) {
    console.log('Nenhuma conta encontrada.');
    return;
  }

  var resposta = UrlFetchApp.fetch(url + '/integracoes/gmail/contas', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-LifeOS-Token': token
    },
    payload: JSON.stringify({ itens: itens }),
    muteHttpExceptions: true
  });

  var codigo = resposta.getResponseCode();
  var corpo = resposta.getContentText();

  console.log('LifeOS respondeu ' + codigo + ': ' + corpo);

  if (codigo < 200 || codigo >= 300) {
    throw new Error('Falha ao enviar contas para o LifeOS: ' + codigo);
  }

  var resultado = JSON.parse(corpo || '{}');
  var uploads = Array.isArray(resultado.uploads) ? resultado.uploads : [];
  var enviados = 0;

  uploads.forEach(function(pedido) {
    var anexosMensagem = anexosBrutos[pedido.email_message_id] || [];
    var anexo = anexosMensagem[Number(pedido.indice)];

    if (!anexo) {
      console.log('Anexo nao encontrado no Gmail: ' + pedido.nome);
      return;
    }

    if (!ehPdf(anexo)) {
      console.log('Anexo ignorado porque nao e PDF: ' + anexo.getName());
      return;
    }

    if (anexo.getSize() > LIFEOS_LIMITE_PDF) {
      console.log('PDF acima de 12 MB, ignorado: ' + anexo.getName());
      return;
    }

    enviarPdfLifeOS(url, token, pedido.chave_cobranca, pedido.indice, anexo);
    enviados += 1;
  });

  console.log('PDFs enviados nesta execucao: ' + enviados);

  extrairPendentesLifeOS(url, token);

  var etiqueta = obterOuCriarEtiqueta('LifeOS/Financeiro/Detectado');

  itens.forEach(function(item) {
    var thread = GmailApp.getThreadById(item.email_thread_id);
    if (thread) thread.addLabel(etiqueta);
  });
}

function filtrarAnexosFinanceiros(fornecedor, anexos) {
  return anexos.filter(function(anexo) {
    var nome = String(anexo.getName() || '');
    var tipo = String(anexo.getContentType() || '').toLowerCase();
    var pdf = tipo === 'application/pdf' || /\.pdf$/i.test(nome);

    if (!pdf) return false;

    if (fornecedor === 'Naturgy') {
      return /^Fatura_.*\.pdf$/i.test(nome);
    }

    return true;
  });
}

function limitarTexto(valor, limite) {
  var texto = String(valor || '').trim();
  return texto ? texto.slice(0, limite) : null;
}

function enviarPdfLifeOS(url, token, chave, indice, anexo) {
  var nomeB64 = Utilities.base64EncodeWebSafe(
    anexo.getName(),
    Utilities.Charset.UTF_8
  );

  var resposta = UrlFetchApp.fetch(url + '/integracoes/gmail/contas/anexo', {
    method: 'post',
    contentType: 'application/pdf',
    headers: {
      'X-LifeOS-Token': token,
      'X-LifeOS-Chave': chave,
      'X-LifeOS-Indice': String(indice),
      'X-LifeOS-Nome-B64': nomeB64
    },
    payload: anexo.getBytes(),
    muteHttpExceptions: true
  });

  var codigo = resposta.getResponseCode();
  var corpo = resposta.getContentText();

  console.log('PDF ' + anexo.getName() + ' -> ' + codigo + ': ' + corpo);

  if (codigo < 200 || codigo >= 300) {
    throw new Error('Falha ao enviar o PDF ' + anexo.getName() + ': ' + codigo);
  }
}

function extrairPendentesLifeOS(url, token) {
  var resposta = UrlFetchApp.fetch(url + '/integracoes/gmail/contas/extrair-pendentes', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-LifeOS-Token': token
    },
    payload: '{}',
    muteHttpExceptions: true
  });

  var codigo = resposta.getResponseCode();
  var corpo = resposta.getContentText();

  console.log('Leitura dos PDFs -> ' + codigo + ': ' + corpo);

  if (codigo < 200 || codigo >= 300) {
    throw new Error('Falha na leitura automatica dos PDFs: ' + codigo);
  }
}

function ehPdf(anexo) {
  var nome = String(anexo.getName() || '').toLowerCase();
  var tipo = String(anexo.getContentType() || '').toLowerCase();
  return tipo === 'application/pdf' || /\.pdf$/.test(nome);
}

function detectarCompetencia(fornecedor, assunto, nomesAnexos, recebidoEm) {
  var textos = [assunto].concat(nomesAnexos).join(' ');
  var resultado = textos.match(/\b(20\d{2})[_-](0[1-9]|1[0-2])\b/);

  if (resultado) {
    return resultado[1] + '-' + resultado[2];
  }

  resultado = textos.match(/\b(0[1-9]|1[0-2])(20\d{2})\b/);

  if (resultado) {
    return resultado[2] + '-' + resultado[1];
  }

  resultado = textos.match(/\b\d{1,2}\/(0?[1-9]|1[0-2])\/(20\d{2})\b/);

  if (resultado) {
    return resultado[2] + '-' + String(resultado[1]).padStart(2, '0');
  }

  return Utilities.formatDate(
    recebidoEm,
    Session.getScriptTimeZone(),
    'yyyy-MM'
  );
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

function instalarGatilhoHorario() {
  ScriptApp.getProjectTriggers()
    .filter(function(gatilho) {
      return gatilho.getHandlerFunction() === 'sincronizarContasLifeOS';
    })
    .forEach(function(gatilho) {
      ScriptApp.deleteTrigger(gatilho);
    });

  ScriptApp.newTrigger('sincronizarContasLifeOS')
    .timeBased()
    .everyHours(1)
    .create();
}
