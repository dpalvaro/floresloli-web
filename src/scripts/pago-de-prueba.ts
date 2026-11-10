/* Pago simulado de las vistas de prueba: confirma o cancela el pedido sin dinero de por medio. */

import { leerPedido, pintarPedido } from './vista-pedido.ts';

const raiz = document.querySelector<HTMLElement>('[data-pago-prueba]');
if (raiz) void iniciar(raiz);

async function iniciar(raiz: HTMLElement): Promise<void> {
  const parametros = new URLSearchParams(location.search);
  const ref = (parametros.get('ref') ?? '').toUpperCase();
  const token = parametros.get('t') ?? '';
  const pagar = raiz.querySelector<HTMLButtonElement>('[data-pagar]')!;
  const cancelar = raiz.querySelector<HTMLButtonElement>('[data-cancelar]')!;
  const fallo = raiz.querySelector<HTMLElement>('[data-fallo]')!;
  raiz.querySelector('[data-ref]')!.textContent = ref;

  const avisar = (mensaje: string) => {
    fallo.textContent = mensaje;
    fallo.hidden = false;
  };

  try {
    const pedido = await leerPedido(ref, token);
    if (!pedido) return avisar('No encontramos ese pedido. Vuelve a la cesta e inténtalo de nuevo.');
    pintarPedido(raiz.querySelector<HTMLElement>('[data-detalle]')!, pedido);
    if (pedido.estado !== 'pendiente_pago') {
      location.replace(`/pedido/gracias/?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(token)}`);
      return;
    }
  } catch {
    return avisar('No se ha podido cargar el pedido. Recarga la página.');
  }

  const enviar = async (resultado: 'pagado' | 'cancelado') => {
    pagar.disabled = cancelar.disabled = true;
    try {
      const respuesta = await fetch('/api/pruebas/pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref, token, resultado }),
      });
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      location.assign(resultado === 'pagado' ? `/pedido/gracias/?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(token)}` : '/pedido/?cancelado=1');
    } catch {
      pagar.disabled = cancelar.disabled = false;
      avisar('No se ha podido simular el pago. Inténtalo de nuevo.');
    }
  };

  pagar.disabled = cancelar.disabled = false;
  pagar.addEventListener('click', () => void enviar('pagado'));
  cancelar.addEventListener('click', () => void enviar('cancelado'));
}
