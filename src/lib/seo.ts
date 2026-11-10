/* Datos estructurados (JSON-LD) y utilidades para buscadores. */

import type { Entorno, Producto } from '../../compartido/catalogo.ts';
import { enTemporada, preciosALaVista } from '../../compartido/catalogo.ts';
import { ahoraEnMadrid } from '../../compartido/fechas.ts';
import { NEGOCIO, enlaceMapa } from '../../compartido/negocio.ts';

const DIA_SCHEMA = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const ID_FLORISTERIA = `${NEGOCIO.web.url}/#floristeria`;

export function urlAbsoluta(ruta: string): string {
  return ruta.startsWith('http') ? ruta : NEGOCIO.web.url + ruta;
}

function telefonoInternacional(numero: string): string {
  return '+34' + numero.replace(/\D/g, '');
}

/** Negocio local (tipo Florist). Nombre, dirección y teléfono idénticos a la ficha de Google. */
export function jsonLdFloristeria(imagenes: string[] = []): Record<string, unknown> {
  const d = NEGOCIO.direccion;
  const redes = Object.values(NEGOCIO.redes)
    .filter((r) => r.confirmada && r.url)
    .map((r) => r.url as string);
  return {
    '@context': 'https://schema.org',
    '@type': 'Florist',
    '@id': ID_FLORISTERIA,
    name: NEGOCIO.nombre,
    url: NEGOCIO.web.url + '/',
    telephone: telefonoInternacional(NEGOCIO.telefono),
    email: NEGOCIO.correo,
    ...(imagenes.length ? { image: imagenes.map(urlAbsoluta) } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: d.calle,
      postalCode: d.cp,
      addressLocality: d.ciudad,
      addressRegion: d.provincia,
      addressCountry: d.pais,
    },
    geo: { '@type': 'GeoCoordinates', latitude: NEGOCIO.geo.lat, longitude: NEGOCIO.geo.lng },
    hasMap: enlaceMapa(),
    openingHoursSpecification: NEGOCIO.horario.flatMap((h) =>
      h.tramos.map(([opens, closes]) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: h.dias.map((dia) => DIA_SCHEMA[dia]),
        opens,
        closes,
      })),
    ),
    areaServed: { '@type': 'City', name: 'Toledo' },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Pedidos',
      telephone: telefonoInternacional(NEGOCIO.movil),
      availableLanguage: 'es',
    },
    ...(redes.length ? { sameAs: redes } : {}),
  };
}

export function jsonLdMigas(migas: { nombre: string; ruta: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: migas.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: m.nombre,
      item: urlAbsoluta(m.ruta),
    })),
  };
}

export function jsonLdPreguntas(preguntas: { pregunta: string; respuesta: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: preguntas.map((p) => ({
      '@type': 'Question',
      name: p.pregunta,
      acceptedAnswer: { '@type': 'Answer', text: p.respuesta },
    })),
  };
}

/**
 * Producto con su precio. Solo se publica el precio si está confirmado: un precio de
 * ejemplo nunca llega a los buscadores.
 */
export function jsonLdProducto(p: Producto, entorno: Entorno, ruta: string, imagen?: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.nombre,
    description: p.resumen,
    url: urlAbsoluta(ruta),
    ...(imagen ? { image: urlAbsoluta(imagen) } : {}),
    brand: { '@type': 'Brand', name: NEGOCIO.nombre },
  };
  if (!preciosALaVista(p, entorno) || !p.precioConfirmado || p.aMedida) return base;

  const precios = p.variantes?.length
    ? p.variantes.map((v) => v.precio).filter((x): x is number => typeof x === 'number')
    : typeof p.precio === 'number'
      ? [p.precio]
      : [];
  if (!precios.length) return base;

  const disponible = enTemporada(p, ahoraEnMadrid().fecha);
  const comun = {
    priceCurrency: 'EUR',
    availability: disponible ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    url: urlAbsoluta(ruta),
    seller: { '@id': ID_FLORISTERIA },
  };
  base.offers =
    precios.length > 1
      ? { '@type': 'AggregateOffer', lowPrice: Math.min(...precios), highPrice: Math.max(...precios), offerCount: precios.length, ...comun }
      : { '@type': 'Offer', price: precios[0], ...comun };
  return base;
}
