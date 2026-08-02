// consumo-estoque.js
// Calcula estimativas de consumo para itens do estoque.

// Converte taxa para consumo por dia
function consumoPorDia(taxa, periodo) {
  if (!taxa || !periodo) return null;
  if (periodo === 'dia')    return taxa;
  if (periodo === 'semana') return taxa / 7;
  if (periodo === 'mes')    return taxa / 30;
  return null;
}

// Retorna quantos dias de estoque restam com base na quantidade atual e taxa de consumo.
// null se não tiver taxa configurada.
export function diasRestantes(item) {
  const cpd = consumoPorDia(item.taxa_consumo, item.taxa_periodo);
  if (!cpd || cpd <= 0) return null;
  const quantidade = item.tipo === 'nivel_visual' ? null : Number(item.quantidade);
  if (quantidade === null || isNaN(quantidade)) return null;
  return Math.floor(quantidade / cpd);
}

// Retorna o status de consumo do item.
// 'critico' | 'atencao' | 'ok' | null (sem taxa configurada)
export function statusConsumo(item) {
  const dias = diasRestantes(item);
  if (dias === null) return null;
  const alerta = item.alerta_dias ?? 7;
  if (dias <= 0)        return 'critico';
  if (dias <= alerta)   return 'atencao';
  return 'ok';
}

export function labelConsumo(item) {
  const dias = diasRestantes(item);
  if (dias === null) return null;
  if (dias <= 0)  return 'Acabou (consumo)';
  if (dias === 1) return 'Dura ~1 dia';
  return `Dura ~${dias} dias`;
}

// Verifica todos os itens do estoque e retorna os que precisam de sugestão na lista.
export function itensCriticosConsumo(itens) {
  return itens.filter(item => {
    const st = statusConsumo(item);
    return st === 'critico' || st === 'atencao';
  });
}

// Gera sugestões na lista de compras para itens com consumo crítico.
// Evita duplicar se já existe um item pendente com o mesmo nome.
export async function gerarSugestoesConsumo(supa, usuario, itensEstoque, itensLista) {
  const criticos = itensCriticosConsumo(itensEstoque);
  if (!criticos.length) return 0;

  const nomesPendentes = new Set(
    (itensLista || []).map(i => i.nome.toLowerCase().trim())
  );

  let gerados = 0;
  for (const item of criticos) {
    const nome = item.nome.toLowerCase().trim();
    if (nomesPendentes.has(nome)) continue;
    await supa.from('lista_compras').insert({
      casa_id: usuario.casa_id,
      nome: item.nome,
      status: 'pendente',
      origem: 'sugestao_consumo',
      estoque_id: item.id,
      criado_por: usuario.id,
    });
    gerados++;
  }
  return gerados;
}
