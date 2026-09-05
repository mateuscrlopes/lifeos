import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const requireText = (source, needle, label) => {
  if (!source.includes(needle)) throw new Error(`Âncora não encontrada em ${label}: ${needle}`);
};

const appPath = 'public/app.js';
let app = read(appPath);

// 1. Navegação passa a ter um único owner dedicado.
if (!app.includes("import { criarNavegacao } from './navigation.js?v=1';")) {
  const anchor = "import { trocarSubCasa, subCasaAtiva } from './casa-view.js?v=1';\n";
  if (app.includes(anchor)) {
    app = app.replace(
      anchor,
      "import { trocarSubCasa } from './casa-view.js?v=1';\nimport { criarNavegacao } from './navigation.js?v=1';\n",
    );
  } else {
    const fallback = "import { trocarSubCasa } from './casa-view.js?v=1';\n";
    requireText(app, fallback, appPath);
    app = app.replace(fallback, `${fallback}import { criarNavegacao } from './navigation.js?v=1';\n`);
  }
}

const constantsStart = app.indexOf('// Mapeamento das abas principais\n');
const dataStart = app.indexOf('// ---- DATA, HORA e CLIMA ----');
if (constantsStart !== -1) {
  if (dataStart <= constantsStart) throw new Error('Mapeamento legado de navegação não pôde ser delimitado.');
  app = `${app.slice(0, constantsStart)}${app.slice(dataStart)}`;
}

const navStart = app.indexOf('function trocarAba(qual,btn,opcoes={}){');
const listaStart = app.indexOf('// --- LISTA ---');
if (navStart === -1 || listaStart === -1 || listaStart <= navStart) {
  throw new Error('Bloco legado de navegação não pôde ser delimitado com segurança.');
}

const navigationOwner = `const {\n  trocarAba,\n  abrirSecao,\n  abrirRitmoContextual,\n  voltarContexto,\n  voltarMais,\n  voltarAbaContextual,\n  voltarCasaContextual,\n} = criarNavegacao({\n  onHoje:()=>{if(usuario)carregarHoje();},\n  onFinanceiro:()=>{if(usuario)window.dispatchEvent(new CustomEvent('lifeos:financeiro-abrir'));},\n  onPlantas:()=>{if(usuario)renderizarPlantasAtuais();},\n  onRitmo:()=>window.dispatchEvent(new CustomEvent('lifeos:ritmo-abrir')),\n  onProjetos:()=>carregarProjetos(),\n  onRituais:()=>carregarRituais(),\n  onConfig:()=>{\n    carregarTokens();\n    carregarLocaisEstoque();\n    carregarLocaisCompraConfig();\n    carregarHistoricoExcluidos('todos');\n  },\n});\n\n`;
app = `${app.slice(0, navStart)}${navigationOwner}${app.slice(listaStart)}`;

if (app.includes('const ABAS_PRINCIPAIS') || app.includes('const SECOES_MAIS') || app.includes('const _origensSecao')) {
  throw new Error('app.js ainda possui estado estrutural da navegação.');
}
if (app.includes('function trocarAba(') || app.includes('function abrirSecao(') || app.includes('function voltarContexto(')) {
  throw new Error('app.js ainda possui funções proprietárias de navegação.');
}
if (!app.includes("import { criarNavegacao } from './navigation.js?v=1';")) {
  throw new Error('Owner de navegação não foi importado.');
}
if (!app.includes('} = criarNavegacao({')) throw new Error('Owner de navegação não foi inicializado.');
for (const compatibility of [
  'window.trocarAba = trocarAba;',
  'window.trocarSub = trocarSubCasa;',
  'window.abrirSecao = abrirSecao;',
  'window.voltarMais = voltarMais;',
  'window.voltarContexto = voltarContexto;',
  'window.abrirRitmoContextual = abrirRitmoContextual;',
  'window.voltarAbaContextual = voltarAbaContextual;',
  'window.voltarCasaContextual = voltarCasaContextual;',
]) requireText(app, compatibility, appPath);
write(appPath, app);

// 2. Testes de navegação passam a olhar para o owner correto.
const ritmoTestPath = 'test/ritmo.test.js';
let ritmoTests = read(ritmoTestPath);
ritmoTests = ritmoTests.replace(
  "  const app = ler('public/app.js');\n  assert.match(html, /id=\"secaoRitmo\"/);",
  "  const app = ler('public/app.js');\n  const navigation = ler('public/navigation.js');\n  assert.match(html, /id=\"secaoRitmo\"/);",
);
ritmoTests = ritmoTests.replace('  assert.match(app, /secaoRitmo/);', '  assert.match(navigation, /secaoRitmo/);');
ritmoTests = ritmoTests.replace(
  "  const app = ler('public/app.js');\n  const html = ler('public/index.html');\n  const shell = ler('public/mobile-shell-v3.js');\n  assert.match(app, /function voltarContexto\\(\\)/);\n  assert.match(app, /_origensSecao/);",
  "  const navigation = ler('public/navigation.js');\n  const html = ler('public/index.html');\n  const shell = ler('public/mobile-shell-v3.js');\n  assert.match(navigation, /function voltarContexto\\(\\)/);\n  assert.match(navigation, /origensSecao/);",
);
ritmoTests = ritmoTests.replace(
  "  const app = ler('public/app.js');\n  const js = ler('public/ritmo.js');\n  assert.match(html, /data-tab=\"ritmo\"/);\n  assert.doesNotMatch(html, /data-tab=\"casa\"/);\n  assert.match(app, /function abrirRitmoContextual/);",
  "  const navigation = ler('public/navigation.js');\n  const js = ler('public/ritmo.js');\n  assert.match(html, /data-tab=\"ritmo\"/);\n  assert.doesNotMatch(html, /data-tab=\"casa\"/);\n  assert.match(navigation, /function abrirRitmoContextual/);",
);
write(ritmoTestPath, ritmoTests);

const mobileTestPath = 'test/mobile-shell-v3.test.js';
let mobileTests = read(mobileTestPath);
mobileTests = mobileTests.replace(
  "  const app = ler('public/app.js');\n\n  assert.match(html, /id=\"abaFinanceiro\"/);",
  "  const app = ler('public/app.js');\n  const navigation = ler('public/navigation.js');\n\n  assert.match(html, /id=\"abaFinanceiro\"/);",
);
mobileTests = mobileTests.replace('  assert.match(app, /\'abaFinanceiro\'/);', "  assert.match(navigation, /'abaFinanceiro'/);");
mobileTests = mobileTests.replace(
  "  const app = ler('public/app.js');\n  const casa = ler('public/casa-view.js');\n  assert.match(html, /id=\"casaPageTitle\"/);",
  "  const navigation = ler('public/navigation.js');\n  const casa = ler('public/casa-view.js');\n  assert.match(html, /id=\"casaPageTitle\"/);",
);
mobileTests = mobileTests.replace('  assert.match(app, /function voltarAbaContextual/);', '  assert.match(navigation, /function voltarAbaContextual/);');
mobileTests = mobileTests.replace('  assert.match(app, /origemCasa/);', '  assert.match(navigation, /origemCasa/);');
write(mobileTestPath, mobileTests);

// 3. Contratos arquiteturais passam a refletir a fronteira real entre Casa e Navegação.
const architectureTestPath = 'test/architecture-policy.test.js';
let tests = read(architectureTestPath);
tests = tests.replace(
  "  const casa = read('public/casa-view.js');\n\n  assert.match(app, /import \\{ renderizarHoje \\} from '\\.\\/hoje-view\\.js\\?v=2';/);",
  "  const casa = read('public/casa-view.js');\n  const navigation = read('public/navigation.js');\n\n  assert.match(app, /import \\{ renderizarHoje \\} from '\\.\\/hoje-view\\.js\\?v=2';/);",
);
tests = tests.replace(
  "  assert.match(app, /import \\{ trocarSubCasa, subCasaAtiva \\} from '\\.\\/casa-view\\.js\\?v=1';/);",
  "  assert.match(app, /import \\{ trocarSubCasa \\} from '\\.\\/casa-view\\.js\\?v=1';/);\n  assert.match(navigation, /import \\{ trocarSubCasa, subCasaAtiva \\} from '\\.\\/casa-view\\.js\\?v=1';/);",
);

if (!tests.includes('navegação e Mais possuem owner dedicado')) {
  tests += `\n\ntest('navegação e Mais possuem owner dedicado', () => {\n  const app = read('public/app.js');\n  const navigation = read('public/navigation.js');\n\n  assert.match(app, /import \\{ criarNavegacao \\} from '\\.\\/navigation\\.js\\?v=1';/);\n  assert.match(app, /criarNavegacao\\(\\{/);\n  assert.doesNotMatch(app, /const ABAS_PRINCIPAIS|const SECOES_MAIS|const _origensSecao/);\n  assert.doesNotMatch(app, /function trocarAba\\(|function abrirSecao\\(|function voltarContexto\\(/);\n  assert.match(navigation, /export function criarNavegacao/);\n  assert.match(navigation, /const SECOES_MAIS/);\n  assert.match(navigation, /function localizacaoAtual/);\n  assert.match(app, /window\\.trocarAba = trocarAba/);\n  assert.match(app, /window\\.abrirSecao = abrirSecao/);\n  assert.match(app, /window\\.voltarContexto = voltarContexto/);\n});\n`;
}
write(architectureTestPath, tests);

for (const transient of [
  'scripts/continue-architecture-phase4.mjs',
  '.github/workflows/continue-architecture-phase4.yml',
]) {
  if (fs.existsSync(transient)) fs.unlinkSync(transient);
}
