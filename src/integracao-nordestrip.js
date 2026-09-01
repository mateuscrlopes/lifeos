// integracao-nordestrip.js — ponte financeira Nordestrip -> LifeOS
// Recebe somente eventos assinados pela integracao. O segredo nunca vai ao navegador.

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

function adminClient() {
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerToken(req) {
  const raw = String(req.get('authorization') || '');
  return raw.toLowerCase().startsWith('bearer ')
    ? raw.slice(7).trim()
    : '';
}

export function registrarRotasIntegracaoNordestrip(app) {
  app.post('/api/integracoes/nordestrip/despesas', async (req, res) => {
    if (!config.supabaseServiceKey) {
      return res.status(503).json({
        ok: false,
        erro: 'Integracao financeira nao configurada no servidor.',
      });
    }

    const token = bearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, erro: 'Credencial da integracao ausente.' });
    }

    const admin = adminClient();

    const { data: autorizado, error: erroToken } = await admin.rpc(
      'verificar_token_integracao',
      {
        p_origem: 'nordestrip',
        p_token: token,
      }
    );

    if (erroToken) {
      console.error('[Integracao Nordestrip] falha ao validar token:', erroToken.message);
      return res.status(503).json({ ok: false, erro: 'Nao foi possivel validar a integracao.' });
    }

    if (!autorizado) {
      return res.status(401).json({ ok: false, erro: 'Credencial da integracao invalida.' });
    }

    const payload = req.body;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return res.status(400).json({ ok: false, erro: 'Evento financeiro invalido.' });
    }

    const { data: resultado, error } = await admin.rpc(
      'sincronizar_despesa_nordestrip',
      { p_payload: payload }
    );

    if (error) {
      console.error('[Integracao Nordestrip] sincronizacao:', error.message);
      return res.status(422).json({
        ok: false,
        erro: 'O LifeOS recusou os dados financeiros enviados pelo Nordestrip.',
        detalhe: error.message,
      });
    }

    if (resultado?.status === 'conflict') {
      return res.status(409).json({
        ok: false,
        conflito: true,
        resultado,
        erro: 'Este acerto ja possui historico de pagamento no LifeOS e nao pode ser reescrito automaticamente.',
      });
    }

    return res.json({ ok: true, resultado });
  });
}
