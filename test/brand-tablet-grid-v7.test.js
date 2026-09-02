import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('mobile exibe apenas uma marca by GhuMat', () => {
  const html = read('public/index.html');
  const acertos = read('public/acertos.js');
  const css = read('public/product-polish-v4.css');
  assert.ok(html.includes('class="header-logo-by">by GhuMat'));
  assert.ok(!acertos.includes('function brand('));
  assert.ok(!acertos.includes("by.textContent = 'by GhuMat'"));
  assert.match(css, /\.header-logo::after[\s\S]*content:\s*none\s*!important/);
});

test('tablet usa o mesmo arquivo de logo do app', () => {
  const mobile = read('public/index.html');
  const tablet = read('public/tablet.html');
  const logo = 'https://awuapqiueykslecwxyaz.supabase.co/storage/v1/object/public/fotos/logo%20life%20os.png';
  assert.ok(mobile.includes(logo));
  assert.ok((tablet.split(logo).length - 1) >= 4);
});

test('dashboard tablet organiza seis módulos em pares alinhados', () => {
  const css = read('public/tablet-app-shell-v3.css');
  const painel = read('public/painel-casa.js');
  assert.match(css, /grid-template-areas:[\s\S]*"tarefas destaques compras"[\s\S]*"plantas contas estoque"/);
  assert.match(css, /display:\s*contents\s*!important/);
  assert.ok(painel.includes('panel.hidden = false'));
});

test('cache v7 força atualização no mobile e tablet', () => {
  const status = read('public/status-estoque.js');
  const polish = read('public/product-polish-v4.js');
  const enhancements = read('public/tablet-enhancements.js');
  const tablet = read('public/tablet.html');
  assert.ok(status.includes('product-polish-v4.js?v=3'));
  assert.ok(polish.includes('product-polish-v4.css?v=3'));
  assert.ok(enhancements.includes('painel-casa.js?v=4'));
  assert.ok(tablet.includes('tablet-app-shell-v3.js?v=6'));
});

test('tablet usa navegação principal igual ao app aprovado', () => {
  const tablet = read('public/tablet.html');
  for (const item of ['Hoje','Ritmo','Financeiro','Plantas','Mais']) assert.match(tablet, new RegExp(`>\\s*${item}\\s*<`));
  assert.match(tablet, /sidebar-profile/);
  assert.match(tablet, /abrirModuloApp\('ritmo'\)/);
});