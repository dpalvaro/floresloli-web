/* Confirmación de un pago: la usan el webhook de Stripe, la comprobación directa y el pago simulado. */

import { avisarPedido } from './correo.ts';
import { guardarAjuste, leerPedido, lineasDe, marcarPagado } from './datos.ts';
import type { FilaPedido } from './datos.ts';
import type { Env } from './entorno.ts';
import { leerSesionDePago } from './stripe.ts';

/**
 * Da un pedido por pagado y manda los avisos. Es seguro llamarla varias veces:
 * solo actúa la primera.
 */
export async function confirmarPago(
  env: Env,
  ref: string,
  datos: { metodo: string; stripePago?: string; detalle: string },
  origen: string,
  enSegundoPlano: (tarea: Promise<unknown>) => void,
): Promise<boolean> {
  const db = env.DB!;
  const primeraVez = await marcarPagado(db, ref, datos);
  if (primeraVez) {
    enSegundoPlano(
      (async () => {
        const pedido = await leerPedido(db, ref);
        if (!pedido) return;
        const lineas = (await lineasDe(db, [ref])).get(ref) ?? [];
        await avisarPedido(env, pedido, lineas, origen);
      })().catch((error) => console.error('Aviso de pedido', ref, error)),
    );
  }
  return primeraVez;
}

/**
 * Pregunta a Stripe por el pago de un pedido que sigue pendiente. Sirve de red de seguridad
 * si el webhook tarda o no está bien configurado.
 */
export async function comprobarPagoEnStripe(
  env: Env,
  pedido: FilaPedido,
  origen: string,
  enSegundoPlano: (tarea: Promise<unknown>) => void,
): Promise<boolean> {
  if (pedido.estado !== 'pendiente_pago' || !pedido.stripe_sesion || !env.STRIPE_SECRET_KEY) return false;
  try {
    const sesion = await leerSesionDePago(env.STRIPE_SECRET_KEY, pedido.stripe_sesion);
    if (sesion?.payment_status === 'paid' && sesion?.client_reference_id === pedido.ref) {
      return confirmarPago(
        env,
        pedido.ref,
        { metodo: 'stripe', stripePago: String(sesion.payment_intent ?? ''), detalle: 'Pago confirmado consultando a Stripe' },
        origen,
        enSegundoPlano,
      );
    }
  } catch (error) {
    console.error('Comprobación de pago', pedido.ref, error);
  }
  return false;
}

export async function anotarUltimoAviso(env: Env, tipo: string): Promise<void> {
  await guardarAjuste(env.DB!, 'stripe_ultimo_aviso', JSON.stringify({ tipo, fecha: new Date().toISOString() }));
}
