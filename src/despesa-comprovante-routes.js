import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { extrairSugestoesDespesaPdf, extrairSugestoesDespesaTexto } from './despesa-comprovante.js';

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
  const header = String(req.get('authorization') || '');
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, erro: 'Sessao ausente.' };

  const admin = adminClient();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData?.user) return { ok: false, status: 401, erro: 'Sessao invalida.' };

  const { data: perfil, error: profileError } = await admin
    .from('usuarios')
    .select('id,nome,casa_id')
    .eq('auth_id', authData.user.id)
    .single();
  if (profileError || !perfil) return { ok: false, status: 403, erro: 'Perfil do LifeOS nao encontrado.' };
  return { ok: true, admin, perfil };
}

function nomeSeguro(value, type) {
  const extension = type === 'application/pdf' ? '.pdf' : type === 'image/png' ? '.png' : '.jpg';
  const base = String(value || 'comprovante')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140)
    .replace(/\.(pdf|png|jpg|jpeg)$/i, '');
  return (base || 'comprovante') + extension;
}

function nomeRecebido(req) {
  const value = String(req.get('x-lifeos-arquivo') || '').trim();
  if (!value) return '';
  try { return decodeURIComponent(value); } catch { return value; }
}

function dadosRecebidos(req) {
  const encoded = String(req.get('x-lifeos-dados-b64') || '').trim();
  if (!encoded || encoded.length > 6000) return {};
  try {
    const normal = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normal + '='.repeat((4 - normal.length % 4) % 4);
    const parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function carregarDespesa(admin, id, casaId) {
  const { data, error } = await admin
    .from('despesas_compartilhadas')
    .select('id,casa_id,titulo,comprovante_path,comprovante_nome,comprovante_tipo,comprovante_dados')
    .eq('id', id)
    .eq('casa_id', casaId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export function registrarRotasDespesaComprovante(app) {
  app.post('/api/acertos/despesas/analisar-texto', async (req, res) => {
    const ctx = await contextoAutenticado(req);
    if (!ctx.ok) return res.status(ctx.status).json({ ok: false, erro: ctx.erro });
    const text = String(req.body?.texto || '').slice(0, 100000);
    if (!text.trim()) return res.status(400).json({ ok: false, erro: 'Texto do comprovante vazio.' });
    return res.json({ ok: true, sugestoes: extrairSugestoesDespesaTexto(text) });
  });

  const receberPdf = express.raw({ type: ['application/pdf', 'application/octet-stream'], limit: LIMITE });
  app.post('/api/acertos/despesas/analisar-pdf', receberPdf, async (req, res) => {
    const ctx = await contextoAutenticado(req);
    if (!ctx.ok) return res.status(ctx.status).json({ ok: false, erro: ctx.erro });
    if (!Buffer.isBuffer(req.body) || req.body.length < 5 || req.body.length > LIMITE) {
      return res.status(400).json({ ok: false, erro: 'PDF vazio ou invalido.' });
    }
    if (req.body.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return res.status(415).json({ ok: false, erro: 'O arquivo nao e um PDF valido.' });
    }
    const sugestoes = await extrairSugestoesDespesaPdf(req.body);
    return res.json({ ok: true, sugestoes });
  });

  const receberArquivo = express.raw({
    type: ['application/pdf', 'application/octet-stream', 'image/png', 'image/jpeg'],
    limit: LIMITE,
  });
  app.post('/api/acertos/despesas/:id/comprovante', receberArquivo, async (req, res) => {
    const ctx = await contextoAutenticado(req);
    if (!ctx.ok) return res.status(ctx.status).json({ ok: false, erro: ctx.erro });

    const typeHeader = String(req.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const originalName = nomeRecebido(req);
    let type = typeHeader;
    if (type === 'application/octet-stream' && /\.pdf$/i.test(originalName)) type = 'application/pdf';
    if (!TIPOS.has(type)) return res.status(415).json({ ok: false, erro: 'Envie PDF, PNG ou JPG.' });
    if (!Buffer.isBuffer(req.body) || req.body.length < 5) return res.status(400).json({ ok: false, erro: 'Arquivo vazio ou invalido.' });

    let expense;
    try {
      expense = await carregarDespesa(ctx.admin, req.params.id, ctx.perfil.casa_id);
    } catch (error) {
      console.error('[Despesa comprovante]', error.message);
      return res.status(500).json({ ok: false, erro: 'Nao foi possivel consultar a despesa.' });
    }
    if (!expense) return res.status(404).json({ ok: false, erro: 'Despesa nao encontrada nesta Casa.' });

    const safeName = nomeSeguro(originalName, type);
    const path = `${ctx.perfil.casa_id}/despesas/${expense.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await ctx.admin.storage
      .from(BUCKET)
      .upload(path, req.body, { contentType: type, cacheControl: '3600', upsert: false });
    if (uploadError) {
      console.error('[Despesa comprovante]', uploadError.message);
      return res.status(500).json({ ok: false, erro: 'Nao foi possivel guardar o comprovante.' });
    }

    const clientData = dadosRecebidos(req);
    const serverData = type === 'application/pdf' ? await extrairSugestoesDespesaPdf(req.body) : {};
    const extracted = { ...clientData, ...serverData, origem: type === 'application/pdf' ? 'pdf_local' : 'ocr_dispositivo' };

    const { error: updateError } = await ctx.admin
      .from('despesas_compartilhadas')
      .update({
        comprovante_path: path,
        comprovante_nome: originalName || safeName,
        comprovante_tipo: type,
        comprovante_dados: extracted,
        comprovante_atualizado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', expense.id)
      .eq('casa_id', ctx.perfil.casa_id);

    if (updateError) {
      await ctx.admin.storage.from(BUCKET).remove([path]);
      console.error('[Despesa comprovante]', updateError.message);
      return res.status(500).json({ ok: false, erro: 'O arquivo foi recebido, mas a despesa nao foi atualizada.' });
    }

    if (expense.comprovante_path && expense.comprovante_path !== path) {
      ctx.admin.storage.from(BUCKET).remove([expense.comprovante_path]).catch(() => {});
    }

    return res.json({ ok: true, path, nome: originalName || safeName, tipo: type, sugestoes: extracted });
  });

  app.get('/api/acertos/despesas/:id/comprovante', async (req, res) => {
    const ctx = await contextoAutenticado(req);
    if (!ctx.ok) return res.status(ctx.status).json({ ok: false, erro: ctx.erro });

    let expense;
    try {
      expense = await carregarDespesa(ctx.admin, req.params.id, ctx.perfil.casa_id);
    } catch (error) {
      console.error('[Despesa comprovante]', error.message);
      return res.status(500).json({ ok: false, erro: 'Nao foi possivel consultar a despesa.' });
    }
    if (!expense?.comprovante_path) return res.status(404).json({ ok: false, erro: 'Esta despesa nao possui comprovante.' });

    const { data: file, error } = await ctx.admin.storage.from(BUCKET).download(expense.comprovante_path);
    if (error || !file) return res.status(404).json({ ok: false, erro: 'Comprovante nao encontrado.' });
    const buffer = Buffer.from(await file.arrayBuffer());
    res.setHeader('Content-Type', expense.comprovante_tipo || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${nomeSeguro(expense.comprovante_nome, expense.comprovante_tipo)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(buffer);
  });
}
