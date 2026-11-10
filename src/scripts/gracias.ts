/* Página de confirmación: pregunta por el pedido y, si el pago aún no consta, espera y vuelve a preguntar. */

import { enlaceWhatsApp } from '../../compartido/negocio.ts';
import { vaciar } from './cesta.ts';
import { leerPedido, pintarPedido } from './vista-pedido.ts';
import type { PedidoCliente } from './vista-pedido.ts';

const CLAVE_FORMULARIO = 'floresloli.pedido.v1';
const INTENTOS = 20;
const ESPERA_MS = 3000;

const raiz = document.querySelector<HTMLElement>('[data-gracias]');
if (raiz) void iniciar(raiz);

async function iniciar(raiz: HTMLElement): Promise<void> {
  const parametros = new URLSearchParams(location.search);
  const ref = (parametros.get('ref') ?? '').toUpperCase();
  const token = parametros.get('t') ?? '';
  const bloque = (nombre: string) => raiz.querySelector<HTMLElement>(`[data-${nombre}]`)!;

  const mostrar = (nombre: 'cargando' | 'recibido' | 'esperando' | 'sin-pago' | 'no-encontrado') => {
    for (const n of ['cargando', 'recibido', 'esperando', 'sin-pago', 'no-encontrado']) bloque(n).hidden = n !== nombre;
    bloque(nombre).querySelector<HTMLElement>('h1')?.focus();
  };
  for (const e of raiz.querySelectorAll<HTMLElement>('[data-ref]')) e.textContent = ref;

  if (!/^[A-Z]\d{6}-[A-Z0-9]{4}$/.test(ref) || !token) return mostrar('no-encontrado');

  const recibido = (p: PedidoCliente) => {
    const esRecogida = p.entrega.metodo === 'recogida';
    bloque('entrada').textContent = p.pagado
      ? `Gracias, ${p.comprador}. Hemos recibido tu pedido y el pago. Lo preparamos para el ${p.entrega.fechaTexto}.`
      : `Gracias, ${p.comprador}. Hemos recibido tu pedido. Lo preparamos para el ${p.entrega.fechaTexto} y lo pagas al recogerlo.`;
    bloque('prueba').hidden = !p.prueba;
    bloque('paso-justificante').hidden = !p.pagado || p.prueba;
    bloque('paso-recogida').hidden = !esRecogida;
    bloque('paso-reparto').hidden = esRecogida;
    bloque('wa-pedido').setAttribute('href', enlaceWhatsApp(`Hola, tengo una consulta sobre mi pedido de la web ${p.ref}.`));
    pintarPedido(bloque('detalle'), p);
    mostrar('recibido');
    // El pedido está hecho: la cesta y el formulario ya no hacen falta.
    vaciar();
    try {
      sessionStorage.removeItem(CLAVE_FORMULARIO);
    } catch {
      /* nada */
    }
  };

  bloque('imprimir').addEventListener('click', () => window.print());

  for (let intento = 0; intento < INTENTOS; intento++) {
    let pedido: PedidoCliente | null;
    try {
      pedido = await leerPedido(ref, token);
    } catch {
      // Fallo de red o del servidor: se enseña la espera y se vuelve a probar.
      mostrar('esperando');
      await new Promise((r) => setTimeout(r, ESPERA_MS));
      continue;
    }
    if (!pedido) return mostrar('no-encontrado');
    if (pedido.estado === 'caducado' || (pedido.estado === 'cancelado' && !pedido.pagado)) return mostrar('sin-pago');
    if (pedido.estado !== 'pendiente_pago') return recibido(pedido);
    mostrar('esperando');
    await new Promise((r) => setTimeout(r, ESPERA_MS));
  }
}
