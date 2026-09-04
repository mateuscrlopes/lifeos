import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('módulo de medidas é carregado pela aplicação', () => {
  const status = read('public/status-estoque.js');
  assert.match(status, /ritmo-medidas-save\.js\?v=3/);
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
  assert.match(js, /modo === 'editar' \? await resolverIdEdicao\(ctx\) : null/);
});

test('botão salvar é explicitamente button e o handler impede a execução duplicada', () => {
  const js = read('public/ritmo-medidas-save.js');
  assert.match(js, /button\.type = 'button'/);
  assert.match(js, /event\.stopImmediatePropagation/);
  assert.match(js, /let salvando = false/);
});

test('novo registro é distinguido visualmente da edição de forma determinística', () => {
  const js = read('public/ritmo-medidas-save.js');
  assert.match(js, /modoPendente = 'novo'/);
  assert.match(js, /modoPendente = 'editar'/);
  assert.match(js, /titulo\.textContent = 'Registrar medidas'/);
  assert.match(js, /titulo\.textContent = 'Editar medidas'/);
  assert.match(js, /querySelector\('#ritmoExcluirMedida'\)\?\.remove\(\)/);
  assert.match(js, /requestAnimationFrame\(\(\) => aplicarModoModal/);
  assert.match(js, /setTimeout\(\(\) => aplicarModoModal\(modoPendente\), 40\)/);
  assert.match(js, /MutationObserver\(\(\) => preparar\(\)\)/);
});

test('após salvar, Ritmo recarrega dados e preserva a aba atual', () => {
  const js = read('public/ritmo-medidas-save.js');
  assert.match(js, /recarregarRitmoPreservandoAba/);
  assert.match(js, /lifeos:ritmo-abrir/);
  assert.match(js, /\[data-ritmo-tab\]\.is-active/);
  assert.match(js, /dataset\.ritmoTab/);
  assert.match(js, /querySelector\(`\[data-ritmo-tab=/);
});

test('assets web revalidam para evitar módulos antigos no iPhone', () => {
  const server = read('src/server.js');
  assert.match(server, /express\.static\('public', \{/);
  assert.match(server, /Cache-Control', 'no-cache, must-revalidate'/);
  assert.match(server, /html\|js\|css/);
});
