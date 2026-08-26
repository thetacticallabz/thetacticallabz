// Capa de lectura de los datos descargados por el pipeline (carpeta data/).
// Todo lo que hay aquí se ejecuta en tiempo de build: cruza clasificación,
// partidos y goleadores para componer la ficha de cada equipo SIN hacer
// ninguna petición extra a la API.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import leaguesConfig from '../../config/leagues.json';

/** Convierte "Estoril Praia" en "estoril-praia", sin acentos ni signos. */
export function slugify(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function leerJson(subcarpeta, slug) {
  try {
    const ruta = path.resolve('data', subcarpeta, `${slug}.json`);
    return JSON.parse(await readFile(ruta, 'utf-8'));
  } catch {
    return null;
  }
}

const ESTADOS_JUGADO = new Set(['FT', 'AET', 'PEN']);

function esJugado(partido) {
  return ESTADOS_JUGADO.has(partido?.fixture?.status?.short);
}

/**
 * Devuelve la lista de equipos de una liga con todo lo que sabemos de ellos.
 * Si no hay datos descargados para esa liga, devuelve un array vacío.
 */
export async function equiposDeLiga(liga) {
  const [standings, fixtures, scorers, assists] = await Promise.all([
    leerJson('standings', liga.slug),
    leerJson('fixtures', liga.slug),
    leerJson('scorers', liga.slug),
    leerJson('assists', liga.slug),
  ]);

  // La API anida la tabla en response[0].league.standings[0]. Algunas
  // competiciones devuelven varios grupos: los aplanamos todos.
  const grupos = standings?.response?.[0]?.league?.standings ?? [];
  const filas = grupos.flat().filter(Boolean);
  if (filas.length === 0) return [];

  const partidos = fixtures?.response ?? [];

  const jugadoresPorEquipo = (fuente, clave) => {
    const mapa = new Map();
    for (const entrada of fuente?.response ?? []) {
      const est = entrada?.statistics?.[0];
      const equipoId = est?.team?.id;
      if (!equipoId) continue;
      const valor = clave === 'goles' ? est?.goals?.total : est?.goals?.assists;
      if (!valor) continue;
      if (!mapa.has(equipoId)) mapa.set(equipoId, []);
      mapa.get(equipoId).push({
        nombre: entrada?.player?.name ?? '—',
        valor,
        partidos: est?.games?.appearences ?? null,
      });
    }
    return mapa;
  };

  const goleadoresPorEquipo = jugadoresPorEquipo(scorers, 'goles');
  const asistentesPorEquipo = jugadoresPorEquipo(assists, 'asistencias');

  return filas.map((fila) => {
    const equipoId = fila?.team?.id;
    const nombre = fila?.team?.name ?? 'Equipo sin nombre';

    const susPartidos = partidos
      .filter((p) => p?.teams?.home?.id === equipoId || p?.teams?.away?.id === equipoId)
      .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

    const componer = (p) => {
      const local = p.teams.home.id === equipoId;
      const rival = local ? p.teams.away : p.teams.home;
      const golesPropios = local ? p.goals.home : p.goals.away;
      const golesRival = local ? p.goals.away : p.goals.home;
      let resultado = null;
      if (golesPropios != null && golesRival != null) {
        resultado = golesPropios > golesRival ? 'V' : golesPropios < golesRival ? 'D' : 'E';
      }
      return {
        fecha: p.fixture.date,
        jornada: p.league?.round ?? null,
        local,
        rival: rival.name,
        rivalLogo: rival.logo ?? null,
        golesPropios,
        golesRival,
        resultado,
      };
    };

    const jugados = susPartidos.filter(esJugado).map(componer);
    const pendientes = susPartidos.filter((p) => !esJugado(p)).map(componer);

    const ordenarPorValor = (lista) => [...(lista ?? [])].sort((a, b) => b.valor - a.valor);

    return {
      id: equipoId,
      nombre,
      slug: slugify(nombre),
      logo: fila?.team?.logo ?? null,
      posicion: fila?.rank ?? null,
      puntos: fila?.points ?? null,
      diferencia: fila?.goalsDiff ?? null,
      racha: fila?.form ?? null,
      descripcion: fila?.description ?? null,
      grupo: fila?.group ?? null,
      total: fila?.all ?? null,
      casa: fila?.home ?? null,
      fuera: fila?.away ?? null,
      ultimos: jugados.slice(-5).reverse(),
      proximos: pendientes.slice(0, 3),
      goleadores: ordenarPorValor(goleadoresPorEquipo.get(equipoId)).slice(0, 5),
      asistentes: ordenarPorValor(asistentesPorEquipo.get(equipoId)).slice(0, 5),
    };
  });
}

/** Todas las ligas configuradas, con sus equipos ya resueltos. */
export async function todasLasLigasConEquipos() {
  const resultado = [];
  for (const liga of leaguesConfig.ligas) {
    const equipos = await equiposDeLiga(liga);
    resultado.push({ liga, equipos });
  }
  return resultado;
}

/**
 * Índice global de equipos: slug del equipo -> TODAS las fichas con ese nombre.
 * Devuelve una lista porque un mismo nombre puede existir en varias ligas
 * (el Nacional uruguayo y el portugués, o un equipo que aparece en primera y
 * en segunda). Quien consulta el índice decide cuál quiere.
 */
export async function indiceDeEquipos() {
  const indice = new Map();
  for (const { liga, equipos } of await todasLasLigasConEquipos()) {
    for (const equipo of equipos) {
      if (!indice.has(equipo.slug)) indice.set(equipo.slug, []);
      indice.get(equipo.slug).push({
        nombre: equipo.nombre,
        logo: equipo.logo,
        ligaSlug: liga.slug,
        ligaNombre: liga.nombre,
        url: `/equipos/${liga.slug}/${equipo.slug}`,
      });
    }
  }
  return indice;
}

/**
 * Elige la ficha correcta entre varias candidatas: si el artículo declara una
 * liga, gana la de esa liga; si no, la primera según el orden de la
 * configuración.
 */
export function elegirFicha(candidatas, ligaDelArticulo) {
  if (!candidatas || candidatas.length === 0) return null;
  if (ligaDelArticulo) {
    const objetivo = slugify(ligaDelArticulo);
    const exacta = candidatas.find(
      (c) => slugify(c.ligaNombre) === objetivo || c.ligaSlug === objetivo
    );
    if (exacta) return exacta;
  }
  return candidatas[0];
}
