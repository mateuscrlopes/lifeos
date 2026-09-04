// LifeOS — QA Mobile v5
// Comportamentos de estabilização baseados na auditoria real do iPhone.
(() => {
  'use strict';

  const STYLE_ID = 'lifeos-mobile-qa-v5';
  let enhancing = false;
  let mutationScheduled = false;
  let bellPopoverShown = false;

  const esc = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const icon = (name, size = 18) => {
    const paths = {
      close: '<path d="m6 6 12 12M18 6 6 18"/>',
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
      trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/>',
      restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    };
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
  };

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = '/mobile-qa-v5.css?v=1';
    document.head.appendChild(link);
  }

  function context() {
    const ctx = window.lifeosContext;
    if (!ctx?.supa || !ctx?.usuario) return null;
    return { client: ctx.supa, user: ctx.usuario };
  }

  function openDialog({ title, subtitle = '', body = '', className = '' }) {
    document.querySelector('.qa5-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'qa5-overlay';
    overlay.innerHTML = `
      <section class="qa5-dialog ${className}" role="dialog" aria-modal="true" aria-labelledby="qa5DialogTitle">
        <div class="qa5-dialog-head">
          <div><h3 id="qa5DialogTitle">${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
          <button type="button" class="qa5-dialog-close" data-qa5-close aria-label="Fechar">${icon('close', 19)}</button>
        </div>
        <div class="qa5-dialog-body">${body}</div>
      </section>`;

    const close = () => {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
    };
    const onKey = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-qa5-close]')) close();
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-qa5-close]')?.focus({ preventScroll: true });
    return { overlay, close };
  }

  async function confirmLifeOS(options) {
    if (typeof window.lifeosConfirmAction === 'function') {
      return window.lifeosConfirmAction(options);
    }
    return window.confirm(options.message || options.title || 'Confirmar?');
  }

  // ------------------------------------------------------------------
  // Hoje: disclosure não pode navegar. “Abrir” é a única navegação.
  // ------------------------------------------------------------------
  function handleTodayDisclosure(event) {
    const toggle = event.target.closest('#cardsHoje .qa-card-toggle');
    if (!toggle) return;
    const card = toggle.closest('.qa-collapsible-card');
    if (!card) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const collapsed = card.classList.toggle('qa-collapsed');
    const title = card.querySelector('.card-hoje-titulo-txt, .card-hoje-head strong')?.textContent?.trim() || 'card';
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.setAttribute('aria-label', (collapsed ? 'Expandir ' : 'Recolher ') + title);
  }

  function handleTodayPlantsOpen(event) {
    const open = event.target.closest('#cardsHoje .qa-card-open[data-ui-destination="plantas"]');
    if (!open) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const plantsTab = document.querySelector('.tab-btn[data-tab="plantas"]');
    if (plantsTab) plantsTab.click();
    else if (typeof window.trocarAba === 'function') window.trocarAba('plantas');
  }

  // ------------------------------------------------------------------
  // Inputs: iOS e teclado coerente com o tipo de dado.
  // ------------------------------------------------------------------
  function enhanceInputModes(root = document) {
    root.querySelectorAll?.('input[type="number"]').forEach(input => {
      if (input.inputMode) return;
      const integerHints = /reps|repet|series|série|dia|dias|parcela|intervalo|ordem|duracao|duração|fotoIntervalo/i;
      const key = `${input.id || ''} ${input.name || ''} ${input.getAttribute('data-item-reps') || ''} ${input.closest('label,.campo,.ritmo-field,.ac-field')?.textContent || ''}`;
      input.inputMode = integerHints.test(key) && !/carga|peso|cm|valor|total|distância|distancia/i.test(key) ? 'numeric' : 'decimal';
    });

    root.querySelectorAll?.('[data-reps], [data-item-reps]').forEach(input => {
      input.inputMode = 'numeric';
      input.autocomplete = 'off';
    });
    root.querySelectorAll?.('[data-carga]').forEach(input => {
      input.inputMode = 'decimal';
      input.autocomplete = 'off';
    });
  }

  // ------------------------------------------------------------------
  // Estoque: status sai do rodapé e vai para junto do nome.
  // ------------------------------------------------------------------
  function enhanceStock(root = document) {
    root.querySelectorAll?.('#itensEstoque .item').forEach(item => {
      if (item.dataset.qa5Stock === '1') return;
      const desc = item.querySelector('.desc');
      const name = desc?.querySelector('.nome');
      const controls = item.querySelector('.est-controles');
      const badge = controls?.querySelector(':scope > .badge');
      if (!desc || !name || !controls || !badge) return;

      let row = desc.querySelector('.qa5-stock-name-row');
      if (!row) {
        row = document.createElement('div');
        row.className = 'qa5-stock-name-row';
        name.insertAdjacentElement('beforebegin', row);
        row.appendChild(name);
      }
      row.appendChild(badge);
      const copy = desc;
      copy.classList.add('qa5-stock-copy');
      item.dataset.qa5Stock = '1';
    });
  }

  // ------------------------------------------------------------------
  // Plantas: botão Cuidar e régua visual.
  // ------------------------------------------------------------------
  function enhancePlants(root = document) {
    root.querySelectorAll?.('#abaPlantas .planta-card').forEach(card => {
      card.querySelectorAll(':scope > button').forEach(button => {
        if ((button.textContent || '').trim().toLowerCase() === 'cuidar') {
          button.classList.add('qa5-plant-care');
          button.removeAttribute('style');
        }
      });
    });
  }

  // ------------------------------------------------------------------
  // Ritmo — semana, água, atividades, medidas, fotos, plano alimentar.
  // ------------------------------------------------------------------
  function enhanceRitmo(root = document) {
    const ritmo = root.matches?.('#secaoRitmo') ? root : root.querySelector?.('#secaoRitmo');
    const scope = ritmo || document.getElementById('secaoRitmo');
    if (!scope) return;

    enhanceInputModes(scope);
    enhanceRitmoWater(scope);
    enhanceRitmoWeek(scope);
    enhanceRitmoAgenda(scope);
    enhanceRitmoExercises(scope);
    enhanceRitmoMeasures(scope);
    enhanceRitmoPhotos(scope);
    enhanceRitmoPlans(scope);
  }

  function enhanceRitmoWater(scope) {
    const head = [...scope.querySelectorAll('.ritmo-section-head')].find(h =>
      h.querySelector('h3')?.textContent?.trim() === 'Água');
    if (!head) return;
    const raw = head.querySelector('span')?.textContent || '';
    const nums = raw.match(/[\d.,]+/g)?.map(v => Number(v.replace('.', '').replace(',', '.'))) || [];
    if (nums.length < 2) return;
    const [actual, target] = nums;
    const card = head.parentElement?.querySelector('.ritmo-card');
    if (!card) return;
    card.querySelector('.qa5-water-over')?.remove();
    if (actual > target) {
      const badge = document.createElement('div');
      badge.className = 'qa5-water-over';
      badge.textContent = `Meta superada em ${Math.round(actual - target)} ml`;
      card.querySelector('.ritmo-water-track')?.insertAdjacentElement('afterend', badge);
    }
  }

  function enhanceRitmoWeek(scope) {
    const head = [...scope.querySelectorAll('.ritmo-section-head')].find(h =>
      h.querySelector('h3')?.textContent?.trim() === 'Semana em Ritmo');
    const summary = head?.querySelector('span');
    if (!head || !summary || summary.dataset.qa5Week === '1') return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'qa5-consistency-open';
    button.textContent = summary.textContent;
    button.setAttribute('aria-label', 'Abrir registros da semana');
    summary.replaceWith(button);
    button.dataset.qa5Week = '1';
    button.addEventListener('click', openWeekRecords);
  }

  async function openWeekRecords() {
    const ctx = context();
    if (!ctx) return;
    const now = new Date();
    const jsDay = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() + (jsDay === 0 ? -6 : 1 - jsDay));
    const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    const result = await ctx.client
      .from('ritmo_checkins')
      .select('id,data,tipo,status,valor,registrado_em')
      .eq('usuario_id', ctx.user.id)
      .gte('data', iso(monday))
      .lte('data', iso(now))
      .order('data', { ascending: false })
      .order('registrado_em', { ascending: false });

    const rows = (result.data || []).filter(item => item.tipo !== 'agua');
    const labelType = type => ({
      cafe:'Café da manhã', lanche_manha:'Lanche da manhã', almoco:'Almoço',
      lanche_tarde:'Lanche da tarde', jantar:'Jantar', atividade:'Atividade', foto:'Foto', medida:'Medida'
    }[type] || type || 'Registro');
    const labelStatus = status => ({ conforme:'Conforme', ajustes:'Com ajustes', nao_feito:'Não feito' }[status] || status || 'Registrado');

    openDialog({
      title: 'Registros da semana',
      subtitle: `${rows.length} registro${rows.length === 1 ? '' : 's'} até hoje.`,
      body: rows.length
        ? `<div class="qa5-week-list">${rows.map(row => `
            <div class="qa5-week-item">
              <time>${new Date(row.data + 'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})}</time>
              <strong>${esc(labelType(row.tipo))}</strong>
              <span>${esc(labelStatus(row.status))}</span>
            </div>`).join('')}</div>`
        : '<div class="ritmo-empty">Ainda não há registros nesta semana.</div>'
    });
  }

  function enhanceRitmoAgenda(scope) {
    scope.querySelectorAll('.ritmo-activity-open[data-abrir-atividade]').forEach(row => {
      if (row.closest('.qa5-agenda-wrap')) return;
      const wrap = document.createElement('div');
      wrap.className = 'qa5-agenda-wrap';
      row.insertAdjacentElement('beforebegin', wrap);
      wrap.appendChild(row);
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'qa5-agenda-edit';
      edit.innerHTML = icon('edit', 16);
      edit.setAttribute('aria-label', 'Editar atividade planejada');
      edit.title = 'Editar atividade';
      edit.dataset.qa5AgendaEdit = row.dataset.abrirAtividade;
      wrap.appendChild(edit);
      edit.addEventListener('click', () => openAgendaEditor(row.dataset.abrirAtividade));
    });
  }

  async function openAgendaEditor(agendaId) {
    const ctx = context();
    if (!ctx || !agendaId) return;
    const result = await ctx.client.from('ritmo_agenda').select('id,plano_id').eq('id', agendaId).maybeSingle();
    const planId = result.data?.plano_id;
    if (!planId) return;
    const detail = document.querySelector(`[data-plano-detalhe="${CSS.escape(planId)}"]`);
    if (!detail) return;
    detail.click();
    window.setTimeout(() => document.getElementById('ritmoEditarPlanoMeta')?.click(), 80);
  }

  function enhanceRitmoExercises(scope) {
    scope.querySelectorAll('[data-carga]').forEach(input => input.inputMode = 'decimal');
    scope.querySelectorAll('[data-reps]').forEach(input => {
      input.inputMode = 'numeric';
      input.setAttribute('pattern', '[0-9-]*');
    });

    scope.querySelectorAll('.phase4-exercise-media img, .phase4-exercise-gallery img').forEach(img => {
      if (img.dataset.qa5Lightbox === '1') return;
      img.dataset.qa5Lightbox = '1';
      img.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openDialog({
          title: img.alt || 'Execução do exercício',
          className: 'qa5-lightbox',
          body: `<img src="${esc(img.src)}" alt="${esc(img.alt || 'Demonstração do exercício')}">`
        });
      });
    });
  }

  const MEASURE_GUIDES = {
    ritmoMedCintura: {
      title: 'Cintura', line: 73,
      text: 'Passe a fita horizontalmente na região mais estreita entre a última costela e o topo do quadril. Meça sem prender a respiração e sem apertar a pele.'
    },
    ritmoMedAbdomen: {
      title: 'Abdômen', line: 86,
      text: 'Use a altura do umbigo como referência. Mantenha a fita paralela ao chão, com o abdômen relaxado. Repita sempre no mesmo ponto.'
    },
    ritmoMedQuadrilAlto: {
      title: 'Quadril alto', line: 96,
      text: 'Meça ao redor da parte superior da pelve, sobre a crista ilíaca, acima da região mais larga do quadril.'
    },
    ritmoMedQuadril: {
      title: 'Quadril', line: 110,
      text: 'Passe a fita pela parte mais larga do quadril e dos glúteos, mantendo-a horizontal e sem comprimir a pele.'
    },
    ritmoMedPeito: {
      title: 'Peito', line: 55,
      text: 'Passe a fita horizontalmente pela parte de maior circunferência do tórax. Mantenha postura natural e respiração normal.'
    },
    ritmoMedCoxa: {
      title: 'Coxa', line: 128,
      text: 'Escolha um ponto fixo na parte superior da coxa e mantenha esse mesmo ponto em todas as medições. A fita deve ficar perpendicular à perna.'
    },
    ritmoMedBraco: {
      title: 'Braço', line: 63,
      text: 'Meça no ponto médio entre ombro e cotovelo, com o braço relaxado ao lado do corpo. Use sempre o mesmo braço e ponto.'
    },
    ritmoMedPanturrilha: {
      title: 'Panturrilha', line: 153,
      text: 'Passe a fita pela parte mais larga da panturrilha, sem contrair a musculatura e sem apertar.'
    },
  };

  function enhanceRitmoMeasures(scope) {
    const dateInput = scope.querySelector('#ritmoMedData');
    if (!dateInput) return;
    const sheet = dateInput.closest('.ritmo-sheet');
    sheet?.classList.add('qa5-measures-sheet');

    Object.entries(MEASURE_GUIDES).forEach(([id, guide]) => {
      const input = scope.querySelector(`#${id}`);
      if (!input) return;
      input.inputMode = 'decimal';
      const field = input.closest('.ritmo-field');
      const label = field?.querySelector('label');
      if (!label || label.querySelector('.qa5-measure-help')) return;
      const help = document.createElement('button');
      help.type = 'button';
      help.className = 'qa5-measure-help';
      help.textContent = '?';
      help.setAttribute('aria-label', `Onde medir ${guide.title.toLowerCase()}?`);
      help.title = 'Onde medir?';
      label.appendChild(help);
      help.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openMeasureGuide(guide);
      });
    });
  }

  function openMeasureGuide(guide) {
    const bodySvg = `
      <svg viewBox="0 0 100 180" fill="none" aria-hidden="true">
        <circle cx="50" cy="19" r="12" stroke="currentColor" stroke-width="3"/>
        <path d="M37 39c-8 17-8 39-5 61l5 35m26-96c8 17 8 39 5 61l-5 35M37 39c8 6 18 6 26 0M32 73l-18 35m54-35 18 35M37 135l-8 38m34-38 8 38" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <line x1="20" x2="80" y1="${guide.line}" y2="${guide.line}" stroke="var(--alert)" stroke-width="5" stroke-linecap="round"/>
      </svg>`;
    openDialog({
      title: `Onde medir · ${guide.title}`,
      subtitle: 'Use o mesmo ponto e condições parecidas em todos os registros.',
      body: `<div class="qa5-measure-guide"><div class="qa5-measure-figure">${bodySvg}</div><div class="qa5-measure-copy"><strong>${esc(guide.title)}</strong><p>${esc(guide.text)}</p></div></div>`
    });
  }

  function enhanceRitmoPhotos(scope) {
    const input = scope.querySelector('#ritmoFotoInput');
    if (!input) return;
    input.removeAttribute('capture');
    if (input.dataset.qa5Photos === '1') return;
    input.dataset.qa5Photos = '1';
    const note = document.createElement('div');
    note.className = 'qa5-photo-note';
    note.textContent = 'Ao escolher a posição, você pode tirar a foto agora ou selecionar uma foto da galeria — útil para usar temporizador e apoiar o celular sempre no mesmo lugar.';
    input.insertAdjacentElement('afterend', note);
  }

  function enhanceRitmoPlans(scope) {
    scope.querySelectorAll('[data-editar-plano-alimentar]').forEach(edit => {
      if (edit.closest('.qa5-plan-actions')) return;
      const planId = edit.dataset.editarPlanoAlimentar;
      const wrap = document.createElement('div');
      wrap.className = 'qa5-plan-actions';
      edit.insertAdjacentElement('beforebegin', wrap);
      wrap.appendChild(edit);
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'qa5-plan-delete';
      del.innerHTML = icon('trash', 16);
      del.setAttribute('aria-label', 'Remover plano alimentar');
      del.title = 'Remover plano';
      wrap.appendChild(del);
      del.addEventListener('click', () => removeFoodPlan(planId, edit.closest('.ritmo-card')));
    });

    const editor = scope.querySelector('#ritmoEditorRefeicoes');
    if (editor && !editor.children.length && editor.dataset.qa5Empty !== '1') {
      editor.dataset.qa5Empty = '1';
      const note = document.createElement('div');
      note.className = 'ritmo-alert';
      note.textContent = 'A leitura do PDF não conseguiu separar as refeições automaticamente. Comece revisando a primeira refeição abaixo; você pode adicionar outras depois.';
      editor.insertAdjacentElement('beforebegin', note);
      window.setTimeout(() => document.getElementById('ritmoAddRefeicaoPlano')?.click(), 0);
    }

    enhancePdfReview(scope);
  }

  async function removeFoodPlan(planId, card) {
    const ctx = context();
    if (!ctx || !planId) return;
    const ok = await confirmLifeOS({
      title: 'Remover plano alimentar',
      message: 'O plano deixará de aparecer e de ser usado nas sugestões. O arquivo PDF original não é armazenado.',
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    const { error } = await ctx.client
      .from('ritmo_planos_alimentares')
      .update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq('id', planId);
    if (error) return console.error('[QA v5] Remover plano:', error);
    card?.remove();
  }

  async function enhancePdfReview(scope) {
    const ctx = context();
    if (!ctx || scope.dataset.qa5PdfReview === 'loading' || scope.dataset.qa5PdfReview === 'done') return;
    const emptyCards = [...scope.querySelectorAll('.ritmo-card')].filter(card =>
      /precisa de revisão manual/i.test(card.textContent || '') && card.querySelector('[data-editar-plano-alimentar]'));
    if (!emptyCards.length) return;
    scope.dataset.qa5PdfReview = 'loading';
    try {
      const ids = emptyCards.map(card => card.querySelector('[data-editar-plano-alimentar]')?.dataset.editarPlanoAlimentar).filter(Boolean);
      const result = await ctx.client.from('ritmo_planos_alimentares').select('id,conteudo').in('id', ids);
      const byId = new Map((result.data || []).map(row => [row.id, row.conteudo || {}]));
      emptyCards.forEach(card => {
        const id = card.querySelector('[data-editar-plano-alimentar]')?.dataset.editarPlanoAlimentar;
        const content = byId.get(id) || {};
        const raw = String(content.texto_revisao || '').trim();
        if (!raw || card.querySelector('.qa5-pdf-review')) return;
        const details = document.createElement('details');
        details.className = 'qa5-pdf-review';
        details.innerHTML = `<summary>Ver texto que o LifeOS conseguiu ler</summary><pre>${esc(raw)}</pre>`;
        card.appendChild(details);
      });
      scope.dataset.qa5PdfReview = 'done';
    } catch (error) {
      console.warn('[QA v5] Revisão do PDF:', error);
      delete scope.dataset.qa5PdfReview;
    }
  }

  // ------------------------------------------------------------------
  // Financeiro — vencidos, recorrência e campos monetários.
  // ------------------------------------------------------------------
  function enhanceFinance(root = document) {
    root.querySelectorAll?.('#acertosRoot .ac-row').forEach(row => {
      if (row.querySelector('.ac-chip.danger')) row.classList.add('qa5-overdue');
    });

    const modal = root.matches?.('#acModal') ? root : root.querySelector?.('#acModal');
    if (modal) {
      enhanceRecurringDaySelect(modal);
      enhanceInputModes(modal);
    }
  }

  function enhanceRecurringDaySelect(modal) {
    const input = modal.querySelector('input[name="generate"]');
    if (!input || input.dataset.qa5Day === '1') return;
    const select = document.createElement('select');
    select.name = input.name;
    select.required = input.required;
    select.dataset.qa5Day = '1';
    const current = Math.max(1, Math.min(31, Number(input.value || 1)));
    select.innerHTML = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1;
      return `<option value="${day}"${day === current ? ' selected' : ''}>${day}</option>`;
    }).join('');
    input.replaceWith(select);
  }

  // ------------------------------------------------------------------
  // Configurações — ações, local de estoque, histórico e notificações.
  // ------------------------------------------------------------------
  function enhanceConfig(root = document) {
    root.querySelectorAll?.('#secaoConfig button').forEach(button => {
      const text = (button.textContent || '').trim().toLowerCase();
      if (text === 'revogar') button.classList.add('qa5-danger-text');
      if (/arquivar/.test(text) && !button.querySelector('svg')) button.classList.add('qa5-danger-text');
    });

    root.querySelectorAll?.('.ui-history-restore').forEach(button => {
      button.classList.add('qa5-icon-action');
      button.setAttribute('aria-label', 'Restaurar item');
      button.title = 'Restaurar';
    });

    enhancePurchaseLocationModal(root);
    enhanceNotificationPopover();
  }

  function handleNewStockLocation(event) {
    const button = event.target.closest('#btnNovoLocalEstoque');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const dialog = openDialog({
      title: 'Novo local do estoque',
      subtitle: 'Crie um ambiente para organizar os itens da Casa.',
      body: `
        <div class="campo"><label for="qa5StockLocationName">Nome do local</label><input id="qa5StockLocationName" type="text" placeholder="Ex.: Despensa" autocomplete="off"></div>
        <div class="qa-confirm-actions" style="margin-top:14px">
          <button type="button" class="qa-confirm-primary" id="qa5SaveStockLocation">Salvar local</button>
          <button type="button" class="qa-confirm-cancel" data-qa5-close>Cancelar</button>
        </div>`
    });
    const input = dialog.overlay.querySelector('#qa5StockLocationName');
    const save = dialog.overlay.querySelector('#qa5SaveStockLocation');
    window.setTimeout(() => input?.focus(), 20);
    save?.addEventListener('click', () => {
      const name = input?.value.trim();
      if (!name) return input?.focus();
      const hiddenInput = document.getElementById('nomeNovoLocalEstoque');
      const hiddenSave = document.getElementById('btnSalvarNovoLocalEstoque');
      if (!hiddenInput || !hiddenSave) return;
      hiddenInput.value = name;
      hiddenSave.click();
      dialog.close();
    });
  }

  function enhancePurchaseLocationModal(root = document) {
    const modal = root.matches?.('#modalEditarLocalCompra') ? root : root.querySelector?.('#modalEditarLocalCompra');
    if (!modal) return;
    const addRow = modal.querySelector('#elcNovoEnd')?.parentElement;
    if (addRow) {
      addRow.style.display = 'grid';
      addRow.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
      addRow.style.gap = '8px';
    }

    const deleteLocal = modal.querySelector('#btnExcluirLocalCompra');
    if (deleteLocal && deleteLocal.dataset.qa5Icon !== '1') {
      deleteLocal.dataset.qa5Icon = '1';
      deleteLocal.classList.add('qa5-icon-action');
      deleteLocal.innerHTML = icon('trash', 17);
      deleteLocal.setAttribute('aria-label', 'Excluir local de compra');
      deleteLocal.title = 'Excluir local';
    }

    modal.querySelectorAll('#elcEnderecos button, #elcCategorias button').forEach(button => {
      const text = (button.textContent || '').trim();
      if (text === '×' || /excluir|remover/i.test(button.getAttribute('aria-label') || '')) {
        button.classList.add('qa5-icon-action');
        if (!button.querySelector('svg')) button.innerHTML = icon('trash', 15);
      }
    });
  }

  function enhanceNotificationPopover() {
    const bell = document.getElementById('acBell');
    const badge = bell?.querySelector('.ac-bell-badge');
    if (!bell || !badge || bellPopoverShown) return;
    const visible = badge.style.display !== 'none' && Number.parseInt(badge.textContent || '0', 10) > 0;
    if (!visible) return;
    const key = `lifeos:qa5-notification-popover:${new Date().toISOString().slice(0,10)}`;
    try { if (sessionStorage.getItem(key)) return; } catch {}

    bellPopoverShown = true;
    const pop = document.createElement('button');
    pop.type = 'button';
    pop.className = 'qa5-bell-popover';
    const count = badge.textContent || '1';
    pop.textContent = `Você tem ${count} notificação${count === '1' ? '' : 'ões'} para ver. Toque aqui para abrir.`;
    document.body.appendChild(pop);
    pop.addEventListener('click', () => {
      pop.remove();
      bell.click();
    });
    window.setTimeout(() => pop.remove(), 7000);
    try { sessionStorage.setItem(key, '1'); } catch {}
  }

  // ------------------------------------------------------------------
  // Global DOM enhancement loop.
  // ------------------------------------------------------------------
  function enhance(root = document) {
    if (enhancing) return;
    enhancing = true;
    try {
      ensureStyle();
      enhanceInputModes(root);
      enhanceStock(root);
      enhancePlants(root);
      enhanceRitmo(root);
      enhanceFinance(root);
      enhanceConfig(root);
    } finally {
      enhancing = false;
    }
  }

  function scheduleEnhance() {
    if (mutationScheduled) return;
    mutationScheduled = true;
    requestAnimationFrame(() => {
      mutationScheduled = false;
      enhance(document);
    });
  }

  function start() {
    ensureStyle();
    enhance(document);

    // Captura antes das camadas antigas que associaram navegação ao card inteiro.
    document.addEventListener('click', handleTodayDisclosure, true);
    document.addEventListener('click', handleTodayPlantsOpen, true);
    document.addEventListener('click', handleNewStockLocation, true);

    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('lifeos:ready', () => setTimeout(scheduleEnhance, 80));
    window.addEventListener('lifeos:lista-atualizar', scheduleEnhance);
    window.addEventListener('lifeos:plants-updated', scheduleEnhance);
    window.addEventListener('lifeos:ritmo-abrir', () => setTimeout(scheduleEnhance, 100));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
