// listaCompras.js
// Regras de negocio da lista de compras. Cada funcao recebe um cliente JA
// LOGADO (vindo do auth.js) e o usuario, para que o RLS seja respeitado e
// para registrar quem fez cada acao.
//
// Toda alteracao relevante grava uma linha na tabela "eventos"
// (rastreabilidade pedida no documento).

// Registra um evento no log. Falha de log NAO derruba a operacao principal:
// se o registro falhar, apenas seguimos (o dado principal ja foi salvo).
async function registrarEvento(cliente, { tipo, entidadeId, usuarioId, valorNovo, detalhe }) {
  try {
    await cliente.from('eventos').insert({
      tipo,
      entidade: 'lista_compras',
      entidade_id: entidadeId ?? null,
      usuario_id: usuarioId ?? null,
      valor_novo: valorNovo ?? null,
      detalhe: detalhe ?? null,
    });
  } catch {
    // log e secundario; ignoramos falha aqui de proposito.
  }
}

// ADICIONAR um item a lista.
export async function adicionarItem(cliente, usuario, dados) {
  const { nome, quantidade, unidade, categoria } = dados ?? {};

  if (!nome || String(nome).trim() === '') {
    return { ok: false, motivo: 'O nome do item e obrigatorio.' };
  }

  const novo = {
    casa_id: usuario.casa_id,
    nome: String(nome).trim(),
    quantidade: quantidade ?? null,
    unidade: unidade ?? null,
    categoria: categoria ?? null,
    status: 'pendente',
    criado_por: usuario.id,
  };

  const { data, error } = await cliente
    .from('lista_compras')
    .insert(novo)
    .select()
    .single();

  if (error) {
    return { ok: false, motivo: error.message };
  }

  await registrarEvento(cliente, {
    tipo: 'item_adicionado',
    entidadeId: data.id,
    usuarioId: usuario.id,
    valorNovo: { nome: data.nome, quantidade: data.quantidade, unidade: data.unidade },
    detalhe: `${usuario.nome} adicionou ${data.nome}`,
  });

  return { ok: true, item: data };
}

// LISTAR itens. Por padrao mostra so os pendentes; passe status='todos'
// para ver tudo, ou status='comprado' para ver o historico.
export async function listarItens(cliente, usuario, status = 'pendente') {
  let query = cliente
    .from('lista_compras')
    .select('id, nome, quantidade, unidade, categoria, status, criado_em, comprado_em')
    .eq('casa_id', usuario.casa_id)
    .order('criado_em', { ascending: false });

  if (status !== 'todos') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, motivo: error.message };
  }
  return { ok: true, itens: data };
}

// MARCAR um item como comprado (versao simples: sem quantidade real ainda).
export async function marcarComprado(cliente, usuario, itemId) {
  if (!itemId) {
    return { ok: false, motivo: 'O id do item e obrigatorio.' };
  }

  const { data, error } = await cliente
    .from('lista_compras')
    .update({
      status: 'comprado',
      comprado_por: usuario.id,
      comprado_em: new Date().toISOString(),
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    return { ok: false, motivo: error.message };
  }
  if (!data) {
    return { ok: false, motivo: 'Item nao encontrado.' };
  }

  await registrarEvento(cliente, {
    tipo: 'item_comprado',
    entidadeId: data.id,
    usuarioId: usuario.id,
    detalhe: `${usuario.nome} comprou ${data.nome}`,
  });

  return { ok: true, item: data };
}

// EDITAR campos de um item (nome, quantidade, unidade, categoria).
export async function editarItem(cliente, usuario, itemId, mudancas) {
  if (!itemId) {
    return { ok: false, motivo: 'O id do item e obrigatorio.' };
  }

  const permitido = {};
  if (mudancas?.nome !== undefined) permitido.nome = String(mudancas.nome).trim();
  if (mudancas?.quantidade !== undefined) permitido.quantidade = mudancas.quantidade;
  if (mudancas?.unidade !== undefined) permitido.unidade = mudancas.unidade;
  if (mudancas?.categoria !== undefined) permitido.categoria = mudancas.categoria;

  if (Object.keys(permitido).length === 0) {
    return { ok: false, motivo: 'Nenhuma mudanca valida enviada.' };
  }

  const { data, error } = await cliente
    .from('lista_compras')
    .update(permitido)
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    return { ok: false, motivo: error.message };
  }

  await registrarEvento(cliente, {
    tipo: 'item_editado',
    entidadeId: itemId,
    usuarioId: usuario.id,
    valorNovo: permitido,
    detalhe: `${usuario.nome} editou ${data.nome}`,
  });

  return { ok: true, item: data };
}

// REMOVER um item da lista.
export async function removerItem(cliente, usuario, itemId) {
  if (!itemId) {
    return { ok: false, motivo: 'O id do item e obrigatorio.' };
  }

  const { error } = await cliente
    .from('lista_compras')
    .delete()
    .eq('id', itemId);

  if (error) {
    return { ok: false, motivo: error.message };
  }

  await registrarEvento(cliente, {
    tipo: 'item_removido',
    entidadeId: itemId,
    usuarioId: usuario.id,
    detalhe: `${usuario.nome} removeu um item`,
  });

  return { ok: true };
}
