// atalhos.js
// Rotas chamadas pelos Atalhos do iOS (Siri).
// Autenticacao por token secreto por usuario.

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

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

  // POST /atalho/lista — adiciona item a lista de compras
  app.post('/atalho/lista', async (req, res) => {
    const { token, item } = req.body ?? {};
    if (!item || String(item).trim() === '') return res.status(400).send('Item nao informado.');
    const usuario = await autenticarToken(token);
    if (!usuario) return res.status(401).send('Token invalido.');
    const nome = String(item).trim();
    const supa = createClient(config.supabaseUrl, config.supabaseServiceKey);
    const { error } = await supa.from('lista_compras').insert({
      casa_id: usuario.casa_id, nome, status: 'pendente',
      origem: 'atalho', criado_por: usuario.id,
    });
    if (error) return res.status(500).send('Erro ao adicionar item.');
    supa.from('eventos').insert({
      tipo: 'item_adicionado', entidade: 'lista_compras',
      usuario_id: usuario.id, detalhe: `${usuario.nome} adicionou "${nome}" via Siri`,
    });
    res.send(`"${nome}" adicionado à lista por ${usuario.nome}.`);
  });

  // POST /atalho/tarefa — cria tarefa da Casa
  // Body: { token, titulo, responsavel? ('mateus'|'ghustavo'|'ambos') }
  app.post('/atalho/tarefa', async (req, res) => {
    const { token, titulo, responsavel } = req.body ?? {};
    if (!titulo || String(titulo).trim() === '') return res.status(400).send('Titulo nao informado.');
    const usuario = await autenticarToken(token);
    if (!usuario) return res.status(401).send('Token invalido.');
    const t = String(titulo).trim();
    const resp = ['mateus','ghustavo','ambos'].includes(responsavel) ? responsavel : 'ambos';
    const supa = createClient(config.supabaseUrl, config.supabaseServiceKey);
    const { error } = await supa.from('tarefas').insert({
      casa_id: usuario.casa_id, titulo: t, responsavel: resp,
      feita: false, criada_por: usuario.id,
    });
    if (error) return res.status(500).send('Erro ao criar tarefa.');
    supa.from('eventos').insert({
      tipo: 'tarefa_criada', entidade: 'tarefas',
      usuario_id: usuario.id, detalhe: `${usuario.nome} criou "${t}" via Siri`,
    });
    const quem = resp === 'ambos' ? 'ambos' : resp.charAt(0).toUpperCase() + resp.slice(1);
    res.send(`Tarefa "${t}" criada para ${quem}.`);
  });

  // POST /atalho/estoque — marca item do estoque como acabou
  // Body: { token, item }
  app.post('/atalho/estoque', async (req, res) => {
    const { token, item } = req.body ?? {};
    if (!item || String(item).trim() === '') return res.status(400).send('Item nao informado.');
    const usuario = await autenticarToken(token);
    if (!usuario) return res.status(401).send('Token invalido.');
    const supa = createClient(config.supabaseUrl, config.supabaseServiceKey);
    const { data: itens } = await supa
      .from('estoque').select('id, nome, quantidade').eq('casa_id', usuario.casa_id);
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
    const encontrado = (itens||[]).find(i => norm(i.nome) === norm(item));
    if (!encontrado) {
      return res.status(404).send(`"${item}" nao encontrado no estoque. Verifique o nome.`);
    }
    const { error } = await supa.from('estoque')
      .update({ quantidade: 0, atualizado_por: usuario.id, atualizado_em: new Date().toISOString() })
      .eq('id', encontrado.id);
    if (error) return res.status(500).send('Erro ao atualizar estoque.');
    supa.from('eventos').insert({
      tipo: 'estoque_ajustado', entidade: 'estoque', entidade_id: encontrado.id,
      usuario_id: usuario.id,
      valor_anterior: { quantidade: encontrado.quantidade }, valor_novo: { quantidade: 0 },
      detalhe: `${usuario.nome} marcou "${encontrado.nome}" como acabou via Siri`,
    });
    res.send(`"${encontrado.nome}" marcado como acabou. Vai aparecer como sugestão na lista.`);
  });
}