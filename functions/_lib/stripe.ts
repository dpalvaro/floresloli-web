/* =====================================================================
   STRIPE, sin dependencias: llamadas a la API REST con fetch.

   Se usa Stripe Checkout (la página de pago la aloja Stripe): la web nunca
   ve ni guarda datos de tarjeta. Los métodos de pago (tarjeta, Bizum,
   Apple Pay…) se activan en el panel de Stripe, sin tocar código.
   ===================================================================== */

import { hmacSha256, igualesSeguro } from './http.ts';

const API = 'https://api.stripe.com/v1';

/** { a: { b: [1, 2] } } → a[b][0]=1&a[b][1]=2, que es como lo espera Stripe. */
export function aFormulario(datos: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  const recorrer = (valor: unknown, clave: string) => {
    if (valor === undefined || valor === null) return;
    if (Array.isArray(valor)) valor.forEach((v, i) => recorrer(v, `${clave}[${i}]`));
    else if (typeof valor === 'object') {
      for (const [k, v] of Object.entries(valor as Record<string, unknown>)) recorrer(v, `${clave}[${k}]`);
    } else params.append(clave, String(valor));
  };
  for (const [k, v] of Object.entries(datos)) recorrer(v, k);
  return params;
}

export class ErrorStripe extends Error {
  estado: number;
  constructor(mensaje: string, estado: number) {
    super(mensaje);
    this.estado = estado;
  }
}

async function llamar(clave: string, metodo: 'GET' | 'POST', ruta: string, datos?: Record<string, unknown>, idempotencia?: string): Promise<any> {
  const cabeceras: Record<string, string> = { Authorization: `Bearer ${clave}` };
  if (datos) cabeceras['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencia) cabeceras['Idempotency-Key'] = idempotencia;
  const respuesta = await fetch(API + ruta, { method: metodo, headers: cabeceras, body: datos ? aFormulario(datos).toString() : undefined });
  const cuerpo: any = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new ErrorStripe(cuerpo?.error?.message ?? `Stripe respondió ${respuesta.status}`, respuesta.status);
  return cuerpo;
}

export interface LineaCobro {
  nombre: string;
  /** Céntimos por unidad. */
  importe: number;
  cantidad: number;
}

export interface DatosSesion {
  ref: string;
  email: string;
  lineas: LineaCobro[];
  urlExito: string;
  urlCancelacion: string;
  /** Minutos hasta que caduca la página de pago (mínimo 30 en Stripe). */
  minutos: number;
  descripcion: string;
}

export async function crearSesionDePago(clave: string, d: DatosSesion, ahora: Date = new Date()): Promise<{ id: string; url: string }> {
  const sesion = await llamar(
    clave,
    'POST',
    '/checkout/sessions',
    {
      mode: 'payment',
      locale: 'es',
      client_reference_id: d.ref,
      customer_email: d.email || undefined,
      success_url: d.urlExito,
      cancel_url: d.urlCancelacion,
      expires_at: Math.floor(ahora.getTime() / 1000) + Math.max(30, d.minutos) * 60 + 30,
      metadata: { ref: d.ref },
      payment_intent_data: { description: d.descripcion, metadata: { ref: d.ref } },
      line_items: d.lineas.map((l) => ({
        quantity: l.cantidad,
        price_data: { currency: 'eur', unit_amount: l.importe, product_data: { name: l.nombre } },
      })),
    },
    `sesion-${d.ref}`,
  );
  if (!sesion?.url || !sesion?.id) throw new ErrorStripe('Stripe no devolvió la página de pago', 502);
  return { id: sesion.id, url: sesion.url };
}

export function leerSesionDePago(clave: string, id: string): Promise<any> {
  return llamar(clave, 'GET', `/checkout/sessions/${encodeURIComponent(id)}`);
}

/**
 * Comprueba la firma de un aviso (webhook) de Stripe y devuelve el evento, o null si no es de fiar.
 * Cabecera: «t=1699999999,v1=firma[,v1=otra]». Firma = HMAC-SHA256(secreto, «t.cuerpo»).
 */
export async function verificarAviso(cuerpo: string, cabecera: string | null, secreto: string, ahora: Date = new Date(), toleranciaSeg = 300): Promise<any | null> {
  if (!cabecera || !secreto) return null;
  let t = '';
  const firmas: string[] = [];
  for (const parte of cabecera.split(',')) {
    const [k, v] = parte.split('=').map((x) => x.trim());
    if (k === 't') t = v;
    if (k === 'v1' && v) firmas.push(v);
  }
  if (!/^\d+$/.test(t) || !firmas.length) return null;
  if (Math.abs(Math.floor(ahora.getTime() / 1000) - Number(t)) > toleranciaSeg) return null;
  const esperada = await hmacSha256(secreto, `${t}.${cuerpo}`);
  if (!firmas.some((f) => igualesSeguro(f, esperada))) return null;
  try {
    return JSON.parse(cuerpo);
  } catch {
    return null;
  }
}
