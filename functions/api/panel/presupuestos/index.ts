/* GET /api/panel/presupuestos → solicitudes de presupuesto (bodas, comuniones, eventos y empresas). */

import { TIPOS_PRESUPUESTO } from '../../../../compartido/pedido.ts';
import { ESTADOS_PRESUPUESTO, listarPresupuestos } from '../../../_lib/datos.ts';
import type { Env } from '../../../_lib/entorno.ts';
import { entornoDe } from '../../../_lib/entorno.ts';
import { json } from '../../../_lib/http.ts';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const filas = await listarPresupuestos(env.DB!, entornoDe(env));
  return json({
    estados: ESTADOS_PRESUPUESTO,
    presupuestos: filas.map((p) => ({
      ref: p.ref,
      creado: p.creado,
      tipo: p.tipo,
      tipoNombre: TIPOS_PRESUPUESTO.find((t) => t.id === p.tipo)?.nombre ?? p.tipo,
      fechaEvento: p.fecha_evento,
      nombre: p.nombre,
      telefono: p.telefono,
      email: p.email,
      mensaje: p.mensaje,
      estado: p.estado,
      notaInterna: p.nota_interna,
      prueba: p.entorno === 'pruebas',
    })),
  });
};
