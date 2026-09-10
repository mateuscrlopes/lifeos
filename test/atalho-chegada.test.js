import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  classificarItensChegada,
  estoquePrecisaRepor,
  localEstoqueCompativel,
} from '../src/atalhos-chegada.js';

const routeSource = fs.readFileSync(new URL('../src/atalhos.js', import.meta.url), 'utf8');
const mercado = new Set([
  'cozinha - nao pereciveis',
  'cozinha - cafe da manha',
  'cozinha - hortifruti',
  'banheiro - higiene pessoal',
  'lavanderia',
]);
const farmacia = new Set(['farmacia / remedios', 'banheiro - higiene pessoal']);

function stock(overrides = {}) {
  return {
    id: 's1',
    nome: 'Arroz',
    categoria: 'mercado',
    local: 'Despensa',
    critico: false,
    tipo: 'contavel',
    quantidade: 0,
    minimo: 1,
    nivel: null,
    minimo_nivel: '25',
    ...overrides,
  };
}

test('item crítico e baixo fora da lista entra diretamente na chegada', () => {
  const resultado = classificarItensChegada({
    itensLista: [],
    itensEstoque: [stock({ critico: true })],
    categoriasAceitas: mercado,
  });
  assert.equal(resultado.criticos.length, 1);
  assert.equal(resultado.criticos[0].nome, 'Arroz');
  assert.equal(resultado.criticos[0].origem_chegada, 'estoque');
});

test('item crítico já na lista não é duplicado pelo estoque', () => {
  const itemEstoque = stock({ critico: true });
  const resultado = classificarItensChegada({
    itensLista: [{ id: 'l1', nome: 'Arroz', estoque_id: 's1', compra_destinos: { tipo: 'mercado', entra_lista_mercado: true } }],
    itensEstoque: [itemEstoque],
    categoriasAceitas: mercado,
  });
  assert.equal(resultado.todos.length, 1);
  assert.equal(resultado.criticos.length, 1);
  assert.equal(resultado.criticos[0].origem_chegada, 'lista');
});

test('item normal explicitamente na lista aparece como item da lista', () => {
  const resultado = classificarItensChegada({
    itensLista: [{ id: 'l1', nome: 'Banana', estoque_id: null, compra_destinos: { tipo: 'mercado', entra_lista_mercado: true } }],
    itensEstoque: [],
    categoriasAceitas: mercado,
  });
  assert.equal(resultado.outros.length, 1);
  assert.equal(resultado.outros[0].nome, 'Banana');
});

test('item destinado a outro tipo de estabelecimento é filtrado', () => {
  const resultadoMercado = classificarItensChegada({
    itensLista: [{ id: 'l1', nome: 'Remédio', estoque_id: null, compra_destinos: { tipo: 'farmacia', entra_lista_mercado: false } }],
    itensEstoque: [],
    categoriasAceitas: mercado,
  });
  assert.equal(resultadoMercado.todos.length, 0);

  const resultadoFarmacia = classificarItensChegada({
    itensLista: [{ id: 'l1', nome: 'Remédio', estoque_id: null, compra_destinos: { tipo: 'farmacia', entra_lista_mercado: false } }],
    itensEstoque: [],
    categoriasAceitas: farmacia,
  });
  assert.equal(resultadoFarmacia.outros.length, 1);
});

test('estoque baixo não crítico vira reposição e estoque suficiente não aparece sozinho', () => {
  assert.equal(estoquePrecisaRepor(stock({ quantidade: 0.5, minimo: 1, tipo: 'peso_volume' })), true);
  assert.equal(estoquePrecisaRepor(stock({ quantidade: 3, minimo: 1 })), false);

  const resultado = classificarItensChegada({
    itensLista: [],
    itensEstoque: [stock({ quantidade: 0.5, minimo: 1, tipo: 'peso_volume' }), stock({ id: 's2', nome: 'Feijão', quantidade: 3, minimo: 1 })],
    categoriasAceitas: mercado,
  });
  assert.deepEqual(resultado.reposicao.map(item => item.nome), ['Arroz']);
});

test('compatibilidade trata locais antigos sem ignorar configuração do estabelecimento', () => {
  assert.equal(localEstoqueCompativel('Despensa', mercado), true);
  assert.equal(localEstoqueCompativel('Cozinha', mercado), true);
  assert.equal(localEstoqueCompativel('Banheiro', farmacia), true);
  assert.equal(localEstoqueCompativel('Despensa', farmacia), false);
});

test('nenhum item necessário produz coleção vazia', () => {
  const resultado = classificarItensChegada({ itensLista: [], itensEstoque: [], categoriasAceitas: mercado });
  assert.equal(resultado.todos.length, 0);
});

test('rota mantém nome, local_id, coordenadas e rejeição de token inválido', () => {
  assert.match(routeSource, /local_id: localId/);
  assert.match(routeSource, /encontrarLocalInformado\(locais, localId, local\)/);
  assert.match(routeSource, /prepararCoordenadas\(latitude, longitude\)/);
  assert.match(routeSource, /if \(!usuario\) return res\.status\(401\)\.send\('Token inválido\.'\)/);
});

test('rota consulta os campos de estoque usados pela fonte de verdade', () => {
  assert.match(routeSource, /tipo,quantidade,minimo,nivel,minimo_nivel/);
  assert.match(routeSource, /classificarItensChegada/);
  assert.match(routeSource, /itens para repor/);
});
