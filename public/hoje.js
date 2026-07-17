// hoje.js
// Reune os dados dos modulos existentes para a Tela Hoje.
// Principio (Documento Mestre, secao 10.2): mostrar so o que PRECISA de
// atencao agora - nao virar lista infinita. O que esta em ordem fica quieto.
//
// Conforme novos modulos nascem (tarefas, alimentacao, saude, projetos),
// novos blocos entram aqui, no lugar que o prototipo ja preve.

import { calcularStatus } from './status-estoque.js';
import { calcularStatusConta, diasAteVencer } from './status-conta.js';

// Saudacao por periodo do dia.
export function saudacao(nome, agora = new Date()) {
  const h = agora.getHours();
  let periodo;
  if (h >= 5 && h < 12) periodo = 'Bom dia';
  else if (h >= 12 && h < 18) periodo = 'Boa tarde';
  else periodo = 'Boa noite';
  return `${periodo}, ${nome}.`;
}

// Busca tudo que a Tela Hoje precisa, em paralelo, e devolve so o que
// merece atencao. Recebe o cliente Supabase logado e o usuario.
export async function montarHoje(supa, usuario) {
  const casaId = usuario.casa_id;

  // Busca as fontes em paralelo (mais rapido que uma de cada vez).
  const [respLista, respEstoque, respContas, respTarefas] = await Promise.all([
    supa.from('lista_compras')
      .select('id, nome, origem')
      .eq('casa_id', casaId)
      .eq('status', 'pendente'),
    supa.from('estoque')
      .select('id, nome, quantidade, minimo')
      .eq('casa_id', casaId),
    supa.from('contas')
      .select('id, nome, valor, vencimento, paga')
      .eq('casa_id', casaId)
      .eq('paga', false),
    supa.from('tarefas')
      .select('id, titulo, responsavel, data, feita')
      .eq('casa_id', casaId)
      .eq('feita', false),
  ]);

  // --- COMPRAS: quantos pendentes e quantos sao sugestao do estoque ---
  const itensLista = respLista.data || [];
  const compras = {
    total: itensLista.length,
    sugestoes: itensLista.filter((i) => i.origem === 'sugestao_estoque').length,
    primeiros: itensLista.slice(0, 4).map((i) => i.nome),
  };

  // --- ESTOQUE: so os que precisam de reposicao (baixo/acabou) ---
  const estoqueAtencao = (respEstoque.data || [])
    .map((item) => ({ ...item, status: calcularStatus(item.quantidade, item.minimo) }))
    .filter((item) => item.status === 'baixo' || item.status === 'acabou')
    .sort((a, b) => a.quantidade - b.quantidade);

  // --- CONTAS: so as que pedem atencao (vencida/hoje/breve), ordenadas ---
  const contasAtencao = (respContas.data || [])
    .map((c) => ({
      ...c,
      status: calcularStatusConta(c),
      dias: diasAteVencer(c.vencimento),
    }))
    .filter((c) => c.status === 'vencida' || c.status === 'vence_hoje' || c.status === 'vence_breve')
    .sort((a, b) => a.dias - b.dias);

  // --- TAREFAS: pendentes de hoje, atrasadas, ou sem data ---
  const hojeStr = new Date().toISOString().slice(0, 10);
  const tarefasAtencao = (respTarefas.data || [])
    .filter((t) => !t.data || t.data <= hojeStr)   // sem data, hoje ou atrasada
    .slice(0, 5);

  // Ha algo pedindo atencao em algum lugar?
  const tudoEmDia =
    compras.total === 0 &&
    estoqueAtencao.length === 0 &&
    contasAtencao.length === 0 &&
    tarefasAtencao.length === 0;

  return { compras, estoqueAtencao, contasAtencao, tarefasAtencao, tudoEmDia };
}
