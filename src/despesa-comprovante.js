import { CanvasFactory } from 'pdf-parse/worker';
import { PDFParse } from 'pdf-parse';

const MAX_TEXT = 100000;

function semAcentos(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizarTexto(value = '') {
  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, MAX_TEXT);
}

function parseMoney(value) {
  let text = String(value || '').replace(/[^\d,.\-]/g, '');
  if (!text) return null;
  if (text.includes(',') && text.includes('.')) text = text.replace(/\./g, '').replace(',', '.');
  else if (text.includes(',')) text = text.replace(',', '.');
  else if ((text.match(/\./g) || []).length > 1) {
    const parts = text.split('.');
    const decimals = parts.pop();
    text = parts.join('') + '.' + decimals;
  }
  const number = Number(text);
  return Number.isFinite(number) && number > 0 && number < 1000000
    ? Math.round(number * 100) / 100
    : null;
}

function parseDate(value) {
  const match = String(value || '').match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 2020 || year > 2040 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function findMoney(text, labels) {
  const base = semAcentos(text).toLowerCase();
  const moneyRe = /R\s*\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})|R\s*\$\s*\d+(?:[.,]\d{2})|\b\d{1,3}(?:\.\d{3})*,\d{2}\b|\b\d+,\d{2}\b/ig;
  for (const label of labels) {
    let start = 0;
    while (start < base.length) {
      const index = base.indexOf(label, start);
      if (index < 0) break;
      const slice = text.slice(index, index + 180);
      for (const candidate of (slice.match(moneyRe) || [])) {
        const value = parseMoney(candidate);
        if (value) return value;
      }
      start = index + label.length;
    }
  }
  return null;
}

function extractValue(text) {
  return findMoney(text, [
    'valor total a pagar',
    'total a pagar',
    'valor da compra',
    'valor pago',
    'total geral',
    'valor total',
    'total',
  ]);
}

function extractDate(text) {
  const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const labels = ['data da compra', 'data da transacao', 'emissao', 'emitido em', 'realizado em', 'pago em', 'data'];
  for (const label of labels) {
    const line = lines.find(candidate => semAcentos(candidate).toLowerCase().includes(label));
    const date = parseDate(line);
    if (date) return date;
  }
  for (const line of lines.slice(0, 40)) {
    const date = parseDate(line);
    if (date) return date;
  }
  return null;
}

function extractTitle(text) {
  const noise = [
    'cnpj', 'cpf', 'cupom', 'nota fiscal', 'documento auxiliar', 'extrato', 'comprovante',
    'endereco', 'endereço', 'telefone', 'data', 'hora', 'valor', 'total', 'subtotal', 'cliente',
    'consumidor', 'sat', 'nfce', 'nfc-e', 'chave de acesso', 'autorizacao', 'autorização',
  ];
  const lines = text.split(/\n+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length >= 3 && line.length <= 90);

  for (const line of lines.slice(0, 25)) {
    const base = semAcentos(line).toLowerCase();
    if (noise.some(term => base.includes(semAcentos(term).toLowerCase()))) continue;
    if (/^\d[\d .\-/]+$/.test(line)) continue;
    if ((line.match(/[A-Za-zÀ-ÿ]/g) || []).length < 3) continue;
    return line.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ0-9)]+$/g, '').slice(0, 80) || null;
  }
  return null;
}

function inferCategory(text, title = '') {
  const base = semAcentos(`${title}\n${text}`).toLowerCase();
  const rules = [
    ['alimentacao', ['supermercado', 'mercado', 'atacadao', 'assai', 'hortifruti', 'padaria', 'restaurante', 'lanchonete', 'ifood', 'comida']],
    ['transporte', ['uber', '99app', '99 ', 'posto ', 'combustivel', 'gasolina', 'etanol', 'pedagio', 'estacionamento']],
    ['saude', ['farmacia', 'drogaria', 'hospital', 'clinica', 'laboratorio', 'consulta']],
    ['viagem', ['hotel', 'pousada', 'latam', 'gol linhas', 'azul linhas', 'booking', 'airbnb', 'passagem']],
    ['moradia', ['condominio', 'aluguel', 'imobiliaria']],
    ['utilidades', ['enel', 'naturgy', 'energia eletrica', 'conta de gas', 'internet', 'telefonia']],
    ['casa', ['leroy', 'material de construcao', 'casa e video', 'utilidades domesticas']],
    ['lazer', ['cinema', 'teatro', 'ingresso', 'spotify', 'netflix', 'show ']],
  ];
  for (const [category, terms] of rules) {
    if (terms.some(term => base.includes(term))) return category;
  }
  return null;
}

export function extrairSugestoesDespesaTexto(textReceived) {
  const text = normalizarTexto(textReceived);
  const title = extractTitle(text);
  const value = extractValue(text);
  const date = extractDate(text);
  const category = inferCategory(text, title);
  const found = [title, value, date, category].filter(valueFound => valueFound !== null && valueFound !== '').length;
  return {
    status: found ? (found >= 2 ? 'sucesso' : 'parcial') : 'falha',
    titulo: title,
    valor: value,
    data_despesa: date,
    categoria: category,
    caracteres_lidos: text.length,
  };
}

export async function extrairSugestoesDespesaPdf(buffer) {
  let parser;
  try {
    parser = new PDFParse({ data: buffer, CanvasFactory });
    const result = await parser.getText({ first: 8 });
    return extrairSugestoesDespesaTexto(result?.text || '');
  } catch (error) {
    return {
      status: 'falha',
      titulo: null,
      valor: null,
      data_despesa: null,
      categoria: null,
      caracteres_lidos: 0,
      erro: String(error?.message || error || 'Falha desconhecida.').slice(0, 300),
    };
  } finally {
    try { await parser?.destroy(); } catch {}
  }
}
