import { normalizarTexto, limparNomeItem, respostaErro } from './util.js';

function temPermissao(dispositivo, acao) {
  const permissoes = Array.isArray(dispositivo.permissoes) ? dispositivo.permissoes : [];
  return permissoes.includes(acao);
}

async function adicionarCompras({ supa, dispositivo, interpretacao }) {
  if (!temPermissao(dispositivo, 'adicionar_compras')) {
    return respostaErro('sem_permissao', 'Este aparelho nao tem permissao para alterar a lista.');
  }

  const itensPedidos = interpretacao.itens.map(limparNomeItem).filter(Boolean);
  if (!itensPedidos.length) {
    return respostaErro('sem_itens', 'Nao consegui identificar o que deve entrar na lista.');
  }

  const { data: pendentes, error: erroConsulta } = await supa
    .from('lista_compras')
    .select('id, nome')
    .eq('casa_id', dispositivo.casa_id)
    .eq('status', 'pendente');

  if (erroConsulta) {
    return respostaErro('erro_banco', 'Nao consegui consultar a lista agora.');
  }

  const nomesPendentes = new Set((pendentes || []).map((item) => normalizarTexto(item.nome)));
  const novos = [];
  const repetidos = [];

  for (const item of itensPedidos) {
    const chave = normalizarTexto(item);
    if (!chave || nomesPendentes.has(chave)) {
      repetidos.push(item);
      continue;
    }
    nomesPendentes.add(chave);
    novos.push(item);
  }

  if (novos.length) {
    const registros = novos.map((nome) => ({
      casa_id: dispositivo.casa_id,
      nome,
      status: 'pendente',
      origem: 'gumate',
      criado_por: dispositivo.usuario_id,
    }));

    const { error: erroInsercao } = await supa.from('lista_compras').insert(registros);
    if (erroInsercao) {
      console.error('[Gumate] Erro ao inserir compras:', erroInsercao.message);
      return respostaErro('erro_banco', 'Nao consegui adicionar os itens agora.');
    }

    void supa.from('eventos').insert(novos.map((nome) => ({
      tipo: 'item_adicionado',
      entidade: 'lista_compras',
      usuario_id: dispositivo.usuario_id,
      detalhe: `${dispositivo.nome} adicionou "${nome}" via Gumate`,
    })));
  }

  if (!novos.length && repetidos.length) {
    return {
      ok: true,
      codigo: 'ja_estavam_na_lista',
      resposta: repetidos.length === 1
        ? `${repetidos[0]} ja estava na lista.`
        : 'Esses itens ja estavam na lista.',
      adicionados: [],
      repetidos,
    };
  }

  const listaNovos = novos.length === 1
    ? novos[0]
    : `${novos.slice(0, -1).join(', ')} e ${novos.at(-1)}`;

  const complemento = repetidos.length
    ? ` ${repetidos.length === 1 ? repetidos[0] + ' ja estava' : 'Alguns itens ja estavam'} na lista.`
    : '';

  return {
    ok: true,
    codigo: 'compras_adicionadas',
    resposta: `${listaNovos} ${novos.length === 1 ? 'foi adicionado' : 'foram adicionados'} à lista.${complemento}`,
    adicionados: novos,
    repetidos,
  };
}

export async function executarAcao(contexto) {
  switch (contexto.interpretacao.acao) {
    case 'adicionar_compras':
      return adicionarCompras(contexto);
    case 'nao_entendi':
      return respostaErro('nao_entendi', contexto.interpretacao.pergunta || 'Nao entendi esse pedido.');
    default:
      return respostaErro('acao_nao_permitida', 'Essa acao ainda nao existe no Gumate.');
  }
}
