import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extrairComprovantePdf } from '../src/financeiro-extracao.js';
import { gerarPdfReciboLifeOS } from '../src/recibo-pdf.js';

function pdfEscape(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function pdfComLinhas(linhas) {
  const comandos = ['BT', '/F1 11 Tf', '52 790 Td'];
  linhas.forEach((linha, indice) => {
    if (indice > 0) comandos.push('0 -20 Td');
    comandos.push('(' + pdfEscape(linha) + ') Tj');
  });
  comandos.push('ET');

  const stream = comandos.join('\n');
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Length ' + Buffer.byteLength(stream, 'latin1') + ' >>\nstream\n' + stream + '\nendstream',
  ];

  const partes = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  const offsets = [0];
  let tamanho = partes[0].length;

  objetos.forEach((objeto, indice) => {
    offsets.push(tamanho);
    const bloco = Buffer.from((indice + 1) + ' 0 obj\n' + objeto + '\nendobj\n', 'latin1');
    partes.push(bloco);
    tamanho += bloco.length;
  });

  let xref = 'xref\n0 ' + (objetos.length + 1) + '\n';
  xref += '0000000000 65535 f \n';
  offsets.slice(1).forEach(offset => {
    xref += String(offset).padStart(10, '0') + ' 00000 n \n';
  });
  xref += 'trailer\n<< /Size ' + (objetos.length + 1) + ' /Root 1 0 R >>\n';
  xref += 'startxref\n' + tamanho + '\n%%EOF\n';
  partes.push(Buffer.from(xref, 'latin1'));

  return Buffer.concat(partes);
}

test('le valor e data de comprovante PDF sem IA', async () => {
  const pdf = pdfComLinhas([
    'Comprovante Pix',
    'Valor da transferencia R$ 123,45',
    'Data e hora 01/09/2026 10:32',
  ]);

  const resultado = await extrairComprovantePdf(pdf);

  assert.equal(resultado.status, 'parcial');
  assert.equal(resultado.valor, 123.45);
  assert.match(resultado.pago_em, /^2026-09-01T10:32:00-03:00$/);
});

test('interface carrega acertos e tema', () => {
  const status = fs.readFileSync(new URL('../public/status-estoque.js', import.meta.url), 'utf8');
  assert.match(status, /acertos\.js\?v=4/);
  assert.match(status, /theme\.js\?v=1/);
});

test('hardening remove execucao anonima dos RPCs financeiros', () => {
  const sql = fs.readFileSync(new URL('../db/035_hardening_acertos.sql', import.meta.url), 'utf8');
  for (const nome of [
    'gerar_acertos_recorrentes',
    'criar_despesa_compartilhada',
    'revisar_pagamento_acerto',
    'atualizar_regra_acerto',
  ]) {
    assert.match(sql, new RegExp('revoke execute on function public\\.' + nome, 'i'));
  }
});


test('acertos não oferece o perfil Casa como participante financeiro', () => {
  const source = fs.readFileSync(new URL('../public/acertos.js', import.meta.url), 'utf8');
  assert.match(source, /toLocaleLowerCase\('pt-BR'\) !== 'casa'/);
});

test('divisão 50% é um modo explícito e automático', () => {
  const source = fs.readFileSync(new URL('../public/acertos.js', import.meta.url), 'utf8');
  assert.match(source, /id="acHalf" checked/);
  assert.match(source, /if \(halfToggle\?\.checked\) fillHalf\(\)/);
  assert.match(source, /input\.readOnly = automatic/);
  assert.match(source, /R\$/);
});


test('ponte Nordestrip exige credencial e usa RPC dedicada', () => {
  const source = fs.readFileSync(new URL('../src/integracao-nordestrip.js', import.meta.url), 'utf8');
  assert.match(source, /verificar_token_integracao/);
  assert.match(source, /sincronizar_despesa_nordestrip/);
  assert.match(source, /Credencial da integracao ausente/);
});

test('mapeamento financeiro Nordestrip inclui somente pessoas reais', () => {
  const sql = fs.readFileSync(new URL('../db/036_integracao_nordestrip.sql', import.meta.url), 'utf8');
  assert.match(sql, /5e2bafb7-d6ef-4fe4-8d73-a4f2c37567bf/);
  assert.match(sql, /059c34d6-bcf7-4ec4-b1d8-e5fb111a3092/);
  assert.doesNotMatch(sql, /1e038f4d-3200-47c0-87ee-b2c2d3efff0f/);
  assert.match(sql, /lifeos_has_payment_history/);
});


test('exclusão de acerto preserva histórico e usa ponte reversa quando necessário', () => {
  const source = fs.readFileSync(new URL('../src/acertos.js', import.meta.url), 'utf8');
  assert.match(source, /app\.delete\('\/api\/acertos\/:id'/);
  assert.match(source, /lifeos_obter_segredo_servidor/);
  assert.match(source, /nordestrip\.vercel\.app\/api\/integrations\/lifeos\/expenses\/archive/);
  assert.match(source, /ja possui historico de pagamento/);
  assert.match(source, /status: 'cancelado'/);
});

test('interface permite excluir acerto sem pagamento', () => {
  const source = fs.readFileSync(new URL('../public/acertos.js', import.meta.url), 'utf8');
  assert.match(source, /data-ac-delete/);
  assert.match(source, /method: 'DELETE'/);
  assert.match(source, /também será arquivada lá/);
});

test('segredo da ponte reversa fica restrito ao service role', () => {
  const sql = fs.readFileSync(new URL('../db/038_exclusao_acertos_e_ponte_reversa.sql', import.meta.url), 'utf8');
  assert.match(sql, /lifeos_obter_segredo_servidor/);
  assert.match(sql, /revoke all on function public\.lifeos_obter_segredo_servidor\(text\)/i);
  assert.match(sql, /grant execute on function public\.lifeos_obter_segredo_servidor\(text\)[\s\S]*service_role/i);
});


test('pagamento em lote aceita várias cobranças e mantém diferença como saldo', () => {
  const sql = fs.readFileSync(new URL('../db/049_pagamentos_multiplos_acertos.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table if not exists public\.acerto_pagamento_lotes/);
  assert.match(sql, /create table if not exists public\.acerto_pagamento_itens/);
  assert.match(sql, /create table if not exists public\.acerto_saldos/);
  assert.match(sql, /revisar_pagamento_lote/);
  assert.match(sql, /saldo_credito/);
  assert.match(sql, /saldo_depois/);
  assert.match(sql, /least\(v_saldo_atual, greatest\(v_disponivel,0\)\)/);
});

test('interface permite selecionar dívidas e prevê Pix maior ou menor', () => {
  const source = fs.readFileSync(new URL('../public/acertos.js', import.meta.url), 'utf8');
  assert.match(source, /data-ac-batch-id/);
  assert.match(source, /Total selecionado/);
  assert.match(source, /crédito a seu favor/);
  assert.match(source, /O restante continuará em aberto/);
  assert.match(source, /\/api\/acertos\/pagamentos\/lote\/comprovante/);
  assert.match(source, /showReviewLot/);
  assert.match(source, /revisar_pagamento_lote/);
});

test('servidor cria lote único, guarda comprovante e emite recibo agrupado', () => {
  const source = fs.readFileSync(new URL('../src/acertos.js', import.meta.url), 'utf8');
  assert.match(source, /app\.post\('\/api\/acertos\/pagamentos\/lote\/comprovante'/);
  assert.match(source, /acerto_pagamento_itens/);
  assert.match(source, /diferenca_selecao/);
  assert.match(source, /app\.get\('\/api\/acertos\/lotes\/:id\/recibo'/);
  assert.match(source, /gerarPdfReciboLifeOS/);
});

test('prints de comprovante usam OCR e nunca viram falso R$ 0,00', () => {
  const front = fs.readFileSync(new URL('../public/acertos.js', import.meta.url), 'utf8');
  const server = fs.readFileSync(new URL('../src/acertos.js', import.meta.url), 'utf8');
  const cleanup = fs.readFileSync(new URL('../db/050_limpeza_pagamentos_lote.sql', import.meta.url), 'utf8');

  assert.match(front, /tesseract\.js@7/);
  assert.match(front, /extractPixValueFromOcr/);
  assert.match(front, /Lendo o print/);
  assert.match(front, /x-lifeos-ocr-valor/);
  assert.match(front, /x-lifeos-ocr-confidence/);
  assert.match(server, /x-lifeos-ocr-valor/);
  assert.match(server, /ocr_imagem_cliente/);
  assert.match(server, /numeroPositivoOuNull\(extracao\.valor\)/);
  assert.match(cleanup, /valor_extraido = null/);
  assert.match(cleanup, /imagem_sem_ocr/);
});

test('pagamento por print continua com fallback manual quando OCR não é confiável', () => {
  const front = fs.readFileSync(new URL('../public/acertos.js', import.meta.url), 'utf8');
  assert.match(front, /Não consegui identificar o valor com segurança neste print/);
  assert.match(front, /Você só precisa corrigir se a leitura estiver errada/);
  assert.match(front, /valueInput\.value = ocrValue\.toFixed\(2\)/);
  assert.match(front, /Digite o valor do Pix para continuar/);
  assert.match(front, /valueInput\.value = ''/);
});

test('recibo PDF usa identidade LifeOS sem fundo pesado e inclui itens', () => {
  const pdf = gerarPdfReciboLifeOS({
    titulo: 'Pagamento de 2 cobrancas',
    pagador: 'Ghustavo',
    recebedor: 'Mateus',
    valor_transferencia: 684,
    valor_utilizado: 684,
    valor_excedente: 0,
    valor_faltante: 0,
    valor_extraido: 684,
    enviado_em: '02/09/2026',
    revisado_em: '02/09/2026',
    id: 'teste-lifeos',
    itens: [
      { titulo: 'Contribuição da Casa', saldo_antes: 500, valor_alocado: 500, saldo_depois: 0 },
      { titulo: 'El Hub', saldo_antes: 184, valor_alocado: 184, saldo_depois: 0 },
    ],
  });

  const raw = pdf.toString('latin1');
  assert.match(raw, /^%PDF-1\.4/);
  assert.match(raw, /LifeOS/);
  assert.match(raw, /by GhuMat/);
  assert.match(raw, /RECIBO DE PAGAMENTO/);
  assert.match(raw, /Contribui/);
  assert.match(raw, /El Hub/);
  assert.match(raw, /Saldo a favor/i);
});
