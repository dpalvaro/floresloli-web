/* GET /api/estado → ¿se puede comprar en la web ahora mismo? La cesta lo pregunta antes de ofrecer el pago. */

import { TIENDA } from '../../compartido/tienda.ts';
import type { Env } from '../_lib/entorno.ts';
import { estadoTienda } from '../_lib/entorno.ts';
import { json } from '../_lib/http.ts';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const e = estadoTienda(env);
  return json({
    entorno: e.entorno,
    pedidosOnline: e.pedidosOnline,
    pago: e.pedidosOnline ? e.pago : null,
    pagoEnTienda: TIENDA.pagoEnTienda && e.baseDatos,
  });
};
