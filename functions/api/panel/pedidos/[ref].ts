/* =====================================================================
   /api/panel/pedidos/<ref>
     GET   → un pedido con todos sus datos y su historial
     PATCH → cambia el estado, la nota interna, el cobro o el día de entrega

   Cancelar un pedido aquí NO devuelve el dinero: la devolución se hace en
   el panel de Stripe, y cuando Stripe avisa el pedido queda como «devuelto».
   ===================================================================== */

import { esFechaValida, fechaLarga } from '../../../../compartido/fechas.ts';
import { ESTADOS_MANUALES, limpiarTexto, nombreEstado } from '../../../../compartido/pedido.ts';
import type { EstadoPedido } from '../../../../compartido/pedido.ts';
import { actualizarPedido, eventosDe, leerPedido, lineasDe } from '../../../_lib/datos.ts';
import type { CambiosPedido, FilaPedido } from '../../../_lib/datos.ts';
import type { Env } from '../../../_lib/entorno.ts';
import { entornoDe } from '../../../_lib/entorno.ts';
import { fallo, json, leerJson } from '../../../_lib/http.ts';
import { FORMAS_DE_COBRO } from '../../../_lib/manual.ts';
import { vistaPanel } from '../../../_lib/vistas.ts';

async function buscar(env: Env, ref: unknown): Promise<FilaPedido | null> {
  const pedido = await leerPedido(env.DB!, String(ref ?? '').toUpperCase());
  // Cada entorno ve solo sus pedidos: los de prueba no aparecen en el panel real.
  return pedido && pedido.entorno === entornoDe(env) ? pedido : null;
}

async function respuesta(env: Env, ref: string): Promise<Response> {
  const db = env.DB!;
  const [pedido, lineas, eventos] = await Promise.all([leerPedido(db, ref), lineasDe(db, [ref]), eventosDe(db, ref)]);
  return json({ pedido: vistaPanel(pedido!, lineas.get(ref) ?? [], eventos) });
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const pedido = await buscar(env, params.ref);
  if (!pedido) return fallo(404, 'no-encontrado', 'No encontramos ese pedido.');
  return respuesta(env, pedido.ref);
};

interface Cambios {
  estado?: string;
  notaInterna?: string;
  pagado?: boolean;
  formaDeCobro?: string;
  fecha?: string;
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const pedido = await buscar(env, params.ref);
  if (!pedido) return fallo(404, 'no-encontrado', 'No encontramos ese pedido.');
  const d = (await leerJson(request, 4000)) as Cambios | null;
  if (!d) return fallo(400, 'datos', 'No hemos podido leer el cambio.');

  const cambios: CambiosPedido = {};
  const detalles: string[] = [];

  if (d.estado !== undefined && d.estado !== pedido.estado) {
    if (!ESTADOS_MANUALES.includes(d.estado as EstadoPedido)) return fallo(422, 'estado', 'Ese estado no se puede poner a mano.');
    // Un pedido de la web que no se ha pagado solo se puede cancelar: no se prepara nada sin cobrar.
    const sinPagarEnWeb = pedido.estado === 'pendiente_pago' || pedido.estado === 'caducado';
    if (sinPagarEnWeb && d.estado !== 'cancelado') {
      return fallo(422, 'estado', 'Este pedido no llegó a pagarse en la web. Si el cliente lo quiere, apúntalo como pedido nuevo.');
    }
    cambios.estado = d.estado as EstadoPedido;
    detalles.push(`Estado: de «${nombreEstado(pedido.estado)}» a «${nombreEstado(d.estado)}»`);
  }

  if (d.notaInterna !== undefined) {
    const nota = limpiarTexto(d.notaInterna, 500, true);
    if (nota !== pedido.nota_interna) {
      cambios.notaInterna = nota;
      detalles.push(nota ? 'Nota interna cambiada' : 'Nota interna borrada');
    }
  }

  if (d.pagado !== undefined) {
    // El cobro de los pedidos pagados en la web lo lleva Stripe: aquí no se toca.
    if (pedido.pago_metodo === 'stripe' || pedido.pago_metodo === 'simulado') {
      return fallo(422, 'pago', 'Este pedido se pagó en la web. El cobro y las devoluciones se llevan desde Stripe.');
    }
    const forma = (FORMAS_DE_COBRO as readonly string[]).includes(d.formaDeCobro ?? '') ? String(d.formaDeCobro) : '';
    const estadoPago = d.pagado ? 'pagado' : 'pendiente';
    if (estadoPago !== pedido.pago_estado || (d.pagado && forma && forma !== pedido.pago_metodo)) {
      cambios.pagoEstado = estadoPago;
      cambios.pagoMetodo = d.pagado ? forma || pedido.pago_metodo : pedido.pago_metodo === 'tienda' ? 'tienda' : '';
      detalles.push(d.pagado ? `Cobrado${forma ? ` (${forma})` : ''}` : 'Marcado como sin cobrar');
    }
  }

  if (d.fecha !== undefined && d.fecha !== pedido.entrega_fecha) {
    if (!esFechaValida(d.fecha)) return fallo(422, 'fecha', 'Esa fecha no es válida.');
    cambios.entregaFecha = d.fecha;
    detalles.push(`Entrega: del ${fechaLarga(pedido.entrega_fecha)} al ${fechaLarga(d.fecha)}`);
  }

  await actualizarPedido(env.DB!, pedido, cambios, detalles);
  return respuesta(env, pedido.ref);
};
