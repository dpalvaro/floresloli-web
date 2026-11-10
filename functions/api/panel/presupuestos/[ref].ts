/* PATCH /api/panel/presupuestos/<ref> → cambia el estado o la nota interna de una solicitud. */

import { limpiarTexto } from '../../../../compartido/pedido.ts';
import { ESTADOS_PRESUPUESTO, actualizarPresupuesto } from '../../../_lib/datos.ts';
import type { Env } from '../../../_lib/entorno.ts';
import { fallo, json, leerJson } from '../../../_lib/http.ts';

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const d = (await leerJson(request, 4000)) as { estado?: string; notaInterna?: string } | null;
  if (!d) return fallo(400, 'datos', 'No hemos podido leer el cambio.');
  const cambios: { estado?: string; notaInterna?: string } = {};
  if (d.estado !== undefined) {
    if (!(ESTADOS_PRESUPUESTO as readonly string[]).includes(d.estado)) return fallo(422, 'estado', 'Ese estado no existe.');
    cambios.estado = d.estado;
  }
  if (d.notaInterna !== undefined) cambios.notaInterna = limpiarTexto(d.notaInterna, 500, true);
  const cambiado = await actualizarPresupuesto(env.DB!, String(params.ref ?? '').toUpperCase(), cambios);
  if (!cambiado) return fallo(404, 'no-encontrado', 'No encontramos esa solicitud.');
  return json({ ok: true });
};
