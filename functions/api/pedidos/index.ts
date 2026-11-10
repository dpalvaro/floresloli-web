/* =====================================================================
   POST /api/pedidos → crea un pedido y devuelve la dirección de pago.

   El navegador manda qué quiere y a dónde; aquí se recalcula todo
   (precios, envío, fechas y cupo) con los datos del servidor. Lo que
   diga el navegador sobre importes no se usa.
   ===================================================================== */

import { catalogoCompra } from '../../../compartido/catalogo.ts';
import { ahoraEnMadrid, estadoDia } from '../../../compartido/fechas.ts';
import { NEGOCIO } from '../../../compartido/negocio.ts';
import { validarPedido } from '../../../compartido/pedido.ts';
import type { PedidoEntrada } from '../../../compartido/pedido.ts';
import { TIENDA, nombreMetodo } from '../../../compartido/tienda.ts';
import { avisarPedido } from '../../_lib/correo.ts';
import {
  ajustesDeDias,
  anotarEvento,
  caducarPedido,
  caducarVencidos,
  crearPedido,
  leerPedido,
  lineasDe,
  ocupacionPorDia,
  permitir,
} from '../../_lib/datos.ts';
import type { Env } from '../../_lib/entorno.ts';
import { estadoTienda } from '../../_lib/entorno.ts';
import { fallo, igualesSeguro, ipDe, json, leerJson, mismoOrigen, sha256 } from '../../_lib/http.ts';
import { crearSesionDePago } from '../../_lib/stripe.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const tienda = estadoTienda(env);
  const sinVenta = () => fallo(503, 'sin-venta-online', 'Ahora mismo los encargos se hacen por WhatsApp o por teléfono.', { porWhatsApp: true });
  if (!tienda.baseDatos) return sinVenta();
  if (!mismoOrigen(request)) return fallo(403, 'origen', 'Petición no permitida.');

  const db = env.DB!;
  const ahora = new Date();

  const clave = 'pedido:' + (await sha256((env.SECRETO_SESION ?? 'floresloli') + ipDe(request))).slice(0, 24);
  if (!(await permitir(db, clave, 8, 600, ahora))) {
    return fallo(429, 'demasiados-intentos', `Has hecho muchos intentos seguidos. Espera unos minutos o llámanos al ${NEGOCIO.telefono}.`);
  }

  const entrada = (await leerJson(request)) as PedidoEntrada | null;
  if (!entrada) return fallo(400, 'datos', 'No hemos podido leer el pedido. Recarga la página e inténtalo de nuevo.');
  // Campo trampa: las personas no lo ven, así que solo lo rellenan los robots.
  if (typeof entrada.web === 'string' && entrada.web.trim() !== '') {
    return fallo(400, 'datos', 'No hemos podido leer el pedido. Recarga la página e inténtalo de nuevo.');
  }

  // Pagar al recoger: solo si está activado en compartido/tienda.ts y el pedido se recoge en la tienda.
  const pagaEnTienda = TIENDA.pagoEnTienda && entrada.pagoEnTienda === true && entrada.entrega?.metodo === 'recogida';
  if (!pagaEnTienda && !tienda.pedidosOnline) return sinVenta();

  const validacion = validarPedido(entrada, catalogoCompra(tienda.entorno));
  if (!validacion.ok) {
    return json(
      { error: 'validacion', mensaje: 'Revisa los datos marcados.', errores: validacion.errores, porWhatsApp: validacion.porWhatsApp ?? false },
      422,
    );
  }
  const pedido = validacion.pedido;
  if (pedido.total < 50) return fallo(422, 'importe', 'El importe del pedido es demasiado bajo para pagarlo en la web.');

  // Si el cliente volvió atrás desde el pago y lo intenta otra vez, se libera el hueco del intento anterior.
  if (entrada.sustituye?.ref && entrada.sustituye?.token) {
    const anterior = await leerPedido(db, String(entrada.sustituye.ref));
    if (anterior && igualesSeguro(anterior.token, String(entrada.sustituye.token))) {
      await caducarPedido(db, anterior.ref, 'Sustituido por un nuevo intento del cliente', ahora);
    }
  }
  await caducarVencidos(db, ahora);

  // Día de entrega: abierto, dentro de hora y con hueco.
  const fecha = pedido.entrega.fecha;
  const [ajustes, ocupacion] = await Promise.all([
    ajustesDeDias(db, fecha, fecha),
    ocupacionPorDia(db, tienda.entorno, fecha, fecha, ahora),
  ]);
  const dia = estadoDia(fecha, ahoraEnMadrid(ahora), ajustes.get(fecha), ocupacion.get(fecha) ?? 0);
  if (!dia.disponible) {
    return json({ error: 'fecha', mensaje: dia.aviso, errores: { 'entrega.fecha': dia.aviso } }, 409);
  }

  const origen = new URL(request.url).origin;

  if (pagaEnTienda) {
    const { ref, token } = await crearPedido(
      db,
      { pedido, entorno: tienda.entorno, origen: 'web', estado: 'nuevo', pagoEstado: 'pendiente', pagoMetodo: 'tienda', autor: 'cliente' },
      ahora,
    );
    waitUntil(
      (async () => {
        const fila = await leerPedido(db, ref);
        if (fila) await avisarPedido(env, fila, (await lineasDe(db, [ref])).get(ref) ?? [], origen);
      })().catch((error) => console.error('Aviso de pedido', ref, error)),
    );
    return json({ ref, token, url: `/pedido/gracias/?ref=${ref}&t=${token}` }, 201);
  }

  const { ref, token } = await crearPedido(
    db,
    { pedido, entorno: tienda.entorno, origen: 'web', estado: 'pendiente_pago', pagoEstado: 'pendiente', pagoMetodo: tienda.pago!, autor: 'cliente' },
    ahora,
  );

  if (tienda.pago === 'simulado') {
    return json({ ref, token, url: `/pedido/pago-de-prueba/?ref=${ref}&t=${token}` }, 201);
  }

  try {
    const lineas = pedido.lineas.map((l) => ({
      nombre: l.detalle ? `${l.nombre} (${l.detalle})` : l.nombre,
      importe: l.precioUnidad!,
      cantidad: l.cantidad,
    }));
    if (pedido.envio > 0) lineas.push({ nombre: nombreMetodo(pedido.entrega.metodo), importe: pedido.envio, cantidad: 1 });

    const sesion = await crearSesionDePago(
      env.STRIPE_SECRET_KEY!,
      {
        ref,
        email: pedido.comprador.email,
        lineas,
        urlExito: `${origen}/pedido/gracias/?ref=${ref}&t=${token}`,
        urlCancelacion: `${origen}/pedido/?cancelado=1`,
        minutos: TIENDA.minutosReserva,
        descripcion: `Pedido ${ref} · ${NEGOCIO.nombre}`,
      },
      ahora,
    );
    await db.prepare('UPDATE pedidos SET stripe_sesion = ? WHERE ref = ?').bind(sesion.id, ref).run();
    return json({ ref, token, url: sesion.url }, 201);
  } catch (error) {
    console.error('No se pudo crear la sesión de pago', ref, error);
    await db.batch([
      db.prepare(`UPDATE pedidos SET estado = 'cancelado', actualizado = ? WHERE ref = ?`).bind(new Date().toISOString(), ref),
      anotarEvento(db, ref, 'error-pago', 'No se pudo abrir la página de pago de Stripe'),
    ]);
    return fallo(
      502,
      'pago',
      `No hemos podido abrir la página de pago. No se ha cobrado nada. Inténtalo de nuevo o llámanos al ${NEGOCIO.telefono}.`,
    );
  }
};
