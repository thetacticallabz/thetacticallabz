#!/usr/bin/env node
// Ayuda a encontrar el ID correcto de una liga en API-Football por país o
// nombre. IMPORTANTE: los IDs de liga de API-Football no se han hardcodeado
// en ningún sitio de este proyecto porque no se pueden verificar sin una
// clave de API real y pueden cambiar — este script es la forma correcta de
// obtenerlos antes de rellenar config/leagues.json.
//
// Uso:
//   node scripts/discover-leagues.mjs --country Portugal
//   node scripts/discover-leagues.mjs --search "Primeira Liga"

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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.country && !args.search) {
    console.error(
      'Especifica --country "Portugal" o --search "nombre de la liga". Ejemplo:\n' +
        '  node scripts/discover-leagues.mjs --country Portugal'
    );
    process.exit(1);
  }

  const params = {};
  if (args.country) params.country = args.country;
  if (args.search) params.search = args.search;

  const data = await apiFootballGet('/leagues', params);

  const rows = data.response.map((entry) => ({
    id: entry.league.id,
    nombre: entry.league.name,
    tipo: entry.league.type,
    pais: entry.country.name,
    temporadasDisponibles: entry.seasons?.map((s) => s.year).join(', '),
  }));

  console.table(rows);
  console.log(
    `\n${rows.length} liga(s) encontrada(s). Copia el "id" que corresponda a config/leagues.json.`
  );
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
