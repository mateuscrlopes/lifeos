import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

const HOSTS_NFCE_RJ = new Set([
  'consultadfe.fazenda.rj.gov.br',
  'www4.fazenda.rj.gov.br',
]);

function adminClient() {
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function contextoAutenticado(req) {
  if (!config.supabaseServiceKey) {
    return { ok: false, status: 503, erro: 'Consulta de NFC-e não configurada no servidor.' };
  }

  const cabecalho = String(req.get('authorization') || '');
  const token = cabecalho.toLowerCase().startsWith('bearer ')
    ? cabecalho.slice(7).trim()
    : '';

  if (!token) return { ok: false, status: 401, erro: 'Sessão ausente.' };

  const admin = adminClient();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData?.user) {
    return { ok: false, status: 401, erro: 'Sessão inválida.' };
  }

  const { data: perfil, error: perfilError } = await admin
    .from('usuarios')
    .select('id,nome,casa_id')
    .eq('auth_id', authData.user.id)
    .single();

  if (perfilError || !perfil) {
    return { ok: false, status: 403, erro: 'Perfil do LifeOS não encontrado.' };
  }

  return { ok: true, admin, perfil };
}

function decodificarEntidades(valor = '') {
  return String(valor)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizarHtml(valor = '') {
  let html = String(valor || '');
  html = html
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u0022/gi, '"')
    .replace(/\\u0027/gi, "'")
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, ' ');
  html = decodificarEntidades(decodificarEntidades(html));
  return html;
}

function textoLimpo(fragmento = '') {
  return decodificarEntidades(
    String(fragmento)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

function escaparRegex(valor = '') {
  return String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textoClasse(bloco, classes = []) {
  for (const classe of classes) {
    const alvo = escaparRegex(classe);
    const regex = new RegExp(
      `<span\\b[^>]*class=["'][^"']*\\b${alvo}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/span>`,
      'i'
    );
    const match = String(bloco).match(regex);
    if (match) return textoLimpo(match[1]);
  }
  return '';
}

function numeroPtBr(valor) {
  const bruto = textoLimpo(valor).replace(/[^\d,.-]/g, '').trim();
  if (!bruto) return null;
  let normalizado = bruto;
  if (bruto.includes(',') && bruto.includes('.')) normalizado = bruto.replace(/\./g, '').replace(',', '.');
  else if (bruto.includes(',')) normalizado = bruto.replace(',', '.');
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function somenteDigitos(valor = '') {
  return String(valor).replace(/\D/g, '');
}

function primeiraCaptura(html, regex) {
  const match = String(html).match(regex);
  return match?.[1] ? textoLimpo(match[1]) : '';
}

function chaveDaUrl(urlConsulta = '') {
  try {
    const url = new URL(urlConsulta);
    const parametro = url.searchParams.get('p') || url.searchParams.get('chNFe') || '';
    const candidato = somenteDigitos(parametro.split('|')[0]);
    if (candidato.length >= 44) return candidato.slice(0, 44);
  } catch {}
  return '';
}

export function interpretarNfceHtml(htmlOriginal, urlConsulta = '') {
  const html = normalizarHtml(htmlOriginal);
  const linhas = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
  const itens = [];

  for (const linha of linhas) {
    const nome = textoClasse(linha, ['txtTit', 'txtTit2']);
    const quantidadeTexto = textoClasse(linha, ['Rqtd']);
    const unidadeTexto = textoClasse(linha, ['RUN']);
    const valorUnitarioTexto = textoClasse(linha, ['RvlUnit']);
    const valorTotalTexto = textoClasse(linha, ['valor']);
    const codigoTexto = textoClasse(linha, ['RCod']);
    if (!nome || (!quantidadeTexto && !valorTotalTexto)) continue;
    if (/^vl\.?\s*total$/i.test(nome)) continue;

    itens.push({
      nome: nome.replace(/^\s*\d+\s*[-–—]\s*/, '').trim(),
      codigo: somenteDigitos(codigoTexto.replace(/c[oó]digo\s*:/i, '')) || null,
      quantidade: numeroPtBr(quantidadeTexto.replace(/qtde\.?\s*:/i, '')),
      unidade: unidadeTexto.replace(/^un\s*:\s*/i, '').trim().toUpperCase() || null,
      valor_unitario: numeroPtBr(valorUnitarioTexto.replace(/vl\.?\s*unit\.?\s*:/i, '')),
      valor_total: numeroPtBr(valorTotalTexto),
    });
  }

  const textoPagina = textoLimpo(html);
  const emitente =
    primeiraCaptura(html, /<div\b[^>]*class=["'][^"']*\btxtTopo\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    || primeiraCaptura(html, /<div\b[^>]*id=["']u20["'][^>]*>([\s\S]*?)<\/div>/i)
    || null;
  const cnpjMatch = textoPagina.match(/\bCNPJ\s*:?\s*([\d./-]{14,20})/i);
  const cnpj = cnpjMatch ? somenteDigitos(cnpjMatch[1]) : null;
  const totalMatch = html.match(/Valor\s+a\s+pagar\s*R\$\s*:?\s*<\/label>\s*<span\b[^>]*class=["'][^"']*\btotalNumb\b[^"']*\btxtMax\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  const totalCalculado = itens.reduce((soma, item) => soma + (Number(item.valor_total) || 0), 0);
  const total = totalMatch ? numeroPtBr(totalMatch[1]) : (totalCalculado || null);
  const emissaoMatch = textoPagina.match(/Emiss(?:ã|a)o\s*:\s*(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)/i);
  const numeroMatch = textoPagina.match(/\bN[uú]mero\s*:\s*(\d+)/i);
  const serieMatch = textoPagina.match(/\bS[eé]rie\s*:\s*(\d+)/i);
  const chavePagina = primeiraCaptura(html, /<span\b[^>]*class=["'][^"']*\bchave\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  const chave = chaveDaUrl(urlConsulta) || somenteDigitos(chavePagina).slice(0, 44) || null;

  return {
    emitente, cnpj, chave,
    numero: numeroMatch?.[1] || null,
    serie: serieMatch?.[1] || null,
    emissao: emissaoMatch?.[1] || null,
    total,
    quantidade_itens: itens.length,
    itens,
  };
}

function validarUrlNfce(valor) {
  let url;
  try { url = new URL(String(valor || '').trim()); }
  catch { throw new Error('O QR Code não contém um endereço válido.'); }

  const host = url.hostname.toLowerCase();
  if (!HOSTS_NFCE_RJ.has(host)) throw new Error('Este QR Code não é de uma NFC-e da SEFAZ-RJ.');
  if (!/\/consultaNFCe\/QRCode\/?$/i.test(url.pathname)) throw new Error('O endereço não corresponde à consulta de NFC-e da SEFAZ-RJ.');
  if (host === 'www4.fazenda.rj.gov.br') {
    url.protocol = 'https:';
    url.hostname = 'consultadfe.fazenda.rj.gov.br';
  }
  if (url.protocol !== 'https:') throw new Error('A consulta da NFC-e precisa usar HTTPS.');
  return url;
}

async function baixarNfce(url) {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 15000);
  try {
    const resposta = await fetch(url, {
      redirect: 'follow', signal: controlador.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });
    const html = await resposta.text();
    if (!resposta.ok) throw new Error(`A SEFAZ respondeu com status ${resposta.status}.`);
    if (/endereços IP|enderecos IP|serviço de segurança|servico de seguranca|Número de ID é|Numero de ID e/i.test(html)) {
      const erro = new Error('A SEFAZ-RJ bloqueou a consulta automática a partir do servidor.');
      erro.codigo = 'SEFAZ_BLOQUEIO';
      throw erro;
    }
    return html;
  } catch (erro) {
    if (erro?.name === 'AbortError') throw new Error('A consulta da NFC-e demorou mais do que o esperado.');
    throw erro;
  } finally { clearTimeout(timer); }
}

export function registrarRotasNfce(app) {
  app.post('/api/nfce/consultar', async (req, res) => {
    const contexto = await contextoAutenticado(req);
    if (!contexto.ok) return res.status(contexto.status).json({ ok: false, erro: contexto.erro });

    let url;
    try { url = validarUrlNfce(req.body?.url); }
    catch (erro) { return res.status(400).json({ ok: false, erro: erro.message }); }

    try {
      const html = await baixarNfce(url);
      const nota = interpretarNfceHtml(html, url.toString());
      if (!nota.itens.length) {
        return res.status(422).json({ ok: false, erro: 'A NFC-e foi aberta, mas os itens não puderam ser lidos.', url: url.toString() });
      }
      return res.json({ ok: true, nota, url: url.toString() });
    } catch (erro) {
      const bloqueio = erro?.codigo === 'SEFAZ_BLOQUEIO';
      return res.status(502).json({ ok: false, erro: erro?.message || 'Não foi possível consultar a NFC-e.', bloqueio, url: url.toString() });
    }
  });
}
