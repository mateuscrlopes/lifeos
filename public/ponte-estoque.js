// ponte-estoque.js
// Liga o estoque a lista de compras (Fatia 2).
//
// Ponte 1: quando um item do estoque fica BAIXO ou ACABOU, cria uma
// sugestao pendente na lista. Quando volta a ficar suficiente, remove a
// sugestao (se ainda nao foi comprada). A sugestao e sempre MARCADA como
// tal - nunca some do controle do usuario, e nada e comprado sozinho.
//
// Todas as funcoes recebem o cliente Supabase JA LOGADO.

import { calcularStatus } from './status-estoque.js';

// Decide se um item de estoque "precisa de reposicao" (baixo ou acabou).
function precisaRepor(item) {
  const status = calcularStatus(item.quantidade, item.minimo, item.tipo, item.nivel, item.minimo_nivel);
  return status === 'baixo' || status === 'acabou';
}

// Sincroniza UM item de estoque com a lista:
//  - se precisa repor e nao ha sugestao pendente -> cria sugestao
//  - se nao precisa mais e existe sugestao pendente -> remove sugestao
// Retorna { criou } / { removeu } para eventual feedback (opcional).
export async function sincronizarItem(supa, usuario, item) {
  const { data: existentes } = await supa
    .from('lista_compras')
    .select('id')
    .eq('estoque_id', item.id)
    .eq('status', 'pendente');

  const temSugestao = existentes && existentes.length > 0;

  if (precisaRepor(item)) {
    if (!temSugestao) {
      const { data } = await supa
        .from('lista_compras')
        .insert({
          casa_id: usuario.casa_id,
          nome: item.nome,
          categoria: item.categoria,
          status: 'pendente',
          origem: 'sugestao_estoque',
          estoque_id: item.id,
          criado_por: usuario.id,
        })
        .select()
        .single();

      if (data) {
        supa.from('eventos').insert({
          tipo: 'sugestao_criada',
          entidade: 'lista_compras',
          entidade_id: data.id,
          usuario_id: usuario.id,
          detalhe: `Estoque baixo sugeriu ${item.nome} na lista`,
        });
      }
      return { criou: true };
    }
  } else if (temSugestao) {
    await supa
      .from('lista_compras')
      .delete()
      .eq('estoque_id', item.id)
      .eq('status', 'pendente')
      .eq('origem', 'sugestao_estoque');
    return { removeu: true };
  }

  return {};
}

// Ponte 2: repor o estoque quando um item ligado e comprado.
// Cada tipo de controle tem uma semantica diferente:
// - contavel/peso_volume: soma a quantidade comprada;
// - presenca: comprar significa que o item passa a existir (0/1, nunca 2, 3...);
// - nivel_visual: uma reposicao direta volta o item para "Cheio".
export async function reporEstoque(supa, usuario, estoqueId, quantidadeComprada) {
  const qtd = Number(quantidadeComprada);
  if (!Number.isFinite(qtd) || qtd < 0) {
    return { ok: false, motivo: 'Quantidade invalida.' };
  }

  const { data: item, error } = await supa
    .from('estoque')
    .select('id,nome,categoria,quantidade,unidade,minimo,tipo,nivel,minimo_nivel')
    .eq('id', estoqueId)
    .eq('casa_id', usuario.casa_id)
    .single();

  if (error || !item) {
    return { ok: false, motivo: 'Item de estoque nao encontrado.' };
  }

  const atualizadoEm = new Date().toISOString();
  let payload;
  let valorAnterior;
  let valorNovo;

  if (item.tipo === 'presenca') {
    payload = { quantidade: qtd > 0 ? 1 : 0, atualizado_por: usuario.id, atualizado_em: atualizadoEm };
    valorAnterior = { quantidade: item.quantidade };
    valorNovo = { quantidade: payload.quantidade };
  } else if (item.tipo === 'nivel_visual') {
    payload = { nivel: 'cheio', atualizado_por: usuario.id, atualizado_em: atualizadoEm };
    valorAnterior = { nivel: item.nivel };
    valorNovo = { nivel: 'cheio' };
  } else {
    const saldoAtual = Number(item.quantidade);
    if (!Number.isFinite(saldoAtual)) {
      return { ok: false, motivo: 'Saldo atual do estoque e invalido.' };
    }
    const novoSaldo = Math.max(0, saldoAtual + qtd);
    payload = { quantidade: novoSaldo, atualizado_por: usuario.id, atualizado_em: atualizadoEm };
    valorAnterior = { quantidade: item.quantidade };
    valorNovo = { quantidade: novoSaldo };
  }

  const { data: atualizado, error: erroUpd } = await supa
    .from('estoque')
    .update(payload)
    .eq('id', estoqueId)
    .eq('casa_id', usuario.casa_id)
    .select('id,nome,categoria,quantidade,unidade,minimo,tipo,nivel,minimo_nivel')
    .single();

  if (erroUpd || !atualizado) {
    return { ok: false, motivo: erroUpd?.message || 'Nao foi possivel atualizar o estoque.' };
  }

  supa.from('eventos').insert({
    tipo: 'estoque_reposto',
    entidade: 'estoque',
    entidade_id: estoqueId,
    usuario_id: usuario.id,
    valor_anterior: valorAnterior,
    valor_novo: valorNovo,
    detalhe: `${usuario.nome} repôs ${item.nome} após uma compra`,
  });

  return {
    ok: true,
    item: atualizado,
    novoSaldo: atualizado.quantidade,
    novoNivel: atualizado.nivel,
  };
}
