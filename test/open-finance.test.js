import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Open Finance fica atrás do backend e reutiliza a ponte Nordestrip', () => {
  const server = ler('src/server.js');
  const route = ler('src/open-finance.js');
  const config = ler('src/config.js');

  assert.match(server, /registrarRotasOpenFinance/);
  assert.match(route, /\/api\/financeiro\/open-finance\/sincronizar/);
  assert.match(route, /nordestrip_reverse_bridge_token/);
  assert.match(route, /\/api\/integrations\/lifeos\/open-finance/);
  assert.match(config, /NORDESTRIP_BASE_URL/);
  assert.doesNotMatch(route, /PLUGGY_CLIENT_ID|PLUGGY_CLIENT_SECRET/);
});

test('cache Open Finance é privado por usuário e fundos podem usar conta dedicada', () => {
  const sql = ler('db/062_open_finance_pessoal.sql');

  assert.match(sql, /financeiro_open_finance_contas/);
  assert.match(sql, /financeiro_open_finance_transacoes/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /lifeos_usuario_atual_id/);
  assert.match(sql, /conta_open_finance_id/);
  assert.match(sql, /financeiro_fundos_conta_ativa_uidx/);
});

test('configurações financeiras editáveis ficam na interface, não hardcoded no código', () => {
  const html = ler('public/index.html');
  const config = ler('public/financeiro-config.js');
  const bootstrap = ler('public/app-bootstrap.js');

  assert.match(html, /id="lifeosFinanceiroConfig"/);
  assert.match(bootstrap, /financeiro-config\.js\?v=1/);
  assert.match(config, /vr_mensal_referencia/);
  assert.match(config, /vr_reservado_terceiros/);
  assert.match(config, /margem_seguranca/);
  assert.match(config, /data-fc-visible/);
  assert.match(config, /data-fc-available/);
  assert.doesNotMatch(config, /1200|1\.200|600/);
});

test('financeiro pessoal usa saldos conectados e permite conta dedicada por fundo', () => {
  const financeiro = ler('public/financeiro-pessoal.js');

  assert.match(financeiro, /financeiro_open_finance_contas/);
  assert.match(financeiro, /financeiro_open_finance_transacoes/);
  assert.match(financeiro, /fpSaldoFundo/);
  assert.match(financeiro, /conta_open_finance_id/);
  assert.match(financeiro, /considerar_disponivel/);
  assert.match(financeiro, /Movimentações/);
  assert.match(financeiro, /Pix enviados/);
  assert.match(financeiro, /Cartões no mês/);
});

test('conta dedicada substitui o saldo manual do fundo sem somar duas vezes', () => {
  const financeiro = ler('public/financeiro-pessoal.js');

  assert.match(financeiro, /if \(fundo\?\.conta_open_finance_id\)/);
  assert.match(financeiro, /segregado: contaId \? true/);
  assert.match(financeiro, /considerar_disponivel: false/);
  assert.match(financeiro, /fundo\.conta_open_finance_id/);
});
