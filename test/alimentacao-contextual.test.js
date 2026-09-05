import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = caminho =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('alimentação contextual consulta o planejamento atual', () => {
  const codigo = ler('public/alimentacao-contextual.js');
  assert.match(codigo, /\.from\('planejamento_dias'\)/);
  assert.match(codigo, /planejamento_semana!inner/);
  assert.match(codigo, /refeicao_ingredientes/);
});

test('datas são calculadas no horário local', () => {
  const codigo = ler('public/alimentacao-contextual.js');
  assert.match(codigo, /dataIsoLocal/);
  assert.doesNotMatch(codigo, /toISOString\(\)\.slice\(0,\s*10\)/);
});

test('tablet não usa observador amplo da Home', () => {
  const codigo = ler('public/alimentacao-contextual.js');
  assert.doesNotMatch(
    codigo,
    /observe\(document\.(body|documentElement)/
  );
  assert.match(codigo, /acTabletDestaque/);
});

test('módulo completo preserva a experiência contextual do tablet', () => {
  const codigo = ler('public/alimentacao-contextual.js');
  assert.match(codigo, /Cardápio de hoje/);
  assert.match(codigo, /acTabletDestaque/);
});

test('tablet usa módulo completo e mobile mantém apenas shim de compatibilidade', () => {
  const tablet = ler('public/tablet-enhancements.js');
  const mobile = ler('public/app.js');
  const shim = ler('public/alimentacao-contextual-mobile-fix.js');
  const status = ler('public/app-bootstrap.js');

  assert.match(tablet, /alimentacao-contextual\.js\?v=2/);
  assert.match(mobile, /alimentacao-contextual-mobile-fix\.js\?v=2/);
  assert.doesNotMatch(status, /alimentacao-contextual\.js\?v=2/);
  assert.doesNotMatch(shim, /MutationObserver|cardsHoje|acMobileDestaque|document\./);
});
