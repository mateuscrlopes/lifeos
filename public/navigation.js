// LifeOS — owner oficial da navegação mobile.
// Controla abas, seções do Mais, origem contextual e scroll; recebe apenas hooks de carregamento.

import { trocarSubCasa, subCasaAtiva } from './casa-view.js?v=1';

const ABAS_PRINCIPAIS = Object.freeze(['abaHoje', 'abaCasa', 'abaFinanceiro', 'abaPlantas', 'abaMais']);
const SECOES_MAIS = Object.freeze(['secaoRitmo', 'secaoProjetos', 'secaoRituais', 'secaoConfig', 'abaPainelProjeto']);
const el = id => document.getElementById(id);

function ocultarSuperficies() {
  for (const id of [...ABAS_PRINCIPAIS, ...SECOES_MAIS]) {
    const node = el(id);
    if (!node) continue;
    node.style.display = 'none';
    node.classList.add('oculto');
  }
}

function mostrar(id) {
  const node = el(id);
  if (!node) return false;
  node.style.display = 'block';
  node.classList.remove('oculto');
  return true;
}

function reiniciarScroll() {
  const body = el('appBody');
  if (body) body.scrollTop = 0;
}

export function criarNavegacao({
  onHoje = () => {},
  onFinanceiro = () => {},
  onPlantas = () => {},
  onRitmo = () => {},
  onProjetos = () => {},
  onRituais = () => {},
  onConfig = () => {},
} = {}) {
  const origensAba = new Map();
  const origensSecao = new Map();

  function localizacaoAtual() {
    for (const id of SECOES_MAIS) {
      const node = el(id);
      if (node && node.style.display !== 'none' && !node.classList.contains('oculto')) {
        if (id === 'abaPainelProjeto') return { tipo: 'painel-projeto' };
        return { tipo: 'secao', secao: id.replace(/^secao/, '').toLowerCase() };
      }
    }

    for (const id of ABAS_PRINCIPAIS) {
      const node = el(id);
      if (node && node.style.display !== 'none' && !node.classList.contains('oculto')) {
        const tab = id.replace(/^aba/, '').toLowerCase();
        if (tab === 'casa') return { tipo: 'casa', sub: subCasaAtiva() };
        return { tipo: 'tab', tab };
      }
    }
    return { tipo: 'tab', tab: 'hoje' };
  }

  function trocarAba(qual, _btn, opcoes = {}) {
    const { registrarOrigem = true } = opcoes;
    if (registrarOrigem) {
      const atual = localizacaoAtual();
      const destinoAtual = atual?.tipo === 'tab' && atual.tab === qual;
      const destinoCasa = qual === 'casa' && atual?.tipo === 'casa';
      if (atual && !destinoAtual && !destinoCasa) origensAba.set(qual, atual);
    }

    ocultarSuperficies();
    mostrar(`aba${qual.charAt(0).toUpperCase()}${qual.slice(1)}`);

    const origemCasa = qual === 'casa' ? origensAba.get('casa') : null;
    const tabAtiva = qual === 'casa'
      ? (origemCasa?.tipo === 'tab'
        ? origemCasa.tab
        : origemCasa?.tipo === 'secao' && origemCasa.secao === 'ritmo'
          ? 'ritmo'
          : origemCasa?.tipo === 'secao'
            ? 'mais'
            : 'hoje')
      : qual;

    document.querySelectorAll('.tab-btn').forEach(botao => {
      botao.classList.toggle('ativa', botao.dataset.tab === tabAtiva);
    });
    reiniciarScroll();

    if (qual === 'hoje') onHoje();
    if (qual === 'financeiro') onFinanceiro();
    if (qual === 'plantas') onPlantas();
  }

  function abrirSecao(qual, { preservarOrigem = false } = {}) {
    if (!preservarOrigem) {
      const atual = localizacaoAtual();
      const mesmaSecao = atual.tipo === 'secao' && atual.secao === qual;
      if (!mesmaSecao) origensSecao.set(qual, atual);
    }

    ocultarSuperficies();
    document.querySelectorAll('.tab-btn').forEach(botao => botao.classList.remove('ativa'));
    mostrar(`secao${qual.charAt(0).toUpperCase()}${qual.slice(1)}`);
    reiniciarScroll();

    if (qual === 'ritmo') onRitmo();
    if (qual === 'projetos') onProjetos();
    if (qual === 'rituais') onRituais();
    if (qual === 'config') onConfig();
  }

  function abrirRitmoContextual() {
    abrirSecao('ritmo');
    document.querySelectorAll('.tab-btn').forEach(botao => {
      botao.classList.toggle('ativa', botao.dataset.tab === 'ritmo');
    });
  }

  function voltarParaLocalizacao(origem) {
    if (origem?.tipo === 'casa') {
      trocarAba('casa', null, { registrarOrigem: false });
      requestAnimationFrame(() => trocarSubCasa(
        origem.sub,
        document.querySelector(`.sub-aba[data-sub="${origem.sub}"]`),
      ));
      return;
    }
    if (origem?.tipo === 'tab') {
      trocarAba(origem.tab, null, { registrarOrigem: false });
      return;
    }
    if (origem?.tipo === 'secao') {
      abrirSecao(origem.secao, { preservarOrigem: true });
      return;
    }
    trocarAba('hoje', null, { registrarOrigem: false });
  }

  function voltarAbaContextual(qual) {
    voltarParaLocalizacao(origensAba.get(qual));
  }

  function voltarCasaContextual() {
    voltarAbaContextual('casa');
  }

  function voltarContexto() {
    const atual = localizacaoAtual();
    const qual = atual.tipo === 'secao' ? atual.secao : null;
    const origem = qual ? origensSecao.get(qual) : null;
    voltarParaLocalizacao(origem || (qual === 'ritmo'
      ? { tipo: 'tab', tab: 'hoje' }
      : { tipo: 'tab', tab: 'mais' }));
  }

  function voltarMais() {
    for (const id of SECOES_MAIS) {
      const node = el(id);
      if (!node) continue;
      node.style.display = 'none';
      node.classList.add('oculto');
    }
    mostrar('abaMais');
    document.querySelectorAll('.tab-btn').forEach(botao => {
      botao.classList.toggle('ativa', botao.dataset.tab === 'mais');
    });
    reiniciarScroll();
  }

  return {
    trocarAba,
    abrirSecao,
    abrirRitmoContextual,
    voltarContexto,
    voltarMais,
    voltarAbaContextual,
    voltarCasaContextual,
    localizacaoAtual,
  };
}
