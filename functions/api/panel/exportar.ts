/* =====================================================================
   GET /api/panel/exportar?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&por=entrega|pedido
   → los pedidos en un archivo CSV que abre Excel, para el gestor.

   Una fila por pedido, con los importes y el IVA desglosado por tipo.
   No lleva direcciones, dedicatorias ni datos de quien recibe las flores.
   ===================================================================== */

import { ahoraEnMadrid, esFechaValida, fechaCorta, sumarDias } from '../../../compartido/fechas.ts';
import { nombreEstado } from '../../../compartido/pedido.ts';
import type { DesgloseIva } from '../../../compartido/pedido.ts';
import { nombreMetodo } from '../../../compartido/tienda.ts';
import { lineasDe } from '../../_lib/datos.ts';
import type { FilaPedido } from '../../_lib/datos.ts';
import type { Env } from '../../_lib/entorno.ts';
import { entornoDe } from '../../_lib/entorno.ts';
import { fallo } from '../../_lib/http.ts';

const ORIGEN: Record<string, string> = { web: 'Web', tienda: 'Mostrador', telefono: 'Teléfono', whatsapp: 'WhatsApp' };
const PAGO: Record<string, string> = { pagado: 'Cobrado', pendiente: 'Sin cobrar', reembolsado: 'Devuelto' };
const FORMA: Record<string, string> = {
  stripe: 'Web (Stripe)',
  simulado: 'Pago de prueba',
  tienda: 'Al recoger',
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta (datáfono)',
  bizum: 'Bizum',
  transferencia: 'Transferencia',
};

/** «4300» → «43,00» (con coma decimal, que es como lo entiende Excel en español). */
const importe = (centimos: number) => (centimos / 100).toFixed(2).replace('.', ',');

/** Una celda de CSV. Lo que empieza por =, +, - o @ se desactiva para que Excel no lo tome por una fórmula. */
function celda(valor: unknown): string {
  let texto = String(valor ?? '').replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t]/.test(texto)) texto = "'" + texto;
  return /[";]/.test(texto) ? '"' + texto.replace(/"/g, '""') + '"' : texto;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.DB!;
  const url = new URL(request.url);
  const hoy = ahoraEnMadrid().fecha;
  const desde = url.searchParams.get('desde') ?? sumarDias(hoy, -31);
  const hasta = url.searchParams.get('hasta') ?? hoy;
  if (!esFechaValida(desde) || !esFechaValida(hasta) || desde > hasta) return fallo(422, 'fechas', 'Revisa las fechas: «desde» no puede ser posterior a «hasta».');
  const porPedido = url.searchParams.get('por') === 'pedido';

  // Fuera quedan los pedidos de la web que no llegaron a pagarse: no son ventas.
  const columna = porPedido ? 'substr(creado, 1, 10)' : 'entrega_fecha';
  const { results: pedidos } = await db
    .prepare(
      `SELECT * FROM pedidos WHERE entorno = ? AND ${columna} BETWEEN ? AND ?
         AND estado NOT IN ('pendiente_pago', 'caducado')
       ORDER BY ${columna}, creado LIMIT 5000`,
    )
    .bind(entornoDe(env), desde, hasta)
    .all<FilaPedido>();
  const lineas = await lineasDe(db, pedidos.map((p) => p.ref));

  const tipos = new Set<number>();
  const desgloses = new Map<string, DesgloseIva[]>();
  for (const p of pedidos) {
    let iva: DesgloseIva[] = [];
    try {
      iva = JSON.parse(p.iva || '[]');
    } catch {
      /* Sin desglose: se deja vacío. */
    }
    desgloses.set(p.ref, iva);
    for (const d of iva) tipos.add(d.tipo);
  }
  const listaTipos = [...tipos].sort((a, b) => a - b);

  const cabecera = [
    'Referencia', 'Fecha del pedido', 'Fecha de entrega', 'Origen', 'Estado', 'Cobro', 'Forma de cobro',
    'Cliente', 'Teléfono', 'Correo', 'Entrega', 'Productos', 'Subtotal', 'Reparto', 'Total',
    ...listaTipos.flatMap((t) => [`Base ${t} %`, `IVA ${t} %`]),
  ];

  const filas = pedidos.map((p) => {
    const iva = desgloses.get(p.ref) ?? [];
    const productos = (lineas.get(p.ref) ?? []).map((l) => `${l.cantidad} × ${l.nombre}${l.detalle ? ` (${l.detalle})` : ''}`).join(' + ');
    return [
      p.ref,
      fechaCorta(ahoraEnMadrid(new Date(p.creado)).fecha),
      fechaCorta(p.entrega_fecha),
      ORIGEN[p.origen] ?? p.origen,
      nombreEstado(p.estado),
      PAGO[p.pago_estado] ?? p.pago_estado,
      FORMA[p.pago_metodo] ?? p.pago_metodo,
      p.comprador_nombre,
      p.comprador_telefono,
      p.comprador_email,
      nombreMetodo(p.entrega_metodo),
      productos,
      importe(p.subtotal),
      importe(p.envio),
      importe(p.total),
      ...listaTipos.flatMap((t) => {
        const d = iva.find((x) => x.tipo === t);
        return d ? [importe(d.base), importe(d.cuota)] : ['', ''];
      }),
    ];
  });

  // BOM al principio para que Excel lea bien los acentos; punto y coma como separador.
  const csv = '﻿' + [cabecera, ...filas].map((fila) => fila.map(celda).join(';')).join('\r\n') + '\r\n';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pedidos-${desde}-a-${hasta}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
};
