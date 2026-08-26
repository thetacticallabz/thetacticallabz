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

function sampleData(type, slug) {
  const base = { _nota: 'DATOS DE EJEMPLO (--sample) — no son datos reales.' };

  if (type === 'standings') {
    return {
      ...base,
      response: [
        {
          league: {
            id: 0,
            name: slug,
            standings: [
              [
                {
                  rank: 1,
                  team: { id: 1, name: 'Equipo Local Demo' },
                  points: 62,
                  goalsDiff: 24,
                  form: 'WWDWL',
                  all: { played: 28, win: 19, draw: 5, lose: 4, goals: { for: 52, against: 28 } },
                },
                {
                  rank: 2,
                  team: { id: 2, name: 'Equipo Demo C' },
                  points: 55,
                  goalsDiff: 15,
                  form: 'WDWWD',
                  all: { played: 28, win: 16, draw: 7, lose: 5, goals: { for: 44, against: 29 } },
                },
              ],
            ],
          },
        },
      ],
    };
  }

  if (type === 'topscorers' || type === 'topassists') {
    const statKey = type === 'topscorers' ? 'goals' : 'assists';
    return {
      ...base,
      response: [
        {
          player: { id: 10, name: 'Jugador Demo A', photo: null },
          statistics: [
            {
              team: { name: 'Equipo Local Demo' },
              games: { appearences: 27 },
              goals: { total: statKey === 'goals' ? 19 : 8, assists: statKey === 'assists' ? 11 : 5 },
            },
          ],
        },
        {
          player: { id: 11, name: 'Jugador Demo B', photo: null },
          statistics: [
            {
              team: { name: 'Equipo Demo C' },
              games: { appearences: 25 },
              goals: { total: statKey === 'goals' ? 14 : 6, assists: statKey === 'assists' ? 9 : 4 },
            },
          ],
        },
      ],
    };
  }

  // fixtures
  return {
    ...base,
    response: [
      {
        fixture: { id: 900001, date: '2026-08-23T18:00:00+00:00', status: { short: 'FT' } },
        league: { id: 0, name: slug, round: 'Jornada 3' },
        teams: {
          home: { id: 1, name: 'Equipo Local Demo', winner: true },
          away: { id: 2, name: 'Equipo Visitante Demo', winner: false },
        },
        goals: { home: 2, away: 1 },
      },
    ],
  };
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
