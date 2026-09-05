import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const requireText = (source, needle, label) => {
  if (!source.includes(needle)) throw new Error(`Âncora não encontrada em ${label}: ${needle}`);
};

// 1. Catálogo compartilhado ganha a direção usada pelo card expansível de Hoje.
const iconsPath = 'public/ui/icons.js';
let icons = read(iconsPath);
if (!icons.includes("chevronDown:")) {
  requireText(icons, "  chevron: '<path d=\"m9 18 6-6-6-6\"/>',", iconsPath);
  icons = icons.replace(
    "  chevron: '<path d=\"m9 18 6-6-6-6\"/>',",
    "  chevron: '<path d=\"m9 18 6-6-6-6\"/>',\n  chevronDown: '<path d=\"m6 9 6 6 6-6\"/>',",
  );
  write(iconsPath, icons);
}

// 2. Hoje deixa de possuir catálogo SVG e carregamento de CSS próprios.
const hojePath = 'public/hoje-view.js';
let hoje = read(hojePath);
if (!hoje.includes("import { icon } from './ui/icons.js';")) {
  const anchor = '// Recebe dados prontos; não consulta banco nem observa/muta a renderização de outros módulos.\n\n';
  requireText(hoje, anchor, hojePath);
  hoje = hoje.replace(anchor, `${anchor}import { icon } from './ui/icons.js';\n\n`);
}

const iconStart = hoje.indexOf('const ICONS = {');
const headingStart = hoje.indexOf('function ensureHeading()');
if (iconStart !== -1) {
  if (headingStart <= iconStart) throw new Error('Bloco de ícones de Hoje não pôde ser delimitado com segurança.');
  const sharedIconAdapter = `const svg = (name, size = 18) => {\n  const aliases = { tasks: 'task', stock: 'box' };\n  return icon(aliases[name] || name, size);\n};\n\n`;
  hoje = `${hoje.slice(0, iconStart)}${sharedIconAdapter}${hoje.slice(headingStart)}`;
}

const legacyToggle = `  toggle.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';`;
if (hoje.includes(legacyToggle)) {
  hoje = hoje.replace(legacyToggle, "  toggle.innerHTML = svg('chevronDown', 17);");
}

hoje = hoje.replace('  ensureStyle();\n', '');

if (hoje.includes('const ICONS = {') || hoje.includes('function ensureStyle()') || hoje.includes('document.head.appendChild(link)')) {
  throw new Error('Hoje ainda contém ownership local de ícones/CSS após a consolidação.');
}
if (!hoje.includes("svg('chevronDown', 17)")) throw new Error('Chevron compartilhado não foi aplicado em Hoje.');
write(hojePath, hoje);

// 3. CSS da superfície é declarado no documento, antes do bootstrap.
const indexPath = 'public/index.html';
let html = read(indexPath);
if (!html.includes('/hoje.css')) {
  const anchor = '  <link rel="stylesheet" href="/styles/components.css?v=1"/>\n';
  requireText(html, anchor, indexPath);
  html = html.replace(anchor, `${anchor}  <link rel="stylesheet" href="/hoje.css?v=2"/>\n`);
  write(indexPath, html);
}

// 4. Política passa a travar regressão do owner recém-consolidado.
const testPath = 'test/architecture-policy.test.js';
let tests = read(testPath);
if (!tests.includes("Hoje usa CSS declarativo e catálogo oficial de ícones")) {
  tests += `\n\ntest('Hoje usa CSS declarativo e catálogo oficial de ícones', () => {\n  const html = read('public/index.html');\n  const hoje = read('public/hoje-view.js');\n  const icons = read('public/ui/icons.js');\n\n  assert.match(html, /href=\"\\/hoje\\.css\\?v=2\"/);\n  assert.match(hoje, /import \\{ icon \\} from '\\.\\/ui\\/icons\\.js';/);\n  assert.doesNotMatch(hoje, /const ICONS = \\{/);\n  assert.doesNotMatch(hoje, /document\\.head\\.appendChild\\(link\\)|function ensureStyle\\(/);\n  assert.match(icons, /chevronDown:/);\n});\n`;
  write(testPath, tests);
}

// Este executor é transitório: some junto com o workflow que o disparou.
for (const transient of [
  'scripts/continue-architecture-phase1.mjs',
  '.github/workflows/continue-architecture-phase1.yml',
]) {
  if (fs.existsSync(transient)) fs.unlinkSync(transient);
}
