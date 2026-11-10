/* =====================================================================
   ENTORNO Y ESTADO DE LA TIENDA

   La API decide sola en qué modo está, según lo que tenga configurado
   en Cloudflare (Settings › Variables and Secrets y Bindings):

   · Sin base de datos o sin pago configurado → la web sigue funcionando
     como catálogo y los encargos van por WhatsApp.
   · Entorno «pruebas» (ramas y vistas previas): productos y precios de
     ejemplo, pago simulado o Stripe en modo prueba. Nunca cobra de verdad.
   · Entorno «produccion» (rama main): solo productos y precios
     confirmados, y solo Stripe con claves reales.
   ===================================================================== */

import type { Entorno } from '../../compartido/catalogo.ts';

export interface Env {
  /** Base de datos D1 (binding «DB»). */
  DB?: D1Database;
  /** «pruebas» o «produccion». Si falta, se deduce de la rama de Cloudflare Pages. */
  ENTORNO?: string;
  CF_PAGES_BRANCH?: string;
  CF_PAGES_URL?: string;
  /** Clave secreta de Stripe (sk_test_… o sk_live_…). */
  STRIPE_SECRET_KEY?: string;
  /** Secreto de firma del webhook de Stripe (whsec_…). */
  STRIPE_WEBHOOK_SECRET?: string;
  /** Clave para entrar en el panel de pedidos. */
  PANEL_CLAVE?: string;
  /** Texto largo y aleatorio para firmar las sesiones del panel. */
  SECRETO_SESION?: string;
  /** Opcional: clave de Resend para mandar correos de aviso. */
  RESEND_API_KEY?: string;
  /** Opcional: remitente de los correos, p. ej. «Flores y Plantas Loli <pedidos@dominio.es>». */
  CORREO_REMITENTE?: string;
  /** Opcional: a qué correo llegan los avisos de pedido. Por defecto, el de la tienda. */
  CORREO_AVISOS?: string;
}

export function entornoDe(env: Env): Entorno {
  const explicito = (env.ENTORNO ?? '').trim().toLowerCase();
  if (explicito === 'pruebas' || explicito === 'produccion') return explicito;
  // En Cloudflare Pages, todo lo que no es la rama main es una vista previa.
  if (env.CF_PAGES_BRANCH && env.CF_PAGES_BRANCH !== 'main') return 'pruebas';
  // Ante la duda, lo estricto: nada de ejemplo ni pagos simulados.
  return 'produccion';
}

export type ModoStripe = 'test' | 'live' | null;

export function modoStripe(clave: string | undefined): ModoStripe {
  const c = (clave ?? '').trim();
  if (/^(sk|rk)_test_/.test(c)) return 'test';
  if (/^(sk|rk)_live_/.test(c)) return 'live';
  return null;
}

export interface EstadoTienda {
  entorno: Entorno;
  baseDatos: boolean;
  /** Cómo se cobra ahora mismo. null = no se puede cobrar en la web. */
  pago: 'stripe' | 'simulado' | null;
  stripe: ModoStripe;
  webhook: boolean;
  /** true = se puede comprar en la web. false = los encargos van por WhatsApp. */
  pedidosOnline: boolean;
  panel: boolean;
  correo: boolean;
  /** Explicaciones para el diagnóstico del panel. */
  motivos: string[];
}

export function estadoTienda(env: Env): EstadoTienda {
  const entorno = entornoDe(env);
  const stripe = modoStripe(env.STRIPE_SECRET_KEY);
  const webhook = /^whsec_/.test((env.STRIPE_WEBHOOK_SECRET ?? '').trim());
  const baseDatos = !!env.DB;
  const motivos: string[] = [];
  let pago: EstadoTienda['pago'] = null;

  if (entorno === 'produccion') {
    if (stripe === 'live' && webhook) pago = 'stripe';
    else if (stripe === 'live') motivos.push('Falta STRIPE_WEBHOOK_SECRET: sin él no se confirman los pagos.');
    else if (stripe === 'test') motivos.push('La clave de Stripe es de prueba (sk_test_). En producción hace falta la real (sk_live_).');
    else motivos.push('Falta STRIPE_SECRET_KEY.');
  } else {
    if (stripe === 'test') pago = 'stripe';
    else {
      pago = 'simulado';
      if (stripe === 'live') motivos.push('Hay una clave real de Stripe en un entorno de pruebas: se ignora y el pago es simulado.');
      else motivos.push('Sin clave de Stripe de prueba: el pago es simulado.');
    }
  }

  if (!baseDatos) motivos.push('Falta la base de datos (binding D1 con el nombre DB).');

  const panel = !!(env.PANEL_CLAVE && env.PANEL_CLAVE.length >= 8 && env.SECRETO_SESION && env.SECRETO_SESION.length >= 24);
  if (!panel) motivos.push('El panel no admite accesos: faltan PANEL_CLAVE (mínimo 8 caracteres) o SECRETO_SESION (mínimo 24).');

  const correo = !!(env.RESEND_API_KEY && env.CORREO_REMITENTE);
  if (!correo) motivos.push('Sin correo propio (RESEND_API_KEY y CORREO_REMITENTE): los avisos de pedido se ven en el panel y en los correos de Stripe.');

  return {
    entorno,
    baseDatos,
    pago,
    stripe,
    webhook,
    pedidosOnline: baseDatos && pago !== null,
    panel,
    correo,
    motivos,
  };
}
