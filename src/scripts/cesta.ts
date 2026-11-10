/* =====================================================================
   LA CESTA: se guarda en el propio navegador (almacenamiento local).
   No se manda nada al servidor hasta que el cliente paga o envía el
   encargo. Es almacenamiento técnico: no necesita aviso de cookies.
   ===================================================================== */

import type { LineaEntrada } from '../../compartido/pedido.ts';

export type LineaCesta = LineaEntrada;

const CLAVE = 'floresloli.cesta.v1';
const MAX_LINEAS = 20;
const MAX_UNIDADES = 20;

/** Dos líneas con la misma clave son el mismo artículo y se suman. */
export function claveLinea(l: LineaCesta): string {
  return [l.id, l.variante ?? '', l.importe ?? '', l.modelo ?? '', (l.nota ?? '').trim()].join('|');
}

function esLinea(x: unknown): x is LineaCesta {
  const l = x as LineaCesta;
  return !!l && typeof l.id === 'string' && Number.isInteger(l.cantidad) && l.cantidad > 0;
}

export function leerCesta(): LineaCesta[] {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    return Array.isArray(datos) ? datos.filter(esLinea).slice(0, MAX_LINEAS) : [];
  } catch {
    return [];
  }
}

export function guardarCesta(lineas: LineaCesta[]): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lineas.slice(0, MAX_LINEAS)));
  } catch {
    /* Navegación privada o almacenamiento lleno: la cesta dura lo que dure la página. */
  }
  window.dispatchEvent(new CustomEvent('cesta:cambio'));
}

export function anadir(linea: LineaCesta): void {
  const lineas = leerCesta();
  const clave = claveLinea(linea);
  const existente = lineas.find((l) => claveLinea(l) === clave);
  if (existente) existente.cantidad = Math.min(MAX_UNIDADES, existente.cantidad + linea.cantidad);
  else lineas.push({ ...linea, cantidad: Math.min(MAX_UNIDADES, linea.cantidad) });
  guardarCesta(lineas);
}

export function cambiarCantidad(clave: string, cantidad: number): void {
  const lineas = leerCesta();
  const linea = lineas.find((l) => claveLinea(l) === clave);
  if (!linea) return;
  if (cantidad < 1) return quitar(clave);
  linea.cantidad = Math.min(MAX_UNIDADES, Math.round(cantidad));
  guardarCesta(lineas);
}

export function quitar(clave: string): void {
  guardarCesta(leerCesta().filter((l) => claveLinea(l) !== clave));
}

export function vaciar(): void {
  guardarCesta([]);
}

export function unidades(): number {
  return leerCesta().reduce((suma, l) => suma + l.cantidad, 0);
}
