const DATASET_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

let cache = null;
let cacheAt = 0;

const ALIASES = {
  'leg press': ['leg press'],
  'supino maquina ou halteres': ['dumbbell bench press', 'bench press'],
  'supino com halteres': ['dumbbell bench press'],
  'supino inclinado': ['incline dumbbell press', 'incline bench press'],
  'chest press ou crucifixo': ['machine bench press', 'butterfly', 'dumbbell fly'],
  'remada sentada': ['seated cable rows', 'seated row'],
  'remada maquina': ['seated cable rows', 'machine row'],
  'remada baixa na polia com triangulo': ['seated cable rows', 'close grip seated cable row'],
  'stiff rdl': ['romanian deadlift', 'stiff legged dumbbell deadlift'],
  'stiff com halteres': ['romanian deadlift with dumbbells', 'stiff legged dumbbell deadlift'],
  'elevacao lateral': ['side lateral raise', 'dumbbell lateral raise'],
  'abdominal na polia': ['kneeling cable crunch', 'cable crunch'],
  'agachamento ou hack': ['hack squat', 'barbell squat'],
  'agachamento na maquina': ['hack squat', 'smith machine squat'],
  'puxada alta': ['wide grip lat pulldown', 'lat pulldown'],
  'puxada alta na polia': ['lat pulldown'],
  'elevacao pelvica': ['barbell glute bridge', 'hip thrust'],
  'rosca de biceps': ['dumbbell bicep curl', 'barbell curl'],
  'rosca biceps': ['dumbbell bicep curl', 'barbell curl'],
  'triceps na polia': ['triceps pushdown', 'cable triceps'],
  'triceps corda': ['triceps pushdown rope attachment', 'triceps pushdown'],
  'prancha': ['plank'],
  'afundo ou bulgaro': ['bulgarian split squat', 'dumbbell rear lunge', 'split squat'],
  'afundo com halteres': ['dumbbell lunge', 'dumbbell rear lunge'],
  'mesa flexora': ['lying leg curls', 'leg curl'],
  'cadeira flexora': ['seated leg curl', 'lying leg curls'],
  'cadeira extensora': ['leg extensions'],
  'desenvolvimento': ['dumbbell shoulder press', 'shoulder press'],
  'desenvolvimento com halteres': ['dumbbell shoulder press'],
  'panturrilha': ['standing calf raises', 'calf raise'],
  'panturrilha com halteres': ['standing dumbbell calf raise', 'calf raise'],
  'elevacao de joelhos ou pernas': ['hanging leg raise', 'captains chair leg raise'],
  'abdutora': ['hip abduction', 'thigh abductor'],
  'adutora': ['hip adduction', 'thigh adductor'],
};

const TOKEN_TRANSLATIONS = {
  agachamento: 'squat', hack: 'hack squat', supino: 'bench press', remada: 'row', puxada: 'pulldown',
  cadeira: 'leg', mesa: 'leg', flexora: 'curl', extensora: 'extension', rosca: 'curl', biceps: 'biceps',
  triceps: 'triceps', panturrilha: 'calf', afundo: 'lunge', bulgaro: 'split squat', desenvolvimento: 'shoulder press',
  elevacao: 'raise', lateral: 'lateral', abdominal: 'crunch', polia: 'cable', halteres: 'dumbbell', maquina: 'machine',
  pelvica: 'glute bridge', stiff: 'romanian deadlift', prancha: 'plank', abdutora: 'abduction', adutora: 'adduction',
};

function normalizar(valor = '') {
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function candidatos(nome) {
  const q = normalizar(nome);
  if (ALIASES[q]) return ALIASES[q];
  for (const [chave, valores] of Object.entries(ALIASES)) {
    if (q.includes(chave) || chave.includes(q)) return valores;
  }
  const traduzido = q.split(' ').map(token => TOKEN_TRANSLATIONS[token] || token).join(' ');
  return [...new Set([traduzido, q])];
}

function pontuar(exercicio, termos) {
  const nome = normalizar(exercicio.name);
  const equipamento = normalizar(exercicio.equipment || '');
  const musculos = normalizar([...(exercicio.primaryMuscles || []), ...(exercicio.secondaryMuscles || [])].join(' '));
  let melhor = 0;
  for (const termoOriginal of termos) {
    const termo = normalizar(termoOriginal);
    if (!termo) continue;
    if (nome === termo) melhor = Math.max(melhor, 1000);
    if (nome.startsWith(termo)) melhor = Math.max(melhor, 850);
    if (nome.includes(termo)) melhor = Math.max(melhor, 760);
    const tokens = termo.split(' ').filter(t => t.length > 2);
    const encontrados = tokens.filter(t => nome.includes(t)).length;
    if (tokens.length) melhor = Math.max(melhor, encontrados / tokens.length * 600);
    const contexto = `${nome} ${equipamento} ${musculos}`;
    const contextoHits = tokens.filter(t => contexto.includes(t)).length;
    if (tokens.length) melhor = Math.max(melhor, contextoHits / tokens.length * 420);
  }
  return melhor;
}

async function carregarDataset() {
  const agora = Date.now();
  if (cache && agora - cacheAt < CACHE_TTL_MS) return cache;
  const resposta = await fetch(DATASET_URL, { signal: AbortSignal.timeout(7000) });
  if (!resposta.ok) throw new Error(`Dataset de exercícios indisponível (${resposta.status})`);
  const dados = await resposta.json();
  cache = Array.isArray(dados) ? dados : [];
  cacheAt = agora;
  return cache;
}

function serializar(exercicio, consulta) {
  const imagens = (exercicio.images || []).slice(0, 2).map(path => `${IMAGE_BASE}${path}`);
  return {
    found: true,
    query: consulta,
    id: exercicio.id,
    name: exercicio.name,
    equipment: exercicio.equipment || null,
    category: exercicio.category || null,
    primaryMuscles: exercicio.primaryMuscles || [],
    secondaryMuscles: exercicio.secondaryMuscles || [],
    instructions: (exercicio.instructions || []).slice(0, 6),
    images: imagens,
    source: 'free-exercise-db',
    sourceLicense: 'Public Domain / Unlicense',
  };
}

export function registrarRotasExerciciosMidia(app) {
  app.get('/api/exercicios/midia', async (req, res) => {
    const nome = String(req.query.nome || '').trim().slice(0, 120);
    if (!nome) return res.status(400).json({ found: false, error: 'Informe o nome do exercício.' });

    try {
      const dataset = await carregarDataset();
      const termos = candidatos(nome);
      const melhores = dataset
        .map(exercicio => ({ exercicio, score: pontuar(exercicio, termos) }))
        .filter(item => item.score >= 210)
        .sort((a, b) => b.score - a.score);
      if (!melhores.length) return res.json({ found: false, query: nome });
      return res.json(serializar(melhores[0].exercicio, nome));
    } catch (erro) {
      console.warn('[Ritmo mídia] catálogo indisponível:', erro?.message || erro);
      return res.status(503).json({ found: false, query: nome, error: 'Catálogo temporariamente indisponível.' });
    }
  });
}
