/* Pruebas de las reglas de la tienda. Se lanzan con `npm test` (no necesitan navegador ni servidor). */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PRODUCTOS, catalogoCompra, esComprable, productosVisibles } from '../compartido/catalogo.ts';
import { abreSegunCalendario, estadoApertura, estadoDia, esFechaValida, sumarDias } from '../compartido/fechas.ts';
import { calcularLineas, desglosarIva, normalizarTelefono, validarPedido } from '../compartido/pedido.ts';
import type { PedidoEntrada } from '../compartido/pedido.ts';
import { TIENDA, precioEnvioCentimos } from '../compartido/tienda.ts';

const pruebas = catalogoCompra('pruebas');
const publico = catalogoCompra('produccion');

const pedidoBase = (cambios: Partial<PedidoEntrada> = {}): PedidoEntrada => ({
  lineas: [{ id: 'ramo-variado-de-temporada', variante: 'grande', cantidad: 1 }],
  entrega: { metodo: 'recogida', fecha: '2026-11-11' },
  comprador: { nombre: 'Cliente de Prueba', telefono: '600 000 000', email: 'prueba@example.com' },
  acepta: true,
  ...cambios,
});

test('la web pública no enseña productos ni precios sin confirmar', () => {
  for (const p of productosVisibles('produccion')) assert.equal(p.ejemplo, false, `${p.id} es de ejemplo y sale en producción`);
  for (const p of publico) {
    const original = PRODUCTOS.find((x) => x.id === p.id)!;
    if (original.precioConfirmado) continue;
    assert.equal(p.precio, null, `${p.id} enseña un precio sin confirmar`);
    for (const v of p.variantes) assert.equal(v.precio, null, `${p.id}/${v.id} enseña un precio sin confirmar`);
    assert.equal(esComprable(original, 'produccion'), false);
  }
});

test('los identificadores de producto no se repiten y cada uno tiene categoría e IVA', () => {
  const ids = PRODUCTOS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of PRODUCTOS) {
    assert.match(p.id, /^[a-z0-9-]+$/);
    assert.ok(p.resumen.length > 10 && p.descripcion.length > 0, `${p.id} sin textos`);
    assert.ok(p.iva === 'flores' || p.iva === 'complementos');
  }
});

test('los importes se calculan en el servidor con el catálogo, no con lo que mande el navegador', () => {
  const r = calcularLineas(
    [
      { id: 'ramo-variado-de-temporada', variante: 'grande', cantidad: 2, precio: 1 } as never,
      { id: 'ramo-a-tu-medida', cantidad: 1, importe: 35 },
    ],
    pruebas,
  );
  assert.deepEqual(r.errores, []);
  assert.equal(r.subtotal, 2 * 4500 + 3500);
});

test('el ramo a medida respeta el mínimo y el máximo', () => {
  const { minimo, maximo } = TIENDA.ramoAMedida;
  assert.ok(calcularLineas([{ id: 'ramo-a-tu-medida', cantidad: 1, importe: minimo - 1 }], pruebas).errores.length);
  assert.ok(calcularLineas([{ id: 'ramo-a-tu-medida', cantidad: 1, importe: maximo + 1 }], pruebas).errores.length);
  assert.ok(calcularLineas([{ id: 'ramo-a-tu-medida', cantidad: 1, importe: 12.5 }], pruebas).errores.length);
});

test('un producto sin precio en la web manda el pedido por WhatsApp', () => {
  const v = validarPedido(pedidoBase(), publico);
  assert.equal(v.ok, false);
  assert.equal(!v.ok && v.porWhatsApp, true);
});

test('pedido válido: recogida gratis, reparto en Toledo y hospital con su precio', () => {
  const recogida = validarPedido(pedidoBase(), pruebas);
  assert.ok(recogida.ok);
  assert.equal(recogida.ok && recogida.pedido.total, 4500);

  const domicilio = validarPedido(
    pedidoBase({ entrega: { metodo: 'domicilio', fecha: '2026-11-11' }, destinatario: { nombre: 'Persona' }, direccion: { calle: 'Calle Mayor 1', cp: '45007' } }),
    pruebas,
  );
  assert.ok(domicilio.ok);
  assert.equal(domicilio.ok && domicilio.pedido.envio, precioEnvioCentimos('domicilio', '45007'));
  assert.equal(domicilio.ok && domicilio.pedido.direccion.localidad, 'Toledo');

  const hospital = validarPedido(pedidoBase({ entrega: { metodo: 'hospital', fecha: '2026-11-11' }, destinatario: { nombre: 'Persona' } }), pruebas);
  assert.ok(hospital.ok);
  assert.equal(hospital.ok && hospital.pedido.envio, TIENDA.entrega.hospital.precio * 100);
});

test('fuera de la zona de reparto no se puede pagar en la web', () => {
  const v = validarPedido(
    pedidoBase({ entrega: { metodo: 'domicilio', fecha: '2026-11-11' }, destinatario: { nombre: 'Persona' }, direccion: { calle: 'Calle Mayor 1', cp: '45100' } }),
    pruebas,
  );
  assert.equal(v.ok, false);
  assert.ok(!v.ok && v.errores['direccion.cp']);
});

test('lo que no se lleva al hospital se rechaza con esa entrega', () => {
  const v = validarPedido(
    pedidoBase({ lineas: [{ id: 'corona-funeraria', cantidad: 1, variante: PRODUCTOS.find((p) => p.id === 'corona-funeraria')?.variantes?.[0]?.id }], entrega: { metodo: 'hospital', fecha: '2026-11-11' }, destinatario: { nombre: 'Persona' } }),
    pruebas,
  );
  assert.equal(v.ok, false);
});

test('faltan datos: se devuelve un error por campo', () => {
  const v = validarPedido({ lineas: [{ id: 'ramo-variado-de-temporada', variante: 'grande', cantidad: 1 }], entrega: {}, comprador: {}, acepta: false }, pruebas);
  assert.equal(v.ok, false);
  if (!v.ok) for (const campo of ['entrega.metodo', 'entrega.fecha', 'comprador.nombre', 'comprador.telefono', 'comprador.email', 'acepta']) assert.ok(v.errores[campo], campo);
});

test('el IVA incluido se desglosa por tipo y cuadra con el total', () => {
  const r = calcularLineas([{ id: 'ramo-variado-de-temporada', variante: 'grande', cantidad: 1 }], pruebas);
  const iva = desglosarIva(r.lineas, 800);
  assert.equal(iva.reduce((s, d) => s + d.total, 0), 4500 + 800);
  for (const d of iva) assert.equal(d.base + d.cuota, d.total);
  assert.equal(iva.find((d) => d.tipo === TIENDA.iva.flores)?.base, Math.round(4500 / 1.1));
});

test('teléfonos', () => {
  assert.equal(normalizarTelefono('600 00 00 00'), '600000000');
  assert.equal(normalizarTelefono('+34 925 24 07 08'), '925240708');
  assert.equal(normalizarTelefono('12345'), null);
});

test('fechas de entrega: domingos, festivos, hora límite, cupo y cambios del panel', () => {
  const martes = { fecha: '2026-11-10', hora: '10:00', diaSemana: 2 };
  assert.ok(esFechaValida('2026-02-28') && !esFechaValida('2026-02-30'));
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(estadoDia('2026-11-10', martes).disponible, true);
  assert.equal(estadoDia('2026-11-10', { ...martes, hora: TIENDA.horaLimiteMismoDia }).motivo, 'hora');
  assert.equal(estadoDia('2026-11-15', martes).motivo, 'cerrado'); // domingo
  assert.equal(estadoDia('2026-12-25', martes).motivo, 'festivo');
  assert.equal(estadoDia('2026-11-09', martes).motivo, 'pasado');
  assert.equal(estadoDia('2026-11-11', martes, null, TIENDA.cupoDiario).motivo, 'completo');
  assert.equal(estadoDia('2026-11-11', martes, { fecha: '2026-11-11', estado: null, cupo: 2 }, 2).motivo, 'completo');
  assert.equal(estadoDia('2026-11-15', martes, { fecha: '2026-11-15', estado: 'abierto', cupo: null }).disponible, true);
  assert.equal(estadoDia('2026-11-11', martes, { fecha: '2026-11-11', estado: 'cerrado', cupo: null }).disponible, false);
  assert.equal(estadoDia(sumarDias('2026-11-10', TIENDA.diasAntelacionMax + 1), martes).motivo, 'lejos');
  assert.equal(abreSegunCalendario('2026-11-14').abre, true); // sábado
});

test('«abierto ahora» según el horario de la tienda', () => {
  assert.equal(estadoApertura({ fecha: '2026-11-10', hora: '10:00', diaSemana: 2 }).abierta, true);
  assert.equal(estadoApertura({ fecha: '2026-11-10', hora: '15:00', diaSemana: 2 }).abierta, false);
  assert.match(estadoApertura({ fecha: '2026-11-14', hora: '15:00', diaSemana: 6 }).texto, /lunes/);
});
