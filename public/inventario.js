// inventario.js
// Logica do Inventario Rotativo (Fatia 3 do estoque).
// Criterios desta fatia (secao 19.3): item critico, ultima atualizacao
// antiga (>15 dias), status baixo/acabou, solicitacao manual.
// Confianca e consumo historico ficam para a Fatia 4.

import { calcularStatus } from './status-estoque.js';

const DIAS_ANTIGO = 15;

function diasDesde(dataStr) {
  if (!dataStr) return 999;
  const umDia = 24 * 60 * 60 * 1000;
  return Math.round((Date.now() - new Date(dataStr).getTime()) / umDia);
}

export function passoQuantidadeEstoque(item) {
  if (item?.tipo !== 'peso_volume') return 1;
  const unidade = String(item?.unidade || '').trim().toLowerCase();
  if (['g', 'grama', 'gramas', 'ml', 'mililitro', 'mililitros'].includes(unidade)) return 100;
  if (['kg', 'quilo', 'quilos', 'quilograma', 'quilogramas', 'l', 'litro', 'litros'].includes(unidade)) return 1;
  return 1;
}

export function normalizarQuantidadeEstoque(item, valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) return null;
  if (item?.tipo === 'presenca') return numero > 0 ? 1 : 0;
  return Math.round(numero * 1000) / 1000;
}

// Seleciona os itens de um local que precisam de conferencia.
// Retorna { itens, local } com os itens ordenados por urgencia.
export async function selecionarItensInventario(supa, usuario, local) {
  const { data: todos, error } = await supa
    .from('estoque')
    .select('id, nome, tipo, quantidade, unidade, minimo, nivel, minimo_nivel, critico, atualizado_em')
    .eq('casa_id', usuario.casa_id)
    .eq('local', local);

  if (error || !todos) return { itens: [], local };

  const itens = todos
    .filter((item) => {
      const status = calcularStatus(item.quantidade, item.minimo, item.tipo, item.nivel, item.minimo_nivel);
      const antigo = diasDesde(item.atualizado_em) >= DIAS_ANTIGO;
      const baixo = status === 'baixo' || status === 'acabou' || status === 'atencao';
      return item.critico || antigo || baixo;
    })
    .sort((a, b) => {
      const pa = (a.critico ? 0 : 1) + (calcularStatus(a.quantidade, a.minimo, a.tipo, a.nivel, a.minimo_nivel) === 'acabou' ? 0 : 1);
      const pb = (b.critico ? 0 : 1) + (calcularStatus(b.quantidade, b.minimo, b.tipo, b.nivel, b.minimo_nivel) === 'acabou' ? 0 : 1);
      return pa - pb;
    });

  return { itens, local };
}

// Grava o resultado do inventario: atualiza o item e registra o evento.
export async function confirmarItemInventario(supa, usuario, item, novoValor) {
  let payload;
  let valorNovo;

  if (item.tipo === 'nivel_visual') {
    payload = { nivel: novoValor, atualizado_por: usuario.id, atualizado_em: new Date().toISOString() };
    valorNovo = { nivel: novoValor };
  } else {
    const quantidade = normalizarQuantidadeEstoque(item, novoValor);
    if (quantidade === null) return false;
    payload = { quantidade, atualizado_por: usuario.id, atualizado_em: new Date().toISOString() };
    valorNovo = { quantidade };
  }

  const { error } = await supa
    .from('estoque')
    .update(payload)
    .eq('id', item.id)
    .eq('casa_id', usuario.casa_id);

  if (!error) {
    supa.from('eventos').insert({
      tipo: 'inventario_item_conferido',
      entidade: 'estoque',
      entidade_id: item.id,
      usuario_id: usuario.id,
      valor_anterior: item.tipo === 'nivel_visual' ? { nivel: item.nivel } : { quantidade: item.quantidade },
      valor_novo: valorNovo,
      detalhe: `Inventário: ${usuario.nome} conferiu ${item.nome}`,
    });
  }
  return !error;
}

// Registra a conclusao da sessao de inventario.
export async function concluirSessaoInventario(supa, usuario, local, itensCount) {
  const { data } = await supa.from('inventarios').insert({
    casa_id: usuario.casa_id,
    local,
    feito_por: usuario.id,
    concluido_em: new Date().toISOString(),
    itens_count: itensCount,
  }).select().single();

  if (data) {
    supa.from('eventos').insert({
      tipo: 'inventario_concluido',
      entidade: 'inventarios',
      entidade_id: data.id,
      usuario_id: usuario.id,
      detalhe: `${usuario.nome} concluiu inventário de ${local} (${itensCount} itens)`,
    });
  }
}
