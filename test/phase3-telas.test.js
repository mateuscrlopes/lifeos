import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('fase 3 é carregada depois das camadas anteriores do mobile', () => {
  const status = read('public/status-estoque.js');
  const oldPolish = status.indexOf("import './product-polish-v4.js?v=4'");
  const phase3 = status.indexOf("import './phase3-polish.js?v=1'");
  assert.ok(oldPolish >= 0);
  assert.ok(phase3 > oldPolish);
});

test('Hoje consolida indicadores em uma faixa única e mantém Cardápio destacado', () => {
  const css = read('public/phase3-polish.css');
  const js = read('public/phase3-polish.js');
  assert.match(css, /#metricasHoje\.metricas-grid[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /#metricasHoje \.metrica:not\(\.metrica-cardapio\)[\s\S]*box-shadow: none/);
  assert.match(css, /#metricasHoje \.metrica-cardapio[\s\S]*grid-column: 1 \/ -1/);
  assert.match(js, /Agora na Casa/);
});

test('refeições do Hoje recebem ícones vetoriais sem emojis', () => {
  const js = read('public/phase3-polish.js');
  assert.match(js, /const mealIcons =/);
  assert.match(js, /phase3-meal-icon/);
  assert.match(js, /startsWith\('almoço'\)/);
  assert.match(js, /startsWith\('jantar'\)/);
  assert.doesNotMatch(js, /🍽|☕|🥪|🌙/);
});

test('Ritmo reduz a sombra do hero e respeita touch target', () => {
  const css = read('public/phase3-polish.css');
  assert.match(css, /#secaoRitmo \.ritmo-hero[\s\S]*box-shadow: 0 5px 18px/);
  assert.match(css, /#secaoRitmo \.ritmo-tab,[\s\S]*min-height: var\(--touch-target, 44px\)/);
});

test('Plantas ganha overview e cards agrupados por cômodo', () => {
  const css = read('public/phase3-polish.css');
  const js = read('public/phase3-polish.js');
  assert.match(js, /phase3-plant-overview/);
  assert.match(js, /precisam de atenção/);
  assert.match(js, /cuidados hoje/);
  assert.match(js, /capturePlantSnapshot/);
  assert.match(css, /#abaPlantas #listaPlantas[\s\S]*display: grid/);
  assert.match(css, /#abaPlantas \.comodo-titulo[\s\S]*text-transform: none/);
});

test('tablet usa grade alinhada para os seis painéis principais', () => {
  const css = read('public/phase3-tablet.css');
  const loader = read('public/tablet-enhancements.js');
  assert.match(loader, /phase3-tablet\.css\?v=1/);
  assert.match(css, /#pag-casa \.col-esq,[\s\S]*display: contents/);
  assert.match(css, /\.col-esq > \.panel:nth-child\(1\) \{ grid-column: 1; grid-row: 1; \}/);
  assert.match(css, /\.col-mid > \.panel:nth-child\(2\) \{ grid-column: 2; grid-row: 2; \}/);
  assert.match(css, /\.col-dir > \.panel:nth-child\(2\) \{ grid-column: 3; grid-row: 2; \}/);
});

test('Financeiro reduz peso visual sem mudar estrutura funcional', () => {
  const css = read('public/phase3-polish.css');
  assert.match(css, /#cfCentral,[\s\S]*#lifeosFinanceiroAcertos \.ac-central[\s\S]*border-radius: 26px/);
  assert.match(css, /#cfCentral \.cf-central-cabecalho[\s\S]*min-height: 132px/);
  assert.match(css, /#lifeosFinanceiroAcertos \.ac-hero[\s\S]*padding: 18px/);
});
