// status-conta.js
// Calcula o STATUS de uma conta a partir do vencimento e de estar paga.
// Status: paga | vencida | vence_hoje | vence_breve | em_dia
//
// "Vence em breve" = vence dentro dos proximos 3 dias (ajustavel).

const DIAS_BREVE = 3;

// Converte 'YYYY-MM-DD' para uma data local no inicio do dia (sem hora),
// para comparar datas sem confusao de fuso.
function soData(valor) {
  if (valor instanceof Date) {
    return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }
  const [a, m, d] = String(valor).slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d);
}

// Diferenca em dias inteiros entre vencimento e hoje (positivo = futuro).
export function diasAteVencer(vencimento, hoje = new Date()) {
  const v = soData(vencimento);
  const h = soData(hoje);
  const umDia = 24 * 60 * 60 * 1000;
  return Math.round((v - h) / umDia);
}

export function calcularStatusConta(conta, hoje = new Date()) {
  if (conta.paga) return 'paga';

  const dias = diasAteVencer(conta.vencimento, hoje);

  if (dias < 0) return 'vencida';
  if (dias === 0) return 'vence_hoje';
  if (dias <= DIAS_BREVE) return 'vence_breve';
  return 'em_dia';
}

export function rotuloStatusConta(status) {
  const mapa = {
    em_dia:      { texto: 'Em dia',         cor: '#2f6f4f' },
    vence_breve: { texto: 'Vence em breve', cor: '#b8860b' },
    vence_hoje:  { texto: 'Vence hoje',     cor: '#b23c3c' },
    vencida:     { texto: 'Vencida',        cor: '#b23c3c' },
    paga:        { texto: 'Paga',           cor: '#6b7280' },
  };
  return mapa[status] || mapa.em_dia;
}

// Formata um valor numerico como moeda brasileira. Nulo vira traco.
export function formatarValor(valor) {
  if (valor === null || valor === undefined || valor === '') return '\u2014';
  const n = Number(valor);
  if (!isFinite(n)) return '\u2014';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
