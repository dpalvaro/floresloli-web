/* PUT /api/panel/dias/<AAAA-MM-DD> → abre o cierra un día concreto y le cambia el cupo de pedidos de la web. */

import { esFechaValida } from '../../../../compartido/fechas.ts';
import { limpiarTexto } from '../../../../compartido/pedido.ts';
import { guardarAjusteDia } from '../../../_lib/datos.ts';
import type { Env } from '../../../_lib/entorno.ts';
import { fallo, json, leerJson } from '../../../_lib/http.ts';

export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  const fecha = String(params.fecha ?? '');
  if (!esFechaValida(fecha)) return fallo(422, 'fecha', 'Esa fecha no es válida.');
  const d = (await leerJson(request, 2000)) as { estado?: string | null; cupo?: number | null; nota?: string } | null;
  if (!d) return fallo(400, 'datos', 'No hemos podido leer el cambio.');

  const estado = d.estado === 'abierto' || d.estado === 'cerrado' ? d.estado : null;
  let cupo: number | null = null;
  if (d.cupo !== null && d.cupo !== undefined && String(d.cupo) !== '') {
    cupo = Number(d.cupo);
    if (!Number.isInteger(cupo) || cupo < 0 || cupo > 500) return fallo(422, 'cupo', 'El cupo tiene que ser un número entre 0 y 500.');
  }

  await guardarAjusteDia(env.DB!, { fecha, estado, cupo, nota: limpiarTexto(d.nota, 120) });
  return json({ ok: true, fecha, ajuste: estado === null && cupo === null && !d.nota ? null : { estado, cupo, nota: limpiarTexto(d.nota, 120) } });
};
