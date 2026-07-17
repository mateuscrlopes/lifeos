// status-estoque.js
// Calcula o STATUS de um item de estoque a partir da quantidade atual e do
// minimo. Regra simples e honesta (Fatia 1 - unidade contavel).
//
// Os cinco status seguem o Documento Mestre (secao 18.3):
//   suficiente | atencao | baixo | conferir | acabou
//
// Nesta fatia trabalhamos so com numero de unidades, entao o calculo e
// direto. "conferir" (baixa confianca) e estimativa entrarao em fatias
// futuras, quando houver historico de consumo. Por enquanto, "conferir"
// nao e gerado automaticamente aqui.

export function calcularStatus(quantidade, minimo) {
  const q = Number(quantidade);
  const m = Number(minimo);

  if (!isFinite(q) || !isFinite(m)) return 'conferir';

  if (q <= 0) return 'acabou';
  if (q < m) return 'baixo';
  if (q === m) return 'atencao';            // no limite: vale repor logo
  if (q <= m * 1.5) return 'atencao';       // um pouco acima do minimo
  return 'suficiente';
}

// Rotulo amigavel e uma cor sugerida (a tela decide como usar).
export function rotuloStatus(status) {
  const mapa = {
    suficiente: { texto: 'Suficiente', cor: '#2f6f4f' },
    atencao:    { texto: 'Atenção',    cor: '#b8860b' },
    baixo:      { texto: 'Baixo',      cor: '#b23c3c' },
    conferir:   { texto: 'Conferir',   cor: '#6b7280' },
    acabou:     { texto: 'Acabou',     cor: '#b23c3c' },
  };
  return mapa[status] || mapa.conferir;
}
