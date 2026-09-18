import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Financeiro pessoal é carregado pelo bootstrap e tem owner próprio', () => {
  const bootstrap = ler('public/app-bootstrap.js');
  const loader = ler('public/financeiro-pessoal-loader.js');
  const financeiro = ler('public/financeiro-pessoal.js');

  assert.match(bootstrap, /financeiro-pessoal-loader\.js\?v=1/);
  assert.match(loader, /lifeosFinanceiroPessoal/);
  assert.match(loader, /Contas e acertos da Casa/);
  assert.match(financeiro, /#?lifeosFinanceiroPessoal|lifeosFinanceiroPessoal/);
  assert.doesNotMatch(financeiro, /MutationObserver/);
  assert.doesNotMatch(financeiro, /cardsHoje/);
});

test('Financeiro pessoal calcula disponível real sem usar limite bancário como orçamento', () => {
  const financeiro = ler('public/financeiro-pessoal.js');

  assert.match(financeiro, /fundosDentroDoCaixa/);
  assert.match(financeiro, /aportesPendentes/);
  assert.match(financeiro, /margem_seguranca/);
  assert.match(financeiro, /Math\.min\(limiteCartoes, pix\)/);
  assert.match(financeiro, /Você pode gastar hoje/);
  assert.match(financeiro, /Simular um gasto/);
});

test('Fundos permitem aporte, retirada e dinheiro fisicamente separado', () => {
  const financeiro = ler('public/financeiro-pessoal.js');
  const sql = ler('db/060_financeiro_pessoal.sql');

  assert.match(financeiro, /lifeos_movimentar_fundo_pessoal/);
  assert.match(financeiro, /segregado/);
  assert.match(sql, /financeiro_fundos_pessoais/);
  assert.match(sql, /p_tipo in \('aporte','retirada','ajuste'\)/);
  assert.match(sql, /Saldo insuficiente no fundo/);
});

test('Dados financeiros pessoais ficam isolados pelo usuário autenticado', () => {
  const sql = ler('db/060_financeiro_pessoal.sql');

  assert.match(sql, /alter table public\.financeiro_pessoal_config enable row level security/);
  assert.match(sql, /alter table public\.financeiro_carteiras_pessoais enable row level security/);
  assert.match(sql, /alter table public\.financeiro_fundos_pessoais enable row level security/);
  assert.match(sql, /usuario_id = \(select public\.lifeos_usuario_atual_id\(\)\)/);
  assert.doesNotMatch(sql, /lifeos_usuario_na_casa/);
});

test('Financeiro pessoal preserva contas e acertos da Casa como área secundária', () => {
  const loader = ler('public/financeiro-pessoal-loader.js');

  assert.match(loader, /lifeosFinanceiroContas/);
  assert.match(loader, /lifeosFinanceiroAcertos/);
  assert.match(loader, /createElement\('details'\)/);
  assert.match(loader, /appendChild\(contas\)/);
  assert.match(loader, /appendChild\(acertos\)/);
});

test('CSS financeiro é mobile-first e respeita safe area e tema por tokens', () => {
  const css = ler('public/financeiro-pessoal.css');
  const hoje = ler('public/hoje.css');

  assert.match(hoje, /financeiro-pessoal\.css\?v=1/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /var\(--paper\)/);
  assert.match(css, /var\(--sage\)/);
  assert.match(css, /@media \(min-width: 560px\)/);
  assert.doesNotMatch(css, /#painelCasa|tablet/i);
});
