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
    .replace(/\)/g, '\\)');
}

function numeroPositivoOuNull(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function quebrarTexto(valor, limite = 74) {
  const texto = String(valor ?? '').replace(/\s+/g, ' ').trim();
  if (!texto) return [''];
  const palavras = texto.split(' ');
  const linhas = [];
  let atual = '';

  for (const palavra of palavras) {
    const candidata = atual ? atual + ' ' + palavra : palavra;
    if (candidata.length <= limite) {
      atual = candidata;
      continue;
    }
    if (atual) linhas.push(atual);
    atual = palavra;
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [''];
}

function pdfTexto(comandos, x, y, tamanho, fonte, valor, cor = '0.10 0.18 0.14') {
  comandos.push(
    'BT',
    cor + ' rg',
    '/' + fonte + ' ' + tamanho + ' Tf',
    x + ' ' + y + ' Td',
    '(' + pdfEscape(valor) + ') Tj',
    'ET'
  );
}

function pdfLinha(comandos, x1, y1, x2, y2, cor = '0.84 0.86 0.84', largura = 0.7) {
  comandos.push(cor + ' RG', largura + ' w', x1 + ' ' + y1 + ' m', x2 + ' ' + y2 + ' l', 'S');
}

function pdfRetangulo(comandos, x, y, largura, altura, cor = '0.82 0.86 0.83') {
  comandos.push(cor + ' RG', '0.7 w', x + ' ' + y + ' ' + largura + ' ' + altura + ' re', 'S');
}

function pdfMarca(comandos, x, y) {
  comandos.push(
    '0.71 0.49 0.18 rg',
    x + ' ' + (y + 12) + ' m',
    (x + 5) + ' ' + (y + 5) + ' l',
    (x + 12) + ' ' + y + ' l',
    (x + 5) + ' ' + (y - 5) + ' l',
    x + ' ' + (y - 12) + ' l',
    (x - 5) + ' ' + (y - 5) + ' l',
    (x - 12) + ' ' + y + ' l',
    (x - 5) + ' ' + (y + 5) + ' l',
    'h',
    'f'
  );
}

export function gerarReciboPdf({
  titulo = 'Recibo de pagamento',
  subtitulo = 'Acertos da Casa',
  campos = [],
  itens = [],
  resumo = [],
  id = '',
  rodape = 'Documento interno do LifeOS. O comprovante bancario original permanece arquivado no sistema.',
} = {}) {
  const larguraPagina = 595;
  const alturaPagina = 842;
  const margem = 48;
  const paginas = [];
  let comandos = [];
  let y = 0;

  const cabecalho = () => {
    pdfMarca(comandos, margem + 12, alturaPagina - 48);
    pdfTexto(comandos, margem + 34, alturaPagina - 44, 17, 'F2', 'LifeOS', '0.08 0.20 0.15');
    pdfTexto(comandos, margem + 34, alturaPagina - 58, 8.5, 'F1', 'by GhuMat', '0.39 0.47 0.42');
    pdfTexto(comandos, larguraPagina - margem - 86, alturaPagina - 47, 8.5, 'F2', 'CONFIRMADO', '0.12 0.43 0.29');
    pdfLinha(comandos, margem, alturaPagina - 76, larguraPagina - margem, alturaPagina - 76);
    pdfTexto(comandos, margem, alturaPagina - 111, 20, 'F2', titulo, '0.08 0.20 0.15');
    pdfTexto(comandos, margem, alturaPagina - 129, 9.5, 'F1', subtitulo, '0.39 0.47 0.42');
    y = alturaPagina - 162;
  };

  const fecharPagina = () => {
    paginas.push(comandos.join('\n'));
    comandos = [];
  };

  const novaPagina = () => {
    if (comandos.length) fecharPagina();
    cabecalho();
  };

  const garantir = (altura) => {
    if (y - altura < 70) novaPagina();
  };

  novaPagina();

  if (campos.length) {
    garantir(80);
    pdfTexto(comandos, margem, y, 10, 'F2', 'Detalhes do pagamento');
    y -= 18;
    const colunas = 2;
    const larguraColuna = (larguraPagina - (margem * 2) - 18) / colunas;
    for (let i = 0; i < campos.length; i += 2) {
      const par = campos.slice(i, i + 2);
      let alturaLinha = 38;
      const blocos = par.map(campo => {
        const linhas = quebrarTexto(campo.valor, 36);
        alturaLinha = Math.max(alturaLinha, 22 + (linhas.length * 12));
        return { ...campo, linhas };
      });
      garantir(alturaLinha + 10);
      blocos.forEach((campo, indice) => {
        const x = margem + indice * (larguraColuna + 18);
        pdfTexto(comandos, x, y, 8.5, 'F1', campo.label, '0.39 0.47 0.42');
        campo.linhas.forEach((linha, linhaIndice) => {
          pdfTexto(comandos, x, y - 15 - (linhaIndice * 12), 10.5, 'F2', linha);
        });
      });
      y -= alturaLinha;
      pdfLinha(comandos, margem, y + 7, larguraPagina - margem, y + 7, '0.90 0.91 0.90', 0.5);
      y -= 8;
    }
    y -= 8;
  }

  if (itens.length) {
    garantir(62);
    pdfTexto(comandos, margem, y, 10, 'F2', itens.length === 1 ? 'Cobranca contemplada' : 'Cobrancas contempladas');
    y -= 18;

    itens.forEach((item, indice) => {
      const linhasTitulo = quebrarTexto(item.titulo, 58);
      const altura = 38 + Math.max(0, linhasTitulo.length - 1) * 12;
      garantir(altura + 8);

      pdfTexto(comandos, margem, y, 8.5, 'F1', String(indice + 1).padStart(2, '0'), '0.39 0.47 0.42');
      linhasTitulo.forEach((linha, linhaIndice) => {
        pdfTexto(comandos, margem + 28, y - (linhaIndice * 12), 10.5, 'F2', linha);
      });
      const metaY = y - (linhasTitulo.length * 12) - 4;
      const meta = 'Aplicado: ' + dinheiro(item.valorAplicado || 0) +
        '   |   Saldo restante: ' + dinheiro(item.saldoDepois || 0);
      pdfTexto(comandos, margem + 28, metaY, 8.7, 'F1', meta, '0.39 0.47 0.42');
      y = metaY - 16;
      pdfLinha(comandos, margem + 28, y + 6, larguraPagina - margem, y + 6, '0.90 0.91 0.90', 0.5);
      y -= 8;
    });
    y -= 8;
  }

  if (resumo.length) {
    const alturaResumo = 26 + resumo.length * 22;
    garantir(alturaResumo + 18);
    pdfRetangulo(comandos, margem, y - alturaResumo + 10, larguraPagina - (margem * 2), alturaResumo);
    pdfTexto(comandos, margem + 14, y - 8, 10, 'F2', 'Resumo');
    let linhaY = y - 30;
    resumo.forEach(item => {
      pdfTexto(comandos, margem + 14, linhaY, 8.7, 'F1', item.label, '0.39 0.47 0.42');
      pdfTexto(comandos, larguraPagina - margem - 150, linhaY, 10, 'F2', item.valor);
      linhaY -= 22;
    });
    y -= alturaResumo + 8;
  }

  garantir(76);
  y -= 10;
  pdfLinha(comandos, margem, y, larguraPagina - margem, y);
  y -= 18;
  quebrarTexto(rodape, 92).forEach(linha => {
    pdfTexto(comandos, margem, y, 8.2, 'F1', linha, '0.39 0.47 0.42');
    y -= 12;
  });
  if (id) {
    y -= 3;
    pdfTexto(comandos, margem, y, 7.6, 'F1', 'ID LifeOS: ' + id, '0.50 0.56 0.52');
  }

  fecharPagina();

  const objetos = new Map();
  objetos.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objetos.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objetos.set(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  const refsPaginas = [];
  let numeroObjeto = 5;
  paginas.forEach(stream => {
    const paginaObj = numeroObjeto++;
    const conteudoObj = numeroObjeto++;
    refsPaginas.push(paginaObj + ' 0 R');
    objetos.set(
      paginaObj,
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + conteudoObj + ' 0 R >>'
    );
    objetos.set(
      conteudoObj,
      '<< /Length ' + Buffer.byteLength(stream, 'latin1') + ' >>\nstream\n' + stream + '\nendstream'
    );
  });
  objetos.set(2, '<< /Type /Pages /Kids [' + refsPaginas.join(' ') + '] /Count ' + paginas.length + ' >>');

  const maxObjeto = Math.max(...objetos.keys());
  const partes = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  const offsets = Array(maxObjeto + 1).fill(0);
  let tamanho = partes[0].length;

  for (let numero = 1; numero <= maxObjeto; numero += 1) {
    const objeto = objetos.get(numero);
    if (!objeto) throw new Error('Objeto PDF ausente: ' + numero);
    offsets[numero] = tamanho;
    const bloco = Buffer.from(numero + ' 0 obj\n' + objeto + '\nendobj\n', 'latin1');
    partes.push(bloco);
    tamanho += bloco.length;
  }

  const xrefOffset = tamanho;
  let xref = 'xref\n0 ' + (maxObjeto + 1) + '\n';
  xref += '0000000000 65535 f \n';
  for (let numero = 1; numero <= maxObjeto; numero += 1) {
    xref += String(offsets[numero]).padStart(10, '0') + ' 00000 n \n';
  }
  xref += 'trailer\n<< /Size ' + (maxObjeto + 1) + ' /Root 1 0 R >>\n';
  xref += 'startxref\n' + xrefOffset + '\n%%EOF\n';
  partes.push(Buffer.from(xref, 'latin1'));

  return Buffer.concat(partes);
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
