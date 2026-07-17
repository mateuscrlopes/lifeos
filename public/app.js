// app.js — LifeOS v0.13.0
import { calcularStatus, rotuloStatus, descricaoQuantidade, NIVEIS_VISUAL, ROTULO_NIVEL } from './status-estoque.js';
import { sincronizarItem, reporEstoque } from './ponte-estoque.js';
import { calcularStatusConta, rotuloStatusConta, formatarValor } from './status-conta.js';
import { saudacao, montarHoje } from './hoje.js';
import { selecionarItensInventario, confirmarItemInventario, concluirSessaoInventario } from './inventario.js';

let supa = null;
let usuario = null;
let canalTempoReal = null;

const el = (id) => document.getElementById(id);

function aviso(id, texto, tipo = '') {
  const alvo = el(id);
  alvo.textContent = texto || '';
  alvo.className = 'aviso' + (tipo ? ' ' + tipo : '');
}

async function iniciar() {
  try {
    const resp = await fetch('/config');
    const cfg = await resp.json();
    supa = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  } catch (e) {
    aviso('avisoLogin', 'Não foi possível carregar a configuração. O backend está rodando?', 'erro');
    return;
  }
  const { data } = await supa.auth.getSession();
  if (data.session) await aoEntrar();
}

async function entrar() {
  const email = el('email').value.trim();
  const senha = el('senha').value;
  if (!email || !senha) { aviso('avisoLogin', 'Preencha e-mail e senha.', 'erro'); return; }
  el('btnEntrar').disabled = true;
  aviso('avisoLogin', 'Entrando...');
  const { error } = await supa.auth.signInWithPassword({ email, password: senha });
  el('btnEntrar').disabled = false;
  if (error) { aviso('avisoLogin', 'Não foi possível entrar. Confira e-mail e senha.', 'erro'); return; }
  el('senha').value = '';
  await aoEntrar();
}

async function aoEntrar() {
  const { data: sessao } = await supa.auth.getSession();
  const authId = sessao.session.user.id;
  const { data: perfil, error } = await supa.from('usuarios').select('id, nome, casa_id').eq('auth_id', authId).single();
  if (error || !perfil) { aviso('avisoLogin', 'Login ok, mas não encontrei seu perfil.', 'erro'); return; }
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

function ligarTempoReal() {
  if (canalTempoReal) return;
  canalTempoReal = supa.channel('lifeos-casa')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lista_compras' }, () => { carregarLista(); carregarHoje(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque' }, () => { carregarEstoque(); carregarHoje(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contas' }, () => { carregarContas(); carregarHoje(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas' }, () => { carregarTarefas(); carregarHoje(); })
    .subscribe();
}

function desligarTempoReal() {
  if (canalTempoReal) { supa.removeChannel(canalTempoReal); canalTempoReal = null; }
}

async function sair() {
  desligarTempoReal();
  await supa.auth.signOut();
  usuario = null;
  el('quem').textContent = '';
  el('telaApp').classList.add('oculto');
  el('telaLogin').classList.remove('oculto');
}

// --- LISTA ---
async function carregarLista() {
  const { data: itens, error } = await supa.from('lista_compras')
    .select('id, nome, quantidade, unidade, categoria, criado_em, origem, estoque_id')
    .eq('casa_id', usuario.casa_id).eq('status', 'pendente').order('criado_em', { ascending: false });
  const area = el('itens');
  area.innerHTML = '';
  if (error) { area.innerHTML = '<div class="vazio">Erro ao carregar a lista.</div>'; return; }
  if (!itens || itens.length === 0) { area.innerHTML = '<div class="vazio">Nada pendente. Adicione um item acima.</div>'; return; }
  for (const item of itens) {
    const linha = document.createElement('div'); linha.className = 'item';
    const desc = document.createElement('div'); desc.className = 'desc';
    const nome = document.createElement('span'); nome.className = 'nome'; nome.textContent = item.nome;
    if (item.origem === 'sugestao_estoque') {
      const tag = document.createElement('span'); tag.className = 'badge';
      tag.style.background = '#8a6d3b'; tag.style.marginLeft = '8px'; tag.style.fontSize = '10px';
      tag.textContent = 'sugestão do estoque'; nome.appendChild(tag);
    }
    desc.appendChild(nome);
    const partes = [];
    if (item.quantidade) partes.push(item.quantidade + (item.unidade ? ' ' + item.unidade : ''));
    if (item.categoria) partes.push(item.categoria);
    if (partes.length) { const meta = document.createElement('span'); meta.className = 'meta'; meta.textContent = partes.join(' · '); desc.appendChild(meta); }
    const botao = document.createElement('button'); botao.textContent = 'Comprei'; botao.onclick = () => comprar(item, botao);
    linha.appendChild(desc); linha.appendChild(botao); area.appendChild(linha);
  }
}

async function adicionar() {
  const nome = el('novoItem').value.trim();
  if (!nome) { aviso('avisoAdd', 'Digite o nome do item.', 'erro'); return; }
  el('btnAdd').disabled = true;
  const { data, error } = await supa.from('lista_compras')
    .insert({ casa_id: usuario.casa_id, nome, status: 'pendente', criado_por: usuario.id }).select().single();
  if (data) supa.from('eventos').insert({ tipo: 'item_adicionado', entidade: 'lista_compras', entidade_id: data.id, usuario_id: usuario.id, detalhe: usuario.nome + ' adicionou ' + nome });
  el('btnAdd').disabled = false;
  if (error) { aviso('avisoAdd', 'Não foi possível adicionar.', 'erro'); return; }
  el('novoItem').value = '';
  aviso('avisoAdd', 'Adicionado.', 'ok');
  setTimeout(() => aviso('avisoAdd', ''), 1500);
  await carregarLista();
}

async function comprar(item, botao) {
  botao.disabled = true;
  let quantidadeComprada = null;
  if (item.estoque_id) {
    const resposta = prompt(`Quantas unidades de "${item.nome}" você comprou?\n(Isso vai repor o estoque)`, '1');
    if (resposta === null) { botao.disabled = false; return; }
    quantidadeComprada = Number(resposta);
    if (!isFinite(quantidadeComprada) || quantidadeComprada < 0) { alert('Quantidade inválida.'); botao.disabled = false; return; }
  }
  const { data, error } = await supa.from('lista_compras')
    .update({ status: 'comprado', comprado_por: usuario.id, comprado_em: new Date().toISOString() }).eq('id', item.id).select().single();
  if (data) supa.from('eventos').insert({ tipo: 'item_comprado', entidade: 'lista_compras', entidade_id: item.id, usuario_id: usuario.id, detalhe: usuario.nome + ' comprou ' + data.nome });
  if (error) { botao.disabled = false; return; }
  if (item.estoque_id && quantidadeComprada !== null) {
    const rep = await reporEstoque(supa, usuario, item.estoque_id, quantidadeComprada);
    if (rep.ok) {
      const { data: ie } = await supa.from('estoque').select('id, nome, categoria, quantidade, minimo, tipo, nivel, minimo_nivel').eq('id', item.estoque_id).single();
      if (ie) await sincronizarItem(supa, usuario, ie);
    }
    await carregarEstoque();
  }
  await carregarLista();
}

// --- ESTOQUE ---
function normalizarNome(nome) {
  return nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
}

async function carregarEstoque() {
  const { data: itens, error } = await supa.from('estoque')
    .select('id, nome, categoria, tipo, quantidade, unidade, minimo, nivel, minimo_nivel, local, critico')
    .eq('casa_id', usuario.casa_id).order('nome');
  const area = el('itensEstoque');
  area.innerHTML = '';
  if (error) { area.innerHTML = '<div class="vazio">Erro ao carregar o estoque.</div>'; return; }
  if (!itens || itens.length === 0) { area.innerHTML = '<div class="vazio">Nada no estoque ainda. Adicione acima.</div>'; return; }
  for (const item of itens) {
    const status = calcularStatus(item.quantidade, item.minimo, item.tipo, item.nivel, item.minimo_nivel);
    const info = rotuloStatus(status);
    const linha = document.createElement('div'); linha.className = 'item';
    const desc = document.createElement('div'); desc.className = 'desc';
    const nome = document.createElement('span'); nome.className = 'nome';
    nome.textContent = item.nome + (item.critico ? ' ⭐' : '');
    desc.appendChild(nome);
    const meta = document.createElement('span'); meta.className = 'meta';
    meta.textContent = (item.local ? item.local + ' · ' : '') + descricaoQuantidade(item);
    desc.appendChild(meta);
    const direita = document.createElement('div'); direita.className = 'est-controles';
    const badge = document.createElement('span'); badge.className = 'badge'; badge.style.background = info.cor; badge.textContent = info.texto;
    direita.appendChild(badge);
    if (item.tipo === 'nivel_visual') {
      const sel = document.createElement('select'); sel.className = 'sel'; sel.style.width = 'auto'; sel.style.padding = '6px 8px'; sel.style.fontSize = '13px';
      NIVEIS_VISUAL.forEach((n) => { const opt = document.createElement('option'); opt.value = n; opt.textContent = ROTULO_NIVEL[n]; if (n === item.nivel) opt.selected = true; sel.appendChild(opt); });
      sel.onchange = () => ajustarNivel(item, sel.value);
      direita.appendChild(sel);
    } else {
      const passo = item.tipo === 'peso_volume' ? 100 : 1;
      const btnM = document.createElement('button'); btnM.textContent = '−'; btnM.onclick = () => ajustarEstoque(item, -passo);
      const qtd = document.createElement('span'); qtd.className = 'est-qtd'; qtd.textContent = item.quantidade;
      const btnP = document.createElement('button'); btnP.textContent = '+'; btnP.onclick = () => ajustarEstoque(item, passo);
      direita.appendChild(btnM); direita.appendChild(qtd); direita.appendChild(btnP);
    }
    linha.appendChild(desc); linha.appendChild(direita); area.appendChild(linha);
  }
}

async function adicionarEstoque() {
  const nome = el('estNome').value.trim();
  const tipo = el('estTipo').value;
  if (!nome) { aviso('avisoEstoque', 'Digite o nome do item.', 'erro'); return; }
  const { data: existentes } = await supa.from('estoque').select('nome').eq('casa_id', usuario.casa_id);
  const nomeNorm = normalizarNome(nome);
  const dup = (existentes || []).find((i) => normalizarNome(i.nome) === nomeNorm);
  if (dup) { aviso('avisoEstoque', `Já existe "${dup.nome}" no estoque.`, 'erro'); return; }
  let payload = { casa_id: usuario.casa_id, nome, tipo, atualizado_por: usuario.id,
    local: el('estLocal').value || null, critico: el('estCritico').checked };
  if (tipo === 'contavel' || tipo === 'peso_volume') {
    const quantidade = Number(el('estQtd').value); const minimo = Number(el('estMin').value);
    if (!isFinite(quantidade) || !isFinite(minimo)) { aviso('avisoEstoque', 'Quantidade e mínimo precisam ser números.', 'erro'); return; }
    payload = { ...payload, quantidade, minimo, unidade: el('estUnidade').value.trim() || (tipo === 'peso_volume' ? 'g' : 'unidades') };
  } else if (tipo === 'nivel_visual') {
    payload = { ...payload, nivel: el('estNivelAtual').value, minimo_nivel: el('estNivelMin').value, quantidade: 0, minimo: 0 };
  }
  el('btnAddEstoque').disabled = true;
  const { data, error } = await supa.from('estoque').insert(payload).select().single();
  if (data) supa.from('eventos').insert({ tipo: 'estoque_item_criado', entidade: 'estoque', entidade_id: data.id, usuario_id: usuario.id, detalhe: usuario.nome + ' adicionou ' + nome + ' ao estoque' });
  el('btnAddEstoque').disabled = false;
  if (error) { aviso('avisoEstoque', 'Não foi possível adicionar.', 'erro'); return; }
  el('estNome').value = ''; el('estTipo').value = 'contavel'; el('estQtd').value = '0';
  el('estMin').value = '1'; el('estUnidade').value = ''; el('estLocal').value = '';
  el('estCritico').checked = false;
  el('estCamposNum').classList.remove('oculto'); el('estCamposNivel').classList.add('oculto');
  aviso('avisoEstoque', 'Adicionado.', 'ok'); setTimeout(() => aviso('avisoEstoque', ''), 1500);
  if (data) { await sincronizarItem(supa, usuario, data); await carregarLista(); }
  await carregarEstoque();
}

async function ajustarEstoque(item, delta) {
  const nova = Math.max(0, Number(item.quantidade) + delta);
  const { error } = await supa.from('estoque').update({ quantidade: nova, atualizado_por: usuario.id, atualizado_em: new Date().toISOString() }).eq('id', item.id);
  if (!error) {
    supa.from('eventos').insert({ tipo: 'estoque_ajustado', entidade: 'estoque', entidade_id: item.id, usuario_id: usuario.id, valor_anterior: { quantidade: item.quantidade }, valor_novo: { quantidade: nova }, detalhe: `${usuario.nome} ajustou ${item.nome} para ${nova}` });
    await sincronizarItem(supa, usuario, { ...item, quantidade: nova });
  }
  await carregarEstoque(); await carregarLista();
}

async function ajustarNivel(item, novoNivel) {
  const { error } = await supa.from('estoque').update({ nivel: novoNivel, atualizado_por: usuario.id, atualizado_em: new Date().toISOString() }).eq('id', item.id);
  if (!error) {
    supa.from('eventos').insert({ tipo: 'estoque_ajustado', entidade: 'estoque', entidade_id: item.id, usuario_id: usuario.id, valor_anterior: { nivel: item.nivel }, valor_novo: { nivel: novoNivel }, detalhe: `${usuario.nome} ajustou ${item.nome} para ${novoNivel}` });
    await sincronizarItem(supa, usuario, { ...item, nivel: novoNivel });
  }
  await carregarEstoque(); await carregarLista();
}

// --- INVENTARIO ---
let _invItens = []; let _invLocal = '';

async function abrirModalInventario() {
  el('invPassoLocal').classList.remove('oculto'); el('invPassoItens').classList.add('oculto');
  el('invLocal').value = ''; el('avisoInventario').textContent = '';
  el('modalInventario').classList.remove('oculto');
  el('modalInventario').classList.add('modal-aberto');
}

async function iniciarInventario() {
  const local = el('invLocal').value;
  if (!local) { aviso('avisoInventario', 'Escolha um ambiente.', 'erro'); return; }
  el('btnIniciarInventario').disabled = true; aviso('avisoInventario', 'Buscando itens...', '');
  const { itens } = await selecionarItensInventario(supa, usuario, local);
  el('btnIniciarInventario').disabled = false;
  if (itens.length === 0) { aviso('avisoInventario', 'Nenhum item precisa de conferência neste ambiente agora.', 'ok'); return; }
  _invItens = itens; _invLocal = local;
  el('invSubtitulo').textContent = `${local} — ${itens.length} ${itens.length === 1 ? 'item' : 'itens'}`;
  const area = el('invItens'); area.innerHTML = '';
  for (const item of itens) {
    const bloco = document.createElement('div'); bloco.style.cssText = 'padding:12px 0;border-bottom:1px solid var(--linha)';
    const topo = document.createElement('div'); topo.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:8px';
    const nome = document.createElement('span'); nome.className = 'nome'; nome.textContent = item.nome + (item.critico ? ' ⭐' : ''); topo.appendChild(nome);
    bloco.appendChild(topo);
    if (item.tipo === 'nivel_visual') {
      const sel = document.createElement('select'); sel.className = 'sel'; sel.dataset.itemId = item.id;
      NIVEIS_VISUAL.forEach((n) => { const opt = document.createElement('option'); opt.value = n; opt.textContent = ROTULO_NIVEL[n]; if (n === item.nivel) opt.selected = true; sel.appendChild(opt); });
      bloco.appendChild(sel);
    } else {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:8px';
      const inp = document.createElement('input'); inp.type = 'number'; inp.min = '0';
      inp.step = item.tipo === 'peso_volume' ? '100' : '1'; inp.value = item.quantidade;
      inp.dataset.itemId = item.id; inp.style.flex = '1';
      const un = document.createElement('span'); un.className = 'meta'; un.textContent = item.unidade || '';
      row.appendChild(inp); row.appendChild(un); bloco.appendChild(row);
    }
    area.appendChild(bloco);
  }
  el('invPassoLocal').classList.add('oculto'); el('invPassoItens').classList.remove('oculto');
}

async function concluirInventario() {
  el('btnConcluirInventario').disabled = true;
  for (const item of _invItens) {
    let novoValor;
    if (item.tipo === 'nivel_visual') { const sel = el('invItens').querySelector(`select[data-item-id="${item.id}"]`); novoValor = sel ? sel.value : item.nivel; }
    else { const inp = el('invItens').querySelector(`input[data-item-id="${item.id}"]`); novoValor = inp ? inp.value : item.quantidade; }
    await confirmarItemInventario(supa, usuario, item, novoValor);
  }
  await concluirSessaoInventario(supa, usuario, _invLocal, _invItens.length);
  el('btnConcluirInventario').disabled = false;
  el('modalInventario').classList.add('oculto');
  el('modalInventario').classList.remove('modal-aberto');
  await carregarEstoque(); await carregarLista();
}

// --- CONTAS ---
async function carregarContas() {
  const { data: contas, error } = await supa.from('contas')
    .select('id, nome, categoria, valor, vencimento, paga, recorrente, dia_vencimento')
    .eq('casa_id', usuario.casa_id).order('paga').order('vencimento');
  const area = el('itensContas'); area.innerHTML = '';
  if (error) { area.innerHTML = '<div class="vazio">Erro ao carregar as contas.</div>'; return; }
  if (!contas || contas.length === 0) { area.innerHTML = '<div class="vazio">Nenhuma conta cadastrada. Adicione acima.</div>'; return; }
  for (const conta of contas) {
    const status = calcularStatusConta(conta); const info = rotuloStatusConta(status);
    const linha = document.createElement('div'); linha.className = 'item';
    const desc = document.createElement('div'); desc.className = 'desc';
    const nome = document.createElement('span'); nome.className = 'nome';
    nome.textContent = conta.nome + (conta.recorrente ? ' ↻' : ''); desc.appendChild(nome);
    const venc = conta.vencimento.slice(0,10).split('-').reverse().join('/');
    const meta = document.createElement('span'); meta.className = 'meta';
    meta.textContent = `${formatarValor(conta.valor)} · vence ${venc}`; desc.appendChild(meta);
    const dir = document.createElement('div'); dir.className = 'est-controles';
    const badge = document.createElement('span'); badge.className = 'badge'; badge.style.background = info.cor; badge.textContent = info.texto; dir.appendChild(badge);
    if (!conta.paga) {
      const btn = document.createElement('button'); btn.textContent = 'Paguei'; btn.style.cssText = 'padding:7px 12px;font-size:13px'; btn.onclick = () => pagarConta(conta, btn); dir.appendChild(btn);
    }
    linha.appendChild(desc); linha.appendChild(dir); area.appendChild(linha);
  }
}

async function adicionarConta() {
  const nome = el('ctNome').value.trim(); const valorTexto = el('ctValor').value;
  const vencimento = el('ctVenc').value; const recorrente = el('ctRecorrente').checked;
  if (!nome) { aviso('avisoConta', 'Digite o nome da conta.', 'erro'); return; }
  if (!vencimento) { aviso('avisoConta', 'Escolha a data de vencimento.', 'erro'); return; }
  const valor = valorTexto === '' ? null : Number(valorTexto);
  const diaVenc = recorrente ? Number(vencimento.slice(8,10)) : null;
  el('btnAddConta').disabled = true;
  const { data, error } = await supa.from('contas').insert({ casa_id: usuario.casa_id, nome, valor, vencimento, recorrente, dia_vencimento: diaVenc, criada_por: usuario.id }).select().single();
  if (data) supa.from('eventos').insert({ tipo: 'conta_criada', entidade: 'contas', entidade_id: data.id, usuario_id: usuario.id, detalhe: usuario.nome + ' cadastrou ' + nome });
  el('btnAddConta').disabled = false;
  if (error) { aviso('avisoConta', 'Não foi possível adicionar.', 'erro'); return; }
  el('ctNome').value = ''; el('ctValor').value = ''; el('ctVenc').value = ''; el('ctRecorrente').checked = false;
  aviso('avisoConta', 'Conta adicionada.', 'ok'); setTimeout(() => aviso('avisoConta', ''), 1500);
  await carregarContas();
}

async function pagarConta(conta, botao) {
  botao.disabled = true;
  const { error } = await supa.from('contas').update({ paga: true, paga_em: new Date().toISOString() }).eq('id', conta.id);
  if (error) { botao.disabled = false; return; }
  supa.from('eventos').insert({ tipo: 'conta_paga', entidade: 'contas', entidade_id: conta.id, usuario_id: usuario.id, detalhe: usuario.nome + ' pagou ' + conta.nome });
  if (conta.recorrente && conta.dia_vencimento) {
    const quer = confirm(`"${conta.nome}" repete todo mês.\nCriar a conta do próximo mês agora?`);
    if (quer) {
      const base = new Date(conta.vencimento.slice(0,10) + 'T00:00:00');
      const prox = new Date(base.getFullYear(), base.getMonth() + 1, conta.dia_vencimento || base.getDate());
      const novoVenc = `${prox.getFullYear()}-${String(prox.getMonth()+1).padStart(2,'0')}-${String(prox.getDate()).padStart(2,'0')}`;
      await supa.from('contas').insert({ casa_id: usuario.casa_id, nome: conta.nome, categoria: conta.categoria, valor: conta.valor, vencimento: novoVenc, recorrente: true, dia_vencimento: conta.dia_vencimento, criada_por: usuario.id });
    }
  }
  await carregarContas();
}

// --- TAREFAS ---
async function carregarTarefas() {
  const { data: tarefas, error } = await supa.from('tarefas')
    .select('id, titulo, responsavel, prioridade, data, feita, recorrente, recorrencia')
    .eq('casa_id', usuario.casa_id).order('feita').order('data', { nullsFirst: true });
  const area = el('itensTarefas'); area.innerHTML = '';
  if (error) { area.innerHTML = '<div class="vazio">Erro ao carregar as tarefas.</div>'; return; }
  if (!tarefas || tarefas.length === 0) { area.innerHTML = '<div class="vazio">Nenhuma tarefa. Adicione acima.</div>'; return; }
  for (const tarefa of tarefas) {
    const linha = document.createElement('div'); linha.className = 'item' + (tarefa.feita ? ' concluida' : '');
    const check = document.createElement('div'); check.className = 'check-tarefa' + (tarefa.feita ? ' feita' : '');
    check.textContent = tarefa.feita ? '✓' : ''; check.onclick = () => alternarTarefa(tarefa);
    const desc = document.createElement('div'); desc.className = 'desc'; desc.style.cssText = 'flex:1;margin-left:12px';
    const nome = document.createElement('span'); nome.className = 'nome'; nome.textContent = tarefa.titulo; desc.appendChild(nome);
    const quem = tarefa.responsavel === 'ambos' ? 'Ambos' : tarefa.responsavel.charAt(0).toUpperCase() + tarefa.responsavel.slice(1);
    const partes = [quem];
    if (tarefa.recorrente && tarefa.recorrencia) partes.push(tarefa.recorrencia);
    if (tarefa.data) partes.push(tarefa.data.slice(0,10).split('-').reverse().join('/'));
    const meta = document.createElement('span'); meta.className = 'meta'; meta.textContent = partes.join(' · '); desc.appendChild(meta);
    const btnRem = document.createElement('button'); btnRem.textContent = '×'; btnRem.title = 'Remover';
    btnRem.style.cssText = 'background:none;color:var(--suave);padding:4px 8px'; btnRem.onclick = () => removerTarefa(tarefa.id);
    const esq = document.createElement('div'); esq.style.cssText = 'display:flex;align-items:center;flex:1';
    esq.appendChild(check); esq.appendChild(desc);
    linha.appendChild(esq); linha.appendChild(btnRem); area.appendChild(linha);
  }
}

async function adicionarTarefa() {
  const titulo = el('tfTitulo').value.trim();
  if (!titulo) { aviso('avisoTarefa', 'Digite o título da tarefa.', 'erro'); return; }
  const responsavel = el('tfResp').value; const data = el('tfData').value || null;
  const recorrente = el('tfRecorrente').checked; const recorrencia = recorrente ? (el('tfRecorrencia').value.trim() || null) : null;
  el('btnAddTarefa').disabled = true;
  const { data: nova, error } = await supa.from('tarefas').insert({ casa_id: usuario.casa_id, titulo, responsavel, data, recorrente, recorrencia, criada_por: usuario.id }).select().single();
  if (nova) supa.from('eventos').insert({ tipo: 'tarefa_criada', entidade: 'tarefas', entidade_id: nova.id, usuario_id: usuario.id, detalhe: usuario.nome + ' criou ' + titulo });
  el('btnAddTarefa').disabled = false;
  if (error) { aviso('avisoTarefa', 'Não foi possível adicionar.', 'erro'); return; }
  el('tfTitulo').value = ''; el('tfData').value = ''; el('tfRecorrente').checked = false;
  el('tfRecorrencia').value = ''; el('tfRecorrenciaBox').classList.add('oculto');
  aviso('avisoTarefa', 'Tarefa adicionada.', 'ok'); setTimeout(() => aviso('avisoTarefa', ''), 1500);
  await carregarTarefas();
}

async function alternarTarefa(tarefa) {
  const novoEstado = !tarefa.feita;
  const { error } = await supa.from('tarefas').update({ feita: novoEstado, feita_por: novoEstado ? usuario.id : null, feita_em: novoEstado ? new Date().toISOString() : null }).eq('id', tarefa.id);
  if (error) return;
  supa.from('eventos').insert({ tipo: novoEstado ? 'tarefa_concluida' : 'tarefa_reaberta', entidade: 'tarefas', entidade_id: tarefa.id, usuario_id: usuario.id, detalhe: `${usuario.nome} ${novoEstado ? 'concluiu' : 'reabriu'} ${tarefa.titulo}` });
  if (novoEstado && tarefa.recorrente) {
    const quer = confirm(`"${tarefa.titulo}" é uma rotina.\nCriar a próxima ocorrência?`);
    if (quer) await supa.from('tarefas').insert({ casa_id: usuario.casa_id, titulo: tarefa.titulo, responsavel: tarefa.responsavel, prioridade: tarefa.prioridade, recorrente: true, recorrencia: tarefa.recorrencia, criada_por: usuario.id });
  }
  await carregarTarefas();
}

async function removerTarefa(tarefaId) {
  const { error } = await supa.from('tarefas').delete().eq('id', tarefaId);
  if (!error) { supa.from('eventos').insert({ tipo: 'tarefa_removida', entidade: 'tarefas', entidade_id: tarefaId, usuario_id: usuario.id, detalhe: usuario.nome + ' removeu uma tarefa' }); await carregarTarefas(); }
}

// --- HOJE ---
async function carregarHoje() {
  el('saudacao').textContent = saudacao(usuario.nome);
  const dados = await montarHoje(supa, usuario);
  const area = el('cardsHoje'); area.innerHTML = '';
  if (dados.tudoEmDia) { const c = document.createElement('div'); c.className = 'cartao'; c.innerHTML = '<div class="tudo-em-dia">Tudo em dia por aqui. ✨</div>'; area.appendChild(c); return; }
  if (dados.contasAtencao.length > 0) {
    const card = criarCartaoHoje('Contas próximas', 'contas');
    for (const c of dados.contasAtencao) {
      const quando = c.status === 'vencida' ? 'venceu' : c.status === 'vence_hoje' ? 'vence hoje' : `vence em ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'}`;
      card.corpo.appendChild(miniItem(c.nome, quando, formatarValor(c.valor)));
    }
    area.appendChild(card.cartao);
  }
  if (dados.tarefasAtencao && dados.tarefasAtencao.length > 0) {
    const card = criarCartaoHoje('Tarefas da Casa', 'tarefas');
    for (const t of dados.tarefasAtencao) {
      const quem = t.responsavel === 'ambos' ? 'Ambos' : t.responsavel.charAt(0).toUpperCase() + t.responsavel.slice(1);
      card.corpo.appendChild(miniItem(t.titulo, quem, ''));
    }
    area.appendChild(card.cartao);
  }
  if (dados.estoqueAtencao.length > 0) {
    const card = criarCartaoHoje('Estoque em atenção', 'estoque');
    for (const item of dados.estoqueAtencao) { card.corpo.appendChild(miniItem(item.nome, `${item.quantidade} · ${item.status === 'acabou' ? 'acabou' : 'baixo'}`, '')); }
    area.appendChild(card.cartao);
  }
  if (dados.compras.total > 0) {
    const card = criarCartaoHoje('Compras', 'compras');
    for (const nome of dados.compras.primeiros) card.corpo.appendChild(miniItem(nome, '', ''));
    if (dados.compras.total > dados.compras.primeiros.length) { const r = document.createElement('div'); r.className = 'mini-item'; r.style.color = 'var(--suave)'; r.textContent = `+ mais ${dados.compras.total - dados.compras.primeiros.length} na lista`; card.corpo.appendChild(r); }
    if (dados.compras.sugestoes > 0) { const s = document.createElement('div'); s.className = 'mini-item'; s.style.color = 'var(--acao)'; s.style.fontSize = '12px'; s.textContent = `${dados.compras.sugestoes} ${dados.compras.sugestoes === 1 ? 'sugestão' : 'sugestões'} do estoque`; card.corpo.appendChild(s); }
    area.appendChild(card.cartao);
  }
}

function criarCartaoHoje(titulo, abaDestino) {
  const cartao = document.createElement('div'); cartao.className = 'cartao card-clicavel';
  const cab = document.createElement('div'); cab.className = 'card-hoje-titulo';
  const t = document.createElement('div'); t.className = 'titulo-secao'; t.textContent = titulo;
  const abrir = document.createElement('span'); abrir.className = 'abrir'; abrir.textContent = 'Abrir';
  cab.appendChild(t); cab.appendChild(abrir);
  const corpo = document.createElement('div');
  cartao.appendChild(cab); cartao.appendChild(corpo);
  cartao.onclick = () => trocarAba(abaDestino);
  return { cartao, corpo };
}

function miniItem(nome, meta, valor) {
  const linha = document.createElement('div'); linha.className = 'mini-item';
  const esq = document.createElement('span'); esq.textContent = nome;
  const dir = document.createElement('span'); dir.className = 'm-meta'; dir.textContent = [meta, valor].filter(Boolean).join('  ');
  linha.appendChild(esq); linha.appendChild(dir); return linha;
}

// --- NAVEGACAO ---
function trocarAba(qual) {
  ['abaHoje','abaCompras','abaEstoque','abaTarefas','abaContas'].forEach((id) => el(id).classList.toggle('oculto', id !== 'aba' + qual.charAt(0).toUpperCase() + qual.slice(1)));
  document.querySelectorAll('.aba').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === qual));
  if (qual === 'hoje' && usuario) carregarHoje();
}

// --- EVENTOS ---
el('btnEntrar').onclick = entrar;
el('senha').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });
el('btnAdd').onclick = adicionar;
el('novoItem').addEventListener('keydown', (e) => { if (e.key === 'Enter') adicionar(); });
el('btnAddEstoque').onclick = adicionarEstoque;
el('estTipo').addEventListener('change', (e) => {
  const t = e.target.value;
  el('estCamposNum').classList.toggle('oculto', t === 'nivel_visual');
  el('estCamposNivel').classList.toggle('oculto', t !== 'nivel_visual');
});
el('btnInventario').onclick = abrirModalInventario;
el('btnFecharInventario').onclick = () => { el('modalInventario').classList.add('oculto'); el('modalInventario').classList.remove('modal-aberto'); };
el('btnIniciarInventario').onclick = iniciarInventario;
el('btnConcluirInventario').onclick = concluirInventario;
el('btnVoltarLocal').onclick = () => { el('invPassoItens').classList.add('oculto'); el('invPassoLocal').classList.remove('oculto'); };
el('btnAddTarefa').onclick = adicionarTarefa;
el('tfRecorrente').addEventListener('change', (e) => el('tfRecorrenciaBox').classList.toggle('oculto', !e.target.checked));
el('btnAddConta').onclick = adicionarConta;
el('btnSair').onclick = sair;
document.querySelectorAll('.aba').forEach((b) => { b.onclick = () => trocarAba(b.dataset.aba); });

iniciar();
