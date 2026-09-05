import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

const forbiddenPermanentNames = /(?:^|\/)(?:[^/]+-(?:fix|polish)|phase\d+-polish)\.js$/i;

test('regra de estoque é domínio puro e não inicializa a aplicação', () => {
  const source = read('public/status-estoque.js');
  assert.doesNotMatch(source, /^import\s/m);
  assert.doesNotMatch(source, /document\.|window\.|MutationObserver|addEventListener/);
  assert.match(source, /export function calcularStatus/);
});

test('mobile possui um único bootstrap explícito', () => {
  const html = read('public/index.html');
  const bootstrap = read('public/app-bootstrap.js');
  assert.match(html, /src="\/app-bootstrap\.js\?v=1"/);
  assert.doesNotMatch(html, /type="module" src="app\.js/);
  assert.match(bootstrap, /await import\('\.\/app\.js\?v=14'\)/);
  assert.match(bootstrap, /await import\('\.\/ui\/index\.js\?v=1'\)/);
});

test('UI compartilhada possui donos oficiais', () => {
  for (const path of ['public/ui/icons.js', 'public/ui/toast.js', 'public/ui/confirm.js', 'public/ui/modal.js', 'public/styles/components.css']) {
    assert.equal(fs.existsSync(path), true, `${path} precisa existir`);
  }
  assert.match(read('public/ui/confirm.js'), /window\.lifeosConfirmAction = confirmAction/);
  assert.match(read('public/ui/toast.js'), /window\.lifeosToast = toast/);
});

test('novos arquivos permanentes não podem repetir o padrão fix/polish', () => {
  const allowLegacy = new Set([
    'public/product-polish-v4.js',
    'public/phase3-polish.js',
    'public/phase4-polish.js',
    'public/audit-qa-polish.js',
    'public/alimentacao-contextual-mobile-fix.js',
  ]);
  const files = fs.readdirSync('public', { recursive: true })
    .map(path => `public/${path}`)
    .filter(path => path.endsWith('.js'));
  const violations = files.filter(path => forbiddenPermanentNames.test(path) && !allowLegacy.has(path));
  assert.deepEqual(violations, [], `Novas camadas proibidas: ${violations.join(', ')}`);
});

test('documentação arquitetural é obrigatória', () => {
  const policy = read('docs/ARQUITETURA_FRONTEND.md');
  assert.match(policy, /Cada superfície visual, comportamento ou regra de negócio tem um único dono/);
  assert.match(policy, /status-estoque\.js.*livre de efeitos colaterais/s);
});

test('Hoje usa CSS declarativo e catálogo oficial de ícones', () => {
  const html = read('public/index.html');
  const hoje = read('public/hoje-view.js');
  const icons = read('public/ui/icons.js');

  assert.match(html, /href="\/hoje\.css\?v=2"/);
  assert.match(hoje, /import \{ icon \} from '\.\/ui\/icons\.js';/);
  assert.doesNotMatch(hoje, /const ICONS = \{/);
  assert.doesNotMatch(hoje, /document\.head\.appendChild\(link\)|function ensureStyle\(/);
  assert.match(icons, /chevronDown:/);
});

test('Hoje e Casa possuem owners reais fora do monólito', () => {
  const app = read('public/app.js');
  const hoje = read('public/hoje-view.js');
  const casa = read('public/casa-view.js');
  const navigation = read('public/navigation.js');

  assert.match(app, /import \{ renderizarHoje \} from '\.\/hoje-view\.js\?v=2';/);
  assert.match(app, /renderizarHoje\(\{dados,plantasUrgentes:urgentes\}\)/);
  assert.doesNotMatch(app, /function criarCartaoHoje\(|const mg=el\('metricasHoje'\)/);
  assert.match(hoje, /export function renderizarHoje/);

  assert.match(app, /import \{ trocarSubCasa \} from '\.\/casa-view\.js\?v=1';/);
  assert.match(navigation, /import \{ trocarSubCasa, subCasaAtiva \} from '\.\/casa-view\.js\?v=1';/);
  assert.match(app, /window\.trocarSub = trocarSubCasa/);
  assert.doesNotMatch(app, /const CASA_TITULOS|function trocarSub\(/);
  assert.match(casa, /export function trocarSubCasa/);
  assert.match(casa, /export function subCasaAtiva/);
});

test('Plantas delega a lista para um owner visual dedicado', () => {
  const app = read('public/app.js');
  const view = read('public/plantas-view.js');

  assert.match(app, /import \{ renderizarListaPlantas \} from '\.\/plantas-view\.js\?v=1';/);
  assert.match(app, /renderizarListaPlantas\(\{/);
  assert.doesNotMatch(app, /function renderizarPlantas\(\)|linha\.className='planta-card'/);
  assert.match(view, /export function renderizarListaPlantas/);
  assert.match(view, /className = 'planta-card'/);
  assert.doesNotMatch(view, /supa\.|from\('/);
});

test('navegação e Mais possuem owner dedicado', () => {
  const app = read('public/app.js');
  const navigation = read('public/navigation.js');

  assert.match(app, /import \{ criarNavegacao \} from '\.\/navigation\.js\?v=1';/);
  assert.match(app, /criarNavegacao\(\{/);
  assert.doesNotMatch(app, /const ABAS_PRINCIPAIS|const SECOES_MAIS|const _origensSecao/);
  assert.doesNotMatch(app, /function trocarAba\(|function abrirSecao\(|function voltarContexto\(/);
  assert.match(navigation, /export function criarNavegacao/);
  assert.match(navigation, /const SECOES_MAIS/);
  assert.match(navigation, /function localizacaoAtual/);
  assert.match(app, /window\.trocarAba = trocarAba/);
  assert.match(app, /window\.abrirSecao = abrirSecao/);
  assert.match(app, /window\.voltarContexto = voltarContexto/);
});

test('Financeiro é owner da própria superfície e não reescreve Hoje', () => {
  const finance = read('public/central-financeira.js');
  const hoje = read('public/hoje-view.js');

  assert.match(finance, /lifeosFinanceiroContas/);
  assert.match(finance, /lifeos:hoje-abrir-conta/);
  assert.match(finance, /LifeOSModal/);
  assert.doesNotMatch(finance, /MutationObserver/);
  assert.doesNotMatch(finance, /cardsHoje|cfToday|cfRenderizarHoje/);
  assert.match(hoje, /lifeos:hoje-abrir-conta/);
});

test('Tablet mantém shell nativo da Casa, sem abrir o mobile comprimido', () => {
  const tablet = read('public/tablet-house-v4.js');
  const loader = read('public/tablet-enhancements.js');

  assert.match(tablet, /const MODULE_TITLES/);
  assert.match(tablet, /Financeiro da Casa/);
  assert.match(loader, /tablet-house-v4\.js/);
  assert.doesNotMatch(tablet, /window\.location\.assign/);
});

test('hotfix concorrente de medidas foi removido do runtime', () => {
  const bootstrap = read('public/app-bootstrap.js');
  const ritmo = read('public/ritmo.js');

  assert.equal(fs.existsSync('public/ritmo-medidas-save.js'), false);
  assert.doesNotMatch(bootstrap, /ritmo-medidas-save/);
  assert.match(ritmo, /addEventListener\('click', \(\) => abrirNovaMedida\(null\)\)/);
});
