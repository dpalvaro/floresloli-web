# Puesta en marcha de la tienda

Pasos para pasar de «rama con la tienda hecha» a «tienda publicada y vendiendo». Los hace Álvaro en los paneles de OVH, Cloudflare, GitHub y Stripe. Ningún agente cambia la configuración del alojamiento, las cuentas ni las claves.

Los nombres de los menús pueden variar un poco si los paneles cambian.

**Dónde vive cada cosa (desde el 22/11/2026):**

- **Producción:** un servidor propio en la Unión Europea, con dominio propio. Se publica solo al fusionar en `main`. Montaje y pasos en [`SERVIDOR.md`](SERVIDOR.md). Se sacó de Cloudflare porque los bloqueos de LaLiga dejan sin servicio muchas webs de Cloudflare los días de partido.
- **Vistas previas (pruebas):** Cloudflare Pages, una por rama, como hasta ahora.

## Qué pasa en cada momento

| Situación | Qué ve el público |
|---|---|
| Ramas sin fusionar | Nada cambia: sigue la landing en `floresyplantasloli.pages.dev` |
| Fusionadas en `main`, sin servidor propio configurado | Cloudflare publica la web nueva en `pages.dev` como **catálogo**: 8 productos sin precio y encargos por WhatsApp. No cobra |
| Servidor propio configurado (`SERVIDOR.md`, pasos 1 a 8) | La web en su dominio, como catálogo. `pages.dev` lleva al dominio |
| Además, precios confirmados en el catálogo | Los precios se ven, pero se sigue encargando por WhatsApp |
| Además, Stripe real (apartado 3) | **Tienda vendiendo** |

## 1. Vistas previas en Cloudflare Pages

Ya está hecho desde el 10/11. Proyecto `floresyplantasloli` › **Settings** › **Build**:

| Campo | Valor |
|---|---|
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (vacío) |

La versión de Node sale del archivo `.node-version` (22).

Para que las vistas previas guarden pedidos de prueba:

1. **Storage & Databases** › **D1** › «Create database» › `floresloli-pruebas`.
2. Proyecto de Pages › **Settings** › **Bindings** › «Add» › D1 database, solo en el entorno **Preview**: nombre `DB`, base `floresloli-pruebas`.
3. **Settings** › **Variables and Secrets**, solo en **Preview**, como «Secret»: `PANEL_CLAVE` (mínimo 8 caracteres) y `SECRETO_SESION` (texto aleatorio de 24 o más). Opcional: claves de prueba de Stripe (apartado 3).
4. **Deployments** › despliegue de la rama › «Retry deployment».

En el entorno **Production** de Cloudflare no hace falta base de datos ni claves: la producción es el servidor propio. Solo va `URL_PUBLICA` (`SERVIDOR.md`, paso 7).

## 2. Comprobar la vista previa

En la dirección de vista previa de la rama:

1. Haz un pedido completo con el pago simulado.
2. Entra en `/panel/` con la clave de Preview y comprueba que aparece, cámbiale el estado e imprímelo.
3. En el panel, pestaña «Ajustes»: no debe haber avisos de configuración que no esperes.

Esta es la vista que se le enseña a Loli para la prueba de diez pedidos (T23).

## 3. Stripe (para cobrar de verdad)

1. Abre la cuenta de Stripe **a nombre de Loli**, con la persona física como titular, su NIF y su cuenta bancaria. Complétala hasta que permita cobrar.
2. En Stripe › **Configuración** › **Métodos de pago**: tarjeta. Si se quiere Bizum, se activa aquí; después pon `pago.bizum: true` en `compartido/tienda.ts` para que la web lo anuncie.
3. En Stripe › **Configuración** › **Correos electrónicos para clientes**: activa el justificante de los pagos correctos. Es el que recibe el cliente.
4. En Stripe › **Desarrolladores** › **Webhooks** › «Añadir destino»:
   - Dirección: `https://tu-dominio/api/stripe/webhook`.
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` y `charge.refunded`.
   - Copia el «secreto de firma» (`whsec_…`).
5. Copia también la clave secreta real (`sk_live_…`).
6. Ponlas en el servidor, en `STRIPE_WEBHOOK_SECRET` y `STRIPE_SECRET_KEY`:
   ```bash
   ssh tienda
   sudoedit /etc/floresloli/entorno
   sudo systemctl restart floresloli
   ```
7. Para probar Stripe antes de cobrar de verdad, usa una vista previa de Cloudflare:
   - Repite el paso 4 en el modo de prueba de Stripe, con la dirección de la vista previa.
   - Pon esas claves (`sk_test_…` y su `whsec_…`) en **Preview** de Cloudflare.
   - Tarjeta de prueba: 4242 4242 4242 4242, cualquier fecha futura y cualquier CVC.

En producción la web **solo** cobra con una clave `sk_live_` y su `whsec_`. Con una clave de prueba en producción no cobra, y lo avisa en «Ajustes».

Las **devoluciones** se hacen en el panel de Stripe. El pedido queda marcado como «Devuelto» en el panel de Loli cuando Stripe avisa.

## 4. Correos propios (opcional)

En Resend, verifica el dominio y crea una clave. Después, en el servidor (`sudoedit /etc/floresloli/entorno` y reinicio):

- `RESEND_API_KEY`.
- `CORREO_REMITENTE`, por ejemplo `Flores y Plantas Loli <pedidos@tu-dominio>`.
- `CORREO_AVISOS`, solo si los avisos deben ir a otro correo que el de la tienda.

Con esto, cada pedido pagado manda un aviso a la tienda y una confirmación al cliente.

## 5. Antes de vender: lista

- [ ] Servidor propio preparado y publicado (`SERVIDOR.md`, pasos 1 a 8), con SSL Labs y securityheaders.com en A.
- [ ] Aviso si se cae (`SERVIDOR.md`, paso 10) y una copia recuperada con éxito (paso 11).
- [ ] `npm run comprobar` no deja ningún pendiente de los marcados «Antes de vender», o Álvaro acepta los que queden.
- [ ] Precios confirmados con Loli y marcados `precioConfirmado: true`.
- [ ] Hora límite, cupo, festivos y zonas de reparto confirmados (`compartido/tienda.ts`).
- [ ] IVA y forma de facturar validados con el gestor (T18).
- [ ] Textos legales revisados y encargo de tratamiento firmado (T16 y T19). La privacidad nombra al proveedor del servidor (`compartido/negocio.ts` › `alojamiento`).
- [ ] Diez pedidos de prueba sin errores, con Loli usando el panel (T23).
- [ ] Loli tiene la clave del panel y sabe dónde mirar los pedidos.
- [ ] Un pedido real de poco importe, pagado con una tarjeta propia y devuelto desde Stripe, llega bien al panel.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| La cesta solo ofrece WhatsApp | Falta Stripe, o algún producto de la cesta no tiene precio confirmado. Míralo en el panel › «Ajustes» |
| El pedido se paga pero se queda «esperando el pago» | El webhook no llega: revisa la dirección y el `STRIPE_WEBHOOK_SECRET`. La página de confirmación lo arregla sola preguntando a Stripe, pero hay que corregirlo |
| El panel dice que no tiene clave | Faltan `PANEL_CLAVE` o `SECRETO_SESION` en `/etc/floresloli/entorno`, o no se ha reiniciado la tienda |
| En la vista previa no sale el pago simulado | Hay una clave `sk_test_` puesta: entonces se usa Stripe en modo prueba |
| La vista previa no compila en Cloudflare | Revisa el apartado 1 y la versión de Node (22) |
| Cualquier cosa del servidor | `SERVIDOR.md`, «Si algo falla» |
