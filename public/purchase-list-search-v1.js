// LifeOS — busca da lista de compras.
// Filtra a lista comum (Casa > Compras), não apenas o modo Mercado.

(() => {
  'use strict';

  let listObserver = null;
  let discoveryObserver = null;

  function normalize(value = '') {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function bindList(list) {
    if (!list || list.dataset.plsObserved === '1') return;
    list.dataset.plsObserved = '1';
    listObserver?.disconnect();
    listObserver = new MutationObserver(() => {
      const value = document.querySelector('#purchaseListSearch input')?.value || '';
      window.requestAnimationFrame(() => { ensure(); filter(value); });
    });
    listObserver.observe(list, { childList: true });
    discoveryObserver?.disconnect();
    discoveryObserver = null;
  }

  function ensure() {
    const list = document.getElementById('itens');
    if (!list) return false;
    bindList(list);
    if (document.getElementById('purchaseListSearch')) return true;
    const holder = document.createElement('div');
    holder.id = 'purchaseListSearch';
    holder.className = 'pls-search';
    holder.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input type="search" autocomplete="off" placeholder="Buscar na lista de compras…" aria-label="Buscar na lista de compras"><button type="button" aria-label="Limpar busca" hidden>×</button>`;
    list.parentElement?.insertBefore(holder, list);
    const input = holder.querySelector('input');
    const clear = holder.querySelector('button');
    input.addEventListener('input', () => { clear.hidden = !input.value; filter(input.value); });
    clear.addEventListener('click', () => { input.value = ''; clear.hidden = true; filter(''); input.focus(); });
    filter(input.value);
    return true;
  }

  function filter(value = '') {
    const list = document.getElementById('itens'); if (!list) return;
    const query = normalize(value);
    const children = [...list.children];
    let currentHeading = null;
    let currentRows = [];
    const flush = () => {
      if (!currentHeading) return;
      const any = currentRows.some(row => !row.hidden);
      currentHeading.hidden = query ? !any : false;
    };
    for (const node of children) {
      if (node.classList.contains('item') || node.classList.contains('lista-item')) {
        const name = node.querySelector('.nome')?.textContent || node.textContent || '';
        node.hidden = Boolean(query && !normalize(name).includes(query));
        currentRows.push(node);
      } else if (!node.classList.contains('vazio')) {
        flush(); currentHeading = node; currentRows = [];
      }
    }
    flush();
    let empty = list.querySelector('.pls-empty');
    const visibleRows = children.filter(node => (node.classList.contains('item') || node.classList.contains('lista-item')) && !node.hidden).length;
    if (query && !visibleRows) {
      if (!empty) { empty = document.createElement('div'); empty.className = 'vazio pls-empty'; list.appendChild(empty); }
      empty.textContent = 'Nenhum item encontrado nessa busca.'; empty.hidden = false;
    } else if (empty) empty.hidden = true;
  }

  function installStyles() {
    if (document.getElementById('purchaseListSearchStyles')) return;
    const style = document.createElement('style');
    style.id = 'purchaseListSearchStyles';
    style.textContent = `.pls-search{position:relative;margin:0 0 12px}.pls-search svg{position:absolute;left:13px;top:13px;width:18px;height:18px;fill:none;stroke:var(--muted);stroke-width:2;pointer-events:none}.pls-search input{width:100%;min-height:44px;padding:10px 40px 10px 42px;border:1.5px solid var(--linha);border-radius:13px;background:var(--bg);color:var(--texto);font-size:14px}.pls-search input:focus{outline:none;border-color:var(--sage);background:var(--paper)}.pls-search button{position:absolute;right:7px;top:7px;width:30px;height:30px;border:0;border-radius:9px;background:transparent;color:var(--muted);font-size:20px}.pls-search button[hidden]{display:none}`;
    document.head.appendChild(style);
  }

  installStyles();
  if (!ensure()) {
    discoveryObserver = new MutationObserver(() => {
      if (ensure()) discoveryObserver?.disconnect();
    });
    discoveryObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
  window.addEventListener('lifeos:ready', () => window.setTimeout(ensure, 0));
})();
