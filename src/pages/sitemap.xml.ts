/* Mapa del sitio para buscadores: sale de la lista de páginas de src/lib/rutas.ts. */

import type { APIRoute } from 'astro';
import { paginasIndexables } from '../lib/rutas.ts';
import { urlAbsoluta } from '../lib/seo.ts';

export const GET: APIRoute = () => {
  const urls = paginasIndexables()
    .map((p) => `  <url><loc>${urlAbsoluta(p.ruta)}</loc><priority>${p.prioridad.toFixed(1)}</priority></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
