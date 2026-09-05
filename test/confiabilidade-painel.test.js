import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = caminho => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');

test('painel de plantas não depende de MutationObserver amplo', () => {
  const codigo = ler('public/painel-casa-v4.js');
  assert.doesNotMatch(codigo, /new MutationObserver/);
  assert.match(codigo, /aguardarContexto/);
  assert.match(codigo, /carregarPlantasHomeComAcoes/);
});

test('migração protege boleto, Pix e importação por RPC', () => {
  const sql = ler('db/030_protecao_duplicidade_contas.sql');
  assert.match(sql, /contas_linha_pagamento_uq/);
  assert.match(sql, /contas_pix_pagamento_uq/);
  assert.match(sql, /adicionar_conta_email_protegida/);
  assert.match(sql, /pg_advisory_xact_lock/);
});

test('instalação troca insert direto pela RPC', () => {
  const codigo = ler('public/central-financeira-email.js');
  assert.match(codigo, /adicionar_conta_email_protegida/);
  assert.doesNotMatch(
    codigo,
    /\.from\('contas'\)\s*\.insert\(novaConta\)/
  );
});

test('tablet carrega painel v4 e central financeira v5', () => {
  const tablet = ler('public/tablet-enhancements.js');
  const status = ler('public/app-bootstrap.js');
  assert.match(tablet, /painel-casa-v4\.js\?v=1/);
  assert.match(status, /central-financeira-email\.js\?v=5/);
});
