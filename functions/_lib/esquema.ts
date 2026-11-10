/* =====================================================================
   ESQUEMA DE LA BASE DE DATOS (Cloudflare D1, SQLite)

   La API crea y actualiza las tablas sola la primera vez que se usa:
   no hay que ejecutar nada a mano. Para cambiar el esquema, AÑADE una
   migración al final de MIGRACIONES (nunca edites las ya publicadas).
   ===================================================================== */

export const MIGRACIONES: string[][] = [
  /* 1 · Esquema inicial */
  [
    `CREATE TABLE pedidos (
      ref TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      creado TEXT NOT NULL,
      actualizado TEXT NOT NULL,
      entorno TEXT NOT NULL,
      origen TEXT NOT NULL DEFAULT 'web',
      estado TEXT NOT NULL,
      pago_estado TEXT NOT NULL DEFAULT 'pendiente',
      pago_metodo TEXT NOT NULL DEFAULT '',
      stripe_sesion TEXT NOT NULL DEFAULT '',
      stripe_pago TEXT NOT NULL DEFAULT '',
      entrega_metodo TEXT NOT NULL,
      entrega_fecha TEXT NOT NULL,
      entrega_nota TEXT NOT NULL DEFAULT '',
      comprador_nombre TEXT NOT NULL DEFAULT '',
      comprador_telefono TEXT NOT NULL DEFAULT '',
      comprador_email TEXT NOT NULL DEFAULT '',
      dest_nombre TEXT NOT NULL DEFAULT '',
      dest_telefono TEXT NOT NULL DEFAULT '',
      dest_direccion TEXT NOT NULL DEFAULT '',
      dest_cp TEXT NOT NULL DEFAULT '',
      dest_localidad TEXT NOT NULL DEFAULT '',
      dest_detalle TEXT NOT NULL DEFAULT '',
      dedicatoria TEXT NOT NULL DEFAULT '',
      observaciones TEXT NOT NULL DEFAULT '',
      nota_interna TEXT NOT NULL DEFAULT '',
      subtotal INTEGER NOT NULL DEFAULT 0,
      envio INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      iva TEXT NOT NULL DEFAULT '[]',
      acepto TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE INDEX pedidos_fecha ON pedidos (entrega_fecha)`,
    `CREATE INDEX pedidos_estado ON pedidos (estado)`,
    `CREATE INDEX pedidos_stripe ON pedidos (stripe_sesion)`,
    `CREATE TABLE pedido_lineas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref TEXT NOT NULL,
      producto TEXT NOT NULL DEFAULT '',
      nombre TEXT NOT NULL,
      detalle TEXT NOT NULL DEFAULT '',
      cantidad INTEGER NOT NULL DEFAULT 1,
      precio_unidad INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      iva TEXT NOT NULL DEFAULT 'flores',
      nota TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE INDEX lineas_ref ON pedido_lineas (ref)`,
    `CREATE TABLE pedido_eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref TEXT NOT NULL,
      fecha TEXT NOT NULL,
      tipo TEXT NOT NULL,
      detalle TEXT NOT NULL DEFAULT '',
      autor TEXT NOT NULL DEFAULT 'sistema'
    )`,
    `CREATE INDEX eventos_ref ON pedido_eventos (ref)`,
    `CREATE TABLE dias (
      fecha TEXT PRIMARY KEY,
      estado TEXT,
      cupo INTEGER,
      nota TEXT NOT NULL DEFAULT '',
      actualizado TEXT NOT NULL
    )`,
    `CREATE TABLE presupuestos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref TEXT NOT NULL UNIQUE,
      creado TEXT NOT NULL,
      entorno TEXT NOT NULL,
      tipo TEXT NOT NULL,
      fecha_evento TEXT NOT NULL DEFAULT '',
      nombre TEXT NOT NULL,
      telefono TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      mensaje TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL DEFAULT 'nuevo',
      nota_interna TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE TABLE stripe_eventos (id TEXT PRIMARY KEY, tipo TEXT NOT NULL, recibido TEXT NOT NULL)`,
    `CREATE TABLE limites (clave TEXT PRIMARY KEY, n INTEGER NOT NULL, caduca INTEGER NOT NULL)`,
    `CREATE TABLE ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)`,
  ],
];

const comprobadas = new WeakMap<object, Promise<void>>();

async function migrar(db: D1Database): Promise<void> {
  await db.prepare('CREATE TABLE IF NOT EXISTS esquema (version INTEGER NOT NULL)').run();
  const fila = await db.prepare('SELECT MAX(version) AS v FROM esquema').first<{ v: number | null }>();
  const actual = fila?.v ?? 0;
  for (let i = actual; i < MIGRACIONES.length; i++) {
    const sentencias = MIGRACIONES[i].map((sql) => db.prepare(sql.replace(/\s+/g, ' ')));
    sentencias.push(db.prepare('INSERT INTO esquema (version) VALUES (?)').bind(i + 1));
    // batch() es una transacción: o entra la migración entera o no entra nada.
    await db.batch(sentencias);
  }
}

/** Deja la base de datos con el esquema al día. Se comprueba una vez por arranque del servidor. */
export function asegurarEsquema(db: D1Database): Promise<void> {
  let promesa = comprobadas.get(db);
  if (!promesa) {
    promesa = migrar(db).catch((error) => {
      comprobadas.delete(db);
      throw error;
    });
    comprobadas.set(db, promesa);
  }
  return promesa;
}
