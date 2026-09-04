// status-estoque.js
// Calcula o STATUS de um item de estoque conforme seu TIPO de medicao.
// Tres tipos ativos (Documento Mestre, secao 18.4):
//   contavel     — numero de unidades (ex.: 3 rolos)
//   peso_volume  — peso ou volume numerico (ex.: 500g, 1.5L)
//   nivel_visual — nivel em escala (cheio/75/metade/25/quase_acabando/acabou)
// Nota: tipo "presenca" foi removido da interface (tudo e contavel).

// Design System deve carregar antes das camadas de refinamento.
import './design-system.js?v=1';
import './theme.js?v=1';
import './ui-refinements.js?v=8';
import './central-financeira.js?v=7';
import './central-financeira-email.js?v=5';
import './acertos.js?v=5';
import './purchase-destination-create.js?v=2';
import './mobile-shell-v3.js?v=4';
import './product-polish-v4.js?v=4';
import './phase3-polish.js?v=1';
import './phase4-polish.js?v=1';
import './audit-qa-polish.js?v=3';
import './ritmo-food-v2-loader.js?v=1';
import './mobile-qa-v5.js?v=1';
import './mobile-qa-v5-1.js?v=2';
import './ritmo-medidas-save.js?v=2';

export const NIVEIS_VISUAL = ['cheio', '75', 'metade', '25', 'quase_acabando', 'acabou'];

export const ROTULO_NIVEL = {
  cheio: 'Cheio',
  '75': '~75%',
  metade: 'Metade',
  '25': '~25%',
  quase_acabando: 'Quase acabando',
  acabou: 'Acabou',
};

function indiceNivel(nivel) {
  const i = NIVEIS_VISUAL.indexOf(nivel);
  return i === -1 ? 0 : i;
}

function statusNumerico(quantidade, minimo) {
  const q = Number(quantidade);
  const m = Number(minimo);
  if (!isFinite(q) || !isFinite(m)) return 'conferir';
  if (q <= 0) return 'acabou';
  if (q < m) return 'baixo';
  if (q <= m * 1.5) return 'atencao';
  return 'suficiente';
}

function statusNivelVisual(nivel, minimoNivel) {
  if (!nivel) return 'conferir';
  if (nivel === 'acabou') return 'acabou';
  const iAtual = indiceNivel(nivel);
  const iMin = indiceNivel(minimoNivel || '25');
  if (iAtual > iMin) return 'baixo';
  if (iAtual === iMin) return 'atencao';
  if (iAtual === iMin - 1) return 'atencao';
  return 'suficiente';
}

function statusPresenca(quantidade) {
  return Number(quantidade) > 0 ? 'Tem' : 'Não tem';
}

export function calcularStatus(quantidade, minimo, tipo, nivel, minimoNivel) {
  switch (tipo) {
    case 'nivel_visual': return statusNivelVisual(nivel, minimoNivel);
    case 'presenca': return statusPresenca(quantidade) === 'Tem' ? 'suficiente' : 'acabou';
    case 'peso_volume':
    case 'contavel':
    default: return statusNumerico(quantidade, minimo);
  }
}

export function rotuloStatus(status) {
  const mapa = {
    suficiente: { texto: 'Suficiente', cor: '#2f6f4f' },
    atencao: { texto: 'Atenção', cor: '#b8860b' },
    baixo: { texto: 'Baixo', cor: '#b23c3c' },
    conferir: { texto: 'Conferir', cor: '#6b7280' },
    acabou: { texto: 'Acabou', cor: '#b23c3c' },
  };
  return mapa[status] || mapa.conferir;
}

export function descricaoQuantidade(item) {
  switch (item.tipo) {
    case 'nivel_visual': return ROTULO_NIVEL[item.nivel] || item.nivel || '—';
    case 'presenca': return Number(item.quantidade) > 0 ? 'Tem' : 'Não tem';
    case 'peso_volume': return item.quantidade != null ? `${item.quantidade} ${item.unidade || ''}`.trim() : '—';
    default: return item.quantidade != null ? String(item.quantidade) : '—';
  }
}
