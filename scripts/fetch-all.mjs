#!/usr/bin/env node
// Actualiza fixtures + standings + topscorers + topassists para TODAS las
// ligas listadas en config/leagues.json que ya tengan un "id" confirmado.
// Es lo que llama el GitHub Action semanal (.github/workflows/fetch-data.yml).
//
// Uso real:   node scripts/fetch-all.mjs
// Modo demo:  node scripts/fetch-all.mjs --sample   (usa todas las ligas, tengan id o no)

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchLeagueData } from './fetch-league-data.mjs';

const TYPES = ['fixtures', 'standings', 'topscorers', 'topassists'];

function parseArgs(argv) {
  return { sample: argv.includes('--sample') };
}

async function main() {
  const { sample } = parseArgs(process.argv.slice(2));
  const configPath = path.resolve('config', 'leagues.json');
  const config = JSON.parse(await readFile(configPath, 'utf-8'));

  const ligas = sample ? config.ligas : config.ligas.filter((l) => l.id);

  if (ligas.length === 0) {
    console.log(
      'Ninguna liga tiene "id" todavía en config/leagues.json. ' +
        'Ejecuta scripts/discover-leagues.mjs para encontrarlos, o usa --sample para probar el pipeline.'
    );
    return;
  }

  let ok = 0;
  let fail = 0;

  for (const liga of ligas) {
    for (const type of TYPES) {
      try {
        await fetchLeagueData({
          type,
          league: liga.id,
          season: liga.temporada,
          slug: liga.slug,
          sample,
        });
        ok++;
      } catch (err) {
        fail++;
        console.error(`✗ [${type}] ${liga.nombre} (${liga.slug}): ${err.message}`);
      }
    }
  }

    console.log(`\nHecho: ${ok} archivo(s) actualizados, ${fail} fallo(s).`);
  // Solo damos el proceso por fallido si NO se pudo descargar nada. Si algunas
  // ligas fallan pero otras funcionan, guardamos lo que sí tenemos.
  if (ok === 0) {
    console.error('No se pudo descargar ningún dato.');
    process.exitCode = 1;
  } else if (fail > 0) {
    console.warn(`Atención: ${fail} descarga(s) fallaron, pero se guardan las que sí funcionaron.`);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
