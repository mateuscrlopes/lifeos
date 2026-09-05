// LifeOS — navegação interna da Casa.
// Proprietário único do estado visual das subtabs e do cabeçalho contextual de #abaCasa.

const TITULOS = Object.freeze({
  compras: ['Compras', 'Lista e compras da Casa.'],
  estoque: ['Estoque', 'O que tem em casa, níveis e reposição.'],
  tarefas: ['Tarefas', 'Tarefas e responsabilidades da Casa.'],
  contas: ['Contas', 'Contas recorrentes e próximos vencimentos.'],
  cardapio: ['Cardápio', 'Receitas e planejamento das refeições.'],
});

const el = id => document.getElementById(id);

export function trocarSubCasa(qual) {
  const destino = String(qual || 'compras');

  document.querySelectorAll('.sub-conteudo').forEach(secao => {
    secao.style.display = 'none';
    secao.classList.add('oculto');
  });

  const alvo = el(`sub${destino.charAt(0).toUpperCase()}${destino.slice(1)}`);
  if (alvo) {
    alvo.style.display = 'block';
    alvo.classList.remove('oculto');
  }

  document.querySelectorAll('.sub-aba').forEach(botao => {
    botao.classList.toggle('ativa', botao.dataset.sub === destino);
  });

  const [titulo, descricao] = TITULOS[destino] || ['Casa', 'Organização da Casa'];
  const tituloNode = el('casaPageTitle');
  const descricaoNode = el('casaPageDescription');
  if (tituloNode) tituloNode.textContent = titulo;
  if (descricaoNode) descricaoNode.textContent = descricao;
}

export function subCasaAtiva() {
  return [...document.querySelectorAll('.sub-aba[data-sub]')]
    .find(botao => botao.classList.contains('ativa'))?.dataset.sub || 'compras';
}
