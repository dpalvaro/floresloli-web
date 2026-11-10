/* Cómo se escribe el precio de un producto en cada sitio. */

import type { Entorno, Producto } from '../../compartido/catalogo.ts';
import { euros, precioDesde, preciosALaVista } from '../../compartido/catalogo.ts';

export interface TextoPrecio {
  /** «Desde 30 €», «12 €», «Tú eliges el importe», «Precio por WhatsApp». */
  texto: string;
  /** true = no hay precio que enseñar y el producto se encarga por WhatsApp. */
  sinPrecio: boolean;
}

export function textoPrecio(p: Producto, entorno: Entorno, largo = false): TextoPrecio {
  if (p.aMedida) return { texto: 'Tú eliges el importe', sinPrecio: !preciosALaVista(p, entorno) };
  const { precio, desde } = precioDesde(p, entorno);
  if (precio === null) {
    return { texto: largo ? 'Te decimos el precio por WhatsApp' : 'Precio por WhatsApp', sinPrecio: true };
  }
  return { texto: (desde ? 'Desde ' : '') + euros(precio), sinPrecio: false };
}

/** Etiqueta de aviso que solo se ve en las vistas de prueba. */
export function etiquetaDePrueba(p: Producto, entorno: Entorno): string | null {
  if (entorno !== 'pruebas') return null;
  if (p.ejemplo) return 'Producto de ejemplo';
  if (!p.precioConfirmado && (p.aMedida || p.precio != null || p.variantes?.length)) return 'Precio de ejemplo';
  return null;
}
