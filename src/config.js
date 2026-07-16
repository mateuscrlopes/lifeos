// config.js
// Le as variaveis de ambiente do arquivo .env e valida que o essencial existe.
// Se algo obrigatorio faltar, o sistema para com uma mensagem clara em vez de
// falhar de um jeito confuso mais tarde.

import dotenv from 'dotenv';

dotenv.config();

function obrigatorio(nome) {
  const valor = process.env[nome];
  if (!valor || valor.trim() === '') {
    console.error(`\n[ERRO DE CONFIGURACAO] A variavel "${nome}" nao foi definida no arquivo .env.`);
    console.error('Verifique se voce copiou .env.example para .env e preencheu os valores.\n');
    process.exit(1);
  }
  return valor.trim();
}

// Remove uma eventual barra final ou /rest/v1 que possa ter sido colado por engano,
// deixando apenas a URL base do projeto.
function normalizarUrlSupabase(url) {
  return url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

export const config = {
  porta: process.env.PORT ? Number(process.env.PORT) : 3000,
  supabaseUrl: normalizarUrlSupabase(obrigatorio('SUPABASE_URL')),
  supabaseAnonKey: obrigatorio('SUPABASE_ANON_KEY'),
};
