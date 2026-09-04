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

test('celular remove o cardápio antigo antes do destaque compacto', () => {
  const codigo = ler('public/alimentacao-contextual.js');
  assert.match(codigo, /removerCardapioPadraoMobile/);
  assert.match(codigo, /Cardápio de hoje/);
  assert.match(codigo, /acMobileDestaque/);
});

test('instalação usa módulo completo no tablet e correção compacta no celular', () => {
  const tablet = ler('public/tablet-enhancements.js');
  const mobile = ler('public/app.js');
  const status = ler('public/app-bootstrap.js');
  assert.match(tablet, /alimentacao-contextual\.js\?v=2/);
  assert.match(mobile, /alimentacao-contextual-mobile-fix\.js\?v=2/);
  assert.doesNotMatch(status, /alimentacao-contextual\.js\?v=2/);
});
