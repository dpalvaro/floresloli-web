import { defineConfig } from 'astro/config';

/*
 * La dirección pública sale de compartido/negocio.ts (web.url). Se repite aquí
 * solo como texto porque este archivo se lee antes de compilar el proyecto;
 * `npm run comprobar` avisa si las dos no coinciden.
 */
const SITIO = 'https://floresyplantasloli.pages.dev';

export default defineConfig({
  site: SITIO,
  // Todas las direcciones acaban en «/»: así canonical, sitemap y enlaces coinciden.
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  // Astro 7 quita por defecto los espacios entre enlaces seguidos (reglas de JSX); así se conservan.
  compressHTML: true,
  devToolbar: { enabled: false },
  server: { port: 4321 },
  vite: {
    server: {
      // En `npm run dev`, la API la sirve `npm run api` (wrangler) en el puerto 8788.
      proxy: { '/api': 'http://127.0.0.1:8788' },
    },
  },
});
