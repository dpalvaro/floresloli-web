/* GET /api/panel/dias?dias=60 → calendario: qué días se abre, el cupo de la web y los pedidos que hay. */

import { abreSegunCalendario, ahoraEnMadrid, diaSemanaDe, estadoDia, etiquetaFecha, sumarDias } from '../../../../compartido/fechas.ts';
import { TIENDA } from '../../../../compartido/tienda.ts';
import { ajustesDeDias, ocupacionPorDia, pedidosPorDia } from '../../../_lib/datos.ts';
import type { Env } from '../../../_lib/entorno.ts';
import { entornoDe } from '../../../_lib/entorno.ts';
import { json } from '../../../_lib/http.ts';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.DB!;
  const entorno = entornoDe(env);
  const ahora = new Date();
  const madrid = ahoraEnMadrid(ahora);
  const solicitados = Number(new URL(request.url).searchParams.get('dias'));
  const dias = Number.isInteger(solicitados) && solicitados > 0 ? Math.min(solicitados, 120) : TIENDA.diasAntelacionMax + 1;
  const hasta = sumarDias(madrid.fecha, dias);

  const [ajustes, ocupacion, totales] = await Promise.all([
    ajustesDeDias(db, madrid.fecha, hasta),
    ocupacionPorDia(db, entorno, madrid.fecha, hasta, ahora),
    pedidosPorDia(db, entorno, madrid.fecha, hasta),
  ]);

  const lista = [];
  for (let i = 0; i < dias; i++) {
    const fecha = sumarDias(madrid.fecha, i);
    const ajuste = ajustes.get(fecha) ?? null;
    const web = ocupacion.get(fecha) ?? 0;
    const estado = estadoDia(fecha, madrid, ajuste, web);
    const calendario = abreSegunCalendario(fecha);
    lista.push({
      fecha,
      etiqueta: etiquetaFecha(fecha, madrid.fecha),
      diaSemana: diaSemanaDe(fecha),
      /** Lo que dice el horario y la lista de festivos, sin contar los cambios hechos aquí. */
      abrePorDefecto: calendario.abre,
      motivoCierre: calendario.motivo,
      ajuste: ajuste ? { estado: ajuste.estado, cupo: ajuste.cupo, nota: ajuste.nota ?? '' } : null,
      cupo: ajuste?.cupo ?? TIENDA.cupoDiario,
      pedidosWeb: web,
      pedidosTotales: totales.get(fecha) ?? 0,
      disponible: estado.disponible,
      motivo: estado.motivo,
    });
  }

  return json({ hoy: madrid.fecha, cupoGeneral: TIENDA.cupoDiario, horaLimite: TIENDA.horaLimiteMismoDia, dias: lista });
};
