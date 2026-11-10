/* Todo lo que cuelga de /api/panel exige sesión, salvo la propia entrada (/api/panel/sesion). */

import type { Env } from '../../_lib/entorno.ts';
import { fallo, mismoOrigen } from '../../_lib/http.ts';
import { sesionValida } from '../../_lib/sesion.ts';

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const ruta = new URL(request.url).pathname.replace(/\/+$/, '');

  // Los cambios solo se aceptan desde la propia web.
  if (request.method !== 'GET' && !mismoOrigen(request)) return fallo(403, 'origen', 'Petición no permitida.');
  if (!env.DB) return fallo(503, 'sin-base-de-datos', 'El panel necesita la base de datos (binding D1 con el nombre DB).');

  if (ruta !== '/api/panel/sesion' && !(await sesionValida(request, env))) {
    return fallo(401, 'sin-sesion', 'La sesión ha caducado. Vuelve a entrar con la clave.');
  }

  const respuesta = await context.next();
  respuesta.headers.set('X-Robots-Tag', 'noindex');
  return respuesta;
};
