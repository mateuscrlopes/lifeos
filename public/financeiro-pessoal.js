import { icon } from './ui/icons.js';

// LifeOS — Financeiro pessoal (iPhone)
// Owner de #lifeosFinanceiroPessoal. Dados privados do usuario autenticado.
// Nao renderiza nem altera a tela Hoje; publica apenas um resumo por evento.

const FP = {
  client: null,
  profile: null,
  config: null,
  carteiras: [],
  fundos: [],
  movimentos: [],
  dividas: [],
  compromissos: [],
  acertos: [],
  tab: 'visao',
  loading: false,
};

const fpEl = id => document.getElementById(id);
const fpMoney = valor => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fpDate = valor => valor ? new Date(`${String(valor).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—';
const fpNum = valor => {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const fpEscape = (valor = '') => String(valor)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function fpToast(mensagem, tipo = 'ok') {
  if (typeof window.lifeosToast === 'function') window.lifeosToast(mensagem, tipo);
  else console[tipo === 'erro' ? 'error' : 'info'](`[Financeiro pessoal] ${mensagem}`);
}

function fpContexto() {
  const ctx = window.lifeosContext;
  if (!ctx?.supa || !ctx?.usuario) return false;
  FP.client = ctx.supa;
  FP.profile = ctx.usuario;
  return true;
}

function fpHojeISO() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
}

function fpFimMesISO() {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 12).toISOString().slice(0, 10);
}

function fpInicioMesISO() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01`;
}

function fpMesSeguinte(data = new Date(), deslocamento = 0) {
  const d = new Date(data.getFullYear(), data.getMonth() + deslocamento, 1, 12);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
}

function fpHorizon() {
  const hoje = fpHojeISO();
  const proxima = FP.config?.proxima_renda;
  return proxima && proxima >= hoje ? proxima : fpFimMesISO();
}

function fpAportesMes() {
  const inicio = fpInicioMesISO();
  const fim = fpFimMesISO();
  const mapa = new Map();
  FP.movimentos
    .filter(m => m.tipo === 'aporte' && m.data >= inicio && m.data <= fim)
    .forEach(m => mapa.set(m.fundo_id, (mapa.get(m.fundo_id) || 0) + fpNum(m.valor)));
  return mapa;
}

function fpCompromissosHorizonte() {
  const hoje = fpHojeISO();
  const horizonte = fpHorizon();
  return FP.compromissos.filter(c => {
    if (!c.ativo || !c.protegido) return false;
    if (c.recorrente) return true;
    if (!c.vencimento) return true;
    return c.vencimento <= horizonte || c.vencimento < hoje;
  });
}

function fpSaldoAcerto(acerto) {
  return Math.max(0, fpNum(acerto.valor_devido) - fpNum(acerto.valor_pago));
}

function fpAcertosAbertos() {
  return FP.acertos.filter(a => !['pago', 'cancelado'].includes(a.status) && fpSaldoAcerto(a) > 0.005);
}

function fpAcertosAPagarHorizonte() {
  const horizonte = fpHorizon();
  return fpAcertosAbertos().filter(a =>
    a.devedor_id === FP.profile?.id && (!a.vencimento || a.vencimento <= horizonte)
  );
}

function fpAcertosAReceber() {
  return fpAcertosAbertos().filter(a => a.credor_id === FP.profile?.id);
}

function fpResumo() {
  const carteirasAtivas = FP.carteiras.filter(c => c.ativo);
  const dinheiroBruto = carteirasAtivas
    .filter(c => c.considerar_disponivel && ['conta', 'dinheiro', 'outro'].includes(c.tipo))
    .reduce((s, c) => s + Math.max(0, fpNum(c.saldo_atual) - fpNum(c.saldo_reservado)), 0);

  const vr = carteirasAtivas
    .filter(c => c.tipo === 'vr')
    .reduce((s, c) => s + Math.max(0, fpNum(c.saldo_atual) - fpNum(c.saldo_reservado)), 0);

  const fundosAtivos = FP.fundos.filter(f => f.ativo);
  const fundosDentroDoCaixa = fundosAtivos
    .filter(f => !f.segregado)
    .reduce((s, f) => s + fpNum(f.saldo_atual), 0);

  const fundosTotal = fundosAtivos.reduce((s, f) => s + fpNum(f.saldo_atual), 0);
  const compromissos = fpCompromissosHorizonte().reduce((s, c) => s + fpNum(c.valor), 0);
  const acertosAPagar = fpAcertosAPagarHorizonte().reduce((s, a) => s + fpSaldoAcerto(a), 0);
  const aportes = fpAportesMes();
  const aportesPendentes = fundosAtivos.reduce((s, f) => {
    const falta = Math.max(0, fpNum(f.aporte_minimo) - (aportes.get(f.id) || 0));
    return s + falta;
  }, 0);
  const margem = fpNum(FP.config?.margem_seguranca);

  const pix = Math.max(0, dinheiroBruto - fundosDentroDoCaixa - compromissos - acertosAPagar - aportesPendentes - margem);
  const limiteCartoes = carteirasAtivas
    .filter(c => c.tipo === 'cartao')
    .reduce((s, c) => s + Math.max(0, fpNum(c.limite_credito) - fpNum(c.fatura_atual)), 0);
  const cartao = Math.max(0, Math.min(limiteCartoes, pix));
  const protegido = fundosTotal + compromissos + acertosAPagar + aportesPendentes + margem;

  return { pix, cartao, vr, protegido, fundosTotal, compromissos, acertosAPagar, aportesPendentes, margem, dinheiroBruto, limiteCartoes };
}

function fpPublicarResumo() {
  const resumo = fpResumo();
  window.dispatchEvent(new CustomEvent('lifeos:financeiro-resumo', {
    detail: {
      pix: resumo.pix,
      cartao: resumo.cartao,
      vr: resumo.vr,
      protegido: resumo.protegido,
      acertosAPagar: resumo.acertosAPagar,
      fundos: FP.fundos.filter(f => f.ativo).map(f => ({ nome: f.nome, saldo: fpNum(f.saldo_atual), meta: f.meta_valor == null ? null : fpNum(f.meta_valor) })),
    },
  }));
}

async function fpCarregar() {
  if (FP.loading || !fpContexto()) return;
  FP.loading = true;
  fpRenderLoading();
  try {
    const uid = FP.profile.id;
    const inicio = fpInicioMesISO();
    const fim = fpFimMesISO();
    const [
      configR, carteirasR, fundosR, movR, dividasR, compromissosR, acertosR,
    ] = await Promise.all([
      FP.client.from('financeiro_pessoal_config').select('*').eq('usuario_id', uid).maybeSingle(),
      FP.client.from('financeiro_carteiras_pessoais').select('*').eq('usuario_id', uid).order('ordem').order('criado_em'),
      FP.client.from('financeiro_fundos_pessoais').select('*').eq('usuario_id', uid).order('ordem').order('criado_em'),
      FP.client.from('financeiro_fundo_movimentos').select('*').eq('usuario_id', uid).gte('data', inicio).lte('data', fim).order('data', { ascending: false }),
      FP.client.from('financeiro_dividas_pessoais').select('*').eq('usuario_id', uid).order('negativada', { ascending: false }).order('criado_em'),
      FP.client.from('financeiro_compromissos_pessoais').select('*').eq('usuario_id', uid).order('ativo', { ascending: false }).order('vencimento', { nullsFirst: false }),
      FP.client.from('acertos').select('id,titulo,devedor_id,credor_id,valor_devido,valor_pago,vencimento,status,origem').eq('casa_id', FP.profile.casa_id).neq('status', 'cancelado').order('vencimento'),
    ]);
    const falha = [configR, carteirasR, fundosR, movR, dividasR, compromissosR, acertosR].find(r => r.error);
    if (falha?.error) throw falha.error;

    FP.config = configR.data || {
      usuario_id: uid,
      renda_mensal_referencia: null,
      proxima_renda: null,
      margem_seguranca: 0,
      vr_mensal_referencia: 0,
      vr_reservado_terceiros: 0,
    };
    FP.carteiras = carteirasR.data || [];
    FP.fundos = fundosR.data || [];
    FP.movimentos = movR.data || [];
    FP.dividas = dividasR.data || [];
    FP.compromissos = compromissosR.data || [];
    FP.acertos = acertosR.data || [];
    fpRender();
    fpPublicarResumo();
  } catch (erro) {
    console.error('[Financeiro pessoal]', erro);
    fpRenderErro();
  } finally {
    FP.loading = false;
  }
}

function fpRenderLoading() {
  const mount = fpEl('lifeosFinanceiroPessoal');
  if (mount) mount.innerHTML = '<div class="fp-state"><span class="fp-spinner"></span><p>Organizando suas finanças…</p></div>';
}

function fpRenderErro() {
  const mount = fpEl('lifeosFinanceiroPessoal');
  if (!mount) return;
  mount.innerHTML = '<div class="fp-state fp-state--error"><strong>Não foi possível carregar suas finanças.</strong><p>Tente novamente em instantes.</p><button type="button" class="lifeos-btn lifeos-btn--secondary" data-fp-retry>Tentar novamente</button></div>';
  mount.querySelector('[data-fp-retry]')?.addEventListener('click', fpCarregar);
}

function fpTabs() {
  const tabs = [
    ['visao', 'Visão geral'],
    ['carteiras', 'Carteiras'],
    ['fundos', 'Fundos'],
    ['planejamento', 'Planejamento'],
  ];
  return `<nav class="fp-tabs" aria-label="Áreas das finanças pessoais">${tabs.map(([id, label]) => `
    <button type="button" class="fp-tab ${FP.tab === id ? 'ativa' : ''}" data-fp-tab="${id}" aria-pressed="${FP.tab === id}">${label}</button>`).join('')}</nav>`;
}

function fpHero(resumo) {
  return `
    <section class="fp-hero">
      <div class="fp-hero-top">
        <div>
          <span class="fp-kicker">Disponível real</span>
          <h2>Você pode gastar hoje</h2>
        </div>
        <button type="button" class="fp-icon-btn" data-fp-config aria-label="Configurar cálculo">${icon('settings', 17)}</button>
      </div>
      <strong class="fp-hero-value">${fpMoney(resumo.pix)}</strong>
      <p>sem mexer nas contas e nos seus planos</p>
      <div class="fp-spend-grid">
        <button type="button" data-fp-simular="pix"><span>Pix / débito</span><strong>${fpMoney(resumo.pix)}</strong></button>
        <button type="button" data-fp-simular="cartao"><span>Cartão</span><strong>${fpMoney(resumo.cartao)}</strong></button>
        <button type="button" data-fp-simular="vr"><span>VR</span><strong>${fpMoney(resumo.vr)}</strong></button>
      </div>
      <button type="button" class="lifeos-btn lifeos-btn--secondary fp-simular-principal" data-fp-simular="pix">Simular um gasto</button>
    </section>`;
}

function fpVisao() {
  const r = fpResumo();
  const aportes = fpAportesMes();
  const fundos = FP.fundos.filter(f => f.ativo);
  const proximos = fpCompromissosHorizonte().slice(0, 4);
  return `
    ${fpHero(r)}
    <section class="fp-card">
      <header class="fp-card-head"><div><span class="fp-kicker">Protegido</span><h3>${fpMoney(r.protegido)}</h3></div><span class="fp-muted">até ${fpDate(fpHorizon())}</span></header>
      <div class="fp-breakdown">
        <div><span>Fundos</span><strong>${fpMoney(r.fundosTotal)}</strong></div>
        <div><span>Compromissos</span><strong>${fpMoney(r.compromissos)}</strong></div>
        <div><span>Acertos da Casa</span><strong>${fpMoney(r.acertosAPagar)}</strong></div>
        <div><span>Aportes mínimos pendentes</span><strong>${fpMoney(r.aportesPendentes)}</strong></div>
        <div><span>Margem de segurança</span><strong>${fpMoney(r.margem)}</strong></div>
      </div>
    </section>
    <section class="fp-card">
      <header class="fp-card-head"><div><span class="fp-kicker">Seus fundos</span><h3>Planos que continuam andando</h3></div><button type="button" class="fp-link" data-fp-go="fundos">Ver todos</button></header>
      <div class="fp-fund-mini-list">
        ${fundos.length ? fundos.slice(0, 4).map(f => fpFundMini(f, aportes.get(f.id) || 0)).join('') : '<p class="fp-empty">Nenhum fundo criado ainda.</p>'}
      </div>
    </section>
    <section class="fp-card">
      <header class="fp-card-head"><div><span class="fp-kicker">Até a próxima renda</span><h3>O que já tem dono</h3></div><button type="button" class="fp-link" data-fp-go="planejamento">Planejar</button></header>
      <div class="fp-simple-list">
        ${proximos.length ? proximos.map(c => `<div><span><strong>${fpEscape(c.titulo)}</strong><small>${c.recorrente ? 'Recorrente' : fpDate(c.vencimento)}</small></span><b>${fpMoney(c.valor)}</b></div>`).join('') : '<p class="fp-empty">Nenhum compromisso pessoal cadastrado.</p>'}
      </div>
    </section>`;
}

function fpFundMini(f, aporteMes = 0) {
  const meta = f.meta_valor == null ? null : fpNum(f.meta_valor);
  const saldo = fpNum(f.saldo_atual);
  const pct = meta && meta > 0 ? Math.min(100, Math.round((saldo / meta) * 100)) : 0;
  const faltaAporte = Math.max(0, fpNum(f.aporte_minimo) - aporteMes);
  return `<button type="button" class="fp-fund-mini" data-fp-fundo="${f.id}">
    <span class="fp-fund-mini-copy"><strong>${fpEscape(f.nome)}</strong><small>${meta ? `${pct}% da meta` : 'sem meta final'}${faltaAporte > 0 ? ` · faltam ${fpMoney(faltaAporte)} do aporte` : ''}</small></span>
    <span class="fp-fund-mini-value">${fpMoney(saldo)}</span>
    <span class="fp-progress" aria-hidden="true"><i style="width:${pct}%"></i></span>
  </button>`;
}

function fpCarteiras() {
  const tipos = { conta: 'Conta', cartao: 'Cartão', vr: 'VR', dinheiro: 'Dinheiro', outro: 'Outra' };
  const cards = FP.carteiras.filter(c => c.ativo).map(c => {
    const disponivel = c.tipo === 'cartao'
      ? Math.max(0, fpNum(c.limite_credito) - fpNum(c.fatura_atual))
      : Math.max(0, fpNum(c.saldo_atual) - fpNum(c.saldo_reservado));
    const meta = c.tipo === 'cartao'
      ? `Fatura ${fpMoney(c.fatura_atual)} · limite do banco ${fpMoney(c.limite_credito)}`
      : c.saldo_reservado > 0
        ? `${fpMoney(c.saldo_reservado)} reservado`
        : (c.instituicao || tipos[c.tipo] || '');
    return `<button type="button" class="fp-wallet" data-fp-carteira="${c.id}">
      <span class="fp-wallet-icon">${icon(c.tipo === 'cartao' ? 'creditCard' : c.tipo === 'conta' ? 'bank' : 'wallet', 17)}</span>
      <span class="fp-wallet-copy"><strong>${fpEscape(c.nome)}</strong><small>${fpEscape(meta)}</small></span>
      <span class="fp-wallet-value"><strong>${fpMoney(disponivel)}</strong><small>${c.tipo === 'cartao' ? 'limite restante' : 'disponível'}</small></span>
    </button>`;
  }).join('');

  return `
    <section class="fp-section-head"><div><span class="fp-kicker">Onde o dinheiro está</span><h2>Carteiras</h2><p>Saldo do banco não é a mesma coisa que dinheiro livre.</p></div><button type="button" class="lifeos-btn lifeos-btn--secondary" data-fp-nova-carteira>+ Carteira</button></section>
    <div class="fp-wallet-list">${cards || '<div class="fp-card fp-empty-card"><strong>Cadastre suas contas e cartões</strong><p>Comece pela conta que você usa no dia a dia e pelo Santander.</p></div>'}</div>
    ${FP.config?.vr_mensal_referencia > 0 ? `<section class="fp-card fp-vr-reference"><span class="fp-kicker">Referência mensal de VR</span><h3>${fpMoney(FP.config.vr_mensal_referencia)}</h3><p>${fpMoney(FP.config.vr_reservado_terceiros)} já são tratados como destinados a outra pessoa antes do cálculo.</p></section>` : ''}`;
}

function fpFundos() {
  const aportes = fpAportesMes();
  const fundos = FP.fundos.filter(f => f.ativo);
  return `
    <section class="fp-section-head"><div><span class="fp-kicker">Progresso visível</span><h2>Fundos</h2><p>Viagem, regularização, apê e reserva podem crescer ao mesmo tempo.</p></div><button type="button" class="lifeos-btn lifeos-btn--secondary" data-fp-novo-fundo>+ Fundo</button></section>
    <div class="fp-funds-grid">
      ${fundos.length ? fundos.map(f => fpFundCard(f, aportes.get(f.id) || 0)).join('') : '<div class="fp-card fp-empty-card"><strong>Nenhum fundo ainda</strong><p>Crie um objetivo e comece com qualquer valor.</p></div>'}
    </div>`;
}

function fpFundCard(f, aporteMes = 0) {
  const saldo = fpNum(f.saldo_atual);
  const meta = f.meta_valor == null ? null : fpNum(f.meta_valor);
  const pct = meta && meta > 0 ? Math.min(100, Math.round((saldo / meta) * 100)) : null;
  const minimo = fpNum(f.aporte_minimo);
  const falta = Math.max(0, minimo - aporteMes);
  return `<article class="fp-fund-card">
    <button type="button" class="fp-fund-card-main" data-fp-fundo="${f.id}">
      <span class="fp-fund-top"><span><small>${f.segregado ? 'dinheiro separado' : 'protegido no caixa'}</small><strong>${fpEscape(f.nome)}</strong></span><b>${fpMoney(saldo)}</b></span>
      ${pct !== null ? `<span class="fp-progress"><i style="width:${pct}%"></i></span><span class="fp-fund-meta"><small>${pct}% concluído</small><small>meta ${fpMoney(meta)}</small></span>` : '<span class="fp-fund-meta"><small>Sem meta final</small></span>'}
      ${minimo > 0 ? `<span class="fp-fund-aporte">${falta > 0 ? `Faltam ${fpMoney(falta)} para o mínimo deste mês` : 'Aporte mínimo do mês concluído'}</span>` : ''}
    </button>
    <div class="fp-fund-actions">
      <button type="button" class="lifeos-btn lifeos-btn--secondary" data-fp-movimentar="${f.id}" data-fp-mov-tipo="aporte">Adicionar</button>
      <button type="button" class="lifeos-btn lifeos-btn--ghost" data-fp-movimentar="${f.id}" data-fp-mov-tipo="retirada">Retirar</button>
    </div>
  </article>`;
}

function fpPlanejamento() {
  const ativos = FP.compromissos.filter(c => c.ativo);
  const acertosAbertos = fpAcertosAbertos();
  const acertosPagar = acertosAbertos.filter(a => a.devedor_id === FP.profile?.id);
  const acertosReceber = fpAcertosAReceber();
  const dividas = FP.dividas.filter(d => d.status !== 'resolvida');
  const negativadas = dividas.filter(d => d.negativada);
  const liberacoes = ativos
    .filter(c => c.recorrente && c.parcelas_restantes > 0)
    .map(c => ({ titulo: c.titulo, valor: fpNum(c.valor), meses: Number(c.parcelas_restantes) }))
    .sort((a, b) => a.meses - b.meses);

  return `
    <section class="fp-section-head"><div><span class="fp-kicker">Próximos passos</span><h2>Planejamento</h2><p>Compromissos, dívidas e renda que vai sendo liberada.</p></div></section>
    <section class="fp-card">
      <header class="fp-card-head"><div><span class="fp-kicker">Compromissos</span><h3>${fpMoney(ativos.reduce((s,c)=>s+fpNum(c.valor),0))} cadastrados</h3></div><button type="button" class="fp-link" data-fp-novo-compromisso>+ Adicionar</button></header>
      <div class="fp-simple-list">
        ${ativos.length ? ativos.map(c => `<button type="button" data-fp-compromisso="${c.id}"><span><strong>${fpEscape(c.titulo)}</strong><small>${c.recorrente ? `mensal${c.parcelas_restantes != null ? ` · ${c.parcelas_restantes} restantes` : ''}` : fpDate(c.vencimento)}</small></span><b>${fpMoney(c.valor)}</b></button>`).join('') : '<p class="fp-empty">Nenhum compromisso pessoal cadastrado.</p>'}
      </div>
    </section>
    <section class="fp-card">
      <header class="fp-card-head"><div><span class="fp-kicker">Acertos da Casa</span><h3>${fpMoney(acertosPagar.reduce((s,a)=>s+fpSaldoAcerto(a),0))} a pagar</h3></div><button type="button" class="fp-link" data-fp-ir-acertos>Ver acertos</button></header>
      <p class="fp-helper">O Pessoal apenas considera o impacto no seu caixa. Pagamento, comprovante e confirmação continuam sendo controlados em Acertos.</p>
      <div class="fp-simple-list">
        ${acertosAbertos.length ? acertosAbertos.slice(0,6).map(a => `<div><span><strong>${fpEscape(a.titulo)}</strong><small>${a.devedor_id === FP.profile?.id ? 'Você deve' : 'Você recebe'} · ${fpDate(a.vencimento)}</small></span><b>${fpMoney(fpSaldoAcerto(a))}</b></div>`).join('') : '<p class="fp-empty">Nenhum acerto em aberto.</p>'}
      </div>
      ${acertosReceber.length ? `<p class="fp-helper">A receber: ${fpMoney(acertosReceber.reduce((s,a)=>s+fpSaldoAcerto(a),0))}. Esse valor só entra no disponível depois de recebido.</p>` : ''}
    </section>
    <section class="fp-card">
      <header class="fp-card-head"><div><span class="fp-kicker">Regularização</span><h3>${negativadas.length} ${negativadas.length === 1 ? 'núcleo negativado' : 'núcleos negativados'}</h3></div><button type="button" class="fp-link" data-fp-nova-divida>+ Adicionar</button></header>
      <p class="fp-helper">Os valores abaixo são referências datadas, não cotações de quitação. Antes de pagar, atualize a proposta.</p>
      <div class="fp-debt-list">
        ${dividas.length ? dividas.map(fpDebtRow).join('') : '<p class="fp-empty">Nenhuma dívida cadastrada.</p>'}
      </div>
    </section>
    <section class="fp-card">
      <header class="fp-card-head"><div><span class="fp-kicker">Renda sendo desbloqueada</span><h3>Liberações previstas</h3></div></header>
      <div class="fp-timeline">
        ${liberacoes.length ? liberacoes.map(l => `<div><span class="fp-timeline-dot"></span><span><strong>Em cerca de ${l.meses} ${l.meses === 1 ? 'mês' : 'meses'}</strong><small>${fpEscape(l.titulo)} termina</small></span><b>+${fpMoney(l.valor)}/mês</b></div>`).join('') : '<p class="fp-empty">Cadastre parcelas restantes para ver quando sua renda será liberada.</p>'}
      </div>
    </section>
    <section class="fp-card fp-forecast">
      <span class="fp-kicker">Próximos 90 dias</span>
      <div class="fp-forecast-grid">${[0,1,2].map(i => `<div><strong>${fpMesSeguinte(new Date(), i)}</strong><span>Compromissos</span><b>${fpMoney(ativos.filter(c => c.recorrente || !c.vencimento || new Date(c.vencimento + 'T12:00:00').getMonth() === new Date(new Date().getFullYear(), new Date().getMonth()+i,1).getMonth()).reduce((s,c)=>s+fpNum(c.valor),0))}</b></div>`).join('')}</div>
      <p>Esta projeção usa apenas o que já está cadastrado no LifeOS; não inventa receitas ou gastos futuros.</p>
    </section>`;
}

function fpDebtRow(d) {
  const statusMap = {
    em_levantamento: 'Em levantamento', mapeada: 'Mapeada', negociar: 'Negociar',
    em_pagamento: 'Em pagamento', resolvida: 'Resolvida', contestada: 'Contestada',
  };
  return `<button type="button" class="fp-debt-row" data-fp-divida="${d.id}">
    <span><span class="fp-debt-title"><strong>${fpEscape(d.nome)}</strong>${d.negativada ? '<i>Negativada</i>' : ''}</span><small>${fpEscape([d.credor_atual, d.cobrador].filter(Boolean).join(' · ') || statusMap[d.status] || '')}</small><small>${fpEscape(d.proxima_acao || '')}</small></span>
    <span><b>${d.valor_referencia == null ? 'A levantar' : fpMoney(d.valor_referencia)}</b><small>${d.data_referencia ? `ref. ${fpDate(d.data_referencia)}` : ''}</small></span>
  </button>`;
}

function fpRender() {
  const mount = fpEl('lifeosFinanceiroPessoal');
  if (!mount) return;
  const conteudo = FP.tab === 'carteiras' ? fpCarteiras()
    : FP.tab === 'fundos' ? fpFundos()
      : FP.tab === 'planejamento' ? fpPlanejamento()
        : fpVisao();
  mount.innerHTML = `<div class="fp-shell">${fpTabs()}<div class="fp-content">${conteudo}</div></div>`;
  fpBind(mount);
}

function fpBind(root) {
  root.querySelectorAll('[data-fp-tab]').forEach(b => b.addEventListener('click', () => { FP.tab = b.dataset.fpTab; fpRender(); }));
  root.querySelectorAll('[data-fp-go]').forEach(b => b.addEventListener('click', () => { FP.tab = b.dataset.fpGo; fpRender(); }));
  root.querySelectorAll('[data-fp-simular]').forEach(b => b.addEventListener('click', () => fpAbrirSimulador(b.dataset.fpSimular)));
  root.querySelector('[data-fp-config]')?.addEventListener('click', fpAbrirConfig);
  root.querySelector('[data-fp-nova-carteira]')?.addEventListener('click', () => fpAbrirCarteira(null));
  root.querySelectorAll('[data-fp-carteira]').forEach(b => b.addEventListener('click', () => fpAbrirCarteira(FP.carteiras.find(c => c.id === b.dataset.fpCarteira))));
  root.querySelector('[data-fp-novo-fundo]')?.addEventListener('click', () => fpAbrirFundo(null));
  root.querySelectorAll('[data-fp-fundo]').forEach(b => b.addEventListener('click', () => fpAbrirFundo(FP.fundos.find(f => f.id === b.dataset.fpFundo))));
  root.querySelectorAll('[data-fp-movimentar]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); fpAbrirMovimento(b.dataset.fpMovimentar, b.dataset.fpMovTipo); }));
  root.querySelector('[data-fp-novo-compromisso]')?.addEventListener('click', () => fpAbrirCompromisso(null));
  root.querySelectorAll('[data-fp-compromisso]').forEach(b => b.addEventListener('click', () => fpAbrirCompromisso(FP.compromissos.find(c => c.id === b.dataset.fpCompromisso))));
  root.querySelector('[data-fp-ir-acertos]')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('lifeos:financeiro-shell-ir', { detail: { secao: 'acertos' } }));
  });
  root.querySelector('[data-fp-nova-divida]')?.addEventListener('click', () => fpAbrirDivida(null));
  root.querySelectorAll('[data-fp-divida]').forEach(b => b.addEventListener('click', () => fpAbrirDivida(FP.dividas.find(d => d.id === b.dataset.fpDivida))));
}

function fpModal(html, initialSelector = null) {
  const overlay = document.createElement('div');
  overlay.className = 'fp-modal-overlay';
  overlay.hidden = true;
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  const fechar = () => {
    if (window.LifeOSModal?.close) window.LifeOSModal.close(overlay);
    else overlay.hidden = true;
    overlay.remove();
  };
  overlay.addEventListener('click', e => {
    if (e.target === overlay || e.target.closest('[data-fp-close]')) {
      e.preventDefault();
      fechar();
    }
  });
  const initialFocus = initialSelector ? overlay.querySelector(initialSelector) : null;
  if (window.LifeOSModal?.open) window.LifeOSModal.open(overlay, { initialFocus });
  else { overlay.hidden = false; initialFocus?.focus?.(); }
  return { overlay, fechar };
}

function fpModalBase(kicker, titulo, subtitulo, body) {
  return `<section class="fp-modal" role="dialog" aria-modal="true" aria-label="${fpEscape(titulo)}">
    <header><div><span class="fp-kicker">${fpEscape(kicker)}</span><h2>${fpEscape(titulo)}</h2>${subtitulo ? `<p>${fpEscape(subtitulo)}</p>` : ''}</div><button type="button" class="fp-modal-close" data-fp-close aria-label="Fechar">×</button></header>
    ${body}
  </section>`;
}

function fpField(label, input) {
  return `<label class="fp-field"><span>${label}</span>${input}</label>`;
}

function fpActions(extra = '') {
  return `<div class="fp-form-actions">${extra}<button type="button" class="lifeos-btn lifeos-btn--ghost" data-fp-close>Cancelar</button><button type="submit" class="lifeos-btn lifeos-btn--primary">Salvar</button></div>`;
}

async function fpSalvarConfig(form, fechar) {
  const data = new FormData(form);
  const payload = {
    usuario_id: FP.profile.id,
    renda_mensal_referencia: data.get('renda') ? fpNum(data.get('renda')) : null,
    proxima_renda: data.get('proxima_renda') || null,
    margem_seguranca: fpNum(data.get('margem')),
    vr_mensal_referencia: fpNum(data.get('vr_mensal')),
    vr_reservado_terceiros: fpNum(data.get('vr_reservado')),
    atualizado_em: new Date().toISOString(),
  };
  const r = await FP.client.from('financeiro_pessoal_config').upsert(payload, { onConflict: 'usuario_id' });
  if (r.error) throw r.error;
  fechar(); await fpCarregar();
}

function fpAbrirConfig() {
  const c = FP.config || {};
  const html = fpModalBase('Como o LifeOS calcula', 'Configurar disponível real', 'Você decide quanto precisa continuar protegido.', `
    <form class="fp-form" data-fp-form>
      ${fpField('Renda mensal de referência', `<input name="renda" inputmode="decimal" value="${c.renda_mensal_referencia ?? ''}" placeholder="0,00">`)}
      ${fpField('Próxima renda', `<input name="proxima_renda" type="date" value="${c.proxima_renda || ''}">`)}
      ${fpField('Margem de segurança', `<input name="margem" inputmode="decimal" value="${c.margem_seguranca ?? 0}">`)}
      <div class="fp-form-grid">
        ${fpField('VR mensal', `<input name="vr_mensal" inputmode="decimal" value="${c.vr_mensal_referencia ?? 0}">`)}
        ${fpField('VR destinado a terceiros', `<input name="vr_reservado" inputmode="decimal" value="${c.vr_reservado_terceiros ?? 0}">`)}
      </div>
      <p class="fp-helper">O saldo real do VR fica nas Carteiras. Estes dois valores servem como referência para a divisão mensal.</p>
      ${fpActions()}
    </form>`);
  const { overlay, fechar } = fpModal(html, '[name="renda"]');
  overlay.querySelector('[data-fp-form]')?.addEventListener('submit', async e => {
    e.preventDefault();
    try { await fpSalvarConfig(e.currentTarget, fechar); fpToast('Configuração salva.'); }
    catch (erro) { console.error(erro); fpToast('Não foi possível salvar.', 'erro'); }
  });
}

function fpSlug(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'fundo';
}

function fpAbrirCarteira(carteira) {
  const c = carteira || {};
  const html = fpModalBase('Carteira', carteira ? 'Editar carteira' : 'Nova carteira', 'Cadastre o que existe hoje; você pode atualizar os saldos quando quiser.', `
    <form class="fp-form" data-fp-form>
      ${fpField('Nome', `<input name="nome" required maxlength="80" value="${fpEscape(c.nome || '')}" placeholder="Ex.: Santander">`)}
      <div class="fp-form-grid">
        ${fpField('Tipo', `<select name="tipo"><option value="conta" ${c.tipo==='conta'?'selected':''}>Conta</option><option value="cartao" ${c.tipo==='cartao'?'selected':''}>Cartão</option><option value="vr" ${c.tipo==='vr'?'selected':''}>VR</option><option value="dinheiro" ${c.tipo==='dinheiro'?'selected':''}>Dinheiro</option><option value="outro" ${c.tipo==='outro'?'selected':''}>Outra</option></select>`)}
        ${fpField('Instituição', `<input name="instituicao" value="${fpEscape(c.instituicao || '')}" placeholder="Banco ou emissor">`)}
      </div>
      <div class="fp-form-grid">
        ${fpField('Saldo atual', `<input name="saldo" inputmode="decimal" value="${c.saldo_atual ?? 0}">`)}
        ${fpField('Saldo reservado', `<input name="reservado" inputmode="decimal" value="${c.saldo_reservado ?? 0}">`)}
      </div>
      <div class="fp-form-grid">
        ${fpField('Limite de crédito', `<input name="limite" inputmode="decimal" value="${c.limite_credito ?? ''}" placeholder="Só para cartão">`)}
        ${fpField('Fatura atual', `<input name="fatura" inputmode="decimal" value="${c.fatura_atual ?? ''}" placeholder="Só para cartão">`)}
      </div>
      <div class="fp-form-grid">
        ${fpField('Dia de fechamento', `<input name="fechamento" type="number" min="1" max="31" value="${c.fechamento_dia ?? ''}">`)}
        ${fpField('Dia de vencimento', `<input name="vencimento" type="number" min="1" max="31" value="${c.vencimento_dia ?? ''}">`)}
      </div>
      <label class="fp-check"><input name="disponivel" type="checkbox" ${c.considerar_disponivel !== false ? 'checked' : ''}><span>Considerar este saldo no dinheiro disponível</span></label>
      ${fpField('Observação', `<textarea name="observacoes" rows="2">${fpEscape(c.observacoes || '')}</textarea>`)}
      ${fpActions(carteira ? '<button type="button" class="lifeos-btn lifeos-btn--danger" data-fp-arquivar>Arquivar</button>' : '')}
    </form>`);
  const { overlay, fechar } = fpModal(html, '[name="nome"]');
  const form = overlay.querySelector('[data-fp-form]');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const d = new FormData(form);
    const saldo = fpNum(d.get('saldo'));
    const reservado = Math.max(0, fpNum(d.get('reservado')));
    const payload = {
      usuario_id: FP.profile.id,
      nome: String(d.get('nome') || '').trim(),
      tipo: d.get('tipo'),
      instituicao: String(d.get('instituicao') || '').trim() || null,
      saldo_atual: saldo,
      saldo_reservado: Math.min(Math.max(0, saldo), reservado),
      limite_credito: d.get('limite') ? fpNum(d.get('limite')) : null,
      fatura_atual: d.get('fatura') ? fpNum(d.get('fatura')) : null,
      fechamento_dia: d.get('fechamento') ? Number(d.get('fechamento')) : null,
      vencimento_dia: d.get('vencimento') ? Number(d.get('vencimento')) : null,
      considerar_disponivel: d.get('disponivel') === 'on',
      observacoes: String(d.get('observacoes') || '').trim() || null,
      atualizado_em: new Date().toISOString(),
    };
    try {
      const q = carteira
        ? FP.client.from('financeiro_carteiras_pessoais').update(payload).eq('id', carteira.id)
        : FP.client.from('financeiro_carteiras_pessoais').insert(payload);
      const r = await q;
      if (r.error) throw r.error;
      fechar(); await fpCarregar(); fpToast('Carteira salva.');
    } catch (erro) { console.error(erro); fpToast('Não foi possível salvar a carteira.', 'erro'); }
  });
  overlay.querySelector('[data-fp-arquivar]')?.addEventListener('click', async () => {
    const r = await FP.client.from('financeiro_carteiras_pessoais').update({ ativo:false, atualizado_em:new Date().toISOString() }).eq('id', carteira.id);
    if (r.error) return fpToast('Não foi possível arquivar.', 'erro');
    fechar(); await fpCarregar(); fpToast('Carteira arquivada.');
  });
}

function fpAbrirFundo(fundo) {
  const f = fundo || {};
  const html = fpModalBase('Fundo', fundo ? f.nome : 'Novo fundo', 'Um plano pode continuar vivo mesmo com outros objetivos acontecendo ao mesmo tempo.', `
    <form class="fp-form" data-fp-form>
      ${fpField('Nome', `<input name="nome" required maxlength="80" value="${fpEscape(f.nome || '')}" placeholder="Ex.: Reserva">`)}
      <div class="fp-form-grid">
        ${fpField('Meta', `<input name="meta" inputmode="decimal" value="${f.meta_valor ?? ''}" placeholder="Opcional">`)}
        ${fpField('Aporte mínimo mensal', `<input name="minimo" inputmode="decimal" value="${f.aporte_minimo ?? 0}">`)}
      </div>
      <label class="fp-check"><input name="segregado" type="checkbox" ${f.segregado ? 'checked' : ''}><span>Este dinheiro já está fisicamente separado da conta do dia a dia</span></label>
      ${fpField('Observação', `<textarea name="observacoes" rows="3">${fpEscape(f.observacoes || '')}</textarea>`)}
      ${fpActions()}
    </form>`);
  const { overlay, fechar } = fpModal(html, '[name="nome"]');
  const form = overlay.querySelector('[data-fp-form]');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const d = new FormData(form);
    const nome = String(d.get('nome') || '').trim();
    const payload = {
      usuario_id: FP.profile.id,
      nome,
      slug: f.slug || fpSlug(nome),
      meta_valor: d.get('meta') ? fpNum(d.get('meta')) : null,
      aporte_minimo: fpNum(d.get('minimo')),
      segregado: d.get('segregado') === 'on',
      observacoes: String(d.get('observacoes') || '').trim() || null,
      atualizado_em: new Date().toISOString(),
    };
    try {
      const q = fundo
        ? FP.client.from('financeiro_fundos_pessoais').update(payload).eq('id', fundo.id)
        : FP.client.from('financeiro_fundos_pessoais').insert(payload);
      const r = await q;
      if (r.error) throw r.error;
      fechar(); await fpCarregar(); fpToast('Fundo salvo.');
    } catch (erro) { console.error(erro); fpToast('Não foi possível salvar o fundo.', 'erro'); }
  });
}

function fpAbrirMovimento(fundoId, tipo = 'aporte') {
  const fundo = FP.fundos.find(f => f.id === fundoId);
  if (!fundo) return;
  const retirada = tipo === 'retirada';
  const html = fpModalBase(retirada ? 'Retirada' : 'Aporte', fundo.nome, retirada ? `Saldo atual: ${fpMoney(fundo.saldo_atual)}` : 'Todo valor conta como progresso.', `
    <form class="fp-form" data-fp-form>
      ${fpField('Valor', '<input name="valor" inputmode="decimal" required autofocus placeholder="0,00">')}
      ${fpField('Observação', `<input name="observacao" maxlength="160" placeholder="${retirada ? 'Ex.: quitação negociada' : 'Ex.: aporte de setembro'}">`)}
      ${fpActions()}
    </form>`);
  const { overlay, fechar } = fpModal(html, '[name="valor"]');
  const form = overlay.querySelector('[data-fp-form]');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const d = new FormData(form);
    const valor = fpNum(d.get('valor'));
    if (valor <= 0) return fpToast('Informe um valor maior que zero.', 'erro');
    try {
      const r = await FP.client.rpc('lifeos_movimentar_fundo_pessoal', {
        p_fundo_id: fundo.id,
        p_tipo: retirada ? 'retirada' : 'aporte',
        p_valor: valor,
        p_observacao: String(d.get('observacao') || '').trim() || null,
      });
      if (r.error) throw r.error;
      fechar(); await fpCarregar(); fpToast(retirada ? 'Retirada registrada.' : 'Aporte registrado.');
    } catch (erro) { console.error(erro); fpToast(erro?.message || 'Não foi possível movimentar o fundo.', 'erro'); }
  });
}

function fpAbrirCompromisso(comp) {
  const c = comp || {};
  const html = fpModalBase('Planejamento', comp ? 'Editar compromisso' : 'Novo compromisso', 'Só compromissos protegidos reduzem o “quanto posso gastar”.', `
    <form class="fp-form" data-fp-form>
      ${fpField('Título', `<input name="titulo" required value="${fpEscape(c.titulo || '')}" placeholder="Ex.: Consignado Santander">`)}
      <div class="fp-form-grid">
        ${fpField('Valor', `<input name="valor" required inputmode="decimal" value="${c.valor ?? ''}">`)}
        ${fpField('Tipo', `<select name="tipo"><option value="conta" ${c.tipo==='conta'?'selected':''}>Conta</option><option value="emprestimo" ${c.tipo==='emprestimo'?'selected':''}>Empréstimo</option><option value="cartao" ${c.tipo==='cartao'?'selected':''}>Cartão</option><option value="assinatura" ${c.tipo==='assinatura'?'selected':''}>Assinatura</option><option value="outro" ${c.tipo==='outro'?'selected':''}>Outro</option></select>`)}
      </div>
      <div class="fp-form-grid">
        ${fpField('Vencimento', `<input name="vencimento" type="date" value="${c.vencimento || ''}">`)}
        ${fpField('Dia mensal', `<input name="dia" type="number" min="1" max="31" value="${c.dia_vencimento ?? ''}">`)}
      </div>
      <div class="fp-form-grid">
        ${fpField('Parcelas restantes', `<input name="restantes" type="number" min="0" value="${c.parcelas_restantes ?? ''}">`)}
        ${fpField('Parcelas totais', `<input name="total" type="number" min="0" value="${c.parcelas_total ?? ''}">`)}
      </div>
      <label class="fp-check"><input name="recorrente" type="checkbox" ${c.recorrente ? 'checked' : ''}><span>Recorrente / mensal</span></label>
      <label class="fp-check"><input name="protegido" type="checkbox" ${c.protegido !== false ? 'checked' : ''}><span>Proteger este valor no cálculo</span></label>
      ${fpField('Observação', `<textarea name="observacoes" rows="2">${fpEscape(c.observacoes || '')}</textarea>`)}
      ${fpActions(comp ? '<button type="button" class="lifeos-btn lifeos-btn--danger" data-fp-desativar>Desativar</button>' : '')}
    </form>`);
  const { overlay, fechar } = fpModal(html, '[name="titulo"]');
  const form = overlay.querySelector('[data-fp-form]');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const d = new FormData(form);
    const payload = {
      usuario_id: FP.profile.id,
      titulo: String(d.get('titulo') || '').trim(),
      tipo: d.get('tipo'),
      valor: fpNum(d.get('valor')),
      vencimento: d.get('vencimento') || null,
      recorrente: d.get('recorrente') === 'on',
      dia_vencimento: d.get('dia') ? Number(d.get('dia')) : null,
      parcelas_restantes: d.get('restantes') !== '' ? Number(d.get('restantes')) : null,
      parcelas_total: d.get('total') !== '' ? Number(d.get('total')) : null,
      protegido: d.get('protegido') === 'on',
      observacoes: String(d.get('observacoes') || '').trim() || null,
      atualizado_em: new Date().toISOString(),
    };
    try {
      const q = comp
        ? FP.client.from('financeiro_compromissos_pessoais').update(payload).eq('id', comp.id)
        : FP.client.from('financeiro_compromissos_pessoais').insert(payload);
      const r = await q; if (r.error) throw r.error;
      fechar(); await fpCarregar(); fpToast('Compromisso salvo.');
    } catch (erro) { console.error(erro); fpToast('Não foi possível salvar.', 'erro'); }
  });
  overlay.querySelector('[data-fp-desativar]')?.addEventListener('click', async () => {
    const r = await FP.client.from('financeiro_compromissos_pessoais').update({ ativo:false, atualizado_em:new Date().toISOString() }).eq('id', comp.id);
    if (r.error) return fpToast('Não foi possível desativar.', 'erro');
    fechar(); await fpCarregar(); fpToast('Compromisso desativado.');
  });
}

function fpAbrirDivida(divida) {
  const d = divida || {};
  const html = fpModalBase('Dívida', divida ? d.nome : 'Nova dívida', 'Registre o núcleo da obrigação, não cada empresa que aparece cobrando.', `
    <form class="fp-form" data-fp-form>
      ${fpField('Nome principal', `<input name="nome" required value="${fpEscape(d.nome || '')}" placeholder="Ex.: Open English">`)}
      <div class="fp-form-grid">
        ${fpField('Origem', `<input name="origem" value="${fpEscape(d.origem || '')}">`)}
        ${fpField('Credor atual', `<input name="credor" value="${fpEscape(d.credor_atual || '')}">`)}
      </div>
      ${fpField('Empresa de cobrança', `<input name="cobrador" value="${fpEscape(d.cobrador || '')}">`)}
      <div class="fp-form-grid">
        ${fpField('Valor de referência', `<input name="valor" inputmode="decimal" value="${d.valor_referencia ?? ''}">`)}
        ${fpField('Data da referência', `<input name="data" type="date" value="${d.data_referencia || ''}">`)}
      </div>
      ${fpField('Status', `<select name="status"><option value="em_levantamento" ${d.status==='em_levantamento'?'selected':''}>Em levantamento</option><option value="mapeada" ${d.status==='mapeada'?'selected':''}>Mapeada</option><option value="negociar" ${d.status==='negociar'?'selected':''}>Negociar</option><option value="em_pagamento" ${d.status==='em_pagamento'?'selected':''}>Em pagamento</option><option value="resolvida" ${d.status==='resolvida'?'selected':''}>Resolvida</option><option value="contestada" ${d.status==='contestada'?'selected':''}>Contestada</option></select>`)}
      <label class="fp-check"><input name="negativada" type="checkbox" ${d.negativada ? 'checked' : ''}><span>Está negativada hoje</span></label>
      ${fpField('Próxima ação', `<input name="acao" value="${fpEscape(d.proxima_acao || '')}" placeholder="Ex.: validar saldo total do contrato">`)}
      ${fpField('Observações', `<textarea name="observacoes" rows="3">${fpEscape(d.observacoes || '')}</textarea>`)}
      ${fpActions()}
    </form>`);
  const { overlay, fechar } = fpModal(html, '[name="nome"]');
  const form = overlay.querySelector('[data-fp-form]');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(form);
    const payload = {
      usuario_id: FP.profile.id,
      nome: String(f.get('nome') || '').trim(),
      tipo: d.tipo || 'outro',
      origem: String(f.get('origem') || '').trim() || null,
      credor_atual: String(f.get('credor') || '').trim() || null,
      cobrador: String(f.get('cobrador') || '').trim() || null,
      valor_referencia: f.get('valor') ? fpNum(f.get('valor')) : null,
      data_referencia: f.get('data') || null,
      negativada: f.get('negativada') === 'on',
      status: f.get('status'),
      proxima_acao: String(f.get('acao') || '').trim() || null,
      observacoes: String(f.get('observacoes') || '').trim() || null,
      atualizado_em: new Date().toISOString(),
    };
    try {
      const q = divida
        ? FP.client.from('financeiro_dividas_pessoais').update(payload).eq('id', divida.id)
        : FP.client.from('financeiro_dividas_pessoais').insert(payload);
      const r = await q; if (r.error) throw r.error;
      fechar(); await fpCarregar(); fpToast('Dívida atualizada.');
    } catch (erro) { console.error(erro); fpToast('Não foi possível salvar.', 'erro'); }
  });
}

function fpAbrirSimulador(tipo = 'pix') {
  const r = fpResumo();
  const max = { pix:r.pix, cartao:r.cartao, vr:r.vr };
  const nomes = { pix:'Pix / débito', cartao:'Cartão', vr:'VR' };
  const html = fpModalBase('Decisão rápida', 'Quanto posso gastar?', 'Teste um gasto antes de passar o cartão ou fazer o Pix.', `
    <form class="fp-form" data-fp-form>
      <div class="fp-segmented">
        ${Object.entries(nomes).map(([id,n]) => `<button type="button" class="${id===tipo?'ativa':''}" data-fp-sim-tipo="${id}">${n}</button>`).join('')}
      </div>
      ${fpField('Quanto você quer gastar?', '<input name="valor" inputmode="decimal" required placeholder="0,00">')}
      <div class="fp-sim-result" data-fp-sim-result><span>Limite seguro agora</span><strong>${fpMoney(max[tipo])}</strong><p>Seus fundos e compromissos continuam protegidos.</p></div>
      <div class="fp-form-actions"><button type="button" class="lifeos-btn lifeos-btn--ghost" data-fp-close>Fechar</button><button type="submit" class="lifeos-btn lifeos-btn--primary">Simular</button></div>
    </form>`);
  const { overlay } = fpModal(html, '[name="valor"]');
  let atual = tipo;
  const result = overlay.querySelector('[data-fp-sim-result]');
  overlay.querySelectorAll('[data-fp-sim-tipo]').forEach(b => b.addEventListener('click', () => {
    atual = b.dataset.fpSimTipo;
    overlay.querySelectorAll('[data-fp-sim-tipo]').forEach(x => x.classList.toggle('ativa', x === b));
    result.innerHTML = `<span>Limite seguro agora</span><strong>${fpMoney(max[atual])}</strong><p>Seus fundos e compromissos continuam protegidos.</p>`;
  }));
  overlay.querySelector('[data-fp-form]')?.addEventListener('submit', e => {
    e.preventDefault();
    const valor = fpNum(new FormData(e.currentTarget).get('valor'));
    const limite = max[atual];
    if (valor <= limite) {
      result.className = 'fp-sim-result fp-sim-result--ok';
      result.innerHTML = `<span>Pode gastar</span><strong>${fpMoney(valor)}</strong><p>Depois disso ainda ficam ${fpMoney(limite - valor)} seguros nesta forma de pagamento.</p>`;
    } else {
      result.className = 'fp-sim-result fp-sim-result--warn';
      result.innerHTML = `<span>Esse valor passa do planejado</span><strong>Até ${fpMoney(limite)}</strong><p>Acima disso você começa a usar dinheiro que já tem outro destino.</p>`;
    }
  });
}

function fpIr({ tab = 'visao', simular = null } = {}) {
  FP.tab = tab;
  if (typeof window.trocarAba === 'function') window.trocarAba('financeiro');
  else document.querySelector('.tab-btn[data-tab="financeiro"]')?.click();
  window.dispatchEvent(new CustomEvent('lifeos:financeiro-shell-ir', { detail: { secao: 'pessoal' } }));
  window.setTimeout(() => {
    fpRender();
    fpEl('lifeosFinanceiroPessoal')?.scrollIntoView({ behavior:'smooth', block:'start' });
    if (simular) fpAbrirSimulador(simular);
  }, 80);
}

window.addEventListener('lifeos:ready', fpCarregar);
window.addEventListener('lifeos:financeiro-abrir', fpCarregar);
window.addEventListener('lifeos:financeiro-pessoal-abrir', fpCarregar);
window.addEventListener('lifeos:acertos-atualizados', fpCarregar);
window.addEventListener('lifeos:financeiro-pessoal-ir', e => fpIr(e.detail || {}));

if (window.lifeosContext) fpCarregar();

export { fpResumo };
