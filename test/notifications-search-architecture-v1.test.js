import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Centro de notificações v2 é dono do sino e roteia tarefas/financeiro', () => {
  const bootstrap = read('public/app-bootstrap.js');
  const notifications = read('public/notifications-v2.js');
  const sql = read('db/060_notificacoes_tarefas.sql');

  assert.match(bootstrap, /notifications-v2\.js\?v=1/);
  assert.match(notifications, /ownsBell:\s*true/);
  assert.match(notifications, /sincronizar_notificacoes_tarefas/);
  assert.match(notifications, /entity === 'tarefas'/);
  assert.match(notifications, /trocarSub\?\.\(sub/);
  assert.match(notifications, /trocarAba\?\.\('financeiro'\)/);
  assert.match(notifications, /data-ntf-id/);
  assert.match(notifications, /ntf-reminder/);
  assert.match(sql, /tarefa_atrasada/);
  assert.match(sql, /tarefa_hoje/);
  assert.match(sql, /tarefa_amanha/);
  assert.match(sql, /on conflict do nothing/);
});

test('Lista comum de compras tem busca imediata e independente do Mercado', () => {
  const bootstrap = read('public/app-bootstrap.js');
  const search = read('public/purchase-list-search-v1.js');

  assert.match(bootstrap, /purchase-list-search-v1\.js\?v=1/);
  assert.match(search, /id = 'purchaseListSearch'/);
  assert.match(search, /Buscar na lista de compras/);
  assert.match(search, /#?itens/);
  assert.match(search, /classList\.contains\('item'\)/);
});

test('owners críticos não voltam a ser carregados em duplicidade', () => {
  const bootstrap = read('public/app-bootstrap.js');
  assert.equal((bootstrap.match(/market-live-v3\.js/g) || []).length, 1);
  assert.equal((bootstrap.match(/shopping-flow-v3\.js/g) || []).length, 1);
  assert.equal((bootstrap.match(/nfce-smart-import-v3\.js/g) || []).length, 1);
  assert.equal((bootstrap.match(/notifications-v2\.js/g) || []).length, 1);
  assert.doesNotMatch(bootstrap, /market-purchase-v2\.js/);
  assert.doesNotMatch(bootstrap, /nfce-file-import-v2\.js/);
});
