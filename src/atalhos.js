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

function normalizarTexto(valor = '') {
  return String(valor)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarCoordenada(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(String(valor).trim().replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

function prepararCoordenadas(latitude, longitude) {
  let lat = normalizarCoordenada(latitude);
  let lon = normalizarCoordenada(longitude);
  if (lat === null || lon === null) return null;

  // Corrige automaticamente o caso comum em que latitude e longitude foram invertidas.
  if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) [lat, lon] = [lon, lat];
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { latitude: lat, longitude: lon };
}

function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180)
    * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function encontrarLocalInformado(locais, localId, localNome) {
  if (localId) {
    const porId = locais.find(item => item.id === String(localId));
    if (porId) return porId;
  }

  const procurado = normalizarTexto(localNome);
  if (!procurado) return null;
  const exato = locais.find(item => normalizarTexto(item.nome) === procurado);
  if (exato) return exato;

  const parciais = locais.filter(item => {
    const nome = normalizarTexto(item.nome);
    return nome.includes(procurado) || procurado.includes(nome);
  });
  return parciais.length === 1 ? parciais[0] : null;
}

function encontrarLocalPorCoordenadas(locais, coordenadas) {
  if (!coordenadas) return { local: null, maisProximo: null };
  const candidatos = [];

  for (const local of locais) {
    for (const endereco of (local.locais_compra_enderecos || [])) {
      const lat = normalizarCoordenada(endereco.latitude);
      const lon = normalizarCoordenada(endereco.longitude);
      if (lat === null || lon === null) continue;
      const distancia = distanciaMetros(
        coordenadas.latitude,
        coordenadas.longitude,
        lat,
        lon,
      );
      candidatos.push({
        local,
        distancia,
        raio: Number(endereco.raio_metros) || 200,
      });
    }
  }

  candidatos.sort((a, b) => a.distancia - b.distancia);
  const maisProximo = candidatos[0] || null;
  const dentroDoRaio = candidatos.find(item => item.distancia <= item.raio) || null;
  return { local: dentroDoRaio?.local || null, maisProximo };
}

export function registrarRotasAtalhos(app) {

  // POST /atalho/lista — adiciona item a lista de compras
  app.post('/atalho/lista', async (req, res) => {
    const { token, item } = req.body ?? {};
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (!item || String(item).trim() === '') return res.status(400).send('Item nao informado.');
    const usuario = await autenticarToken(token);
    if (!usuario) return res.status(401).send('Token invalido.');
    const nome = String(item).trim();
    const supa = createClient(config.supabaseUrl, config.supabaseServiceKey);
    const { error } = await supa.from('lista_compras').insert({
      casa_id: usuario.casa_id,
      nome,
      status: 'pendente',
      origem: 'atalho',
      criado_por: usuario.id,
    });
    if (error) return res.status(500).send('Erro ao adicionar item.');
    supa.from('eventos').insert({
      tipo: 'item_adicionado',
      entidade: 'lista_compras',
      usuario_id: usuario.id,
      detalhe: `${usuario.nome} adicionou "${nome}" via Siri`,
    });
    return res.send(`"${nome}" adicionado à lista por ${usuario.nome}.`);
  });

  // POST /atalho/tarefa — cria tarefa da Casa
  // Body: { token, titulo, responsavel? ('mateus'|'ghustavo'|'ambos') }
  app.post('/atalho/tarefa', async (req, res) => {
    const { token, titulo, responsavel } = req.body ?? {};
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (!titulo || String(titulo).trim() === '') return res.status(400).send('Titulo nao informado.');
    const usuario = await autenticarToken(token);
    if (!usuario) return res.status(401).send('Token invalido.');
    const t = String(titulo).trim();
    const resp = ['mateus', 'ghustavo', 'ambos'].includes(responsavel) ? responsavel : 'ambos';
    const supa = createClient(config.supabaseUrl, config.supabaseServiceKey);
    const { error } = await supa.from('tarefas').insert({
      casa_id: usuario.casa_id,
      titulo: t,
      responsavel: resp,
      feita: false,
      criada_por: usuario.id,
    });
    if (error) return res.status(500).send('Erro ao criar tarefa.');
    supa.from('eventos').insert({
      tipo: 'tarefa_criada',
      entidade: 'tarefas',
      usuario_id: usuario.id,
      detalhe: `${usuario.nome} criou "${t}" via Siri`,
    });
    const quem = resp === 'ambos' ? 'ambos' : resp.charAt(0).toUpperCase() + resp.slice(1);
    return res.send(`Tarefa "${t}" criada para ${quem}.`);
  });

  // POST /atalho/chegada
  // Fluxo recomendado: o iPhone identifica a automacao/local e envia
  // { token, local: 'Nome cadastrado no LifeOS' }.
  // Latitude e longitude continuam opcionais como compatibilidade e diagnostico.
  app.post('/atalho/chegada', async (req, res) => {
    const {
      token,
      local,
      local_id: localId,
      latitude,
      longitude,
      diagnostico = false,
    } = req.body ?? {};
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    const usuario = await autenticarToken(token);
    if (!usuario) return res.status(401).send('Token inválido.');

    const supa = createClient(config.supabaseUrl, config.supabaseServiceKey);
    const { data: locais, error: locaisError } = await supa
      .from('locais_compra')
      .select('id,nome,locais_compra_enderecos(latitude,longitude,raio_metros),locais_compra_categorias(local_estoque)')
      .eq('casa_id', usuario.casa_id)
      .eq('ativo', true);

    if (locaisError) return res.status(500).send('Não foi possível consultar os locais cadastrados.');
    if (!locais || !locais.length) return res.send('Nenhum local cadastrado.');

    let localDetectado = encontrarLocalInformado(locais, localId, local);
    let origemDeteccao = localDetectado ? 'iPhone' : null;
    let maisProximo = null;

    if ((local || localId) && !localDetectado) {
      const disponiveis = locais.map(item => item.nome).join(', ');
      return res.status(404).send(`O local informado não foi encontrado no LifeOS. Cadastrados: ${disponiveis}.`);
    }

    if (!localDetectado) {
      const coordenadas = prepararCoordenadas(latitude, longitude);
      if (!coordenadas) {
        return res.status(400).send('Informe o nome do local ou coordenadas válidas.');
      }
      const resultado = encontrarLocalPorCoordenadas(locais, coordenadas);
      localDetectado = resultado.local;
      maisProximo = resultado.maisProximo;
      origemDeteccao = localDetectado ? 'coordenadas' : null;
    }

    if (!localDetectado) {
      if (maisProximo) {
        return res.send(
          `Você não está próximo de nenhum local cadastrado. Mais próximo: ${maisProximo.local.nome}, `
          + `${Math.round(maisProximo.distancia)} m (raio ${Math.round(maisProximo.raio)} m).`,
        );
      }
      return res.send('Você não está próximo de nenhum local cadastrado.');
    }

    const categorias = new Set(
      (localDetectado.locais_compra_categorias || [])
        .map(item => normalizarTexto(item.local_estoque))
        .filter(Boolean),
    );

    const [{ data: itensLista, error: itensError }, { data: itensEstoque, error: estoqueError }] = await Promise.all([
      supa.from('lista_compras')
        .select('id,nome,categoria,estoque_id,destino_compra_id,compra_destinos(nome,tipo,entra_lista_mercado)')
        .eq('casa_id', usuario.casa_id)
        .eq('status', 'pendente'),
      supa.from('estoque')
        .select('id,nome,local,critico')
        .eq('casa_id', usuario.casa_id),
    ]);

    if (itensError || estoqueError) return res.status(500).send('Não foi possível consultar a lista de compras.');

    const estoquePorId = new Map((itensEstoque || []).map(item => [item.id, item]));
    const estoquePorNome = new Map((itensEstoque || []).map(item => [normalizarTexto(item.nome), item]));

    const classificados = (itensLista || []).map(item => {
      const estoque = estoquePorId.get(item.estoque_id)
        || estoquePorNome.get(normalizarTexto(item.nome))
        || null;
      const critico = Boolean(estoque?.critico);
      const destinoMercado = !item.compra_destinos || item.compra_destinos.entra_lista_mercado !== false;
      return { ...item, estoque, critico, compativel: destinoMercado };
    });

    const criticos = classificados.filter(item => item.critico);
    const outros = classificados.filter(item => !item.critico && item.compativel);

    if (!criticos.length && !outros.length) {
      const base = `Você está no ${localDetectado.nome}. Nenhum item da lista é daqui.`;
      return res.send(diagnostico ? `${base} Detecção: ${origemDeteccao}.` : base);
    }

    const partes = [`${localDetectado.nome}:`];
    if (criticos.length) {
      partes.push(`${criticos.length} ${criticos.length === 1 ? 'item crítico' : 'itens críticos'} — ${criticos.map(item => item.nome).join(', ')}`);
    }
    if (outros.length) {
      partes.push(`${outros.length} ${outros.length === 1 ? 'outro item' : 'outros itens'} — ${outros.map(item => item.nome).join(', ')}`);
    }
    if (diagnostico) partes.push(`Detecção: ${origemDeteccao}.`);
    return res.send(partes.join('\n'));
  });

  // POST /atalho/estoque — marca item do estoque como acabou
  // Body: { token, item }
  app.post('/atalho/estoque', async (req, res) => {
    const { token, item } = req.body ?? {};
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (!item || String(item).trim() === '') return res.status(400).send('Item nao informado.');
    const usuario = await autenticarToken(token);
    if (!usuario) return res.status(401).send('Token invalido.');
    const supa = createClient(config.supabaseUrl, config.supabaseServiceKey);
    const { data: itens } = await supa
      .from('estoque')
      .select('id,nome,quantidade')
      .eq('casa_id', usuario.casa_id);
    const encontrado = (itens || []).find(itemEstoque => normalizarTexto(itemEstoque.nome) === normalizarTexto(item));
    if (!encontrado) {
      return res.status(404).send(`"${item}" nao encontrado no estoque. Verifique o nome.`);
    }
    const { error } = await supa.from('estoque')
      .update({ quantidade: 0, atualizado_por: usuario.id, atualizado_em: new Date().toISOString() })
      .eq('id', encontrado.id);
    if (error) return res.status(500).send('Erro ao atualizar estoque.');
    supa.from('eventos').insert({
      tipo: 'estoque_ajustado',
      entidade: 'estoque',
      entidade_id: encontrado.id,
      usuario_id: usuario.id,
      valor_anterior: { quantidade: encontrado.quantidade },
      valor_novo: { quantidade: 0 },
      detalhe: `${usuario.nome} marcou "${encontrado.nome}" como acabou via Siri`,
    });
    return res.send(`"${encontrado.nome}" marcado como acabou. Vai aparecer como sugestão na lista.`);
  });
}
