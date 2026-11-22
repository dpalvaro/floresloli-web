/* =====================================================================
   BASE DE DATOS EN EL SERVIDOR PROPIO

   La API se escribió para Cloudflare D1, que es SQLite. Aquí se ofrece la
   misma forma de uso (prepare, bind, first, all, run y batch) sobre un
   archivo SQLite, con el módulo node:sqlite que trae Node: sin dependencias.

   Solo está lo que usa la API. Lo demás falla con un error claro.
   ===================================================================== */

import { DatabaseSync } from 'node:sqlite';
import type { StatementSync } from 'node:sqlite';

type Valor = null | number | bigint | string | Uint8Array;
type Fila = Record<string, unknown>;

export interface MetaD1 {
  duration: number;
  changes: number;
  last_row_id: number;
  changed_db: boolean;
  rows_read: number;
  rows_written: number;
  size_after: number;
  served_by: string;
}

export interface ResultadoD1<T = Fila> {
  results: T[];
  success: true;
  meta: MetaD1;
}

/** Convierte un valor de bind() como lo hace D1. */
function convertir(v: unknown): Valor {
  if (v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint') return v;
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  throw new TypeError(`D1_TYPE_ERROR: bind() no admite ${v === undefined ? 'undefined' : typeof v}.`);
}

/** ¿La sentencia devuelve filas? (SELECT, WITH, PRAGMA de lectura, … RETURNING) */
function devuelveFilas(sentencia: StatementSync, sql: string): boolean {
  const s = sentencia as StatementSync & { columns?: () => unknown[] };
  if (typeof s.columns === 'function') return s.columns().length > 0;
  return /^\s*(select|with|pragma|values|explain)\b/i.test(sql) || /\breturning\b/i.test(sql);
}

function resultado<T>(filas: T[], cambios: number, ultimoId: number, inicio: number): ResultadoD1<T> {
  return {
    results: filas,
    success: true,
    meta: {
      duration: performance.now() - inicio,
      changes: cambios,
      last_row_id: ultimoId,
      changed_db: cambios > 0,
      rows_read: filas.length,
      rows_written: cambios,
      size_after: 0,
      served_by: 'servidor-propio',
    },
  };
}

export class SentenciaD1 {
  readonly #bd: BaseDatosD1;
  readonly sql: string;
  readonly #valores: Valor[];

  constructor(bd: BaseDatosD1, sql: string, valores: Valor[] = []) {
    this.#bd = bd;
    this.sql = sql;
    this.#valores = valores;
  }

  bind(...valores: unknown[]): SentenciaD1 {
    return new SentenciaD1(this.#bd, this.sql, valores.map(convertir));
  }

  async first<T = Fila>(columna?: string): Promise<T | null> {
    const fila = this.#bd.preparada(this.sql).get(...this.#valores) as Fila | undefined;
    if (!fila) return null;
    if (columna === undefined) return { ...fila } as T;
    if (!(columna in fila)) throw new Error(`D1_COLUMN_NOTFOUND: no hay columna «${columna}».`);
    return fila[columna] as T;
  }

  async all<T = Fila>(): Promise<ResultadoD1<T>> {
    return this.ejecutar<T>();
  }

  async run<T = Fila>(): Promise<ResultadoD1<T>> {
    return this.ejecutar<T>();
  }

  async raw<T = unknown[]>(opciones: { columnNames?: boolean } = {}): Promise<T[]> {
    const filas = this.#bd.preparada(this.sql).all(...this.#valores) as Fila[];
    const valores = filas.map((f) => Object.values(f)) as T[];
    if (!opciones.columnNames) return valores;
    const nombres = filas[0] ? Object.keys(filas[0]) : [];
    return [nombres as T, ...valores];
  }

  /** Ejecuta sin esperas (para que batch() sea una sola transacción). */
  ejecutar<T>(): ResultadoD1<T> {
    const inicio = performance.now();
    const sentencia = this.#bd.preparada(this.sql);
    if (devuelveFilas(sentencia, this.sql)) {
      const filas = (sentencia.all(...this.#valores) as Fila[]).map((f) => ({ ...f }) as T);
      return resultado(filas, 0, 0, inicio);
    }
    const r = sentencia.run(...this.#valores);
    return resultado<T>([], Number(r.changes), Number(r.lastInsertRowid), inicio);
  }
}

export class BaseDatosD1 {
  readonly #db: DatabaseSync;
  readonly #preparadas = new Map<string, StatementSync>();

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  /** Sentencia compilada, guardada para reutilizarla. */
  preparada(sql: string): StatementSync {
    let s = this.#preparadas.get(sql);
    if (!s) {
      s = this.#db.prepare(sql);
      if (this.#preparadas.size >= 500) this.#preparadas.clear();
      this.#preparadas.set(sql, s);
    }
    return s;
  }

  prepare(sql: string): SentenciaD1 {
    return new SentenciaD1(this, sql);
  }

  /** Como en D1: todas las sentencias en una transacción; si una falla, no se aplica ninguna. */
  async batch<T = Fila>(sentencias: SentenciaD1[]): Promise<ResultadoD1<T>[]> {
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const resultados = sentencias.map((s) => s.ejecutar<T>());
      this.#db.exec('COMMIT');
      return resultados;
    } catch (error) {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* la transacción ya estaba deshecha */
      }
      throw error;
    }
  }

  async exec(sql: string): Promise<{ count: number; duration: number }> {
    const inicio = performance.now();
    this.#db.exec(sql);
    return { count: sql.split(';').filter((t) => t.trim()).length, duration: performance.now() - inicio };
  }

  async dump(): Promise<ArrayBuffer> {
    throw new Error('dump() no está disponible en el servidor propio: las copias las hace floresloli-copia.');
  }

  cerrar(): void {
    this.#preparadas.clear();
    this.#db.close();
  }
}

/**
 * Abre (o crea) el archivo de la base de datos.
 * WAL: lecturas y escrituras a la vez, y copias en caliente sin parar la tienda.
 * synchronous = FULL: un pedido confirmado no se pierde aunque se vaya la luz.
 */
export function abrirBaseDatos(ruta: string): BaseDatosD1 {
  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = FULL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  return new BaseDatosD1(db);
}
