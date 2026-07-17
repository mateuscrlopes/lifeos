// server.js
// Ponto de entrada do backend do LifeOS.
// Nesta primeira entrega ele faz apenas o essencial: sobe o servidor e oferece
// uma rota de teste (/saude) que confirma "backend vivo + banco conectado".
// Nada de compras, estoque ou usuarios ainda - isso vem nas proximas entregas.

import express from 'express';
import { config } from './config.js';
import { testarConexao, lerNucleoComLogin } from './supabase.js';

const app = express();
app.use(express.json());

// Rota raiz - mensagem simples para quem abrir o endereco no navegador.
app.get('/', (req, res) => {
  res.json({
    sistema: 'LifeOS',
    versao: '0.1.0',
    mensagem: 'Backend no ar. Use /saude para verificar a conexao com o banco.',
  });
});

// Rota de saude - a "porta de teste" desta entrega.
// Responde se o backend esta vivo e se o banco Supabase esta conectado.
app.get('/saude', async (req, res) => {
  const banco = await testarConexao();
  const tudoOk = banco.conectado;

  res.status(tudoOk ? 200 : 503).json({
    status: tudoOk ? 'ok' : 'com problema',
    backend: 'vivo',
    banco: banco.conectado ? 'conectado' : 'desconectado',
    detalhe: banco.conectado ? undefined : banco.motivo,
    horario: new Date().toISOString(),
  });
});

// Rota de teste do nucleo - a "porta de teste" desta entrega.
// Recebe email e senha de um morador (no corpo da requisicao), faz login
// e devolve a Casa e a lista de moradores. Prova que perfis, login e RLS
// estao todos funcionando juntos.
//
// A senha vai no corpo da requisicao, NUNCA no codigo nem na URL.
app.post('/nucleo', async (req, res) => {
  const { email, senha } = req.body ?? {};

  if (!email || !senha) {
    return res.status(400).json({
      ok: false,
      mensagem: 'Envie email e senha no corpo da requisicao.',
    });
  }

  const resultado = await lerNucleoComLogin(email, senha);

  if (!resultado.ok) {
    return res.status(401).json({
      ok: false,
      etapa: resultado.etapa,
      motivo: resultado.motivo,
    });
  }

  res.json({
    ok: true,
    casa: resultado.casa,
    moradores: resultado.moradores,
  });
});

app.listen(config.porta, () => {
  console.log('\n========================================');
  console.log('  LifeOS - backend iniciado');
  console.log('========================================');
  console.log(`  Endereco:  http://localhost:${config.porta}`);
  console.log(`  Saude:     http://localhost:${config.porta}/saude`);
  console.log('  Para parar: Ctrl + C');
  console.log('========================================\n');
});
