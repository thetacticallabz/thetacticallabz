# The Tactical Labz — Blog

Esqueleto funcional del blog de análisis táctico (extensión de la marca
The Tactical Labz), centrado en Portugal, Sudamérica, Asia, África, Oceanía y
equipos desconocidos de las grandes ligas.

## Qué hay montado ya

- Sitio en Astro (`npm run build` genera un sitio estático, rápido y con buen SEO técnico de base).
- Taxonomía de contenido (`src/content/config.ts`): cada artículo se clasifica por región, tipo (análisis de equipo / táctico / jugador / sistema de juego / datos de liga), liga, equipos y jugadores mencionados, y de dónde viene su capa de datos (API-Football / editorial / mixto).
- Páginas: portada, una página por región (`/ligas/<region>`) y la página de artículo individual, con metadatos Open Graph, canonical URL, sitemap automático y datos estructurados `Article` (schema.org) para SEO.
- Un artículo de ejemplo (`src/content/articulos/casa-pia-bloque-medio-2526.md`) que sirve de plantilla de formato: capa de datos + capa de análisis editorial.
- Pipeline de datos (`scripts/fetch-league-data.mjs`, `scripts/fetch-all.mjs` y `scripts/discover-leagues.mjs`) contra API-Football, con modo `--sample` para probar sin clave de API todavía.
- Páginas de datos 100% automatizables por liga (`/datos/<liga>/clasificacion`, `/goleadores`, `/asistencias`), enlazadas desde cada página de región. No necesitan que escribas nada — se generan solas a partir de lo que traiga el pipeline.

## Cómo se automatiza (y qué no)

- **Se automatiza al 100%**: partidos, clasificación, goleadores y asistencias vía API-Football, mediante un GitHub Action semanal (`.github/workflows/fetch-data.yml`) que corre en la nube de GitHub — no depende de esta sesión de Claude ni de tener el ordenador encendido. Estas páginas de datos no necesitan revisión editorial porque son solo tablas, no análisis.
- **No se automatiza (a propósito)**: la redacción del análisis táctico. La decisión tomada fue "datos automatizados, análisis manual" — Claude Code puede ayudarte a redactar un primer borrador a partir de los datos, pero la publicación final pasa por tu revisión editorial. Esto es clave para evitar que Google trate el sitio como contenido masivo sin valor ("scaled content abuse").
- **Huecos de datos reales**: para África, Oceanía y la mayoría de segundas divisiones no hay xG ni estadísticas avanzadas en ninguna API accesible (ver investigación completa en el documento del proyecto). En esas ligas el pipeline solo te da resultados/alineaciones básicas — el análisis táctico ahí depende de tu criterio y de ver los partidos.

## Primeros pasos para que esto sea real

1. **Conseguir la API key**: crea una cuenta en [api-football.com](https://www.api-football.com/pricing) (plan Pro, $19/mes, es el recomendado por cobertura de estas regiones). Copia `.env.example` a `.env` y pega la clave.
2. **Encontrar los IDs de liga reales**: ejecuta `node scripts/discover-leagues.mjs --country "Portugal"` (y lo mismo para cada país/liga que te interese) y rellena el campo `id` en `config/leagues.json` con los IDs que confirme la API. No se han puesto IDs de ejemplo porque cambian y hay que verificarlos con una clave real.
3. **Probar el pipeline de verdad**: `node scripts/fetch-all.mjs` (trae fixtures + clasificación + goleadores + asistencias de todas las ligas que ya tengan `id` en `config/leagues.json`).
4. **Subir el proyecto a GitHub**: este proyecto vive solo en esta sesión de Claude por ahora — para que el GitHub Action de automatización funcione necesita estar en un repositorio real. Cuando tengas el repo, añade `API_FOOTBALL_KEY` como secret del repositorio (Settings → Secrets and variables → Actions); el workflow ya está listo para ejecutar `node scripts/fetch-all.mjs` en cuanto los IDs estén confirmados.
5. **Desplegar el sitio**: conecta el repositorio a [Vercel](https://vercel.com/new) o [Netlify](https://app.netlify.com/start) — ambos detectan Astro automáticamente. Cambia `site` en `astro.config.mjs` por el dominio real antes de desplegar (afecta al sitemap y a las URLs canónicas/OG).
6. **Dominio**: decide si va en un subdominio de Tactical Labz (p. ej. `blog.thetacticallabz.com`) o en dominio propio, y actualízalo en `astro.config.mjs` y en `public/robots.txt`.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm install` | Instala dependencias |
| `npm run dev` | Servidor de desarrollo local |
| `npm run build` | Build de producción (falla si hay errores de tipos/contenido) |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run fetch:data` | Atajo a `scripts/fetch-all.mjs` (actualiza todas las ligas configuradas) |

## Cómo añadir un artículo nuevo

Crea un `.md` o `.mdx` en `src/content/articulos/` con este frontmatter mínimo:

```yaml
---
title: "Título del artículo"
description: "Resumen para SEO, máx. ~300 caracteres"
pubDate: 2026-08-26
region: portugal # portugal | sudamerica | asia | africa | oceania | equipos-desconocidos-grandes-ligas
tipo: analisis-tactico # analisis-equipo | analisis-tactico | analisis-jugador | sistema-de-juego | datos-liga
liga: "Primeira Liga"
equipos: ["Nombre del equipo"]
fuenteDatos: editorial # api-football | editorial | mixto
draft: false
---
```

El build (`astro check`) valida ese frontmatter automáticamente — si falta un
campo obligatorio o el valor de `region`/`tipo` no es uno de los permitidos,
el build falla con un error claro en vez de publicar algo mal etiquetado.
