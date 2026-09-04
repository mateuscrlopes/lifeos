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
  assert.match(js, /foodv2:\$\{isoLocal\(\)\}:\$\{refeicao\}/);
});

test('Ritmo food v2 oferece receita salva ou montagem por ingredientes', () => {
  const js = read('public/ritmo-food-v2.js');
  assert.match(js, /Escolher refeição/);
  assert.match(js, /Montar refeição/);
  assert.match(js, /Aceitar e registrar/);
  assert.match(js, /Buscar refeição salva/);
});

test('Ritmo food v2 substitui controles alimentares duplicados', () => {
  const js = read('public/ritmo-food-v2.js');
  assert.match(js, /\.ritmo-now-section/);
  assert.match(js, /\.ritmo-plano-hoje-section/);
  assert.match(js, /alimentacao de hoje/);
  assert.match(js, /foodv2-old-hidden/);
});

test('alimentacao unificada carrega apenas no almoco e jantar', () => {
  const status = read('public/app-bootstrap.js');
  const loader = read('public/ritmo-food-v2-loader.js');
  assert.match(status, /ritmo-food-v2-loader\.js\?v=1/);
  assert.doesNotMatch(status, /import '\.\/ritmo-food-v2\.js\?v=1'/);
  assert.match(loader, /hora >= 12 && hora < 15/);
  assert.match(loader, /hora >= 18/);
  assert.match(loader, /import\('\.\/ritmo-food-v2\.js\?v=1'\)/);
});

test('Ritmo food v2 tem UI mobile com touch targets e resumo simples', () => {
  const css = read('public/ritmo-food-v2.css');
  const js = read('public/ritmo-food-v2.js');
  assert.match(css, /min-height:44px/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /@media\(max-width:390px\)/);
  assert.match(css, /foodv2-day-summary/);
  assert.match(js, /dayTotals/);
});