# floresloli-web · Web de Flores y Plantas Loli

Web pública de Flores y Plantas Loli (C/ Río Alberche 30, Polígono, Toledo), hecha por impulsaDT. Ahora mismo es la landing de Todos los Santos: los encargos se mandan por WhatsApp y la web no cobra, no guarda datos, no usa cookies ni analítica.

Las reglas generales de la agencia están en el repositorio `dpalvaro/impulsadt-operaciones` (`CLAUDE.md`, la habilidad `desarrollo-web` y la memoria de `clientes/loli/`). Lo de aquí las completa.

## Publicación

- Cloudflare Pages, proyecto `floresyplantasloli`. Se publica la carpeta `web/`, sin paso de compilación.
- `main` es producción: lo que entra en `main` sale a la web en un par de minutos.
- Cada rama y cada petición de revisión tiene su vista previa. Los agentes trabajan en ramas `claude/` y nunca suben a `main`.
- Dirección pública: `https://floresyplantasloli.pages.dev/`. Aparece en `web/index.html` (canonical, og:url y og:image), `web/robots.txt` y `web/sitemap.xml`. Si cambia, se cambia en los tres.

## Datos

- Todo lo que cambia (teléfonos, WhatsApp, horario, campaña, productos, precios y datos legales) está en `web/datos.js`. No lo cambies sin una fuente: la ficha de Loli o una decisión de Álvaro.
- WhatsApp de pedidos: 635 54 37 63 (está en el rótulo de la tienda).
- Los días de campaña que ya han pasado no se ofrecen, y la franja de campaña se oculta sola cuando no queda ninguno.
- Datos legales del titular (nombre, NIF y correo) en `web/datos.js` desde el 28/10/2026; los dio Álvaro. Si alguno se deja vacío, el aviso legal no muestra esa línea.

## Fotos y vídeos

- Son de la tienda. La foto de la fachada lleva al equipo en la puerta: no la uses en redes ni en otros sitios sin confirmar su autorización.
- Nunca datos, nombres, habitaciones ni caras de pacientes, tampoco como ejemplo.

## Cómo probar

```
python3 -m http.server 8080 -d web
```

Ábrelo con un móvil de 390 px de ancho y comprueba:

- Que no hay errores en la consola.
- Que «Encargar» abre la hoja y que el envío abre `wa.me/34635543763` con el encargo escrito.
- Que los enlaces `tel:` y «Cómo llegar» funcionan.
- Que el aviso legal carga.
