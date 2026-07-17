// atalhos.js
// Rotas chamadas pelos Atalhos do iOS (Siri).
// Autenticacao por token secreto por usuario — sem expor credenciais do Supabase.
// Cada rota e simples e independente: falha aqui nao afeta o resto do sistema.

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

// Verifica o token e devolve o perfil do usuario, ou null se invalido.
async function autenticarToken(token) {
  if (!token) return null;
  const supa = createClient(config.supabaseUrl, config.supabaseServiceKey);
  const { data } = await supa
    .from('atalho_tokens')
    .select('usuario_id, usuarios(id, nome, casa_id)')
    .eq('token', token)
    .eq('ativo', true)
    .single();
  return data?.usuarios || null;
}

export function registrarRotasAtalhos(app) {
  // POST /atalho/lista
  // Adiciona um item a lista de compras.
  // Body: { token: "...", item: "leite" }
  // Resposta: texto simples (o Atalho exibe como notificacao).
  app.post('/atalho/lista', async (req, res) => {
    const { token, item } = req.body ?? {};

    if (!item || String(item).trim() === '') {
      return res.status(400).send('Item nao informado.');
    }

    const usuario = await autenticarToken(token);
    if (!usuario) {
      return res.status(401).send('Token invalido.');
    }

    const nome = String(item).trim();
    const supa = createClient(config.supabaseUrl, config.supabaseServiceKey);

    const { error } = await supa.from('lista_compras').insert({
      casa_id: usuario.casa_id,
      nome,
      status: 'pendente',
      origem: 'atalho',
      criado_por: usuario.id,
    });

    if (error) {
      return res.status(500).send('Erro ao adicionar item.');
    }

    // Registra o evento.
    supa.from('eventos').insert({
      tipo: 'item_adicionado',
      entidade: 'lista_compras',
      usuario_id: usuario.id,
      detalhe: `${usuario.nome} adicionou "${nome}" via Siri`,
    });

    // Resposta simples para o Atalho exibir.
    res.send(`"${nome}" adicionado à lista por ${usuario.nome}.`);
  });
}
