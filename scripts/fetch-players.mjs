#!/usr/bin/env node
// Descarga la plantilla (jugadores, no estadísticas de liga) de cada equipo
// de una liga, usando /players/squads?team={id} de API-Football — 1 petición
// por EQUIPO, no por liga. Necesita que data/standings/<slug>.json ya exista
// (de ahí saca los IDs de equipo, sin gastar peticiones extra en buscarlos).
//
// Guarda en data/players/<slug>.json, un archivo por liga con todos sus equipos.
//
// Uso real (requiere API_FOOTBALL_KEY):
//   node scripts/fetch-players.mjs --slug primeira-liga
//   node scripts/fetch-players.mjs --all          (todas las ligas con standings ya descargado)
//
// Modo de ejemplo, sin clave:
//   node scripts/fetch-players.mjs --slug primeira-liga --sample
//   node scripts/fetch-players.mjs --all --sample
//
// Nota de coste: esto NO es coste marginal cero como las fichas de equipo —
// es una petición nueva por cada equipo (~1.200 en las 60 ligas). Cabe de
// sobra en el límite diario (7.500), pero es gasto real, no reciclado.

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { apiFootballGet } from './lib/api-football.mjs';

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

// Mismos equipos y mismos IDs de ejemplo que scripts/fetch-league-data.mjs,
// para que el standings de muestra y la plantilla de muestra encajen entre sí.
const EQUIPOS_DEMO = [
  { id: 9001, name: 'Atlético Demo' },
  { id: 9002, name: 'Unión Ejemplo' },
  { id: 9003, name: 'Deportivo Muestra' },
  { id: 9004, name: 'Racing Prueba' },
];

const POSICIONES_DEMO = ['Goalkeeper', 'Defender', 'Defender', 'Midfielder', 'Midfielder', 'Attacker'];

function squadDemo(team) {
  return {
    team: { id: team.id, name: team.name, logo: null },
    players: POSICIONES_DEMO.map((posicion, i) => ({
      id: team.id * 100 + i,
      name: `Jugador Demo ${team.id}-${i + 1}`,
      age: 19 + ((i * 3) % 15),
      number: i + 1,
      position: posicion,
      photo: null,
    })),
  };
}

async function idsDeEquipos(slug) {
  const ruta = path.resolve('data', 'standings', `${slug}.json`);
  const standings = JSON.parse(await readFile(ruta, 'utf-8'));
  const grupos = standings?.response?.[0]?.league?.standings ?? [];
  const filas = grupos.flat().filter(Boolean);
  return filas.map((f) => ({ id: f?.team?.id, name: f?.team?.name })).filter((t) => t.id);
}

export async function fetchPlayersLiga({ slug, sample }) {
  const outDir = path.resolve('data', 'players');
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${slug}.json`);

  const equipos = sample ? EQUIPOS_DEMO : await idsDeEquipos(slug);

  if (equipos.length === 0) {
    throw new Error(
      `No hay equipos en data/standings/${slug}.json todavía. Ejecuta fetch-league-data.mjs para standings primero.`
    );
  }

  const squads = [];
  let fail = 0;

  for (const equipo of equipos) {
    try {
      if (sample) {
        squads.push(squadDemo(equipo));
        continue;
      }
      console.log(`  Plantilla de ${equipo.name}...`);
      const data = await apiFootballGet('/players/squads', { team: equipo.id });
      const resultado = data?.response?.[0];
      if (resultado) squads.push(resultado);
    } catch (err) {
      fail++;
      console.error(`  ✗ ${equipo.name}: ${err.message}`);
    }
  }

  const salida = {
    _nota: sample ? 'DATOS DE EJEMPLO (--sample) — no son datos reales.' : undefined,
    response: squads,
  };
  await writeFile(outPath, JSON.stringify(salida, null, 2));
  console.log(`✓ [players] ${squads.length} equipo(s) guardados en ${outPath}${fail ? ` (${fail} fallo(s))` : ''}`);
  return outPath;
}

async function todasLasLigasConStandings() {
  const dir = path.resolve('data', 'standings');
  const { readdir } = await import('node:fs/promises');
  const archivos = await readdir(dir).catch(() => []);
  return archivos.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.slug && !args.all) {
    console.error(
      'Uso:\n' +
        '  node scripts/fetch-players.mjs --slug <slug-de-liga> [--sample]\n' +
        '  node scripts/fetch-players.mjs --all [--sample]   (todas las ligas con standings ya descargado)'
    );
    process.exit(1);
  }

  const slugs = args.all ? await todasLasLigasConStandings() : [args.slug];

  if (slugs.length === 0) {
    console.log('No hay ninguna liga con data/standings/ descargado todavía.');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const slug of slugs) {
    try {
      await fetchPlayersLiga({ slug, sample: Boolean(args.sample) });
      ok++;
    } catch (err) {
      fail++;
      console.error(`✗ ${slug}: ${err.message}`);
    }
  }

  console.log(`\nHecho: ${ok} liga(s) procesadas, ${fail} fallo(s).`);
  if (ok === 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
