/* =====================================================================
   POST /api/pruebas/pago → pago simulado.

   Solo existe en el entorno de pruebas y solo cuando no hay Stripe de
   prueba configurado. Sirve para probar el circuito completo (pedido,
   panel, avisos) sin dinero de por medio. En producción responde 404.
   ===================================================================== */

import { caducarPedido, leerPedido } from '../../_lib/datos.ts';
import type { Env } from '../../_lib/entorno.ts';
import { estadoTienda } from '../../_lib/entorno.ts';
import { fallo, igualesSeguro, json, leerJson, mismoOrigen } from '../../_lib/http.ts';
import { confirmarPago } from '../../_lib/pagos.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const tienda = estadoTienda(env);
  if (tienda.entorno !== 'pruebas' || tienda.pago !== 'simulado' || !env.DB) {
    return fallo(404, 'no-encontrado', 'No existe.');
  }
  if (!mismoOrigen(request)) return fallo(403, 'origen', 'Petición no permitida.');

  const datos = (await leerJson(request, 2000)) as { ref?: string; token?: string; resultado?: string } | null;
  const pedido = datos?.ref ? await leerPedido(env.DB, String(datos.ref)) : null;
  if (!pedido || !igualesSeguro(pedido.token, String(datos?.token ?? ''))) {
    return fallo(404, 'no-encontrado', 'No encontramos ese pedido.');
  }

  if (datos?.resultado === 'cancelado') {
    await caducarPedido(env.DB, pedido.ref, 'Pago simulado: cancelado por el cliente');
    return json({ ok: true, estado: 'caducado' });
  }

  await confirmarPago(
    env,
    pedido.ref,
    { metodo: 'simulado', detalle: 'Pago simulado (entorno de pruebas)' },
    new URL(request.url).origin,
    (tarea) => waitUntil(tarea),
  );
  return json({ ok: true, estado: 'pagado' });
};
