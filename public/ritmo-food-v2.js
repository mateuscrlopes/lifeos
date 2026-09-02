(() => {
  'use strict';

  const FOOD = [
    {id:'frango_peito',grupo:'proteina',nome:'Frango',kcal:165,p:31,c:0,porcao:120},
    {id:'frango_desfiado',grupo:'proteina',nome:'Frango desfiado',kcal:165,p:31,c:0,porcao:120},
    {id:'carne_moida',grupo:'proteina',nome:'Carne moída',kcal:215,p:26,c:0,porcao:120},
    {id:'carne_bovina',grupo:'proteina',nome:'Carne bovina',kcal:210,p:28,c:0,porcao:120},
    {id:'peixe',grupo:'proteina',nome:'Peixe',kcal:130,p:26,c:0,porcao:140},
    {id:'porco',grupo:'proteina',nome:'Carne suína',kcal:210,p:27,c:0,porcao:120},
    {id:'ovo',grupo:'proteina',nome:'Ovo',kcal:143,p:13,c:1.1,porcao:100},
    {id:'atum',grupo:'proteina',nome:'Atum',kcal:132,p:29,c:0,porcao:120},
    {id:'arroz_branco',grupo:'carbo',nome:'Arroz branco',kcal:130,p:2.7,c:28,porcao:100},
    {id:'arroz_integral',grupo:'carbo',nome:'Arroz integral',kcal:124,p:2.6,c:25.8,porcao:100},
    {id:'batata',grupo:'carbo',nome:'Batata',kcal:87,p:1.9,c:20,porcao:150},
    {id:'batata_doce',grupo:'carbo',nome:'Batata-doce',kcal:90,p:2,c:21,porcao:150},
    {id:'macarrao',grupo:'carbo',nome:'Macarrão',kcal:158,p:5.8,c:30.9,porcao:120},
    {id:'mandioca',grupo:'carbo',nome:'Mandioca',kcal:125,p:0.6,c:30,porcao:120},
    {id:'feijao',grupo:'carbo',nome:'Feijão',kcal:76,p:4.8,c:13.6,porcao:100},
    {id:'cuscuz',grupo:'carbo',nome:'Cuscuz',kcal:112,p:2.2,c:23,porcao:120},
    {id:'brocolis',grupo:'vegetal',nome:'Brócolis',kcal:35,p:2.4,c:7.2,porcao:80},
    {id:'couve_flor',grupo:'vegetal',nome:'Couve-flor',kcal:25,p:1.9,c:5,porcao:80},
    {id:'abobrinha',grupo:'vegetal',nome:'Abobrinha',kcal:17,p:1.2,c:3.1,porcao:100},
    {id:'cenoura',grupo:'vegetal',nome:'Cenoura',kcal:41,p:0.9,c:9.6,porcao:60},
    {id:'beterraba',grupo:'vegetal',nome:'Beterraba',kcal:43,p:1.6,c:9.6,porcao:60},
    {id:'pepino',grupo:'vegetal',nome:'Pepino',kcal:15,p:0.7,c:3.6,porcao:60},
    {id:'repolho',grupo:'vegetal',nome:'Repolho',kcal:25,p:1.3,c:5.8,porcao:70},
    {id:'couve',grupo:'vegetal',nome:'Couve',kcal:32,p:2.9,c:4.4,porcao:60},
    {id:'vagem',grupo:'vegetal',nome:'Vagem',kcal:35,p:1.9,c:7.9,porcao:80},
    {id:'tomate',grupo:'vegetal',nome:'Tomate',kcal:18,p:0.9,c:3.9,porcao:80},
    {id:'queijo',grupo:'extra',nome:'Queijo',kcal:330,p:22,c:3,porcao:30},
    {id:'requeijao',grupo:'extra',nome:'Requeijão',kcal:250,p:9,c:5,porcao:20},
    {id:'azeite',grupo:'extra',nome:'Azeite',kcal:884,p:0,c:0,porcao:8},
    {id:'molho_cremoso',grupo:'extra',nome:'Molho cremoso',kcal:180,p:3,c:7,porcao:30},
    {id:'farofa',grupo:'extra',nome:'Farofa',kcal:365,p:4,c:64,porcao:25},
  ];

  const LABELS = { cafe:'Café da manhã', lanche_manha:'Lanche da manhã', almoco:'Almoço', lanche_tarde:'Lanche da tarde', jantar:'Jantar' };
  const state = { ctx:null, tipo:null, planned:null, recipes:[], suggestion:null, items:[], open:false, loading:false };

  const norm = (v='') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const esc = (v='') => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const isoLocal = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const monday = () => { const d=new Date(); const day=d.getDay(); d.setDate(d.getDate()+(day===0?-6:1-day)); d.setHours(0,0,0,0); return isoLocal(d); };
  const weekday = () => { const d=new Date().getDay(); return d===0?7:d; };
  const currentMeal = () => { const h=new Date().getHours(); if(h<10)return'cafe'; if(h<12)return'lanche_manha'; if(h<15)return'almoco'; if(h<18)return'lanche_tarde'; return'jantar'; };
  const userKey = () => norm(state.ctx?.usuario?.nome||'').startsWith('mateus')?'mateus':norm(state.ctx?.usuario?.nome||'').startsWith('ghustavo')?'ghustavo':'ambos';

  function macros(items=state.items){
    return items.reduce((a,row)=>{ const food=FOOD.find(f=>f.id===row.id); if(!food)return a; const k=Number(row.g||0)/100; a.kcal+=food.kcal*k; a.p+=food.p*k; a.c+=food.c*k; return a; },{kcal:0,p:0,c:0});
  }
  const macroText = m => `${Math.round(m.kcal)} kcal · ${Math.round(m.p)} g proteína · ${Math.round(m.c)} g carb.`;

  function ingredientGuess(name){
    const n=norm(name);
    return FOOD.find(f=>n.includes(norm(f.nome)) || norm(f.nome).split(' ').every(w=>w.length<4||n.includes(w))) || null;
  }

  function recipeMacros(recipe){
    if(recipe.calorias_por_porcao!=null) return {kcal:Number(recipe.calorias_por_porcao||0),p:Number(recipe.proteina_por_porcao||0),c:Number(recipe.carboidratos_por_porcao||0),estimated:false};
    const acc=(recipe.refeicao_ingredientes||[]).reduce((a,i)=>{ const f=ingredientGuess(i.nome); if(!f)return a; let g=Number(i.quantidade||0); const u=norm(i.unidade||''); if(!g)return a; if(['kg','quilo','quilos'].includes(u))g*=1000; else if(['colher','colheres','cs'].includes(u))g*=15; else if(['un','unidade','unidades'].includes(u))g*=50; const k=g/100; a.kcal+=f.kcal*k; a.p+=f.p*k; a.c+=f.c*k; a.hit++; return a; },{kcal:0,p:0,c:0,hit:0});
    const porcoes=Math.max(1,Number(recipe.porcoes||1));
    return {kcal:acc.kcal/porcoes,p:acc.p/porcoes,c:acc.c/porcoes,estimated:true,hit:acc.hit};
  }

  async function load(){
    const ctx=window.lifeosContext; if(!ctx?.supa||!ctx?.usuario)return;
    state.ctx=ctx; state.tipo=currentMeal(); state.loading=true;
    const semana=monday(); const dia=weekday(); const responsavel=userKey();
    const [plans,recipes]=await Promise.all([
      ctx.supa.from('planejamento_semana').select('id,responsavel,planejamento_dias(id,dia_semana,tipo,refeicao_id,refeicao_nome,calorias,proteina_g,carboidratos_g,refeicoes(id,nome,calorias_por_porcao,proteina_por_porcao,carboidratos_por_porcao))').eq('casa_id',ctx.usuario.casa_id).eq('semana_inicio',semana),
      ctx.supa.from('refeicoes').select('id,nome,tipo,porcoes,calorias_por_porcao,proteina_por_porcao,carboidratos_por_porcao,refeicao_ingredientes(nome,quantidade,unidade)').eq('casa_id',ctx.usuario.casa_id).order('nome')
    ]);
    state.recipes=recipes.data||[];
    const targetType=state.tipo==='jantar'?'janta':state.tipo;
    const p=(plans.data||[]).sort((a,b)=>{ const score=x=>x.responsavel===responsavel?0:x.responsavel==='ambos'?1:2; return score(a)-score(b); }).find(x=>(x.planejamento_dias||[]).some(d=>d.dia_semana===dia && (d.tipo===targetType || d.tipo===state.tipo)));
    const row=p?.planejamento_dias?.find(d=>d.dia_semana===dia&&(d.tipo===targetType||d.tipo===state.tipo));
    state.planned=row?{...row,planId:p.id,responsavel:p.responsavel}:null;
    const candidates=state.recipes.filter(r=>['almoco','janta','jantar'].includes(targetType)?['almoco','janta','jantar'].includes(r.tipo):r.tipo===targetType);
    const index=(dia + (state.tipo==='jantar'?3:0)) % Math.max(1,candidates.length);
    state.suggestion=candidates[index]||state.recipes[index]||null;
    state.loading=false; render();
  }

  function plannedMacros(){
    if(!state.planned)return null;
    return {kcal:Number(state.planned.calorias??state.planned.refeicoes?.calorias_por_porcao??0),p:Number(state.planned.proteina_g??state.planned.refeicoes?.proteina_por_porcao??0),c:Number(state.planned.carboidratos_g??state.planned.refeicoes?.carboidratos_por_porcao??0)};
  }

  function summaryCard(){
    const planned=state.planned; const suggested=state.suggestion; const recipeMacro=suggested?recipeMacros(suggested):null;
    const title=planned?.refeicoes?.nome||planned?.refeicao_nome||suggested?.nome||'Monte sua refeição';
    const m=planned?plannedMacros():recipeMacro;
    return `<section class="foodv2-card ${planned?'is-planned':'is-suggestion'}">
      <div class="foodv2-kicker">${planned?'Planejado para agora':'Sugestão para agora'}</div>
      <div class="foodv2-head"><div><h3>${esc(title)}</h3>${m?`<p>${macroText(m)}</p>`:''}</div><span class="foodv2-pill">${esc(LABELS[state.tipo]||'Refeição')}</span></div>
      <div class="foodv2-actions">
        ${!planned&&suggested?'<button class="foodv2-primary" data-foodv2-accept>Aceitar sugestão</button>':''}
        <button class="foodv2-secondary" data-foodv2-change>${planned?'Trocar refeição':'Escolher outra'}</button>
        <button class="foodv2-secondary" data-foodv2-build>Montar refeição</button>
      </div>
      <p class="foodv2-note">Ao confirmar, o Ritmo registra os macros e atualiza o Cardápio da semana automaticamente.</p>
    </section>`;
  }

  function mount(){
    const view=document.querySelector('#secaoRitmo .ritmo-view'); if(!view)return null;
    const active=document.querySelector('#secaoRitmo .ritmo-tab.is-active')?.dataset?.ritmoTab;
    if(active&&active!=='hoje'){ document.getElementById('foodV2Root')?.remove(); return null; }
    let root=document.getElementById('foodV2Root');
    if(!root){ root=document.createElement('div'); root.id='foodV2Root'; view.prepend(root); }
    return root;
  }

  function render(){
    const root=mount(); if(!root)return;
    root.innerHTML=state.loading?'<div class="foodv2-card"><div class="foodv2-skeleton"></div></div>':summaryCard();
    const old=document.querySelector('#secaoRitmo .ritmo-now-section'); if(old)old.classList.add('foodv2-old-hidden');
  }

  function dialog(){
    let d=document.getElementById('foodV2Dialog'); if(d)return d;
    d=document.createElement('div'); d.id='foodV2Dialog'; d.className='foodv2-overlay'; d.innerHTML='<div class="foodv2-sheet" role="dialog" aria-modal="true"><div class="foodv2-sheet-head"><div><strong id="foodV2Title">Escolher refeição</strong><span id="foodV2Subtitle"></span></div><button type="button" data-foodv2-close aria-label="Fechar">×</button></div><div id="foodV2Body" class="foodv2-body"></div></div>'; document.body.appendChild(d); return d;
  }
  function close(){ const d=document.getElementById('foodV2Dialog'); if(d)d.classList.remove('is-open'); state.open=false; }
  function openChooser(){
    const d=dialog(),body=d.querySelector('#foodV2Body'); d.querySelector('#foodV2Title').textContent='Escolher refeição'; d.querySelector('#foodV2Subtitle').textContent='Do que já existe na Casa';
    const recipes=state.recipes.map(r=>({r,m:recipeMacros(r)})).filter(x=>x.m.kcal>0).sort((a,b)=>a.r.nome.localeCompare(b.r.nome,'pt-BR'));
    body.innerHTML=`<div class="foodv2-search"><input id="foodV2Search" type="search" placeholder="Buscar refeição salva"></div><div class="foodv2-recipe-list" id="foodV2RecipeList">${recipes.map(({r,m})=>`<button type="button" class="foodv2-recipe" data-foodv2-recipe="${r.id}"><span><strong>${esc(r.nome)}</strong><small>${macroText(m)}${m.estimated?' · estimado':''}</small></span><span>Escolher</span></button>`).join('')}</div><button type="button" class="foodv2-build-link" data-foodv2-build>Não foi isso? Montar pelos ingredientes</button>`;
    d.classList.add('is-open'); state.open=true;
  }

  function itemRow(row,index){ const f=FOOD.find(x=>x.id===row.id); return `<div class="foodv2-selected" data-foodv2-row="${index}"><span>${esc(f?.nome||row.id)}</span><label><input type="number" min="1" max="1000" step="5" value="${Number(row.g||f?.porcao||100)}" data-foodv2-grams="${index}"> g</label><button type="button" data-foodv2-remove="${index}" aria-label="Remover">×</button></div>`; }
  function renderBuilder(){
    const d=dialog(),body=d.querySelector('#foodV2Body'); d.querySelector('#foodV2Title').textContent='Montar refeição'; d.querySelector('#foodV2Subtitle').textContent='Escolha os alimentos e ajuste a quantidade';
    const group=(id,title)=>`<div class="foodv2-group"><strong>${title}</strong><div class="foodv2-chips">${FOOD.filter(f=>f.grupo===id).map(f=>`<button type="button" data-foodv2-add="${f.id}">${esc(f.nome)}</button>`).join('')}</div></div>`;
    const m=macros(); body.innerHTML=`<div class="foodv2-macro-live"><strong>${Math.round(m.kcal)} kcal</strong><span>${Math.round(m.p)} g proteína</span><span>${Math.round(m.c)} g carb.</span></div>${group('proteina','1. Proteína')}${group('carbo','2. Carboidrato')}${group('vegetal','3. Legumes e salada')}${group('extra','4. Extras')}<div class="foodv2-selected-list">${state.items.length?state.items.map(itemRow).join(''):'<p>Selecione os alimentos acima. Você pode combinar quantos quiser.</p>'}</div><label class="foodv2-name"><span>Nome da refeição (opcional)</span><input id="foodV2CustomName" placeholder="Ex.: frango cremoso com arroz e salada"></label><button type="button" class="foodv2-primary foodv2-save" data-foodv2-save-builder ${state.items.length?'':'disabled'}>Usar esta refeição</button>`;
    d.classList.add('is-open'); state.open=true;
  }

  async function ensureWeekPlan(){
    const {supa,usuario}=state.ctx; const resp=userKey(); const semana=monday();
    const {data}=await supa.from('planejamento_semana').select('id').eq('casa_id',usuario.casa_id).eq('semana_inicio',semana).eq('responsavel',resp).maybeSingle();
    if(data?.id)return data.id;
    const ins=await supa.from('planejamento_semana').insert({casa_id:usuario.casa_id,semana_inicio:semana,responsavel:resp,criado_por:usuario.id}).select('id').single();
    if(ins.error)throw ins.error; return ins.data.id;
  }

  async function saveMeal({name,recipeId=null,kcal=0,p=0,c=0,source='manual',description=null}){
    const {supa,usuario}=state.ctx; const planId=await ensureWeekPlan(); const dia=weekday(); const tipo=state.tipo==='jantar'?'janta':state.tipo;
    const payload={planejamento_id:planId,dia_semana:dia,tipo,refeicao_id:recipeId,refeicao_nome:name,calorias:Math.round(kcal),proteina_g:Number(p.toFixed(1)),carboidratos_g:Number(c.toFixed(1))};
    const existing=await supa.from('planejamento_dias').select('id').eq('planejamento_id',planId).eq('dia_semana',dia).eq('tipo',tipo).maybeSingle();
    let dayId=existing.data?.id;
    if(dayId){ const u=await supa.from('planejamento_dias').update(payload).eq('id',dayId); if(u.error)throw u.error; }
    else { const i=await supa.from('planejamento_dias').insert(payload).select('id').single(); if(i.error)throw i.error; dayId=i.data.id; }
    const refeicao=state.tipo; const ref=`foodv2:${isoLocal()}:${refeicao}`;
    const prior=await supa.from('ritmo_consumos').select('id').eq('usuario_id',usuario.id).eq('data',isoLocal()).eq('referencia_chave',ref).maybeSingle();
    const consumo={usuario_id:usuario.id,data:isoLocal(),refeicao,descricao:description||name,calorias:Math.round(kcal),proteina_g:Number(p.toFixed(1)),carboidratos_g:Number(c.toFixed(1)),fonte:source==='recipe'?'receita':'manual',planejamento_dia_id:dayId,referencia_chave:ref};
    if(prior.data?.id){ const u=await supa.from('ritmo_consumos').update(consumo).eq('id',prior.data.id); if(u.error)throw u.error; }
    else { const i=await supa.from('ritmo_consumos').insert(consumo); if(i.error)throw i.error; }
    close(); await load(); window.dispatchEvent(new CustomEvent('lifeos:food-updated',{detail:{tipo:refeicao}}));
  }

  async function acceptRecipe(r){ const m=recipeMacros(r); await saveMeal({name:r.nome,recipeId:r.id,kcal:m.kcal,p:m.p,c:m.c,source:'recipe'}); }

  document.addEventListener('click',async e=>{
    const t=e.target;
    if(t.closest('[data-foodv2-close]'))return close();
    if(t.closest('[data-foodv2-change]'))return openChooser();
    if(t.closest('[data-foodv2-build]')){ state.items=[]; return renderBuilder(); }
    if(t.closest('[data-foodv2-accept]')&&state.suggestion)return acceptRecipe(state.suggestion).catch(console.error);
    const recipeBtn=t.closest('[data-foodv2-recipe]'); if(recipeBtn){ const r=state.recipes.find(x=>x.id===recipeBtn.dataset.foodv2Recipe); if(r)return acceptRecipe(r).catch(console.error); }
    const add=t.closest('[data-foodv2-add]'); if(add){ const f=FOOD.find(x=>x.id===add.dataset.foodv2Add); if(f){ const ex=state.items.find(x=>x.id===f.id); ex?ex.g+=f.porcao:state.items.push({id:f.id,g:f.porcao}); renderBuilder(); } return; }
    const rem=t.closest('[data-foodv2-remove]'); if(rem){ state.items.splice(Number(rem.dataset.foodv2Remove),1); return renderBuilder(); }
    if(t.closest('[data-foodv2-save-builder]')){ const m=macros(); const names=state.items.map(x=>FOOD.find(f=>f.id===x.id)?.nome).filter(Boolean); const custom=document.getElementById('foodV2CustomName')?.value.trim(); const name=custom||names.join(' + '); return saveMeal({name,kcal:m.kcal,p:m.p,c:m.c,source:'manual',description:name}).catch(console.error); }
  });

  document.addEventListener('input',e=>{
    if(e.target.id==='foodV2Search'){ const q=norm(e.target.value); document.querySelectorAll('#foodV2RecipeList .foodv2-recipe').forEach(b=>b.hidden=q&&!norm(b.textContent).includes(q)); }
    if(e.target.matches('[data-foodv2-grams]')){ const idx=Number(e.target.dataset.foodv2Grams); if(state.items[idx])state.items[idx].g=Math.max(0,Number(e.target.value||0)); const m=macros(); const live=document.querySelector('.foodv2-macro-live'); if(live)live.innerHTML=`<strong>${Math.round(m.kcal)} kcal</strong><span>${Math.round(m.p)} g proteína</span><span>${Math.round(m.c)} g carb.</span>`; }
  });

  const observer=new MutationObserver(()=>{ if(document.querySelector('#secaoRitmo .ritmo-view')&&!document.getElementById('foodV2Root')) load(); });
  function start(){ const link=document.createElement('link'); link.rel='stylesheet'; link.href='/ritmo-food-v2.css?v=1'; link.id='ritmo-food-v2-css'; if(!document.getElementById(link.id))document.head.appendChild(link); observer.observe(document.body,{childList:true,subtree:true}); load(); }
  window.addEventListener('lifeos:ready',()=>setTimeout(start,120),{once:true});
  if(window.lifeosContext)setTimeout(start,50);
})();