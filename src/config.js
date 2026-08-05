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

  // Chave administrativa: usada somente no backend.
  // Nunca vai para o navegador, aplicativo Android ou Git.
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',

  // Integracao Gmail -> Central Financeira.
  gmailImportToken: process.env.GMAIL_IMPORT_TOKEN || '',
  lifeosCasaId: process.env.LIFEOS_CASA_ID || '',

  // Senha usada somente no backend para abrir PDFs protegidos da Enel.
  // Configure ENEL_PDF_PASSWORD diretamente no Render. Nunca envie ao navegador.
  enelPdfPassword: process.env.ENEL_PDF_PASSWORD || '',

  // Gumate: a API de IA e opcional. Comandos simples continuam funcionando
  // pelas regras locais mesmo quando GEMINI_API_KEY nao estiver configurada.
  gumateEnabled: process.env.GUMATE_ENABLED !== 'false',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
};
