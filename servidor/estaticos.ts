/* =====================================================================
   ARCHIVOS DE LA WEB (carpeta dist/)

   Sirve la web compilada igual que Cloudflare Pages:
   · /tienda → /tienda/ (308) y /tienda/index.html → /tienda/ (308).
   · Lo que no existe devuelve 404.html con estado 404.
   · Las cabeceras salen del archivo _headers (el mismo que usa Cloudflare):
     seguridad (CSP, HSTS…), caché y noindex.
   · Rangos (Range) para el vídeo, que Safari los necesita, y ETag para no
     volver a mandar lo que el navegador ya tiene.

   Seguridad: nunca sale de dist/ (ni con «..» ni codificado), no sirve
   archivos ocultos ni _headers, y solo admite GET y HEAD.
   ===================================================================== */

import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import type { Stats } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

/** Archivos de configuración de Cloudflare que nunca se sirven. */
const RESERVADOS = new Set(['/_headers', '/_redirects', '/_routes.json', '/_worker.js']);

interface Regla {
  patron: RegExp;
  poner: [string, string][];
  quitar: string[];
}

/** Lee _headers con el formato de Cloudflare Pages: una ruta y debajo sus cabeceras con sangría. */
export function leerReglas(texto: string): Regla[] {
  const reglas: Regla[] = [];
  let actual: Regla | null = null;
  for (const linea of texto.split(/\r?\n/)) {
    if (!linea.trim() || linea.trim().startsWith('#')) continue;
    if (!/^\s/.test(linea)) {
      const ruta = linea.trim();
      // Las reglas con dominio (https://…) solo tienen sentido en Cloudflare.
      if (!ruta.startsWith('/')) {
        actual = null;
        continue;
      }
      const fuente = ruta
        .split('*')
        .map((trozo) => trozo.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:\w+/g, '[^/]+'))
        .join('.*');
      actual = { patron: new RegExp('^' + fuente + '$'), poner: [], quitar: [] };
      reglas.push(actual);
      continue;
    }
    if (!actual) continue;
    const t = linea.trim();
    if (t.startsWith('!')) {
      actual.quitar.push(t.slice(1).trim().toLowerCase());
      continue;
    }
    const i = t.indexOf(':');
    if (i > 0) actual.poner.push([t.slice(0, i).trim(), t.slice(i + 1).trim()]);
  }
  return reglas;
}

/** Cabeceras de _headers para una ruta. Como en Cloudflare, si dos reglas ponen la misma, se unen con coma. */
export function cabecerasDe(reglas: Regla[], ruta: string): { poner: Map<string, string>; quitar: Set<string> } {
  const poner = new Map<string, string>();
  const quitar = new Set<string>();
  for (const r of reglas) {
    if (!r.patron.test(ruta)) continue;
    for (const [k, v] of r.poner) {
      const clave = k.toLowerCase();
      poner.set(clave, poner.has(clave) ? `${poner.get(clave)}, ${v}` : v);
    }
    for (const q of r.quitar) quitar.add(q);
  }
  return { poner, quitar };
}

function rango(cabecera: string | null, tamano: number): { inicio: number; fin: number } | 'fuera' | null {
  if (!cabecera) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(cabecera.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null; // varios rangos o mal escrito: se manda entero
  let inicio: number;
  let fin: number;
  if (m[1] === '') {
    const ultimos = Number(m[2]);
    if (ultimos === 0) return 'fuera';
    inicio = Math.max(0, tamano - ultimos);
    fin = tamano - 1;
  } else {
    inicio = Number(m[1]);
    fin = m[2] === '' ? tamano - 1 : Math.min(Number(m[2]), tamano - 1);
  }
  if (inicio >= tamano || inicio > fin) return 'fuera';
  return { inicio, fin };
}

export function crearEstaticos(carpeta: string): (request: Request) => Promise<Response> {
  const raiz = resolve(carpeta);
  const archivoCabeceras = join(raiz, '_headers');
  const reglas = existsSync(archivoCabeceras) ? leerReglas(readFileSync(archivoCabeceras, 'utf8')) : [];

  function archivo(ruta: string): { ruta: string; info: Stats } | null {
    try {
      const info = statSync(ruta);
      return info.isFile() ? { ruta, info } : null;
    } catch {
      return null;
    }
  }

  function cabeceras(rutaPedida: string, tipo: string, info: Stats | null): Headers {
    const h = new Headers();
    h.set('Content-Type', tipo);
    h.set('Cache-Control', 'public, max-age=0, must-revalidate');
    if (info) {
      h.set('ETag', `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`);
      h.set('Last-Modified', info.mtime.toUTCString());
      h.set('Accept-Ranges', 'bytes');
    }
    const { poner, quitar } = cabecerasDe(reglas, rutaPedida);
    for (const [k, v] of poner) h.set(k, v);
    for (const q of quitar) h.delete(q);
    return h;
  }

  function redirigir(destino: string): Response {
    return new Response(null, { status: 308, headers: { Location: destino, 'Cache-Control': 'public, max-age=0, must-revalidate' } });
  }

  function noEncontrado(rutaPedida: string, cabeza: boolean): Response {
    const pagina = archivo(join(raiz, '404.html'));
    const h = cabeceras(rutaPedida, 'text/html; charset=utf-8', null);
    h.set('Cache-Control', 'no-store');
    if (!pagina) return new Response(cabeza ? null : 'No existe.', { status: 404, headers: h });
    h.set('Content-Length', String(pagina.info.size));
    return new Response(cabeza ? null : (Readable.toWeb(createReadStream(pagina.ruta)) as ReadableStream), { status: 404, headers: h });
  }

  return async function servir(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const cabeza = request.method === 'HEAD';
    if (request.method !== 'GET' && !cabeza) {
      return new Response('Método no permitido.', { status: 405, headers: { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    let ruta: string;
    try {
      ruta = decodeURIComponent(url.pathname);
    } catch {
      return noEncontrado(url.pathname, cabeza);
    }
    // Nada de bytes nulos, barras invertidas, «..» ni archivos ocultos (.git, .env…).
    if (ruta.includes('\0') || ruta.includes('\\') || ruta.split('/').some((p) => p === '..' || p.startsWith('.')) || RESERVADOS.has(ruta)) {
      return noEncontrado(url.pathname, cabeza);
    }
    const absoluta = resolve(raiz, '.' + ruta);
    if (absoluta !== raiz && !absoluta.startsWith(raiz + sep)) return noEncontrado(url.pathname, cabeza);

    let encontrado: { ruta: string; info: Stats } | null;
    if (ruta.endsWith('/')) {
      encontrado = archivo(join(absoluta, 'index.html'));
    } else if (ruta.endsWith('/index.html')) {
      if (archivo(absoluta)) return redirigir(url.pathname.slice(0, -'index.html'.length) + url.search);
      encontrado = null;
    } else {
      encontrado = archivo(absoluta);
      if (!encontrado && archivo(join(absoluta, 'index.html'))) return redirigir(url.pathname + '/' + url.search);
    }
    if (!encontrado) return noEncontrado(url.pathname, cabeza);

    const { info } = encontrado;
    const h = cabeceras(url.pathname, TIPOS[extname(encontrado.ruta).toLowerCase()] ?? 'application/octet-stream', info);

    const etiqueta = h.get('ETag');
    const siNoCoincide = request.headers.get('if-none-match');
    if (etiqueta && siNoCoincide && siNoCoincide.split(',').some((e) => e.trim() === etiqueta || e.trim() === '*')) {
      h.delete('Content-Type');
      return new Response(null, { status: 304, headers: h });
    }

    const r = rango(request.headers.get('range'), info.size);
    if (r === 'fuera') {
      h.set('Content-Range', `bytes */${info.size}`);
      return new Response(null, { status: 416, headers: h });
    }
    if (r) {
      h.set('Content-Range', `bytes ${r.inicio}-${r.fin}/${info.size}`);
      h.set('Content-Length', String(r.fin - r.inicio + 1));
      const cuerpo = cabeza ? null : (Readable.toWeb(createReadStream(encontrado.ruta, { start: r.inicio, end: r.fin })) as ReadableStream);
      return new Response(cuerpo, { status: 206, headers: h });
    }
    h.set('Content-Length', String(info.size));
    return new Response(cabeza ? null : (Readable.toWeb(createReadStream(encontrado.ruta)) as ReadableStream), { status: 200, headers: h });
  };
}
