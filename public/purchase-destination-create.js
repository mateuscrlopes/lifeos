// Seletor visual de destino no cadastro rápido de Compras.
// O salvamento é feito pela função adicionar() do app.js.

let destinationClient = null;
let destinationProfile = null;
let destinationObserverBusy = false;

async function getPurchaseDestinationContext() {
  if (destinationClient && destinationProfile) {
    return { client: destinationClient, profile: destinationProfile };
  }

  const response = await fetch('/config');
  if (!response.ok) throw new Error('Não foi possível carregar a configuração do LifeOS.');

  const config = await response.json();
  destinationClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

  const { data: sessionData } = await destinationClient.auth.getSession();
  const session = sessionData?.session;
  if (!session) throw new Error('Faça login novamente para continuar.');

  const profileResult = await destinationClient
    .from('usuarios')
    .select('id,casa_id')
    .eq('auth_id', session.user.id)
    .single();

  if (profileResult.error || !profileResult.data) {
    throw new Error('Perfil do LifeOS não encontrado.');
  }

  destinationProfile = profileResult.data;
  return { client: destinationClient, profile: destinationProfile };
}

function destinationEscapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function ensurePurchaseDestinationStyles() {
  if (document.getElementById('purchaseDestinationCreateStyles')) return;

  const style = document.createElement('style');
  style.id = 'purchaseDestinationCreateStyles';
  style.textContent = `
    .ui-purchase-create-destination{
      margin-top:10px;
      display:flex;
      align-items:center;
      gap:8px;
    }
    .ui-purchase-create-destination label{
      font-size:12px;
      color:var(--muted);
      font-weight:700;
      white-space:nowrap;
    }
    .ui-purchase-create-destination select{
      flex:1;
      min-width:0;
      padding:10px 12px;
      border:1.5px solid var(--linha);
      border-radius:var(--r-sm);
      background:var(--bg);
      color:var(--texto);
      font:inherit;
    }
    .ui-purchase-create-destination select:focus{
      outline:none;
      border-color:var(--sage);
      background:var(--paper);
    }
  `;
  document.head.appendChild(style);
}

async function loadPurchaseDestinations(select) {
  if (!select || select.dataset.loading === '1') return;
  select.dataset.loading = '1';

  try {
    const { client, profile } = await getPurchaseDestinationContext();
    const result = await client
      .from('compra_destinos')
      .select('id,nome,padrao,ativo,ordem')
      .eq('casa_id', profile.casa_id)
      .eq('ativo', true)
      .order('ordem')
      .order('nome');

    if (result.error) throw result.error;

    const options = result.data || [];
    const previousValue = select.value;

    select.innerHTML = options.map(option =>
      `<option value="${option.id}"${option.padrao ? ' selected' : ''}>${destinationEscapeHtml(option.nome)}</option>`
    ).join('');

    if (previousValue && options.some(option => option.id === previousValue)) {
      select.value = previousValue;
    }

    select.disabled = !options.length;
  } catch (error) {
    select.innerHTML = '<option value="">Destino indisponível</option>';
    select.disabled = true;
    console.warn('[LifeOS] Destinos de compra:', error);
  } finally {
    delete select.dataset.loading;
  }
}

function ensurePurchaseDestinationSelect() {
  if (destinationObserverBusy) return;
  destinationObserverBusy = true;

  try {
    const input = document.getElementById('novoItem');
    const button = document.getElementById('btnAdd');
    if (!input || !button) return;

    let select = document.getElementById('novoItemDestino');
    if (select) return;

    ensurePurchaseDestinationStyles();

    const row = input.closest('.linha-add') || input.parentElement;
    const wrapper = document.createElement('div');
    wrapper.className = 'ui-purchase-create-destination';
    wrapper.innerHTML = `
      <label for="novoItemDestino">Onde comprar</label>
      <select id="novoItemDestino" aria-label="Destino da compra">
        <option value="">Carregando...</option>
      </select>
    `;

    row.insertAdjacentElement('afterend', wrapper);
    select = wrapper.querySelector('#novoItemDestino');
    loadPurchaseDestinations(select);
  } finally {
    destinationObserverBusy = false;
  }
}

function initPurchaseDestinationCreate() {
  ensurePurchaseDestinationSelect();

  const observer = new MutationObserver(() => ensurePurchaseDestinationSelect());
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', event => {
    if (!event.target.closest('.sub-aba[data-sub="compras"]')) return;
    window.setTimeout(() => {
      ensurePurchaseDestinationSelect();
      loadPurchaseDestinations(document.getElementById('novoItemDestino'));
    }, 100);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPurchaseDestinationCreate, { once: true });
} else {
  initPurchaseDestinationCreate();
}
