(() => {
  'use strict';

  const STYLE_ID = 'lifeos-phase3-polish';
  let plantSnapshot = null;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = '/phase3-polish.css?v=1';
    document.head.appendChild(link);
  }

  function ensureTodayHeading() {
    const metrics = document.getElementById('metricasHoje');
    if (!metrics || document.getElementById('phase3TodayHeading')) return;
    const heading = document.createElement('div');
    heading.id = 'phase3TodayHeading';
    heading.className = 'phase3-today-section-head';
    heading.innerHTML = '<strong>Agora na Casa</strong><span>Atalhos e pendências do dia</span>';
    metrics.before(heading);
  }

  const mealIcons = {
    cafe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M17 10h1a3 3 0 0 1 0 6h-2"/><path d="M7 4v2M11 3v3M15 4v2"/></svg>',
    almoco: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
    lanche: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 10h14l-1 9H6l-1-9Z"/><path d="M8 10c0-3 1.8-5 4-5s4 2 4 5"/></svg>',
    janta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h16"/><path d="M6 14a6 6 0 0 1 12 0"/><path d="M12 5V3"/><path d="M4 18h16"/></svg>',
  };

  function mealType(text = '') {
    const value = String(text).toLocaleLowerCase('pt-BR');
    if (value.startsWith('café') || value.startsWith('cafe')) return 'cafe';
    if (value.startsWith('almoço') || value.startsWith('almoco')) return 'almoco';
    if (value.startsWith('lanche')) return 'lanche';
    if (value.startsWith('jantar') || value.startsWith('janta')) return 'janta';
    return null;
  }

  function decorateMealRows(root = document) {
    root.querySelectorAll?.('#cardsHoje .mini-item > span:first-child').forEach(label => {
      if (label.dataset.phase3Meal === '1') return;
      const type = mealType(label.textContent);
      if (!type) return;
      label.dataset.phase3Meal = '1';
      label.classList.add('phase3-meal-label');
      const icon = document.createElement('span');
      icon.className = 'phase3-meal-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = mealIcons[type];
      label.prepend(icon);
    });
  }

  function ensurePlantOverview() {
    const filters = document.querySelector('#abaPlantas .filtros-plantas');
    if (!filters) return null;
    let overview = document.getElementById('phase3PlantOverview');
    if (overview) return overview;
    overview = document.createElement('div');
    overview.id = 'phase3PlantOverview';
    overview.className = 'phase3-plant-overview';
    overview.innerHTML = `
      <div class="phase3-plant-stat"><strong data-phase3-plant-total>0</strong><span>plantas ativas</span></div>
      <div class="phase3-plant-stat is-attention"><strong data-phase3-plant-attention>0</strong><span>precisam de atenção</span></div>
      <div class="phase3-plant-stat is-today"><strong data-phase3-plant-today>0</strong><span>cuidados hoje</span></div>`;
    filters.before(overview);
    return overview;
  }

  function updatePlantOverview(detail = {}) {
    const overview = ensurePlantOverview();
    if (!overview) return;
    const total = Number(detail.total || 0);
    const overdue = Number(detail.overdue || 0);
    const today = Number(detail.today || 0);
    overview.querySelector('[data-phase3-plant-total]').textContent = String(total);
    overview.querySelector('[data-phase3-plant-attention]').textContent = String(overdue + today);
    overview.querySelector('[data-phase3-plant-today]').textContent = String(today);
  }

  function capturePlantSnapshot() {
    const list = document.getElementById('listaPlantas');
    const activeFilter = document.querySelector('#abaPlantas .filtro-btn.ativo');
    if (!list || !activeFilter) return;
    const filter = activeFilter.dataset.filtro || activeFilter.textContent.trim().toLocaleLowerCase('pt-BR');
    const isAll = filter === 'todas' || filter === 'todas as plantas' || filter === 'todas';
    if (!isAll) return;

    const cards = [...list.querySelectorAll('.planta-card')];
    if (!cards.length) {
      const counter = document.getElementById('plantasContador')?.textContent || '';
      const total = Number(counter.match(/\d+/)?.[0] || 0);
      plantSnapshot = { total, overdue: 0, today: 0 };
      updatePlantOverview(plantSnapshot);
      return;
    }

    let overdue = 0;
    let today = 0;
    cards.forEach(card => {
      const status = card.querySelector('.badge')?.textContent?.trim().toLocaleLowerCase('pt-BR') || '';
      if (status === 'vencida') overdue += 1;
      if (status === 'hoje') today += 1;
    });
    plantSnapshot = { total: cards.length, overdue, today };
    updatePlantOverview(plantSnapshot);
  }

  function refreshPlants() {
    ensurePlantOverview();
    window.requestAnimationFrame(() => {
      capturePlantSnapshot();
      if (plantSnapshot) updatePlantOverview(plantSnapshot);
    });
  }

  function enhance(root = document) {
    ensureStyle();
    ensureTodayHeading();
    ensurePlantOverview();
    decorateMealRows(root);
    refreshPlants();
  }

  window.addEventListener('lifeos:plants-updated', event => {
    plantSnapshot = event.detail || plantSnapshot;
    updatePlantOverview(event.detail || {});
  });
  window.addEventListener('lifeos:ready', () => window.setTimeout(() => enhance(document), 100));

  document.addEventListener('click', event => {
    if (event.target.closest('#abaPlantas .filtro-btn')) window.setTimeout(refreshPlants, 80);
  });

  const observer = new MutationObserver(records => {
    let plantListChanged = false;
    records.forEach(record => {
      decorateMealRows(record.target instanceof Element ? record.target : document);
      if (record.target instanceof Element && (record.target.id === 'listaPlantas' || record.target.closest?.('#listaPlantas'))) {
        plantListChanged = true;
      }
    });
    ensureTodayHeading();
    ensurePlantOverview();
    if (plantListChanged) refreshPlants();
  });

  function start() {
    enhance(document);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
