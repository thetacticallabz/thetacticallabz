import { defineCollection, z } from 'astro:content';

// Taxonomía de contenido del blog. "region" es la clasificación clave para el
// nicho: ligas top europeas SOLO para equipos/hilos desconocidos dentro de
// ellas (no para competir de frente en el contenido genérico de esas ligas),
// y el resto de regiones son el foco principal del proyecto.
const REGIONES = [
  'portugal',
  'sudamerica',
  'asia',
  'africa',
  'oceania',
  'equipos-desconocidos-grandes-ligas',
] as const;

const TIPOS = [
  'analisis-equipo',
  'analisis-tactico',
  'analisis-jugador',
  'sistema-de-juego',
  'datos-liga',
] as const;

const articulos = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().max(300),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      region: z.enum(REGIONES),
      tipo: z.enum(TIPOS),
      liga: z.string(),
      equipos: z.array(z.string()).default([]),
      jugadores: z.array(z.string()).default([]),
      autor: z.string().default('The Tactical Labz'),
      // De dónde viene la capa de datos de este artículo: útil para saber qué
      // se puede automatizar (API-Football) y qué es 100% editorial.
      fuenteDatos: z.enum(['api-football', 'editorial', 'mixto']).default('editorial'),
      heroImage: image().optional(),
      draft: z.boolean().default(false),
    }),
});

export const collections = { articulos };
export { REGIONES, TIPOS };
