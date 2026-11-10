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
  // Desde Astro 7, por defecto se quitan los espacios entre elementos como hace JSX ('jsx').
  // Con `true` se comprime sin perder los espacios entre enlaces y palabras seguidas.
  compressHTML: true,
  devToolbar: { enabled: false },
  server: { port: 4321 },
  vite: {
    // Ningún script va incrustado en el HTML: así la política de seguridad (public/_headers) puede prohibirlos.
    build: { assetsInlineLimit: 0 },
    server: {
      // En `npm run dev`, la API la sirve `npm run api` (wrangler) en el puerto 8788.
      proxy: { '/api': 'http://127.0.0.1:8788' },
    },
  },
});
