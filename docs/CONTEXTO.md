# Tienda online de Flores y Plantas Loli · Contexto completo

Documento para quien retome este proyecto, sea una persona, otro chat o un agente. Léelo entero antes de tocar nada: explica qué hay hecho, cómo funciona, dónde se cambia cada cosa y qué falta.

Última actualización: martes 10 de noviembre de 2026.

---

## 1. Qué es y en qué punto está

- **Cliente:** Flores y Plantas Loli, floristería en C/ Río Alberche 30, Polígono (Santa María de Benquerencia), 45007 Toledo. Cliente piloto de la agencia impulsaDT (Álvaro).
- **Qué es esto:** la web definitiva con tienda online (tarea **T39** del centro de mando; fecha límite 13/12/2026). Sustituye a la landing de Todos los Santos, que era una sola página en la carpeta `web/` y ya no existe en esta rama.
- **Rama:** `claude/T39-tienda-online-v1`, con petición de revisión contra `main`. **`main` es producción**: lo que entra en `main` se publica solo. Nadie más que Álvaro fusiona.
- **Estado:** toda la estructura está hecha y probada en local (web, cesta, pedido, pago, panel de Loli y base de datos). **No está publicada ni vende todavía.** Faltan datos del negocio (precios, logo, fotos), las cuentas (Stripe, base de datos en Cloudflare) y unas confirmaciones con Loli. La lista exacta está en [`PENDIENTES.md`](PENDIENTES.md) y los pasos para publicarla, en [`PUESTA-EN-MARCHA.md`](PUESTA-EN-MARCHA.md).

### La regla más importante: nada sin confirmar llega al público

La web se construye en uno de dos **entornos**:

| Entorno | Cuándo | Qué enseña | Cómo cobra |
|---|---|---|---|
| `pruebas` | Cualquier rama que no sea `main`, las vistas previas de Cloudflare y el trabajo en local | **Todo** el catálogo (36 productos), con los de ejemplo y sus precios de ejemplo etiquetados. Una franja amarilla avisa de que es una vista de pruebas. No se indexa en buscadores | Pago simulado, o Stripe en modo prueba si se ponen claves `sk_test_`. Nunca cobra de verdad |
| `produccion` | La rama `main` | **Solo** los productos con `ejemplo: false` (hoy, 8) y **solo** los precios con `precioConfirmado: true` (hoy, ninguno) | Solo con claves reales de Stripe (`sk_live_`) y base de datos. Si faltan, la web funciona como catálogo y los encargos van por WhatsApp |

Consecuencia práctica: **si esta rama se fusionara hoy en `main` sin configurar nada**, la web pública sería un catálogo de 8 productos sin precio («Te decimos el precio por WhatsApp»), con todas las páginas de servicio, y el botón de la cesta escribiría el encargo en WhatsApp. No enseñaría ningún precio inventado ni cobraría nada. Para que venda hay que confirmar precios y poner las cuentas.

Los productos de ejemplo son los habituales de una floristería (ramos, rosas, plantas, centros, condolencias y complementos). Los puso Claude a petición de Álvaro para dejar la estructura hecha; **Loli no ha confirmado ninguno ni sus precios**.

---

## 2. Cómo está montado

- **Astro 7** genera la web como archivos estáticos (carpeta `dist/`). Sin frameworks de interfaz: HTML, CSS y TypeScript pequeño.
- **Cloudflare Pages** la publica. La carpeta `functions/` son **Pages Functions**: la API (`/api/...`), que se ejecuta en Cloudflare.
- **Cloudflare D1** (SQLite) guarda pedidos, días, presupuestos y límites de uso. La API crea las tablas sola.
- **Stripe Checkout** cobra. La página de pago es de Stripe: la web nunca ve datos de tarjeta. Sin dependencias: se llama a la API de Stripe con `fetch`.
- **Resend** (opcional) manda correos de aviso. Sin él, el cliente recibe el justificante de Stripe y Loli ve los pedidos en el panel.
- **Sin cookies de terceros, sin analítica y sin cuentas de cliente** (decisión del 28/10/2026). La cesta vive en el navegador.

### Mapa de carpetas

```
compartido/          Datos y reglas que usan la web Y la API. Aquí se cambia casi todo.
  negocio.ts           Nombre, dirección, teléfonos, horario, titular legal, dirección de la web, logo.
  tienda.ts            Reparto y zonas, hora límite, cupo, festivos, IVA, ramo a medida, plazos de privacidad.
  catalogo.ts          Categorías, ocasiones y los 36 productos (con ejemplo / precioConfirmado).
  pedido.ts            Cálculo de importes y validación de un pedido. Estados.
  fechas.ts            Qué días se puede encargar y por qué no. Todo en hora de Madrid.
  pendientes.ts        Lista única de lo que falta por confirmar o recibir.
  ilustraciones.ts     Dibujos hechos con código para los productos sin foto.
  formato.ts           Cómo se escriben los importes.
src/
  pages/               Una página por archivo (ver la tabla de abajo).
  components/          Cabecera, pie, tarjeta de producto, foto, migas, preguntas…
  layouts/Base.astro   Plantilla común: <head>, SEO, cabecera y pie.
  scripts/             Lo que se ejecuta en el navegador: cesta, pedido, panel…
  lib/                 Entorno, rutas, SEO (datos estructurados), imágenes y precios.
  styles/global.css    Colores del rótulo (lima y violeta), tipografías y piezas comunes.
  assets/fotos/        Fotos de la tienda. Astro las convierte a WebP en varios tamaños.
functions/
  api/                 Los puntos de entrada de la API (ver la tabla de abajo).
  _lib/                Base de datos, esquema, Stripe, correo, sesión del panel, estado de la tienda.
public/                Lo que se copia tal cual: tipografías, vídeo, iconos, imagen de compartir, _headers.
herramientas/          comprobar.mjs, prueba-compra.mjs, imagenes-sociales.mjs.
pruebas/               Pruebas automáticas de las reglas (npm test).
docs/                  Este documento, PUESTA-EN-MARCHA.md y PENDIENTES.md.
```

### Páginas

| Dirección | Archivo | Para qué |
|---|---|---|
| `/` | `pages/index.astro` | Portada |
| `/tienda/` | `pages/tienda/index.astro` | Todo el catálogo, por categorías |
| `/tienda/<producto>/` | `pages/tienda/[id].astro` | Ficha de producto: opciones, importe o modelo, y añadir a la cesta |
| `/ramos-de-flores/`, `/rosas/`, `/plantas/`, `/centros-de-flores/`, `/coronas-y-condolencias/` | `pages/[categoria].astro` | Categorías (solo las que tienen algún producto a la vista) |
| `/ocasiones/<ocasión>/` | `pages/ocasiones/[ocasion].astro` | Cumpleaños, amor, nacimiento, gracias, ánimo y Navidad |
| `/flores-hospital-universitario-toledo/` | mismo nombre | **Página clave de SEO local**: flores al HUT, que está en el mismo barrio |
| `/reparto-a-domicilio-toledo/` | mismo nombre | Zonas, precios y preguntas del reparto |
| `/bodas-y-eventos/` | mismo nombre | Formulario de presupuesto (va a la API y al panel) |
| `/cuidados/` | `pages/cuidados.astro` | Consejos de cuidado (contenido para buscadores) |
| `/contacto/` | `pages/contacto.astro` | Dónde estamos, horario y teléfonos |
| `/pedido/` | `pages/pedido/index.astro` + `scripts/pedido.ts` | **Cesta y pedido** en una sola página |
| `/pedido/gracias/` | `pages/pedido/gracias.astro` | Confirmación después de pagar |
| `/pedido/pago-de-prueba/` | `pages/pedido/[prueba].astro` | Pago simulado. **Solo existe en `pruebas`** |
| `/panel/` | `pages/panel.astro` + `scripts/panel.ts` | **Panel de Loli** (con clave) |
| `/aviso-legal/`, `/privacidad/`, `/cookies/`, `/condiciones-de-venta/` | mismo nombre | Textos legales, con los datos de `negocio.ts` |

### API

| Ruta | Qué hace |
|---|---|
| `GET /api/estado` | Dice si la web puede cobrar ahora mismo. La cesta lo pregunta para elegir entre «Pagar» y «Enviar por WhatsApp» |
| `GET /api/disponibilidad` | Próximos 35 días, con los que no se pueden elegir y por qué |
| `POST /api/pedidos` | Crea el pedido. **Recalcula todo en el servidor** (precios, envío, fecha y cupo) y devuelve la dirección de pago |
| `GET /api/pedidos/<ref>?t=<código>` | Estado del pedido para la página de confirmación. Si Stripe aún no ha avisado, se le pregunta |
| `POST /api/stripe/webhook` | Avisos de Stripe: pagado, caducado y devuelto. Comprueba la firma |
| `POST /api/pruebas/pago` | Pago simulado. En producción responde 404 |
| `POST /api/presupuestos` | Recoge una solicitud de presupuesto |
| `/api/panel/sesion` | Entrar (POST), comprobar (GET) y salir (DELETE) |
| `/api/panel/pedidos`, `/api/panel/pedidos/<ref>` | Lista, alta a mano y cambios de un pedido |
| `/api/panel/dias`, `/api/panel/dias/<fecha>` | Calendario: abrir o cerrar un día y cambiar su cupo |
| `/api/panel/presupuestos`, `.../<ref>` | Solicitudes de presupuesto |
| `/api/panel/exportar` | Pedidos en CSV para el gestor, con el IVA desglosado |
| `/api/panel/estado` | Cómo está configurada la tienda (pestaña «Ajustes») |

---

## 3. Cómo funciona un pedido

1. El cliente añade productos a la **cesta** (se guarda en su navegador, `localStorage`).
2. En `/pedido/` elige **cómo lo recibe** (recoger gratis, reparto a domicilio u Hospital Universitario), **el día**, los datos de entrega, la **dedicatoria** y sus datos.
3. Según lo que diga `/api/estado` y lo que haya en la cesta:
   - **Se puede cobrar** → botón «Pagar 43,00 €». La API valida, comprueba que el día está abierto, dentro de hora y con hueco, guarda el pedido como «esperando el pago» y devuelve la página de pago de Stripe.
   - **No se puede cobrar** (no hay Stripe o algún producto no tiene precio) → botón «Enviar el encargo por WhatsApp». Se abre `wa.me/34635543763` con el encargo escrito. El mensaje empieza siempre por **«Hola, quiero hacer un encargo desde la web»**: así se mide cuántos encargos trae la web. No lo cambies.
4. Stripe cobra y avisa al **webhook**. El pedido pasa a «Nuevo» y «Pagado». Si el aviso tarda, la página de confirmación pregunta a Stripe directamente.
5. El cliente ve la **confirmación** con su número de pedido (por ejemplo, `L261110-7KQ2`) y recibe el justificante de Stripe.
6. Loli lo ve en el **panel**, lo prepara y va cambiando el estado: Nuevo → En preparación → Listo → En reparto → Entregado.

Detalles que conviene saber:

- **El hueco se reserva 31 minutos** mientras el cliente paga. Si no paga, el pedido caduca solo y el hueco se libera.
- **Hora límite para el mismo día:** 12:00 (provisional). **Cupo:** 12 pedidos web por día (provisional). **Domingos y festivos:** cerrado. Todo en `compartido/tienda.ts`; un día suelto se cambia desde el panel.
- **Reparto:** 8 € en Toledo capital (códigos postales 45001 a 45008) y 8 € al hospital (provisional). Fuera de esa zona no se puede pagar en la web: se remite a WhatsApp.
- **Temporadas:** un producto de temporada (girasoles, flor de pascua…) no se puede pedir para una fecha fuera de ella.
- **Hospital:** algunos productos no se llevan (coronas, liliums…): `hospital: false` en el catálogo.
- **Cancelar un pedido en el panel no devuelve el dinero.** La devolución se hace en Stripe; cuando Stripe avisa, el pedido queda «Devuelto». Es deliberado: los cobros y devoluciones no los hace la web por su cuenta.
- **Privacidad:** a los 90 días de la entrega se borran solos los datos de quien recibió las flores, las indicaciones, la dedicatoria y las observaciones. Los pedidos que nunca se pagaron se borran enteros. Las solicitudes de presupuesto, a los 12 meses. Lo hace la API una vez al día (`limpiezaDiaria` en `functions/_lib/datos.ts`).
- **Cada entorno ve solo sus pedidos.** Un pedido de prueba no aparece en el panel real ni le quita hueco, aunque compartieran base de datos.

## 4. El panel de Loli (`/panel/`)

Se entra con una clave única (`PANEL_CLAVE`). La sesión dura 12 horas.

- **Pedidos:** lo que hay por hacer, agrupado por día, con un botón grande para el siguiente paso. Buscador por nombre, teléfono o número. Cada pedido se puede imprimir (con la dedicatoria aparte, para la tarjeta).
- **Apuntar pedido:** el «libro de pedidos». Para apuntar los del mostrador, el teléfono y WhatsApp, con precios libres y cobro en efectivo, tarjeta, Bizum o transferencia.
- **Calendario:** cerrar un día, abrir un domingo señalado o cambiar cuántos pedidos web caben.
- **Presupuestos:** las solicitudes de bodas, comuniones, eventos y empresas.
- **Ajustes:** exportar los pedidos a Excel (CSV) para el gestor y ver si la tienda está bien configurada.

Los precios, el horario y las reglas **no** se cambian en el panel: se cambian en el código (apartado 6).

---

## 5. Cómo trabajar en el proyecto

Hace falta Node 22.12 o superior.

```bash
npm install
cp .dev.vars.example .dev.vars   # y pon una clave de panel y un secreto

npm run local          # compila y arranca todo (web + API + base de datos local) en http://localhost:8788
npm run dev            # solo la web, con recarga al guardar, en http://localhost:4321 (la API, con `npm run api` en otra terminal)

npm test               # pruebas de las reglas de la tienda
npm run tipos          # comprobación de tipos de la web y de la API
npm run comprobar      # lista de pendientes y coherencia; regenera docs/PENDIENTES.md
npm run prueba:compra  # compra completa contra la tienda en local (con `npm run local` en marcha)
npm run imagenes       # rehace los iconos y la imagen de compartir

npm run build              # compila en modo pruebas
npm run build:produccion   # compila como lo hará main: solo lo confirmado
```

Antes de cada petición de revisión:

1. `npm test`, `npm run tipos`, `npm run comprobar` y `npm run prueba:compra`, sin fallos.
2. Míralo a 390 px de ancho y en escritorio: sin errores en la consola y sin desplazamiento horizontal.
3. Compila con `npm run build:produccion` y comprueba que no sale ningún producto ni precio de ejemplo.
4. Repasa la lista de calidad de la habilidad `desarrollo-web` (repositorio `dpalvaro/impulsadt-operaciones`).

Normas de la agencia que se aplican aquí (están en el `CLAUDE.md` de `impulsadt-operaciones`):

- Ramas `claude/<tarea>-<resumen>` y petición de revisión. Nunca se sube a `main`.
- **No se inventan datos del negocio.** Precios, horarios, zonas y textos legales salen de la ficha de Loli (`clientes/loli/ficha.md`) o de una decisión de Álvaro. Lo que falta se deja marcado y se apunta en `compartido/pendientes.ts`.
- Nunca nombres, habitaciones ni caras de pacientes, tampoco como ejemplo.
- La foto de la fachada lleva al equipo en la puerta: se usa en la web (confirmado), pero no en redes ni en la imagen de compartir.
- Español de España, frases cortas, tono de barrio. Sin «low cost», «premium» ni urgencias falsas. Sobrio en condolencias y delicado en el hospital.

---

## 6. Dónde se cambia cada cosa

| Quiero… | Archivo | Qué hago |
|---|---|---|
| Poner el precio real de un producto | `compartido/catalogo.ts` | Cambia `precio` (o el de cada `variantes`) y pon `precioConfirmado: true` |
| Dar por bueno un producto de ejemplo | `compartido/catalogo.ts` | `ejemplo: false`. Si sobra, borra el bloque entero |
| Añadir un producto | `compartido/catalogo.ts` | Copia un bloque parecido y cambia `id` (será su dirección), textos, categoría y ocasiones |
| Poner la foto de un producto | `src/assets/fotos/<nombre>.jpg` + `catalogo.ts` | Guarda la foto (mejor de 1000 px de ancho o más, vertical 4:5) y pon `fotos: ['<nombre>']` y `fotoAlt` |
| Poner el logo | `src/assets/logo.svg` (o `.png`) + `compartido/negocio.ts` | `logo: 'logo.svg'` y después `npm run imagenes` |
| Cambiar horario, teléfonos o dirección | `compartido/negocio.ts` | Sale en toda la web, en los datos estructurados y en el «abierto ahora» |
| Cambiar los datos del titular | `compartido/negocio.ts` → `legal` | Se actualizan solos el aviso legal, la privacidad y las condiciones |
| Enlazar Facebook o Instagram | `compartido/negocio.ts` → `redes` | Pon la `url` y `confirmada: true` |
| Cambiar el precio o la zona del reparto | `compartido/tienda.ts` → `entrega` | Para un pueblo con precio fijo, añade una zona con sus códigos postales |
| Cambiar hora límite, cupo o festivos | `compartido/tienda.ts` | Un día suelto, mejor desde el panel |
| Abrir un domingo señalado | `compartido/tienda.ts` → `aperturasEspeciales`, o desde el panel | |
| Cambiar el IVA | `compartido/tienda.ts` → `iva` | Pendiente de validar con el gestor |
| Permitir pagar al recoger | `compartido/tienda.ts` → `pagoEnTienda: true` | Solo vale para «Recoger en la tienda» |
| Anunciar Bizum | Actívalo en Stripe y `compartido/tienda.ts` → `pago.bizum: true` | |
| Cambiar la dirección de la web (dominio propio) | `compartido/negocio.ts` → `web.url` **y** `astro.config.mjs` → `SITIO` | Las dos a la vez; `npm run comprobar` avisa si no coinciden |
| Cambiar las normas del hospital | `src/pages/flores-hospital-universitario-toledo.astro` | Constante `AVISO_UNIDADES` y las preguntas |
| Revisar los textos legales | `src/pages/aviso-legal.astro`, `privacidad.astro`, `cookies.astro`, `condiciones-de-venta.astro` | |
| Cambiar la base de datos | `functions/_lib/esquema.ts` | **Añade** una migración al final; nunca edites una publicada |
| Dar por cerrado un pendiente | `compartido/pendientes.ts` | Borra su entrada y lanza `npm run comprobar` |

---

## 7. Decisiones tomadas y por qué

| Decisión | Por qué |
|---|---|
| Web propia con Astro, Cloudflare Pages, D1 y Stripe | Decidido el 28/10/2026 (`decisiones.md`): código, dominio y cuentas a nombre de Loli, con coste contenido |
| Dos entornos y etiquetas `ejemplo` / `precioConfirmado` | Permite dejar toda la tienda montada sin publicar precios ni productos que Loli no ha confirmado |
| Sin Stripe, la web sigue funcionando por WhatsApp | La web se puede publicar ya como catálogo y encender el pago cuando estén las cuentas, sin tocar código |
| El servidor recalcula todos los importes | Lo que manda el navegador no es de fiar |
| Stripe Checkout alojado, sin SDK | La web no toca datos de tarjeta y no hay dependencias que mantener |
| Clave única para el panel, con cookie firmada | Es una tienda con una sola persona usándolo. Si hicieran falta varios usuarios, se cambia `functions/_lib/sesion.ts` |
| Sin cuentas de cliente, sin cookies de terceros y sin analítica | Decisión del 28/10/2026. No hace falta aviso de cookies |
| Ilustraciones dibujadas con código para los productos sin foto | No se usan fotos de bancos de imágenes ni con derechos de terceros |
| Los datos de quien recibe las flores se borran a los 90 días | Minimización de datos; son de terceros y a veces de personas ingresadas |
| La web no devuelve dinero ni emite facturas | Cobros y devoluciones los decide una persona, en Stripe. La facturación está pendiente de hablar con el gestor (T18) |

## 8. Lo que la tienda no hace (todavía)

- **No emite facturas.** El panel exporta los pedidos para el gestor. Pendiente de T18 (Verifactu).
- **No manda correos propios** hasta que haya dominio verificado en Resend. El justificante lo manda Stripe.
- **No tiene control de existencias.** Hay un cupo de pedidos por día, no unidades por producto.
- **No tiene franjas horarias de reparto.** La ficha dice «en el horario del comercio, sin franjas».
- **No avisa a Loli al móvil** cuando entra un pedido: lo ve en el panel (que se actualiza cada minuto) y en el correo de Stripe. Con Resend, también por correo.
- **No tiene cupones, valoraciones ni cuentas de cliente.**

## 9. Qué falta, en orden

1. **Cloudflare** (Álvaro): cambiar la compilación del proyecto, crear las bases de datos y poner las variables. Sin esto la rama no se puede ni previsualizar. → `PUESTA-EN-MARCHA.md`, pasos 1 a 4.
2. **Con Loli** (segunda entrevista, T11 y T15): productos y precios reales, logo, fotos, hora límite, cupo, festivos, zonas de reparto y compromisos de las condiciones de venta.
3. **Con el gestor** (T18): IVA de complementos y envío, y cómo se factura.
4. **Stripe** a nombre de Loli y las claves reales en Cloudflare. → `PUESTA-EN-MARCHA.md`, paso 5.
5. **Hospital** (T17): normas reales sobre flores y entregas.
6. **Legal** (T16 y T19): revisión de los textos y encargo de tratamiento.
7. **Diez pedidos de prueba** con Loli usando el panel (T23) y, entonces, fusionar en `main`.

La lista completa, con dónde se cambia cada cosa y quién la tiene que dar, está en [`PENDIENTES.md`](PENDIENTES.md). Se regenera con `npm run comprobar`.
