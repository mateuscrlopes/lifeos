import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = caminho =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('correção mobile consulta somente a refeição do horário atual', () => {
  const codigo = ler('public/alimentacao-contextual-mobile-fix.js');
  assert.match(codigo, /\.eq\('tipo', tipoAtual\(\)\)/);
  assert.match(codigo, /maybeSingle/);
});

test('hero antigo é corrigido quando usa cardápio genérico', () => {
  const codigo = ler('public/alimentacao-contextual-mobile-fix.js');
  assert.match(codigo, /Cardápio planejado para hoje/);
  assert.match(codigo, /corrigirHero/);
});

test('correção é carregada diretamente pelo app.js', () => {
  const app = ler('public/app.js');
  const status = ler('public/status-estoque.js');
  assert.match(app, /alimentacao-contextual-mobile-fix\.js\?v=1/);
  assert.doesNotMatch(status, /alimentacao-contextual\.js\?v=1/);
});
