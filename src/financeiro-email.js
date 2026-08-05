// financeiro-email.js
// Recebe somente metadados de contas detectadas pelo Google Apps Script.
// O token e a chave administrativa ficam exclusivamente no backend.

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

const FORNECEDORES = new Set(['Enel', 'EI Fiber', 'QuintoAndar', 'Naturgy']);

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

function normalizarAnexos(anexos) {
  if (!Array.isArray(anexos)) return [];

  return anexos.slice(0, 10).map(anexo => ({
    nome: texto(anexo?.nome, 240),
    tipo: texto(anexo?.tipo, 120),
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

    const admin = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin
      .from('contas_email_caixa')
      .upsert(itens, {
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

    return res.json({
      ok: true,
      recebidos: recebidos.length,
      validos: itens.length,
      novos: data?.length || 0,
    });
  });
}
