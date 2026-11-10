/* GET /api/panel/estado → cómo está configurada la tienda: para la pestaña «Ajustes» del panel. */

import { TIENDA } from '../../../compartido/tienda.ts';
import { leerAjuste } from '../../_lib/datos.ts';
import type { Env } from '../../_lib/entorno.ts';
import { estadoTienda } from '../../_lib/entorno.ts';
import { json } from '../../_lib/http.ts';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const tienda = estadoTienda(env);
  const [aviso, limpieza] = await Promise.all([leerAjuste(env.DB!, 'stripe_ultimo_aviso'), leerAjuste(env.DB!, 'limpieza_ultima')]);
  let ultimoAviso: { tipo: string; fecha: string } | null = null;
  try {
    ultimoAviso = aviso ? JSON.parse(aviso) : null;
  } catch {
    ultimoAviso = null;
  }
  return json({
    ...tienda,
    ultimoAvisoStripe: ultimoAviso,
    ultimaLimpieza: limpieza,
    reglas: {
      horaLimite: TIENDA.horaLimiteMismoDia,
      cupoDiario: TIENDA.cupoDiario,
      pagoEnTienda: TIENDA.pagoEnTienda,
      diasDatosDestinatario: TIENDA.privacidad.diasDatosDestinatario,
    },
  });
};
