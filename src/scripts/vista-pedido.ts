/* Pinta el resumen de un pedido (lo que devuelve /api/pedidos/<ref>) en las páginas de confirmación y de pago de prueba. */

import { eurosDeCentimos } from '../../compartido/formato.ts';

export interface PedidoCliente {
  ref: string;
  estado: string;
  estadoTexto: string;
  pagado: boolean;
  prueba: boolean;
  entrega: { metodo: string; nombre: string; fecha: string; fechaTexto: string; nota: string };
  destinatario: string;
  comprador: string;
  lineas: { nombre: string; detalle: string; cantidad: number; total: number }[];
  subtotal: number;
  envio: number;
  total: number;
  dedicatoria: string;
}

const crear = <K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase?: string, texto?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
};

export async function leerPedido(ref: string, token: string): Promise<PedidoCliente | null> {
  const respuesta = await fetch(`/api/pedidos/${encodeURIComponent(ref)}?t=${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } });
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw new Error(`Estado ${respuesta.status}`);
  return (await respuesta.json()) as PedidoCliente;
}

export function pintarPedido(contenedor: HTMLElement, p: PedidoCliente): void {
  const lista = crear('ul', 'pedido-lineas');
  for (const l of p.lineas) {
    const li = crear('li');
    li.append(crear('span', undefined, `${l.cantidad} × ${l.nombre}${l.detalle ? ` (${l.detalle})` : ''}`), crear('span', 'importe', eurosDeCentimos(l.total)));
    lista.append(li);
  }
  if (p.envio > 0) {
    const li = crear('li');
    li.append(crear('span', undefined, p.entrega.nombre), crear('span', 'importe', eurosDeCentimos(p.envio)));
    lista.append(li);
  }
  const total = crear('li', 'total');
  total.append(crear('span', undefined, 'Total (IVA incluido)'), crear('span', 'importe', eurosDeCentimos(p.total)));
  lista.append(total);

  const datos = crear('dl', 'datos');
  const dato = (titulo: string, texto: string) => {
    const fila = crear('div');
    fila.append(crear('dt', undefined, titulo), crear('dd', undefined, texto));
    datos.append(fila);
  };
  dato('Entrega', `${p.entrega.nombre}, el ${p.entrega.fechaTexto}`);
  if (p.destinatario) dato('Para', p.destinatario);
  if (p.dedicatoria) dato('Dedicatoria', p.dedicatoria);

  contenedor.replaceChildren(lista, datos);
}
