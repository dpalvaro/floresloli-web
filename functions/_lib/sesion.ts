/* =====================================================================
   SESIÓN DEL PANEL

   Una sola clave (PANEL_CLAVE) para entrar. La sesión es una cookie
   firmada (HMAC) que caduca a las 12 horas: no se guarda nada en la base
   de datos. La cookie solo viaja a /api/panel, por HTTPS, y el navegador
   no deja leerla desde JavaScript (HttpOnly) ni mandarla desde otras webs
   (SameSite=Strict).
   ===================================================================== */

import type { Env } from './entorno.ts';
import { hmacSha256, igualesSeguro, sha256 } from './http.ts';

const NOMBRE = 'panel_sesion';
const HORAS = 12;

function leerCookie(request: Request, nombre: string): string | null {
  const cabecera = request.headers.get('cookie') ?? '';
  for (const trozo of cabecera.split(';')) {
    const [k, ...v] = trozo.trim().split('=');
    if (k === nombre) return v.join('=');
  }
  return null;
}

export async function claveCorrecta(env: Env, clave: unknown): Promise<boolean> {
  if (typeof clave !== 'string' || !env.PANEL_CLAVE || env.PANEL_CLAVE.length < 8) return false;
  // Se comparan los resúmenes, de la misma longitud, en tiempo constante.
  return igualesSeguro(await sha256('panel:' + clave), await sha256('panel:' + env.PANEL_CLAVE));
}

export async function cookieDeSesion(env: Env, ahora: Date = new Date()): Promise<string> {
  const caduca = Math.floor(ahora.getTime() / 1000) + HORAS * 3600;
  const firma = await hmacSha256(env.SECRETO_SESION!, `panel.${caduca}`);
  return `${NOMBRE}=${caduca}.${firma}; Path=/api/panel; Max-Age=${HORAS * 3600}; HttpOnly; Secure; SameSite=Strict`;
}

export function cookieDeSalida(): string {
  return `${NOMBRE}=; Path=/api/panel; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export async function sesionValida(request: Request, env: Env, ahora: Date = new Date()): Promise<boolean> {
  if (!env.SECRETO_SESION || env.SECRETO_SESION.length < 24) return false;
  const valor = leerCookie(request, NOMBRE);
  if (!valor) return false;
  const [caduca, firma] = valor.split('.');
  if (!/^\d+$/.test(caduca ?? '') || !firma) return false;
  if (Number(caduca) < Math.floor(ahora.getTime() / 1000)) return false;
  return igualesSeguro(firma, await hmacSha256(env.SECRETO_SESION, `panel.${caduca}`));
}
