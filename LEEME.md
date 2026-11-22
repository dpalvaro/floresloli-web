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
| [`docs/PUESTA-EN-MARCHA.md`](docs/PUESTA-EN-MARCHA.md) | Pasos para publicarla y empezar a vender (vistas previas, Stripe y correo) |
| [`docs/SERVIDOR.md`](docs/SERVIDOR.md) | El servidor propio donde vive la tienda: cómo se monta, cómo se publica, copias y seguridad |
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

Para probarla tal como corre en el servidor propio, usa `npm run local:servidor` en lugar de `npm run local`.

## Publicar

La tienda vive en un servidor propio en la Unión Europea, con su dominio ([`docs/SERVIDOR.md`](docs/SERVIDOR.md)). Se sacó de Cloudflare el 22/11/2026 porque los bloqueos de LaLiga tumban muchas webs de Cloudflare los días de partido.

Cada cambio que entra en la rama `main` se publica solo: GitHub pasa las pruebas, compila y lo manda al servidor, que vuelve a la versión anterior si la nueva no responde. Los cambios que prepara Claude llegan como petición de revisión con su vista previa en Cloudflare Pages; al aprobarla y fusionarla, se publican.

## Origen de fotos y vídeos

Fotos y vídeo de la propia tienda, optimizados a partir de `06_Recursos_graficos/flores`; los originales no se han tocado. Los productos que todavía no tienen foto llevan una ilustración dibujada con código.
