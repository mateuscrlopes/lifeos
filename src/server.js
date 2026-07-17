// server.js
import express from 'express';
import { config } from './config.js';
import { testarConexao } from './supabase.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Config publica para o frontend.
app.get('/config', (req, res) => {
  res.json({ supabaseUrl: config.supabaseUrl, supabaseAnonKey: config.supabaseAnonKey });
});

// Saude do backend.
app.get('/saude', async (req, res) => {
  const banco = await testarConexao();
  res.status(banco.conectado ? 200 : 503).json({
    status: banco.conectado ? 'ok' : 'com problema',
    backend: 'vivo',
    banco: banco.conectado ? 'conectado' : 'desconectado',
    detalhe: banco.conectado ? undefined : banco.motivo,
    horario: new Date().toISOString(),
    versao: '0.13.0',
  });
});

app.listen(config.porta, '0.0.0.0', () => {
  console.log(`\nLifeOS v0.13.0 — porta ${config.porta}\n`);
});
