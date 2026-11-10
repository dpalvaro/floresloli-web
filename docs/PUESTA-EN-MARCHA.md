# Puesta en marcha de la tienda

Pasos para pasar de «rama con la tienda hecha» a «tienda publicada y vendiendo». Los hace Álvaro en los paneles de Cloudflare y de Stripe: ningún agente cambia la configuración del hosting, las cuentas ni las claves.

Los nombres de los menús pueden variar un poco si Cloudflare o Stripe cambian sus paneles.

> **Antes de fusionar en `main`, haz el paso 1.** El proyecto de Cloudflare está configurado para publicar la carpeta `web/` sin compilar, y esa carpeta ya no existe. Si se fusiona sin cambiar la configuración, la compilación falla y Cloudflare deja publicada la versión anterior (la landing): no se rompe nada, pero tampoco sale la web nueva.

## Qué pasa en cada momento

| Situación | Qué ve el público |
|---|---|
| Rama sin fusionar | Nada cambia: sigue la landing |
| Fusionada, con el paso 1 hecho y nada más | Web nueva como **catálogo**: 8 productos sin precio y encargos por WhatsApp. No cobra |
| Además, precios confirmados en el catálogo | Los precios se ven, pero se sigue encargando por WhatsApp |
| Además, pasos 2 a 5 (base de datos, variables y Stripe real) | **Tienda vendiendo** |

## 1. Compilación en Cloudflare Pages

Proyecto `floresyplantasloli` › **Settings** › **Build** (o «Builds & deployments»):

| Campo | Valor |
|---|---|
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (vacío) |

La versión de Node sale del archivo `.node-version` (22). Si Cloudflare no lo respeta, añade la variable `NODE_VERSION` = `22` en los dos entornos.

No hace falta la variable `ENTORNO`: la web sabe sola que `main` es producción y que cualquier otra rama es de pruebas.

Después, en **Deployments**, busca el despliegue de la rama `claude/T39-tienda-online-v1` y pulsa «Retry deployment». Su dirección de vista previa es donde se prueba la tienda.

## 2. Base de datos (D1)

1. **Storage & Databases** › **D1** › «Create database». Crea dos: `floresloli-pruebas` y `floresloli`.
2. Proyecto de Pages › **Settings** › **Bindings** › «Add» › D1 database:
   - Entorno **Preview**: nombre de la variable `DB`, base de datos `floresloli-pruebas`.
   - Entorno **Production**: nombre de la variable `DB`, base de datos `floresloli`.

El nombre tiene que ser exactamente `DB`. Las tablas se crean solas la primera vez que alguien usa la tienda: no hay que ejecutar nada.

## 3. Variables y secretos

Proyecto de Pages › **Settings** › **Variables and Secrets**. Ponlas como «Secret» (cifradas), en cada entorno:

| Variable | Preview | Production | Para qué |
|---|---|---|---|
| `PANEL_CLAVE` | Sí | Sí, distinta | Clave para entrar en `/panel/`. Mínimo 8 caracteres. La de producción es la que usará Loli |
| `SECRETO_SESION` | Sí | Sí, distinto | Texto largo y aleatorio (mínimo 24 caracteres) para firmar la sesión del panel |
| `STRIPE_SECRET_KEY` | Opcional: `sk_test_…` | `sk_live_…` | Clave secreta de Stripe |
| `STRIPE_WEBHOOK_SECRET` | Opcional: `whsec_…` del webhook de prueba | `whsec_…` del webhook real | Para comprobar que los avisos vienen de Stripe |
| `RESEND_API_KEY`, `CORREO_REMITENTE`, `CORREO_AVISOS` | Opcional | Opcional | Correos propios de aviso (paso 6) |

Para generar un secreto aleatorio: `openssl rand -base64 36`.

Las variables se aplican en el siguiente despliegue: después de cambiarlas, pulsa «Retry deployment».

Sin claves de Stripe, las vistas de prueba usan un **pago simulado** que no cobra nada: con los pasos 1, 2 y `PANEL_CLAVE` + `SECRETO_SESION` ya se puede probar la tienda entera.

## 4. Comprobar la vista previa

En la dirección de vista previa de la rama:

1. Haz un pedido completo con el pago simulado.
2. Entra en `/panel/` con la clave de Preview y comprueba que aparece, cámbiale el estado e imprímelo.
3. En el panel, pestaña «Ajustes»: no debe haber avisos de configuración que no esperes.

Esta es la vista que se le enseña a Loli para la prueba de diez pedidos (T23).

## 5. Stripe (para cobrar de verdad)

1. Abre la cuenta de Stripe **a nombre de Loli** (titular: la persona física, con su NIF y su cuenta bancaria) y complétala hasta que permita cobrar.
2. En Stripe › **Configuración** › **Métodos de pago**: tarjeta. Si se quiere Bizum, se activa aquí; después pon `pago.bizum: true` en `compartido/tienda.ts` para que la web lo anuncie.
3. En Stripe › **Configuración** › **Correos electrónicos para clientes**: activa el justificante de los pagos correctos. Es el justificante que recibe el cliente.
4. En Stripe › **Desarrolladores** › **Webhooks** › «Añadir destino»:
   - Dirección: `https://floresyplantasloli.pages.dev/api/stripe/webhook` (o la del dominio propio).
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` y `charge.refunded`.
   - Copia el «secreto de firma» (`whsec_…`) en `STRIPE_WEBHOOK_SECRET` de Production.
5. Copia la clave secreta real (`sk_live_…`) en `STRIPE_SECRET_KEY` de Production.
6. Para probar con Stripe antes de cobrar de verdad: repite los pasos 4 y 5 en el modo de prueba de Stripe, con la dirección de la vista previa, y pon esas claves (`sk_test_…`) en Preview. Tarjeta de prueba: 4242 4242 4242 4242, cualquier fecha futura y cualquier CVC.

En producción la web **solo** cobra con una clave `sk_live_` y su `whsec_`. Con una clave de prueba en producción, no cobra y lo avisa en «Ajustes».

Las **devoluciones** se hacen en el panel de Stripe. El pedido queda marcado como «Devuelto» en el panel de Loli cuando Stripe avisa.

## 6. Correos propios (opcional)

Hace falta un dominio propio. En Resend: verifica el dominio y crea una clave. En Cloudflare: `RESEND_API_KEY`, `CORREO_REMITENTE` (por ejemplo, `Flores y Plantas Loli <pedidos@dominio.es>`) y, si los avisos deben ir a otro correo que el de la tienda, `CORREO_AVISOS`.

Con esto, cada pedido pagado manda un aviso a la tienda y una confirmación al cliente.

## 7. Dominio propio (opcional)

1. Proyecto de Pages › **Custom domains** › añade el dominio.
2. Cambia la dirección en `compartido/negocio.ts` (`web.url`) **y** en `astro.config.mjs` (`SITIO`). `npm run comprobar` avisa si no coinciden.
3. Cambia la dirección del webhook en Stripe.
4. Pon la web nueva en la ficha de Google, en Facebook y en Instagram (T38).

## 8. Antes de vender: lista

- [ ] `npm run comprobar` no deja ningún pendiente de los marcados «Antes de vender» (o Álvaro acepta los que queden).
- [ ] Precios confirmados con Loli y marcados `precioConfirmado: true`.
- [ ] Hora límite, cupo, festivos y zonas de reparto confirmados (`compartido/tienda.ts`).
- [ ] IVA y forma de facturar validados con el gestor (T18).
- [ ] Textos legales revisados y encargo de tratamiento firmado (T16 y T19).
- [ ] Diez pedidos de prueba sin errores, con Loli usando el panel (T23).
- [ ] Loli tiene la clave del panel y sabe dónde mirar los pedidos.
- [ ] Un pedido real de poco importe, pagado con una tarjeta propia y devuelto desde Stripe, llega bien al panel.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| La cesta solo ofrece WhatsApp | Falta la base de datos (`DB`), falta Stripe o algún producto de la cesta no tiene precio confirmado. Míralo en el panel › «Ajustes» |
| El pedido se paga pero se queda «esperando el pago» | El webhook no llega: revisa la dirección y el `STRIPE_WEBHOOK_SECRET`. La página de confirmación lo arregla sola preguntando a Stripe, pero hay que corregirlo |
| El panel dice que no tiene clave | Faltan `PANEL_CLAVE` o `SECRETO_SESION` en ese entorno, o no se ha vuelto a desplegar |
| En la vista previa no sale el pago simulado | Hay una clave `sk_test_` puesta: entonces se usa Stripe en modo prueba |
| La compilación falla en Cloudflare | Revisa el paso 1 y la versión de Node (22) |
