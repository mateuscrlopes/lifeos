// LifeOS — entrada direta de NFC-e por PDF.
// O usuário pode anexar um PDF da SEFAZ logo ao abrir o leitor, sem precisar
// iniciar câmera/QR primeiro. O processamento continua pertencendo ao
// nfce-smart-import-v3 através do contrato data-nfb-file.

(() => {
  'use strict';

  function installStyles() {
    if (document.getElementById('nfceDirectPdfStyles')) return;
    const style = document.createElement('style');
    style.id = 'nfceDirectPdfStyles';
    style.textContent = `
      .nfce-direct-pdf{display:grid;gap:7px;margin-bottom:12px}
      .nfce-direct-pdf .nfce-btn{width:100%}
      .nfce-direct-pdf small{display:block;color:var(--muted,#667);font-size:11px;line-height:1.4;padding:0 2px}
      .nfce-direct-separator{display:flex;align-items:center;gap:10px;color:var(--muted,#667);font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin:2px 0 10px}
      .nfce-direct-separator::before,.nfce-direct-separator::after{content:'';height:1px;background:var(--linha,#ddd);flex:1}
    `;
    document.head.appendChild(style);
  }

  function decorateOverlay(overlay) {
    if (!(overlay instanceof HTMLElement)) return;
    const content = overlay.querySelector('#nfceContent');
    if (!content) return;

    // Telas de fallback/revisão já possuem seu próprio seletor de arquivo.
    // Só adicionamos a entrada direta na tela inicial.
    if (content.querySelector('[data-nfb-file]') || content.querySelector('[data-nfce-direct-pdf]')) return;

    const actions = content.querySelector('.nfce-actions');
    if (!actions) return;

    const direct = document.createElement('div');
    direct.className = 'nfce-direct-pdf';
    direct.dataset.nfceDirectPdf = '1';
    direct.innerHTML = `
      <button type="button" class="nfce-btn primary" data-nfce-direct-pdf-button>Importar PDF da SEFAZ</button>
      <input type="file" accept="application/pdf,.pdf" data-nfb-file hidden>
      <small>Se você já salvou a nota em PDF, anexe direto. Não precisa abrir a câmera primeiro.</small>
    `;

    const separator = document.createElement('div');
    separator.className = 'nfce-direct-separator';
    separator.textContent = 'ou escaneie o QR';

    content.insertBefore(direct, actions);
    content.insertBefore(separator, actions);

    const input = direct.querySelector('[data-nfb-file]');
    direct.querySelector('[data-nfce-direct-pdf-button]')?.addEventListener('click', () => input?.click());

    const subtitle = overlay.querySelector('.nfce-head p');
    if (subtitle) subtitle.textContent = 'Importe o PDF da SEFAZ ou escaneie o QR Code.';

    const status = content.querySelector('.nfce-status');
    if (status && /jogar tudo para o carrinho/i.test(status.textContent || '')) {
      status.textContent = 'PDF e QR entram no mesmo fluxo de conferência. A NFC-e é registrada como compra já realizada.';
    }
  }

  installStyles();

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches?.('.nfce-overlay')) decorateOverlay(node);
        node.querySelectorAll?.('.nfce-overlay').forEach(decorateOverlay);
      }
    }
  });

  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }), { once: true });

  document.querySelectorAll('.nfce-overlay').forEach(decorateOverlay);
})();
