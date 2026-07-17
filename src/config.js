// config.js
import dotenv from 'dotenv';
dotenv.config();

function obrigatorio(nome) {
  const valor = process.env[nome];
  if (!valor || valor.trim() === '') {
    console.error(`\n[ERRO] Variavel "${nome}" nao definida no .env.\n`);
    process.exit(1);
  }
  return valor.trim();
}

function normalizarUrlSupabase(url) {
  return url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

export const config = {
  porta: process.env.PORT ? Number(process.env.PORT) : 3000,
  supabaseUrl: normalizarUrlSupabase(obrigatorio('SUPABASE_URL')),
  supabaseAnonKey: obrigatorio('SUPABASE_ANON_KEY'),
  // Service key: usada APENAS no backend para operacoes dos Atalhos.
  // NUNCA vai para o frontend nem para o Git.
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
};
