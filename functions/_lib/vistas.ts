/* Qué datos de un pedido se enseñan a cada cual. */

import { fechaLarga } from '../../compartido/fechas.ts';
import { ESTADOS, nombreEstado } from '../../compartido/pedido.ts';
import { nombreMetodo } from '../../compartido/tienda.ts';
import type { FilaEvento, FilaLinea, FilaPedido } from './datos.ts';

/** Lo que ve el cliente: lo justo para confirmar su pedido, sin direcciones ni teléfonos. */
export function vistaCliente(p: FilaPedido, lineas: FilaLinea[]) {
  return {
    ref: p.ref,
    estado: p.estado,
    estadoTexto: ESTADOS.find((e) => e.id === p.estado)?.paraCliente ?? '',
    pagado: p.pago_estado === 'pagado',
    prueba: p.entorno === 'pruebas',
    entrega: {
      metodo: p.entrega_metodo,
      nombre: nombreMetodo(p.entrega_metodo),
      fecha: p.entrega_fecha,
      fechaTexto: fechaLarga(p.entrega_fecha),
      nota: p.entrega_nota,
    },
    destinatario: p.dest_nombre,
    comprador: p.comprador_nombre,
    lineas: lineas.map((l) => ({ nombre: l.nombre, detalle: l.detalle, cantidad: l.cantidad, total: l.total })),
    subtotal: p.subtotal,
    envio: p.envio,
    total: p.total,
    dedicatoria: p.dedicatoria,
  };
}


/** Lo que ve Loli en el panel: todo. */
export function vistaPanel(p: FilaPedido, lineas: FilaLinea[], eventos?: FilaEvento[]) {
  return {
    ref: p.ref,
    creado: p.creado,
    actualizado: p.actualizado,
    origen: p.origen,
    prueba: p.entorno === 'pruebas',
    estado: p.estado,
    estadoNombre: nombreEstado(p.estado),
    pago: { estado: p.pago_estado, metodo: p.pago_metodo, stripe: p.stripe_pago },
    entrega: {
      metodo: p.entrega_metodo,
      nombre: nombreMetodo(p.entrega_metodo),
      fecha: p.entrega_fecha,
      fechaTexto: fechaLarga(p.entrega_fecha),
      nota: p.entrega_nota,
    },
    comprador: { nombre: p.comprador_nombre, telefono: p.comprador_telefono, email: p.comprador_email },
    destinatario: {
      nombre: p.dest_nombre,
      telefono: p.dest_telefono,
      direccion: p.dest_direccion,
      cp: p.dest_cp,
      localidad: p.dest_localidad,
      detalle: p.dest_detalle,
    },
    dedicatoria: p.dedicatoria,
    observaciones: p.observaciones,
    notaInterna: p.nota_interna,
    lineas: lineas.map((l) => ({
      nombre: l.nombre,
      detalle: l.detalle,
      cantidad: l.cantidad,
      precioUnidad: l.precio_unidad,
      total: l.total,
      nota: l.nota,
    })),
    subtotal: p.subtotal,
    envio: p.envio,
    total: p.total,
    iva: JSON.parse(p.iva || '[]'),
    eventos: eventos?.map((e) => ({ fecha: e.fecha, tipo: e.tipo, detalle: e.detalle, autor: e.autor })),
  };
}
