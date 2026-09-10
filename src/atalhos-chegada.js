import { calcularStatus } from '../public/status-estoque.js';

export function normalizarTextoChegada(valor = '') {
  return String(valor)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function estoquePrecisaRepor(item) {
  if (!item) return false;
  const status = calcularStatus(
    item.quantidade,
    item.minimo,
    item.tipo,
    item.nivel,
    item.minimo_nivel,
  );
  return status === 'baixo' || status === 'acabou';
}

function localMercado(categorias) {
  return [...categorias].some(categoria =>
    categoria.startsWith('cozinha')
    || categoria.startsWith('casa')
    || categoria === 'lavanderia'
  );
}

function localFarmacia(categorias) {
  return [...categorias].some(categoria => categoria.startsWith('farmacia'));
}

export function localEstoqueCompativel(localEstoque, categoriasAceitas = []) {
  const categorias = categoriasAceitas instanceof Set
    ? categoriasAceitas
    : new Set(categoriasAceitas.map(normalizarTextoChegada).filter(Boolean));
  if (!categorias.size) return true;

  const local = normalizarTextoChegada(localEstoque);
  if (!local) return localMercado(categorias);

  if ([...categorias].some(categoria =>
    categoria === local
    || categoria.startsWith(`${local} -`)
    || categoria.startsWith(`${local} /`)
  )) return true;

  // O catálogo antigo usa "Despensa", enquanto a configuração nova separa
  // os corredores equivalentes da cozinha. Mantemos a compatibilidade sem
  // transformar carnes/hortifruti em itens de despensa.
  if (local === 'despensa') {
    return [
      'cozinha - nao pereciveis',
      'cozinha - cafe da manha',
      'cozinha - temperos',
    ].some(categoria => categorias.has(categoria));
  }

  return false;
}

function destinoCompativel(destino, categorias) {
  if (!destino) return true;
  const tipo = normalizarTextoChegada(destino.tipo);
  if (tipo === 'mercado') return localMercado(categorias);
  if (tipo === 'farmacia') return localFarmacia(categorias);
  return destino.entra_lista_mercado !== false && localMercado(categorias);
}

export function classificarItensChegada({ itensLista = [], itensEstoque = [], categoriasAceitas = [] } = {}) {
  const categorias = categoriasAceitas instanceof Set
    ? categoriasAceitas
    : new Set(categoriasAceitas.map(normalizarTextoChegada).filter(Boolean));
  const estoquePorId = new Map(itensEstoque.map(item => [item.id, item]));
  const estoquePorNome = new Map(
    itensEstoque.map(item => [normalizarTextoChegada(item.nome), item]),
  );
  const estoqueRepresentado = new Set();
  const nomesRepresentados = new Set();

  const classificados = itensLista.map(item => {
    const estoque = estoquePorId.get(item.estoque_id)
      || estoquePorNome.get(normalizarTextoChegada(item.nome))
      || null;
    if (estoque?.id) estoqueRepresentado.add(estoque.id);
    nomesRepresentados.add(normalizarTextoChegada(item.nome));

    const compativel = estoque?.local
      ? localEstoqueCompativel(estoque.local, categorias)
      : destinoCompativel(item.compra_destinos, categorias);

    return {
      ...item,
      estoque,
      compativel,
      critico: Boolean(estoque?.critico),
      reposicao: Boolean(estoque && estoquePrecisaRepor(estoque)),
      origem_chegada: 'lista',
    };
  });

  // A chegada não depende mais de a ponte do frontend já ter criado uma
  // sugestão na lista. Estoque baixo/acabado entra diretamente no cálculo.
  for (const estoque of itensEstoque) {
    if (!estoquePrecisaRepor(estoque)) continue;
    if (estoqueRepresentado.has(estoque.id)) continue;
    if (nomesRepresentados.has(normalizarTextoChegada(estoque.nome))) continue;
    if (!localEstoqueCompativel(estoque.local, categorias)) continue;

    classificados.push({
      id: `estoque:${estoque.id}`,
      nome: estoque.nome,
      categoria: estoque.categoria || null,
      estoque_id: estoque.id,
      destino_compra_id: null,
      compra_destinos: null,
      estoque,
      compativel: true,
      critico: Boolean(estoque.critico),
      reposicao: true,
      origem_chegada: 'estoque',
    });
  }

  const compativeis = classificados.filter(item => item.compativel);
  const criticos = compativeis.filter(item => item.critico);
  const reposicao = compativeis.filter(item => !item.critico && item.reposicao);
  const outros = compativeis.filter(item => !item.critico && !item.reposicao);

  return { criticos, reposicao, outros, todos: compativeis };
}
