// LifeOS — composição da superfície do Financeiro pessoal.
// Não possui dados nem renderização financeira; apenas prepara os mounts existentes.

function prepararSuperficieFinanceira() {
  const pagina = document.getElementById('abaFinanceiro');
  if (!pagina) return;

  const titulo = pagina.querySelector('.lifeos-page-head-copy h1');
  const subtitulo = pagina.querySelector('.lifeos-page-head-copy p');
  if (titulo) titulo.textContent = 'Finanças';
  if (subtitulo) subtitulo.textContent = 'Quanto está livre, o que está protegido e como seus planos estão andando.';

  let mount = document.getElementById('lifeosFinanceiroPessoal');
  if (!mount) {
    mount = document.createElement('section');
    mount.id = 'lifeosFinanceiroPessoal';
    mount.setAttribute('aria-live', 'polite');
    const referencia = document.getElementById('lifeosFinanceiroContas');
    if (referencia) pagina.insertBefore(mount, referencia);
    else pagina.appendChild(mount);
  }

  let legado = document.getElementById('lifeosFinanceiroCasaLegado');
  if (!legado) {
    const contas = document.getElementById('lifeosFinanceiroContas');
    const acertos = document.getElementById('lifeosFinanceiroAcertos');
    if (contas || acertos) {
      legado = document.createElement('details');
      legado.id = 'lifeosFinanceiroCasaLegado';
      const resumo = document.createElement('summary');
      resumo.textContent = 'Contas e acertos da Casa';
      legado.appendChild(resumo);
      if (contas) legado.appendChild(contas);
      if (acertos) legado.appendChild(acertos);
      pagina.appendChild(legado);
    }
  }
}

prepararSuperficieFinanceira();
await import('./financeiro-pessoal.js?v=1');

window.addEventListener('lifeos:financeiro-abrir', prepararSuperficieFinanceira);
