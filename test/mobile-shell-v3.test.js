import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('LifeOS possui cinco módulos principais com Financeiro separado', () => {
  const html = ler('public/index.html');
  const app = ler('public/app.js');

  assert.match(html, /id="abaFinanceiro"/);
  assert.match(html, /id="lifeosFinanceiroContas"/);
  assert.match(html, /id="lifeosFinanceiroAcertos"/);
  assert.match(html, /data-tab="financeiro"/);
  assert.match(html, /data-tab="ritmo"/);
  assert.doesNotMatch(html, /data-tab="casa"/);
  assert.match(html, />\s*Hoje\s*<\/button>/);
  assert.match(html, />\s*Ritmo\s*<\/button>/);
  assert.match(app, /'abaFinanceiro'/);
  assert.match(app, /lifeos:financeiro-abrir/);
});

test('Central Financeira e Acertos usam o módulo Financeiro', () => {
  const central = ler('public/central-financeira.js');
  const acertos = ler('public/acertos.js');

  assert.match(central, /lifeosFinanceiroContas/);
  assert.match(central, /trocarAba\('financeiro'/);
  assert.match(acertos, /lifeosFinanceiroAcertos/);
});

test('shell mobile v3 é carregado por último sem duplicar a navegação da home', () => {
  const status = ler('public/status-estoque.js');
  const shell = ler('public/mobile-shell-v3.js');
  const css = ler('public/mobile-shell-v3.css');

  assert.match(status, /mobile-shell-v3\.js\?v=4/);
  assert.ok(
    status.lastIndexOf('mobile-shell-v3.js') > status.lastIndexOf('acertos.js'),
    'shell v3 precisa carregar depois dos módulos funcionais'
  );
  assert.match(shell, /removeLegacyHomeShortcuts/);
  assert.match(shell, /document\.getElementById\('lifeosHomeShortcuts'\)\?\.remove/);
  assert.match(css, /\.tab-bar[\s\S]*border-radius: 24px/);
  assert.match(css, /prefers-reduced-motion/);
});

test('tema usa uma única chave de preferência', () => {
  const design = ler('public/design-system.js');
  const theme = ler('public/theme.js');

  assert.doesNotMatch(design, /lifeos:theme/);
  assert.match(design, /lifeos-theme/);
  assert.match(theme, /lifeos-theme/);
});

test('exclusão de acerto é otimista e reversível em caso de erro', () => {
  const acertos = ler('public/acertos.js');

  assert.match(acertos, /const originalAcertos = A\.acertos\.map/);
  assert.match(acertos, /status: 'cancelado'/);
  assert.match(acertos, /renderCentral\(\);/);
  assert.match(acertos, /A\.acertos = originalAcertos/);
  assert.match(acertos, /window\.lifeosToast/);
});

test('ações de exclusão usam ícone e rótulo acessível', () => {
  const shell = ler('public/mobile-shell-v3.js');
  const acertos = ler('public/acertos.js');

  assert.match(shell, /lifeos-icon-action/);
  assert.match(shell, /aria-label/);
  assert.match(shell, /ICONS\.trash|trash:/);
  assert.match(acertos, /ac-icon-action danger/);
  assert.match(acertos, /aria-label="Excluir acerto"/);
});

test('shell respeita safe area em navegação e modais', () => {
  const css = ler('public/mobile-shell-v3.css');

  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /env\(safe-area-inset-top/);
  assert.match(css, /max-height: calc\(100dvh/);
});

test('Casa é área interna do Hoje e mantém retorno contextual', () => {
  const html = ler('public/index.html');
  const app = ler('public/app.js');
  assert.match(html, /id="casaPageTitle"/);
  assert.match(html, /voltarCasaContextual\(\)/);
  assert.match(app, /const CASA_TITULOS/);
  assert.match(app, /function voltarAbaContextual/);
  assert.match(app, /origemCasa/);
});

test('barra inferior sobe acima do Home Indicator', () => {
  const css = ler('public/mobile-shell-v3.css');
  assert.match(css, /bottom:\s*calc\(14px \+ env\(safe-area-inset-bottom/);
  assert.match(css, /padding-bottom:\s*calc\(112px \+ env\(safe-area-inset-bottom/);
});


test('Hoje mantém Cardápio visível e receitas contidas no mobile', () => {
  const app = ler('public/app.js');
  const css = ler('public/mobile-shell-v3.css');
  const shell = ler('public/mobile-shell-v3.js');

  assert.match(app, /metrica-cardapio/);
  assert.match(app, /data-ui-destination="cardapio"/);
  assert.match(app, /Café da manhã · Almoço · Lanche · Jantar/);
  assert.match(css, /#metricasHoje \.metrica-cardapio[\s\S]*grid-column:\s*1 \/ -1/);
  assert.match(css, /#listaRefeicoes \.card-refeicao[\s\S]*max-width:\s*100%\s*!important/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*\.receita-row-actions[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 34px/);
  assert.match(shell, /mobile-shell-v3\.css\?v=3/);
});

test('cabeçalhos e ações de página usam uma régua consistente', () => {
  const css = ler('public/mobile-shell-v3.css');
  assert.match(css, /\.lifeos-page-head--with-back[\s\S]*grid-template-columns:\s*42px minmax\(0, 1fr\)/);
  assert.match(css, /\.lifeos-page-head--with-back > \.lifeos-icon-action[\s\S]*align-self:\s*center/);
  assert.match(css, /#abaPlantas > \.lifeos-page-head \+ div[\s\S]*align-items:\s*center/);
});
