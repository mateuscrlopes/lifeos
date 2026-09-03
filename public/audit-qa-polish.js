// LifeOS — Auditoria QA mobile/tablet — 2026-09
// Camada de acabamento baseada em uso real. Sem duplicar regras de negócio.
(() => {
  'use strict';

  const CSS_ID = 'lifeos-audit-qa-polish';
  const MOBILE = () => !document.getElementById('painelCasa');
  const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const ICONS = {
    task: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    plant: '<path d="M12 14V8"/><path d="M12 10c-4 0-6-2-6-5 4 0 6 2 6 5Z"/><path d="M12 8c4 0 6-2 6-5-4 0-6 2-6 5Z"/><path d="M6 14h12l-1 7H7Z"/>',
    bill: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 13h6"/>',
    stock: '<path d="M4 7 12 3l8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/>',
    ritual: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  };

  let heroSlides = [];
  let heroIndex = 0;
  let heroTimer = null;
  let refreshTimer = null;
  let observer = null;
  let enhancing = false;

  function svg(name, size = 18) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || '') + '</svg>';
  }

  function loadCss() {
    if (document.getElementById(CSS_ID)) return;
    const link = document.createElement('link');
    link.id = CSS_ID;
    link.rel = 'stylesheet';
    link.href = '/audit-qa-polish.css?v=2';
    document.head.appendChild(link);
  }

  function localDate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function installMetaSeparator() {
    if (!MOBILE()) return;
    const climate = document.getElementById('climaResumido');
    const meta = climate?.closest('.greeting-meta');
    if (!climate || !meta || meta.querySelector('.qa-meta-separator')) return;
    const separator = document.createElement('span');
    separator.className = 'qa-meta-separator';
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = '|';
    climate.insertAdjacentElement('afterend', separator);
  }

  function installBottomFade() {
    if (!MOBILE() || document.querySelector('.qa-bottom-fade')) return;
    const fade = document.createElement('div');
    fade.className = 'qa-bottom-fade';
    fade.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fade);
  }

  function replacePurchaseIcon(root = document) {
    root.querySelectorAll?.('[data-ui-action="purchase"], .ui-purchase-action').forEach(button => {
      if (button.dataset.qaPurchaseIcon === '1') return;
      button.innerHTML = svg('check', 20);
      button.dataset.qaPurchaseIcon = '1';
      button.setAttribute('aria-label', 'Marcar como comprado');
      button.title = 'Marcar como comprado';
    });
  }

  function classifyPurchaseSheet(root = document) {
    root.querySelectorAll?.('.ui-sheet').forEach(sheet => {
      const text = (sheet.textContent || '').toLowerCase();
      if (text.includes('registre a compra rapidamente') || text.includes('ligado ao estoque')) {
        sheet.classList.add('qa-no-drag-handle');
      }
    });
  }

  function cardTitle(header) {
    return header?.querySelector('.card-hoje-titulo-txt')?.textContent?.trim()
      || header?.querySelector('strong')?.textContent?.trim()
      || '';
  }

  function countRows(card) {
    const selectors = [
      '.mini-item',
      '.cf-hoje-item',
      '.item',
      '.planta-row',
      '.task-row',
      '.estoque-row',
      '.conta-row',
    ];
    const found = new Set();
    selectors.forEach(selector => card.querySelectorAll(selector).forEach(node => found.add(node)));
    return found.size;
  }

  function enhanceCollapsibleCards(root = document) {
    if (!MOBILE()) return;
    const candidates = [
      ...root.querySelectorAll?.('#cardsHoje .card-hoje > .cartao') || [],
      ...root.querySelectorAll?.('#cardsHoje #cfToday .cf-hoje-interior') || [],
    ];
    candidates.forEach(card => {
      const header = card.querySelector(':scope > .card-hoje-head');
      if (!header) return;
      const title = cardTitle(header);
      if (!title || /cardápio/i.test(title)) return;

      const count = countRows(card);
      const titleNode = header.querySelector('.card-hoje-titulo-txt') || header.querySelector('strong');
      let badge = titleNode?.querySelector('.qa-card-count');
      if (titleNode && count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'qa-card-count';
          titleNode.appendChild(badge);
        }
        badge.textContent = String(count);
        badge.setAttribute('aria-label', count + ' itens');
      }

      let actions = header.querySelector(':scope > .qa-card-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'qa-card-actions';
        const oldAction = header.querySelector(':scope > .card-hoje-abrir, :scope > .secao-link');
        if (oldAction) actions.appendChild(oldAction);
        header.appendChild(actions);
      }

      const destination = card.dataset.qaDestination || card.dataset.uiDestination || '';
      const existingAction = actions.querySelector('.card-hoje-abrir, .secao-link');
      if (existingAction) {
        existingAction.hidden = false;
        existingAction.classList.add('qa-card-open');
        if (destination && !existingAction.hasAttribute('data-cf-ver-todas')) {
          existingAction.dataset.uiDestination = destination;
        }
      }

      if (destination) {
        delete card.dataset.uiDestination;
        card.removeAttribute('tabindex');
        card.removeAttribute('role');
        card.classList.remove('clicavel');
        card.onclick = null;
      }

      let toggle = actions.querySelector('.qa-card-toggle');
      if (!toggle) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'qa-card-toggle';
        toggle.innerHTML = svg('chevron', 17);
        actions.appendChild(toggle);
      }

      if (toggle.dataset.qaBound !== '1') {
        toggle.dataset.qaBound = '1';
        toggle.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          const collapsed = card.classList.toggle('qa-collapsed');
          toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
          toggle.setAttribute('aria-label', (collapsed ? 'Expandir ' : 'Recolher ') + title);
        });
      }

      card.classList.add('qa-collapsible-card');
      if (!card.dataset.qaCollapseInitialized) {
        card.classList.add('qa-collapsed');
        card.dataset.qaCollapseInitialized = '1';
      }
      const collapsed = card.classList.contains('qa-collapsed');
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggle.setAttribute('aria-label', (collapsed ? 'Expandir ' : 'Recolher ') + title);
      header.dataset.qaCollapse = '1';
    });
  }

  function reorderWeeklyMenu() {
    if (!MOBILE()) return;
    const section = document.querySelector('#subCardapio > .secao');
    const plan = document.getElementById('planResp')?.closest('.cartao');
    if (!section || !plan) return;
    plan.classList.add('qa-cardapio-week-card');
    if (section.firstElementChild !== plan) section.insertBefore(plan, section.firstElementChild);
  }

  function annotateMealSlots(root = document) {
    if (!MOBILE()) return;
    ['slotsAlmoco', 'slotsJanta'].forEach(id => {
      const grid = document.getElementById(id);
      if (!grid) return;
      [...grid.children].forEach((child, index) => {
        if (child.classList.contains('qa-cardapio-slot')) return;
        const slot = child.matches('.dia-slot') ? child : child.querySelector('.dia-slot');
        if (!slot) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'qa-cardapio-slot';
        const label = document.createElement('span');
        label.className = 'qa-slot-day';
        label.textContent = DAY_LABELS[index] || '';
        wrapper.appendChild(label);
        grid.insertBefore(wrapper, child);
        wrapper.appendChild(child);

        const hasMeal = slot.classList.contains('preenchido');
        const recipeId = slot.dataset.receitaId;
        if (hasMeal) {
          const edit = document.createElement('button');
          edit.type = 'button';
          edit.className = 'qa-slot-edit';
          edit.innerHTML = svg('edit', 13);
          edit.setAttribute('aria-label', 'Editar ' + (DAY_LABELS[index] || 'refeição'));
          edit.title = 'Editar planejamento';
          edit.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            slot.dispatchEvent(new CustomEvent('lifeos:edit-planned-meal', {
              bubbles: true,
              detail: { forceEdit: true },
            }));
          });
          wrapper.appendChild(edit);
        }

        if (hasMeal && recipeId) {
          slot.title = 'Abrir receita';
        }
      });
    });
  }

  function simplifyPlantFilters() {
    if (!MOBILE()) return;
    const filters = document.querySelector('#abaPlantas .filtros-plantas');
    if (!filters) return;
    document.getElementById('plantasContador')?.parentElement?.classList.add('qa-plant-toolbar');
    filters.setAttribute('aria-label', 'Filtrar plantas por prazo');
    filters.querySelector('[data-filtro="sala"]')?.setAttribute('aria-hidden', 'true');
    filters.querySelector('[data-filtro="outros"]')?.setAttribute('aria-hidden', 'true');
  }

  function restructureStockForm() {
    if (!MOBILE()) return;
    const type = document.getElementById('estTipo');
    const quantity = document.getElementById('estQtd');
    const minimum = document.getElementById('estMin');
    const unit = document.getElementById('estUnidade');
    if (!type || !quantity || !minimum || !unit || document.querySelector('.qa-stock-form-layout')) return;

    const typeField = type.closest('.campo');
    const quantityField = quantity.closest('.campo');
    const minimumField = minimum.closest('.campo');
    const unitField = unit.closest('.campo');
    const numberBox = document.getElementById('estCamposNum');
    if (!typeField || !quantityField || !minimumField || !unitField || !numberBox) return;

    const layout = document.createElement('div');
    layout.className = 'qa-stock-form-layout';
    const row1 = document.createElement('div');
    row1.className = 'qa-stock-row qa-stock-row-primary';
    const row2 = document.createElement('div');
    row2.className = 'qa-stock-row qa-stock-row-secondary';

    typeField.parentNode.insertBefore(layout, typeField);
    layout.appendChild(row1);
    layout.appendChild(row2);
    row1.appendChild(typeField);
    row1.appendChild(quantityField);
    row2.appendChild(minimumField);
    row2.appendChild(unitField);

    const sync = () => {
      const numeric = type.value !== 'nivel_visual';
      quantityField.hidden = !numeric;
      minimumField.hidden = !numeric;
      unitField.hidden = !numeric;
      row2.hidden = !numeric;
      row1.classList.toggle('qa-single-field', !numeric);
    };
    type.addEventListener('change', () => window.setTimeout(sync, 0));
    sync();

    const rate = document.getElementById('estTaxaConsumo');
    const rateField = rate?.closest('.campo');
    const rateLabel = rateField?.querySelector('label');
    if (rateLabel) rateLabel.textContent = 'Consumo médio';
    if (rateField && !rateField.querySelector('.qa-stock-consumption-help')) {
      const help = document.createElement('small');
      help.className = 'qa-stock-consumption-help';
      help.textContent = 'Quanto costuma ser consumido no período escolhido.';
      rateField.querySelector('label')?.insertAdjacentElement('afterend', help);
    }
  }

  function parseStockStatus(item) {
    if (item.tipo === 'nivel_visual') {
      const levels = ['cheio', '75', 'metade', '25', 'quase_acabando', 'acabou'];
      const current = levels.indexOf(item.nivel);
      const minimum = levels.indexOf(item.minimo_nivel || '25');
      if (item.nivel === 'acabou') return 'acabou';
      if (current > minimum) return 'baixo';
      if (current === minimum || current === minimum - 1) return 'atencao';
      return 'suficiente';
    }
    const q = Number(item.quantidade);
    const m = Number(item.minimo);
    if (!Number.isFinite(q) || !Number.isFinite(m)) return 'conferir';
    if (q <= 0) return 'acabou';
    if (q < m) return 'baixo';
    if (q <= m * 1.5) return 'atencao';
    return 'suficiente';
  }

  function plantName(plant) {
    return plant.nome_personalizado || plant.especies?.nome_popular || plant.codigo || 'Planta';
  }

  async function loadHeroSlides() {
    const ctx = window.lifeosContext;
    if (!ctx?.supa || !ctx?.usuario) return;
    const { supa, usuario } = ctx;
    const today = localDate();

    try {
      const [tasksR, billsR, stockR, plantsR, ritualsR] = await Promise.all([
        supa.from('tarefas')
          .select('id,titulo,data,feita')
          .eq('casa_id', usuario.casa_id)
          .eq('feita', false),
        supa.from('contas')
          .select('id,nome,vencimento,paga')
          .eq('casa_id', usuario.casa_id)
          .eq('paga', false),
        supa.from('estoque')
          .select('id,nome,critico,tipo,quantidade,minimo,nivel,minimo_nivel')
          .eq('casa_id', usuario.casa_id),
        supa.from('plantas')
          .select('id,codigo,nome_personalizado,status,especies(nome_popular),planta_rotinas(tipo,proxima_realizacao,ativa)')
          .eq('casa_id', usuario.casa_id)
          .eq('status', 'ativa'),
        supa.from('rituais')
          .select('id,nome,privado,ritual_sessoes(realizado_em,proxima_em)')
          .eq('casa_id', usuario.casa_id),
      ]);

      const slides = [];

      const tasks = (tasksR.data || [])
        .filter(item => !item.data || item.data <= today)
        .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));
      if (tasks.length) {
        slides.push({
          type: 'task',
          title: tasks[0].titulo,
          subtitle: tasks.length === 1 ? '1 tarefa pendente para hoje' : tasks.length + ' tarefas pendentes para hoje',
        });
      }

      const duePlants = [];
      for (const plant of (plantsR.data || [])) {
        const due = (plant.planta_rotinas || [])
          .filter(routine => routine.ativa && (!routine.proxima_realizacao || routine.proxima_realizacao <= today))
          .sort((a, b) => String(a.proxima_realizacao || '').localeCompare(String(b.proxima_realizacao || '')));
        if (due.length) duePlants.push({ plant, routine: due[0] });
      }
      if (duePlants.length) {
        const first = duePlants[0];
        const overdue = first.routine.proxima_realizacao && first.routine.proxima_realizacao < today;
        slides.push({
          type: 'plant',
          title: plantName(first.plant) + ' precisa de cuidado',
          subtitle: overdue
            ? (duePlants.length === 1 ? 'Cuidado vencido' : duePlants.length + ' plantas precisam de atenção')
            : (duePlants.length === 1 ? 'Cuidado previsto para hoje' : duePlants.length + ' plantas precisam de atenção'),
        });
      }

      const bills = (billsR.data || [])
        .filter(item => item.vencimento && item.vencimento <= today)
        .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
      if (bills.length) {
        const first = bills[0];
        const overdue = first.vencimento < today;
        slides.push({
          type: 'bill',
          title: first.nome,
          subtitle: overdue
            ? (bills.length === 1 ? 'Conta vencida' : bills.length + ' contas vencidas ou para hoje')
            : (bills.length === 1 ? 'Conta vence hoje' : bills.length + ' contas vencidas ou para hoje'),
        });
      }

      const criticalStock = (stockR.data || [])
        .map(item => ({ ...item, qaStatus: parseStockStatus(item) }))
        .filter(item => item.critico && ['acabou', 'baixo', 'atencao'].includes(item.qaStatus))
        .sort((a, b) => {
          const order = { acabou: 0, baixo: 1, atencao: 2 };
          return (order[a.qaStatus] ?? 9) - (order[b.qaStatus] ?? 9);
        });
      if (criticalStock.length) {
        const first = criticalStock[0];
        slides.push({
          type: 'stock',
          title: first.nome + (first.qaStatus === 'acabou' ? ' acabou' : ' está acabando'),
          subtitle: criticalStock.length === 1
            ? 'Item crítico do estoque'
            : criticalStock.length + ' itens críticos precisam de atenção',
        });
      }

      const dueRituals = (ritualsR.data || []).map(ritual => {
        const sessions = [...(ritual.ritual_sessoes || [])].sort(
          (a, b) => new Date(b.realizado_em || 0) - new Date(a.realizado_em || 0)
        );
        return { ritual, next: sessions[0]?.proxima_em || null };
      }).filter(item => item.next && item.next <= today)
        .sort((a, b) => String(a.next).localeCompare(String(b.next)));
      if (dueRituals.length) {
        slides.push({
          type: 'ritual',
          title: dueRituals[0].ritual.nome,
          subtitle: dueRituals[0].next < today ? 'Ritual pendente' : 'Ritual previsto para hoje',
        });
      }

      heroSlides = slides.length ? slides : [{
        type: 'check',
        title: 'Tudo em dia!',
        subtitle: 'Nenhuma pendência importante para agora',
      }];
      heroIndex = Math.min(heroIndex, heroSlides.length - 1);
      renderHeroSlide();
    } catch (error) {
      console.warn('[LifeOS QA] Não foi possível atualizar o destaque do dia:', error);
    }
  }

  function ensureHeroIcon(hero) {
    if (!MOBILE()) return null;
    let icon = hero.querySelector('.qa-hero-icon');
    if (icon) return icon;
    icon = document.createElement('div');
    icon.className = 'qa-hero-icon';
    const kicker = hero.querySelector('.hero-kicker');
    kicker?.insertAdjacentElement('afterend', icon);
    hero.classList.add('qa-hero-rotator');
    return icon;
  }

  function renderHeroSlide() {
    if (!heroSlides.length) return;
    const title = document.getElementById('heroTitulo');
    const subtitle = document.getElementById('heroSub');
    const hero = title?.closest('.hero-hoje') || title?.parentElement;
    if (!title || !subtitle || !hero) return;
    const slide = heroSlides[heroIndex % heroSlides.length];

    title.textContent = slide.title;
    subtitle.textContent = slide.subtitle;
    const icon = ensureHeroIcon(hero);
    if (icon) icon.innerHTML = svg(slide.type === 'check' ? 'check' : slide.type, 20);

    [title, subtitle, icon].filter(Boolean).forEach(node => {
      node.classList.remove('qa-slide-enter');
      void node.offsetWidth;
      node.classList.add('qa-slide-enter');
    });
  }

  function startHeroRotation() {
    window.clearInterval(heroTimer);
    heroTimer = window.setInterval(() => {
      if (heroSlides.length <= 1 || document.visibilityState !== 'visible') return;
      heroIndex = (heroIndex + 1) % heroSlides.length;
      renderHeroSlide();
    }, 8000);
  }

  function confirmDialog({ title, message, confirmLabel = 'Confirmar', secondaryLabel = '', danger = false }) {
    return new Promise(resolve => {
      document.querySelector('.qa-confirm-overlay')?.remove();
      const overlay = document.createElement('div');
      overlay.className = 'qa-confirm-overlay';
      overlay.innerHTML = `
        <section class="qa-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="qaConfirmTitle">
          <h3 id="qaConfirmTitle"></h3>
          <p></p>
          <div class="qa-confirm-actions">
            <button type="button" class="qa-confirm-primary${danger ? ' is-danger' : ''}" data-qa-confirm></button>
            ${secondaryLabel ? '<button type="button" class="qa-confirm-secondary" data-qa-secondary></button>' : ''}
            <button type="button" class="qa-confirm-cancel" data-qa-cancel>Cancelar</button>
          </div>
        </section>`;
      overlay.querySelector('h3').textContent = title;
      overlay.querySelector('p').textContent = message;
      overlay.querySelector('[data-qa-confirm]').textContent = confirmLabel;
      const secondary = overlay.querySelector('[data-qa-secondary]');
      if (secondary) secondary.textContent = secondaryLabel;

      let done = false;
      const finish = value => {
        if (done) return;
        done = true;
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        resolve(value);
      };
      const onKey = event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(null);
        }
      };
      overlay.addEventListener('click', event => {
        if (event.target === overlay || event.target.closest('[data-qa-cancel]')) finish(null);
        else if (event.target.closest('[data-qa-confirm]')) finish('confirm');
        else if (event.target.closest('[data-qa-secondary]')) finish('secondary');
      });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(overlay);
      overlay.querySelector('[data-qa-confirm]')?.focus();
    });
  }

  window.lifeosConfirmAction = async options =>
    (await confirmDialog(options)) === 'confirm';

  window.lifeosConfirmRecurringTask = options =>
    confirmDialog({
      ...options,
      confirmLabel: options?.confirmLabel || 'Concluir e criar próxima',
      secondaryLabel: options?.secondaryLabel || 'Só concluir',
    });

  function enhanceAll(root = document) {
    if (enhancing) return;
    enhancing = true;
    try {
      installMetaSeparator();
      installBottomFade();
      replacePurchaseIcon(root);
      classifyPurchaseSheet(root);
      enhanceCollapsibleCards(root);
      reorderWeeklyMenu();
      annotateMealSlots(root);
      simplifyPlantFilters();
      restructureStockForm();
    } finally {
      enhancing = false;
    }
  }

  function installObserver() {
    if (observer) return;
    let scheduled = false;
    observer = new MutationObserver(records => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof HTMLElement) {
              replacePurchaseIcon(node);
              classifyPurchaseSheet(node);
            }
          }
        }
        enhanceAll();
        scheduled = false;
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function refreshHighlightsSoon() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(loadHeroSlides, 220);
  }

  function start() {
    loadCss();
    enhanceAll();
    installObserver();
    startHeroRotation();
    refreshHighlightsSoon();

    window.addEventListener('lifeos:ready', () => {
      window.setTimeout(() => {
        enhanceAll();
        refreshHighlightsSoon();
      }, 120);
    });
    ['lifeos:lista-atualizar', 'lifeos:food-updated', 'lifeos:receitas-atualizar']
      .forEach(name => window.addEventListener(name, refreshHighlightsSoon));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshHighlightsSoon();
    });
    window.setInterval(loadHeroSlides, 5 * 60 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
