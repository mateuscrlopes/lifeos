import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('formulários mobile usam grids explícitos e seguros', () => {
  const html = read('public/index.html');
  const css = read('public/product-polish-v4.css');

  assert.match(html, /lifeos-form-grid-2 lifeos-account-grid/);
  assert.match(html, /id="ctValor"/);
  assert.match(html, /id="ctVenc"/);
  assert.match(css, /\.lifeos-form-grid-2/);
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.lifeos-account-grid[\s\S]*grid-template-columns:\s*1fr/i);
  assert.match(css, /-webkit-appearance:\s*none/);
});

test('acertos deixam valor e ações na mesma coluna lateral', () => {
  const js = read('public/acertos.js');
  const css = read('public/product-polish-v4.css');

  assert.match(js, /ac-row-side/);
  assert.doesNotMatch(js, /ac-row-meta[\s\S]*ac-actions[\s\S]*<\/div>' \+\s*'<\/div>' \+\s*'<div class="ac-row-value"/);
  assert.match(css, /#lifeosFinanceiroAcertos \.ac-row-side/);
  assert.match(css, /align-items:\s*flex-end/);
});

test('tablet v3 troca densidade de dashboard por leitura e scroll', () => {
  const css = read('public/tablet-app-shell-v3.css');

  assert.match(css, /\.painel-body[\s\S]*overflow-y:\s*auto\s*!important/);
  assert.match(css, /#pag-inicio \\.conteudo-grid[\\s\\S]*grid-template-columns: repeat\\(3, minmax\\(0, 1fr\\)\\) !important/);
  assert.match(css, /\.col-dir[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(css, /\.hero-banner-bg[\s\S]*display:\s*none\s*!important/);
});

test('home do tablet esconde KPIs e prioriza os seis módulos', () => {
  const html = read('public/tablet.html');
  const css = read('public/tablet-app-shell-v3.css');

  assert.match(html, /id="metricasGrid"/);
  assert.match(css, /#pag-inicio #metricasGrid[\s\S]*display:\s*none\s*!important/);
  assert.match(css, /grid-template-areas:[\s\S]*"tarefas destaques compras"[\s\S]*"plantas contas estoque"/);
});

test('tablet exibe marca GhuMat e shell v3 carrega por último', () => {
  const html = read('public/tablet.html');

  assert.match(html, /header-brand-parent">by GhuMat/);
  assert.match(html, /tablet-app-shell-v3\.js\?v=5/);
  assert.ok(
    html.lastIndexOf('tablet-app-shell-v3.js') > html.lastIndexOf('tablet-product-shell-v2.js'),
    'shell v3 precisa carregar depois do shell v2'
  );
});

test('polish mobile usa cache bust novo e versão é 0.36.0', () => {
  const loader = read('public/product-polish-v4.js');
  const server = read('src/server.js');

  assert.match(loader, /product-polish-v4\.css\?v=3/);
  assert.match(server, /0\.36\.0/);
});


test('tablet v6 abandona contexto legado e preserva hero nativo', () => {
  const painel = read('public/painel-casa.js');
  const css = read('public/tablet-app-shell-v3.css');
  const enhancements = read('public/tablet-enhancements.js');

  assert.doesNotMatch(painel, /painel-casa-v2\.css/);
  assert.match(painel, /limparLayoutLegado/);
  assert.match(painel, /painelContextoCasa/);
  assert.match(css, /#painelContextoCasa[\s\S]*display:\s*none\s*!important/);
  assert.match(css, /\.hero-banner[\s\S]*display:\s*block\s*!important/);
  assert.match(enhancements, /painel-casa\.js\?v=4/);
});

test('tablet v6 mantém shell final mesmo após folhas dinâmicas', () => {
  const loader = read('public/tablet-app-shell-v3.js');
  const html = read('public/tablet.html');

  assert.match(loader, /MutationObserver/);
  assert.match(loader, /HTMLLinkElement/);
  assert.match(loader, /tablet-app-shell-v3\.css\?v=5/);
  assert.match(html, /tablet-app-shell-v3\.js\?v=5/);
});

test('alimentação contextual deixa de parecer faixa tracejada', () => {
  const css = read('public/tablet-app-shell-v3.css');

  assert.match(css, /\.ac-tablet-strip\.ac-is-empty[\s\S]*border-style:\s*solid\s*!important/);
  assert.match(css, /\.ac-tablet-main strong[\s\S]*font-family:\s*var\(--sans\)\s*!important/);
});


test('tema claro do tablet preserva contraste da navegação e dos cards', () => {
  const css = read('public/tablet-app-shell-v3.css');
  assert.match(css, /html:not\(\[data-theme="dark"\]\) #painelCasa \.sidebar[\s\S]*#173124/);
  assert.match(css, /html\[data-theme="light"\] #painelCasa \.sidebar-btn[\s\S]*rgba\(255,255,255,\.72\)/);
  assert.match(css, /html:not\(\[data-theme="dark"\]\) #painelCasa \.panel[\s\S]*background:\s*var\(--paper\)\s*!important/);
  assert.match(css, /color:\s*var\(--texto\)\s*!important/);
});
