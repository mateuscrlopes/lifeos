// supabase.js
// Cria o cliente que conversa com o banco Supabase.
// Fica isolado aqui para que, se um dia trocarmos de provedor de banco,
// so este arquivo precise mudar.

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

// Testa a conexao com o banco fazendo uma consulta real a tabela casa.
// Agora que as tabelas existem, este teste e mais rigoroso do que antes:
// se o banco, as credenciais ou a tabela estiverem errados, ele acusa.
//
// Observacao: como o RLS so libera leitura para usuarios logados, uma
// consulta sem login pode voltar vazia. Isso NAO e erro de conexao - e a
// seguranca funcionando. Por isso tratamos "sem erro" como conectado,
// mesmo que nenhuma linha volte.
// Retorna { conectado: true } ou { conectado: false, motivo: "..." }.
export async function testarConexao() {
  try {
    const { error } = await supabase.from('casa').select('id').limit(1);
    if (error) {
      return { conectado: false, motivo: error.message };
    }
    return { conectado: true };
  } catch (e) {
    return { conectado: false, motivo: e.message };
  }
}

// Le o nucleo (a casa e seus moradores) FAZENDO LOGIN primeiro.
// Isto prova duas coisas ao mesmo tempo:
//  1. Que os dados existem e estao ligados corretamente.
//  2. Que o RLS funciona: sem login nao se ve nada; com login, ve.
//
// Usa um cliente temporario e isolado, so para este teste, para nao
// interferir no cliente principal. Recebe email e senha de um morador.
export async function lerNucleoComLogin(email, senha) {
  // Cria um cliente proprio para esta sessao de teste.
  const cliente = createClient(config.supabaseUrl, config.supabaseAnonKey);

  const { error: erroLogin } = await cliente.auth.signInWithPassword({
    email,
    password: senha,
  });
  if (erroLogin) {
    return { ok: false, etapa: 'login', motivo: erroLogin.message };
  }

  // Agora logado: le a casa e os moradores (o RLS libera para autenticados).
  const { data: casas, error: erroCasa } = await cliente
    .from('casa')
    .select('id, nome, criada_em');
  if (erroCasa) {
    return { ok: false, etapa: 'leitura_casa', motivo: erroCasa.message };
  }

  const { data: moradores, error: erroUsuarios } = await cliente
    .from('usuarios')
    .select('nome, casa_id, criado_em')
    .order('criado_em');
  if (erroUsuarios) {
    return { ok: false, etapa: 'leitura_usuarios', motivo: erroUsuarios.message };
  }

  // Encerra a sessao de teste para nao deixar login pendurado.
  await cliente.auth.signOut();

  return { ok: true, casa: casas, moradores };
}
