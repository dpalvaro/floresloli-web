/* =====================================================================
   QUÉ FALTA: `npm run comprobar`

   Junta la lista de pendientes (compartido/pendientes.ts) con lo que se
   puede detectar solo (productos de ejemplo, precios sin confirmar, fotos
   que faltan…), lo imprime y lo deja escrito en docs/PENDIENTES.md.
   No cambia nada más. Termina con error si hay una incoherencia técnica.
   ===================================================================== */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTOS } from '../compartido/catalogo.ts';
import { ahoraEnMadrid } from '../compartido/fechas.ts';
import { NEGOCIO } from '../compartido/negocio.ts';
import { PENDIENTES } from '../compartido/pendientes.ts';
import { TIENDA } from '../compartido/tienda.ts';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const hoy = ahoraEnMadrid().fecha;
const fallos = [];

/* ---------- Lo que se detecta solo ---------- */

const deEjemplo = PRODUCTOS.filter((p) => p.ejemplo);
const confirmados = PRODUCTOS.filter((p) => !p.ejemplo);
const sinPrecioConfirmado = confirmados.filter((p) => !p.precioConfirmado);
const sinFoto = PRODUCTOS.filter((p) => p.fotos.length === 0);
const fotosRotas = PRODUCTOS.flatMap((p) => [...p.fotos, ...(p.modelos ?? [])].filter((f) => !existsSync(join(raiz, 'src/assets/fotos', f + '.jpg'))).map((f) => `${p.id} → ${f}`));
const festivosPasados = TIENDA.festivos.filter((f) => f < hoy);
const ultimoFestivo = [...TIENDA.festivos].sort().at(-1) ?? '';

if (fotosRotas.length) fallos.push(`Fotos que no existen en src/assets/fotos: ${fotosRotas.join(', ')}`);
const sitio = /const SITIO = '([^']+)'/.exec(readFileSync(join(raiz, 'astro.config.mjs'), 'utf8'))?.[1];
if (sitio !== NEGOCIO.web.url) fallos.push(`La dirección de astro.config.mjs (${sitio}) no coincide con la de compartido/negocio.ts (${NEGOCIO.web.url}).`);
if (!/^34\d{9}$/.test(NEGOCIO.whatsapp)) fallos.push('El WhatsApp de compartido/negocio.ts tiene que ser 34 + nueve cifras.');

const automaticos = [
  `Productos confirmados (se ven en la web pública): ${confirmados.length}. De ejemplo (solo en las vistas de prueba): ${deEjemplo.length}.`,
  `Productos confirmados con el precio sin confirmar (en la web pública salen sin precio y se encargan por WhatsApp): ${sinPrecioConfirmado.length} de ${confirmados.length}${sinPrecioConfirmado.length ? ` → ${sinPrecioConfirmado.map((p) => p.id).join(', ')}` : ''}.`,
  `Productos sin foto real (llevan ilustración): ${sinFoto.length} → ${sinFoto.map((p) => p.id).join(', ') || 'ninguno'}.`,
  `Logo: ${NEGOCIO.logo ? NEGOCIO.logo : 'falta (la cabecera escribe el nombre)'}.`,
  `Redes sociales enlazadas: ${Object.entries(NEGOCIO.redes).filter(([, r]) => r.confirmada && r.url).map(([n]) => n).join(', ') || 'ninguna'}.`,
  `Festivos cargados hasta el ${ultimoFestivo}${festivosPasados.length ? ` (${festivosPasados.length} ya han pasado y se pueden borrar)` : ''}.`,
  `Pago en la tienda al recoger: ${TIENDA.pagoEnTienda ? 'activado' : 'desactivado'}. Bizum anunciado: ${TIENDA.pago.bizum ? 'sí' : 'no'}.`,
];

/* ---------- Salida ---------- */

const BLOQUEA = { venta: 'Antes de vender', publicar: 'Antes de publicar', no: 'Se puede lanzar sin ello' };
const areas = [...new Set(PENDIENTES.map((p) => p.area))];

const lineas = [
  '# Pendientes de la tienda',
  '',
  `Generado con \`npm run comprobar\` el ${hoy.split('-').reverse().join('/')}. No edites este archivo: la lista sale de \`compartido/pendientes.ts\`.`,
  '',
  `Abiertos: **${PENDIENTES.length}** (${PENDIENTES.filter((p) => p.bloquea === 'venta').length} hay que cerrarlos antes de vender; ${PENDIENTES.filter((p) => p.bloquea === 'publicar').length}, antes de publicar).`,
  '',
  '## Detectado automáticamente',
  '',
  ...automaticos.map((a) => `- ${a}`),
  ...(fallos.length ? ['', '## Fallos que hay que corregir', '', ...fallos.map((f) => `- ${f}`)] : []),
];
for (const area of areas) {
  lineas.push('', `## ${area}`, '', '| Qué falta | Qué hay puesto mientras tanto | Dónde se cambia | Quién | Tarea | Cuándo |', '|---|---|---|---|---|---|');
  for (const p of PENDIENTES.filter((x) => x.area === area)) {
    const celda = (t) => t.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    lineas.push(`| ${celda(p.que)} | ${celda(p.provisional)} | ${celda(p.donde)} | ${celda(p.quien)} | ${p.tarea ?? ''} | ${BLOQUEA[p.bloquea]} |`);
  }
}
writeFileSync(join(raiz, 'docs/PENDIENTES.md'), lineas.join('\n') + '\n');

console.log(`\nPENDIENTES DE LA TIENDA (${PENDIENTES.length})\n`);
for (const area of areas) {
  console.log(area.toUpperCase());
  for (const p of PENDIENTES.filter((x) => x.area === area)) console.log(`  [${p.bloquea === 'venta' ? 'VENTA' : p.bloquea === 'publicar' ? 'PUBLICAR' : '  -  '}] ${p.que}\n          → ${p.donde}`);
  console.log('');
}
console.log('DETECTADO AUTOMÁTICAMENTE');
for (const a of automaticos) console.log('  · ' + a);
console.log('\nLista completa en docs/PENDIENTES.md');
if (fallos.length) {
  console.error('\nFALLOS:\n' + fallos.map((f) => '  ✗ ' + f).join('\n'));
  process.exit(1);
}
