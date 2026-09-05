import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = caminho =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('shim legado de alimentação mobile não disputa mais a tela Hoje', () => {
  const codigo = ler('public/alimentacao-contextual-mobile-fix.js');
  assert.doesNotMatch(codigo, /MutationObserver|document\.|querySelector|cardsHoje|acMobileDestaque/);
  assert.match(codigo, /hoje-view\.js/);
});

test('Hoje é o único renderer do destaque contextual de refeição no mobile', () => {
  const hoje = ler('public/hoje-view.js');
  assert.match(hoje, /function criarDestaqueRefeicao/);
  assert.match(hoje, /button\.id = 'acMobileDestaque'/);
  assert.match(hoje, /renderCards\(dados, plantasUrgentes\)/);
});

test('destaque vazio nunca reserva uma barra na tela Hoje', () => {
  const css = ler('public/hoje.css');
  assert.match(css, /#cardsHoje > #acMobileDestaque:empty[\s\S]*display:\s*none\s*!important/);
});

test('ações da lista de compras permanecem estáveis mesmo antes da iconização', () => {
  const css = ler('public/styles/components.css');
  assert.match(css, /#itens \.item > div:last-child[\s\S]*display:\s*flex\s*!important/);
  assert.match(css, /button:first-child:not\(\.ui-purchase-action\):not\(\[data-ui-action="purchase"\]\)/);
  assert.match(css, /button:nth-child\(2\)|> button \{/);
});

test('compatibilidade continua carregada sem criar um segundo owner', () => {
  const app = ler('public/app.js');
  const status = ler('public/app-bootstrap.js');
  assert.match(app, /alimentacao-contextual-mobile-fix\.js\?v=2/);
  assert.doesNotMatch(status, /alimentacao-contextual\.js\?v=1/);
});
