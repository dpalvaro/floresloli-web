/* =====================================================================
   DIRECCIÓN ANTIGUA → DOMINIO PROPIO

   La tienda vive en su servidor propio (docs/SERVIDOR.md). Si en la
   producción de Cloudflare Pages se pone la variable URL_PUBLICA, la
   dirección antigua (floresyplantasloli.pages.dev) lleva a la nueva con la
   misma ruta, para no perder los enlaces de Google, redes y tarjetas.

   Solo actúa en la dirección principal de Cloudflare («proyecto.pages.dev»).
   Las vistas previas («rama.proyecto.pages.dev»), el servidor propio y el
   trabajo en local siguen igual. Se mira la dirección y no la rama porque
   Cloudflare no garantiza CF_PAGES_BRANCH fuera de la compilación.
   ===================================================================== */

import type { Env } from './_lib/entorno.ts';

/** Dirección principal de un proyecto de Cloudflare Pages: sin rama ni versión delante. */
const PRINCIPAL_CLOUDFLARE = /^[a-z0-9-]+\.pages\.dev$/i;

export const onRequest: PagesFunction<Env> = async (context) => {
  const destino = (context.env.URL_PUBLICA ?? '').trim().replace(/\/+$/, '');
  const url = new URL(context.request.url);
  if (PRINCIPAL_CLOUDFLARE.test(url.hostname) && /^https:\/\/[a-z0-9.-]+$/i.test(destino)) {
    // Como texto: con new URL(ruta, destino), una ruta «//otro.example» llevaría a otro dominio.
    const nueva = new URL(destino + url.pathname + url.search);
    if (nueva.origin === new URL(destino).origin && nueva.host !== url.host) return Response.redirect(nueva.toString(), 301);
  }
  return context.next();
};
