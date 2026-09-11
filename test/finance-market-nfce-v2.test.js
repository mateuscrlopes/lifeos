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

test('Mercado separa planejamento e compra real sem carregar o rerender legado', () => {
  const sql = read('db/055_market_actual_quantity_and_finish_v2.sql');
  const market = read('public/market-live-v3.js');
  const bootstrap = read('public/app-bootstrap.js');

  assert.match(bootstrap, /market-live-v3\.js\?v=1/);
  assert.doesNotMatch(bootstrap, /market-purchase-v2\.js/);
  assert.match(sql, /quantidade_planejada numeric/);
  assert.match(sql, /quantidade_comprada numeric/);
  assert.match(sql, /unidade_planejada text/);
  assert.match(sql, /unidade_comprada text/);
  assert.match(market, /quantidade_planejada/);
  assert.match(market, /quantidade_comprada/);
  assert.match(market, /Planejado:/);
  assert.match(market, /Peguei:/);
  assert.match(market, /Marcar como peguei/);
});

test('Mercado live observa só a abertura/pulso necessário e não rerenderiza a si próprio', () => {
  const market = read('public/market-live-v3.js');
  assert.match(market, /bodyObserver\.observe\(document\.body, \{ childList: true \}\)/);
  assert.match(market, /overlayObserver\.observe\(overlay, \{ childList: true \}\)/);
  assert.doesNotMatch(market, /observe\(document\.documentElement, \{ childList: true, subtree: true \}\)/);
  assert.match(market, /if \(refreshing\)/);
});

test('Preço do mercado continua usando entrada em centavos no fluxo v3', () => {
  const shopping = read('public/shopping-flow-v3.js');

  assert.match(shopping, /replace\(\/\\D\/g, ''\)/);
  assert.match(shopping, /dataset\.cents/);
  assert.match(shopping, /cents \/ 100/);
  assert.match(shopping, /minimumFractionDigits: 2/);
  assert.match(shopping, /inputmode="numeric"/);
});

test('NFC-e textual é reconhecida por biblioteca e registrada como compra concluída', () => {
  const fallback = read('public/nfce-browser-fallback.js');
  const smart = read('public/nfce-smart-import-v3.js');
  const pdfServer = read('src/nfce-pdf.js');
  const migration = read('db/059_nfce_biblioteca_compra_final.sql');
  const bootstrap = read('public/app-bootstrap.js');

  assert.match(bootstrap, /nfce-browser-fallback\.js\?v=1/);
  assert.match(bootstrap, /nfce-smart-import-v3\.js\?v=1/);
  assert.doesNotMatch(bootstrap, /nfce-file-import-v2\.js/);
  assert.match(fallback, /mode: 'cors'/);
  assert.match(fallback, /tesseract\.js/);
  assert.match(smart, /\/api\/nfce\/analisar-pdf/);
  assert.match(smart, /nfce_produto_mapeamentos/);
  assert.match(smart, /registrar_compra_nfce_v3/);
  assert.match(smart, /Registrar compra/);
  assert.match(smart, /quantidade_itens_declarada/);
  assert.doesNotMatch(smart, /status:\s*'pendente',[\s\S]{0,120}origem:\s*'nfce'/);
  assert.match(migration, /origem = 'nfce'/);
  assert.match(migration, /status = 'comprado'/);
  assert.match(migration, /aguardando_conferencia/);
  assert.match(pdfServer, /PDFParse/);
  assert.match(pdfServer, /interpretarNfceTexto/);
  assert.doesNotMatch(pdfServer, /storage\.from\(/);
});
