// app.js
// Logica da tela do LifeOS. Fala DIRETO com o Supabase (o backend Node so
// entrega a configuracao publica). O login usa token de sessao - a senha e
// digitada uma vez e nao se repete a cada acao.

import { calcularStatus, rotuloStatus, descricaoQuantidade, NIVEIS_VISUAL, ROTULO_NIVEL } from './status-estoque.js';
import { sincronizarItem, reporEstoque } from './ponte-estoque.js';
import { calcularStatusConta, rotuloStatusConta, formatarValor } from './status-conta.js';
import { saudacao, montarHoje } from './hoje.js';

let supa = null;      // cliente Supabase
let usuario = null;   // perfil do morador logado (id, nome, casa_id)
let canalTempoReal = null;  // "escuta" das mudancas da lista em tempo real

// Atalhos para pegar elementos da tela.
const el = (id) => document.getElementById(id);

// Mostra um aviso (erro ou sucesso) em algum ponto da tela.
function aviso(id, texto, tipo = '') {
  const alvo = el(id);
  alvo.textContent = texto || '';
  alvo.className = 'aviso' + (tipo ? ' ' + tipo : '');
}

// -------------------------------------------------------------------
// Inicializacao: busca a config publica do backend e cria o cliente.
// -------------------------------------------------------------------
async function iniciar() {
  try {
    const resp = await fetch('/config');
    const cfg = await resp.json();
    supa = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  } catch (e) {
    aviso('avisoLogin', 'Nao foi possivel carregar a configuracao. O backend esta rodando?', 'erro');
    return;
  }

  // Se ja houver uma sessao salva (login anterior), entra direto.
  const { data } = await supa.auth.getSession();
  if (data.session) {
    await aoEntrar();
  }
}

// -------------------------------------------------------------------
// LOGIN
// -------------------------------------------------------------------
async function entrar() {
  const email = el('email').value.trim();
  const senha = el('senha').value;
  if (!email || !senha) {
    aviso('avisoLogin', 'Preencha e-mail e senha.', 'erro');
    return;
  }

  el('btnEntrar').disabled = true;
  aviso('avisoLogin', 'Entrando...');

  const { error } = await supa.auth.signInWithPassword({ email, password: senha });

  el('btnEntrar').disabled = false;

  if (error) {
    aviso('avisoLogin', 'Nao foi possivel entrar. Confira e-mail e senha.', 'erro');
    return;
  }

  el('senha').value = '';   // limpa a senha da tela assim que entra
  await aoEntrar();
}

// Depois de logado: busca o perfil e mostra a lista.
async function aoEntrar() {
  const { data: sessao } = await supa.auth.getSession();
  const authId = sessao.session.user.id;

  const { data: perfil, error } = await supa
    .from('usuarios')
    .select('id, nome, casa_id')
    .eq('auth_id', authId)
    .single();

  if (error || !perfil) {
    aviso('avisoLogin', 'Login ok, mas nao encontrei seu perfil.', 'erro');
    return;
  }

  usuario = perfil;
  el('quem').textContent = perfil.nome;
  el('telaLogin').classList.add('oculto');
  el('telaApp').classList.remove('oculto');
  aviso('avisoLogin', '');
  await carregarHoje();
  await carregarLista();
  await carregarEstoque();
  await carregarTarefas();
  await carregarContas();
  ligarTempoReal();
}

// Liga a "escuta" das mudancas na lista da Casa. Sempre que qualquer
// alteracao acontece na tabela lista_compras (adicao, compra, remocao),
// o Supabase avisa e nos recarregamos a lista - sem o usuario apertar F5.
function ligarTempoReal() {
  // Evita ligar duas vezes.
  if (canalTempoReal) return;

  canalTempoReal = supa
    .channel('lista-da-casa')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'lista_compras' },
      () => {
        // Chegou um aviso de mudanca: recarrega a lista.
        carregarLista();
        carregarHoje();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'estoque' },
      () => {
        carregarEstoque();
        carregarHoje();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'contas' },
      () => {
        carregarContas();
        carregarHoje();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tarefas' },
      () => {
        carregarTarefas();
        carregarHoje();
      }
    )
    .subscribe();
}

// Desliga a escuta (ao sair, para nao deixar conexao pendurada).
function desligarTempoReal() {
  if (canalTempoReal) {
    supa.removeChannel(canalTempoReal);
    canalTempoReal = null;
  }
}

// -------------------------------------------------------------------
// LISTA
// -------------------------------------------------------------------
async function carregarLista() {
  const { data: itens, error } = await supa
    .from('lista_compras')
    .select('id, nome, quantidade, unidade, categoria, criado_em, origem, estoque_id')
    .eq('casa_id', usuario.casa_id)
    .eq('status', 'pendente')
    .order('criado_em', { ascending: false });

  const area = el('itens');
  area.innerHTML = '';

  if (error) {
    area.innerHTML = '<div class="vazio">Erro ao carregar a lista.</div>';
    return;
  }
  if (!itens || itens.length === 0) {
    area.innerHTML = '<div class="vazio">Nada pendente. Adicione um item acima.</div>';
    return;
  }

  for (const item of itens) {
    const linha = document.createElement('div');
    linha.className = 'item';

    const desc = document.createElement('div');
    desc.className = 'desc';
    const nome = document.createElement('span');
    nome.className = 'nome';
    nome.textContent = item.nome;
    desc.appendChild(nome);

    // Se veio do estoque, marca visivelmente como sugestao.
    if (item.origem === 'sugestao_estoque') {
      const tag = document.createElement('span');
      tag.className = 'badge';
      tag.style.background = '#8a6d3b';
      tag.style.marginLeft = '8px';
      tag.style.fontSize = '10px';
      tag.textContent = 'sugestão do estoque';
      nome.appendChild(tag);
    }

    const partes = [];
    if (item.quantidade) partes.push(item.quantidade + (item.unidade ? ' ' + item.unidade : ''));
    if (item.categoria) partes.push(item.categoria);
    if (partes.length) {
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = partes.join(' \u00b7 ');
      desc.appendChild(meta);
    }

    const botao = document.createElement('button');
    botao.textContent = 'Comprei';
    botao.onclick = () => comprar(item, botao);

    linha.appendChild(desc);
    linha.appendChild(botao);
    area.appendChild(linha);
  }
}

async function adicionar() {
  const nome = el('novoItem').value.trim();
  if (!nome) {
    aviso('avisoAdd', 'Digite o nome do item.', 'erro');
    return;
  }

  el('btnAdd').disabled = true;

  const { data, error } = await supa
    .from('lista_compras')
    .insert({ casa_id: usuario.casa_id, nome, status: 'pendente', criado_por: usuario.id })
    .select()
    .single();

  // Registra o evento (rastreabilidade). Falha aqui nao atrapalha o item.
  if (data) {
    supa.from('eventos').insert({
      tipo: 'item_adicionado',
      entidade: 'lista_compras',
      entidade_id: data.id,
      usuario_id: usuario.id,
      detalhe: usuario.nome + ' adicionou ' + nome,
    });
  }

  el('btnAdd').disabled = false;

  if (error) {
    aviso('avisoAdd', 'Nao foi possivel adicionar.', 'erro');
    return;
  }

  el('novoItem').value = '';
  aviso('avisoAdd', 'Adicionado.', 'ok');
  setTimeout(() => aviso('avisoAdd', ''), 1500);
  await carregarLista();
}

async function comprar(item, botao) {
  botao.disabled = true;

  // Se o item esta ligado ao estoque, pergunta quanto realmente veio
  // (o caso 12 vs 24 do documento) e repoe o estoque.
  let quantidadeComprada = null;
  if (item.estoque_id) {
    const resposta = prompt(
      `Quantas unidades de "${item.nome}" você comprou?\n(Isso vai repor o estoque)`,
      '1'
    );
    // Se cancelar, aborta a compra.
    if (resposta === null) {
      botao.disabled = false;
      return;
    }
    quantidadeComprada = Number(resposta);
    if (!isFinite(quantidadeComprada) || quantidadeComprada < 0) {
      alert('Quantidade inválida. Nada foi alterado.');
      botao.disabled = false;
      return;
    }
  }

  const { data, error } = await supa
    .from('lista_compras')
    .update({ status: 'comprado', comprado_por: usuario.id, comprado_em: new Date().toISOString() })
    .eq('id', item.id)
    .select()
    .single();

  if (data) {
    supa.from('eventos').insert({
      tipo: 'item_comprado',
      entidade: 'lista_compras',
      entidade_id: item.id,
      usuario_id: usuario.id,
      detalhe: usuario.nome + ' comprou ' + data.nome,
    });
  }

  if (error) {
    botao.disabled = false;
    return;
  }

  // Ponte 2: repoe o estoque com a quantidade real comprada.
  if (item.estoque_id && quantidadeComprada !== null) {
    const rep = await reporEstoque(supa, usuario, item.estoque_id, quantidadeComprada);
    // Reavalia: se apos repor ainda estiver baixo, mantem/recria sugestao;
    // se ficou suficiente, remove eventual sugestao pendente.
    if (rep.ok) {
      const { data: itemEstoque } = await supa
        .from('estoque')
        .select('id, nome, categoria, quantidade, minimo')
        .eq('id', item.estoque_id)
        .single();
      if (itemEstoque) {
        await sincronizarItem(supa, usuario, itemEstoque);
      }
    }
    await carregarEstoque();
  }

  await carregarLista();
}

async function sair() {
  desligarTempoReal();
  await supa.auth.signOut();
  usuario = null;
  el('quem').textContent = '';
  el('telaApp').classList.add('oculto');
  el('telaLogin').classList.remove('oculto');
}

// -------------------------------------------------------------------
// ESTOQUE (Fatia 1 + 1.5)
// -------------------------------------------------------------------

// Normaliza um nome para comparacao: minusculas, sem acento, sem espacos extras.
// Assim "Papel Higiênico" e "papel higienico" sao tratados como iguais.
function normalizarNome(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .trim()
    .replace(/\s+/g, ' ');            // colapsa espacos multiplos
}
async function carregarEstoque() {
  const { data: itens, error } = await supa
    .from('estoque')
    .select('id, nome, categoria, tipo, quantidade, unidade, minimo, nivel, minimo_nivel')
    .eq('casa_id', usuario.casa_id)
    .order('nome');

  const area = el('itensEstoque');
  area.innerHTML = '';

  if (error) {
    area.innerHTML = '<div class="vazio">Erro ao carregar o estoque.</div>';
    return;
  }
  if (!itens || itens.length === 0) {
    area.innerHTML = '<div class="vazio">Nada no estoque ainda. Adicione um item acima.</div>';
    return;
  }

  for (const item of itens) {
    const status = calcularStatus(item.quantidade, item.minimo, item.tipo, item.nivel, item.minimo_nivel);
    const info = rotuloStatus(status);

    const linha = document.createElement('div');
    linha.className = 'item';

    const desc = document.createElement('div');
    desc.className = 'desc';
    const nome = document.createElement('span');
    nome.className = 'nome';
    nome.textContent = item.nome;
    desc.appendChild(nome);
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = descricaoQuantidade(item);
    desc.appendChild(meta);

    const direita = document.createElement('div');
    direita.className = 'est-controles';

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.style.background = info.cor;
    badge.textContent = info.texto;
    direita.appendChild(badge);

    // Controles adaptados por tipo.
    if (item.tipo === 'nivel_visual') {
      // Seletor de nivel.
      const sel = document.createElement('select');
      sel.className = 'sel';
      sel.style.width = 'auto';
      sel.style.padding = '6px 8px';
      sel.style.fontSize = '13px';
      NIVEIS_VISUAL.forEach((n) => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = ROTULO_NIVEL[n];
        if (n === item.nivel) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = () => ajustarNivel(item, sel.value);
      direita.appendChild(sel);

    } else {
      // Contavel e peso_volume: botoes +/-.
      const btnMenos = document.createElement('button');
      const passo = item.tipo === 'peso_volume' ? 100 : 1;
      btnMenos.textContent = '\u2212';
      btnMenos.onclick = () => ajustarEstoque(item, -passo);
      const qtd = document.createElement('span');
      qtd.className = 'est-qtd';
      qtd.textContent = item.quantidade;
      const btnMais = document.createElement('button');
      btnMais.textContent = '+';
      btnMais.onclick = () => ajustarEstoque(item, passo);
      direita.appendChild(btnMenos);
      direita.appendChild(qtd);
      direita.appendChild(btnMais);
    }

    linha.appendChild(desc);
    linha.appendChild(direita);
    area.appendChild(linha);
  }
}

async function adicionarEstoque() {
  const nome = el('estNome').value.trim();
  const tipo = el('estTipo').value;

  if (!nome) {
    aviso('avisoEstoque', 'Digite o nome do item.', 'erro');
    return;
  }

  // Verifica duplicata com normalizacao: compara sem acento e sem caixa.
  const { data: existentes } = await supa
    .from('estoque')
    .select('nome')
    .eq('casa_id', usuario.casa_id);

  const nomeNorm = normalizarNome(nome);
  const duplicata = (existentes || []).find(
    (i) => normalizarNome(i.nome) === nomeNorm
  );
  if (duplicata) {
    aviso('avisoEstoque', `Já existe "${duplicata.nome}" no estoque. Verifique antes de adicionar.`, 'erro');
    return;
  }

  let payload = { casa_id: usuario.casa_id, nome, tipo, atualizado_por: usuario.id };

  if (tipo === 'contavel' || tipo === 'peso_volume') {
    const quantidade = Number(el('estQtd').value);
    const minimo = Number(el('estMin').value);
    const unidade = el('estUnidade').value.trim() || (tipo === 'peso_volume' ? 'g' : 'unidades');
    if (!isFinite(quantidade) || !isFinite(minimo)) {
      aviso('avisoEstoque', 'Quantidade e mínimo precisam ser números.', 'erro');
      return;
    }
    payload = { ...payload, quantidade, minimo, unidade };

  } else if (tipo === 'nivel_visual') {
    payload = {
      ...payload,
      nivel: el('estNivelAtual').value,
      minimo_nivel: el('estNivelMin').value,
      quantidade: 0, minimo: 0,
    };
  }

  el('btnAddEstoque').disabled = true;

  const { data, error } = await supa
    .from('estoque').insert(payload).select().single();

  if (data) {
    supa.from('eventos').insert({
      tipo: 'estoque_item_criado', entidade: 'estoque', entidade_id: data.id,
      usuario_id: usuario.id, detalhe: usuario.nome + ' adicionou ' + nome + ' ao estoque',
    });
  }

  el('btnAddEstoque').disabled = false;

  if (error) {
    aviso('avisoEstoque', 'Não foi possível adicionar.', 'erro');
    return;
  }

  // Resetar formulario.
  el('estNome').value = '';
  el('estTipo').value = 'contavel';
  el('estQtd').value = '0';
  el('estMin').value = '1';
  el('estUnidade').value = '';
  el('estCamposNum').classList.remove('oculto');
  el('estCamposNivel').classList.add('oculto');
  aviso('avisoEstoque', 'Adicionado.', 'ok');
  setTimeout(() => aviso('avisoEstoque', ''), 1500);

  if (data) {
    await sincronizarItem(supa, usuario, data);
    await carregarLista();
  }
  await carregarEstoque();
}

// Ajusta a quantidade de um item (+1 ou -1), sem deixar negativo.
async function ajustarEstoque(item, delta) {
  const nova = Math.max(0, Number(item.quantidade) + delta);

  const { error } = await supa
    .from('estoque')
    .update({
      quantidade: nova,
      atualizado_por: usuario.id,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', item.id);

  if (!error) {
    supa.from('eventos').insert({
      tipo: 'estoque_ajustado', entidade: 'estoque', entidade_id: item.id,
      usuario_id: usuario.id,
      valor_anterior: { quantidade: item.quantidade },
      valor_novo: { quantidade: nova },
      detalhe: `${usuario.nome} ajustou ${item.nome} para ${nova}`,
    });
  }
  // Ponte 1: apos mudar a quantidade, sincroniza sugestao na lista
  // (cria se ficou baixo, remove se voltou a suficiente).
  await sincronizarItem(supa, usuario, { ...item, quantidade: nova });

  // O tempo real recarrega a lista de estoque sozinho; recarregamos tambem
  // aqui para resposta imediata a quem clicou.
  await carregarEstoque();
  await carregarLista();
}

// Ajusta o nivel visual de um item (seletor).
async function ajustarNivel(item, novoNivel) {
  const { error } = await supa
    .from('estoque')
    .update({ nivel: novoNivel, atualizado_por: usuario.id, atualizado_em: new Date().toISOString() })
    .eq('id', item.id);

  if (!error) {
    supa.from('eventos').insert({
      tipo: 'estoque_ajustado', entidade: 'estoque', entidade_id: item.id,
      usuario_id: usuario.id,
      valor_anterior: { nivel: item.nivel },
      valor_novo: { nivel: novoNivel },
      detalhe: `${usuario.nome} ajustou ${item.nome} para ${novoNivel}`,
    });
    await sincronizarItem(supa, usuario, { ...item, nivel: novoNivel });
  }
  await carregarEstoque();
  await carregarLista();
}

// -------------------------------------------------------------------
// CONTAS (cadastro manual)
// -------------------------------------------------------------------
async function carregarContas() {
  const { data: contas, error } = await supa
    .from('contas')
    .select('id, nome, categoria, valor, vencimento, paga, recorrente, dia_vencimento')
    .eq('casa_id', usuario.casa_id)
    .order('paga')                                  // nao pagas primeiro
    .order('vencimento');

  const area = el('itensContas');
  area.innerHTML = '';

  if (error) {
    area.innerHTML = '<div class="vazio">Erro ao carregar as contas.</div>';
    return;
  }
  if (!contas || contas.length === 0) {
    area.innerHTML = '<div class="vazio">Nenhuma conta cadastrada. Adicione acima.</div>';
    return;
  }

  for (const conta of contas) {
    const status = calcularStatusConta(conta);
    const info = rotuloStatusConta(status);

    const linha = document.createElement('div');
    linha.className = 'item';

    const desc = document.createElement('div');
    desc.className = 'desc';
    const nome = document.createElement('span');
    nome.className = 'nome';
    nome.textContent = conta.nome;
    if (conta.recorrente) {
      const r = document.createElement('span');
      r.className = 'meta';
      r.textContent = ' \u21bb';   // simbolo de repeticao
      r.title = 'Repete todo mês';
      nome.appendChild(r);
    }
    desc.appendChild(nome);

    const meta = document.createElement('span');
    meta.className = 'meta';
    const venc = conta.vencimento.slice(0, 10).split('-').reverse().join('/');
    meta.textContent = `${formatarValor(conta.valor)} \u00b7 vence ${venc}`;
    desc.appendChild(meta);

    const direita = document.createElement('div');
    direita.className = 'est-controles';

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.style.background = info.cor;
    badge.textContent = info.texto;
    direita.appendChild(badge);

    if (!conta.paga) {
      const btnPagar = document.createElement('button');
      btnPagar.textContent = 'Paguei';
      btnPagar.style.padding = '7px 12px';
      btnPagar.style.fontSize = '13px';
      btnPagar.onclick = () => pagarConta(conta, btnPagar);
      direita.appendChild(btnPagar);
    }

    linha.appendChild(desc);
    linha.appendChild(direita);
    area.appendChild(linha);
  }
}

async function adicionarConta() {
  const nome = el('ctNome').value.trim();
  const valorTexto = el('ctValor').value;
  const vencimento = el('ctVenc').value;   // formato YYYY-MM-DD
  const recorrente = el('ctRecorrente').checked;

  if (!nome) {
    aviso('avisoConta', 'Digite o nome da conta.', 'erro');
    return;
  }
  if (!vencimento) {
    aviso('avisoConta', 'Escolha a data de vencimento.', 'erro');
    return;
  }

  const valor = valorTexto === '' ? null : Number(valorTexto);
  const diaVenc = recorrente ? Number(vencimento.slice(8, 10)) : null;

  el('btnAddConta').disabled = true;

  const { data, error } = await supa
    .from('contas')
    .insert({
      casa_id: usuario.casa_id,
      nome, valor, vencimento, recorrente,
      dia_vencimento: diaVenc,
      criada_por: usuario.id,
    })
    .select()
    .single();

  if (data) {
    supa.from('eventos').insert({
      tipo: 'conta_criada', entidade: 'contas', entidade_id: data.id,
      usuario_id: usuario.id, detalhe: usuario.nome + ' cadastrou a conta ' + nome,
    });
  }

  el('btnAddConta').disabled = false;

  if (error) {
    aviso('avisoConta', 'Não foi possível adicionar.', 'erro');
    return;
  }

  el('ctNome').value = '';
  el('ctValor').value = '';
  el('ctVenc').value = '';
  el('ctRecorrente').checked = false;
  aviso('avisoConta', 'Conta adicionada.', 'ok');
  setTimeout(() => aviso('avisoConta', ''), 1500);
  await carregarContas();
}

async function pagarConta(conta, botao) {
  botao.disabled = true;

  const { error } = await supa
    .from('contas')
    .update({ paga: true, paga_em: new Date().toISOString() })
    .eq('id', conta.id);

  if (error) {
    botao.disabled = false;
    return;
  }

  supa.from('eventos').insert({
    tipo: 'conta_paga', entidade: 'contas', entidade_id: conta.id,
    usuario_id: usuario.id, detalhe: usuario.nome + ' pagou ' + conta.nome,
  });

  // Se a conta e recorrente, oferece criar a do proximo mes.
  if (conta.recorrente && conta.dia_vencimento) {
    const querProxima = confirm(
      `"${conta.nome}" repete todo mês.\nCriar a conta do próximo mês agora?`
    );
    if (querProxima) {
      await criarProximaRecorrencia(conta);
    }
  }

  await carregarContas();
}

// Cria a proxima ocorrencia de uma conta recorrente, no mes seguinte.
async function criarProximaRecorrencia(conta) {
  const base = new Date(conta.vencimento.slice(0, 10) + 'T00:00:00');
  // Avanca um mes mantendo o dia de vencimento.
  const prox = new Date(base.getFullYear(), base.getMonth() + 1, conta.dia_vencimento || base.getDate());
  const ano = prox.getFullYear();
  const mes = String(prox.getMonth() + 1).padStart(2, '0');
  const dia = String(prox.getDate()).padStart(2, '0');
  const novoVenc = `${ano}-${mes}-${dia}`;

  const { data } = await supa
    .from('contas')
    .insert({
      casa_id: usuario.casa_id,
      nome: conta.nome,
      categoria: conta.categoria,
      valor: conta.valor,
      vencimento: novoVenc,
      recorrente: true,
      dia_vencimento: conta.dia_vencimento,
      criada_por: usuario.id,
    })
    .select()
    .single();

  if (data) {
    supa.from('eventos').insert({
      tipo: 'conta_recorrente_criada', entidade: 'contas', entidade_id: data.id,
      usuario_id: usuario.id, detalhe: `Próxima ${conta.nome} criada para ${novoVenc}`,
    });
  }
}

// -------------------------------------------------------------------
// TELA HOJE — o painel que reune os modulos (so o que precisa de atencao)
// -------------------------------------------------------------------
async function carregarHoje() {
  el('saudacao').textContent = saudacao(usuario.nome);

  const dados = await montarHoje(supa, usuario);
  const area = el('cardsHoje');
  area.innerHTML = '';

  // Se esta tudo em ordem, uma mensagem tranquila em vez de cards vazios.
  if (dados.tudoEmDia) {
    const card = document.createElement('div');
    card.className = 'cartao';
    card.innerHTML = '<div class="tudo-em-dia">Tudo em dia por aqui. \u2728</div>';
    area.appendChild(card);
    return;
  }

  // --- Card CONTAS (o mais urgente primeiro) ---
  if (dados.contasAtencao.length > 0) {
    const card = criarCartaoHoje('Contas próximas', 'contas');
    for (const c of dados.contasAtencao) {
      const quando =
        c.status === 'vencida' ? 'venceu' :
        c.status === 'vence_hoje' ? 'vence hoje' :
        `vence em ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'}`;
      card.corpo.appendChild(miniItem(c.nome, quando, formatarValor(c.valor)));
    }
    area.appendChild(card.cartao);
  }

  // --- Card TAREFAS de hoje/atrasadas ---
  if (dados.tarefasAtencao && dados.tarefasAtencao.length > 0) {
    const card = criarCartaoHoje('Tarefas da Casa', 'tarefas');
    for (const t of dados.tarefasAtencao) {
      const quem = t.responsavel === 'ambos' ? 'Ambos'
        : t.responsavel.charAt(0).toUpperCase() + t.responsavel.slice(1);
      card.corpo.appendChild(miniItem(t.titulo, quem, ''));
    }
    area.appendChild(card.cartao);
  }

  // --- Card ESTOQUE em atencao ---
  if (dados.estoqueAtencao.length > 0) {
    const card = criarCartaoHoje('Estoque em atenção', 'estoque');
    for (const item of dados.estoqueAtencao) {
      const rotulo = item.status === 'acabou' ? 'acabou' : 'baixo';
      card.corpo.appendChild(miniItem(item.nome, `${item.quantidade} \u00b7 ${rotulo}`, ''));
    }
    area.appendChild(card.cartao);
  }

  // --- Card COMPRAS pendentes ---
  if (dados.compras.total > 0) {
    const card = criarCartaoHoje('Compras', 'compras');
    for (const nome of dados.compras.primeiros) {
      card.corpo.appendChild(miniItem(nome, '', ''));
    }
    if (dados.compras.total > dados.compras.primeiros.length) {
      const resto = document.createElement('div');
      resto.className = 'mini-item';
      resto.style.color = 'var(--suave)';
      resto.textContent = `+ mais ${dados.compras.total - dados.compras.primeiros.length} na lista`;
      card.corpo.appendChild(resto);
    }
    if (dados.compras.sugestoes > 0) {
      const sug = document.createElement('div');
      sug.className = 'mini-item';
      sug.style.color = 'var(--acao)';
      sug.style.fontSize = '12px';
      sug.textContent = `${dados.compras.sugestoes} ${dados.compras.sugestoes === 1 ? 'sugestão' : 'sugestões'} do estoque`;
      card.corpo.appendChild(sug);
    }
    area.appendChild(card.cartao);
  }
}

// Cria um cartao do Hoje com titulo e um link "Abrir" que troca de aba.
function criarCartaoHoje(titulo, abaDestino) {
  const cartao = document.createElement('div');
  cartao.className = 'cartao card-clicavel';

  const cab = document.createElement('div');
  cab.className = 'card-hoje-titulo';
  const t = document.createElement('div');
  t.className = 'titulo-secao';
  t.textContent = titulo;
  const abrir = document.createElement('span');
  abrir.className = 'abrir';
  abrir.textContent = 'Abrir';
  cab.appendChild(t);
  cab.appendChild(abrir);

  const corpo = document.createElement('div');

  cartao.appendChild(cab);
  cartao.appendChild(corpo);
  cartao.onclick = () => trocarAba(abaDestino);

  return { cartao, corpo };
}

// Uma linha compacta: nome a esquerda, meta e valor a direita.
function miniItem(nome, meta, valor) {
  const linha = document.createElement('div');
  linha.className = 'mini-item';

  const esq = document.createElement('span');
  esq.textContent = nome;

  const dir = document.createElement('span');
  dir.className = 'm-meta';
  dir.textContent = [meta, valor].filter(Boolean).join('  ');

  linha.appendChild(esq);
  linha.appendChild(dir);
  return linha;
}

// -------------------------------------------------------------------
// TAREFAS (Fatia 1)
// -------------------------------------------------------------------
async function carregarTarefas() {
  const { data: tarefas, error } = await supa
    .from('tarefas')
    .select('id, titulo, responsavel, prioridade, data, feita, recorrente, recorrencia')
    .eq('casa_id', usuario.casa_id)
    .order('feita')
    .order('data', { nullsFirst: true });

  const area = el('itensTarefas');
  area.innerHTML = '';

  if (error) {
    area.innerHTML = '<div class="vazio">Erro ao carregar as tarefas.</div>';
    return;
  }
  if (!tarefas || tarefas.length === 0) {
    area.innerHTML = '<div class="vazio">Nenhuma tarefa. Adicione acima.</div>';
    return;
  }

  for (const tarefa of tarefas) {
    const linha = document.createElement('div');
    linha.className = 'item' + (tarefa.feita ? ' concluida' : '');

    // Checkbox de concluir.
    const check = document.createElement('div');
    check.className = 'check-tarefa' + (tarefa.feita ? ' feita' : '');
    check.textContent = tarefa.feita ? '\u2713' : '';
    check.onclick = () => alternarTarefa(tarefa);

    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.style.flex = '1';
    desc.style.marginLeft = '12px';
    const nome = document.createElement('span');
    nome.className = 'nome';
    nome.textContent = tarefa.titulo;
    desc.appendChild(nome);

    const metaPartes = [];
    const quem = tarefa.responsavel === 'ambos' ? 'Ambos'
      : tarefa.responsavel.charAt(0).toUpperCase() + tarefa.responsavel.slice(1);
    metaPartes.push(quem);
    if (tarefa.recorrente && tarefa.recorrencia) metaPartes.push(tarefa.recorrencia);
    if (tarefa.data) metaPartes.push(tarefa.data.slice(0, 10).split('-').reverse().join('/'));
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = metaPartes.join(' \u00b7 ');
    desc.appendChild(meta);

    // Botao remover discreto.
    const btnRemover = document.createElement('button');
    btnRemover.textContent = '\u00d7';
    btnRemover.title = 'Remover';
    btnRemover.style.background = 'none';
    btnRemover.style.color = 'var(--suave)';
    btnRemover.style.padding = '4px 8px';
    btnRemover.onclick = () => removerTarefa(tarefa.id);

    const containerEsq = document.createElement('div');
    containerEsq.style.display = 'flex';
    containerEsq.style.alignItems = 'center';
    containerEsq.style.flex = '1';
    containerEsq.appendChild(check);
    containerEsq.appendChild(desc);

    linha.appendChild(containerEsq);
    linha.appendChild(btnRemover);
    area.appendChild(linha);
  }
}

async function adicionarTarefa() {
  const titulo = el('tfTitulo').value.trim();
  const responsavel = el('tfResp').value;
  const data = el('tfData').value || null;
  const recorrente = el('tfRecorrente').checked;
  const recorrencia = recorrente ? (el('tfRecorrencia').value.trim() || null) : null;

  if (!titulo) {
    aviso('avisoTarefa', 'Digite o título da tarefa.', 'erro');
    return;
  }

  el('btnAddTarefa').disabled = true;

  const { data: nova, error } = await supa
    .from('tarefas')
    .insert({
      casa_id: usuario.casa_id,
      titulo, responsavel, data, recorrente, recorrencia,
      criada_por: usuario.id,
    })
    .select()
    .single();

  if (nova) {
    supa.from('eventos').insert({
      tipo: 'tarefa_criada', entidade: 'tarefas', entidade_id: nova.id,
      usuario_id: usuario.id, detalhe: usuario.nome + ' criou a tarefa ' + titulo,
    });
  }

  el('btnAddTarefa').disabled = false;

  if (error) {
    aviso('avisoTarefa', 'Não foi possível adicionar.', 'erro');
    return;
  }

  el('tfTitulo').value = '';
  el('tfData').value = '';
  el('tfRecorrente').checked = false;
  el('tfRecorrencia').value = '';
  el('tfRecorrenciaBox').classList.add('oculto');
  aviso('avisoTarefa', 'Tarefa adicionada.', 'ok');
  setTimeout(() => aviso('avisoTarefa', ''), 1500);
  await carregarTarefas();
}

// Marca/desmarca uma tarefa como feita. Ao concluir uma recorrente,
// oferece criar a proxima (mesmo padrao das contas).
async function alternarTarefa(tarefa) {
  const novoEstado = !tarefa.feita;

  const { error } = await supa
    .from('tarefas')
    .update({
      feita: novoEstado,
      feita_por: novoEstado ? usuario.id : null,
      feita_em: novoEstado ? new Date().toISOString() : null,
    })
    .eq('id', tarefa.id);

  if (error) return;

  supa.from('eventos').insert({
    tipo: novoEstado ? 'tarefa_concluida' : 'tarefa_reaberta',
    entidade: 'tarefas', entidade_id: tarefa.id, usuario_id: usuario.id,
    detalhe: `${usuario.nome} ${novoEstado ? 'concluiu' : 'reabriu'} ${tarefa.titulo}`,
  });

  // Se concluiu uma recorrente, oferece criar a proxima.
  if (novoEstado && tarefa.recorrente) {
    const querProxima = confirm(
      `"${tarefa.titulo}" é uma rotina.\nCriar a próxima ocorrência?`
    );
    if (querProxima) {
      await supa.from('tarefas').insert({
        casa_id: usuario.casa_id,
        titulo: tarefa.titulo,
        responsavel: tarefa.responsavel,
        prioridade: tarefa.prioridade,
        recorrente: true,
        recorrencia: tarefa.recorrencia,
        criada_por: usuario.id,
      });
    }
  }

  await carregarTarefas();
}

async function removerTarefa(tarefaId) {
  const { error } = await supa.from('tarefas').delete().eq('id', tarefaId);
  if (!error) {
    supa.from('eventos').insert({
      tipo: 'tarefa_removida', entidade: 'tarefas', entidade_id: tarefaId,
      usuario_id: usuario.id, detalhe: usuario.nome + ' removeu uma tarefa',
    });
    await carregarTarefas();
  }
}

// -------------------------------------------------------------------
// NAVEGACAO POR ABAS
// -------------------------------------------------------------------
function trocarAba(qual) {
  el('abaHoje').classList.toggle('oculto', qual !== 'hoje');
  el('abaCompras').classList.toggle('oculto', qual !== 'compras');
  el('abaEstoque').classList.toggle('oculto', qual !== 'estoque');
  el('abaTarefas').classList.toggle('oculto', qual !== 'tarefas');
  el('abaContas').classList.toggle('oculto', qual !== 'contas');
  document.querySelectorAll('.aba').forEach((b) => {
    b.classList.toggle('ativa', b.dataset.aba === qual);
  });
  if (qual === 'hoje' && usuario) carregarHoje();
}

document.querySelectorAll('.aba').forEach((botao) => {
  botao.onclick = () => trocarAba(botao.dataset.aba);
});

// -------------------------------------------------------------------
// Ligacoes de eventos da tela
// -------------------------------------------------------------------
el('btnEntrar').onclick = entrar;
el('senha').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });
el('btnAdd').onclick = adicionar;
el('novoItem').addEventListener('keydown', (e) => { if (e.key === 'Enter') adicionar(); });
el('btnAddEstoque').onclick = adicionarEstoque;
// Mostra os campos certos conforme o tipo selecionado.
el('estTipo').addEventListener('change', (e) => {
  const t = e.target.value;
  el('estCamposNum').classList.toggle('oculto', t === 'nivel_visual');
  el('estCamposNivel').classList.toggle('oculto', t !== 'nivel_visual');
});
el('btnAddConta').onclick = adicionarConta;
el('btnAddTarefa').onclick = adicionarTarefa;
// Mostra o campo de recorrencia so quando "Repete (rotina)" esta marcado.
el('tfRecorrente').addEventListener('change', (e) => {
  el('tfRecorrenciaBox').classList.toggle('oculto', !e.target.checked);
});
el('btnSair').onclick = sair;

iniciar();
