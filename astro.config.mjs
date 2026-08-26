import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// IMPORTANTE: cambia "site" por el dominio real antes de desplegar a producción.
// El sitemap y las etiquetas canónicas/OG dependen de este valor.
export default defineConfig({
  site: 'https://thetacticallabz.vercel.app',
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
