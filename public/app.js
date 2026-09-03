// app.js — LifeOS v0.18.0
import { calcularStatus, rotuloStatus, descricaoQuantidade, NIVEIS_VISUAL, ROTULO_NIVEL } from './status-estoque.js?v=2';
import { sincronizarItem, reporEstoque } from './ponte-estoque.js';
import { calcularStatusConta, rotuloStatusConta, formatarValor } from './status-conta.js';
import { excluirContaPorId } from './contas.js';
import { saudacao, montarHoje, inicioSemana, formatarDataISO } from './hoje.js';
import { selecionarItensInventario, confirmarItemInventario, concluirSessaoInventario } from './inventario.js';
import { diasRestantes, statusConsumo, labelConsumo, gerarSugestoesConsumo } from './consumo-estoque.js';
import { carregarPlantas, carregarEspecies, cadastrarPlanta, editarRotina, urgenciaPlanta, COR_URGENCIA, COR_PERFIL, registrarCuidado, registrarCuidadoManual, removerPlanta, contarUrgentes } from './plantas.js';
import './alimentacao-contextual-mobile-fix.js?v=2';
import './receitas-v2.js?v=2';

let supa=null,usuario=null,canalTempoReal=null;
let _plantasCache=[];
let _filtroAtual='todas';
let _contaHistAtual=null;
let _plantaAberta=null;
let _plantaEditando=null;
let _especies=[];
const el=(id)=>document.getElementById(id);
const escapeHtml=(valor='')=>String(valor)
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'",'&#039;');

// Ícones vetoriais da interface. Mantidos aqui para substituir emojis
// sem depender de fonte, sistema operacional ou biblioteca externa.
const ICONES_SVG={
  estrela:'<path d="m12 2.6 2.82 5.72 6.31.92-4.56 4.44 1.08 6.28L12 17l-5.65 2.96 1.08-6.28-4.56-4.44 6.31-.92L12 2.6Z"/>',
  atualizar:'<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/>',
  balde:'<path d="M5 8h14l-1.2 11H6.2L5 8Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/><path d="M4 8h16"/>',
  gota:'<path d="M12 2.7S6.5 9 6.5 14a5.5 5.5 0 0 0 11 0c0-5-5.5-11.3-5.5-11.3Z"/>',
  broto:'<path d="M12 22V12"/><path d="M12 15c-4.5 0-7-2.3-7-6 4.5 0 7 2.3 7 6Z"/><path d="M12 12c4.5 0 7-2.3 7-6-4.5 0-7 2.3-7 6Z"/>',
  tesoura:'<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="m8.7 8.3 11.3 7.2M8.7 15.7 20 8.5"/>',
  anotacao:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  cadeado:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  prancheta:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M9 9h6M9 13h6M9 17h4"/>',
  repetir:'<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  cartao:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  carrinho:'<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.2 10h10.6l2-7H6"/>',
  caixa:'<path d="m3 7 9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
  refeicao:'<path d="M4 3v7a3 3 0 0 0 3 3h1V3M8 3v10M18 3v18M15 8c0-3 1-5 3-5v10h-3Z"/>',
};
function iconeSvg(nome,tamanho=16,classe='icone-svg'){
  const conteudo=ICONES_SVG[nome];
  if(!conteudo)return'';
  return `<svg class="${classe}" viewBox="0 0 24 24" width="${tamanho}" height="${tamanho}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="display:inline-block;flex:none;vertical-align:-0.15em">${conteudo}</svg>`;
}
function conteudoComIcone(nome,texto,tamanho=15){
  return `${iconeSvg(nome,tamanho)}<span>${texto}</span>`;
}
function aviso(id,t,tipo=''){const a=el(id);if(!a)return;a.textContent=t||'';a.className='aviso'+(tipo?' '+tipo:'');}
function abrirModal(id){const m=el(id);if(m){m.dataset.uiDirty='0';m.classList.add('aberto');}}
function fecharModal(id){const m=el(id);if(m){m.dataset.uiDirty='0';m.classList.remove('aberto');}}

async function iniciar(){
  try{const r=await fetch('/config');const c=await r.json();supa=window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey);}
  catch(e){aviso('avisoLogin','Não foi possível carregar a configuração.','erro');return;}
  const{data}=await supa.auth.getSession();if(data.session)await aoEntrar();
}

async function entrar(){
  const email=el('email').value.trim(),senha=el('senha').value;
  if(!email||!senha){aviso('avisoLogin','Preencha e-mail e senha.','erro');return;}
  el('btnEntrar').disabled=true;aviso('avisoLogin','Entrando...');
  const{error}=await supa.auth.signInWithPassword({email,password:senha});
  el('btnEntrar').disabled=false;
  if(error){aviso('avisoLogin','Não foi possível entrar.','erro');return;}
  el('senha').value='';await aoEntrar();
}

async function aoEntrar(){
  const{data:s}=await supa.auth.getSession();
  const{data:p,error}=await supa.from('usuarios').select('id,nome,casa_id').eq('auth_id',s.session.user.id).single();
  if(error||!p){aviso('avisoLogin','Perfil não encontrado.','erro');return;}
  usuario=p;
  window.lifeosContext={supa,usuario};window.dispatchEvent(new CustomEvent('lifeos:ready'));
  // Atualizar header avatar
  const av=el('headerAvatar');if(av)av.textContent=p.nome.charAt(0).toUpperCase();
  // Atualizar data/hora/clima no Hoje
  atualizarDataHoje();carregarClimaHoje();
  el('telaLogin').style.display='none';el('telaApp').style.display='flex';aviso('avisoLogin','');
  await Promise.allSettled([carregarHoje(),carregarLista(),carregarEstoque(),carregarTarefas(),carregarContas(),carregarRefeicoes(),carregarPlanejamento(),carregarRituais(),atualizarPlantas(),carregarProjetos()]);
  const moduloSolicitado=new URLSearchParams(window.location.search).get('modulo');
  if(moduloSolicitado==='ritmo')abrirRitmoContextual();
  else if(['financeiro','plantas','mais','hoje'].includes(moduloSolicitado))trocarAba(moduloSolicitado);
  if(moduloSolicitado)history.replaceState(null,'',window.location.pathname);
  carregarLocaisEstoque();
  ligarTempoReal();
}

function ligarTempoReal(){
  if(canalTempoReal)return;
  canalTempoReal=supa.channel('lifeos-casa')
    .on('postgres_changes',{event:'*',schema:'public',table:'lista_compras'},()=>{carregarLista();carregarHoje();})
    .on('postgres_changes',{event:'*',schema:'public',table:'estoque'},()=>{carregarEstoque();carregarHoje();})
    .on('postgres_changes',{event:'*',schema:'public',table:'contas'},()=>{carregarContas();carregarHoje();})
    .on('postgres_changes',{event:'*',schema:'public',table:'tarefas'},()=>{carregarTarefas();carregarHoje();})
    .on('postgres_changes',{event:'*',schema:'public',table:'planejamento_dias'},()=>{carregarPlanejamento();carregarHoje();})
    .on('postgres_changes',{event:'*',schema:'public',table:'ritual_sessoes'},()=>{carregarRituais();})
    .on('postgres_changes',{event:'*',schema:'public',table:'planta_rotinas'},()=>{atualizarPlantas();carregarHoje();})
    .subscribe();
}

async function sair(){
  if(canalTempoReal){supa.removeChannel(canalTempoReal);canalTempoReal=null;}
  await supa.auth.signOut();usuario=null;
  el('quem')&&(el('quem').textContent='');el('telaApp').style.display='none';el('telaLogin').style.display='flex';
}

// Mapeamento das abas principais
const ABAS_PRINCIPAIS=['abaHoje','abaCasa','abaFinanceiro','abaPlantas','abaMais'];
const SECOES_MAIS=['secaoRitmo','secaoProjetos','secaoRituais','secaoConfig','abaPainelProjeto'];
const _origensAba = new Map();

const CASA_TITULOS = {
  compras: ['Compras', 'Lista e compras da Casa.'],
  estoque: ['Estoque', 'O que tem em casa, níveis e reposição.'],
  tarefas: ['Tarefas', 'Tarefas e responsabilidades da Casa.'],
  contas: ['Contas', 'Contas recorrentes e próximos vencimentos.'],
  cardapio: ['Cardápio', 'Receitas e planejamento das refeições.'],
};

// ---- DATA, HORA e CLIMA ----
function atualizarDataHoje(){
  const agora=new Date();
  const h=agora.getHours();
  const periodo=h>=5&&h<12?'Bom dia':h>=12&&h<18?'Boa tarde':'Boa noite';
  const meses=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const dias=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const data=`${dias[agora.getDay()]}, ${agora.getDate()} de ${meses[agora.getMonth()]}`;
  const gp=el('greetingPeriodo');if(gp)gp.textContent=periodo;
  const gn=el('greetingNome');if(gn&&usuario)gn.textContent=`Olá, ${usuario.nome}.`;
  const dh=el('dataHoje');if(dh)dh.textContent=data;
}

const CLIMA_MOBILE_DIRETO_URL='https://api.open-meteo.com/v1/forecast?latitude=-22.8269&longitude=-43.0539&current=temperature_2m,weather_code,wind_speed_10m&forecast_days=1&timezone=America%2FSao_Paulo';
const CLIMA_MOBILE_CACHE_KEY='lifeos:clima:ultimo';
const CLIMA_MOBILE_CACHE_MAX_MS=6*60*60*1000;
const CLIMA_MOBILE_DESCRICOES={0:'Céu limpo',1:'Principalmente limpo',2:'Parcialmente nublado',3:'Nublado',45:'Neblina',48:'Neblina com geada',51:'Garoa leve',53:'Garoa moderada',55:'Garoa intensa',61:'Chuva leve',63:'Chuva moderada',65:'Chuva forte',71:'Neve leve',73:'Neve moderada',75:'Neve forte',80:'Pancadas de chuva leves',81:'Pancadas de chuva moderadas',82:'Pancadas de chuva fortes',95:'Trovoada',96:'Trovoada com granizo',99:'Trovoada com granizo forte'};

function climaMobileValido(clima){return Number.isFinite(Number(clima?.temperatura));}
function lerClimaMobileLocal(){
  try{
    const registro=JSON.parse(localStorage.getItem(CLIMA_MOBILE_CACHE_KEY)||'null');
    const idade=Date.now()-Number(registro?.salvo_em||0);
    return idade>=0&&idade<=CLIMA_MOBILE_CACHE_MAX_MS&&climaMobileValido(registro?.clima)?registro.clima:null;
  }catch{return null;}
}
function salvarClimaMobileLocal(clima){
  if(!climaMobileValido(clima))return;
  try{localStorage.setItem(CLIMA_MOBILE_CACHE_KEY,JSON.stringify({salvo_em:Date.now(),clima}));}catch{}
}
function converterClimaMobileDireto(dados){
  const atual=dados?.current||{};
  const temperatura=Number(atual.temperature_2m);
  const codigo=Number(atual.weather_code);
  if(!Number.isFinite(temperatura)||!Number.isFinite(codigo))return null;
  return{temperatura:Math.round(temperatura),descricao:CLIMA_MOBILE_DESCRICOES[codigo]||'Tempo variável'};
}
async function carregarClimaHoje(){
  const cr=el('climaResumido');if(!cr)return;
  let clima=null;
  try{
    const direto=await fetch(CLIMA_MOBILE_DIRETO_URL,{cache:'no-store',headers:{accept:'application/json'}});
    if(direto.ok)clima=converterClimaMobileDireto(await direto.json());
  }catch{}
  if(!clima){
    try{
      const backend=await fetch('/clima',{cache:'no-store'});
      if(backend.ok){const recebido=await backend.json();if(climaMobileValido(recebido))clima=recebido;}
    }catch{}
  }
  if(!clima)clima=lerClimaMobileLocal();
  if(climaMobileValido(clima)){
    salvarClimaMobileLocal(clima);
    cr.textContent=Math.round(Number(clima.temperatura))+'° · '+(clima.descricao||'Tempo variável');
  }else cr.textContent='Clima indisponível';
}

async function confirmarAcao(titulo,mensagem,{confirmLabel='Confirmar',danger=false}={}){
  if(typeof window.lifeosConfirmAction==='function')return window.lifeosConfirmAction({title,message:mensagem,confirmLabel,danger});
  return confirm(mensagem);
}
function trocarAba(qual,btn,opcoes={}){
  const { registrarOrigem = true } = opcoes;
  if(registrarOrigem){
    const atual=localizacaoAtual?.() || null;
    const destinoAtual=atual?.tipo==='tab' && atual.tab===qual;
    const destinoCasa=qual==='casa' && atual?.tipo==='casa';
    if(atual && !destinoAtual && !destinoCasa) _origensAba.set(qual,atual);
  }
  // Esconde todas as abas e seções
  [...ABAS_PRINCIPAIS,...SECOES_MAIS].forEach(id=>{
    const e=el(id);if(e){e.style.display='none';e.classList.add('oculto');}
  });
  const id='aba'+qual.charAt(0).toUpperCase()+qual.slice(1);
  const alvo=el(id);if(alvo){alvo.style.display='block';alvo.classList.remove('oculto');}
  const origemCasa=qual==='casa'?_origensAba.get('casa'):null;
  const tabAtiva=qual==='casa'
    ? (origemCasa?.tipo==='tab' ? origemCasa.tab : origemCasa?.tipo==='secao' && origemCasa.secao==='ritmo' ? 'ritmo' : origemCasa?.tipo==='secao' ? 'mais' : 'hoje')
    : qual;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('ativa',b.dataset.tab===tabAtiva));
  const body=el('appBody');if(body)body.scrollTop=0;
  if(qual==='hoje'&&usuario)carregarHoje();
  if(qual==='financeiro'&&usuario)window.dispatchEvent(new CustomEvent('lifeos:financeiro-abrir'));
  if(qual==='plantas'&&usuario)renderizarPlantas();
}

function abrirRitmoContextual(){
  abrirSecao('ritmo');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('ativa',b.dataset.tab==='ritmo'));
}

function voltarParaLocalizacao(origem){
  if(origem?.tipo==='casa'){
    trocarAba('casa',null,{registrarOrigem:false});
    requestAnimationFrame(()=>trocarSub(origem.sub,document.querySelector(`.sub-aba[data-sub="${origem.sub}"]`)));
    return;
  }
  if(origem?.tipo==='tab'){
    trocarAba(origem.tab,null,{registrarOrigem:false});
    return;
  }
  if(origem?.tipo==='secao'){
    abrirSecao(origem.secao,{preservarOrigem:true});
    return;
  }
  trocarAba('hoje',null,{registrarOrigem:false});
}

function voltarAbaContextual(qual){
  voltarParaLocalizacao(_origensAba.get(qual));
}

function voltarCasaContextual(){
  voltarAbaContextual('casa');
}

function trocarSub(qual,btn){
  document.querySelectorAll('.sub-conteudo').forEach(s=>{s.style.display='none';s.classList.add('oculto');});
  const alvo=el('sub'+qual.charAt(0).toUpperCase()+qual.slice(1));
  if(alvo){alvo.style.display='block';alvo.classList.remove('oculto');}
  document.querySelectorAll('.sub-aba').forEach(b=>b.classList.toggle('ativa',b.dataset.sub===qual));
  const [titulo,descricao]=CASA_TITULOS[qual]||['Casa','Organização da Casa'];
  if(el('casaPageTitle'))el('casaPageTitle').textContent=titulo;
  if(el('casaPageDescription'))el('casaPageDescription').textContent=descricao;
}

const _origensSecao = new Map();

function localizacaoAtual(){
  for(const id of SECOES_MAIS){
    const node=el(id);
    if(node && node.style.display!=='none' && !node.classList.contains('oculto')){
      if(id==='abaPainelProjeto') return {tipo:'painel-projeto'};
      return {tipo:'secao',secao:id.replace(/^secao/,'').toLowerCase()};
    }
  }
  for(const id of ABAS_PRINCIPAIS){
    const node=el(id);
    if(node && node.style.display!=='none' && !node.classList.contains('oculto')){
      const tab=id.replace(/^aba/,'').toLowerCase();
      if(tab==='casa'){
        const sub=[...document.querySelectorAll('.sub-aba[data-sub]')].find(b=>b.classList.contains('ativa'))?.dataset.sub || 'compras';
        return {tipo:'casa',sub};
      }
      return {tipo:'tab',tab};
    }
  }
  return {tipo:'tab',tab:'hoje'};
}

function abrirSecao(qual,{preservarOrigem=false}={}){
  if(!preservarOrigem){
    const atual=localizacaoAtual();
    const mesmaSecao=atual.tipo==='secao' && atual.secao===qual;
    if(!mesmaSecao) _origensSecao.set(qual,atual);
  }
  [...ABAS_PRINCIPAIS,...SECOES_MAIS].forEach(id=>{
    const e=el(id);if(e){e.style.display='none';e.classList.add('oculto');}
  });
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('ativa'));
  const secao=el('secao'+qual.charAt(0).toUpperCase()+qual.slice(1));
  if(secao){secao.style.display='block';secao.classList.remove('oculto');}
  const body=el('appBody');if(body)body.scrollTop=0;
  // Carregar dados da seção
  if(qual==='ritmo')window.dispatchEvent(new CustomEvent('lifeos:ritmo-abrir'));
  if(qual==='projetos')carregarProjetos();
  if(qual==='rituais')carregarRituais();
  if(qual==='config'){carregarTokens();carregarLocaisEstoque();carregarLocaisCompraConfig();carregarHistoricoExcluidos('todos');}
}

function voltarContexto(){
  const atual=localizacaoAtual();
  const qual=atual.tipo==='secao' ? atual.secao : null;
  const origem=qual ? _origensSecao.get(qual) : null;
  voltarParaLocalizacao(origem || (qual==='ritmo' ? {tipo:'tab',tab:'hoje'} : {tipo:'tab',tab:'mais'}));
}

function voltarMais(){
  [...SECOES_MAIS].forEach(id=>{
    const e=el(id);if(e){e.style.display='none';e.classList.add('oculto');}
  });
  const mais=el('abaMais');if(mais){mais.style.display='block';mais.classList.remove('oculto');}
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('ativa',b.dataset.tab==='mais'));
  const body=el('appBody');if(body)body.scrollTop=0;
}

// --- LISTA ---
async function carregarLista(){
  const{data:itens,error}=await supa.from('lista_compras').select('id,nome,quantidade,unidade,categoria,criado_em,origem,estoque_id,ciclo_compra').eq('casa_id',usuario.casa_id).eq('status','pendente').order('criado_em',{ascending:false});
  const area=el('itens');area.innerHTML='';
  if(error){area.innerHTML='<div class="vazio">Erro ao carregar.</div>';return;}
  if(!itens||!itens.length){area.innerHTML='<div class="vazio">Nada pendente.</div>';return;}
  let cicloAnterior=null;
  const ordenados=[...itens].sort((a,b)=>{
    const ordem={semanal:0,mensal:1};
    return (ordem[a.ciclo_compra||'semanal']??0)-(ordem[b.ciclo_compra||'semanal']??0)
      || new Date(b.criado_em)-new Date(a.criado_em);
  });
  for(const item of ordenados){
    const ciclo=item.ciclo_compra||'semanal';
    if(ciclo!==cicloAnterior){
      const h=document.createElement('div');
      h.style.cssText='font-size:11px;font-weight:700;color:var(--muted);padding:10px 2px 6px;text-transform:uppercase;letter-spacing:.04em';
      h.textContent=ciclo==='mensal'?'Compra do mês':'Compra semanal';
      area.appendChild(h);
      cicloAnterior=ciclo;
    }
    const l=document.createElement('div');l.className='item';
    const d=document.createElement('div');d.className='desc';
    const n=document.createElement('span');n.className='nome';n.textContent=item.nome;
    if(item.origem==='sugestao_estoque'||item.origem==='cardapio'||item.origem==='sugestao_consumo'){const t=document.createElement('span');t.className='badge';t.style.background=item.origem==='cardapio'?'#5b6e9e':item.origem==='sugestao_consumo'?'#b23c3c':'#8a6d3b';t.style.cssText+='margin-left:8px;font-size:10px';t.textContent=item.origem==='cardapio'?'cardápio':item.origem==='sugestao_consumo'?'consumo':'sugestão estoque';n.appendChild(t);}
    d.appendChild(n);
    const ps=[];if(item.quantidade)ps.push(item.quantidade+(item.unidade?' '+item.unidade:''));if(item.categoria)ps.push(item.categoria);
    if(ps.length){const m=document.createElement('span');m.className='meta';m.textContent=ps.join(' · ');d.appendChild(m);}
    const acoes=document.createElement('div');acoes.style.cssText='display:flex;gap:2px;align-items:center';
    const btnComprei=document.createElement('button');btnComprei.textContent='Comprei';btnComprei.onclick=()=>comprar(item,btnComprei);
    const btnEditL=document.createElement('button');btnEditL.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;btnEditL.title='Editar';btnEditL.style.cssText='background:none;color:var(--suave);padding:4px 6px;font-size:13px';btnEditL.onclick=()=>abrirEditarLista(item);
    const btnDelL=document.createElement('button');btnDelL.textContent='×';btnDelL.dataset.uiAction='delete';btnDelL.setAttribute('aria-label','Excluir item');btnDelL.style.cssText='background:none;color:var(--suave);padding:4px 6px';btnDelL.onclick=()=>removerItemLista(item);
    acoes.appendChild(btnComprei);acoes.appendChild(btnEditL);acoes.appendChild(btnDelL);
    l.appendChild(d);l.appendChild(acoes);area.appendChild(l);
  }
}

function abrirEditarLista(item){
  _listaEditando=item;
  el('elNome').value=item.nome||'';
  el('elQtd').value=item.quantidade??'';
  el('elUnidade').value=item.unidade||'';
  if(el('elCicloCompra'))el('elCicloCompra').value=item.ciclo_compra||'semanal';
  aviso('avisoEditarLista','');
  abrirModal('modalEditarLista');
}

async function salvarEditarLista(){
  if(!_listaEditando)return;
  const nome=el('elNome').value.trim();
  if(!nome){aviso('avisoEditarLista','Digite o nome.','erro');return;}
  el('btnSalvarEditarLista').disabled=true;
  const qtd=el('elQtd').value?Number(el('elQtd').value):null;
  const{error}=await supa.from('lista_compras').update({
    nome,quantidade:qtd,unidade:el('elUnidade').value.trim()||null,
    ciclo_compra:el('elCicloCompra')?.value||'semanal',
  }).eq('id',_listaEditando.id);
  el('btnSalvarEditarLista').disabled=false;
  if(error){aviso('avisoEditarLista','Erro ao salvar.','erro');return;}
  fecharModal('modalEditarLista');
  _listaEditando=null;
  await carregarLista();
}

async function removerItemLista(item){
  if(!await confirmarAcao('Remover item',`Remover "${item.nome}" da lista?`,{confirmLabel:'Remover',danger:true}))return;
  const{error}=await supa.from('lista_compras').delete().eq('id',item.id);
  if(!error){
    supa.from('historico_excluidos').insert({
      casa_id:usuario.casa_id,usuario_id:usuario.id,
      modulo:'lista_compras',registro_id:item.id,dados:item,
    });
    await carregarLista();
  }
}

async function adicionar(){
  const nome=el('novoItem').value.trim();if(!nome){aviso('avisoAdd','Digite o nome.','erro');return;}
  const destinoCompraId=el('novoItemDestino')?.value||null;
  el('btnAdd').disabled=true;
  const payload={casa_id:usuario.casa_id,nome,status:'pendente',criado_por:usuario.id,ciclo_compra:el('novoItemCiclo')?.value||'semanal'};
  if(destinoCompraId)payload.destino_compra_id=destinoCompraId;
  const{data,error}=await supa.from('lista_compras').insert(payload).select().single();
  if(data)supa.from('eventos').insert({tipo:'item_adicionado',entidade:'lista_compras',entidade_id:data.id,usuario_id:usuario.id,detalhe:usuario.nome+' adicionou '+nome});
  el('btnAdd').disabled=false;
  if(error){aviso('avisoAdd','Erro.','erro');return;}
  el('novoItem').value='';aviso('avisoAdd','Adicionado.','ok');setTimeout(()=>aviso('avisoAdd',''),1500);await carregarLista();
}

async function comprar(item,botao){
  botao.disabled=true;let qc=null;
  if(item.estoque_id){const r=prompt(`Quantas unidades de "${item.nome}" você comprou?`,'1');if(r===null){botao.disabled=false;return;}qc=Number(r);if(!isFinite(qc)||qc<0){alert('Quantidade inválida.');botao.disabled=false;return;}}
  const{data,error}=await supa.from('lista_compras').update({status:'comprado',comprado_por:usuario.id,comprado_em:new Date().toISOString()}).eq('id',item.id).select().single();
  if(data)supa.from('eventos').insert({tipo:'item_comprado',entidade:'lista_compras',entidade_id:item.id,usuario_id:usuario.id,detalhe:usuario.nome+' comprou '+data.nome});
  if(error){botao.disabled=false;return;}
  if(item.estoque_id&&qc!==null){const rep=await reporEstoque(supa,usuario,item.estoque_id,qc);if(rep.ok){const{data:ie}=await supa.from('estoque').select('id,nome,categoria,quantidade,minimo,tipo,nivel,minimo_nivel').eq('id',item.estoque_id).single();if(ie)await sincronizarItem(supa,usuario,ie);}await carregarEstoque();}
  await carregarLista();
}

// --- ESTOQUE ---
function normalizarNome(n){return n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ');}

async function carregarEstoque(){
  const{data:itens,error}=await supa.from('estoque').select('id,nome,categoria,tipo,quantidade,unidade,minimo,nivel,minimo_nivel,local,critico,taxa_consumo,taxa_periodo,alerta_dias').eq('casa_id',usuario.casa_id).order('nome');
  const area=el('itensEstoque');area.innerHTML='';
  if(error){area.innerHTML='<div class="vazio">Erro.</div>';return;}
  if(!itens||!itens.length){area.innerHTML='<div class="vazio">Nada no estoque ainda.</div>';return;}
  // Verifica consumo critico em background (nao bloqueia a renderizacao)
  verificarConsumoEstoque(itens);
  for(const item of itens){
    const status=calcularStatus(item.quantidade,item.minimo,item.tipo,item.nivel,item.minimo_nivel);const info=rotuloStatus(status);
    const l=document.createElement('div');l.className='item';
    const d=document.createElement('div');d.className='desc';
    const n=document.createElement('span');n.className='nome';n.textContent=item.nome;if(item.critico){n.insertAdjacentHTML('beforeend',' '+iconeSvg('estrela',13));n.title='Item crítico';}d.appendChild(n);
    const m=document.createElement('span');m.className='meta';
    let metaTxt=(item.local?item.local+' · ':'')+descricaoQuantidade(item);
    const lc=labelConsumo(item);if(lc)metaTxt+=' · '+lc;
    m.textContent=metaTxt;d.appendChild(m);
    // Badge de consumo crítico
    const sc=statusConsumo(item);
    if(sc==='critico'||sc==='atencao'){
      const bc=document.createElement('span');bc.className='badge-consumo';
      bc.style.background=sc==='critico'?'#b23c3c':'#b8860b';
      bc.textContent=sc==='critico'?'Acabando':'Atenção';
      n.appendChild(bc);
    }
    const dir=document.createElement('div');dir.className='est-controles';
    const badge=document.createElement('span');badge.className='badge';badge.style.background=info.cor;badge.textContent=info.texto;dir.appendChild(badge);
    if(item.tipo==='nivel_visual'){const sel=document.createElement('select');sel.className='sel';sel.style.cssText='width:auto;padding:6px 8px;font-size:13px';NIVEIS_VISUAL.forEach(nv=>{const o=document.createElement('option');o.value=nv;o.textContent=ROTULO_NIVEL[nv];if(nv===item.nivel)o.selected=true;sel.appendChild(o);});sel.onchange=()=>ajustarNivel(item,sel.value);dir.appendChild(sel);}
    else{const p=item.tipo==='peso_volume'?100:1;const bm=document.createElement('button');bm.textContent='−';bm.onclick=()=>ajustarEstoque(item,-p);const q=document.createElement('span');q.className='est-qtd';q.textContent=item.quantidade;const bp=document.createElement('button');bp.textContent='+';bp.onclick=()=>ajustarEstoque(item,p);dir.appendChild(bm);dir.appendChild(q);dir.appendChild(bp);}
    const btnEditE=document.createElement('button');btnEditE.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;btnEditE.title='Editar';btnEditE.style.cssText='background:none;color:var(--suave);padding:4px 6px;font-size:13px';btnEditE.onclick=()=>abrirEditarEstoque(item);
    const btnDelE=document.createElement('button');btnDelE.textContent='×';btnDelE.dataset.uiAction='delete';btnDelE.setAttribute('aria-label','Excluir item do estoque');btnDelE.style.cssText='background:none;color:var(--suave);padding:4px 6px';btnDelE.onclick=()=>removerEstoque(item);
    dir.appendChild(btnEditE);dir.appendChild(btnDelE);
    l.appendChild(d);l.appendChild(dir);area.appendChild(l);
  }
}

// Verifica consumo critico e gera sugestoes na lista (chamado ao carregar estoque)
async function verificarConsumoEstoque(itens){
  const{data:pendentes}=await supa.from('lista_compras').select('nome').eq('casa_id',usuario.casa_id).eq('status','pendente');
  const gerados=await gerarSugestoesConsumo(supa,usuario,itens||[],pendentes||[]);
  if(gerados>0)await carregarLista();
}

async function adicionarEstoque(){
  const nome=el('estNome').value.trim(),tipo=el('estTipo').value;
  if(!nome){aviso('avisoEstoque','Digite o nome.','erro');return;}
  const{data:ex}=await supa.from('estoque').select('nome').eq('casa_id',usuario.casa_id);
  const nn=normalizarNome(nome),dup=(ex||[]).find(i=>normalizarNome(i.nome)===nn);
  if(dup){aviso('avisoEstoque',`Já existe "${dup.nome}".`,'erro');return;}
  const taxaC=el('estTaxaConsumo').value?Number(el('estTaxaConsumo').value):null;
  const taxaP=el('estTaxaPeriodo').value||null;
  let payload={casa_id:usuario.casa_id,nome,tipo,atualizado_por:usuario.id,local:el('estLocal').value||null,critico:el('estCritico').checked,taxa_consumo:taxaC,taxa_periodo:taxaP,alerta_dias:Number(el('estAlertaDias').value)||7};
  if(tipo==='contavel'||tipo==='peso_volume'){const quantidade=Number(el('estQtd').value),minimo=Number(el('estMin').value);if(!isFinite(quantidade)||!isFinite(minimo)){aviso('avisoEstoque','Números inválidos.','erro');return;}payload={...payload,quantidade,minimo,unidade:el('estUnidade').value.trim()||(tipo==='peso_volume'?'g':'unidades')};}
  else if(tipo==='nivel_visual'){payload={...payload,nivel:el('estNivelAtual').value,minimo_nivel:el('estNivelMin').value,quantidade:0,minimo:0};}
  el('btnAddEstoque').disabled=true;
  const{data,error}=await supa.from('estoque').insert(payload).select().single();
  if(data)supa.from('eventos').insert({tipo:'estoque_item_criado',entidade:'estoque',entidade_id:data.id,usuario_id:usuario.id,detalhe:usuario.nome+' adicionou '+nome});
  el('btnAddEstoque').disabled=false;
  if(error){aviso('avisoEstoque','Erro.','erro');return;}
  el('estNome').value='';el('estTipo').value='contavel';el('estQtd').value='0';el('estMin').value='1';el('estUnidade').value='';el('estLocal').value='';el('estCritico').checked=false;el('estTaxaConsumo').value='';el('estTaxaPeriodo').value='';el('estAlertaDias').value='7';
  el('estCamposNum').classList.remove('oculto');el('estCamposNivel').classList.add('oculto');
  aviso('avisoEstoque','Adicionado.','ok');setTimeout(()=>aviso('avisoEstoque',''),1500);
  if(data){await sincronizarItem(supa,usuario,data);await carregarLista();}await carregarEstoque();
}

async function ajustarEstoque(item,delta){
  const nova=Math.max(0,Number(item.quantidade)+delta);
  const{error}=await supa.from('estoque').update({quantidade:nova,atualizado_por:usuario.id,atualizado_em:new Date().toISOString()}).eq('id',item.id);
  if(!error){supa.from('eventos').insert({tipo:'estoque_ajustado',entidade:'estoque',entidade_id:item.id,usuario_id:usuario.id,valor_anterior:{quantidade:item.quantidade},valor_novo:{quantidade:nova},detalhe:`${usuario.nome} ajustou ${item.nome} para ${nova}`});await sincronizarItem(supa,usuario,{...item,quantidade:nova});}
  await carregarEstoque();await carregarLista();
}

async function ajustarNivel(item,novoNivel){
  const{error}=await supa.from('estoque').update({nivel:novoNivel,atualizado_por:usuario.id,atualizado_em:new Date().toISOString()}).eq('id',item.id);
  if(!error){supa.from('eventos').insert({tipo:'estoque_ajustado',entidade:'estoque',entidade_id:item.id,usuario_id:usuario.id,valor_anterior:{nivel:item.nivel},valor_novo:{nivel:novoNivel},detalhe:`${usuario.nome} ajustou ${item.nome}`});await sincronizarItem(supa,usuario,{...item,nivel:novoNivel});}
  await carregarEstoque();await carregarLista();
}

// --- INVENTARIO ---
let _invItens=[],_invLocal='';
function abrirEditarEstoque(item){
  _estoqueEditando=item;
  el('eeNome').value=item.nome||'';
  el('eeLocal').value=item.local||'';
  el('eeMin').value=item.minimo??'';
  el('eeUnidade').value=item.unidade||'';
  el('eeTaxaConsumo').value=item.taxa_consumo??'';
  el('eeTaxaPeriodo').value=item.taxa_periodo||'';
  el('eeAlertaDias').value=item.alerta_dias??7;
  el('eeCritico').checked=!!item.critico;
  el('eeQtdBox').style.display=item.tipo==='nivel_visual'?'none':'block';
  aviso('avisoEditarEstoque','');
  abrirModal('modalEditarEstoque');
}

async function salvarEditarEstoque(){
  if(!_estoqueEditando)return;
  const nome=el('eeNome').value.trim();
  if(!nome){aviso('avisoEditarEstoque','Digite o nome.','erro');return;}
  el('btnSalvarEditarEstoque').disabled=true;
  const taxaC=el('eeTaxaConsumo').value?Number(el('eeTaxaConsumo').value):null;
  const taxaP=el('eeTaxaPeriodo').value||null;
  const payload={nome,local:el('eeLocal').value||null,critico:el('eeCritico').checked,taxa_consumo:taxaC,taxa_periodo:taxaP,alerta_dias:Number(el('eeAlertaDias').value)||7,atualizado_por:usuario.id,atualizado_em:new Date().toISOString()};
  if(_estoqueEditando.tipo!=='nivel_visual'){payload.minimo=Number(el('eeMin').value)||0;payload.unidade=el('eeUnidade').value.trim()||_estoqueEditando.unidade;}
  const{error}=await supa.from('estoque').update(payload).eq('id',_estoqueEditando.id);
  el('btnSalvarEditarEstoque').disabled=false;
  if(error){aviso('avisoEditarEstoque','Erro ao salvar.','erro');return;}
  fecharModal('modalEditarEstoque');
  _estoqueEditando=null;
  await carregarEstoque();await carregarLista();
}

async function removerEstoque(item){
  if(!await confirmarAcao('Excluir item do estoque',`Excluir "${item.nome}" do estoque?`,{confirmLabel:'Excluir',danger:true}))return;
  const{error}=await supa.from('estoque').delete().eq('id',item.id);
  if(!error){
    supa.from('historico_excluidos').insert({casa_id:usuario.casa_id,usuario_id:usuario.id,modulo:'estoque',registro_id:item.id,dados:item});
    await carregarEstoque();await carregarLista();
  }
}

async function abrirModalInventario(){el('invPassoLocal').classList.remove('oculto');el('invPassoItens').classList.add('oculto');el('invLocal').value='';el('avisoInventario').textContent='';abrirModal('modalInventario');}
async function iniciarInventario(){
  const local=el('invLocal').value;if(!local){aviso('avisoInventario','Escolha um ambiente.','erro');return;}
  el('btnIniciarInventario').disabled=true;aviso('avisoInventario','Buscando...','');
  const{itens}=await selecionarItensInventario(supa,usuario,local);
  el('btnIniciarInventario').disabled=false;
  if(!itens.length){aviso('avisoInventario','Nenhum item precisa de conferência agora.','ok');return;}
  _invItens=itens;_invLocal=local;
  el('invSubtitulo').textContent=`${local} — ${itens.length} itens`;
  const area=el('invItens');area.innerHTML='';
  for(const item of itens){
    const bloco=document.createElement('div');bloco.style.cssText='padding:12px 0;border-bottom:1px solid var(--linha)';
    const topo=document.createElement('div');topo.style.cssText='display:flex;justify-content:space-between;margin-bottom:8px';
    const n=document.createElement('span');n.className='nome';n.textContent=item.nome;if(item.critico){n.insertAdjacentHTML('beforeend',' '+iconeSvg('estrela',13));n.title='Item crítico';}topo.appendChild(n);bloco.appendChild(topo);
    if(item.tipo==='nivel_visual'){const sel=document.createElement('select');sel.className='sel';sel.dataset.itemId=item.id;NIVEIS_VISUAL.forEach(nv=>{const o=document.createElement('option');o.value=nv;o.textContent=ROTULO_NIVEL[nv];if(nv===item.nivel)o.selected=true;sel.appendChild(o);});bloco.appendChild(sel);}
    else{const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:8px';const inp=document.createElement('input');inp.type='number';inp.min='0';inp.step=item.tipo==='peso_volume'?'100':'1';inp.value=item.quantidade;inp.dataset.itemId=item.id;inp.style.flex='1';const un=document.createElement('span');un.className='meta';un.textContent=item.unidade||'';row.appendChild(inp);row.appendChild(un);bloco.appendChild(row);}
    area.appendChild(bloco);
  }
  el('invPassoLocal').style.display='none';el('invPassoItens').style.display='block';el('invPassoItens').classList.remove('oculto');
}
async function concluirInventario(){
  el('btnConcluirInventario').disabled=true;
  for(const item of _invItens){let v;if(item.tipo==='nivel_visual'){const s=el('invItens').querySelector(`select[data-item-id="${item.id}"]`);v=s?s.value:item.nivel;}else{const i=el('invItens').querySelector(`input[data-item-id="${item.id}"]`);v=i?i.value:item.quantidade;}await confirmarItemInventario(supa,usuario,item,v);}
  await concluirSessaoInventario(supa,usuario,_invLocal,_invItens.length);
  el('btnConcluirInventario').disabled=false;fecharModal('modalInventario');
  await carregarEstoque();await carregarLista();
}

// --- PLANTAS ---
async function atualizarPlantas(){
  const [res, esp] = await Promise.all([carregarPlantas(supa,usuario), carregarEspecies(supa,usuario)]);
  if(res.ok)_plantasCache=res.plantas;
  _especies=esp;
  const contador=el('plantasContador');
  if(contador)contador.textContent=`${_plantasCache.length} plantas ativas`;
  renderizarPlantas();
}

function renderizarPlantas(){
  const area=el('listaPlantas');area.innerHTML='';
  if(!_plantasCache.length){area.innerHTML='<div class="cartao"><div class="vazio">Nenhuma planta cadastrada.</div></div>';return;}

  // Filtra
  let filtradas=_plantasCache;
  if(_filtroAtual==='vencida')filtradas=filtradas.filter(p=>urgenciaPlanta(p)==='vencida');
  else if(_filtroAtual==='hoje')filtradas=filtradas.filter(p=>urgenciaPlanta(p)==='hoje');
  else if(_filtroAtual==='breve')filtradas=filtradas.filter(p=>['vencida','hoje','breve'].includes(urgenciaPlanta(p)));
  else if(_filtroAtual==='sala')filtradas=filtradas.filter(p=>p.comodo==='Sala');
  else if(_filtroAtual==='outros')filtradas=filtradas.filter(p=>p.comodo!=='Sala');

  if(!filtradas.length){area.innerHTML='<div class="cartao"><div class="vazio">Nenhuma planta neste filtro.</div></div>';return;}

  // Agrupa por cômodo
  const comodos={};
  for(const p of filtradas){const c=p.comodo||'Sem local';if(!comodos[c])comodos[c]=[];comodos[c].push(p);}

  for(const[comodo,plantas] of Object.entries(comodos)){
    const cartao=document.createElement('div');cartao.className='cartao';
    const titulo=document.createElement('div');titulo.className='comodo-titulo';titulo.textContent=`${comodo} (${plantas.length})`;cartao.appendChild(titulo);

    for(const planta of plantas){
      const urgencia=urgenciaPlanta(planta);
      const infoUrg=COR_URGENCIA[urgencia];
      const perfil=COR_PERFIL[planta.perfil_hidrico]||COR_PERFIL.medio;
      const rotinaPrincipal=(planta.planta_rotinas||[]).find(r=>r.ativa);
      const nomeEspecie=planta.especies?.nome_popular||'';

      const linha=document.createElement('div');linha.className='planta-card';linha.onclick=()=>abrirFichaPlanta(planta);

      const esq=document.createElement('div');
      const cod=document.createElement('div');cod.className='planta-codigo';cod.textContent=`${planta.codigo} · Etiq. ${planta.numero_etiqueta}`;
      const nome=document.createElement('div');nome.className='planta-nome';
      nome.innerHTML=`<span class="dot-perfil" style="background:${perfil.cor}"></span>${escapeHtml(nomeEspecie)}`;
      if(planta.nome_personalizado){const apelido=document.createElement('span');apelido.style.cssText='font-size:12px;color:var(--suave);margin-left:4px';apelido.textContent=`(${planta.nome_personalizado})`;nome.appendChild(apelido);}
      const meta=document.createElement('div');meta.className='planta-meta';
      if(rotinaPrincipal){
        const prox=rotinaPrincipal.proxima_realizacao;
        const hoje=new Date().toISOString().slice(0,10);
        const dias=prox?Math.round((new Date(prox)-new Date(hoje))/86400000):null;
        const quando=dias===null?'—':dias<0?`${Math.abs(dias)}d atrás`:dias===0?'hoje':`em ${dias}d`;
        meta.textContent=`${rotinaPrincipal.tipo} · ${quando}`;
      }
      esq.appendChild(cod);esq.appendChild(nome);esq.appendChild(meta);

      const dir=document.createElement('div');dir.style.display='flex';dir.style.alignItems='center';dir.style.gap='8px';
      const badge=document.createElement('span');badge.className='badge';badge.style.background=infoUrg.cor;badge.textContent=infoUrg.texto;

      if(urgencia==='vencida'||urgencia==='hoje'){
        const btnCuidar=document.createElement('button');btnCuidar.textContent='Cuidar';btnCuidar.style.cssText='padding:7px 12px;font-size:13px';
        btnCuidar.onclick=(e)=>{e.stopPropagation();cuidarPlanta(planta,btnCuidar);};
        dir.appendChild(badge);dir.appendChild(btnCuidar);
      }else{dir.appendChild(badge);}

      linha.appendChild(esq);linha.appendChild(dir);cartao.appendChild(linha);
    }
    area.appendChild(cartao);
  }
}

async function cuidarPlanta(planta,botao){
  botao.disabled=true;
  try{
    const rotinas=(planta.planta_rotinas||[]).filter(r=>r.ativa);
    const hoje=new Date().toISOString().slice(0,10);
    const vencidas=rotinas.filter(r=>!r.proxima_realizacao||r.proxima_realizacao<=hoje);
    const resultados=[];
    for(const rotina of vencidas){resultados.push(await registrarCuidado(supa,usuario,planta,rotina));}
    if(resultados.some(resultado=>!resultado.ok)){
      alert('Não foi possível registrar o cuidado agora. Tente novamente.');
      return;
    }
    await atualizarPlantas();
    await carregarHoje();
  }catch(e){
    alert('Não foi possível registrar o cuidado agora. Tente novamente.');
  }finally{
    botao.disabled=false;
  }
}

async function abrirFichaPlanta(planta){
  const nomeEspecie=planta.especies?.nome_popular||'';
  const cientifico=planta.especies?.nome_cientifico||'';
  _plantaAberta=planta;
  el('mpCodigo').textContent=`${planta.codigo} · Etiqueta ${planta.numero_etiqueta}`;
  el('mpNome').textContent=planta.nome_personalizado?`${nomeEspecie} (${planta.nome_personalizado})`:nomeEspecie;

  // Dados
  const dados=el('mpDados');dados.innerHTML='';
  const info=[
    ['Espécie',cientifico||'—'],
    ['Cômodo',planta.comodo||'—'],
    ['Posição',planta.posicao||'—'],
    ['Método',planta.metodo_cultivo],
    ['Perfil hídrico',COR_PERFIL[planta.perfil_hidrico]?.label||planta.perfil_hidrico],
    ['Observações',planta.observacoes||'—'],
  ];
  for(const[k,v]of info){const linha=document.createElement('div');linha.style.cssText='display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--linha);font-size:13px';linha.innerHTML=`<span style="color:var(--suave)">${escapeHtml(k)}</span><span>${escapeHtml(v)}</span>`;dados.appendChild(linha);}

  // Botoes de cuidado manual
  const acoes=el('mpAcoes');acoes.innerHTML='';
  const metodo=planta.metodo_cultivo;
  const tiposManual = metodo==='agua'
    ? [['troca_agua','atualizar','Trocar água']]
    : metodo==='kokedama'
    ? [['imersao','balde','Imersão']]
    : [['rega','gota','Regar agora'],['adubacao','broto','Adubar'],['poda','tesoura','Podar'],['observacao','anotacao','Observação']];
  for(const[tipo,icone,label] of tiposManual){
    const btn=document.createElement('button');btn.innerHTML=conteudoComIcone(icone,label,14);btn.className='secundario';btn.style.cssText='font-size:13px;padding:7px 12px;display:inline-flex;align-items:center;gap:6px';
    btn.onclick=async()=>{
      if(tipo==='observacao'){const nota=prompt('Observação:');if(!nota)return;await supa.from('planta_eventos').insert({planta_id:planta.id,tipo:'observacao',notas:nota,usuario_id:usuario.id,data:new Date().toISOString()});}
      else{await registrarCuidadoManual(supa,usuario,planta,tipo);}
      await atualizarPlantas();
      // Recarrega eventos na ficha
      if(_plantaAberta)await renderizarEventosPlanta(_plantaAberta);
    };
    acoes.appendChild(btn);
  }

  // Rotinas com botao de cuidar e editar intervalo
  const rotDiv=el('mpRotinas');rotDiv.innerHTML='<div class="titulo-secao">Rotinas</div>';
  const rotinas=(planta.planta_rotinas||[]).filter(r=>r.ativa);
  for(const r of rotinas){
    const div=document.createElement('div');div.style.cssText='padding:10px 0;border-bottom:1px solid var(--linha)';
    const hoje=new Date().toISOString().slice(0,10);
    const dias=r.proxima_realizacao?Math.round((new Date(r.proxima_realizacao)-new Date(hoje))/86400000):null;
    const quando=dias===null?'—':dias<0?`${Math.abs(dias)}d atrás`:dias===0?'hoje':`em ${dias}d`;
    // Linha principal
    const topo=document.createElement('div');topo.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px';
    topo.innerHTML=`<span style="font-size:13px">${escapeHtml(r.tipo)} · <strong>${escapeHtml(quando)}</strong></span>`;
    if(dias===null||dias<=0){
      const btn=document.createElement('button');btn.textContent='Cuidar';btn.style.cssText='padding:6px 10px;font-size:12px';
      btn.onclick=async()=>{
        btn.disabled=true;btn.textContent='Registrando…';
        try{
          const resultado=await registrarCuidado(supa,usuario,planta,r);
          if(!resultado.ok){alert('Não foi possível registrar o cuidado agora. Tente novamente.');return;}
          await atualizarPlantas();
          await carregarHoje();
          const plantaAtualizada=_plantasCache.find(item=>item.id===planta.id);
          if(plantaAtualizada)await abrirFichaPlanta(plantaAtualizada);
        }catch(e){
          alert('Não foi possível registrar o cuidado agora. Tente novamente.');
        }finally{
          btn.disabled=false;
          if(btn.isConnected&&btn.textContent==='Registrando…')btn.textContent='Cuidar';
        }
      };
      topo.appendChild(btn);
    }
    div.appendChild(topo);
    // Linha de edição do intervalo
    const edit=document.createElement('div');edit.style.cssText='display:flex;align-items:center;gap:8px;font-size:12px;color:var(--suave)';
    const inp=document.createElement('input');inp.type='number';inp.min='1';inp.value=r.intervalo_dias;inp.style.cssText='width:56px;padding:4px 8px;font-size:12px';
    const lbl=document.createElement('span');lbl.textContent='dias entre cuidados';
    const btnSalvar=document.createElement('button');btnSalvar.textContent='Salvar';btnSalvar.style.cssText='padding:4px 10px;font-size:12px';
    btnSalvar.onclick=async()=>{
      btnSalvar.disabled=true;btnSalvar.textContent='Salvando…';
      try{
        const ok=await editarRotina(supa,r,inp.value);
        if(!ok){alert('Não foi possível salvar o intervalo. Tente novamente.');return;}
        await atualizarPlantas();
        const plantaAtualizada=_plantasCache.find(item=>item.id===planta.id);
        if(plantaAtualizada)await abrirFichaPlanta(plantaAtualizada);
      }catch(e){
        alert('Não foi possível salvar o intervalo. Tente novamente.');
      }finally{
        btnSalvar.disabled=false;
        if(btnSalvar.isConnected&&btnSalvar.textContent==='Salvando…')btnSalvar.textContent='Salvar';
      }
    };
    edit.appendChild(inp);edit.appendChild(lbl);edit.appendChild(btnSalvar);
    div.appendChild(edit);
    rotDiv.appendChild(div);
  }

  // Eventos (linha do tempo)
  await renderizarEventosPlanta(planta);

  abrirModal('modalPlanta');
}

function abrirEditarPlanta(){
  if(!_plantaAberta)return;
  _plantaEditando=_plantaAberta;
  const p=_plantaEditando;
  el('epTitulo').textContent=`Editar ${p.especies?.nome_popular||p.codigo}`;
  el('epApelido').value=p.nome_personalizado||'';
  el('epComodo').value=p.comodo||'Sala';
  el('epPosicao').value=p.posicao||'';
  el('epMetodo').value=p.metodo_cultivo||'substrato';
  el('epPerfil').value=p.perfil_hidrico||'medio';
  el('epObs').value=p.observacoes||'';
  aviso('avisoEditarPlanta','');
  abrirModal('modalEditarPlanta');
}

async function salvarEditarPlanta(){
  if(!_plantaEditando)return;
  el('btnSalvarEditarPlanta').disabled=true;
  const perfil=el('epPerfil').value;
  const corMap={alto:'verde',medio:'laranja',baixo:'azul'};
  const{error}=await supa.from('plantas').update({
    nome_personalizado:el('epApelido').value.trim()||null,
    comodo:el('epComodo').value,
    posicao:el('epPosicao').value.trim()||null,
    metodo_cultivo:el('epMetodo').value,
    perfil_hidrico:perfil,
    cor_etiqueta:corMap[perfil]||null,
    observacoes:el('epObs').value.trim()||null,
  }).eq('id',_plantaEditando.id);
  el('btnSalvarEditarPlanta').disabled=false;
  if(error){aviso('avisoEditarPlanta','Erro ao salvar.','erro');return;}
  fecharModal('modalEditarPlanta');
  // Atualiza o cache e reabre a ficha com dados novos
  await atualizarPlantas();
  const atualizada=_plantasCache.find(p=>p.id===_plantaEditando.id);
  _plantaEditando=null;
  if(atualizada)await abrirFichaPlanta(atualizada);
}

// --- CARDAPIO ---
let _refeicoes=[],_planDias={},_slotAtual=null,_sugestaoCardapioOffset=0;
let _planRespAtual='ambos';
let _planDiasPorResp={ambos:{},mateus:{},ghustavo:{}};
const CARDAPIO_RESPONSAVEIS=['ambos','mateus','ghustavo'];
const CARDAPIO_DIAS={1:'Seg',2:'Ter',3:'Qua',4:'Qui',5:'Sex',6:'Sáb',7:'Dom'};
const CARDAPIO_TIPOS={cafe:'Café da manhã',almoco:'Almoço',lanche:'Lanche',janta:'Jantar'};

function labelTipoCardapio(tipo){
  return CARDAPIO_TIPOS[tipo]||({ambos:'Almoço/Janta'}[tipo])||tipo;
}

function receitaCompativelComSlot(receita,tipo){
  if(receita.tipo===tipo)return true;
  return receita.tipo==='ambos'&&(tipo==='almoco'||tipo==='janta');
}

function selecionarResponsavelCardapio(resp,{render=true}={}){
  _planRespAtual=CARDAPIO_RESPONSAVEIS.includes(resp)?resp:'ambos';
  _planDias=_planDiasPorResp[_planRespAtual]||(_planDiasPorResp[_planRespAtual]={});
  if(el('planResp'))el('planResp').value=_planRespAtual;
  if(render)renderizarSlotsCardapio();
}
async function carregarRefeicoes(){
  const{data,error}=await supa.from('refeicoes').select('id,nome,tipo,porcoes,tempo_minutos,modo_preparo,observacoes,fonte_url,calorias_por_porcao,proteina_por_porcao,carboidratos_por_porcao,refeicao_ingredientes(id,nome,quantidade,unidade)').eq('casa_id',usuario.casa_id).order('nome');
  _refeicoes=data||[];
  const area=el('listaRefeicoes');area.innerHTML='';
  if(error||!_refeicoes.length){area.innerHTML='<div class="vazio">Nenhuma refeição cadastrada.</div>';return;}
  for(const r of _refeicoes){
    const linha=document.createElement('div');linha.className='card-refeicao';linha.dataset.receitaId=r.id;
    const d=document.createElement('div');d.className='desc';
    const n=document.createElement('span');n.className='nome';n.textContent=r.nome;d.appendChild(n);
    const m=document.createElement('span');m.className='meta';m.textContent=`${labelTipoCardapio(r.tipo)} · ${r.porcoes} porções · ${(r.refeicao_ingredientes||[]).length} ingredientes${r.tempo_minutos?` · ${r.tempo_minutos} min`:''}${r.calorias_por_porcao!=null?` · ${Number(r.calorias_por_porcao)} kcal`:''}${r.proteina_por_porcao!=null?` · ${Number(r.proteina_por_porcao)} g prot.`:''}${r.carboidratos_por_porcao!=null?` · ${Number(r.carboidratos_por_porcao)} g carb.`:''}`;d.appendChild(m);
    const acoes=document.createElement('div');acoes.className='receita-row-actions';
    const abrir=document.createElement('button');abrir.type='button';abrir.className='receita-open-btn';abrir.dataset.rv2Open=r.id;abrir.textContent='Abrir';
    const apagar=document.createElement('button');apagar.type='button';apagar.className='lifeos-icon-action is-danger receita-delete-btn';apagar.setAttribute('aria-label',`Excluir ${r.nome}`);apagar.title='Excluir';apagar.innerHTML='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></svg>';
    apagar.onclick=(ev)=>{ev.stopPropagation();removerRefeicao(r.id,r.nome);};
    acoes.appendChild(abrir);acoes.appendChild(apagar);
    linha.appendChild(d);linha.appendChild(acoes);area.appendChild(linha);
  }
  renderizarSlotsCardapio();
}

async function salvarRefeicao(){
  const nome=el('refNome').value.trim();if(!nome){aviso('avisoRefeicao','Digite o nome.','erro');return;}
  el('btnSalvarRefeicao').disabled=true;
  const{data:ref,error}=await supa.from('refeicoes').insert({casa_id:usuario.casa_id,nome,tipo:el('refTipo').value,porcoes:Number(el('refPorcoes').value)||2,tempo_minutos:Number(el('refTempo')?.value)||null,calorias_por_porcao:el('refKcal')?.value?Number(el('refKcal').value):null,proteina_por_porcao:el('refProteina')?.value?Number(el('refProteina').value):null,carboidratos_por_porcao:el('refCarbo')?.value?Number(el('refCarbo').value):null,fonte_url:el('refFonte')?.value.trim()||null,observacoes:el('refObservacoes')?.value.trim()||null,modo_preparo:el('refPreparo')?.value.trim()||null,criada_por:usuario.id,atualizado_em:new Date().toISOString()}).select().single();
  if(error){aviso('avisoRefeicao','Erro.','erro');el('btnSalvarRefeicao').disabled=false;return;}
  const linhas=el('refIngredientes').querySelectorAll('.linha-ingrediente');
  for(const l of linhas){const n=l.querySelector('.ing-nome').value.trim();const q=l.querySelector('.ing-qtd').value;const u=l.querySelector('.ing-un').value.trim();if(n)await supa.from('refeicao_ingredientes').insert({refeicao_id:ref.id,nome:n,quantidade:q?Number(q):null,unidade:u||null});}
  el('refNome').value='';el('refPorcoes').value='2';if(el('refKcal'))el('refKcal').value='';if(el('refProteina'))el('refProteina').value='';if(el('refCarbo'))el('refCarbo').value='';if(el('refTempo'))el('refTempo').value='';if(el('refFonte'))el('refFonte').value='';if(el('refObservacoes'))el('refObservacoes').value='';if(el('refPreparo'))el('refPreparo').value='';el('refIngredientes').innerHTML='';
  aviso('avisoRefeicao','Refeição salva.','ok');setTimeout(()=>aviso('avisoRefeicao',''),1500);el('btnSalvarRefeicao').disabled=false;await carregarRefeicoes();
}

async function removerRefeicao(id,nome='esta receita'){
  if(!await confirmarAcao('Excluir receita',`Excluir "${nome}"? Esta ação remove a receita da biblioteca.`,{confirmLabel:'Excluir',danger:true}))return;
  await supa.from('refeicoes').delete().eq('id',id);
  await carregarRefeicoes();
}

function adicionarLinhaIngrediente(){
  const div=document.createElement('div');div.className='linha-ingrediente';div.style.cssText='display:flex;gap:6px;margin-bottom:8px;align-items:center';
  const n=document.createElement('input');n.type='text';n.className='ing-nome';n.placeholder='Ingrediente';n.style.flex='2';
  const q=document.createElement('input');q.type='number';q.className='ing-qtd';q.placeholder='Qtd';q.style.flex='1';q.min='0';
  const u=document.createElement('input');u.type='text';u.className='ing-un';u.placeholder='g/un';u.style.flex='1';
  const r=document.createElement('button');r.textContent='×';r.dataset.uiAction='delete';r.setAttribute('aria-label','Remover ingrediente');r.style.cssText='background:none;color:var(--suave);padding:4px 8px';r.onclick=()=>div.remove();
  div.appendChild(n);div.appendChild(q);div.appendChild(u);div.appendChild(r);el('refIngredientes').appendChild(div);n.focus();
}

function renderizarSlotsCardapio(){
  ['almoco','janta'].forEach(tipo=>{
    const grid=el(`slots${tipo.charAt(0).toUpperCase()+tipo.slice(1)}`);
    if(!grid)return;
    grid.innerHTML='';
    for(let d=1;d<=7;d++){
      const chave=`${d}-${tipo}`;
      const slot=_planDias[chave];
      const wrap=document.createElement('div');
      wrap.className='qa-cardapio-slot';
      const dia=document.createElement('span');
      dia.className='qa-slot-day';
      dia.textContent=(CARDAPIO_DIAS[d]||'').slice(0,3);
      wrap.appendChild(dia);
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='dia-slot'+(slot?' preenchido':'');
      if(slot?.refeicaoId)btn.dataset.receitaId=slot.refeicaoId;
      btn.innerHTML=slot?`<span>${escapeHtml(slot.nome)}</span>${slot.calorias!=null?`<small>${Number(slot.calorias)} kcal</small>`:''}`:'<span>+</span>';
      btn.setAttribute('aria-label',`${CARDAPIO_DIAS[d]} · ${labelTipoCardapio(tipo)}${slot?' · '+slot.nome:''}${slot?.calorias!=null?' · '+Number(slot.calorias)+' kcal':''}`);
      btn.onclick=()=>{
        if(slot?.refeicaoId&&typeof window.lifeosAbrirReceita==='function')window.lifeosAbrirReceita(slot.refeicaoId);
        else abrirModalRefeicao(d,tipo);
      };
      wrap.appendChild(btn);
      if(slot){
        const edit=document.createElement('button');
        edit.type='button';
        edit.className='qa-slot-edit';
        edit.setAttribute('aria-label',`Editar ${CARDAPIO_DIAS[d]} · ${labelTipoCardapio(tipo)}`);
        edit.title='Editar planejamento';
        edit.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
        edit.onclick=(event)=>{event.preventDefault();event.stopPropagation();abrirModalRefeicao(d,tipo);};
        wrap.appendChild(edit);
      }
      grid.appendChild(wrap);
    }
  });
}

function normalizarCardapioTexto(valor=''){
  return String(valor||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}

function familiaProteinaReceita(receita){
  const texto=normalizarCardapioTexto([receita.nome,...(receita.refeicao_ingredientes||[]).map(i=>i.nome)].join(' '));
  if(/frango|sassami|sobrecoxa/.test(texto))return 'frango';
  if(/tilapia|peixe|atum|sardinha/.test(texto))return 'peixe';
  if(/suino|lombo|porco/.test(texto))return 'porco';
  if(/carne|acem|bife|almondega/.test(texto))return 'carne';
  if(/ovo|omelete/.test(texto))return 'ovos';
  return 'outro';
}

function ingredienteDisponivelNoEstoque(ingrediente,nomesEstoque){
  const nome=normalizarCardapioTexto(ingrediente);
  if(!nome)return false;
  return nomesEstoque.some(est=>est.includes(nome)||nome.includes(est));
}

async function sugerirPlanejamentoSemana(){
  const botao=el('btnSugerirPlan');
  if(botao){botao.disabled=true;botao.textContent='Montando...';}
  try{
    if(!_refeicoes.length)await carregarRefeicoes();
    const candidatas=_refeicoes.filter(r=>['almoco','janta','ambos'].includes(r.tipo));
    if(!candidatas.length){aviso('avisoPlan','Cadastre ao menos uma refeição de almoço/janta.','erro');return;}

    const{data:estoque}=await supa.from('estoque')
      .select('nome,quantidade,nivel')
      .eq('casa_id',usuario.casa_id);
    const nomesEstoque=(estoque||[])
      .filter(i=>i.nivel!=='acabou'&&(i.quantidade==null||Number(i.quantidade)>0))
      .map(i=>normalizarCardapioTexto(i.nome))
      .filter(Boolean);

    const usados=new Set();
    let ultimaFamilia=null;
    const semana=formatarDataISO(inicioSemana());
    const baseHash=[...semana].reduce((a,c)=>a+c.charCodeAt(0),0)+_sugestaoCardapioOffset++;

    for(let d=1;d<=7;d++){
      for(const tipo of ['almoco','janta']){
        const compativeis=candidatas.filter(r=>r.tipo===tipo||r.tipo==='ambos');
        const ranking=compativeis.map((r,idx)=>{
          const disponiveis=(r.refeicao_ingredientes||[])
            .filter(i=>ingredienteDisponivelNoEstoque(i.nome,nomesEstoque)).length;
          const familia=familiaProteinaReceita(r);
          let score=disponiveis*3;
          if(usados.has(r.id))score-=20;
          if(familia===ultimaFamilia&&familia!=='outro')score-=4;
          score+=((baseHash+idx+d+(tipo==='janta'?7:0))%7)/100;
          return{r,score,familia};
        }).sort((a,b)=>b.score-a.score||a.r.nome.localeCompare(b.r.nome,'pt-BR'));

        const escolha=ranking[0]||null;
        if(!escolha)continue;
        _planDias[`${d}-${tipo}`]={nome:escolha.r.nome,refeicaoId:escolha.r.id,calorias:escolha.r.calorias_por_porcao??null,proteina:escolha.r.proteina_por_porcao??null,carboidratos:escolha.r.carboidratos_por_porcao??null};
        usados.add(escolha.r.id);
        ultimaFamilia=escolha.familia;
      }
    }
    renderizarSlotsCardapio();
    aviso('avisoPlan',nomesEstoque.length
      ?'Sugestão pronta priorizando o que já existe no estoque. Revise e salve quando quiser.'
      :'Sugestão pronta com variedade. Revise e salve quando quiser.','ok');
  }catch(erro){
    console.error('[Cardápio] Falha ao sugerir semana:',erro);
    aviso('avisoPlan','Não foi possível montar a sugestão agora.','erro');
  }finally{
    if(botao){botao.disabled=false;botao.textContent='Sugerir semana';}
  }
}

function abrirModalRefeicao(dia,tipo){
  _slotAtual={dia,tipo};el('modalRefTitulo').textContent=`${CARDAPIO_DIAS[dia]||'Dia'} — ${labelTipoCardapio(tipo)} · ${_planRespAtual==='ambos'?'Ambos':_planRespAtual.charAt(0).toUpperCase()+_planRespAtual.slice(1)}`;
  const chave=`${dia}-${tipo}`;
  const atual=_planDias[chave]||{};
  el('modalRefNomeAvulso').value=atual.nome||'';
  if(el('modalRefKcal'))el('modalRefKcal').value=atual.calorias??'';
  if(el('modalRefProteina'))el('modalRefProteina').value=atual.proteina??'';
  if(el('modalRefCarbo'))el('modalRefCarbo').value=atual.carboidratos??'';
  const lista=el('modalRefLista');lista.innerHTML='';
  _refeicoes.filter(r=>receitaCompativelComSlot(r,tipo)).forEach(r=>{
    const btn=document.createElement('div');btn.className='card-refeicao';btn.style.cursor='pointer';
    btn.innerHTML=`<div class="desc"><span class="nome">${escapeHtml(r.nome)}</span><span class="meta">${r.calorias_por_porcao!=null?Number(r.calorias_por_porcao)+' kcal por porção':'Calorias não informadas'}</span></div>`;
    btn.onclick=()=>{
      el('modalRefNomeAvulso').value=r.nome;
      if(el('modalRefKcal'))el('modalRefKcal').value=r.calorias_por_porcao??'';
      if(el('modalRefProteina'))el('modalRefProteina').value=r.proteina_por_porcao??'';
      if(el('modalRefCarbo'))el('modalRefCarbo').value=r.carboidratos_por_porcao??'';
      _slotAtual.refeicaoId=r.id;
    };
    lista.appendChild(btn);
  });
  abrirModal('modalRefeicao');
}

function confirmarSlot(){
  if(!_slotAtual)return;
  const nome=el('modalRefNomeAvulso').value.trim();
  const chave=`${_slotAtual.dia}-${_slotAtual.tipo}`;
  if(nome)_planDias[chave]={
    nome,
    refeicaoId:_slotAtual.refeicaoId||null,
    calorias:el('modalRefKcal')?.value?Number(el('modalRefKcal').value):null,
    proteina:el('modalRefProteina')?.value?Number(el('modalRefProteina').value):null,
    carboidratos:el('modalRefCarbo')?.value?Number(el('modalRefCarbo').value):null
  };
  fecharModalRefeicao();renderizarSlotsCardapio();
}
function limparSlot(){if(!_slotAtual)return;delete _planDias[`${_slotAtual.dia}-${_slotAtual.tipo}`];fecharModalRefeicao();renderizarSlotsCardapio();}
function fecharModalRefeicao(){fecharModal('modalRefeicao');_slotAtual=null;}

async function carregarPlanejamento(){
  const seg=formatarDataISO(inicioSemana());
  const{data:planos,error}=await supa.from('planejamento_semana')
    .select('id,responsavel,planejamento_dias(id,dia_semana,tipo,refeicao_id,refeicao_nome,calorias,proteina_g,carboidratos_g,refeicoes(nome,calorias_por_porcao,proteina_por_porcao,carboidratos_por_porcao))')
    .eq('casa_id',usuario.casa_id)
    .eq('semana_inicio',seg);
  _planDiasPorResp={ambos:{},mateus:{},ghustavo:{}};
  if(error){
    console.error('[Cardápio] Falha ao carregar planejamento:',error);
    selecionarResponsavelCardapio('ambos');
    return;
  }
  for(const plano of(planos||[])){
    const resp=CARDAPIO_RESPONSAVEIS.includes(plano.responsavel)?plano.responsavel:'ambos';
    for(const d of(plano.planejamento_dias||[])){
      _planDiasPorResp[resp][`${d.dia_semana}-${d.tipo}`]={
        nome:d.refeicoes?.nome||d.refeicao_nome||'',
        refeicaoId:d.refeicao_id,
        calorias:d.calorias??d.refeicoes?.calorias_por_porcao??null,
        proteina:d.proteina_g??d.refeicoes?.proteina_por_porcao??null,
        carboidratos:d.carboidratos_g??d.refeicoes?.carboidratos_por_porcao??null
      };
    }
  }
  selecionarResponsavelCardapio(el('planResp')?.value||'ambos');
}

async function salvarPlanejamento(){
  const botao=el('btnSalvarPlan');
  if(botao)botao.disabled=true;
  const seg=formatarDataISO(inicioSemana());
  try{
    const{data:existentes,error}=await supa.from('planejamento_semana')
      .select('id,responsavel')
      .eq('casa_id',usuario.casa_id)
      .eq('semana_inicio',seg);
    if(error)throw error;
    const porResp=new Map((existentes||[]).map(p=>[p.responsavel||'ambos',p]));

    for(const resp of CARDAPIO_RESPONSAVEIS){
      const slots=_planDiasPorResp[resp]||{};
      let plano=porResp.get(resp);
      let planId=plano?.id||null;
      if(!planId){
        const{data:n,error:e}=await supa.from('planejamento_semana')
          .insert({casa_id:usuario.casa_id,semana_inicio:seg,responsavel:resp,criado_por:usuario.id})
          .select('id').single();
        if(e)throw e;
        planId=n?.id;
      }else{
        const{error:e}=await supa.from('planejamento_semana').update({responsavel:resp}).eq('id',planId);
        if(e)throw e;
      }
      if(!planId)continue;
      const{error:delErr}=await supa.from('planejamento_dias').delete().eq('planejamento_id',planId);
      if(delErr)throw delErr;
      const inserir=Object.entries(slots).map(([chave,val])=>{
        const[dia,tipo]=chave.split('-');
        return{planejamento_id:planId,dia_semana:Number(dia),tipo,refeicao_id:val.refeicaoId||null,refeicao_nome:val.nome,calorias:val.calorias??null,proteina_g:val.proteina??null,carboidratos_g:val.carboidratos??null};
      });
      if(inserir.length){
        const{error:insErr}=await supa.from('planejamento_dias').insert(inserir);
        if(insErr)throw insErr;
      }
    }
    aviso('avisoPlan','Cardápios salvos para Ambos, Mateus e Ghustavo.','ok');
    setTimeout(()=>aviso('avisoPlan',''),2500);
  }catch(erro){
    console.error('[Cardápio] Falha ao salvar:',erro);
    aviso('avisoPlan','Não foi possível salvar o cardápio.','erro');
  }finally{
    if(botao)botao.disabled=false;
  }
}

async function limparPlanejamentoAtual(){
  const rotulo=_planRespAtual==='ambos'?'Ambos':_planRespAtual.charAt(0).toUpperCase()+_planRespAtual.slice(1);
  if(!Object.keys(_planDias).length)return;
  if(!await confirmarAcao('Limpar cardápio',`Limpar todos os slots de ${rotulo} nesta semana?`,{confirmLabel:'Limpar',danger:true}))return;
  _planDiasPorResp[_planRespAtual]={};
  selecionarResponsavelCardapio(_planRespAtual);
  aviso('avisoPlan',`Slots de ${rotulo} limpos. Clique em Salvar para confirmar.`,'ok');
}

async function gerarListaCardapio(){
  el('btnGerarLista').disabled=true;
  const ingredientes=[];
  for(const[,val]of Object.entries(_planDias)){if(!val.refeicaoId)continue;const ref=_refeicoes.find(r=>r.id===val.refeicaoId);if(!ref)continue;for(const ing of(ref.refeicao_ingredientes||[])){const qtdBase=ing.quantidade?ing.quantidade*(5/ref.porcoes):null;ingredientes.push({nome:ing.nome,quantidade:qtdBase?Math.ceil(qtdBase):null,unidade:ing.unidade||null});}}
  const mapa={};for(const ing of ingredientes){const k=normalizarNome(ing.nome);if(mapa[k]){if(mapa[k].quantidade&&ing.quantidade)mapa[k].quantidade+=ing.quantidade;}else{mapa[k]={...ing};}}
  const itens=Object.values(mapa);
  if(!itens.length){aviso('avisoPlan','Nenhum ingrediente encontrado.','erro');el('btnGerarLista').disabled=false;return;}
  await supa.from('lista_compras').insert(itens.map(i=>({casa_id:usuario.casa_id,nome:i.nome,quantidade:i.quantidade,unidade:i.unidade,status:'pendente',origem:'cardapio',criado_por:usuario.id})));
  aviso('avisoPlan',`${itens.length} ingredientes adicionados.`,'ok');setTimeout(()=>aviso('avisoPlan',''),3000);el('btnGerarLista').disabled=false;await carregarLista();
}

// --- RITUAIS ---
let _ritualAtual=null;
let _ritualEditando=null;
async function carregarRituais(){
  const{data:rituais,error}=await supa.from('rituais').select('id,nome,frequencia,pauta,privado,ritual_sessoes(id,realizado_em,proxima_em)').eq('casa_id',usuario.casa_id).order('nome');
  const area=el('listaRituais');area.innerHTML='';
  if(error){area.innerHTML='<div class="vazio">Erro.</div>';return;}
  if(!rituais||!rituais.length){area.innerHTML='<div class="vazio">Nenhum ritual cadastrado.</div>';return;}
  const freqLabel={semanal:'Semanal',mensal:'Mensal',bimestral:'Bimestral',livre:'Livre'};
  for(const r of rituais){
    const sessoes=r.ritual_sessoes||[];const ultima=sessoes.sort((a,b)=>new Date(b.realizado_em)-new Date(a.realizado_em))[0];const proxima=ultima?.proxima_em;
    const div=document.createElement('div');div.className='ritual-card';
    const topo=document.createElement('div');topo.className='ritual-topo';
    const esq=document.createElement('div');
    const n=document.createElement('span');n.className='nome';n.textContent=r.nome;if(r.privado){n.insertAdjacentHTML('beforeend',' '+iconeSvg('cadeado',13));n.title='Ritual privado';}esq.appendChild(n);
    const m=document.createElement('div');m.className='ritual-meta';const partes=[freqLabel[r.frequencia]||r.frequencia];if(ultima)partes.push(`última: ${new Date(ultima.realizado_em).toLocaleDateString('pt-BR')}`);if(proxima)partes.push(`próxima: ${proxima.split('-').reverse().join('/')}`);m.textContent=partes.join(' · ');esq.appendChild(m);
    const btns=document.createElement('div');btns.style.cssText='display:flex;gap:6px;align-items:center';
    const btnAb=document.createElement('button');btnAb.textContent='Iniciar';btnAb.style.cssText='padding:7px 12px;font-size:13px';btnAb.onclick=()=>abrirModalRitual(r);
    const btnEditR=document.createElement('button');btnEditR.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;btnEditR.title='Editar';btnEditR.style.cssText='background:none;color:var(--suave);padding:4px 6px;font-size:13px';btnEditR.onclick=()=>abrirEditarRitual(r);
    const btnRem=document.createElement('button');btnRem.textContent='×';btnRem.dataset.uiAction='delete';btnRem.setAttribute('aria-label','Excluir ritual');btnRem.style.cssText='background:none;color:var(--suave);padding:4px 8px';btnRem.onclick=()=>removerRitual(r);
    btns.appendChild(btnAb);btns.appendChild(btnEditR);btns.appendChild(btnRem);topo.appendChild(esq);topo.appendChild(btns);div.appendChild(topo);
    if(sessoes.length){const hist=document.createElement('div');hist.style.marginTop='8px';sessoes.slice(0,3).forEach(s=>{const h=document.createElement('div');h.className='historico-item';h.textContent=new Date(s.realizado_em).toLocaleDateString('pt-BR');hist.appendChild(h);});div.appendChild(hist);}
    area.appendChild(div);
  }
}

async function salvarRitual(){
  const nome=el('ritNome').value.trim();if(!nome){aviso('avisoRitual','Digite o nome.','erro');return;}
  el('btnSalvarRitual').disabled=true;
  const{data,error}=await supa.from('rituais').insert({casa_id:usuario.casa_id,nome,frequencia:el('ritFreq').value,pauta:el('ritPauta').value.trim()||null,privado:el('ritPrivado').checked}).select().single();
  if(data)supa.from('eventos').insert({tipo:'ritual_criado',entidade:'rituais',entidade_id:data.id,usuario_id:usuario.id,detalhe:usuario.nome+' criou '+nome});
  el('btnSalvarRitual').disabled=false;
  if(error){aviso('avisoRitual','Erro.','erro');return;}
  el('ritNome').value='';el('ritPauta').value='';el('ritPrivado').checked=false;
  aviso('avisoRitual','Ritual salvo.','ok');setTimeout(()=>aviso('avisoRitual',''),1500);await carregarRituais();
}

async function removerRitual(r){
  if(!await confirmarAcao('Excluir ritual',`Excluir o ritual "${r.nome}"?`,{confirmLabel:'Excluir',danger:true}))return;
  const{error}=await supa.from('rituais').delete().eq('id',r.id);
  if(!error){
    supa.from('historico_excluidos').insert({casa_id:usuario.casa_id,usuario_id:usuario.id,modulo:'rituais',registro_id:r.id,dados:r});
    await carregarRituais();
  }
}

function abrirEditarRitual(r){
  _ritualEditando=r;
  el('erNome').value=r.nome||'';
  el('erFreq').value=r.frequencia||'semanal';
  el('erPauta').value=r.pauta||'';
  el('erPrivado').checked=!!r.privado;
  aviso('avisoEditarRitual','');
  abrirModal('modalEditarRitual');
}

async function salvarEditarRitual(){
  if(!_ritualEditando)return;
  const nome=el('erNome').value.trim();
  if(!nome){aviso('avisoEditarRitual','Digite o nome.','erro');return;}
  el('btnSalvarEditarRitual').disabled=true;
  const{error}=await supa.from('rituais').update({
    nome,frequencia:el('erFreq').value,
    pauta:el('erPauta').value.trim()||null,
    privado:el('erPrivado').checked,
  }).eq('id',_ritualEditando.id);
  el('btnSalvarEditarRitual').disabled=false;
  if(error){aviso('avisoEditarRitual','Erro ao salvar.','erro');return;}
  fecharModal('modalEditarRitual');
  _ritualEditando=null;
  await carregarRituais();
}

function abrirModalRitual(ritual){
  _ritualAtual=ritual;el('modalRitNome').textContent=ritual.nome;el('modalRitPauta').textContent=ritual.pauta||'Sem pauta definida.';el('modalRitNotas').value='';
  const hoje=new Date();let prox=new Date(hoje);
  if(ritual.frequencia==='semanal')prox.setDate(hoje.getDate()+7);else if(ritual.frequencia==='mensal')prox.setMonth(hoje.getMonth()+1);else if(ritual.frequencia==='bimestral')prox.setMonth(hoje.getMonth()+2);
  el('modalRitProxima').value=ritual.frequencia==='livre'?'':formatarDataISO(prox);
  aviso('avisoSessao','');abrirModal('modalRitual');
}

async function concluirRitual(){
  if(!_ritualAtual)return;el('btnConcluirRitual').disabled=true;
  const{data,error}=await supa.from('ritual_sessoes').insert({ritual_id:_ritualAtual.id,notas:el('modalRitNotas').value.trim()||null,proxima_em:el('modalRitProxima').value||null,criado_por:usuario.id}).select().single();
  if(data)supa.from('eventos').insert({tipo:'ritual_concluido',entidade:'rituais',entidade_id:_ritualAtual.id,usuario_id:usuario.id,detalhe:`${usuario.nome} concluiu ${_ritualAtual.nome}`});
  el('btnConcluirRitual').disabled=false;
  if(error){aviso('avisoSessao','Erro.','erro');return;}
  aviso('avisoSessao','Sessão registrada.','ok');
  setTimeout(()=>{fecharModal('modalRitual');_ritualAtual=null;carregarRituais();},1200);
}

function criarTarefaDoRitual(){fecharModal('modalRitual');trocarAba('casa');trocarSub('tarefas',null);el('tfTitulo').value=(_ritualAtual?`[${_ritualAtual.nome}] `:'');el('tfTitulo').focus();}

function abrirEditarConta(conta){
  _contaEditando=conta;
  el('ecNome').value=conta.nome||'';
  el('ecValor').value=conta.valor??'';
  el('ecVenc').value=conta.vencimento?conta.vencimento.slice(0,10):'';
  el('ecRecorrente').checked=!!conta.recorrente;
  aviso('avisoEditarConta','');
  abrirModal('modalEditarConta');
}

async function salvarEditarConta(){
  if(!_contaEditando)return;
  const nome=el('ecNome').value.trim();
  if(!nome){aviso('avisoEditarConta','Digite o nome.','erro');return;}
  const vencimento=el('ecVenc').value;
  if(!vencimento){aviso('avisoEditarConta','Escolha o vencimento.','erro');return;}
  el('btnSalvarEditarConta').disabled=true;
  const valor=el('ecValor').value===''?null:Number(el('ecValor').value);
  const recorrente=el('ecRecorrente').checked;
  const{error}=await supa.from('contas').update({
    nome,valor,vencimento,recorrente,
    dia_vencimento:recorrente?Number(vencimento.slice(8,10)):null,
  }).eq('id',_contaEditando.id);
  el('btnSalvarEditarConta').disabled=false;
  if(error){aviso('avisoEditarConta','Erro ao salvar.','erro');return;}
  fecharModal('modalEditarConta');
  _contaEditando=null;
  await carregarContas();
}

async function removerConta(conta,botao){
  if(!await confirmarAcao('Excluir conta',`Excluir a conta "${conta.nome}"?`,{confirmLabel:'Excluir',danger:true}))return;
  if(botao)botao.disabled=true;
  try{
    const{error}=await excluirContaPorId(supa,conta.id);
    if(error){
      aviso('avisoConta','Não foi possível excluir a conta.','erro');
      return;
    }
    const{error:erroHistorico}=await supa.from('historico_excluidos').insert({
        casa_id:usuario.casa_id,usuario_id:usuario.id,
        modulo:'contas',registro_id:conta.id,dados:conta,
    });
    if(erroHistorico)console.error('Conta excluída, mas não foi possível registrar no histórico.',erroHistorico);
    await Promise.all([carregarContas(),carregarHoje()]);
    window.dispatchEvent(new CustomEvent('lifeos:contas-atualizadas'));
  }catch(e){
    aviso('avisoConta','Não foi possível excluir a conta.','erro');
  }finally{
    if(botao)botao.disabled=false;
  }
}

// --- HISTORICO DE CONTAS ---
async function abrirHistConta(conta) {
  _contaHistAtual = conta;
  el('hcNome').textContent = conta.nome;
  el('avisoRetro').textContent = '';
  el('hcValorRetro').value = '';
  // Preenche o mes atual no campo de retroativo
  const hoje = new Date();
  el('hcMes').value = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
  await renderizarHistConta(conta);
  el('modalHistConta').classList.remove('oculto');
  el('modalHistConta').classList.add('modal-aberto');
}

async function renderizarHistConta(conta) {
  // Busca todas as ocorrencias desta conta (mesmo nome, recorrente ou não)
  const { data: ocorrencias } = await supa
    .from('contas')
    .select('id, valor, vencimento, paga, paga_em')
    .eq('casa_id', usuario.casa_id)
    .eq('nome', conta.nome)
    .order('vencimento', { ascending: false })
    .limit(24);

  const todas = ocorrencias || [];
  const pagas = todas.filter(c => c.paga);
  const abertas = todas.filter(c => !c.paga);

  // Resumo
  const resumoEl = el('hcResumo');
  if (pagas.length > 0) {
    const valores = pagas.map(c => c.valor).filter(v => v != null);
    const media = valores.length ? valores.reduce((a,b)=>a+b,0)/valores.length : null;
    const ultimo = pagas[0]?.valor;
    const partes = [`${pagas.length} ${pagas.length===1?'mês pago':'meses pagos'}`];
    if (media != null) partes.push(`média ${formatarValor(media)}`);
    if (ultimo != null) partes.push(`último ${formatarValor(ultimo)}`);
    resumoEl.textContent = partes.join(' · ');
  } else {
    resumoEl.textContent = abertas.length > 0 ? 'Nenhum mês pago ainda.' : 'Nenhuma ocorrência encontrada.';
  }

  // Histórico mensal
  const area = el('hcHistorico');
  area.innerHTML = '';

  if (!todas.length) {
    area.innerHTML = '<div class="vazio">Nenhuma ocorrência encontrada.</div>';
    return;
  }

  // Calcular variação entre meses pagos consecutivos
  let anteriorValor = null;
  for (const c of todas) {
    const linha = document.createElement('div');
    linha.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 4px;border-bottom:1px solid var(--linha)';

    const venc = c.vencimento.slice(0,7); // YYYY-MM
    const [ano, mes] = venc.split('-');
    const nomesMes = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const mesLabel = `${nomesMes[Number(mes)]} ${ano}`;

    const esq = document.createElement('div');
    const mesSpan = document.createElement('div');
    mesSpan.style.cssText = 'font-size:14px;font-weight:600';
    mesSpan.textContent = mesLabel;

    const statusSpan = document.createElement('div');
    statusSpan.style.cssText = 'font-size:12px;margin-top:2px';
    statusSpan.style.color = c.paga ? 'var(--acao)' : 'var(--suave)';
    statusSpan.textContent = c.paga
      ? `Pago${c.paga_em ? ' em ' + new Date(c.paga_em).toLocaleDateString('pt-BR') : ''}`
      : 'Em aberto';

    esq.appendChild(mesSpan);
    esq.appendChild(statusSpan);

    const dir = document.createElement('div');
    dir.style.cssText = 'text-align:right';

    const valorSpan = document.createElement('div');
    valorSpan.style.cssText = 'font-size:15px;font-weight:600';
    valorSpan.textContent = formatarValor(c.valor);
    dir.appendChild(valorSpan);

    // Variação em relação ao mês anterior (só para pagos)
    if (c.paga && c.valor != null && anteriorValor != null) {
      const diff = c.valor - anteriorValor;
      const varSpan = document.createElement('div');
      varSpan.style.cssText = `font-size:11px;${diff > 0 ? 'color:var(--perigo)' : diff < 0 ? 'color:var(--acao)' : 'color:var(--suave)'}`;
      varSpan.textContent = diff === 0 ? '=' : (diff > 0 ? '▲ ' : '▼ ') + formatarValor(Math.abs(diff));
      dir.appendChild(varSpan);
    }
    if (c.paga && c.valor != null) anteriorValor = c.valor;

    linha.appendChild(esq);
    linha.appendChild(dir);
    area.appendChild(linha);
  }
}

async function adicionarRetroativo() {
  if (!_contaHistAtual) return;
  const mes = el('hcMes').value; // YYYY-MM
  if (!mes) { aviso('avisoRetro', 'Escolha o mês.', 'erro'); return; }
  const valor = el('hcValorRetro').value === '' ? null : Number(el('hcValorRetro').value);
  const vencimento = `${mes}-01`;
  el('btnAddRetro').disabled = true;
  // Verifica se já existe uma conta com esse nome e mês
  const { data: exist } = await supa.from('contas')
    .select('id').eq('casa_id', usuario.casa_id)
    .eq('nome', _contaHistAtual.nome)
    .gte('vencimento', `${mes}-01`).lte('vencimento', `${mes}-28`).limit(1);
  if (exist && exist.length > 0) {
    aviso('avisoRetro', 'Já existe uma conta para este mês.', 'erro');
    el('btnAddRetro').disabled = false;
    return;
  }
  const { error } = await supa.from('contas').insert({
    casa_id: usuario.casa_id,
    nome: _contaHistAtual.nome,
    valor,
    vencimento,
    paga: true,
    paga_em: new Date().toISOString(),
    recorrente: _contaHistAtual.recorrente,
    dia_vencimento: _contaHistAtual.dia_vencimento,
    criada_por: usuario.id,
  });
  el('btnAddRetro').disabled = false;
  if (error) { aviso('avisoRetro', 'Erro ao adicionar.', 'erro'); return; }
  aviso('avisoRetro', 'Mês adicionado.', 'ok');
  setTimeout(() => aviso('avisoRetro', ''), 1500);
  await renderizarHistConta(_contaHistAtual);
  await carregarContas();
}

// --- CONTAS ---
async function carregarContas(){
  const{data:contas,error}=await supa.from('contas').select('id,nome,categoria,valor,vencimento,paga,recorrente,dia_vencimento').eq('casa_id',usuario.casa_id).order('paga').order('vencimento');
  const area=el('itensContas');area.innerHTML='';
  if(error){area.innerHTML='<div class="vazio">Erro.</div>';return;}
  if(!contas||!contas.length){area.innerHTML='<div class="vazio">Nenhuma conta.</div>';return;}
  for(const conta of contas){
    const status=calcularStatusConta(conta),info=rotuloStatusConta(status);
    const l=document.createElement('div');l.className='item';l.dataset.recordId=conta.id;
    const d=document.createElement('div');d.className='desc';
    const n=document.createElement('span');n.className='nome';n.textContent=conta.nome+(conta.recorrente?' ↻':'');d.appendChild(n);
    const venc=conta.vencimento.slice(0,10).split('-').reverse().join('/');
    const m=document.createElement('span');m.className='meta';m.textContent=`${formatarValor(conta.valor)} · vence ${venc}`;d.appendChild(m);
    const dir=document.createElement('div');dir.className='est-controles';
    const badge=document.createElement('span');badge.className='badge';badge.style.background=info.cor;badge.textContent=info.texto;dir.appendChild(badge);
    if(!conta.paga){const btn=document.createElement('button');btn.textContent='Paguei';btn.style.cssText='padding:7px 12px;font-size:13px';btn.onclick=(e)=>{e.stopPropagation();pagarConta(conta,btn);};dir.appendChild(btn);}
    const btnEditC=document.createElement('button');btnEditC.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;btnEditC.title='Editar';btnEditC.style.cssText='background:none;color:var(--suave);padding:4px 6px;font-size:13px';btnEditC.onclick=(e)=>{e.stopPropagation();abrirEditarConta(conta);};
    const btnDelC=document.createElement('button');btnDelC.textContent='×';btnDelC.dataset.uiAction='delete';btnDelC.setAttribute('aria-label','Excluir conta');btnDelC.dataset.recordId=conta.id;btnDelC.dataset.lifeosDeleteFlow='app';btnDelC.style.cssText='background:none;color:var(--suave);padding:4px 6px';btnDelC.onclick=(e)=>{e.stopPropagation();removerConta(conta,btnDelC);};
    dir.appendChild(btnEditC);dir.appendChild(btnDelC);
    l.appendChild(d);l.appendChild(dir);
    l.style.cursor='pointer';
    l.onclick=()=>abrirHistConta(conta);
    area.appendChild(l);
  }
}

async function adicionarConta(){
  const nome=el('ctNome').value.trim(),vencimento=el('ctVenc').value,recorrente=el('ctRecorrente').checked;
  if(!nome){aviso('avisoConta','Digite o nome.','erro');return;}if(!vencimento){aviso('avisoConta','Escolha o vencimento.','erro');return;}
  const valor=el('ctValor').value===''?null:Number(el('ctValor').value);
  el('btnAddConta').disabled=true;
  const{data,error}=await supa.from('contas').insert({casa_id:usuario.casa_id,nome,valor,vencimento,recorrente,dia_vencimento:recorrente?Number(vencimento.slice(8,10)):null,criada_por:usuario.id}).select().single();
  if(data)supa.from('eventos').insert({tipo:'conta_criada',entidade:'contas',entidade_id:data.id,usuario_id:usuario.id,detalhe:usuario.nome+' cadastrou '+nome});
  el('btnAddConta').disabled=false;
  if(error){aviso('avisoConta','Erro.','erro');return;}
  el('ctNome').value='';el('ctValor').value='';el('ctVenc').value='';el('ctRecorrente').checked=false;
  aviso('avisoConta','Conta adicionada.','ok');setTimeout(()=>aviso('avisoConta',''),1500);await carregarContas();
}

async function pagarConta(conta,botao){
  botao.disabled=true;const{error}=await supa.from('contas').update({paga:true,paga_em:new Date().toISOString()}).eq('id',conta.id);
  if(error){botao.disabled=false;return;}
  supa.from('eventos').insert({tipo:'conta_paga',entidade:'contas',entidade_id:conta.id,usuario_id:usuario.id,detalhe:usuario.nome+' pagou '+conta.nome});
  if(conta.recorrente&&conta.dia_vencimento){const q=await confirmarAcao('Conta recorrente',`"${conta.nome}" repete todo mês. Criar a do próximo mês?`,{confirmLabel:'Criar próxima'});if(q){const base=new Date(conta.vencimento.slice(0,10)+'T00:00:00');const prox=new Date(base.getFullYear(),base.getMonth()+1,conta.dia_vencimento||base.getDate());await supa.from('contas').insert({casa_id:usuario.casa_id,nome:conta.nome,categoria:conta.categoria,valor:conta.valor,vencimento:`${prox.getFullYear()}-${String(prox.getMonth()+1).padStart(2,'0')}-${String(prox.getDate()).padStart(2,'0')}`,recorrente:true,dia_vencimento:conta.dia_vencimento,criada_por:usuario.id});}}
  await carregarContas();
}

// --- TAREFAS ---
// --- PROJETOS PESSOAIS ---
let _projetoAtual=null;
let _tarefaEditando=null;
let _contaEditando=null;
let _estoqueEditando=null;
let _listaEditando=null;
let _moduloHistorico='todos';
let _localCompraEditando=null;
let _localCompraEnderecos=[];
let _localCompraCategorias=[];

const STATUS_PROJ={
  nao_iniciado:{label:'Não iniciado',cor:'#6b7280'},
  em_andamento:{label:'Em andamento',cor:'#2f6f4f'},
  concluido:{label:'Concluído',cor:'#3b7dbf'},
  pausado:{label:'Pausado',cor:'#b8860b'},
};

async function carregarProjetos(){
  const{data,error}=await supa.from('projetos')
    .select('id,nome,descricao,status,frequencia,inicio,termino,criado_em')
    .eq('usuario_id',usuario.id)
    .order('criado_em',{ascending:false});
  const area=el('listaProjetos');area.innerHTML='';
  const lista=data||[];
  const ps=el('projetosSubtitulo');if(ps)ps.textContent=`${lista.length} ${lista.length===1?'projeto':'projetos'}`;
  if(error){area.innerHTML='<div class="cartao"><div class="vazio">Erro ao carregar.</div></div>';return;}
  if(!lista.length){area.innerHTML='<div class="cartao"><div class="vazio">Nenhum projeto ainda. Crie o primeiro acima.</div></div>';return;}
  const cartao=document.createElement('div');cartao.className='cartao';
  for(const p of lista){
    const div=document.createElement('div');div.className='projeto-card';
    const topo=document.createElement('div');topo.style.cssText='display:flex;justify-content:space-between;align-items:center';
    const nome=document.createElement('span');nome.style.cssText='font-size:15px;font-weight:600';nome.textContent=p.nome;
    const badge=document.createElement('span');badge.className='status-proj';
    const st=STATUS_PROJ[p.status]||STATUS_PROJ.nao_iniciado;
    badge.style.cssText=`background:${st.cor}20;color:${st.cor}`;badge.textContent=st.label;
    topo.appendChild(nome);topo.appendChild(badge);div.appendChild(topo);
    if(p.descricao){const desc=document.createElement('div');desc.style.cssText='font-size:13px;color:var(--suave);margin-top:4px';desc.textContent=p.descricao;div.appendChild(desc);}
    if(p.inicio||p.termino){
      const periodo=document.createElement('div');periodo.style.cssText='font-size:12px;color:var(--suave);margin-top:4px';
      const ini=p.inicio?p.inicio.slice(0,10).split('-').reverse().join('/'):'';
      const ter=p.termino?p.termino.slice(0,10).split('-').reverse().join('/'):'';
      periodo.textContent=ini&&ter?`${ini} → ${ter}`:ini||ter;div.appendChild(periodo);
    }
    div.onclick=()=>abrirPainelProjeto(p);
    cartao.appendChild(div);
  }
  area.appendChild(cartao);
}

async function abrirPainelProjeto(projeto){
  _projetoAtual=projeto;
  el('ppNome').textContent=projeto.nome;
  // Esconde a lista e mostra o painel
  [...ABAS_PRINCIPAIS,...SECOES_MAIS].forEach(id=>{const e=el(id);if(e){e.style.display='none';e.classList.add('oculto');}});
  el('abaPainelProjeto').style.display='block';el('abaPainelProjeto').classList.remove('oculto');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('ativa'));
  // Ocultar inputs
  el('inputObjetivo').style.display='none';el('inputObjetivo').classList.add('oculto');
  el('inputTarefaProjeto').style.display='none';el('inputTarefaProjeto').classList.add('oculto');
  el('inputItemProjeto').style.display='none';el('inputItemProjeto').classList.add('oculto');
  await renderizarPainelProjeto(projeto);
}

async function renderizarPainelProjeto(projeto){
  // Buscar tarefas e calcular progresso
  const{data:tarefas}=await supa.from('tarefas').select('id,titulo,feita,privado,data').eq('projeto_id',projeto.id).order('feita').order('criada_em',{ascending:true});
  const todas=tarefas||[];
  const concluidas=todas.filter(t=>t.feita).length;
  const pct=todas.length?Math.round(concluidas/todas.length*100):0;
  // Progresso
  const ppDiv=el('ppProgresso');ppDiv.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
      <div class="titulo-secao" style="margin:0">Progresso</div>
      <strong style="font-size:22px;color:var(--acao)">${pct}%</strong>
    </div>
    <div class="progresso-barra"><div class="progresso-fill" style="width:${pct}%"></div></div>
    <div style="font-size:12px;color:var(--suave);margin-top:4px">${concluidas} de ${todas.length} tarefas concluídas</div>
    ${projeto.descricao?`<div style="font-size:13px;color:var(--suave);margin-top:8px">${escapeHtml(projeto.descricao)}</div>`:''}
    ${projeto.inicio||projeto.termino?`<div style="font-size:12px;color:var(--suave);margin-top:4px">${projeto.inicio?projeto.inicio.slice(0,10).split('-').reverse().join('/'):'?'} → ${projeto.termino?projeto.termino.slice(0,10).split('-').reverse().join('/'):'?'}</div>`:''}
  `;
  // Objetivos
  const{data:objs}=await supa.from('projeto_objetivos').select('id,descricao').eq('projeto_id',projeto.id).order('ordem');
  const ppObj=el('ppObjetivos');ppObj.innerHTML='';
  if(!objs||!objs.length){ppObj.innerHTML='<div class="vazio" style="padding:12px 0">Nenhum objetivo ainda.</div>';}
  for(const o of(objs||[])){
    const linha=document.createElement('div');linha.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--linha);font-size:14px';
    const txt=document.createElement('span');txt.textContent='• '+o.descricao;
    const rem=document.createElement('button');rem.textContent='×';rem.dataset.uiAction='delete';rem.setAttribute('aria-label','Excluir objetivo');rem.style.cssText='background:none;color:var(--suave);padding:2px 6px';
    rem.onclick=async()=>{await supa.from('projeto_objetivos').delete().eq('id',o.id);await renderizarPainelProjeto(_projetoAtual);};
    linha.appendChild(txt);linha.appendChild(rem);ppObj.appendChild(linha);
  }
  // Tarefas do projeto
  const ppTar=el('ppTarefas');ppTar.innerHTML='';
  if(!todas.length){ppTar.innerHTML='<div class="vazio" style="padding:12px 0">Nenhuma tarefa ainda.</div>';}
  for(const t of todas){
    const linha=document.createElement('div');linha.style.cssText='display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--linha)';
    const ch=document.createElement('div');ch.className='check-tarefa'+(t.feita?' feita':'');ch.innerHTML=t.feita?iconeSvg('check',12):'';
    ch.onclick=async()=>{
      await supa.from('tarefas').update({feita:!t.feita,feita_por:!t.feita?usuario.id:null,feita_em:!t.feita?new Date().toISOString():null}).eq('id',t.id);
      await renderizarPainelProjeto(_projetoAtual);
    };
    const info=document.createElement('div');info.style.flex='1';
    const nome=document.createElement('div');nome.style.cssText='font-size:14px'+(t.feita?';text-decoration:line-through;color:var(--suave)':'');nome.textContent=t.titulo;
    const meta=document.createElement('div');meta.style.cssText='font-size:11px;color:var(--suave)';
    const partes=[];if(t.privado)partes.push({icone:'cadeado',texto:'Privada'});if(t.data)partes.push({texto:t.data.slice(0,10).split('-').reverse().join('/')});
    partes.forEach((parte,i)=>{if(i)meta.appendChild(document.createTextNode(' · '));if(parte.icone)meta.insertAdjacentHTML('beforeend',iconeSvg(parte.icone,11)+' ');meta.appendChild(document.createTextNode(parte.texto));});
    info.appendChild(nome);if(partes.length)info.appendChild(meta);
    const rem=document.createElement('button');rem.textContent='×';rem.dataset.uiAction='delete';rem.setAttribute('aria-label','Excluir tarefa');rem.style.cssText='background:none;color:var(--suave);padding:2px 6px';
    rem.onclick=async()=>{await supa.from('tarefas').delete().eq('id',t.id);await renderizarPainelProjeto(_projetoAtual);};
    linha.appendChild(ch);linha.appendChild(info);linha.appendChild(rem);ppTar.appendChild(linha);
  }
  // Itens do projeto
  const{data:itens}=await supa.from('projeto_itens').select('id,nome,estoque_id').eq('projeto_id',projeto.id);
  const ppIt=el('ppItens');ppIt.innerHTML='';
  if(!itens||!itens.length){ppIt.innerHTML='<div class="vazio" style="padding:12px 0">Nenhum item vinculado.</div>';}
  for(const it of(itens||[])){
    const linha=document.createElement('div');linha.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--linha);font-size:14px';
    const txt=document.createElement('span');txt.textContent=it.nome;
    const dir=document.createElement('div');dir.style.cssText='display:flex;gap:6px;align-items:center';
    const btnLista=document.createElement('button');btnLista.textContent='→ Lista';btnLista.style.cssText='font-size:11px;padding:4px 8px;background:var(--acao-clara);color:var(--acao)';
    btnLista.onclick=async()=>{await supa.from('lista_compras').insert({casa_id:usuario.casa_id,nome:it.nome,status:'pendente',origem:'projeto',criado_por:usuario.id});await carregarLista();};
    const rem=document.createElement('button');rem.textContent='×';rem.dataset.uiAction='delete';rem.setAttribute('aria-label','Excluir item do projeto');rem.style.cssText='background:none;color:var(--suave);padding:2px 6px';
    rem.onclick=async()=>{await supa.from('projeto_itens').delete().eq('id',it.id);await renderizarPainelProjeto(_projetoAtual);};
    dir.appendChild(btnLista);dir.appendChild(rem);linha.appendChild(txt);linha.appendChild(dir);ppIt.appendChild(linha);
  }
}

async function salvarProjeto(){
  const nome=el('projNome').value.trim();
  if(!nome){aviso('avisoProjeto','Digite o nome.','erro');return;}
  el('btnSalvarProjeto').disabled=true;
  const payload={
    usuario_id:usuario.id,nome,descricao:el('projDesc').value.trim()||null,
    status:el('projStatus').value,frequencia:el('projFreq').value,
    inicio:el('projInicio').value||null,termino:el('projTermino').value||null,
  };
  let error;
  if(_projetoAtual&&el('modalProjetoTitulo').textContent==='Editar projeto'){
    ({error}=await supa.from('projetos').update(payload).eq('id',_projetoAtual.id));
    if(!error){_projetoAtual={..._projetoAtual,...payload};}
  }else{
    const{error:e}=await supa.from('projetos').insert(payload);error=e;
  }
  el('btnSalvarProjeto').disabled=false;
  if(error){aviso('avisoProjeto','Erro ao salvar.','erro');return;}
  fecharModal('modalProjeto');
  await carregarProjetos();
  if(_projetoAtual&&el('abaPainelProjeto')&&!el('abaPainelProjeto').classList.contains('oculto')){
    el('ppNome').textContent=_projetoAtual.nome;
    await renderizarPainelProjeto(_projetoAtual);
  }
}

async function removerProjeto(){
  if(!_projetoAtual)return;
  if(!await confirmarAcao('Remover projeto',`Remover o projeto "${_projetoAtual.nome}"? Todas as tarefas e objetivos vinculados serão removidos.`,{confirmLabel:'Remover',danger:true}))return;
  await supa.from('projetos').delete().eq('id',_projetoAtual.id);
  _projetoAtual=null;
  trocarAba('projetos');
  await carregarProjetos();
}

function toggleInputProjeto(id){
  const el2=el(id);if(!el2)return;const vis=el2.style.display==='none'||el2.classList.contains('oculto');
  el2.style.display=vis?'block':'none';
  if(vis)el2.classList.remove('oculto');else el2.classList.add('oculto');
}

async function carregarTarefas(){
  const{data:tarefas,error}=await supa.from('tarefas').select('id,titulo,responsavel,prioridade,data,feita,recorrente,recorrencia,privado,projeto_id').eq('casa_id',usuario.casa_id).order('feita').order('data',{nullsFirst:true});
  const area=el('itensTarefas');area.innerHTML='';
  if(error){area.innerHTML='<div class="vazio">Erro.</div>';return;}
  // Filtra: só tarefas gerais (sem projeto), e privadas só do usuario logado
  const gerais=(tarefas||[]).filter(t=>(t.projeto_id===null||t.projeto_id===undefined)&&(!t.privado||t.responsavel===usuario.nome.toLowerCase()||t.responsavel==='ambos'));
  if(!gerais.length){area.innerHTML='<div class="vazio">Nenhuma tarefa.</div>';return;}
  // Separa privadas das publicas
  const publicas=gerais.filter(t=>!t.privado);
  const privadas=gerais.filter(t=>t.privado);
  const todasOrdenadas=[...publicas,...privadas];
  if(privadas.length){
    const sep=document.createElement('div');sep.style.cssText='font-size:11px;color:var(--suave);text-transform:uppercase;letter-spacing:.05em;padding:12px 4px 4px;border-bottom:1px solid var(--linha);margin-bottom:4px';
    // Será inserido antes das privadas — tratamos abaixo
  }
  const tarefas2=todasOrdenadas;
  for(const t of tarefas2){
    const l=document.createElement('div');l.className='item'+(t.feita?' concluida':'');
    const ch=document.createElement('div');ch.className='check-tarefa'+(t.feita?' feita':'');ch.innerHTML=t.feita?iconeSvg('check',12):'';ch.onclick=()=>alternarTarefa(t);
    const d=document.createElement('div');d.className='desc';d.style.cssText='flex:1;margin-left:12px';
    const n=document.createElement('span');n.className='nome';n.textContent=t.titulo;d.appendChild(n);
    const quem=t.responsavel==='ambos'?'Ambos':t.responsavel.charAt(0).toUpperCase()+t.responsavel.slice(1);
    const ps=[quem];if(t.recorrente&&t.recorrencia)ps.push(t.recorrencia);if(t.data)ps.push(t.data.slice(0,10).split('-').reverse().join('/'));
    const m=document.createElement('span');m.className='meta';m.textContent=ps.join(' · ');d.appendChild(m);
    const acoesTarefa=document.createElement('div');acoesTarefa.style.cssText='display:flex;gap:2px;align-items:center';
    const btnEdit=document.createElement('button');btnEdit.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;btnEdit.title='Editar';btnEdit.style.cssText='background:none;color:var(--suave);padding:4px 6px;display:flex;align-items:center;';btnEdit.onclick=()=>abrirEditarTarefa(t);
    const br=document.createElement('button');br.textContent='×';br.dataset.uiAction='delete';br.setAttribute('aria-label','Excluir tarefa');br.style.cssText='background:none;color:var(--suave);padding:4px 6px';br.onclick=()=>removerTarefa(t);
    acoesTarefa.appendChild(btnEdit);acoesTarefa.appendChild(br);
    const esq=document.createElement('div');esq.style.cssText='display:flex;align-items:center;flex:1';esq.appendChild(ch);esq.appendChild(d);l.appendChild(esq);l.appendChild(acoesTarefa);area.appendChild(l);
  }
}

function abrirEditarTarefa(t){
  _tarefaEditando=t;
  el('etTitulo').value=t.titulo||'';
  el('etResp').value=t.responsavel||'ambos';
  el('etData').value=t.data?t.data.slice(0,10):'';
  el('etRecorrente').checked=!!t.recorrente;
  el('etRecorrencia').value=t.recorrencia||'';
  el('etRecorrenciaBox').classList.toggle('oculto',!t.recorrente);
  aviso('avisoEditarTarefa','');
  abrirModal('modalEditarTarefa');
}

async function salvarEditarTarefa(){
  if(!_tarefaEditando)return;
  const titulo=el('etTitulo').value.trim();
  if(!titulo){aviso('avisoEditarTarefa','Digite o título.','erro');return;}
  el('btnSalvarEditarTarefa').disabled=true;
  const recorrente=el('etRecorrente').checked;
  const{error}=await supa.from('tarefas').update({
    titulo,responsavel:el('etResp').value,
    data:el('etData').value||null,
    recorrente,recorrencia:recorrente?el('etRecorrencia').value.trim()||null:null,
  }).eq('id',_tarefaEditando.id);
  el('btnSalvarEditarTarefa').disabled=false;
  if(error){aviso('avisoEditarTarefa','Erro ao salvar.','erro');return;}
  fecharModal('modalEditarTarefa');
  _tarefaEditando=null;
  await carregarTarefas();
}

async function adicionarTarefa(){
  const titulo=el('tfTitulo').value.trim();if(!titulo){aviso('avisoTarefa','Digite o título.','erro');return;}
  const recorrente=el('tfRecorrente').checked;el('btnAddTarefa').disabled=true;
  const{data,error}=await supa.from('tarefas').insert({casa_id:usuario.casa_id,titulo,responsavel:el('tfResp').value,data:el('tfData').value||null,recorrente,recorrencia:recorrente?el('tfRecorrencia').value.trim()||null:null,criada_por:usuario.id}).select().single();
  if(data)supa.from('eventos').insert({tipo:'tarefa_criada',entidade:'tarefas',entidade_id:data.id,usuario_id:usuario.id,detalhe:usuario.nome+' criou '+titulo});
  el('btnAddTarefa').disabled=false;
  if(error){aviso('avisoTarefa','Erro.','erro');return;}
  el('tfTitulo').value='';el('tfData').value='';el('tfRecorrente').checked=false;el('tfRecorrencia').value='';el('tfRecorrenciaBox').classList.add('oculto');
  aviso('avisoTarefa','Tarefa adicionada.','ok');setTimeout(()=>aviso('avisoTarefa',''),1500);await carregarTarefas();
}

async function alternarTarefa(t){
  const novo=!t.feita;
  let criarProxima=false;
  if(novo&&t.recorrente){
    if(typeof window.lifeosConfirmRecurringTask==='function'){
      const escolha=await window.lifeosConfirmRecurringTask({
        title:'Concluir rotina',
        message:`"${t.titulo}" é recorrente. Você quer concluir esta ocorrência e criar a próxima?`,
        confirmLabel:'Concluir e criar próxima',
        secondaryLabel:'Só concluir'
      });
      if(!escolha)return;
      criarProxima=escolha==='confirm';
    }else{
      const q=confirm(`"${t.titulo}" é uma rotina.\nCriar a próxima?`);
      if(!q)return;
      criarProxima=true;
    }
  }
  const{error}=await supa.from('tarefas').update({feita:novo,feita_por:novo?usuario.id:null,feita_em:novo?new Date().toISOString():null}).eq('id',t.id);
  if(error)return;
  supa.from('eventos').insert({tipo:novo?'tarefa_concluida':'tarefa_reaberta',entidade:'tarefas',entidade_id:t.id,usuario_id:usuario.id,detalhe:`${usuario.nome} ${novo?'concluiu':'reabriu'} ${t.titulo}`});
  if(criarProxima)await supa.from('tarefas').insert({casa_id:usuario.casa_id,titulo:t.titulo,responsavel:t.responsavel,prioridade:t.prioridade,recorrente:true,recorrencia:t.recorrencia,criada_por:usuario.id});
  await carregarTarefas();
}

async function removerTarefa(t){
  const confirmado=typeof window.lifeosConfirmAction==='function'
    ?await window.lifeosConfirmAction({title:'Excluir tarefa',message:`Excluir a tarefa "${t.titulo}"?`,confirmLabel:'Excluir',danger:true})
    :confirm(`Excluir a tarefa "${t.titulo}"?`);
  if(!confirmado)return;
  const{error}=await supa.from('tarefas').delete().eq('id',t.id);
  if(!error){
    // Guarda no histórico de excluídos
    supa.from('historico_excluidos').insert({
      casa_id:usuario.casa_id,usuario_id:usuario.id,
      modulo:'tarefas',registro_id:t.id,
      dados:t,
    });
    supa.from('eventos').insert({tipo:'tarefa_removida',entidade:'tarefas',entidade_id:t.id,usuario_id:usuario.id,detalhe:usuario.nome+' removeu a tarefa: '+t.titulo});
    await carregarTarefas();
  }
}

// --- HOJE ---
async function carregarHoje(){
  atualizarDataHoje();
  const dados=await montarHoje(supa,usuario);
  // Hero destaque
  const urgentes=contarUrgentes(_plantasCache);
  const heroTit=el('heroTitulo');const heroSub=el('heroSub');
  if(dados.tarefasAtencao&&dados.tarefasAtencao.length>0){
    if(heroTit)heroTit.textContent=dados.tarefasAtencao[0].titulo;
    if(heroSub)heroSub.textContent=`${dados.tarefasAtencao.length} tarefa${dados.tarefasAtencao.length>1?'s':''} pendente${dados.tarefasAtencao.length>1?'s':''} hoje`;
  }else if(dados.cardapioHoje){
    if(heroTit)heroTit.textContent=dados.cardapioHoje.almoco||dados.cardapioHoje.janta||'Cardápio do dia';
    if(heroSub)heroSub.textContent='Cardápio planejado para hoje';
  }else if(urgentes>0){
    if(heroTit)heroTit.textContent=`${urgentes} planta${urgentes>1?'s precisam':' precisa'} de cuidado`;
    if(heroSub)heroSub.textContent='Confira a aba Plantas';
  }else{
    if(heroTit)heroTit.textContent='Tudo em dia!';
    if(heroSub)heroSub.textContent='Nenhuma pendência para hoje';
  }
  // Métricas rápidas
  const mg=el('metricasHoje');
  if(mg){
    const tarefasN=dados.tarefasAtencao?.length||0;
    const contasN=dados.contasAtencao?.length||0;
    const comprasN=dados.compras?.total||0;
    const estN=dados.estoqueAtencao?.length||0;
    mg.innerHTML=`
      <div class="metrica mi-sage clicavel" role="button" tabindex="0" data-ui-destination="tarefas"><div class="metrica-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></div><div class="metrica-num">${tarefasN}</div><div class="metrica-label">Tarefas</div></div>
      <div class="metrica mi-clay clicavel" role="button" tabindex="0" data-ui-destination="contas"><div class="metrica-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div><div class="metrica-num">${contasN}</div><div class="metrica-label">Contas</div></div>
      <div class="metrica mi-sky clicavel" role="button" tabindex="0" data-ui-destination="compras"><div class="metrica-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.93-1.46l1.38-5.53H6"/></svg></div><div class="metrica-num">${comprasN}</div><div class="metrica-label">Lista</div></div>
      <div class="metrica mi-sun clicavel" role="button" tabindex="0" data-ui-destination="estoque"><div class="metrica-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg></div><div class="metrica-num">${estN}</div><div class="metrica-label">Estoque</div></div>
      <div class="metrica mi-sage clicavel metrica-cardapio" role="button" tabindex="0" data-ui-destination="cardapio" aria-label="Abrir Cardápio"><div class="metrica-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 3v7M4 3v4a3 3 0 006 0V3M7 10v11M15 3v18M15 3c3 0 5 2.7 5 6s-2 5-5 5"/></svg></div><div class="metrica-cardapio-copy"><div class="metrica-cardapio-titulo">Cardápio da Casa</div><div class="metrica-label">Almoço e jantar da semana</div></div><span class="metrica-cardapio-acao">Abrir</span></div>
    `;
  }
  const area=el('cardsHoje');area.innerHTML='';

  // Card plantas (se houver urgentes)
  const urgentesCards=contarUrgentes(_plantasCache);
  if(urgentesCards>0){
    const card=criarCartaoHoje('Plantas','plantas');
    card.corpo.appendChild(miniItem(`${urgentesCards} ${urgentesCards===1?'planta precisa':'plantas precisam'} de cuidado`,'',''));
    area.appendChild(card.cartao);
  }

  {
    const card=criarCartaoHoje('Cardápio de hoje','cardapio');const ch=dados.cardapioHoje;
    if(ch){
      if(ch.itens?.length){
        ch.itens.slice(0,4).forEach(item=>{
          const resp=item.responsavel==='ambos'?'Ambos':item.responsavel.charAt(0).toUpperCase()+item.responsavel.slice(1);
          card.corpo.appendChild(miniItem(`${labelTipoCardapio(item.tipo)} · ${resp}`,item.nome,item.calorias!=null?`${Number(item.calorias)} kcal`:''));
        });
      }else{
        if(ch.almoco)card.corpo.appendChild(miniItem('Almoço',ch.almoco,''));
        if(ch.janta)card.corpo.appendChild(miniItem('Jantar',ch.janta,''));
        if(ch.responsavel)card.corpo.appendChild(miniItem('Responsável',ch.responsavel==='ambos'?'Ambos':ch.responsavel.charAt(0).toUpperCase()+ch.responsavel.slice(1),''));
      }
    }else{
      card.corpo.appendChild(miniItem('Sem refeições planejadas','Toque para montar a semana',''));
    }
    area.appendChild(card.cartao);
  }

  if(dados.tudoEmDia&&urgentesCards===0){const w=document.createElement('div');w.className='card-hoje';const c=document.createElement('div');c.className='cartao';c.innerHTML='<div class="tudo-em-dia">Tudo em dia por aqui.</div>';w.appendChild(c);area.appendChild(w);}
if(dados.tarefasAtencao&&dados.tarefasAtencao.length){const card=criarCartaoHoje('Tarefas da Casa','tarefas');for(const t of dados.tarefasAtencao){const q=t.responsavel==='ambos'?'Ambos':t.responsavel.charAt(0).toUpperCase()+t.responsavel.slice(1);card.corpo.appendChild(miniItem(t.titulo,q,''));}area.appendChild(card.cartao);}
  if(dados.estoqueAtencao.length){const card=criarCartaoHoje('Estoque em atenção','estoque');for(const i of dados.estoqueAtencao)card.corpo.appendChild(miniItem(i.nome,`${i.quantidade} · ${i.status==='acabou'?'acabou':'baixo'}`,''));area.appendChild(card.cartao);}
  if(dados.compras.total){const card=criarCartaoHoje('Compras','compras');for(const n of dados.compras.primeiros)card.corpo.appendChild(miniItem(n,'',''));if(dados.compras.total>dados.compras.primeiros.length){const r=document.createElement('div');r.className='mini-item';r.style.color='var(--suave)';r.textContent=`+ mais ${dados.compras.total-dados.compras.primeiros.length} na lista`;card.corpo.appendChild(r);}area.appendChild(card.cartao);}
}

function criarCartaoHoje(titulo,dest){
  const wrap=document.createElement('div');wrap.className='card-hoje';
  const c=document.createElement('div');c.className='cartao qa-collapsible-card qa-collapsed';c.dataset.qaDestination=dest;
  const cab=document.createElement('div');cab.className='card-hoje-head';
  const grupo=document.createElement('div');grupo.className='card-hoje-title-row';
  const iconMap={tarefas:'prancheta',plantas:'broto',estoque:'caixa',compras:'carrinho',cardapio:'refeicao',contas:'cartao'};
  if(iconMap[dest]){const ico=document.createElement('span');ico.className='card-hoje-head-icon';ico.innerHTML=iconeSvg(iconMap[dest],17);grupo.appendChild(ico);}
  const t=document.createElement('div');t.className='card-hoje-titulo-txt';t.textContent=titulo;grupo.appendChild(t);
  const acoes=document.createElement('div');acoes.className='qa-card-actions';
  const abrir=document.createElement('button');abrir.type='button';abrir.className='card-hoje-abrir qa-card-open';abrir.textContent='Abrir';abrir.dataset.uiDestination=dest;
  const toggle=document.createElement('button');toggle.type='button';toggle.className='qa-card-toggle';toggle.setAttribute('aria-label','Expandir '+titulo);toggle.setAttribute('aria-expanded','false');toggle.innerHTML='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  toggle.onclick=event=>{event.preventDefault();event.stopPropagation();const recolhido=c.classList.toggle('qa-collapsed');toggle.setAttribute('aria-expanded',recolhido?'false':'true');toggle.setAttribute('aria-label',(recolhido?'Expandir ':'Recolher ')+titulo);};
  acoes.appendChild(abrir);acoes.appendChild(toggle);cab.appendChild(grupo);cab.appendChild(acoes);
  const corpo=document.createElement('div');corpo.className='qa-card-body';c.appendChild(cab);c.appendChild(corpo);
  wrap.appendChild(c);return{cartao:wrap,corpo};
}
function miniItem(nome,meta,valor){const l=document.createElement('div');l.className='mini-item';const e=document.createElement('span');e.textContent=nome;const d=document.createElement('span');d.className='mini-meta';d.textContent=[meta,valor].filter(Boolean).join(' · ');l.appendChild(e);l.appendChild(d);return l;}

// --- EVENTOS DA LINHA DO TEMPO ---
const TIPO_LABEL_EV={cadastro:{icone:'prancheta',texto:'Cadastro'},rega:{icone:'gota',texto:'Rega'},troca_agua:{icone:'atualizar',texto:'Troca de água'},imersao:{icone:'balde',texto:'Imersão'},adubacao:{icone:'broto',texto:'Adubação'},poda:{icone:'tesoura',texto:'Poda'},observacao:{icone:'anotacao',texto:'Obs.'},alteracao_status:{icone:'repetir',texto:'Status'},muda_retirada:{icone:'broto',texto:'Muda'}};

async function renderizarEventosPlanta(planta){
  const{data:eventos}=await supa.from('planta_eventos').select('id,tipo,data,notas').eq('planta_id',planta.id).order('data',{ascending:false}).limit(30);
  const evArea=el('mpEventos');evArea.innerHTML='';
  if(!eventos||!eventos.length){evArea.innerHTML='<div class="vazio">Nenhum evento registrado ainda.</div>';return;}
  for(const ev of eventos){
    const div=document.createElement('div');div.className='evento-linha';div.style.alignItems='flex-start';
    const data=document.createElement('span');data.className='evento-data';data.textContent=new Date(ev.data).toLocaleDateString('pt-BR');
    const corpo=document.createElement('div');corpo.style.cssText='flex:1;font-size:13px';
    const tipoInfo=TIPO_LABEL_EV[ev.tipo];
    const notaSpan=document.createElement('span');notaSpan.style.cssText='display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap';
    if(tipoInfo){notaSpan.insertAdjacentHTML('beforeend',iconeSvg(tipoInfo.icone,14));notaSpan.appendChild(document.createTextNode(tipoInfo.texto));}
    else{notaSpan.appendChild(document.createTextNode(ev.tipo));}
    if(ev.notas)notaSpan.appendChild(document.createTextNode(' — '+ev.notas));
    corpo.appendChild(notaSpan);
    // Botoes editar e remover (só para tipos editáveis)
    const acoes=document.createElement('div');acoes.style.cssText='display:flex;gap:6px;margin-top:4px';
    if(ev.tipo==='observacao'||ev.notas){
      const btnEdit=document.createElement('button');btnEdit.textContent='Editar';btnEdit.style.cssText='background:none;color:var(--acao);font-size:11px;padding:2px 6px;font-weight:400;border:1px solid var(--acao);border-radius:6px';
      btnEdit.onclick=async()=>{
        const novaNota=prompt('Editar observação:',ev.notas||'');
        if(novaNota===null)return;
        await supa.from('planta_eventos').update({notas:novaNota}).eq('id',ev.id);
        await renderizarEventosPlanta(planta);
      };
      acoes.appendChild(btnEdit);
    }
    const btnDel=document.createElement('button');btnDel.textContent='×';btnDel.dataset.uiAction='delete';btnDel.setAttribute('aria-label','Excluir evento');btnDel.style.cssText='background:none;color:var(--suave);font-size:13px;padding:2px 6px;font-weight:400';
    btnDel.onclick=async()=>{
      if(!await confirmarAcao('Remover evento','Remover este evento da linha do tempo?',{confirmLabel:'Remover',danger:true}))return;
      await supa.from('planta_eventos').delete().eq('id',ev.id);
      await renderizarEventosPlanta(planta);
    };
    acoes.appendChild(btnDel);
    corpo.appendChild(acoes);
    div.appendChild(data);div.appendChild(corpo);evArea.appendChild(div);
  }
}

// --- NOVA PLANTA ---
async function abrirModalNovaPlanta(){
  const{codigo,numero_etiqueta}=await import('./plantas.js').then(m=>m.proximoCodigo(supa,usuario));
  el('npCodigoPreview').textContent=`Próximo código: ${codigo} · Etiqueta ${numero_etiqueta}`;
  // Preencher select de especies
  const sel=el('npEspecie');sel.innerHTML='<option value="">— Selecionar espécie —</option><option value="__nova__">+ Nova espécie</option>';
  for(const e of _especies){const o=document.createElement('option');o.value=e.id;o.textContent=e.nome_popular;sel.appendChild(o);}
  // Reset campos
  el('npApelido').value='';el('npPosicao').value='';el('npObs').value='';
  el('npNovaEspecieBox').style.display='none';el('npNovaEspecie').value='';
  el('npRotinaI').value='7';aviso('avisoNovaPlanta','');
  abrirModal('modalNovaPlanta');
}

async function salvarNovaPlanta(){
  const especieId=el('npEspecie').value;
  const novaEspecie=el('npNovaEspecie').value.trim();
  if(!especieId&&!novaEspecie){aviso('avisoNovaPlanta','Escolha ou crie uma espécie.','erro');return;}
  const comodo=el('npComodo').value;
  if(!comodo){aviso('avisoNovaPlanta','Escolha o cômodo.','erro');return;}
  el('btnSalvarNovaPlanta').disabled=true;
  let espId=especieId==='__nova__'?null:especieId||null;
  // Se for especie nova, cadastra primeiro
  if(especieId==='__nova__'&&novaEspecie){
    const metodo=el('npMetodo').value;
    const perfil=el('npPerfil').value;
    const{data:esp}=await supa.from('especies').insert({
      casa_id:usuario.casa_id,nome_popular:novaEspecie,
      perfil_hidrico:perfil,metodo_cultivo:metodo,
      rotina_principal:el('npRotinaT').value,
      intervalo_dias:Number(el('npRotinaI').value),
    }).select().single();
    if(esp)espId=esp.id;
  }
  const perfil=el('npPerfil').value;
  const corMap={alto:'verde',medio:'laranja',baixo:'azul'};
  const res=await cadastrarPlanta(supa,usuario,{
    especie_id:espId,
    nome_personalizado:el('npApelido').value.trim()||null,
    comodo,posicao:el('npPosicao').value.trim()||null,
    metodo_cultivo:el('npMetodo').value,
    perfil_hidrico:perfil,
    cor_etiqueta:corMap[perfil]||null,
    observacoes:el('npObs').value.trim()||null,
    rotina_tipo:el('npRotinaT').value,
    rotina_intervalo:el('npRotinaI').value,
  });
  el('btnSalvarNovaPlanta').disabled=false;
  if(!res.ok){aviso('avisoNovaPlanta','Erro ao salvar: '+res.motivo,'erro');return;}
  aviso('avisoNovaPlanta',`${res.codigo} cadastrada com sucesso!`,'ok');
  await atualizarPlantas();
  setTimeout(()=>{fecharModal('modalNovaPlanta');},1500);
}

// Quando muda a especie no select, preenche metodo/perfil/rotina automaticamente
function aoEscolherEspecie(){
  const val=el('npEspecie').value;
  el('npNovaEspecieBox').style.display=val==='__nova__'?'block':'none';
  if(val&&val!=='__nova__'){
    const esp=_especies.find(e=>e.id===val);
    if(esp){
      el('npMetodo').value=esp.metodo_cultivo||'substrato';
      el('npPerfil').value=esp.perfil_hidrico||'medio';
      if(esp.rotina_principal)el('npRotinaT').value=esp.rotina_principal;
      if(esp.intervalo_dias)el('npRotinaI').value=esp.intervalo_dias;
    }
  }
}

// ===================================================================
// CONFIGURAÇÕES
// ===================================================================

// --- TOKENS ---
async function carregarTokens(){
  const{data}=await supa.from('atalho_tokens').select('id,token,nome,ativo,criado_em').order('criado_em');
  const area=el('listaTokens');area.innerHTML='';
  if(!data||!data.length){area.innerHTML='<div class="vazio">Nenhum token cadastrado.</div>';return;}
  for(const t of data){
    const linha=document.createElement('div');linha.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--linha);font-size:13px';
    const esq=document.createElement('div');
    esq.innerHTML=`<div style="font-weight:600">${escapeHtml(t.nome||'Sem nome')}</div><div style="font-size:11px;color:var(--suave);margin-top:2px">${escapeHtml(t.token.slice(0,16))}…</div>`;
    const dir=document.createElement('div');dir.style.cssText='display:flex;gap:6px';
    const badge=document.createElement('span');badge.className='badge';badge.style.background=t.ativo?'#2f6f4f':'#6b7280';badge.textContent=t.ativo?'Ativo':'Inativo';
    const btnRev=document.createElement('button');btnRev.textContent=t.ativo?'Revogar':'Reativar';btnRev.style.cssText='font-size:11px;padding:4px 8px;background:var(--acao-clara);color:var(--acao)';
    btnRev.onclick=async()=>{await supa.from('atalho_tokens').update({ativo:!t.ativo}).eq('id',t.id);carregarTokens();};
    const btnDel=document.createElement('button');btnDel.textContent='×';btnDel.dataset.uiAction='delete';btnDel.setAttribute('aria-label','Excluir token');btnDel.style.cssText='background:none;color:var(--suave);padding:4px 6px';
    btnDel.onclick=async()=>{if(!await confirmarAcao('Excluir token','Excluir este token? O Atalho vai parar de funcionar.',{confirmLabel:'Excluir',danger:true}))return;await supa.from('atalho_tokens').delete().eq('id',t.id);carregarTokens();};
    dir.appendChild(badge);dir.appendChild(btnRev);dir.appendChild(btnDel);
    linha.appendChild(esq);linha.appendChild(dir);area.appendChild(linha);
  }
}

async function gerarNovoToken(){
  const nome=prompt('Nome para identificar este token (ex: iPhone de Mateus):');
  if(!nome)return;
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
  // Busca o usuario_id pelo nome
  const{data:u}=await supa.from('usuarios').select('id').eq('casa_id',usuario.casa_id).ilike('nome',`%${nome.split(' ')[0]}%`).limit(1);
  const uid=u?.[0]?.id||usuario.id;
  const{error}=await supa.from('atalho_tokens').insert({usuario_id:uid,token,nome,ativo:true});
  if(error){aviso('avisoTokens','Erro ao gerar token.','erro');return;}
  aviso('avisoTokens','Token gerado: '+token,'ok');
  carregarTokens();
}

// --- LOCAIS DO ESTOQUE ---
let _locaisEstoque=[];

async function carregarLocaisEstoque(){
  const{data}=await supa.from('locais_estoque').select('id,nome,ordem,ativo').eq('casa_id',usuario.casa_id).eq('ativo',true).order('ordem');
  _locaisEstoque=data||[];
  const area=el('listaLocaisEstoque');if(!area)return;area.innerHTML='';
  for(const loc of _locaisEstoque){
    const linha=document.createElement('div');linha.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--linha);font-size:13px';
    const txt=document.createElement('span');txt.textContent=loc.nome;
    const dir=document.createElement('div');dir.style.cssText='display:flex;gap:4px';
    const btnEdit=document.createElement('button');btnEdit.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;btnEdit.style.cssText='background:none;color:var(--suave);padding:4px 6px;display:flex;align-items:center;';
    btnEdit.onclick=()=>{const novo=prompt('Novo nome:',loc.nome);if(novo&&novo.trim()){supa.from('locais_estoque').update({nome:novo.trim()}).eq('id',loc.id).then(()=>{carregarLocaisEstoque();atualizarSelectsLocais();});}};
    const btnDel=document.createElement('button');btnDel.textContent='Arquivar';btnDel.setAttribute('aria-label','Arquivar local do estoque');btnDel.style.cssText='font-size:11px;padding:4px 8px;background:var(--paper-2);color:var(--muted)';
    btnDel.onclick=async()=>{if(!await confirmarAcao('Arquivar local',`Arquivar "${loc.nome}"? O local deixará de aparecer nas opções ativas.`,{confirmLabel:'Arquivar'}))return;await supa.from('locais_estoque').update({ativo:false}).eq('id',loc.id);carregarLocaisEstoque();atualizarSelectsLocais();};
    dir.appendChild(btnEdit);dir.appendChild(btnDel);linha.appendChild(txt);linha.appendChild(dir);area.appendChild(linha);
  }
  atualizarSelectsLocais();
}

async function salvarNovoLocalEstoque(){
  const nome=el('nomeNovoLocalEstoque').value.trim();
  if(!nome)return;
  const ordem=(_locaisEstoque.length?Math.max(..._locaisEstoque.map(l=>l.ordem)):0)+1;
  await supa.from('locais_estoque').insert({casa_id:usuario.casa_id,nome,ordem});
  el('nomeNovoLocalEstoque').value='';
  toggleInputProjeto('inputNovoLocalEstoque');
  carregarLocaisEstoque();
}

// Atualiza todos os selects de local no app com os locais do banco
function atualizarSelectsLocais(){
  const ids=['estLocal','eeLocal','invLocal'];
  for(const id of ids){
    const sel=el(id);if(!sel)continue;
    const val=sel.value;
    sel.innerHTML='<option value="">— Sem local —</option>';
    for(const loc of _locaisEstoque){const o=document.createElement('option');o.value=loc.nome;o.textContent=loc.nome;sel.appendChild(o);}
    sel.value=val;
  }
}

// --- LOCAIS DE COMPRA ---
async function carregarLocaisCompraConfig(){
  const{data}=await supa.from('locais_compra').select('id,nome,ativo,locais_compra_enderecos(id,endereco,latitude,longitude),locais_compra_categorias(id,local_estoque)').eq('casa_id',usuario.casa_id).order('nome');
  const area=el('listaLocaisCompra');if(!area)return;area.innerHTML='';
  if(!data||!data.length){area.innerHTML='<div class="vazio">Nenhum local cadastrado.</div>';return;}
  for(const loc of data){
    const linha=document.createElement('div');linha.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--linha)';
    const esq=document.createElement('div');
    const n=document.createElement('div');n.style.cssText='font-size:14px;font-weight:600';n.textContent=loc.nome+(loc.ativo?'':' (inativo)');
    const m=document.createElement('div');m.style.cssText='font-size:11px;color:var(--suave);margin-top:2px';
    m.textContent=`${(loc.locais_compra_enderecos||[]).length} endereço(s) · ${(loc.locais_compra_categorias||[]).length} categoria(s)`;
    esq.appendChild(n);esq.appendChild(m);
    const btnEdit=document.createElement('button');btnEdit.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span style='margin-left:4px'>Editar</span>`;btnEdit.style.cssText='font-size:12px;padding:6px 10px;background:var(--acao-clara);color:var(--acao);display:flex;align-items:center;gap:4px;border-radius:8px;';
    btnEdit.onclick=()=>abrirEditarLocalCompra(loc);
    linha.appendChild(esq);linha.appendChild(btnEdit);area.appendChild(linha);
  }
}

async function criarNovoLocalCompra(){
  const nome=el('nomeNovoLocalCompra').value.trim();
  if(!nome){aviso('avisoNovoLocalCompra','Digite o nome.','erro');return;}
  const{data,error}=await supa.from('locais_compra').insert({casa_id:usuario.casa_id,nome,ativo:true}).select().single();
  if(error){aviso('avisoNovoLocalCompra','Erro.','erro');return;}
  el('nomeNovoLocalCompra').value='';
  toggleInputProjeto('inputNovoLocalCompra');
  carregarLocaisCompraConfig();
  // Abre para edição imediata
  if(data)abrirEditarLocalCompra({...data,locais_compra_enderecos:[],locais_compra_categorias:[]});
}

function abrirEditarLocalCompra(loc){
  _localCompraEditando=loc;
  _localCompraEnderecos=[...(loc.locais_compra_enderecos||[])];
  _localCompraCategorias=(loc.locais_compra_categorias||[]).map(c=>c.local_estoque);
  el('elcTitulo').textContent=loc.nome;
  el('elcNome').value=loc.nome;
  el('elcNovoEnd').value='';el('elcNovoLat').value='';el('elcNovoLon').value='';
  renderizarEnderecos();
  renderizarCategoriasLocalCompra();
  aviso('avisoEditarLocalCompra','');
  abrirModal('modalEditarLocalCompra');
}

function renderizarEnderecos(){
  const area=el('elcEnderecos');area.innerHTML='';
  for(const e of _localCompraEnderecos){
    const linha=document.createElement('div');linha.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--linha);font-size:12px';
    linha.innerHTML=`<span>${escapeHtml(e.endereco||'Sem endereço')} ${e.latitude?`(${Number(e.latitude).toFixed(4)}, ${Number(e.longitude).toFixed(4)})`:'sem coords'}</span>`;
    const btnD=document.createElement('button');btnD.textContent='×';btnD.dataset.uiAction='delete';btnD.setAttribute('aria-label','Excluir endereço');btnD.style.cssText='background:none;color:var(--suave);padding:2px 6px';
    btnD.onclick=async()=>{if(!await confirmarAcao('Excluir endereço',`Excluir o endereço "${e.endereco||'Sem endereço'}"?`,{confirmLabel:'Excluir',danger:true}))return;if(e.id)await supa.from('locais_compra_enderecos').delete().eq('id',e.id);_localCompraEnderecos=_localCompraEnderecos.filter(x=>x!==e);renderizarEnderecos();};
    linha.appendChild(btnD);area.appendChild(linha);
  }
  if(!_localCompraEnderecos.length)area.innerHTML='<div style="font-size:12px;color:var(--suave);padding:6px 0">Nenhum endereço.</div>';
}

function renderizarCategoriasLocalCompra(){
  const area=el('elcCategorias');area.innerHTML='';
  for(const cat of _localCompraCategorias){
    const chip=document.createElement('span');chip.style.cssText='display:inline-flex;align-items:center;gap:4px;background:var(--acao-clara);color:var(--acao);font-size:11px;padding:3px 8px;border-radius:999px;margin:2px';
    chip.textContent=cat;
    const x=document.createElement('button');x.type='button';x.textContent='×';x.dataset.uiAction='delete';x.setAttribute('aria-label',`Remover categoria ${cat}`);x.style.cssText='background:none;color:inherit;padding:2px;min-width:28px;min-height:28px';x.onclick=()=>{_localCompraCategorias=_localCompraCategorias.filter(c=>c!==cat);renderizarCategoriasLocalCompra();renderizarBotoesCategorias();};
    chip.appendChild(x);area.appendChild(chip);
  }
  renderizarBotoesCategorias();
}

function renderizarBotoesCategorias(){
  const area=el('elcBtnsCategorias');area.innerHTML='';
  for(const loc of _locaisEstoque){
    if(_localCompraCategorias.includes(loc.nome))continue;
    const btn=document.createElement('button');btn.className='secundario';btn.style.cssText='font-size:11px;padding:4px 8px;margin:2px';btn.textContent='+ '+loc.nome;
    btn.onclick=()=>{_localCompraCategorias.push(loc.nome);renderizarCategoriasLocalCompra();};
    area.appendChild(btn);
  }
}

async function salvarEditarLocalCompra(){
  if(!_localCompraEditando)return;
  el('btnSalvarEditarLocalCompra').disabled=true;
  const nome=el('elcNome').value.trim();
  if(!nome){aviso('avisoEditarLocalCompra','Digite o nome.','erro');el('btnSalvarEditarLocalCompra').disabled=false;return;}
  // Atualiza nome
  await supa.from('locais_compra').update({nome}).eq('id',_localCompraEditando.id);
  // Recria categorias
  await supa.from('locais_compra_categorias').delete().eq('local_compra_id',_localCompraEditando.id);
  if(_localCompraCategorias.length)await supa.from('locais_compra_categorias').insert(_localCompraCategorias.map(c=>({local_compra_id:_localCompraEditando.id,local_estoque:c})));
  el('btnSalvarEditarLocalCompra').disabled=false;
  aviso('avisoEditarLocalCompra','Salvo.','ok');
  setTimeout(()=>{fecharModal('modalEditarLocalCompra');_localCompraEditando=null;carregarLocaisCompraConfig();},1000);
}

async function excluirLocalCompra(){
  if(!_localCompraEditando)return;
  if(!await confirmarAcao('Excluir local de compra',`Excluir "${_localCompraEditando.nome}"?`,{confirmLabel:'Excluir',danger:true}))return;
  await supa.from('locais_compra').delete().eq('id',_localCompraEditando.id);
  fecharModal('modalEditarLocalCompra');
  _localCompraEditando=null;carregarLocaisCompraConfig();
}

async function adicionarEnderecoLocal(){
  const end=el('elcNovoEnd').value.trim();
  const lat=el('elcNovoLat').value?Number(el('elcNovoLat').value):null;
  const lon=el('elcNovoLon').value?Number(el('elcNovoLon').value):null;
  if(!end)return;
  if(_localCompraEditando?.id){
    const{data}=await supa.from('locais_compra_enderecos').insert({local_compra_id:_localCompraEditando.id,endereco:end,latitude:lat,longitude:lon,raio_metros:200}).select().single();
    if(data)_localCompraEnderecos.push(data);
  }else{_localCompraEnderecos.push({endereco:end,latitude:lat,longitude:lon});}
  el('elcNovoEnd').value='';el('elcNovoLat').value='';el('elcNovoLon').value='';
  renderizarEnderecos();
}

// --- HISTÓRICO DE EXCLUÍDOS ---
async function carregarHistoricoExcluidos(modulo){
  _moduloHistorico=modulo;
  const area=el('listaHistorico');area.innerHTML='<div class="vazio">Carregando...</div>';
  let q=supa.from('historico_excluidos').select('id,modulo,dados,excluido_em,restaurado_em').eq('casa_id',usuario.casa_id).order('excluido_em',{ascending:false}).limit(50);
  if(modulo!=='todos')q=q.eq('modulo',modulo);
  const{data}=await q;
  area.innerHTML='';
  if(!data||!data.length){area.innerHTML='<div class="vazio">Nenhum item excluído nesta categoria.</div>';return;}
  const MOD_LABEL={tarefas:'Tarefa',contas:'Conta',estoque:'Estoque',lista_compras:'Lista',rituais:'Ritual'};
  for(const h of data){
    const nome=h.dados?.titulo||h.dados?.nome||h.dados?.nome_popular||'Item excluído';
    const quando=new Date(h.excluido_em).toLocaleDateString('pt-BR');
    const linha=document.createElement('div');linha.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--linha)';
    const esq=document.createElement('div');
    esq.innerHTML=`<div style="font-size:13px;font-weight:600">${escapeHtml(nome)}</div><div style="font-size:11px;color:var(--suave)">${escapeHtml(MOD_LABEL[h.modulo]||h.modulo)} · excluído em ${escapeHtml(quando)}${h.restaurado_em?' · restaurado':''}</div>`;
    const btnRest=document.createElement('button');btnRest.textContent='Restaurar';btnRest.style.cssText='font-size:12px;padding:6px 10px;background:var(--acao-clara);color:var(--acao)';
    btnRest.disabled=!!h.restaurado_em;
    btnRest.onclick=async()=>{await restaurarItem(h);btnRest.disabled=true;btnRest.textContent='Restaurado';};
    linha.appendChild(esq);linha.appendChild(btnRest);area.appendChild(linha);
  }
}

async function restaurarItem(h){
  const d=h.dados;
  try{
    if(h.modulo==='tarefas'){
      await supa.from('tarefas').insert({casa_id:usuario.casa_id,titulo:d.titulo,responsavel:d.responsavel,data:d.data,feita:false,recorrente:d.recorrente,recorrencia:d.recorrencia,criada_por:usuario.id});
      await carregarTarefas();
    }else if(h.modulo==='contas'){
      await supa.from('contas').insert({casa_id:usuario.casa_id,nome:d.nome,valor:d.valor,vencimento:d.vencimento,paga:d.paga,recorrente:d.recorrente,dia_vencimento:d.dia_vencimento,criada_por:usuario.id});
      await carregarContas();
    }else if(h.modulo==='estoque'){
      await supa.from('estoque').insert({casa_id:usuario.casa_id,nome:d.nome,tipo:d.tipo,quantidade:d.quantidade,minimo:d.minimo,unidade:d.unidade,nivel:d.nivel,minimo_nivel:d.minimo_nivel,local:d.local,critico:d.critico,taxa_consumo:d.taxa_consumo,taxa_periodo:d.taxa_periodo,alerta_dias:d.alerta_dias,atualizado_por:usuario.id});
      await carregarEstoque();
    }else if(h.modulo==='lista_compras'){
      await supa.from('lista_compras').insert({casa_id:usuario.casa_id,nome:d.nome,quantidade:d.quantidade,unidade:d.unidade,status:'pendente',criado_por:usuario.id});
      await carregarLista();
    }else if(h.modulo==='rituais'){
      await supa.from('rituais').insert({casa_id:usuario.casa_id,nome:d.nome,frequencia:d.frequencia,pauta:d.pauta,privado:d.privado});
      await carregarRituais();
    }
    // Marca como restaurado
    await supa.from('historico_excluidos').update({restaurado_em:new Date().toISOString(),restaurado_por:usuario.id}).eq('id',h.id);
  }catch(e){console.error('Erro ao restaurar:',e);}
}

// --- EVENTOS ---
el('btnEntrar').onclick=entrar;
el('senha').addEventListener('keydown',e=>{if(e.key==='Enter')entrar();});
el('btnSair').onclick=sair;
el('btnAdd').onclick=adicionar;
el('novoItem').addEventListener('keydown',e=>{if(e.key==='Enter')adicionar();});
el('btnAddEstoque').onclick=adicionarEstoque;
el('estTipo').addEventListener('change',e=>{const t=e.target.value;el('estCamposNum').classList.toggle('oculto',t==='nivel_visual');el('estCamposNivel').classList.toggle('oculto',t!=='nivel_visual');});
el('btnInventario').onclick=abrirModalInventario;
el('btnFecharInventario').onclick=()=>{fecharModal('modalInventario');};
el('btnIniciarInventario').onclick=iniciarInventario;
el('btnConcluirInventario').onclick=concluirInventario;
el('btnVoltarLocal').onclick=()=>{el('invPassoItens').style.display='none';el('invPassoLocal').style.display='block';};
el('btnSalvarRefeicao').onclick=salvarRefeicao;
el('btnAddIngrediente').onclick=adicionarLinhaIngrediente;
el('btnConfirmarRef').onclick=confirmarSlot;
el('btnLimparSlot').onclick=limparSlot;
el('btnFecharModalRef').onclick=fecharModalRefeicao;
el('btnSugerirPlan').onclick=sugerirPlanejamentoSemana;
el('btnSalvarPlan').onclick=salvarPlanejamento;
el('btnGerarLista').onclick=gerarListaCardapio;
el('btnLimparPlan').onclick=limparPlanejamentoAtual;
el('planResp').onchange=e=>selecionarResponsavelCardapio(e.target.value);
el('btnSalvarRitual').onclick=salvarRitual;
el('btnConcluirRitual').onclick=concluirRitual;
el('btnCriarTarefaRitual').onclick=criarTarefaDoRitual;
el('btnFecharModalRitual').onclick=()=>{fecharModal('modalRitual');_ritualAtual=null;};
el('btnFecharPlanta').onclick=()=>{fecharModal('modalPlanta');_plantaAberta=null;};
el('btnRemoverPlanta').onclick=async()=>{
  if(!_plantaAberta)return;
  const nome=_plantaAberta.especies?.nome_popular||_plantaAberta.codigo;
  if(!await confirmarAcao('Remover planta',`Remover "${nome}" da listagem ativa? O histórico e o cadastro serão preservados.`,{confirmLabel:'Remover',danger:true}))return;
  el('btnRemoverPlanta').disabled=true;
  const res=await removerPlanta(supa,usuario,_plantaAberta);
  el('btnRemoverPlanta').disabled=false;
  if(res.ok){
    fecharModal('modalPlanta');
    _plantaAberta=null;
    await atualizarPlantas();
  }
};
el('btnNovaPlanta').onclick=abrirModalNovaPlanta;
el('btnFecharNovaPlanta').onclick=()=>{fecharModal('modalNovaPlanta');};
el('btnSalvarNovaPlanta').onclick=salvarNovaPlanta;
el('npEspecie').addEventListener('change',aoEscolherEspecie);
el('btnAddTarefa').onclick=adicionarTarefa;
el('tfRecorrente').addEventListener('change',e=>el('tfRecorrenciaBox').classList.toggle('oculto',!e.target.checked));
el('btnAddConta').onclick=adicionarConta;
// Projetos
el('btnNovoProjeto').onclick=()=>{
  _projetoAtual=null;
  el('modalProjetoTitulo').textContent='Novo projeto';
  el('projNome').value='';el('projDesc').value='';el('projInicio').value='';el('projTermino').value='';
  el('projStatus').value='nao_iniciado';el('projFreq').value='semanal';
  aviso('avisoProjeto','');
  abrirModal('modalProjeto');
};
el('btnFecharModalProjeto').onclick=()=>{fecharModal('modalProjeto');};
el('btnSalvarProjeto').onclick=salvarProjeto;
el('btnVoltarProjetos').onclick=()=>{_projetoAtual=null;abrirSecao('projetos',{preservarOrigem:true});};
el('btnEditarProjeto').onclick=()=>{
  if(!_projetoAtual)return;
  el('modalProjetoTitulo').textContent='Editar projeto';
  el('projNome').value=_projetoAtual.nome||'';
  el('projDesc').value=_projetoAtual.descricao||'';
  el('projInicio').value=_projetoAtual.inicio||'';
  el('projTermino').value=_projetoAtual.termino||'';
  el('projStatus').value=_projetoAtual.status||'nao_iniciado';
  el('projFreq').value=_projetoAtual.frequencia||'semanal';
  aviso('avisoProjeto','');
  abrirModal('modalProjeto');
};
el('btnRemoverProjeto').onclick=removerProjeto;
el('btnAddObjetivo').onclick=()=>toggleInputProjeto('inputObjetivo');
el('btnSalvarObjetivo').onclick=async()=>{
  const txt=el('novoObjetivo').value.trim();if(!txt)return;
  await supa.from('projeto_objetivos').insert({projeto_id:_projetoAtual.id,descricao:txt,ordem:0});
  el('novoObjetivo').value='';toggleInputProjeto('inputObjetivo');
  await renderizarPainelProjeto(_projetoAtual);
};
el('btnAddTarefaProjeto').onclick=()=>toggleInputProjeto('inputTarefaProjeto');
el('btnSalvarTarefaProjeto').onclick=async()=>{
  const titulo=el('novaTarefaProjeto').value.trim();
  if(!titulo){aviso('avisoTarefaProjeto','Digite o título.','erro');return;}
  const privado=el('tfpPriv').value==='true';
  await supa.from('tarefas').insert({
    casa_id:usuario.casa_id,titulo,responsavel:usuario.nome.toLowerCase(),
    data:el('tfpData').value||null,feita:false,
    privado,projeto_id:_projetoAtual.id,criada_por:usuario.id,
  });
  el('novaTarefaProjeto').value='';el('tfpData').value='';
  toggleInputProjeto('inputTarefaProjeto');
  await renderizarPainelProjeto(_projetoAtual);
};
el('btnAddItemProjeto').onclick=()=>toggleInputProjeto('inputItemProjeto');
el('btnSalvarItemProjeto').onclick=async()=>{
  const nome=el('novoItemProjeto').value.trim();if(!nome)return;
  await supa.from('projeto_itens').insert({projeto_id:_projetoAtual.id,nome,estoque_id:null});
  if(el('itemProjetoParaLista').checked){
    await supa.from('lista_compras').insert({casa_id:usuario.casa_id,nome,status:'pendente',origem:'projeto',criado_por:usuario.id});
    await carregarLista();
  }
  el('novoItemProjeto').value='';el('itemProjetoParaLista').checked=false;
  toggleInputProjeto('inputItemProjeto');
  await renderizarPainelProjeto(_projetoAtual);
};
// Configurações
el('btnGerarToken').onclick=gerarNovoToken;
el('btnNovoLocalEstoque').onclick=()=>toggleInputProjeto('inputNovoLocalEstoque');
el('btnSalvarNovoLocalEstoque').onclick=salvarNovoLocalEstoque;
el('btnNovoLocalCompra').onclick=()=>toggleInputProjeto('inputNovoLocalCompra');
el('nomeNovoLocalCompra').addEventListener('keydown',e=>{if(e.key==='Enter')criarNovoLocalCompra();});
el('btnFecharEditarLocalCompra').onclick=()=>{fecharModal('modalEditarLocalCompra');_localCompraEditando=null;};
el('btnSalvarEditarLocalCompra').onclick=salvarEditarLocalCompra;
el('btnExcluirLocalCompra').onclick=excluirLocalCompra;
el('btnAddEndereco').onclick=adicionarEnderecoLocal;
document.querySelectorAll('[data-modulo]').forEach(b=>{b.onclick=()=>{_moduloHistorico=b.dataset.modulo;document.querySelectorAll('[data-modulo]').forEach(x=>x.classList.remove('ativo'));b.classList.add('ativo');carregarHistoricoExcluidos(b.dataset.modulo);};}); 
el('btnFecharEditarRitual').onclick=()=>{fecharModal('modalEditarRitual');_ritualEditando=null;};
el('btnSalvarEditarRitual').onclick=salvarEditarRitual;
el('btnFecharEditarPlanta').onclick=()=>{fecharModal('modalEditarPlanta');_plantaEditando=null;};
el('btnSalvarEditarPlanta').onclick=salvarEditarPlanta;
el('btnEditarPlanta').onclick=abrirEditarPlanta;
el('btnFecharEditarLista').onclick=()=>{fecharModal('modalEditarLista');_listaEditando=null;};
el('btnSalvarEditarLista').onclick=salvarEditarLista;
el('btnFecharEditarEstoque').onclick=()=>{fecharModal('modalEditarEstoque');_estoqueEditando=null;};
el('btnSalvarEditarEstoque').onclick=salvarEditarEstoque;
el('btnFecharEditarConta').onclick=()=>{fecharModal('modalEditarConta');_contaEditando=null;};
el('btnSalvarEditarConta').onclick=salvarEditarConta;
el('btnFecharEditarTarefa').onclick=()=>{fecharModal('modalEditarTarefa');_tarefaEditando=null;};
el('btnSalvarEditarTarefa').onclick=salvarEditarTarefa;
el('etRecorrente').addEventListener('change',e=>el('etRecorrenciaBox').classList.toggle('oculto',!e.target.checked));
el('btnFecharHistConta').onclick=()=>{fecharModal('modalHistConta');_contaHistAtual=null;};
el('btnAddRetro').onclick=adicionarRetroativo;
el('btnSair').onclick=sair;
// Tab bar gerenciada pelo onclick inline no HTML
document.querySelectorAll('.filtro-btn').forEach(b=>{b.onclick=()=>{_filtroAtual=b.dataset.filtro;document.querySelectorAll('.filtro-btn').forEach(x=>x.classList.remove('ativo'));b.classList.add('ativo');renderizarPlantas();};});

iniciar();

// Expor funções globais para onclick inline no HTML
window.trocarAba = trocarAba;
window.trocarSub = trocarSub;
window.abrirSecao = abrirSecao;
window.voltarMais = voltarMais;
window.voltarContexto = voltarContexto;
window.abrirRitmoContextual = abrirRitmoContextual;
window.voltarAbaContextual = voltarAbaContextual;
window.voltarCasaContextual = voltarCasaContextual;
if (typeof mudarPagina === 'function') window.mudarPagina = mudarPagina;



