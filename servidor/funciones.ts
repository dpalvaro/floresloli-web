/* =====================================================================
   PAGES FUNCTIONS EN NODE

   Carga la carpeta functions/ y reparte las peticiones igual que Cloudflare
   Pages, para que la misma API funcione en Cloudflare (vistas previas) y en
   el servidor propio (producción) sin tocarla:

   · Cada archivo es una ruta: api/estado.ts → /api/estado,
     api/pedidos/index.ts → /api/pedidos, api/pedidos/[ref].ts → /api/pedidos/:ref
     y [[resto]].ts recoge el resto de la ruta.
   · _middleware.ts se ejecuta antes que todo lo de su carpeta, de fuera adentro.
   · onRequest atiende cualquier método; onRequestGet, onRequestPost… solo el suyo.
   · Lo que no tiene función pasa a los archivos de la web (dist/).

   Las carpetas que empiezan por «_» (como _lib) son código de apoyo, no rutas.
   ===================================================================== */

import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

type Manejador = (contexto: Contexto) => Response | Promise<Response>;
type Modulo = Record<string, unknown>;

export interface Contexto {
  request: Request;
  env: Record<string, unknown>;
  params: Record<string, string | string[]>;
  data: Record<string, unknown>;
  functionPath: string;
  next: (entrada?: Request | string, init?: RequestInit) => Promise<Response>;
  waitUntil: (tarea: Promise<unknown>) => void;
  passThroughOnException: () => void;
}

type Segmento = { tipo: 'fijo'; valor: string } | { tipo: 'param'; nombre: string } | { tipo: 'resto'; nombre: string };

interface Ruta {
  /** Como lo escribe Cloudflare: /api/pedidos/:ref */
  patron: string;
  segmentos: Segmento[];
  modulo: Modulo;
}

interface Middleware {
  /** Carpeta a la que se aplica, sin barra final («» = toda la web). */
  base: string;
  manejadores: Manejador[];
}

const METODOS: Record<string, string> = {
  GET: 'onRequestGet',
  HEAD: 'onRequestHead',
  POST: 'onRequestPost',
  PUT: 'onRequestPut',
  PATCH: 'onRequestPatch',
  DELETE: 'onRequestDelete',
  OPTIONS: 'onRequestOptions',
};

function archivosTs(carpeta: string): string[] {
  const lista: string[] = [];
  for (const nombre of readdirSync(carpeta).sort()) {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) {
      if (!nombre.startsWith('_') && !nombre.startsWith('.')) lista.push(...archivosTs(ruta));
    } else if (/\.(ts|js|mjs)$/.test(nombre) && !nombre.endsWith('.d.ts')) {
      lista.push(ruta);
    }
  }
  return lista;
}

function segmentosDe(partes: string[]): Segmento[] {
  return partes.map((p) => {
    let m: RegExpExecArray | null;
    if ((m = /^\[\[(\w+)\]\]$/.exec(p))) return { tipo: 'resto', nombre: m[1] };
    if ((m = /^\[(\w+)\]$/.exec(p))) return { tipo: 'param', nombre: m[1] };
    return { tipo: 'fijo', valor: p };
  });
}

/** Como en Cloudflare: primero las rutas más largas y, a igual largo, lo fijo antes que los parámetros. */
function comparar(a: Ruta, b: Ruta): number {
  if (a.segmentos.length !== b.segmentos.length) return b.segmentos.length - a.segmentos.length;
  const peso = (s: Segmento) => (s.tipo === 'fijo' ? 0 : s.tipo === 'param' ? 1 : 2);
  for (let i = 0; i < a.segmentos.length; i++) {
    const d = peso(a.segmentos[i]) - peso(b.segmentos[i]);
    if (d) return d;
  }
  return 0;
}

function manejadoresDe(valor: unknown): Manejador[] {
  if (typeof valor === 'function') return [valor as Manejador];
  if (Array.isArray(valor)) return valor.filter((v): v is Manejador => typeof v === 'function');
  return [];
}

function encajar(ruta: Ruta, partes: string[]): Record<string, string | string[]> | null {
  const params: Record<string, string | string[]> = {};
  for (let i = 0; i < ruta.segmentos.length; i++) {
    const s = ruta.segmentos[i];
    if (s.tipo === 'resto') {
      const resto = partes.slice(i);
      if (!resto.length) return null;
      params[s.nombre] = resto;
      return params;
    }
    const parte = partes[i];
    if (parte === undefined) return null;
    if (s.tipo === 'fijo') {
      if (s.valor !== parte) return null;
    } else {
      params[s.nombre] = parte;
    }
  }
  return partes.length === ruta.segmentos.length ? params : null;
}

function partesDe(pathname: string): string[] {
  return pathname
    .split('/')
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
}

export interface Funciones {
  /** Rutas cargadas, para el arranque y las pruebas. */
  rutas: string[];
  atender(request: Request, env: Record<string, unknown>, waitUntil: (tarea: Promise<unknown>) => void, estaticos: (request: Request) => Promise<Response>): Promise<Response>;
}

export async function cargarFunciones(carpeta: string): Promise<Funciones> {
  const rutas: Ruta[] = [];
  const middlewares: Middleware[] = [];

  for (const archivo of archivosTs(carpeta)) {
    const partes = relative(carpeta, archivo).split(sep);
    const nombre = partes.pop()!.replace(/\.(ts|js|mjs)$/, '');
    const modulo = (await import(pathToFileURL(archivo).href)) as Modulo;
    if (nombre === '_middleware') {
      const manejadores = manejadoresDe(modulo.onRequest);
      if (manejadores.length) middlewares.push({ base: partes.length ? '/' + partes.join('/') : '', manejadores });
      continue;
    }
    if (nombre.startsWith('_')) continue;
    if (!Object.keys(modulo).some((k) => /^onRequest/.test(k))) continue;
    if (nombre !== 'index') partes.push(nombre);
    const segmentos = segmentosDe(partes);
    const patron = '/' + segmentos.map((s) => (s.tipo === 'fijo' ? s.valor : s.tipo === 'param' ? ':' + s.nombre : ':' + s.nombre + '*')).join('/');
    rutas.push({ patron, segmentos, modulo });
  }
  rutas.sort(comparar);
  // De fuera adentro: primero el de la raíz, después /api, después /api/panel…
  middlewares.sort((a, b) => a.base.split('/').length - b.base.split('/').length);

  return {
    rutas: rutas.map((r) => r.patron),
    async atender(peticion, env, waitUntil, estaticos) {
      let request = peticion;
      const ruta = new URL(request.url).pathname;
      const partes = partesDe(ruta);
      const aplicables = middlewares.filter((m) => m.base === '' || ruta === m.base || ruta.startsWith(m.base + '/'));
      const cadena = aplicables.flatMap((m) => m.manejadores);

      let destino: { ruta: Ruta; params: Record<string, string | string[]> } | null = null;
      for (const r of rutas) {
        const params = encajar(r, partes);
        if (params) {
          destino = { ruta: r, params };
          break;
        }
      }

      const data: Record<string, unknown> = {};
      let paso = 0;

      const contexto = (): Contexto => ({
        request,
        env,
        params: destino?.params ?? {},
        data,
        functionPath: destino?.ruta.patron ?? ruta,
        next: siguiente,
        waitUntil,
        passThroughOnException: () => {},
      });

      async function final(): Promise<Response> {
        if (!destino) return estaticos(request);
        const m = destino.ruta.modulo;
        const metodo = request.method.toUpperCase();
        let manejador = manejadoresDe(m[METODOS[metodo] ?? ''])[0] ?? manejadoresDe(m.onRequest)[0];
        if (!manejador && metodo === 'HEAD') manejador = manejadoresDe(m.onRequestGet)[0];
        if (!manejador) {
          const permitidos = Object.entries(METODOS)
            .filter(([, clave]) => typeof m[clave] === 'function')
            .map(([metodo]) => metodo);
          return new Response(JSON.stringify({ error: 'metodo', mensaje: 'Método no permitido.' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Allow: permitidos.join(', ') },
          });
        }
        return manejador(contexto());
      }

      async function siguiente(entrada?: Request | string, init?: RequestInit): Promise<Response> {
        if (entrada !== undefined) request = entrada instanceof Request && !init ? entrada : new Request(entrada, init);
        if (paso < cadena.length) return cadena[paso++](contexto());
        return final();
      }

      return siguiente();
    },
  };
}
