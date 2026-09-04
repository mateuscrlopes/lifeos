import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
let parserFn = null;

async function getParser() {
  if (parserFn) return parserFn;
  process.env.SUPABASE_URL ||= 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY ||= 'test-anon-key';
  const modulo = await import('../src/ritmo.js');
  parserFn = modulo.estruturarPlanoAlimentar;
  return parserFn;
}

test('QA Mobile v5 é carregado após as camadas existentes', () => {
  const status = read('public/app-bootstrap.js');
  assert.match(status, /audit-qa-polish\.js\?v=3/);
  assert.match(status, /mobile-qa-v5\.js\?v=1/);
  assert.ok(status.indexOf('mobile-qa-v5.js') > status.indexOf('audit-qa-polish.js'));
});

test('datas, horas e modais não podem estourar ou arrastar horizontalmente', () => {
  const css = read('public/mobile-qa-v5.css');
  assert.match(css, /input\[type="date"\][\s\S]*width:\s*100%\s*!important/);
  assert.match(css, /input\[type="time"\]/);
  assert.match(css, /overflow-x:\s*hidden\s*!important/);
  assert.match(css, /touch-action:\s*pan-y/);
});

test('Hoje separa expandir de abrir e Plantas usa a aba correta', () => {
  const js = read('public/mobile-qa-v5.js');
  assert.match(js, /handleTodayDisclosure/);
  assert.match(js, /qa-collapsed/);
  assert.match(js, /handleTodayPlantsOpen/);
  assert.match(js, /\.tab-btn\[data-tab="plantas"\]/);
});

test('confirmação destrutiva permanece textual e não vira quadrado vazio', () => {
  const css = read('public/mobile-qa-v5.css');
  assert.match(css, /\.qa-confirm-primary\.is-danger:empty::after/);
  assert.match(css, /content:\s*"Excluir"/);
  assert.match(css, /\.qa-confirm-actions button[\s\S]*width:\s*100%/);
});

test('Compras mantém item, frequência e adicionar na mesma régua', () => {
  const css = read('public/mobile-qa-v5.css');
  assert.match(css, /#subCompras \.linha-add[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 112px 48px/);
  assert.match(css, /#subCompras #btnAdd[\s\S]*grid-column:\s*3/);
  assert.match(css, /ui-purchase-create-destination/);
});

test('Estoque move status para junto do nome e preserva controles', () => {
  const js = read('public/mobile-qa-v5.js');
  const css = read('public/mobile-qa-v5.css');
  assert.match(js, /qa5-stock-name-row/);
  assert.match(js, /row\.appendChild\(badge\)/);
  assert.match(css, /#itensEstoque \.est-controles/);
});

test('Plantas recuperam ação Cuidar como botão do sistema', () => {
  const js = read('public/mobile-qa-v5.js');
  const css = read('public/mobile-qa-v5.css');
  assert.match(js, /qa5-plant-care/);
  assert.match(css, /#abaPlantas \.planta-card > button/);
  assert.match(css, /background:\s*var\(--sage-soft\)/);
});

test('Ritmo expõe registros da semana e água pode ultrapassar a meta', () => {
  const js = read('public/mobile-qa-v5.js');
  const ritmo = read('public/ritmo.js');
  assert.match(js, /openWeekRecords/);
  assert.match(js, /Meta superada em/);
  assert.match(ritmo, /alterarAgua\(500\)/);
  assert.match(ritmo, /Math\.max\(0, atual \+ delta\)/);
});

test('Movimento ganha edição descobrível e teclado numérico nos exercícios', () => {
  const js = read('public/mobile-qa-v5.js');
  const css = read('public/mobile-qa-v5.css');
  assert.match(js, /qa5-agenda-edit/);
  assert.match(js, /openAgendaEditor/);
  assert.match(js, /inputMode = 'decimal'/);
  assert.match(js, /inputMode = 'numeric'/);
  assert.match(css, /ritmo-exercise-inputs[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
});

test('imagens de exercício podem abrir ampliadas', () => {
  const js = read('public/mobile-qa-v5.js');
  assert.match(js, /phase4-exercise-media img/);
  assert.match(js, /qa5-lightbox/);
});

test('medidas corporais têm ajuda visual e campos compactos', () => {
  const js = read('public/mobile-qa-v5.js');
  const css = read('public/mobile-qa-v5.css');
  for (const id of ['ritmoMedCintura','ritmoMedAbdomen','ritmoMedQuadrilAlto','ritmoMedQuadril','ritmoMedPeito','ritmoMedCoxa','ritmoMedBraco','ritmoMedPanturrilha']) {
    assert.match(js, new RegExp(id));
  }
  assert.match(js, /openMeasureGuide/);
  assert.match(css, /qa5-measures-sheet[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
});

test('Fotos de evolução permitem escolher arquivo sem forçar captura imediata', () => {
  const js = read('public/mobile-qa-v5.js');
  assert.match(js, /removeAttribute\('capture'\)/);
  assert.match(js, /selecionar uma foto da galeria/);
});

test('plano alimentar vazio abre caminho de revisão e pode ser removido', () => {
  const js = read('public/mobile-qa-v5.js');
  assert.match(js, /A leitura do PDF não conseguiu separar as refeições automaticamente/);
  assert.match(js, /ritmoAddRefeicaoPlano/);
  assert.match(js, /removeFoodPlan/);
  assert.match(js, /ativo:\s*false/);
});

test('parser de PDF separa cabeçalhos que chegam na mesma linha', async () => {
  const estruturarPlanoAlimentar = await getParser();
  const parsed = estruturarPlanoAlimentar(
    'Café da manhã 07:30 2 fatias de pão; 2 ovos Almoço 12:30 arroz; feijão; frango Jantar 20:00 sopa; torradas'
  );
  assert.equal(parsed.status, 'estruturado');
  assert.equal(parsed.refeicoes.length, 3);
  assert.equal(parsed.refeicoes[0].nome, 'Café da manhã');
  assert.equal(parsed.refeicoes[1].nome, 'Almoço');
  assert.equal(parsed.refeicoes[2].nome, 'Jantar');
});

test('parser preserva trecho limitado quando precisa de revisão manual', async () => {
  const estruturarPlanoAlimentar = await getParser();
  const parsed = estruturarPlanoAlimentar('Plano personalizado sem títulos convencionais. '.repeat(400));
  assert.equal(parsed.status, 'revisao_necessaria');
  assert.ok(parsed.texto_revisao.length > 0);
  assert.ok(parsed.texto_revisao.length <= 8000);
});

test('recorrências aceitam seletor 1 a 31 e último dia de meses curtos', () => {
  const js = read('public/mobile-qa-v5.js');
  const sql = read('db/054_acertos_dia_31.sql');
  assert.match(js, /Array\.from\(\{ length: 31 \}/);
  assert.match(sql, /gerar_dia between 1 and 31/);
  assert.match(sql, /least\(r\.gerar_dia, v_ultimo_dia\)/);
  assert.match(sql, /p_gerar_dia not between 1 and 31/);
});

test('Financeiro diferencia vencidos de contas normais', () => {
  const js = read('public/mobile-qa-v5.js');
  const css = read('public/mobile-qa-v5.css');
  assert.match(js, /ac-chip\.danger/);
  assert.match(js, /qa5-overdue/);
  assert.match(css, /qa5-overdue[\s\S]*var\(--alert\)/);
});

test('Configurações ganham modal de novo local, histórico icon-only e popover de notificação', () => {
  const js = read('public/mobile-qa-v5.js');
  const css = read('public/mobile-qa-v5.css');
  assert.match(js, /Novo local do estoque/);
  assert.match(js, /btnSalvarNovoLocalEstoque/);
  assert.match(css, /ui-history-restore > span/);
  assert.match(js, /qa5-bell-popover/);
});
