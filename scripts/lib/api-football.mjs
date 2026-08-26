//// Cliente mínimo para API-Football v3.
// Sin dependencias externas: usa fetch nativo de Node 18+.

const BASE_URL = 'https://v3.football.api-sports.io';

// API-Football limita las peticiones por minuto además de por día. Para no
// chocar con ese límite espaciamos las llamadas y reintentamos si aun así
// devuelve 429 (Too Many Requests).
const PAUSA_ENTRE_LLAMADAS_MS = 1500;
const REINTENTOS_MAX = 4;
const ESPERA_TRAS_429_MS = 20000;

let ultimaLlamada = 0;

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function getApiKey() {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;
  return key;
}

async function esperarTurno() {
  const transcurrido = Date.now() - ultimaLlamada;
  if (transcurrido < PAUSA_ENTRE_LLAMADAS_MS) {
    await dormir(PAUSA_ENTRE_LLAMADAS_MS - transcurrido);
  }
  ultimaLlamada = Date.now();
}

export async function apiFootballGet(path, params = {}) {
  const key = getApiKey();
  if (!key) {
    throw new Error(
      'Falta API_FOOTBALL_KEY. Copia .env.example a .env y añade tu clave, o usa --sample para generar datos de ejemplo sin llamar a la API real.'
    );
  }

  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  let ultimoError;

  for (let intento = 1; intento <= REINTENTOS_MAX; intento++) {
    await esperarTurno();

    const res = await fetch(url, { headers: { 'x-apisports-key': key } });

    if (res.status === 429) {
      ultimoError = new Error(`API-Football respondió 429 (límite de peticiones) para ${url}`);
      if (intento < REINTENTOS_MAX) {
        const espera = ESPERA_TRAS_429_MS * intento;
        console.warn(`  Límite alcanzado, esperando ${espera / 1000}s antes de reintentar...`);
        await dormir(espera);
        continue;
      }
      throw ultimoError;
    }

    if (!res.ok) {
      throw new Error(`API-Football respondió ${res.status} ${res.statusText} para ${url}`);
    }

    const json = await res.json();

    if (json.errors && !Array.isArray(json.errors) && Object.keys(json.errors).length > 0) {
      throw new Error(`API-Football devolvió errores: ${JSON.stringify(json.errors)}`);
    }

    return json;
  }

  throw ultimoError ?? new Error('Fallo desconocido llamando a API-Football');
}
