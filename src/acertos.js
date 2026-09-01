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

function gerarPdfSimples(linhas) {
  const comandos = [
    'BT',
    '/F1 18 Tf',
    '52 792 Td',
    '(' + pdfEscape('LifeOS by GhuMat') + ') Tj',
    '0 -28 Td',
    '/F1 12 Tf',
    '(' + pdfEscape('Recibo interno de pagamento') + ') Tj',
    '0 -28 Td',
    '/F1 10 Tf',
  ];

  linhas.forEach((linha, indice) => {
    if (indice > 0) comandos.push('0 -19 Td');
    comandos.push('(' + pdfEscape(linha) + ') Tj');
  });

  comandos.push('ET');
  const stream = comandos.join('\n');

  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Length ' + Buffer.byteLength(stream, 'latin1') + ' >>\nstream\n' + stream + '\nendstream',
  ];

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

    const divergenciaValor = Number.isFinite(Number(extracao.valor))
      ? Math.abs(Number(extracao.valor) - valor) > 0.01
      : false;

    const { data: pagamento, error: erroPagamento } = await admin
      .from('acerto_pagamentos')
      .insert({
        id: pagamentoId,
        casa_id: acerto.casa_id,
        acerto_id: acerto.id,
        enviado_por: perfil.id,
        valor_informado: valor,
        valor_extraido: Number.isFinite(Number(extracao.valor)) ? Number(extracao.valor) : null,
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
    const linhas = [
      'Documento interno do LifeOS. Nao e comprovante bancario.',
      '',
      'Acerto: ' + registro.acerto.titulo,
      'Pagador: ' + (nomes.get(registro.acerto.devedor_id) || 'Nao identificado'),
      'Recebedor: ' + (nomes.get(registro.acerto.credor_id) || 'Nao identificado'),
      'Valor confirmado: ' + dinheiro(registro.pagamento.valor_informado),
      'Data do envio: ' + dataBr(registro.pagamento.enviado_em),
      'Confirmado em: ' + dataBr(registro.pagamento.revisado_em),
      'Competencia: ' + dataBr(registro.acerto.competencia),
      'Parcela: ' + registro.acerto.parcela_numero + '/' + registro.acerto.parcelas_total,
      'ID LifeOS: ' + registro.pagamento.id,
      '',
      'O comprovante bancario original permanece arquivado no LifeOS.',
    ];

    const pdf = gerarPdfSimples(linhas);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="recibo-lifeos-' + registro.pagamento.id + '.pdf"');
    return res.send(pdf);
  });
}
