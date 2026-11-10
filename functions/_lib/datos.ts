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
 * Solo cuentan los del mismo entorno: un pedido de prueba no quita hueco a los reales.
 */
export async function ocupacionPorDia(
  db: D1Database,
  entorno: Entorno,
  desde: string,
  hasta: string,
  ahora: Date = new Date(),
): Promise<Map<string, number>> {
  const reserva = new Date(ahora.getTime() - TIENDA.minutosReserva * 60_000).toISOString();
  const estados = ESTADOS_QUE_OCUPAN.map((e) => `'${e}'`).join(',');
  const { results } = await db
    .prepare(
      `SELECT entrega_fecha AS fecha, COUNT(*) AS n FROM pedidos
       WHERE origen = 'web' AND entorno = ? AND entrega_fecha BETWEEN ? AND ?
         AND (estado IN (${estados}) OR (estado = 'pendiente_pago' AND creado > ?))
       GROUP BY entrega_fecha`,
    )
    .bind(entorno, desde, hasta, reserva)
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

/* ------------------------------------------------------------------ */
/* Panel: listados, cambios y resumen                                  */
/* ------------------------------------------------------------------ */

export interface FiltroPedidos {
  entorno: Entorno;
  /** Fechas de entrega, las dos incluidas. */
  desde?: string;
  hasta?: string;
  estados?: EstadoPedido[];
  /** Texto que se busca en la referencia, los nombres y los teléfonos. */
  q?: string;
  orden?: 'entrega' | 'creado';
  limite?: number;
}

export async function listarPedidos(db: D1Database, f: FiltroPedidos): Promise<FilaPedido[]> {
  const donde: string[] = ['entorno = ?'];
  const valores: unknown[] = [f.entorno];
  if (f.desde) {
    donde.push('entrega_fecha >= ?');
    valores.push(f.desde);
  }
  if (f.hasta) {
    donde.push('entrega_fecha <= ?');
    valores.push(f.hasta);
  }
  if (f.estados?.length) {
    donde.push(`estado IN (${f.estados.map(() => '?').join(',')})`);
    valores.push(...f.estados);
  }
  const q = (f.q ?? '').trim().slice(0, 60);
  if (q) {
    // Los comodines que escriba la persona se buscan tal cual.
    const patron = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
    const columnas = ['ref', 'comprador_nombre', 'comprador_telefono', 'dest_nombre', 'dest_telefono'];
    donde.push('(' + columnas.map((c) => `${c} LIKE ? ESCAPE '\\'`).join(' OR ') + ')');
    valores.push(...columnas.map(() => patron));
  }
  const orden = f.orden === 'creado' ? 'creado DESC' : 'entrega_fecha ASC, creado ASC';
  const limite = Math.min(Math.max(f.limite ?? 200, 1), 500);
  const { results } = await db
    .prepare(`SELECT * FROM pedidos WHERE ${donde.join(' AND ')} ORDER BY ${orden} LIMIT ${limite}`)
    .bind(...valores)
    .all<FilaPedido>();
  return results;
}

export interface CambiosPedido {
  estado?: EstadoPedido;
  notaInterna?: string;
  pagoEstado?: 'pendiente' | 'pagado';
  pagoMetodo?: string;
  entregaFecha?: string;
  entregaNota?: string;
}

/** Aplica cambios hechos desde el panel y los apunta en el historial del pedido. */
export async function actualizarPedido(
  db: D1Database,
  pedido: FilaPedido,
  cambios: CambiosPedido,
  detalles: string[],
  ahora: Date = new Date(),
): Promise<void> {
  const columnas: string[] = [];
  const valores: unknown[] = [];
  const poner = (columna: string, valor: unknown) => {
    columnas.push(`${columna} = ?`);
    valores.push(valor);
  };
  if (cambios.estado !== undefined) poner('estado', cambios.estado);
  if (cambios.notaInterna !== undefined) poner('nota_interna', cambios.notaInterna);
  if (cambios.pagoEstado !== undefined) poner('pago_estado', cambios.pagoEstado);
  if (cambios.pagoMetodo !== undefined) poner('pago_metodo', cambios.pagoMetodo);
  if (cambios.entregaFecha !== undefined) poner('entrega_fecha', cambios.entregaFecha);
  if (cambios.entregaNota !== undefined) poner('entrega_nota', cambios.entregaNota);
  if (!columnas.length) return;
  poner('actualizado', ahora.toISOString());
  await db.batch([
    db.prepare(`UPDATE pedidos SET ${columnas.join(', ')} WHERE ref = ?`).bind(...valores, pedido.ref),
    ...detalles.map((d) => anotarEvento(db, pedido.ref, 'cambio', d, 'tienda', ahora)),
  ]);
}

export interface ResumenPanel {
  /** Pedidos pagados que nadie ha empezado a preparar. */
  nuevos: number;
  /** En marcha con entrega hoy. */
  hoy: number;
  /** En marcha con entrega mañana. */
  manana: number;
  /** En marcha con la fecha de entrega ya pasada. */
  atrasados: number;
  presupuestosNuevos: number;
}

export async function resumenPanel(db: D1Database, entorno: Entorno, hoy: string, manana: string): Promise<ResumenPanel> {
  const enMarcha = `estado IN ('nuevo','en_preparacion','listo','en_reparto')`;
  const [pedidos, presupuestos] = await Promise.all([
    db
      .prepare(
        `SELECT
           SUM(CASE WHEN estado = 'nuevo' THEN 1 ELSE 0 END) AS nuevos,
           SUM(CASE WHEN ${enMarcha} AND entrega_fecha = ?2 THEN 1 ELSE 0 END) AS hoy,
           SUM(CASE WHEN ${enMarcha} AND entrega_fecha = ?3 THEN 1 ELSE 0 END) AS manana,
           SUM(CASE WHEN ${enMarcha} AND entrega_fecha < ?2 THEN 1 ELSE 0 END) AS atrasados
         FROM pedidos WHERE entorno = ?1`,
      )
      .bind(entorno, hoy, manana)
      .first<{ nuevos: number | null; hoy: number | null; manana: number | null; atrasados: number | null }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM presupuestos WHERE entorno = ? AND estado = 'nuevo'`).bind(entorno).first<{ n: number }>(),
  ]);
  return {
    nuevos: pedidos?.nuevos ?? 0,
    hoy: pedidos?.hoy ?? 0,
    manana: pedidos?.manana ?? 0,
    atrasados: pedidos?.atrasados ?? 0,
    presupuestosNuevos: presupuestos?.n ?? 0,
  };
}

/** Todos los pedidos en marcha (de cualquier origen) por día: para el calendario del panel. */
export async function pedidosPorDia(db: D1Database, entorno: Entorno, desde: string, hasta: string): Promise<Map<string, number>> {
  const estados = ESTADOS_QUE_OCUPAN.map((e) => `'${e}'`).join(',');
  const { results } = await db
    .prepare(
      `SELECT entrega_fecha AS fecha, COUNT(*) AS n FROM pedidos
       WHERE entorno = ? AND entrega_fecha BETWEEN ? AND ? AND estado IN (${estados}) GROUP BY entrega_fecha`,
    )
    .bind(entorno, desde, hasta)
    .all<{ fecha: string; n: number }>();
  return new Map(results.map((r) => [r.fecha, r.n]));
}

/* ------------------------------------------------------------------ */
/* Presupuestos                                                        */
/* ------------------------------------------------------------------ */

export interface FilaPresupuesto {
  id: number;
  ref: string;
  creado: string;
  entorno: string;
  tipo: string;
  fecha_evento: string;
  nombre: string;
  telefono: string;
  email: string;
  mensaje: string;
  estado: string;
  nota_interna: string;
}

export const ESTADOS_PRESUPUESTO = ['nuevo', 'contestado', 'aceptado', 'descartado'] as const;

export async function listarPresupuestos(db: D1Database, entorno: Entorno): Promise<FilaPresupuesto[]> {
  const { results } = await db
    .prepare('SELECT * FROM presupuestos WHERE entorno = ? ORDER BY creado DESC LIMIT 200')
    .bind(entorno)
    .all<FilaPresupuesto>();
  return results;
}

export async function actualizarPresupuesto(db: D1Database, ref: string, cambios: { estado?: string; notaInterna?: string }): Promise<boolean> {
  const columnas: string[] = [];
  const valores: unknown[] = [];
  if (cambios.estado !== undefined) {
    columnas.push('estado = ?');
    valores.push(cambios.estado);
  }
  if (cambios.notaInterna !== undefined) {
    columnas.push('nota_interna = ?');
    valores.push(cambios.notaInterna);
  }
  if (!columnas.length) return false;
  const res = await db.prepare(`UPDATE presupuestos SET ${columnas.join(', ')} WHERE ref = ?`).bind(...valores, ref).run();
  return (res.meta?.changes ?? 0) > 0;
}

/* ------------------------------------------------------------------ */
/* Limpieza de datos personales                                        */
/* ------------------------------------------------------------------ */

export interface ResultadoLimpieza {
  destinatarios: number;
  sinPagar: number;
  presupuestos: number;
}

/**
 * Borra lo que ya no hace falta guardar (plazos en compartido/tienda.ts → privacidad):
 * · datos de quien recibió las flores, indicaciones de entrega, dedicatoria y observaciones
 *   de los pedidos entregados hace más de N días (el pedido y sus importes se conservan);
 * · pedidos de la web que nunca llegaron a pagarse, enteros, en el mismo plazo;
 * · solicitudes de presupuesto de hace más de N meses.
 */
export async function limpiarDatosAntiguos(db: D1Database, ahora: Date = new Date()): Promise<ResultadoLimpieza> {
  const resultado: ResultadoLimpieza = { destinatarios: 0, sinPagar: 0, presupuestos: 0 };
  const hoy = ahoraEnMadrid(ahora).fecha;
  const dias = TIENDA.privacidad.diasDatosDestinatario;

  if (dias !== null) {
    const [a, m, d] = hoy.split('-').map(Number);
    const limite = new Date(Date.UTC(a, m - 1, d - dias)).toISOString().slice(0, 10);

    const sinPagar = `estado = 'caducado' AND pago_estado = 'pendiente' AND entrega_fecha < ?`;
    const borrados = await db.batch([
      db.prepare(`DELETE FROM pedido_lineas WHERE ref IN (SELECT ref FROM pedidos WHERE ${sinPagar})`).bind(limite),
      db.prepare(`DELETE FROM pedido_eventos WHERE ref IN (SELECT ref FROM pedidos WHERE ${sinPagar})`).bind(limite),
      db.prepare(`DELETE FROM pedidos WHERE ${sinPagar}`).bind(limite),
    ]);
    resultado.sinPagar = borrados[2]?.meta?.changes ?? 0;

    const res = await db
      .prepare(
        `UPDATE pedidos SET dest_nombre = '', dest_telefono = '', dest_direccion = '', dest_cp = '', dest_localidad = '',
           dest_detalle = '', dedicatoria = '', entrega_nota = '', observaciones = ''
         WHERE entrega_fecha < ? AND estado NOT IN ('nuevo','en_preparacion','listo','en_reparto')
           AND (dest_nombre != '' OR dest_telefono != '' OR dest_direccion != '' OR dest_detalle != ''
                OR dedicatoria != '' OR entrega_nota != '' OR observaciones != '')`,
      )
      .bind(limite)
      .run();
    resultado.destinatarios = res.meta?.changes ?? 0;
  }

  const meses = TIENDA.privacidad.mesesPresupuestos;
  if (meses !== null) {
    const limite = new Date(ahora.getTime());
    limite.setUTCMonth(limite.getUTCMonth() - meses);
    const res = await db.prepare('DELETE FROM presupuestos WHERE creado < ?').bind(limite.toISOString()).run();
    resultado.presupuestos = res.meta?.changes ?? 0;
  }
  return resultado;
}

let ultimaComprobacionDeLimpieza = '';

/** Lanza la limpieza una vez al día como mucho. Barata de llamar: casi siempre no hace nada. */
export async function limpiezaDiaria(db: D1Database, ahora: Date = new Date()): Promise<void> {
  const hoy = ahoraEnMadrid(ahora).fecha;
  if (ultimaComprobacionDeLimpieza === hoy) return;
  ultimaComprobacionDeLimpieza = hoy;
  if ((await leerAjuste(db, 'limpieza_ultima')) === hoy) return;
  await guardarAjuste(db, 'limpieza_ultima', hoy);
  const r = await limpiarDatosAntiguos(db, ahora);
  if (r.destinatarios || r.sinPagar || r.presupuestos) console.log('Limpieza de datos', JSON.stringify(r));
}
