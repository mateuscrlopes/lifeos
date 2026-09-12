import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../public/nfce-smart-import-v3.js', import.meta.url), 'utf8');

test('NFC-e aceita item ainda sem mapeamento na biblioteca', () => {
  assert.match(source, /const mapping = exactMapping/);
  assert.match(source, /const rawFactor = Number\(mapping\?\.fator_quantidade \?\? 1\)/);
  assert.match(source, /Number\.isFinite\(rawFactor\) && rawFactor > 0 \? rawFactor : 1/);
  assert.doesNotMatch(source, /Number\(mapping\.fator_quantidade\)/);
});

test('item sem biblioteca segue para revisão em vez de falhar', () => {
  assert.match(source, /_canonical: canonical \|\| row\.nome/);
  assert.match(source, /'Nome ainda não aprendido'/);
  assert.match(source, /_action: mapping\?\.acao_estoque \|\| 'conferir'/);
});
