import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const requireText = (source, needle, label) => {
  if (!source.includes(needle)) throw new Error(`Âncora não encontrada em ${label}: ${needle}`);
};

const appPath = 'public/app.js';
let app = read(appPath);

if (!app.includes("import { renderizarListaPlantas } from './plantas-view.js?v=1';")) {
  const anchor = "import { trocarSubCasa, subCasaAtiva } from './casa-view.js?v=1';\n";
  requireText(app, anchor, appPath);
  app = app.replace(anchor, `${anchor}import { renderizarListaPlantas } from './plantas-view.js?v=1';\n`);
}

const renderInicio = app.indexOf('function renderizarPlantas(){');
const cuidarInicio = app.indexOf('async function cuidarPlanta', renderInicio);
if (renderInicio === -1 || cuidarInicio === -1 || cuidarInicio <= renderInicio) {
  throw new Error('Render legado de Plantas não pôde ser delimitado com segurança.');
}

const delegador = `function renderizarPlantasAtuais(){\n  renderizarListaPlantas({\n    plantas:_plantasCache,\n    filtroAtual:_filtroAtual,\n    onOpen:abrirFichaPlanta,\n    onCare:cuidarPlanta,\n  });\n}\n\n`;
app = `${app.slice(0, renderInicio)}${delegador}${app.slice(cuidarInicio)}`;
app = app.replaceAll('renderizarPlantas();', 'renderizarPlantasAtuais();');

if (app.includes('function renderizarPlantas(){')) {
  throw new Error('app.js ainda contém o renderizador visual legado de Plantas.');
}
if (app.includes("linha.className='planta-card'")) {
  throw new Error('app.js ainda monta cartões de Plantas diretamente.');
}
if (!app.includes("import { renderizarListaPlantas } from './plantas-view.js?v=1';")) {
  throw new Error('Owner visual de Plantas não foi importado.');
}
if (!app.includes('renderizarListaPlantas({')) {
  throw new Error('Plantas não delegam renderização ao owner visual.');
}
write(appPath, app);

const foundationTestPath = 'test/fundacao-produto.test.js';
let foundationTests = read(foundationTestPath);
foundationTests = foundationTests.replace(
  "test('conteúdo persistido é escapado antes de entrar em templates HTML', () => {\n  const app = read('../public/app.js');\n  const tablet = read('../public/tablet.html');",
  "test('conteúdo persistido é escapado antes de entrar em templates HTML', () => {\n  const app = read('../public/app.js');\n  const plantasView = read('../public/plantas-view.js');\n  const tablet = read('../public/tablet.html');",
);
foundationTests = foundationTests.replace(
  '  assert.match(app, /escapeHtml\\(nomeEspecie\\)/);',
  '  assert.match(plantasView, /document\\.createTextNode\\(nomeEspecie\\)/);',
);
write(foundationTestPath, foundationTests);

const architectureTestPath = 'test/architecture-policy.test.js';
let tests = read(architectureTestPath);
if (!tests.includes('Plantas delega a lista para um owner visual dedicado')) {
  tests += `\n\ntest('Plantas delega a lista para um owner visual dedicado', () => {\n  const app = read('public/app.js');\n  const view = read('public/plantas-view.js');\n\n  assert.match(app, /import \\{ renderizarListaPlantas \\} from '\\.\\/plantas-view\\.js\\?v=1';/);\n  assert.match(app, /renderizarListaPlantas\\(\\{/);\n  assert.doesNotMatch(app, /function renderizarPlantas\\(\\)|linha\\.className='planta-card'/);\n  assert.match(view, /export function renderizarListaPlantas/);\n  assert.match(view, /className = 'planta-card'/);\n  assert.doesNotMatch(view, /supa\\.|from\\('/);\n});\n`;
  write(architectureTestPath, tests);
}

for (const transient of [
  'scripts/continue-architecture-phase3.mjs',
  '.github/workflows/continue-architecture-phase3.yml',
]) {
  if (fs.existsSync(transient)) fs.unlinkSync(transient);
}
