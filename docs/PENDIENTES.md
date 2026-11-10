# Pendientes de la tienda

Generado con `npm run comprobar` el 10/11/2026. No edites este archivo: la lista sale de `compartido/pendientes.ts`.

Abiertos: **31** (15 hay que cerrarlos antes de vender; 2, antes de publicar).

## Detectado automáticamente

- Productos confirmados (se ven en la web pública): 8. De ejemplo (solo en las vistas de prueba): 28.
- Productos confirmados con el precio sin confirmar (en la web pública salen sin precio y se encargan por WhatsApp): 8 de 8 → ramo-variado-de-temporada, ramo-a-tu-medida, crisantemo-en-maceta, jardinera-de-temporada, centro-de-flor-natural, centro-de-flor-artificial, corona-funeraria, centro-para-lapida.
- Productos sin foto real (llevan ilustración): 27 → ramo-de-girasoles, ramo-de-liliums, ramo-de-tulipanes, ramo-silvestre, ramo-de-flor-seca, ramo-de-rosas-rojas, ramo-de-rosas-de-colores, rosa-suelta, rosa-eterna, orquidea, anturio, espatifilo, kalanchoe, planta-verde-de-interior, suculentas, flor-de-pascua, ciclamen, cesta-de-flores, caja-de-flores, ramo-para-recien-nacido, centro-de-mesa-de-navidad, centro-de-condolencias, ramo-de-condolencias, jarron-de-cristal, caja-de-bombones, peluche, globo.
- Logo: falta (la cabecera escribe el nombre).
- Redes sociales enlazadas: ninguna.
- Festivos cargados hasta el 2027-12-25.
- Pago en la tienda al recoger: desactivado. Bizum anunciado: no.

## Catálogo y precios

| Qué falta | Qué hay puesto mientras tanto | Dónde se cambia | Quién | Tarea | Cuándo |
|---|---|---|---|---|---|
| Precios reales de cada producto y de cada tamaño. | Todos los precios son de ejemplo (precioConfirmado: false). En la web pública no se enseñan: sale «Te decimos el precio por WhatsApp» y ese producto se encarga por WhatsApp. | compartido/catalogo.ts → precio / variantes, y precioConfirmado: true en cada producto | Loli | T15 | Antes de vender |
| Qué productos de ejemplo vende Loli de verdad, con qué nombre y cuáles sobran. | Los productos habituales de una floristería están marcados ejemplo: true. Solo se ven en las vistas de prueba; la web pública enseña los 8 que ya salían en la landing. | compartido/catalogo.ts → ejemplo: false (o borrar el producto) | Loli | T15 | Se puede lanzar sin ello |
| Importes habituales del ramo a presupuesto, y el mínimo y el máximo que se aceptan. | Botones de 25, 35, 50 y 75 €; mínimo 20 € y máximo 300 €. | compartido/tienda.ts → ramoAMedida, y precioConfirmado: true en «ramo-a-tu-medida» | Loli |  | Antes de vender |
| Fechas de temporada de girasoles, tulipanes, crisantemos, ciclamen, flor de pascua y centro de Navidad. | Temporadas habituales en España. Fuera de temporada el producto se ve, pero no se puede pedir para esas fechas. | compartido/catalogo.ts → temporada de cada producto | Loli |  | Se puede lanzar sin ello |

## Reparto y fechas

| Qué falta | Qué hay puesto mientras tanto | Dónde se cambia | Quién | Tarea | Cuándo |
|---|---|---|---|---|---|
| Hora límite para pedir para el mismo día (la ficha dice «siempre que dé tiempo»). | 12:00. | compartido/tienda.ts → horaLimiteMismoDia | Loli |  | Antes de vender |
| Cuántos pedidos de la web se aceptan por día. | 12 al día. Se puede cambiar un día concreto desde el panel. | compartido/tienda.ts → cupoDiario | Loli (con el registro de pedidos de dos semanas) | T10 | Antes de vender |
| Qué festivos cierra, los festivos locales de Toledo de 2027 y qué domingos señalados abre (San Valentín, domingo 14/02/2027; Día de la Madre, domingo 02/05/2027). | Cerrado los domingos y los festivos nacionales y de Castilla-La Mancha de 2026 y 2027 (lista sin confirmar con el calendario oficial). Ningún domingo abierto. | compartido/tienda.ts → festivos y aperturasEspeciales (o día a día desde el panel, pestaña «Calendario») | Loli |  | Antes de vender |
| Qué barrios y códigos postales entran en los 8 € y la tarifa de los pueblos cercanos (Layos, Cabañas…). | Los 8 códigos postales de Toledo capital (45001 a 45008) a 8 €. Cualquier otro código postal no se puede pagar en la web: se remite a WhatsApp. | compartido/tienda.ts → entrega.domicilio.zonas | Loli | T15 | Antes de vender |
| Precio de la entrega en el Hospital Universitario de Toledo. | 8 €, como el reparto en Toledo. | compartido/tienda.ts → entrega.hospital.precio | Loli |  | Antes de vender |
| Normas del hospital sobre flores y entregas (qué unidades no las admiten, dónde se dejan y a qué horas). | La página del hospital dice, sin concretar, que algunas unidades no admiten flores y que conviene preguntarlo en la planta. No promete horas. | src/pages/flores-hospital-universitario-toledo.astro (constante AVISO_UNIDADES y preguntas frecuentes) | Álvaro (llamada a Atención al Paciente) | T17 | Antes de publicar |
| Si se puede encargar en la web y pagar al recoger en la tienda (momento del cobro, sin confirmar en la ficha). | Desactivado: en la web se paga siempre al hacer el pedido. | compartido/tienda.ts → pagoEnTienda | Loli |  | Se puede lanzar sin ello |

## Fotos y marca

| Qué falta | Qué hay puesto mientras tanto | Dónde se cambia | Quién | Tarea | Cuándo |
|---|---|---|---|---|---|
| Logo en buena calidad (mejor en SVG o PNG con fondo transparente). | La cabecera escribe «Flores Loli» con la tipografía de la web y los colores del rótulo. | src/assets/logo.svg (o .png) y compartido/negocio.ts → logo; después, `npm run imagenes` para rehacer el icono y la imagen de compartir | Loli | T15 | Se puede lanzar sin ello |
| Fotos reales de los productos que no tienen (de 20 a 30 fotos de trabajos). | Cada producto sin foto lleva una ilustración propia dibujada con código. Hay 15 fotos reales, las de la landing. | src/assets/fotos/<nombre>.jpg y compartido/catalogo.ts → fotos: ['<nombre>'] y fotoAlt | Loli | T15 | Se puede lanzar sin ello |
| Autorización de imagen firmada del equipo que sale en la foto de la fachada. | La foto se usa en la portada y en «Dónde estamos» (el uso en la web se confirmó en T34). No se usa en la imagen de compartir. | src/assets/fotos/fachada.jpg (si no hay autorización, cambiarla por una sin personas) | Loli | T16 | Se puede lanzar sin ello |
| Dirección de la página de Facebook y confirmar que el Instagram @floresyplantasloli está activo. | No se enlaza ninguna red social. | compartido/negocio.ts → redes (url y confirmada: true) | Loli | T13 | Se puede lanzar sin ello |

## Pagos y cuentas

| Qué falta | Qué hay puesto mientras tanto | Dónde se cambia | Quién | Tarea | Cuándo |
|---|---|---|---|---|---|
| Decidir la pasarela de pago y abrir la cuenta a nombre de Loli. Stripe es la recomendada y la que está integrada. | Sin claves, la web pública no cobra: funciona como catálogo y los encargos van por WhatsApp. En las vistas de prueba el pago es simulado. | Cloudflare Pages → Settings → Variables and Secrets: STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET (docs/PUESTA-EN-MARCHA.md) | Álvaro y Loli | T39 | Antes de vender |
| Si se activa Bizum además de la tarjeta (se hace en el panel de Stripe, sin tocar código). | Los textos de la web hablan solo de tarjeta. | Panel de Stripe → Métodos de pago; después compartido/tienda.ts → pago.bizum: true | Álvaro y Loli |  | Se puede lanzar sin ello |
| Cambiar la configuración del proyecto de Cloudflare Pages (orden de compilación y carpeta), crear la base de datos D1 y poner las variables. La cuenta pasa a nombre de Loli con la tienda. | El proyecto actual publica la carpeta web/ sin compilar: con esa configuración esta rama no se puede previsualizar. | Panel de Cloudflare (docs/PUESTA-EN-MARCHA.md, pasos 1 a 4) | Álvaro |  | Antes de publicar |
| Clave del panel de pedidos y secreto de sesión. | Sin ellos nadie puede entrar en el panel. | Cloudflare Pages → Variables and Secrets: PANEL_CLAVE y SECRETO_SESION | Álvaro |  | Antes de vender |
| Dominio propio para la tienda (a nombre de Loli). | https://floresyplantasloli.pages.dev | compartido/negocio.ts → web.url y astro.config.mjs → SITIO (las dos a la vez) | Álvaro y Loli |  | Se puede lanzar sin ello |
| Correos automáticos al cliente y a la tienda con cada pedido (hace falta un dominio propio verificado en Resend). | Sin correo propio: el cliente recibe el justificante de Stripe y Loli ve los pedidos en el panel. | Cloudflare Pages → Variables and Secrets: RESEND_API_KEY, CORREO_REMITENTE y CORREO_AVISOS | Álvaro |  | Se puede lanzar sin ello |

## Fiscal y legal

| Qué falta | Qué hay puesto mientras tanto | Dónde se cambia | Quién | Tarea | Cuándo |
|---|---|---|---|---|---|
| IVA de los complementos y del envío. | Flores y plantas al 10 % (ficha); complementos y envío al 21 %. Los precios se muestran siempre con el IVA incluido. | compartido/tienda.ts → iva | Gestor de Loli | T18 | Antes de vender |
| Cómo se factura la venta online (factura simplificada o completa, Verifactu) y quién la emite. | La web no emite facturas. Las condiciones dicen que la factura se pide a la tienda. El panel exporta los pedidos en CSV para el gestor. | src/pages/condiciones-de-venta.astro (apartado «Factura») | Gestor de Loli | T18 | Antes de vender |
| Revisión del aviso legal, la política de privacidad, la de cookies y las condiciones de venta. | Textos completos redactados con los datos de la ficha, sin revisión jurídica. | src/pages/aviso-legal.astro, privacidad.astro, cookies.astro y condiciones-de-venta.astro | Álvaro |  | Antes de vender |
| Compromisos de las condiciones de venta: cambiar una flor por otra parecida, plazo para avisar de un problema, devolución si se cancela antes de prepararlo y hojas de reclamaciones. | Sustitución por flor parecida del mismo valor; aviso de problemas en 24 horas con foto; cancelación con devolución íntegra hasta el día anterior a la entrega; hojas de reclamaciones en la tienda. | compartido/tienda.ts → condiciones, y src/pages/condiciones-de-venta.astro | Loli |  | Antes de vender |
| Domicilio de la titular a efectos del aviso legal. | Se usa la dirección de la tienda (C/ Río Alberche, 30). | compartido/negocio.ts → legal.domicilio | Loli |  | Se puede lanzar sin ello |
| Cuánto tiempo se guardan los datos de quien recibe las flores (nombre, dirección, habitación y dedicatoria). | Se borran solos a los 90 días de la entrega; el resto del pedido se conserva para la contabilidad. | compartido/tienda.ts → privacidad.diasDatosDestinatario (null = no borrar nunca) | Álvaro |  | Se puede lanzar sin ello |
| Contrato de encargo de tratamiento entre Loli e impulsaDT y registro de actividades, antes de guardar datos de clientes. | La política de privacidad nombra a los proveedores (Cloudflare, Stripe y, si se activa, Resend) y a impulsaDT como mantenimiento. | Documentos de la agencia; src/pages/privacidad.astro si cambia algún proveedor | Álvaro | T16 y T19 | Antes de vender |

## Decisiones

| Qué falta | Qué hay puesto mientras tanto | Dónde se cambia | Quién | Tarea | Cuándo |
|---|---|---|---|---|---|
| Validar con Loli la voz de marca y si se habla de «nosotras», «nosotros» o «Loli». | Textos en el tono del borrador de voz de marca, sin usar «nosotras» ni «nosotros». | Textos de src/pages y compartido/catalogo.ts | Loli | T11 | Se puede lanzar sin ello |
| Si se quiere medir las visitas. | Sin analítica ni cookies de terceros (decisión del 28/10/2026). Los encargos por WhatsApp siguen empezando por «Hola, quiero hacer un encargo desde la web». | Si se añade: src/layouts/Base.astro y src/pages/cookies.astro (y aviso de cookies si no es analítica sin cookies) | Álvaro |  | Se puede lanzar sin ello |
| Diez pedidos de prueba sin errores, con Loli usando el panel, antes de vender. | Hecha la prueba automática de compra completa (`npm run prueba:compra`) y la revisión en móvil y escritorio. | Vista previa de la rama, con pago simulado o con Stripe en modo prueba | Álvaro y Loli | T23 | Antes de vender |
