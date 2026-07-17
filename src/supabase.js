// supabase.js
// Cria o cliente base que conversa com o banco Supabase e oferece um
// teste de conexao. O login de usuarios fica no modulo auth.js.

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

// Testa a conexao fazendo uma consulta leve a tabela casa.
// Observacao: com o RLS ligado, uma consulta sem login pode voltar vazia -
// isso NAO e erro de conexao, e a seguranca funcionando. Tratamos
// "sem erro" como conectado.
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
