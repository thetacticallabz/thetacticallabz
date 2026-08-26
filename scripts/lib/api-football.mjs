// Cliente mínimo para API-Football v3 (https://www.api-football.com/documentation-v3).
// Sin dependencias externas: usa fetch nativo de Node 18+.

const BASE_URL = 'https://v3.football.api-sports.io';

export function getApiKey() {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;
  return key;
}

/**
 * Llama a un endpoint de API-Football. Lanza si la respuesta HTTP falla o si
 * la API devuelve errores en el cuerpo (API-Football usa 200 OK incluso para
 * algunos errores de parámetros, así que hay que revisar `errors`).
 */
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

  const res = await fetch(url, {
    headers: { 'x-apisports-key': key },
  });

  if (!res.ok) {
    throw new Error(`API-Football respondió ${res.status} ${res.statusText} para ${url}`);
  }

  const json = await res.json();

  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football devolvió errores: ${JSON.stringify(json.errors)}`);
  }

  return json;
}
