/* =====================================================================
   SERVIDOR PROPIO DE LA TIENDA

   Un solo proceso de Node, sin dependencias, que sirve la web compilada
   (dist/) y la API (functions/), con la base de datos en un archivo SQLite.
   Escucha solo en 127.0.0.1: delante está Caddy, que pone el HTTPS y dice
   cuál es la IP real del cliente. Todo el montaje, en docs/SERVIDOR.md.

   Variables (en el servidor las pone systemd desde /etc/floresloli/entorno;
   en local se leen de .dev.vars):
     ENTORNO, PANEL_CLAVE, SECRETO_SESION, STRIPE_SECRET_KEY,
     STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, CORREO_REMITENTE y
     CORREO_AVISOS                        las mismas que en Cloudflare
     URL_PUBLICA  https://dominio-de-la-tienda. Manda sobre la cabecera Host,
                  así nadie puede cambiar las direcciones que salen en los
                  pagos o en los correos.
     BASE_DATOS   archivo SQLite (por defecto .datos/tienda.sqlite)
     WEB          carpeta de la web compilada (por defecto dist/)
     PUERTO       por defecto 8788
     DIRECCION    por defecto 127.0.0.1
   ===================================================================== */

import { existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { abrirBaseDatos } from './d1.ts';
import type { BaseDatosD1 } from './d1.ts';
import { crearEstaticos } from './estaticos.ts';
import { cargarFunciones } from './funciones.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Límite del cuerpo de una petición. La API lee como mucho 20 kB; los avisos de Stripe son pequeños. */
export const MAX_CUERPO = 1024 * 1024;

/** Variables que se pasan a la API. Nada más del entorno del proceso llega a las funciones. */
const VARIABLES = [
  'ENTORNO',
  'PANEL_CLAVE',
  'SECRETO_SESION',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'CORREO_REMITENTE',
  'CORREO_AVISOS',
  'URL_PUBLICA',
];

/** Cabeceras que no pasan del cliente a la API: las de conexión y las de IP, que se calculan aquí. */
const QUITAR = new Set(['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer', 'http2-settings', 'cf-connecting-ip', 'x-forwarded-for', 'x-real-ip', 'forwarded', 'true-client-ip']);

const esLocal = (ip: string) => ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

/**
 * IP del cliente. Solo se cree a X-Real-IP si la conexión viene de esta misma
 * máquina (Caddy); Caddy la escribe siempre, así que el cliente no la puede falsear.
 */
export function ipDelCliente(direccion: string | undefined, xRealIp: string | string[] | undefined): string {
  const socket = (direccion ?? '').replace(/^::ffff:/, '');
  const dicha = typeof xRealIp === 'string' ? xRealIp.trim() : '';
  if (esLocal(direccion ?? '') && dicha && isIP(dicha)) return dicha;
  return isIP(socket) ? socket : 'desconocida';
}

class CuerpoDemasiadoGrande extends Error {}

async function leerCuerpo(req: IncomingMessage): Promise<Buffer> {
  const declarado = Number(req.headers['content-length'] ?? '0');
  if (declarado > MAX_CUERPO) throw new CuerpoDemasiadoGrande();
  const trozos: Buffer[] = [];
  let total = 0;
  for await (const trozo of req) {
    total += (trozo as Buffer).length;
    if (total > MAX_CUERPO) throw new CuerpoDemasiadoGrande();
    trozos.push(trozo as Buffer);
  }
  return Buffer.concat(trozos);
}

async function aPeticionWeb(req: IncomingMessage, base: URL | null): Promise<Request> {
  const objetivo = req.url ?? '/';
  // Solo rutas normales («/algo»): nada de «http://otro-sitio/…» ni «*».
  if (!objetivo.startsWith('/') || objetivo.startsWith('//')) throw new TypeError('ruta');
  const origen = base ?? new URL(`http://${req.headers.host && /^[\w.:[\]-]+$/.test(req.headers.host) ? req.headers.host : '127.0.0.1'}`);
  // Se pega la ruta al origen como texto: con new URL(ruta, origen), «/\otro.example» acabaría en otro dominio.
  const url = new URL(origen.origin + objetivo);
  if (url.origin !== origen.origin) throw new TypeError('ruta');

  const cabeceras = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined || QUITAR.has(k)) continue;
    if (Array.isArray(v)) for (const x of v) cabeceras.append(k, x);
    else cabeceras.set(k, v);
  }
  cabeceras.set('cf-connecting-ip', ipDelCliente(req.socket.remoteAddress, req.headers['x-real-ip']));
  if (base) cabeceras.set('host', base.host);

  const metodo = (req.method ?? 'GET').toUpperCase();
  const conCuerpo = metodo !== 'GET' && metodo !== 'HEAD';
  const cuerpo = conCuerpo ? await leerCuerpo(req) : null;
  return new Request(url, { method: metodo, headers: cabeceras, body: cuerpo && cuerpo.length ? Uint8Array.from(cuerpo) : null });
}

async function escribir(res: ServerResponse, respuesta: Response, cabeza: boolean): Promise<void> {
  res.statusCode = respuesta.status;
  for (const [k, v] of respuesta.headers) {
    if (k === 'set-cookie') continue;
    res.setHeader(k, v);
  }
  const cookies = respuesta.headers.getSetCookie();
  if (cookies.length) res.setHeader('set-cookie', cookies);
  if (cabeza || !respuesta.body || respuesta.status === 204 || respuesta.status === 304) {
    await respuesta.body?.cancel().catch(() => {});
    res.end();
    return;
  }
  await pipeline(Readable.fromWeb(respuesta.body as import('node:stream/web').ReadableStream), res);
}

function textoPlano(res: ServerResponse, estado: number, texto: string): void {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(estado, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'close' });
  res.end(texto);
}

export interface Opciones {
  web: string;
  funciones: string;
  baseDatos: string;
  variables: Record<string, string | undefined>;
}

export interface Tienda {
  servidor: Server;
  db: BaseDatosD1;
  rutas: string[];
  /** Deja de aceptar peticiones, espera a las que están en marcha y a las tareas pendientes, y cierra la base de datos. */
  cerrar(): Promise<void>;
}

export async function crearTienda(opciones: Opciones): Promise<Tienda> {
  const urlPublica = (opciones.variables.URL_PUBLICA ?? '').trim();
  let base: URL | null = null;
  if (urlPublica) {
    base = new URL(urlPublica);
    if (base.protocol !== 'https:' && base.hostname !== '127.0.0.1' && base.hostname !== 'localhost') {
      throw new Error('URL_PUBLICA tiene que empezar por https://');
    }
  }
  if ((opciones.variables.ENTORNO ?? '').trim().toLowerCase() === 'produccion' && !base) {
    console.warn('Aviso: en producción conviene poner URL_PUBLICA (https://dominio-de-la-tienda).');
  }

  mkdirSync(dirname(opciones.baseDatos), { recursive: true });
  const db = abrirBaseDatos(opciones.baseDatos);
  const env: Record<string, unknown> = { DB: db };
  for (const clave of VARIABLES) {
    const valor = opciones.variables[clave];
    if (valor !== undefined && valor !== '') env[clave] = valor;
  }

  const estaticos = crearEstaticos(opciones.web);
  const funciones = await cargarFunciones(opciones.funciones);

  // Tareas que siguen después de responder (avisos, correos, limpieza): se esperan al apagar.
  const pendientes = new Set<Promise<unknown>>();
  const waitUntil = (tarea: Promise<unknown>) => {
    const p: Promise<unknown> = Promise.resolve(tarea)
      .catch((error) => console.error('Tarea en segundo plano', error))
      .finally(() => pendientes.delete(p));
    pendientes.add(p);
  };

  const servidor = createServer(async (req, res) => {
    let peticion: Request;
    try {
      peticion = await aPeticionWeb(req, base);
    } catch (error) {
      if (error instanceof CuerpoDemasiadoGrande) return textoPlano(res, 413, 'Petición demasiado grande.');
      return textoPlano(res, 400, 'Petición no válida.');
    }
    try {
      const respuesta = await funciones.atender(peticion, env, waitUntil, estaticos);
      await escribir(res, respuesta, peticion.method === 'HEAD');
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ERR_STREAM_PREMATURE_CLOSE') return; // el cliente se fue a mitad
      console.error('Error al atender', peticion.method, new URL(peticion.url).pathname, error);
      textoPlano(res, 500, 'Algo ha fallado por nuestra parte. Inténtalo de nuevo en un momento.');
    }
  });
  // Límites: nadie puede dejar conexiones colgadas ni mandar cabeceras eternas.
  servidor.headersTimeout = 15_000;
  servidor.requestTimeout = 30_000;
  servidor.keepAliveTimeout = 5_000;
  servidor.maxHeadersCount = 100;
  servidor.maxConnections = 1024;

  return {
    servidor,
    db,
    rutas: funciones.rutas,
    async cerrar() {
      await new Promise<void>((ok) => {
        servidor.close(() => ok());
        servidor.closeIdleConnections();
      });
      await Promise.race([Promise.allSettled([...pendientes]), new Promise((ok) => setTimeout(ok, 10_000))]);
      db.cerrar();
    },
  };
}

/* ---------- Arranque (node servidor/servidor.ts) ---------- */

async function arrancar(): Promise<void> {
  const local = join(RAIZ, '.dev.vars');
  // En el servidor manda systemd. En local, si no hay variables, se leen las de .dev.vars.
  if (!process.env.ENTORNO && existsSync(local)) process.loadEnvFile(local);

  const variables = process.env;
  const tienda = await crearTienda({
    web: resolve(variables.WEB ?? join(RAIZ, 'dist')),
    funciones: join(RAIZ, 'functions'),
    baseDatos: resolve(variables.BASE_DATOS ?? join(RAIZ, '.datos', 'tienda.sqlite')),
    variables,
  });

  const puerto = Number(variables.PUERTO ?? 8788);
  const direccion = variables.DIRECCION ?? '127.0.0.1';
  tienda.servidor.listen(puerto, direccion, () => {
    console.log(`Tienda en http://${direccion}:${puerto} · entorno ${(variables.ENTORNO ?? 'produccion').trim()} · ${tienda.rutas.length} rutas de API`);
  });

  let apagando = false;
  const apagar = async (senal: string) => {
    if (apagando) return;
    apagando = true;
    console.log(`${senal}: cerrando con orden…`);
    await tienda.cerrar();
    process.exit(0);
  };
  process.on('SIGTERM', () => void apagar('SIGTERM'));
  process.on('SIGINT', () => void apagar('SIGINT'));
  process.on('unhandledRejection', (error) => console.error('Promesa sin atender', error));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  arrancar().catch((error) => {
    console.error('No se ha podido arrancar la tienda', error);
    process.exit(1);
  });
}
