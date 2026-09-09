import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Acertos mantém histórico aprovado com filtros, consolidado e documentos', () => {
  const history = read('public/acertos-history.js');
  const bootstrap = read('public/app-bootstrap.js');

  assert.match(bootstrap, /acertos-history\.js\?v=1/);
  assert.match(history, /Histórico dos acertos/);
  assert.match(history, /data-ach-mode="month"/);
  assert.match(history, /data-ach-mode="year"/);
  assert.match(history, /data-ach-mode="all"/);
  assert.match(history, /Saldo do período/);
  assert.match(history, /Fluxo no período/);
  assert.match(history, /\/api\/acertos\/lotes\//);
  assert.match(history, /\/api\/acertos\/pagamentos\//);
  assert.match(history, /comprovante/);
  assert.match(history, /recibo/);
});

test('Mercado separa o que foi planejado do que foi realmente comprado', () => {
  const sql = read('db/055_market_actual_quantity_and_finish_v2.sql');
  const market = read('public/market-purchase-v2.js');
  const bootstrap = read('public/app-bootstrap.js');

  assert.match(bootstrap, /market-purchase-v2\.js\?v=1/);
  assert.match(sql, /quantidade_planejada numeric/);
  assert.match(sql, /quantidade_comprada numeric/);
  assert.match(sql, /unidade_planejada text/);
  assert.match(sql, /unidade_comprada text/);
  assert.match(sql, /finalizar_compra_mercado_v2/);
  assert.match(sql, /aguardando_conferencia = true/);
  assert.match(market, /Quanto você pegou/);
  assert.match(market, /data-mpx-minus/);
  assert.match(market, /data-mpx-plus/);
  assert.match(market, /quantidade_comprada/);
  assert.match(market, /unidade_comprada/);
  assert.match(market, /Planejado:/);
  assert.match(market, /Peguei:/);
});

test('Preço do mercado usa entrada em centavos sem exigir vírgula', () => {
  const market = read('public/market-purchase-v2.js');

  assert.match(market, /replace\(\/\\D\/g, ''\)/);
  assert.match(market, /dataset\.cents/);
  assert.match(market, /cents \/ 100/);
  assert.match(market, /minimumFractionDigits: 2/);
  assert.match(market, /inputmode="numeric"/);
});

test('NFC-e bloqueada tenta rede do aparelho e aceita PDF ou print localmente', () => {
  const fallback = read('public/nfce-browser-fallback.js');
  const bootstrap = read('public/app-bootstrap.js');

  assert.match(bootstrap, /nfce-browser-fallback\.js\?v=1/);
  assert.match(fallback, /mode: 'cors'/);
  assert.match(fallback, /Tentar pela conexão do iPhone/);
  assert.match(fallback, /Importar PDF ou print/);
  assert.match(fallback, /pdfjs-dist/);
  assert.match(fallback, /tesseract\.js/);
  assert.match(fallback, /quantidade_comprada/);
  assert.match(fallback, /unidade_comprada/);
  assert.doesNotMatch(fallback, /storage\.from\(/);
});
