#!/usr/bin/env node
// Pipeline de datos general: trae partidos, clasificación, goleadores o
// asistencias de API-Football para UNA liga y los guarda en data/<tipo>/<slug>.json
// listos para que las páginas del sitio (src/pages/datos/[liga]/[tipo].astro)
// los lean en el build.
//
// Uso real (requiere API_FOOTBALL_KEY en .env):
//   node scripts/fetch-league-data.mjs --type standings --league 94 --season 2026 --slug primeira-liga
//
// Modo de ejemplo, sin clave todavía:
//   node scripts/fetch-league-data.mjs --type standings --sample --slug primeira-liga
//
// Tipos disponibles: fixtures | standings | topscorers | topassists
//
// Para actualizar TODAS las ligas de config/leagues.json de golpe, usa
// scripts/fetch-all.mjs en su lugar.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { apiFootballGet } from './lib/api-football.mjs';

const ENDPOINTS = {
  fixtures: '/fixtures',
  standings: '/standings',
  topscorers: '/players/topscorers',
  topassists: '/players/topassists',
};

const OUT_SUBDIR = {
  fixtures: 'fixtures',
  standings: 'standings',
  topscorers: 'scorers',
  topassists: 'assists',
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = value;
    }
  }
  return args;
}

// Los datos de ejemplo replican la FORMA exacta de las respuestas reales de
// API-Football (comprobada contra datos en producción), para poder desarrollar
// y probar el sitio sin clave y sin gastar peticiones.
const EQUIPOS_DEMO = [
  { id: 9001, name: 'Atlético Demo', logo: null },
  { id: 9002, name: 'Unión Ejemplo', logo: null },
  { id: 9003, name: 'Deportivo Muestra', logo: null },
  { id: 9004, name: 'Racing Prueba', logo: null },
];

function sampleData(type, slug) {
  const base = { _nota: 'DATOS DE EJEMPLO (--sample) — no son datos reales.' };

  if (type === 'standings') {
    const filas = EQUIPOS_DEMO.map((team, i) => {
      const jugados = 6;
      const ganados = 5 - i;
      const empatados = i % 2;
      const perdidos = jugados - ganados - empatados;
      const aFavor = 14 - i * 2;
      const enContra = 4 + i * 2;
      return {
        rank: i + 1,
        team,
        points: ganados * 3 + empatados,
        goalsDiff: aFavor - enContra,
        group: slug,
        form: ['WWWDW', 'WDWLW', 'DLWDL', 'LLDLW'][i],
        status: 'same',
        description: i === 0 ? 'Promotion - Champions League' : null,
        all: { played: jugados, win: ganados, draw: empatados, lose: perdidos, goals: { for: aFavor, against: enContra } },
        home: (() => {
          const g = Math.min(3, Math.max(0, Math.ceil(ganados / 2)));
          const e = Math.min(3 - g, empatados);
          return { played: 3, win: g, draw: e, lose: 3 - g - e, goals: { for: Math.round(aFavor / 2), against: Math.round(enContra / 2) } };
        })(),
        away: (() => {
          const g = Math.min(3, Math.max(0, Math.floor(ganados / 2)));
          const e = Math.min(3 - g, empatados);
          return { played: 3, win: g, draw: e, lose: 3 - g - e, goals: { for: Math.floor(aFavor / 2), against: Math.floor(enContra / 2) } };
        })(),
        update: '2026-08-25T00:00:00+00:00',
      };
    });
    return { ...base, response: [{ league: { id: 0, name: slug, standings: [filas] } }] };
  }

  if (type === 'topscorers' || type === 'topassists') {
    const esGoles = type === 'topscorers';
    return {
      ...base,
      response: EQUIPOS_DEMO.flatMap((team, i) =>
        [0, 1].map((j) => ({
          player: { id: 9100 + i * 10 + j, name: `Jugador Demo ${i + 1}${j === 0 ? 'A' : 'B'}`, photo: null },
          statistics: [
            {
              team,
              games: { appearences: 6 - j },
              goals: {
                total: esGoles ? 8 - i - j * 2 : 3,
                assists: esGoles ? 2 : 6 - i - j * 2,
              },
            },
          ],
        }))
      ),
    };
  }

  // fixtures: unos cuantos jugados y unos cuantos por jugar
  const partidos = [];
  let id = 900000;
  for (let jornada = 1; jornada <= 4; jornada++) {
    const jugado = jornada <= 3;
    for (let par = 0; par < 2; par++) {
      const local = EQUIPOS_DEMO[(jornada + par) % 4];
      const visitante = EQUIPOS_DEMO[(jornada + par + 1) % 4];
      partidos.push({
        fixture: {
          id: id++,
          date: `2026-08-${String(5 + jornada * 5).padStart(2, '0')}T18:00:00+00:00`,
          venue: { name: 'Estadio de Ejemplo', city: 'Ciudad Demo' },
          status: jugado
            ? { long: 'Match Finished', short: 'FT', elapsed: 90 }
            : { long: 'Not Started', short: 'NS', elapsed: null },
        },
        league: { id: 0, name: slug, season: 2026, round: `Regular Season - ${jornada}` },
        teams: {
          home: { ...local, winner: jugado ? true : null },
          away: { ...visitante, winner: jugado ? false : null },
        },
        goals: jugado ? { home: 2, away: 1 } : { home: null, away: null },
        score: {
          halftime: jugado ? { home: 1, away: 0 } : { home: null, away: null },
          fulltime: jugado ? { home: 2, away: 1 } : { home: null, away: null },
        },
      });
    }
  }
  return { ...base, response: partidos };
}

export async function fetchLeagueData({ type, league, season, slug, sample }) {
  if (!ENDPOINTS[type]) {
    throw new Error(`Tipo desconocido "${type}". Usa: ${Object.keys(ENDPOINTS).join(', ')}`);
  }
  if (!slug) {
    throw new Error('Falta --slug (identificador de la liga usado en las URLs del sitio).');
  }

  const outDir = path.resolve('data', OUT_SUBDIR[type]);
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${slug}.json`);

  if (sample) {
    const data = sampleData(type, slug);
    await writeFile(outPath, JSON.stringify(data, null, 2));
    console.log(`✓ [${type}] datos de ejemplo escritos en ${outPath}`);
    return outPath;
  }

  if (!league || !season) {
    throw new Error('Faltan --league <id> y --season <año> (o usa --sample para probar sin clave).');
  }

  console.log(`Descargando ${type} de la liga ${league}, temporada ${season}...`);
  const data = await apiFootballGet(ENDPOINTS[type], { league, season });
  await writeFile(outPath, JSON.stringify(data, null, 2));
  console.log(`✓ [${type}] guardado en ${outPath}`);
  return outPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.type) {
    console.error(
      'Uso:\n' +
        '  node scripts/fetch-league-data.mjs --type <fixtures|standings|topscorers|topassists> --league <id> --season <año> --slug <slug>\n' +
        '  node scripts/fetch-league-data.mjs --type standings --sample --slug primeira-liga\n\n' +
        'Para actualizar todas las ligas de config/leagues.json de golpe: node scripts/fetch-all.mjs [--sample]'
    );
    process.exit(1);
  }

  await fetchLeagueData({
    type: args.type,
    league: args.league,
    season: args.season,
    slug: args.slug,
    sample: Boolean(args.sample),
  });
}

// Solo ejecuta main() si se llama directamente (no cuando fetch-all.mjs importa esta función)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
