// Definido en su propio módulo (en vez de como const suelto dentro del
// frontmatter de la página) porque Astro extrae getStaticPaths a un ámbito
// separado del resto del componente, y un const declarado solo en el
// frontmatter no queda disponible ahí de forma fiable. Importarlo desde un
// módulo aparte sí funciona en ambos sitios.
export const TIPOS_DATOS = [
  { slug: 'clasificacion', label: 'Clasificación', dataDir: 'standings' },
  { slug: 'goleadores', label: 'Goleadores', dataDir: 'scorers' },
  { slug: 'asistencias', label: 'Asistencias', dataDir: 'assists' },
];
