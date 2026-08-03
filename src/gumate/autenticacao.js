import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

function clienteAdministrativo() {
  if (!config.supabaseServiceKey) return null;
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function autenticarDispositivo(req) {
  if (!config.supabaseServiceKey) {
    return { ok: false, status: 503, motivo: 'SUPABASE_SERVICE_KEY nao configurada no servidor.' };
  }

  const token = req.get('x-gumate-token') || req.body?.token;
  if (!token || String(token).length < 24) {
    return { ok: false, status: 401, motivo: 'Token do dispositivo ausente ou invalido.' };
  }

  const supa = clienteAdministrativo();
  const tokenHash = hashToken(token);
  const { data, error } = await supa
    .from('gumate_dispositivos')
    .select('id, nome, casa_id, usuario_id, permissoes, ativo')
    .eq('token_hash', tokenHash)
    .eq('ativo', true)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, motivo: 'Falha ao validar o dispositivo.' };
  }
  if (!data) {
    return { ok: false, status: 401, motivo: 'Dispositivo nao autorizado.' };
  }

  // Atualizacao de telemetria sem bloquear o comando em caso de falha.
  void supa
    .from('gumate_dispositivos')
    .update({ ultimo_acesso_em: new Date().toISOString() })
    .eq('id', data.id);

  return { ok: true, dispositivo: data, supa };
}
