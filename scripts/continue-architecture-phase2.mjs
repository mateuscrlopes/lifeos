import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const requireText = (source, needle, label) => {
  if (!source.includes(needle)) throw new Error(`Âncora não encontrada em ${label}: ${needle}`);
};

const appPath = 'public/app.js';
let app = read(appPath);

// 1. Hoje passa a ter um único renderizador real: hoje-view.js.
if (!app.includes("import { renderizarHoje } from './hoje-view.js?v=2';")) {
  const anchor = "import { saudacao, montarHoje, inicioSemana, formatarDataISO } from './hoje.js';\n";
  requireText(app, anchor, appPath);
  app = app.replace(anchor, `${anchor}import { renderizarHoje } from './hoje-view.js?v=2';\n`);
}

const hojeInicio = app.indexOf('// --- HOJE ---\nasync function carregarHoje(){');
const hojeFim = app.indexOf('// --- EVENTOS DA LINHA DO TEMPO ---');
if (hojeInicio === -1 || hojeFim === -1 || hojeFim <= hojeInicio) {
  throw new Error('Bloco legado de Hoje não pôde ser delimitado com segurança.');
}
const hojeOwner = `// --- HOJE ---\nasync function carregarHoje(){\n  atualizarDataHoje();\n  const dados=await montarHoje(supa,usuario);\n  const urgentes=contarUrgentes(_plantasCache);\n  renderizarHoje({dados,plantasUrgentes:urgentes});\n}\n\n`;
app = `${app.slice(0, hojeInicio)}${hojeOwner}${app.slice(hojeFim)}`;

// 2. Navegação interna de Casa sai do monólito e passa a casa-view.js.
if (!app.includes("from './casa-view.js?v=1';")) {
  const anchor = "import { renderizarHoje } from './hoje-view.js?v=2';\n";
  requireText(app, anchor, appPath);
  app = app.replace(anchor, `${anchor}import { trocarSubCasa, subCasaAtiva } from './casa-view.js?v=1';\n`);
}

const titulosRegex = /const CASA_TITULOS = \{[\s\S]*?\n\};\n\n/;
if (titulosRegex.test(app)) app = app.replace(titulosRegex, '');

const trocarSubRegex = /function trocarSub\(qual,btn\)\{[\s\S]*?\n\}\n\nconst _origensSecao/;
if (trocarSubRegex.test(app)) app = app.replace(trocarSubRegex, 'const _origensSecao');

app = app.replaceAll('trocarSub(', 'trocarSubCasa(');
app = app.replace('window.trocarSub = trocarSub;', 'window.trocarSub = trocarSubCasa;');

const localizacaoLegada = `        const sub=[...document.querySelectorAll('.sub-aba[data-sub]')].find(b=>b.classList.contains('ativa'))?.dataset.sub || 'compras';`;
if (app.includes(localizacaoLegada)) app = app.replace(localizacaoLegada, '        const sub=subCasaAtiva();');

if (app.includes('function trocarSub(') || app.includes('const CASA_TITULOS =')) {
  throw new Error('app.js ainda possui ownership visual interno de Casa.');
}
if (app.includes('function criarCartaoHoje(') || app.includes('const mg=el(\'metricasHoje\')')) {
  throw new Error('app.js ainda possui renderização visual duplicada de Hoje.');
}
if (!app.includes('renderizarHoje({dados,plantasUrgentes:urgentes});')) {
  throw new Error('carregarHoje não delega para o owner oficial.');
}
if (!app.includes('window.trocarSub = trocarSubCasa;')) {
  throw new Error('Compatibilidade global de trocarSub não foi preservada.');
}
write(appPath, app);

// 3. Testes antigos passam a verificar os owners corretos, sem exigir código no monólito.
const mobileTestPath = 'test/mobile-shell-v3.test.js';
let mobileTests = read(mobileTestPath);
mobileTests = mobileTests.replace(
  "  const app = ler('public/app.js');\n  assert.match(html, /id=\"casaPageTitle\"/);\n  assert.match(html, /voltarCasaContextual\\(\\)/);\n  assert.match(app, /const CASA_TITULOS/);",
  "  const app = ler('public/app.js');\n  const casa = ler('public/casa-view.js');\n  assert.match(html, /id=\"casaPageTitle\"/);\n  assert.match(html, /voltarCasaContextual\\(\\)/);\n  assert.match(casa, /const TITULOS/);",
);
mobileTests = mobileTests.replace(
  "  const app = ler('public/app.js');\n  const css = ler('public/mobile-shell-v3.css');\n  const polish = ler('public/product-polish-v4.css');\n  const shell = ler('public/mobile-shell-v3.js');\n\n  assert.match(app, /metrica-cardapio/);\n  assert.match(app, /data-ui-destination=\"cardapio\"/);\n  assert.match(app, /Almoço e jantar da semana/);",
  "  const hoje = ler('public/hoje-view.js');\n  const css = ler('public/mobile-shell-v3.css');\n  const polish = ler('public/product-polish-v4.css');\n  const shell = ler('public/mobile-shell-v3.js');\n\n  assert.match(hoje, /metrica-cardapio/);\n  assert.match(hoje, /data-ui-destination=\"cardapio\"/);\n  assert.match(hoje, /Almoço e jantar da semana/);",
);
write(mobileTestPath, mobileTests);

const auditTestPath = 'test/auditoria-qa-ui.test.js';
let auditTests = read(auditTestPath);
auditTests = auditTests.replace(
  "test('cards do Hoje separam navegação de expansão', () => {\n  const app = read('public/app.js');",
  "test('cards do Hoje separam navegação de expansão', () => {\n  const hoje = read('public/hoje-view.js');",
);
auditTests = auditTests.replaceAll('  assert.match(app, /qa-card-actions/);', '  assert.match(hoje, /qa-card-actions/);');
auditTests = auditTests.replaceAll('  assert.match(app, /qa-card-open/);', '  assert.match(hoje, /qa-card-open/);');
auditTests = auditTests.replaceAll('  assert.match(app, /qa-collapsible-card qa-collapsed/);', '  assert.match(hoje, /qa-collapsible-card qa-collapsed/);');
write(auditTestPath, auditTests);

const architectureTestPath = 'test/architecture-policy.test.js';
let architectureTests = read(architectureTestPath);
if (!architectureTests.includes('Hoje e Casa possuem owners reais fora do monólito')) {
  architectureTests += `\n\ntest('Hoje e Casa possuem owners reais fora do monólito', () => {\n  const app = read('public/app.js');\n  const hoje = read('public/hoje-view.js');\n  const casa = read('public/casa-view.js');\n\n  assert.match(app, /import \\{ renderizarHoje \\} from '\\.\\/hoje-view\\.js\\?v=2';/);\n  assert.match(app, /renderizarHoje\\(\\{dados,plantasUrgentes:urgentes\\}\\)/);\n  assert.doesNotMatch(app, /function criarCartaoHoje\\(|const mg=el\\('metricasHoje'\\)/);\n  assert.match(hoje, /export function renderizarHoje/);\n\n  assert.match(app, /import \\{ trocarSubCasa, subCasaAtiva \\} from '\\.\\/casa-view\\.js\\?v=1';/);\n  assert.match(app, /window\\.trocarSub = trocarSubCasa/);\n  assert.doesNotMatch(app, /const CASA_TITULOS|function trocarSub\\(/);\n  assert.match(casa, /export function trocarSubCasa/);\n  assert.match(casa, /export function subCasaAtiva/);\n});\n`;
  write(architectureTestPath, architectureTests);
}

// 4. Remove executores temporários que já cumpriram seu papel.
for (const transient of [
  'scripts/consolidate-hoje-owner.mjs',
  '.github/workflows/consolidate-hoje.yml',
  'scripts/continue-architecture-phase2.mjs',
  '.github/workflows/continue-architecture-phase2.yml',
]) {
  if (fs.existsSync(transient)) fs.unlinkSync(transient);
}
