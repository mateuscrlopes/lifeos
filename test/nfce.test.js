import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY ||= 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY ||= 'test-service-key';

const { interpretarNfceHtml } = await import('../src/nfce.js');

test('parser da NFC-e lê produtos, quantidades, valores e total', () => {
  const html = `
    <html><body>
      <div class="txtTopo">ASSAI ATACADISTA LTDA</div>
      <div>CNPJ: 12.345.678/0001-90</div>
      <table id="tabResult">
        <tr><td><span class="txtTit">ARROZ TIPO 1 5KG</span><span class="RCod">Código: 123</span>
          <span class="Rqtd">Qtde.: 1</span><span class="RUN">UN: UN</span><span class="RvlUnit">Vl. Unit.: 24,90</span></td><td><span class="valor">24,90</span></td></tr>
        <tr><td><span class="txtTit2">BANANA PRATA KG</span><span class="RCod">Código: 456</span>
          <span class="Rqtd">Qtde.: 1,245</span><span class="RUN">UN: KG</span><span class="RvlUnit">Vl. Unit.: 7,99</span></td><td><span class="valor">9,95</span></td></tr>
      </table>
      <label>Valor a pagar R$:</label><span class="totalNumb txtMax">34,85</span>
      <span class="chave">33260912345678000190650010000001234567890123</span>
      <div>Emissão: 08/09/2026 19:10:00 Número: 123 Série: 1</div>
    </body></html>`;

  const nota = interpretarNfceHtml(html, 'https://consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode?p=33260912345678000190650010000001234567890123|2|1|x');
  assert.equal(nota.emitente, 'ASSAI ATACADISTA LTDA');
  assert.equal(nota.cnpj, '12345678000190');
  assert.equal(nota.quantidade_itens, 2);
  assert.equal(nota.itens[0].nome, 'ARROZ TIPO 1 5KG');
  assert.equal(nota.itens[0].quantidade, 1);
  assert.equal(nota.itens[0].valor_total, 24.9);
  assert.equal(nota.itens[1].quantidade, 1.245);
  assert.equal(nota.itens[1].unidade, 'KG');
  assert.equal(nota.total, 34.85);
  assert.equal(nota.chave, '33260912345678000190650010000001234567890123');
});

test('frontend da NFC-e mantém câmera, foto e consulta autenticada', () => {
  const js = fs.readFileSync(new URL('../public/nfce.js', import.meta.url), 'utf8');
  assert.match(js, /getUserMedia/);
  assert.match(js, /capture="environment"/);
  assert.match(js, /jsqr@1\.4\.0/);
  assert.match(js, /Authorization: `Bearer \$\{token\}`/);
  assert.match(js, /Ler QR da nota fiscal/);
});

test('backend tenta rota alternativa quando a SEFAZ bloqueia o servidor principal', () => {
  const backend = fs.readFileSync(new URL('../src/nfce.js', import.meta.url), 'utf8');
  assert.match(backend, /nfce-rj-proxy/);
  assert.match(backend, /baixarNfceAlternativa/);
  assert.match(backend, /erroPrincipal\?\.codigo === 'SEFAZ_BLOQUEIO'/);
  assert.match(backend, /rota: 'supabase'/);
  assert.match(backend, /apikey: config\.supabaseAnonKey/);
});
