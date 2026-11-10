/* =====================================================================
   CATÁLOGO: categorías, ocasiones y productos.

   CÓMO SE CAMBIA UN PRODUCTO
   · precio: en euros, con IVA, sin el símbolo (30 o 12.5). null = «Te decimos
     el precio por WhatsApp» y no se puede pagar en la web.
   · variantes: tamaños u opciones, cada una con su precio.
   · fotos: nombres de archivo en src/assets/fotos, sin «.jpg». Si está vacío,
     la web dibuja una ilustración y marca la foto como pendiente.
   · ejemplo: true = producto DE EJEMPLO (lo habitual en una floristería), que
     Loli todavía no ha confirmado. Solo se ve en las vistas de prueba; en la
     web pública no sale. Al confirmarlo con Loli: ejemplo: false.
   · precioConfirmado: false = precio DE EJEMPLO. En las vistas de prueba se ve
     con la etiqueta «precio de ejemplo»; en la web pública sale «Te decimos el
     precio por WhatsApp». Al confirmarlo con Loli: precioConfirmado: true.

   Qué queda por confirmar: `npm run comprobar`.
   ===================================================================== */

import type { ProductoCompra } from './pedido.ts';

export type Entorno = 'pruebas' | 'produccion';

export type CategoriaId = 'ramos' | 'rosas' | 'plantas' | 'centros' | 'condolencias' | 'complementos';
export type OcasionId = 'cumpleanos' | 'amor' | 'nacimiento' | 'gracias' | 'animo' | 'navidad';

export interface Categoria {
  id: CategoriaId;
  /** Dirección: /<slug>/ */
  slug: string;
  nombre: string;
  /** <title> y descripción para buscadores. */
  titulo: string;
  descripcion: string;
  /** Texto de entrada de la página. */
  intro: string;
  /** Tono sobrio (condolencias). */
  sobrio?: boolean;
}

export interface Ocasion {
  id: OcasionId;
  /** Dirección: /ocasiones/<slug>/ */
  slug: string;
  nombre: string;
  titulo: string;
  descripcion: string;
  intro: string;
}

export interface Variante {
  id: string;
  nombre: string;
  precio: number | null;
}

export type FormaIlustracion = 'ramo' | 'centro' | 'cesta' | 'caja' | 'maceta' | 'corona' | 'cupula' | 'tallo' | 'objeto';
export type FlorIlustracion =
  | 'mixta' | 'rosa' | 'margarita' | 'girasol' | 'tulipan' | 'lirio' | 'espiga'
  | 'orquidea' | 'anturio' | 'pascua' | 'hojas' | 'suculenta' | 'clavel'
  | 'jarron' | 'bombones' | 'peluche' | 'globo';

export interface Ilustracion {
  forma: FormaIlustracion;
  flor: FlorIlustracion;
  /** Colores de las flores (hex). */
  colores: string[];
}

export interface Temporada {
  /** MM-DD */
  desde: string;
  hasta: string;
  /** «De noviembre a Reyes» */
  texto: string;
}

export interface Producto {
  /** También es su dirección: /tienda/<id>/ */
  id: string;
  nombre: string;
  categoria: CategoriaId;
  ocasiones: OcasionId[];
  /** Una frase para la tarjeta y la descripción de buscadores. */
  resumen: string;
  /** Párrafos de la ficha. */
  descripcion: string[];
  /** Lista corta de datos prácticos. */
  detalles?: string[];
  precio?: number | null;
  variantes?: Variante[];
  /** Ramo a presupuesto: el cliente elige el importe. */
  aMedida?: boolean;
  /** Fotos de los modelos entre los que se elige (centros de flor artificial). */
  modelos?: string[];
  fotos: string[];
  fotoAlt?: string;
  ilustracion: Ilustracion;
  temporada?: Temporada;
  /** Sale en la portada. */
  destacado?: boolean;
  ejemplo: boolean;
  precioConfirmado: boolean;
  iva: 'flores' | 'complementos';
  /** false = no se ofrece para el hospital (coronas, centros de lápida…). */
  hospital?: boolean;
}

/* ------------------------------------------------------------------ */
/* Categorías                                                          */
/* ------------------------------------------------------------------ */

export const CATEGORIAS: Categoria[] = [
  {
    id: 'ramos',
    slug: 'ramos-de-flores',
    nombre: 'Ramos de flores',
    titulo: 'Ramos de flores en Toledo, hechos a mano',
    descripcion:
      'Ramos de flor fresca de temporada hechos a mano en el Polígono de Toledo. Recógelo en la tienda o te lo llevamos a casa en Toledo.',
    intro:
      'Cada ramo se monta a mano en la tienda, con la flor que entra esa semana. Elige uno o dinos cuánto quieres gastar y lo preparamos a tu gusto.',
  },
  {
    id: 'rosas',
    slug: 'rosas',
    nombre: 'Rosas',
    titulo: 'Ramos de rosas en Toledo',
    descripcion:
      'Rosas rojas y de colores, sueltas o en ramo, preparadas en el Polígono de Toledo. Con tarjeta y dedicatoria si quieres.',
    intro:
      'Una rosa, media docena o el ramo grande. Las preparamos con su verde y, si quieres, con una tarjeta escrita a mano con tu dedicatoria.',
  },
  {
    id: 'plantas',
    slug: 'plantas',
    nombre: 'Plantas',
    titulo: 'Plantas de interior y de temporada en Toledo',
    descripcion:
      'Orquídeas, plantas verdes de interior y plantas de temporada en el Polígono de Toledo. Para regalar o para casa, con reparto en Toledo.',
    intro:
      'Una planta dura mucho más que un ramo y casi siempre acierta. Te decimos dónde ponerla y cada cuánto regarla.',
  },
  {
    id: 'centros',
    slug: 'centros-de-flores',
    nombre: 'Centros y cestas',
    titulo: 'Centros de flores y cestas en Toledo',
    descripcion:
      'Centros de flor natural, cestas y cajas de flores montados a mano en el Polígono de Toledo. Llegan listos para poner en la mesa.',
    intro:
      'Los centros van montados en su base, con agua, y no hace falta jarrón: se colocan tal cual llegan. Buena opción para una mesa, una oficina o una habitación de hospital.',
  },
  {
    id: 'condolencias',
    slug: 'coronas-y-condolencias',
    nombre: 'Coronas y condolencias',
    titulo: 'Coronas y centros de condolencias en Toledo',
    descripcion:
      'Coronas, centros y ramos de condolencias preparados en Toledo, con cinta y dedicatoria. También centros para lápida y nicho.',
    intro:
      'Preparamos coronas, centros y ramos para despedir a un ser querido, y centros para la lápida o el nicho. Si tienes prisa o dudas, es mejor que nos llames.',
    sobrio: true,
  },
  {
    id: 'complementos',
    slug: 'complementos',
    nombre: 'Complementos',
    titulo: 'Complementos para tu ramo',
    descripcion: 'Jarrones y detalles para acompañar tu ramo o tu planta.',
    intro: 'Un detalle para acompañar las flores.',
  },
];

/* ------------------------------------------------------------------ */
/* Ocasiones                                                           */
/* ------------------------------------------------------------------ */

export const OCASIONES: Ocasion[] = [
  {
    id: 'cumpleanos',
    slug: 'cumpleanos',
    nombre: 'Cumpleaños',
    titulo: 'Flores para un cumpleaños en Toledo',
    descripcion:
      'Ramos, plantas y centros para felicitar un cumpleaños, hechos a mano en el Polígono de Toledo. Con tarjeta y reparto a domicilio en Toledo.',
    intro:
      'Colores alegres y una tarjeta con tu felicitación. Si sabes cuáles son sus flores o sus colores, dínoslo en el pedido.',
  },
  {
    id: 'amor',
    slug: 'amor-y-aniversario',
    nombre: 'Amor y aniversario',
    titulo: 'Flores para un aniversario o para decir «te quiero»',
    descripcion:
      'Rosas rojas y ramos para un aniversario, San Valentín o porque sí. Preparados en el Polígono de Toledo, con reparto en Toledo.',
    intro: 'Las rosas rojas no fallan, pero no son lo único. Elige y escribe la dedicatoria: la tarjeta va a mano.',
  },
  {
    id: 'nacimiento',
    slug: 'nacimiento',
    nombre: 'Nacimiento',
    titulo: 'Flores para un nacimiento en Toledo',
    descripcion:
      'Ramos y plantas para dar la enhorabuena por un nacimiento. Se los llevamos a casa en Toledo o al Hospital Universitario de Toledo.',
    intro:
      'Para dar la enhorabuena a la familia. Si siguen en el hospital, se lo llevamos allí: estamos en el mismo barrio.',
  },
  {
    id: 'gracias',
    slug: 'para-dar-las-gracias',
    nombre: 'Para dar las gracias',
    titulo: 'Flores y plantas para dar las gracias',
    descripcion:
      'Un ramo o una planta para dar las gracias a quien te ha ayudado. Hechos a mano en el Polígono de Toledo.',
    intro: 'A una profesora, a una vecina, a quien te cuidó. Un detalle sencillo con una tarjeta lo dice todo.',
  },
  {
    id: 'animo',
    slug: 'para-dar-animo',
    nombre: 'Para dar ánimo',
    titulo: 'Flores y plantas para dar ánimo',
    descripcion:
      'Ramos y plantas para acompañar a alguien que lo necesita, en casa o en el Hospital Universitario de Toledo.',
    intro: 'Para que sepa que te acuerdas. Si está ingresado en el Hospital Universitario, se lo llevamos allí.',
  },
  {
    id: 'navidad',
    slug: 'navidad',
    nombre: 'Navidad',
    titulo: 'Flor de pascua y centros de Navidad en Toledo',
    descripcion:
      'Flor de pascua y centros de mesa de Navidad preparados en el Polígono de Toledo. Recógelos en la tienda o te los llevamos a casa.',
    intro: 'La flor de pascua para casa y el centro para la mesa de Nochebuena. Encárgalo con tiempo y lo tienes listo.',
  },
];

/* ------------------------------------------------------------------ */
/* Productos                                                           */
/* ------------------------------------------------------------------ */

const NOTA_TEMPORADA =
  'Trabajamos con flor fresca de temporada, así que alguna flor puede cambiar por otra parecida. El ramo será del mismo estilo y tamaño que el de la foto.';

const P = {
  rosa: '#D9488B', rosaClaro: '#F2A7C3', rojo: '#C4283C', naranja: '#EE7D2B', amarillo: '#F2C230',
  blanco: '#FFFDF7', crema: '#F6E7C8', lila: '#9C7BD0', morado: '#6B4FB3', melocoton: '#F4B183',
  azul: '#8FB7E8', verde: '#4F8A4B',
};

export const PRODUCTOS: Producto[] = [
  /* ---------------- Ramos ---------------- */
  {
    id: 'ramo-variado-de-temporada',
    nombre: 'Ramo variado de temporada',
    categoria: 'ramos',
    ocasiones: ['cumpleanos', 'gracias', 'animo'],
    resumen: 'Ramo de flor fresca para llevar en mano: gerbera, margarita y verde.',
    descripcion: [
      'El ramo de siempre: flor variada de temporada, con su verde, atado a mano y envuelto para regalar.',
      NOTA_TEMPORADA,
    ],
    detalles: ['Flor fresca de temporada', 'Atado a mano y envuelto', 'Tarjeta con tu dedicatoria, si quieres'],
    variantes: [
      { id: 'mediano', nombre: 'Mediano', precio: 30 },
      { id: 'grande', nombre: 'Grande', precio: 45 },
    ],
    fotos: ['ramo'],
    fotoAlt: 'Ramo variado con gerbera rosa, lilium y margaritas blancas, sujeto en la mano',
    ilustracion: { forma: 'ramo', flor: 'mixta', colores: [P.rosa, P.blanco, P.lila] },
    destacado: true,
    ejemplo: false,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'ramo-de-margaritas-y-gerberas',
    nombre: 'Ramo de margaritas y gerberas',
    categoria: 'ramos',
    ocasiones: ['cumpleanos', 'animo', 'nacimiento', 'gracias'],
    resumen: 'Margaritas blancas y gerberas rosas con verde fino. Alegre y sin perfume fuerte.',
    descripcion: [
      'Un ramo luminoso, de tonos blancos y rosas. Casi no huele, así que va bien para una habitación pequeña o para el hospital.',
      NOTA_TEMPORADA,
    ],
    detalles: ['Margarita, gerbera y verde', 'Perfume suave', 'Tarjeta con tu dedicatoria, si quieres'],
    precio: 35,
    fotos: ['ramo-hospital'],
    fotoAlt: 'Ramo de margaritas blancas, gerberas rosas y astilbe',
    ilustracion: { forma: 'ramo', flor: 'margarita', colores: [P.blanco, P.rosa, P.rosaClaro] },
    destacado: true,
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'ramo-de-girasoles',
    nombre: 'Ramo de girasoles',
    categoria: 'ramos',
    ocasiones: ['cumpleanos', 'gracias', 'animo'],
    resumen: 'Girasoles con verde. El ramo más alegre del verano.',
    descripcion: [
      'Cinco girasoles grandes con su verde. Aguantan bien en jarrón si les cambias el agua cada dos días.',
    ],
    detalles: ['5 girasoles', 'De mayo a octubre'],
    precio: 30,
    fotos: [],
    ilustracion: { forma: 'ramo', flor: 'girasol', colores: [P.amarillo, P.naranja] },
    temporada: { desde: '05-01', hasta: '10-15', texto: 'De mayo a octubre' },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'ramo-de-liliums',
    nombre: 'Ramo de liliums',
    categoria: 'ramos',
    ocasiones: ['cumpleanos', 'gracias'],
    resumen: 'Liliums que se van abriendo en casa. Dura más de una semana.',
    descripcion: [
      'Los liliums llegan con capullos cerrados y se abren poco a poco, así el ramo dura. Tienen un perfume intenso: mejor para un salón que para un dormitorio.',
    ],
    detalles: ['Liliums con verde', 'Perfume intenso', 'No recomendado para el hospital'],
    precio: 32,
    fotos: [],
    ilustracion: { forma: 'ramo', flor: 'lirio', colores: [P.rosaClaro, P.blanco] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
    hospital: false,
  },
  {
    id: 'ramo-de-tulipanes',
    nombre: 'Ramo de tulipanes',
    categoria: 'ramos',
    ocasiones: ['cumpleanos', 'amor', 'gracias'],
    resumen: 'Diez tulipanes del color que haya esa semana. Solo en su temporada.',
    descripcion: [
      'Diez tulipanes con sus hojas. Dinos si prefieres un color y te decimos cuáles han entrado.',
    ],
    detalles: ['10 tulipanes', 'De enero a abril'],
    precio: 28,
    fotos: [],
    ilustracion: { forma: 'ramo', flor: 'tulipan', colores: [P.rosa, P.amarillo, P.naranja] },
    temporada: { desde: '01-10', hasta: '04-30', texto: 'De enero a abril' },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'ramo-silvestre',
    nombre: 'Ramo silvestre',
    categoria: 'ramos',
    ocasiones: ['cumpleanos', 'gracias', 'amor'],
    resumen: 'Flor pequeña y verdes sueltos, como recién cogido del campo.',
    descripcion: [
      'Un ramo desenfadado, con flor pequeña, espigas y verdes variados. Cada uno sale distinto.',
      NOTA_TEMPORADA,
    ],
    precio: 35,
    fotos: [],
    ilustracion: { forma: 'ramo', flor: 'espiga', colores: [P.lila, P.blanco, P.amarillo] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'ramo-de-flor-seca',
    nombre: 'Ramo de flor seca',
    categoria: 'ramos',
    ocasiones: ['cumpleanos', 'gracias'],
    resumen: 'No necesita agua y dura meses. Para quien no quiere estar pendiente.',
    descripcion: [
      'Flor seca y preservada en tonos suaves. Se coloca en un jarrón sin agua, lejos del sol directo, y dura meses.',
    ],
    detalles: ['Sin agua', 'Dura meses'],
    precio: 38,
    fotos: [],
    ilustracion: { forma: 'ramo', flor: 'espiga', colores: [P.crema, P.melocoton, P.rosaClaro] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'ramo-a-tu-medida',
    nombre: 'Ramo a tu medida',
    categoria: 'ramos',
    ocasiones: ['cumpleanos', 'amor', 'nacimiento', 'gracias', 'animo'],
    resumen: 'Tú dices cuánto quieres gastar y lo preparamos a tu gusto.',
    descripcion: [
      'Dinos el importe y, si quieres, los colores o las flores que le gustan. Elegimos la mejor flor que haya ese día y montamos el ramo a mano.',
      'Es lo que más nos piden en el mostrador: así el ramo siempre sale con flor fresca y a tu presupuesto.',
    ],
    detalles: ['Tú eliges el importe', 'Con la flor más fresca del día', 'Tarjeta con tu dedicatoria, si quieres'],
    aMedida: true,
    fotos: ['centro-lilium'],
    fotoAlt: 'Composición de lilium, hortensia y rosas recién montada en la tienda',
    ilustracion: { forma: 'ramo', flor: 'mixta', colores: [P.rosa, P.amarillo, P.lila, P.blanco] },
    destacado: true,
    ejemplo: false,
    precioConfirmado: false,
    iva: 'flores',
  },

  /* ---------------- Rosas ---------------- */
  {
    id: 'ramo-de-rosas-rojas',
    nombre: 'Ramo de rosas rojas',
    categoria: 'rosas',
    ocasiones: ['amor', 'cumpleanos'],
    resumen: 'Rosas rojas de tallo largo con su verde. El clásico.',
    descripcion: [
      'Rosas rojas de tallo largo, con verde y paniculata, atadas a mano y envueltas para regalar.',
      'Si lo quieres para San Valentín o el Día de la Madre, encárgalo con unos días de margen.',
    ],
    detalles: ['Rosa de tallo largo', 'Con verde y paniculata', 'Tarjeta con tu dedicatoria, si quieres'],
    variantes: [
      { id: '6', nombre: '6 rosas', precio: 28 },
      { id: '12', nombre: '12 rosas', precio: 50 },
      { id: '24', nombre: '24 rosas', precio: 95 },
    ],
    fotos: [],
    ilustracion: { forma: 'ramo', flor: 'rosa', colores: [P.rojo] },
    destacado: true,
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'ramo-de-rosas-de-colores',
    nombre: 'Ramo de rosas de colores',
    categoria: 'rosas',
    ocasiones: ['cumpleanos', 'gracias', 'nacimiento', 'amor'],
    resumen: 'Rosas rosas, blancas, amarillas o mezcladas. Tú eliges el tono.',
    descripcion: [
      'Rosas del color que prefieras, según lo que haya esa semana. Indícalo en las observaciones del pedido.',
    ],
    variantes: [
      { id: '6', nombre: '6 rosas', precio: 26 },
      { id: '12', nombre: '12 rosas', precio: 46 },
    ],
    fotos: [],
    ilustracion: { forma: 'ramo', flor: 'rosa', colores: [P.rosaClaro, P.amarillo, P.blanco, P.melocoton] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'rosa-suelta',
    nombre: 'Una rosa',
    categoria: 'rosas',
    ocasiones: ['amor', 'gracias'],
    resumen: 'Una rosa de tallo largo, con su verde y envuelta.',
    descripcion: ['A veces basta con una. Va con su verde, envuelta y con tarjeta si quieres.'],
    precio: 6,
    fotos: [],
    ilustracion: { forma: 'tallo', flor: 'rosa', colores: [P.rojo] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'rosa-eterna',
    nombre: 'Rosa eterna en cúpula',
    categoria: 'rosas',
    ocasiones: ['amor', 'cumpleanos'],
    resumen: 'Rosa preservada bajo una cúpula de cristal. No necesita agua.',
    descripcion: [
      'Una rosa natural preservada, dentro de una cúpula de cristal. No se riega y se conserva durante años lejos del sol directo.',
    ],
    detalles: ['Rosa natural preservada', 'Sin agua ni cuidados'],
    precio: 35,
    fotos: [],
    ilustracion: { forma: 'cupula', flor: 'rosa', colores: [P.rojo] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },

  /* ---------------- Plantas ---------------- */
  {
    id: 'orquidea',
    nombre: 'Orquídea',
    categoria: 'plantas',
    ocasiones: ['cumpleanos', 'gracias', 'animo', 'nacimiento'],
    resumen: 'Orquídea de dos varas. Florece durante semanas y vuelve a hacerlo.',
    descripcion: [
      'Orquídea phalaenopsis de dos varas, en blanco o en rosa según lo que haya. Es de las plantas más agradecidas: luz sin sol directo y un riego a la semana.',
    ],
    detalles: ['Dos varas en flor', 'Riego: una vez por semana', 'Luz sin sol directo'],
    variantes: [
      { id: 'maceta', nombre: 'En su maceta', precio: 28 },
      { id: 'ceramica', nombre: 'Con macetero de cerámica', precio: 36 },
    ],
    fotos: [],
    ilustracion: { forma: 'maceta', flor: 'orquidea', colores: [P.blanco, P.rosa] },
    destacado: true,
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'anturio',
    nombre: 'Anturio',
    categoria: 'plantas',
    ocasiones: ['cumpleanos', 'gracias', 'animo'],
    resumen: 'Hojas brillantes y flores rojas casi todo el año.',
    descripcion: [
      'Planta de interior resistente, con flores rojas que duran semanas. Le gusta la luz y la tierra un poco húmeda.',
    ],
    detalles: ['Interior con buena luz', 'Riego: cuando la tierra esté seca por arriba'],
    precio: 24,
    fotos: [],
    ilustracion: { forma: 'maceta', flor: 'anturio', colores: [P.rojo] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'espatifilo',
    nombre: 'Espatifilo',
    categoria: 'plantas',
    ocasiones: ['gracias', 'animo'],
    resumen: 'La planta de las flores blancas. Aguanta con poca luz.',
    descripcion: [
      'Fácil de cuidar: cuando necesita agua, baja las hojas y con un riego se recupera. Va bien en sitios con poca luz.',
    ],
    detalles: ['Poca luz', 'Riego: una o dos veces por semana'],
    precio: 20,
    fotos: [],
    ilustracion: { forma: 'maceta', flor: 'anturio', colores: [P.blanco] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'kalanchoe',
    nombre: 'Kalanchoe',
    categoria: 'plantas',
    ocasiones: ['gracias', 'cumpleanos'],
    resumen: 'Pequeña, con mucha flor y muy poco riego.',
    descripcion: [
      'Un detalle pequeño que dura. Es una planta crasa: riégala poco y ponla donde le dé la luz.',
    ],
    detalles: ['Mucha luz', 'Riego: cada diez días'],
    precio: 8,
    fotos: [],
    ilustracion: { forma: 'maceta', flor: 'mixta', colores: [P.naranja, P.rosa, P.amarillo] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'planta-verde-de-interior',
    nombre: 'Planta verde de interior',
    categoria: 'plantas',
    ocasiones: ['gracias', 'cumpleanos'],
    resumen: 'Poto, ficus, sansevieria… la que mejor vaya para tu casa.',
    descripcion: [
      'Dinos dónde va a estar (más o menos luz, mucha o poca calefacción) y elegimos la planta que mejor lo lleve.',
    ],
    variantes: [
      { id: 'pequena', nombre: 'Pequeña', precio: 14 },
      { id: 'grande', nombre: 'Grande', precio: 34 },
    ],
    fotos: [],
    ilustracion: { forma: 'maceta', flor: 'hojas', colores: [P.verde] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'suculentas',
    nombre: 'Composición de suculentas',
    categoria: 'plantas',
    ocasiones: ['gracias', 'cumpleanos'],
    resumen: 'Varias suculentas en una maceta. Casi no hay que regarlas.',
    descripcion: [
      'Una maceta con varias suculentas distintas. Mucha luz y un riego cada dos o tres semanas.',
    ],
    precio: 18,
    fotos: [],
    ilustracion: { forma: 'maceta', flor: 'suculenta', colores: ['#7FB08A', '#A9C7A0', P.rosaClaro] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'crisantemo-en-maceta',
    nombre: 'Crisantemo en maceta',
    categoria: 'plantas',
    ocasiones: [],
    resumen: 'La planta de Todos los Santos: aguanta semanas al aire libre. En blanco, amarillo o morado.',
    descripcion: [
      'Crisantemo de bola, cuajado de flor. Aguanta bien el frío, así que va igual de bien en el cementerio que en un balcón.',
    ],
    detalles: ['Exterior', 'En blanco, amarillo o morado, según haya'],
    precio: 12,
    fotos: ['crisantemo-maceta'],
    fotoAlt: 'Crisantemo blanco de bola, cuajado de flores pequeñas',
    ilustracion: { forma: 'maceta', flor: 'margarita', colores: [P.blanco, P.amarillo] },
    temporada: { desde: '10-01', hasta: '11-30', texto: 'En otoño' },
    ejemplo: false,
    precioConfirmado: false,
    iva: 'flores',
    hospital: false,
  },
  {
    id: 'jardinera-de-temporada',
    nombre: 'Jardinera de temporada',
    categoria: 'plantas',
    ocasiones: ['gracias'],
    resumen: 'Brezo, ciclamen, crisantemo y una pequeña conífera, para jardinera o maceta grande.',
    descripcion: [
      'Una composición de plantas de exterior ya montada, lista para poner en la terraza, en la entrada de casa o en el cementerio. Las plantas cambian con la estación.',
    ],
    detalles: ['Exterior', 'Las plantas cambian según la temporada'],
    precio: 30,
    fotos: ['jardinera'],
    fotoAlt: 'Jardinera con brezo morado, ciclamen rojo, crisantemo amarillo y una conífera pequeña',
    ilustracion: { forma: 'maceta', flor: 'mixta', colores: [P.morado, P.rojo, P.amarillo] },
    ejemplo: false,
    precioConfirmado: false,
    iva: 'flores',
    hospital: false,
  },
  {
    id: 'flor-de-pascua',
    nombre: 'Flor de pascua',
    categoria: 'plantas',
    ocasiones: ['navidad'],
    resumen: 'La planta de la Navidad. Lejos de corrientes, llega a Reyes sin problema.',
    descripcion: [
      'Ponla en un sitio con luz y sin corrientes, y riégala por abajo cuando la tierra esté seca. No le gusta el frío de la calle.',
    ],
    variantes: [
      { id: 'pequena', nombre: 'Pequeña', precio: 7 },
      { id: 'grande', nombre: 'Grande', precio: 14 },
    ],
    fotos: [],
    ilustracion: { forma: 'maceta', flor: 'pascua', colores: [P.rojo] },
    temporada: { desde: '11-15', hasta: '01-06', texto: 'De mediados de noviembre a Reyes' },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'ciclamen',
    nombre: 'Ciclamen',
    categoria: 'plantas',
    ocasiones: ['gracias'],
    resumen: 'Flor de invierno para el balcón o una ventana fresca.',
    descripcion: [
      'Florece cuando casi nada lo hace. Le gusta el fresco: mejor en una ventana o en el balcón que junto al radiador.',
    ],
    precio: 7,
    fotos: [],
    ilustracion: { forma: 'maceta', flor: 'tulipan', colores: [P.rosa, P.rojo] },
    temporada: { desde: '10-01', hasta: '03-15', texto: 'De otoño a primavera' },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },

  /* ---------------- Centros y cestas ---------------- */
  {
    id: 'centro-de-flor-natural',
    nombre: 'Centro de flor natural',
    categoria: 'centros',
    ocasiones: ['cumpleanos', 'gracias', 'animo', 'nacimiento'],
    resumen: 'Gerberas, crisantemos y claveles en tonos alegres, montado a mano en la tienda.',
    descripcion: [
      'Va montado en su base, con agua, así que no hace falta jarrón: se coloca tal cual llega. Para mantenerlo, añade un poco de agua cada dos días.',
      NOTA_TEMPORADA,
    ],
    detalles: ['Montado en su base', 'No necesita jarrón'],
    variantes: [
      { id: 'mediano', nombre: 'Mediano', precio: 40 },
      { id: 'grande', nombre: 'Grande', precio: 60 },
    ],
    fotos: ['centro-natural', 'centro-gerberas'],
    fotoAlt: 'Centro de gerberas naranjas y rosas, crisantemos y claveles con un lazo rosa',
    ilustracion: { forma: 'centro', flor: 'mixta', colores: [P.naranja, P.rosa, P.amarillo] },
    destacado: true,
    ejemplo: false,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'cesta-de-flores',
    nombre: 'Cesta de flores',
    categoria: 'centros',
    ocasiones: ['cumpleanos', 'gracias', 'nacimiento'],
    resumen: 'Flor variada en una cesta de mimbre con asa.',
    descripcion: [
      'Una cesta de mimbre con flor fresca variada. Fácil de llevar y de colocar en cualquier sitio.',
      NOTA_TEMPORADA,
    ],
    precio: 45,
    fotos: [],
    ilustracion: { forma: 'cesta', flor: 'mixta', colores: [P.rosa, P.amarillo, P.blanco] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'caja-de-flores',
    nombre: 'Caja de flores',
    categoria: 'centros',
    ocasiones: ['amor', 'cumpleanos', 'gracias'],
    resumen: 'Rosas y flor fina en una caja redonda. Llega lista para poner.',
    descripcion: [
      'Flores montadas en una caja redonda de regalo. No necesita jarrón: solo un poco de agua cada dos días.',
    ],
    precio: 42,
    fotos: [],
    ilustracion: { forma: 'caja', flor: 'rosa', colores: [P.rosaClaro, P.rosa, P.blanco] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'ramo-para-recien-nacido',
    nombre: 'Ramo para un recién nacido',
    categoria: 'ramos',
    ocasiones: ['nacimiento'],
    resumen: 'Tonos suaves y poco perfume, para dar la enhorabuena.',
    descripcion: [
      'Flor en tonos suaves, rosa, azul o neutros: indícalo en las observaciones. Usamos flores de perfume suave, pensando en el bebé.',
      'Si la familia sigue en el Hospital Universitario, se lo llevamos allí.',
    ],
    precio: 35,
    fotos: [],
    ilustracion: { forma: 'ramo', flor: 'mixta', colores: [P.rosaClaro, P.azul, P.blanco] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'centro-de-mesa-de-navidad',
    nombre: 'Centro de mesa de Navidad',
    categoria: 'centros',
    ocasiones: ['navidad'],
    resumen: 'Abeto, piñas y flor roja para la mesa de Nochebuena.',
    descripcion: [
      'Un centro bajo, para que no estorbe en la mesa, con verde de abeto, piñas y flor roja. Dura todas las fiestas.',
    ],
    precio: 35,
    fotos: [],
    ilustracion: { forma: 'centro', flor: 'pascua', colores: [P.rojo, P.crema] },
    temporada: { desde: '12-01', hasta: '01-06', texto: 'De diciembre a Reyes' },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
  },
  {
    id: 'centro-de-flor-artificial',
    nombre: 'Centro de flor artificial',
    categoria: 'centros',
    ocasiones: [],
    resumen: 'Centros de flor artificial que tenemos en tienda. Aguantan meses sin estropearse.',
    descripcion: [
      'Muchos clientes los eligen para el nicho o la lápida, porque aguantan meses al aire libre. También quedan bien en casa.',
      'Elige el que te guste y dinos el número: te confirmamos precio y disponibilidad.',
    ],
    precio: null,
    modelos: ['modelo-1', 'modelo-2', 'modelo-3', 'modelo-4', 'modelo-5', 'modelo-6', 'modelo-7', 'modelo-8'],
    fotos: ['modelo-1'],
    fotoAlt: 'Centro de flor artificial con rosas y liliums en tonos crema',
    ilustracion: { forma: 'centro', flor: 'rosa', colores: [P.crema, P.rosaClaro] },
    ejemplo: false,
    precioConfirmado: false,
    iva: 'complementos',
    hospital: false,
  },

  /* ---------------- Coronas y condolencias ---------------- */
  {
    id: 'corona-funeraria',
    nombre: 'Corona',
    categoria: 'condolencias',
    ocasiones: [],
    resumen: 'Corona redonda de rosas, anturios y flor variada. Con cinta y dedicatoria si lo pides.',
    descripcion: [
      'Corona de flor natural montada sobre su caballete. Escribe en el pedido el texto de la cinta.',
      'Si es para hoy o para mañana, llámanos: así confirmamos la hora y el lugar de entrega.',
    ],
    detalles: ['Flor natural', 'Con cinta y dedicatoria, si lo pides'],
    variantes: [
      { id: 'estandar', nombre: 'Estándar', precio: 90 },
      { id: 'grande', nombre: 'Grande', precio: 130 },
    ],
    fotos: ['corona'],
    fotoAlt: 'Corona redonda de rosas lilas y blancas, anturios y flor variada',
    ilustracion: { forma: 'corona', flor: 'rosa', colores: [P.blanco, P.lila, P.rosaClaro] },
    ejemplo: false,
    precioConfirmado: false,
    iva: 'flores',
    hospital: false,
  },
  {
    id: 'centro-de-condolencias',
    nombre: 'Centro de condolencias',
    categoria: 'condolencias',
    ocasiones: [],
    resumen: 'Centro de flor natural en tonos blancos, con tarjeta o cinta.',
    descripcion: [
      'Un centro de flor natural en tonos blancos y verdes. Escribe en el pedido el texto de la tarjeta o de la cinta.',
    ],
    detalles: ['Flor natural', 'Tarjeta o cinta con dedicatoria'],
    precio: 60,
    fotos: [],
    ilustracion: { forma: 'centro', flor: 'lirio', colores: [P.blanco, P.crema] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
    hospital: false,
  },
  {
    id: 'ramo-de-condolencias',
    nombre: 'Ramo de condolencias',
    categoria: 'condolencias',
    ocasiones: [],
    resumen: 'Ramo alargado de flor blanca, para acompañar a la familia.',
    descripcion: [
      'Ramo de mano alargado, de flor blanca y verde. Va con una tarjeta con tu mensaje.',
    ],
    precio: 50,
    fotos: [],
    ilustracion: { forma: 'ramo', flor: 'lirio', colores: [P.blanco] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'flores',
    hospital: false,
  },
  {
    id: 'centro-para-lapida',
    nombre: 'Centro para lápida o nicho',
    categoria: 'condolencias',
    ocasiones: [],
    resumen: 'Centro bajo de claveles rojos y blancos, el clásico para la lápida.',
    descripcion: [
      'Centro bajo, pensado para la lápida o el nicho. Dinos si lo prefieres de flor natural o de flor artificial, que aguanta meses.',
    ],
    precio: 35,
    fotos: ['centro-lapida'],
    fotoAlt: 'Centro bajo de claveles rojos y blancos',
    ilustracion: { forma: 'centro', flor: 'clavel', colores: [P.rojo, P.blanco] },
    ejemplo: false,
    precioConfirmado: false,
    iva: 'flores',
    hospital: false,
  },

  /* ---------------- Complementos ---------------- */
  {
    id: 'jarron-de-cristal',
    nombre: 'Jarrón de cristal',
    categoria: 'complementos',
    ocasiones: [],
    resumen: 'Para que el ramo llegue listo para poner.',
    descripcion: ['Jarrón de cristal liso, del tamaño adecuado para el ramo.'],
    precio: 9,
    fotos: [],
    ilustracion: { forma: 'objeto', flor: 'jarron', colores: ['#BFD8E6'] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'complementos',
  },
  {
    id: 'caja-de-bombones',
    nombre: 'Caja de bombones',
    categoria: 'complementos',
    ocasiones: [],
    resumen: 'Un dulce para acompañar las flores.',
    descripcion: ['Caja pequeña de bombones para acompañar el ramo.'],
    precio: 8,
    fotos: [],
    ilustracion: { forma: 'objeto', flor: 'bombones', colores: ['#7A4B2A'] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'complementos',
  },
  {
    id: 'peluche',
    nombre: 'Peluche',
    categoria: 'complementos',
    ocasiones: [],
    resumen: 'Un peluche pequeño, para un nacimiento o un cumpleaños.',
    descripcion: ['Peluche pequeño para acompañar las flores.'],
    precio: 12,
    fotos: [],
    ilustracion: { forma: 'objeto', flor: 'peluche', colores: ['#C9A27A'] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'complementos',
  },
  {
    id: 'globo',
    nombre: 'Globo',
    categoria: 'complementos',
    ocasiones: [],
    resumen: 'Globo de helio con mensaje: «Felicidades», «Es niña», «Es niño»…',
    descripcion: ['Globo de helio con mensaje. Dinos cuál quieres en las observaciones.'],
    precio: 4,
    fotos: [],
    ilustracion: { forma: 'objeto', flor: 'globo', colores: [P.rosa] },
    ejemplo: true,
    precioConfirmado: false,
    iva: 'complementos',
  },
];

/* ------------------------------------------------------------------ */
/* Consultas                                                           */
/* ------------------------------------------------------------------ */

export function categoriaPorId(id: CategoriaId): Categoria {
  return CATEGORIAS.find((c) => c.id === id)!;
}

export function productoPorId(id: string): Producto | undefined {
  return PRODUCTOS.find((p) => p.id === id);
}

/** Productos que se enseñan: en producción, solo los confirmados por Loli. */
export function productosVisibles(entorno: Entorno): Producto[] {
  return PRODUCTOS.filter((p) => entorno === 'pruebas' || !p.ejemplo);
}

/** Catálogo que se navega (sin los complementos, que se añaden en la cesta). */
export function productosDeTienda(entorno: Entorno): Producto[] {
  return productosVisibles(entorno).filter((p) => p.categoria !== 'complementos');
}

export function complementos(entorno: Entorno): Producto[] {
  return productosVisibles(entorno).filter((p) => p.categoria === 'complementos');
}

export function productosDeCategoria(id: CategoriaId, entorno: Entorno): Producto[] {
  return productosVisibles(entorno).filter((p) => p.categoria === id);
}

export function productosDeOcasion(id: OcasionId, entorno: Entorno): Producto[] {
  return productosDeTienda(entorno).filter((p) => p.ocasiones.includes(id));
}

/** ¿Se puede enseñar el precio? En producción, solo si está confirmado. */
export function preciosALaVista(p: Producto, entorno: Entorno): boolean {
  return entorno === 'pruebas' || p.precioConfirmado;
}

/** Precio en euros de un producto o de una de sus variantes; null si no se enseña o no tiene. */
export function precioDe(p: Producto, varianteId: string | null | undefined, entorno: Entorno): number | null {
  if (!preciosALaVista(p, entorno) || p.aMedida) return null;
  if (p.variantes?.length) {
    const v = p.variantes.find((x) => x.id === varianteId);
    return v ? v.precio : null;
  }
  return p.precio ?? null;
}

/** Precio más bajo que se puede enseñar («desde…»). */
export function precioDesde(p: Producto, entorno: Entorno): { precio: number | null; desde: boolean } {
  if (!preciosALaVista(p, entorno)) return { precio: null, desde: false };
  if (p.variantes?.length) {
    const precios = p.variantes.map((v) => v.precio).filter((x): x is number => typeof x === 'number');
    if (!precios.length) return { precio: null, desde: false };
    return { precio: Math.min(...precios), desde: new Set(precios).size > 1 };
  }
  return { precio: p.precio ?? null, desde: false };
}

/** ¿Se puede pagar en la web? (tiene precio a la vista, o es a medida con importes confirmados). */
export function esComprable(p: Producto, entorno: Entorno): boolean {
  if (!productosVisibles(entorno).includes(p)) return false;
  if (!preciosALaVista(p, entorno)) return false;
  if (p.aMedida) return true;
  if (p.variantes?.length) return p.variantes.some((v) => typeof v.precio === 'number');
  return typeof p.precio === 'number';
}

/**
 * Catálogo reducido para comprar: lo que se incrusta en la cesta y lo que usa la API
 * para recalcular importes. Los precios que no se pueden enseñar van a null.
 * En el ramo a medida, precio 0 = se puede pagar en la web con el importe que elija el cliente.
 */
export function catalogoCompra(entorno: Entorno): ProductoCompra[] {
  return productosVisibles(entorno).map((p) => {
    const ver = preciosALaVista(p, entorno);
    return {
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      precio: p.aMedida ? (ver ? 0 : null) : ver ? (p.precio ?? null) : null,
      variantes: (p.variantes ?? []).map((v) => ({ id: v.id, nombre: v.nombre, precio: ver ? v.precio : null })),
      aMedida: !!p.aMedida,
      modelos: p.modelos?.length ?? 0,
      iva: p.iva,
      hospital: p.hospital !== false,
      temporada: p.temporada ?? null,
    };
  });
}

/** ¿Está en temporada en esa fecha (AAAA-MM-DD)? Sin temporada = siempre. */
export function enTemporada(p: Producto, fecha: string): boolean {
  if (!p.temporada) return true;
  const md = fecha.slice(5);
  const { desde, hasta } = p.temporada;
  return desde <= hasta ? md >= desde && md <= hasta : md >= desde || md <= hasta;
}

export function rutaProducto(p: Producto | string): string {
  return `/tienda/${typeof p === 'string' ? p : p.id}/`;
}

export function rutaCategoria(c: Categoria | CategoriaId): string {
  const cat = typeof c === 'string' ? categoriaPorId(c) : c;
  return `/${cat.slug}/`;
}

export function rutaOcasion(o: Ocasion): string {
  return `/ocasiones/${o.slug}/`;
}

/*
 * El formato de los importes vive en formato.ts para que las páginas que se ejecutan en el
 * navegador puedan usarlo sin cargar el catálogo entero (que lleva precios de ejemplo).
 */
export { euros, eurosDeCentimos } from './formato.ts';
