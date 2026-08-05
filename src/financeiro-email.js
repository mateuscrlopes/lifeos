// financeiro-email.js
// Recebe metadados e PDFs de contas detectadas pelo Google Apps Script.
// O token e a chave administrativa ficam exclusivamente no backend.

import crypto from 'crypto';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import {
  consolidarExtracoes,
  EXTRACAO_VERSAO,
  extrairDadosPdf,
  extrairDadosTexto,
} from './financeiro-extracao.js';

const FORNECEDORES = new Set(['Enel', 'EI Fiber', 'QuintoAndar', 'Naturgy']);
const BUCKET_CONTAS = 'contas-email';
const LIMITE_PDF_BYTES = 12 * 1024 * 1024;

function tokenValido(recebido) {
  const esperado = String(config.gmailImportToken || '');
  const informado = String(recebido || '');

  if (!esperado || !informado) return false;

  const a = Buffer.from(esperado);
  const b = Buffer.from(informado);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function texto(valor, limite = 500) {
  const normalizado = String(valor || '').trim();
  return normalizado ? normalizado.slice(0, limite) : null;
}

function numeroInteiro(valor, padrao = null) {
  const numero = Number.parseInt(valor, 10);
  return Number.isInteger(numero) ? numero : padrao;
}

function ehPdf(anexo) {
  const nome = String(anexo?.nome || '');
  const tipo = String(anexo?.tipo || '').toLowerCase();
  return tipo === 'application/pdf' || nome.toLowerCase().endsWith('.pdf');
}

function normalizarAnexos(anexos) {
  if (!Array.isArray(anexos)) return [];

  return anexos.slice(0, 10).map((anexo, indicePadrao) => ({
    indice: numeroInteiro(anexo?.indice, indicePadrao),
    nome: texto(anexo?.nome, 240),
    tipo: texto(anexo?.tipo, 120),
    tamanho: numeroInteiro(anexo?.tamanho, null),
  })).filter(anexo => anexo.nome);
}

function camposPagamento(dados) {
  if (!dados || typeof dados !== 'object') return {};

  return {
    valor: Number.isFinite(Number(dados.valor)) ? Number(dados.valor) : null,
    vencimento: texto(dados.vencimento, 10),
    linha_digitavel: texto(dados.linha_digitavel, 80),
    pix_copia_cola: texto(dados.pix_copia_cola, 1500),
  };
}

function temDadosPagamento(dados) {
  return Boolean(
    dados?.valor
    || dados?.vencimento
    || dados?.linha_digitavel
    || dados?.pix_copia_cola
  );
}

function selecionarDadosEmail(fornecedor, dadosLidos) {
  const dados = camposPagamento(dadosLidos);
  let selecionados = {};

  if (fornecedor === 'Naturgy') {
    // A Conta Inteligente já traz os quatro campos de pagamento no corpo.
    selecionados = dados;
  } else if (fornecedor === 'EI Fiber') {
    // O e-mail é a fonte mais confiável para o código; valor e vencimento vêm do PDF.
    selecionados = {
      linha_digitavel: dados.linha_digitavel,
      pix_copia_cola: dados.pix_copia_cola,
    };
  } else if (fornecedor === 'Enel') {
    // O resumo do e-mail é útil para valor e vencimento, mas nunca para escolher
    // o código de pagamento: isso fica restrito ao bloco bancário do PDF.
    selecionados = {
      valor: dados.valor,
      vencimento: dados.vencimento,
    };
  }

  return temDadosPagamento(selecionados) ? selecionados : null;
}

function normalizarItem(item) {
  const fornecedor = texto(item?.fornecedor, 80);
  const messageId = texto(item?.email_message_id, 200);
  const chave = texto(item?.chave_cobranca, 200);

  if (!FORNECEDORES.has(fornecedor) || !messageId || !chave) return null;

  const corpoTexto = texto(item?.corpo_texto, 20000);
  const dadosEmailLidos = corpoTexto
    ? extrairDadosTexto(corpoTexto, { fornecedor, origem: 'email' })
    : null;
  const dadosEmail = selecionarDadosEmail(fornecedor, dadosEmailLidos);

  return {
    casa_id: config.lifeosCasaId,
    fornecedor,
    chave_cobranca: chave,
    competencia: texto(item?.competencia, 20),
    email_message_id: messageId,
    email_thread_id: texto(item?.email_thread_id, 200),
    remetente: texto(item?.remetente, 320),
    assunto: texto(item?.assunto, 500),
    recebido_em: item?.recebido_em || new Date().toISOString(),
    anexos: normalizarAnexos(item?.anexos),
    status: 'aguardando',
    atualizado_em: new Date().toISOString(),
    dados_email: dadosEmail,
  };
}

function clienteAdmin() {
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function senhaPdfPorFornecedor(fornecedor) {
  if (fornecedor === 'Enel') {
    return String(config.enelPdfPassword || '');
  }

  return '';
}

function deveExtrairAnexo(anexo, fornecedor) {
  if (!anexo?.path) return false;

  const extracao = anexo?.extracao;
  if (!extracao?.status) return true;

  const versao = numeroInteiro(extracao.versao, 0);
  if (versao < EXTRACAO_VERSAO) return true;

  const senhaConfigurada = Boolean(senhaPdfPorFornecedor(fornecedor));

  return fornecedor === 'Enel'
    && senhaConfigurada
    && extracao.status === 'falha'
    && extracao.codigo === 'senha_necessaria';
}

function decodificarBase64Url(valor) {
  const recebido = String(valor || '').trim();
  if (!recebido) return null;

  try {
    const normal = recebido.replace(/-/g, '+').replace(/_/g, '/');
    const preenchido = normal + '='.repeat((4 - (normal.length % 4)) % 4);
    return Buffer.from(preenchido, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function nomeSeguroArquivo(valor, indice) {
  const base = String(valor || `conta-${indice + 1}.pdf`)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);

  if (!base) return `conta-${indice + 1}.pdf`;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

function indiceDoAnexo(anexo, indicePadrao) {
  return numeroInteiro(anexo?.indice, indicePadrao);
}

function anexoJaEnviado(anexosExistentes, anexoNovo, indicePadrao) {
  const indiceNovo = indiceDoAnexo(anexoNovo, indicePadrao);
  const nomeNovo = String(anexoNovo?.nome || '').trim().toLowerCase();

  return anexosExistentes.some((anexo, indiceExistente) => {
    if (!anexo?.path) return false;

    const mesmoIndice = indiceDoAnexo(anexo, indiceExistente) === indiceNovo;
    const mesmoNome = nomeNovo && String(anexo?.nome || '').trim().toLowerCase() === nomeNovo;
    return mesmoIndice || mesmoNome;
  });
}


function itemParaBanco(item) {
  const { dados_email: dadosEmail, ...banco } = item;
  return banco;
}

function statusDados(dados) {
  const principais = Number(Boolean(dados?.valor)) + Number(Boolean(dados?.vencimento));

  if (principais === 2) return 'sucesso';
  if (principais === 1 || dados?.linha_digitavel || dados?.pix_copia_cola) return 'parcial';
  return 'falha';
}

function mesclarCampos(base, novos) {
  const atuais = camposPagamento(base);
  const recebidos = camposPagamento(novos);

  return {
    valor: recebidos.valor ?? atuais.valor ?? null,
    vencimento: recebidos.vencimento || atuais.vencimento || null,
    linha_digitavel: recebidos.linha_digitavel || atuais.linha_digitavel || null,
    pix_copia_cola: recebidos.pix_copia_cola || atuais.pix_copia_cola || null,
  };
}

function mesclarDadosFornecedor(fornecedor, dadosAtuais, { pdf = null, email = null } = {}) {
  const atuais = dadosAtuais && typeof dadosAtuais === 'object' ? dadosAtuais : {};
  const origensAtuais = atuais.origens_dados && typeof atuais.origens_dados === 'object'
    ? atuais.origens_dados
    : {};

  const emailAnterior = origensAtuais.email || {};
  const pdfAnterior = origensAtuais.pdf || (
    temDadosPagamento(atuais) ? camposPagamento(atuais) : {}
  );

  const dadosEmail = mesclarCampos(emailAnterior, email);
  const dadosPdf = mesclarCampos(pdfAnterior, pdf);
  let finais;

  if (fornecedor === 'Naturgy') {
    finais = {
      valor: dadosEmail.valor ?? dadosPdf.valor,
      vencimento: dadosEmail.vencimento || dadosPdf.vencimento,
      linha_digitavel: dadosEmail.linha_digitavel || dadosPdf.linha_digitavel,
      pix_copia_cola: dadosEmail.pix_copia_cola || dadosPdf.pix_copia_cola,
    };
  } else if (fornecedor === 'EI Fiber') {
    finais = {
      valor: dadosPdf.valor ?? dadosEmail.valor,
      vencimento: dadosPdf.vencimento || dadosEmail.vencimento,
      linha_digitavel: dadosEmail.linha_digitavel || dadosPdf.linha_digitavel,
      pix_copia_cola: dadosEmail.pix_copia_cola || dadosPdf.pix_copia_cola,
    };
  } else if (fornecedor === 'Enel') {
    finais = {
      valor: dadosEmail.valor ?? dadosPdf.valor,
      vencimento: dadosEmail.vencimento || dadosPdf.vencimento,
      linha_digitavel: dadosPdf.linha_digitavel || null,
      pix_copia_cola: dadosPdf.pix_copia_cola || null,
    };
  } else {
    finais = {
      valor: dadosPdf.valor ?? dadosEmail.valor,
      vencimento: dadosPdf.vencimento || dadosEmail.vencimento,
      linha_digitavel: dadosPdf.linha_digitavel || dadosEmail.linha_digitavel,
      pix_copia_cola: dadosPdf.pix_copia_cola || dadosEmail.pix_copia_cola,
    };
  }

  return {
    ...atuais,
    ...(pdf && typeof pdf === 'object' ? pdf : {}),
    ...finais,
    versao: EXTRACAO_VERSAO,
    origens_dados: {
      email: dadosEmail,
      pdf: dadosPdf,
    },
  };
}

async function sincronizarContaOficial(admin, contaId, dadosExtraidos) {
  if (!contaId || !dadosExtraidos) return false;

  const { data: conta, error: erroConsulta } = await admin
    .from('contas')
    .select('id,linha_digitavel,pix_copia_cola')
    .eq('id', contaId)
    .maybeSingle();

  if (erroConsulta) throw erroConsulta;
  if (!conta) return false;

  const atualizacoes = {};

  if (
    dadosExtraidos.linha_digitavel
    && dadosExtraidos.linha_digitavel !== conta.linha_digitavel
  ) {
    atualizacoes.linha_digitavel = dadosExtraidos.linha_digitavel;
  }

  if (
    dadosExtraidos.pix_copia_cola
    && dadosExtraidos.pix_copia_cola !== conta.pix_copia_cola
  ) {
    atualizacoes.pix_copia_cola = dadosExtraidos.pix_copia_cola;
  }

  if (!Object.keys(atualizacoes).length) return false;

  atualizacoes.atualizado_em = new Date().toISOString();

  const { error: erroAtualizacao } = await admin
    .from('contas')
    .update(atualizacoes)
    .eq('id', contaId);

  if (erroAtualizacao) throw erroAtualizacao;
  return true;
}

export function registrarRotasFinanceiroEmail(app) {
  app.post('/integracoes/gmail/contas', async (req, res) => {
    if (!tokenValido(req.get('x-lifeos-token'))) {
      return res.status(401).json({ ok: false, erro: 'Nao autorizado.' });
    }

    if (!config.supabaseServiceKey || !config.lifeosCasaId) {
      return res.status(503).json({
        ok: false,
        erro: 'Integracao financeira nao configurada no servidor.',
      });
    }

    const recebidos = Array.isArray(req.body?.itens) ? req.body.itens : [];

    if (!recebidos.length || recebidos.length > 50) {
      return res.status(400).json({
        ok: false,
        erro: 'Envie entre 1 e 50 itens por chamada.',
      });
    }

    const itens = recebidos.map(normalizarItem).filter(Boolean);

    if (!itens.length) {
      return res.status(400).json({
        ok: false,
        erro: 'Nenhum item valido foi recebido.',
      });
    }

    // Uma cobranca por fornecedor/competencia. Lembretes repetidos nao criam copias.
    const itensPorChave = new Map();
    itens.forEach(item => {
      if (!itensPorChave.has(item.chave_cobranca)) {
        itensPorChave.set(item.chave_cobranca, item);
      }
    });

    const itensUnicosComDados = Array.from(itensPorChave.values());
    const itensUnicos = itensUnicosComDados.map(itemParaBanco);
    const chaves = itensUnicos.map(item => item.chave_cobranca);
    const admin = clienteAdmin();

    const { data, error } = await admin
      .from('contas_email_caixa')
      .upsert(itensUnicos, {
        onConflict: 'casa_id,chave_cobranca',
        ignoreDuplicates: true,
      })
      .select('id,chave_cobranca');

    if (error) {
      console.error('[Financeiro Gmail]', error.message);
      return res.status(500).json({
        ok: false,
        erro: 'Nao foi possivel registrar as contas detectadas.',
      });
    }

    const { data: registros, error: erroConsulta } = await admin
      .from('contas_email_caixa')
      .select('id,chave_cobranca,anexos,dados_extraidos,conta_id,status')
      .eq('casa_id', config.lifeosCasaId)
      .in('chave_cobranca', chaves);

    if (erroConsulta) {
      console.error('[Financeiro Gmail]', erroConsulta.message);
      return res.status(500).json({
        ok: false,
        erro: 'As contas foram registradas, mas os anexos nao puderam ser conferidos.',
      });
    }

    const uploads = [];
    let pixEmailDetectados = 0;

    for (const registro of registros || []) {
      const item = itensPorChave.get(registro.chave_cobranca);
      if (!item) continue;

      if (item.dados_email) {
        const dadosExtraidos = mesclarDadosFornecedor(
          item.fornecedor,
          registro.dados_extraidos,
          { email: item.dados_email }
        );

        const { error: erroDadosEmail } = await admin
          .from('contas_email_caixa')
          .update({
            dados_extraidos: dadosExtraidos,
            extracao_status: statusDados(dadosExtraidos),
            extracao_em: new Date().toISOString(),
            extracao_erro: null,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', registro.id);

        if (erroDadosEmail) {
          console.error('[Financeiro Gmail Corpo]', erroDadosEmail.message);
          return res.status(500).json({
            ok: false,
            erro: 'A conta foi encontrada, mas os dados do e-mail nao puderam ser registrados.',
          });
        }

        registro.dados_extraidos = dadosExtraidos;

        if (registro.conta_id) {
          await sincronizarContaOficial(admin, registro.conta_id, dadosExtraidos);
        }

        if (item.dados_email.pix_copia_cola) pixEmailDetectados += 1;
      }

      const existentes = Array.isArray(registro.anexos) ? registro.anexos : [];

      item.anexos.forEach((anexo, indicePadrao) => {
        if (!ehPdf(anexo) || anexoJaEnviado(existentes, anexo, indicePadrao)) return;

        uploads.push({
          chave_cobranca: item.chave_cobranca,
          email_message_id: item.email_message_id,
          indice: indiceDoAnexo(anexo, indicePadrao),
          nome: anexo.nome,
        });
      });
    }

    return res.json({
      ok: true,
      recebidos: recebidos.length,
      validos: itens.length,
      cobrancas: itensUnicos.length,
      novos: data?.length || 0,
      pix_email_detectados: pixEmailDetectados,
      uploads,
    });
  });

  const receberPdf = express.raw({
    type: ['application/pdf', 'application/octet-stream'],
    limit: LIMITE_PDF_BYTES,
  });

  app.post('/integracoes/gmail/contas/anexo', receberPdf, async (req, res) => {
    if (!tokenValido(req.get('x-lifeos-token'))) {
      return res.status(401).json({ ok: false, erro: 'Nao autorizado.' });
    }

    if (!config.supabaseServiceKey || !config.lifeosCasaId) {
      return res.status(503).json({
        ok: false,
        erro: 'Integracao financeira nao configurada no servidor.',
      });
    }

    const chave = texto(req.get('x-lifeos-chave'), 200);
    const indice = numeroInteiro(req.get('x-lifeos-indice'), null);
    const nomeOriginal = decodificarBase64Url(req.get('x-lifeos-nome-b64'));

    if (!chave || indice === null || indice < 0 || indice > 9) {
      return res.status(400).json({ ok: false, erro: 'Identificacao do anexo invalida.' });
    }

    if (!Buffer.isBuffer(req.body) || req.body.length < 5) {
      return res.status(400).json({ ok: false, erro: 'PDF vazio ou invalido.' });
    }

    if (req.body.length > LIMITE_PDF_BYTES) {
      return res.status(413).json({ ok: false, erro: 'PDF acima do limite de 12 MB.' });
    }

    if (req.body.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return res.status(415).json({ ok: false, erro: 'O anexo recebido nao e um PDF valido.' });
    }

    const admin = clienteAdmin();

    const { data: registro, error: erroRegistro } = await admin
      .from('contas_email_caixa')
      .select('id,fornecedor,competencia,anexos,dados_extraidos,extracao_status,conta_id')
      .eq('casa_id', config.lifeosCasaId)
      .eq('chave_cobranca', chave)
      .single();

    if (erroRegistro || !registro) {
      console.error('[Financeiro Gmail PDF]', erroRegistro?.message || 'Cobranca nao encontrada.');
      return res.status(404).json({ ok: false, erro: 'Cobranca nao encontrada.' });
    }

    const nomeArquivo = nomeSeguroArquivo(nomeOriginal, indice);
    const caminho = `${config.lifeosCasaId}/${registro.id}/${indice}-${nomeArquivo}`;

    const { error: erroUpload } = await admin.storage
      .from(BUCKET_CONTAS)
      .upload(caminho, req.body, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true,
      });

    if (erroUpload) {
      console.error('[Financeiro Gmail PDF]', erroUpload.message);
      return res.status(500).json({ ok: false, erro: 'Nao foi possivel guardar o PDF.' });
    }

    const anexos = Array.isArray(registro.anexos)
      ? registro.anexos.map(anexo => ({ ...anexo }))
      : [];

    const posicao = anexos.findIndex((anexo, indicePadrao) =>
      indiceDoAnexo(anexo, indicePadrao) === indice
    );

    const extracao = await extrairDadosPdf(req.body, {
      fornecedor: registro.fornecedor,
      competencia: registro.competencia,
      senhaPdf: senhaPdfPorFornecedor(registro.fornecedor),
    });

    const anexoAtualizado = {
      ...(posicao >= 0 ? anexos[posicao] : {}),
      indice,
      nome: nomeOriginal || nomeArquivo,
      tipo: 'application/pdf',
      tamanho: req.body.length,
      path: caminho,
      enviado_em: new Date().toISOString(),
      extracao,
    };

    if (posicao >= 0) anexos[posicao] = anexoAtualizado;
    else anexos.push(anexoAtualizado);

    anexos.sort((a, b) => indiceDoAnexo(a, 0) - indiceDoAnexo(b, 0));

    const consolidado = consolidarExtracoes(anexos);
    consolidado.dados = mesclarDadosFornecedor(
      registro.fornecedor,
      registro.dados_extraidos,
      { pdf: consolidado.dados }
    );
    consolidado.status = statusDados(consolidado.dados);

    const { error: erroAtualizacao } = await admin
      .from('contas_email_caixa')
      .update({
        anexos,
        dados_extraidos: consolidado.dados,
        extracao_status: consolidado.status,
        extracao_em: new Date().toISOString(),
        extracao_erro: consolidado.erro,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', registro.id);

    if (erroAtualizacao) {
      console.error('[Financeiro Gmail PDF]', erroAtualizacao.message);
      return res.status(500).json({
        ok: false,
        erro: 'O PDF foi guardado, mas o registro da conta nao foi atualizado.',
      });
    }

    if (registro.conta_id) {
      try {
        await sincronizarContaOficial(admin, registro.conta_id, consolidado.dados);
      } catch (erroConta) {
        console.error('[Financeiro Conta Oficial]', erroConta.message);
      }
    }

    return res.json({
      ok: true,
      indice,
      nome: nomeOriginal || nomeArquivo,
      extracao_status: consolidado.status,
      dados_extraidos: consolidado.dados,
    });
  });

  app.post('/integracoes/gmail/contas/extrair-pendentes', async (req, res) => {
    if (!tokenValido(req.get('x-lifeos-token'))) {
      return res.status(401).json({ ok: false, erro: 'Nao autorizado.' });
    }

    if (!config.supabaseServiceKey || !config.lifeosCasaId) {
      return res.status(503).json({
        ok: false,
        erro: 'Integracao financeira nao configurada no servidor.',
      });
    }

    const admin = clienteAdmin();

    const { data: registros, error } = await admin
      .from('contas_email_caixa')
      .select('id,fornecedor,competencia,anexos,extracao_status,dados_extraidos,conta_id,status')
      .eq('casa_id', config.lifeosCasaId)
      .in('status', ['aguardando', 'importado'])
      .limit(30);

    if (error) {
      console.error('[Financeiro Extracao]', error.message);
      return res.status(500).json({ ok: false, erro: 'Nao foi possivel consultar os PDFs.' });
    }

    const pendentes = (registros || []).filter(registro => {
      const anexos = Array.isArray(registro.anexos) ? registro.anexos : [];
      return anexos.some(anexo => deveExtrairAnexo(anexo, registro.fornecedor));
    });

    let processados = 0;
    let falhas = 0;
    let contasAtualizadas = 0;

    for (const registro of pendentes) {
      const anexos = Array.isArray(registro.anexos)
        ? registro.anexos.map(anexo => ({ ...anexo }))
        : [];

      for (let indice = 0; indice < anexos.length; indice += 1) {
        const anexo = anexos[indice];
        if (!deveExtrairAnexo(anexo, registro.fornecedor)) continue;

        const { data: arquivo, error: erroDownload } = await admin.storage
          .from(BUCKET_CONTAS)
          .download(anexo.path);

        if (erroDownload || !arquivo) {
          anexos[indice].extracao = {
            status: 'falha',
            codigo: 'download',
            erro: erroDownload?.message || 'Nao foi possivel baixar o PDF.',
          };
          falhas += 1;
          continue;
        }

        const buffer = Buffer.from(await arquivo.arrayBuffer());
        anexos[indice].extracao = await extrairDadosPdf(buffer, {
          fornecedor: registro.fornecedor,
          competencia: registro.competencia,
          senhaPdf: senhaPdfPorFornecedor(registro.fornecedor),
        });

        if (anexos[indice].extracao.status === 'falha') falhas += 1;
        processados += 1;
      }

      const consolidado = consolidarExtracoes(anexos);
      consolidado.dados = mesclarDadosFornecedor(
        registro.fornecedor,
        registro.dados_extraidos,
        { pdf: consolidado.dados }
      );
      consolidado.status = statusDados(consolidado.dados);

      const { error: erroAtualizacao } = await admin
        .from('contas_email_caixa')
        .update({
          anexos,
          dados_extraidos: consolidado.dados,
          extracao_status: consolidado.status,
          extracao_em: new Date().toISOString(),
          extracao_erro: consolidado.erro,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', registro.id);

      if (erroAtualizacao) {
        console.error('[Financeiro Extracao]', erroAtualizacao.message);
        falhas += 1;
        continue;
      }

      if (registro.conta_id) {
        try {
          const atualizada = await sincronizarContaOficial(
            admin,
            registro.conta_id,
            consolidado.dados
          );
          if (atualizada) contasAtualizadas += 1;
        } catch (erroConta) {
          console.error('[Financeiro Conta Oficial]', erroConta.message);
          falhas += 1;
        }
      }
    }

    return res.json({
      ok: true,
      cobrancas_pendentes: pendentes.length,
      pdfs_processados: processados,
      contas_atualizadas: contasAtualizadas,
      falhas,
    });
  });
}
