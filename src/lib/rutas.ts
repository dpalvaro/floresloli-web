/* Qué páginas existen en cada entorno: de aquí salen el menú, el pie y el sitemap. */

import {
  CATEGORIAS,
  OCASIONES,
  productosDeCategoria,
  productosDeOcasion,
  productosDeTienda,
  rutaCategoria,
  rutaOcasion,
  rutaProducto,
} from '../../compartido/catalogo.ts';
import type { Categoria, Ocasion } from '../../compartido/catalogo.ts';
import { ENTORNO } from './entorno.ts';

export const RUTA_HOSPITAL = '/flores-hospital-universitario-toledo/';
export const RUTA_REPARTO = '/reparto-a-domicilio-toledo/';
export const RUTA_EVENTOS = '/bodas-y-eventos/';
export const RUTA_CUIDADOS = '/cuidados/';
export const RUTA_CONTACTO = '/contacto/';
export const RUTA_TIENDA = '/tienda/';
export const RUTA_PEDIDO = '/pedido/';
export const RUTA_A_MEDIDA = rutaProducto('ramo-a-tu-medida');

/** Categorías con página propia: las que tienen algún producto a la vista (sin los complementos). */
export function categoriasConPagina(): Categoria[] {
  return CATEGORIAS.filter((c) => c.id !== 'complementos' && productosDeCategoria(c.id, ENTORNO).length > 0);
}

/** Ocasiones con página propia: las que tienen algún producto a la vista. */
export function ocasionesConPagina(): Ocasion[] {
  return OCASIONES.filter((o) => productosDeOcasion(o.id, ENTORNO).length > 0);
}

export const LEGALES = [
  { nombre: 'Aviso legal', ruta: '/aviso-legal/' },
  { nombre: 'Privacidad', ruta: '/privacidad/' },
  { nombre: 'Cookies', ruta: '/cookies/' },
  { nombre: 'Condiciones de venta', ruta: '/condiciones-de-venta/' },
];

/** Todas las páginas que deben salir en buscadores, con su prioridad para el sitemap. */
export function paginasIndexables(): { ruta: string; prioridad: number }[] {
  return [
    { ruta: '/', prioridad: 1 },
    { ruta: RUTA_TIENDA, prioridad: 0.9 },
    ...categoriasConPagina().map((c) => ({ ruta: rutaCategoria(c), prioridad: 0.8 })),
    { ruta: RUTA_HOSPITAL, prioridad: 0.9 },
    { ruta: RUTA_REPARTO, prioridad: 0.8 },
    ...ocasionesConPagina().map((o) => ({ ruta: rutaOcasion(o), prioridad: 0.6 })),
    ...productosDeTienda(ENTORNO).map((p) => ({ ruta: rutaProducto(p), prioridad: 0.7 })),
    { ruta: RUTA_EVENTOS, prioridad: 0.7 },
    { ruta: RUTA_CONTACTO, prioridad: 0.7 },
    { ruta: RUTA_CUIDADOS, prioridad: 0.5 },
    ...LEGALES.map((l) => ({ ruta: l.ruta, prioridad: 0.2 })),
  ];
}
