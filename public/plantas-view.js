// LifeOS — owner visual da lista de Plantas.
// Recebe estado e callbacks; não consulta banco nem altera regras de cuidado.

import { urgenciaPlanta, COR_URGENCIA, COR_PERFIL } from './plantas.js';

const el = id => document.getElementById(id);

function filtrarPlantas(plantas, filtro) {
  if (filtro === 'vencida') return plantas.filter(planta => urgenciaPlanta(planta) === 'vencida');
  if (filtro === 'hoje') return plantas.filter(planta => urgenciaPlanta(planta) === 'hoje');
  if (filtro === 'breve') return plantas.filter(planta => ['vencida', 'hoje', 'breve'].includes(urgenciaPlanta(planta)));
  if (filtro === 'sala') return plantas.filter(planta => planta.comodo === 'Sala');
  if (filtro === 'outros') return plantas.filter(planta => planta.comodo !== 'Sala');
  return plantas;
}

function textoProximoCuidado(rotina) {
  if (!rotina) return '';
  const proxima = rotina.proxima_realizacao;
  const hoje = new Date().toISOString().slice(0, 10);
  const dias = proxima ? Math.round((new Date(proxima) - new Date(hoje)) / 86400000) : null;
  const quando = dias === null
    ? '—'
    : dias < 0
      ? `${Math.abs(dias)}d atrás`
      : dias === 0
        ? 'hoje'
        : `em ${dias}d`;
  return `${rotina.tipo} · ${quando}`;
}

function criarLinhaPlanta(planta, { onOpen, onCare }) {
  const urgencia = urgenciaPlanta(planta);
  const infoUrgencia = COR_URGENCIA[urgencia];
  const perfil = COR_PERFIL[planta.perfil_hidrico] || COR_PERFIL.medio;
  const rotinaPrincipal = (planta.planta_rotinas || []).find(rotina => rotina.ativa);
  const nomeEspecie = planta.especies?.nome_popular || '';

  const linha = document.createElement('div');
  linha.className = 'planta-card';
  linha.onclick = () => onOpen(planta);

  const esquerda = document.createElement('div');
  const codigo = document.createElement('div');
  codigo.className = 'planta-codigo';
  codigo.textContent = `${planta.codigo} · Etiq. ${planta.numero_etiqueta}`;

  const nome = document.createElement('div');
  nome.className = 'planta-nome';
  const dot = document.createElement('span');
  dot.className = 'dot-perfil';
  dot.style.background = perfil.cor;
  nome.appendChild(dot);
  nome.appendChild(document.createTextNode(nomeEspecie));

  if (planta.nome_personalizado) {
    const apelido = document.createElement('span');
    apelido.style.cssText = 'font-size:12px;color:var(--suave);margin-left:4px';
    apelido.textContent = `(${planta.nome_personalizado})`;
    nome.appendChild(apelido);
  }

  const meta = document.createElement('div');
  meta.className = 'planta-meta';
  meta.textContent = textoProximoCuidado(rotinaPrincipal);
  esquerda.append(codigo, nome, meta);

  const direita = document.createElement('div');
  direita.style.display = 'flex';
  direita.style.alignItems = 'center';
  direita.style.gap = '8px';

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.style.background = infoUrgencia.cor;
  badge.textContent = infoUrgencia.texto;
  direita.appendChild(badge);

  if (urgencia === 'vencida' || urgencia === 'hoje') {
    const cuidar = document.createElement('button');
    cuidar.type = 'button';
    cuidar.textContent = 'Cuidar';
    cuidar.style.cssText = 'padding:7px 12px;font-size:13px';
    cuidar.onclick = evento => {
      evento.stopPropagation();
      onCare(planta, cuidar);
    };
    direita.appendChild(cuidar);
  }

  linha.append(esquerda, direita);
  return linha;
}

export function renderizarListaPlantas({
  plantas = [],
  filtroAtual = 'todas',
  onOpen = () => {},
  onCare = () => {},
} = {}) {
  const area = el('listaPlantas');
  if (!area) return;
  area.innerHTML = '';

  if (!plantas.length) {
    area.innerHTML = '<div class="cartao"><div class="vazio">Nenhuma planta cadastrada.</div></div>';
    return;
  }

  const filtradas = filtrarPlantas(plantas, filtroAtual);
  if (!filtradas.length) {
    area.innerHTML = '<div class="cartao"><div class="vazio">Nenhuma planta neste filtro.</div></div>';
    return;
  }

  const porComodo = new Map();
  for (const planta of filtradas) {
    const comodo = planta.comodo || 'Sem local';
    if (!porComodo.has(comodo)) porComodo.set(comodo, []);
    porComodo.get(comodo).push(planta);
  }

  for (const [comodo, plantasDoComodo] of porComodo) {
    const cartao = document.createElement('div');
    cartao.className = 'cartao';
    const titulo = document.createElement('div');
    titulo.className = 'comodo-titulo';
    titulo.textContent = `${comodo} (${plantasDoComodo.length})`;
    cartao.appendChild(titulo);

    for (const planta of plantasDoComodo) {
      cartao.appendChild(criarLinhaPlanta(planta, { onOpen, onCare }));
    }
    area.appendChild(cartao);
  }
}
