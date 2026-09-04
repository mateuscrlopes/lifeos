// status-estoque.js
// Regra de domínio pura: calcula o status de um item de estoque.
// Este arquivo NÃO inicializa UI, estilos, integrações ou outros módulos.

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
  if (!Number.isFinite(q) || !Number.isFinite(m)) return 'conferir';
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
  return Number(quantidade) > 0 ? 'suficiente' : 'acabou';
}

export function calcularStatus(quantidade, minimo, tipo, nivel, minimoNivel) {
  switch (tipo) {
    case 'nivel_visual': return statusNivelVisual(nivel, minimoNivel);
    case 'presenca': return statusPresenca(quantidade);
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
