/* Se ejecuta antes de cualquier ruta de /api: prepara la base de datos y recoge los errores. */

import type { Env } from '../_lib/entorno.ts';
import { asegurarEsquema } from '../_lib/esquema.ts';
import { fallo } from '../_lib/http.ts';

export const onRequest: PagesFunction<Env> = async (context) => {
  try {
    if (context.env.DB) await asegurarEsquema(context.env.DB);
    return await context.next();
  } catch (error) {
    console.error('Error en la API', context.request.method, new URL(context.request.url).pathname, error);
    return fallo(500, 'interno', 'Algo ha fallado por nuestra parte. Inténtalo de nuevo en un momento o llámanos.');
  }
};
