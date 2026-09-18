// LifeOS — Configurações financeiras pessoais.
// Owner único de #lifeosFinanceiroConfig.

import { icon } from './ui/icons.js';

const FC = { client: null, profile: null, config: null, contas: [], loading: false };

const el = id => document.getElementById(id);
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function context() {
  const ctx = window.lifeosContext;
  if (!ctx?.supa || !ctx?.usuario) return false;
  FC.client = ctx.supa;
  FC.profile = ctx.usuario;
  return true;
}

function toast(message, type = 'ok') {
  if (typeof window.lifeosToast === 'function') window.lifeosToast(message, type);
}

function syncDate(value) {
  if (!value) return 'Ainda não sincronizada';
  return 'Atualizada em ' + new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

async function load() {
  if (FC.loading || !context()) return;
  FC.loading = true;
  try {
    const uid = FC.profile.id;
    const [configR, contasR] = await Promise.all([
      FC.client.from('financeiro_pessoal_config').select('*').eq('usuario_id', uid).maybeSingle(),
      FC.client.from('financeiro_open_finance_contas').select('*').eq('usuario_id', uid).order('nome'),
    ]);
    if (configR.error) throw configR.error;
    if (contasR.error) throw contasR.error;
    FC.config = configR.data || {
      usuario_id: uid,
      renda_mensal_referencia: null,
      proxima_renda: null,
      margem_seguranca: 0,
      vr_mensal_referencia: 0,
      vr_reservado_terceiros: 0,
    };
    FC.contas = contasR.data || [];
    render();
  } catch (error) {
    console.error('[Config Financeiro]', error);
    const mount = el('lifeosFinanceiroConfig');
    if (mount) mount.innerHTML = '<div class="fc-card"><strong>Não foi possível carregar as configurações financeiras.</strong></div>';
  } finally {
    FC.loading = false;
  }
}

function accountValue(conta) {
  if (conta.tipo === 'credit_card') {
    const available = conta.limite_disponivel != null
      ? Number(conta.limite_disponivel)
      : Number(conta.limite_credito || 0) - Number(conta.saldo_atual || 0);
    return { value: Math.max(0, available), label: 'limite disponível' };
  }
  return { value: Number(conta.saldo_atual || 0), label: 'saldo' };
}

function renderAccounts() {
  if (!FC.contas.length) {
    return '<div class="fc-empty"><strong>Nenhuma conta sincronizada ainda.</strong><p>As conexões que já existem no Meu Pluggy podem ser importadas sem recadastrar banco ou cartão.</p></div>';
  }

  return '<div class="fc-account-list">' + FC.contas.map(conta => {
    const value = accountValue(conta);
    return `<article class="fc-account" data-fc-account="${conta.id}">
      <span class="fc-account-icon">${icon(conta.tipo === 'credit_card' ? 'creditCard' : 'bank', 17)}</span>
      <span class="fc-account-copy"><strong>${esc(conta.nome)}</strong><small>${esc(syncDate(conta.sincronizado_em))}</small></span>
      <span class="fc-account-value"><strong>${money(value.value)}</strong><small>${value.label}</small></span>
      <label class="fc-toggle"><input type="checkbox" data-fc-visible ${conta.visivel ? 'checked' : ''}><span>Mostrar</span></label>
      <label class="fc-toggle"><input type="checkbox" data-fc-available ${conta.considerar_disponivel ? 'checked' : ''} ${!conta.visivel ? 'disabled' : ''}><span>Usar no disponível</span></label>
    </article>`;
  }).join('') + '</div>';
}

function render() {
  const mount = el('lifeosFinanceiroConfig');
  if (!mount) return;
  const c = FC.config || {};
  mount.innerHTML = `
    <section class="fc-card">
      <header class="fc-head"><span class="fc-icon">${icon('settings', 18)}</span><div><strong>Finanças pessoais</strong><small>Valores de referência e regras do “quanto posso gastar”.</small></div></header>
      <form class="fc-form" data-fc-config-form>
        <label><span>Renda mensal de referência</span><input name="renda" inputmode="decimal" value="${c.renda_mensal_referencia ?? ''}" placeholder="0,00"></label>
        <label><span>Próxima renda</span><input name="proxima_renda" type="date" value="${c.proxima_renda || ''}"></label>
        <label><span>Margem de segurança</span><input name="margem" inputmode="decimal" value="${c.margem_seguranca ?? 0}"></label>
        <label><span>VR mensal</span><input name="vr_mensal" inputmode="decimal" value="${c.vr_mensal_referencia ?? 0}"></label>
        <label><span>VR destinado a terceiros</span><input name="vr_reservado" inputmode="decimal" value="${c.vr_reservado_terceiros ?? 0}"></label>
        <button type="submit" class="lifeos-btn lifeos-btn--primary">Salvar finanças</button>
      </form>
    </section>

    <section class="fc-card">
      <header class="fc-head fc-head--action">
        <span class="fc-icon">${icon('swap', 18)}</span>
        <div><strong>Open Finance</strong><small>Escolha quais contas conectadas aparecem no LifeOS.</small></div>
        <button type="button" class="lifeos-btn lifeos-btn--secondary" data-fc-sync>Sincronizar</button>
      </header>
      ${renderAccounts()}
      <p class="fc-note">Conectar um banco novo continua sendo feito no Meu Pluggy por enquanto. Depois da conexão, o LifeOS encontra a conta na próxima sincronização.</p>
    </section>`;

  bind(mount);
}

function numeric(value) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

async function saveConfig(form) {
  const data = new FormData(form);
  const payload = {
    usuario_id: FC.profile.id,
    renda_mensal_referencia: data.get('renda') ? numeric(data.get('renda')) : null,
    proxima_renda: data.get('proxima_renda') || null,
    margem_seguranca: numeric(data.get('margem')),
    vr_mensal_referencia: numeric(data.get('vr_mensal')),
    vr_reservado_terceiros: numeric(data.get('vr_reservado')),
    atualizado_em: new Date().toISOString(),
  };
  const result = await FC.client.from('financeiro_pessoal_config').upsert(payload, { onConflict: 'usuario_id' });
  if (result.error) throw result.error;
  toast('Configurações financeiras salvas.');
  window.dispatchEvent(new CustomEvent('lifeos:financeiro-config-atualizada'));
  await load();
}

async function syncOpenFinance(button) {
  button.disabled = true;
  try {
    const session = await FC.client.auth.getSession();
    const accessToken = session.data?.session?.access_token;
    if (!accessToken) throw new Error('Sessão indisponível.');

    const response = await fetch('/api/financeiro/open-finance/sincronizar', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.erro || 'Falha na sincronização.');

    toast(data.contas
      ? `${data.contas} conta${data.contas === 1 ? '' : 's'} sincronizada${data.contas === 1 ? '' : 's'}.`
      : 'Open Finance atualizado.');
    window.dispatchEvent(new CustomEvent('lifeos:open-finance-atualizado', { detail: data }));
    await load();
  } catch (error) {
    console.error('[Config Financeiro][Open Finance]', error);
    toast(error.message || 'Não foi possível sincronizar.', 'erro');
  } finally {
    button.disabled = false;
  }
}

async function updateAccount(article, changed) {
  const id = article.dataset.fcAccount;
  const visible = article.querySelector('[data-fc-visible]');
  const available = article.querySelector('[data-fc-available]');
  if (!id || !visible || !available) return;

  if (changed === visible && !visible.checked) {
    available.checked = false;
    available.disabled = true;
  } else if (visible.checked) {
    available.disabled = false;
  }

  const result = await FC.client
    .from('financeiro_open_finance_contas')
    .update({
      visivel: visible.checked,
      considerar_disponivel: visible.checked && available.checked,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('usuario_id', FC.profile.id);

  if (result.error) {
    toast('Não foi possível alterar essa conta.', 'erro');
    await load();
    return;
  }
  window.dispatchEvent(new CustomEvent('lifeos:open-finance-atualizado'));
}

function bind(mount) {
  mount.querySelector('[data-fc-config-form]')?.addEventListener('submit', async event => {
    event.preventDefault();
    try { await saveConfig(event.currentTarget); }
    catch (error) {
      console.error('[Config Financeiro]', error);
      toast('Não foi possível salvar as configurações.', 'erro');
    }
  });

  mount.querySelector('[data-fc-sync]')?.addEventListener('click', event => syncOpenFinance(event.currentTarget));
  mount.querySelectorAll('.fc-account').forEach(article => {
    article.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', () => updateAccount(article, input));
    });
  });
}

window.addEventListener('lifeos:ready', load);
window.addEventListener('lifeos:open-finance-atualizado', () => window.setTimeout(load, 50));
window.addEventListener('lifeos:financeiro-config-atualizada', () => window.setTimeout(load, 50));

if (window.lifeosContext) load();
