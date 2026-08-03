// server.js — LifeOS v0.17.0
import express from 'express';
import { config } from './config.js';
import { testarConexao } from './supabase.js';
import { registrarRotasAtalhos } from './atalhos.js';
import { buscarClima } from './clima.js';

const app = express();
app.use(express.json());
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
    versao: '0.26.0',
  });
});

// Clima — para o tablet
app.get('/clima', async (req, res) => {
  const clima = await buscarClima();
  res.json(clima);
});

// Rotas dos Atalhos do iOS (Siri).
registrarRotasAtalhos(app);

app.listen(config.porta, '0.0.0.0', () => {
  console.log(`\nLifeOS v0.17.0 — porta ${config.porta}\n`);
});
