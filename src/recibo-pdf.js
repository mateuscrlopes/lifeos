// recibo-pdf.js — gerador vetorial leve dos recibos LifeOS
// Sem imagens remotas, sem fundo pesado e sem dependencias externas.

function dinheiro(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function pdfEscape(valor) {
  return String(valor ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\xFF]/g, ' ');
}

function pdfCor([r, g, b]) {
  return [r, g, b].map(v => Number(v).toFixed(3)).join(' ');
}

function pdfTexto(x, y, tamanho, texto, negrito = false, cor = [0.11, 0.20, 0.16]) {
  return [
    'BT',
    pdfCor(cor) + ' rg',
    '/' + (negrito ? 'F2' : 'F1') + ' ' + tamanho + ' Tf',
    '1 0 0 1 ' + x + ' ' + y + ' Tm',
    '(' + pdfEscape(texto) + ') Tj',
    'ET',
  ].join('\n');
}

function pdfLinha(x1, y1, x2, y2, cor = [0.84, 0.86, 0.84], largura = 1) {
  return [
    pdfCor(cor) + ' RG',
    largura + ' w',
    x1 + ' ' + y1 + ' m',
    x2 + ' ' + y2 + ' l',
    'S',
  ].join('\n');
}

function pdfRetangulo(x, y, w, h, cor = [0.84, 0.86, 0.84]) {
  return [
    pdfCor(cor) + ' RG',
    '1 w',
    x + ' ' + y + ' ' + w + ' ' + h + ' re',
    'S',
  ].join('\n');
}

function quebrarTexto(texto, maxChars = 70) {
  const palavras = String(texto || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const linhas = [];
  let atual = '';

  for (const palavra of palavras) {
    const candidata = atual ? atual + ' ' + palavra : palavra;
    if (candidata.length > maxChars && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = candidata;
    }
  }

  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [''];
}

function construirPdfPaginas(streams) {
  const objetos = new Map();
  objetos.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objetos.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objetos.set(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  const refs = [];
  let proximo = 5;

  streams.forEach(stream => {
    const pageId = proximo++;
    const contentId = proximo++;
    refs.push(pageId + ' 0 R');
    objetos.set(
      pageId,
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + contentId + ' 0 R >>'
    );
    objetos.set(
      contentId,
      '<< /Length ' + Buffer.byteLength(stream, 'latin1') + ' >>\nstream\n' + stream + '\nendstream'
    );
  });

  objetos.set(2, '<< /Type /Pages /Kids [' + refs.join(' ') + '] /Count ' + streams.length + ' >>');

  const maxId = Math.max(...objetos.keys());
  const partes = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  const offsets = Array(maxId + 1).fill(0);
  let tamanho = partes[0].length;

  for (let id = 1; id <= maxId; id += 1) {
    const objeto = objetos.get(id);
    if (!objeto) throw new Error('Objeto PDF ausente: ' + id);
    offsets[id] = tamanho;
    const bloco = Buffer.from(id + ' 0 obj\n' + objeto + '\nendobj\n', 'latin1');
    partes.push(bloco);
    tamanho += bloco.length;
  }

  const xrefOffset = tamanho;
  let xref = 'xref\n0 ' + (maxId + 1) + '\n';
  xref += '0000000000 65535 f \n';
  for (let id = 1; id <= maxId; id += 1) {
    xref += String(offsets[id]).padStart(10, '0') + ' 00000 n \n';
  }
  xref += 'trailer\n<< /Size ' + (maxId + 1) + ' /Root 1 0 R >>\n';
  xref += 'startxref\n' + xrefOffset + '\n%%EOF\n';
  partes.push(Buffer.from(xref, 'latin1'));

  return Buffer.concat(partes);
}

export function gerarPdfReciboLifeOS(documento = {}) {
  const verde = [0.12, 0.38, 0.26];
  const texto = [0.11, 0.20, 0.16];
  const muted = [0.39, 0.45, 0.41];
  const linha = [0.84, 0.86, 0.84];
  const paginas = [];
  let comandos = [];
  let y = 0;
  let paginaNumero = 0;

  const novaPagina = () => {
    if (comandos.length) paginas.push(comandos.join('\n'));
    comandos = [];
    paginaNumero += 1;
    y = 790;

    // Marca vetorial do LifeOS. Sem imagem remota para nao quebrar a geracao.
    comandos.push(pdfCor(verde) + ' rg');
    comandos.push('56 796 m 62 808 l 68 796 l 80 790 l 68 784 l 62 772 l 56 784 l 44 790 l h f');
    comandos.push(pdfTexto(88, 794, 19, 'LifeOS', true, texto));
    comandos.push(pdfTexto(152, 797, 8, 'by GhuMat', true, muted));
    comandos.push(pdfTexto(44, 754, 10, paginaNumero === 1 ? 'RECIBO DE PAGAMENTO' : 'RECIBO DE PAGAMENTO - CONTINUACAO', true, verde));
    comandos.push(pdfLinha(44, 742, 551, 742, linha));
    y = 718;
  };

  const garantir = (altura) => {
    if (y - altura < 62) novaPagina();
  };

  const textoQuebrado = (valor, x, tamanho = 10, negrito = false, cor = texto, maxChars = 72, passo = 14) => {
    quebrarTexto(valor, maxChars).forEach(l => {
      garantir(passo + 2);
      comandos.push(pdfTexto(x, y, tamanho, l, negrito, cor));
      y -= passo;
    });
  };

  novaPagina();

  textoQuebrado(documento.titulo || 'Pagamento confirmado', 44, 18, true, texto, 48, 22);
  textoQuebrado(
    (documento.pagador || 'Pagador') + ' -> ' + (documento.recebedor || 'Recebedor'),
    44, 10, false, muted, 72, 14
  );
  y -= 8;

  const resumo = [
    ['Pix recebido', dinheiro(documento.valor_transferencia)],
    ['Aplicado nas cobrancas', dinheiro(documento.valor_utilizado)],
    ['Saldo a favor', dinheiro(documento.valor_excedente)],
    ['Ainda em aberto', dinheiro(documento.valor_faltante)],
  ];

  garantir(84);
  comandos.push(pdfRetangulo(44, y - 68, 507, 70, linha));
  resumo.forEach((item, indice) => {
    const col = indice % 2;
    const row = Math.floor(indice / 2);
    const x = 58 + col * 246;
    const yy = y - 18 - row * 32;
    comandos.push(pdfTexto(x, yy + 8, 8, item[0].toUpperCase(), true, muted));
    comandos.push(pdfTexto(x, yy - 5, 12, item[1], true, texto));
  });
  y -= 92;

  comandos.push(pdfTexto(44, y, 10, 'COBRANCAS INCLUIDAS', true, verde));
  y -= 18;

  for (const item of documento.itens || []) {
    const tituloLinhas = quebrarTexto(item.titulo || 'Cobranca', 58);
    const altura = 44 + Math.max(0, tituloLinhas.length - 1) * 12;
    garantir(altura + 10);

    tituloLinhas.forEach((linhaTitulo, idx) => {
      comandos.push(pdfTexto(44, y - idx * 12, 10.5, linhaTitulo, idx === 0, texto));
    });
    y -= tituloLinhas.length * 12 + 4;

    comandos.push(pdfTexto(
      44, y, 8.5,
      'Saldo antes: ' + dinheiro(item.saldo_antes) +
      '   |   Aplicado: ' + dinheiro(item.valor_alocado) +
      '   |   Saldo depois: ' + dinheiro(item.saldo_depois),
      false, muted
    ));
    y -= 13;
    comandos.push(pdfLinha(44, y, 551, y, linha));
    y -= 14;
  }

  garantir(130);
  comandos.push(pdfTexto(44, y, 10, 'DADOS DO PAGAMENTO', true, verde));
  y -= 20;
  [
    'Data do envio: ' + (documento.enviado_em || 'Nao informada'),
    'Confirmado em: ' + (documento.revisado_em || 'Nao informada'),
    'Valor identificado no comprovante: ' +
      (documento.valor_extraido != null ? dinheiro(documento.valor_extraido) : 'Nao identificado automaticamente'),
    'ID LifeOS: ' + (documento.id || 'Nao informado'),
  ].forEach(detalhe => textoQuebrado(detalhe, 44, 9, false, muted, 85, 13));

  y -= 10;
  garantir(58);
  comandos.push(pdfLinha(44, y, 551, y, linha));
  y -= 18;
  textoQuebrado(
    'Documento interno do LifeOS. Nao substitui o comprovante bancario original, que permanece arquivado no sistema.',
    44, 8.5, false, muted, 92, 12
  );

  paginas.push(comandos.join('\n'));
  return construirPdfPaginas(paginas);
}
