/* Utilidades de respuesta y de lectura de peticiones. */

const CABECERAS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function json(datos: unknown, estado = 200, cabeceras: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(datos), { status: estado, headers: { ...CABECERAS, ...cabeceras } });
}

/** Error con un código estable (para el programa) y un mensaje (para la persona). */
export function fallo(estado: number, error: string, mensaje: string, extra: Record<string, unknown> = {}): Response {
  return json({ error, mensaje, ...extra }, estado);
}

/** Lee un cuerpo JSON con límite de tamaño. null si no es JSON válido o es demasiado grande. */
export async function leerJson(request: Request, maxBytes = 20_000): Promise<unknown | null> {
  const largo = Number(request.headers.get('content-length') ?? '0');
  if (largo > maxBytes) return null;
  let texto: string;
  try {
    texto = await request.text();
  } catch {
    return null;
  }
  if (texto.length > maxBytes) return null;
  try {
    const datos = JSON.parse(texto);
    return datos && typeof datos === 'object' ? datos : null;
  } catch {
    return null;
  }
}

/**
 * ¿Viene la petición de nuestra propia web? Los navegadores mandan Origin en los POST;
 * si falta (curl, pruebas) se acepta, porque no hay sesión de navegador que proteger.
 */
export function mismoOrigen(request: Request): boolean {
  const origen = request.headers.get('origin');
  if (!origen) return true;
  try {
    return new URL(origen).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function ipDe(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'desconocida';
}

/* ---------- Criptografía pequeña (Web Crypto) ---------- */

const codificador = new TextEncoder();

export function hex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

export async function sha256(texto: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', codificador.encode(texto)));
}

export async function hmacSha256(secreto: string, mensaje: string): Promise<string> {
  const clave = await crypto.subtle.importKey('raw', codificador.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', clave, codificador.encode(mensaje)));
}

/** Comparación en tiempo constante de dos textos (para firmas y claves). */
export function igualesSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

export function aleatorioHex(bytes = 16): string {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}
