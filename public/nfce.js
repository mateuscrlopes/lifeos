// LifeOS — leitura de NFC-e por QR Code no modo Mercado.
// O QR é lido no aparelho; o servidor consulta apenas URLs oficiais da SEFAZ-RJ.

const NFC_JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';

let nfceClient = null;
let nfceProfile = null;
let nfceOverlay = null;
let nfceStream = null;
let nfceScanFrame = 0;
let nfceNotaAtual = null;

function nfceEscape(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function nfceMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
}

function nfceNorm(value = '') {
  return String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|un|und|pct|pcte)\b/g, ' ')
    .replace(/\b(?:tradicional|integral|natural|zero|light|premium|tipo|marca)\b/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nfceTokens(value = '') {
  const stop = new Set(['de','da','do','das','dos','com','sem','para','em','a','o','e']);
  return nfceNorm(value).split(' ').filter(token => token.length > 1 && !stop.has(token));
}

function nfceSimilarity(a, b) {
  const ta = nfceTokens(a);
  const tb = nfceTokens(b);
  if (!ta.length || !tb.length) return 0;
  const setA = new Set(ta);
  const setB = new Set(tb);
  let inter = 0;
  for (const token of setA) if (setB.has(token)) inter += 1;
  const union = new Set([...setA, ...setB]).size || 1;
  const jaccard = inter / union;
  const na = nfceNorm(a);
  const nb = nfceNorm(b);
  const contains = na.includes(nb) || nb.includes(na) ? 0.35 : 0;
  const first = ta[0] === tb[0] ? 0.15 : 0;
  return Math.min(1, jaccard + contains + first);
}

async function nfceContext() {
  if (nfceClient && nfceProfile) return { client: nfceClient, profile: nfceProfile };
  const response = await fetch('/config');
  if (!response.ok) throw new Error('Não foi possível carregar a configuração do LifeOS.');
  const config = await response.json();
  if (!window.supabase) throw new Error('Supabase não está disponível.');
  nfceClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data: sessionData } = await nfceClient.auth.getSession();
  const session = sessionData?.session;
  if (!session) throw new Error('Faça login novamente para continuar.');
  const { data: profile, error } = await nfceClient.from('usuarios')
    .select('id,nome,casa_id').eq('auth_id', session.user.id).single();
  if (error || !profile) throw new Error('Perfil do LifeOS não encontrado.');
  nfceProfile = profile;
  return { client: nfceClient, profile, session };
}

function nfceStyles() {
  if (document.getElementById('lifeosNfceStyles')) return;
  const style = document.createElement('style');
  style.id = 'lifeosNfceStyles';
  style.textContent = `
    .nfce-overlay{position:fixed;inset:0;z-index:220;background:rgba(17,24,19,.58);display:grid;place-items:end center}
    .nfce-sheet{width:min(100%,560px);max-height:94dvh;overflow:auto;background:var(--paper,#fff);color:var(--texto,#172018);border-radius:22px 22px 0 0;padding:18px 18px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -12px 40px rgba(0,0,0,.18)}
    .nfce-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.nfce-head h2{margin:0;font:700 21px/1.1 var(--serif,serif)}.nfce-head p{margin:5px 0 0;color:var(--muted,#667);font-size:12px}
    .nfce-close{border:0;background:var(--bg,#f4f3ef);width:38px;height:38px;border-radius:12px;font-size:24px;color:inherit}
    .nfce-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.nfce-btn{border:0;border-radius:12px;padding:12px 14px;font-weight:750;font-size:14px}.nfce-btn.primary{background:var(--sage,#47745b);color:#fff}.nfce-btn.secondary{background:var(--sage-soft,#e8f1eb);color:var(--sage,#47745b)}.nfce-btn.ghost{background:var(--bg,#f4f3ef);color:inherit}.nfce-btn:disabled{opacity:.5}
    .nfce-camera{position:relative;margin:12px 0;border-radius:16px;overflow:hidden;background:#111;aspect-ratio:3/4}.nfce-camera video{width:100%;height:100%;object-fit:cover}.nfce-frame{position:absolute;inset:20%;border:3px solid #fff;border-radius:18px;box-shadow:0 0 0 999px rgba(0,0,0,.2)}
    .nfce-status{padding:12px;border-radius:12px;background:var(--bg,#f4f3ef);font-size:13px;margin:12px 0}.nfce-status.error{color:#a33;background:#fff0f0}
    .nfce-manual{display:flex;gap:8px;margin-top:10px}.nfce-manual input{flex:1;min-width:0;padding:11px;border:1px solid var(--linha,#ddd);border-radius:10px;background:var(--bg,#fff);color:inherit}
    .nfce-note-card{background:var(--bg,#f6f5f1);border-radius:14px;padding:13px;margin:10px 0}.nfce-note-card strong{display:block}.nfce-list{display:flex;flex-direction:column;gap:8px;margin:12px 0}.nfce-item{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:start;padding:11px;border:1px solid var(--linha,#ddd);border-radius:12px}.nfce-item input{width:19px;height:19px;accent-color:var(--sage,#47745b);margin-top:2px}.nfce-item small{display:block;color:var(--muted,#667);margin-top:3px}.nfce-price{font-weight:750;white-space:nowrap}.nfce-match{font-size:11px!important;color:var(--sage,#47745b)!important}.nfce-footer{position:sticky;bottom:0;background:var(--paper,#fff);padding-top:10px}.nfce-market-button{width:100%;margin-bottom:8px!important}
    @media(min-width:700px){.nfce-overlay{place-items:center}.nfce-sheet{border-radius:22px;max-height:88dvh}}
  `;
  document.head.appendChild(style);
}

function nfceStopCamera() {
  cancelAnimationFrame(nfceScanFrame);
  nfceScanFrame = 0;
  nfceStream?.getTracks?.().forEach(track => track.stop());
  nfceStream = null;
}

function nfceClose() {
  nfceStopCamera();
  nfceOverlay?.remove();
  nfceOverlay = null;
}

function nfceOpen() {
  nfceClose();
  nfceStyles();
  nfceOverlay = document.createElement('div');
  nfceOverlay.className = 'nfce-overlay';
  nfceOverlay.innerHTML = `
    <section class="nfce-sheet" role="dialog" aria-modal="true" aria-label="Ler nota fiscal">
      <div class="nfce-head"><div><h2>Ler nota fiscal</h2><p>Escaneie o QR Code da NFC-e depois da compra.</p></div><button class="nfce-close" data-nfce-close aria-label="Fechar">×</button></div>
      <div id="nfceContent">
        <div class="nfce-actions"><button class="nfce-btn primary" data-nfce-camera>Usar câmera</button><button class="nfce-btn secondary" data-nfce-photo>Usar foto</button></div>
        <input id="nfcePhotoInput" type="file" accept="image/*" capture="environment" hidden>
        <div class="nfce-manual"><input id="nfceManualUrl" inputmode="url" placeholder="Ou cole o link do QR Code"><button class="nfce-btn ghost" data-nfce-manual>Ler</button></div>
        <div class="nfce-status">O LifeOS confere os itens antes de jogar tudo para o carrinho.</div>
      </div>
    </section>`;
  document.body.appendChild(nfceOverlay);
  nfceOverlay.addEventListener('click', event => {
    if (event.target === nfceOverlay || event.target.closest('[data-nfce-close]')) nfceClose();
  });
  nfceOverlay.querySelector('[data-nfce-camera]').addEventListener('click', nfceStartCamera);
  nfceOverlay.querySelector('[data-nfce-photo]').addEventListener('click', () => nfceOverlay.querySelector('#nfcePhotoInput').click());
  nfceOverlay.querySelector('#nfcePhotoInput').addEventListener('change', nfceReadPhoto);
  nfceOverlay.querySelector('[data-nfce-manual]').addEventListener('click', () => {
    const value = nfceOverlay.querySelector('#nfceManualUrl').value.trim();
    if (value) nfceConsult(value);
  });
}

async function nfceLoadJsQr() {
  if (window.jsQR) return window.jsQR;
  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-lifeos-jsqr]');
    if (existing) { existing.addEventListener('load', resolve, { once:true }); existing.addEventListener('error', reject, { once:true }); return; }
    const script = document.createElement('script');
    script.src = NFC_JSQR_URL; script.async = true; script.dataset.lifeosJsqr = '1'; script.onload = resolve;
    script.onerror = () => reject(new Error('Não foi possível carregar o leitor de QR Code.'));
    document.head.appendChild(script);
  });
  if (!window.jsQR) throw new Error('Leitor de QR Code indisponível.');
  return window.jsQR;
}

function nfceStatus(message, error = false) {
  const target = nfceOverlay?.querySelector('.nfce-status');
  if (!target) return;
  target.textContent = message;
  target.classList.toggle('error', error);
}

async function nfceStartCamera() {
  try {
    const jsQR = await nfceLoadJsQr();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('A câmera não está disponível neste navegador.');
    nfceStopCamera();
    const content = nfceOverlay.querySelector('#nfceContent');
    let camera = content.querySelector('.nfce-camera');
    if (!camera) {
      camera = document.createElement('div'); camera.className = 'nfce-camera';
      camera.innerHTML = '<video playsinline muted></video><div class="nfce-frame"></div><canvas hidden></canvas>';
      content.insertBefore(camera, content.querySelector('.nfce-manual'));
    }
    const video = camera.querySelector('video');
    const canvas = camera.querySelector('canvas');
    nfceStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    video.srcObject = nfceStream;
    await video.play();
    nfceStatus('Aponte para o QR Code da nota fiscal.');
    const scan = () => {
      if (!nfceStream || !video.videoWidth) { nfceScanFrame = requestAnimationFrame(scan); return; }
      const max = 900;
      const scale = Math.min(1, max / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
      if (code?.data) { nfceStopCamera(); nfceConsult(code.data); return; }
      nfceScanFrame = requestAnimationFrame(scan);
    };
    nfceScanFrame = requestAnimationFrame(scan);
  } catch (error) { nfceStatus(error.message || 'Não foi possível abrir a câmera.', true); }
}

async function nfceReadPhoto(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const jsQR = await nfceLoadJsQr();
    const bitmap = await createImageBitmap(file);
    const max = 1400; const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
    if (!code?.data) throw new Error('Não encontrei um QR Code legível nessa foto.');
    await nfceConsult(code.data);
  } catch (error) { nfceStatus(error.message || 'Não foi possível ler a foto.', true); }
  finally { event.target.value = ''; }
}

async function nfceConsult(rawUrl) {
  try {
    nfceStopCamera(); nfceStatus('Consultando a NFC-e na SEFAZ…');
    const { client } = await nfceContext();
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Faça login novamente para continuar.');
    const response = await fetch('/api/nfce/consultar', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ url: rawUrl }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      const error = new Error(payload.erro || 'Não foi possível consultar a nota fiscal.');
      error.url = payload.url || rawUrl; error.bloqueio = Boolean(payload.bloqueio); throw error;
    }
    nfceNotaAtual = { ...payload.nota, url: payload.url };
    await nfceRenderReview();
  } catch (error) {
    const content = nfceOverlay?.querySelector('#nfceContent');
    if (content && error.bloqueio && error.url) {
      content.innerHTML = `<div class="nfce-status error">${nfceEscape(error.message)}</div><p style="font-size:13px;color:var(--muted)">A leitura do QR funcionou, mas a SEFAZ bloqueou a consulta automática do servidor.</p><a class="nfce-btn secondary" style="display:block;text-align:center;text-decoration:none" href="${nfceEscape(error.url)}" target="_blank" rel="noopener">Abrir nota na SEFAZ</a><button class="nfce-btn ghost" style="width:100%;margin-top:8px" data-nfce-retry>Tentar outro QR</button>`;
      content.querySelector('[data-nfce-retry]').addEventListener('click', nfceOpen);
    } else nfceStatus(error.message || 'Não foi possível consultar a NFC-e.', true);
  }
}

function nfceBestMatch(receiptItem, pending, used) {
  let best = null;
  for (const item of pending) {
    if (used.has(item.id)) continue;
    const score = nfceSimilarity(receiptItem.nome, item.nome);
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score >= 0.42 ? best : null;
}

async function nfceRenderReview() {
  const { client, profile } = await nfceContext();
  const { data: pending, error } = await client.from('lista_compras').select('id,nome,quantidade,unidade,ciclo_compra,destino_compra_id,estoque_id').eq('casa_id', profile.casa_id).eq('status', 'pendente');
  if (error) throw error;
  const used = new Set();
  const annotated = nfceNotaAtual.itens.map((receipt, index) => {
    const match = nfceBestMatch(receipt, pending || [], used);
    if (match) used.add(match.item.id);
    return { ...receipt, _index: index, _match: match };
  });
  nfceNotaAtual._annotated = annotated;
  const content = nfceOverlay.querySelector('#nfceContent');
  const total = nfceNotaAtual.total != null ? nfceMoney(nfceNotaAtual.total) : 'total não identificado';
  content.innerHTML = `<div class="nfce-note-card"><strong>${nfceEscape(nfceNotaAtual.emitente || 'NFC-e')}</strong><small>${annotated.length} itens · ${total}${nfceNotaAtual.emissao ? ` · ${nfceEscape(nfceNotaAtual.emissao)}` : ''}</small></div><div class="nfce-list">${annotated.map(item => `<label class="nfce-item"><input type="checkbox" data-nfce-item="${item._index}" checked><span><b>${nfceEscape(item.nome)}</b><small>${item.quantidade ?? '—'} ${nfceEscape(item.unidade || '')}${item.valor_unitario != null ? ` · ${nfceMoney(item.valor_unitario)}/un.` : ''}</small><small class="nfce-match">${item._match ? `Vai para: ${nfceEscape(item._match.item.nome)}` : 'Novo item da compra'}</small></span><span class="nfce-price">${nfceMoney(item.valor_total)}</span></label>`).join('')}</div><div class="nfce-footer"><button class="nfce-btn primary" style="width:100%" data-nfce-apply>Aplicar na compra</button><button class="nfce-btn ghost" style="width:100%;margin-top:8px" data-nfce-back>Ler outra nota</button></div>`;
  content.querySelector('[data-nfce-apply]').addEventListener('click', nfceApply);
  content.querySelector('[data-nfce-back]').addEventListener('click', nfceOpen);
}

function nfceUnit(unit) {
  const map = { UN:'un', UND:'un', UNID:'un', KG:'kg', G:'g', L:'L', LT:'L', ML:'ml', PCT:'pacote', 'PÇ':'un', PC:'un' };
  const key = String(unit || '').trim().toUpperCase();
  return map[key] || (key ? key.toLowerCase() : null);
}

async function nfceApply() {
  const button = nfceOverlay.querySelector('[data-nfce-apply]');
  try {
    button.disabled = true; button.textContent = 'Aplicando…';
    const { client, profile } = await nfceContext();
    const selected = new Set([...nfceOverlay.querySelectorAll('[data-nfce-item]:checked')].map(el => Number(el.dataset.nfceItem)));
    const rows = (nfceNotaAtual._annotated || []).filter(item => selected.has(item._index));
    if (!rows.length) throw new Error('Selecione pelo menos um item.');
    const { data: market } = await client.from('compra_destinos').select('id').eq('casa_id', profile.casa_id).eq('tipo', 'mercado').eq('ativo', true).order('padrao', { ascending: false }).limit(1).maybeSingle();
    if (!market?.id) throw new Error('Destino Mercado não encontrado.');

    for (const row of rows) {
      const obs = `NFC-e${nfceNotaAtual.chave ? ` ${nfceNotaAtual.chave}` : ''}: ${row.quantidade ?? ''} ${row.unidade || ''}; valor total ${nfceMoney(row.valor_total)}`.trim();
      if (row._match?.item?.id) {
        const changes = { no_carrinho: true, preco_compra: row.valor_total == null ? null : Number(row.valor_total), compra_observacao: obs };
        if (row.quantidade != null && Number(row.quantidade) > 0) changes.quantidade = Number(row.quantidade);
        const unit = nfceUnit(row.unidade); if (unit) changes.unidade = unit;
        const result = await client.from('lista_compras').update(changes).eq('id', row._match.item.id);
        if (result.error) throw result.error;
      } else {
        const result = await client.from('lista_compras').insert({ casa_id: profile.casa_id, nome: row.nome, quantidade: row.quantidade == null ? 1 : Number(row.quantidade), unidade: nfceUnit(row.unidade) || 'un', categoria: 'mercado', status: 'pendente', criado_por: profile.id, origem: 'nfce', no_carrinho: true, preco_compra: row.valor_total == null ? null : Number(row.valor_total), compra_observacao: obs, destino_compra_id: market.id, ciclo_compra: 'semanal' });
        if (result.error) throw result.error;
      }
    }

    const content = nfceOverlay.querySelector('#nfceContent');
    content.innerHTML = `<div class="nfce-note-card"><strong>Nota aplicada à compra.</strong><small>${rows.length} itens foram colocados no carrinho com as quantidades e valores lidos da NFC-e.</small></div><button class="nfce-btn primary" style="width:100%" data-nfce-done>Atualizar Mercado</button>`;
    content.querySelector('[data-nfce-done]').addEventListener('click', () => window.location.reload());
  } catch (error) {
    button.disabled = false; button.textContent = 'Aplicar na compra';
    const status = document.createElement('div'); status.className = 'nfce-status error'; status.textContent = error.message || 'Não foi possível aplicar a nota.'; button.parentElement.before(status);
  }
}

function nfceInjectMarketButton(root = document) {
  const footers = root.querySelectorAll?.('.ui-market-footer') || [];
  footers.forEach(footer => {
    if (footer.querySelector('[data-nfce-open]')) return;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'ui-secondary nfce-market-button'; button.dataset.nfceOpen = '1'; button.textContent = 'Ler QR da nota fiscal'; button.addEventListener('click', nfceOpen); footer.prepend(button);
  });
}

nfceStyles();
nfceInjectMarketButton();
const nfceObserver = new MutationObserver(mutations => {
  for (const mutation of mutations) for (const node of mutation.addedNodes) {
    if (!(node instanceof Element)) continue;
    if (node.matches?.('.ui-market-footer')) nfceInjectMarketButton(node.parentElement || node); else nfceInjectMarketButton(node);
  }
});
nfceObserver.observe(document.documentElement, { childList: true, subtree: true });
window.lifeosAbrirNfce = nfceOpen;
