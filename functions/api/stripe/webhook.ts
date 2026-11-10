/* =====================================================================
   POST /api/stripe/webhook → avisos de Stripe (pago hecho, caducado, devuelto).

   En Stripe: Desarrolladores › Webhooks › Añadir destino, con la dirección
   https://<dominio>/api/stripe/webhook y estos eventos:
     checkout.session.completed
     checkout.session.async_payment_succeeded
     checkout.session.async_payment_failed
     checkout.session.expired
     charge.refunded
   El «secreto de firma» (whsec_…) va en la variable STRIPE_WEBHOOK_SECRET.
   ===================================================================== */

import { anotarEvento, caducarPedido, leerPedido } from '../../_lib/datos.ts';
import type { Env } from '../../_lib/entorno.ts';
import { entornoDe } from '../../_lib/entorno.ts';
import { fallo, json } from '../../_lib/http.ts';
import { anotarUltimoAviso, confirmarPago } from '../../_lib/pagos.ts';
import { verificarAviso } from '../../_lib/stripe.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  if (!env.DB || !env.STRIPE_WEBHOOK_SECRET) return fallo(503, 'sin-configurar', 'Webhook sin configurar.');
  const db = env.DB;

  const cuerpo = await request.text();
  const evento = await verificarAviso(cuerpo, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!evento?.id || !evento?.type) return fallo(400, 'firma', 'Firma no válida.');

  // Los avisos de prueba no tocan pedidos reales, ni al revés.
  const real = evento.livemode === true;
  if (real !== (entornoDe(env) === 'produccion')) return json({ recibido: true, ignorado: 'modo distinto del entorno' });

  // Stripe puede repetir un aviso: si ya se procesó, no se hace nada.
  const visto = await db.prepare('SELECT 1 AS si FROM stripe_eventos WHERE id = ?').bind(evento.id).first();
  if (visto) return json({ recibido: true, repetido: true });

  const objeto = evento.data?.object ?? {};
  const origen = new URL(request.url).origin;

  switch (evento.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const ref = String(objeto.client_reference_id ?? objeto.metadata?.ref ?? '');
      if (!ref || objeto.payment_status !== 'paid') break;
      const pedido = await leerPedido(db, ref);
      if (!pedido) break;
      await confirmarPago(
        env,
        ref,
        { metodo: 'stripe', stripePago: String(objeto.payment_intent ?? ''), detalle: 'Pago confirmado por Stripe' },
        origen,
        (tarea) => waitUntil(tarea),
      );
      if (objeto.amount_total !== pedido.total) {
        await anotarEvento(db, ref, 'revisar', `Stripe cobró ${objeto.amount_total} céntimos y el pedido suma ${pedido.total}. Revísalo.`).run();
      }
      break;
    }
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed': {
      const ref = String(objeto.client_reference_id ?? objeto.metadata?.ref ?? '');
      if (ref) await caducarPedido(db, ref, evento.type === 'checkout.session.expired' ? 'La página de pago caducó sin pagar' : 'El pago no se completó');
      break;
    }
    case 'charge.refunded': {
      const pago = String(objeto.payment_intent ?? '');
      const ref = String(objeto.metadata?.ref ?? '');
      const pedido = ref
        ? await leerPedido(db, ref)
        : pago
          ? await db.prepare('SELECT * FROM pedidos WHERE stripe_pago = ?').bind(pago).first<{ ref: string }>()
          : null;
      if (!pedido) break;
      const todo = objeto.refunded === true;
      const sentencias = [
        anotarEvento(db, pedido.ref, 'devolucion', `${todo ? 'Devolución completa' : 'Devolución parcial'} en Stripe: ${objeto.amount_refunded ?? '?'} céntimos devueltos en total`),
      ];
      if (todo) sentencias.push(db.prepare(`UPDATE pedidos SET pago_estado = 'reembolsado', actualizado = ? WHERE ref = ?`).bind(new Date().toISOString(), pedido.ref));
      await db.batch(sentencias);
      break;
    }
    default:
      break;
  }

  // Se apunta al final: si algo falla antes, Stripe reintenta y se vuelve a procesar.
  await db.prepare('INSERT OR IGNORE INTO stripe_eventos (id, tipo, recibido) VALUES (?,?,?)').bind(evento.id, evento.type, new Date().toISOString()).run();
  await anotarUltimoAviso(env, evento.type);
  return json({ recibido: true });
};
