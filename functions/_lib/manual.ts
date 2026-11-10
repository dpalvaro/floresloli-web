/* =====================================================================
   PEDIDOS APUNTADOS A MANO (el «libro de pedidos»)

   Los pedidos del mostrador, del teléfono y de WhatsApp se apuntan desde
   el panel para tenerlos todos en el mismo sitio. Aquí Loli manda: las
   líneas y los precios son libres, no hay cupo ni hora límite, y casi
   todos los datos son opcionales.
   ===================================================================== */

import { esFechaValida } from '../../compartido/fechas.ts';
import { desglosarIva, emailValido, limpiarTexto, normalizarTelefono } from '../../compartido/pedido.ts';
import type { Errores, LineaCalculada, PedidoValidado } from '../../compartido/pedido.ts';
import { METODOS_ENTREGA, TIENDA } from '../../compartido/tienda.ts';
import type { MetodoEntrega } from '../../compartido/tienda.ts';

export const ORIGENES_MANUALES = ['tienda', 'telefono', 'whatsapp'] as const;
export type OrigenManual = (typeof ORIGENES_MANUALES)[number];

export const FORMAS_DE_COBRO = ['efectivo', 'tarjeta', 'bizum', 'transferencia'] as const;

export interface EntradaManual {
  origen?: string;
  lineas?: { nombre?: string; cantidad?: number; precio?: number; iva?: string; nota?: string }[];
  entrega?: { metodo?: string; fecha?: string; nota?: string };
  /** Precio del reparto en euros. */
  envio?: number;
  destinatario?: { nombre?: string; telefono?: string };
  direccion?: { calle?: string; cp?: string; localidad?: string };
  hospital?: { detalle?: string };
  dedicatoria?: string;
  comprador?: { nombre?: string; telefono?: string; email?: string };
  observaciones?: string;
  notaInterna?: string;
  pagado?: boolean;
  formaDeCobro?: string;
}

export type ResultadoManual =
  | { ok: true; pedido: PedidoValidado; origen: OrigenManual; pagado: boolean; formaDeCobro: string; notaInterna: string }
  | { ok: false; errores: Errores };

const aCentimos = (euros: unknown): number | null => {
  const n = typeof euros === 'string' ? Number(euros.replace(',', '.')) : Number(euros);
  if (!Number.isFinite(n) || n < 0 || n > 20_000) return null;
  return Math.round(n * 100);
};

export function validarPedidoManual(entrada: unknown): ResultadoManual {
  const d = (entrada ?? {}) as EntradaManual;
  const e: Errores = {};

  const origen = ORIGENES_MANUALES.includes(d.origen as OrigenManual) ? (d.origen as OrigenManual) : 'tienda';

  const metodo = d.entrega?.metodo as MetodoEntrega;
  if (!METODOS_ENTREGA.includes(metodo)) e['entrega.metodo'] = 'Elige cómo se entrega.';
  const fecha = d.entrega?.fecha;
  if (!esFechaValida(fecha)) e['entrega.fecha'] = 'Elige el día de entrega.';

  const lineas: LineaCalculada[] = [];
  const crudas = Array.isArray(d.lineas) ? d.lineas.slice(0, 30) : [];
  for (const [i, cruda] of crudas.entries()) {
    const nombre = limpiarTexto(cruda?.nombre, 120);
    if (!nombre) continue;
    const cantidad = Number(cruda.cantidad ?? 1);
    const precio = aCentimos(cruda.precio ?? 0);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 500) {
      e['lineas'] = `La cantidad de la línea ${i + 1} no es válida.`;
      continue;
    }
    if (precio === null) {
      e['lineas'] = `El precio de la línea ${i + 1} no es válido.`;
      continue;
    }
    lineas.push({
      id: '',
      nombre,
      detalle: null,
      cantidad,
      precioUnidad: precio,
      total: precio * cantidad,
      iva: cruda.iva === 'complementos' ? 'complementos' : 'flores',
      nota: limpiarTexto(cruda.nota, 200) || null,
    });
  }
  if (!lineas.length && !e['lineas']) e['lineas'] = 'Apunta al menos un producto.';

  const envio = aCentimos(d.envio ?? 0);
  if (envio === null) e['envio'] = 'El precio del reparto no es válido.';

  const comprador = {
    nombre: limpiarTexto(d.comprador?.nombre, 80),
    telefono: limpiarTexto(d.comprador?.telefono, 25),
    email: limpiarTexto(d.comprador?.email, 120).toLowerCase(),
  };
  if (comprador.nombre.length < 2) e['comprador.nombre'] = 'Escribe el nombre de quien encarga.';
  if (comprador.telefono) {
    const tel = normalizarTelefono(comprador.telefono);
    if (!tel) e['comprador.telefono'] = 'Ese teléfono no parece válido.';
    else comprador.telefono = tel;
  }
  if (comprador.email && !emailValido(comprador.email)) e['comprador.email'] = 'Ese correo no parece válido.';

  const destinatario = {
    nombre: limpiarTexto(d.destinatario?.nombre, 80),
    telefono: limpiarTexto(d.destinatario?.telefono, 25),
  };
  if (destinatario.telefono) {
    const tel = normalizarTelefono(destinatario.telefono);
    if (!tel) e['destinatario.telefono'] = 'Ese teléfono no parece válido.';
    else destinatario.telefono = tel;
  }
  const direccion = {
    calle: metodo === 'domicilio' ? limpiarTexto(d.direccion?.calle, 140) : '',
    cp: metodo === 'domicilio' ? limpiarTexto(d.direccion?.cp, 5) : '',
    localidad: metodo === 'domicilio' ? limpiarTexto(d.direccion?.localidad, 60) : '',
  };
  if (metodo === 'domicilio' && direccion.calle.length < 3) e['direccion.calle'] = 'Escribe la dirección de entrega.';
  if (direccion.cp && !/^\d{5}$/.test(direccion.cp)) e['direccion.cp'] = 'El código postal tiene 5 cifras.';

  if (Object.keys(e).length || envio === null) return { ok: false, errores: e };

  const subtotal = lineas.reduce((suma, l) => suma + (l.total ?? 0), 0);
  const formaDeCobro = (FORMAS_DE_COBRO as readonly string[]).includes(d.formaDeCobro ?? '') ? String(d.formaDeCobro) : '';

  return {
    ok: true,
    origen,
    pagado: d.pagado === true,
    formaDeCobro,
    notaInterna: limpiarTexto(d.notaInterna, 500, true),
    pedido: {
      lineas,
      subtotal,
      envio,
      total: subtotal + envio,
      iva: desglosarIva(lineas, envio),
      entrega: { metodo, fecha: fecha as string, nota: limpiarTexto(d.entrega?.nota, 120) },
      destinatario,
      direccion,
      hospitalDetalle: metodo === 'hospital' ? limpiarTexto(d.hospital?.detalle, 120) : '',
      dedicatoria: limpiarTexto(d.dedicatoria, TIENDA.limites.dedicatoria, true),
      comprador,
      observaciones: limpiarTexto(d.observaciones, TIENDA.limites.observaciones, true),
    },
  };
}
