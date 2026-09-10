import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretarNfceTexto } from '../src/nfce-text.js';

const textoSefazSafari = `SENDAS DISTRIBUIDORA S/A
CNPJ: 06.057.223/0438-14
Rua Doutor Alberto Torres, 0, Sao Goncalo, RJ
ARR CARRET PARB 5kg (Código: 63188 )
Qtde.:1 UN: Un Vl. Unit.: 20,69
Vl. Total
20,69
TOMATE SALADA kg (Código: 8186 )
Qtde.:0,55 UN: Kg Vl. Unit.: 11,89
Vl. Total
6,53
54
510,19
1,90
508,29
Valor pago R$:
508,29
Qtd. total de itens:
Valor total R$:
Descontos R$:
Valor a pagar R$:
Forma de pagamento:
Cartão de Crédito
EMISSÃO NORMAL
Número: 251162 Série: 20 Emissão: 08/09/2026 20:53:50-03:00 - Via Consumidor 2
Chave de acesso
Consulte pela Chave de Acesso em www.fazenda.rj.gov.br/nfce/consulta
Chave de acesso:
3326 0906 0572 2304 3814 6502 0000 2511 6212 0098 8575`;

test('parser lê o layout do PDF salvo pelo Safari sem OCR', () => {
  const nota = interpretarNfceTexto(textoSefazSafari);
  assert.equal(nota.emitente, 'SENDAS DISTRIBUIDORA S/A');
  assert.equal(nota.cnpj, '06057223043814');
  assert.equal(nota.itens.length, 2);
  assert.deepEqual(nota.itens[0], {
    nome: 'ARR CARRET PARB 5kg',
    codigo: '63188',
    quantidade: 1,
    unidade: 'UN',
    valor_unitario: 20.69,
    valor_total: 20.69,
  });
  assert.equal(nota.itens[1].quantidade, 0.55);
  assert.equal(nota.itens[1].unidade, 'KG');
  assert.equal(nota.itens[1].valor_unitario, 11.89);
  assert.equal(nota.itens[1].valor_total, 6.53);
});

test('parser entende o resumo deslocado pelo exportador de PDF', () => {
  const nota = interpretarNfceTexto(textoSefazSafari);
  assert.equal(nota.quantidade_itens_declarada, 54);
  assert.equal(nota.total_itens_bruto, 510.19);
  assert.equal(nota.desconto, 1.90);
  assert.equal(nota.total, 508.29);
});

test('parser recupera emissão e chave mesmo quando a chave está espaçada', () => {
  const nota = interpretarNfceTexto(textoSefazSafari);
  assert.equal(nota.emissao, '08/09/2026 20:53:50-03:00');
  assert.equal(nota.chave, '33260906057223043814650200002511621200988575');
});

test('parser continua aceitando Vl. Total na mesma linha', () => {
  const nota = interpretarNfceTexto(`MERCADO TESTE S/A\nCNPJ: 00.000.000/0001-00\nFEIJAO 1KG (Código: 1)\nQtde.:1 UN: Un Vl. Unit.: 7,99\nVl. Total: 7,99`);
  assert.equal(nota.itens.length, 1);
  assert.equal(nota.itens[0].valor_total, 7.99);
  assert.equal(nota.total, 7.99);
});
