// ritmo.js — importacao privada de planos pessoais do modulo Ritmo.
// PDFs sao lidos localmente no servidor; o arquivo original nao e persistido.

import express from 'express';
import { CanvasFactory } from 'pdf-parse/worker';
import { PasswordException, PDFParse } from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

const LIMITE_PDF = 12 * 1024 * 1024;
const MAX_TEXTO = 180000;
const MAX_TEXTO_REVISAO = 8000;

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

// Alguns planos de nutricionistas usam fontes PDF sem mapa ToUnicode correto.
// Nesses arquivos o texto visualmente legivel chega do pdf-parse com os codigos
// dos glifos deslocados. Ex.: "3ODQR DOLPHQWDU" representa "Plano alimentar".
// A transformacao abaixo e deterministica e so e adotada quando o vocabulario
// de alimentacao fica claramente mais coerente que o texto original.
function decodificarGlifosDeslocados(texto = '') {
  let saida = '';
  for (const caractere of String(texto || '')) {
    const codigo = caractere.charCodeAt(0);

    // Newline, carriage return e tab sao estrutura real do texto extraido e nao
    // fazem parte da codificacao da fonte.
    if (codigo === 9 || codigo === 10 || codigo === 13) {
      saida += caractere;
      continue;
    }

    // Nesta familia de fontes, espaco, pontuacao e digitos foram gravados
    // 29 posicoes antes. O ':' usado nos horarios corresponde ao codigo 29.
    if (codigo >= 3 && codigo <= 29) {
      saida += String.fromCharCode(codigo + 29);
      continue;
    }

    // Iniciais maiusculas A–V tambem aparecem 29 posicoes antes ($ ... 9).
    if (codigo >= 36 && codigo <= 57) {
      saida += String.fromCharCode(codigo + 29);
      continue;
    }

    // O restante do alfabeto latino costuma aparecer tres posicoes depois.
    if ((codigo >= 65 && codigo <= 90) || (codigo >= 97 && codigo <= 122)) {
      const base = codigo >= 97 ? 97 : 65;
      saida += String.fromCharCode(base + ((codigo - base - 3 + 26) % 26));
      continue;
    }

    saida += caractere;
  }
  return saida;
}

function normalizarRuidoFonte(valor = '') {
  return semAcentos(valor)
    .toLowerCase()
    .replace(/\bcafb\b/g, 'cafe')
    .replace(/\bmanhz\b/g, 'manha')
    .replace(/\balmoao\b/g, 'almoco')
    .replace(/\bcola[a-z]o\b/g, 'colacao')
    .replace(/\bpr[a-z][ -]?treino\b/g, 'pre treino')
    .replace(/\bpos[ -]?treino\b/g, 'pos treino')
    .replace(/[-–—]+/g, ' ')
    .replace(/[^a-z0-9\s:;|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pontuarTextoPlano(valor = '') {
  const base = normalizarRuidoFonte(valor);
  if (!base) return 0;

  const fortes = [
    'plano alimentar', 'planejamento alimentar', 'cafe da manha', 'almoco',
    'jantar', 'lanche da manha', 'lanche da tarde', 'ceia',
  ];
  const apoio = [
    'nutricionista', 'paciente', 'frango', 'arroz', 'ovo', 'colher',
    'unidade', 'porcao', 'grama', 'opcao',
  ];

  let pontos = 0;
  for (const termo of fortes) if (base.includes(termo)) pontos += 5;
  for (const termo of apoio) if (base.includes(termo)) pontos += 1;
  return pontos;
}

export function decodificarTextoPdfSeNecessario(textoRecebido = '') {
  const original = String(textoRecebido || '');
  const candidato = decodificarGlifosDeslocados(original);
  const pontosOriginal = pontuarTextoPlano(original);
  const pontosCandidato = pontuarTextoPlano(candidato);

  if (pontosCandidato >= 6 && pontosCandidato >= pontosOriginal + 4) {
    return normalizar(candidato);
  }
  return normalizar(original);
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

const CABECALHOS_REFEICAO_RE = /\s+(?=(?:caf(?:e|b)\s+da\s+manh(?:a|z)|desjejum|lanche\s+da\s+manh(?:a|z)|cola[cça-z][aãa-z]o|almo(?:[cç]|a)o|lanche\s+da\s+tarde|jantar|ceia|pr[eéa-z][\s-]*treino|p[oó]s[\s-]*treino)\b)/gi;

function separarCabecalhosEmbutidos(texto = '') {
  // pdf-parse pode devolver tabelas inteiras em uma linha. Quebrar apenas antes de
  // nomes conhecidos de refeicao torna o parser tolerante sem tentar interpretar
  // livremente o conteudo do nutricionista.
  return String(texto || '').replace(CABECALHOS_REFEICAO_RE, '\n');
}

function detectarCabecalhoRefeicao(linha) {
  const original = String(linha || '').trim();
  const horario = original.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)?.[0] || null;
  const semPrefixo = original
    .replace(/^\s*(?:([01]?\d|2[0-3]):[0-5]\d)?\s*[:;|\-–—]*\s*/, '')
    .trim();
  const base = normalizarRuidoFonte(semPrefixo);

  for (const [chave, titulo] of REFEICOES) {
    const comeca = base === chave || base.startsWith(chave + ' ');
    if (!comeca) continue;

    // As correcoes de ruido acima preservam o comprimento dos nomes de refeicao
    // usados pelos PDFs observados, entao conseguimos manter conteudo que venha na
    // mesma linha do cabecalho.
    const restante = semPrefixo
      .slice(Math.min(semPrefixo.length, chave.length))
      .replace(/^[\s:;|\-–—]+/, '')
      .trim();
    return { titulo, horario, restante };
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
    const match = normalizarRuidoFonte(linha).match(/^opcao\s*(\d+)?\s*[:\-–]?\s*(.*)$/i);
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
  const textoDecodificado = decodificarTextoPdfSeNecessario(textoRecebido);
  const texto = normalizar(separarCabecalhosEmbutidos(textoDecodificado));
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
  const secoes = [];
  let atual = null;

  for (const linha of linhas) {
    const cabecalho = detectarCabecalhoRefeicao(linha);
    if (cabecalho) {
      if (atual) secoes.push(atual);
      atual = { nome: cabecalho.titulo, horario: cabecalho.horario, linhas: [] };
      if (cabecalho.restante) atual.linhas.push(cabecalho.restante);
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

  const precisaRevisao = !refeicoes.length;
  return {
    versao: 3,
    refeicoes,
    caracteres_lidos: texto.length,
    status: precisaRevisao ? 'revisao_necessaria' : 'estruturado',
    observacao: precisaRevisao
      ? 'O PDF foi lido, mas a estrutura de refeições não ficou clara. O trecho extraído está disponível para revisão manual.'
      : 'Plano lido automaticamente. Revise horários, porções e opções antes de usar.',
    ...(precisaRevisao ? { texto_revisao: texto.slice(0, MAX_TEXTO_REVISAO) } : {}),
  };
}

async function lerPdf(buffer) {
  let parser;
  try {
    parser = new PDFParse({ data: buffer, CanvasFactory });
    const resultado = await parser.getText({ first: 20 });
    return decodificarTextoPdfSeNecessario(resultado?.text);
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
