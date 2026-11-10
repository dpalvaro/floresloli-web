/* =====================================================================
   DATOS DEL NEGOCIO
   Fuente: ficha de Loli (impulsadt-operaciones/clientes/loli/ficha.md)
   y landing de Todos los Santos aprobada por Álvaro (28/10/2026).

   Regla: aquí no se inventa nada. Lo que no está confirmado va a null
   y se apunta en compartido/pendientes.ts.
   ===================================================================== */

export interface TramoHorario {
  /** Días de la semana: 0 = domingo, 1 = lunes … 6 = sábado. */
  dias: number[];
  /** Tramos de apertura en hora local (Europe/Madrid), «HH:MM». */
  tramos: [string, string][];
}

export const NEGOCIO = {
  nombre: 'Flores y Plantas Loli',
  /** Como aparece en el rótulo de la tienda. */
  nombreCorto: 'Flores Loli',

  direccion: {
    calle: 'Calle Río Alberche, 30',
    cp: '45007',
    ciudad: 'Toledo',
    provincia: 'Toledo',
    barrio: 'Polígono',
    barrioOficial: 'Santa María de Benquerencia',
    pais: 'ES',
  },

  /** Coordenadas de la tienda (ficha de Google Maps, consultada el 10/11/2026). */
  geo: { lat: 39.865019, lng: -3.951514 },

  telefono: '925 24 07 08',
  movil: '635 54 37 63',
  /** WhatsApp de pedidos: con prefijo 34 y sin espacios. Está en el rótulo. */
  whatsapp: '34635543763',
  correo: 'floreslolitoledo@gmail.com',

  horario: [
    { dias: [1, 2, 3, 4, 5], tramos: [['09:30', '14:00'], ['17:00', '20:00']] },
    { dias: [6], tramos: [['10:00', '14:00']] },
  ] as TramoHorario[],

  /** Redes. Solo se enlazan las que tienen url y confirmada = true. */
  redes: {
    // PENDIENTE: dirección de la página de Facebook.
    facebook: { url: null as string | null, confirmada: false },
    // PENDIENTE: confirmar que @floresyplantasloli está activa (rotulada en el escaparate).
    instagram: { url: 'https://www.instagram.com/floresyplantasloli/', confirmada: false },
  },

  /** Titular (aviso legal, condiciones y privacidad). Datos dados por Álvaro el 28/10/2026. */
  legal: {
    titular: 'Maria Francisca García López',
    nif: '03863364P',
    /** Persona física (autónoma). Si se crea una sociedad, cambian estos datos. */
    forma: 'autonoma' as 'autonoma' | 'sociedad',
    /** PENDIENTE: domicilio a efectos legales. Mientras sea null se usa la dirección de la tienda. */
    domicilio: null as string | null,
  },

  web: {
    /**
     * Dirección pública, sin barra final. Si se compra un dominio propio se cambia
     * aquí (y solo aquí): canonical, Open Graph, sitemap y robots salen de este valor.
     */
    url: 'https://floresyplantasloli.pages.dev',
  },

  /**
   * PENDIENTE: logo en buena calidad (T15). Cuando llegue: guárdalo en
   * src/assets/logo.svg (o .png) y pon aquí el nombre del archivo.
   * Mientras sea null, la cabecera escribe el nombre con la tipografía de la web.
   */
  logo: null as string | null,

  hospital: {
    nombre: 'Hospital Universitario de Toledo',
    siglas: 'HUT',
    direccion: 'Avenida del Río Guadiana, 45007 Toledo',
  },
} as const;

/* ---------- Utilidades de contacto ---------- */

const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function enlaceTelefono(numero: string): string {
  return 'tel:+34' + numero.replace(/\D/g, '');
}

/** Todos los encargos por WhatsApp empiezan así: es como se mide la captación de la web. */
export const SALUDO_WHATSAPP = 'Hola, quiero hacer un encargo desde la web';

export function enlaceWhatsApp(texto: string = SALUDO_WHATSAPP + '.'): string {
  return `https://wa.me/${NEGOCIO.whatsapp}?text=${encodeURIComponent(texto)}`;
}

export function direccionCompleta(): string {
  const d = NEGOCIO.direccion;
  return `${d.calle}, ${d.cp} ${d.ciudad}`;
}

export function domicilioLegal(): string {
  return NEGOCIO.legal.domicilio ?? direccionCompleta();
}

export function enlaceMapa(): string {
  const consulta = `${NEGOCIO.nombre}, ${direccionCompleta()}`;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(consulta);
}

export function enlaceComoLlegar(): string {
  const destino = `${NEGOCIO.nombre}, ${direccionCompleta()}`;
  return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(destino);
}

function hora(h: string): string {
  // «09:30» → «9:30»
  return h.replace(/^0/, '');
}

/** Horario agrupado para mostrar: [{ dias: 'Lunes a viernes', horas: ['9:30 – 14:00', '17:00 – 20:00'] }, …]. */
export function horarioParaMostrar(): { dias: string; horas: string[] }[] {
  const filas = NEGOCIO.horario.map((h) => {
    const dias = [...h.dias].sort((a, b) => a - b);
    const seguido = dias.every((d, i) => i === 0 || d === dias[i - 1] + 1);
    let nombre: string;
    if (dias.length === 1) nombre = NOMBRE_DIA[dias[0]] + 's';
    else if (seguido) nombre = `${NOMBRE_DIA[dias[0]]} a ${NOMBRE_DIA[dias[dias.length - 1]]}`;
    else nombre = dias.map((d) => NOMBRE_DIA[d]).join(', ');
    return {
      dias: nombre.charAt(0).toUpperCase() + nombre.slice(1),
      horas: h.tramos.map(([a, c]) => `${hora(a)} – ${hora(c)}`),
    };
  });
  const abiertos = new Set(NEGOCIO.horario.flatMap((h) => h.dias));
  const cerrados = [0, 1, 2, 3, 4, 5, 6].filter((d) => !abiertos.has(d));
  if (cerrados.length) {
    const nombre = cerrados.map((d) => NOMBRE_DIA[d] + 's').join(' y ');
    filas.push({ dias: nombre.charAt(0).toUpperCase() + nombre.slice(1), horas: ['Cerrado'] });
  }
  return filas;
}

/** Tramos de un día de la semana (0-6). Vacío si ese día se cierra. */
export function tramosDelDia(diaSemana: number): [string, string][] {
  const h = NEGOCIO.horario.find((x) => x.dias.includes(diaSemana));
  return h ? h.tramos.map((t) => [t[0], t[1]] as [string, string]) : [];
}

export function nombreDia(diaSemana: number): string {
  return NOMBRE_DIA[diaSemana];
}
