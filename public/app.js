// app.js
// Logica da tela do LifeOS. Fala DIRETO com o Supabase (o backend Node so
// entrega a configuracao publica). O login usa token de sessao - a senha e
// digitada uma vez e nao se repete a cada acao.

let supa = null;      // cliente Supabase
let usuario = null;   // perfil do morador logado (id, nome, casa_id)

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
  el('telaLista').classList.remove('oculto');
  aviso('avisoLogin', '');
  await carregarLista();
}

// -------------------------------------------------------------------
// LISTA
// -------------------------------------------------------------------
async function carregarLista() {
  const { data: itens, error } = await supa
    .from('lista_compras')
    .select('id, nome, quantidade, unidade, categoria, criado_em')
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
    botao.onclick = () => comprar(item.id, botao);

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

async function comprar(itemId, botao) {
  botao.disabled = true;

  const { data, error } = await supa
    .from('lista_compras')
    .update({ status: 'comprado', comprado_por: usuario.id, comprado_em: new Date().toISOString() })
    .eq('id', itemId)
    .select()
    .single();

  if (data) {
    supa.from('eventos').insert({
      tipo: 'item_comprado',
      entidade: 'lista_compras',
      entidade_id: itemId,
      usuario_id: usuario.id,
      detalhe: usuario.nome + ' comprou ' + data.nome,
    });
  }

  if (error) {
    botao.disabled = false;
    return;
  }
  await carregarLista();
}

async function sair() {
  await supa.auth.signOut();
  usuario = null;
  el('quem').textContent = '';
  el('telaLista').classList.add('oculto');
  el('telaLogin').classList.remove('oculto');
}

// -------------------------------------------------------------------
// Ligacoes de eventos da tela
// -------------------------------------------------------------------
el('btnEntrar').onclick = entrar;
el('senha').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });
el('btnAdd').onclick = adicionar;
el('novoItem').addEventListener('keydown', (e) => { if (e.key === 'Enter') adicionar(); });
el('btnSair').onclick = sair;

iniciar();
