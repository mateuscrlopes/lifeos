import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY ||= 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY ||= 'test-service-key';

const { decodificarTextoPdfSeNecessario, estruturarPlanoAlimentar } = await import('../src/ritmo.js');
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('decoder recupera texto de PDF com fonte deslocada sem destruir quebras de linha', () => {
  const texto = [
    '3ODQR\u0003DOLPHQWDU',
    '\u0013\u001a\u001d\u0016\u0013\u0003\u0010\u0003&DIe\u0010GD\u0010PDQKc',
    '2YR\u0003GH\u0003JDOLQKD\u0003PH[LGR',
    '\u0014\u0015\u001d\u0013\u0013\u0003\u0010\u0003$OPRdR',
    ')LOg\u0003GH\u0003IUDQJR\u0003JUHOKDGR',
    '\u0015\u0013\u001d\u0013\u0013\u0003\u0010\u0003-DQWDU',
    '6RSD\u0003GH\u0003OHJXPHV',
  ].join('\n');

  const decodificado = decodificarTextoPdfSeNecessario(texto);
  assert.match(decodificado, /PLANO ALIMENTAR/i);
  assert.match(decodificado, /07:30/);
  assert.match(decodificado, /12:00/);
  assert.match(decodificado, /20:00/);
  assert.match(decodificado, /FRANGO/i);
  assert.ok(decodificado.includes('\n'));
});

test('parser estrutura refeições do padrão real observado no PDF importado', () => {
  const texto = [
    '3ODQR\u0003DOLPHQWDU',
    '\u0013\u001a\u001d\u0016\u0013\u0003\u0010\u0003&DIe\u0010GD\u0010PDQKc',
    '2YR\u0003GH\u0003JDOLQKD\u0003PH[LGR',
    '\u0014\u0015\u001d\u0013\u0013\u0003\u0010\u0003$OPRdR',
    ')LOg\u0003GH\u0003IUDQJR\u0003JUHOKDGR',
    '$UUR]\u0003EUDQFR\u0003FR]LGR',
    '\u0015\u0013\u001d\u0013\u0013\u0003\u0010\u0003-DQWDU',
    '6RSD\u0003GH\u0003OHJXPHV',
  ].join('\n');

  const plano = estruturarPlanoAlimentar(texto);
  assert.equal(plano.status, 'estruturado');
  assert.equal(plano.versao, 3);
  assert.deepEqual(plano.refeicoes.map(r => r.nome), ['Café da manhã', 'Almoço', 'Jantar']);
  assert.deepEqual(plano.refeicoes.map(r => r.horario), ['07:30', '12:00', '20:00']);
  assert.ok(plano.refeicoes.every(r => r.opcoes.length > 0));
});

test('texto PDF normal não é submetido ao decoder de fonte deslocada', () => {
  const texto = 'Plano alimentar\n07:30 - Café da manhã\nPão e ovos\n12:00 - Almoço\nArroz e frango';
  assert.equal(decodificarTextoPdfSeNecessario(texto), texto);
});

test('QA v5.1 contém correções estruturais de plantas, central e configurações', () => {
  const css = read('public/mobile-qa-v5-1.css');
  const js = read('public/mobile-qa-v5-1.js');
  assert.match(css, /planta-card > div:last-child > button/);
  assert.match(css, /cf-conta-item\.qa51-overdue/);
  assert.match(css, /ac-rule-title \.ac-chip/);
  assert.match(js, /openNewPurchaseLocationModal/);
  assert.match(js, /bindPurchaseLocationButton/);
  assert.match(js, /enhanceCentralFinance/);
  assert.match(js, /qa51-measure-body/);
});

test('Ritmo reserva colunas próprias para horário, ícone, conteúdo e origem', () => {
  const css = read('public/mobile-qa-v5-1.css');
  assert.match(css, /grid-template-areas:[\s\S]*"time icon copy"[\s\S]*"source icon copy"/);
  assert.match(css, /ritmo-plan-row > \.ritmo-plan-copy/);
  assert.match(css, /ritmo-plan-row > \.ritmo-row-icon/);
  assert.match(css, /ritmo-plan-row > \.ritmo-plan-source/);
});

test('busca do Histórico remove a lupa nativa do Safari e preserva o ícone LifeOS', () => {
  const css = read('public/mobile-qa-v5-1.css');
  assert.match(css, /-webkit-appearance: none !important/);
  assert.match(css, /::-webkit-search-decoration/);
  assert.match(css, /padding: 11px 14px 11px 50px !important/);
});

test('v5.1 força nova versão de JS e CSS para evitar módulo antigo no iPhone', () => {
  const status = read('public/app-bootstrap.js');
  const js = read('public/mobile-qa-v5-1.js');
  assert.match(status, /mobile-qa-v5-1\.js\?v=2/);
  assert.match(js, /mobile-qa-v5-1\.css\?v=2/);
  assert.match(js, /pageshow/);
});

test('Locais de compra liga o botão Novo diretamente ao modal e esconde o formulário inline', () => {
  const js = read('public/mobile-qa-v5-1.js');
  assert.match(js, /button\.onclick = event =>/);
  assert.match(js, /openNewPurchaseLocationModal\(\)/);
  assert.match(js, /inputNovoLocalCompra/);
  assert.match(js, /oldInline\.style\.display = 'none'/);
});
