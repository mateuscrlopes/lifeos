(() => {
  'use strict';

  const STYLE_ID = 'lifeos-phase4-polish';
  const exerciseRequests = new Map();
  let sortingPlants = false;
  let plantSortScheduled = false;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = '/phase4-polish.css?v=1';
    document.head.appendChild(link);
  }

  function normalizar(valor = '') {
    return String(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapar(valor = '') {
    return String(valor)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function prioridadePlanta(card) {
    const badge = normalizar(card.querySelector('.badge')?.textContent || '');
    const texto = normalizar(card.textContent || '');

    if (badge.includes('vencida') || texto.includes('vencida')) {
      const dias = Number(texto.match(/(?:ha|há)\s+(\d+)\s+dias?/)?.[1] || texto.match(/(\d+)\s+dias?\s+atras/)?.[1] || 0);
      return { rank: 0, distance: -dias, label: 'vencida' };
    }
    if (badge === 'hoje' || badge.includes('hoje') || texto.includes('cuidados hoje')) {
      return { rank: 1, distance: 0, label: 'hoje' };
    }
    if (badge.includes('amanha') || badge.includes('amanhã')) {
      return { rank: 2, distance: 1, label: 'proxima' };
    }
    const emDias = Number(texto.match(/em\s+(\d+)\s+dias?/)?.[1] || 999);
    if (Number.isFinite(emDias) && emDias !== 999) return { rank: 2, distance: emDias, label: 'proxima' };
    if (badge.includes('ok') || badge.includes('em dia') || badge.includes('normal')) return { rank: 3, distance: 999, label: 'em-dia' };
    if (badge.includes('sem rotina') || texto.includes('sem rotina')) return { rank: 4, distance: 9999, label: 'sem-rotina' };
    return { rank: 3, distance: 999, label: 'em-dia' };
  }

  function compararPrioridade(a, b) {
    return a.priority.rank - b.priority.rank || a.priority.distance - b.priority.distance || a.index - b.index;
  }

  function sortPlantsNow() {
    if (sortingPlants) return;
    const list = document.getElementById('listaPlantas');
    if (!list) return;
    const groups = [...list.children].filter(node => node instanceof HTMLElement && node.classList.contains('cartao'));
    if (!groups.length) return;

    sortingPlants = true;
    try {
      const rankedGroups = groups.map((group, groupIndex) => {
        const cards = [...group.querySelectorAll(':scope > .planta-card')];
        const rankedCards = cards.map((card, index) => ({ card, index, priority: prioridadePlanta(card) })).sort(compararPrioridade);
        rankedCards.forEach(({ card }) => group.appendChild(card));
        const best = rankedCards[0]?.priority || { rank: 9, distance: 9999, label: 'sem-itens' };
        group.dataset.phase4Priority = best.label;
        return { group, index: groupIndex, priority: best };
      }).sort(compararPrioridade);

      rankedGroups.forEach(({ group }) => list.appendChild(group));
    } finally {
      sortingPlants = false;
    }
  }

  function schedulePlantSort() {
    if (plantSortScheduled) return;
    plantSortScheduled = true;
    requestAnimationFrame(() => {
      plantSortScheduled = false;
      sortPlantsNow();
    });
  }

  function equipamentoPt(value = '') {
    const mapa = {
      dumbbell: 'halteres', barbell: 'barra', cable: 'polia', machine: 'máquina',
      'leverage machine': 'máquina articulada', 'body only': 'peso corporal', kettlebells: 'kettlebell',
      bands: 'elástico', 'e-z curl bar': 'barra W', other: 'equipamento livre',
    };
    const key = normalizar(value);
    return mapa[key] || value || 'equipamento não informado';
  }

  function mediaPlaceholder() {
    return '<svg class="phase4-exercise-placeholder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 6.5h11M4 9v6M20 9v6M7 8v8M17 8v8M7 12h10"/></svg>';
  }

  function renderExerciseDetail(data) {
    const imagens = Array.isArray(data.images) ? data.images.slice(0, 2) : [];
    const gallery = imagens.length ? `<div class="phase4-exercise-gallery">${imagens.map((url, index) => `<figure><img src="${escapar(url)}" alt="${index === 0 ? 'Posição inicial' : 'Posição final'} de ${escapar(data.name || data.query)}" loading="lazy" referrerpolicy="no-referrer"><figcaption>${index === 0 ? 'Posição inicial' : 'Posição final'}</figcaption></figure>`).join('')}</div>` : '';
    return `${gallery}<p class="phase4-exercise-equipment">Equipamento: ${escapar(equipamentoPt(data.equipment))}</p><p class="phase4-exercise-source">Demonstração do catálogo público Free Exercise DB. A execução pode variar conforme o aparelho disponível na academia.</p>`;
  }

  async function buscarMidia(nome) {
    const key = normalizar(nome);
    if (!exerciseRequests.has(key)) {
      const request = fetch(`/api/exercicios/midia?nome=${encodeURIComponent(nome)}`, { headers: { Accept: 'application/json' } })
        .then(async response => {
          if (!response.ok) return { found: false };
          return response.json();
        })
        .catch(() => ({ found: false }));
      exerciseRequests.set(key, request);
    }
    return exerciseRequests.get(key);
  }

  async function enrichExercise(card) {
    if (!(card instanceof HTMLElement) || card.dataset.phase4Media) return;
    const title = card.querySelector(':scope > strong');
    const nome = title?.textContent?.trim();
    if (!nome) return;
    card.dataset.phase4Media = 'loading';

    const media = document.createElement('div');
    media.className = 'phase4-exercise-media';
    media.setAttribute('aria-hidden', 'true');
    media.innerHTML = mediaPlaceholder();
    card.prepend(media);

    const data = await buscarMidia(nome);
    if (!data?.found || !data.images?.length) {
      card.dataset.phase4Media = 'missing';
      media.title = 'Demonstração ainda não encontrada para este exercício';
      return;
    }

    card.dataset.phase4Media = 'ready';
    const img = document.createElement('img');
    img.src = data.images[0];
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    media.replaceChildren(img);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'phase4-exercise-toggle';
    toggle.textContent = data.images.length > 1 ? 'Ver execução' : 'Ver demonstração';
    toggle.setAttribute('aria-expanded', 'false');

    const detail = document.createElement('div');
    detail.className = 'phase4-exercise-detail';
    detail.hidden = true;
    detail.innerHTML = renderExerciseDetail(data);

    toggle.addEventListener('click', () => {
      const abrir = detail.hidden;
      detail.hidden = !abrir;
      toggle.setAttribute('aria-expanded', String(abrir));
      toggle.textContent = abrir ? 'Ocultar execução' : (data.images.length > 1 ? 'Ver execução' : 'Ver demonstração');
    });

    const meta = card.querySelector('.ritmo-exercise-meta');
    (meta || title).insertAdjacentElement('afterend', toggle);
    card.appendChild(detail);
  }

  function enhanceExercises(root = document) {
    root.querySelectorAll?.('#secaoRitmo .ritmo-exercise').forEach(enrichExercise);
  }

  function enhance(root = document) {
    ensureStyle();
    enhanceExercises(root);
    schedulePlantSort();
  }

  window.addEventListener('lifeos:plants-updated', schedulePlantSort);
  window.addEventListener('lifeos:ready', () => setTimeout(() => enhance(document), 100));

  document.addEventListener('click', event => {
    if (event.target.closest('#abaPlantas .filtro-btn')) setTimeout(schedulePlantSort, 80);
  });

  const observer = new MutationObserver(records => {
    let plantsChanged = false;
    records.forEach(record => {
      const target = record.target instanceof Element ? record.target : null;
      record.addedNodes.forEach(node => {
        if (node instanceof Element) enhanceExercises(node);
      });
      if (target?.id === 'listaPlantas' || target?.closest?.('#listaPlantas')) plantsChanged = true;
    });
    if (plantsChanged && !sortingPlants) schedulePlantSort();
  });

  function start() {
    enhance(document);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
