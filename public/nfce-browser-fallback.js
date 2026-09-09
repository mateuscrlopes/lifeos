// LifeOS — fallback de NFC-e pelo navegador
// Quando datacenters são bloqueados pela SEFAZ, tentamos usar a própria rede do
// aparelho. Se a política entre sites impedir a leitura, o usuário pode importar
// PDF/print da página oficial; a extração ocorre localmente no navegador.

(() => {
  'use strict';

  const F = {
    client: null,
    profile: null,
    pdfPromise: null,
    ocrPromise: null,
    processing: false,
    observedUrl: null,
  };

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function money(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '—';
  }

  function numberPt(value) {
    const raw = String(value || '').replace(/[^\d,.-]/g, '').trim();
    if (!raw) return null;
    let normalized = raw;
    if (raw.includes(',') && raw.includes('.')) normalized = raw.replace(/\./g, '').replace(',', '.');
    else if (raw.includes(',')) normalized = raw.replace(',', '.');
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function digits(value = '') {
    return String(value).replace(/\D/g, '');
  }

  function cleanText(value = '') {
    return String(value).replace(/\s+/g, ' ').trim();
  }

  async function context() {
    const ctx = window.lifeosContext;
    if (ctx?.supa && ctx?.usuario) {
      F.client = ctx.supa;
      F.profile = ctx.usuario;
      return { client: F.client, profile: F.profile };
    }
    if (F.client && F.profile) return { client: F.client, profile: F.profile };
    const configResponse = await fetch('/config');
    if (!configResponse.ok) throw new Error('Não foi possível carregar a configuração do LifeOS.');
    const config = await configResponse.json();
    if (!window.supabase) throw new Error('Supabase não está disponível.');
    F.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data: auth } = await F.client.auth.getSession();
    if (!auth?.session) throw new Error('Faça login novamente para continuar.');
    const { data: profile, error } = await F.client.from('usuarios')
      .select('id,nome,casa_id').eq('auth_id', auth.session.user.id).single();
    if (error || !profile) throw new Error('Perfil do LifeOS não encontrado.');
    F.profile = profile;
    return { client: F.client, profile };
  }

  function normalize(value = '') {
    return String(value)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\b\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|un|und|pct|pcte)\b/g, ' ')
      .replace(/\b(?:tradicional|integral|natural|zero|light|premium|tipo|marca)\b/g, ' ')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokens(value = '') {
    const stop = new Set(['de','da','do','das','dos','com','sem','para','em','a','o','e']);
    return normalize(value).split(' ').filter(token => token.length > 1 && !stop.has(token));
  }

  function similarity(a, b) {
    const ta = tokens(a), tb = tokens(b);
    if (!ta.length || !tb.length) return 0;
    const sa = new Set(ta), sb = new Set(tb);
    let inter = 0;
    for (const token of sa) if (sb.has(token)) inter += 1;
    const union = new Set([...sa, ...sb]).size || 1;
    const contains = normalize(a).includes(normalize(b)) || normalize(b).includes(normalize(a)) ? 0.35 : 0;
    const first = ta[0] === tb[0] ? 0.15 : 0;
    return Math.min(1, inter / union + contains + first);
  }

  function parseHtml(html, url = '') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items = [];
    doc.querySelectorAll('tr').forEach(row => {
      const text = selector => cleanText(row.querySelector(selector)?.textContent || '');
      const name = text('.txtTit,.txtTit2');
      const qty = numberPt(text('.Rqtd').replace(/qtde\.?\s*:/i, ''));
      const unit = text('.RUN').replace(/^un\s*:\s*/i, '').trim().toUpperCase() || null;
      const unitPrice = numberPt(text('.RvlUnit').replace(/vl\.?\s*unit\.?\s*:/i, ''));
      const total = numberPt(text('.valor'));
      const code = digits(text('.RCod').replace(/c[oó]digo\s*:/i, '')) || null;
      if (!name || (qty == null && total == null)) return;
      items.push({ nome: name.replace(/^\s*\d+\s*[-–—]\s*/, '').trim(), codigo: code, quantidade: qty, unidade: unit, valor_unitario: unitPrice, valor_total: total });
    });
    const pageText = cleanText(doc.body?.textContent || '');
    const cnpjMatch = pageText.match(/\bCNPJ\s*:?\s*([\d./-]{14,20})/i);
    const totalText = cleanText(doc.querySelector('.totalNumb.txtMax')?.textContent || '');
    const title = cleanText(doc.querySelector('.txtTopo')?.textContent || '') || null;
    let key = null;
    try {
      const parsed = new URL(url);
      const raw = parsed.searchParams.get('p') || parsed.searchParams.get('chNFe') || '';
      const candidate = digits(raw.split('|')[0]);
      if (candidate.length >= 44) key = candidate.slice(0, 44);
    } catch {}
    return {
      emitente: title,
      cnpj: cnpjMatch ? digits(cnpjMatch[1]) : null,
      chave: key,
      total: numberPt(totalText) ?? items.reduce((sum, item) => sum + Number(item.valor_total || 0), 0),
      quantidade_itens: items.length,
      itens: items,
      url,
    };
  }

  function parsePlainText(input, url = '') {
    const text = String(input || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\r/g, '\n');
    const compact = text.replace(/\n+/g, '\n');
    const items = [];

    // Formato típico da consulta da NFC-e: nome, Código, Qtde., UN, Vl. Unit., total.
    const itemRegex = /(?:^|\n)([^\n]{3,180}?)\s*(?:\(?\s*C[oó]digo\s*:\s*([^\n)]{1,40})\s*\)?)?\s*(?:\n|\s)+Qtde\.?\s*:\s*([\d.,]+)\s*(?:\n|\s)+UN\s*:\s*([A-Za-zÇÃÕÉÊÁÍÓÚ]+)\s*(?:\n|\s)+Vl\.?\s*Unit\.?\s*:\s*([\d.,]+)\s*(?:\n|\s)+([\d.,]+)(?=\s*(?:\n|$))/gim;
    let match;
    while ((match = itemRegex.exec(compact))) {
      const name = cleanText(match[1]).replace(/^\d+\s*[-–—]\s*/, '');
      if (/^(?:qtde|un|vl\.?\s*unit)/i.test(name)) continue;
      items.push({
        nome: name,
        codigo: digits(match[2] || '') || null,
        quantidade: numberPt(match[3]),
        unidade: cleanText(match[4]).toUpperCase(),
        valor_unitario: numberPt(match[5]),
        valor_total: numberPt(match[6]),
      });
    }

    // OCR às vezes cola tudo em uma linha; tenta localizar blocos pelos rótulos.
    if (!items.length) {
      const flat = compact.replace(/\n/g, ' ');
      const loose = /(.{3,120}?)\s*(?:\(?C[oó]digo\s*:\s*([^)]{1,40})\)?)?\s*Qtde\.?\s*:\s*([\d.,]+)\s*UN\s*:\s*([A-Za-z]+)\s*Vl\.?\s*Unit\.?\s*:\s*([\d.,]+)\s+([\d.,]+)/gi;
      while ((match = loose.exec(flat))) {
        let name = cleanText(match[1]);
        const cut = Math.max(name.lastIndexOf(' R$ '), name.lastIndexOf(' Total '));
        if (cut >= 0) name = cleanText(name.slice(cut + 4));
        if (name.length > 100) name = name.slice(-100).trim();
        if (!name) continue;
        items.push({ nome: name, codigo: digits(match[2] || '') || null, quantidade: numberPt(match[3]), unidade: cleanText(match[4]).toUpperCase(), valor_unitario: numberPt(match[5]), valor_total: numberPt(match[6]) });
      }
    }

    const cnpjMatch = compact.match(/\bCNPJ\s*:?\s*([\d./-]{14,20})/i);
    const totalMatch = compact.match(/Valor\s+a\s+pagar\s*R\$?\s*:?\s*([\d.,]+)/i)
      || compact.match(/Valor\s+total\s*R\$?\s*:?\s*([\d.,]+)/i);
    let key = null;
    const keyMatch = compact.match(/\b(\d{44})\b/);
    if (keyMatch) key = keyMatch[1];
    if (!key) {
      try {
        const parsed = new URL(url);
        const candidate = digits((parsed.searchParams.get('p') || parsed.searchParams.get('chNFe') || '').split('|')[0]);
        if (candidate.length >= 44) key = candidate.slice(0, 44);
      } catch {}
    }
    return {
      emitente: null,
      cnpj: cnpjMatch ? digits(cnpjMatch[1]) : null,
      chave: key,
      total: totalMatch ? numberPt(totalMatch[1]) : items.reduce((sum, item) => sum + Number(item.valor_total || 0), 0),
      quantidade_itens: items.length,
      itens: items,
      url,
    };
  }

  async function loadPdfJs() {
    if (window.pdfjsLib?.getDocument) return window.pdfjsLib;
    if (F.pdfPromise) return F.pdfPromise;
    F.pdfPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
      script.async = true;
      script.onload = () => {
        if (!window.pdfjsLib?.getDocument) return reject(new Error('Leitor de PDF não ficou disponível.'));
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error('Não foi possível carregar o leitor de PDF.'));
      document.head.appendChild(script);
    }).catch(error => { F.pdfPromise = null; throw error; });
    return F.pdfPromise;
  }

  async function loadTesseract() {
    if (window.Tesseract?.createWorker) return window.Tesseract;
    if (F.ocrPromise) return F.ocrPromise;
    F.ocrPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.min.js';
      script.async = true;
      script.onload = () => window.Tesseract?.createWorker ? resolve(window.Tesseract) : reject(new Error('OCR não ficou disponível.'));
      script.onerror = () => reject(new Error('Não foi possível carregar o OCR.'));
      document.head.appendChild(script);
    }).catch(error => { F.ocrPromise = null; throw error; });
    return F.ocrPromise;
  }

  function setFallbackStatus(message, error = false) {
    const node = document.querySelector('.nfce-browser-status');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('error', error);
  }

  async function textFromPdf(file) {
    const pdfjs = await loadPdfJs();
    const data = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data }).promise;
    const chunks = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      setFallbackStatus(`Lendo texto do PDF… página ${pageNumber}/${pdf.numPages}`);
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      chunks.push(content.items.map(item => item.str).join('\n'));
    }
    return { text: chunks.join('\n'), pdf };
  }

  async function ocrCanvas(canvas, worker, label) {
    setFallbackStatus(label);
    const result = await worker.recognize(canvas);
    return result?.data?.text || '';
  }

  async function ocrImageFile(file) {
    const Tesseract = await loadTesseract();
    const worker = await Tesseract.createWorker('por');
    try {
      setFallbackStatus('Lendo o print da nota… isso pode levar alguns segundos.');
      const result = await worker.recognize(file);
      return result?.data?.text || '';
    } finally {
      await worker.terminate();
    }
  }

  async function ocrPdf(pdf) {
    const Tesseract = await loadTesseract();
    const worker = await Tesseract.createWorker('por');
    const chunks = [];
    try {
      const maxPages = Math.min(pdf.numPages, 8);
      for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.6 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        chunks.push(await ocrCanvas(canvas, worker, `Lendo imagem do PDF… página ${pageNumber}/${maxPages}`));
      }
    } finally {
      await worker.terminate();
    }
    return chunks.join('\n');
  }

  async function parseFile(file, url) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
      const { text, pdf } = await textFromPdf(file);
      let note = parsePlainText(text, url);
      if (!note.itens.length) {
        setFallbackStatus('O PDF parece ser uma imagem. Vou tentar ler visualmente.');
        const ocr = await ocrPdf(pdf);
        note = parsePlainText(ocr, url);
      }
      return note;
    }
    const text = await ocrImageFile(file);
    return parsePlainText(text, url);
  }

  function bestMatch(noteItem, pending) {
    let best = null;
    for (const item of pending) {
      const score = similarity(noteItem.nome, item.nome);
      if (!best || score > best.score) best = { item, score };
    }
    return best && best.score >= 0.42 ? best : null;
  }

  async function showReview(note, sourceLabel = 'nota') {
    if (!note?.itens?.length) throw new Error('Não consegui identificar produtos nessa nota.');
    const { client, profile } = await context();
    const pendingResult = await client.from('lista_compras')
      .select('id,nome,quantidade,unidade,quantidade_planejada,unidade_planejada,quantidade_comprada,unidade_comprada,ciclo_compra,destino_compra_id,estoque_id')
      .eq('casa_id', profile.casa_id).eq('status', 'pendente');
    if (pendingResult.error) throw pendingResult.error;
    const pending = pendingResult.data || [];
    const rows = note.itens.map(item => ({ ...item, _match: bestMatch(item, pending) }));

    const content = document.querySelector('.nfce-overlay #nfceContent');
    if (!content) throw new Error('Leitor da nota não está aberto.');
    content.innerHTML = `
      <div class="nfce-note-card"><strong>${esc(note.emitente || 'NFC-e identificada')}</strong><small>${rows.length} ${rows.length === 1 ? 'produto' : 'produtos'} · ${money(note.total)}</small></div>
      <div class="nfce-browser-status">Confira o que será colocado no carrinho.</div>
      <div class="nfce-list">${rows.map((row, index) => `<label class="nfce-item"><input type="checkbox" data-nfb-row="${index}" checked><span><strong>${esc(row.nome)}</strong><small>${esc(`${row.quantidade ?? '—'} ${row.unidade || ''}`.trim())} · unit. ${money(row.valor_unitario)}</small>${row._match ? `<small class="nfce-match">Lista: ${esc(row._match.item.nome)}</small>` : '<small class="nfce-match">Novo item no carrinho</small>'}</span><span class="nfce-price">${money(row.valor_total)}</span></label>`).join('')}</div>
      <div class="nfce-footer"><button type="button" class="nfce-btn primary" style="width:100%" data-nfb-apply>Aplicar ao carrinho</button><button type="button" class="nfce-btn ghost" style="width:100%;margin-top:8px" data-nfb-cancel>Voltar</button></div>`;

    content.querySelector('[data-nfb-cancel]').addEventListener('click', () => enhanceBlockedScreen(F.observedUrl, true));
    content.querySelector('[data-nfb-apply]').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const selected = rows.filter((row, index) => content.querySelector(`[data-nfb-row="${index}"]`)?.checked);
        if (!selected.length) throw new Error('Selecione ao menos um produto.');
        await applyRows(selected, note, sourceLabel);
        document.querySelector('.nfce-overlay')?.remove();
        window.lifeosToast?.(`${selected.length} ${selected.length === 1 ? 'item adicionado' : 'itens adicionados'} ao carrinho.`, 'ok');
        window.dispatchEvent(new CustomEvent('lifeos:nfce-browser-applied'));
      } catch (error) {
        button.disabled = false;
        setFallbackStatus(error.message || 'Não foi possível aplicar a nota.', true);
      }
    });
  }

  async function applyRows(rows, note, sourceLabel) {
    const { client, profile } = await context();
    const destinationResult = await client.from('compra_destinos')
      .select('id,nome,entra_lista_mercado,padrao,ativo,ordem')
      .eq('casa_id', profile.casa_id).eq('ativo', true).eq('entra_lista_mercado', true)
      .order('padrao', { ascending: false }).order('ordem').limit(1).maybeSingle();
    const market = destinationResult.data || null;

    for (const row of rows) {
      const qty = row.quantidade != null && Number(row.quantidade) > 0 ? Number(row.quantidade) : 1;
      const unit = String(row.unidade || 'un').trim() || 'un';
      const observation = `${sourceLabel === 'navegador' ? 'NFC-e via navegador' : 'NFC-e importada'}${note.chave ? ` ${note.chave}` : ''}: ${qty} ${unit}; total ${money(row.valor_total)}`;
      if (row._match?.item?.id) {
        const current = row._match.item;
        const result = await client.from('lista_compras').update({
          quantidade_planejada: current.quantidade_planejada ?? current.quantidade,
          unidade_planejada: current.unidade_planejada ?? current.unidade,
          quantidade_comprada: qty,
          unidade_comprada: unit,
          no_carrinho: true,
          preco_compra: row.valor_total == null ? null : Number(row.valor_total),
          compra_observacao: observation,
        }).eq('id', current.id).eq('casa_id', profile.casa_id);
        if (result.error) throw result.error;
      } else {
        const result = await client.from('lista_compras').insert({
          casa_id: profile.casa_id,
          nome: row.nome,
          quantidade: qty,
          unidade: unit,
          quantidade_comprada: qty,
          unidade_comprada: unit,
          status: 'pendente',
          origem: 'nfce',
          criado_por: profile.id,
          no_carrinho: true,
          preco_compra: row.valor_total == null ? null : Number(row.valor_total),
          compra_observacao: observation,
          destino_compra_id: market?.id || null,
        });
        if (result.error) throw result.error;
      }
    }
  }

  async function tryBrowser(url) {
    if (!url || F.processing) return;
    F.processing = true;
    setFallbackStatus('Tentando ler a nota pela conexão deste aparelho…');
    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        headers: { Accept: 'text/html,application/xhtml+xml' },
      });
      if (!response.ok) throw new Error(`A SEFAZ respondeu ${response.status}.`);
      const html = await response.text();
      const note = parseHtml(html, url);
      if (!note.itens.length) throw new Error('A página abriu, mas o navegador não conseguiu interpretar os produtos.');
      await showReview(note, 'navegador');
    } catch (error) {
      // Navegação pode funcionar e fetch falhar: isso é o bloqueio de leitura entre origens.
      setFallbackStatus('A página abre no iPhone, mas a SEFAZ não permite que outro site leia o conteúdo diretamente. Use “Importar PDF ou print” abaixo.', false);
    } finally {
      F.processing = false;
    }
  }

  async function handleFile(event, url) {
    const file = event.target.files?.[0];
    if (!file || F.processing) return;
    F.processing = true;
    const button = document.querySelector('[data-nfb-file-button]');
    if (button) button.disabled = true;
    try {
      setFallbackStatus('Preparando a nota para leitura…');
      const note = await parseFile(file, url);
      if (!note.itens.length) throw new Error('Não consegui reconhecer os itens. Tente um PDF da página ou um print com os produtos legíveis.');
      await showReview(note, 'arquivo');
    } catch (error) {
      setFallbackStatus(error.message || 'Não foi possível ler esse arquivo.', true);
      if (button) button.disabled = false;
    } finally {
      F.processing = false;
      event.target.value = '';
    }
  }

  function enhanceBlockedScreen(url, force = false) {
    const content = document.querySelector('.nfce-overlay #nfceContent');
    if (!content || !url) return;
    F.observedUrl = url;
    if (!force && content.querySelector('[data-nfb-ready]')) return;

    content.innerHTML = `
      <div class="nfce-status error">A SEFAZ-RJ bloqueou a consulta automática dos servidores.</div>
      <p style="font-size:13px;color:var(--muted);line-height:1.5">O QR está correto. O LifeOS vai tentar primeiro usar a conexão deste aparelho. Se a SEFAZ permitir apenas visualizar a página, abra a nota e depois importe um PDF ou print dela.</p>
      <div class="nfce-browser-status" data-nfb-ready>Preparando alternativa…</div>
      <button type="button" class="nfce-btn primary" style="width:100%;margin-top:8px" data-nfb-browser>Tentar pela conexão do iPhone</button>
      <a class="nfce-btn secondary" style="display:block;text-align:center;text-decoration:none;margin-top:8px" href="${esc(url)}" target="_blank" rel="noopener">Abrir nota na SEFAZ</a>
      <button type="button" class="nfce-btn secondary" style="width:100%;margin-top:8px" data-nfb-file-button>Importar PDF ou print</button>
      <input type="file" accept="application/pdf,image/*" data-nfb-file hidden>
      <p style="font-size:11px;color:var(--muted);line-height:1.45;margin:10px 2px 0">O arquivo é lido no próprio aparelho. Não é necessário guardar uma cópia temporária no Supabase.</p>
      <button type="button" class="nfce-btn ghost" style="width:100%;margin-top:8px" data-nfb-other>Tentar outro QR</button>`;

    content.querySelector('[data-nfb-browser]').addEventListener('click', () => tryBrowser(url));
    content.querySelector('[data-nfb-file-button]').addEventListener('click', () => content.querySelector('[data-nfb-file]').click());
    content.querySelector('[data-nfb-file]').addEventListener('change', event => handleFile(event, url));
    content.querySelector('[data-nfb-other]').addEventListener('click', () => {
      const close = document.querySelector('.nfce-overlay [data-nfce-close]');
      close?.click();
      window.setTimeout(() => document.querySelector('[data-nfce-open]')?.click(), 80);
    });

    // Faz uma tentativa automática. Se CORS impedir, a interface permanece útil.
    window.setTimeout(() => tryBrowser(url), 40);
  }

  function detectBlockedScreen() {
    const overlay = document.querySelector('.nfce-overlay');
    if (!overlay) return;
    const openLink = [...overlay.querySelectorAll('a')]
      .find(link => /abrir nota na sefaz/i.test(link.textContent || ''));
    if (!openLink?.href) return;
    const text = overlay.textContent || '';
    if (!/bloqueou|consulta automática/i.test(text)) return;
    enhanceBlockedScreen(openLink.href);
  }

  function installStyles() {
    if (document.getElementById('nfceBrowserFallbackStyles')) return;
    const style = document.createElement('style');
    style.id = 'nfceBrowserFallbackStyles';
    style.textContent = `.nfce-browser-status{padding:10px 12px;border-radius:11px;background:var(--bg,#f4f3ef);font-size:12px;color:var(--muted,#667);line-height:1.4;margin:10px 0}.nfce-browser-status.error{background:#fff0f0;color:#a33}`;
    document.head.appendChild(style);
  }

  installStyles();
  const observer = new MutationObserver(() => window.setTimeout(detectBlockedScreen, 20));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('lifeos:bootstrap-ready', detectBlockedScreen);
})();
