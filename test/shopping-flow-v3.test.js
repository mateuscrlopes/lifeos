import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('compras v3 carrega antes dos módulos legados para ser dona dos cliques rápidos', () => {
  const bootstrap = read('public/app-bootstrap.js');
  const ownerImport = "await import('./shopping-flow-v3.js?v=1');";
  const legacyLoop = 'for (const modulePath of LEGACY_MODULES)';
  assert.match(bootstrap, /shopping-flow-v3\.js\?v=1/);
  assert.ok(bootstrap.indexOf(ownerImport) >= 0);
  assert.ok(bootstrap.indexOf(legacyLoop) >= 0);
  assert.ok(bootstrap.indexOf(ownerImport) < bootstrap.indexOf(legacyLoop));
});

test('estoque usa saldo real e passo explícito sem inferir incremento oculto pela unidade', () => {
  const flow = read('public/shopping-flow-v3.js');
  assert.match(flow, /Number\(stock\.passo_ajuste\) > 0 \? Number\(stock\.passo_ajuste\) : 1/);
  assert.match(flow, /current \+ direction \* step/);
  assert.doesNotMatch(flow, /unit\s*===\s*['\"]g['\"][\s\S]{0,120}?100/);
  assert.doesNotMatch(flow, /unit\s*===\s*['\"]ml['\"][\s\S]{0,120}?100/);
  assert.match(flow, /sincronizarItem/);
});

test('preparação da compra busca estoque e atualiza item já pendente em vez de duplicar', () => {
  const flow = read('public/shopping-flow-v3.js');
  assert.match(flow, /sfv3StockSearch/);
  assert.match(flow, /data-sfv3-add-list/);
  assert.match(flow, /S\.pending\.find\(item => item\.estoque_id === stock\.id\)/);
  assert.match(flow, /Atualizar lista/);
});

test('mercado tem busca, um toque para pegar o planejado e editor para exceções', () => {
  const flow = read('public/shopping-flow-v3.js');
  assert.match(flow, /sfv3MarketSearch/);
  assert.match(flow, /async function quickAddMarket/);
  assert.match(flow, /quantidade_comprada: roundQty\(plannedQty\)/);
  assert.match(flow, /async function openMarketEditor/);
});

test('preço é digitado em centavos e subtotal considera quantidade x preço unitário', () => {
  const flow = read('public/shopping-flow-v3.js');
  assert.match(flow, /input\.value\.replace\(\/\\D\/g, ''\)/);
  assert.match(flow, /preco_unitario_compra: unitPrice/);
  assert.match(flow, /Math\.round\(unitPrice \* amount \* 100\) \/ 100/);
});

test('item inesperado procura lista e estoque antes de criar item novo', () => {
  const flow = read('public/shopping-flow-v3.js');
  assert.match(flow, /Primeiro procuro na lista e no estoque para evitar duplicatas/);
  assert.match(flow, /exactPending/);
  assert.match(flow, /exactStock/);
  assert.match(flow, /origem: 'mercado_inesperado'/);
});

test('normalização preserva modificadores como grego, integral e zero', () => {
  const flow = read('public/shopping-flow-v3.js');
  assert.doesNotMatch(flow, /tradicional\|integral\|natural\|zero\|light/);
  assert.match(flow, /replace\(\/\[\^a-z0-9\]\+\/g, ' '\)/);
});

test('NFC-e fica acima dos modais de compras', () => {
  const flow = read('public/shopping-flow-v3.js');
  assert.match(flow, /\.nfce-overlay\{z-index:470!important\}/);
});

test('migração v3 separa quantidade ideal, passo de ajuste e preço unitário', () => {
  const sql = read('db/058_shopping_flow_v3.sql');
  assert.match(sql, /quantidade_ideal numeric/);
  assert.match(sql, /passo_ajuste numeric not null default 1/);
  assert.match(sql, /preco_unitario_compra numeric/);
  assert.match(sql, /preco_unitario numeric/);
});
