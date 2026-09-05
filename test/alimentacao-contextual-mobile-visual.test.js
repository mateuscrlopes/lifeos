import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = caminho =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('faixa contextual duplicada não participa do layout do Hoje', () => {
  const css = ler('public/hoje.css');
  assert.match(css, /#cardsHoje > #acMobileDestaque\s*\{[\s\S]*display:\s*none\s*!important/);
});

test('Cardápio da Casa permanece como destaque oficial de refeição no Hoje', () => {
  const hoje = ler('public/hoje-view.js');
  const phase3 = ler('public/phase3-polish.css');
  assert.match(hoje, /metrica-cardapio/);
  assert.match(hoje, /Cardápio da Casa/);
  assert.match(phase3, /#metricasHoje \.metrica-cardapio/);
});

test('shim antigo não injeta mais CSS concorrente no mobile', () => {
  const js = ler('public/alimentacao-contextual-mobile-fix.js');
  const html = ler('public/index.html');
  assert.doesNotMatch(js, /alimentacao-contextual-mobile-fix\.css/);
  assert.match(html, /href="\/hoje\.css\?v=2"/);
});
