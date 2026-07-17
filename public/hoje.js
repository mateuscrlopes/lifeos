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

  // dia da semana: 1=seg...5=sex (0=dom/6=sab nao tem marmita)
  const diaSemana = hojeDate.getDay(); // 0=dom,1=seg...6=sab
  const diaCardapio = diaSemana >= 1 && diaSemana <= 5 ? diaSemana : null;

  const [respLista, respEstoque, respContas, respTarefas, respCardapio] = await Promise.all([
    supa.from('lista_compras').select('id, nome, origem').eq('casa_id', casaId).eq('status', 'pendente'),
    supa.from('estoque').select('id, nome, quantidade, minimo, tipo, nivel, minimo_nivel').eq('casa_id', casaId),
    supa.from('contas').select('id, nome, valor, vencimento, paga').eq('casa_id', casaId).eq('paga', false),
    supa.from('tarefas').select('id, titulo, responsavel, data, feita').eq('casa_id', casaId).eq('feita', false),
    diaCardapio ? supa.from('planejamento_dias')
      .select('tipo, refeicao_nome, observacao, refeicoes(nome), planejamento_semana!inner(semana_inicio, responsavel)')
      .eq('planejamento_semana.casa_id', casaId)
      .eq('planejamento_semana.semana_inicio', segStr)
      .eq('dia_semana', diaCardapio) : Promise.resolve({ data: [] }),
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

  // Cardapio de hoje
  const diasCardapio = respCardapio.data || [];
  const almoco = diasCardapio.find((d) => d.tipo === 'almoco');
  const janta = diasCardapio.find((d) => d.tipo === 'janta');
  const cardapioHoje = (almoco || janta) ? {
    almoco: almoco ? (almoco.refeicoes?.nome || almoco.refeicao_nome || null) : null,
    janta: janta ? (janta.refeicoes?.nome || janta.refeicao_nome || null) : null,
    responsavel: almoco?.planejamento_semana?.responsavel || janta?.planejamento_semana?.responsavel || null,
  } : null;

  const tudoEmDia = compras.total === 0 && estoqueAtencao.length === 0 &&
    contasAtencao.length === 0 && tarefasAtencao.length === 0;

  return { compras, estoqueAtencao, contasAtencao, tarefasAtencao, cardapioHoje, tudoEmDia };
}
