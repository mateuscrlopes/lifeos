// acertos.js — LifeOS: comprovantes, aprovacao e recibos de acertos
// Documentos ficam privados no Supabase. PDFs sao lidos localmente, sem IA.

import crypto from 'crypto';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { extrairComprovantePdf } from './financeiro-extracao.js';

const BUCKET = 'comprovantes-acertos';
const LIMITE = 12 * 1024 * 1024;
const TIPOS = new Set(['application/pdf', 'image/png', 'image/jpeg']);

function adminClient() {
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function contextoAutenticado(req) {
  if (!config.supabaseServiceKey) {
    return { ok: false, status: 503, erro: 'Servico financeiro nao configurado no servidor.' };
  }

  const cabecalho = String(req.get('authorization') || '');
  const token = cabecalho.toLowerCase().startsWith('bearer ')
    ? cabecalho.slice(7).trim()
    : '';

  if (!token) {
    return { ok: false, status: 401, erro: 'Sessao ausente.' };
  }

  const admin = adminClient();
  const { data: authData, error: authError } = await admin.auth.getUser(token);

  if (authError || !authData?.user) {
    return { ok: false, status: 401, erro: 'Sessao invalida.' };
  }

  const { data: perfil, error: perfilError } = await admin
    .from('usuarios')
    .select('id,nome,casa_id')
    .eq('auth_id', authData.user.id)
    .single();

  if (perfilError || !perfil) {
    return { ok: false, status: 403, erro: 'Perfil do LifeOS nao encontrado.' };
  }

  return { ok: true, admin, perfil };
}

function nomeSeguro(valor, tipo) {
  const extensao = tipo === 'application/pdf' ? '.pdf'
    : tipo === 'image/png' ? '.png'
      : '.jpg';

  const base = String(valor || 'comprovante')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140)
    .replace(/\.(pdf|png|jpg|jpeg)$/i, '');

  return (base || 'comprovante') + extensao;
}

function nomeRecebido(req) {
  const valor = String(req.get('x-lifeos-arquivo') || '').trim();
  if (!valor) return '';

  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

function dinheiro(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function dataBr(valor) {
  if (!valor) return 'Nao informado';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor);
  return data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function pdfEscape(valor) {
  return String(valor ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\xFF]/g, ' ');
}

function pdfCor([r, g, b]) {
  return [r, g, b].map(v => Number(v).toFixed(3)).join(' ');
}

function pdfTexto(x, y, tamanho, texto, negrito = false, cor = [0.11, 0.20, 0.16]) {
  return [
    'BT',
    pdfCor(cor) + ' rg',
    '/' + (negrito ? 'F2' : 'F1') + ' ' + tamanho + ' Tf',
    '1 0 0 1 ' + x + ' ' + y + ' Tm',
    '(' + pdfEscape(texto) + ') Tj',
    'ET',
  ].join('\n');
}

function pdfLinha(x1, y1, x2, y2, cor = [0.84, 0.86, 0.84], largura = 1) {
  return [
    pdfCor(cor) + ' RG',
    largura + ' w',
    x1 + ' ' + y1 + ' m',
    x2 + ' ' + y2 + ' l',
    'S',
  ].join('\n');
}

function pdfRetangulo(x, y, w, h, cor = [0.84, 0.86, 0.84], raioIgnorado = 0) {
  return [
    pdfCor(cor) + ' RG',
    '1 w',
    x + ' ' + y + ' ' + w + ' ' + h + ' re',
    'S',
  ].join('\n');
}

function quebrarTexto(texto, maxChars = 70) {
  const palavras = String(texto || '').split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = '';

  for (const palavra of palavras) {
    const candidata = atual ? atual + ' ' + palavra : palavra;
    if (candidata.length > maxChars && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = candidata;
    }
  }

  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [''];
}

function construirPdfPaginas(streams) {
  const objetos = [
    null,
    '<< /Type /Pages /Kids [' + streams.map((_, i) => (5 + i * 2) + ' 0 R').join(' ') + '] /Count ' + streams.length + ' >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];

  streams.forEach((stream, indice) => {
    const pageId = 5 + indice * 2;
    const contentId = pageId + 1;
    objetos[pageId - 1] =
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + contentId + ' 0 R >>';
    objetos[contentId - 1] =
      '<< /Length ' + Buffer.byteLength(stream, 'latin1') + ' >>\nstream\n' + stream + '\nendstream';
  });

  objetos[0] = '<< /Type /Catalog /Pages 2 0 R >>';

  const partes = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  const offsets = [0];
  let tamanho = partes[0].length;

  objetos.forEach((objeto, indice) => {
    offsets.push(tamanho);
    const bloco = Buffer.from((indice + 1) + ' 0 obj\n' + objeto + '\nendobj\n', 'latin1');
    partes.push(bloco);
    tamanho += bloco.length;
  });

  const xrefOffset = tamanho;
  let xref = 'xref\n0 ' + (objetos.length + 1) + '\n';
  xref += '0000000000 65535 f \n';
  offsets.slice(1).forEach(offset => {
    xref += String(offset).padStart(10, '0') + ' 00000 n \n';
  });
  xref += 'trailer\n<< /Size ' + (objetos.length + 1) + ' /Root 1 0 R >>\n';
  xref += 'startxref\n' + xrefOffset + '\n%%EOF\n';
  partes.push(Buffer.from(xref, 'latin1'));

  return Buffer.concat(partes);
}

function gerarPdfReciboLifeOS(documento) {
  const verde = [0.12, 0.38, 0.26];
  const texto = [0.11, 0.20, 0.16];
  const muted = [0.39, 0.45, 0.41];
  const linha = [0.84, 0.86, 0.84];
  const paginas = [];
  let comandos = [];
  let y = 0;
  let paginaNumero = 0;

  const novaPagina = () => {
    if (comandos.length) paginas.push(comandos.join('\n'));
    comandos = [];
    paginaNumero += 1;
    y = 790;

    // Marca vetorial simples, segura para PDF e coerente com o LifeOS.
    comandos.push(pdfCor(verde) + ' rg');
    comandos.push('56 796 m 62 808 l 68 796 l 80 790 l 68 784 l 62 772 l 56 784 l 44 790 l h f');
    comandos.push(pdfTexto(88, 794, 19, 'LifeOS', true, texto));
    comandos.push(pdfTexto(152, 797, 8, 'by GhuMat', true, muted));
    comandos.push(pdfTexto(44, 754, 10, paginaNumero === 1 ? 'RECIBO DE PAGAMENTO' : 'RECIBO DE PAGAMENTO - CONTINUACAO', true, verde));
    comandos.push(pdfLinha(44, 742, 551, 742, linha));
    y = 718;
  };

  const garantir = (altura) => {
    if (y - altura < 62) novaPagina();
  };

  const textoQuebrado = (valor, x, tamanho = 10, negrito = false, cor = texto, maxChars = 72, passo = 14) => {
    const linhas = quebrarTexto(valor, maxChars);
    linhas.forEach(l => {
      garantir(passo + 2);
      comandos.push(pdfTexto(x, y, tamanho, l, negrito, cor));
      y -= passo;
    });
  };

  novaPagina();

  textoQuebrado(documento.titulo || 'Pagamento confirmado', 44, 18, true, texto, 48, 22);
  textoQuebrado(
    (documento.pagador || 'Pagador') + ' -> ' + (documento.recebedor || 'Recebedor'),
    44, 10, false, muted, 72, 14
  );
  y -= 8;

  const resumo = [
    ['Pix recebido', dinheiro(documento.valor_transferencia)],
    ['Aplicado nas cobrancas', dinheiro(documento.valor_utilizado)],
    ['Saldo a favor', dinheiro(documento.valor_excedente)],
    ['Ainda em aberto', dinheiro(documento.valor_faltante)],
  ];

  garantir(84);
  comandos.push(pdfRetangulo(44, y - 68, 507, 70, linha));
  resumo.forEach((item, indice) => {
    const col = indice % 2;
    const row = Math.floor(indice / 2);
    const x = 58 + col * 246;
    const yy = y - 18 - row * 32;
    comandos.push(pdfTexto(x, yy + 8, 8, item[0].toUpperCase(), true, muted));
    comandos.push(pdfTexto(x, yy - 5, 12, item[1], true, texto));
  });
  y -= 92;

  comandos.push(pdfTexto(44, y, 10, 'COBRANCAS INCLUIDAS', true, verde));
  y -= 18;

  for (const item of documento.itens || []) {
    const tituloLinhas = quebrarTexto(item.titulo || 'Cobranca', 58);
    const altura = 44 + Math.max(0, tituloLinhas.length - 1) * 12;
    garantir(altura + 10);

    tituloLinhas.forEach((linhaTitulo, idx) => {
      comandos.push(pdfTexto(44, y - idx * 12, 10.5, linhaTitulo, idx === 0, texto));
    });
    y -= tituloLinhas.length * 12 + 4;
    comandos.push(pdfTexto(
      44, y, 8.5,
      'Saldo antes: ' + dinheiro(item.saldo_antes) +
      '   |   Aplicado: ' + dinheiro(item.valor_alocado) +
      '   |   Saldo depois: ' + dinheiro(item.saldo_depois),
      false, muted
    ));
    y -= 13;
    comandos.push(pdfLinha(44, y, 551, y, linha));
    y -= 14;
  }

  garantir(130);
  comandos.push(pdfTexto(44, y, 10, 'DADOS DO PAGAMENTO', true, verde));
  y -= 20;
  const detalhes = [
    'Data do envio: ' + (documento.enviado_em || 'Nao informada'),
    'Confirmado em: ' + (documento.revisado_em || 'Nao informada'),
    'Valor identificado no comprovante: ' + (documento.valor_extraido != null ? dinheiro(documento.valor_extraido) : 'Nao identificado automaticamente'),
    'ID LifeOS: ' + (documento.id || 'Nao informado'),
  ];
  detalhes.forEach(detalhe => {
    textoQuebrado(detalhe, 44, 9, false, muted, 85, 13);
  });

  y -= 10;
  garantir(58);
  comandos.push(pdfLinha(44, y, 551, y, linha));
  y -= 18;
  textoQuebrado(
    'Documento interno do LifeOS. Nao substitui o comprovante bancario original, que permanece arquivado no sistema.',
    44, 8.5, false, muted, 92, 12
  );

  paginas.push(comandos.join('\n'));
  return construirPdfPaginas(paginas);
}

async function segredoServidor(admin, nome) {
  const { data, error } = await admin.rpc('lifeos_obter_segredo_servidor', {
    p_nome: nome,
  });

  if (error || !data) {
    throw new Error('Segredo da integracao nao disponivel.');
  }

  return String(data);
}

async function arquivarDespesaNoNordestrip(admin, expenseId) {
  const token = await segredoServidor(admin, 'nordestrip_reverse_bridge_token');
  const response = await fetch(
    'https://nordestrip.vercel.app/api/integrations/lifeos/expenses/archive',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expenseId }),
      signal: AbortSignal.timeout(12000),
    }
  );

  let body = null;
  try {
    body = await response.json();
  } catch {}

  if (!response.ok) {
    const erro = body?.error || 'O Nordestrip nao confirmou o arquivamento.';
    const e = new Error(erro);
    e.status = response.status;
    throw e;
  }

  return body?.result || null;
}

async function carregarPagamento(admin, pagamentoId) {
  const { data: pagamento, error } = await admin
    .from('acerto_pagamentos')
    .select('id,casa_id,acerto_id,enviado_por,valor_informado,valor_extraido,pago_em_extraido,arquivo_nome,arquivo_tipo,comprovante_path,dados_extraidos,status,revisado_por,revisado_em,motivo_recusa,enviado_em')
    .eq('id', pagamentoId)
    .single();

  if (error || !pagamento) return null;

  const { data: acerto } = await admin
    .from('acertos')
    .select('id,casa_id,titulo,devedor_id,credor_id,competencia,parcela_numero,parcelas_total,valor_devido,valor_pago,vencimento,status')
    .eq('id', pagamento.acerto_id)
    .single();

  if (!acerto) return null;
  return { pagamento, acerto };
}

async function carregarLote(admin, loteId) {
  const { data: lote, error } = await admin
    .from('acerto_pagamento_lotes')
    .select('*')
    .eq('id', loteId)
    .single();

  if (error || !lote) return null;

  const { data: itens, error: itensError } = await admin
    .from('acerto_pagamento_itens')
    .select('*')
    .eq('lote_id', lote.id)
    .order('ordem');

  if (itensError) return null;

  const acertoIds = [...new Set((itens || []).map(item => item.acerto_id))];
  const { data: acertos } = acertoIds.length
    ? await admin
      .from('acertos')
      .select('id,titulo,devedor_id,credor_id,competencia,parcela_numero,parcelas_total,valor_devido,valor_pago,vencimento,status')
      .in('id', acertoIds)
    : { data: [] };

  const mapa = new Map((acertos || []).map(acerto => [acerto.id, acerto]));
  return {
    lote,
    itens: (itens || []).map(item => ({ ...item, acerto: mapa.get(item.acerto_id) || null })),
  };
}


function valorExtraidoSeguro(valor) {
  return valor !== null && valor !== undefined && valor !== ''
    && Number.isFinite(Number(valor))
    && Number(valor) > 0;
}

export function registrarRotasAcertos(app) {
  const receberArquivo = express.raw({
    type: ['application/pdf', 'image/png', 'image/jpeg', 'application/octet-stream'],
    limit: LIMITE,
  });

  app.delete('/api/acertos/:id', async (req, res) => {
    const contexto = await contextoAutenticado(req);
    if (!contexto.ok) return res.status(contexto.status).json({ ok: false, erro: contexto.erro });

    const { admin, perfil } = contexto;

    const { data: acerto, error: erroAcerto } = await admin
      .from('acertos')
      .select('id,casa_id,despesa_id,titulo,devedor_id,credor_id,valor_pago,status,origem,origem_externa_id,criado_por')
      .eq('id', req.params.id)
      .single();

    if (erroAcerto || !acerto || acerto.casa_id !== perfil.casa_id) {
      return res.status(404).json({ ok: false, erro: 'Acerto nao encontrado.' });
    }

    const podeExcluir = acerto.credor_id === perfil.id || acerto.criado_por === perfil.id;
    if (!podeExcluir) {
      return res.status(403).json({
        ok: false,
        erro: 'Somente quem criou ou vai receber este acerto pode exclui-lo.',
      });
    }

    if (['pago', 'cancelado'].includes(acerto.status)) {
      return res.status(409).json({
        ok: false,
        erro: acerto.status === 'pago'
          ? 'Um acerto pago nao pode ser excluido.'
          : 'Este acerto ja foi excluido.',
      });
    }

    let alvoIds = [acerto.id];
    let despesa = null;

    if (acerto.despesa_id) {
      const [acertosGrupo, despesaResult] = await Promise.all([
        admin
          .from('acertos')
          .select('id,valor_pago,status')
          .eq('despesa_id', acerto.despesa_id),
        admin
          .from('despesas_compartilhadas')
          .select('id,casa_id,origem,origem_externa_id,titulo')
          .eq('id', acerto.despesa_id)
          .maybeSingle(),
      ]);

      if (acertosGrupo.error) {
        return res.status(500).json({ ok: false, erro: 'Nao foi possivel carregar as parcelas deste acerto.' });
      }

      alvoIds = (acertosGrupo.data || []).map(item => item.id);
      despesa = despesaResult.data || null;
    }

    const { data: pagamentos, error: erroPagamentos } = await admin
      .from('acerto_pagamentos')
      .select('id,acerto_id,status')
      .in('acerto_id', alvoIds);

    if (erroPagamentos) {
      return res.status(500).json({ ok: false, erro: 'Nao foi possivel validar o historico de pagamentos.' });
    }

    const { data: valores } = await admin
      .from('acertos')
      .select('id,valor_pago')
      .in('id', alvoIds);

    const temHistorico = (pagamentos || []).length > 0
      || (valores || []).some(item => Number(item.valor_pago || 0) > 0);

    if (temHistorico) {
      return res.status(409).json({
        ok: false,
        erro: 'Este acerto ja possui historico de pagamento. Para preservar comprovantes e recibos, ele nao pode ser excluido.',
      });
    }

    let nordestrip = null;
    const veioDoNordestrip = acerto.origem === 'nordestrip'
      || despesa?.origem === 'nordestrip';

    if (veioDoNordestrip) {
      const externalExpenseId = despesa?.origem_externa_id;
      if (!externalExpenseId) {
        return res.status(409).json({
          ok: false,
          erro: 'Este acerto veio do Nordestrip, mas o vinculo de origem nao foi encontrado.',
        });
      }

      try {
        nordestrip = await arquivarDespesaNoNordestrip(admin, externalExpenseId);
      } catch (e) {
        console.error('[Acertos exclusao Nordestrip]', e.message);
        return res.status(502).json({
          ok: false,
          erro: 'Nao consegui remover a compra no Nordestrip. Nada foi excluido no LifeOS para evitar desencontro entre os dois aplicativos.',
        });
      }
    }

    const agora = new Date().toISOString();
    const motivo = veioDoNordestrip
      ? 'Excluido no LifeOS e arquivado no Nordestrip.'
      : 'Excluido manualmente no LifeOS.';

    const atualizacao = await admin
      .from('acertos')
      .update({
        status: 'cancelado',
        cancelado_em: agora,
        cancelado_por: perfil.id,
        cancelamento_motivo: motivo,
        atualizado_em: agora,
      })
      .in('id', alvoIds)
      .neq('status', 'pago');

    if (atualizacao.error) {
      return res.status(500).json({
        ok: false,
        erro: 'Nao foi possivel excluir o acerto no LifeOS.',
      });
    }

    if (acerto.despesa_id) {
      await admin
        .from('despesas_compartilhadas')
        .update({
          cancelada_em: agora,
          cancelada_por: perfil.id,
          cancelamento_motivo: motivo,
          atualizado_em: agora,
        })
        .eq('id', acerto.despesa_id);
    }

    await admin.from('eventos').insert({
      tipo: 'acerto_excluido',
      entidade: 'acertos',
      entidade_id: acerto.id,
      usuario_id: perfil.id,
      valor_novo: {
        acertos_cancelados: alvoIds,
        despesa_id: acerto.despesa_id,
        origem: veioDoNordestrip ? 'nordestrip' : acerto.origem,
        nordestrip,
      },
      detalhe: motivo,
    });

    return res.json({
      ok: true,
      removidos: alvoIds.length,
      sincronizado_nordestrip: veioDoNordestrip,
    });
  });

  app.post('/api/acertos/pagamentos/lote/comprovante', receberArquivo, async (req, res) => {
    const contexto = await contextoAutenticado(req);
    if (!contexto.ok) return res.status(contexto.status).json({ ok: false, erro: contexto.erro });

    const { admin, perfil } = contexto;
    const valorInformado = Number(String(req.get('x-lifeos-valor') || '').replace(',', '.'));
    const ids = [...new Set(String(req.get('x-lifeos-acertos') || '')
      .split(',')
      .map(item => item.trim())
      .filter(item => /^[0-9a-f-]{36}$/i.test(item)))];

    const tipoRecebido = String(req.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const tipo = tipoRecebido === 'application/octet-stream'
      ? String(req.get('x-lifeos-tipo') || '').trim().toLowerCase()
      : tipoRecebido;

    if (!ids.length || ids.length > 25) {
      return res.status(400).json({ ok: false, erro: 'Selecione ao menos uma cobranca para pagar.' });
    }

    if (!Number.isFinite(valorInformado) || valorInformado <= 0) {
      return res.status(400).json({ ok: false, erro: 'Informe o valor do Pix.' });
    }

    if (!TIPOS.has(tipo)) {
      return res.status(415).json({ ok: false, erro: 'Envie PDF, PNG ou JPG.' });
    }

    if (!Buffer.isBuffer(req.body) || req.body.length < 5) {
      return res.status(400).json({ ok: false, erro: 'Arquivo vazio ou invalido.' });
    }

    const { data: acertos, error: erroAcertos } = await admin
      .from('acertos')
      .select('id,casa_id,titulo,devedor_id,credor_id,valor_devido,valor_pago,status,vencimento')
      .in('id', ids);

    if (erroAcertos || !acertos || acertos.length !== ids.length) {
      return res.status(404).json({ ok: false, erro: 'Uma das cobrancas selecionadas nao foi encontrada.' });
    }

    const porId = new Map(acertos.map(acerto => [acerto.id, acerto]));
    const ordenados = ids.map(id => porId.get(id)).filter(Boolean);
    const credores = new Set(ordenados.map(acerto => acerto.credor_id));

    if (ordenados.some(acerto => acerto.casa_id !== perfil.casa_id || acerto.devedor_id !== perfil.id)) {
      return res.status(403).json({ ok: false, erro: 'Voce so pode pagar cobrancas em que aparece como devedor.' });
    }

    if (credores.size !== 1) {
      return res.status(400).json({ ok: false, erro: 'Selecione cobrancas do mesmo recebedor para usar um unico Pix.' });
    }

    if (ordenados.some(acerto => ['pago','cancelado'].includes(acerto.status))) {
      return res.status(409).json({ ok: false, erro: 'Uma das cobrancas selecionadas nao aceita novos pagamentos.' });
    }

    const { data: pendentesAntigos } = await admin
      .from('acerto_pagamentos')
      .select('acerto_id')
      .in('acerto_id', ids)
      .eq('status', 'aguardando_confirmacao');

    if ((pendentesAntigos || []).length) {
      return res.status(409).json({ ok: false, erro: 'Uma das cobrancas ja possui pagamento aguardando confirmacao.' });
    }

    const { data: itensExistentes } = await admin
      .from('acerto_pagamento_itens')
      .select('acerto_id,lote_id')
      .in('acerto_id', ids);

    const loteIds = [...new Set((itensExistentes || []).map(item => item.lote_id))];
    if (loteIds.length) {
      const { data: lotesPendentes } = await admin
        .from('acerto_pagamento_lotes')
        .select('id')
        .in('id', loteIds)
        .eq('status', 'aguardando_confirmacao');

      if ((lotesPendentes || []).length) {
        return res.status(409).json({ ok: false, erro: 'Uma das cobrancas ja esta em outro Pix aguardando confirmacao.' });
      }
    }

    const itens = ordenados.map((acerto, indice) => {
      const saldo = Math.max(0, Math.round((Number(acerto.valor_devido) - Number(acerto.valor_pago || 0)) * 100) / 100);
      return {
        acerto,
        ordem: indice + 1,
        saldo,
      };
    }).filter(item => item.saldo > 0.005);

    if (!itens.length) {
      return res.status(409).json({ ok: false, erro: 'As cobrancas selecionadas ja estao quitadas.' });
    }

    const valorSelecionado = Math.round(itens.reduce((soma, item) => soma + item.saldo, 0) * 100) / 100;

    let extracao = {
      status: 'manual',
      valor: null,
      pago_em: null,
      codigo: tipo === 'application/pdf' ? null : 'imagem_sem_ocr',
      erro: tipo === 'application/pdf' ? null : 'Imagem armazenada para conferencia humana.',
    };

    if (tipo === 'application/pdf') {
      extracao = await extrairComprovantePdf(req.body);
    }

    const valorExtraido = numeroPositivoOuNull(extracao.valor);
    const loteId = crypto.randomUUID();
    const arquivoNome = nomeSeguro(nomeRecebido(req), tipo);
    const caminho = perfil.casa_id + '/lotes/' + loteId + '/' + arquivoNome;

    const { error: erroUpload } = await admin.storage
      .from(BUCKET)
      .upload(caminho, req.body, {
        contentType: tipo,
        cacheControl: '3600',
        upsert: false,
      });

    if (erroUpload) {
      console.error('[Acertos lote comprovante]', erroUpload.message);
      return res.status(500).json({ ok: false, erro: 'Nao foi possivel guardar o comprovante.' });
    }

    const divergenciaLeitura = valorExtraido !== null
      ? Math.abs(valorExtraido - valorInformado) > 0.01
      : false;
    const valorReferencia = valorExtraido ?? valorInformado;
    const diferencaSelecao = Math.round((valorReferencia - valorSelecionado) * 100) / 100;

    const { data: lote, error: erroLote } = await admin
      .from('acerto_pagamento_lotes')
      .insert({
        id: loteId,
        casa_id: perfil.casa_id,
        devedor_id: perfil.id,
        credor_id: itens[0].acerto.credor_id,
        enviado_por: perfil.id,
        valor_selecionado: valorSelecionado,
        valor_informado: Math.round(valorInformado * 100) / 100,
        valor_extraido: valorExtraido,
        pago_em_extraido: extracao.pago_em || null,
        arquivo_nome: arquivoNome,
        arquivo_tipo: tipo,
        comprovante_path: caminho,
        dados_extraidos: {
          ...extracao,
          divergencia_valor_informado: divergenciaLeitura,
          diferenca_selecao: diferencaSelecao,
        },
        status: 'aguardando_confirmacao',
      })
      .select('*')
      .single();

    if (erroLote || !lote) {
      await admin.storage.from(BUCKET).remove([caminho]);
      console.error('[Acertos lote]', erroLote?.message);
      return res.status(500).json({ ok: false, erro: 'Comprovante guardado, mas o pagamento nao foi registrado.' });
    }

    const { error: erroItens } = await admin
      .from('acerto_pagamento_itens')
      .insert(itens.map(item => ({
        lote_id: lote.id,
        acerto_id: item.acerto.id,
        ordem: item.ordem,
        saldo_antes: item.saldo,
        valor_previsto: item.saldo,
      })));

    if (erroItens) {
      await admin.from('acerto_pagamento_lotes').delete().eq('id', lote.id);
      await admin.storage.from(BUCKET).remove([caminho]);
      console.error('[Acertos lote itens]', erroItens.message);
      return res.status(500).json({ ok: false, erro: 'Nao foi possivel vincular as cobrancas ao pagamento.' });
    }

    await admin.from('notificacoes').insert({
      casa_id: perfil.casa_id,
      usuario_id: lote.credor_id,
      tipo: 'pagamento_aguardando',
      titulo: 'Pix aguardando confirmacao',
      mensagem: perfil.nome + ' enviou um Pix de ' + dinheiro(valorReferencia) +
        ' para ' + itens.length + (itens.length === 1 ? ' cobranca.' : ' cobrancas.'),
      entidade: 'acerto_pagamento_lotes',
      entidade_id: lote.id,
    });

    await admin.from('eventos').insert({
      tipo: 'comprovante_lote_enviado',
      entidade: 'acerto_pagamento_lotes',
      entidade_id: lote.id,
      usuario_id: perfil.id,
      valor_novo: {
        acertos: itens.map(item => item.acerto.id),
        valor_selecionado: valorSelecionado,
        valor_informado: valorInformado,
        valor_extraido: valorExtraido,
        diferenca_selecao: diferencaSelecao,
      },
      detalhe: 'Comprovante unico enviado para multiplos acertos; pagamento aguarda confirmacao.',
    });

    return res.json({
      ok: true,
      lote: {
        id: lote.id,
        status: lote.status,
        valor_selecionado: lote.valor_selecionado,
        valor_informado: lote.valor_informado,
        valor_extraido: lote.valor_extraido,
      },
      leitura: {
        status: extracao.status,
        valor_extraido: valorExtraido,
        divergencia_valor_informado: divergenciaLeitura,
        diferenca_selecao: diferencaSelecao,
        observacao: tipo === 'application/pdf'
          ? 'PDF lido localmente, sem IA.'
          : 'Imagem guardada para conferencia; o valor informado sera validado pelo recebedor.',
      },
    });
  });

  app.get('/api/acertos/lotes/:id/comprovante', async (req, res) => {
    const contexto = await contextoAutenticado(req);
    if (!contexto.ok) return res.status(contexto.status).json({ ok: false, erro: contexto.erro });

    const registro = await carregarLote(contexto.admin, req.params.id);
    if (!registro || registro.lote.casa_id !== contexto.perfil.casa_id) {
      return res.status(404).json({ ok: false, erro: 'Comprovante nao encontrado.' });
    }

    if (!registro.lote.comprovante_path) {
      return res.status(404).json({ ok: false, erro: 'Este pagamento nao possui arquivo.' });
    }

    const { data: arquivo, error } = await contexto.admin.storage
      .from(BUCKET)
      .download(registro.lote.comprovante_path);

    if (error || !arquivo) {
      return res.status(404).json({ ok: false, erro: 'Arquivo nao encontrado.' });
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    res.setHeader('Content-Type', registro.lote.arquivo_tipo || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline; filename="' + (registro.lote.arquivo_nome || 'comprovante') + '"');
    return res.send(buffer);
  });

  app.get('/api/acertos/lotes/:id/recibo', async (req, res) => {
    const contexto = await contextoAutenticado(req);
    if (!contexto.ok) return res.status(contexto.status).json({ ok: false, erro: contexto.erro });

    const registro = await carregarLote(contexto.admin, req.params.id);
    if (!registro || registro.lote.casa_id !== contexto.perfil.casa_id) {
      return res.status(404).json({ ok: false, erro: 'Pagamento nao encontrado.' });
    }

    if (registro.lote.status !== 'aprovado') {
      return res.status(409).json({ ok: false, erro: 'O recibo so existe depois da confirmacao do recebedor.' });
    }

    const { data: pessoas } = await contexto.admin
      .from('usuarios')
      .select('id,nome')
      .in('id', [registro.lote.devedor_id, registro.lote.credor_id]);

    const nomes = new Map((pessoas || []).map(pessoa => [pessoa.id, pessoa.nome]));
    const aplicado = registro.itens.reduce((soma, item) => soma + Number(item.valor_aplicado || 0), 0);
    const falta = registro.itens.reduce((soma, item) => soma + Number(item.saldo_depois || 0), 0);

    const pdf = gerarReciboPdf({
      titulo: 'Recibo de pagamento',
      subtitulo: 'Acertos da Casa - Pix confirmado',
      campos: [
        { label: 'Pagador', valor: nomes.get(registro.lote.devedor_id) || 'Nao identificado' },
        { label: 'Recebedor', valor: nomes.get(registro.lote.credor_id) || 'Nao identificado' },
        { label: 'Valor do Pix confirmado', valor: dinheiro(registro.lote.valor_confirmado) },
        { label: 'Confirmado em', valor: dataBr(registro.lote.revisado_em) },
        { label: 'Total selecionado', valor: dinheiro(registro.lote.valor_selecionado) },
        { label: 'Data identificada no comprovante', valor: dataBr(registro.lote.pago_em_extraido) },
      ],
      itens: registro.itens.map(item => ({
        titulo: item.acerto?.titulo || 'Cobranca',
        valorAplicado: item.valor_aplicado,
        saldoDepois: item.saldo_depois,
      })),
      resumo: [
        { label: 'Aplicado nas cobrancas', valor: dinheiro(aplicado) },
        { label: 'Ainda em aberto nas selecionadas', valor: dinheiro(falta) },
        { label: 'Saldo a favor gerado', valor: dinheiro(registro.lote.saldo_gerado) },
      ],
      id: registro.lote.id,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="recibo-lifeos-' + registro.lote.id + '.pdf"');
    return res.send(pdf);
  });

  app.post('/api/acertos/:id/comprovante', receberArquivo, async (req, res) => {
    const contexto = await contextoAutenticado(req);
    if (!contexto.ok) return res.status(contexto.status).json({ ok: false, erro: contexto.erro });

    const { admin, perfil } = contexto;
    const valor = Number(String(req.get('x-lifeos-valor') || '').replace(',', '.'));
    const tipoRecebido = String(req.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const tipo = tipoRecebido === 'application/octet-stream'
      ? String(req.get('x-lifeos-tipo') || '').trim().toLowerCase()
      : tipoRecebido;

    if (!Number.isFinite(valor) || valor <= 0) {
      return res.status(400).json({ ok: false, erro: 'Informe o valor pago.' });
    }

    if (!TIPOS.has(tipo)) {
      return res.status(415).json({ ok: false, erro: 'Envie PDF, PNG ou JPG.' });
    }

    if (!Buffer.isBuffer(req.body) || req.body.length < 5) {
      return res.status(400).json({ ok: false, erro: 'Arquivo vazio ou invalido.' });
    }

    const { data: acerto, error: erroAcerto } = await admin
      .from('acertos')
      .select('id,casa_id,titulo,devedor_id,credor_id,valor_devido,valor_pago,status')
      .eq('id', req.params.id)
      .single();

    if (erroAcerto || !acerto || acerto.casa_id !== perfil.casa_id) {
      return res.status(404).json({ ok: false, erro: 'Acerto nao encontrado.' });
    }

    if (acerto.devedor_id !== perfil.id) {
      return res.status(403).json({ ok: false, erro: 'Somente quem deve pode enviar o comprovante.' });
    }

    if (['pago', 'cancelado'].includes(acerto.status)) {
      return res.status(409).json({ ok: false, erro: 'Este acerto nao aceita novos pagamentos.' });
    }

    const { data: aguardando } = await admin
      .from('acerto_pagamentos')
      .select('valor_informado')
      .eq('acerto_id', acerto.id)
      .eq('status', 'aguardando_confirmacao');

    const valorAguardando = (aguardando || [])
      .reduce((soma, item) => soma + Number(item.valor_informado || 0), 0);

    const restante = Number(acerto.valor_devido) - Number(acerto.valor_pago || 0) - valorAguardando;
    if (valor > restante + 0.01) {
      return res.status(409).json({
        ok: false,
        erro: 'O valor informado ultrapassa o saldo ainda disponivel deste acerto.',
      });
    }

    let extracao = {
      status: 'manual',
      valor: null,
      pago_em: null,
      codigo: tipo === 'application/pdf' ? null : 'imagem_sem_ocr',
      erro: tipo === 'application/pdf' ? null : 'Imagem armazenada para conferencia humana.',
    };

    if (tipo === 'application/pdf') {
      extracao = await extrairComprovantePdf(req.body);
    }

    const pagamentoId = crypto.randomUUID();
    const arquivoNome = nomeSeguro(nomeRecebido(req), tipo);
    const caminho = perfil.casa_id + '/' + acerto.id + '/' + pagamentoId + '/' + arquivoNome;

    const { error: erroUpload } = await admin.storage
      .from(BUCKET)
      .upload(caminho, req.body, {
        contentType: tipo,
        cacheControl: '3600',
        upsert: false,
      });

    if (erroUpload) {
      console.error('[Acertos comprovante]', erroUpload.message);
      return res.status(500).json({ ok: false, erro: 'Nao foi possivel guardar o comprovante.' });
    }

    const valorExtraido = numeroPositivoOuNull(extracao.valor);
    const divergenciaValor = valorExtraido !== null
      ? Math.abs(valorExtraido - valor) > 0.01
      : false;

    const { data: pagamento, error: erroPagamento } = await admin
      .from('acerto_pagamentos')
      .insert({
        id: pagamentoId,
        casa_id: acerto.casa_id,
        acerto_id: acerto.id,
        enviado_por: perfil.id,
        valor_informado: valor,
        valor_extraido: valorExtraido,
        pago_em_extraido: extracao.pago_em || null,
        arquivo_nome: arquivoNome,
        arquivo_tipo: tipo,
        comprovante_path: caminho,
        dados_extraidos: {
          ...extracao,
          divergencia_valor: divergenciaValor,
        },
        status: 'aguardando_confirmacao',
      })
      .select('id,status,valor_informado,valor_extraido,pago_em_extraido,dados_extraidos')
      .single();

    if (erroPagamento) {
      await admin.storage.from(BUCKET).remove([caminho]);
      console.error('[Acertos pagamento]', erroPagamento.message);
      return res.status(500).json({ ok: false, erro: 'Comprovante guardado, mas pagamento nao foi registrado.' });
    }

    await admin.from('notificacoes').insert({
      casa_id: acerto.casa_id,
      usuario_id: acerto.credor_id,
      tipo: 'pagamento_aguardando',
      titulo: 'Pagamento aguardando confirmacao',
      mensagem: perfil.nome + ' informou um pagamento de ' + dinheiro(valor) + ' para ' + acerto.titulo + '.',
      entidade: 'acerto_pagamentos',
      entidade_id: pagamento.id,
    });

    await admin.from('eventos').insert({
      tipo: 'comprovante_acerto_enviado',
      entidade: 'acerto_pagamentos',
      entidade_id: pagamento.id,
      usuario_id: perfil.id,
      valor_novo: {
        acerto_id: acerto.id,
        valor_informado: valor,
        valor_extraido: pagamento.valor_extraido,
        divergencia_valor: divergenciaValor,
      },
      detalhe: 'Comprovante enviado; pagamento aguarda confirmacao do recebedor.',
    });

    return res.json({
      ok: true,
      pagamento,
      leitura: {
        status: extracao.status,
        divergencia_valor: divergenciaValor,
        observacao: tipo === 'application/pdf'
          ? 'PDF lido localmente, sem IA.'
          : 'Imagem guardada para conferencia; OCR ainda nao e usado.',
      },
    });
  });

  app.get('/api/acertos/pagamentos/:id/comprovante', async (req, res) => {
    const contexto = await contextoAutenticado(req);
    if (!contexto.ok) return res.status(contexto.status).json({ ok: false, erro: contexto.erro });

    const registro = await carregarPagamento(contexto.admin, req.params.id);
    if (!registro || registro.acerto.casa_id !== contexto.perfil.casa_id) {
      return res.status(404).json({ ok: false, erro: 'Comprovante nao encontrado.' });
    }

    if (!registro.pagamento.comprovante_path) {
      return res.status(404).json({ ok: false, erro: 'Este pagamento nao possui arquivo.' });
    }

    const { data: arquivo, error } = await contexto.admin.storage
      .from(BUCKET)
      .download(registro.pagamento.comprovante_path);

    if (error || !arquivo) {
      return res.status(404).json({ ok: false, erro: 'Arquivo nao encontrado.' });
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    res.setHeader('Content-Type', registro.pagamento.arquivo_tipo || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline; filename="' + (registro.pagamento.arquivo_nome || 'comprovante') + '"');
    return res.send(buffer);
  });

  app.get('/api/acertos/pagamentos/:id/recibo', async (req, res) => {
    const contexto = await contextoAutenticado(req);
    if (!contexto.ok) return res.status(contexto.status).json({ ok: false, erro: contexto.erro });

    const registro = await carregarPagamento(contexto.admin, req.params.id);
    if (!registro || registro.acerto.casa_id !== contexto.perfil.casa_id) {
      return res.status(404).json({ ok: false, erro: 'Pagamento nao encontrado.' });
    }

    if (registro.pagamento.status !== 'aprovado') {
      return res.status(409).json({ ok: false, erro: 'O recibo so existe depois da confirmacao do recebedor.' });
    }

    const ids = [registro.acerto.devedor_id, registro.acerto.credor_id];
    const { data: pessoas } = await contexto.admin
      .from('usuarios')
      .select('id,nome')
      .in('id', ids);

    const nomes = new Map((pessoas || []).map(pessoa => [pessoa.id, pessoa.nome]));
    const saldoDepois = Math.max(0, Number(registro.acerto.valor_devido) - Number(registro.acerto.valor_pago || 0));
    const pdf = gerarReciboPdf({
      titulo: 'Recibo de pagamento',
      subtitulo: 'Acertos da Casa - pagamento confirmado',
      campos: [
        { label: 'Pagador', valor: nomes.get(registro.acerto.devedor_id) || 'Nao identificado' },
        { label: 'Recebedor', valor: nomes.get(registro.acerto.credor_id) || 'Nao identificado' },
        { label: 'Valor confirmado', valor: dinheiro(registro.pagamento.valor_informado) },
        { label: 'Confirmado em', valor: dataBr(registro.pagamento.revisado_em) },
        { label: 'Competencia', valor: dataBr(registro.acerto.competencia) },
        { label: 'Parcela', valor: registro.acerto.parcela_numero + '/' + registro.acerto.parcelas_total },
      ],
      itens: [{
        titulo: registro.acerto.titulo,
        valorAplicado: registro.pagamento.valor_informado,
        saldoDepois,
      }],
      resumo: [
        { label: 'Valor deste pagamento', valor: dinheiro(registro.pagamento.valor_informado) },
        { label: 'Saldo restante do acerto', valor: dinheiro(saldoDepois) },
      ],
      id: registro.pagamento.id,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="recibo-lifeos-' + registro.pagamento.id + '.pdf"');
    return res.send(pdf);
  });
}
