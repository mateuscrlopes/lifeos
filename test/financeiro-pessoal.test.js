import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ler = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Financeiro usa mounts estáveis e owners separados', () => {
  const html = ler('public/index.html');
  const bootstrap = ler('public/app-bootstrap.js');
  const shell = ler('public/financeiro-shell.js');
  const financeiro = ler('public/financeiro-pessoal.js');

  assert.match(html, /id="lifeosFinanceiroNav"/);
  assert.match(html, /id="lifeosFinanceiroPessoal"/);
  assert.match(html, /id="lifeosFinanceiroContas"/);
  assert.match(html, /id="lifeosFinanceiroAcertos"/);
  assert.match(bootstrap, /financeiro-shell\.js\?v=1/);
  assert.match(bootstrap, /financeiro-pessoal\.js\?v=2/);
  assert.doesNotMatch(bootstrap, /financeiro-pessoal-loader/);
  assert.match(shell, /Pessoal/);
  assert.match(shell, /Contas/);
  assert.match(shell, /Acertos/);
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
  assert.match(sql, /p_tipo not in \('aporte','retirada','ajuste'\)/);
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

test('Contas e Acertos são áreas de primeiro nível, sem details ou reparenting', () => {
  const html = ler('public/index.html');
  const shell = ler('public/financeiro-shell.js');

  assert.match(html, /lifeosFinanceiroContasPanel/);
  assert.match(html, /lifeosFinanceiroAcertosPanel/);
  assert.doesNotMatch(html, /lifeosFinanceiroCasaLegado/);
  assert.doesNotMatch(shell, /appendChild\(contas\)|appendChild\(acertos\)|createElement\('details'\)/);
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


test('Hoje consome resumo financeiro pelo owner da própria tela', () => {
  const hoje = ler('public/hoje-view.js');
  const financeiro = ler('public/financeiro-pessoal.js');

  assert.match(financeiro, /lifeos:financeiro-resumo/);
  assert.match(hoje, /lifeos:financeiro-resumo/);
  assert.match(hoje, /hoje-finance-card/);
  assert.match(hoje, /lifeos:financeiro-pessoal-ir/);
  assert.doesNotMatch(financeiro, /cardsHoje/);
});


test('Financeiro usa apenas o catálogo oficial de ícones', () => {
  const financeiro = ler('public/financeiro-pessoal.js');
  const shell = ler('public/financeiro-shell.js');
  const icons = ler('public/ui/icons.js');

  assert.match(financeiro, /icon\('settings'/);
  assert.match(financeiro, /creditCard/);
  assert.match(shell, /icon\(secao\.icon/);
  assert.match(icons, /wallet:/);
  assert.match(icons, /swap:/);
  assert.doesNotMatch(financeiro, /⚙|▣|◫|●/);
});

test('Acertos em aberto impactam o disponível sem duplicar a regra de pagamento', () => {
  const financeiro = ler('public/financeiro-pessoal.js');
  const acertos = ler('public/acertos.js');

  assert.match(financeiro, /fpAcertosAPagarHorizonte/);
  assert.match(financeiro, /acertosAPagar/);
  assert.match(financeiro, /lifeos:financeiro-shell-ir/);
  assert.match(acertos, /lifeos:acertos-atualizados/);
  assert.doesNotMatch(financeiro, /data-ac-pay|revisar_pagamento|acerto_pagamentos/);
});
