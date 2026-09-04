// LifeOS — QA Mobile v5.1
// Correções observadas após a primeira validação do QA Mobile v5.
(() => {
  'use strict';

  let scheduled = false;

  function ensureStyle() {
    const href = '/mobile-qa-v5-1.css?v=2';
    const existing = document.getElementById('lifeos-mobile-qa-v5-1');
    if (existing) {
      if (!existing.getAttribute('href')?.endsWith('v=2')) existing.setAttribute('href', href);
      return;
    }
    const link = document.createElement('link');
    link.id = 'lifeos-mobile-qa-v5-1';
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function closeIcon() {
    return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  }

  function openDialog({ title, subtitle = '', body = '', className = '' }) {
    document.querySelector('.qa5-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'qa5-overlay';
    overlay.innerHTML = `
      <section class="qa5-dialog ${className}" role="dialog" aria-modal="true" aria-labelledby="qa51DialogTitle">
        <div class="qa5-dialog-head">
          <div><h3 id="qa51DialogTitle">${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
          <button type="button" class="qa5-dialog-close" data-qa51-close aria-label="Fechar">${closeIcon()}</button>
        </div>
        <div class="qa5-dialog-body">${body}</div>
      </section>`;

    const close = () => {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
    };
    const onKey = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-qa51-close]')) close();
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    return { overlay, close };
  }

  // ------------------------------------------------------------------
  // Central Financeira: a classe de vencido passa a controlar texto e ação.
  // ------------------------------------------------------------------
  function enhanceCentralFinance(root = document) {
    root.querySelectorAll?.('.cf-conta-item').forEach(row => {
      const meta = row.querySelector('.cf-conta-meta');
      const overdue = /\bvencid[oa]s?\b/i.test(meta?.textContent || '');
      row.classList.toggle('qa51-overdue', overdue);
      const pay = row.querySelector('.cf-conta-lateral button');
      if (pay) {
        pay.classList.toggle('qa51-overdue-action', overdue);
        if (overdue) pay.setAttribute('aria-label', `Pagar conta vencida · ${(row.querySelector('.cf-conta-nome')?.textContent || '').trim()}`);
      }
    });
  }

  // ------------------------------------------------------------------
  // Locais de compra: + Novo usa modal de forma explícita.
  // O input legado continua existindo apenas como ponte para a função de
  // negócio já consolidada, mas nunca é apresentado ao usuário.
  // ------------------------------------------------------------------
  function openNewPurchaseLocationModal() {
    const oldInline = document.getElementById('inputNovoLocalCompra');
    if (oldInline) {
      oldInline.style.display = 'none';
      oldInline.classList.add('oculto');
    }

    const dialog = openDialog({
      title: 'Novo local de compra',
      subtitle: 'Cadastre o estabelecimento e depois complete endereço e categorias.',
      body: `
        <div class="qa51-location-form">
          <label for="qa51PurchaseLocationName">Nome do local
            <input id="qa51PurchaseLocationName" type="text" placeholder="Ex.: Padaria" autocomplete="off">
          </label>
          <div class="qa-confirm-actions">
            <button type="button" class="qa-confirm-primary" id="qa51SavePurchaseLocation">Criar local</button>
            <button type="button" class="qa-confirm-cancel" data-qa51-close>Cancelar</button>
          </div>
        </div>`
    });

    const input = dialog.overlay.querySelector('#qa51PurchaseLocationName');
    const save = dialog.overlay.querySelector('#qa51SavePurchaseLocation');
    window.setTimeout(() => input?.focus(), 20);

    const submit = () => {
      const name = input?.value.trim();
      if (!name) return input?.focus();
      const hidden = document.getElementById('nomeNovoLocalCompra');
      if (!hidden) return;
      hidden.value = name;
      hidden.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', bubbles: true, cancelable: true,
      }));
      dialog.close();
    };

    save?.addEventListener('click', submit);
    input?.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      submit();
    });
  }

  function bindPurchaseLocationButton(root = document) {
    const button = root.querySelector?.('#btnNovoLocalCompra');
    if (!button) return;

    const oldInline = document.getElementById('inputNovoLocalCompra');
    if (oldInline) {
      oldInline.style.display = 'none';
      oldInline.classList.add('oculto');
    }

    button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      openNewPurchaseLocationModal();
    };
    button.dataset.qa51ModalBound = '1';
  }

  function handleNewPurchaseLocation(event) {
    const button = event.target.closest('#btnNovoLocalCompra');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openNewPurchaseLocationModal();
  }

  // ------------------------------------------------------------------
  // Medidas: substitui a figura esquemática por uma silhueta corporal clara.
  // ------------------------------------------------------------------
  const MEASURES = {
    ritmoMedPeito: {
      title: 'Peito', y: 72,
      text: 'Passe a fita horizontalmente pela parte de maior circunferência do tórax. Mantenha postura natural e respiração normal.'
    },
    ritmoMedBraco: {
      title: 'Braço', y: 88,
      text: 'Meça no ponto médio entre ombro e cotovelo, com o braço relaxado ao lado do corpo. Use sempre o mesmo braço e o mesmo ponto.'
    },
    ritmoMedCintura: {
      title: 'Cintura', y: 103,
      text: 'Passe a fita na região mais estreita entre a última costela e o topo do quadril, sem prender a respiração nem apertar a pele.'
    },
    ritmoMedAbdomen: {
      title: 'Abdômen', y: 116,
      text: 'Use a altura do umbigo como referência. Mantenha a fita paralela ao chão, com o abdômen relaxado.'
    },
    ritmoMedQuadrilAlto: {
      title: 'Quadril alto', y: 126,
      text: 'Meça ao redor da parte superior da pelve, sobre a crista ilíaca, acima da região mais larga do quadril.'
    },
    ritmoMedQuadril: {
      title: 'Quadril', y: 139,
      text: 'Passe a fita pela parte mais larga do quadril e dos glúteos, mantendo-a horizontal e sem comprimir a pele.'
    },
    ritmoMedCoxa: {
      title: 'Coxa', y: 170,
      text: 'Escolha um ponto fixo na parte superior da coxa e repita sempre no mesmo ponto. A fita deve ficar perpendicular à perna.'
    },
    ritmoMedPanturrilha: {
      title: 'Panturrilha', y: 204,
      text: 'Passe a fita pela parte mais larga da panturrilha, com a musculatura relaxada e sem apertar.'
    },
  };

  function humanBodySvg(lineY) {
    return `
      <svg class="qa51-measure-body" viewBox="0 0 120 240" fill="none" aria-hidden="true">
        <circle class="body-fill" cx="60" cy="24" r="15"/>
        <path class="body-fill" d="M53 40h14l2 11c9 2 16 5 21 11 5 7 8 17 10 30l5 35c1 7-2 11-7 11-4 0-6-3-7-8l-7-36-5 23c-2 9-1 18 3 28l5 14-8 66c-1 8-7 11-12 7-2-2-3-5-2-9l2-61-7-19-7 19 2 61c1 4 0 7-2 9-5 4-11 1-12-7l-8-66 5-14c4-10 5-19 3-28l-5-23-7 36c-1 5-3 8-7 8-5 0-8-4-7-11l5-35c2-13 5-23 10-30 5-6 12-9 21-11l2-11Z"/>
        <path d="M46 59c4 5 9 7 14 7s10-2 14-7M43 119c5 4 11 6 17 6s12-2 17-6M42 139c6 5 12 7 18 7s12-2 18-7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".45"/>
        <line class="measure-line" x1="24" x2="96" y1="${lineY}" y2="${lineY}"/>
        <circle class="measure-dot" cx="96" cy="${lineY}" r="4"/>
      </svg>`;
  }

  function openBetterMeasureGuide(id) {
    const guide = MEASURES[id];
    if (!guide) return false;
    openDialog({
      title: `Onde medir · ${guide.title}`,
      subtitle: 'Use sempre o mesmo ponto para comparar sua evolução com consistência.',
      className: 'qa51-measure-dialog',
      body: `
        <div class="qa51-measure-layout">
          <div class="qa51-measure-figure">${humanBodySvg(guide.y)}</div>
          <div class="qa51-measure-copy">
            <strong>${esc(guide.title)}</strong>
            <p>${esc(guide.text)}</p>
            <div class="qa51-measure-tip">Fita paralela ao chão, encostada no corpo sem comprimir a pele. Faça a medida em condições parecidas e registre no mesmo lado quando houver lado de referência.</div>
          </div>
        </div>`
    });
    return true;
  }

  function handleMeasureHelp(event) {
    const button = event.target.closest('.qa5-measure-help');
    if (!button) return;
    const input = button.closest('.ritmo-field')?.querySelector('input[id]');
    if (!input || !MEASURES[input.id]) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    openBetterMeasureGuide(input.id);
  }

  function enhance(root = document) {
    ensureStyle();
    enhanceCentralFinance(root);
    bindPurchaseLocationButton(root);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhance(document);
    });
  }

  function start() {
    ensureStyle();
    enhance(document);
    document.addEventListener('click', handleNewPurchaseLocation, true);
    document.addEventListener('click', handleMeasureHelp, true);

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('lifeos:ready', () => setTimeout(schedule, 60));
    window.addEventListener('lifeos:financeiro-abrir', () => setTimeout(schedule, 40));
    window.addEventListener('lifeos:contas-atualizadas', () => setTimeout(schedule, 40));
    window.addEventListener('pageshow', () => setTimeout(schedule, 0));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
