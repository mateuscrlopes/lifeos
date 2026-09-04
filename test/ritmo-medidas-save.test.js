import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('módulo de medidas é carregado pela aplicação', () => {
  const status = read('public/status-estoque.js');
  assert.match(status, /ritmo-medidas-save\.js\?v=1/);
});

test('salvamento de medidas confirma persistência no banco e não falha silenciosamente', () => {
  const js = read('public/ritmo-medidas-save.js');
  assert.doesNotThrow(() => new Function(js));
  assert.match(js, /from\('ritmo_medidas'\)/);
  assert.match(js, /\.select\('\*'\)\.single\(\)/);
  assert.match(js, /if \(error\) throw error/);
  assert.match(js, /Medidas salvas\./);
  assert.match(js, /Não foi possível salvar as medidas/);
});

test('edição preserva id do registro e cadastro novo usa conflito usuario+data', () => {
  const js = read('public/ritmo-medidas-save.js');
  assert.match(js, /data-editar-medida/);
  assert.match(js, /\.update\(payload\)\.eq\('id', id\)/);
  assert.match(js, /upsert\(payload, \{ onConflict: 'usuario_id,data' \}\)/);
});

test('botão salvar é explicitamente button e o handler impede a execução duplicada', () => {
  const js = read('public/ritmo-medidas-save.js');
  assert.match(js, /button\.type = 'button'/);
  assert.match(js, /event\.stopImmediatePropagation/);
  assert.match(js, /let salvando = false/);
});
