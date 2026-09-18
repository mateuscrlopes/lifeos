// open-finance.js — ponte privada LifeOS -> Nordestrip -> Meu Pluggy.
// Segredos e credenciais nunca chegam ao navegador.

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

function adminClient() {
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function contextoAutenticado(req) {
  if (!config.supabaseServiceKey) {
    return { ok: false, status: 503, erro: 'Open Finance não configurado no servidor.' };
  }

  const raw = String(req.get('authorization') || '');
  const token = raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, erro: 'Sessão ausente.' };

  const admin = adminClient();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData?.user) {
    return { ok: false, status: 401, erro: 'Sessão inválida.' };
  }

  const { data: perfil, error: perfilError } = await admin
    .from('usuarios')
    .select('id,nome,casa_id')
    .eq('auth_id', authData.user.id)
    .single();

  if (perfilError || !perfil) {
    return { ok: false, status: 403, erro: 'Perfil do LifeOS não encontrado.' };
  }

  return { ok: true, admin, perfil };
}

async function segredoServidor(admin, nome) {
  const { data, error } = await admin.rpc('lifeos_obter_segredo_servidor', { p_nome: nome });
  if (error || !data) throw new Error('Segredo da integração indisponível.');
  return String(data);
}

function numeroOuNull(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function textoOuNull(valor) {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}

function dataIsoOuNull(valor) {
  const texto = textoOuNull(valor);
  if (!texto) return null;
  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

function objeto(valor) {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {};
}

function lista(valor) {
  return Array.isArray(valor) ? valor : [];
}

export function registrarRotasOpenFinance(app) {
  app.post('/api/financeiro/open-finance/sincronizar', async (req, res) => {
    const contexto = await contextoAutenticado(req);
    if (!contexto.ok) return res.status(contexto.status).json({ ok: false, erro: contexto.erro });

    const { admin, perfil } = contexto;
    let bridgeToken;
    try {
      bridgeToken = await segredoServidor(admin, 'nordestrip_reverse_bridge_token');
    } catch (error) {
      console.error('[Open Finance] segredo:', error.message);
      return res.status(503).json({ ok: false, erro: 'Integração financeira indisponível.' });
    }

    const dateFrom = textoOuNull(req.body?.dateFrom);
    const dateTo = textoOuNull(req.body?.dateTo);

    let response;
    try {
      response = await fetch(
        config.nordestripBaseUrl + '/api/integrations/lifeos/open-finance',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + bridgeToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lifeosUserId: perfil.id,
            ...(dateFrom ? { dateFrom } : {}),
            ...(dateTo ? { dateTo } : {}),
          }),
          signal: AbortSignal.timeout(45000),
        }
      );
    } catch (error) {
      console.error('[Open Finance] ponte:', error.message);
      return res.status(502).json({ ok: false, erro: 'Não foi possível consultar o Open Finance agora.' });
    }

    let snapshot = null;
    try {
      snapshot = await response.json();
    } catch {}

    if (!response.ok) {
      console.error('[Open Finance] Nordestrip:', response.status, snapshot?.error || 'sem detalhe');
      return res.status(response.status === 401 ? 502 : response.status).json({
        ok: false,
        erro: snapshot?.error || 'A ponte Open Finance recusou a sincronização.',
      });
    }

    const sincronizadoEm = dataIsoOuNull(snapshot?.syncedAt) || new Date().toISOString();
    const contasExternas = lista(snapshot?.accounts);
    const contaRows = contasExternas
      .map(raw => {
        const conta = objeto(raw);
        const externalId = textoOuNull(conta.externalId);
        if (!externalId) return null;
        const tipoRaw = textoOuNull(conta.accountType);
        const tipo = ['checking', 'credit_card'].includes(tipoRaw) ? tipoRaw : 'other';
        return {
          usuario_id: perfil.id,
          provider: 'pluggy',
          external_id: externalId,
          item_id: textoOuNull(conta.itemId),
          nome: textoOuNull(conta.name) || 'Conta conectada',
          tipo,
          subtipo: textoOuNull(conta.subtype),
          saldo_atual: numeroOuNull(conta.balance),
          limite_credito: numeroOuNull(conta.creditLimit),
          limite_disponivel: numeroOuNull(conta.availableCreditLimit),
          saldo_investido_automatico: numeroOuNull(conta.automaticallyInvestedBalance),
          moeda: textoOuNull(conta.currency) || 'BRL',
          sincronizado_em: sincronizadoEm,
          metadata: {
            connector_name: textoOuNull(conta.connectorName),
            item_status: textoOuNull(conta.itemStatus),
            item_execution_status: textoOuNull(conta.itemExecutionStatus),
          },
          atualizado_em: sincronizadoEm,
        };
      })
      .filter(Boolean);

    let contasLocais = [];
    if (contaRows.length) {
      const save = await admin
        .from('financeiro_open_finance_contas')
        .upsert(contaRows, { onConflict: 'usuario_id,provider,external_id' })
        .select('id,external_id');

      if (save.error) {
        console.error('[Open Finance] contas:', save.error.message);
        return res.status(500).json({ ok: false, erro: 'Não foi possível guardar as contas conectadas.' });
      }
      contasLocais = save.data || [];
    }

    const idPorExterno = new Map(contasLocais.map(conta => [conta.external_id, conta.id]));
    const transacoes = lista(snapshot?.transactions)
      .map(raw => {
        const tx = objeto(raw);
        const externalId = textoOuNull(tx.externalId);
        const accountExternalId = textoOuNull(tx.accountExternalId);
        const contaId = accountExternalId ? idPorExterno.get(accountExternalId) : null;
        const valor = numeroOuNull(tx.amount);
        if (!externalId || !contaId || valor === null) return null;

        const direcaoRaw = textoOuNull(tx.direction);
        return {
          usuario_id: perfil.id,
          conta_id: contaId,
          provider: 'pluggy',
          external_id: externalId,
          descricao: textoOuNull(tx.description) || 'Transação',
          valor,
          direcao: ['debit', 'credit'].includes(direcaoRaw) ? direcaoRaw : null,
          ocorrido_em: dataIsoOuNull(tx.occurredAt),
          categoria_provider: textoOuNull(tx.category),
          merchant: textoOuNull(tx.merchant),
          status: textoOuNull(tx.status),
          moeda: textoOuNull(tx.currency) || 'BRL',
          metadata: {
            item_id: textoOuNull(tx.itemId),
            category_id: textoOuNull(tx.categoryId),
            type: textoOuNull(tx.type),
            pix: /\bpix\b/i.test(String(tx.description || '')),
          },
          sincronizado_em: sincronizadoEm,
          atualizado_em: sincronizadoEm,
        };
      })
      .filter(Boolean);

    for (let i = 0; i < transacoes.length; i += 250) {
      const batch = transacoes.slice(i, i + 250);
      const save = await admin
        .from('financeiro_open_finance_transacoes')
        .upsert(batch, { onConflict: 'usuario_id,provider,external_id' });
      if (save.error) {
        console.error('[Open Finance] transacoes:', save.error.message);
        return res.status(500).json({ ok: false, erro: 'As contas foram sincronizadas, mas houve falha nas movimentações.' });
      }
    }

    return res.json({
      ok: true,
      conectado: Boolean(snapshot?.connected),
      contas: contaRows.length,
      transacoes: transacoes.length,
      erros_parciais: lista(snapshot?.errors),
      sincronizado_em: sincronizadoEm,
    });
  });
}
