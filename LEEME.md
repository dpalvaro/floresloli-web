# Web y tienda online de Flores y Plantas Loli

Floristería en C/ Río Alberche 30, Polígono (Toledo). Web hecha por impulsaDT.

- Catálogo de flores y plantas, cesta y pedido con pago en la web (Stripe).
- Recogida en la tienda, reparto a domicilio en Toledo y entrega en el Hospital Universitario.
- Panel para Loli: pedidos, calendario, presupuestos y exportación para el gestor.
- Mientras la tienda no pueda cobrar, los encargos se mandan por WhatsApp al 635 54 37 63.

## Documentación

| Documento | Para qué |
|---|---|
| [`docs/CONTEXTO.md`](docs/CONTEXTO.md) | Cómo está montada, cómo funciona y dónde se cambia cada cosa. **Empieza por aquí** |
| [`docs/PUESTA-EN-MARCHA.md`](docs/PUESTA-EN-MARCHA.md) | Pasos en Cloudflare y en Stripe para publicarla y empezar a vender |
| [`docs/PENDIENTES.md`](docs/PENDIENTES.md) | Lo que falta por confirmar o recibir (se genera con `npm run comprobar`) |
| [`CLAUDE.md`](CLAUDE.md) | Reglas para los agentes que trabajen en este repositorio |

## Cambiar precios, productos, horario o reparto

Todo está en la carpeta `compartido/`:

- `catalogo.ts`: productos y precios. Para poner un precio real, cambia `precio` y pon `precioConfirmado: true`.
- `negocio.ts`: teléfonos, horario, dirección y datos del titular.
- `tienda.ts`: reparto, hora límite, pedidos por día, festivos e IVA.

## Probar en local

```
npm install
cp .dev.vars.example .dev.vars
npm run local
```

Y abre http://localhost:8788. El panel está en http://localhost:8788/panel/.

## Publicar

La web está en Cloudflare Pages, conectada a este repositorio. Cada cambio que entra en la rama `main` se publica solo en un par de minutos. Los cambios que prepara Claude llegan como petición de revisión con su vista previa; al aprobarla y fusionarla, se publican.

## Origen de fotos y vídeos

Fotos y vídeo de la propia tienda, optimizados a partir de `06_Recursos_graficos/flores`; los originales no se han tocado. Los productos que todavía no tienen foto llevan una ilustración dibujada con código.
