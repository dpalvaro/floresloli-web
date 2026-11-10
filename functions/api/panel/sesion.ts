/* =====================================================================
   /api/panel/sesion
     GET    → ¿hay sesión abierta? ¿está el panel configurado?
     POST   → entrar con la clave (como mucho 6 intentos cada 15 minutos)
     DELETE → salir
   ===================================================================== */

import { permitir } from '../../_lib/datos.ts';
import type { Env } from '../../_lib/entorno.ts';
import { estadoTienda } from '../../_lib/entorno.ts';
import { fallo, ipDe, json, leerJson, sha256 } from '../../_lib/http.ts';
import { claveCorrecta, cookieDeSalida, cookieDeSesion, sesionValida } from '../../_lib/sesion.ts';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const tienda = estadoTienda(env);
  return json({ dentro: tienda.panel && (await sesionValida(request, env)), configurado: tienda.panel, entorno: tienda.entorno });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const tienda = estadoTienda(env);
  if (!tienda.panel) {
    return fallo(503, 'sin-configurar', 'El panel todavía no tiene clave. Hay que poner PANEL_CLAVE y SECRETO_SESION en Cloudflare.');
  }
  const clave = 'panel:' + (await sha256((env.SECRETO_SESION ?? '') + ipDe(request))).slice(0, 24);
  if (!(await permitir(env.DB!, clave, 6, 900))) {
    return fallo(429, 'demasiados-intentos', 'Demasiados intentos. Espera un cuarto de hora y vuelve a probar.');
  }
  const datos = (await leerJson(request, 1000)) as { clave?: unknown } | null;
  if (!(await claveCorrecta(env, datos?.clave))) return fallo(401, 'clave', 'La clave no es correcta.');
  return json({ dentro: true, entorno: tienda.entorno }, 200, { 'Set-Cookie': await cookieDeSesion(env) });
};

export const onRequestDelete: PagesFunction<Env> = async () => json({ dentro: false }, 200, { 'Set-Cookie': cookieDeSalida() });
