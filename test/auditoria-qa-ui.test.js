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
