// clima.js
// Busca o clima atual via Open-Meteo (sem chave de API).
// Coordenadas: São Gonçalo - RJ (-22.8269, -43.0539)

const LAT = -22.8269;
const LON = -43.0539;

const DESCRICAO_CLIMA = {
  0:  'Céu limpo',
  1:  'Principalmente limpo',
  2:  'Parcialmente nublado',
  3:  'Nublado',
  45: 'Neblina',
  48: 'Neblina com geada',
  51: 'Garoa leve',
  53: 'Garoa moderada',
  55: 'Garoa intensa',
  61: 'Chuva leve',
  63: 'Chuva moderada',
  65: 'Chuva forte',
  71: 'Neve leve',
  73: 'Neve moderada',
  75: 'Neve forte',
  80: 'Pancadas de chuva leves',
  81: 'Pancadas de chuva moderadas',
  82: 'Pancadas de chuva fortes',
  95: 'Trovoada',
  96: 'Trovoada com granizo',
  99: 'Trovoada com granizo forte',
};

const EMOJI_CLIMA = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '❄️', 73: '❄️', 75: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

let cache = null;
let cacheTs = 0;
const CACHE_TTL = 30 * 60 * 1000;
const TIMEOUT_MS = 10000;

function numeroOuNulo(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export async function buscarClima() {
  const agora = Date.now();
  if (cache && agora - cacheTs < CACHE_TTL) return cache;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const campos = 'temperature_2m,weather_code,wind_speed_10m';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=${campos}&timezone=America%2FSao_Paulo`;
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });

    if (!resp.ok) {
      throw new Error(`Falha na API de clima: HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const atual = data?.current || {};

    // Os nomes com sublinhado são os campos atuais da API.
    // Os nomes antigos ficam como compatibilidade de segurança.
    const temperatura = numeroOuNulo(atual.temperature_2m);
    const codigo = numeroOuNulo(atual.weather_code ?? atual.weathercode);
    const vento = numeroOuNulo(atual.wind_speed_10m ?? atual.windspeed_10m);

    if (temperatura === null || codigo === null) {
      throw new Error('A API de clima respondeu sem os campos esperados.');
    }

    cache = {
      temperatura: Math.round(temperatura),
      descricao: DESCRICAO_CLIMA[codigo] || 'Tempo variável',
      emoji: EMOJI_CLIMA[codigo] || '🌡️',
      vento: vento === null ? null : Math.round(vento),
      atualizado_em: new Date().toISOString(),
    };
    cacheTs = agora;
    return cache;
  } catch (erro) {
    console.error('[Clima]', String(erro?.message || erro));
    return cache || {
      temperatura: null,
      descricao: 'Indisponível',
      emoji: '🌡️',
      vento: null,
      atualizado_em: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
