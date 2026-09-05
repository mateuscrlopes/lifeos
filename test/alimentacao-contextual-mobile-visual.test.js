import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = caminho =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('CSS oficial do Hoje limita os dois SVGs do destaque mobile', () => {
  const css = ler('public/hoje.css');
  assert.match(css, /#acMobileDestaque \.ac-mobile-icon svg/);
  assert.match(css, /width:\s*21px\s*!important/);
  assert.match(css, /#acMobileDestaque \.ac-mobile-chevron svg/);
  assert.match(css, /width:\s*18px\s*!important/);
});

test('destaque contextual do Hoje possui grid e largura limitada', () => {
  const css = ler('public/hoje.css');
  assert.match(css, /grid-template-columns:\s*44px minmax\(0,\s*1fr\) 20px/);
  assert.match(css, /width:\s*calc\(100% - 40px\)/);
  assert.match(css, /overflow:\s*hidden/);
});

test('shim antigo não injeta mais CSS concorrente no mobile', () => {
  const js = ler('public/alimentacao-contextual-mobile-fix.js');
  const html = ler('public/index.html');
  assert.doesNotMatch(js, /alimentacao-contextual-mobile-fix\.css/);
  assert.match(html, /href="\/hoje\.css\?v=2"/);
});
