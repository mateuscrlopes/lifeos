// LifeOS — parser puro para texto de NFC-e.
// Suporta o texto exportado/imprimido pela consulta oficial da SEFAZ-RJ,
// inclusive quando o rótulo "Vl. Total" fica em uma linha separada.

function limpar(valor = '') {
  return String(valor).replace(/\u00a0/g, ' ').replace(/\r/g, '\n');
}

function textoLinha(valor = '') {
  return String(valor).replace(/[ \t]+/g, ' ').trim();
}

function somenteDigitos(valor = '') {
  return String(valor).replace(/\D/g, '');
}

function numeroPt(valor) {
  const bruto = String(valor || '').replace(/[^\d,.-]/g, '').trim();
  if (!bruto) return null;
  let normalizado = bruto;
  if (bruto.includes(',') && bruto.includes('.')) normalizado = bruto.replace(/\./g, '').replace(',', '.');
  else if (bruto.includes(',')) normalizado = bruto.replace(',', '.');
  else if ((bruto.match(/\./g) || []).length > 1) {
    const partes = bruto.split('.');
    const decimal = partes.pop();
    normalizado = partes.join('') + '.' + decimal;
  }
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function valorAposRotulo(linhas, regex) {
  for (let i = 0; i < linhas.length; i += 1) {
    const linha = linhas[i];
    if (!regex.test(linha)) continue;
    regex.lastIndex = 0;
    const depois = linha.replace(regex, '').replace(/^\s*:?\s*/, '');
    const naMesma = numeroPt(depois);
    if (naMesma != null) return naMesma;
    for (let j = i + 1; j <= Math.min(i + 3, linhas.length - 1); j += 1) {
      const proxima = textoLinha(linhas[j]);
      if (!proxima) continue;
      const valor = numeroPt(proxima);
      if (valor != null) return valor;
      break;
    }
  }
  return null;
}

function chaveDoTexto(texto) {
  const linhas = limpar(texto).split('\n').map(textoLinha);
  for (let i = 0; i < linhas.length; i += 1) {
    if (!/chave\s+de\s+acesso/i.test(linhas[i])) continue;
    for (let j = i; j <= Math.min(i + 4, linhas.length - 1); j += 1) {
      const candidato = somenteDigitos(linhas[j]);
      if (candidato.length === 44) return candidato;
    }
  }
  const compactado = somenteDigitos(texto);
  const match = compactado.match(/\d{44}/);
  return match?.[0] || null;
}

function emissaoDoTexto(texto) {
  const match = String(texto).match(/Emiss(?:ã|a)o\s*:\s*(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?(?:-\d{2}:\d{2})?)?)/i);
  return match?.[1] || null;
}

function emitenteDoTexto(linhas) {
  for (const linha of linhas.slice(0, 12)) {
    if (!linha) continue;
    if (/^(?:cnpj|cpf|documento auxiliar|nfce|nfc-e|rua|avenida|av\.|rodovia|estrada|data\/hora)/i.test(linha)) continue;
    if (/^https?:\/\//i.test(linha)) continue;
    if ((linha.match(/[A-Za-zÀ-ÿ]/g) || []).length < 4) continue;
    return linha.slice(0, 120);
  }
  return null;
}

function cnpjDoTexto(texto) {
  const match = String(texto).match(/\bCNPJ\s*:?\s*([\d./-]{14,20})/i);
  return match ? somenteDigitos(match[1]) : null;
}

function itemDoBloco(nome, codigo, detalhes, valorTotal) {
  const detalhe = textoLinha(detalhes);
  const match = detalhe.match(/Qtde\.?\s*:\s*([\d.,]+)\s+UN\s*:\s*([^\s]+)\s+Vl\.?\s*Unit\.?\s*:\s*([\d.,]+)/i);
  if (!match) return null;
  const quantidade = numeroPt(match[1]);
  const valorUnitario = numeroPt(match[3]);
  const total = numeroPt(valorTotal);
  if (!textoLinha(nome) || quantidade == null || (valorUnitario == null && total == null)) return null;
  return {
    nome: textoLinha(nome),
    codigo: somenteDigitos(codigo) || null,
    quantidade,
    unidade: textoLinha(match[2]).toUpperCase() || null,
    valor_unitario: valorUnitario,
    valor_total: total,
  };
}

export function interpretarNfceTexto(textoRecebido, url = '') {
  const texto = limpar(textoRecebido);
  const linhasOriginais = texto.split('\n');
  const linhas = linhasOriginais.map(textoLinha);
  const itens = [];

  for (let i = 0; i < linhas.length; i += 1) {
    const cabecalho = linhas[i].match(/^(.{2,180}?)\s*\(\s*C[oó]digo\s*:\s*([^)]{1,50})\s*\)\s*$/i);
    if (!cabecalho) continue;

    let detalhes = '';
    let valorTotal = '';
    for (let j = i + 1; j <= Math.min(i + 6, linhas.length - 1); j += 1) {
      if (!detalhes && /Qtde\.?\s*:/i.test(linhas[j]) && /Vl\.?\s*Unit\.?\s*:/i.test(linhas[j])) {
        detalhes = linhas[j];
        continue;
      }
      if (!detalhes) continue;
      if (/^Vl\.?\s*Total\s*:?[\s\d,.-]*$/i.test(linhas[j])) {
        const mesmaLinha = linhas[j].replace(/^Vl\.?\s*Total\s*:?\s*/i, '');
        if (numeroPt(mesmaLinha) != null) valorTotal = mesmaLinha;
        else {
          const seguinte = linhas[j + 1] || '';
          if (numeroPt(seguinte) != null) valorTotal = seguinte;
        }
        break;
      }
      if (/^[\d.,]+$/.test(linhas[j]) && numeroPt(linhas[j]) != null) {
        valorTotal = linhas[j];
        break;
      }
    }

    const item = itemDoBloco(cabecalho[1], cabecalho[2], detalhes, valorTotal);
    if (item) itens.push(item);
  }

  // Compatibilidade com PDFs/extrações que colocam tudo no mesmo fluxo e não
  // preservam a quebra antes de "Vl. Total".
  if (!itens.length) {
    const regex = /(?:^|\n)([^\n]{2,180}?)\s*\(\s*C[oó]digo\s*:\s*([^)]{1,50})\s*\)\s*(?:\n|\s)+Qtde\.?\s*:\s*([\d.,]+)\s+UN\s*:\s*([^\s]+)\s+Vl\.?\s*Unit\.?\s*:\s*([\d.,]+)\s*(?:\n|\s)+(?:Vl\.?\s*Total\s*:?\s*)?(?:\n|\s)*([\d.,]+)/gim;
    let match;
    while ((match = regex.exec(texto))) {
      const item = itemDoBloco(match[1], match[2], `Qtde.:${match[3]} UN: ${match[4]} Vl. Unit.: ${match[5]}`, match[6]);
      if (item) itens.push(item);
    }
  }

  const valorAPagar = valorAposRotulo(linhas, /Valor\s+a\s+pagar\s*R\$?/i);
  const valorTotal = valorAposRotulo(linhas, /Valor\s+total\s*R\$?/i);
  const totalItens = itens.reduce((soma, item) => soma + (Number(item.valor_total) || 0), 0);
  const qtdDeclarada = valorAposRotulo(linhas, /Qtd\.?\s*total\s+de\s+itens/i);

  return {
    emitente: emitenteDoTexto(linhas),
    cnpj: cnpjDoTexto(texto),
    chave: chaveDoTexto(texto),
    emissao: emissaoDoTexto(texto),
    total: valorAPagar ?? valorTotal ?? (totalItens || null),
    total_itens_bruto: valorTotal ?? (totalItens || null),
    quantidade_itens: itens.length,
    quantidade_itens_declarada: qtdDeclarada == null ? null : Number(qtdDeclarada),
    itens,
    url: url || null,
  };
}
