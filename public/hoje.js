// hoje.js — monta os dados para a Tela Hoje
import { calcularStatus } from './status-estoque.js';
import { calcularStatusConta, diasAteVencer } from './status-conta.js';

export function saudacao(nome, agora = new Date()) {
  const h = agora.getHours();
  const p = h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite';
  return `${p}, ${nome}.`;
}

// Retorna a segunda-feira da semana de uma data.
export function inicioSemana(data = new Date()) {
  const d = new Date(data);
  const dia = d.getDay(); // 0=dom, 1=seg...
  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatarDataISO(data) {
  return data.toISOString().slice(0, 10);
}

export async function montarHoje(supa, usuario) {
  const casaId = usuario.casa_id;
  const hojeDate = new Date();
  const hojeStr = formatarDataISO(hojeDate);
  const segStr = formatarDataISO(inicioSemana(hojeDate));

  // Cardápio usa 1=seg...7=dom.
  const diaSemana = hojeDate.getDay(); // 0=dom,1=seg...6=sab
  const diaCardapio = diaSemana === 0 ? 7 : diaSemana;

  const [respLista, respEstoque, respContas, respTarefas, respCardapio] = await Promise.all([
    supa.from('lista_compras').select('id, nome, origem').eq('casa_id', casaId).eq('status', 'pendente'),
    supa.from('estoque').select('id, nome, quantidade, minimo, tipo, nivel, minimo_nivel').eq('casa_id', casaId),
    supa.from('contas').select('id, nome, valor, vencimento, paga').eq('casa_id', casaId).eq('paga', false),
    supa.from('tarefas').select('id, titulo, responsavel, data, feita').eq('casa_id', casaId).eq('feita', false),
    supa.from('planejamento_dias')
      .select('id, tipo, refeicao_nome, observacao, calorias, proteina_g, refeicoes(nome, calorias_por_porcao, proteina_por_porcao), planejamento_semana!inner(semana_inicio, responsavel)')
      .eq('planejamento_semana.casa_id', casaId)
      .eq('planejamento_semana.semana_inicio', segStr)
      .eq('dia_semana', diaCardapio),
  ]);

  const itensLista = respLista.data || [];
  const compras = {
    total: itensLista.length,
    sugestoes: itensLista.filter((i) => i.origem === 'sugestao_estoque' || i.origem === 'cardapio').length,
    primeiros: itensLista.slice(0, 4).map((i) => i.nome),
  };

  const estoqueAtencao = (respEstoque.data || [])
    .map((item) => ({ ...item, status: calcularStatus(item.quantidade, item.minimo, item.tipo, item.nivel, item.minimo_nivel) }))
    .filter((item) => item.status === 'baixo' || item.status === 'acabou')
    .sort((a, b) => a.quantidade - b.quantidade);

  const contasAtencao = (respContas.data || [])
    .map((c) => ({ ...c, status: calcularStatusConta(c), dias: diasAteVencer(c.vencimento) }))
    .filter((c) => ['vencida','vence_hoje','vence_breve'].includes(c.status))
    .sort((a, b) => a.dias - b.dias);

  const tarefasAtencao = (respTarefas.data || [])
    .filter((t) => !t.data || t.data <= hojeStr).slice(0, 5);

  // Cardápio de hoje pode ter uma refeição compartilhada ou opções pessoais diferentes.
  const diasCardapio = respCardapio.data || [];
  const itensCardapio = diasCardapio.map((d) => ({
    id: d.id,
    tipo: d.tipo,
    nome: d.refeicoes?.nome || d.refeicao_nome || null,
    calorias: d.calorias ?? d.refeicoes?.calorias_por_porcao ?? null,
    proteina_g: d.proteina_g ?? d.refeicoes?.proteina_por_porcao ?? null,
    responsavel: d.planejamento_semana?.responsavel || 'ambos',
  })).filter((d) => d.nome);
  const cafe = itensCardapio.find((d) => d.tipo === 'cafe');
  const almoco = itensCardapio.find((d) => d.tipo === 'almoco');
  const lanche = itensCardapio.find((d) => d.tipo === 'lanche');
  const janta = itensCardapio.find((d) => d.tipo === 'janta');
  const cardapioHoje = itensCardapio.length ? {
    itens: itensCardapio,
    cafe: cafe?.nome || null,
    almoco: almoco?.nome || null,
    lanche: lanche?.nome || null,
    janta: janta?.nome || null,
    responsavel: itensCardapio.length === 1 ? itensCardapio[0].responsavel : null,
  } : null;

  const tudoEmDia = compras.total === 0 && estoqueAtencao.length === 0 &&
    contasAtencao.length === 0 && tarefasAtencao.length === 0;

  return { compras, estoqueAtencao, contasAtencao, tarefasAtencao, cardapioHoje, tudoEmDia };
}
