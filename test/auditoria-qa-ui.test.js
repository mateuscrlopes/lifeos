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


test('cards do Hoje separam abrir de expandir sem navegação no cartão inteiro', () => {
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

test('modais com X não exibem falsa alça de arraste e usam uma única superfície', () => {
  const ui = read('public/ui-refinements.js');
  const css = read('public/audit-qa-polish.css');

  assert.doesNotMatch(ui, /<div class="ui-sheet-handle"><\/div>/);
  assert.match(css, /\.ui-sheet-handle\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /\.modal-header,[\s\S]*\.ui-sheet-head,[\s\S]*background:\s*var\(--paper\)\s*!important/);
});

test('clima mobile tem consulta direta, backend e cache local', () => {
  const app = read('public/app.js');
  assert.match(app, /CLIMA_MOBILE_DIRETO_URL/);
  assert.match(app, /api\.open-meteo\.com/);
  assert.match(app, /CLIMA_MOBILE_CACHE_KEY/);
  assert.match(app, /fetch\('\/clima'/);
  assert.match(app, /Clima indisponível/);
});

test('confirmações principais usam diálogo do LifeOS em vez de OK e Cancelar do navegador', () => {
  const app = read('public/app.js');
  assert.match(app, /confirmarAcao\('Limpar cardápio'/);
  assert.match(app, /confirmarAcao\('Excluir receita'/);
  assert.match(app, /confirmarAcao\('Remover planta'/);
  assert.match(app, /confirmarAcao\('Excluir local de compra'/);
  assert.match(app, /confirmarAcao\('Conta recorrente'/);
});

test('cache da rodada visual é incrementado no mobile e tablet', () => {
  const status = read('public/status-estoque.js');
  const app = read('public/app.js');
  const html = read('public/index.html');
  const tabletEnhancements = read('public/tablet-enhancements.js');
  const tabletHtml = read('public/tablet.html');

  assert.match(status, /audit-qa-polish\.js\?v=2/);
  assert.match(app, /status-estoque\.js\?v=3/);
  assert.match(html, /app\.js\?v=12/);
  assert.match(tabletEnhancements, /audit-qa-polish\.js\?v=2/);
  assert.match(tabletHtml, /tablet-enhancements\.js\?v=3/);
});
