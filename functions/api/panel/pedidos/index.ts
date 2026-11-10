/* =====================================================================
   /api/panel/pedidos
     GET  → lista de pedidos (el libro de pedidos), con filtros
            ?vista=marcha|hoy|proximos|todos  ?q=texto  ?desde= ?hasta= ?estado=
     POST → apunta un pedido del mostrador, del teléfono o de WhatsApp
   ===================================================================== */

import { ahoraEnMadrid, esFechaValida, sumarDias } from '../../../../compartido/fechas.ts';
import { ESTADOS, ESTADOS_EN_MARCHA } from '../../../../compartido/pedido.ts';
import type { EstadoPedido } from '../../../../compartido/pedido.ts';
import { caducarVencidos, crearPedido, leerPedido, lineasDe, listarPedidos, resumenPanel } from '../../../_lib/datos.ts';
import type { FiltroPedidos } from '../../../_lib/datos.ts';
import type { Env } from '../../../_lib/entorno.ts';
import { entornoDe } from '../../../_lib/entorno.ts';
import { json, leerJson } from '../../../_lib/http.ts';
import { validarPedidoManual } from '../../../_lib/manual.ts';
import { vistaPanel } from '../../../_lib/vistas.ts';

const VISIBLES: EstadoPedido[] = ['nuevo', 'en_preparacion', 'listo', 'en_reparto', 'entregado', 'cancelado'];

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.DB!;
  const entorno = entornoDe(env);
  const url = new URL(request.url);
  const ahora = new Date();
  const hoy = ahoraEnMadrid(ahora).fecha;
  const manana = sumarDias(hoy, 1);
  await caducarVencidos(db, ahora);

  const vista = url.searchParams.get('vista') ?? 'marcha';
  const filtro: FiltroPedidos = { entorno, q: url.searchParams.get('q') ?? '' };

  if (vista === 'hoy') {
    filtro.desde = hoy;
    filtro.hasta = hoy;
    filtro.estados = VISIBLES;
  } else if (vista === 'proximos') {
    filtro.desde = manana;
    filtro.estados = ESTADOS_EN_MARCHA;
  } else if (vista === 'todos') {
    const desde = url.searchParams.get('desde');
    const hasta = url.searchParams.get('hasta');
    const estado = url.searchParams.get('estado');
    if (esFechaValida(desde)) filtro.desde = desde;
    if (esFechaValida(hasta)) filtro.hasta = hasta;
    // Los pedidos sin pagar (esperando el pago o caducados) solo salen si se piden expresamente.
    filtro.estados = ESTADOS.some((e) => e.id === estado) ? [estado as EstadoPedido] : VISIBLES;
    filtro.orden = 'creado';
  } else {
    // «En marcha»: todo lo que está por hacer, con lo más urgente arriba.
    filtro.estados = ESTADOS_EN_MARCHA;
  }

  const [pedidos, resumen] = await Promise.all([listarPedidos(db, filtro), resumenPanel(db, entorno, hoy, manana)]);
  const lineas = await lineasDe(db, pedidos.map((p) => p.ref));

  return json({
    hoy,
    manana,
    vista,
    resumen,
    pedidos: pedidos.map((p) => vistaPanel(p, lineas.get(p.ref) ?? [])),
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.DB!;
  const validacion = validarPedidoManual(await leerJson(request));
  if (!validacion.ok) return json({ error: 'validacion', mensaje: 'Revisa los datos marcados.', errores: validacion.errores }, 422);

  const { ref } = await crearPedido(db, {
    pedido: validacion.pedido,
    entorno: entornoDe(env),
    origen: validacion.origen,
    estado: 'nuevo',
    pagoEstado: validacion.pagado ? 'pagado' : 'pendiente',
    pagoMetodo: validacion.pagado ? validacion.formaDeCobro : '',
    notaInterna: validacion.notaInterna,
    autor: 'tienda',
  });

  const pedido = (await leerPedido(db, ref))!;
  const lineas = (await lineasDe(db, [ref])).get(ref) ?? [];
  return json({ ok: true, pedido: vistaPanel(pedido, lineas) }, 201);
};
