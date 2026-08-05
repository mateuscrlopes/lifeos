// financeiro-extracao.js
// Leitura local de PDFs financeiros. Nenhum documento e enviado para uma IA externa.

import { CanvasFactory } from 'pdf-parse/worker';
import { PDFParse } from 'pdf-parse';

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

function extrairLinhaDigitavel(texto) {
  const base = semAcentos(texto).toLowerCase();
  const rotulos = [
    'linha digitavel',
    'codigo de barras',
    'codigo para pagamento',
  ];

  const validar = trecho => {
    const candidatos = trecho.match(/(?:\d[\s.\-]?){44,58}/g) || [];

    for (const candidato of candidatos) {
      const digitos = candidato.replace(/\D/g, '');
      if ([44, 46, 47, 48].includes(digitos.length)) return digitos;
    }

    return null;
  };

  for (const rotulo of rotulos) {
    for (const indice of ocorrencias(base, rotulo)) {
      const linha = validar(texto.slice(indice, indice + 300));
      if (linha) return linha;
    }
  }

  return validar(texto);
}

function consolidarStatus(dados) {
  const principais = Number(Boolean(dados.valor)) + Number(Boolean(dados.vencimento));

  if (principais === 2) return 'sucesso';
  if (principais === 1 || dados.linha_digitavel) return 'parcial';
  return 'falha';
}

export async function extrairDadosPdf(buffer, contexto = {}) {
  let parser;

  try {
    parser = new PDFParse({
      data: buffer,
      CanvasFactory,
    });

    const resultado = await parser.getText({ first: 8 });
    const texto = normalizarTexto(resultado?.text);

    if (!texto || texto.replace(/\s/g, '').length < 20) {
      return {
        status: 'falha',
        erro: 'O PDF nao possui texto selecionavel suficiente.',
        fornecedor: contexto.fornecedor || null,
      };
    }

    const dados = {
      valor: extrairValor(texto),
      vencimento: extrairVencimento(texto),
      linha_digitavel: extrairLinhaDigitavel(texto),
      fornecedor: contexto.fornecedor || null,
      caracteres_lidos: texto.length,
    };

    return {
      ...dados,
      status: consolidarStatus(dados),
      erro: null,
    };
  } catch (erro) {
    return {
      status: 'falha',
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

  const valor = valores[0] ?? null;
  const vencimento = vencimentos[0] ?? null;
  const linhaDigitavel = linhas[0] ?? null;

  const dados = {
    valor,
    vencimento,
    linha_digitavel: linhaDigitavel,
    fontes: extracoes
      .filter(item => item.valor || item.vencimento || item.linha_digitavel)
      .map(item => item.nome)
      .filter(Boolean),
    divergencias: {
      valor: new Set(valores.map(String)).size > 1,
      vencimento: new Set(vencimentos).size > 1,
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
