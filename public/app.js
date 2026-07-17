// app.js
// Logica da tela do LifeOS. Fala DIRETO com o Supabase (o backend Node so
// entrega a configuracao publica). O login usa token de sessao - a senha e
// digitada uma vez e nao se repete a cada acao.

import { calcularStatus, rotuloStatus } from './status-estoque.js';
import { sincronizarItem, reporEstoque } from './ponte-estoque.js';
import { calcularStatusConta, rotuloStatusConta, formatarValor } from './status-conta.js';

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
  await carregarLista();
  await carregarEstoque();
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
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'estoque' },
      () => {
        carregarEstoque();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'contas' },
      () => {
        carregarContas();
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
// ESTOQUE (Fatia 1 - unidade contavel)
// -------------------------------------------------------------------
async function carregarEstoque() {
  const { data: itens, error } = await supa
    .from('estoque')
    .select('id, nome, categoria, quantidade, unidade, minimo')
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
    const status = calcularStatus(item.quantidade, item.minimo);
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
    meta.textContent = `mínimo: ${item.minimo} ${item.unidade || ''}`.trim();
    desc.appendChild(meta);

    const direita = document.createElement('div');
    direita.className = 'est-controles';

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.style.background = info.cor;
    badge.textContent = info.texto;

    const btnMenos = document.createElement('button');
    btnMenos.textContent = '\u2212';   // sinal de menos
    btnMenos.onclick = () => ajustarEstoque(item, -1);

    const qtd = document.createElement('span');
    qtd.className = 'est-qtd';
    qtd.textContent = item.quantidade;

    const btnMais = document.createElement('button');
    btnMais.textContent = '+';
    btnMais.onclick = () => ajustarEstoque(item, +1);

    direita.appendChild(badge);
    direita.appendChild(btnMenos);
    direita.appendChild(qtd);
    direita.appendChild(btnMais);

    linha.appendChild(desc);
    linha.appendChild(direita);
    area.appendChild(linha);
  }
}

async function adicionarEstoque() {
  const nome = el('estNome').value.trim();
  const quantidade = Number(el('estQtd').value);
  const minimo = Number(el('estMin').value);

  if (!nome) {
    aviso('avisoEstoque', 'Digite o nome do item.', 'erro');
    return;
  }
  if (!isFinite(quantidade) || !isFinite(minimo)) {
    aviso('avisoEstoque', 'Quantidade e mínimo precisam ser números.', 'erro');
    return;
  }

  el('btnAddEstoque').disabled = true;

  const { data, error } = await supa
    .from('estoque')
    .insert({
      casa_id: usuario.casa_id,
      nome, quantidade, minimo,
      atualizado_por: usuario.id,
    })
    .select()
    .single();

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

  el('estNome').value = '';
  el('estQtd').value = '0';
  el('estMin').value = '1';
  aviso('avisoEstoque', 'Adicionado.', 'ok');
  setTimeout(() => aviso('avisoEstoque', ''), 1500);

  // Se o item ja nasce baixo/acabou, sugere na lista.
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
// NAVEGACAO POR ABAS
// -------------------------------------------------------------------
function trocarAba(qual) {
  el('abaCompras').classList.toggle('oculto', qual !== 'compras');
  el('abaEstoque').classList.toggle('oculto', qual !== 'estoque');
  el('abaContas').classList.toggle('oculto', qual !== 'contas');
  document.querySelectorAll('.aba').forEach((b) => {
    b.classList.toggle('ativa', b.dataset.aba === qual);
  });
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
el('btnAddConta').onclick = adicionarConta;
el('btnSair').onclick = sair;

iniciar();
