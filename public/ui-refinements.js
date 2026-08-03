// LifeOS — camada de refinamento mobile v1
// Carregada como efeito colateral por status-estoque.js.

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.5L21 8H7"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  leaf: '<path d="M12 22V12M12 12C12 12 8 10 6 7c-1-1.5-1-4 2-4s4 3 4 3M12 12c0 0 4-2 6-5 1-1.5 1-4-2-4s-4 3-4 3"/>',
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

function loadStyles() {
  if (document.querySelector('link[data-lifeos-refinements]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/ui-refinements.css?v=1';
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
  const { data: profile, error } = await uiClient
    .from('usuarios')
    .select('id,nome,casa_id')
    .eq('auth_id', session.user.id)
    .single();
  if (error || !profile) throw new Error('Perfil do LifeOS não encontrado.');
  uiProfile = profile;
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
  document.querySelector('.ui-sheet-overlay')?.remove();
  updateBodyModalState();
}

function openSheet({ title, subtitle = '', content = '', onMount }) {
  closeSheet();
  const overlay = document.createElement('div');
  overlay.className = 'ui-sheet-overlay';
  overlay.innerHTML = `
    <section class="ui-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="ui-sheet-handle"></div>
      <div class="ui-sheet-head">
        <div>
          <div class="ui-sheet-title">${escapeHtml(title)}</div>
          ${subtitle ? `<div class="ui-sheet-sub">${escapeHtml(subtitle)}</div>` : ''}
        </div>
        <button type="button" class="ui-icon-button ui-sheet-close" aria-label="Fechar">${icon('close')}</button>
      </div>
      <div class="ui-sheet-body">${content}</div>
    </section>`;
  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeSheet();
  });
  overlay.querySelector('.ui-sheet-close').addEventListener('click', closeSheet);
  document.body.appendChild(overlay);
  document.body.classList.add('ui-modal-open');
  onMount?.(overlay.querySelector('.ui-sheet'));
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
  return (button.textContent || '').replace(/\s+/g, ' ').trim();
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
  const label = buttonLabel(button);
  const title = (button.title || '').toLowerCase();

  if (button.classList.contains('modal-fechar')) {
    button.classList.add('ui-icon-button');
    button.setAttribute('aria-label', 'Fechar');
    setButtonContent(button, 'close');
    return;
  }

  if (title.includes('editar') || button.id?.startsWith('btnEdit')) {
    button.classList.add('ui-icon-button');
    button.setAttribute('aria-label', button.title || 'Editar');
    setButtonContent(button, 'edit');
    return;
  }

  if ((label === '×' || label === '✕') && !button.closest('.linha-ingrediente')) {
    button.classList.add('ui-icon-button', 'ui-delete');
    button.setAttribute('aria-label', 'Excluir');
    setButtonContent(button, 'trash');
    return;
  }

  if (label === '×' && button.closest('.linha-ingrediente')) {
    button.classList.add('ui-icon-button', 'ui-delete');
    button.setAttribute('aria-label', 'Remover ingrediente');
    setButtonContent(button, 'close');
    return;
  }

  if (/^(Comprei|Paguei|Cuidar|Concluir|Entrar|Salvar|Adicionar|Iniciar)/i.test(label)) {
    button.classList.add('ui-primary');
    if (label === 'Comprei') setButtonContent(button, 'check', 'Comprei');
    else if (label === 'Paguei') setButtonContent(button, 'check', 'Paguei');
    return;
  }

  if (/^(Editar ficha|Gerar lista|Criar tarefa|Restaurar|Reativar|Inventário|Iniciar inventário)/i.test(label)) {
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
  root.querySelectorAll?.('.sub-abas, .filtros-plantas').forEach(el => el.classList.add('ui-scroll-fade'));
  const addButton = document.getElementById('btnAdd');
  if (addButton) {
    addButton.classList.add('ui-primary');
    addButton.setAttribute('aria-label', 'Adicionar à lista');
    setButtonContent(addButton, 'plus');
  }
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
  const name = rowName(row);
  if (!name) throw new Error('Não foi possível identificar o item selecionado.');
  const { client, profile } = await getContext();
  let query = client.from(config.table).select(config.select).eq(config.nameField, name);
  if (module !== 'refeicoes' && module !== 'rituais') query = query.eq('casa_id', profile.casa_id);
  else query = query.eq('casa_id', profile.casa_id);
  const { data: records, error } = await query.limit(1);
  if (error || !records?.length) throw new Error(`Não foi possível localizar “${name}”.`);
  const record = records[0];
  const accepted = window.confirm(`Excluir “${name}”?\n\nO item ficará disponível no Histórico para restauração.`);
  if (!accepted) return;
  await recordHistory(module, record.id, record);
  const { error: deleteError } = await client.from(config.table).delete().eq('id', record.id);
  if (deleteError) throw new Error(deleteError.message);
  row.remove();
  toast(`${name} foi movido para o Histórico.`);
  if (isConfigVisible()) await loadHistory();
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
    ['#itensContas', 'contas'],
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
  return button.classList.contains('ui-delete') || label === '×' || aria.includes('excluir') || aria.includes('remover');
}

function installDeletionGuard() {
  document.addEventListener('click', async event => {
    const button = event.target.closest('button');
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

function installHistoryWatcher() {
  const section = document.getElementById('secaoConfig');
  if (!section) return;
  const observer = new MutationObserver(() => {
    if (isConfigVisible()) { window.setTimeout(loadHistory, 120); window.setTimeout(loadHistory, 700); }
  });
  observer.observe(section, { attributes: true, attributeFilter: ['class', 'style'] });
  document.addEventListener('click', event => {
    if (event.target.closest('[onclick*="config"], .tab-btn[data-tab="mais"]')) {
      window.setTimeout(() => { if (isConfigVisible()) loadHistory(); }, 250);
      window.setTimeout(() => { if (isConfigVisible()) loadHistory(); }, 850);
    }
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
    if (!button || buttonLabel(button) !== 'Comprei') return;
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

function makeMetricsInteractive() {
  const destinations = ['tarefas', 'contas', 'compras', 'estoque'];
  document.querySelectorAll('#metricasHoje .metrica').forEach((metric, index) => {
    if (metric.dataset.uiInteractive) return;
    metric.dataset.uiInteractive = '1';
    metric.tabIndex = 0;
    metric.setAttribute('role', 'button');
    const open = () => {
      window.trocarAba?.('casa');
      window.trocarSub?.(destinations[index], null);
    };
    metric.addEventListener('click', open);
    metric.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') open(); });
  });
}

function installPeriodicEnhancements() {
  let attempts = 0;
  const timer = window.setInterval(() => {
    enhanceUi();
    enhanceMoreMenu();
    makeMetricsInteractive();
    attempts += 1;
    if (attempts > 30) window.clearInterval(timer);
  }, 350);
}

function init() {
  loadStyles();
  enhanceUi();
  installUiObserver();
  installModalManager();
  installDeletionGuard();
  installPurchaseFlow();
  installHistoryWatcher();
  installPeriodicEnhancements();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
