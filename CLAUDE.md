# floresloli-web · Web y tienda online de Flores y Plantas Loli

Web pública con tienda online de Flores y Plantas Loli (C/ Río Alberche 30, Polígono, Toledo), hecha por impulsaDT. Astro + API como Pages Functions + SQLite + Stripe Checkout. Producción en un servidor propio en la UE; vistas previas en Cloudflare Pages.

**Antes de tocar nada, lee `docs/CONTEXTO.md`**: explica cómo está montada, cómo funciona un pedido, dónde se cambia cada cosa y qué falta. Los pasos de publicación están en `docs/PUESTA-EN-MARCHA.md`, el servidor en `docs/SERVIDOR.md` y la lista de pendientes en `docs/PENDIENTES.md`.

Las reglas generales de la agencia están en el repositorio `dpalvaro/impulsadt-operaciones` (`CLAUDE.md`, la habilidad `desarrollo-web` y la memoria de `clientes/loli/`). Lo de aquí las completa.

## Publicación

- **Producción: servidor propio** (`docs/SERVIDOR.md`). Al entrar algo en `main`, GitHub Actions (`.github/workflows/publicar.yml`) pasa las pruebas, compila para producción y lo publica en el servidor en unos minutos. Si la versión nueva no responde, el servidor vuelve solo a la anterior.
- Se sacó de Cloudflare el 22/11/2026 por los bloqueos de LaLiga. No propongas volver a Cloudflare ni poner el dominio detrás de su proxy.
- **Vistas previas: Cloudflare Pages**, proyecto `floresyplantasloli`. Cada rama y cada petición de revisión tiene la suya. Se compila con `npm run build` y se publica `dist/`.
- `main` es producción. Los agentes trabajan en ramas `claude/` y nunca suben a `main`.
- Los agentes no tocan el servidor, Cloudflare, Stripe, los secretos de GitHub ni las claves: eso lo hace Álvaro. Un cambio en `servidor/` o en el flujo de publicación va, como todo, en una rama con petición de revisión.
- El servidor no lleva dependencias: `servidor/` usa solo lo que trae Node. No añadas paquetes de npm al código que corre en producción (`servidor/`, `functions/` y `compartido/`).
- Dirección pública: `https://floresyplantasloli.pages.dev`. Está en `compartido/negocio.ts` (`web.url`) y en `astro.config.mjs` (`SITIO`). Si cambia, se cambia en los dos.

## Dos entornos

- `main` → **producción**: solo se ven los productos con `ejemplo: false` y los precios con `precioConfirmado: true`. Solo cobra con claves reales de Stripe.
- Cualquier otra rama y el trabajo en local → **pruebas**: se ve todo el catálogo, con los productos y precios de ejemplo etiquetados, y el pago es simulado o de prueba.
- Un producto o un precio solo se marca como confirmado con una fuente: la ficha de Loli o una decisión de Álvaro.

## Datos

- Todo lo que cambia está en `compartido/`: `negocio.ts` (teléfonos, horario, dirección y datos legales), `tienda.ts` (reparto, fechas, cupo e IVA) y `catalogo.ts` (productos y precios). No lo cambies sin una fuente.
- Lo que falta por confirmar o recibir se apunta en `compartido/pendientes.ts`. No se inventa: se deja el hueco marcado.
- WhatsApp de pedidos: 635 54 37 63 (está en el rótulo de la tienda). Los encargos por WhatsApp empiezan siempre por «Hola, quiero hacer un encargo desde la web»: es como se mide la captación. No lo cambies.
- La web no usa cookies de terceros ni analítica (decisión del 28/10/2026).
- Los importes los calcula siempre el servidor (`compartido/pedido.ts`, desde `functions/api/pedidos/`). Los scripts del navegador no importan `compartido/catalogo.ts`, para que los precios de ejemplo no lleguen a la web pública.
- Para cambiar la base de datos, añade una migración al final de `functions/_lib/esquema.ts`. Nunca edites una ya publicada.

## Fotos y personas

- Las fotos son de la tienda. La de la fachada lleva al equipo en la puerta: se usa en la web, pero no en redes, en la imagen de compartir ni en otros sitios sin confirmar su autorización.
- Los productos sin foto llevan una ilustración propia (`compartido/ilustraciones.ts`). No uses fotos de bancos de imágenes ni con derechos de terceros.
- Nunca datos, nombres, habitaciones ni caras de pacientes, tampoco como ejemplo ni en las pruebas.
- El panel pinta los datos de los clientes siempre como texto, nunca como HTML.

## Cómo probar

```
npm install
cp .dev.vars.example .dev.vars
npm run local            # web + API + base de datos local en http://localhost:8788 (con Cloudflare/wrangler)
npm run local:servidor   # lo mismo con el servidor propio, como en producción
```

Antes de cada petición de revisión:

- `npm test`, `npm run tipos`, `npm run comprobar` y, con `npm run local` o `npm run local:servidor` en marcha, `npm run prueba:compra`: todo sin fallos. GitHub Actions lo repite en cada petición de revisión.
- Con un móvil de 390 px de ancho: sin errores en la consola ni desplazamiento horizontal.
- Un pedido completo: producto › cesta › pedido › pago de prueba › confirmación, y que aparece en `/panel/`.
- Que, sin poder cobrar, el botón de la cesta abre `wa.me/34635543763` con el encargo escrito.
- Que los enlaces `tel:` y «Cómo llegar» funcionan y que los textos legales cargan.
- `npm run build:produccion` y comprobar que no sale ningún producto ni precio de ejemplo.
