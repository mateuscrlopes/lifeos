import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('mobile v4 corrige overflow de inputs e campos iOS', () => {
  const css = read('public/product-polish-v4.css');

  assert.match(css, /box-sizing:\s*border-box/);
  assert.match(css, /input\[type="date"\][\s\S]*min-inline-size:\s*0/i);
  assert.match(css, /max-width:\s*100%\s*!important/);
  assert.match(css, /#ctValor/);
  assert.match(css, /#ctVenc/);
});

test('home remove efeito de card dentro de card', () => {
  const css = read('public/product-polish-v4.css');

  assert.match(css, /\.card-hoje\s*\{[\s\S]*border:\s*0\s*!important/);
  assert.match(css, /\.card-hoje\s*>\s*\.cartao[\s\S]*overflow:\s*hidden/);
  assert.match(css, /card-hoje-head[\s\S]*linear-gradient/);
});

test('Central Financeira usa um módulo visual integrado em três ritmos', () => {
  const css = read('public/product-polish-v4.css');

  assert.match(css, /#cfCentral[\s\S]*border-radius:\s*30px/);
  assert.match(css, /#cfCentral \.cf-central-cabecalho[\s\S]*linear-gradient/);
  assert.match(css, /#cfCentral #cfeInbox[\s\S]*border-radius:\s*0/);
  assert.match(css, /#cfCentral \.cf-resumo[\s\S]*grid-template-columns/);
});

test('acabamento v4 carrega depois do shell funcional', () => {
  const status = read('public/status-estoque.js');

  assert.match(status, /mobile-shell-v3\.js\?v=1/);
  assert.match(status, /product-polish-v4\.js\?v=1/);
  assert.ok(
    status.lastIndexOf('product-polish-v4.js') > status.lastIndexOf('mobile-shell-v3.js'),
    'product polish precisa carregar depois do shell'
  );
});

test('tablet recebe acabamento próprio sem copiar layout mobile', () => {
  const html = read('public/tablet.html');
  const css = read('public/tablet-product-shell-v2.css');

  assert.match(html, /tablet-product-shell-v2\.css\?v=1/);
  assert.match(css, /\.conteudo-grid[\s\S]*grid-template-columns:\s*minmax\(0, 1\.25fr\)/);
  assert.match(css, /@media \(max-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /@media \(max-height: 700px\) and \(orientation: landscape\)/);
});

test('tablet usa módulos integrados e tipografia sans', () => {
  const css = read('public/tablet-product-shell-v2.css');

  assert.match(css, /\.panel[\s\S]*padding:\s*0\s*!important/);
  assert.match(css, /\.panel-head[\s\S]*border-bottom/);
  assert.match(css, /font-family:\s*var\(--sans\)\s*!important/);
});

test('LifeOS foi versionado para 0.32.0', () => {
  const server = read('src/server.js');
  assert.match(server, /0\.32\.0/);
});
