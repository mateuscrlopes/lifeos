// app.js — LifeOS v0.18.0
import { calcularStatus, rotuloStatus, descricaoQuantidade, NIVEIS_VISUAL, ROTULO_NIVEL } from './status-estoque.js';
import { sincronizarItem, reporEstoque } from './ponte-estoque.js';
import { calcularStatusConta, rotuloStatusConta, formatarValor } from './status-conta.js';
import { saudacao, montarHoje, inicioSemana, formatarDataISO } from './hoje.js';
import { selecionarItensInventario, confirmarItemInventario, concluirSessaoInventario } from './inventario.js';
import { carregarPlantas, urgenciaPlanta, COR_URGENCIA, COR_PERFIL, registrarCuidado, contarUrgentes } from './plantas.js';

let supa=null,usuario=null,canalTempoReal=null;
let _plantasCache=[];
let _filtroAtual='todas';
const el=(id)=>document.getElementById(id);
function aviso(id,t,tipo=''){const a=el(id);a.textContent=t||'';a.className='aviso'+(tipo?' '+tipo:'');}

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
  usuario=p;el('quem').textContent=p.nome;
  el('telaLogin').classList.add('oculto');el('telaApp').classList.remove('oculto');aviso('avisoLogin','');
  await Promise.all([carregarHoje(),carregarLista(),carregarEstoque(),carregarTarefas(),carregarContas(),carregarRefeicoes(),carregarPlanejamento(),carregarRituais(),atualizarPlantas()]);
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
  el('quem').textContent='';el('telaApp').classList.add('oculto');el('telaLogin').classList.remove('oculto');
}

function trocarAba(qual){
  ['abaHoje','abaCompras','abaEstoque','abaCardapio','abaPlantas','abaRituais','abaTarefas','abaContas'].forEach(id=>el(id).classList.toggle('oculto',id!=='aba'+qual.charAt(0).toUpperCase()+qual.slice(1)));
  document.querySelectorAll('.aba').forEach(b=>b.classList.toggle('ativa',b.dataset.aba===qual));
  if(qual==='hoje'&&usuario)carregarHoje();
  if(qual==='plantas'&&usuario)renderizarPlantas();
}

// --- LISTA ---
async function carregarLista(){
  const{data:itens,error}=await supa.from('lista_compras').select('id,nome,quantidade,unidade,categoria,criado_em,origem,estoque_id').eq('casa_id',usuario.casa_id).eq('status','pendente').order('criado_em',{ascending:false});
  const area=el('itens');area.innerHTML='';
  if(error){area.innerHTML='<div class="vazio">Erro ao carregar.</div>';return;}
  if(!itens||!itens.length){area.innerHTML='<div class="vazio">Nada pendente.</div>';return;}
  for(const item of itens){
    const l=document.createElement('div');l.className='item';
    const d=document.createElement('div');d.className='desc';
    const n=document.createElement('span');n.className='nome';n.textContent=item.nome;
    if(item.origem==='sugestao_estoque'||item.origem==='cardapio'){const t=document.createElement('span');t.className='badge';t.style.background=item.origem==='cardapio'?'#5b6e9e':'#8a6d3b';t.style.cssText+='margin-left:8px;font-size:10px';t.textContent=item.origem==='cardapio'?'cardápio':'sugestão estoque';n.appendChild(t);}
    d.appendChild(n);
    const ps=[];if(item.quantidade)ps.push(item.quantidade+(item.unidade?' '+item.unidade:''));if(item.categoria)ps.push(item.categoria);
    if(ps.length){const m=document.createElement('span');m.className='meta';m.textContent=ps.join(' · ');d.appendChild(m);}
    const btn=document.createElement('button');btn.textContent='Comprei';btn.onclick=()=>comprar(item,btn);
    l.appendChild(d);l.appendChild(btn);area.appendChild(l);
  }
}

async function adicionar(){
  const nome=el('novoItem').value.trim();if(!nome){aviso('avisoAdd','Digite o nome.','erro');return;}
  el('btnAdd').disabled=true;
  const{data,error}=await supa.from('lista_compras').insert({casa_id:usuario.casa_id,nome,status:'pendente',criado_por:usuario.id}).select().single();
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
  const{data:itens,error}=await supa.from('estoque').select('id,nome,categoria,tipo,quantidade,unidade,minimo,nivel,minimo_nivel,local,critico').eq('casa_id',usuario.casa_id).order('nome');
  const area=el('itensEstoque');area.innerHTML='';
  if(error){area.innerHTML='<div class="vazio">Erro.</div>';return;}
  if(!itens||!itens.length){area.innerHTML='<div class="vazio">Nada no estoque ainda.</div>';return;}
  for(const item of itens){
    const status=calcularStatus(item.quantidade,item.minimo,item.tipo,item.nivel,item.minimo_nivel);const info=rotuloStatus(status);
    const l=document.createElement('div');l.className='item';
    const d=document.createElement('div');d.className='desc';
    const n=document.createElement('span');n.className='nome';n.textContent=item.nome+(item.critico?' ⭐':'');d.appendChild(n);
    const m=document.createElement('span');m.className='meta';m.textContent=(item.local?item.local+' · ':'')+descricaoQuantidade(item);d.appendChild(m);
    const dir=document.createElement('div');dir.className='est-controles';
    const badge=document.createElement('span');badge.className='badge';badge.style.background=info.cor;badge.textContent=info.texto;dir.appendChild(badge);
    if(item.tipo==='nivel_visual'){const sel=document.createElement('select');sel.className='sel';sel.style.cssText='width:auto;padding:6px 8px;font-size:13px';NIVEIS_VISUAL.forEach(nv=>{const o=document.createElement('option');o.value=nv;o.textContent=ROTULO_NIVEL[nv];if(nv===item.nivel)o.selected=true;sel.appendChild(o);});sel.onchange=()=>ajustarNivel(item,sel.value);dir.appendChild(sel);}
    else{const p=item.tipo==='peso_volume'?100:1;const bm=document.createElement('button');bm.textContent='−';bm.onclick=()=>ajustarEstoque(item,-p);const q=document.createElement('span');q.className='est-qtd';q.textContent=item.quantidade;const bp=document.createElement('button');bp.textContent='+';bp.onclick=()=>ajustarEstoque(item,p);dir.appendChild(bm);dir.appendChild(q);dir.appendChild(bp);}
    l.appendChild(d);l.appendChild(dir);area.appendChild(l);
  }
}

async function adicionarEstoque(){
  const nome=el('estNome').value.trim(),tipo=el('estTipo').value;
  if(!nome){aviso('avisoEstoque','Digite o nome.','erro');return;}
  const{data:ex}=await supa.from('estoque').select('nome').eq('casa_id',usuario.casa_id);
  const nn=normalizarNome(nome),dup=(ex||[]).find(i=>normalizarNome(i.nome)===nn);
  if(dup){aviso('avisoEstoque',`Já existe "${dup.nome}".`,'erro');return;}
  let payload={casa_id:usuario.casa_id,nome,tipo,atualizado_por:usuario.id,local:el('estLocal').value||null,critico:el('estCritico').checked};
  if(tipo==='contavel'||tipo==='peso_volume'){const quantidade=Number(el('estQtd').value),minimo=Number(el('estMin').value);if(!isFinite(quantidade)||!isFinite(minimo)){aviso('avisoEstoque','Números inválidos.','erro');return;}payload={...payload,quantidade,minimo,unidade:el('estUnidade').value.trim()||(tipo==='peso_volume'?'g':'unidades')};}
  else if(tipo==='nivel_visual'){payload={...payload,nivel:el('estNivelAtual').value,minimo_nivel:el('estNivelMin').value,quantidade:0,minimo:0};}
  el('btnAddEstoque').disabled=true;
  const{data,error}=await supa.from('estoque').insert(payload).select().single();
  if(data)supa.from('eventos').insert({tipo:'estoque_item_criado',entidade:'estoque',entidade_id:data.id,usuario_id:usuario.id,detalhe:usuario.nome+' adicionou '+nome});
  el('btnAddEstoque').disabled=false;
  if(error){aviso('avisoEstoque','Erro.','erro');return;}
  el('estNome').value='';el('estTipo').value='contavel';el('estQtd').value='0';el('estMin').value='1';el('estUnidade').value='';el('estLocal').value='';el('estCritico').checked=false;
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
async function abrirModalInventario(){el('invPassoLocal').classList.remove('oculto');el('invPassoItens').classList.add('oculto');el('invLocal').value='';el('avisoInventario').textContent='';el('modalInventario').classList.remove('oculto');el('modalInventario').classList.add('modal-aberto');}
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
    const n=document.createElement('span');n.className='nome';n.textContent=item.nome+(item.critico?' ⭐':'');topo.appendChild(n);bloco.appendChild(topo);
    if(item.tipo==='nivel_visual'){const sel=document.createElement('select');sel.className='sel';sel.dataset.itemId=item.id;NIVEIS_VISUAL.forEach(nv=>{const o=document.createElement('option');o.value=nv;o.textContent=ROTULO_NIVEL[nv];if(nv===item.nivel)o.selected=true;sel.appendChild(o);});bloco.appendChild(sel);}
    else{const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:8px';const inp=document.createElement('input');inp.type='number';inp.min='0';inp.step=item.tipo==='peso_volume'?'100':'1';inp.value=item.quantidade;inp.dataset.itemId=item.id;inp.style.flex='1';const un=document.createElement('span');un.className='meta';un.textContent=item.unidade||'';row.appendChild(inp);row.appendChild(un);bloco.appendChild(row);}
    area.appendChild(bloco);
  }
  el('invPassoLocal').classList.add('oculto');el('invPassoItens').classList.remove('oculto');
}
async function concluirInventario(){
  el('btnConcluirInventario').disabled=true;
  for(const item of _invItens){let v;if(item.tipo==='nivel_visual'){const s=el('invItens').querySelector(`select[data-item-id="${item.id}"]`);v=s?s.value:item.nivel;}else{const i=el('invItens').querySelector(`input[data-item-id="${item.id}"]`);v=i?i.value:item.quantidade;}await confirmarItemInventario(supa,usuario,item,v);}
  await concluirSessaoInventario(supa,usuario,_invLocal,_invItens.length);
  el('btnConcluirInventario').disabled=false;el('modalInventario').classList.add('oculto');el('modalInventario').classList.remove('modal-aberto');
  await carregarEstoque();await carregarLista();
}

// --- PLANTAS ---
async function atualizarPlantas(){
  const res=await carregarPlantas(supa,usuario);
  if(res.ok)_plantasCache=res.plantas;
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
      nome.innerHTML=`<span class="dot-perfil" style="background:${perfil.cor}"></span>${nomeEspecie}`;
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
  const rotinas=(planta.planta_rotinas||[]).filter(r=>r.ativa);
  const hoje=new Date().toISOString().slice(0,10);
  const vencidas=rotinas.filter(r=>!r.proxima_realizacao||r.proxima_realizacao<=hoje);
  for(const rotina of vencidas){await registrarCuidado(supa,usuario,planta,rotina);}
  botao.disabled=false;
  await atualizarPlantas();
  await carregarHoje();
}

async function abrirFichaPlanta(planta){
  const nomeEspecie=planta.especies?.nome_popular||'';
  const cientifico=planta.especies?.nome_cientifico||'';
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
  for(const[k,v]of info){const linha=document.createElement('div');linha.style.cssText='display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--linha);font-size:13px';linha.innerHTML=`<span style="color:var(--suave)">${k}</span><span>${v}</span>`;dados.appendChild(linha);}

  // Rotinas com botao de cuidar
  const rotDiv=el('mpRotinas');rotDiv.innerHTML='<div class="titulo-secao">Rotinas</div>';
  const rotinas=(planta.planta_rotinas||[]).filter(r=>r.ativa);
  for(const r of rotinas){
    const div=document.createElement('div');div.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--linha)';
    const hoje=new Date().toISOString().slice(0,10);
    const dias=r.proxima_realizacao?Math.round((new Date(r.proxima_realizacao)-new Date(hoje))/86400000):null;
    const quando=dias===null?'—':dias<0?`${Math.abs(dias)}d atrás`:dias===0?'hoje':`em ${dias}d`;
    div.innerHTML=`<span style="font-size:13px">${r.tipo} · a cada ${r.intervalo_dias}d · <strong>${quando}</strong></span>`;
    if(dias===null||dias<=0){const btn=document.createElement('button');btn.textContent='Cuidar';btn.style.cssText='padding:6px 10px;font-size:12px';btn.onclick=async()=>{btn.disabled=true;await registrarCuidado(supa,usuario,planta,r);await atualizarPlantas();btn.textContent='✓';};div.appendChild(btn);}
    rotDiv.appendChild(div);
  }

  // Eventos (linha do tempo)
  const{data:eventos}=await supa.from('planta_eventos').select('tipo,data,notas').eq('planta_id',planta.id).order('data',{ascending:false}).limit(20);
  const evArea=el('mpEventos');evArea.innerHTML='';
  const TIPO_LABEL={cadastro:'📋 Cadastro',rega:'💧 Rega',troca_agua:'🔄 Troca de água',imersao:'🪣 Imersão',adubacao:'🌱 Adubação',poda:'✂️ Poda',observacao:'📝 Obs.'};
  for(const ev of(eventos||[])){
    const div=document.createElement('div');div.className='evento-linha';
    const data=new Date(ev.data).toLocaleDateString('pt-BR');
    div.innerHTML=`<span class="evento-data">${data}</span><span>${TIPO_LABEL[ev.tipo]||ev.tipo}${ev.notas?' — '+ev.notas:''}</span>`;
    evArea.appendChild(div);
  }
  if(!eventos||!eventos.length)evArea.innerHTML='<div class="vazio">Nenhum evento registrado ainda.</div>';

  el('modalPlanta').classList.remove('oculto');el('modalPlanta').classList.add('modal-aberto');
}

// --- CARDAPIO ---
let _refeicoes=[],_planDias={},_slotAtual=null;
async function carregarRefeicoes(){
  const{data,error}=await supa.from('refeicoes').select('id,nome,tipo,porcoes,refeicao_ingredientes(id,nome,quantidade,unidade)').eq('casa_id',usuario.casa_id).order('nome');
  _refeicoes=data||[];
  const area=el('listaRefeicoes');area.innerHTML='';
  if(error||!_refeicoes.length){area.innerHTML='<div class="vazio">Nenhuma refeição cadastrada.</div>';return;}
  for(const r of _refeicoes){const linha=document.createElement('div');linha.className='card-refeicao';const d=document.createElement('div');d.className='desc';const n=document.createElement('span');n.className='nome';n.textContent=r.nome;d.appendChild(n);const m=document.createElement('span');m.className='meta';m.textContent=`${({almoco:'Almoço',janta:'Janta',ambos:'Ambos'}[r.tipo]||r.tipo)} · ${r.porcoes} porções · ${(r.refeicao_ingredientes||[]).length} ingredientes`;d.appendChild(m);const btn=document.createElement('button');btn.textContent='×';btn.style.cssText='background:none;color:var(--suave);padding:4px 8px';btn.onclick=()=>removerRefeicao(r.id);linha.appendChild(d);linha.appendChild(btn);area.appendChild(linha);}
  renderizarSlotsCardapio();
}

async function salvarRefeicao(){
  const nome=el('refNome').value.trim();if(!nome){aviso('avisoRefeicao','Digite o nome.','erro');return;}
  el('btnSalvarRefeicao').disabled=true;
  const{data:ref,error}=await supa.from('refeicoes').insert({casa_id:usuario.casa_id,nome,tipo:el('refTipo').value,porcoes:Number(el('refPorcoes').value)||2,criada_por:usuario.id}).select().single();
  if(error){aviso('avisoRefeicao','Erro.','erro');el('btnSalvarRefeicao').disabled=false;return;}
  const linhas=el('refIngredientes').querySelectorAll('.linha-ingrediente');
  for(const l of linhas){const n=l.querySelector('.ing-nome').value.trim();const q=l.querySelector('.ing-qtd').value;const u=l.querySelector('.ing-un').value.trim();if(n)await supa.from('refeicao_ingredientes').insert({refeicao_id:ref.id,nome:n,quantidade:q?Number(q):null,unidade:u||null});}
  el('refNome').value='';el('refPorcoes').value='2';el('refIngredientes').innerHTML='';
  aviso('avisoRefeicao','Refeição salva.','ok');setTimeout(()=>aviso('avisoRefeicao',''),1500);el('btnSalvarRefeicao').disabled=false;await carregarRefeicoes();
}

async function removerRefeicao(id){await supa.from('refeicoes').delete().eq('id',id);await carregarRefeicoes();}

function adicionarLinhaIngrediente(){
  const div=document.createElement('div');div.className='linha-ingrediente';div.style.cssText='display:flex;gap:6px;margin-bottom:8px;align-items:center';
  const n=document.createElement('input');n.type='text';n.className='ing-nome';n.placeholder='Ingrediente';n.style.flex='2';
  const q=document.createElement('input');q.type='number';q.className='ing-qtd';q.placeholder='Qtd';q.style.flex='1';q.min='0';
  const u=document.createElement('input');u.type='text';u.className='ing-un';u.placeholder='g/un';u.style.flex='1';
  const r=document.createElement('button');r.textContent='×';r.style.cssText='background:none;color:var(--suave);padding:4px 8px';r.onclick=()=>div.remove();
  div.appendChild(n);div.appendChild(q);div.appendChild(u);div.appendChild(r);el('refIngredientes').appendChild(div);n.focus();
}

function renderizarSlotsCardapio(){
  ['almoco','janta'].forEach(tipo=>{const grid=el(`slots${tipo.charAt(0).toUpperCase()+tipo.slice(1)}`);if(!grid)return;grid.innerHTML='';for(let d=1;d<=5;d++){const chave=`${d}-${tipo}`;const slot=_planDias[chave];const btn=document.createElement('div');btn.className='dia-slot'+(slot?' preenchido':'');btn.textContent=slot?slot.nome:'+ add';btn.onclick=()=>abrirModalRefeicao(d,tipo);grid.appendChild(btn);}});
}

function abrirModalRefeicao(dia,tipo){
  _slotAtual={dia,tipo};el('modalRefTitulo').textContent=`${['','Seg','Ter','Qua','Qui','Sex'][dia]} — ${tipo==='almoco'?'Almoço':'Janta'}`;
  const chave=`${dia}-${tipo}`;el('modalRefNomeAvulso').value=_planDias[chave]?.nome||'';
  const lista=el('modalRefLista');lista.innerHTML='';
  _refeicoes.filter(r=>r.tipo===tipo||r.tipo==='ambos').forEach(r=>{const btn=document.createElement('div');btn.className='card-refeicao';btn.style.cursor='pointer';btn.innerHTML=`<span class="nome">${r.nome}</span>`;btn.onclick=()=>{el('modalRefNomeAvulso').value=r.nome;_slotAtual.refeicaoId=r.id;};lista.appendChild(btn);});
  el('modalRefeicao').classList.remove('oculto');el('modalRefeicao').classList.add('modal-aberto');
}

function confirmarSlot(){if(!_slotAtual)return;const nome=el('modalRefNomeAvulso').value.trim();const chave=`${_slotAtual.dia}-${_slotAtual.tipo}`;if(nome)_planDias[chave]={nome,refeicaoId:_slotAtual.refeicaoId||null};fecharModalRefeicao();renderizarSlotsCardapio();}
function limparSlot(){if(!_slotAtual)return;delete _planDias[`${_slotAtual.dia}-${_slotAtual.tipo}`];fecharModalRefeicao();renderizarSlotsCardapio();}
function fecharModalRefeicao(){el('modalRefeicao').classList.add('oculto');el('modalRefeicao').classList.remove('modal-aberto');_slotAtual=null;}

async function carregarPlanejamento(){
  const seg=formatarDataISO(inicioSemana());
  const{data:plan}=await supa.from('planejamento_semana').select('id,responsavel').eq('casa_id',usuario.casa_id).eq('semana_inicio',seg).single();
  if(!plan){_planDias={};renderizarSlotsCardapio();return;}
  if(plan.responsavel)el('planResp').value=plan.responsavel;
  const{data:dias}=await supa.from('planejamento_dias').select('dia_semana,tipo,refeicao_id,refeicao_nome,refeicoes(nome)').eq('planejamento_id',plan.id);
  _planDias={};for(const d of(dias||[])){_planDias[`${d.dia_semana}-${d.tipo}`]={nome:d.refeicoes?.nome||d.refeicao_nome||'',refeicaoId:d.refeicao_id};}renderizarSlotsCardapio();
}

async function salvarPlanejamento(){
  el('btnSalvarPlan').disabled=true;const seg=formatarDataISO(inicioSemana());const resp=el('planResp').value;
  let planId;const{data:ex}=await supa.from('planejamento_semana').select('id').eq('casa_id',usuario.casa_id).eq('semana_inicio',seg).single();
  if(ex){planId=ex.id;await supa.from('planejamento_semana').update({responsavel:resp}).eq('id',planId);}
  else{const{data:n}=await supa.from('planejamento_semana').insert({casa_id:usuario.casa_id,semana_inicio:seg,responsavel:resp,criado_por:usuario.id}).select().single();planId=n?.id;}
  if(!planId){aviso('avisoPlan','Erro.','erro');el('btnSalvarPlan').disabled=false;return;}
  await supa.from('planejamento_dias').delete().eq('planejamento_id',planId);
  const inserir=Object.entries(_planDias).map(([chave,val])=>{const[dia,tipo]=chave.split('-');return{planejamento_id:planId,dia_semana:Number(dia),tipo,refeicao_id:val.refeicaoId||null,refeicao_nome:val.nome};});
  if(inserir.length)await supa.from('planejamento_dias').insert(inserir);
  aviso('avisoPlan','Cardápio salvo.','ok');setTimeout(()=>aviso('avisoPlan',''),2000);el('btnSalvarPlan').disabled=false;
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
    const n=document.createElement('span');n.className='nome';n.textContent=r.nome+(r.privado?' 🔒':'');esq.appendChild(n);
    const m=document.createElement('div');m.className='ritual-meta';const partes=[freqLabel[r.frequencia]||r.frequencia];if(ultima)partes.push(`última: ${new Date(ultima.realizado_em).toLocaleDateString('pt-BR')}`);if(proxima)partes.push(`próxima: ${proxima.split('-').reverse().join('/')}`);m.textContent=partes.join(' · ');esq.appendChild(m);
    const btns=document.createElement('div');btns.style.cssText='display:flex;gap:6px;align-items:center';
    const btnAb=document.createElement('button');btnAb.textContent='Iniciar';btnAb.style.cssText='padding:7px 12px;font-size:13px';btnAb.onclick=()=>abrirModalRitual(r);
    const btnRem=document.createElement('button');btnRem.textContent='×';btnRem.style.cssText='background:none;color:var(--suave);padding:4px 8px';btnRem.onclick=()=>removerRitual(r.id);
    btns.appendChild(btnAb);btns.appendChild(btnRem);topo.appendChild(esq);topo.appendChild(btns);div.appendChild(topo);
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

async function removerRitual(id){await supa.from('rituais').delete().eq('id',id);await carregarRituais();}

function abrirModalRitual(ritual){
  _ritualAtual=ritual;el('modalRitNome').textContent=ritual.nome;el('modalRitPauta').textContent=ritual.pauta||'Sem pauta definida.';el('modalRitNotas').value='';
  const hoje=new Date();let prox=new Date(hoje);
  if(ritual.frequencia==='semanal')prox.setDate(hoje.getDate()+7);else if(ritual.frequencia==='mensal')prox.setMonth(hoje.getMonth()+1);else if(ritual.frequencia==='bimestral')prox.setMonth(hoje.getMonth()+2);
  el('modalRitProxima').value=ritual.frequencia==='livre'?'':formatarDataISO(prox);
  aviso('avisoSessao','');el('modalRitual').classList.remove('oculto');el('modalRitual').classList.add('modal-aberto');
}

async function concluirRitual(){
  if(!_ritualAtual)return;el('btnConcluirRitual').disabled=true;
  const{data,error}=await supa.from('ritual_sessoes').insert({ritual_id:_ritualAtual.id,notas:el('modalRitNotas').value.trim()||null,proxima_em:el('modalRitProxima').value||null,criado_por:usuario.id}).select().single();
  if(data)supa.from('eventos').insert({tipo:'ritual_concluido',entidade:'rituais',entidade_id:_ritualAtual.id,usuario_id:usuario.id,detalhe:`${usuario.nome} concluiu ${_ritualAtual.nome}`});
  el('btnConcluirRitual').disabled=false;
  if(error){aviso('avisoSessao','Erro.','erro');return;}
  aviso('avisoSessao','Sessão registrada.','ok');
  setTimeout(()=>{el('modalRitual').classList.add('oculto');el('modalRitual').classList.remove('modal-aberto');_ritualAtual=null;carregarRituais();},1200);
}

function criarTarefaDoRitual(){el('modalRitual').classList.add('oculto');el('modalRitual').classList.remove('modal-aberto');trocarAba('tarefas');el('tfTitulo').value=(_ritualAtual?`[${_ritualAtual.nome}] `:'');el('tfTitulo').focus();}

// --- CONTAS ---
async function carregarContas(){
  const{data:contas,error}=await supa.from('contas').select('id,nome,categoria,valor,vencimento,paga,recorrente,dia_vencimento').eq('casa_id',usuario.casa_id).order('paga').order('vencimento');
  const area=el('itensContas');area.innerHTML='';
  if(error){area.innerHTML='<div class="vazio">Erro.</div>';return;}
  if(!contas||!contas.length){area.innerHTML='<div class="vazio">Nenhuma conta.</div>';return;}
  for(const conta of contas){
    const status=calcularStatusConta(conta),info=rotuloStatusConta(status);
    const l=document.createElement('div');l.className='item';
    const d=document.createElement('div');d.className='desc';
    const n=document.createElement('span');n.className='nome';n.textContent=conta.nome+(conta.recorrente?' ↻':'');d.appendChild(n);
    const venc=conta.vencimento.slice(0,10).split('-').reverse().join('/');
    const m=document.createElement('span');m.className='meta';m.textContent=`${formatarValor(conta.valor)} · vence ${venc}`;d.appendChild(m);
    const dir=document.createElement('div');dir.className='est-controles';
    const badge=document.createElement('span');badge.className='badge';badge.style.background=info.cor;badge.textContent=info.texto;dir.appendChild(badge);
    if(!conta.paga){const btn=document.createElement('button');btn.textContent='Paguei';btn.style.cssText='padding:7px 12px;font-size:13px';btn.onclick=()=>pagarConta(conta,btn);dir.appendChild(btn);}
    l.appendChild(d);l.appendChild(dir);area.appendChild(l);
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
  if(conta.recorrente&&conta.dia_vencimento){const q=confirm(`"${conta.nome}" repete todo mês.\nCriar a do próximo mês?`);if(q){const base=new Date(conta.vencimento.slice(0,10)+'T00:00:00');const prox=new Date(base.getFullYear(),base.getMonth()+1,conta.dia_vencimento||base.getDate());await supa.from('contas').insert({casa_id:usuario.casa_id,nome:conta.nome,categoria:conta.categoria,valor:conta.valor,vencimento:`${prox.getFullYear()}-${String(prox.getMonth()+1).padStart(2,'0')}-${String(prox.getDate()).padStart(2,'0')}`,recorrente:true,dia_vencimento:conta.dia_vencimento,criada_por:usuario.id});}}
  await carregarContas();
}

// --- TAREFAS ---
async function carregarTarefas(){
  const{data:tarefas,error}=await supa.from('tarefas').select('id,titulo,responsavel,prioridade,data,feita,recorrente,recorrencia').eq('casa_id',usuario.casa_id).order('feita').order('data',{nullsFirst:true});
  const area=el('itensTarefas');area.innerHTML='';
  if(error){area.innerHTML='<div class="vazio">Erro.</div>';return;}
  if(!tarefas||!tarefas.length){area.innerHTML='<div class="vazio">Nenhuma tarefa.</div>';return;}
  for(const t of tarefas){
    const l=document.createElement('div');l.className='item'+(t.feita?' concluida':'');
    const ch=document.createElement('div');ch.className='check-tarefa'+(t.feita?' feita':'');ch.textContent=t.feita?'✓':'';ch.onclick=()=>alternarTarefa(t);
    const d=document.createElement('div');d.className='desc';d.style.cssText='flex:1;margin-left:12px';
    const n=document.createElement('span');n.className='nome';n.textContent=t.titulo;d.appendChild(n);
    const quem=t.responsavel==='ambos'?'Ambos':t.responsavel.charAt(0).toUpperCase()+t.responsavel.slice(1);
    const ps=[quem];if(t.recorrente&&t.recorrencia)ps.push(t.recorrencia);if(t.data)ps.push(t.data.slice(0,10).split('-').reverse().join('/'));
    const m=document.createElement('span');m.className='meta';m.textContent=ps.join(' · ');d.appendChild(m);
    const br=document.createElement('button');br.textContent='×';br.style.cssText='background:none;color:var(--suave);padding:4px 8px';br.onclick=()=>removerTarefa(t.id);
    const esq=document.createElement('div');esq.style.cssText='display:flex;align-items:center;flex:1';esq.appendChild(ch);esq.appendChild(d);l.appendChild(esq);l.appendChild(br);area.appendChild(l);
  }
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
  const novo=!t.feita;const{error}=await supa.from('tarefas').update({feita:novo,feita_por:novo?usuario.id:null,feita_em:novo?new Date().toISOString():null}).eq('id',t.id);
  if(error)return;
  supa.from('eventos').insert({tipo:novo?'tarefa_concluida':'tarefa_reaberta',entidade:'tarefas',entidade_id:t.id,usuario_id:usuario.id,detalhe:`${usuario.nome} ${novo?'concluiu':'reabriu'} ${t.titulo}`});
  if(novo&&t.recorrente){const q=confirm(`"${t.titulo}" é uma rotina.\nCriar a próxima?`);if(q)await supa.from('tarefas').insert({casa_id:usuario.casa_id,titulo:t.titulo,responsavel:t.responsavel,prioridade:t.prioridade,recorrente:true,recorrencia:t.recorrencia,criada_por:usuario.id});}
  await carregarTarefas();
}

async function removerTarefa(id){const{error}=await supa.from('tarefas').delete().eq('id',id);if(!error){supa.from('eventos').insert({tipo:'tarefa_removida',entidade:'tarefas',entidade_id:id,usuario_id:usuario.id,detalhe:usuario.nome+' removeu uma tarefa'});await carregarTarefas();}}

// --- HOJE ---
async function carregarHoje(){
  el('saudacao').textContent=saudacao(usuario.nome);
  const dados=await montarHoje(supa,usuario);
  const area=el('cardsHoje');area.innerHTML='';

  // Card plantas (se houver urgentes)
  const urgentes=contarUrgentes(_plantasCache);
  if(urgentes>0){
    const card=criarCartaoHoje('🌿 Plantas','plantas');
    const mini=document.createElement('div');mini.className='mini-item';
    mini.innerHTML=`<span>${urgentes} ${urgentes===1?'planta precisa':'plantas precisam'} de cuidado hoje</span>`;
    card.corpo.appendChild(mini);area.appendChild(card.cartao);
  }

  if(dados.cardapioHoje){
    const card=document.createElement('div');card.className='cartao card-clicavel';card.onclick=()=>trocarAba('cardapio');
    const cab=document.createElement('div');cab.className='card-hoje-titulo';const t=document.createElement('div');t.className='titulo-secao';t.textContent='Cardápio de hoje';const ab=document.createElement('span');ab.className='abrir';ab.textContent='Abrir';cab.appendChild(t);cab.appendChild(ab);card.appendChild(cab);
    const slots=document.createElement('div');slots.className='card-cardapio-hoje';const ch=dados.cardapioHoje;
    if(ch.almoco){const s=document.createElement('div');s.className='slot-hoje';s.innerHTML=`<div class="rotulo">🍱 Almoço</div><div class="prato">${ch.almoco}</div>`;slots.appendChild(s);}
    if(ch.janta){const s=document.createElement('div');s.className='slot-hoje';s.innerHTML=`<div class="rotulo">🍽️ Janta</div><div class="prato">${ch.janta}</div>`;slots.appendChild(s);}
    card.appendChild(slots);if(ch.responsavel){const r=document.createElement('div');r.className='meta';r.style.marginTop='8px';r.textContent=`Responsável: ${ch.responsavel==='ambos'?'Ambos':ch.responsavel.charAt(0).toUpperCase()+ch.responsavel.slice(1)}`;card.appendChild(r);}
    area.appendChild(card);
  }

  if(dados.tudoEmDia&&!dados.cardapioHoje&&urgentes===0){const c=document.createElement('div');c.className='cartao';c.innerHTML='<div class="tudo-em-dia">Tudo em dia por aqui. ✨</div>';area.appendChild(c);return;}
  if(dados.contasAtencao.length){const card=criarCartaoHoje('Contas próximas','contas');for(const c of dados.contasAtencao){const q=c.status==='vencida'?'venceu':c.status==='vence_hoje'?'vence hoje':`vence em ${c.dias} ${c.dias===1?'dia':'dias'}`;card.corpo.appendChild(miniItem(c.nome,q,formatarValor(c.valor)));}area.appendChild(card.cartao);}
  if(dados.tarefasAtencao&&dados.tarefasAtencao.length){const card=criarCartaoHoje('Tarefas da Casa','tarefas');for(const t of dados.tarefasAtencao){const q=t.responsavel==='ambos'?'Ambos':t.responsavel.charAt(0).toUpperCase()+t.responsavel.slice(1);card.corpo.appendChild(miniItem(t.titulo,q,''));}area.appendChild(card.cartao);}
  if(dados.estoqueAtencao.length){const card=criarCartaoHoje('Estoque em atenção','estoque');for(const i of dados.estoqueAtencao)card.corpo.appendChild(miniItem(i.nome,`${i.quantidade} · ${i.status==='acabou'?'acabou':'baixo'}`,''));area.appendChild(card.cartao);}
  if(dados.compras.total){const card=criarCartaoHoje('Compras','compras');for(const n of dados.compras.primeiros)card.corpo.appendChild(miniItem(n,'',''));if(dados.compras.total>dados.compras.primeiros.length){const r=document.createElement('div');r.className='mini-item';r.style.color='var(--suave)';r.textContent=`+ mais ${dados.compras.total-dados.compras.primeiros.length} na lista`;card.corpo.appendChild(r);}area.appendChild(card.cartao);}
}

function criarCartaoHoje(titulo,dest){const c=document.createElement('div');c.className='cartao card-clicavel';const cab=document.createElement('div');cab.className='card-hoje-titulo';const t=document.createElement('div');t.className='titulo-secao';t.textContent=titulo;const ab=document.createElement('span');ab.className='abrir';ab.textContent='Abrir';cab.appendChild(t);cab.appendChild(ab);const corpo=document.createElement('div');c.appendChild(cab);c.appendChild(corpo);c.onclick=()=>trocarAba(dest);return{cartao:c,corpo};}
function miniItem(nome,meta,valor){const l=document.createElement('div');l.className='mini-item';const e=document.createElement('span');e.textContent=nome;const d=document.createElement('span');d.className='m-meta';d.textContent=[meta,valor].filter(Boolean).join('  ');l.appendChild(e);l.appendChild(d);return l;}

// --- EVENTOS ---
el('btnEntrar').onclick=entrar;
el('senha').addEventListener('keydown',e=>{if(e.key==='Enter')entrar();});
el('btnAdd').onclick=adicionar;
el('novoItem').addEventListener('keydown',e=>{if(e.key==='Enter')adicionar();});
el('btnAddEstoque').onclick=adicionarEstoque;
el('estTipo').addEventListener('change',e=>{const t=e.target.value;el('estCamposNum').classList.toggle('oculto',t==='nivel_visual');el('estCamposNivel').classList.toggle('oculto',t!=='nivel_visual');});
el('btnInventario').onclick=abrirModalInventario;
el('btnFecharInventario').onclick=()=>{el('modalInventario').classList.add('oculto');el('modalInventario').classList.remove('modal-aberto');};
el('btnIniciarInventario').onclick=iniciarInventario;
el('btnConcluirInventario').onclick=concluirInventario;
el('btnVoltarLocal').onclick=()=>{el('invPassoItens').classList.add('oculto');el('invPassoLocal').classList.remove('oculto');};
el('btnSalvarRefeicao').onclick=salvarRefeicao;
el('btnAddIngrediente').onclick=adicionarLinhaIngrediente;
el('btnConfirmarRef').onclick=confirmarSlot;
el('btnLimparSlot').onclick=limparSlot;
el('btnFecharModalRef').onclick=fecharModalRefeicao;
el('btnSalvarPlan').onclick=salvarPlanejamento;
el('btnGerarLista').onclick=gerarListaCardapio;
el('btnSalvarRitual').onclick=salvarRitual;
el('btnConcluirRitual').onclick=concluirRitual;
el('btnCriarTarefaRitual').onclick=criarTarefaDoRitual;
el('btnFecharModalRitual').onclick=()=>{el('modalRitual').classList.add('oculto');el('modalRitual').classList.remove('modal-aberto');_ritualAtual=null;};
el('btnFecharPlanta').onclick=()=>{el('modalPlanta').classList.add('oculto');el('modalPlanta').classList.remove('modal-aberto');};
el('btnAddTarefa').onclick=adicionarTarefa;
el('tfRecorrente').addEventListener('change',e=>el('tfRecorrenciaBox').classList.toggle('oculto',!e.target.checked));
el('btnAddConta').onclick=adicionarConta;
el('btnSair').onclick=sair;
document.querySelectorAll('.aba').forEach(b=>{b.onclick=()=>trocarAba(b.dataset.aba);});
document.querySelectorAll('.filtro-btn').forEach(b=>{b.onclick=()=>{_filtroAtual=b.dataset.filtro;document.querySelectorAll('.filtro-btn').forEach(x=>x.classList.remove('ativo'));b.classList.add('ativo');renderizarPlantas();};});

iniciar();
