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
  assert.match(js, /handleNewPurchaseLocation/);
  assert.match(js, /enhanceCentralFinance/);
  assert.match(js, /qa51-measure-body/);
});
