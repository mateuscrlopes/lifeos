// server.js — LifeOS v0.36.0 + Gumate Lab
import express from 'express';
import { config } from './config.js';
import { testarConexao } from './supabase.js';
import { registrarRotasAtalhos } from './atalhos.js';
import { registrarRotasFinanceiroEmail } from './financeiro-email.js';
import { registrarRotasGumate } from './gumate/index.js';
import { registrarRotasAcertos } from './acertos.js';
import { registrarRotasIntegracaoNordestrip } from './integracao-nordestrip.js';
import { registrarRotasRitmo } from './ritmo.js';
import { buscarClima } from './clima.js';

const app = express();
app.disable('x-powered-by');

// A importação financeira pode receber até 50 e-mails com trechos do corpo.
// 2 MB mantém o limite controlado e comporta o máximo já aceito pela rota.
app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

app.get('/config', (req, res) => {
  res.json({ supabaseUrl: config.supabaseUrl, supabaseAnonKey: config.supabaseAnonKey });
});

app.get('/saude', async (req, res) => {
  const banco = await testarConexao();
  res.status(banco.conectado ? 200 : 503).json({
    status: banco.conectado ? 'ok' : 'com problema',
    backend: 'vivo',
    banco: banco.conectado ? 'conectado' : 'desconectado',
    detalhe: banco.conectado ? undefined : banco.motivo,
    horario: new Date().toISOString(),
    versao: '0.36.0',
  });
});

// Tablet da Casa
app.get('/tablet', (req, res) => {
  res.sendFile('tablet.html', { root: './public' });
});

// Clima — para o tablet
app.get('/clima', async (req, res) => {
  const clima = await buscarClima();
  res.json(clima);
});

// Rotas dos Atalhos do iOS (Siri).
registrarRotasAtalhos(app);

// Entrada segura das contas detectadas no Gmail.
registrarRotasFinanceiroEmail(app);

// Acertos financeiros entre moradores.
registrarRotasAcertos(app);

// Ponte financeira com o Nordestrip.
registrarRotasIntegracaoNordestrip(app);

// Modulo pessoal Ritmo: importacao de planos e recursos privados.
registrarRotasRitmo(app);

// Rotas do assistente de voz da Casa.
registrarRotasGumate(app);

app.listen(config.porta, '0.0.0.0', () => {
  console.log(`\nLifeOS v0.36.0 — porta ${config.porta}`);
  console.log(`Gumate: ${config.gumateEnabled ? 'habilitado' : 'desabilitado'}\n`);
});
