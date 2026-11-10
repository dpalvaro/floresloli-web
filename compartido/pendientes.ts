/* =====================================================================
   PENDIENTES: todo lo que falta por confirmar o por recibir.

   Es la lista única de «huecos» del proyecto. `npm run comprobar` la
   imprime junto con lo que detecta solo (productos de ejemplo, precios
   sin confirmar, fotos que faltan…) y genera docs/PENDIENTES.md.

   Al resolver uno: cambia el dato en el archivo que indica «donde» y
   borra aquí su entrada (o deja solo lo que siga abierto).
   ===================================================================== */

export interface Pendiente {
  id: string;
  area: 'Catálogo y precios' | 'Reparto y fechas' | 'Fotos y marca' | 'Pagos y cuentas' | 'Fiscal y legal' | 'Decisiones';
  /** Qué falta. */
  que: string;
  /** Qué hay puesto mientras tanto. */
  provisional: string;
  /** Dónde se cambia. */
  donde: string;
  /** Quién lo tiene que dar o decidir. */
  quien: string;
  /** Tarea del centro de mando relacionada. */
  tarea?: string;
  /**
   * 'venta'  = sin esto no se puede cobrar en la web.
   * 'publicar' = conviene cerrarlo antes de fusionar en main.
   * 'no' = se puede lanzar sin ello.
   */
  bloquea: 'venta' | 'publicar' | 'no';
}

export const PENDIENTES: Pendiente[] = [
  /* ---------------- Catálogo y precios ---------------- */
  {
    id: 'precios',
    area: 'Catálogo y precios',
    que: 'Precios reales de cada producto y de cada tamaño.',
    provisional:
      'Todos los precios son de ejemplo (precioConfirmado: false). En la web pública no se enseñan: sale «Te decimos el precio por WhatsApp» y ese producto se encarga por WhatsApp.',
    donde: 'compartido/catalogo.ts → precio / variantes, y precioConfirmado: true en cada producto',
    quien: 'Loli',
    tarea: 'T15',
    bloquea: 'venta',
  },
  {
    id: 'productos-de-ejemplo',
    area: 'Catálogo y precios',
    que: 'Qué productos de ejemplo vende Loli de verdad, con qué nombre y cuáles sobran.',
    provisional:
      'Los productos habituales de una floristería están marcados ejemplo: true. Solo se ven en las vistas de prueba; la web pública enseña los 8 que ya salían en la landing.',
    donde: 'compartido/catalogo.ts → ejemplo: false (o borrar el producto)',
    quien: 'Loli',
    tarea: 'T15',
    bloquea: 'no',
  },
  {
    id: 'ramo-a-medida',
    area: 'Catálogo y precios',
    que: 'Importes habituales del ramo a presupuesto, y el mínimo y el máximo que se aceptan.',
    provisional: 'Botones de 25, 35, 50 y 75 €; mínimo 20 € y máximo 300 €.',
    donde: 'compartido/tienda.ts → ramoAMedida, y precioConfirmado: true en «ramo-a-tu-medida»',
    quien: 'Loli',
    bloquea: 'venta',
  },
  {
    id: 'temporadas',
    area: 'Catálogo y precios',
    que: 'Fechas de temporada de girasoles, tulipanes, crisantemos, ciclamen, flor de pascua y centro de Navidad.',
    provisional: 'Temporadas habituales en España. Fuera de temporada el producto se ve, pero no se puede pedir para esas fechas.',
    donde: 'compartido/catalogo.ts → temporada de cada producto',
    quien: 'Loli',
    bloquea: 'no',
  },

  /* ---------------- Reparto y fechas ---------------- */
  {
    id: 'hora-limite',
    area: 'Reparto y fechas',
    que: 'Hora límite para pedir para el mismo día (la ficha dice «siempre que dé tiempo»).',
    provisional: '12:00.',
    donde: 'compartido/tienda.ts → horaLimiteMismoDia',
    quien: 'Loli',
    bloquea: 'venta',
  },
  {
    id: 'cupo',
    area: 'Reparto y fechas',
    que: 'Cuántos pedidos de la web se aceptan por día.',
    provisional: '12 al día. Se puede cambiar un día concreto desde el panel.',
    donde: 'compartido/tienda.ts → cupoDiario',
    quien: 'Loli (con el registro de pedidos de dos semanas)',
    tarea: 'T10',
    bloquea: 'venta',
  },
  {
    id: 'festivos',
    area: 'Reparto y fechas',
    que: 'Qué festivos cierra, los festivos locales de Toledo de 2027 y qué domingos señalados abre (San Valentín, domingo 14/02/2027; Día de la Madre, domingo 02/05/2027).',
    provisional:
      'Cerrado los domingos y los festivos nacionales y de Castilla-La Mancha de 2026 y 2027 (lista sin confirmar con el calendario oficial). Ningún domingo abierto.',
    donde: 'compartido/tienda.ts → festivos y aperturasEspeciales (o día a día desde el panel, pestaña «Calendario»)',
    quien: 'Loli',
    bloquea: 'venta',
  },
  {
    id: 'zonas-de-reparto',
    area: 'Reparto y fechas',
    que: 'Qué barrios y códigos postales entran en los 8 € y la tarifa de los pueblos cercanos (Layos, Cabañas…).',
    provisional:
      'Los 8 códigos postales de Toledo capital (45001 a 45008) a 8 €. Cualquier otro código postal no se puede pagar en la web: se remite a WhatsApp.',
    donde: 'compartido/tienda.ts → entrega.domicilio.zonas',
    quien: 'Loli',
    tarea: 'T15',
    bloquea: 'venta',
  },
  {
    id: 'hospital-precio',
    area: 'Reparto y fechas',
    que: 'Precio de la entrega en el Hospital Universitario de Toledo.',
    provisional: '8 €, como el reparto en Toledo.',
    donde: 'compartido/tienda.ts → entrega.hospital.precio',
    quien: 'Loli',
    bloquea: 'venta',
  },
  {
    id: 'hospital-normas',
    area: 'Reparto y fechas',
    que: 'Normas del hospital sobre flores y entregas (qué unidades no las admiten, dónde se dejan y a qué horas).',
    provisional:
      'La página del hospital dice, sin concretar, que algunas unidades no admiten flores y que conviene preguntarlo en la planta. No promete horas.',
    donde: 'src/pages/flores-hospital-universitario-toledo.astro (constante AVISO_UNIDADES y preguntas frecuentes)',
    quien: 'Álvaro (llamada a Atención al Paciente)',
    tarea: 'T17',
    bloquea: 'publicar',
  },
  {
    id: 'pago-en-tienda',
    area: 'Reparto y fechas',
    que: 'Si se puede encargar en la web y pagar al recoger en la tienda (momento del cobro, sin confirmar en la ficha).',
    provisional: 'Desactivado: en la web se paga siempre al hacer el pedido.',
    donde: 'compartido/tienda.ts → pagoEnTienda',
    quien: 'Loli',
    bloquea: 'no',
  },

  /* ---------------- Fotos y marca ---------------- */
  {
    id: 'logo',
    area: 'Fotos y marca',
    que: 'Logo en buena calidad (mejor en SVG o PNG con fondo transparente).',
    provisional: 'La cabecera escribe «Flores Loli» con la tipografía de la web y los colores del rótulo.',
    donde: 'src/assets/logo.svg (o .png) y compartido/negocio.ts → logo; después, `npm run imagenes` para rehacer el icono y la imagen de compartir',
    quien: 'Loli',
    tarea: 'T15',
    bloquea: 'no',
  },
  {
    id: 'fotos-de-producto',
    area: 'Fotos y marca',
    que: 'Fotos reales de los productos que no tienen (de 20 a 30 fotos de trabajos).',
    provisional: 'Cada producto sin foto lleva una ilustración propia dibujada con código. Hay 15 fotos reales, las de la landing.',
    donde: 'src/assets/fotos/<nombre>.jpg y compartido/catalogo.ts → fotos: [\'<nombre>\'] y fotoAlt',
    quien: 'Loli',
    tarea: 'T15',
    bloquea: 'no',
  },
  {
    id: 'foto-fachada',
    area: 'Fotos y marca',
    que: 'Autorización de imagen firmada del equipo que sale en la foto de la fachada.',
    provisional: 'La foto se usa en la portada y en «Dónde estamos» (el uso en la web se confirmó en T34). No se usa en la imagen de compartir.',
    donde: 'src/assets/fotos/fachada.jpg (si no hay autorización, cambiarla por una sin personas)',
    quien: 'Loli',
    tarea: 'T16',
    bloquea: 'no',
  },
  {
    id: 'redes',
    area: 'Fotos y marca',
    que: 'Dirección de la página de Facebook y confirmar que el Instagram @floresyplantasloli está activo.',
    provisional: 'No se enlaza ninguna red social.',
    donde: 'compartido/negocio.ts → redes (url y confirmada: true)',
    quien: 'Loli',
    tarea: 'T13',
    bloquea: 'no',
  },

  /* ---------------- Pagos y cuentas ---------------- */
  {
    id: 'pasarela',
    area: 'Pagos y cuentas',
    que: 'Decidir la pasarela de pago y abrir la cuenta a nombre de Loli. Stripe es la recomendada y la que está integrada.',
    provisional:
      'Sin claves, la web pública no cobra: funciona como catálogo y los encargos van por WhatsApp. En las vistas de prueba el pago es simulado.',
    donde: 'Cloudflare Pages → Settings → Variables and Secrets: STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET (docs/PUESTA-EN-MARCHA.md)',
    quien: 'Álvaro y Loli',
    tarea: 'T39',
    bloquea: 'venta',
  },
  {
    id: 'bizum',
    area: 'Pagos y cuentas',
    que: 'Si se activa Bizum además de la tarjeta (se hace en el panel de Stripe, sin tocar código).',
    provisional: 'Los textos de la web hablan solo de tarjeta.',
    donde: 'Panel de Stripe → Métodos de pago; después compartido/tienda.ts → pago.bizum: true',
    quien: 'Álvaro y Loli',
    bloquea: 'no',
  },
  {
    id: 'cloudflare',
    area: 'Pagos y cuentas',
    que: 'Cambiar la configuración del proyecto de Cloudflare Pages (orden de compilación y carpeta), crear la base de datos D1 y poner las variables. La cuenta pasa a nombre de Loli con la tienda.',
    provisional: 'El proyecto actual publica la carpeta web/ sin compilar: con esa configuración esta rama no se puede previsualizar.',
    donde: 'Panel de Cloudflare (docs/PUESTA-EN-MARCHA.md, pasos 1 a 4)',
    quien: 'Álvaro',
    bloquea: 'publicar',
  },
  {
    id: 'panel-clave',
    area: 'Pagos y cuentas',
    que: 'Clave del panel de pedidos y secreto de sesión.',
    provisional: 'Sin ellos nadie puede entrar en el panel.',
    donde: 'Cloudflare Pages → Variables and Secrets: PANEL_CLAVE y SECRETO_SESION',
    quien: 'Álvaro',
    bloquea: 'venta',
  },
  {
    id: 'dominio',
    area: 'Pagos y cuentas',
    que: 'Dominio propio para la tienda (a nombre de Loli).',
    provisional: 'https://floresyplantasloli.pages.dev',
    donde: 'compartido/negocio.ts → web.url y astro.config.mjs → SITIO (las dos a la vez)',
    quien: 'Álvaro y Loli',
    bloquea: 'no',
  },
  {
    id: 'correo-avisos',
    area: 'Pagos y cuentas',
    que: 'Correos automáticos al cliente y a la tienda con cada pedido (hace falta un dominio propio verificado en Resend).',
    provisional: 'Sin correo propio: el cliente recibe el justificante de Stripe y Loli ve los pedidos en el panel.',
    donde: 'Cloudflare Pages → Variables and Secrets: RESEND_API_KEY, CORREO_REMITENTE y CORREO_AVISOS',
    quien: 'Álvaro',
    bloquea: 'no',
  },

  /* ---------------- Fiscal y legal ---------------- */
  {
    id: 'iva',
    area: 'Fiscal y legal',
    que: 'IVA de los complementos y del envío.',
    provisional: 'Flores y plantas al 10 % (ficha); complementos y envío al 21 %. Los precios se muestran siempre con el IVA incluido.',
    donde: 'compartido/tienda.ts → iva',
    quien: 'Gestor de Loli',
    tarea: 'T18',
    bloquea: 'venta',
  },
  {
    id: 'facturas',
    area: 'Fiscal y legal',
    que: 'Cómo se factura la venta online (factura simplificada o completa, Verifactu) y quién la emite.',
    provisional: 'La web no emite facturas. Las condiciones dicen que la factura se pide a la tienda. El panel exporta los pedidos en CSV para el gestor.',
    donde: 'src/pages/condiciones-de-venta.astro (apartado «Factura»)',
    quien: 'Gestor de Loli',
    tarea: 'T18',
    bloquea: 'venta',
  },
  {
    id: 'textos-legales',
    area: 'Fiscal y legal',
    que: 'Revisión del aviso legal, la política de privacidad, la de cookies y las condiciones de venta.',
    provisional: 'Textos completos redactados con los datos de la ficha, sin revisión jurídica.',
    donde: 'src/pages/aviso-legal.astro, privacidad.astro, cookies.astro y condiciones-de-venta.astro',
    quien: 'Álvaro',
    bloquea: 'venta',
  },
  {
    id: 'compromisos-de-venta',
    area: 'Fiscal y legal',
    que: 'Compromisos de las condiciones de venta: cambiar una flor por otra parecida, plazo para avisar de un problema, devolución si se cancela antes de prepararlo y hojas de reclamaciones.',
    provisional:
      'Sustitución por flor parecida del mismo valor; aviso de problemas en 24 horas con foto; cancelación con devolución íntegra hasta el día anterior a la entrega; hojas de reclamaciones en la tienda.',
    donde: 'compartido/tienda.ts → condiciones, y src/pages/condiciones-de-venta.astro',
    quien: 'Loli',
    bloquea: 'venta',
  },
  {
    id: 'domicilio-legal',
    area: 'Fiscal y legal',
    que: 'Domicilio de la titular a efectos del aviso legal.',
    provisional: 'Se usa la dirección de la tienda (C/ Río Alberche, 30).',
    donde: 'compartido/negocio.ts → legal.domicilio',
    quien: 'Loli',
    bloquea: 'no',
  },
  {
    id: 'conservacion-de-datos',
    area: 'Fiscal y legal',
    que: 'Cuánto tiempo se guardan los datos de quien recibe las flores (nombre, dirección, habitación y dedicatoria).',
    provisional: 'Se borran solos a los 90 días de la entrega; el resto del pedido se conserva para la contabilidad.',
    donde: 'compartido/tienda.ts → privacidad.diasDatosDestinatario (null = no borrar nunca)',
    quien: 'Álvaro',
    bloquea: 'no',
  },
  {
    id: 'encargo-de-tratamiento',
    area: 'Fiscal y legal',
    que: 'Contrato de encargo de tratamiento entre Loli e impulsaDT y registro de actividades, antes de guardar datos de clientes.',
    provisional: 'La política de privacidad nombra a los proveedores (Cloudflare, Stripe y, si se activa, Resend) y a impulsaDT como mantenimiento.',
    donde: 'Documentos de la agencia; src/pages/privacidad.astro si cambia algún proveedor',
    quien: 'Álvaro',
    tarea: 'T16 y T19',
    bloquea: 'venta',
  },

  /* ---------------- Decisiones ---------------- */
  {
    id: 'voz-de-marca',
    area: 'Decisiones',
    que: 'Validar con Loli la voz de marca y si se habla de «nosotras», «nosotros» o «Loli».',
    provisional: 'Textos en el tono del borrador de voz de marca, sin usar «nosotras» ni «nosotros».',
    donde: 'Textos de src/pages y compartido/catalogo.ts',
    quien: 'Loli',
    tarea: 'T11',
    bloquea: 'no',
  },
  {
    id: 'analitica',
    area: 'Decisiones',
    que: 'Si se quiere medir las visitas.',
    provisional:
      'Sin analítica ni cookies de terceros (decisión del 28/10/2026). Los encargos por WhatsApp siguen empezando por «Hola, quiero hacer un encargo desde la web».',
    donde: 'Si se añade: src/layouts/Base.astro y src/pages/cookies.astro (y aviso de cookies si no es analítica sin cookies)',
    quien: 'Álvaro',
    bloquea: 'no',
  },
  {
    id: 'pedidos-de-prueba',
    area: 'Decisiones',
    que: 'Diez pedidos de prueba sin errores, con Loli usando el panel, antes de vender.',
    provisional: 'Hecha la prueba automática de compra completa (`npm run prueba:compra`) y la revisión en móvil y escritorio.',
    donde: 'Vista previa de la rama, con pago simulado o con Stripe en modo prueba',
    quien: 'Álvaro y Loli',
    tarea: 'T23',
    bloquea: 'venta',
  },
];
