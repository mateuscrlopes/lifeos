// LifeOS — navegação interna de Finanças.
// Owner único dos painéis de primeiro nível. Não renderiza o conteúdo interno
// de Pessoal, Contas ou Acertos; cada módulo continua dono do próprio mount.

import { icon } from './ui/icons.js';

const SECOES = Object.freeze([
  { id: 'pessoal', label: 'Pessoal', icon: 'wallet', panel: 'lifeosFinanceiroPessoalPanel' },
  { id: 'contas', label: 'Contas', icon: 'bill', panel: 'lifeosFinanceiroContasPanel' },
  { id: 'acertos', label: 'Acertos', icon: 'swap', panel: 'lifeosFinanceiroAcertosPanel' },
]);

let ativa = 'pessoal';

function el(id) { return document.getElementById(id); }

function renderNav() {
  const nav = el('lifeosFinanceiroNav');
  if (!nav) return;

  nav.innerHTML = SECOES.map(secao => `
    <button type="button" class="lifeos-finance-nav-item${ativa === secao.id ? ' ativa' : ''}"
      data-finance-secao="${secao.id}" aria-pressed="${ativa === secao.id}">
      <span class="lifeos-finance-nav-icon">${icon(secao.icon, 18)}</span>
      <span>${secao.label}</span>
    </button>`).join('');

  nav.querySelectorAll('[data-finance-secao]').forEach(button => {
    button.addEventListener('click', () => irPara(button.dataset.financeSecao));
  });
}

function aplicarPaineis() {
  for (const secao of SECOES) {
    const panel = el(secao.panel);
    if (panel) panel.hidden = secao.id !== ativa;
  }
}

export function irPara(secao = 'pessoal', { scroll = true } = {}) {
  if (!SECOES.some(item => item.id === secao)) secao = 'pessoal';
  ativa = secao;
  aplicarPaineis();
  renderNav();

  if (secao === 'pessoal') window.dispatchEvent(new CustomEvent('lifeos:financeiro-pessoal-abrir'));
  if (secao === 'contas') window.dispatchEvent(new CustomEvent('lifeos:financeiro-contas-abrir'));
  if (secao === 'acertos') window.dispatchEvent(new CustomEvent('lifeos:financeiro-acertos-abrir'));

  if (scroll) {
    window.setTimeout(() => el('lifeosFinanceiroNav')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  }
}

function iniciar() {
  aplicarPaineis();
  renderNav();
}

window.addEventListener('lifeos:financeiro-shell-ir', event => irPara(event.detail?.secao || 'pessoal'));
window.addEventListener('lifeos:financeiro-abrir', () => {
  aplicarPaineis();
  renderNav();
});
window.lifeosFinanceiroIr = irPara;

iniciar();
