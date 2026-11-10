/*
 * robots.txt
 * · Web pública: todo abierto menos la API. La cesta y el panel no se bloquean aquí a propósito:
 *   llevan «noindex», y para que los buscadores lo lean tienen que poder entrar.
 * · Vistas de prueba: nada se indexa.
 */

import type { APIRoute } from 'astro';
import { NEGOCIO } from '../../compartido/negocio.ts';
import { ES_PRUEBAS } from '../lib/entorno.ts';

export const GET: APIRoute = () => {
  const texto = ES_PRUEBAS
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${NEGOCIO.web.url}/sitemap.xml\n`;
  return new Response(texto, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
