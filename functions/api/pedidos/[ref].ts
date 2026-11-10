/* GET /api/pedidos/<ref>?t=<token> → estado del pedido para la página de confirmación del cliente. */

import { leerPedido, lineasDe } from '../../_lib/datos.ts';
import type { Env } from '../../_lib/entorno.ts';
import { fallo, igualesSeguro, json } from '../../_lib/http.ts';
import { comprobarPagoEnStripe } from '../../_lib/pagos.ts';
import { vistaCliente } from '../../_lib/vistas.ts';

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params, waitUntil }) => {
  if (!env.DB) return fallo(503, 'sin-base-de-datos', 'El estado de los pedidos no está disponible ahora mismo.');
  const url = new URL(request.url);
  const ref = String(params.ref ?? '').toUpperCase();
  const token = url.searchParams.get('t') ?? '';

  let pedido = await leerPedido(env.DB, ref);
  if (!pedido || !igualesSeguro(pedido.token, token)) return fallo(404, 'no-encontrado', 'No encontramos ese pedido.');

  // Red de seguridad: si el aviso de Stripe aún no ha llegado, se le pregunta directamente.
  if (pedido.estado === 'pendiente_pago' && pedido.pago_metodo === 'stripe') {
    const confirmado = await comprobarPagoEnStripe(env, pedido, url.origin, (tarea) => waitUntil(tarea));
    if (confirmado) pedido = (await leerPedido(env.DB, ref))!;
  }

  const lineas = (await lineasDe(env.DB, [ref])).get(ref) ?? [];
  return json(vistaCliente(pedido, lineas));
};
