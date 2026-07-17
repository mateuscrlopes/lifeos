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
  const status = calcularStatus(item.quantidade, item.minimo);
  return status === 'baixo' || status === 'acabou';
}

// Sincroniza UM item de estoque com a lista:
//  - se precisa repor e nao ha sugestao pendente -> cria sugestao
//  - se nao precisa mais e existe sugestao pendente -> remove sugestao
// Retorna { criou } / { removeu } para eventual feedback (opcional).
export async function sincronizarItem(supa, usuario, item) {
  // Ja existe uma sugestao pendente para este item de estoque?
  const { data: existentes } = await supa
    .from('lista_compras')
    .select('id')
    .eq('estoque_id', item.id)
    .eq('status', 'pendente');

  const temSugestao = existentes && existentes.length > 0;

  if (precisaRepor(item)) {
    if (!temSugestao) {
      // Cria a sugestao na lista, claramente marcada.
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
  } else {
    // Nao precisa mais repor: remove sugestao pendente se houver.
    // (So remove sugestoes automaticas ainda pendentes; nao mexe em item
    //  que ja foi comprado nem em item adicionado manualmente.)
    if (temSugestao) {
      await supa
        .from('lista_compras')
        .delete()
        .eq('estoque_id', item.id)
        .eq('status', 'pendente')
        .eq('origem', 'sugestao_estoque');
      return { removeu: true };
    }
  }

  return {};
}

// Ponte 2: repor o estoque quando um item ligado e comprado.
// Soma a quantidade realmente comprada ao saldo atual do estoque.
export async function reporEstoque(supa, usuario, estoqueId, quantidadeComprada) {
  const qtd = Number(quantidadeComprada);
  if (!isFinite(qtd) || qtd < 0) {
    return { ok: false, motivo: 'Quantidade invalida.' };
  }

  // Le o saldo atual.
  const { data: item, error } = await supa
    .from('estoque')
    .select('id, nome, quantidade')
    .eq('id', estoqueId)
    .single();

  if (error || !item) {
    return { ok: false, motivo: 'Item de estoque nao encontrado.' };
  }

  const novoSaldo = Number(item.quantidade) + qtd;

  const { error: erroUpd } = await supa
    .from('estoque')
    .update({
      quantidade: novoSaldo,
      atualizado_por: usuario.id,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', estoqueId);

  if (erroUpd) {
    return { ok: false, motivo: erroUpd.message };
  }

  supa.from('eventos').insert({
    tipo: 'estoque_reposto',
    entidade: 'estoque',
    entidade_id: estoqueId,
    usuario_id: usuario.id,
    valor_anterior: { quantidade: item.quantidade },
    valor_novo: { quantidade: novoSaldo },
    detalhe: `${usuario.nome} repos ${qtd} de ${item.nome} (compra)`,
  });

  return { ok: true, novoSaldo };
}
