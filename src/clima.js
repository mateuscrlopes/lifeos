// clima.js
// Busca previsao do tempo atual via Open-Meteo (sem chave de API).
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

let _cache = null;
let _cacheTs = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

export async function buscarClima() {
  const agora = Date.now();
  if (_cache && agora - _cacheTs < CACHE_TTL) return _cache;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weathercode,windspeed_10m&timezone=America%2FSao_Paulo`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Falha na API de clima');
    const data = await resp.json();
    const cur = data.current;
    const code = cur.weathercode;
    _cache = {
      temperatura: Math.round(cur.temperature_2m),
      descricao: DESCRICAO_CLIMA[code] || 'Tempo variável',
      emoji: EMOJI_CLIMA[code] || '🌡️',
      vento: Math.round(cur.windspeed_10m),
    };
    _cacheTs = agora;
    return _cache;
  } catch (e) {
    return _cache || { temperatura: null, descricao: 'Indisponível', emoji: '🌡️', vento: null };
  }
}
