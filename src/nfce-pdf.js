// LifeOS — importação temporária de PDF de NFC-e.
// O PDF é lido pelo próprio backend do LifeOS, não é persistido e não usa IA.

import express from 'express';
import { CanvasFactory } from 'pdf-parse/worker';
import { PDFParse } from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { interpretarNfceTexto } from './nfce-text.js';

const LIMITE = 12 * 1024 * 1024;

function adminClient() {
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function autenticar(req) {
  if (!config.supabaseServiceKey) return { ok: false, status: 503, erro: 'Leitura de NFC-e não configurada.' };
  const cabecalho = String(req.get('authorization') || '');
  const token = cabecalho.toLowerCase().startsWith('bearer ') ? cabecalho.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, erro: 'Sessão ausente.' };
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, erro: 'Sessão inválida.' };
  const { data: perfil, error: perfilError } = await admin
    .from('usuarios')
    .select('id,casa_id')
    .eq('auth_id', data.user.id)
    .single();
  if (perfilError || !perfil) return { ok: false, status: 403, erro: 'Perfil do LifeOS não encontrado.' };
  return { ok: true };
}

async function textoDoPdf(buffer) {
  let parser;
  try {
    parser = new PDFParse({ data: buffer, CanvasFactory });
    const resultado = await parser.getText({ first: 8 });
    return String(resultado?.text || '');
  } finally {
    try { await parser?.destroy(); } catch {}
  }
}

export function registrarRotasNfcePdf(app) {
  const rawPdf = express.raw({
    type: ['application/pdf', 'application/octet-stream'],
    limit: LIMITE,
  });

  app.post('/api/nfce/analisar-pdf', rawPdf, async (req, res) => {
    const auth = await autenticar(req);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, erro: auth.erro });

    if (!Buffer.isBuffer(req.body) || req.body.length < 5 || req.body.length > LIMITE) {
      return res.status(400).json({ ok: false, erro: 'PDF vazio ou inválido.' });
    }
    if (req.body.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return res.status(415).json({ ok: false, erro: 'O arquivo enviado não é um PDF válido.' });
    }

    try {
      const texto = await textoDoPdf(req.body);
      if (!texto.trim()) {
        return res.status(422).json({
          ok: false,
          erro: 'Este PDF não possui texto selecionável. Tente importar um print da nota.',
          codigo: 'NFC_PDF_SEM_TEXTO',
        });
      }
      const nota = interpretarNfceTexto(texto);
      if (!nota.itens.length) {
        return res.status(422).json({
          ok: false,
          erro: 'O PDF tem texto, mas o formato da nota ainda não foi reconhecido.',
          codigo: 'NFC_PDF_FORMATO',
        });
      }
      return res.json({ ok: true, nota, origem: 'pdf_texto' });
    } catch (error) {
      console.error('[NFC-e PDF]', error);
      return res.status(422).json({
        ok: false,
        erro: 'Não foi possível ler o texto deste PDF.',
        codigo: 'NFC_PDF_LEITURA',
      });
    }
  });
}
