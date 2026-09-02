// ritmo.js — importacao privada de planos pessoais do modulo Ritmo.
// PDFs sao lidos localmente no servidor; o arquivo original nao e persistido.

import express from 'express';
import { CanvasFactory } from 'pdf-parse/worker';
import { PasswordException, PDFParse } from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

const LIMITE_PDF = 12 * 1024 * 1024;
const MAX_TEXTO = 180000;

function adminClient() {
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function contextoAutenticado(req) {
  if (!config.supabaseServiceKey) {
    return { ok: false, status: 503, erro: 'Ritmo nao configurado no servidor.' };
  }

  const cabecalho = String(req.get('authorization') || '');
  const token = cabecalho.toLowerCase().startsWith('bearer ')
    ? cabecalho.slice(7).trim()
    : '';

  if (!token) return { ok: false, status: 401, erro: 'Sessao ausente.' };

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

function normalizar(valor = '') {
  return String(valor)
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXTO);
}

function semAcentos(valor = '') {
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const REFEICOES = [
  ['cafe da manha', 'Café da manhã'],
  ['desjejum', 'Café da manhã'],
  ['lanche da manha', 'Lanche da manhã'],
  ['colacao', 'Lanche da manhã'],
  ['almoco', 'Almoço'],
  ['lanche da tarde', 'Lanche da tarde'],
  ['jantar', 'Jantar'],
  ['ceia', 'Ceia'],
  ['pre treino', 'Pré-treino'],
  ['pos treino', 'Pós-treino'],
];

function tituloRefeicao(linha) {
  const base = semAcentos(linha).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [chave, titulo] of REFEICOES) {
    if (base === chave || base.startsWith(chave + ' ') || base.includes(chave + ':')) return titulo;
  }
  return null;
}

function limparItem(linha) {
  return String(linha || '')
    .replace(/^[-•▪◦*]+\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .trim();
}

function opcoesDaSecao(linhas = []) {
  const limpas = linhas.map(limparItem).filter(Boolean);
  if (!limpas.length) return [];

  const grupos = [];
  let atual = null;

  for (const linha of limpas) {
    const match = semAcentos(linha).match(/^opcao\s*(\d+)?\s*[:\-–]?\s*(.*)$/i);
    if (match) {
      if (atual?.itens?.length) grupos.push(atual);
      atual = {
        titulo: match[1] ? `Opção ${match[1]}` : 'Opção',
        itens: match[2] ? [match[2].trim()] : [],
      };
      continue;
    }

    if (!atual) atual = { titulo: 'Opção principal', itens: [] };
    atual.itens.push(linha);
  }

  if (atual?.itens?.length) grupos.push(atual);
  return grupos;
}

export function estruturarPlanoAlimentar(textoRecebido) {
  const texto = normalizar(textoRecebido);
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
  const secoes = [];
  let atual = null;

  for (const linha of linhas) {
    const titulo = tituloRefeicao(linha);
    if (titulo) {
      if (atual) secoes.push(atual);
      const horario = linha.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)?.[0] || null;
      atual = { nome: titulo, horario, linhas: [] };
      continue;
    }
    if (atual) atual.linhas.push(linha);
  }
  if (atual) secoes.push(atual);

  const refeicoes = secoes.map(secao => ({
    nome: secao.nome,
    horario: secao.horario,
    opcoes: opcoesDaSecao(secao.linhas),
  })).filter(ref => ref.opcoes.length);

  return {
    versao: 1,
    refeicoes,
    caracteres_lidos: texto.length,
    status: refeicoes.length ? 'estruturado' : 'revisao_necessaria',
    observacao: refeicoes.length
      ? 'Plano lido automaticamente. Revise horários, porções e opções antes de usar.'
      : 'O PDF foi lido, mas a estrutura de refeições não ficou clara. Revise o conteúdo manualmente.',
  };
}

async function lerPdf(buffer) {
  let parser;
  try {
    parser = new PDFParse({ data: buffer, CanvasFactory });
    const resultado = await parser.getText({ first: 20 });
    return normalizar(resultado?.text);
  } catch (erro) {
    const protegido = erro instanceof PasswordException || erro?.name === 'PasswordException';
    if (protegido) throw new Error('O PDF está protegido por senha.');
    throw new Error('Não foi possível ler esse PDF.');
  } finally {
    try { await parser?.destroy(); } catch {}
  }
}

function nomeArquivo(req) {
  const valor = String(req.get('x-lifeos-arquivo') || 'plano-alimentar.pdf').trim();
  try { return decodeURIComponent(valor).slice(0, 180); } catch { return valor.slice(0, 180); }
}

export function registrarRotasRitmo(app) {
  app.post(
    '/api/ritmo/importar-plano',
    express.raw({ type: 'application/pdf', limit: LIMITE_PDF }),
    async (req, res) => {
      const contexto = await contextoAutenticado(req);
      if (!contexto.ok) return res.status(contexto.status).json({ ok: false, erro: contexto.erro });

      if (!Buffer.isBuffer(req.body) || !req.body.length) {
        return res.status(400).json({ ok: false, erro: 'Envie um arquivo PDF válido.' });
      }

      try {
        const texto = await lerPdf(req.body);
        const conteudo = estruturarPlanoAlimentar(texto);
        const arquivoNome = nomeArquivo(req);

        const { data, error } = await contexto.admin
          .from('ritmo_planos_alimentares')
          .insert({
            usuario_id: contexto.perfil.id,
            nome: arquivoNome.replace(/\.pdf$/i, '') || 'Plano alimentar',
            origem: 'pdf',
            arquivo_nome: arquivoNome,
            conteudo,
            ativo: true,
          })
          .select('id,nome,origem,arquivo_nome,conteudo,criado_em')
          .single();

        if (error) throw error;

        return res.json({ ok: true, plano: data });
      } catch (erro) {
        return res.status(422).json({
          ok: false,
          erro: String(erro?.message || erro || 'Falha ao importar o plano.').slice(0, 300),
        });
      }
    }
  );
}
