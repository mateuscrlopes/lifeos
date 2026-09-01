// financeiro-extracao.js
// Leitura local de PDFs financeiros. Nenhum documento e enviado para uma IA externa.

import { CanvasFactory } from 'pdf-parse/worker';
import { PasswordException, PDFParse } from 'pdf-parse';

export const EXTRACAO_VERSAO = 3;
const LIMITE_TEXTO = 250000;

function normalizarTexto(valor) {
  return String(valor || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, LIMITE_TEXTO);
}

function semAcentos(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseDataBr(valor) {
  const match = String(valor || '').match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (!match) return null;

  const dia = Number(match[1]);
  const mes = Number(match[2]);
  let ano = Number(match[3]);

  if (ano < 100) ano += 2000;
  if (ano < 2020 || ano > 2040 || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return null;
  }

  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return null;
  }

  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function parseValorBr(valor) {
  const limpo = String(valor || '')
    .replace(/[^\d,.\-]/g, '')
    .trim();

  if (!limpo) return null;

  let numeroTexto = limpo;

  if (limpo.includes(',') && limpo.includes('.')) {
    numeroTexto = limpo.replace(/\./g, '').replace(',', '.');
  } else if (limpo.includes(',')) {
    numeroTexto = limpo.replace(',', '.');
  } else {
    const partes = limpo.split('.');
    if (partes.length > 2) {
      const decimal = partes.pop();
      numeroTexto = partes.join('') + '.' + decimal;
    }
  }

  const numero = Number(numeroTexto);
  if (!Number.isFinite(numero) || numero <= 0 || numero > 1000000) return null;

  return Number(numero.toFixed(2));
}

function ocorrencias(textoBase, termo) {
  const resultados = [];
  let inicio = 0;

  while (inicio < textoBase.length) {
    const indice = textoBase.indexOf(termo, inicio);
    if (indice < 0) break;
    resultados.push(indice);
    inicio = indice + termo.length;
  }

  return resultados;
}

function extrairVencimento(texto) {
  const base = semAcentos(texto).toLowerCase();
  const rotulos = [
    'data de vencimento',
    'vencimento',
    'vence em',
    'venc.',
    'data venc',
  ];

  for (const rotulo of rotulos) {
    for (const indice of ocorrencias(base, rotulo)) {
      const trechoDepois = texto.slice(indice, indice + 140);
      const depois = trechoDepois.match(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/);
      const dataDepois = parseDataBr(depois?.[0]);
      if (dataDepois) return dataDepois;

      const trechoAntes = texto.slice(Math.max(0, indice - 70), indice + rotulo.length);
      const datasAntes = trechoAntes.match(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/g) || [];
      const dataAntes = parseDataBr(datasAntes.at(-1));
      if (dataAntes) return dataAntes;
    }
  }

  return null;
}

function encontrarMoeda(trecho) {
  const comCifrao = trecho.match(/R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})|R\$\s*\d+(?:,\d{2})/i);
  if (comCifrao) return parseValorBr(comCifrao[0]);

  const simples = trecho.match(/\b\d{1,3}(?:\.\d{3})*,\d{2}\b|\b\d+,\d{2}\b/);
  return parseValorBr(simples?.[0]);
}

function extrairValor(texto) {
  const base = semAcentos(texto).toLowerCase();
  const rotulos = [
    'valor total a pagar',
    'total a pagar',
    'valor a pagar',
    'valor da fatura',
    'valor do documento',
    'valor cobrado',
    'valor total',
    'total da fatura',
    'quanto eu vou pagar',
  ];

  for (const rotulo of rotulos) {
    for (const indice of ocorrencias(base, rotulo)) {
      const valorDepois = encontrarMoeda(texto.slice(indice, indice + 180));
      if (valorDepois) return valorDepois;

      const valorAntes = encontrarMoeda(texto.slice(Math.max(0, indice - 80), indice + rotulo.length));
      if (valorAntes) return valorAntes;
    }
  }

  return null;
}

function digitoModulo10(valor) {
  let soma = 0;
  let multiplicador = 2;

  for (let indice = valor.length - 1; indice >= 0; indice -= 1) {
    const produto = Number(valor[indice]) * multiplicador;
    soma += Math.floor(produto / 10) + (produto % 10);
    multiplicador = multiplicador === 2 ? 1 : 2;
  }

  return (10 - (soma % 10)) % 10;
}

function digitoModulo11Arrecadacao(valor) {
  let soma = 0;
  let peso = 2;

  for (let indice = valor.length - 1; indice >= 0; indice -= 1) {
    soma += Number(valor[indice]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }

  const resto = soma % 11;
  return resto === 0 || resto === 1 ? 0 : 11 - resto;
}

function linhaBancariaValida(digitos) {
  if (digitos.length !== 47) return false;

  return digitoModulo10(digitos.slice(0, 9)) === Number(digitos[9])
    && digitoModulo10(digitos.slice(10, 20)) === Number(digitos[20])
    && digitoModulo10(digitos.slice(21, 31)) === Number(digitos[31]);
}

function linhaArrecadacaoValida(digitos) {
  if (digitos.length !== 48 || digitos[0] !== '8') return false;

  const referencia = digitos[2];
  const calcular = referencia === '6' || referencia === '7'
    ? digitoModulo10
    : referencia === '8' || referencia === '9'
      ? digitoModulo11Arrecadacao
      : null;

  if (!calcular) return false;

  for (let inicio = 0; inicio < 48; inicio += 12) {
    const bloco = digitos.slice(inicio, inicio + 12);
    if (calcular(bloco.slice(0, 11)) !== Number(bloco[11])) return false;
  }

  return true;
}

function codigoBarrasValido(digitos) {
  if (digitos.length !== 44) return false;
  return digitos[0] === '8' || /^\d{3}9/.test(digitos);
}

function encontrarLinhaEmDigitos(digitosRecebidos, tamanhos = [48, 47, 44]) {
  const digitos = String(digitosRecebidos || '').replace(/\D/g, '');

  for (const tamanho of tamanhos) {
    if (digitos.length < tamanho) continue;

    for (let inicio = 0; inicio <= digitos.length - tamanho; inicio += 1) {
      const candidato = digitos.slice(inicio, inicio + tamanho);

      if (
        (tamanho === 48 && linhaArrecadacaoValida(candidato))
        || (tamanho === 47 && linhaBancariaValida(candidato))
        || (tamanho === 44 && codigoBarrasValido(candidato))
      ) {
        return candidato;
      }
    }
  }

  return null;
}

function extrairLinhaEnel(original, base) {
  // A fatura da Enel também traz uma chave/QR da nota fiscal no topo.
  // Para não confundi-la com o pagamento, a busca fica restrita ao bloco
  // bancário e aceita somente a linha digitável validada de 47 ou 48 dígitos.
  const ancoras = [
    'banco bradesco',
    'ficha de compensacao',
    'pagavel em qualquer banco',
    'linha digitavel',
    'codigo de barras',
  ];

  const indices = ancoras
    .flatMap(ancora => ocorrencias(base, ancora))
    .sort((a, b) => b - a);

  for (const indice of indices) {
    const trecho = original.slice(
      Math.max(0, indice - 260),
      Math.min(original.length, indice + 1800)
    );
    const linha = encontrarLinhaEmDigitos(trecho, [47, 48]);
    if (linha) return linha;
  }

  // Reserva: o boleto costuma estar no rodapé da primeira página. Mesmo aqui,
  // códigos de 44 dígitos são recusados para não aceitar a chave da nota fiscal.
  const rodape = original.slice(Math.floor(original.length * 0.55));
  return encontrarLinhaEmDigitos(rodape, [47, 48]);
}

function extrairLinhaDigitavel(texto, contexto = {}) {
  const original = String(texto || '');
  const base = semAcentos(original).toLowerCase();
  const tamanhos = contexto.fornecedor ? [48, 47] : [48, 47, 44];

  if (contexto.fornecedor === 'Enel') {
    return extrairLinhaEnel(original, base);
  }

  const rotulos = [
    'linha digitavel',
    'codigo de barras',
    'codigo para pagamento',
    'ficha de compensacao',
  ];

  for (const rotulo of rotulos) {
    for (const indice of ocorrencias(base, rotulo)) {
      const trecho = original.slice(
        Math.max(0, indice - 220),
        Math.min(original.length, indice + 520)
      );
      const linha = encontrarLinhaEmDigitos(trecho, tamanhos);
      if (linha) return linha;
    }
  }

  const linhas = original.split(/\n+/);

  for (let indice = 0; indice < linhas.length; indice += 1) {
    const combinacoes = [
      linhas[indice],
      `${linhas[indice] || ''} ${linhas[indice + 1] || ''}`,
      `${linhas[indice] || ''} ${linhas[indice + 1] || ''} ${linhas[indice + 2] || ''}`,
    ];

    for (const trecho of combinacoes) {
      const linha = encontrarLinhaEmDigitos(trecho, tamanhos);
      if (linha) return linha;
    }
  }

  const blocos = original.match(/[\d.\-\s]{40,180}/g) || [];

  for (const bloco of blocos) {
    const linha = encontrarLinhaEmDigitos(bloco, tamanhos);
    if (linha) return linha;
  }

  return null;
}

function crc16Pix(valor) {
  let crc = 0xFFFF;

  for (const byte of Buffer.from(String(valor || ''), 'utf8')) {
    crc ^= byte << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000)
        ? ((crc << 1) ^ 0x1021) & 0xFFFF
        : (crc << 1) & 0xFFFF;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function pixValido(valor) {
  const candidato = String(valor || '').trim();
  const final = candidato.match(/6304([0-9A-Fa-f]{4})$/);
  if (!final) return false;

  const informado = final[1].toUpperCase();
  const calculado = crc16Pix(candidato.slice(0, -4));
  return informado === calculado;
}

function extrairPixCopiaCola(texto) {
  const original = String(texto || '');
  const variantes = [
    original,
    original.replace(/[\r\n\t]+/g, ''),
  ];

  for (const variante of variantes) {
    let inicio = variante.indexOf('000201');

    while (inicio >= 0) {
      let fim = variante.indexOf('6304', inicio + 6);

      while (fim >= 0 && fim - inicio <= 1500) {
        const candidato = variante.slice(inicio, fim + 8).trim();

        if (candidato.length >= 30 && pixValido(candidato)) {
          return candidato;
        }

        fim = variante.indexOf('6304', fim + 4);
      }

      inicio = variante.indexOf('000201', inicio + 6);
    }
  }

  return null;
}

export function extrairDadosTexto(textoRecebido, contexto = {}) {
  const texto = normalizarTexto(textoRecebido);

  if (!texto || texto.replace(/\s/g, '').length < 20) {
    return {
      versao: EXTRACAO_VERSAO,
      valor: null,
      vencimento: null,
      linha_digitavel: null,
      pix_copia_cola: null,
      fornecedor: contexto.fornecedor || null,
      caracteres_lidos: texto.length,
      status: 'falha',
      codigo: 'sem_texto',
      erro: 'O documento nao possui texto suficiente para leitura.',
    };
  }

  const pixCopiaCola = extrairPixCopiaCola(texto);
  const textoSemPix = pixCopiaCola ? texto.replace(pixCopiaCola, ' ') : texto;
  let valor = extrairValor(textoSemPix);

  if (!valor && contexto.origem === 'email') {
    const base = semAcentos(textoSemPix).toLowerCase();

    for (const indice of ocorrencias(base, 'valor')) {
      valor = encontrarMoeda(textoSemPix.slice(indice, indice + 300));
      if (valor) break;
    }
  }

  const dados = {
    versao: EXTRACAO_VERSAO,
    valor,
    vencimento: extrairVencimento(textoSemPix),
    linha_digitavel: extrairLinhaDigitavel(textoSemPix, contexto),
    pix_copia_cola: pixCopiaCola,
    fornecedor: contexto.fornecedor || null,
    caracteres_lidos: texto.length,
  };

  return {
    ...dados,
    status: consolidarStatus(dados),
    codigo: null,
    erro: null,
  };
}

function consolidarStatus(dados) {
  const principais = Number(Boolean(dados.valor)) + Number(Boolean(dados.vencimento));

  if (principais === 2) return 'sucesso';
  if (principais === 1 || dados.linha_digitavel || dados.pix_copia_cola) return 'parcial';
  return 'falha';
}

export async function extrairDadosPdf(buffer, contexto = {}) {
  let parser;

  try {
    const senhaPdf = String(contexto.senhaPdf || '');

    parser = new PDFParse({
      data: buffer,
      CanvasFactory,
      ...(senhaPdf ? { password: senhaPdf } : {}),
    });

    const resultado = await parser.getText({ first: 8 });
    const texto = normalizarTexto(resultado?.text);

    return extrairDadosTexto(texto, contexto);
  } catch (erro) {
    const senhaPdf = String(contexto.senhaPdf || '');
    const erroDeSenha = erro instanceof PasswordException
      || erro?.name === 'PasswordException';

    if (erroDeSenha) {
      return {
        versao: EXTRACAO_VERSAO,
        status: 'falha',
        codigo: senhaPdf ? 'senha_incorreta' : 'senha_necessaria',
        erro: senhaPdf
          ? 'A senha configurada nao abriu o PDF.'
          : 'O PDF exige uma senha para leitura.',
        fornecedor: contexto.fornecedor || null,
      };
    }

    return {
      versao: EXTRACAO_VERSAO,
      status: 'falha',
      codigo: 'erro_leitura',
      erro: String(erro?.message || erro || 'Falha desconhecida.').slice(0, 300),
      fornecedor: contexto.fornecedor || null,
    };
  } finally {
    try {
      await parser?.destroy();
    } catch {
      // O descarte do leitor nao deve interromper o fluxo.
    }
  }
}

export function consolidarExtracoes(anexos = []) {
  const extracoes = anexos
    .map(anexo => ({
      nome: anexo?.nome || null,
      ...(anexo?.extracao || {}),
    }))
    .filter(extracao => extracao.status);

  const valores = extracoes.map(item => item.valor).filter(valor => Number.isFinite(valor));
  const vencimentos = extracoes.map(item => item.vencimento).filter(Boolean);
  const linhas = extracoes.map(item => item.linha_digitavel).filter(Boolean);
  const pix = extracoes.map(item => item.pix_copia_cola).filter(Boolean);

  const valor = valores[0] ?? null;
  const vencimento = vencimentos[0] ?? null;
  const linhaDigitavel = linhas[0] ?? null;
  const pixCopiaCola = pix[0] ?? null;

  const dados = {
    valor,
    vencimento,
    linha_digitavel: linhaDigitavel,
    pix_copia_cola: pixCopiaCola,
    fontes: extracoes
      .filter(item => item.valor || item.vencimento || item.linha_digitavel || item.pix_copia_cola)
      .map(item => item.nome)
      .filter(Boolean),
    divergencias: {
      valor: new Set(valores.map(String)).size > 1,
      vencimento: new Set(vencimentos).size > 1,
      pix: new Set(pix).size > 1,
    },
  };

  return {
    dados,
    status: consolidarStatus(dados),
    erro: extracoes.every(item => item.status === 'falha')
      ? extracoes.map(item => item.erro).filter(Boolean).join(' | ').slice(0, 500) || 'Nenhum dado foi localizado.'
      : null,
  };
}


// -------------------------------------------------------------------
// Comprovantes de pagamento entre moradores
// Leitura deterministica/local: valor e data, sem IA generativa.
// -------------------------------------------------------------------

function extrairValorComprovante(texto) {
  const base = semAcentos(texto).toLowerCase();
  const rotulos = [
    'valor da transferencia',
    'valor da transacao',
    'valor transferido',
    'valor enviado',
    'valor pago',
    'valor',
  ];

  for (const rotulo of rotulos) {
    for (const indice of ocorrencias(base, rotulo)) {
      const valor = encontrarMoeda(texto.slice(indice, indice + 220));
      if (valor) return valor;
    }
  }

  const moedas = texto.match(/R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})|R\$\s*\d+(?:,\d{2})/gi) || [];
  for (const moeda of moedas) {
    const valor = parseValorBr(moeda);
    if (valor) return valor;
  }

  return null;
}

function extrairDataComprovante(texto) {
  const base = semAcentos(texto).toLowerCase();
  const rotulos = [
    'data e hora',
    'data da transacao',
    'data da transferencia',
    'realizado em',
    'feito em',
    'pagamento realizado',
    'data',
  ];

  for (const rotulo of rotulos) {
    for (const indice of ocorrencias(base, rotulo)) {
      const trecho = texto.slice(indice, indice + 220);
      const dataMatch = trecho.match(/(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/);
      const data = parseDataBr(dataMatch?.[1]);
      if (!data) continue;

      const horaMatch = trecho.match(/(?:\s|às|as)(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
      const hora = horaMatch
        ? `${String(horaMatch[1]).padStart(2, '0')}:${horaMatch[2]}:${horaMatch[3] || '00'}`
        : '12:00:00';

      return `${data}T${hora}-03:00`;
    }
  }

  return null;
}

export async function extrairComprovantePdf(buffer) {
  let parser;

  try {
    parser = new PDFParse({
      data: buffer,
      CanvasFactory,
    });

    const resultado = await parser.getText({ first: 6 });
    const texto = normalizarTexto(resultado?.text);
    const valor = extrairValorComprovante(texto);
    const pagoEm = extrairDataComprovante(texto);

    return {
      versao: EXTRACAO_VERSAO,
      status: valor || pagoEm ? 'parcial' : 'falha',
      valor,
      pago_em: pagoEm,
      caracteres_lidos: texto.length,
      codigo: valor || pagoEm ? null : 'dados_nao_encontrados',
      erro: valor || pagoEm ? null : 'Nao foi possivel identificar valor ou data no comprovante.',
    };
  } catch (erro) {
    return {
      versao: EXTRACAO_VERSAO,
      status: 'falha',
      valor: null,
      pago_em: null,
      codigo: 'erro_leitura_comprovante',
      erro: String(erro?.message || erro || 'Falha desconhecida.').slice(0, 300),
    };
  } finally {
    try {
      await parser?.destroy();
    } catch {
      // O descarte do leitor nao deve interromper o fluxo.
    }
  }
}
