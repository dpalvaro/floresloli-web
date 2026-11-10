/* =====================================================================
   PEDIDO: cálculo de importes y validación de los datos.

   Lo usan el navegador (para enseñar totales y avisar pronto de errores)
   y la API (que recalcula todo y es la que manda). No importa el catálogo
   completo: recibe la lista de productos que se pueden comprar, ya
   filtrada por entorno (ver catalogoCompra en catalogo.ts).
   ===================================================================== */

import { esFechaValida } from './fechas.ts';
import { TIENDA, precioEnvioCentimos, zonaDeCp, METODOS_ENTREGA } from './tienda.ts';
import type { MetodoEntrega } from './tienda.ts';

/** Lo mínimo de un producto para poder venderlo. */
export interface ProductoCompra {
  id: string;
  nombre: string;
  categoria: string;
  /** Euros con IVA. null = sin precio en la web (se encarga por WhatsApp). */
  precio: number | null;
  variantes: { id: string; nombre: string; precio: number | null }[];
  aMedida: boolean;
  /** Número de modelos entre los que elegir (0 si no aplica). */
  modelos: number;
  iva: 'flores' | 'complementos';
  hospital: boolean;
  temporada: { desde: string; hasta: string; texto: string } | null;
}

export interface LineaEntrada {
  id: string;
  variante?: string | null;
  cantidad: number;
  /** Solo para el ramo a medida: importe en euros. */
  importe?: number | null;
  /** Solo para productos con modelos: número de modelo (1, 2, 3…). */
  modelo?: number | null;
  /** Preferencias del cliente para esa línea (colores, flores…). */
  nota?: string | null;
}

export interface LineaCalculada {
  id: string;
  nombre: string;
  /** «Grande», «12 rosas», «Importe: 35 €», «Modelo 3»… */
  detalle: string | null;
  cantidad: number;
  /** Céntimos. null = sin precio en la web. */
  precioUnidad: number | null;
  total: number | null;
  iva: 'flores' | 'complementos';
  nota: string | null;
}

export interface ResultadoLineas {
  lineas: LineaCalculada[];
  /** Céntimos; suma de las líneas con precio. */
  subtotal: number;
  /** Mensajes de error para el cliente. Vacío = todo bien. */
  errores: string[];
  /** true si alguna línea no tiene precio en la web: el pedido va por WhatsApp. */
  haySinPrecio: boolean;
}

export interface DesgloseIva {
  /** Tipo en % */
  tipo: number;
  base: number;
  cuota: number;
  total: number;
}

const LIM = TIENDA.limites;

/* ------------------------------------------------------------------ */
/* Texto                                                               */
/* ------------------------------------------------------------------ */

/** Quita caracteres de control y espacios sobrantes, y recorta. */
export function limpiarTexto(valor: unknown, max: number, multilinea = false): string {
  if (typeof valor !== 'string') return '';
  let t = valor.replace(/\r\n?/g, '\n');
  // eslint-disable-next-line no-control-regex
  t = multilinea ? t.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ') : t.replace(/[\u0000-\u001F\u007F]/g, ' ');
  t = multilinea
    ? t.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim()
    : t.replace(/\s+/g, ' ').trim();
  return t.slice(0, max);
}

export function emailValido(email: string): boolean {
  return email.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Devuelve el teléfono normalizado («612345678» o «+33123456789») o null si no vale. */
export function normalizarTelefono(valor: string): string | null {
  const limpio = valor.replace(/[\s().\-]/g, '');
  if (/^(\+34|0034)?[6789]\d{8}$/.test(limpio)) return limpio.replace(/^(\+34|0034)/, '');
  if (/^(\+|00)\d{8,15}$/.test(limpio)) return '+' + limpio.replace(/^(\+|00)/, '');
  return null;
}

/* ------------------------------------------------------------------ */
/* Líneas e importes                                                   */
/* ------------------------------------------------------------------ */

function enTemporada(p: ProductoCompra, fecha: string): boolean {
  if (!p.temporada) return true;
  const md = fecha.slice(5);
  const { desde, hasta } = p.temporada;
  return desde <= hasta ? md >= desde && md <= hasta : md >= desde || md <= hasta;
}

/**
 * Calcula las líneas de un pedido contra el catálogo.
 * @param catalogo productos que se pueden pedir en este entorno.
 * @param opciones fecha y método de entrega, si ya se conocen, para validar temporada y hospital.
 */
export function calcularLineas(
  entrada: unknown,
  catalogo: ProductoCompra[],
  opciones: { fecha?: string; metodo?: MetodoEntrega } = {},
): ResultadoLineas {
  const res: ResultadoLineas = { lineas: [], subtotal: 0, errores: [], haySinPrecio: false };
  if (!Array.isArray(entrada) || entrada.length === 0) {
    res.errores.push('La cesta está vacía.');
    return res;
  }
  if (entrada.length > LIM.lineasPorPedido) {
    res.errores.push('Hay demasiados productos en la cesta. Para un pedido tan grande, llámanos.');
    return res;
  }

  for (const cruda of entrada as LineaEntrada[]) {
    const p = catalogo.find((x) => x.id === cruda?.id);
    if (!p) {
      res.errores.push('Un producto de la cesta ya no está disponible. Quítalo para seguir.');
      continue;
    }
    const cantidad = Number(cruda.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > LIM.unidadesPorLinea) {
      res.errores.push(`La cantidad de «${p.nombre}» no es válida.`);
      continue;
    }

    let precio: number | null = null;
    let detalle: string | null = null;

    if (p.aMedida) {
      const importe = Number(cruda.importe);
      const { minimo, maximo } = TIENDA.ramoAMedida;
      if (!Number.isInteger(importe) || importe < minimo || importe > maximo) {
        res.errores.push(`El importe de «${p.nombre}» tiene que estar entre ${minimo} y ${maximo} €, sin céntimos.`);
        continue;
      }
      // Sin importes confirmados (precio null en este entorno), se encarga por WhatsApp.
      precio = p.precio === null ? null : importe;
      detalle = `Importe: ${importe} €`;
    } else if (p.variantes.length) {
      const v = p.variantes.find((x) => x.id === cruda.variante);
      if (!v) {
        res.errores.push(`Elige una opción de «${p.nombre}».`);
        continue;
      }
      precio = v.precio;
      detalle = v.nombre;
    } else {
      precio = p.precio;
      if (p.modelos > 0) {
        const modelo = Number(cruda.modelo);
        if (!Number.isInteger(modelo) || modelo < 1 || modelo > p.modelos) {
          res.errores.push(`Elige un modelo de «${p.nombre}».`);
          continue;
        }
        detalle = `Modelo ${modelo}`;
      }
    }

    if (opciones.fecha && !enTemporada(p, opciones.fecha)) {
      res.errores.push(`«${p.nombre}» solo se prepara en temporada (${p.temporada!.texto.toLowerCase()}). Cambia la fecha o quítalo de la cesta.`);
    }
    if (opciones.metodo === 'hospital' && !p.hospital) {
      res.errores.push(`«${p.nombre}» no se puede llevar al hospital. Quítalo de la cesta o elige otra forma de entrega.`);
    }

    const precioUnidad = precio === null ? null : Math.round(precio * 100);
    const total = precioUnidad === null ? null : precioUnidad * cantidad;
    if (total === null) res.haySinPrecio = true;
    else res.subtotal += total;

    res.lineas.push({
      id: p.id,
      nombre: p.nombre,
      detalle,
      cantidad,
      precioUnidad,
      total,
      iva: p.iva,
      nota: limpiarTexto(cruda.nota, 200) || null,
    });
  }
  return res;
}

/** IVA incluido en los importes, por tipo. Importes en céntimos. */
export function desglosarIva(lineas: LineaCalculada[], envio: number): DesgloseIva[] {
  const porTipo = new Map<number, number>();
  const sumar = (tipo: number, importe: number) => porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + importe);
  for (const l of lineas) if (l.total) sumar(TIENDA.iva[l.iva], l.total);
  if (envio > 0) sumar(TIENDA.iva.envio, envio);
  return [...porTipo.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tipo, total]) => {
      const base = Math.round(total / (1 + tipo / 100));
      return { tipo, base, cuota: total - base, total };
    });
}

/* ------------------------------------------------------------------ */
/* Validación del pedido completo                                      */
/* ------------------------------------------------------------------ */

export interface PedidoEntrada {
  lineas: LineaEntrada[];
  entrega: { metodo: MetodoEntrega; fecha: string; nota?: string };
  destinatario?: { nombre?: string; telefono?: string };
  direccion?: { calle?: string; cp?: string; localidad?: string };
  hospital?: { detalle?: string };
  dedicatoria?: string;
  comprador: { nombre: string; telefono: string; email: string };
  observaciones?: string;
  acepta: boolean;
  /** Campo trampa contra robots: tiene que llegar vacío. */
  web?: string;
  /** Pedido anterior sin pagar que este sustituye (el cliente volvió atrás desde el pago). */
  sustituye?: { ref: string; token: string } | null;
}

export interface PedidoValidado {
  lineas: LineaCalculada[];
  subtotal: number;
  envio: number;
  total: number;
  iva: DesgloseIva[];
  entrega: { metodo: MetodoEntrega; fecha: string; nota: string };
  destinatario: { nombre: string; telefono: string };
  direccion: { calle: string; cp: string; localidad: string };
  hospitalDetalle: string;
  dedicatoria: string;
  comprador: { nombre: string; telefono: string; email: string };
  observaciones: string;
}

/** Errores por campo: { 'comprador.email': 'Escribe un correo válido.' } */
export type Errores = Record<string, string>;

export type ResultadoValidacion =
  | { ok: true; pedido: PedidoValidado }
  | { ok: false; errores: Errores; porWhatsApp?: boolean };

/**
 * Valida y normaliza un pedido. No comprueba la disponibilidad del día (cupo y hora límite):
 * eso lo hace la API con la base de datos (estadoDia en fechas.ts).
 */
export function validarPedido(entrada: unknown, catalogo: ProductoCompra[]): ResultadoValidacion {
  const e: Errores = {};
  const d = (entrada ?? {}) as Partial<PedidoEntrada>;

  // Entrega
  const metodo = d.entrega?.metodo as MetodoEntrega;
  if (!METODOS_ENTREGA.includes(metodo)) e['entrega.metodo'] = 'Elige cómo quieres recibirlo.';
  const fecha = d.entrega?.fecha;
  if (!esFechaValida(fecha)) e['entrega.fecha'] = 'Elige el día.';

  // Líneas
  const calc = calcularLineas(d.lineas, catalogo, {
    fecha: esFechaValida(fecha) ? fecha : undefined,
    metodo: METODOS_ENTREGA.includes(metodo) ? metodo : undefined,
  });
  if (calc.errores.length) e['lineas'] = calc.errores.join(' ');
  else if (calc.haySinPrecio) {
    return {
      ok: false,
      porWhatsApp: true,
      errores: {
        lineas: 'Algún producto de la cesta no tiene precio en la web. Envíanos el encargo por WhatsApp y te lo confirmamos.',
      },
    };
  }

  // Comprador
  const comprador = {
    nombre: limpiarTexto(d.comprador?.nombre, 80),
    telefono: limpiarTexto(d.comprador?.telefono, 25),
    email: limpiarTexto(d.comprador?.email, 120).toLowerCase(),
  };
  if (comprador.nombre.length < 2) e['comprador.nombre'] = 'Escribe tu nombre.';
  const telComprador = normalizarTelefono(comprador.telefono);
  if (!telComprador) e['comprador.telefono'] = 'Escribe un teléfono válido, con sus 9 cifras.';
  else comprador.telefono = telComprador;
  if (!emailValido(comprador.email)) e['comprador.email'] = 'Escribe un correo válido. Ahí te llega el justificante.';

  // Destinatario y dirección
  const destinatario = {
    nombre: limpiarTexto(d.destinatario?.nombre, 80),
    telefono: limpiarTexto(d.destinatario?.telefono, 25),
  };
  const direccion = {
    calle: limpiarTexto(d.direccion?.calle, 140),
    cp: limpiarTexto(d.direccion?.cp, 5),
    localidad: limpiarTexto(d.direccion?.localidad, 60),
  };
  let hospitalDetalle = limpiarTexto(d.hospital?.detalle, 120);

  if (destinatario.telefono) {
    const tel = normalizarTelefono(destinatario.telefono);
    if (!tel) e['destinatario.telefono'] = 'Ese teléfono no parece válido. Revísalo o déjalo en blanco.';
    else destinatario.telefono = tel;
  }

  let envio: number | null = 0;
  if (metodo === 'domicilio') {
    if (destinatario.nombre.length < 2) e['destinatario.nombre'] = 'Escribe el nombre de quien lo recibe.';
    if (direccion.calle.length < 5) e['direccion.calle'] = 'Escribe la calle, el número y el piso.';
    if (!/^\d{5}$/.test(direccion.cp)) e['direccion.cp'] = 'Escribe el código postal, con sus 5 cifras.';
    else {
      const zona = zonaDeCp(direccion.cp);
      envio = precioEnvioCentimos('domicilio', direccion.cp);
      if (!zona || envio === null) e['direccion.cp'] = TIENDA.entrega.domicilio.fueraDeZona;
      else if (!direccion.localidad) direccion.localidad = zona.id === 'toledo' ? 'Toledo' : zona.nombre;
    }
    hospitalDetalle = '';
  } else if (metodo === 'hospital') {
    if (destinatario.nombre.length < 2) e['destinatario.nombre'] = 'Escribe el nombre de la persona ingresada.';
    envio = precioEnvioCentimos('hospital');
    direccion.calle = '';
    direccion.cp = '';
    direccion.localidad = '';
  } else {
    // Recogida: no hacen falta ni dirección ni datos del hospital.
    direccion.calle = '';
    direccion.cp = '';
    direccion.localidad = '';
    hospitalDetalle = '';
  }

  if (d.acepta !== true) e['acepta'] = 'Marca la casilla para aceptar las condiciones y la política de privacidad.';

  if (Object.keys(e).length || envio === null) return { ok: false, errores: e };

  const total = calc.subtotal + envio;
  return {
    ok: true,
    pedido: {
      lineas: calc.lineas,
      subtotal: calc.subtotal,
      envio,
      total,
      iva: desglosarIva(calc.lineas, envio),
      entrega: { metodo, fecha: fecha as string, nota: limpiarTexto(d.entrega?.nota, 120) },
      destinatario,
      direccion,
      hospitalDetalle,
      dedicatoria: limpiarTexto(d.dedicatoria, LIM.dedicatoria, true),
      comprador,
      observaciones: limpiarTexto(d.observaciones, LIM.observaciones, true),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Estados                                                             */
/* ------------------------------------------------------------------ */

export type EstadoPedido =
  | 'pendiente_pago'
  | 'nuevo'
  | 'en_preparacion'
  | 'listo'
  | 'en_reparto'
  | 'entregado'
  | 'cancelado'
  | 'caducado';

/**
 * Estados de un pedido. El pago va aparte (pagado, pendiente o devuelto), porque un pedido
 * apuntado a mano puede estar en marcha y cobrarse al recogerlo.
 */
export const ESTADOS: { id: EstadoPedido; nombre: string; paraCliente: string }[] = [
  { id: 'pendiente_pago', nombre: 'Esperando el pago', paraCliente: 'Estamos esperando la confirmación del pago.' },
  { id: 'nuevo', nombre: 'Nuevo', paraCliente: 'Hemos recibido tu pedido.' },
  { id: 'en_preparacion', nombre: 'En preparación', paraCliente: 'Estamos preparando tu pedido.' },
  { id: 'listo', nombre: 'Listo', paraCliente: 'Tu pedido está preparado.' },
  { id: 'en_reparto', nombre: 'En reparto', paraCliente: 'Tu pedido va de camino.' },
  { id: 'entregado', nombre: 'Entregado', paraCliente: 'Tu pedido está entregado.' },
  { id: 'cancelado', nombre: 'Cancelado', paraCliente: 'Este pedido está cancelado.' },
  { id: 'caducado', nombre: 'Sin pagar (caducado)', paraCliente: 'Este pedido no llegó a pagarse y ha caducado.' },
];

/** Estados que ocupan hueco en el cupo del día. */
export const ESTADOS_QUE_OCUPAN: EstadoPedido[] = ['nuevo', 'en_preparacion', 'listo', 'en_reparto', 'entregado'];

/** Estados en los que el pedido está en marcha (ni entregado ni anulado). */
export const ESTADOS_EN_MARCHA: EstadoPedido[] = ['nuevo', 'en_preparacion', 'listo', 'en_reparto'];

/** Estados que Loli puede poner a mano desde el panel. */
export const ESTADOS_MANUALES: EstadoPedido[] = ['nuevo', 'en_preparacion', 'listo', 'en_reparto', 'entregado', 'cancelado'];

export function nombreEstado(id: string): string {
  return ESTADOS.find((x) => x.id === id)?.nombre ?? id;
}

/** Para qué se puede pedir presupuesto. */
export const TIPOS_PRESUPUESTO: { id: string; nombre: string }[] = [
  { id: 'boda', nombre: 'Boda' },
  { id: 'comunion', nombre: 'Comunión o bautizo' },
  { id: 'evento', nombre: 'Otro evento' },
  { id: 'empresa', nombre: 'Empresa' },
  { id: 'otro', nombre: 'Otra cosa' },
];
