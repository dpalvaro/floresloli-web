/* =====================================================================
   REGLAS DE LA TIENDA: reparto, fechas, cupo, IVA y límites.

   Lo usan la web (para enseñar opciones) y la API (que es quien decide).
   Casi todo lo marcado PENDIENTE son valores provisionales que hay que
   confirmar con Loli antes de vender (fila «T39 · Datos provisionales»
   de «Para aprobar», 30/10/2026). La lista completa: `npm run comprobar`.
   ===================================================================== */

export type MetodoEntrega = 'recogida' | 'domicilio' | 'hospital';

export interface ZonaReparto {
  id: string;
  nombre: string;
  /** Localidad que se escribe en la dirección del pedido. */
  localidad: string;
  /** Códigos postales que cubre. */
  cps: string[];
  /** Precio del reparto en euros (IVA incluido). null = se consulta por WhatsApp. */
  precio: number | null;
  /** Solo pueblos: km por carretera desde la tienda (de ahí sale el precio). */
  km?: number;
}

/** Pueblo al que se reparte, con los km por carretera desde la tienda. */
export interface Pueblo {
  nombre: string;
  cp: string;
  km: number;
}

/** Euros por km de ida a los pueblos (Loli, 24/11/2026: 1 € por km, sin contar la vuelta). */
const PRECIO_KM = 1;

/**
 * Pueblos a 25 km o menos de la tienda (Loli, 24/11/2026: «hasta 25 km»).
 * km por carretera desde C/ Río Alberche 30 hasta el centro del pueblo, redondeados hacia arriba.
 * Calculados el 24/11/2026 con OpenStreetMap (OSRM); códigos postales comprobados.
 * PENDIENTE: que Loli revise la lista (si falta alguno o algún precio no le cuadra).
 * Para añadir uno: nombre, código postal y km. El precio sale solo.
 */
const PUEBLOS: Pueblo[] = [
  { nombre: 'Burguillos de Toledo', cp: '45112', km: 13 },
  { nombre: 'Nambroca', cp: '45190', km: 15 },
  { nombre: 'Bargas', cp: '45593', km: 15 },
  { nombre: 'Cobisa', cp: '45111', km: 15 },
  { nombre: 'Mocejón', cp: '45270', km: 16 },
  { nombre: 'Olías del Rey', cp: '45280', km: 16 },
  { nombre: 'Argés', cp: '45122', km: 19 },
  { nombre: 'Layos', cp: '45123', km: 23 },
  { nombre: 'Villasequilla', cp: '45740', km: 23 },
  { nombre: 'Chueca', cp: '45113', km: 23 },
  { nombre: 'Ajofrín', cp: '45110', km: 24 },
  { nombre: 'Cabañas de la Sagra', cp: '45592', km: 24 },
  { nombre: 'Villaseca de la Sagra', cp: '45260', km: 24 },
  { nombre: 'Almonacid de Toledo', cp: '45420', km: 24 },
  { nombre: 'Magán', cp: '45590', km: 25 },
];

const zonaDePueblo = (p: Pueblo): ZonaReparto => ({
  id: `pueblo-${p.cp}`,
  nombre: p.nombre,
  localidad: p.nombre,
  cps: [p.cp],
  precio: p.km * PRECIO_KM,
  km: p.km,
});

export const TIENDA = {
  moneda: 'EUR',

  entrega: {
    recogida: {
      nombre: 'Recoger en la tienda',
      resumen: 'Gratis. Te lo dejamos preparado.',
      precio: 0,
    },
    domicilio: {
      nombre: 'Reparto a domicilio',
      resumen: 'En el Polígono, 5 €; en el resto de Toledo, 8 €; en los pueblos cercanos, 1 € por km.',
      /**
       * Fuente: Loli, por Álvaro (24/11/2026): Polígono 5 €, resto de Toledo 8 € y pueblos
       * a 1 € por km de ida, hasta 25 km. La primera zona que coincide es la que vale.
       */
      zonas: [
        {
          id: 'poligono',
          nombre: 'el Polígono (Santa María de Benquerencia)',
          localidad: 'Toledo',
          cps: ['45007'],
          precio: 5,
        },
        {
          id: 'toledo',
          nombre: 'Toledo capital',
          localidad: 'Toledo',
          cps: ['45001', '45002', '45003', '45004', '45005', '45006', '45008'],
          precio: 8,
        },
        ...PUEBLOS.map(zonaDePueblo),
      ] as ZonaReparto[],
      /** Pueblos con su distancia, para la página de reparto. */
      pueblos: PUEBLOS,
      precioKm: PRECIO_KM,
      kmMaximo: 25,
      /** Texto para los códigos postales que no están en ninguna zona con precio. */
      fueraDeZona:
        'Por la web repartimos en Toledo y en los pueblos a 25 km o menos. Para otro sitio, escríbenos por WhatsApp y lo vemos.',
    },
    hospital: {
      nombre: 'Entrega en el Hospital Universitario de Toledo',
      resumen: 'Estamos en el mismo barrio.',
      // Fuente: Loli, por Álvaro (24/11/2026): 5 €, como el Polígono.
      precio: 5,
    },
  },

  /**
   * Hora límite para pedir para el mismo día (hora de Madrid). Después, se llama a la tienda.
   * Fuente: Loli, por Álvaro (24/11/2026).
   */
  horaLimiteMismoDia: '12:00',

  /**
   * Pedidos de la web que se aceptan por día de entrega. Cuando un día se llena,
   * los demás siguen abiertos. Fuente: Loli, por Álvaro (24/11/2026): 12 «de momento».
   * Se puede cambiar un día concreto desde el panel (pestaña «Calendario»).
   */
  cupoDiario: 12,

  /** Con cuántos días de antelación se puede encargar, como mucho. */
  diasAntelacionMax: 60,

  /** Minutos que se guarda el hueco de un pedido sin pagar (el pago de Stripe caduca a la vez). */
  minutosReserva: 31,

  /**
   * Días que la tienda cierra además de los domingos. Formato AAAA-MM-DD.
   * Son los festivos nacionales y de Castilla-La Mancha de 2026-2027.
   * PENDIENTE: confirmar con Loli cuáles cierra de verdad y añadir los locales de Toledo de 2027.
   * Un día suelto se abre o se cierra desde el panel sin tocar este archivo.
   */
  festivos: [
    '2026-12-08', // Inmaculada
    '2026-12-25', // Navidad
    '2027-01-01', // Año Nuevo
    '2027-01-06', // Reyes
    '2027-03-25', // Jueves Santo
    '2027-03-26', // Viernes Santo
    '2027-05-01', // Fiesta del Trabajo
    '2027-05-27', // Corpus Christi
    '2027-05-31', // Día de Castilla-La Mancha
    '2027-10-12', // Fiesta Nacional
    '2027-11-01', // Todos los Santos
    '2027-12-06', // Constitución
    '2027-12-08', // Inmaculada
    '2027-12-25', // Navidad
  ],

  /**
   * Domingos o festivos que sí se trabaja («fechas señaladas»). Formato AAAA-MM-DD.
   * PENDIENTE: decidir San Valentín (domingo 14/02/2027) y Día de la Madre (domingo 02/05/2027).
   */
  aperturasEspeciales: [] as string[],

  /**
   * IVA incluido en los precios, en %. Loli da todos los precios con el IVA incluido (24/11/2026).
   * Este reparto solo sirve para desglosarlo. Flores y plantas ornamentales: 10 % (ficha).
   * Complementos y envío: PENDIENTE validar con el gestor (T18).
   */
  iva: { flores: 10, complementos: 21, envio: 21 },

  ramoAMedida: {
    /** Importes que se ofrecen como botones. PENDIENTE: confirmar los habituales. */
    importes: [25, 35, 50, 75],
    minimo: 20,
    maximo: 300,
  },

  limites: {
    dedicatoria: 250,
    observaciones: 400,
    unidadesPorLinea: 20,
    lineasPorPedido: 20,
  },

  /**
   * Pago en la tienda al recoger (sin pagar en la web). Desactivado: el momento del cobro
   * está por confirmar en la ficha. Si se activa, solo vale para «Recoger en la tienda».
   */
  pagoEnTienda: false,

  /** Qué formas de pago anuncia la web. Se activan en el panel de Stripe, no aquí. */
  pago: {
    // PENDIENTE: poner true cuando Bizum esté activado en Stripe.
    bizum: false,
  },

  /** Compromisos de las condiciones de venta. PENDIENTE: confirmarlos con Loli. */
  condiciones: {
    /** Horas para avisar de un problema con el pedido recibido. */
    horasAvisoProblema: 24,
    /** Días naturales para devolver un complemento sin usar (desistimiento legal: 14). */
    diasDesistimientoComplementos: 14,
  },

  privacidad: {
    /**
     * Días después de la entrega en que se borran solos los datos de quien recibe las flores
     * (nombre, teléfono, dirección, planta y habitación) y la dedicatoria. null = no se borran.
     * PENDIENTE: confirmar el plazo.
     */
    diasDatosDestinatario: 90 as number | null,
    /** Meses que se guardan los datos de contacto de una solicitud de presupuesto. null = no se borran. */
    mesesPresupuestos: 12 as number | null,
  },
} as const;

/** Precio en euros de una zona por su id ('poligono', 'toledo'…), o null. */
export function precioZona(id: string): number | null {
  return TIENDA.entrega.domicilio.zonas.find((z) => z.id === id)?.precio ?? null;
}

/** Zona de reparto que cubre un código postal, o null. */
export function zonaDeCp(cp: string): ZonaReparto | null {
  const limpio = (cp || '').trim();
  return TIENDA.entrega.domicilio.zonas.find((z) => z.cps.includes(limpio)) ?? null;
}

/** Precio del envío en céntimos, o null si hay que consultarlo. */
export function precioEnvioCentimos(metodo: MetodoEntrega, cp?: string): number | null {
  if (metodo === 'recogida') return 0;
  if (metodo === 'hospital') return Math.round(TIENDA.entrega.hospital.precio * 100);
  const zona = zonaDeCp(cp ?? '');
  if (!zona || zona.precio === null) return null;
  return Math.round(zona.precio * 100);
}

export function nombreMetodo(metodo: MetodoEntrega): string {
  return TIENDA.entrega[metodo].nombre;
}

export const METODOS_ENTREGA: MetodoEntrega[] = ['recogida', 'domicilio', 'hospital'];
