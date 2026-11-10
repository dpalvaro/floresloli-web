/* =====================================================================
   ACCESO A LA BASE DE DATOS: pedidos, días, presupuestos y límites.
   Importes en céntimos. Fechas de entrega «AAAA-MM-DD». Marcas de tiempo ISO en UTC.
   ===================================================================== */

import type { Entorno } from '../../compartido/catalogo.ts';
import type { AjusteDia } from '../../compartido/fechas.ts';
import { ahoraEnMadrid } from '../../compartido/fechas.ts';
import type { EstadoPedido, LineaCalculada, PedidoValidado } from '../../compartido/pedido.ts';
import { ESTADOS_QUE_OCUPAN } from '../../compartido/pedido.ts';
import { TIENDA } from '../../compartido/tienda.ts';
import { aleatorioHex } from './http.ts';

export interface FilaPedido {
  ref: string;
  token: string;
  creado: string;
  actualizado: string;
  entorno: string;
  origen: string;
  estado: EstadoPedido;
  pago_estado: 'pendiente' | 'pagado' | 'reembolsado';
  pago_metodo: string;
  stripe_sesion: string;
  stripe_pago: string;
  entrega_metodo: 'recogida' | 'domicilio' | 'hospital';
  entrega_fecha: string;
  entrega_nota: string;
  comprador_nombre: string;
  comprador_telefono: string;
  comprador_email: string;
  dest_nombre: string;
  dest_telefono: string;
  dest_direccion: string;
  dest_cp: string;
  dest_localidad: string;
  dest_detalle: string;
  dedicatoria: string;
  observaciones: string;
  nota_interna: string;
  subtotal: number;
  envio: number;
  total: number;
  iva: string;
  acepto: string;
}

export interface FilaLinea {
  id: number;
  ref: string;
  producto: string;
  nombre: string;
  detalle: string;
  cantidad: number;
  precio_unidad: number;
  total: number;
  iva: string;
  nota: string;
}

export interface FilaEvento {
  id: number;
  ref: string;
  fecha: string;
  tipo: string;
  detalle: string;
  autor: string;
}

const LETRAS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Referencia corta y fácil de dictar por teléfono: «L261110-7KQ2». */
export function nuevaReferencia(ahora: Date, prefijo = 'L'): string {
  const hoy = ahoraEnMadrid(ahora).fecha;
  const azar = crypto.getRandomValues(new Uint8Array(4));
  let cola = '';
  for (const b of azar) cola += LETRAS[b % LETRAS.length];
  return `${prefijo}${hoy.slice(2, 4)}${hoy.slice(5, 7)}${hoy.slice(8, 10)}-${cola}`;
}

/* ------------------------------------------------------------------ */
/* Pedidos                                                             */
/* ------------------------------------------------------------------ */

export interface AltaPedido {
  pedido: PedidoValidado;
  entorno: Entorno;
  origen: 'web' | 'tienda' | 'telefono' | 'whatsapp';
  estado: EstadoPedido;
  pagoEstado: 'pendiente' | 'pagado';
  pagoMetodo: string;
  notaInterna?: string;
  autor: string;
}

export async function crearPedido(db: D1Database, alta: AltaPedido, ahora: Date = new Date()): Promise<{ ref: string; token: string }> {
  const p = alta.pedido;
  const token = aleatorioHex(16);
  const marca = ahora.toISOString();
  let ultimoError: unknown;

  // La referencia es aleatoria: si coincide con una existente (muy raro), se prueba otra.
  for (let intento = 0; intento < 4; intento++) {
    const ref = nuevaReferencia(ahora);
    const sentencias = [
      db
        .prepare(
          `INSERT INTO pedidos (ref, token, creado, actualizado, entorno, origen, estado, pago_estado, pago_metodo,
            entrega_metodo, entrega_fecha, entrega_nota, comprador_nombre, comprador_telefono, comprador_email,
            dest_nombre, dest_telefono, dest_direccion, dest_cp, dest_localidad, dest_detalle,
            dedicatoria, observaciones, nota_interna, subtotal, envio, total, iva, acepto)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          ref, token, marca, marca, alta.entorno, alta.origen, alta.estado, alta.pagoEstado, alta.pagoMetodo,
          p.entrega.metodo, p.entrega.fecha, p.entrega.nota, p.comprador.nombre, p.comprador.telefono, p.comprador.email,
          p.destinatario.nombre, p.destinatario.telefono, p.direccion.calle, p.direccion.cp, p.direccion.localidad, p.hospitalDetalle,
          p.dedicatoria, p.observaciones, alta.notaInterna ?? '', p.subtotal, p.envio, p.total, JSON.stringify(p.iva),
          alta.origen === 'web' ? marca : '',
        ),
      ...p.lineas.map((l: LineaCalculada) =>
        db
          .prepare('INSERT INTO pedido_lineas (ref, producto, nombre, detalle, cantidad, precio_unidad, total, iva, nota) VALUES (?,?,?,?,?,?,?,?,?)')
          .bind(ref, l.id, l.nombre, l.detalle ?? '', l.cantidad, l.precioUnidad ?? 0, l.total ?? 0, l.iva, l.nota ?? ''),
      ),
      db
        .prepare('INSERT INTO pedido_eventos (ref, fecha, tipo, detalle, autor) VALUES (?,?,?,?,?)')
        .bind(ref, marca, 'creado', alta.origen === 'web' ? 'Pedido hecho en la web' : `Pedido apuntado a mano (${alta.origen})`, alta.autor),
    ];
    try {
      await db.batch(sentencias);
      return { ref, token };
    } catch (error) {
      ultimoError = error;
      if (!/UNIQUE|PRIMARY/i.test(String(error))) break;
    }
  }
  throw ultimoError;
}

export async function leerPedido(db: D1Database, ref: string): Promise<FilaPedido | null> {
  return db.prepare('SELECT * FROM pedidos WHERE ref = ?').bind(ref).first<FilaPedido>();
}

export async function lineasDe(db: D1Database, refs: string[]): Promise<Map<string, FilaLinea[]>> {
  const mapa = new Map<string, FilaLinea[]>();
  // D1 admite hasta 100 parámetros por consulta.
  for (let i = 0; i < refs.length; i += 90) {
    const trozo = refs.slice(i, i + 90);
    const { results } = await db
      .prepare(`SELECT * FROM pedido_lineas WHERE ref IN (${trozo.map(() => '?').join(',')}) ORDER BY id`)
      .bind(...trozo)
      .all<FilaLinea>();
    for (const l of results) {
      if (!mapa.has(l.ref)) mapa.set(l.ref, []);
      mapa.get(l.ref)!.push(l);
    }
  }
  return mapa;
}

export async function eventosDe(db: D1Database, ref: string): Promise<FilaEvento[]> {
  const { results } = await db.prepare('SELECT * FROM pedido_eventos WHERE ref = ? ORDER BY id').bind(ref).all<FilaEvento>();
  return results;
}

export function anotarEvento(db: D1Database, ref: string, tipo: string, detalle: string, autor = 'sistema', ahora: Date = new Date()) {
  return db
    .prepare('INSERT INTO pedido_eventos (ref, fecha, tipo, detalle, autor) VALUES (?,?,?,?,?)')
    .bind(ref, ahora.toISOString(), tipo, detalle, autor);
}

/**
 * Marca un pedido como pagado. Devuelve true solo la primera vez (para no avisar dos veces
 * si Stripe repite el aviso o si llegan a la vez el webhook y la comprobación directa).
 */
export async function marcarPagado(
  db: D1Database,
  ref: string,
  datos: { metodo: string; stripePago?: string; detalle: string },
  ahora: Date = new Date(),
): Promise<boolean> {
  const marca = ahora.toISOString();
  const res = await db
    .prepare(
      `UPDATE pedidos SET estado = 'nuevo', pago_estado = 'pagado', pago_metodo = ?, stripe_pago = ?, actualizado = ?
       WHERE ref = ? AND estado IN ('pendiente_pago', 'caducado')`,
    )
    .bind(datos.metodo, datos.stripePago ?? '', marca, ref)
    .run();
  const cambiado = (res.meta?.changes ?? 0) > 0;
  if (cambiado) await anotarEvento(db, ref, 'pagado', datos.detalle, 'sistema', ahora).run();
  return cambiado;
}

/** Da por caducado un pedido que sigue sin pagar. Devuelve true si cambió algo. */
export async function caducarPedido(db: D1Database, ref: string, detalle: string, ahora: Date = new Date()): Promise<boolean> {
  const res = await db
    .prepare(`UPDATE pedidos SET estado = 'caducado', actualizado = ? WHERE ref = ? AND estado = 'pendiente_pago'`)
    .bind(ahora.toISOString(), ref)
    .run();
  const cambiado = (res.meta?.changes ?? 0) > 0;
  if (cambiado) await anotarEvento(db, ref, 'caducado', detalle, 'sistema', ahora).run();
  return cambiado;
}

/** Caduca los pedidos sin pagar cuyo plazo de pago ya pasó (con unos minutos de margen). */
export async function caducarVencidos(db: D1Database, ahora: Date = new Date()): Promise<void> {
  const limite = new Date(ahora.getTime() - (TIENDA.minutosReserva + 10) * 60_000).toISOString();
  await db
    .prepare(`UPDATE pedidos SET estado = 'caducado', actualizado = ? WHERE estado = 'pendiente_pago' AND creado < ?`)
    .bind(ahora.toISOString(), limite)
    .run();
}

/**
 * Pedidos de la web que ocupan hueco, por día de entrega: los pagados (en cualquier estado
 * posterior) y los que están pagándose ahora mismo (reserva de unos minutos).
 */
export async function ocupacionPorDia(db: D1Database, desde: string, hasta: string, ahora: Date = new Date()): Promise<Map<string, number>> {
  const reserva = new Date(ahora.getTime() - TIENDA.minutosReserva * 60_000).toISOString();
  const estados = ESTADOS_QUE_OCUPAN.map((e) => `'${e}'`).join(',');
  const { results } = await db
    .prepare(
      `SELECT entrega_fecha AS fecha, COUNT(*) AS n FROM pedidos
       WHERE origen = 'web' AND entrega_fecha BETWEEN ? AND ?
         AND (estado IN (${estados}) OR (estado = 'pendiente_pago' AND creado > ?))
       GROUP BY entrega_fecha`,
    )
    .bind(desde, hasta, reserva)
    .all<{ fecha: string; n: number }>();
  return new Map(results.map((r) => [r.fecha, r.n]));
}

/* ------------------------------------------------------------------ */
/* Días (cierres, aperturas y cupos puestos desde el panel)            */
/* ------------------------------------------------------------------ */

export async function ajustesDeDias(db: D1Database, desde: string, hasta: string): Promise<Map<string, AjusteDia>> {
  const { results } = await db
    .prepare('SELECT fecha, estado, cupo, nota FROM dias WHERE fecha BETWEEN ? AND ?')
    .bind(desde, hasta)
    .all<{ fecha: string; estado: string | null; cupo: number | null; nota: string }>();
  return new Map(
    results.map((r) => [
      r.fecha,
      { fecha: r.fecha, estado: r.estado === 'abierto' || r.estado === 'cerrado' ? r.estado : null, cupo: r.cupo, nota: r.nota },
    ]),
  );
}

export async function guardarAjusteDia(db: D1Database, ajuste: AjusteDia, ahora: Date = new Date()): Promise<void> {
  if (ajuste.estado === null && ajuste.cupo === null && !ajuste.nota) {
    await db.prepare('DELETE FROM dias WHERE fecha = ?').bind(ajuste.fecha).run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO dias (fecha, estado, cupo, nota, actualizado) VALUES (?,?,?,?,?)
       ON CONFLICT(fecha) DO UPDATE SET estado = excluded.estado, cupo = excluded.cupo, nota = excluded.nota, actualizado = excluded.actualizado`,
    )
    .bind(ajuste.fecha, ajuste.estado, ajuste.cupo, ajuste.nota ?? '', ahora.toISOString())
    .run();
}

/* ------------------------------------------------------------------ */
/* Límites de uso (contra abusos) y ajustes sueltos                    */
/* ------------------------------------------------------------------ */

/**
 * Cuenta un intento y dice si se permite: como mucho `max` cada `ventana` segundos por clave.
 * La clave lleva la IP resumida (hash), nunca la IP tal cual.
 */
export async function permitir(db: D1Database, clave: string, max: number, ventana: number, ahora: Date = new Date()): Promise<boolean> {
  const t = Math.floor(ahora.getTime() / 1000);
  const fila = await db
    .prepare(
      `INSERT INTO limites (clave, n, caduca) VALUES (?1, 1, ?2)
       ON CONFLICT(clave) DO UPDATE SET
         n = CASE WHEN limites.caduca <= ?3 THEN 1 ELSE limites.n + 1 END,
         caduca = CASE WHEN limites.caduca <= ?3 THEN ?2 ELSE limites.caduca END
       RETURNING n`,
    )
    .bind(clave, t + ventana, t)
    .first<{ n: number }>();
  if (Math.random() < 0.02) await db.prepare('DELETE FROM limites WHERE caduca < ?').bind(t - 86400).run();
  return (fila?.n ?? 1) <= max;
}

export async function leerAjuste(db: D1Database, clave: string): Promise<string | null> {
  const fila = await db.prepare('SELECT valor FROM ajustes WHERE clave = ?').bind(clave).first<{ valor: string }>();
  return fila?.valor ?? null;
}

export async function guardarAjuste(db: D1Database, clave: string, valor: string): Promise<void> {
  await db
    .prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor')
    .bind(clave, valor)
    .run();
}
