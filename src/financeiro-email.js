// financeiro-email.js
// Recebe metadados e PDFs de contas detectadas pelo Google Apps Script.
// O token e a chave administrativa ficam exclusivamente no backend.

import crypto from 'crypto';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

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

function normalizarItem(item) {
  const fornecedor = texto(item?.fornecedor, 80);
  const messageId = texto(item?.email_message_id, 200);
  const chave = texto(item?.chave_cobranca, 200);

  if (!FORNECEDORES.has(fornecedor) || !messageId || !chave) return null;

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
  };
}

function clienteAdmin() {
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

    const itensUnicos = Array.from(itensPorChave.values());
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
      .select('id,chave_cobranca,anexos')
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

    (registros || []).forEach(registro => {
      const item = itensPorChave.get(registro.chave_cobranca);
      if (!item) return;

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
    });

    return res.json({
      ok: true,
      recebidos: recebidos.length,
      validos: itens.length,
      cobrancas: itensUnicos.length,
      novos: data?.length || 0,
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
      .select('id,fornecedor,competencia,anexos')
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

    const anexoAtualizado = {
      ...(posicao >= 0 ? anexos[posicao] : {}),
      indice,
      nome: nomeOriginal || nomeArquivo,
      tipo: 'application/pdf',
      tamanho: req.body.length,
      path: caminho,
      enviado_em: new Date().toISOString(),
    };

    if (posicao >= 0) anexos[posicao] = anexoAtualizado;
    else anexos.push(anexoAtualizado);

    anexos.sort((a, b) => indiceDoAnexo(a, 0) - indiceDoAnexo(b, 0));

    const { error: erroAtualizacao } = await admin
      .from('contas_email_caixa')
      .update({
        anexos,
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

    return res.json({
      ok: true,
      indice,
      nome: nomeOriginal || nomeArquivo,
    });
  });
}
