import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('controles de estoque usam passo coerente com a unidade', () => {
  const stock = read('public/stock-integrity.js');
  assert.match(stock, /unit === 'g' \|\| unit === 'ml'\) return 100/);
  assert.match(stock, /unit === 'kg' \|\| unit === 'l'\) return 1/);
  assert.match(stock, /current \+ direction \* quantityStep\(item\)/);
  assert.doesNotMatch(stock, /tipo === 'peso_volume' \? 100 : 1/);
});

test('presença continua binária em ajuste, compra e inventário', () => {
  const stock = read('public/stock-integrity.js');
  const bridge = read('public/ponte-estoque.js');
  const inventory = read('public/inventario.js');
  const migration = read('db/056_stock_integrity_and_safe_delete.sql');

  assert.match(stock, /item\.tipo === 'presenca'[\s\S]*direction > 0 \? 1 : 0/);
  assert.match(bridge, /item\.tipo === 'presenca'[\s\S]*qtd > 0 \? 1 : 0/);
  assert.match(inventory, /item\?\.tipo === 'presenca'\) return numero > 0 \? 1 : 0/);
  assert.match(migration, /estoque_presenca_binaria/);
  assert.match(migration, /quantidade in \(0,1\)/);
});

test('exclusão do estoque é atômica e preserva referências derivadas', () => {
  const stock = read('public/stock-integrity.js');
  const migration = read('db/056_stock_integrity_and_safe_delete.sql');

  assert.match(stock, /rpc\('excluir_item_estoque'/);
  assert.match(stock, /row\.remove\(\);[\s\S]*foi removido/);
  assert.match(migration, /references public\.estoque\(id\) on delete set null/g);
  assert.match(migration, /insert into public\.historico_excluidos/);
  assert.match(migration, /delete from public\.estoque where id = p_estoque_id/);
});

test('conferência pós-compra usa quantidade real e RPC atômica', () => {
  const stock = read('public/stock-integrity.js');
  const migration = read('db/057_stock_conference_atomic.sql');

  assert.match(stock, /quantidade_comprada,unidade_comprada/);
  assert.match(stock, /convertQuantity\(boughtQuantity, boughtUnit, stock\.unidade\)/);
  assert.match(stock, /rpc\('confirmar_reposicao_estoque'/);
  assert.match(migration, /aguardando_conferencia = false/);
  assert.match(migration, /set quantidade = quantidade \+ p_quantidade/);
});

test('conversão entre kg-g e L-ml evita somar unidades incompatíveis', () => {
  const stock = read('public/stock-integrity.js');
  assert.match(stock, /from === 'kg' && to === 'g'/);
  assert.match(stock, /from === 'g' && to === 'kg'/);
  assert.match(stock, /from === 'l' && to === 'ml'/);
  assert.match(stock, /from === 'ml' && to === 'l'/);
  assert.match(stock, /return null;[\s\S]*A compra foi registrada/);
});

test('guard do estoque carrega antes do app e participa da validação estática', () => {
  const bootstrap = read('public/app-bootstrap.js');
  const validator = read('scripts/validar.js');
  assert.match(bootstrap, /stock-integrity\.js\?v=1/);
  assert.ok(bootstrap.indexOf('stock-integrity.js') < bootstrap.indexOf("app.js?v=14"));
  assert.match(validator, /public\/stock-integrity\.js/);
  assert.match(validator, /public\/inventario\.js/);
  assert.match(validator, /public\/ponte-estoque\.js/);
});
