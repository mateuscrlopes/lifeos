import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('contribuicoes da Casa sao historicas e separadas de Acertos', () => {
  const sql = read('db/063_contribuicoes_casa.sql');

  assert.match(sql, /financeiro_casa_contribuicao_regras/);
  assert.match(sql, /tipo in \('fixa','percentual','restante'\)/);
  assert.match(sql, /inicio\s+date not null/);
  assert.match(sql, /fim\s+date/);
  assert.match(sql, /lifeos_definir_contribuicao_casa/);
  assert.match(sql, /lifeos_contribuicoes_casa_mes/);
  assert.doesNotMatch(sql, /insert into public\.acertos/i);
});

test('contas podem sair da base de contribuicao sem deixar de ser contas', () => {
  const sql = read('db/063_contribuicoes_casa.sql');
  const central = read('public/central-financeira.js');

  assert.match(sql, /entra_contribuicao_casa boolean not null default true/);
  assert.match(central, /data-cf-contribuicao/);
  assert.match(central, /fora da contribuição/);
  assert.match(central, /lifeos:contribuicoes-casa-atualizadas/);
});

test('financeiro pessoal protege a contribuicao mensal antes do disponivel', () => {
  const financeiro = read('public/financeiro-pessoal.js');

  assert.match(financeiro, /fpContribuicaoCasaAtual/);
  assert.match(financeiro, /contribuicaoCasa/);
  assert.match(financeiro, /dinheiroBruto - fundosDentroDoCaixa - compromissos - contribuicaoCasa - acertosAPagar/);
  assert.match(financeiro, /Contribuição da Casa/);
  assert.match(financeiro, /Acertos pessoais/);
});

test('configuracoes permitem valor fixo percentual e restante sem hardcode', () => {
  const config = read('public/financeiro-config.js');

  assert.match(config, /Valor fixo/);
  assert.match(config, /Percentual das contas/);
  assert.match(config, /Restante depois das outras contribuições/);
  assert.match(config, /lifeos_definir_contribuicao_casa/);
  assert.match(config, /Válido a partir de/);
  assert.doesNotMatch(config, /\b500\b/);
});

test('acertos deixam de se apresentar como despesa da Casa', () => {
  const acertos = read('public/acertos.js');

  assert.match(acertos, /Acertos pessoais/);
  assert.doesNotMatch(acertos, /<h2>Acertos da Casa<\/h2>/);
});
