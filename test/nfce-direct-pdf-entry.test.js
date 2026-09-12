import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const entry = fs.readFileSync(new URL('../public/nfce-entry-v4.js', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('../public/app-bootstrap.js', import.meta.url), 'utf8');

test('PDF pode ser escolhido logo na tela inicial sem abrir a câmera', () => {
  assert.match(entry, /Importar PDF da SEFAZ/);
  assert.match(entry, /accept="application\/pdf,\.pdf"/);
  assert.match(entry, /data-nfb-file/);
  assert.doesNotMatch(entry, /capture=/);
});

test('entrada direta reaproveita o processador oficial e não cria outro fluxo de PDF', () => {
  assert.match(entry, /data-nfb-file/);
  assert.doesNotMatch(entry, /analisar-pdf/);
  assert.doesNotMatch(entry, /processPdf\s*\(/);
});

test('entrada direta não duplica seletor em telas que já oferecem arquivo', () => {
  assert.match(entry, /content\.querySelector\('\[data-nfb-file\]'\)/);
  assert.match(entry, /content\.querySelector\('\[data-nfce-direct-pdf\]'\)/);
});

test('bootstrap carrega a entrada depois do importador inteligente', () => {
  const smart = bootstrap.indexOf("./nfce-smart-import-v3.js?v=1");
  const direct = bootstrap.indexOf("./nfce-entry-v4.js?v=1");
  assert.ok(smart >= 0, 'smart importer precisa estar no bootstrap');
  assert.ok(direct > smart, 'entrada visual deve reutilizar o contrato já instalado pelo smart importer');
});

test('copy inicial substitui a mensagem legada por compra já realizada', () => {
  assert.match(entry, /jogar tudo para o carrinho/i);
  assert.match(entry, /status\.textContent = 'PDF e QR entram no mesmo fluxo de conferência\. A NFC-e é registrada como compra já realizada\.'/);
});
