import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const history = fs.readFileSync(new URL('../public/acertos-history.js', import.meta.url), 'utf8');
const acertos = fs.readFileSync(new URL('../public/acertos.js', import.meta.url), 'utf8');

test('histórico não usa debounce reiniciado por toda mutação do documento', () => {
  assert.doesNotMatch(history, /clearTimeout\(H\.mountTimer\)/);
  assert.match(history, /requestAnimationFrame/);
  assert.match(history, /if \(H\.mountTimer\) return/);
});

test('histórico remonta quando a Central Financeira destrói o nó injetado', () => {
  assert.match(acertos, /root\.innerHTML\s*=/);
  assert.match(history, /if \(!document\.getElementById\('acertosHistoryModule'\)\) load\(\)/);
  assert.match(history, /MutationObserver\(scheduleMount\)/);
});

test('histórico também se recupera de eventos comuns no iPhone e atualizações financeiras', () => {
  assert.match(history, /lifeos:financeiro-atualizar/);
  assert.match(history, /pageshow/);
  assert.match(history, /window\.addEventListener\('focus', refreshHistory\)/);
});

test('detalhe continua oferecendo comprovante original e recibo LifeOS', () => {
  assert.match(history, /Ver comprovante original/);
  assert.match(history, /Ver recibo LifeOS/);
  assert.match(history, /\/api\/acertos\/lotes\//);
  assert.match(history, /\/api\/acertos\/pagamentos\//);
});
