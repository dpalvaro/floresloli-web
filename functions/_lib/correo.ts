/* =====================================================================
   CORREOS DE AVISO (opcional)

   Solo se envían si están configurados RESEND_API_KEY y CORREO_REMITENTE
   (hace falta un dominio propio verificado en Resend). Sin ellos la tienda
   funciona igual: Loli ve los pedidos en el panel y Stripe manda el
   justificante de pago al cliente y el aviso de cobro a la tienda.
   ===================================================================== */

import { eurosDeCentimos } from '../../compartido/catalogo.ts';
import { fechaLarga } from '../../compartido/fechas.ts';
import { NEGOCIO, direccionCompleta } from '../../compartido/negocio.ts';
import { nombreMetodo } from '../../compartido/tienda.ts';
import type { FilaLinea, FilaPedido } from './datos.ts';
import type { Env } from './entorno.ts';

interface Correo {
  para: string;
  asunto: string;
  texto: string;
  responderA?: string;
}

function aHtml(texto: string): string {
  const seguro = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<div style="font:16px/1.55 system-ui,-apple-system,'Segoe UI',sans-serif;color:#1F1B2E;max-width:560px">${seguro
    .split('\n\n')
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')}</div>`;
}

export async function enviarCorreo(env: Env, correo: Correo): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.CORREO_REMITENTE || !correo.para) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.CORREO_REMITENTE,
        to: [correo.para],
        subject: correo.asunto,
        text: correo.texto,
        html: aHtml(correo.texto),
        reply_to: correo.responderA,
      }),
    });
    if (!r.ok) console.error('Correo no enviado', r.status, await r.text().catch(() => ''));
    return r.ok;
  } catch (error) {
    console.error('Correo no enviado', error);
    return false;
  }
}

function lineasEnTexto(lineas: FilaLinea[]): string {
  return lineas
    .map((l) => `· ${l.cantidad} × ${l.nombre}${l.detalle ? ` (${l.detalle})` : ''}: ${eurosDeCentimos(l.total)}${l.nota ? `\n  Nota: ${l.nota}` : ''}`)
    .join('\n');
}

function entregaEnTexto(p: FilaPedido): string {
  const partes = [`${nombreMetodo(p.entrega_metodo)}, el ${fechaLarga(p.entrega_fecha)}`];
  if (p.entrega_nota) partes.push(`Indicaciones: ${p.entrega_nota}`);
  if (p.entrega_metodo === 'domicilio') {
    partes.push(`Para: ${p.dest_nombre}${p.dest_telefono ? ` (tel. ${p.dest_telefono})` : ''}`);
    partes.push(`Dirección: ${p.dest_direccion}, ${p.dest_cp} ${p.dest_localidad}`);
  }
  if (p.entrega_metodo === 'hospital') {
    partes.push(`Para: ${p.dest_nombre}`);
    if (p.dest_detalle) partes.push(`Planta y habitación: ${p.dest_detalle}`);
  }
  return partes.join('\n');
}

/** Aviso a la tienda y confirmación al cliente de un pedido ya pagado. */
export async function avisarPedido(env: Env, p: FilaPedido, lineas: FilaLinea[], origen: string): Promise<void> {
  const total = eurosDeCentimos(p.total);
  const prueba = p.entorno === 'pruebas' ? '[PRUEBA] ' : '';

  await enviarCorreo(env, {
    para: env.CORREO_AVISOS || NEGOCIO.correo,
    asunto: `${prueba}Pedido web ${p.ref} para el ${fechaLarga(p.entrega_fecha)} · ${total}`,
    responderA: p.comprador_email || undefined,
    texto: [
      `Pedido ${p.ref}, pagado en la web: ${total}.`,
      lineasEnTexto(lineas),
      entregaEnTexto(p),
      p.dedicatoria ? `Dedicatoria:\n${p.dedicatoria}` : '',
      p.observaciones ? `Observaciones:\n${p.observaciones}` : '',
      `Cliente: ${p.comprador_nombre} · ${p.comprador_telefono} · ${p.comprador_email}`,
      `Verlo en el panel: ${origen}/panel/#pedido=${p.ref}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
  });

  if (p.comprador_email) {
    await enviarCorreo(env, {
      para: p.comprador_email,
      asunto: `${prueba}Hemos recibido tu pedido ${p.ref} · ${NEGOCIO.nombre}`,
      responderA: NEGOCIO.correo,
      texto: [
        `Hola, ${p.comprador_nombre}:`,
        `Hemos recibido tu pedido ${p.ref} y el pago de ${total}. Lo preparamos para el ${fechaLarga(p.entrega_fecha)}.`,
        lineasEnTexto(lineas),
        entregaEnTexto(p),
        p.dedicatoria ? `Dedicatoria:\n${p.dedicatoria}` : '',
        `Si tienes que cambiar algo, llámanos al ${NEGOCIO.telefono} o escríbenos por WhatsApp al ${NEGOCIO.movil} con el número de pedido.`,
        `${NEGOCIO.nombre}\n${direccionCompleta()}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    });
  }
}

export async function avisarPresupuesto(
  env: Env,
  d: { ref: string; tipo: string; nombre: string; telefono: string; email: string; fecha: string; mensaje: string; entorno: string },
  origen: string,
): Promise<void> {
  await enviarCorreo(env, {
    para: env.CORREO_AVISOS || NEGOCIO.correo,
    asunto: `${d.entorno === 'pruebas' ? '[PRUEBA] ' : ''}Solicitud de presupuesto ${d.ref} (${d.tipo})`,
    responderA: d.email || undefined,
    texto: [
      `${d.nombre} pide presupuesto para: ${d.tipo}.`,
      d.fecha ? `Fecha del evento: ${fechaLarga(d.fecha)}` : '',
      d.mensaje,
      `Contacto: ${d.telefono}${d.email ? ` · ${d.email}` : ''}`,
      `Verlo en el panel: ${origen}/panel/#presupuestos`,
    ]
      .filter(Boolean)
      .join('\n\n'),
  });
}
