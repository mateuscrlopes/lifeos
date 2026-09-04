import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('tablet passa a usar navegação nativa focada na Casa', () => {
  const code = read('public/tablet-house-v4.js');
  for (const item of ['Hoje', 'Tarefas', 'Compras', 'Estoque', 'Financeiro', 'Cardápio', 'Plantas']) {
    assert.match(code, new RegExp(item));
  }
  assert.doesNotMatch(code, /\['ritmo',\s*'Ritmo'\]/i);
  assert.match(code, /window\.abrirModuloApp/);
  assert.match(code, /financeiro:\s*'contas'/);
  assert.match(code, /plantas:\s*'plantas'/);
});

test('tablet não redireciona módulos da Casa para o app mobile', () => {
  const code = read('public/tablet-house-v4.js');
  assert.doesNotMatch(code, /window\.location\.assign/);
  assert.match(code, /window\.mudarPagina\(target/);
});

test('cardápio da Casa tem visão semanal e abre receita', () => {
  const code = read('public/tablet-house-v4.js');
  const css = read('public/tablet-house-v4.css');
  assert.match(code, /planejamento_semana/);
  assert.match(code, /planejamento_dias/);
  assert.match(code, /openRecipe/);
  assert.match(code, /refeicao_ingredientes/);
  assert.match(code, /modo_preparo/);
  assert.match(css, /tablet-menu-week/);
  assert.match(css, /grid-template-columns:\s*repeat\(7/);
});

test('plantas do tablet têm visão própria e cuidado registrável', () => {
  const code = read('public/tablet-house-v4.js');
  const css = read('public/tablet-house-v4.css');
  assert.match(code, /planta_rotinas/);
  assert.match(code, /registrar_cuidado_planta/);
  assert.match(code, /tablet-care-button/);
  assert.match(css, /tablet-plant-grid/);
  assert.match(css, /tablet-plant-summary/);
});

test('destaques do tablet deixam de depender do Ritmo pessoal', () => {
  const code = read('public/tablet-house-v4.js');
  assert.match(code, /renderHouseHighlights/);
  assert.doesNotMatch(code, /ritmo_ciclos/);
  assert.match(code, /Cardápio da Casa/);
});

test('tablet enhancements carrega a camada Casa v4', () => {
  const enhancements = read('public/tablet-enhancements.js');
  assert.match(enhancements, /tablet-house-v4\.js\?v=1/);
});
