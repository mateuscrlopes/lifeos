import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');

test('Ritmo é o único dono da criação e edição de medidas', () => {
  const js = read('public/ritmo.js');
  const bootstrap = read('public/app-bootstrap.js');
  assert.match(js, /ritmoNovaMedida'\)\?\.addEventListener\('click', \(\) => abrirNovaMedida\(null\)\)/);
  assert.match(js, /data-editar-medida[\s\S]*abrirNovaMedida\(R\.medidas\.find/);
  assert.doesNotMatch(bootstrap, /ritmo-medidas-save/);
  assert.equal(fs.existsSync('public/ritmo-medidas-save.js'), false);
});

test('criação de atividade também não recebe MouseEvent como plano', () => {
  const js = read('public/ritmo.js');
  assert.match(js, /ritmoNovaAtividade'\)\?\.addEventListener\('click', \(\) => abrirNovaAtividade\(null\)\)/);
});

test('persistência de medidas continua no módulo proprietário', () => {
  const js = read('public/ritmo.js');
  assert.match(js, /from\('ritmo_medidas'\)/);
  assert.match(js, /\.update\(payload\)\.eq\('id', medida\.id\)/);
  assert.match(js, /upsert\(payload, \{ onConflict: 'usuario_id,data' \}\)/);
});

test('troca de área do Ritmo reinicia a rolagem da viewport', () => {
  const js = read('public/ritmo.js');
  assert.match(js, /function navegarRitmo\(aba\)/);
  assert.match(js, /body\.scrollTop = 0/);
  assert.match(js, /data-ritmo-tab[\s\S]*navegarRitmo\(b\.dataset\.ritmoTab\)/);
  assert.match(js, /data-ritmo-go[\s\S]*navegarRitmo\(b\.dataset\.ritmoGo\)/);
});

test('modal do Ritmo sempre libera a interface ao fechar', () => {
  const js = read('public/ritmo.js');
  assert.match(js, /document\.body\.classList\.add\('lifeos-modal-open'\)/);
  assert.match(js, /document\.body\.classList\.remove\('lifeos-modal-open'\)/);
  assert.match(js, /if \(conteudo\) conteudo\.innerHTML = ''/);
  assert.match(js, /window\.lifeosConfirmAction/);
});

test('assets web continuam sem cache persistente de código', () => {
  const server = read('src/server.js');
  assert.match(server, /Cache-Control', 'no-cache, must-revalidate'/);
});
