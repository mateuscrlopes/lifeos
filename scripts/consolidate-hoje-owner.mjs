import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

function replaceRequired(source, search, replacement, label) {
  const next = typeof search === 'string' ? source.replace(search, replacement) : source.replace(search, replacement);
  if (next === source) throw new Error(`Trecho esperado não encontrado: ${label}`);
  return next;
}

// ---------------------------------------------------------------------------
// app.js: orquestra dados; hoje-view.js passa a ser o único dono dos mounts.
// ---------------------------------------------------------------------------
let app = read('public/app.js');
app = replaceRequired(
  app,
  "import { saudacao, montarHoje, inicioSemana, formatarDataISO } from './hoje.js';",
  "import { saudacao, montarHoje, inicioSemana, formatarDataISO } from './hoje.js';\nimport { renderizarHoje } from './hoje-view.js?v=1';",
  'import da view de Hoje',
);
app = replaceRequired(
  app,
  "import './alimentacao-contextual-mobile-fix.js?v=2';\n",
  '',
  'remoção do hotfix de alimentação',
);
app = replaceRequired(
  app,
  /\/\/ --- HOJE ---[\s\S]*?\/\/ --- EVENTOS DA LINHA DO TEMPO ---/,
  `// --- HOJE ---\nasync function carregarHoje(){\n  atualizarDataHoje();\n  const dados=await montarHoje(supa,usuario);\n  renderizarHoje({dados,plantasUrgentes:contarUrgentes(_plantasCache)});\n}\n\n// --- EVENTOS DA LINHA DO TEMPO ---`,
  'renderização antiga de Hoje',
);
write('public/app.js', app);

// Hoje precisa saber quais itens do estoque são marcados como críticos para o destaque.
let hoje = read('public/hoje.js');
hoje = replaceRequired(
  hoje,
  ".select('id, nome, quantidade, minimo, tipo, nivel, minimo_nivel').eq('casa_id', casaId)",
  ".select('id, nome, quantidade, minimo, tipo, nivel, minimo_nivel, critico').eq('casa_id', casaId)",
  'campo critico no agregador de Hoje',
);
write('public/hoje.js', hoje);

// ---------------------------------------------------------------------------
// Central Financeira: mantém domínio/modal, mas deixa de renderizar em #cardsHoje.
// Hoje pede abertura de conta por evento explícito.
// ---------------------------------------------------------------------------
let finance = read('public/central-financeira.js');
finance = finance
  .replace("let cfObservadorHoje = null;\n", '')
  .replace("let cfRenderizandoHoje = false;\n", '');
finance = replaceRequired(
  finance,
  /function cfRemoverCartaoAntigo\(\) \{[\s\S]*?\nfunction cfListaFiltrada\(\) \{/,
  'function cfListaFiltrada() {',
  'renderer financeiro concorrente em Hoje',
);
finance = finance.replaceAll('    cfRenderizarHoje();\n', '');
finance = finance.replaceAll('          cfRenderizarHoje();\n', '');
finance = replaceRequired(
  finance,
  /function cfObservarHoje\(\) \{[\s\S]*?\n\}\n\nfunction cfCarregarEstilos/,
  'function cfCarregarEstilos',
  'observer financeiro de Hoje',
);
finance = finance.replaceAll('      cfObservarHoje();\n', '');
finance = finance.replaceAll('    cfObservarHoje();\n', '');
finance += `\n\nwindow.addEventListener('lifeos:hoje-abrir-conta', async event => {\n  const contaId = event.detail?.contaId;\n  if (!contaId || !cfObterContexto()) return;\n  try {\n    await cfCarregar();\n    const conta = cfContas.find(item => String(item.id) === String(contaId));\n    if (!conta) return;\n    cfAbaOrigem = 'hoje';\n    cfAbrirConta(conta);\n  } catch (erro) {\n    console.error('[Central Financeira] Não foi possível abrir a conta a partir de Hoje:', erro);\n  }\n});\n`;
write('public/central-financeira.js', finance);

// ---------------------------------------------------------------------------
// Audit QA: deixa de ser um segundo controller da tela Hoje.
// Mantém correções transversais e componentes compartilhados.
// ---------------------------------------------------------------------------
let audit = read('public/audit-qa-polish.js');
audit = audit
  .replace("  let heroSlides = [];\n", '')
  .replace("  let heroIndex = 0;\n", '')
  .replace("  let heroTimer = null;\n", '')
  .replace("  let refreshTimer = null;\n", '');
audit = replaceRequired(
  audit,
  /  function cardTitle\(header\) \{[\s\S]*?\n  function reorderWeeklyMenu\(\) \{/,
  '  function reorderWeeklyMenu() {',
  'enhancer concorrente de cards de Hoje',
);
audit = replaceRequired(
  audit,
  /  function parseStockStatus\(item\) \{[\s\S]*?\n  function confirmDialog/,
  '  function confirmDialog',
  'rotador concorrente do hero de Hoje',
);
audit = audit.replace("      enhanceCollapsibleCards(root);\n", '');
audit = replaceRequired(
  audit,
  /  function refreshHighlightsSoon\(\) \{[\s\S]*?\n  function start\(\) \{[\s\S]*?\n  \}\n\n  if \(document\.readyState/,
  `  function start() {\n    loadCss();\n    enhanceAll();\n    installObserver();\n    window.addEventListener('lifeos:ready', () => {\n      window.setTimeout(() => enhanceAll(), 120);\n    });\n  }\n\n  if (document.readyState`,
  'ciclo de vida concorrente do hero de Hoje',
);
write('public/audit-qa-polish.js', audit);

// ---------------------------------------------------------------------------
// Phase 3: mantém Plantas e CSS, mas não cria cabeçalho/ícones após Hoje renderizar.
// ---------------------------------------------------------------------------
let phase3 = read('public/phase3-polish.js');
phase3 = replaceRequired(
  phase3,
  /  function ensureTodayHeading\(\) \{[\s\S]*?\n  function ensurePlantOverview\(\) \{/,
  '  function ensurePlantOverview() {',
  'decoradores concorrentes da phase3 em Hoje',
);
phase3 = phase3.replaceAll('    ensureTodayHeading();\n', '');
phase3 = phase3.replaceAll('    decorateMealRows(root);\n', '');
phase3 = phase3.replaceAll('      decorateMealRows(record.target instanceof Element ? record.target : document);\n', '');
write('public/phase3-polish.js', phase3);

// ---------------------------------------------------------------------------
// Mobile QA: disclosure/abertura de Plantas já nascem corretos em hoje-view.js.
// ---------------------------------------------------------------------------
let mobileQa = read('public/mobile-qa-v5.js');
mobileQa = replaceRequired(
  mobileQa,
  /  \/\/ ------------------------------------------------------------------\n  \/\/ Hoje: disclosure não pode navegar[\s\S]*?  \/\/ ------------------------------------------------------------------\n  \/\/ Inputs:/,
  `  // ------------------------------------------------------------------\n  // Inputs:`,
  'handlers concorrentes do Hoje no QA mobile',
);
mobileQa = mobileQa.replace("    // Captura antes das camadas antigas que associaram navegação ao card inteiro.\n    document.addEventListener('click', handleTodayDisclosure, true);\n    document.addEventListener('click', handleTodayPlantsOpen, true);\n", '');
write('public/mobile-qa-v5.js', mobileQa);

// Hotfix antigo deixa de existir: a regra foi incorporada ao proprietário.
for (const path of ['public/alimentacao-contextual-mobile-fix.js','public/alimentacao-contextual-mobile-fix.css']) {
  if (fs.existsSync(path)) fs.unlinkSync(path);
}

// ---------------------------------------------------------------------------
// Contratos de teste acompanham a arquitetura consolidada.
// ---------------------------------------------------------------------------
write('test/alimentacao-contextual-mobile-fix.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst ler = caminho => fs.readFileSync(new URL(\`../\${caminho}\`, import.meta.url), 'utf8');\n\ntest('Hoje escolhe a refeição do horário atual no proprietário da tela', () => {\n  const view = ler('public/hoje-view.js');\n  assert.match(view, /function refeicaoDoHorario/);\n  assert.match(view, /getHours\\(\\) < 15/);\n  assert.match(view, /item => item\\.tipo === tipo/);\n});\n\ntest('destaque de alimentação e hero são renderizados pelo mesmo proprietário', () => {\n  const view = ler('public/hoje-view.js');\n  assert.match(view, /acMobileDestaque/);\n  assert.match(view, /renderHero/);\n  assert.match(view, /Cardápio da Casa/);\n});\n\ntest('app não carrega mais hotfix concorrente de alimentação', () => {\n  const app = ler('public/app.js');\n  assert.match(app, /hoje-view\\.js\\?v=1/);\n  assert.doesNotMatch(app, /alimentacao-contextual-mobile-fix/);\n  assert.equal(fs.existsSync(new URL('../public/alimentacao-contextual-mobile-fix.js', import.meta.url)), false);\n});\n`);

let phase3Test = read('test/phase3-telas.test.js');
phase3Test = phase3Test.replace(
  "  const js = read('public/phase3-polish.js');\n  assert.match(css, /#metricasHoje\\.metricas-grid[\\s\\S]*repeat\\(4, minmax\\(0, 1fr\\)\\)/);",
  "  const js = read('public/hoje-view.js');\n  assert.match(css, /#metricasHoje\\.metricas-grid[\\s\\S]*repeat\\(4, minmax\\(0, 1fr\\)\\)/);"
);
phase3Test = phase3Test.replace(
  "  const js = read('public/phase3-polish.js');\n  assert.match(js, /const mealIcons =/);\n  assert.match(js, /phase3-meal-icon/);\n  assert.match(js, /startsWith\\('almoço'\\)/);\n  assert.match(js, /startsWith\\('jantar'\\)/);",
  "  const js = read('public/hoje-view.js');\n  assert.match(js, /const ICONS =/);\n  assert.match(js, /meal:/);\n  assert.match(js, /labelTipoCardapio/);\n  assert.match(js, /Almoço/);\n  assert.match(js, /Jantar/);"
);
write('test/phase3-telas.test.js', phase3Test);

let auditTest = read('test/auditoria-qa-ui.test.js');
auditTest = auditTest.replace(
`test('Hoje possui separador, destaque rotativo e cards recolhíveis', () => {\n  const js = read('public/audit-qa-polish.js');\n  const css = read('public/audit-qa-polish.css');\n  for (const token of ['qa-meta-separator', 'loadHeroSlides', 'tarefas', 'plantas', 'contas', 'estoque', 'rituais', 'qa-card-toggle']) {\n    assert.match(js + css, new RegExp(token));\n  }\n  assert.match(js, /8000/);\n});`,
`test('Hoje possui separador, destaque rotativo e cards recolhíveis no proprietário da tela', () => {\n  const view = read('public/hoje-view.js');\n  const audit = read('public/audit-qa-polish.js');\n  const css = read('public/audit-qa-polish.css');\n  assert.match(audit + css, /qa-meta-separator/);\n  for (const token of ['renderHero', 'tarefas', 'plantas', 'contas', 'estoque', 'qa-card-toggle']) assert.match(view, new RegExp(token));\n  assert.match(view, /8000/);\n  assert.doesNotMatch(audit, /getElementById\\('heroTitulo'\\)/);\n});`
);
auditTest = auditTest.replace(
`test('cards do Hoje separam navegação de expansão', () => {\n  const app = read('public/app.js');\n  const ui = read('public/ui-refinements.js');\n  const audit = read('public/audit-qa-polish.js');\n  const finance = read('public/central-financeira.js');\n\n  assert.match(app, /qa-card-actions/);\n  assert.match(app, /qa-card-open/);\n  assert.match(app, /qa-collapsible-card qa-collapsed/);\n  assert.match(ui, /event\\.target\\.closest\\('\\.qa-card-toggle'\\)/);\n  assert.match(ui, /card\\.classList\\.contains\\('qa-collapsible-card'\\)/);\n  assert.match(audit, /existingAction\\.hidden = false/);\n  assert.match(finance, /cf-hoje-interior qa-collapsible-card qa-collapsed/);\n});`,
`test('cards do Hoje separam navegação de expansão sem renderers concorrentes', () => {\n  const view = read('public/hoje-view.js');\n  const audit = read('public/audit-qa-polish.js');\n  const finance = read('public/central-financeira.js');\n  const phase3 = read('public/phase3-polish.js');\n  assert.match(view, /qa-card-actions/);\n  assert.match(view, /qa-card-open/);\n  assert.match(view, /qa-collapsible-card qa-collapsed/);\n  assert.match(finance, /lifeos:hoje-abrir-conta/);\n  assert.doesNotMatch(finance, /getElementById\\('cardsHoje'\\)/);\n  assert.doesNotMatch(audit, /#cardsHoje/);\n  assert.doesNotMatch(phase3, /#cardsHoje/);\n});`
);
write('test/auditoria-qa-ui.test.js', auditTest);

let mobileTest = read('test/mobile-qa-v5.test.js');
mobileTest = mobileTest.replace(
`test('Hoje separa expandir de abrir e Plantas usa a aba correta', () => {\n  const js = read('public/mobile-qa-v5.js');\n  assert.match(js, /handleTodayDisclosure/);\n  assert.match(js, /qa-collapsed/);\n  assert.match(js, /handleTodayPlantsOpen/);\n  assert.match(js, /\\.tab-btn\\[data-tab="plantas"\\]/);\n});`,
`test('Hoje não depende mais de interceptadores do QA mobile', () => {\n  const qa = read('public/mobile-qa-v5.js');\n  const view = read('public/hoje-view.js');\n  assert.doesNotMatch(qa, /handleTodayDisclosure/);\n  assert.doesNotMatch(qa, /#cardsHoje/);\n  assert.match(view, /qa-collapsed/);\n  assert.match(view, /data-ui-destination/);\n});`
);
write('test/mobile-qa-v5.test.js', mobileTest);

write('test/hoje-owner.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');\n\ntest('hoje-view é o único renderer dos mounts principais de Hoje', () => {\n  const view = read('public/hoje-view.js');\n  const app = read('public/app.js');\n  const finance = read('public/central-financeira.js');\n  const audit = read('public/audit-qa-polish.js');\n  const phase3 = read('public/phase3-polish.js');\n  const mobile = read('public/mobile-qa-v5.js');\n  for (const id of ['heroTitulo','heroSub','metricasHoje','cardsHoje']) assert.match(view, new RegExp(id));\n  assert.match(app, /renderizarHoje\\(\\{dados,plantasUrgentes/);\n  for (const code of [finance,audit,phase3,mobile]) assert.doesNotMatch(code, /getElementById\\('cardsHoje'\\)|#cardsHoje/);\n});\n\ntest('Financeiro atende ação de conta por evento sem escrever na tela Hoje', () => {\n  const finance = read('public/central-financeira.js');\n  assert.match(finance, /lifeos:hoje-abrir-conta/);\n  assert.match(finance, /cfAbrirConta\\(conta\\)/);\n  assert.doesNotMatch(finance, /cfRenderizarHoje|cfObservarHoje|cfToday/);\n});\n\ntest('hotfix de alimentação foi absorvido pelo proprietário', () => {\n  assert.equal(fs.existsSync(new URL('../public/alimentacao-contextual-mobile-fix.js', import.meta.url)), false);\n  assert.equal(fs.existsSync(new URL('../public/alimentacao-contextual-mobile-fix.css', import.meta.url)), false);\n  assert.match(read('public/hoje-view.js'), /acMobileDestaque/);\n  assert.match(read('public/hoje.css'), /ac-mobile-highlight/);\n});\n`);

console.log('Consolidação de Hoje aplicada.');
