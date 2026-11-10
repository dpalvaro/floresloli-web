/* =====================================================================
   PRUEBA DE COMPRA COMPLETA: `npm run prueba:compra`

   Hace un pedido de principio a fin contra la tienda en local, sin
   navegador: disponibilidad, pedido, pago simulado, confirmación, panel,
   calendario, presupuesto y exportación.

   Antes, en otra terminal:  npm run local   (compila y arranca en el puerto 8788)
   Solo funciona en un entorno de PRUEBAS con pago simulado: contra la web
   pública se niega a seguir. Los pedidos que crea quedan marcados «Prueba».
   ===================================================================== */

import { readFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8788';
const clave = process.env.PANEL_CLAVE ?? /^PANEL_CLAVE=(.*)$/m.exec(readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8'))?.[1]?.trim();
// En local, el límite de intentos va por IP: cada ejecución usa una distinta para no chocar con la anterior.
const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
let cookie = '';
let fallos = 0;

const comprobar = (condicion, texto) => {
  console.log(`${condicion ? '✓' : '✗'} ${texto}`);
  if (!condicion) fallos++;
};

async function pedir(ruta, { metodo = 'GET', cuerpo } = {}) {
  const respuesta = await fetch(BASE + ruta, {
    method: metodo,
    headers: { 'CF-Connecting-IP': ip, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const galleta = respuesta.headers.get('set-cookie');
  if (galleta) cookie = galleta.split(';')[0];
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = JSON.parse(texto);
  } catch {
    /* No es JSON (el CSV, por ejemplo). */
  }
  return { estado: respuesta.status, datos, texto };
}

const estado = await pedir('/api/estado').catch(() => null);
if (!estado || estado.estado !== 200) {
  console.error(`No hay respuesta en ${BASE}. Arranca antes la tienda en local: npm run local`);
  process.exit(2);
}
if (estado.datos.entorno !== 'pruebas' || estado.datos.pago !== 'simulado') {
  console.error('Esta prueba solo se lanza contra un entorno de pruebas con pago simulado.');
  process.exit(2);
}

const disponibilidad = (await pedir('/api/disponibilidad')).datos;
const dia = disponibilidad.dias.find((d) => d.disponible);
const domingo = disponibilidad.dias.find((d) => d.motivo === 'cerrado');
comprobar(!!dia, `Hay días disponibles (el primero: ${dia?.etiqueta})`);

const base = {
  lineas: [
    { id: 'ramo-variado-de-temporada', variante: 'grande', cantidad: 1, nota: 'Tonos rosas' },
    { id: 'ramo-a-tu-medida', cantidad: 1, importe: 35 },
  ],
  entrega: { metodo: 'domicilio', fecha: dia.fecha, nota: 'Portal B' },
  destinatario: { nombre: 'Persona de Prueba', telefono: '' },
  direccion: { calle: 'Calle de la Prueba 1', cp: '45007', localidad: '' },
  dedicatoria: 'Feliz cumpleaños.',
  comprador: { nombre: 'Cliente de Prueba', telefono: '600 000 000', email: 'prueba@example.com' },
  acepta: true,
};

let r = await pedir('/api/pedidos', { metodo: 'POST', cuerpo: { ...base, acepta: false } });
comprobar(r.estado === 422 && r.datos.errores.acepta, 'Sin aceptar las condiciones no hay pedido');

r = await pedir('/api/pedidos', { metodo: 'POST', cuerpo: { ...base, direccion: { calle: 'Calle Lejana 1', cp: '45100' } } });
comprobar(r.estado === 422 && r.datos.errores['direccion.cp'], 'Fuera de la zona de reparto no se puede pagar en la web');

if (domingo) {
  r = await pedir('/api/pedidos', { metodo: 'POST', cuerpo: { ...base, entrega: { ...base.entrega, fecha: domingo.fecha } } });
  comprobar(r.estado === 409, 'Un día cerrado se rechaza');
}

r = await pedir('/api/pedidos', { metodo: 'POST', cuerpo: base });
comprobar(r.estado === 201 && r.datos.url.includes('/pedido/pago-de-prueba/'), 'Pedido creado, pendiente de pago');
const { ref, token } = r.datos;

r = await pedir(`/api/pedidos/${ref}?t=${token}`);
comprobar(r.datos.estado === 'pendiente_pago' && r.datos.total === 4500 + 3500 + 800, `El servidor calcula el total: ${r.datos.total / 100} €`);
comprobar((await pedir(`/api/pedidos/${ref}?t=otro`)).estado === 404, 'Sin el código del pedido no se puede consultar');

r = await pedir('/api/pruebas/pago', { metodo: 'POST', cuerpo: { ref, token, resultado: 'pagado' } });
r = await pedir(`/api/pedidos/${ref}?t=${token}`);
comprobar(r.datos.estado === 'nuevo' && r.datos.pagado === true, 'Pago simulado: el pedido queda pagado y nuevo');

comprobar((await pedir('/api/panel/pedidos')).estado === 401, 'El panel no responde sin sesión');
comprobar((await pedir('/api/panel/sesion', { metodo: 'POST', cuerpo: { clave: 'no-es-la-clave' } })).estado === 401, 'Una clave mala no entra');
comprobar((await pedir('/api/panel/sesion', { metodo: 'POST', cuerpo: { clave } })).estado === 200 && cookie !== '', 'La clave buena abre sesión');

r = await pedir('/api/panel/pedidos?vista=marcha');
comprobar(r.datos.pedidos.some((p) => p.ref === ref), 'El pedido aparece en el panel');
r = await pedir(`/api/panel/pedidos/${ref}`, { metodo: 'PATCH', cuerpo: { estado: 'en_preparacion', notaInterna: 'Nota de prueba' } });
comprobar(r.datos.pedido.estado === 'en_preparacion' && r.datos.pedido.eventos.length >= 3, 'Cambio de estado y nota, con historial');
comprobar((await pedir(`/api/panel/pedidos/${ref}`, { metodo: 'PATCH', cuerpo: { pagado: false } })).estado === 422, 'El cobro de un pedido pagado en la web no se toca a mano');

r = await pedir('/api/panel/pedidos', {
  metodo: 'POST',
  cuerpo: { origen: 'telefono', lineas: [{ nombre: 'Ramo por teléfono', cantidad: 1, precio: 30 }], entrega: { metodo: 'recogida', fecha: dia.fecha }, comprador: { nombre: 'Cliente del teléfono' } },
});
comprobar(r.estado === 201 && r.datos.pedido.total === 3000 && r.datos.pedido.pago.estado === 'pendiente', 'Pedido apuntado a mano, sin cobrar');
const manual = r.datos.pedido.ref;
r = await pedir(`/api/panel/pedidos/${manual}`, { metodo: 'PATCH', cuerpo: { pagado: true, formaDeCobro: 'efectivo' } });
comprobar(r.datos.pedido.pago.estado === 'pagado', 'Pedido a mano marcado como cobrado');

const libre = disponibilidad.dias.filter((d) => d.disponible).at(-1).fecha;
await pedir(`/api/panel/dias/${libre}`, { metodo: 'PUT', cuerpo: { estado: 'cerrado', cupo: null, nota: 'Prueba' } });
comprobar((await pedir('/api/disponibilidad')).datos.dias.find((d) => d.fecha === libre).disponible === false, 'Cerrar un día desde el panel lo quita de la web');
await pedir(`/api/panel/dias/${libre}`, { metodo: 'PUT', cuerpo: { estado: null, cupo: 0, nota: '' } });
r = await pedir('/api/pedidos', { metodo: 'POST', cuerpo: { ...base, entrega: { ...base.entrega, fecha: libre } } });
comprobar(r.estado === 409, 'Con el cupo del día a cero, la web no admite más pedidos');
await pedir(`/api/panel/dias/${libre}`, { metodo: 'PUT', cuerpo: { estado: null, cupo: null, nota: '' } });
comprobar((await pedir('/api/disponibilidad')).datos.dias.find((d) => d.fecha === libre).disponible === true, 'Al quitar el cambio, el día vuelve a estar disponible');

r = await pedir('/api/presupuestos', {
  metodo: 'POST',
  cuerpo: { tipo: 'boda', nombre: 'Pareja de Prueba', telefono: '600000000', mensaje: 'Ramo de novia y centros para diez mesas.', acepta: true },
});
comprobar(r.estado === 201, 'Solicitud de presupuesto recogida');
comprobar((await pedir('/api/panel/presupuestos')).datos.presupuestos.some((p) => p.ref === r.datos.ref), 'La solicitud aparece en el panel');

r = await pedir(`/api/panel/exportar?desde=${dia.fecha}&hasta=${dia.fecha}`);
comprobar(r.texto.includes(ref) && r.texto.includes('Base 10 %') && !r.texto.includes('Calle de la Prueba'), 'La exportación lleva el pedido y el IVA, y no lleva direcciones');

await pedir(`/api/panel/pedidos/${manual}`, { metodo: 'PATCH', cuerpo: { estado: 'cancelado' } });
await pedir('/api/panel/sesion', { metodo: 'DELETE' });
cookie = '';
comprobar((await pedir('/api/panel/pedidos')).estado === 401, 'Al salir, el panel deja de responder');

console.log(fallos ? `\n${fallos} comprobaciones han fallado.` : '\nCompra completa sin errores.');
process.exit(fallos ? 1 : 0);
