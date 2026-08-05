// status-estoque.js
// Calcula o STATUS de um item de estoque conforme seu TIPO de medicao.
// Tres tipos ativos (Documento Mestre, secao 18.4):
//   contavel     — numero de unidades (ex.: 3 rolos)
//   peso_volume  — peso ou volume numerico (ex.: 500g, 1.5L)
//   nivel_visual — nivel em escala (cheio/75/metade/25/quase_acabando/acabou)
// Nota: tipo "presenca" foi removido da interface (tudo e contavel).

// A camada abaixo concentra refinamentos visuais e comportamentais sem
// alterar a arquitetura ou a estrutura de navegacao do LifeOS.
import './ui-refinements.js?v=4';
import './central-financeira.js?v=3';
import './purchase-destination-create.js?v=2';

// Ordem dos niveis visuais (do mais cheio ao mais vazio).
export const NIVEIS_VISUAL = ['cheio', '75', 'metade', '25', 'quase_acabando', 'acabou'];

export const ROTULO_NIVEL = {
  cheio:          'Cheio',
  '75':           '~75%',
  metade:         'Metade',
  '25':           '~25%',
  quase_acabando: 'Quase acabando',
  acabou:         'Acabou',
};

// Indice do nivel (quanto menor o indice, mais cheio).
function indiceNivel(nivel) {
  const i = NIVEIS_VISUAL.indexOf(nivel);
  return i === -1 ? 0 : i;
}

// --- CONTAVEL e PESO_VOLUME (mesma logica, base numerica) ---
function statusNumerico(quantidade, minimo) {
  const q = Number(quantidade);
  const m = Number(minimo);
  if (!isFinite(q) || !isFinite(m)) return 'conferir';
  if (q <= 0) return 'acabou';
  if (q < m) return 'baixo';
  if (q <= m * 1.5) return 'atencao';
  return 'suficiente';
}

// --- NIVEL VISUAL ---
// minimo e um nivel (ex.: '25'): abaixo dele fica baixo/acabou.
function statusNivelVisual(nivel, minimoNivel) {
  if (!nivel) return 'conferir';
  if (nivel === 'acabou') return 'acabou';
  const iAtual = indiceNivel(nivel);
  const iMin = indiceNivel(minimoNivel || '25');
  // Quanto maior o indice, mais vazio. Se atual >= minimo, esta baixo.
  if (iAtual > iMin) return 'baixo';
  if (iAtual === iMin) return 'atencao';
  // Um nivel acima do minimo = atencao; dois ou mais = suficiente.
  if (iAtual === iMin - 1) return 'atencao';
  return 'suficiente';
}

// --- PRESENCA ---
function statusPresenca(quantidade) {
  return Number(quantidade) > 0 ? 'suficiente' : 'acabou';
}

// Funcao principal: recebe o item completo e devolve o status.
export function calcularStatus(quantidade, minimo, tipo, nivel, minimoNivel) {
  switch (tipo) {
    case 'nivel_visual': return statusNivelVisual(nivel, minimoNivel);
    case 'presenca':     return statusPresenca(quantidade);
    case 'peso_volume':
    case 'contavel':
    default:             return statusNumerico(quantidade, minimo);
  }
}

// Rotulo amigavel e cor para exibir na tela.
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

// Descricao do valor atual para exibir na linha do item.
export function descricaoQuantidade(item) {
  switch (item.tipo) {
    case 'nivel_visual':
      return ROTULO_NIVEL[item.nivel] || item.nivel || '—';
    case 'presenca':
      return Number(item.quantidade) > 0 ? 'Tem' : 'Não tem';
    case 'peso_volume':
      return item.quantidade != null
        ? `${item.quantidade} ${item.unidade || ''}`.trim()
        : '—';
    default: // contavel
      return item.quantidade != null ? String(item.quantidade) : '—';
  }
}





