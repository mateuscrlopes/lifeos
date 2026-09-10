import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Gmail reconhece PDF encaminhado com marcador LifeOS e condomínio', () => {
  const code = read('apps-script/financeiro-gmail/Code.gs');
  assert.match(code, /fornecedor: 'Condomínio'/);
  assert.match(code, /subject:LifeOS/);
  assert.match(code, /subject:Condomínio/);
  assert.match(code, /subject:Condominio/);
  assert.match(code, /has:attachment/);
});

test('backend aceita condomínio e mantém leitura local do PDF', () => {
  const server = read('src/financeiro-email.js');
  assert.match(server, /'Condomínio'/);
  assert.match(server, /extrairDadosPdf\(req\.body/);
  assert.match(server, /fornecedor: registro\.fornecedor/);
});

test('Central Financeira sugere nome Condomínio e categoria Moradia', () => {
  const ui = read('public/central-financeira-email.js');
  assert.match(ui, /'Condomínio': 'Condomínio'/);
  assert.match(ui, /\['QuintoAndar', 'Condomínio'\]\.includes\(item\.fornecedor\)/);
  assert.match(ui, /Adicionar às contas/);
});

test('boleto encaminhado continua passando por conferência antes de virar conta', () => {
  const ui = read('public/central-financeira-email.js');
  const server = read('src/financeiro-email.js');
  assert.match(server, /status: 'aguardando'/);
  assert.match(ui, /Confira os dados antes de adicionar a conta/);
  assert.match(ui, /adicionar_conta_email_protegida/);
});
