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

  // POST /atalho/chegada
  // Chamado pelo Atalho de automacao iOS ao chegar num local.
  // Body: { token, latitude, longitude }
  // Retorna texto com os itens da lista relevantes para aquele local.
  app.post('/atalho/chegada', async (req, res) => {
    const { token, latitude, longitude } = req.body ?? {};
    if (!latitude || !longitude) return res.status(400).send('Coordenadas não informadas.');
    const usuario = await autenticarToken(token);
    if (!usuario) return res.status(401).send('Token inválido.');

    const supa = createClient(config.supabaseUrl, config.supabaseServiceKey);

    // Busca todos os locais com seus enderecos e categorias
    const { data: locais } = await supa
      .from('locais_compra')
      .select('id, nome, locais_compra_enderecos(latitude,longitude,raio_metros), locais_compra_categorias(local_estoque)')
      .eq('casa_id', usuario.casa_id)
      .eq('ativo', true);

    if (!locais || !locais.length) return res.send('Nenhum local cadastrado.');

    // Calcula distancia em metros (formula de Haversine simplificada)
    function distanciaMetros(lat1, lon1, lat2, lon2) {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    // Identifica em qual local o usuario esta
    let localDetectado = null;
    for (const local of locais) {
      for (const end of (local.locais_compra_enderecos || [])) {
        if (!end.latitude || !end.longitude) continue;
        const dist = distanciaMetros(Number(latitude), Number(longitude), Number(end.latitude), Number(end.longitude));
        if (dist <= (end.raio_metros || 200)) {
          localDetectado = local;
          break;
        }
      }
      if (localDetectado) break;
    }

    if (!localDetectado) return res.send('Você não está próximo de nenhum local cadastrado.');

    // Pega as categorias desse local
    const categorias = (localDetectado.locais_compra_categorias || []).map(c => c.local_estoque);
    if (!categorias.length) return res.send(`Você está no ${localDetectado.nome}, mas sem categorias mapeadas.`);

    // Busca itens pendentes na lista que vêm de produtos com local nessas categorias
    const { data: itensLista } = await supa
      .from('lista_compras')
      .select('nome, estoque_id, estoque(local)')
      .eq('casa_id', usuario.casa_id)
      .eq('status', 'pendente');

    const relevantes = (itensLista || []).filter(item => {
      const localItem = item.estoque?.local;
      return localItem && categorias.includes(localItem);
    });

    if (!relevantes.length) {
      return res.send(`Você está no ${localDetectado.nome}. Nenhum item da lista é daqui.`);
    }

    const nomes = relevantes.map(i => i.nome).join(', ');
    return res.send(`${localDetectado.nome}: ${relevantes.length} ${relevantes.length === 1 ? 'item' : 'itens'} na lista — ${nomes}`);
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
