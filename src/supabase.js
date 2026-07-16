// supabase.js
// Cria o cliente que conversa com o banco Supabase.
// Fica isolado aqui para que, se um dia trocarmos de provedor de banco,
// so este arquivo precise mudar.

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

// Testa a conexao com o banco de forma leve.
// Nesta fundacao ainda nao criamos nenhuma tabela, entao apenas confirmamos
// que o endereco e a chave sao validos e que o Supabase responde.
// Retorna { conectado: true } ou { conectado: false, motivo: "..." }.
export async function testarConexao() {
  try {
    // Uma chamada simples e barata a API de autenticacao do Supabase.
    // Se as credenciais estiverem erradas, isto falha; se estiverem certas,
    // responde mesmo sem nenhum usuario logado.
    const { error } = await supabase.auth.getSession();
    if (error) {
      return { conectado: false, motivo: error.message };
    }
    return { conectado: true };
  } catch (e) {
    return { conectado: false, motivo: e.message };
  }
}
