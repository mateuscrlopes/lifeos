// LifeOS — Tela Hoje
// Proprietário único dos mounts #heroHoje, #metricasHoje e #cardsHoje.
// Recebe dados prontos; não consulta banco nem observa/muta a renderização de outros módulos.

let heroTimer = null;
let heroSlides = [];
let heroIndex = 0;

const el = id => document.getElementById(id);
const dinheiro = valor => valor == null
  ? 'Valor não informado'
  : Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ICONS = {
  task: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  plant: '<path d="M12 14V8"/><path d="M12 10c-4 0-6-2-6-5 4 0 6 2 6 5Z"/><path d="M12 8c4 0 6-2 6-5-4 0-6 2-6 5Z"/><path d="M6 14h12l-1 7H7Z"/>',
  bill: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
  stock: '<path d="m3 7 9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
  meal: '<path d="M4 3v7a3 3 0 0 0 3 3h1V3M8 3v10M18 3v18M15 8c0-3 1-5 3-5v10h-3Z"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  tasks: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.93-1.46l1.38-5.53H6"/>',
  box: '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
};

function svg(name, size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.check}</svg>`;
}

function ensureStyle() {
  if (document.getElementById('lifeos-hoje-style')) return;
  const link = document.createElement('link');
  link.id = 'lifeos-hoje-style';
  link.rel = 'stylesheet';
  link.href = '/hoje.css?v=1';
  document.head.appendChild(link);
}

function ensureHeading() {
  const metrics = el('metricasHoje');
  if (!metrics) return;
  let heading = el('phase3TodayHeading');
  if (!heading) {
    heading = document.createElement('div');
    heading.id = 'phase3TodayHeading';
    heading.className = 'phase3-today-section-head';
    heading.innerHTML = '<strong>Agora na Casa</strong><span>Atalhos e pendências do dia</span>';
    metrics.before(heading);
  }
}

function responsavelTexto(valor) {
  const mapa = { mateus: 'Mateus', ghustavo: 'Ghustavo', gustavo: 'Ghustavo', ambos: 'Mateus e Ghustavo' };
  return mapa[String(valor || '').toLowerCase()] || valor || '';
}

function labelTipoCardapio(tipo) {
  return tipo === 'almoco' ? 'Almoço' : tipo === 'janta' ? 'Jantar' : tipo || 'Refeição';
}

function refeicaoDoHorario(cardapio) {
  const itens = cardapio?.itens || [];
  if (!itens.length) return null;
  const dia = new Date().getDay();
  if (dia < 1 || dia > 5) return null;
  const tipo = new Date().getHours() < 15 ? 'almoco' : 'janta';
  return itens.find(item => item.tipo === tipo) || null;
}

function buildHeroSlides(dados, plantasUrgentes) {
  const slides = [];
  const tarefas = dados.tarefasAtencao || [];
  const contas = dados.contasAtencao || [];
  const estoque = dados.estoqueAtencao || [];

  if (tarefas.length) slides.push({
    type: 'task',
    title: tarefas[0].titulo,
    subtitle: tarefas.length === 1 ? '1 tarefa pendente para hoje' : `${tarefas.length} tarefas pendentes para hoje`,
  });
  if (plantasUrgentes > 0) slides.push({
    type: 'plant',
    title: `${plantasUrgentes} ${plantasUrgentes === 1 ? 'planta precisa' : 'plantas precisam'} de cuidado`,
    subtitle: 'Confira os cuidados pendentes em Plantas',
  });
  if (contas.length) slides.push({
    type: 'bill',
    title: contas[0].nome,
    subtitle: contas[0].status === 'vencida' ? 'Conta vencida' : contas[0].status === 'vence_hoje' ? 'Conta vence hoje' : 'Conta próxima do vencimento',
  });
  const criticos = estoque.filter(item => item.critico || item.status === 'acabou');
  if (criticos.length) slides.push({
    type: 'stock',
    title: `${criticos[0].nome}${criticos[0].status === 'acabou' ? ' acabou' : ' está acabando'}`,
    subtitle: criticos.length === 1 ? 'Item do estoque precisa de atenção' : `${criticos.length} itens precisam de atenção`,
  });

  if (!slides.length) {
    const refeicao = refeicaoDoHorario(dados.cardapioHoje);
    if (refeicao?.nome) slides.push({
      type: 'meal',
      title: refeicao.nome,
      subtitle: `${labelTipoCardapio(refeicao.tipo)} planejado para este horário`,
    });
  }

  return slides.length ? slides : [{ type: 'check', title: 'Tudo em dia!', subtitle: 'Nenhuma pendência importante para agora' }];
}

function ensureHeroIcon(hero) {
  let icon = hero?.querySelector('.qa-hero-icon');
  if (icon) return icon;
  icon = document.createElement('div');
  icon.className = 'qa-hero-icon';
  hero?.querySelector('.hero-kicker')?.insertAdjacentElement('afterend', icon);
  hero?.classList.add('qa-hero-rotator');
  return icon;
}

function renderHeroSlide() {
  const title = el('heroTitulo');
  const subtitle = el('heroSub');
  const hero = el('heroHoje');
  if (!title || !subtitle || !hero || !heroSlides.length) return;
  const slide = heroSlides[heroIndex % heroSlides.length];
  title.textContent = slide.title;
  subtitle.textContent = slide.subtitle;
  const icon = ensureHeroIcon(hero);
  if (icon) icon.innerHTML = svg(slide.type, 20);
}

function renderHero(dados, plantasUrgentes) {
  window.clearInterval(heroTimer);
  heroSlides = buildHeroSlides(dados, plantasUrgentes);
  heroIndex = 0;
  renderHeroSlide();
  if (heroSlides.length > 1) {
    heroTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      heroIndex = (heroIndex + 1) % heroSlides.length;
      renderHeroSlide();
    }, 8000);
  }
}

function renderMetrics(dados) {
  const mount = el('metricasHoje');
  if (!mount) return;
  const tarefas = dados.tarefasAtencao?.length || 0;
  const contas = dados.contasAtencao?.length || 0;
  const compras = dados.compras?.total || 0;
  const estoque = dados.estoqueAtencao?.length || 0;
  mount.innerHTML = `
    <div class="metrica mi-sage clicavel" role="button" tabindex="0" data-ui-destination="tarefas"><div class="metrica-icon">${svg('tasks',22)}</div><div class="metrica-num">${tarefas}</div><div class="metrica-label">Tarefas</div></div>
    <div class="metrica mi-clay clicavel" role="button" tabindex="0" data-ui-destination="contas"><div class="metrica-icon">${svg('bill',22)}</div><div class="metrica-num">${contas}</div><div class="metrica-label">Contas</div></div>
    <div class="metrica mi-sky clicavel" role="button" tabindex="0" data-ui-destination="compras"><div class="metrica-icon">${svg('cart',22)}</div><div class="metrica-num">${compras}</div><div class="metrica-label">Lista</div></div>
    <div class="metrica mi-sun clicavel" role="button" tabindex="0" data-ui-destination="estoque"><div class="metrica-icon">${svg('box',22)}</div><div class="metrica-num">${estoque}</div><div class="metrica-label">Estoque</div></div>
    <div class="metrica mi-sage clicavel metrica-cardapio" role="button" tabindex="0" data-ui-destination="cardapio" aria-label="Abrir Cardápio"><div class="metrica-icon">${svg('meal',22)}</div><div class="metrica-cardapio-copy"><div class="metrica-cardapio-titulo">Cardápio da Casa</div><div class="metrica-label">Almoço e jantar da semana</div></div><span class="metrica-cardapio-acao">Abrir</span></div>`;
}

function criarCartao(titulo, destino, quantidade = 0) {
  const wrap = document.createElement('div');
  wrap.className = 'card-hoje';
  const card = document.createElement('div');
  card.className = 'cartao qa-collapsible-card qa-collapsed';
  card.dataset.qaDestination = destino;
  card.dataset.qaCollapseInitialized = '1';

  const header = document.createElement('div');
  header.className = 'card-hoje-head';
  header.dataset.qaCollapse = '1';
  const titleRow = document.createElement('div');
  titleRow.className = 'card-hoje-title-row';
  const iconMap = { tarefas:'task', plantas:'plant', estoque:'box', compras:'cart', contas:'bill' };
  const iconNode = document.createElement('span');
  iconNode.className = 'card-hoje-head-icon';
  iconNode.innerHTML = svg(iconMap[destino] || 'check', 17);
  const title = document.createElement('div');
  title.className = 'card-hoje-titulo-txt';
  title.textContent = titulo;
  if (quantidade > 0) {
    const badge = document.createElement('span');
    badge.className = 'qa-card-count';
    badge.textContent = String(quantidade);
    badge.setAttribute('aria-label', `${quantidade} itens`);
    title.appendChild(badge);
  }
  titleRow.append(iconNode, title);

  const actions = document.createElement('div');
  actions.className = 'qa-card-actions';
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'card-hoje-abrir qa-card-open';
  open.textContent = destino === 'contas' ? 'Ver todas' : 'Abrir';
  open.dataset.uiDestination = destino;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'qa-card-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', `Expandir ${titulo}`);
  toggle.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  toggle.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const collapsed = card.classList.toggle('qa-collapsed');
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.setAttribute('aria-label', `${collapsed ? 'Expandir' : 'Recolher'} ${titulo}`);
  });
  actions.append(open, toggle);
  header.append(titleRow, actions);

  const body = document.createElement('div');
  body.className = 'qa-card-body';
  card.append(header, body);
  wrap.appendChild(card);
  return { wrap, body };
}

function miniItem(nome, meta = '', valor = '') {
  const row = document.createElement('div');
  row.className = 'mini-item';
  const main = document.createElement('span');
  main.textContent = nome;
  const detail = document.createElement('span');
  detail.className = 'mini-meta';
  detail.textContent = [meta, valor].filter(Boolean).join(' · ');
  row.append(main, detail);
  return row;
}

function contaItem(conta) {
  const row = document.createElement('div');
  row.className = 'mini-item hoje-conta-item';
  const copy = document.createElement('div');
  copy.className = 'hoje-conta-copy';
  const nome = document.createElement('span');
  nome.textContent = conta.nome;
  const meta = document.createElement('span');
  meta.className = 'mini-meta';
  const situacao = conta.status === 'vencida' ? 'Vencida' : conta.status === 'vence_hoje' ? 'Vence hoje' : conta.dias === 1 ? 'Vence amanhã' : `Vence em ${Math.max(0, Number(conta.dias || 0))} dias`;
  meta.textContent = `${dinheiro(conta.valor)} · ${situacao}`;
  copy.append(nome, meta);
  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'hoje-conta-acao';
  action.textContent = 'Pagar';
  action.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent('lifeos:hoje-abrir-conta', { detail: { contaId: conta.id } }));
  });
  row.append(copy, action);
  return row;
}

function criarDestaqueRefeicao(cardapio) {
  const item = refeicaoDoHorario(cardapio);
  if (!item?.nome) return null;
  const button = document.createElement('button');
  button.id = 'acMobileDestaque';
  button.type = 'button';
  button.className = 'ac-mobile-highlight';
  const responsavel = responsavelTexto(item.responsavel);
  button.innerHTML = `
    <span class="ac-mobile-icon">${svg('meal',21)}</span>
    <span class="ac-mobile-text"><small>${labelTipoCardapio(item.tipo)} de hoje</small><strong></strong>${responsavel ? '<span></span>' : ''}</span>
    <span class="ac-mobile-chevron">${svg('chevron',18)}</span>`;
  button.querySelector('strong').textContent = item.nome;
  const detail = button.querySelector('.ac-mobile-text > span');
  if (detail) detail.textContent = `Responsável: ${responsavel}`;
  button.addEventListener('click', () => {
    window.trocarAba?.('casa');
    window.setTimeout(() => window.trocarSub?.('cardapio', document.querySelector('.sub-aba[data-sub="cardapio"]')), 60);
  });
  return button;
}

function renderCards(dados, plantasUrgentes) {
  const mount = el('cardsHoje');
  if (!mount) return;
  mount.innerHTML = '';

  const refeicao = criarDestaqueRefeicao(dados.cardapioHoje);
  if (refeicao) mount.appendChild(refeicao);

  const contas = dados.contasAtencao || [];
  const contaCard = criarCartao('Contas próximas', 'contas', contas.length);
  if (contas.length) contas.slice(0, 4).forEach(conta => contaCard.body.appendChild(contaItem(conta)));
  else contaCard.body.innerHTML = '<div class="vazio hoje-card-vazio">Nenhum vencimento próximo.</div>';
  mount.appendChild(contaCard.wrap);

  if (plantasUrgentes > 0) {
    const card = criarCartao('Plantas', 'plantas', plantasUrgentes);
    card.body.appendChild(miniItem(`${plantasUrgentes} ${plantasUrgentes === 1 ? 'planta precisa' : 'plantas precisam'} de cuidado`));
    mount.appendChild(card.wrap);
  }

  const tarefas = dados.tarefasAtencao || [];
  if (tarefas.length) {
    const card = criarCartao('Tarefas da Casa', 'tarefas', tarefas.length);
    tarefas.forEach(tarefa => {
      const responsavel = tarefa.responsavel === 'ambos' ? 'Ambos' : String(tarefa.responsavel || '').replace(/^./, char => char.toUpperCase());
      card.body.appendChild(miniItem(tarefa.titulo, responsavel));
    });
    mount.appendChild(card.wrap);
  }

  const estoque = dados.estoqueAtencao || [];
  if (estoque.length) {
    const card = criarCartao('Estoque em atenção', 'estoque', estoque.length);
    estoque.forEach(item => card.body.appendChild(miniItem(item.nome, `${item.quantidade} · ${item.status === 'acabou' ? 'acabou' : 'baixo'}`)));
    mount.appendChild(card.wrap);
  }

  if (dados.compras?.total) {
    const card = criarCartao('Compras', 'compras', dados.compras.total);
    dados.compras.primeiros.forEach(nome => card.body.appendChild(miniItem(nome)));
    if (dados.compras.total > dados.compras.primeiros.length) card.body.appendChild(miniItem(`+ mais ${dados.compras.total - dados.compras.primeiros.length} na lista`));
    mount.appendChild(card.wrap);
  }

  if (dados.tudoEmDia && plantasUrgentes === 0 && !refeicao) {
    const wrap = document.createElement('div');
    wrap.className = 'card-hoje';
    wrap.innerHTML = '<div class="cartao"><div class="tudo-em-dia">Tudo em dia por aqui.</div></div>';
    mount.appendChild(wrap);
  }
}

export function renderizarHoje({ dados, plantasUrgentes = 0 }) {
  if (!dados) return;
  ensureStyle();
  ensureHeading();
  renderHero(dados, plantasUrgentes);
  renderMetrics(dados);
  renderCards(dados, plantasUrgentes);
}
