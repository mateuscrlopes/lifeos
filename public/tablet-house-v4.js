(() => {
  'use strict';

  const CSS_ID = 'tablet-house-v4-css';
  const NAV_ID = 'tabletHouseNavV4';
  const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const MODULE_TITLES = {
    inicio: 'Painel da Casa',
    tarefas: 'Tarefas da Casa',
    compras: 'Compras',
    estoque: 'Estoque',
    contas: 'Financeiro da Casa',
    cardapio: 'Cardápio da Casa',
    plantas: 'Plantas',
  };

  const ICONS = {
    inicio: '<path d="M3 10 12 3l9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
    tarefas: '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    compras: '<circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M3 4h2l2.5 10h10l2-7H7"/>',
    estoque: '<path d="M4 7 12 3l8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/>',
    contas: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
    cardapio: '<path d="M4 3v7a3 3 0 0 0 3 3h1V3M8 3v10M18 3v18M15 8c0-3 1-5 3-5v10h-3Z"/>',
    plantas: '<path d="M12 14V8"/><path d="M12 10c-4 0-6-2-6-5 4 0 6 2 6 5Z"/><path d="M12 8c4 0 6-2 6-5-4 0-6 2-6 5Z"/><path d="M6 14h12l-1 7H7Z"/>',
  };

  const mealState = { week: null, plans: [], byKey: new Map() };
  const plantState = { plants: [] };

  function svg(name, size = 19) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  function esc(value = '') {
    if (typeof tabletEscapeHtml === 'function') return tabletEscapeHtml(value);
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function loadCss() {
    if (document.getElementById(CSS_ID)) return;
    const link = document.createElement('link');
    link.id = CSS_ID;
    link.rel = 'stylesheet';
    link.href = '/tablet-house-v4.css?v=1';
    document.head.appendChild(link);
  }

  function mondayOf(date = new Date()) {
    const current = new Date(date);
    current.setHours(12, 0, 0, 0);
    const weekday = current.getDay();
    current.setDate(current.getDate() + (weekday === 0 ? -6 : 1 - weekday));
    return current;
  }

  function dateCivil(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function formatShortDate(date) {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
      .format(date)
      .replace('.', '');
  }

  function titleCase(value = '') {
    const text = String(value).trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
  }

  function profileLabel(responsavel) {
    if (!responsavel || responsavel === 'ambos') return 'Casa';
    if (responsavel === 'ghustavo' || responsavel === 'gustavo') return 'Gustavo';
    return titleCase(responsavel);
  }

  function buildNavButton(page, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sidebar-btn';
    button.dataset.pag = page;
    button.innerHTML = `${svg(page)}<span>${label}</span>`;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => window.mudarPagina(page, button));
    return button;
  }

  function installHouseNavigation() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav || nav.dataset.houseV4 === '1') return;
    nav.dataset.houseV4 = '1';
    nav.id = NAV_ID;
    nav.innerHTML = '';

    [
      ['inicio', 'Hoje'],
      ['tarefas', 'Tarefas'],
      ['compras', 'Compras'],
      ['estoque', 'Estoque'],
      ['contas', 'Financeiro'],
      ['cardapio', 'Cardápio'],
      ['plantas', 'Plantas'],
    ].forEach(([page, label]) => nav.appendChild(buildNavButton(page, label)));

    nav.querySelector('[data-pag="inicio"]')?.classList.add('ativo');

    const profile = document.querySelector('.sidebar-profile');
    if (profile) {
      profile.setAttribute('aria-label', 'Perfil da Casa');
      profile.querySelector('span')?.replaceChildren(document.createTextNode('Casa'));
    }
  }

  function installPages() {
    const body = document.querySelector('.painel-body');
    if (!body) return;

    if (!document.getElementById('pag-cardapio')) {
      const page = document.createElement('div');
      page.id = 'pag-cardapio';
      page.className = 'pagina';
      page.innerHTML = `
        <div class="tablet-house-page-head">
          <div><h1>Cardápio da Casa</h1><p>Semana planejada e receitas para consultar enquanto cozinha.</p></div>
          <span class="tablet-house-chip">Compartilhado</span>
        </div>
        <div id="tabletHouseMenu"><div class="tablet-house-loading">Carregando cardápio...</div></div>`;
      body.appendChild(page);
    }

    if (!document.getElementById('pag-plantas')) {
      const page = document.createElement('div');
      page.id = 'pag-plantas';
      page.className = 'pagina';
      page.innerHTML = `
        <div class="tablet-house-page-head">
          <div><h1>Plantas</h1><p>Cuidados da Casa em uma visão própria para tela grande.</p></div>
          <span class="tablet-house-chip">Casa</span>
        </div>
        <div id="tabletHousePlants"><div class="tablet-house-loading">Carregando plantas...</div></div>`;
      body.appendChild(page);
    }
  }

  function markActive(page) {
    document.querySelectorAll('.sidebar-btn').forEach(button => {
      button.classList.toggle('ativo', button.dataset.pag === page);
    });
  }

  function patchNavigation() {
    if (window.__tabletHouseV4Navigation) return;
    const baseChange = window.mudarPagina;
    const baseLoad = window.carregarPaginaSecundaria;

    window.mudarPagina = function houseNavigate(page, button) {
      if (typeof baseChange === 'function') baseChange(page, button || document.querySelector(`[data-pag="${page}"]`));
      markActive(page);
      const title = document.getElementById('headerTitulo');
      if (title) title.textContent = MODULE_TITLES[page] || 'Casa';
      if (page === 'cardapio') loadHouseMenu();
      if (page === 'plantas') loadHousePlants();
    };

    window.carregarPaginaSecundaria = async function houseSecondary(page) {
      if (typeof baseLoad === 'function') await baseLoad(page);
      if (page === 'cardapio') await loadHouseMenu();
      if (page === 'plantas') await loadHousePlants();
    };

    window.abrirModuloApp = function tabletNativeModule(moduleName) {
      const map = {
        financeiro: 'contas',
        contas: 'contas',
        plantas: 'plantas',
        cardapio: 'cardapio',
        compras: 'compras',
        estoque: 'estoque',
        tarefas: 'tarefas',
      };
      const target = map[moduleName];
      if (target) window.mudarPagina(target, document.querySelector(`[data-pag="${target}"]`));
      else window.mudarPagina('inicio', document.querySelector('[data-pag="inicio"]'));
    };

    window.__tabletHouseV4Navigation = true;
  }

  function mealKey(day, type) { return `${day}:${type}`; }

  async function loadHouseMenu() {
    const area = document.getElementById('tabletHouseMenu');
    if (!area || typeof supa === 'undefined' || !supa || typeof usuario === 'undefined' || !usuario) return;

    area.innerHTML = '<div class="tablet-house-loading">Carregando cardápio...</div>';
    const monday = mondayOf();
    const week = dateCivil(monday);
    mealState.week = week;

    const { data, error } = await supa
      .from('planejamento_semana')
      .select('id,responsavel,planejamento_dias(id,dia_semana,tipo,refeicao_id,refeicao_nome,calorias,refeicoes(id,nome,calorias_por_porcao))')
      .eq('casa_id', usuario.casa_id)
      .eq('semana_inicio', week);

    if (error) {
      area.innerHTML = '<div class="tablet-house-empty">Não foi possível carregar o cardápio da semana.</div>';
      return;
    }

    mealState.plans = data || [];
    mealState.byKey = new Map();
    for (const plan of mealState.plans) {
      for (const day of plan.planejamento_dias || []) {
        const key = mealKey(Number(day.dia_semana), day.tipo);
        if (!mealState.byKey.has(key)) mealState.byKey.set(key, []);
        mealState.byKey.get(key).push({ ...day, responsavel: plan.responsavel });
      }
    }

    for (const list of mealState.byKey.values()) {
      list.sort((a, b) => (a.responsavel === 'ambos' ? -1 : 1) - (b.responsavel === 'ambos' ? -1 : 1));
    }

    const todayJs = new Date().getDay();
    const today = todayJs === 0 ? 7 : todayJs;
    const sunday = addDays(monday, 6);

    area.innerHTML = `
      <div class="tablet-menu-toolbar">
        <strong>Semana de ${esc(formatShortDate(monday))} a ${esc(formatShortDate(sunday))}</strong>
        <span class="tablet-house-chip">Toque em uma refeição para abrir a receita</span>
      </div>
      <div class="tablet-menu-week">
        ${DAY_NAMES.map((name, index) => renderMenuDay(index + 1, name, addDays(monday, index), today === index + 1)).join('')}
      </div>`;

    area.querySelectorAll('[data-tablet-recipe]').forEach(button => {
      button.addEventListener('click', () => openRecipe(button.dataset.tabletRecipe));
    });
  }

  function renderMealSlot(day, type, label) {
    const list = mealState.byKey.get(mealKey(day, type)) || [];
    if (!list.length) {
      return `<div class="tablet-meal-block"><div class="tablet-meal-label">${label}</div><div class="tablet-meal-empty">Não planejado</div></div>`;
    }

    const buttons = list.map(item => {
      const name = item.refeicoes?.nome || item.refeicao_nome || 'Refeição planejada';
      const kcal = item.calorias ?? item.refeicoes?.calorias_por_porcao ?? null;
      const recipeId = item.refeicao_id || item.refeicoes?.id || '';
      const profile = profileLabel(item.responsavel);
      return `<button type="button" class="tablet-meal${recipeId ? ' has-recipe' : ''}" ${recipeId ? `data-tablet-recipe="${esc(recipeId)}"` : ''}>
        <span class="tablet-meal-name">${esc(name)}</span>
        <span class="tablet-meal-meta">${esc(profile)}${kcal != null ? ` · ${Number(kcal)} kcal` : ''}</span>
      </button>`;
    }).join('');

    return `<div class="tablet-meal-block"><div class="tablet-meal-label">${label}</div>${buttons}</div>`;
  }

  function renderMenuDay(day, label, date, today) {
    return `<article class="tablet-menu-day${today ? ' is-today' : ''}">
      <div class="tablet-menu-day-head"><strong>${label}</strong><span>${esc(formatShortDate(date))}</span></div>
      ${renderMealSlot(day, 'almoco', 'Almoço')}
      ${renderMealSlot(day, 'janta', 'Jantar')}
    </article>`;
  }

  async function openRecipe(recipeId) {
    if (!recipeId || typeof supa === 'undefined' || !supa || !usuario) return;
    closeRecipe();

    const overlay = document.createElement('div');
    overlay.className = 'tablet-recipe-overlay';
    overlay.id = 'tabletRecipeOverlay';
    overlay.innerHTML = '<section class="tablet-recipe-dialog" role="dialog" aria-modal="true"><div class="tablet-house-loading">Abrindo receita...</div></section>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => { if (event.target === overlay) closeRecipe(); });

    const { data, error } = await supa
      .from('refeicoes')
      .select('id,nome,tipo,porcoes,tempo_minutos,modo_preparo,observacoes,calorias_por_porcao,refeicao_ingredientes(id,nome,quantidade,unidade)')
      .eq('id', recipeId)
      .eq('casa_id', usuario.casa_id)
      .maybeSingle();

    const dialog = overlay.querySelector('.tablet-recipe-dialog');
    if (error || !data) {
      dialog.innerHTML = '<div class="tablet-house-empty">Não foi possível abrir esta receita.</div>';
      return;
    }

    const ingredients = data.refeicao_ingredientes || [];
    dialog.innerHTML = `
      <div class="tablet-recipe-head">
        <div>
          <h2>${esc(data.nome)}</h2>
          <p>${data.porcoes ? `${Number(data.porcoes)} porções` : 'Receita da Casa'}${data.tempo_minutos ? ` · ${Number(data.tempo_minutos)} min` : ''}${data.calorias_por_porcao != null ? ` · ${Number(data.calorias_por_porcao)} kcal/porção` : ''}</p>
        </div>
        <button type="button" class="tablet-recipe-close" aria-label="Fechar receita">×</button>
      </div>
      <div class="tablet-recipe-grid">
        <section class="tablet-recipe-section">
          <h3>Ingredientes</h3>
          ${ingredients.length ? `<ul>${ingredients.map(item => `<li>${esc([item.quantidade, item.unidade, item.nome].filter(Boolean).join(' '))}</li>`).join('')}</ul>` : '<div class="tablet-house-empty">Sem ingredientes cadastrados.</div>'}
        </section>
        <section class="tablet-recipe-section">
          <h3>Modo de preparo</h3>
          <div class="tablet-recipe-prep">${esc(data.modo_preparo || 'Modo de preparo ainda não cadastrado.')}</div>
          ${data.observacoes ? `<div class="tablet-recipe-prep" style="margin-top:12px"><strong>Observações</strong>\n${esc(data.observacoes)}</div>` : ''}
        </section>
      </div>`;

    dialog.querySelector('.tablet-recipe-close')?.addEventListener('click', closeRecipe);
  }

  function closeRecipe() {
    document.getElementById('tabletRecipeOverlay')?.remove();
  }

  function plantUrgency(plant) {
    const today = dateCivil(new Date());
    const routines = (plant.planta_rotinas || []).filter(r => r.ativa && r.proxima_realizacao);
    if (!routines.length) return { status: 'ok', label: 'Sem rotina', routine: null, days: null };
    const routine = [...routines].sort((a, b) => String(a.proxima_realizacao).localeCompare(String(b.proxima_realizacao)))[0];
    const days = Math.round((new Date(`${routine.proxima_realizacao}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000);
    if (days < 0) return { status: 'due', label: `${Math.abs(days)}d atrasada`, routine, days };
    if (days === 0) return { status: 'today', label: 'Hoje', routine, days };
    if (days <= 2) return { status: 'soon', label: `em ${days}d`, routine, days };
    return { status: 'ok', label: `em ${days}d`, routine, days };
  }

  async function loadHousePlants() {
    const area = document.getElementById('tabletHousePlants');
    if (!area || typeof supa === 'undefined' || !supa || typeof usuario === 'undefined' || !usuario) return;
    area.innerHTML = '<div class="tablet-house-loading">Carregando plantas...</div>';

    const { data, error } = await supa
      .from('plantas')
      .select('id,codigo,numero_etiqueta,nome_personalizado,comodo,perfil_hidrico,status,especies(nome_popular),planta_rotinas(id,tipo,intervalo_dias,proxima_realizacao,ultima_realizacao,ativa)')
      .eq('casa_id', usuario.casa_id)
      .eq('status', 'ativa')
      .order('numero_etiqueta');

    if (error) {
      area.innerHTML = '<div class="tablet-house-empty">Não foi possível carregar as plantas.</div>';
      return;
    }

    plantState.plants = data || [];
    const decorated = plantState.plants.map(plant => ({ plant, urgency: plantUrgency(plant) }))
      .sort((a, b) => {
        const order = { due: 0, today: 1, soon: 2, ok: 3 };
        return (order[a.urgency.status] ?? 9) - (order[b.urgency.status] ?? 9)
          || Number(a.plant.numero_etiqueta || 0) - Number(b.plant.numero_etiqueta || 0);
      });

    const due = decorated.filter(item => item.urgency.status === 'due').length;
    const today = decorated.filter(item => item.urgency.status === 'today').length;

    area.innerHTML = `
      <div class="tablet-plant-summary">
        <div class="tablet-plant-summary-card"><strong>${decorated.length}</strong><span>plantas ativas</span></div>
        <div class="tablet-plant-summary-card"><strong>${due + today}</strong><span>precisam de atenção</span></div>
        <div class="tablet-plant-summary-card"><strong>${today}</strong><span>cuidados hoje</span></div>
      </div>
      <div class="tablet-plant-grid">
        ${decorated.length ? decorated.map(item => renderPlantCard(item.plant, item.urgency)).join('') : '<div class="tablet-house-empty">Nenhuma planta ativa.</div>'}
      </div>`;

    area.querySelectorAll('[data-tablet-care]').forEach(button => {
      button.addEventListener('click', () => registerPlantCare(button.dataset.tabletPlant, button.dataset.tabletCare, button));
    });
  }

  function renderPlantCard(plant, urgency) {
    const name = plant.nome_personalizado || plant.especies?.nome_popular || plant.codigo || 'Planta';
    const routine = urgency.routine;
    const statusClass = urgency.status === 'due' ? ' is-due' : urgency.status === 'today' ? ' is-today' : '';
    const canCare = routine && urgency.days != null && urgency.days <= 0;
    return `<article class="tablet-plant-card">
      <div class="tablet-plant-icon">${svg('plantas', 20)}</div>
      <div>
        <div class="tablet-plant-name">${esc(name)}</div>
        <div class="tablet-plant-meta">${esc(plant.codigo || '')}${plant.comodo ? ` · ${esc(plant.comodo)}` : ''}${routine?.tipo ? ` · ${esc(routine.tipo)}` : ''}</div>
      </div>
      <div class="tablet-plant-actions">
        <span class="tablet-plant-status${statusClass}">${esc(urgency.label)}</span>
        ${canCare ? `<button type="button" class="tablet-care-button" data-tablet-plant="${esc(plant.id)}" data-tablet-care="${esc(routine.id)}">Cuidar</button>` : ''}
      </div>
    </article>`;
  }

  async function registerPlantCare(plantId, routineId, button) {
    const plant = plantState.plants.find(item => String(item.id) === String(plantId));
    const routine = plant?.planta_rotinas?.find(item => String(item.id) === String(routineId));
    if (!plant || !routine || !usuario) return;

    button.disabled = true;
    button.textContent = 'Salvando';
    const now = new Date();
    const today = dateCivil(now);
    const next = addDays(new Date(`${today}T12:00:00`), Number(routine.intervalo_dias || 1));
    const eventType = routine.tipo === 'Trocar a água' ? 'troca_agua'
      : routine.tipo === 'Fazer imersão' ? 'imersao' : 'rega';

    const { error } = await supa.rpc('registrar_cuidado_planta', {
      p_planta_id: plant.id,
      p_rotina_id: routine.id,
      p_usuario_id: usuario.id,
      p_realizado_em: now.toISOString(),
      p_proxima_realizacao: dateCivil(next),
      p_tipo_evento: eventType,
      p_notas: `${routine.tipo} registrada via tablet da Casa`,
    });

    if (error) {
      button.disabled = false;
      button.textContent = 'Cuidar';
      return;
    }

    await loadHousePlants();
    if (typeof carregarPlantasHome === 'function') carregarPlantasHome();
  }

  async function renderHouseHighlights() {
    const area = document.getElementById('painelDestaques');
    if (!area || typeof supa === 'undefined' || !supa || typeof usuario === 'undefined' || !usuario) return;

    const todayDate = new Date();
    const day = todayDate.getDay() === 0 ? 7 : todayDate.getDay();
    const week = dateCivil(mondayOf(todayDate));
    const [menuResult, plantsResult] = await Promise.all([
      supa.from('planejamento_semana')
        .select('responsavel,planejamento_dias(dia_semana,tipo,refeicao_nome,calorias,refeicoes(nome,calorias_por_porcao))')
        .eq('casa_id', usuario.casa_id)
        .eq('semana_inicio', week),
      supa.from('plantas')
        .select('id,planta_rotinas(proxima_realizacao,ativa)')
        .eq('casa_id', usuario.casa_id)
        .eq('status', 'ativa'),
    ]);

    const highlights = [];
    const meals = [];
    for (const plan of menuResult.data || []) {
      for (const item of plan.planejamento_dias || []) {
        if (Number(item.dia_semana) !== day) continue;
        meals.push({ ...item, responsavel: plan.responsavel });
      }
    }
    const sharedMeals = meals.filter(item => item.responsavel === 'ambos');
    const sourceMeals = sharedMeals.length ? sharedMeals : meals;
    const order = ['cafe', 'almoco', 'lanche', 'janta'];
    const hour = todayDate.getHours();
    const target = hour < 11 ? 'cafe' : hour < 15 ? 'almoco' : hour < 18 ? 'lanche' : 'janta';
    const meal = sourceMeals.find(item => item.tipo === target) || sourceMeals.sort((a, b) => order.indexOf(a.tipo) - order.indexOf(b.tipo))[0];
    if (meal) {
      const name = meal.refeicoes?.nome || meal.refeicao_nome || 'Refeição planejada';
      const kcal = meal.calorias ?? meal.refeicoes?.calorias_por_porcao ?? null;
      highlights.push({ title: 'Cardápio da Casa', subtitle: `${name}${kcal != null ? ` · ${Number(kcal)} kcal` : ''}`, icon: 'cardapio' });
    }

    const today = dateCivil(todayDate);
    let urgentPlants = 0;
    for (const plant of plantsResult.data || []) {
      if ((plant.planta_rotinas || []).some(r => r.ativa && r.proxima_realizacao && r.proxima_realizacao <= today)) urgentPlants += 1;
    }
    if (urgentPlants) highlights.push({ title: 'Plantas', subtitle: `${urgentPlants} ${urgentPlants === 1 ? 'planta precisa' : 'plantas precisam'} de cuidado`, icon: 'plantas' });

    if (!highlights.length) {
      area.innerHTML = '<div class="vazio">Casa em dia no momento.</div>';
      return;
    }

    area.innerHTML = highlights.slice(0, 2).map(item => `
      <div class="destaque">
        <div class="destaque-icon" style="background:var(--sage-soft);color:var(--sage)">${svg(item.icon, 17)}</div>
        <div style="flex:1;min-width:0"><div class="destaque-titulo">${esc(item.title)}</div><div class="destaque-sub">${esc(item.subtitle)}</div></div>
      </div>`).join('');
  }

  function patchHouseHighlights() {
    window.carregarDestaquesHome = renderHouseHighlights;
    window.setTimeout(renderHouseHighlights, 500);
  }

  function start() {
    loadCss();
    installPages();
    installHouseNavigation();
    patchNavigation();
    patchHouseHighlights();

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeRecipe();
    });

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      const active = document.querySelector('.sidebar-btn.ativo')?.dataset.pag;
      if (active === 'cardapio') loadHouseMenu();
      if (active === 'plantas') loadHousePlants();
      renderHouseHighlights();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
