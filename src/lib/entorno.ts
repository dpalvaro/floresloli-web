/* =====================================================================
   ENTORNO EN EL QUE SE CONSTRUYE LA WEB

   · «produccion»: lo que ve el público. Solo productos y precios confirmados.
   · «pruebas»: vistas previas y trabajo en local. Se ven también los productos
     y precios de ejemplo, con su etiqueta, y los buscadores no la indexan.

   En Cloudflare Pages se decide solo: la rama main es producción y cualquier
   otra rama es de pruebas. La API hace lo mismo (functions/_lib/entorno.ts).
   Se puede forzar con la variable ENTORNO.
   ===================================================================== */

import type { Entorno } from '../../compartido/catalogo.ts';

// Este archivo solo se ejecuta al construir la web (en Node), nunca en el navegador.
declare const process: { env: Record<string, string | undefined> };

function calcular(): Entorno {
  const explicito = (process.env.ENTORNO ?? '').trim().toLowerCase();
  if (explicito === 'pruebas' || explicito === 'produccion') return explicito;
  if (process.env.CF_PAGES === '1') return process.env.CF_PAGES_BRANCH === 'main' ? 'produccion' : 'pruebas';
  return 'pruebas';
}

export const ENTORNO: Entorno = calcular();
export const ES_PRUEBAS = ENTORNO === 'pruebas';
