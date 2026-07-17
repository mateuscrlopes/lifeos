// server.js
// Ponto de entrada do backend do LifeOS.
// Sobe o servidor e expoe as rotas. A logica de negocio fica nos modulos
// (auth.js, listaCompras.js); aqui so recebemos requisicoes e respondemos.

import express from 'express';
import { config } from './config.js';
import { testarConexao } from './supabase.js';
import { autenticar, encerrar } from './auth.js';
import {
  adicionarItem,
  listarItens,
  marcarComprado,
  editarItem,
  removerItem,
} from './listaCompras.js';

const app = express();
app.use(express.json());

// Serve a tela (arquivos da pasta public) no mesmo endereco do backend.
app.use(express.static('public'));

// Config publica que a tela precisa para falar com o Supabase.
// Sao dados publicos por design (a anon key e feita para o frontend);
// a protecao real vem do RLS. A senha/segredos NUNCA vem por aqui.
app.get('/config', (req, res) => {
  res.json({
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
  });
});

// ------------------------------------------------------------------
// Rotas basicas
// ------------------------------------------------------------------
app.get('/api', (req, res) => {
  res.json({
    sistema: 'LifeOS',
    versao: '0.4.0',
    mensagem: 'Backend no ar. A tela esta na raiz (/). Use /saude para checar o banco.',
  });
});

app.get('/saude', async (req, res) => {
  const banco = await testarConexao();
  res.status(banco.conectado ? 200 : 503).json({
    status: banco.conectado ? 'ok' : 'com problema',
    backend: 'vivo',
    banco: banco.conectado ? 'conectado' : 'desconectado',
    detalhe: banco.conectado ? undefined : banco.motivo,
    horario: new Date().toISOString(),
  });
});

// ------------------------------------------------------------------
// Rota de teste do nucleo (login + leitura da casa e moradores)
// ------------------------------------------------------------------
app.post('/nucleo', async (req, res) => {
  const { email, senha } = req.body ?? {};
  const auth = await autenticar(email, senha);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, motivo: auth.motivo });
  }

  const { data: casa } = await auth.cliente.from('casa').select('id, nome, criada_em');
  const { data: moradores } = await auth.cliente
    .from('usuarios')
    .select('nome, casa_id, criado_em')
    .order('criado_em');

  await encerrar(auth.cliente);
  res.json({ ok: true, usuario: auth.usuario.nome, casa, moradores });
});

// ------------------------------------------------------------------
// LISTA DE COMPRAS
// Todas as rotas recebem email e senha no corpo para autenticar.
// (Isto e provisorio para a fase de testes; quando houver app/tela,
//  a autenticacao usara um token de sessao em vez de senha a cada chamada.)
// ------------------------------------------------------------------

// Middleware simples: autentica a partir do corpo e segue.
async function comLogin(req, res, acao) {
  const { email, senha } = req.body ?? {};
  const auth = await autenticar(email, senha);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, motivo: auth.motivo });
  }
  try {
    const resultado = await acao(auth.cliente, auth.usuario);
    res.status(resultado.ok ? 200 : 400).json(resultado);
  } catch (e) {
    res.status(500).json({ ok: false, motivo: e.message });
  } finally {
    await encerrar(auth.cliente);
  }
}

// Adicionar item.  Corpo: email, senha, nome, quantidade?, unidade?, categoria?
app.post('/lista/adicionar', (req, res) =>
  comLogin(req, res, (cliente, usuario) =>
    adicionarItem(cliente, usuario, req.body)
  )
);

// Listar itens.  Corpo: email, senha, status? ('pendente' | 'comprado' | 'todos')
app.post('/lista/listar', (req, res) =>
  comLogin(req, res, (cliente, usuario) =>
    listarItens(cliente, usuario, req.body?.status ?? 'pendente')
  )
);

// Marcar como comprado.  Corpo: email, senha, itemId
app.post('/lista/comprar', (req, res) =>
  comLogin(req, res, (cliente, usuario) =>
    marcarComprado(cliente, usuario, req.body?.itemId)
  )
);

// Editar item.  Corpo: email, senha, itemId, mudancas {nome?, quantidade?, ...}
app.post('/lista/editar', (req, res) =>
  comLogin(req, res, (cliente, usuario) =>
    editarItem(cliente, usuario, req.body?.itemId, req.body?.mudancas)
  )
);

// Remover item.  Corpo: email, senha, itemId
app.post('/lista/remover', (req, res) =>
  comLogin(req, res, (cliente, usuario) =>
    removerItem(cliente, usuario, req.body?.itemId)
  )
);

// ------------------------------------------------------------------
// Escuta em 0.0.0.0 (todas as interfaces) para funcionar tanto localmente
// quanto em servidores como o Render. A porta vem do ambiente (Render define
// a sua) ou 3000 no local.
app.listen(config.porta, '0.0.0.0', () => {
  console.log('\n========================================');
  console.log('  LifeOS - backend iniciado');
  console.log('========================================');
  console.log(`  Porta:     ${config.porta}`);
  console.log(`  Local:     http://localhost:${config.porta}`);
  console.log(`  Saude:     http://localhost:${config.porta}/saude`);
  console.log('  Para parar: Ctrl + C');
  console.log('========================================\n');
});
