// LifeOS — camada de refinamento mobile v2
// Carregada como efeito colateral por status-estoque.js.

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9"/>',
  cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L21 8H7"/>',
  cartCheck: '<path d="M3 4h2l2.2 9.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L20.4 8H7"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="m11 10 1.8 1.8L16.5 8"/>',
  moneyCheck: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h3M16 15h2"/><path d="m8 14 2 2 4-5"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  leaf: '<path d="M12 22V12M12 12C12 12 8 10 6 7c-1-1.5-1-4 2-4s4 3 4 3M12 12c0 0 4-2 6-5 1-1.5 1-4-2-4s-4 3-4 3"/>',
  plant: '<path d="M12 14V8"/><path d="M12 10c-4 0-6-2-6-5 4 0 6 2 6 5Z"/><path d="M12 8c4 0 6-2 6-5-4 0-6 2-6 5Z"/><path d="M6 14h12l-1 7H7Z"/>',
  house: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
  sparkle: '<path d="M12 2c.7 5.2 4.8 9.3 10 10-5.2.7-9.3 4.8-10 10-.7-5.2-4.8-9.3-10-10 5.2-.7 9.3-4.8 10-10Z"/>',
  camera: '<path d="M14.5 5 13 3h-2L9.5 5H6a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3Z"/><circle cx="12" cy="12" r="3.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  meal: '<path d="M7 2v8M4 2v5a3 3 0 0 0 6 0V2M7 10v12M17 2v20M17 2c3 2 4 5 4 8h-4"/>',
  task: '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  bill: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 13h6"/>',
  ritual: '<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/><circle cx="12" cy="12" r="4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.3 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
};

function icon(name, size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

let uiClient = null;
let uiProfile = null;
let historyFilter = 'todos';
let historySearch = '';
let historyCache = [];
let observerBusy = false;
let avatarSchemaAvailable = true;
let profileCardLoading = false;
let plantTimelineBusy = false;
let plantTimelineTimer = null;
let historyLoadTimer = null;
let marketOverlay = null;
let marketCurrentLocal = null;
let marketItemsCache = [];
let marketStocksCache = [];
let marketLocationsCache = [];
let stockConferenceLoading = false;
let marketDestinationsCache = [];
let purchaseRowsDecorating = false;
let uiSheetReturnFocus = null;
let uiSheetKeydownHandler = null;
let uiSheetViewportCleanup = null;
const LAST_SUBTAB_KEY = 'lifeos:last-casa-subtab';

function loadStyles() {
  if (document.querySelector('link[data-lifeos-refinements]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/ui-refinements.css?v=4';
  link.dataset.lifeosRefinements = '1';
  document.head.appendChild(link);
}

async function getContext() {
  if (uiClient && uiProfile) return { client: uiClient, profile: uiProfile };
  const response = await fetch('/config');
  if (!response.ok) throw new Error('Não foi possível carregar a configuração do LifeOS.');
  const config = await response.json();
  if (!window.supabase) throw new Error('Supabase não está disponível.');
  uiClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data: sessionData } = await uiClient.auth.getSession();
  const session = sessionData?.session;
  if (!session) throw new Error('Faça login novamente para continuar.');
  let { data: profile, error } = await uiClient
    .from('usuarios')
    .select('id,nome,casa_id,avatar_url')
    .eq('auth_id', session.user.id)
    .single();
  if (error) {
    avatarSchemaAvailable = false;
    const fallback = await uiClient
      .from('usuarios')
      .select('id,nome,casa_id')
      .eq('auth_id', session.user.id)
      .single();
    profile = fallback.data;
    error = fallback.error;
  }
  if (error || !profile) throw new Error('Perfil do LifeOS não encontrado.');
  uiProfile = { ...profile, auth_id: session.user.id, avatar_url: profile.avatar_url || null };
  return { client: uiClient, profile: uiProfile };
}

function toast(message, type = 'ok', duration = 2800) {
  let region = document.querySelector('.ui-toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'ui-toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  const item = document.createElement('div');
  item.className = `ui-toast ${type}`;
  item.textContent = message;
  region.appendChild(item);
  window.setTimeout(() => item.remove(), duration);
}

function closeSheet() {
  const overlay = document.querySelector('.ui-sheet-overlay');
  if (!overlay) return;
  overlay.remove();
  uiSheetViewportCleanup?.();
  uiSheetViewportCleanup = null;
  if (uiSheetKeydownHandler) document.removeEventListener('keydown', uiSheetKeydownHandler);
  uiSheetKeydownHandler = null;
  updateBodyModalState();

  const returnFocus = uiSheetReturnFocus;
  uiSheetReturnFocus = null;
  window.requestAnimationFrame(() => returnFocus?.focus?.({ preventScroll: true }));
}

function openSheet({ title, subtitle = '', content = '', onMount }) {
  closeSheet();
  uiSheetReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const overlay = document.createElement('div');
  const overMarket = Boolean(marketOverlay);
  overlay.className = `ui-sheet-overlay${overMarket ? ' ui-sheet-over-market ui-sheet-center' : ''}`;
  overlay.innerHTML = `
    <section class="ui-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="ui-sheet-handle"></div>
      <div class="ui-sheet-head">
        <div>
          <div class="ui-sheet-title">${escapeHtml(title)}</div>
          ${subtitle ? `<div class="ui-sheet-sub">${escapeHtml(subtitle)}</div>` : ''}
        </div>
        <button type="button" class="ui-icon-button ui-sheet-close" data-ui-action="close" aria-label="Fechar">${icon('close')}</button>
      </div>
      <div class="ui-sheet-body">${content}</div>
    </section>`;

  const syncViewport = () => {
    const height = window.visualViewport?.height || window.innerHeight;
    overlay.style.setProperty('--ui-viewport-height', Math.round(height) + 'px');
  };
  syncViewport();
  window.visualViewport?.addEventListener('resize', syncViewport);
  window.visualViewport?.addEventListener('scroll', syncViewport);
  uiSheetViewportCleanup = () => {
    window.visualViewport?.removeEventListener('resize', syncViewport);
    window.visualViewport?.removeEventListener('scroll', syncViewport);
  };

  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeSheet();
  });
  overlay.addEventListener('focusin', event => {
    if (!event.target?.matches?.('input, select, textarea')) return;
    window.setTimeout(() => event.target.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 120);
  });
  overlay.querySelector('.ui-sheet-close').addEventListener('click', closeSheet);
  document.body.appendChild(overlay);
  document.body.classList.add('ui-modal-open');

  uiSheetKeydownHandler = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSheet();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...overlay.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )].filter(el => !el.hidden && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', uiSheetKeydownHandler);

  const sheet = overlay.querySelector('.ui-sheet');
  onMount?.(sheet);
  window.requestAnimationFrame(() => {
    sheet?.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])')
      ?.focus({ preventScroll: true });
  });
  return overlay;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function updateBodyModalState() {
  const hasModal = document.querySelector('.modal-overlay.aberto, .ui-sheet-overlay');
  document.body.classList.toggle('ui-modal-open', Boolean(hasModal));
}

function installModalManager() {
  const handleModalChange = modal => {
    if (!(modal instanceof HTMLElement) || !modal.classList.contains('modal-overlay')) return;
    if (modal.classList.contains('aberto')) {
      document.querySelectorAll('.modal-overlay.aberto').forEach(other => {
        if (other === modal) return;
        if (!modal.dataset.uiParent) modal.dataset.uiParent = other.id || '';
        other.classList.remove('aberto');
        other.classList.add('ui-suspenso');
      });
    } else if (modal.dataset.uiParent) {
      const parent = document.getElementById(modal.dataset.uiParent);
      const anotherOpen = document.querySelector('.modal-overlay.aberto');
      if (parent?.classList.contains('ui-suspenso') && !anotherOpen) {
        parent.classList.remove('ui-suspenso');
        parent.classList.add('aberto');
      }
      delete modal.dataset.uiParent;
    }
    updateBodyModalState();
  };

  const modalObserver = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') handleModalChange(record.target);
    }
  });
  document.querySelectorAll('.modal-overlay').forEach(modal => modalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] }));

  const bodyObserver = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches?.('.modal-overlay')) modalObserver.observe(node, { attributes: true, attributeFilter: ['class'] });
      node.querySelectorAll?.('.modal-overlay').forEach(modal => modalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] }));
    }));
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });
}

function buttonLabel(button) {
  const current = (button.textContent || '').replace(/\s+/g, ' ').trim();
  return current || button.dataset.uiOriginalLabel || '';
}

function setButtonContent(button, iconName, text = '') {
  if (button.dataset.uiIconized === `${iconName}:${text}`) return;
  button.innerHTML = text
    ? `<span class="ui-button-content">${icon(iconName)}<span>${escapeHtml(text)}</span></span>`
    : icon(iconName);
  button.dataset.uiIconized = `${iconName}:${text}`;
}

function enhanceButton(button) {
  if (!(button instanceof HTMLButtonElement)) return;
  const liveLabel = (button.textContent || '').replace(/\s+/g, ' ').trim();
  if (liveLabel && !button.dataset.uiOriginalLabel) button.dataset.uiOriginalLabel = liveLabel;
  const label = buttonLabel(button);
  const title = (button.title || '').toLowerCase();
  const aria = (button.getAttribute('aria-label') || '').toLowerCase();
  const explicitAction = String(button.dataset.uiAction || '').toLowerCase();
  const closeControl = explicitAction === 'close'
    || button.classList.contains('modal-fechar')
    || button.classList.contains('ritmo-close')
    || button.matches('[data-fechar-ritmo],[data-rv2-close],[data-ac-close],[data-cf-fechar],[data-cf-editor-fechar],[data-cfe-fechar]')
    || aria.includes('fechar')
    || title.includes('fechar');

  if (closeControl) {
    button.classList.remove('ui-delete', 'ui-danger', 'is-danger');
    button.classList.add('ui-icon-button');
    button.setAttribute('aria-label', 'Fechar');
    button.title = 'Fechar';
    setButtonContent(button, 'close');
    return;
  }

  if (label === 'Comprei') {
    button.classList.remove('ui-primary');
    button.classList.add('ui-icon-button', 'ui-action-icon', 'ui-purchase-action');
    button.dataset.uiAction = 'purchase';
    button.setAttribute('aria-label', 'Marcar como comprado');
    button.title = 'Marcar como comprado';
    setButtonContent(button, 'cartCheck');
    return;
  }

  if (label === 'Paguei') {
    button.classList.remove('ui-primary');
    button.classList.add('ui-icon-button', 'ui-action-icon', 'ui-payment-action');
    button.dataset.uiAction = 'payment';
    button.setAttribute('aria-label', 'Marcar como pago');
    button.title = 'Marcar como pago';
    setButtonContent(button, 'moneyCheck');
    return;
  }

  if (button.id === 'btnEditarPlanta' || button.id === 'btnEditarProjeto' || label === 'Editar ficha' || label === 'Editar projeto') {
    button.classList.add('ui-secondary');
    if (label) setButtonContent(button, 'edit', label);
    return;
  }

  if (button.closest('#mpRotinas') && label === 'Salvar') {
    button.classList.add('ui-icon-button', 'ui-action-icon', 'ui-routine-save');
    button.setAttribute('aria-label', 'Salvar intervalo');
    button.title = 'Salvar intervalo';
    setButtonContent(button, 'check');
    return;
  }

  if (title.includes('editar') || button.id?.startsWith('btnEdit') || (button.closest('#mpEventos') && label === 'Editar')) {
    button.classList.add('ui-icon-button');
    button.setAttribute('aria-label', button.title || 'Editar');
    button.title = button.title || 'Editar';
    setButtonContent(button, 'edit');
    return;
  }

  if (explicitAction === 'delete') {
    button.classList.add('ui-icon-button', 'ui-delete');
    button.setAttribute('aria-label', button.getAttribute('aria-label') || 'Excluir');
    button.title = button.title || 'Excluir';
    setButtonContent(button, 'trash');
    return;
  }

  if ((label === '×' || label === '✕') && !button.closest('.linha-ingrediente')) {
    // Um X sem semântica explícita é tratado como fechar, nunca como exclusão.
    // Ações destrutivas precisam declarar data-ui-action="delete".
    button.classList.remove('ui-delete', 'ui-danger', 'is-danger');
    button.classList.add('ui-icon-button');
    button.dataset.uiAction = 'close';
    button.setAttribute('aria-label', 'Fechar');
    button.title = 'Fechar';
    setButtonContent(button, 'close');
    return;
  }

  if (label === '×' && button.closest('.linha-ingrediente')) {
    button.classList.add('ui-icon-button', 'ui-delete');
    button.dataset.uiAction = 'delete';
    button.setAttribute('aria-label', 'Remover ingrediente');
    button.title = 'Remover ingrediente';
    setButtonContent(button, 'trash');
    return;
  }

  if (/^(Cuidar|Concluir|Entrar|Salvar|Adicionar|Iniciar)/i.test(label)) {
    button.classList.add('ui-primary');
    return;
  }

  if (/^(Gerar lista|Criar tarefa|Restaurar|Reativar|Inventário|Iniciar inventário)/i.test(label)) {
    button.classList.add('ui-secondary');
    return;
  }

  if (/^(Remover|Excluir|Revogar)/i.test(label)) {
    button.classList.add('ui-danger');
    return;
  }

  if (/^(Voltar|Cancelar|Limpar)/i.test(label)) {
    button.classList.add('ui-quiet');
    if (/^Voltar/i.test(label)) setButtonContent(button, 'back', label.replace(/^←\s*/, ''));
    return;
  }

  if (/^(\+|Add$|Novo|Nova|Gerar)/i.test(label) || label.startsWith('+ ')) {
    button.classList.add(button.classList.contains('secundario') ? 'ui-secondary' : 'ui-primary');
    const text = label.replace(/^\+\s*/, '').replace(/^Add$/, 'Adicionar');
    setButtonContent(button, 'plus', text);
  }
}

function enhanceUi(root = document) {
  root.querySelectorAll?.('button').forEach(enhanceButton);
  const addButton = document.getElementById('btnAdd');
  if (addButton) {
    addButton.classList.add('ui-primary');
    addButton.setAttribute('aria-label', 'Adicionar à lista');
    addButton.title = 'Adicionar à lista';
    setButtonContent(addButton, 'plus');
  }
  markFormRows();
  structureDynamicRows();
  replaceBottomNavigationIcons();
  makeMetricsInteractive();
  applyInputHints(root);
}

function installUiObserver() {
  const observer = new MutationObserver(records => {
    if (observerBusy) return;
    observerBusy = true;
    requestAnimationFrame(() => {
      for (const record of records) {
        record.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) {
            if (node.tagName === 'BUTTON') enhanceButton(node);
            enhanceUi(node);
          }
        });
      }
      observerBusy = false;
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function normalizeName(value = '') {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function rowName(row) {
  const element = row.querySelector('.nome, .lista-item-nome, .planta-nome, .ui-history-name');
  if (!element) return '';
  const clone = element.cloneNode(true);
  clone.querySelectorAll('.badge, svg').forEach(node => node.remove());
  return clone.textContent.replace(/\s+/g, ' ').trim().replace(/\s*\([^)]*\)\s*$/, '').trim();
}

async function recordHistory(module, recordId, data) {
  const { client, profile } = await getContext();
  const { error } = await client.from('historico_excluidos').insert({
    casa_id: profile.casa_id,
    usuario_id: profile.id,
    modulo: module,
    registro_id: recordId || null,
    dados: data,
  });
  if (error) throw new Error(`Não foi possível registrar no histórico: ${error.message}`);
}

const SIMPLE_DELETE_MAP = {
  lista_compras: { table: 'lista_compras', nameField: 'nome', select: '*' },
  estoque: { table: 'estoque', nameField: 'nome', select: '*' },
  tarefas: { table: 'tarefas', nameField: 'titulo', select: '*' },
  contas: { table: 'contas', nameField: 'nome', select: '*' },
  rituais: { table: 'rituais', nameField: 'nome', select: '*,ritual_sessoes(*)' },
  refeicoes: { table: 'refeicoes', nameField: 'nome', select: '*,refeicao_ingredientes(*)' },
};

async function deleteSimple(module, row) {
  const config = SIMPLE_DELETE_MAP[module];
  if (!config) return;
  const recordId = row.dataset.recordId;
  const name = rowName(row);
  if (!recordId && !name) throw new Error('Não foi possível identificar o item selecionado.');
  const { client, profile } = await getContext();
  let query = client.from(config.table).select(config.select);
  query = recordId ? query.eq('id', recordId) : query.eq(config.nameField, name);
  if (module !== 'refeicoes' && module !== 'rituais') query = query.eq('casa_id', profile.casa_id);
  else query = query.eq('casa_id', profile.casa_id);
  const { data: records, error } = await query.limit(1);
  if (error || !records?.length) throw new Error(`Não foi possível localizar “${name}”.`);
  const record = records[0];
  const accepted = window.confirm(`Excluir “${name}”?\n\nO item ficará disponível no Histórico para restauração.`);
  if (!accepted) return;

  const parent = row.parentNode;
  const nextSibling = row.nextSibling;
  row.remove();
  toast(`${name} foi removido.`);

  try {
    await recordHistory(module, record.id, record);
    const { error: deleteError } = await client.from(config.table).delete().eq('id', record.id);
    if (deleteError) throw new Error(deleteError.message);
    if (isConfigVisible()) loadHistory();
  } catch (error) {
    if (parent && !row.isConnected) parent.insertBefore(row, nextSibling);
    throw error;
  }
}

async function deletePlant() {
  const codeText = document.getElementById('mpCodigo')?.textContent || '';
  const code = codeText.split('·')[0].trim();
  if (!code) throw new Error('Não foi possível identificar a planta.');
  const { client, profile } = await getContext();
  const { data: plant, error } = await client
    .from('plantas')
    .select('*,especies(*),planta_rotinas(*),planta_eventos(*)')
    .eq('casa_id', profile.casa_id)
    .eq('codigo', code)
    .single();
  if (error || !plant) throw new Error('Planta não encontrada.');
  const name = document.getElementById('mpNome')?.textContent || code;
  const accepted = window.confirm(`Remover “${name}” da lista ativa?\n\nA ficha, as rotinas e a linha do tempo poderão ser restauradas.`);
  if (!accepted) return;
  await recordHistory('plantas', plant.id, { _ui_bundle: 'planta', planta: plant });
  const { error: updateError } = await client.from('plantas').update({ status: 'removida' }).eq('id', plant.id);
  if (updateError) throw new Error(updateError.message);
  await client.from('planta_eventos').insert({
    planta_id: plant.id,
    tipo: 'alteracao_status',
    notas: 'Planta movida para o Histórico do LifeOS.',
    usuario_id: profile.id,
  });
  document.getElementById('modalPlanta')?.classList.remove('aberto');
  toast(`${name} foi movida para o Histórico.`);
  window.setTimeout(() => window.location.reload(), 500);
}

async function deleteProject() {
  const name = document.getElementById('ppNome')?.textContent?.trim();
  if (!name) throw new Error('Não foi possível identificar o projeto.');
  const { client, profile } = await getContext();
  const { data: projects, error } = await client
    .from('projetos')
    .select('*')
    .eq('usuario_id', profile.id)
    .eq('nome', name)
    .limit(1);
  if (error || !projects?.length) throw new Error('Projeto não encontrado.');
  const project = projects[0];
  const [{ data: objectives }, { data: tasks }, { data: items }] = await Promise.all([
    client.from('projeto_objetivos').select('*').eq('projeto_id', project.id),
    client.from('tarefas').select('*').eq('projeto_id', project.id),
    client.from('projeto_itens').select('*').eq('projeto_id', project.id),
  ]);
  const accepted = window.confirm(`Remover o projeto “${name}”?\n\nObjetivos, tarefas e itens vinculados poderão ser restaurados.`);
  if (!accepted) return;
  await recordHistory('projetos', project.id, {
    _ui_bundle: 'projeto',
    projeto: project,
    objetivos: objectives || [],
    tarefas: tasks || [],
    itens: items || [],
  });
  const { error: deleteError } = await client.from('projetos').delete().eq('id', project.id);
  if (deleteError) throw new Error(deleteError.message);
  toast(`${name} foi movido para o Histórico.`);
  window.abrirSecao?.('projetos');
}

function moduleFromDeleteTarget(button) {
  if (button.id === 'btnRemoverPlanta') return { module: 'plantas', row: null };
  if (button.id === 'btnRemoverProjeto') return { module: 'projetos', row: null };
  const contexts = [
    ['#itens', 'lista_compras'],
    ['#itensEstoque', 'estoque'],
    ['#itensTarefas', 'tarefas'],
    ['#listaRituais', 'rituais'],
    ['#listaRefeicoes', 'refeicoes'],
  ];
  for (const [selector, module] of contexts) {
    const container = button.closest(selector);
    if (!container) continue;
    const row = button.closest('.item, .ritual-card, .card-refeicao, .lista-item');
    if (row) return { module, row };
  }
  return null;
}

function isDeleteControl(button) {
  const label = buttonLabel(button);
  const aria = (button.getAttribute('aria-label') || '').toLowerCase();
  const title = (button.title || '').toLowerCase();
  const closeControl = button.classList.contains('modal-fechar')
    || button.classList.contains('ritmo-close')
    || button.matches('[data-fechar-ritmo],[data-rv2-close]')
    || aria.includes('fechar')
    || title.includes('fechar');
  if (closeControl) return false;
  return button.classList.contains('ui-delete') || label === '×' || aria.includes('excluir') || aria.includes('remover');
}

function installDeletionGuard() {
  document.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (button?.dataset.lifeosDeleteFlow === 'app') return;
    if (!button || !isDeleteControl(button)) return;
    const target = moduleFromDeleteTarget(button);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    button.disabled = true;
    try {
      if (target.module === 'plantas') await deletePlant();
      else if (target.module === 'projetos') await deleteProject();
      else await deleteSimple(target.module, target.row);
    } catch (error) {
      toast(error.message || 'Não foi possível excluir o item.', 'erro', 5000);
    } finally {
      button.disabled = false;
    }
  }, true);
}

function isConfigVisible() {
  const section = document.getElementById('secaoConfig');
  return section && getComputedStyle(section).display !== 'none' && !section.classList.contains('oculto');
}

const HISTORY_MODULES = [
  ['todos', 'Todos'],
  ['lista_compras', 'Compras'],
  ['estoque', 'Estoque'],
  ['tarefas', 'Tarefas'],
  ['contas', 'Contas'],
  ['refeicoes', 'Cardápio'],
  ['projetos', 'Projetos'],
  ['rituais', 'Rituais'],
  ['plantas', 'Plantas'],
];

function historyName(item) {
  const data = item.dados || {};
  if (data._ui_bundle === 'planta') {
    const p = data.planta || {};
    return p.nome_personalizado || p.especies?.nome_popular || p.codigo || 'Planta';
  }
  if (data._ui_bundle === 'projeto') return data.projeto?.nome || 'Projeto';
  return data.titulo || data.nome || data.nome_popular || data.codigo || 'Item excluído';
}

function moduleLabel(module) {
  return HISTORY_MODULES.find(([key]) => key === module)?.[1] || module;
}

function ensureHistoryControls() {
  const list = document.getElementById('listaHistorico');
  if (!list || document.getElementById('uiHistoricoControles')) return;
  const oldFilters = list.parentElement?.querySelector('.filtros-plantas');
  if (oldFilters) oldFilters.classList.add('ui-hidden');
  const controls = document.createElement('div');
  controls.id = 'uiHistoricoControles';
  controls.className = 'ui-history-controls';
  controls.innerHTML = `
    <div class="ui-history-search">
      ${icon('search')}
      <input type="search" placeholder="Procurar no histórico" aria-label="Procurar no histórico" />
    </div>
    <div class="ui-history-filters">
      ${HISTORY_MODULES.map(([key, label]) => `<button type="button" class="ui-history-filter${key === 'todos' ? ' ativo' : ''}" data-history-filter="${key}">${label}</button>`).join('')}
    </div>`;
  list.before(controls);
  controls.querySelector('input').addEventListener('input', event => {
    historySearch = event.target.value.trim().toLowerCase();
    renderHistory();
  });
  controls.querySelectorAll('[data-history-filter]').forEach(button => {
    button.addEventListener('click', () => {
      historyFilter = button.dataset.historyFilter;
      controls.querySelectorAll('[data-history-filter]').forEach(item => item.classList.toggle('ativo', item === button));
      renderHistory();
    });
  });
}

async function loadHistory() {
  const list = document.getElementById('listaHistorico');
  if (!list) return;
  ensureHistoryControls();
  list.innerHTML = '<div class="vazio">Carregando histórico...</div>';
  try {
    const { client, profile } = await getContext();
    const { data, error } = await client
      .from('historico_excluidos')
      .select('id,modulo,registro_id,dados,excluido_em,restaurado_em,restaurado_por')
      .eq('casa_id', profile.casa_id)
      .order('excluido_em', { ascending: false })
      .limit(300);
    if (error) throw error;
    historyCache = data || [];
    renderHistory();
  } catch (error) {
    list.innerHTML = `<div class="ui-history-error"><strong>O Histórico não pôde ser carregado.</strong><br>${escapeHtml(error.message || 'Verifique se a migração 017 foi aplicada no Supabase.')}</div>`;
  }
}

function renderHistory() {
  const list = document.getElementById('listaHistorico');
  if (!list) return;
  let items = historyCache;
  if (historyFilter !== 'todos') items = items.filter(item => item.modulo === historyFilter);
  if (historySearch) items = items.filter(item => normalizeName(historyName(item)).includes(normalizeName(historySearch)));
  if (!items.length) {
    list.innerHTML = '<div class="vazio">Nenhum item encontrado neste filtro.</div>';
    return;
  }
  list.innerHTML = '';
  items.forEach(item => {
    const wrapper = document.createElement('div');
    wrapper.className = 'ui-history-item';
    const date = item.excluido_em ? new Date(item.excluido_em) : null;
    const restoredDate = item.restaurado_em ? new Date(item.restaurado_em) : null;
    wrapper.innerHTML = `
      <div class="ui-history-top">
        <div>
          <div class="ui-history-name">${escapeHtml(historyName(item))}</div>
          <div class="ui-history-meta">
            ${escapeHtml(moduleLabel(item.modulo))}
            ${date ? ` · excluído em ${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </div>
        </div>
        ${item.restaurado_em
          ? `<span class="ui-history-restored">${icon('check', 15)} Restaurado${restoredDate ? ` em ${restoredDate.toLocaleDateString('pt-BR')}` : ''}</span>`
          : `<button type="button" class="ui-secondary ui-history-restore">${icon('restore', 16)} <span>Restaurar</span></button>`}
      </div>`;
    if (!item.restaurado_em) {
      wrapper.querySelector('.ui-history-restore').addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await restoreHistoryItem(item);
          toast(`${historyName(item)} foi restaurado.`);
          await loadHistory();
        } catch (error) {
          toast(error.message || 'Não foi possível restaurar.', 'erro', 5000);
          button.disabled = false;
        }
      });
    }
    list.appendChild(wrapper);
  });
  enhanceUi(list);
}

function cleanRecord(record, excluded = []) {
  const copy = { ...record };
  excluded.forEach(key => delete copy[key]);
  return copy;
}

async function insertOrUpdate(client, table, record) {
  const payload = { ...record };
  if (payload.id) {
    const { data: existing } = await client.from(table).select('id').eq('id', payload.id).maybeSingle();
    if (existing) return client.from(table).update(payload).eq('id', payload.id);
  }
  return client.from(table).insert(payload);
}

async function restoreHistoryItem(item) {
  const { client, profile } = await getContext();
  const data = item.dados || {};
  let result = { error: null };

  if (data._ui_bundle === 'planta') {
    const plant = data.planta || {};
    result = await client.from('plantas').update({ status: 'ativa' }).eq('id', plant.id);
    if (!result.error) {
      await client.from('planta_eventos').insert({
        planta_id: plant.id,
        tipo: 'alteracao_status',
        notas: 'Planta restaurada pelo Histórico do LifeOS.',
        usuario_id: profile.id,
      });
    }
  } else if (data._ui_bundle === 'projeto') {
    const project = cleanRecord(data.projeto || []);
    result = await insertOrUpdate(client, 'projetos', project);
    if (!result.error) {
      for (const objective of data.objetivos || []) await insertOrUpdate(client, 'projeto_objetivos', cleanRecord(objective));
      for (const task of data.tarefas || []) await insertOrUpdate(client, 'tarefas', cleanRecord(task));
      for (const projectItem of data.itens || []) await insertOrUpdate(client, 'projeto_itens', cleanRecord(projectItem));
    }
  } else {
    switch (item.modulo) {
      case 'tarefas':
        result = await insertOrUpdate(client, 'tarefas', cleanRecord(data));
        break;
      case 'contas':
        result = await insertOrUpdate(client, 'contas', cleanRecord(data));
        break;
      case 'estoque':
        result = await insertOrUpdate(client, 'estoque', cleanRecord(data));
        break;
      case 'lista_compras':
        result = await insertOrUpdate(client, 'lista_compras', { ...cleanRecord(data), status: 'pendente' });
        break;
      case 'rituais': {
        const ritual = cleanRecord(data, ['ritual_sessoes']);
        result = await insertOrUpdate(client, 'rituais', ritual);
        if (!result.error) {
          for (const session of data.ritual_sessoes || []) await insertOrUpdate(client, 'ritual_sessoes', cleanRecord(session));
        }
        break;
      }
      case 'refeicoes': {
        const meal = cleanRecord(data, ['refeicao_ingredientes']);
        result = await insertOrUpdate(client, 'refeicoes', meal);
        if (!result.error) {
          for (const ingredient of data.refeicao_ingredientes || []) await insertOrUpdate(client, 'refeicao_ingredientes', cleanRecord(ingredient));
        }
        break;
      }
      case 'plantas':
        result = await client.from('plantas').update({ status: 'ativa' }).eq('id', item.registro_id);
        break;
      default:
        throw new Error(`Restauração ainda não configurada para ${moduleLabel(item.modulo)}.`);
    }
  }

  if (result?.error) throw new Error(result.error.message);
  const { error: markError } = await client.from('historico_excluidos').update({
    restaurado_em: new Date().toISOString(),
    restaurado_por: profile.id,
  }).eq('id', item.id);
  if (markError) throw new Error(markError.message);
}

function scheduleHistoryLoad(delay = 180) {
  window.clearTimeout(historyLoadTimer);
  historyLoadTimer = window.setTimeout(() => {
    if (isConfigVisible()) loadHistory();
  }, delay);
}

function installHistoryWatcher() {
  const section = document.getElementById('secaoConfig');
  if (!section) return;
  const observer = new MutationObserver(() => {
    if (isConfigVisible()) scheduleHistoryLoad();
  });
  observer.observe(section, { attributes: true, attributeFilter: ['class', 'style'] });
  document.addEventListener('click', event => {
    if (event.target.closest('[onclick*="config"], .tab-btn[data-tab="mais"]')) scheduleHistoryLoad(300);
  });
}

function getPendingNameFromRow(row) {
  return rowName(row);
}

async function findPendingItem(name) {
  const { client, profile } = await getContext();
  const { data, error } = await client
    .from('lista_compras')
    .select('*')
    .eq('casa_id', profile.casa_id)
    .eq('status', 'pendente')
    .eq('nome', name)
    .order('criado_em', { ascending: false })
    .limit(1);
  if (error || !data?.length) throw new Error('Item da lista não encontrado.');
  return data[0];
}

async function completePurchase(item, options) {
  const { client, profile } = await getContext();
  let stockId = item.estoque_id || options.stockId || null;

  if (options.createStock) {
    const base = {
      casa_id: profile.casa_id,
      nome: item.nome,
      tipo: options.type,
      local: options.local || null,
      categoria: item.categoria || null,
      critico: false,
      atualizado_por: profile.id,
    };
    if (options.type === 'nivel_visual') {
      Object.assign(base, { nivel: options.level || 'cheio', minimo_nivel: '25', quantidade: 0, minimo: 0 });
    } else {
      Object.assign(base, {
        quantidade: Number(options.quantity) || 0,
        minimo: 1,
        unidade: options.unit || (options.type === 'peso_volume' ? 'g' : 'un'),
      });
    }
    const { data: created, error } = await client.from('estoque').insert(base).select().single();
    if (error) throw new Error(error.message);
    stockId = created.id;
  } else if (stockId && options.updateStock !== false) {
    const { data: stock, error } = await client.from('estoque').select('*').eq('id', stockId).single();
    if (error || !stock) throw new Error('Item correspondente não foi encontrado no estoque.');
    if (stock.tipo === 'nivel_visual') {
      const { error: updateError } = await client.from('estoque').update({
        nivel: options.level || 'cheio',
        atualizado_por: profile.id,
        atualizado_em: new Date().toISOString(),
      }).eq('id', stock.id);
      if (updateError) throw new Error(updateError.message);
    } else {
      const incoming = Number(options.quantity) || 1;
      const { error: updateError } = await client.from('estoque').update({
        quantidade: Number(stock.quantidade || 0) + incoming,
        atualizado_por: profile.id,
        atualizado_em: new Date().toISOString(),
      }).eq('id', stock.id);
      if (updateError) throw new Error(updateError.message);
    }
  }

  const { error: purchaseError } = await client.from('lista_compras').update({
    status: 'comprado',
    estoque_id: stockId,
    comprado_por: profile.id,
    comprado_em: new Date().toISOString(),
  }).eq('id', item.id);
  if (purchaseError) throw new Error(purchaseError.message);
  await client.from('eventos').insert({
    tipo: 'item_comprado',
    entidade: 'lista_compras',
    entidade_id: item.id,
    usuario_id: profile.id,
    detalhe: `${profile.nome} comprou ${item.nome}${stockId ? ' e atualizou o estoque' : ''}`,
  });
}

function renderLinkedPurchaseSheet(item, stock) {
  const isVisual = stock?.tipo === 'nivel_visual';
  const defaultQuantity = Number(item.quantidade) || 1;
  openSheet({
    title: item.nome,
    subtitle: stock ? 'O item já está ligado ao estoque.' : 'Registre a compra rapidamente.',
    content: isVisual ? `
      <div class="campo"><label>Nível após a compra</label>
        <select id="uiPurchaseLevel">
          <option value="cheio">Cheio</option><option value="75">~75%</option><option value="metade">Metade</option>
        </select>
      </div>
      <div class="ui-sheet-actions">
        <button type="button" id="uiConfirmPurchase" class="ui-primary">${icon('check')} <span>Concluir compra</span></button>
        <button type="button" id="uiOnlyPurchase" class="ui-quiet">Só marcar como comprado</button>
      </div>` : `
      <div class="campo"><label>Quantidade comprada</label>
        <div class="ui-stepper">
          <button type="button" id="uiMinus" aria-label="Diminuir">−</button>
          <input id="uiPurchaseQuantity" type="number" min="0" step="any" value="${defaultQuantity}">
          <button type="button" id="uiPlus" aria-label="Aumentar">+</button>
        </div>
      </div>
      <div class="ui-sheet-actions">
        <button type="button" id="uiConfirmPurchase" class="ui-primary">${icon('check')} <span>Concluir e atualizar estoque</span></button>
        <button type="button" id="uiOnlyPurchase" class="ui-quiet">Só marcar como comprado</button>
      </div>`,
    onMount(sheet) {
      const input = sheet.querySelector('#uiPurchaseQuantity');
      sheet.querySelector('#uiMinus')?.addEventListener('click', () => { input.value = Math.max(0, Number(input.value || 0) - 1); });
      sheet.querySelector('#uiPlus')?.addEventListener('click', () => { input.value = Number(input.value || 0) + 1; });
      sheet.querySelector('#uiConfirmPurchase').addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await completePurchase(item, isVisual
            ? { level: sheet.querySelector('#uiPurchaseLevel').value }
            : { quantity: Number(input.value) || 1 });
          closeSheet();
          toast(`${item.nome} foi registrado e o estoque foi atualizado.`);
        } catch (error) {
          toast(error.message, 'erro', 5000);
          button.disabled = false;
        }
      });
      sheet.querySelector('#uiOnlyPurchase').addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await completePurchase(item, { updateStock: false });
          closeSheet();
          toast(`${item.nome} foi marcado como comprado.`);
        } catch (error) {
          toast(error.message, 'erro', 5000);
          button.disabled = false;
        }
      });
    },
  });
}

async function renderNewStockPurchaseSheet(item) {
  const { client, profile } = await getContext();
  const { data: locations } = await client.from('locais_estoque').select('nome').eq('casa_id', profile.casa_id).eq('ativo', true).order('ordem');
  let type = 'contavel';
  openSheet({
    title: item.nome,
    subtitle: 'Como você quer controlar este item no estoque?',
    content: `
      <div class="ui-sheet-grid" role="group" aria-label="Tipo de controle">
        <button type="button" class="ui-choice ativo" data-type="contavel">${icon('box')}<br>Unidades</button>
        <button type="button" class="ui-choice" data-type="peso_volume">${icon('box')}<br>Peso ou volume</button>
        <button type="button" class="ui-choice" data-type="nivel_visual">${icon('box')}<br>Nível visual</button>
      </div>
      <div id="uiPurchaseFields"></div>
      <div class="campo"><label>Local — opcional</label>
        <select id="uiPurchaseLocation"><option value="">Sem local</option>${(locations || []).map(location => `<option value="${escapeHtml(location.nome)}">${escapeHtml(location.nome)}</option>`).join('')}</select>
      </div>
      <div class="ui-sheet-actions">
        <button type="button" id="uiCreateAndPurchase" class="ui-primary">${icon('check')} <span>Concluir compra</span></button>
        <button type="button" id="uiOnlyPurchase" class="ui-quiet">Só marcar como comprado</button>
      </div>`,
    onMount(sheet) {
      const fields = sheet.querySelector('#uiPurchaseFields');
      const renderFields = () => {
        fields.innerHTML = type === 'nivel_visual' ? `
          <div class="campo"><label>Nível após a compra</label><select id="uiNewLevel"><option value="cheio">Cheio</option><option value="75">~75%</option><option value="metade">Metade</option></select></div>` : `
          <div class="campo"><label>Quantidade comprada</label><input id="uiNewQuantity" type="number" min="0" step="any" value="${Number(item.quantidade) || 1}"></div>
          <div class="campo"><label>Unidade</label><select id="uiNewUnit">${type === 'peso_volume'
            ? '<option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option>'
            : '<option value="un">un</option><option value="pacote">pacote</option><option value="caixa">caixa</option><option value="rolo">rolo</option>'}</select></div>`;
      };
      renderFields();
      sheet.querySelectorAll('[data-type]').forEach(button => button.addEventListener('click', () => {
        type = button.dataset.type;
        sheet.querySelectorAll('[data-type]').forEach(choice => choice.classList.toggle('ativo', choice === button));
        renderFields();
      }));
      sheet.querySelector('#uiCreateAndPurchase').addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await completePurchase(item, {
            createStock: true,
            type,
            quantity: Number(sheet.querySelector('#uiNewQuantity')?.value) || 1,
            unit: sheet.querySelector('#uiNewUnit')?.value || 'un',
            level: sheet.querySelector('#uiNewLevel')?.value || 'cheio',
            local: sheet.querySelector('#uiPurchaseLocation').value,
          });
          closeSheet();
          toast(`${item.nome} foi comprado e adicionado ao estoque.`);
        } catch (error) {
          toast(error.message, 'erro', 5000);
          button.disabled = false;
        }
      });
      sheet.querySelector('#uiOnlyPurchase').addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await completePurchase(item, { updateStock: false });
          closeSheet();
          toast(`${item.nome} foi marcado como comprado.`);
        } catch (error) {
          toast(error.message, 'erro', 5000);
          button.disabled = false;
        }
      });
    },
  });
}

async function openPurchaseFlow(row) {
  const name = getPendingNameFromRow(row);
  const item = await findPendingItem(name);
  const { client, profile } = await getContext();
  let stock = null;
  if (item.estoque_id) {
    const { data } = await client.from('estoque').select('*').eq('id', item.estoque_id).maybeSingle();
    stock = data;
  } else {
    const { data: stocks } = await client.from('estoque').select('*').eq('casa_id', profile.casa_id);
    stock = (stocks || []).find(candidate => normalizeName(candidate.nome) === normalizeName(item.nome)) || null;
    if (stock) item.estoque_id = stock.id;
  }
  if (stock) renderLinkedPurchaseSheet(item, stock);
  else await renderNewStockPurchaseSheet(item);
}

function installPurchaseFlow() {
  document.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button || (button.dataset.uiAction !== 'purchase' && buttonLabel(button) !== 'Comprei')) return;
    const row = button.closest('#itens .item, #itens .lista-item');
    if (!row) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    button.disabled = true;
    try {
      await openPurchaseFlow(row);
    } catch (error) {
      toast(error.message || 'Não foi possível abrir a compra.', 'erro', 5000);
    } finally {
      button.disabled = false;
    }
  }, true);
}

function enhanceMoreMenu() {
  const mappings = [
    ['Projetos pessoais', 'folder'],
    ['Rituais', 'ritual'],
    ['Configurações', 'settings'],
  ];
  document.querySelectorAll('#abaMais .cartao.clicavel').forEach(card => {
    const title = card.querySelector('div[style*="font-size:15px"]')?.textContent?.trim();
    const match = mappings.find(([label]) => label === title);
    if (!match || card.querySelector('.ui-menu-icon')) return;
    const row = card.querySelector(':scope > div');
    const left = row?.firstElementChild;
    if (!row || !left) return;
    const iconBox = document.createElement('span');
    iconBox.className = 'ui-menu-icon';
    iconBox.style.cssText = 'width:38px;height:38px;border-radius:12px;background:var(--sage-soft);color:var(--sage);display:grid;place-items:center;flex:none;margin-right:12px';
    iconBox.innerHTML = icon(match[1]);
    row.style.justifyContent = 'flex-start';
    row.insertBefore(iconBox, left);
    row.lastElementChild.style.marginLeft = 'auto';
  });
}

function destinationFromText(value = '') {
  const text = normalizeName(value);
  if (text.includes('tarefa')) return 'tarefas';
  if (text.includes('conta')) return 'financeiro';
  if (text.includes('compra') || text.includes('lista')) return 'compras';
  if (text.includes('estoque') || text.includes('item')) return 'estoque';
  return '';
}

function makeMetricsInteractive() {
  const fallback = ['tarefas', 'financeiro', 'compras', 'estoque'];
  document.querySelectorAll('#metricasHoje .metrica').forEach((metric, index) => {
    const label = metric.querySelector('.metrica-label')?.textContent || metric.textContent || '';
    const destination = destinationFromText(label) || fallback[index] || '';
    if (!destination) return;
    metric.dataset.uiDestination = destination;
    metric.tabIndex = 0;
    metric.setAttribute('role', 'button');
    metric.setAttribute('aria-label', `Abrir ${label.trim() || destination}`);
  });

  document.querySelectorAll('#cardsHoje .card-hoje, #cardsHoje .cartao.clicavel').forEach(card => {
    // A Central Financeira possui cliques próprios em Pagar e Ver todas.
    // Não transforme o cartão financeiro em um atalho global para Casa > Contas.
    if (card.id === 'cfToday' || card.closest('#cfToday')) {
      delete card.dataset.uiDestination;
      card.removeAttribute('tabindex');
      card.removeAttribute('role');
      return;
    }
    const title = card.querySelector('.card-hoje-titulo-txt, .secao-titulo, b')?.textContent || card.textContent || '';
    const destination = destinationFromText(title);
    if (!destination) return;
    card.dataset.uiDestination = destination;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
  });
}


const FORM_ROW_GROUPS = [
  { ids: ['ctValor', 'ctVenc'], stack: true },
  { ids: ['ecValor', 'ecVenc'], stack: true },
  { ids: ['projInicio', 'projTermino'], stack: true },
  { ids: ['tfResp', 'tfData'], stack: true },
  { ids: ['etResp', 'etData'], stack: true },
  { ids: ['hcMes', 'hcValorRetro'], stack: true },
  { ids: ['refTipo', 'refPorcoes'] },
  { ids: ['estQtd', 'estMin'] },
  { ids: ['epComodo', 'epPosicao'] },
  { ids: ['epMetodo', 'epPerfil'] },
  { ids: ['npComodo', 'npPosicao'] },
  { ids: ['npMetodo', 'npPerfil'] },
  { ids: ['npRotinaT', 'npRotinaI'], stack: true },
  { ids: ['projStatus', 'projFreq'] },
  { ids: ['elQtd', 'elUnidade'] },
];

function markFormRows() {
  FORM_ROW_GROUPS.forEach(group => {
    const elements = group.ids.map(id => document.getElementById(id)).filter(Boolean);
    if (elements.length !== group.ids.length) return;
    const parent = elements[0].closest('div[style*="display:flex"]');
    if (!parent || !elements.every(element => parent.contains(element))) return;
    parent.classList.add('ui-form-row');
    if (group.stack) parent.classList.add('ui-stack-mobile');
  });

  ['estTaxaConsumo', 'eeTaxaConsumo'].forEach(id => {
    const input = document.getElementById(id);
    input?.parentElement?.classList.add('ui-consumption-row');
  });
}

function replaceBottomNavigationIcons() {
  const icons = {
    hoje: `<svg class="ui-nav-svg ui-nav-sparkle" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.7 5.2 4.8 9.3 10 10-5.2.7-9.3 4.8-10 10-.7-5.2-4.8-9.3-10-10 5.2-.7 9.3-4.8 10-10Z"/></svg>`,
    casa: `<svg class="ui-nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></svg>`,
    financeiro: `<svg class="ui-nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></svg>`,
    plantas: `<svg class="ui-nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 14V8"/><path d="M12 10c-4 0-6-2-6-5 4 0 6 2 6 5Z"/><path d="M12 8c4 0 6-2 6-5-4 0-6 2-6 5Z"/><path d="M6 14h12l-1 7H7Z"/></svg>`,
    mais: `<svg class="ui-nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
  };
  Object.entries(icons).forEach(([tab, markup]) => {
    const button = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (!button || button.dataset.uiNavV2) return;
    const old = button.querySelector('svg');
    if (old) old.outerHTML = markup;
    else button.insertAdjacentHTML('afterbegin', markup);
    button.dataset.uiNavV2 = '1';
  });
}

function centerActiveSubtab(button) {
  if (!(button instanceof HTMLElement)) return;
  window.requestAnimationFrame(() => {
    button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
}

function installSubtabScrolling() {
  document.addEventListener('click', event => {
    const button = event.target.closest('.sub-aba, .filtro-btn, .ui-history-filter');
    if (button) centerActiveSubtab(button);
  });
  const active = document.querySelector('.sub-abas .sub-aba.ativa');
  if (active) window.setTimeout(() => centerActiveSubtab(active), 200);
}

function structureDynamicRows() {
  document.querySelectorAll('#itens .item').forEach(row => {
    row.classList.add('ui-purchase-row');
    row.lastElementChild?.classList.add('ui-row-actions');
  });

  document.querySelectorAll('#itensContas .item').forEach(row => {
    row.classList.add('ui-account-row');
    const desc = row.querySelector(':scope > .desc');
    const actions = row.querySelector(':scope > .est-controles');
    if (!desc || !actions) return;
    actions.classList.add('ui-row-actions');
    let titleRow = desc.querySelector('.ui-account-title-row');
    if (!titleRow) {
      const name = desc.querySelector('.nome');
      if (name) {
        titleRow = document.createElement('div');
        titleRow.className = 'ui-account-title-row';
        desc.insertBefore(titleRow, name);
        titleRow.appendChild(name);
      }
    }
    const badge = actions.querySelector('.badge');
    if (badge && titleRow) titleRow.appendChild(badge);
  });

  document.querySelectorAll('#listaRituais .ritual-card').forEach(card => {
    card.classList.add('ui-ritual-card');
    const top = card.querySelector('.ritual-topo');
    if (!top) return;
    top.firstElementChild?.classList.add('ui-ritual-info');
    top.lastElementChild?.classList.add('ui-ritual-actions');
  });

  document.querySelectorAll('#listaTokens > div, #listaLocaisEstoque > div').forEach(row => row.classList.add('ui-settings-row'));

  const plantActions = document.getElementById('mpAcoes');
  plantActions?.querySelectorAll('button').forEach(button => button.classList.add('ui-plant-care-action'));
  const plantFooter = document.getElementById('btnEditarPlanta')?.parentElement;
  plantFooter?.classList.add('ui-plant-footer-actions');

  document.querySelectorAll('#mpRotinas > div:not(.titulo-secao)').forEach(row => row.classList.add('ui-plant-routine'));
}

const PLANT_EVENT_INFO = {
  cadastro: ['task', 'Cadastro'],
  rega: ['leaf', 'Rega'],
  troca_agua: ['restore', 'Troca de água'],
  imersao: ['box', 'Imersão'],
  adubacao: ['plant', 'Adubação'],
  poda: ['edit', 'Poda'],
  observacao: ['edit', 'Observação'],
  alteracao_status: ['restore', 'Status'],
  muda_retirada: ['plant', 'Muda'],
};

async function getCurrentPlant() {
  const codeText = document.getElementById('mpCodigo')?.textContent || '';
  const code = codeText.split('·')[0].trim();
  if (!code) throw new Error('Não foi possível identificar a planta.');
  const { client, profile } = await getContext();
  const { data, error } = await client.from('plantas').select('id,codigo').eq('casa_id', profile.casa_id).eq('codigo', code).single();
  if (error || !data) throw new Error('Planta não encontrada.');
  return data;
}

function openConfirmSheet({ title, message, confirmLabel = 'Confirmar', danger = false, onConfirm }) {
  openSheet({
    title,
    content: `<p class="ui-confirm-message">${escapeHtml(message)}</p><div class="ui-sheet-actions"><button type="button" id="uiConfirmAction" class="${danger ? 'ui-danger' : 'ui-primary'}">${escapeHtml(confirmLabel)}</button><button type="button" id="uiCancelAction" class="ui-quiet">Cancelar</button></div>`,
    onMount(sheet) {
      sheet.querySelector('#uiCancelAction').addEventListener('click', closeSheet);
      sheet.querySelector('#uiConfirmAction').addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try { await onConfirm(); closeSheet(); }
        catch (error) { toast(error.message || 'Não foi possível concluir.', 'erro', 5000); button.disabled = false; }
      });
    },
  });
}

function openPlantNoteSheet({ plantId, eventId = null, initialValue = '' }) {
  openSheet({
    title: eventId ? 'Editar observação' : 'Nova observação',
    subtitle: eventId ? 'Atualize o texto registrado na linha do tempo.' : 'Registre uma informação sobre esta planta.',
    content: `<div class="campo"><label>Observação</label><textarea id="uiPlantNote" rows="5" placeholder="Escreva a observação">${escapeHtml(initialValue)}</textarea></div><div class="ui-sheet-actions"><button type="button" id="uiSavePlantNote" class="ui-primary">${icon('check')}<span>Salvar observação</span></button><button type="button" id="uiCancelPlantNote" class="ui-quiet">Cancelar</button></div>`,
    onMount(sheet) {
      const input = sheet.querySelector('#uiPlantNote');
      input.focus();
      input.setSelectionRange?.(input.value.length, input.value.length);
      sheet.querySelector('#uiCancelPlantNote').addEventListener('click', closeSheet);
      sheet.querySelector('#uiSavePlantNote').addEventListener('click', async event => {
        const note = input.value.trim();
        if (!note) { toast('Digite uma observação.', 'erro'); return; }
        const button = event.currentTarget;
        button.disabled = true;
        try {
          const { client, profile } = await getContext();
          const result = eventId
            ? await client.from('planta_eventos').update({ notas: note }).eq('id', eventId)
            : await client.from('planta_eventos').insert({ planta_id: plantId, tipo: 'observacao', notas: note, usuario_id: profile.id, data: new Date().toISOString() });
          if (result.error) throw result.error;
          closeSheet();
          toast(eventId ? 'Observação atualizada.' : 'Observação registrada.');
          await renderPlantTimelineV2();
        } catch (error) {
          toast(error.message || 'Não foi possível salvar a observação.', 'erro', 5000);
          button.disabled = false;
        }
      });
    },
  });
}

async function renderPlantTimelineV2() {
  if (plantTimelineBusy) return;
  const modal = document.getElementById('modalPlanta');
  const area = document.getElementById('mpEventos');
  if (!modal?.classList.contains('aberto') || !area) return;
  plantTimelineBusy = true;
  try {
    const plant = await getCurrentPlant();
    const { client } = await getContext();
    const { data: events, error } = await client.from('planta_eventos').select('id,tipo,data,notas').eq('planta_id', plant.id).order('data', { ascending: false }).limit(30);
    if (error) throw error;
    area.innerHTML = '';
    area.dataset.uiTimelineV2 = '1';
    if (!events?.length) {
      area.innerHTML = '<div class="vazio">Nenhum evento registrado ainda.</div>';
      return;
    }
    events.forEach(item => {
      const [iconName, label] = PLANT_EVENT_INFO[item.tipo] || ['edit', item.tipo];
      const date = item.data ? new Date(item.data) : null;
      const row = document.createElement('article');
      row.className = 'ui-timeline-item';
      row.innerHTML = `
        <div class="ui-timeline-date">${date ? date.toLocaleDateString('pt-BR') : '—'}</div>
        <div class="ui-timeline-body">
          <div class="ui-timeline-title"><span class="ui-timeline-icon">${icon(iconName, 17)}</span><strong>${escapeHtml(label)}</strong></div>
          ${item.notas ? `<div class="ui-timeline-note">${escapeHtml(item.notas)}</div>` : ''}
        </div>
        <div class="ui-timeline-actions">
          ${(item.tipo === 'observacao' || item.notas) ? `<button type="button" class="ui-icon-button ui-event-edit" aria-label="Editar observação" title="Editar observação">${icon('edit')}</button>` : ''}
          <button type="button" class="ui-icon-button ui-delete ui-event-delete" aria-label="Excluir evento" title="Excluir evento">${icon('trash')}</button>
        </div>`;
      row.querySelector('.ui-event-edit')?.addEventListener('click', () => openPlantNoteSheet({ plantId: plant.id, eventId: item.id, initialValue: item.notas || '' }));
      row.querySelector('.ui-event-delete').addEventListener('click', () => openConfirmSheet({
        title: 'Excluir evento',
        message: 'Este registro será removido da linha do tempo da planta.',
        confirmLabel: 'Excluir evento',
        danger: true,
        onConfirm: async () => {
          const result = await client.from('planta_eventos').delete().eq('id', item.id);
          if (result.error) throw result.error;
          toast('Evento removido.');
          await renderPlantTimelineV2();
        },
      }));
      area.appendChild(row);
    });
  } catch (error) {
    area.innerHTML = `<div class="ui-history-error">${escapeHtml(error.message || 'Não foi possível carregar a linha do tempo.')}</div>`;
  } finally {
    plantTimelineBusy = false;
  }
}

function schedulePlantTimeline() {
  window.clearTimeout(plantTimelineTimer);
  plantTimelineTimer = window.setTimeout(renderPlantTimelineV2, 100);
}

function installPlantEnhancements() {
  document.addEventListener('click', async event => {
    const observationButton = event.target.closest('#mpAcoes button');
    if (observationButton && normalizeName(buttonLabel(observationButton)).includes('observacao')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      try {
        const plant = await getCurrentPlant();
        openPlantNoteSheet({ plantId: plant.id });
      } catch (error) { toast(error.message, 'erro', 5000); }
      return;
    }

    const careButton = event.target.closest('#mpAcoes button, #mpRotinas button');
    if (careButton) window.setTimeout(schedulePlantTimeline, 650);
  }, true);

  const modal = document.getElementById('modalPlanta');
  if (modal) {
    new MutationObserver(() => {
      if (modal.classList.contains('aberto')) schedulePlantTimeline();
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  }
}

function renderHeaderAvatar(profile) {
  const avatar = document.getElementById('headerAvatar');
  if (!avatar || !profile) return;
  avatar.setAttribute('aria-label', `Perfil de ${profile.nome}`);
  avatar.title = `Perfil de ${profile.nome}`;
  avatar.innerHTML = profile.avatar_url
    ? `<img src="${escapeHtml(profile.avatar_url)}" alt="Foto de ${escapeHtml(profile.nome)}">`
    : `<span>${escapeHtml(profile.nome?.charAt(0)?.toUpperCase() || '?')}</span>`;
}

function fileToSquareBlob(file, size = 512) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) { reject(new Error('Escolha uma imagem válida.')); return; }
    if (file.size > 12 * 1024 * 1024) { reject(new Error('Escolha uma imagem de até 12 MB.')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
      image.onload = () => {
        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
        const sx = (image.naturalWidth - sourceSize) / 2;
        const sy = (image.naturalHeight - sourceSize) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, size, size);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível preparar a imagem.')), 'image/webp', .84);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadAvatar(file) {
  if (!avatarSchemaAvailable) throw new Error('Execute a migração 020_avatar_perfil.sql no Supabase antes de enviar a foto.');
  const { client, profile } = await getContext();
  const blob = await fileToSquareBlob(file);
  const path = `${profile.auth_id}/avatar.webp`;
  const upload = await client.storage.from('avatares').upload(path, blob, { upsert: true, contentType: 'image/webp', cacheControl: '3600' });
  if (upload.error) throw upload.error;
  const publicData = client.storage.from('avatares').getPublicUrl(path).data;
  const url = `${publicData.publicUrl}?v=${Date.now()}`;
  const update = await client.from('usuarios').update({ avatar_url: url }).eq('id', profile.id);
  if (update.error) throw update.error;
  uiProfile = { ...profile, avatar_url: url };
  renderHeaderAvatar(uiProfile);
}

async function removeAvatar() {
  if (!avatarSchemaAvailable) return;
  const { client, profile } = await getContext();
  await client.storage.from('avatares').remove([`${profile.auth_id}/avatar.webp`]);
  const update = await client.from('usuarios').update({ avatar_url: null }).eq('id', profile.id);
  if (update.error) throw update.error;
  uiProfile = { ...profile, avatar_url: null };
  renderHeaderAvatar(uiProfile);
}

async function ensureProfileCard() {
  const section = document.querySelector('#secaoConfig .secao');
  if (!section || document.getElementById('uiProfileCard') || profileCardLoading) return;
  profileCardLoading = true;
  try {
    const { profile } = await getContext();
    renderHeaderAvatar(profile);
    const card = document.createElement('div');
    card.id = 'uiProfileCard';
    card.className = 'cartao ui-profile-card';
    card.innerHTML = `
      <div class="ui-profile-heading">Meu perfil</div>
      <div class="ui-profile-layout">
        <div class="ui-profile-preview">${profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="Foto de ${escapeHtml(profile.nome)}">` : `<span>${escapeHtml(profile.nome.charAt(0).toUpperCase())}</span>`}</div>
        <div class="ui-profile-info"><strong>${escapeHtml(profile.nome)}</strong><span>A foto aparece no cabeçalho do seu LifeOS.</span></div>
      </div>
      <input id="uiAvatarInput" type="file" accept="image/*" hidden>
      <div class="ui-profile-actions">
        <button type="button" id="uiChooseAvatar" class="ui-secondary">${icon('camera')}<span>${profile.avatar_url ? 'Trocar foto' : 'Escolher foto'}</span></button>
        ${profile.avatar_url ? `<button type="button" id="uiRemoveAvatar" class="ui-danger">Remover foto</button>` : ''}
      </div>
      ${avatarSchemaAvailable ? '' : '<div class="ui-profile-warning">Para enviar a foto, execute a migração 020_avatar_perfil.sql no Supabase.</div>'}`;
    section.insertBefore(card, section.firstElementChild);
    const input = card.querySelector('#uiAvatarInput');
    card.querySelector('#uiChooseAvatar').addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const button = card.querySelector('#uiChooseAvatar');
      button.disabled = true;
      try {
        await uploadAvatar(file);
        toast('Foto de perfil atualizada.');
        card.remove();
        await ensureProfileCard();
      } catch (error) {
        toast(error.message || 'Não foi possível enviar a foto.', 'erro', 6000);
        button.disabled = false;
      }
    });
    card.querySelector('#uiRemoveAvatar')?.addEventListener('click', () => openConfirmSheet({
      title: 'Remover foto',
      message: 'O avatar voltará a mostrar a inicial do seu nome.',
      confirmLabel: 'Remover foto',
      danger: true,
      onConfirm: async () => {
        await removeAvatar();
        toast('Foto removida.');
        card.remove();
        await ensureProfileCard();
      },
    }));
  } catch (error) {
    console.warn('LifeOS: não foi possível preparar o perfil.', error);
  } finally {
    profileCardLoading = false;
  }
}

function installProfileEnhancements() {
  window.setTimeout(async () => {
    try { const { profile } = await getContext(); renderHeaderAvatar(profile); }
    catch (_) {}
  }, 500);

  const section = document.getElementById('secaoConfig');
  if (section) {
    new MutationObserver(() => {
      if (isConfigVisible()) window.setTimeout(ensureProfileCard, 100);
    }).observe(section, { attributes: true, attributeFilter: ['class', 'style'] });
  }
}


function isVisible(element) {
  return Boolean(element && getComputedStyle(element).display !== 'none' && !element.classList.contains('oculto'));
}

function openCasaSubtab(destination, { remember = true } = {}) {
  if (!destination) return;
  if (remember) localStorage.setItem(LAST_SUBTAB_KEY, destination);
  window.trocarAba?.('casa');
  window.requestAnimationFrame(() => {
    window.trocarSub?.(destination, document.querySelector(`.sub-aba[data-sub="${destination}"]`));
    const button = document.querySelector(`.sub-aba[data-sub="${destination}"]`);
    if (button) centerActiveSubtab(button);
  });
}

function goToToday() {
  closeSheet();
  marketOverlay?.remove();
  marketOverlay = null;
  window.trocarAba?.('hoje');
  document.getElementById('appBody')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function syncBottomNavigationState() {
  const ritmoVisible = isVisible(document.getElementById('secaoRitmo'));
  if (ritmoVisible) {
    document.querySelectorAll('.tab-btn').forEach(button => button.classList.toggle('ativa', button.dataset.tab === 'ritmo'));
    return;
  }
  const moreSections = ['secaoProjetos', 'secaoRituais', 'secaoConfig', 'abaPainelProjeto'];
  const moreVisible = moreSections.some(id => isVisible(document.getElementById(id)));
  if (!moreVisible) return;
  document.querySelectorAll('.tab-btn').forEach(button => button.classList.toggle('ativa', button.dataset.tab === 'mais'));
}

function applyInputHints(root = document) {
  const decimalIds = ['ctValor','ecValor','hcValorRetro','estQtd','estMin','estTaxaConsumo','eeMin','eeTaxaConsumo','elQtd','refPorcoes','npRotinaI'];
  decimalIds.forEach(id => {
    const input = root.getElementById?.(id) || root.querySelector?.(`#${id}`);
    if (input instanceof HTMLInputElement) input.inputMode = 'decimal';
  });
  root.querySelectorAll?.('input[type="number"]').forEach(input => { input.inputMode = 'decimal'; });
}

function focusModal(modal) {
  window.setTimeout(() => {
    const target = modal.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
    target?.focus({ preventScroll: true });
  }, 180);
}

function installStableNavigation() {
  const logo = document.querySelector('.header-logo');
  if (logo) {
    logo.tabIndex = 0;
    logo.setAttribute('role', 'button');
    logo.setAttribute('aria-label', 'Voltar para a página inicial');
    logo.title = 'Voltar para Hoje';
  }

  document.addEventListener('click', event => {
    const logoTarget = event.target.closest('.header-logo');
    if (logoTarget) {
      event.preventDefault();
      goToToday();
      return;
    }

    // Deixe a Central Financeira tratar seus próprios controles.
    // Este listener roda em captura e, sem esta exceção, intercepta Pagar
    // antes que o módulo financeiro consiga abrir o modal.
    if (event.target.closest('#cfToday [data-cf-abrir], #cfToday [data-cf-ver-todas]')) return;

    const destinationTarget = event.target.closest('[data-ui-destination]');
    if (destinationTarget) {
      event.preventDefault();
      event.stopPropagation();
      const destination = destinationTarget.dataset.uiDestination;
      if (destination === 'financeiro') {
        if (typeof window.trocarAba === 'function') window.trocarAba('financeiro');
        else document.querySelector('.tab-btn[data-tab="financeiro"]')?.click();
      } else {
        openCasaSubtab(destination);
      }
      return;
    }

    const subtab = event.target.closest('.sub-aba[data-sub]');
    if (subtab) localStorage.setItem(LAST_SUBTAB_KEY, subtab.dataset.sub);

  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('#cfToday')) return;
    const target = event.target.closest('.header-logo, [data-ui-destination]');
    if (!target) return;
    event.preventDefault();
    if (target.classList.contains('header-logo')) goToToday();
    else if (target.dataset.uiDestination === 'financeiro') {
      if (typeof window.trocarAba === 'function') window.trocarAba('financeiro');
      else document.querySelector('.tab-btn[data-tab="financeiro"]')?.click();
    } else openCasaSubtab(target.dataset.uiDestination);
  });

  const appBody = document.getElementById('appBody');
  if (appBody) {
    new MutationObserver(() => {
      syncBottomNavigationState();
      makeMetricsInteractive();
      ensureMarketLauncher();
      ensureStockConferenceCard();
    }).observe(appBody, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
  }
}

function installModalAccessibility() {
  const observer = new MutationObserver(records => {
    records.forEach(record => {
      const modal = record.target;
      if (modal instanceof HTMLElement && modal.classList.contains('aberto')) {
        modal.dataset.uiDirty = '0';
        focusModal(modal);
      }
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(modal => observer.observe(modal, { attributes: true, attributeFilter: ['class'] }));

  document.addEventListener('input', event => {
    const modal = event.target.closest?.('.modal-overlay.aberto');
    if (modal && event.target.matches('input,select,textarea')) modal.dataset.uiDirty = '1';
  }, true);
  document.addEventListener('change', event => {
    const modal = event.target.closest?.('.modal-overlay.aberto');
    if (modal && event.target.matches('input,select,textarea')) modal.dataset.uiDirty = '1';
  }, true);

  document.addEventListener('click', event => {
    const close = event.target.closest?.('.modal-overlay.aberto .modal-fechar');
    if (!close) return;
    const modal = close.closest('.modal-overlay');
    if (modal?.dataset.uiDirty === '1' && !confirm('Deseja sair sem salvar as alterações?')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (document.querySelector('.ui-sheet-overlay')) { closeSheet(); return; }
    if (marketOverlay) { closeMarketMode(); return; }
    const open = [...document.querySelectorAll('.modal-overlay.aberto')].pop();
    if (!open) return;
    if (open.dataset.uiDirty === '1' && !confirm('Deseja sair sem salvar as alterações?')) return;
    open.dataset.uiDirty = '0';
    open.classList.remove('aberto');
  });
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function getMarketData(localId = null) {
  const { client, profile } = await getContext();
  const [itemsResult, stocksResult, locationsResult, destinationsResult] = await Promise.all([
    client.from('lista_compras')
      .select('id,nome,quantidade,unidade,categoria,estoque_id,criado_em,no_carrinho,preco_compra,aguardando_conferencia,destino_compra_id,compra_destinos(id,nome,tipo,entra_lista_mercado)')
      .eq('casa_id', profile.casa_id).eq('status', 'pendente').order('criado_em', { ascending: true }),
    client.from('estoque').select('id,nome,local,critico,tipo,quantidade,unidade,nivel').eq('casa_id', profile.casa_id),
    client.from('locais_compra').select('id,nome,ativo').eq('casa_id', profile.casa_id).eq('ativo', true).order('nome'),
    client.from('compra_destinos').select('id,nome,tipo,entra_lista_mercado,padrao,ativo,ordem').eq('casa_id', profile.casa_id).eq('ativo', true).order('ordem').order('nome'),
  ]);
  if (itemsResult.error) {
    if (/destino_compra_id|compra_destinos|compra_sessao_id/i.test(itemsResult.error.message || '')) {
      throw new Error('Execute a migração 023_compras_praticas.sql no Supabase.');
    }
    if (/no_carrinho|preco_compra|aguardando_conferencia/i.test(itemsResult.error.message || '')) {
      throw new Error('Execute a migração 022_lista_mercado.sql no Supabase.');
    }
    throw itemsResult.error;
  }
  if (stocksResult.error) throw stocksResult.error;
  marketStocksCache = stocksResult.data || [];
  marketLocationsCache = locationsResult.data || [];
  marketDestinationsCache = destinationsResult.data || [];
  marketCurrentLocal = localId ? marketLocationsCache.find(local => local.id === localId) || null : null;
  const byId = new Map(marketStocksCache.map(stock => [stock.id, stock]));
  const byName = new Map(marketStocksCache.map(stock => [normalizeName(stock.nome), stock]));
  marketItemsCache = (itemsResult.data || []).map(item => {
    const stock = byId.get(item.estoque_id) || byName.get(normalizeName(item.nome)) || null;
    const destination = item.compra_destinos || marketDestinationsCache.find(option => option.id === item.destino_compra_id) || null;
    const belongsToMarket = !destination || destination.entra_lista_mercado !== false;
    return { ...item, stock, destination, critical: Boolean(stock?.critico), compatible: belongsToMarket };
  }).filter(item => item.compatible)
    .sort((a, b) => Number(b.critical) - Number(a.critical) || a.nome.localeCompare(b.nome, 'pt-BR'));
  return marketItemsCache;
}

function closeMarketMode() {
  marketOverlay?.remove();
  marketOverlay = null;
  document.body.classList.remove('ui-modal-open');
}

function marketSummary(items) {
  const cart = items.filter(item => item.no_carrinho);
  const total = cart.reduce((sum, item) => sum + Number(item.preco_compra || 0), 0);
  const withoutPrice = cart.filter(item => item.preco_compra === null || item.preco_compra === undefined).length;
  return { cart, total, withoutPrice, pending: items.length - cart.length };
}

function marketItemMarkup(item, inCart) {
  const quantity = item.quantidade ? `${item.quantidade}${item.unidade ? ` ${item.unidade}` : ''}` : '';
  return `<article class="ui-market-item${inCart ? ' is-cart' : ''}" data-market-id="${item.id}">
    <button type="button" class="ui-market-toggle" data-market-action="${inCart ? 'remove' : 'add'}" aria-label="${inCart ? 'Retirar do carrinho' : 'Adicionar ao carrinho'}">
      ${inCart ? icon('check', 18) : ''}
    </button>
    <div class="ui-market-item-info">
      <div class="ui-market-item-name">${escapeHtml(item.nome)} ${item.critical ? '<span class="ui-market-critical">Crítico</span>' : ''}</div>
      <div class="ui-market-item-meta">${escapeHtml(quantity || item.stock?.local || 'Item da lista')}</div>
    </div>
    ${inCart ? `<button type="button" class="ui-market-price" data-market-action="price">${item.preco_compra == null ? 'Sem preço' : money(item.preco_compra)}</button>` : ''}
  </article>`;
}

function renderMarketMode() {
  if (!marketOverlay) return;
  const { cart, total, withoutPrice, pending } = marketSummary(marketItemsCache);
  const waiting = marketItemsCache.filter(item => !item.no_carrinho);
  marketOverlay.innerHTML = `
    <section class="ui-market-panel" role="dialog" aria-modal="true" aria-label="Lista do mercado">
      <header class="ui-market-header">
        <button type="button" class="ui-icon-button" data-market-action="close" aria-label="Fechar">${icon('back')}</button>
        <div class="ui-market-heading"><strong>${escapeHtml(marketCurrentLocal?.nome || 'Lista do mercado')}</strong><span>${pending} restantes · ${cart.length} no carrinho</span></div>
        <button type="button" class="ui-quiet ui-market-change" data-market-action="change">Trocar</button>
      </header>
      <div class="ui-market-total"><span>Total informado</span><strong>${money(total)}</strong><small>${withoutPrice ? `${withoutPrice} ${withoutPrice === 1 ? 'item sem preço' : 'itens sem preço'}` : 'Todos os itens com preço'}</small></div>
      <div class="ui-market-actions-top"><button type="button" class="ui-secondary" data-market-action="extra">${icon('plus')}<span>Adicionar item inesperado</span></button></div>
      <main class="ui-market-content">
        <section><h3>Para pegar</h3>${waiting.length ? waiting.map(item => marketItemMarkup(item, false)).join('') : '<div class="vazio">Tudo que estava na lista já foi para o carrinho.</div>'}</section>
        <section><h3>No carrinho</h3>${cart.length ? cart.map(item => marketItemMarkup(item, true)).join('') : '<div class="vazio">Nenhum item no carrinho ainda.</div>'}</section>
      </main>
      <footer class="ui-market-footer"><button type="button" class="ui-primary" data-market-action="finish" ${cart.length ? '' : 'disabled'}>${icon('check')}<span>Finalizar compra</span></button></footer>
    </section>`;
  enhanceUi(marketOverlay);
}

async function refreshMarketMode() {
  await getMarketData(marketCurrentLocal?.id || null);
  renderMarketMode();
}

function openMarketPriceSheet(item) {
  const editing = Boolean(item.no_carrinho);
  openSheet({
    title: item.nome,
    subtitle: 'O valor é opcional. Você pode informar depois ou deixar sem preço.',
    content: `<div class="campo"><label>Valor do item</label><input id="uiMarketPriceInput" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0,00" value="${item.preco_compra ?? ''}"></div>
      <div class="ui-sheet-actions"><button type="button" id="uiMarketSavePrice" class="ui-primary">${icon('cartCheck')}<span>${editing ? 'Atualizar item' : 'Adicionar ao carrinho'}</span></button><button type="button" id="uiMarketNoPrice" class="ui-secondary">Continuar sem preço</button><button type="button" id="uiMarketCancel" class="ui-quiet">Cancelar</button></div>`,
    onMount(sheet) {
      const input = sheet.querySelector('#uiMarketPriceInput');
      input.focus();
      const save = async price => {
        const { client } = await getContext();
        const result = await client.from('lista_compras').update({ no_carrinho: true, preco_compra: price }).eq('id', item.id);
        if (result.error) throw result.error;
        closeSheet();
        await refreshMarketMode();
      };
      sheet.querySelector('#uiMarketSavePrice').addEventListener('click', async event => {
        const button = event.currentTarget; button.disabled = true;
        try { await save(input.value === '' ? null : Number(input.value)); }
        catch (error) { toast(error.message, 'erro', 5000); button.disabled = false; }
      });
      sheet.querySelector('#uiMarketNoPrice').addEventListener('click', async event => {
        const button = event.currentTarget; button.disabled = true;
        try { await save(null); }
        catch (error) { toast(error.message, 'erro', 5000); button.disabled = false; }
      });
      sheet.querySelector('#uiMarketCancel').addEventListener('click', closeSheet);
    },
  });
}

function openUnexpectedMarketItemSheet() {
  openSheet({
    title: 'Adicionar item',
    subtitle: 'Para algo que você decidiu comprar e não estava na lista.',
    content: `<div class="campo"><label>Item</label><input id="uiUnexpectedName" type="text" placeholder="Ex.: biscoito"></div><div class="campo"><label>Valor — opcional</label><input id="uiUnexpectedPrice" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0,00"></div><div class="ui-sheet-actions"><button type="button" id="uiUnexpectedSave" class="ui-primary">${icon('plus')}<span>Adicionar ao carrinho</span></button><button type="button" id="uiUnexpectedCancel" class="ui-quiet">Cancelar</button></div>`,
    onMount(sheet) {
      const name = sheet.querySelector('#uiUnexpectedName');
      name.focus();
      sheet.querySelector('#uiUnexpectedCancel').addEventListener('click', closeSheet);
      sheet.querySelector('#uiUnexpectedSave').addEventListener('click', async event => {
        const itemName = name.value.trim();
        if (!itemName) { toast('Digite o nome do item.', 'erro'); return; }
        const button = event.currentTarget; button.disabled = true;
        try {
          const { client, profile } = await getContext();
          const priceInput = sheet.querySelector('#uiUnexpectedPrice').value;
          const marketDestination = marketDestinationsCache.find(option => option.entra_lista_mercado && option.padrao) || marketDestinationsCache.find(option => option.entra_lista_mercado) || null;
          const result = await client.from('lista_compras').insert({ casa_id: profile.casa_id, nome: itemName, status: 'pendente', origem: 'mercado', criado_por: profile.id, no_carrinho: true, preco_compra: priceInput === '' ? null : Number(priceInput), destino_compra_id: marketDestination?.id || null });
          if (result.error) throw result.error;
          closeSheet();
          await refreshMarketMode();
        } catch (error) { toast(error.message, 'erro', 5000); button.disabled = false; }
      });
    },
  });
}

async function removeMarketItemFromCart(item) {
  const { client } = await getContext();
  const result = await client.from('lista_compras').update({ no_carrinho: false, preco_compra: null }).eq('id', item.id);
  if (result.error) throw result.error;
  await refreshMarketMode();
}

function finishMarketPurchase() {
  const summary = marketSummary(marketItemsCache);
  if (!summary.cart.length) return;
  openConfirmSheet({
    title: 'Finalizar compra',
    message: `Finalizar ${summary.cart.length} ${summary.cart.length === 1 ? 'item' : 'itens'}${summary.withoutPrice ? `, com ${summary.withoutPrice} sem preço` : ''}?`,
    confirmLabel: 'Finalizar compra',
    onConfirm: async () => {
      const { client, profile } = await getContext();
      const ids = summary.cart.map(item => item.id);
      const sessionResult = await client.from('compras_sessoes').insert({
        casa_id: profile.casa_id,
        local_compra_id: marketCurrentLocal?.id || null,
        local_nome: marketCurrentLocal?.nome || 'Mercado não informado',
        usuario_id: profile.id,
        iniciada_em: new Date().toISOString(),
        finalizada_em: new Date().toISOString(),
        total_informado: summary.total,
        itens_sem_preco: summary.withoutPrice,
        quantidade_itens: summary.cart.length,
      }).select('id').single();
      if (sessionResult.error) throw sessionResult.error;
      const sessionId = sessionResult.data.id;
      const historyItems = summary.cart.map(item => ({
        sessao_id: sessionId,
        lista_compra_id: item.id,
        nome: item.nome,
        quantidade: item.quantidade || null,
        unidade: item.unidade || null,
        preco: item.preco_compra == null ? null : Number(item.preco_compra),
        destino_nome: item.destination?.nome || 'Mercado',
        estoque_id: item.estoque_id || item.stock?.id || null,
      }));
      const historyResult = await client.from('compras_sessao_itens').insert(historyItems);
      if (historyResult.error) throw historyResult.error;
      const result = await client.from('lista_compras').update({ status: 'comprado', no_carrinho: false, aguardando_conferencia: true, compra_sessao_id: sessionId, comprado_por: profile.id, comprado_em: new Date().toISOString() }).in('id', ids);
      if (result.error) throw result.error;
      closeMarketMode();
      toast('Compra finalizada. Você pode revisar o estoque depois.');
      ensureStockConferenceCard(true);
      ensurePurchaseHistoryLauncher(true);
    },
  });
}

async function openMarketMode(localId = null) {
  closeSheet();
  await getMarketData(localId);
  marketOverlay?.remove();
  marketOverlay = document.createElement('div');
  marketOverlay.className = 'ui-market-overlay';
  marketOverlay.addEventListener('click', async event => {
    const action = event.target.closest('[data-market-action]')?.dataset.marketAction;
    if (!action) return;
    if (action === 'close') { closeMarketMode(); return; }
    if (action === 'change') { closeMarketMode(); chooseMarketLocation(); return; }
    if (action === 'extra') { openUnexpectedMarketItemSheet(); return; }
    if (action === 'finish') { finishMarketPurchase(); return; }
    const row = event.target.closest('[data-market-id]');
    const item = marketItemsCache.find(candidate => candidate.id === row?.dataset.marketId);
    if (!item) return;
    if (action === 'add' || action === 'price') openMarketPriceSheet(item);
    if (action === 'remove') {
      try { await removeMarketItemFromCart(item); }
      catch (error) { toast(error.message, 'erro', 5000); }
    }
  });
  document.body.appendChild(marketOverlay);
  document.body.classList.add('ui-modal-open');
  renderMarketMode();
}

async function chooseMarketLocation() {
  try {
    const { client, profile } = await getContext();
    const { data, error } = await client.from('locais_compra').select('id,nome').eq('casa_id', profile.casa_id).eq('ativo', true).order('nome');
    if (error) throw error;
    const locations = data || [];
    openSheet({
      title: 'Lista do mercado',
      subtitle: 'Escolha onde você está para mostrar os itens compatíveis e os críticos.',
      content: `<div class="ui-market-location-list">${locations.map(location => `<button type="button" class="ui-market-location" data-location-id="${location.id}">${icon('cart')}<span>${escapeHtml(location.nome)}</span></button>`).join('')}${locations.length ? '' : '<div class="vazio">Nenhum mercado cadastrado.</div>'}<button type="button" class="ui-market-location ui-market-all" data-location-id="">${icon('task')}<span>Continuar sem informar o mercado</span></button></div>`,
      onMount(sheet) {
        sheet.querySelectorAll('[data-location-id]').forEach(button => button.addEventListener('click', async () => {
          const id = button.dataset.locationId || null;
          button.disabled = true;
          try { closeSheet(); await openMarketMode(id); }
          catch (error) { toast(error.message, 'erro', 6000); }
        }));
      },
    });
  } catch (error) { toast(error.message || 'Não foi possível abrir a lista do mercado.', 'erro', 6000); }
}

function ensureMarketLauncher() {
  const section = document.querySelector('#subCompras .secao');
  if (!section || document.getElementById('uiMarketLauncher')) return;
  const card = document.createElement('div');
  card.id = 'uiMarketLauncher';
  card.className = 'cartao ui-market-launcher';
  card.innerHTML = `<div><strong>Lista do mercado</strong><span>Marque os itens e informe os preços que souber.</span></div><button type="button" class="ui-secondary">${icon('cart')}<span>Abrir</span></button>`;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', 'Abrir Lista do Mercado');
  const abrirLista = event => {
    if (event?.type === 'click' && event.target.closest('button')) return;
    chooseMarketLocation();
  };
  card.addEventListener('click', abrirLista);
  card.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    chooseMarketLocation();
  });
  card.querySelector('button').addEventListener('click', event => {
    event.stopPropagation();
    chooseMarketLocation();
  });
  section.insertBefore(card, section.firstElementChild);
  enhanceUi(card);
}

async function getStockConferenceItems() {
  const { client, profile } = await getContext();
  const result = await client.from('lista_compras').select('id,nome,quantidade,unidade,estoque_id,preco_compra,comprado_em').eq('casa_id', profile.casa_id).eq('status', 'comprado').eq('aguardando_conferencia', true).order('comprado_em', { ascending: false });
  if (result.error) {
    if (/aguardando_conferencia/i.test(result.error.message || '')) return [];
    throw result.error;
  }
  return result.data || [];
}

async function markConferenceDone(itemId) {
  const { client } = await getContext();
  const result = await client.from('lista_compras').update({ aguardando_conferencia: false }).eq('id', itemId);
  if (result.error) throw result.error;
}

async function openConferenceItem(item, stock = null) {
  const { client, profile } = await getContext();
  const { data: locations } = await client.from('locais_estoque').select('nome').eq('casa_id', profile.casa_id).eq('ativo', true).order('ordem');
  let type = stock?.tipo || 'contavel';
  openSheet({
    title: item.nome,
    subtitle: stock ? 'Confirme quanto deve entrar no estoque.' : 'Crie um controle simples ou ignore este item.',
    content: stock ? `<div class="campo"><label>${stock.tipo === 'nivel_visual' ? 'Nível após a compra' : 'Quantidade que entrou'}</label>${stock.tipo === 'nivel_visual' ? '<select id="uiConferenceLevel"><option value="cheio">Cheio</option><option value="75">~75%</option><option value="metade">Metade</option></select>' : `<input id="uiConferenceQuantity" type="number" inputmode="decimal" min="0" step="any" value="${Number(item.quantidade) || 1}">`}</div><div class="ui-sheet-actions"><button type="button" id="uiConferenceConfirm" class="ui-primary">${icon('check')}<span>Atualizar estoque</span></button><button type="button" id="uiConferenceIgnore" class="ui-quiet">Não controlar esta compra</button></div>` : `<div class="ui-sheet-grid" role="group" aria-label="Tipo de controle"><button type="button" class="ui-choice ativo" data-conference-type="contavel">Unidades</button><button type="button" class="ui-choice" data-conference-type="peso_volume">Peso ou volume</button><button type="button" class="ui-choice" data-conference-type="nivel_visual">Nível visual</button></div><div id="uiConferenceFields"></div><div class="campo"><label>Local — opcional</label><select id="uiConferenceLocation"><option value="">Sem local</option>${(locations || []).map(location => `<option value="${escapeHtml(location.nome)}">${escapeHtml(location.nome)}</option>`).join('')}</select></div><div class="ui-sheet-actions"><button type="button" id="uiConferenceCreate" class="ui-primary">${icon('box')}<span>Criar no estoque</span></button><button type="button" id="uiConferenceIgnore" class="ui-quiet">Não controlar este item</button></div>`,
    onMount(sheet) {
      const finish = async callback => {
        await callback();
        await markConferenceDone(item.id);
        closeSheet();
        toast(`${item.nome} foi conferido.`);
        await openStockConference();
        ensureStockConferenceCard(true);
      };
      sheet.querySelector('#uiConferenceIgnore').addEventListener('click', async event => {
        const button = event.currentTarget; button.disabled = true;
        try { await finish(async () => {}); }
        catch (error) { toast(error.message, 'erro', 5000); button.disabled = false; }
      });
      if (stock) {
        sheet.querySelector('#uiConferenceConfirm').addEventListener('click', async event => {
          const button = event.currentTarget; button.disabled = true;
          try {
            await finish(async () => {
              const payload = stock.tipo === 'nivel_visual'
                ? { nivel: sheet.querySelector('#uiConferenceLevel').value, atualizado_por: profile.id, atualizado_em: new Date().toISOString() }
                : { quantidade: Number(stock.quantidade || 0) + (Number(sheet.querySelector('#uiConferenceQuantity').value) || 1), atualizado_por: profile.id, atualizado_em: new Date().toISOString() };
              const result = await client.from('estoque').update(payload).eq('id', stock.id);
              if (result.error) throw result.error;
            });
          } catch (error) { toast(error.message, 'erro', 5000); button.disabled = false; }
        });
      } else {
        const fields = sheet.querySelector('#uiConferenceFields');
        const renderFields = () => {
          fields.innerHTML = type === 'nivel_visual' ? '<div class="campo"><label>Nível atual</label><select id="uiConferenceNewLevel"><option value="cheio">Cheio</option><option value="75">~75%</option><option value="metade">Metade</option></select></div>' : `<div class="campo"><label>Quantidade</label><input id="uiConferenceNewQuantity" type="number" inputmode="decimal" min="0" step="any" value="${Number(item.quantidade) || 1}"></div><div class="campo"><label>Unidade</label><select id="uiConferenceNewUnit">${type === 'peso_volume' ? '<option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option>' : '<option value="un">un</option><option value="pacote">pacote</option><option value="caixa">caixa</option>'}</select></div>`;
        };
        renderFields();
        sheet.querySelectorAll('[data-conference-type]').forEach(button => button.addEventListener('click', () => {
          type = button.dataset.conferenceType;
          sheet.querySelectorAll('[data-conference-type]').forEach(choice => choice.classList.toggle('ativo', choice === button));
          renderFields();
        }));
        sheet.querySelector('#uiConferenceCreate').addEventListener('click', async event => {
          const button = event.currentTarget; button.disabled = true;
          try {
            await finish(async () => {
              const payload = { casa_id: profile.casa_id, nome: item.nome, tipo, local: sheet.querySelector('#uiConferenceLocation').value || null, critico: false, atualizado_por: profile.id };
              if (type === 'nivel_visual') Object.assign(payload, { nivel: sheet.querySelector('#uiConferenceNewLevel').value, minimo_nivel: '25', quantidade: 0, minimo: 0 });
              else Object.assign(payload, { quantidade: Number(sheet.querySelector('#uiConferenceNewQuantity').value) || 1, minimo: 1, unidade: sheet.querySelector('#uiConferenceNewUnit').value });
              const created = await client.from('estoque').insert(payload).select('id').single();
              if (created.error) throw created.error;
              await client.from('lista_compras').update({ estoque_id: created.data.id }).eq('id', item.id);
            });
          } catch (error) { toast(error.message, 'erro', 5000); button.disabled = false; }
        });
      }
    },
  });
}

async function openStockConference() {
  try {
    const items = await getStockConferenceItems();
    if (!items.length) { closeSheet(); toast('Não há compras aguardando conferência.'); return; }
    const { client, profile } = await getContext();
    const { data: stocks } = await client.from('estoque').select('*').eq('casa_id', profile.casa_id);
    const byId = new Map((stocks || []).map(stock => [stock.id, stock]));
    const byName = new Map((stocks || []).map(stock => [normalizeName(stock.nome), stock]));
    openSheet({
      title: 'Conferir compras',
      subtitle: 'A compra já terminou. Agora ajuste somente o que vale controlar no estoque.',
      content: `<div class="ui-conference-list">${items.map(item => { const stock = byId.get(item.estoque_id) || byName.get(normalizeName(item.nome)); return `<button type="button" class="ui-conference-item" data-conference-id="${item.id}"><span><strong>${escapeHtml(item.nome)}</strong><small>${stock ? `Ligado a ${escapeHtml(stock.nome)}` : 'Ainda não está no estoque'}</small></span>${icon('back')}</button>`; }).join('')}</div>`,
      onMount(sheet) {
        sheet.querySelectorAll('[data-conference-id]').forEach(button => button.addEventListener('click', () => {
          const item = items.find(candidate => candidate.id === button.dataset.conferenceId);
          const stock = byId.get(item.estoque_id) || byName.get(normalizeName(item.nome)) || null;
          openConferenceItem(item, stock);
        }));
      },
    });
  } catch (error) { toast(error.message || 'Não foi possível carregar a conferência.', 'erro', 6000); }
}

async function ensureStockConferenceCard(force = false) {
  const section = document.querySelector('#subEstoque .secao');
  if (!section || stockConferenceLoading) return;
  const existing = document.getElementById('uiStockConferenceCard');
  if (existing && !force) return;
  stockConferenceLoading = true;
  try {
    const items = await getStockConferenceItems();
    existing?.remove();
    if (!items.length) return;
    const card = document.createElement('div');
    card.id = 'uiStockConferenceCard';
    card.className = 'cartao ui-stock-conference-card';
    card.innerHTML = `<div><strong>${items.length} ${items.length === 1 ? 'compra aguarda' : 'compras aguardam'} conferência</strong><span>Ajuste o estoque com calma depois do mercado.</span></div><button type="button" class="ui-secondary">Conferir</button>`;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Abrir conferência das compras');
    card.addEventListener('click', openStockConference);
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openStockConference(); } });
    section.insertBefore(card, section.firstElementChild);
    enhanceUi(card);
  } catch (_) {
    existing?.remove();
  } finally { stockConferenceLoading = false; }
}


function openPurchaseDestinationPicker(item) {
  openSheet({
    title: 'Onde comprar',
    subtitle: item.nome,
    content: `<div class="ui-market-location-list">${marketDestinationsCache.filter(option => option.ativo !== false).map(option => `<button type="button" class="ui-market-location" data-purchase-destination="${option.id}">${icon(option.tipo === 'farmacia' ? 'bill' : option.tipo === 'mercado' ? 'cart' : 'folder')}<span>${escapeHtml(option.nome)}</span></button>`).join('')}</div>`,
    onMount(sheet) {
      sheet.querySelectorAll('[data-purchase-destination]').forEach(button => button.addEventListener('click', async () => {
        try {
          const { client } = await getContext();
          const result = await client.from('lista_compras').update({ destino_compra_id: button.dataset.purchaseDestination }).eq('id', item.id);
          if (result.error) throw result.error;
          closeSheet(); toast('Destino atualizado.'); await decoratePurchaseRows();
        } catch (error) { toast(error.message, 'erro', 5000); }
      }));
    },
  });
}

async function decoratePurchaseRows() {
  if (purchaseRowsDecorating) return;
  const container = document.getElementById('itens');
  if (!container || !uiProfile) return;
  purchaseRowsDecorating = true;
  try {
    const { client, profile } = await getContext();
    if (!marketDestinationsCache.length) {
      const destinations = await client.from('compra_destinos').select('*').eq('casa_id', profile.casa_id).eq('ativo', true).order('ordem').order('nome');
      marketDestinationsCache = destinations.data || [];
    }
    const result = await client.from('lista_compras')
      .select('id,nome,destino_compra_id,compra_destinos(nome,tipo)')
      .eq('casa_id', profile.casa_id).eq('status', 'pendente').order('criado_em', { ascending: false });
    if (result.error) return;
    const available = [...(result.data || [])];
    container.querySelectorAll('.item').forEach(row => {
      row.querySelector('.ui-purchase-destination')?.remove();
      const name = rowName(row);
      const index = available.findIndex(item => normalizeName(item.nome) === normalizeName(name));
      if (index < 0) return;
      const item = available.splice(index, 1)[0];
      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'ui-purchase-destination';
      badge.textContent = item.compra_destinos?.nome || 'Mercado';
      badge.setAttribute('aria-label', `Alterar destino de ${item.nome}`);
      badge.addEventListener('click', event => { event.stopPropagation(); openPurchaseDestinationPicker(item); });
      row.querySelector('.desc')?.appendChild(badge);
    });
  } finally { purchaseRowsDecorating = false; }
}

function destinationEditorContent(option = null) {
  return `<div class="campo"><label>Nome</label><input id="uiDestinationName" type="text" value="${escapeHtml(option?.nome || '')}" placeholder="Ex.: Pet shop"></div>
    <div class="campo"><label>Grupo</label><select id="uiDestinationType"><option value="mercado" ${option?.tipo === 'mercado' ? 'selected' : ''}>Mercado</option><option value="farmacia" ${option?.tipo === 'farmacia' ? 'selected' : ''}>Farmácia</option><option value="outros" ${option?.tipo === 'outros' ? 'selected' : ''}>Outros</option></select></div>
    <label class="toggle-label"><input id="uiDestinationMarket" type="checkbox" ${option?.entra_lista_mercado !== false ? 'checked' : ''}><span>Mostrar na Lista do Mercado</span></label>
    <label class="toggle-label"><input id="uiDestinationDefault" type="checkbox" ${option?.padrao ? 'checked' : ''}><span>Usar como opção padrão</span></label>
    <div class="ui-sheet-actions"><button type="button" id="uiDestinationSave" class="ui-primary">Salvar</button>${option ? '<button type="button" id="uiDestinationDeactivate" class="ui-danger">Desativar opção</button>' : ''}<button type="button" id="uiDestinationCancel" class="ui-quiet">Cancelar</button></div>`;
}

function openDestinationEditor(option = null) {
  openSheet({
    title: option ? 'Editar destino de compra' : 'Novo destino de compra',
    subtitle: 'As opções desativadas continuam preservadas nos registros antigos.',
    content: destinationEditorContent(option),
    onMount(sheet) {
      sheet.querySelector('#uiDestinationCancel').addEventListener('click', closeSheet);
      sheet.querySelector('#uiDestinationSave').addEventListener('click', async event => {
        const name = sheet.querySelector('#uiDestinationName').value.trim();
        if (!name) { toast('Digite um nome.', 'erro'); return; }
        const button = event.currentTarget; button.disabled = true;
        try {
          const { client, profile } = await getContext();
          const payload = { casa_id: profile.casa_id, nome: name, tipo: sheet.querySelector('#uiDestinationType').value, entra_lista_mercado: sheet.querySelector('#uiDestinationMarket').checked, padrao: sheet.querySelector('#uiDestinationDefault').checked, ativo: true };
          if (payload.padrao) await client.from('compra_destinos').update({ padrao: false }).eq('casa_id', profile.casa_id);
          const result = option ? await client.from('compra_destinos').update(payload).eq('id', option.id) : await client.from('compra_destinos').insert(payload);
          if (result.error) throw result.error;
          closeSheet(); toast('Opção salva.'); await ensurePurchaseOptionsSettings(true); decoratePurchaseRows();
        } catch (error) { toast(error.message, 'erro', 5000); button.disabled = false; }
      });
      sheet.querySelector('#uiDestinationDeactivate')?.addEventListener('click', async event => {
        const button = event.currentTarget; button.disabled = true;
        try {
          const { client } = await getContext();
          const result = await client.from('compra_destinos').update({ ativo: false, padrao: false }).eq('id', option.id);
          if (result.error) throw result.error;
          closeSheet(); toast('Opção desativada. Os registros antigos foram mantidos.'); await ensurePurchaseOptionsSettings(true);
        } catch (error) { toast(error.message, 'erro', 5000); button.disabled = false; }
      });
    },
  });
}

async function ensurePurchaseOptionsSettings(force = false) {
  const section = document.getElementById('secaoConfig');
  if (!section || section.dataset.purchaseOptionsLoading === '1') return;
  document.querySelectorAll('#uiPurchaseOptionsSettings').forEach((duplicate, index) => {
    if (index > 0) duplicate.remove();
  });
  let card = document.getElementById('uiPurchaseOptionsSettings');
  if (card && !force) return;
  section.dataset.purchaseOptionsLoading = '1';
  try {
    const { client, profile } = await getContext();
    const result = await client.from('compra_destinos').select('*').eq('casa_id', profile.casa_id).order('ativo', { ascending: false }).order('ordem').order('nome');
    if (result.error) return;
    card?.remove();
    card = document.createElement('div');
    card.id = 'uiPurchaseOptionsSettings';
    card.className = 'cartao ui-settings-card';
    card.innerHTML = `<div class="ui-settings-card-head"><div><strong>Destinos de compra</strong><span>Defina o que aparece na Lista do Mercado.</span></div><button type="button" class="ui-secondary" data-destination-new>${icon('plus')}<span>Novo</span></button></div><div class="ui-destination-list">${(result.data || []).map(option => `<button type="button" class="ui-destination-row${option.ativo ? '' : ' is-inactive'}" data-destination-id="${option.id}"><span><strong>${escapeHtml(option.nome)}</strong><small>${option.entra_lista_mercado ? 'Aparece na Lista do Mercado' : option.tipo === 'farmacia' ? 'Farmácia' : 'Fora da Lista do Mercado'}${option.padrao ? ' · padrão' : ''}${option.ativo ? '' : ' · desativado'}</small></span>${icon('edit')}</button>`).join('')}</div>`;
    const configContent = section.querySelector(':scope > .secao') || section.querySelector('.secao');
    if (!configContent) return;
    configContent.appendChild(card);
    card.querySelector('[data-destination-new]').addEventListener('click', () => openDestinationEditor());
    card.querySelectorAll('[data-destination-id]').forEach(button => button.addEventListener('click', () => openDestinationEditor((result.data || []).find(option => option.id === button.dataset.destinationId))));
    enhanceUi(card);
  } catch (_) {
  } finally {
    delete section.dataset.purchaseOptionsLoading;
  }
}

function purchaseHistoryMarkup(session) {
  const date = new Date(session.finalizada_em || session.criado_em);
  return `<button type="button" class="ui-purchase-history-row" data-session-id="${session.id}"><span><strong>${escapeHtml(session.local_nome || 'Compra')}</strong><small>${date.toLocaleDateString('pt-BR')} · ${session.quantidade_itens || 0} itens${session.itens_sem_preco ? ` · ${session.itens_sem_preco} sem preço` : ''}</small></span><b>${money(session.total_informado)}</b></button>`;
}

async function openPurchaseHistory() {
  try {
    const { client, profile } = await getContext();
    const sessions = await client.from('compras_sessoes').select('*').eq('casa_id', profile.casa_id).order('finalizada_em', { ascending: false }).limit(50);
    if (sessions.error) throw sessions.error;
    openSheet({
      title: 'Histórico de compras',
      subtitle: 'Valores informados durante as compras.',
      content: `<div class="ui-purchase-history-list">${sessions.data?.length ? sessions.data.map(purchaseHistoryMarkup).join('') : '<div class="vazio">Nenhuma compra finalizada ainda.</div>'}</div>`,
      onMount(sheet) {
        sheet.querySelectorAll('[data-session-id]').forEach(button => button.addEventListener('click', async () => {
          const session = sessions.data.find(item => item.id === button.dataset.sessionId);
          const items = await client.from('compras_sessao_itens').select('*').eq('sessao_id', session.id).order('criado_em');
          if (items.error) { toast(items.error.message, 'erro'); return; }
          openSheet({ title: session.local_nome || 'Compra', subtitle: new Date(session.finalizada_em).toLocaleString('pt-BR'), content: `<div class="ui-purchase-history-items">${(items.data || []).map(item => `<div><span>${escapeHtml(item.nome)}</span><b>${item.preco == null ? 'Sem preço' : money(item.preco)}</b></div>`).join('')}</div><div class="ui-history-total"><span>Total informado</span><strong>${money(session.total_informado)}</strong></div>` });
        }));
      },
    });
  } catch (error) { toast(error.message || 'Não foi possível abrir o histórico.', 'erro', 5000); }
}

async function ensurePurchaseHistoryLauncher(force = false) {
  const section = document.querySelector('#subCompras .secao');
  if (!section) return;
  let card = document.getElementById('uiPurchaseHistoryLauncher');
  if (card && !force) return;
  card?.remove();
  card = document.createElement('div');
  card.id = 'uiPurchaseHistoryLauncher';
  card.className = 'cartao ui-purchase-history-launcher';
  card.tabIndex = 0; card.setAttribute('role','button');
  card.innerHTML = `<div><strong>Histórico de compras</strong><span>Consulte as idas e os valores informados.</span></div>${icon('back')}`;
  card.addEventListener('click', openPurchaseHistory);
  card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPurchaseHistory(); } });
  const launcher = document.getElementById('uiMarketLauncher');
  if (launcher) launcher.after(card); else section.prepend(card);
}

function installMarketAndConference() {
  ensureMarketLauncher();
  ensurePurchaseHistoryLauncher();
  ensureStockConferenceCard();
  ensurePurchaseOptionsSettings();
  decoratePurchaseRows();
  document.addEventListener('click', event => {
    if (event.target.closest('.sub-aba[data-sub="compras"]')) window.setTimeout(() => { ensureMarketLauncher(); ensurePurchaseHistoryLauncher(); decoratePurchaseRows(); }, 80);
    if (event.target.closest('.sub-aba[data-sub="estoque"]')) window.setTimeout(() => ensureStockConferenceCard(true), 120);
  });
}

function installPeriodicEnhancements() {
  let attempts = 0;
  const timer = window.setInterval(() => {
    enhanceUi();
    enhanceMoreMenu();
    makeMetricsInteractive();
    ensureMarketLauncher();
    ensurePurchaseHistoryLauncher();
    ensureStockConferenceCard();
    ensurePurchaseOptionsSettings();
    decoratePurchaseRows();
    syncBottomNavigationState();
    if (isConfigVisible()) ensureProfileCard();
    if (document.getElementById('modalPlanta')?.classList.contains('aberto')) schedulePlantTimeline();
    attempts += 1;
    if (attempts > 14) window.clearInterval(timer);
  }, 500);
}

function init() {
  loadStyles();
  enhanceUi();
  installUiObserver();
  installModalManager();
  installModalAccessibility();
  installStableNavigation();
  installSubtabScrolling();
  installDeletionGuard();
  installPurchaseFlow();
  installHistoryWatcher();
  installPlantEnhancements();
  installProfileEnhancements();
  installMarketAndConference();
  installPeriodicEnhancements();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();


