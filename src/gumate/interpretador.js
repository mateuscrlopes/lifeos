import { config } from '../config.js';
import { normalizarTexto, separarItens } from './util.js';

const ACOES_PERMITIDAS = new Set(['adicionar_compras', 'nao_entendi']);

function interpretarComRegras(textoOriginal) {
  const texto = normalizarTexto(textoOriginal);
  if (!texto) return null;

  const padroes = [
    /^(?:adiciona|adicione|adicionar|coloca|coloque|poe|põe|bota|inclui|inclua)\s+(.+)$/i,
    /^(?:acabou|esta faltando|tá faltando|ta faltando|precisamos comprar|precisa comprar)\s+(.+)$/i,
  ];

  for (const padrao of padroes) {
    const resultado = textoOriginal.match(padrao);
    if (!resultado?.[1]) continue;
    const itens = separarItens(resultado[1]);
    if (itens.length) {
      return {
        acao: 'adicionar_compras',
        itens,
        confianca: 1,
        precisa_confirmacao: false,
        pergunta: null,
        origem_interpretacao: 'regras',
      };
    }
  }

  return null;
}

function validarInterpretacao(valor) {
  if (!valor || typeof valor !== 'object') return null;
  if (!ACOES_PERMITIDAS.has(valor.acao)) return null;

  const itens = Array.isArray(valor.itens)
    ? valor.itens.map((item) => String(item).trim().slice(0, 120)).filter(Boolean).slice(0, 12)
    : [];

  if (valor.acao === 'adicionar_compras' && itens.length === 0) return null;

  return {
    acao: valor.acao,
    itens,
    confianca: Number.isFinite(Number(valor.confianca)) ? Number(valor.confianca) : 0.5,
    precisa_confirmacao: Boolean(valor.precisa_confirmacao),
    pergunta: valor.pergunta ? String(valor.pergunta).slice(0, 180) : null,
    origem_interpretacao: 'gemini',
  };
}

async function interpretarComGemini(texto) {
  if (!config.geminiApiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(12_000),
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: [
            'Voce interpreta comandos de voz de uma casa brasileira.',
            'Nesta versao, a unica acao executavel e adicionar_compras.',
            'Extraia somente itens de compra explicitamente pedidos.',
            'Nao invente quantidades, marcas ou produtos.',
            'Quando nao for um pedido de compra, devolva nao_entendi.',
          ].join(' '),
        }],
      },
      contents: [{ role: 'user', parts: [{ text: texto }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 300,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          required: ['acao', 'itens', 'confianca', 'precisa_confirmacao'],
          properties: {
            acao: { type: 'STRING', enum: ['adicionar_compras', 'nao_entendi'] },
            itens: { type: 'ARRAY', items: { type: 'STRING' } },
            confianca: { type: 'NUMBER' },
            precisa_confirmacao: { type: 'BOOLEAN' },
            pergunta: { type: ['STRING', 'NULL'] },
          },
        },
      },
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(`Gemini respondeu ${resposta.status}: ${detalhe.slice(0, 180)}`);
  }

  const payload = await resposta.json();
  const textoJson = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textoJson) return null;
  return validarInterpretacao(JSON.parse(textoJson));
}

export async function interpretarComando(texto) {
  const porRegras = interpretarComRegras(texto);
  if (porRegras) return porRegras;

  try {
    const porIa = await interpretarComGemini(texto);
    if (porIa) return porIa;
  } catch (erro) {
    console.error('[Gumate] Falha de interpretacao por IA:', erro.message);
  }

  return {
    acao: 'nao_entendi',
    itens: [],
    confianca: 0,
    precisa_confirmacao: false,
    pergunta: 'Ainda nao entendi esse pedido. Tente dizer: adiciona detergente na lista.',
    origem_interpretacao: config.geminiApiKey ? 'fallback' : 'sem_ia',
  };
}
