/* GET /api/disponibilidad → próximos días de entrega, con los que no se pueden elegir y por qué. */

import { ahoraEnMadrid, calendarioEntrega, sumarDias } from '../../compartido/fechas.ts';
import { TIENDA } from '../../compartido/tienda.ts';
import { ajustesDeDias, caducarVencidos, ocupacionPorDia } from '../_lib/datos.ts';
import type { Env } from '../_lib/entorno.ts';
import { json } from '../_lib/http.ts';

const DIAS = 35;

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const ahora = new Date();
  const madrid = ahoraEnMadrid(ahora);
  const hasta = sumarDias(madrid.fecha, DIAS);

  let ajustes = new Map();
  let ocupacion = new Map();
  if (env.DB) {
    await caducarVencidos(env.DB, ahora);
    [ajustes, ocupacion] = await Promise.all([
      ajustesDeDias(env.DB, madrid.fecha, hasta),
      ocupacionPorDia(env.DB, madrid.fecha, hasta, ahora),
    ]);
  }

  return json({
    hoy: madrid.fecha,
    horaLimite: TIENDA.horaLimiteMismoDia,
    dias: calendarioEntrega(madrid, ajustes, ocupacion, DIAS),
  });
};
