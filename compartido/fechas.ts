/* =====================================================================
   FECHAS DE ENTREGA: qué días se puede encargar y por qué no.
   Todo en hora de Madrid. Las fechas viajan como texto «AAAA-MM-DD».
   ===================================================================== */

import { NEGOCIO, tramosDelDia } from './negocio.ts';
import { TIENDA } from './tienda.ts';

export interface AhoraMadrid {
  /** AAAA-MM-DD */
  fecha: string;
  /** HH:MM (24 h) */
  hora: string;
  /** 0 = domingo … 6 = sábado */
  diaSemana: number;
}

/** Ajuste de un día concreto, hecho desde el panel. */
export interface AjusteDia {
  fecha: string;
  /** 'abierto' fuerza abrir (un domingo señalado), 'cerrado' fuerza cerrar, null no cambia nada. */
  estado: 'abierto' | 'cerrado' | null;
  /** Cupo de ese día; null = el general. */
  cupo: number | null;
  nota?: string | null;
}

export type MotivoNoDisponible = 'pasado' | 'cerrado' | 'festivo' | 'hora' | 'completo' | 'lejos';

export interface DiaEntrega {
  fecha: string;
  /** «Hoy, martes 10 de noviembre» */
  etiqueta: string;
  disponible: boolean;
  motivo: MotivoNoDisponible | null;
  /** Texto para el cliente cuando no está disponible. */
  aviso: string | null;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIA_CORTO: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const formatoMadrid = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

export function ahoraEnMadrid(ahora: Date = new Date()): AhoraMadrid {
  const p: Record<string, string> = {};
  for (const parte of formatoMadrid.formatToParts(ahora)) p[parte.type] = parte.value;
  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    hora: `${p.hour}:${p.minute}`,
    diaSemana: DIA_CORTO[p.weekday] ?? 0,
  };
}

export function esFechaValida(fecha: unknown): fecha is string {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [a, m, d] = fecha.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}

export function diaSemanaDe(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

/** «martes 10 de noviembre» (con el año si no es el actual). */
export function fechaLarga(fecha: string, hoy?: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const texto = `${DIAS[diaSemanaDe(fecha)]} ${d} de ${MESES[m - 1]}`;
  const anioActual = hoy ? Number(hoy.slice(0, 4)) : a;
  return a === anioActual ? texto : `${texto} de ${a}`;
}

/** «10/11/2026» */
export function fechaCorta(fecha: string): string {
  const [a, m, d] = fecha.split('-');
  return `${d}/${m}/${a}`;
}

export function etiquetaFecha(fecha: string, hoy: string): string {
  const larga = fechaLarga(fecha, hoy);
  if (fecha === hoy) return `Hoy, ${larga}`;
  if (fecha === sumarDias(hoy, 1)) return `Mañana, ${larga}`;
  return larga.charAt(0).toUpperCase() + larga.slice(1);
}

/** ¿Abre la tienda ese día según el horario y los festivos (sin contar los ajustes del panel)? */
export function abreSegunCalendario(fecha: string): { abre: boolean; motivo: 'cerrado' | 'festivo' | null } {
  if ((TIENDA.aperturasEspeciales as readonly string[]).includes(fecha)) return { abre: true, motivo: null };
  if ((TIENDA.festivos as readonly string[]).includes(fecha)) return { abre: false, motivo: 'festivo' };
  if (tramosDelDia(diaSemanaDe(fecha)).length === 0) return { abre: false, motivo: 'cerrado' };
  return { abre: true, motivo: null };
}

const AVISOS: Record<MotivoNoDisponible, string> = {
  pasado: 'Ese día ya ha pasado.',
  cerrado: 'Ese día la tienda está cerrada.',
  festivo: 'Ese día es festivo y la tienda está cerrada.',
  hora: `Para hoy ya no llegamos por la web. Llámanos al ${NEGOCIO.telefono} y lo vemos.`,
  completo: `Ese día ya no nos caben más pedidos por la web. Llámanos al ${NEGOCIO.telefono} y lo vemos.`,
  lejos: `Por la web se puede encargar con ${TIENDA.diasAntelacionMax} días de antelación como mucho.`,
};

/**
 * Estado de un día de entrega.
 * @param ocupados pedidos de la web que ya cuentan para ese día.
 */
export function estadoDia(
  fecha: string,
  ahora: AhoraMadrid,
  ajuste?: AjusteDia | null,
  ocupados: number = 0,
): DiaEntrega {
  const base = { fecha, etiqueta: etiquetaFecha(fecha, ahora.fecha) };
  const no = (motivo: MotivoNoDisponible): DiaEntrega => ({
    ...base,
    disponible: false,
    motivo,
    aviso: AVISOS[motivo],
  });

  if (fecha < ahora.fecha) return no('pasado');
  if (diasEntre(ahora.fecha, fecha) > TIENDA.diasAntelacionMax) return no('lejos');

  const calendario = abreSegunCalendario(fecha);
  let abre = calendario.abre;
  let motivoCierre: MotivoNoDisponible = calendario.motivo ?? 'cerrado';
  if (ajuste?.estado === 'abierto') abre = true;
  if (ajuste?.estado === 'cerrado') {
    abre = false;
    motivoCierre = 'cerrado';
  }
  if (!abre) return no(motivoCierre);

  if (fecha === ahora.fecha && ahora.hora >= TIENDA.horaLimiteMismoDia) return no('hora');

  const cupo = ajuste?.cupo ?? TIENDA.cupoDiario;
  if (ocupados >= cupo) return no('completo');

  return { ...base, disponible: true, motivo: null, aviso: null };
}

/** Los próximos días, con su estado. `ajustes` y `ocupacion` van indexados por fecha. */
export function calendarioEntrega(
  ahora: AhoraMadrid,
  ajustes: Map<string, AjusteDia> = new Map(),
  ocupacion: Map<string, number> = new Map(),
  dias: number = 30,
): DiaEntrega[] {
  const lista: DiaEntrega[] = [];
  for (let i = 0; i < dias; i++) {
    const fecha = sumarDias(ahora.fecha, i);
    lista.push(estadoDia(fecha, ahora, ajustes.get(fecha), ocupacion.get(fecha) ?? 0));
  }
  return lista;
}

/** ¿Está abierta la tienda ahora mismo? Para el «Abierto ahora» de la cabecera y el pie. */
export function estadoApertura(ahora: AhoraMadrid): {
  abierta: boolean;
  /** «Abierto ahora · cierra a las 14:00», «Cerrado · abre mañana a las 9:30»… */
  texto: string;
} {
  const quitarCero = (h: string) => h.replace(/^0/, '');
  const festivoHoy = !abreSegunCalendario(ahora.fecha).abre;
  const tramosHoy = festivoHoy ? [] : tramosDelDia(ahora.diaSemana);
  for (const [abre, cierra] of tramosHoy) {
    if (ahora.hora >= abre && ahora.hora < cierra) {
      return { abierta: true, texto: `Abierto ahora · cierra a las ${quitarCero(cierra)}` };
    }
  }
  const siguienteHoy = tramosHoy.find(([abre]) => ahora.hora < abre);
  if (siguienteHoy) return { abierta: false, texto: `Cerrado ahora · abre a las ${quitarCero(siguienteHoy[0])}` };
  for (let i = 1; i <= 7; i++) {
    const fecha = sumarDias(ahora.fecha, i);
    if (!abreSegunCalendario(fecha).abre) continue;
    const tramos = tramosDelDia(diaSemanaDe(fecha));
    if (!tramos.length) continue;
    const cuando = i === 1 ? 'mañana' : `el ${DIAS[diaSemanaDe(fecha)]}`;
    return { abierta: false, texto: `Cerrado ahora · abre ${cuando} a las ${quitarCero(tramos[0][0])}` };
  }
  return { abierta: false, texto: 'Cerrado ahora' };
}
