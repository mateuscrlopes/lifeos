import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = caminho =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('CSS limita os dois SVGs do cartão mobile', () => {
  const css = ler('public/alimentacao-contextual-mobile-fix.css');
  assert.match(css, /\.ac-mobile-icon svg/);
  assert.match(css, /width:\s*21px\s*!important/);
  assert.match(css, /\.ac-mobile-chevron svg/);
  assert.match(css, /width:\s*18px\s*!important/);
});

test('cartão possui grid e largura limitada', () => {
  const css = ler('public/alimentacao-contextual-mobile-fix.css');
  assert.match(css, /grid-template-columns:\s*44px minmax\(0,\s*1fr\) 20px/);
  assert.match(css, /width:\s*calc\(100% - 40px\)/);
  assert.match(css, /overflow:\s*hidden/);
});

test('JavaScript carrega CSS versão 2', () => {
  const js = ler('public/alimentacao-contextual-mobile-fix.js');
  assert.match(js, /alimentacao-contextual-mobile-fix\.css\?v=2/);
});
