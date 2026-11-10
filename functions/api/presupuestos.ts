/* POST /api/presupuestos → solicitud de presupuesto para bodas, comuniones, eventos y empresas. */

import { esFechaValida } from '../../compartido/fechas.ts';
import { NEGOCIO } from '../../compartido/negocio.ts';
import { TIPOS_PRESUPUESTO, emailValido, limpiarTexto, normalizarTelefono } from '../../compartido/pedido.ts';
import { avisarPresupuesto } from '../_lib/correo.ts';
import { nuevaReferencia, permitir } from '../_lib/datos.ts';
import type { Env } from '../_lib/entorno.ts';
import { entornoDe } from '../_lib/entorno.ts';
import { fallo, ipDe, json, leerJson, mismoOrigen, sha256 } from '../_lib/http.ts';

interface Entrada {
  tipo?: string;
  nombre?: string;
  telefono?: string;
  email?: string;
  fecha?: string;
  mensaje?: string;
  acepta?: boolean;
  web?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  if (!env.DB) {
    return fallo(503, 'sin-base-de-datos', 'Ahora mismo no podemos recoger la solicitud aquí. Escríbenos por WhatsApp.', { porWhatsApp: true });
  }
  if (!mismoOrigen(request)) return fallo(403, 'origen', 'Petición no permitida.');
  const db = env.DB;
  const ahora = new Date();

  const clave = 'presupuesto:' + (await sha256((env.SECRETO_SESION ?? 'floresloli') + ipDe(request))).slice(0, 24);
  if (!(await permitir(db, clave, 5, 3600, ahora))) {
    return fallo(429, 'demasiados-intentos', `Has enviado varias solicitudes seguidas. Si es urgente, llámanos al ${NEGOCIO.telefono}.`);
  }

  const d = (await leerJson(request, 8000)) as Entrada | null;
  if (!d || (typeof d.web === 'string' && d.web.trim() !== '')) {
    return fallo(400, 'datos', 'No hemos podido leer la solicitud. Recarga la página e inténtalo de nuevo.');
  }

  const errores: Record<string, string> = {};
  const tipo = TIPOS_PRESUPUESTO.some((t) => t.id === d.tipo) ? String(d.tipo) : '';
  if (!tipo) errores.tipo = 'Elige para qué es.';
  const nombre = limpiarTexto(d.nombre, 80);
  if (nombre.length < 2) errores.nombre = 'Escribe tu nombre.';
  const telefono = normalizarTelefono(limpiarTexto(d.telefono, 25));
  if (!telefono) errores.telefono = 'Escribe un teléfono válido, con sus 9 cifras.';
  const email = limpiarTexto(d.email, 120).toLowerCase();
  if (email && !emailValido(email)) errores.email = 'Ese correo no parece válido. Revísalo o déjalo en blanco.';
  const fecha = d.fecha ? String(d.fecha) : '';
  if (fecha && !esFechaValida(fecha)) errores.fecha = 'Esa fecha no es válida.';
  const mensaje = limpiarTexto(d.mensaje, 1500, true);
  if (mensaje.length < 10) errores.mensaje = 'Cuéntanos qué necesitas, aunque sea en dos líneas.';
  if (d.acepta !== true) errores.acepta = 'Marca la casilla para aceptar la política de privacidad.';

  if (Object.keys(errores).length) return json({ error: 'validacion', mensaje: 'Revisa los datos marcados.', errores }, 422);

  const entorno = entornoDe(env);
  const ref = nuevaReferencia(ahora, 'P');
  await db
    .prepare('INSERT INTO presupuestos (ref, creado, entorno, tipo, fecha_evento, nombre, telefono, email, mensaje) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(ref, ahora.toISOString(), entorno, tipo, fecha, nombre, telefono, email, mensaje)
    .run();

  waitUntil(
    avisarPresupuesto(env, { ref, tipo, nombre, telefono: telefono!, email, fecha, mensaje, entorno }, new URL(request.url).origin).catch((error) =>
      console.error('Aviso de presupuesto', ref, error),
    ),
  );

  return json({ ok: true, ref }, 201);
};
