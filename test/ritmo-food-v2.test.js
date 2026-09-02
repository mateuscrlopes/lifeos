import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Ritmo food v2 usa catalogo deterministico sem IA', () => {
  const js = read('public/ritmo-food-v2.js');
  assert.match(js, /const FOOD = \[/);
  assert.match(js, /grupo:'proteina'/);
  assert.match(js, /grupo:'carbo'/);
  assert.match(js, /grupo:'vegetal'/);
  assert.doesNotMatch(js, /openai|gemini|anthropic|llm/i);
});

test('Ritmo food v2 calcula macros por gramas', () => {
  const js = read('public/ritmo-food-v2.js');
  assert.match(js, /Number\(row\.g\|\|0\)\/100/);
  assert.match(js, /a\.kcal\+=food\.kcal\*k/);
  assert.match(js, /a\.p\+=food\.p\*k/);
  assert.match(js, /a\.c\+=food\.c\*k/);
});

test('Ritmo food v2 sincroniza planejamento e consumo', () => {
  const js = read('public/ritmo-food-v2.js');
  assert.match(js, /from\('planejamento_semana'\)/);
  assert.match(js, /from\('planejamento_dias'\)/);
  assert.match(js, /from\('ritmo_consumos'\)/);
  assert.match(js, /referencia_chave/);
});

test('Ritmo food v2 oferece receita salva ou montagem por ingredientes', () => {
  const js = read('public/ritmo-food-v2.js');
  assert.match(js, /Escolher refeição/);
  assert.match(js, /Montar refeição/);
  assert.match(js, /Aceitar sugestão/);
  assert.match(js, /Buscar refeição salva/);
});

test('Ritmo food v2 tem UI mobile com touch targets', () => {
  const css = read('public/ritmo-food-v2.css');
  assert.match(css, /min-height:44px/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /@media\(max-width:390px\)/);
});