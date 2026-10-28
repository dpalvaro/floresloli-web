/* =====================================================================
   DATOS DE LA FLORISTERÍA: el único archivo que hay que tocar para
   cambiar productos, precios, teléfonos, horario o fechas.

   · Precio: escribe un número (ej. 25) o déjalo en null y la web dirá
     «Te decimos el precio por WhatsApp». No pongas el símbolo €.
   · Foto: nombre base de la foto en /fotos (la web usa las versiones
     -600.jpg y -1000.jpg).
   · visible: false oculta un producto sin borrarlo.
   ===================================================================== */

window.FLORISTERIA = {
  nombre: "Flores y Plantas Loli",
  direccion: "Calle Río Alberche, 30",
  cp: "45007",
  ciudad: "Toledo",
  barrio: "Polígono (Santa María de Benquerencia)",
  telefono: "925 24 07 08",
  movil: "635 54 37 63",
  whatsapp: "34635543763", // con prefijo 34 y sin espacios

  // Varios tramos en un mismo día: sepáralos con " y ".
  horario: [
    { dias: "Lunes a viernes", horas: "9:30 – 14:00 y 17:00 – 20:00" },
    { dias: "Sábados", horas: "10:00 – 14:00" },
    { dias: "Domingos", horas: "Cerrado" },
  ],

  campana: {
    activa: true,
    // Días en los que se puede recoger o recibir un encargo de campaña.
    fechas: [
      { valor: "2026-10-27", texto: "Martes 27 de octubre" },
      { valor: "2026-10-28", texto: "Miércoles 28 de octubre" },
      { valor: "2026-10-29", texto: "Jueves 29 de octubre" },
      { valor: "2026-10-30", texto: "Viernes 30 de octubre" },
      { valor: "2026-10-31", texto: "Sábado 31 de octubre" },
    ],
    franja: "Recogida del martes 27 al sábado 31 de octubre",
    aviso: "El 30 y el 31 son los días de más trabajo: cuanto antes encargues, mejor.",
    entregaCementerio: false, // true si Loli lleva las flores al cementerio
  },

  envio: "Reparto a domicilio en Toledo por 8 €. Pueblos cercanos (Layos, Cabañas…), según distancia.",

  productosCampana: [
    { id: "centro-lapida", nombre: "Centro para lápida o nicho", descripcion: "Centro bajo de claveles rojos y blancos, el clásico para la lápida.", precio: null, foto: "centro-lapida", visible: true },
    { id: "corona", nombre: "Corona", descripcion: "Corona redonda de rosas, anturios y flor variada. Con cinta y dedicatoria si lo pides.", precio: null, foto: "corona", visible: true },
    { id: "centro-natural", nombre: "Centro de flor natural", descripcion: "Gerberas, crisantemos y claveles en tonos alegres, montado a mano en la tienda.", precio: null, foto: "centro-natural", visible: true },
    { id: "crisantemo-maceta", nombre: "Crisantemo en maceta", descripcion: "La planta de Todos los Santos: aguanta semanas al aire libre. En blanco, amarillo o morado.", precio: null, foto: "crisantemo-maceta", visible: true },
    { id: "jardinera", nombre: "Jardinera de temporada", descripcion: "Brezo, ciclamen, crisantemo y una pequeña conífera, para jardinera o maceta grande.", precio: null, foto: "jardinera", visible: true },
    { id: "ramo", nombre: "Ramo para llevar", descripcion: "Ramo de flor fresca para llevar en mano: gerbera, margarita y verde.", precio: null, foto: "ramo", visible: true },
  ],

  // Galería «Centros que tenemos en tienda». El número es la referencia
  // que el cliente da por WhatsApp. Cambia o quita fotos libremente.
  modelos: ["modelo-1", "modelo-2", "modelo-3", "modelo-4", "modelo-5", "modelo-6", "modelo-7", "modelo-8"],

  legal: {
    titular: "⚠ PENDIENTE: nombre y apellidos o razón social",
    nif: "⚠ PENDIENTE",
    email: "⚠ PENDIENTE",
  },
};
