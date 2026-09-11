// LifeOS — Central de Notificações v2
// Dono único do sino. Une notificações financeiras e de tarefas, oferece ações
// reais ao toque e mostra lembrete contextual de tarefas na abertura do app.

(() => {
  'use strict';

  window.lifeosNotificationsV2 = { ownsBell: true };

  const N = { client: null, profile: null, channel: null, loading: false, notifications: [] };

  function esc(value = '') {
    return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }

  function localDate() {
    const d = new Date();
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function context() {
    const ctx = window.lifeosContext;
    if (!ctx?.supa || !ctx?.usuario) return null;
    N.client = ctx.supa; N.profile = ctx.usuario;
    return { client: N.client, profile: N.profile };
  }

  function installStyles() {
    if (document.getElementById('notificationsV2Styles')) return;
    const style = document.createElement('style');
    style.id = 'notificationsV2Styles';
    style.textContent = `
      #acBell.ac-bell{position:relative;width:40px;height:40px;min-width:40px;border:0;border-radius:12px;background:transparent;color:var(--texto);display:grid;place-items:center;padding:0}
      #acBell.ac-bell svg{width:21px;height:21px}.ac-bell-badge{position:absolute;right:2px;top:2px;min-width:17px;height:17px;padding:0 4px;border-radius:99px;background:var(--perigo,#b23c3c);color:#fff;font-size:9px;font-weight:800;place-items:center}
      .ntf-overlay{position:fixed;inset:0;z-index:620;background:rgba(17,24,19,.58);display:flex;align-items:flex-end;justify-content:center}.ntf-panel{width:min(100%,560px);max-height:88dvh;overflow:auto;background:var(--paper);border-radius:24px 24px 0 0;padding:18px 18px calc(22px + env(safe-area-inset-bottom));color:var(--texto)}
      .ntf-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.ntf-head h2{margin:0;font-size:21px}.ntf-head-actions{display:flex;gap:7px}.ntf-head button{border:0;border-radius:10px;background:var(--bg);color:var(--texto);padding:9px 11px;font-size:11px;font-weight:750}.ntf-list{display:grid;gap:8px}.ntf-item{width:100%;border:1px solid var(--linha);border-radius:13px;background:var(--paper);padding:12px;text-align:left;color:var(--texto);display:grid;grid-template-columns:9px 1fr auto;gap:9px;align-items:start}.ntf-item.unread{background:var(--sage-soft)}.ntf-dot{width:8px;height:8px;border-radius:50%;background:transparent;margin-top:5px}.ntf-item.unread .ntf-dot{background:var(--sage)}.ntf-item strong,.ntf-item span,.ntf-item small{display:block}.ntf-item strong{font-size:13px}.ntf-item span{font-size:11px;color:var(--muted);margin-top:3px;line-height:1.4}.ntf-item small{font-size:9px;color:var(--muted);white-space:nowrap}.ntf-empty{padding:28px 8px;text-align:center;color:var(--muted);font-size:13px}
      .ntf-reminder{position:fixed;inset:0;z-index:640;background:rgba(17,24,19,.46);display:grid;place-items:center;padding:20px}.ntf-reminder-card{width:min(100%,420px);background:var(--paper);border-radius:22px;padding:20px;box-shadow:0 18px 60px rgba(0,0,0,.2);color:var(--texto)}.ntf-reminder-kicker{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--sage);font-weight:800}.ntf-reminder-card h3{font-size:21px;margin:5px 0 7px}.ntf-reminder-card p{font-size:12px;line-height:1.5;color:var(--muted);margin:0 0 12px}.ntf-task-preview{display:grid;gap:5px;margin:10px 0 15px}.ntf-task-preview div{padding:8px 10px;border-radius:10px;background:var(--bg);font-size:11px}.ntf-reminder-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ntf-reminder-actions button{min-height:44px;border:0;border-radius:12px;font-weight:800}.ntf-reminder-actions .primary{background:var(--sage);color:#fff}.ntf-reminder-actions .quiet{background:var(--bg);color:var(--texto)}
      @media(min-width:700px){.ntf-overlay{align-items:center}.ntf-panel{border-radius:24px;max-height:80dvh}}
    `;
    document.head.appendChild(style);
  }

  function ensureBell() {
    const header = document.querySelector('.app-header');
    const avatar = document.getElementById('headerAvatar');
    if (!header || !avatar) return null;
    let button = document.getElementById('acBell');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button'; button.id = 'acBell'; button.className = 'ac-bell';
      button.setAttribute('aria-label', 'Notificações');
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span class="ac-bell-badge" style="display:none"></span>';
      header.insertBefore(button, avatar);
    }
    if (button.dataset.ntfOwner !== 'v2') {
      const clean = button.cloneNode(true);
      clean.dataset.ntfOwner = 'v2';
      button.replaceWith(clean); button = clean;
      button.addEventListener('click', showCenter);
    }
    return button;
  }

  function updateBadge() {
    const button = ensureBell();
    if (!button) return;
    const unread = N.notifications.filter(item => !item.lida).length;
    const badge = button.querySelector('.ac-bell-badge');
    if (!badge) return;
    badge.textContent = unread > 9 ? '9+' : String(unread);
    badge.style.display = unread ? 'grid' : 'none';
  }

  async function loadNotifications() {
    const ctx = context(); if (!ctx) return [];
    const result = await ctx.client.from('notificacoes')
      .select('id,tipo,titulo,mensagem,entidade,entidade_id,lida,criada_em')
      .eq('usuario_id', ctx.profile.id).order('criada_em', { ascending: false }).limit(80);
    if (result.error) throw result.error;
    N.notifications = result.data || [];
    updateBadge();
    return N.notifications;
  }

  function formatWhen(value) {
    if (!value) return '';
    const date = new Date(value);
    const today = new Date();
    const same = date.toDateString() === today.toDateString();
    return same ? date.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : date.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
  }

  function closeCenter() { document.querySelector('.ntf-overlay')?.remove(); }

  async function markRead(item) {
    if (item.lida || !context()) return;
    const result = await N.client.from('notificacoes').update({ lida:true, lida_em:new Date().toISOString() }).eq('id', item.id).eq('usuario_id', N.profile.id);
    if (!result.error) { item.lida = true; updateBadge(); }
  }

  function openHouseSubtab(sub) {
    closeCenter();
    window.trocarAba?.('casa');
    window.setTimeout(() => window.trocarSub?.(sub, document.querySelector(`.sub-aba[data-sub="${sub}"]`)), 40);
  }

  function route(item) {
    const entity = String(item.entidade || '');
    if (entity === 'tarefas') return openHouseSubtab('tarefas');
    if (entity === 'lista_compras') return openHouseSubtab('compras');
    if (entity === 'estoque') return openHouseSubtab('estoque');
    if (entity === 'contas' || entity.startsWith('acerto') || String(item.tipo || '').startsWith('pagamento')) {
      closeCenter(); window.trocarAba?.('financeiro'); return;
    }
    closeCenter();
  }

  async function showCenter() {
    try { await loadNotifications(); } catch {}
    closeCenter();
    const overlay = document.createElement('div'); overlay.className = 'ntf-overlay';
    overlay.innerHTML = `<section class="ntf-panel" role="dialog" aria-modal="true" aria-label="Notificações"><div class="ntf-head"><h2>Notificações</h2><div class="ntf-head-actions"><button type="button" data-ntf-read-all>Marcar lidas</button><button type="button" data-ntf-close>Fechar</button></div></div><div class="ntf-list">${N.notifications.length ? N.notifications.map(item => `<button type="button" class="ntf-item${item.lida ? '' : ' unread'}" data-ntf-id="${item.id}"><i class="ntf-dot"></i><div><strong>${esc(item.titulo)}</strong>${item.mensagem ? `<span>${esc(item.mensagem)}</span>` : ''}</div><small>${esc(formatWhen(item.criada_em))}</small></button>`).join('') : '<div class="ntf-empty">Nada novo por aqui.</div>'}</div></section>`;
    overlay.addEventListener('click', event => { if (event.target === overlay || event.target.closest('[data-ntf-close]')) closeCenter(); });
    overlay.querySelector('[data-ntf-read-all]')?.addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      const ctx = context(); if (!ctx) return;
      const result = await ctx.client.from('notificacoes').update({ lida:true, lida_em:new Date().toISOString() }).eq('usuario_id', ctx.profile.id).eq('lida', false);
      if (!result.error) { N.notifications.forEach(item => { item.lida = true; }); updateBadge(); await showCenter(); }
    });
    overlay.querySelectorAll('[data-ntf-id]').forEach(button => button.addEventListener('click', async () => {
      const item = N.notifications.find(candidate => candidate.id === button.dataset.ntfId); if (!item) return;
      await markRead(item); route(item);
    }));
    document.body.appendChild(overlay);
  }

  function reminderText(summary) {
    const parts = [];
    if (summary.atrasadas) parts.push(`${summary.atrasadas} ${summary.atrasadas === 1 ? 'atrasada' : 'atrasadas'}`);
    if (summary.hoje) parts.push(`${summary.hoje} ${summary.hoje === 1 ? 'para hoje' : 'para hoje'}`);
    if (summary.amanha) parts.push(`${summary.amanha} ${summary.amanha === 1 ? 'para amanhã' : 'para amanhã'}`);
    return parts.join(' · ');
  }

  async function showTaskReminder(summary) {
    const total = Number(summary.atrasadas || 0) + Number(summary.hoje || 0) + Number(summary.amanha || 0);
    if (!total || !context()) return;
    const signature = `${summary.atrasadas || 0}:${summary.hoje || 0}:${summary.amanha || 0}`;
    const key = `lifeos:task-reminder:${N.profile.id}:${localDate()}`;
    if (localStorage.getItem(key) === signature) return;

    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
    const tasksResult = await N.client.from('tarefas').select('id,titulo,responsavel,data')
      .eq('casa_id', N.profile.casa_id).eq('feita', false).lte('data', tomorrowIso).order('data').limit(8);
    const userKey = String(N.profile.nome || '').toLowerCase();
    const tasks = (tasksResult.data || []).filter(task => ['ambos', userKey].includes(String(task.responsavel || '').toLowerCase()));

    document.querySelector('.ntf-reminder')?.remove();
    const overlay = document.createElement('div'); overlay.className = 'ntf-reminder';
    const heading = summary.atrasadas ? 'Você tem tarefas atrasadas' : summary.hoje ? `Você tem ${summary.hoje === 1 ? 'uma tarefa' : 'tarefas'} para hoje` : `Você tem ${summary.amanha === 1 ? 'uma tarefa' : 'tarefas'} para amanhã`;
    overlay.innerHTML = `<section class="ntf-reminder-card" role="dialog" aria-modal="true"><div class="ntf-reminder-kicker">LifeOS lembra</div><h3>${esc(heading)}</h3><p>${esc(reminderText(summary))}. Abra Tarefas para organizar ou concluir o que estiver pendente.</p>${tasks.length ? `<div class="ntf-task-preview">${tasks.slice(0,3).map(task => `<div>${esc(task.titulo)} · ${task.data ? new Date(`${task.data}T12:00:00`).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) : 'sem data'}</div>`).join('')}</div>` : ''}<div class="ntf-reminder-actions"><button type="button" class="quiet" data-ntf-remind-close>Agora não</button><button type="button" class="primary" data-ntf-open-tasks>Ver tarefas</button></div></section>`;
    const dismiss = () => { localStorage.setItem(key, signature); overlay.remove(); };
    overlay.querySelector('[data-ntf-remind-close]').addEventListener('click', dismiss);
    overlay.querySelector('[data-ntf-open-tasks]').addEventListener('click', () => { dismiss(); openHouseSubtab('tarefas'); });
    document.body.appendChild(overlay);
  }

  async function syncTasks() {
    const ctx = context(); if (!ctx || N.loading) return;
    N.loading = true;
    try {
      const result = await ctx.client.rpc('sincronizar_notificacoes_tarefas', { p_data: localDate() });
      if (result.error) throw result.error;
      await loadNotifications();
      await showTaskReminder(result.data || {});
    } catch (error) {
      console.warn('[Notificações v2]', error);
    } finally { N.loading = false; }
  }

  function subscribe() {
    if (!context() || N.channel) return;
    N.channel = N.client.channel(`lifeos-notifications-${N.profile.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'notificacoes', filter:`usuario_id=eq.${N.profile.id}` }, () => loadNotifications().catch(() => {}))
      .on('postgres_changes', { event:'*', schema:'public', table:'tarefas', filter:`casa_id=eq.${N.profile.casa_id}` }, () => window.setTimeout(syncTasks, 120))
      .subscribe();
  }

  function start() {
    ensureBell();
    if (!context()) return;
    syncTasks(); subscribe();
    window.setTimeout(() => loadNotifications().catch(() => {}), 800);
  }

  installStyles(); ensureBell();
  window.addEventListener('lifeos:ready', start);
  window.addEventListener('pageshow', () => { if (context()) syncTasks(); });
  window.addEventListener('focus', () => { if (context()) loadNotifications().catch(() => {}); });
  if (context()) start();
})();
