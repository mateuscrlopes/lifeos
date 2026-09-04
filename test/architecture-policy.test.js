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
