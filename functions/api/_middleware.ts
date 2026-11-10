/* Se ejecuta antes de cualquier ruta de /api: prepara la base de datos y recoge los errores. */

import { limpiezaDiaria } from '../_lib/datos.ts';
import type { Env } from '../_lib/entorno.ts';
import { asegurarEsquema } from '../_lib/esquema.ts';
import { fallo } from '../_lib/http.ts';

export const onRequest: PagesFunction<Env> = async (context) => {
  try {
    const db = context.env.DB;
    if (db) {
      await asegurarEsquema(db);
      // Una vez al día, y sin hacer esperar a nadie, se borran los datos personales que ya han cumplido su plazo.
      context.waitUntil(limpiezaDiaria(db).catch((error) => console.error('Limpieza de datos', error)));
    }
    return await context.next();
  } catch (error) {
    console.error('Error en la API', context.request.method, new URL(context.request.url).pathname, error);
    return fallo(500, 'interno', 'Algo ha fallado por nuestra parte. Inténtalo de nuevo en un momento o llámanos.');
  }
};
