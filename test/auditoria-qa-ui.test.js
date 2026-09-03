import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('auditoria QA impede zoom automático do iOS e remove salto de botões', () => {
  const css = read('public/audit-qa-polish.css');
  assert.match(css, /font-size:\s*16px\s*!important/);
  assert.match(css, /button:not\(:disabled\):active[\s\S]*transform:\s*none\s*!important/);
});

test('Hoje possui separador, destaque rotativo e cards recolhíveis', () => {
  const js = read('public/audit-qa-polish.js');
  const css = read('public/audit-qa-polish.css');
  for (const token of ['qa-meta-separator', 'loadHeroSlides', 'tarefas', 'plantas', 'contas', 'estoque', 'rituais', 'qa-card-toggle']) {
    assert.match(js + css, new RegExp(token));
  }
  assert.match(js, /8000/);
});

test('Compras, estoque e tarefas recebem correções estruturais da auditoria', () => {
  const js = read('public/audit-qa-polish.js');
  const css = read('public/audit-qa-polish.css');
  assert.match(css, /#subCompras \.linha-add/);
  assert.match(css, /\.ui-purchase-action/);
  assert.match(js, /qa-no-drag-handle/);
  assert.match(js, /restructureStockForm/);
  assert.match(css, /#tfData,[\s\S]*#etData/);
  assert.match(js, /lifeosConfirmRecurringTask/);
  assert.match(js, /lifeosConfirmAction/);
});

test('Cardápio abre receita no prato e mantém edição como ação separada', () => {
  const app = read('public/app.js');
  const recipes = read('public/receitas-v2.js');
  const css = read('public/audit-qa-polish.css');
  assert.match(app, /dataset\.receitaId/);
  assert.match(app, /lifeosAbrirReceita/);
  assert.match(app, /qa-slot-edit/);
  assert.match(recipes, /lifeosAbrirReceita/);
  assert.match(css, /grid-auto-flow:\s*column/);
  assert.match(css, /scroll-snap-type:\s*x/);
});

test('Plantas retiram filtros de cômodo misturados aos filtros de prazo', () => {
  const css = read('public/audit-qa-polish.css');
  assert.match(css, /data-filtro="sala"/);
  assert.match(css, /data-filtro="outros"/);
  assert.match(css, /display:\s*none\s*!important/);
});

test('camada QA é carregada no mobile e tablet', () => {
  const status = read('public/status-estoque.js');
  const tablet = read('public/tablet-enhancements.js');
  assert.match(status, /audit-qa-polish\.js/);
  assert.match(tablet, /audit-qa-polish\.js/);
});


test('ações principais não dependem de confirm nativo do iOS', () => {
  const app = read('public/app.js');
  const refinements = read('public/ui-refinements.js');
  assert.match(app, /confirmarLifeOS/);
  assert.match(app, /Limpar cardápio da semana/);
  assert.match(app, /Remover da lista/);
  assert.match(app, /Excluir do estoque/);
  assert.match(refinements, /uiConfirm/);
  assert.doesNotMatch(app, /if\s*\(!confirm\(/);
  assert.doesNotMatch(refinements, /const accepted = window\.confirm/);
});

test('degradê inferior fica restrito à área próxima da barra', () => {
  const css = read('public/audit-qa-polish.css');
  assert.match(css, /--qa-bottom-fade-height:\s*calc\(24px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.doesNotMatch(css, /--qa-bottom-fade-height:\s*calc\(104px/);
});

test('cache da correção de confirmação é incrementado', () => {
  const html = read('public/index.html');
  const app = read('public/app.js');
  const status = read('public/status-estoque.js');
  const qa = read('public/audit-qa-polish.js');
  const tablet = read('public/tablet.html');
  assert.match(html, /app\.js\?v=13/);
  assert.match(app, /status-estoque\.js\?v=4/);
  assert.match(status, /ui-refinements\.js\?v=8/);
  assert.match(status, /audit-qa-polish\.js\?v=3/);
  assert.match(qa, /audit-qa-polish\.css\?v=3/);
  assert.match(tablet, /tablet-enhancements\.js\?v=4/);
});


test('cards do Hoje separam navegação de expansão', () => {
  const app = read('public/app.js');
  const ui = read('public/ui-refinements.js');
  const audit = read('public/audit-qa-polish.js');
  const finance = read('public/central-financeira.js');

  assert.match(app, /qa-card-actions/);
  assert.match(app, /qa-card-open/);
  assert.match(app, /qa-collapsible-card qa-collapsed/);
  assert.match(ui, /event\.target\.closest\('\.qa-card-toggle'\)/);
  assert.match(ui, /card\.classList\.contains\('qa-collapsible-card'\)/);
  assert.match(audit, /existingAction\.hidden = false/);
  assert.match(finance, /cf-hoje-interior qa-collapsible-card qa-collapsed/);
});

test('sheets com X não exibem alça falsa e usam superfície uniforme', () => {
  const ui = read('public/ui-refinements.js');
  const css = read('public/audit-qa-polish.css');

  assert.doesNotMatch(ui, /<div class="ui-sheet-handle"><\/div>/);
  assert.match(css, /\.ui-sheet-handle\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /\.modal-header,[\s\S]*\.ui-sheet-head,[\s\S]*background:\s*var\(--paper\)\s*!important/);
});

test('clima mobile usa consulta direta, backend e cache local', () => {
  const app = read('public/app.js');

  assert.match(app, /CLIMA_MOBILE_DIRETO_URL/);
  assert.match(app, /api\.open-meteo\.com/);
  assert.match(app, /CLIMA_MOBILE_CACHE_KEY/);
  assert.match(app, /fetch\('\/clima'/);
  assert.match(app, /Clima indisponível/);
});

test('visual QA mantém refinamento de planner, plantas e controles do estoque', () => {
  const css = read('public/audit-qa-polish.css');

  assert.match(css, /\.qa-card-actions/);
  assert.match(css, /\.ui-market-launcher > button[\s\S]*align-items:\s*center/);
  assert.match(css, /#itensEstoque \.est-controles/);
  assert.match(css, /#abaPlantas \.qa-plant-toolbar/);
  assert.match(css, /#subCardapio \.qa-cardapio-week-card/);
  assert.match(css, /grid-auto-columns:\s*122px/);
});
