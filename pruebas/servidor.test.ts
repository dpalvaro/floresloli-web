/* Pruebas del servidor propio: base de datos, rutas de la API, archivos de la web y seguridad. */

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { asegurarEsquema } from '../functions/_lib/esquema.ts';
import { onRequest as redirigirDominio } from '../functions/_middleware.ts';
import { abrirBaseDatos } from '../servidor/d1.ts';
import { cabecerasDe, crearEstaticos, leerReglas } from '../servidor/estaticos.ts';
import { cargarFunciones } from '../servidor/funciones.ts';
import { MAX_CUERPO, crearTienda, ipDelCliente } from '../servidor/servidor.ts';

const temporal = mkdtempSync(join(tmpdir(), 'tienda-pruebas-'));
after(() => rmSync(temporal, { recursive: true, force: true }));

function escribir(ruta: string, contenido: string | Uint8Array) {
  mkdirSync(join(ruta, '..'), { recursive: true });
  writeFileSync(ruta, contenido);
}

/* ---------- Web de prueba ---------- */

const web = join(temporal, 'web');
escribir(join(web, 'index.html'), '<h1>Portada</h1>');
escribir(join(web, 'tienda', 'index.html'), '<h1>Tienda</h1>');
escribir(join(web, '404.html'), '<h1>No existe</h1>');
escribir(join(web, '_astro', 'app.js'), 'console.log(1)');
escribir(join(web, 'video', 'clip.mp4'), new Uint8Array(1000).map((_, i) => i % 256));
escribir(join(web, '.env'), 'SECRETO=1');
escribir(join(temporal, 'fuera.txt'), 'no se sirve');
escribir(
  join(web, '_headers'),
  ['/*', '  X-Frame-Options: DENY', '  Content-Security-Policy: default-src \'self\'', '', '/_astro/*', '  Cache-Control: public, max-age=31536000, immutable', '', '/privado/*', '  ! X-Frame-Options', '  X-Robots-Tag: noindex'].join('\n'),
);
const servir = crearEstaticos(web);
const pedir = (ruta: string, init: RequestInit = {}) => servir(new Request('https://tienda.example' + ruta, init));

/* ---------- Base de datos ---------- */

test('D1 sobre SQLite: esquema, lectura, escritura y cambios', async () => {
  const db = abrirBaseDatos(join(temporal, 'base.sqlite'));
  await asegurarEsquema(db as never);
  await asegurarEsquema(db as never); // la segunda vez no hace nada
  const version = await db.prepare('SELECT MAX(version) AS v FROM esquema').first<{ v: number }>();
  assert.ok(version && version.v >= 1);

  const alta = await db.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?)').bind('a', 'uno').run();
  assert.equal(alta.success, true);
  assert.equal(alta.meta.changes, 1);
  assert.equal(await db.prepare('SELECT valor FROM ajustes WHERE clave = ?').bind('a').first('valor'), 'uno');
  assert.equal(await db.prepare('SELECT valor FROM ajustes WHERE clave = ?').bind('nada').first(), null);

  const lista = await db.prepare('SELECT clave, valor FROM ajustes').all<{ clave: string; valor: string }>();
  assert.deepEqual(lista.results, [{ clave: 'a', valor: 'uno' }]);

  // Como D1: true/false se guardan como 1/0 y undefined es un error
  await db.prepare('INSERT INTO limites (clave, n, caduca) VALUES (?, ?, ?)').bind('x', true, 5).run();
  assert.equal(await db.prepare('SELECT n FROM limites WHERE clave = ?').bind('x').first('n'), 1);
  assert.throws(() => db.prepare('SELECT 1').bind(undefined));
  await assert.rejects(db.prepare('SELECT 1 AS uno').first('dos'));
  db.cerrar();
});

test('D1 sobre SQLite: batch es una transacción (todo o nada)', async () => {
  const db = abrirBaseDatos(join(temporal, 'batch.sqlite'));
  await db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT NOT NULL)');
  const r = await db.batch([db.prepare('INSERT INTO t (v) VALUES (?)').bind('a'), db.prepare('INSERT INTO t (v) VALUES (?)').bind('b'), db.prepare('SELECT COUNT(*) AS n FROM t')]);
  assert.equal(r[1].meta.changes, 1);
  assert.deepEqual(r[2].results, [{ n: 2 }]);
  // La segunda sentencia falla (v no puede ser NULL): la primera tampoco se queda
  await assert.rejects(db.batch([db.prepare('INSERT INTO t (v) VALUES (?)').bind('c'), db.prepare('INSERT INTO t (v) VALUES (?)').bind(null)]));
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM t').first('n'), 2);
  db.cerrar();
});

/* ---------- IP del cliente ---------- */

test('La IP del cliente no se puede falsear', () => {
  // Desde Caddy (misma máquina) vale X-Real-IP, que Caddy escribe siempre
  assert.equal(ipDelCliente('127.0.0.1', '83.45.1.2'), '83.45.1.2');
  assert.equal(ipDelCliente('::ffff:127.0.0.1', '2a02::1'), '2a02::1');
  // Desde fuera, se ignora lo que diga la petición
  assert.equal(ipDelCliente('203.0.113.9', '1.1.1.1'), '203.0.113.9');
  assert.equal(ipDelCliente('::ffff:203.0.113.9', undefined), '203.0.113.9');
  // Basura en la cabecera: la del enchufe
  assert.equal(ipDelCliente('127.0.0.1', 'no-es-una-ip'), '127.0.0.1');
});

/* ---------- Archivos de la web ---------- */

test('_headers: reglas, unión y quitar cabeceras', () => {
  const reglas = leerReglas('/*\n  A: 1\n/x/*\n  A: 2\n  ! B\n/:id/p\n  C: 3\n');
  const x = cabecerasDe(reglas, '/x/algo');
  assert.equal(x.poner.get('a'), '1, 2');
  assert.ok(x.quitar.has('b'));
  assert.equal(cabecerasDe(reglas, '/7/p').poner.get('c'), '3');
  assert.equal(cabecerasDe(reglas, '/7/8/p').poner.get('c'), undefined);
});

test('Archivos: páginas, barra final, 404 y cabeceras de seguridad', async () => {
  const portada = await pedir('/');
  assert.equal(portada.status, 200);
  assert.equal(await portada.text(), '<h1>Portada</h1>');
  assert.equal(portada.headers.get('x-frame-options'), 'DENY');
  assert.equal(portada.headers.get('content-security-policy'), "default-src 'self'");
  assert.match(portada.headers.get('content-type') ?? '', /text\/html/);

  const sinBarra = await pedir('/tienda?x=1');
  assert.equal(sinBarra.status, 308);
  assert.equal(sinBarra.headers.get('location'), '/tienda/?x=1');
  const conIndex = await pedir('/tienda/index.html');
  assert.equal(conIndex.status, 308);
  assert.equal(conIndex.headers.get('location'), '/tienda/');

  const noExiste = await pedir('/no-existe/');
  assert.equal(noExiste.status, 404);
  assert.equal(await noExiste.text(), '<h1>No existe</h1>');

  assert.equal((await pedir('/_astro/app.js')).headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const privado = await pedir('/privado/nada');
  assert.equal(privado.headers.get('x-frame-options'), null);
  assert.equal(privado.headers.get('x-robots-tag'), 'noindex');
});

test('Archivos: nunca se sale de la web ni se ven archivos ocultos', async () => {
  for (const ruta of ['/../fuera.txt', '/%2e%2e/fuera.txt', '/tienda/%2E%2E/%2E%2E/fuera.txt', '/.env', '/_headers', '/%00', '/..%5cfuera.txt', '/tienda%2f..%2f..%2ffuera.txt']) {
    const r = await pedir(ruta);
    assert.equal(r.status, 404, ruta);
    assert.doesNotMatch(await r.text(), /no se sirve|SECRETO/, ruta);
  }
  assert.equal((await pedir('/', { method: 'POST', body: 'x' })).status, 405);
});

test('Archivos: ETag, rangos para el vídeo y HEAD', async () => {
  const completo = await pedir('/video/clip.mp4');
  assert.equal(completo.status, 200);
  assert.equal(completo.headers.get('content-length'), '1000');
  const etiqueta = completo.headers.get('etag')!;
  await completo.arrayBuffer();
  assert.equal((await pedir('/video/clip.mp4', { headers: { 'If-None-Match': etiqueta } })).status, 304);

  const trozo = await pedir('/video/clip.mp4', { headers: { Range: 'bytes=10-19' } });
  assert.equal(trozo.status, 206);
  assert.equal(trozo.headers.get('content-range'), 'bytes 10-19/1000');
  assert.deepEqual([...new Uint8Array(await trozo.arrayBuffer())], [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  assert.equal((await pedir('/video/clip.mp4', { headers: { Range: 'bytes=5000-' } })).status, 416);

  const cabeza = await pedir('/', { method: 'HEAD' });
  assert.equal(cabeza.status, 200);
  assert.equal(cabeza.body, null);
});

/* ---------- Rutas de la API ---------- */

test('Funciones: rutas, parámetros, middlewares y métodos como en Cloudflare', async () => {
  const f = join(temporal, 'functions');
  escribir(join(f, '_middleware.mjs'), "export const onRequest = (c) => { c.data.orden = ['raiz']; return c.next(); };");
  escribir(join(f, 'api', '_middleware.mjs'), "export const onRequest = [(c) => { c.data.orden.push('api'); return c.next(); }];");
  escribir(join(f, 'api', 'estado.mjs'), 'export const onRequestGet = (c) => Response.json({ orden: c.data.orden, ip: c.request.headers.get("cf-connecting-ip") });');
  escribir(join(f, 'api', 'cosas', '[id].mjs'), 'export const onRequestGet = (c) => new Response("id:" + c.params.id); export const onRequestPost = () => new Response("post");');
  escribir(join(f, 'api', 'cosas', 'fija.mjs'), 'export const onRequestGet = () => new Response("fija");');
  escribir(join(f, 'api', 'todo', '[[resto]].mjs'), 'export const onRequest = (c) => Response.json(c.params.resto);');
  escribir(join(f, '_lib', 'apoyo.mjs'), 'export const onRequest = () => new Response("no debería ser una ruta");');
  const funciones = await cargarFunciones(f);
  assert.deepEqual([...funciones.rutas].sort(), ['/api/cosas/:id', '/api/cosas/fija', '/api/estado', '/api/todo/:resto*'].sort());

  const estaticos = async () => new Response('estático');
  const ir = (ruta: string, metodo = 'GET') => funciones.atender(new Request('https://t.example' + ruta, { method: metodo }), {}, () => {}, estaticos);

  assert.deepEqual((await (await ir('/api/estado/')).json()).orden, ['raiz', 'api']);
  assert.equal(await (await ir('/api/cosas/fija')).text(), 'fija');
  assert.equal(await (await ir('/api/cosas/L26-7')).text(), 'id:L26-7');
  assert.equal(await (await ir('/api/cosas/7', 'POST')).text(), 'post');
  const borrar = await ir('/api/cosas/7', 'DELETE');
  assert.equal(borrar.status, 405);
  assert.equal(borrar.headers.get('allow'), 'GET, POST');
  assert.deepEqual(await (await ir('/api/todo/a/b')).json(), ['a', 'b']);
  assert.equal(await (await ir('/_lib/apoyo')).text(), 'estático');
  assert.equal(await (await ir('/tienda/')).text(), 'estático');
});

test('Dirección antigua: solo la dirección principal de Cloudflare con URL_PUBLICA lleva al dominio propio', async () => {
  const siguiente = async () => new Response('sigue');
  const llamar = (direccion: string, env: Record<string, string>) =>
    (redirigirDominio as unknown as (c: unknown) => Promise<Response>)({ request: new Request(direccion), env, next: siguiente });
  const principal = 'https://floresyplantasloli.pages.dev/tienda/?a=1';
  const nuevo = { URL_PUBLICA: 'https://tienda.example' };

  const r = await llamar(principal, nuevo);
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), 'https://tienda.example/tienda/?a=1');
  // Vistas previas (rama o versión delante), servidor propio y local: siguen igual
  assert.equal(await (await llamar('https://claude-prueba.floresyplantasloli.pages.dev/tienda/', nuevo)).text(), 'sigue');
  assert.equal(await (await llamar('https://3f2a9c1d.floresyplantasloli.pages.dev/', nuevo)).text(), 'sigue');
  assert.equal(await (await llamar('https://tienda.example/tienda/', nuevo)).text(), 'sigue');
  assert.equal(await (await llamar('http://localhost:8788/', nuevo)).text(), 'sigue');
  // Sin variable o con una variable rara, no se mueve nada
  assert.equal(await (await llamar(principal, {})).text(), 'sigue');
  assert.equal(await (await llamar(principal, { URL_PUBLICA: 'http://tienda.example' })).text(), 'sigue');
  assert.equal(await (await llamar(principal, { URL_PUBLICA: 'https://tienda.example/malo' })).text(), 'sigue');
  assert.equal(await (await llamar(principal, { URL_PUBLICA: 'https://floresyplantasloli.pages.dev' })).text(), 'sigue');
  // Una ruta con doble barra no puede sacar a otro dominio
  const doble = await llamar('https://floresyplantasloli.pages.dev//malo.example/x', { URL_PUBLICA: 'https://tienda.example/' });
  assert.equal(doble.status, 301);
  assert.equal(new URL(doble.headers.get('location')!).host, 'tienda.example');
});

/* ---------- Servidor completo ---------- */

test('Servidor: API real, dominio fijo, origen y límites', async () => {
  const tienda = await crearTienda({
    web,
    funciones: join(import.meta.dirname, '..', 'functions'),
    baseDatos: join(temporal, 'tienda', 'tienda.sqlite'),
    variables: { ENTORNO: 'pruebas', PANEL_CLAVE: 'clave-de-prueba', SECRETO_SESION: 'x'.repeat(32), URL_PUBLICA: 'https://tienda.example', OTRA_COSA: 'no llega' },
  });
  await new Promise<void>((ok) => tienda.servidor.listen(0, '127.0.0.1', () => ok()));
  const { port } = tienda.servidor.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  try {
    const estado = await fetch(base + '/api/estado');
    assert.equal(estado.status, 200);
    assert.equal((await estado.json()).entorno, 'pruebas');
    assert.equal((await fetch(base + '/')).status, 200);

    // Aunque la petición diga otro Host, la tienda se sabe su dirección: los cambios desde otra web no pasan
    const ajena = await fetch(base + '/api/panel/sesion', { method: 'POST', headers: { Host: 'malo.example', Origin: 'https://malo.example', 'Content-Type': 'application/json' }, body: '{"clave":"x"}' });
    assert.equal(ajena.status, 403);
    const propia = await fetch(base + '/api/panel/sesion', { method: 'POST', headers: { Origin: 'https://tienda.example', 'Content-Type': 'application/json', 'X-Real-IP': '198.51.100.7' }, body: '{"clave":"mala"}' });
    assert.equal(propia.status, 401);

    // Un cuerpo demasiado grande se corta antes de leerlo entero
    // Rutas que intentan cambiar de dominio: o se rechazan o se quedan en el de la tienda
    for (const ruta of ['/\\malo.example/x', '/%5Cmalo.example', '/@malo.example']) {
      const estado = await new Promise<number>((ok, mal) => {
        const req = request({ host: '127.0.0.1', port, path: ruta, method: 'GET' }, (res) => {
          res.resume();
          ok(res.statusCode ?? 0);
        });
        req.on('error', mal);
        req.end();
      });
      assert.ok(estado === 400 || estado === 404, `${ruta} → ${estado}`);
    }

    const enorme = await new Promise<number>((ok, mal) => {
      const req = request({ host: '127.0.0.1', port, path: '/api/presupuestos', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': String(MAX_CUERPO + 1) } });
      req.on('response', (res) => {
        res.resume();
        ok(res.statusCode ?? 0);
      });
      req.on('error', mal);
      req.write('x'.repeat(1000));
    });
    assert.equal(enorme, 413);
    assert.equal((await fetch(base + '/api/estado', { method: 'DELETE' })).status, 405);
  } finally {
    await tienda.cerrar();
  }
});
