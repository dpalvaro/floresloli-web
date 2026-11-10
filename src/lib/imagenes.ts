/* Fotos de src/assets/fotos, por nombre de archivo sin extensión. */

import type { ImageMetadata } from 'astro';

const modulos = import.meta.glob<{ default: ImageMetadata }>('../assets/fotos/*.{jpg,jpeg,png,webp}', { eager: true });

const FOTOS = new Map<string, ImageMetadata>();
for (const [ruta, modulo] of Object.entries(modulos)) {
  const nombre = ruta.split('/').pop()!.replace(/\.[a-z]+$/i, '');
  FOTOS.set(nombre, modulo.default);
}

/** La foto con ese nombre, o undefined si no existe (la web dibuja entonces la ilustración). */
export function foto(nombre: string | undefined | null): ImageMetadata | undefined {
  return nombre ? FOTOS.get(nombre) : undefined;
}

export function nombresDeFotos(): string[] {
  return [...FOTOS.keys()].sort();
}
