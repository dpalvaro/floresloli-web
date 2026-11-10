/* =====================================================================
   PANEL DE PEDIDOS

   Todo se pide a /api/panel/… con la cookie de sesión. Los datos de los
   clientes se pintan siempre como texto (nunca como HTML), para que nada
   de lo que escriba un cliente pueda ejecutarse en el panel.
   ===================================================================== */

import { ahoraEnMadrid, fechaCorta, fechaLarga, sumarDias } from '../../compartido/fechas.ts';
import { eurosDeCentimos } from '../../compartido/formato.ts';
import { NEGOCIO } from '../../compartido/negocio.ts';
import { TIENDA } from '../../compartido/tienda.ts';

/* ---------------- Tipos de lo que devuelve la API ---------------- */

interface PedidoPanel {
  ref: string;
  creado: string;
  origen: string;
  prueba: boolean;
  estado: string;
  estadoNombre: string;
  pago: { estado: string; metodo: string; stripe: string };
  entrega: { metodo: string; nombre: string; fecha: string; fechaTexto: string; nota: string };
  comprador: { nombre: string; telefono: string; email: string };
  destinatario: { nombre: string; telefono: string; direccion: string; cp: string; localidad: string; detalle: string };
  dedicatoria: string;
  observaciones: string;
  notaInterna: string;
  lineas: { nombre: string; detalle: string; cantidad: number; precioUnidad: number; total: number; nota: string }[];
  subtotal: number;
  envio: number;
  total: number;
  eventos?: { fecha: string; tipo: string; detalle: string; autor: string }[];
}

interface Resumen {
  nuevos: number;
  hoy: number;
  manana: number;
  atrasados: number;
  presupuestosNuevos: number;
}

interface DiaPanel {
  fecha: string;
  etiqueta: string;
  abrePorDefecto: boolean;
  motivoCierre: string | null;
  ajuste: { estado: 'abierto' | 'cerrado' | null; cupo: number | null; nota: string } | null;
  cupo: number;
  pedidosWeb: number;
  pedidosTotales: number;
  disponible: boolean;
  motivo: string | null;
}

interface PresupuestoPanel {
  ref: string;
  creado: string;
  tipoNombre: string;
  fechaEvento: string;
  nombre: string;
  telefono: string;
  email: string;
  mensaje: string;
  estado: string;
  notaInterna: string;
}

interface DatosPagina {
  productos: { nombre: string; precio: number | null; iva: string }[];
  estados: { id: string; nombre: string }[];
  envioToledo: number;
  envioHospital: number;
}

class SinSesion extends Error {}

/* ---------------- Utilidades ---------------- */

type Hijo = Node | string | null | undefined | false;
type Atributos = Record<string, string | number | boolean | undefined | ((evento: Event) => void)>;

/** Crea un elemento. Los textos entran siempre como texto, nunca como HTML. */
function h<K extends keyof HTMLElementTagNameMap>(etiqueta: K, atributos: Atributos | null, ...hijos: Hijo[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos ?? {})) {
    if (valor === undefined || valor === false) continue;
    if (typeof valor === 'function') e.addEventListener(nombre.replace(/^on/, ''), valor);
    else if (nombre === 'class') e.className = String(valor);
    else if (valor === true) e.setAttribute(nombre, '');
    else e.setAttribute(nombre, String(valor));
  }
  for (const hijo of hijos) if (hijo !== null && hijo !== undefined && hijo !== false) e.append(hijo);
  return e;
}

const ORIGEN: Record<string, string> = { web: 'Web', tienda: 'Mostrador', telefono: 'Teléfono', whatsapp: 'WhatsApp' };
const COBRO: Record<string, string> = { pagado: 'Cobrado', pendiente: 'Sin cobrar', reembolsado: 'Devuelto' };
const FORMA: Record<string, string> = {
  stripe: 'en la web',
  simulado: 'pago de prueba',
  tienda: 'al recoger',
  efectivo: 'efectivo',
  tarjeta: 'tarjeta',
  bizum: 'Bizum',
  transferencia: 'transferencia',
};
const COLOR_ESTADO: Record<string, string> = {
  nuevo: '',
  en_preparacion: 'ambar',
  listo: 'lima',
  en_reparto: 'lima',
  entregado: 'verde',
  cancelado: 'gris',
  caducado: 'gris',
  pendiente_pago: 'gris',
};
const ESTADOS_PRESUPUESTO: Record<string, string> = { nuevo: 'Nuevo', contestado: 'Contestado', aceptado: 'Aceptado', descartado: 'Descartado' };

const enlaceTel = (numero: string) => 'tel:' + (numero.startsWith('+') ? numero : '+34' + numero);
const enlaceWa = (numero: string) => 'https://wa.me/' + (numero.startsWith('+') ? numero.slice(1) : '34' + numero);

function horaMadrid(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  const m = ahoraEnMadrid(fecha);
  return `${fechaCorta(m.fecha)} ${m.hora}`;
}

/** Qué toca hacer ahora con un pedido: el botón grande de su tarjeta. */
function siguientePaso(p: PedidoPanel): { estado: string; texto: string } | null {
  if (p.estado === 'nuevo') return { estado: 'en_preparacion', texto: 'Empezar a prepararlo' };
  if (p.estado === 'en_preparacion') return { estado: 'listo', texto: 'Ya está listo' };
  if (p.estado === 'listo') return p.entrega.metodo === 'recogida' ? { estado: 'entregado', texto: 'Entregado' } : { estado: 'en_reparto', texto: 'Sale a reparto' };
  if (p.estado === 'en_reparto') return { estado: 'entregado', texto: 'Entregado' };
  return null;
}

/* ---------------- Arranque ---------------- */

const raiz = document.querySelector<HTMLElement>('[data-panel]');
if (raiz) iniciar(raiz);

function iniciar(raiz: HTMLElement): void {
  const datos = JSON.parse(document.getElementById('datos-panel')?.textContent ?? '{}') as DatosPagina;
  const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

  const cargando = $('[data-cargando]');
  const entrada = $('[data-entrada]');
  const dentro = $('[data-dentro]');
  const falloPanel = $('[data-fallo-panel]');
  const listaPedidos = $('[data-lista-pedidos]');
  const ficha = $<HTMLDialogElement>('[data-ficha]');
  const fichaContenido = $('[data-ficha-contenido]');
  const hoja = $('[data-hoja]');
  document.body.append(hoja); // Para imprimir solo el pedido, la hoja cuelga directamente de la página.

  let vista = 'marcha';
  let seccion = 'pedidos';
  let hoy = ahoraEnMadrid().fecha;
  let temporizador = 0;

  /* ---------------- Llamadas a la API ---------------- */

  async function api<T>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown } = {}): Promise<T> {
    const respuesta = await fetch('/api/panel/' + ruta, {
      method: opciones.metodo ?? 'GET',
      headers: opciones.cuerpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
      credentials: 'same-origin',
    });
    const cuerpo = (await respuesta.json().catch(() => ({}))) as T & { mensaje?: string; errores?: Record<string, string> };
    if (respuesta.status === 401 && ruta !== 'sesion') {
      mostrarEntrada(true, true);
      throw new SinSesion();
    }
    if (!respuesta.ok) throw Object.assign(new Error(cuerpo.mensaje ?? `Error ${respuesta.status}`), { errores: cuerpo.errores, estado: respuesta.status });
    return cuerpo;
  }

  function avisar(error: unknown): void {
    if (error instanceof SinSesion) return;
    falloPanel.textContent = error instanceof Error && error.message ? error.message : 'Algo ha fallado. Inténtalo de nuevo.';
    falloPanel.hidden = false;
    falloPanel.scrollIntoView({ block: 'nearest' });
  }
  const quitarAviso = () => (falloPanel.hidden = true);

  /* ---------------- Entrada y salida ---------------- */

  function mostrarEntrada(configurado: boolean, conBase: boolean): void {
    window.clearInterval(temporizador);
    cargando.hidden = true;
    dentro.hidden = true;
    entrada.hidden = false;
    if (ficha.open) ficha.close();
    $('[data-sin-configurar]').hidden = configurado || !conBase;
    $('[data-sin-base]').hidden = conBase;
    $<HTMLFormElement>('[data-form-entrada]').hidden = !configurado || !conBase;
    if (configurado && conBase) $<HTMLInputElement>('#clave').focus();
  }

  function mostrarPanel(entorno: string): void {
    cargando.hidden = true;
    entrada.hidden = true;
    dentro.hidden = false;
    $('[data-entorno]').hidden = entorno !== 'pruebas';
    const destino = location.hash.slice(1);
    if (destino === 'presupuestos' || destino === 'calendario' || destino === 'apuntar' || destino === 'ajustes') irA(destino);
    else irA('pedidos');
    const ref = /^pedido=([A-Za-z0-9-]+)$/.exec(destino)?.[1];
    if (ref) void abrirFicha(ref.toUpperCase());
    window.clearInterval(temporizador);
    // Cada minuto se vuelve a mirar si hay pedidos nuevos, mientras el panel esté a la vista.
    temporizador = window.setInterval(() => {
      if (document.visibilityState === 'visible' && seccion === 'pedidos' && !ficha.open && !$<HTMLInputElement>('[data-buscar]').value) void cargarPedidos(true);
    }, 60_000);
  }

  async function comprobarSesion(): Promise<void> {
    try {
      const s = await api<{ dentro: boolean; configurado: boolean; entorno: string }>('sesion');
      if (s.dentro) mostrarPanel(s.entorno);
      else mostrarEntrada(s.configurado, true);
    } catch (error) {
      const estado = (error as { estado?: number }).estado;
      mostrarEntrada(true, estado !== 503);
      if (estado !== 503) {
        const hueco = $('[data-error-entrada]');
        hueco.textContent = 'No se ha podido conectar con el panel. Recarga la página.';
        hueco.hidden = false;
      }
    }
  }

  $<HTMLFormElement>('[data-form-entrada]').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const hueco = $('[data-error-entrada]');
    const clave = $<HTMLInputElement>('#clave');
    hueco.hidden = true;
    try {
      const s = await api<{ entorno: string }>('sesion', { metodo: 'POST', cuerpo: { clave: clave.value } });
      clave.value = '';
      mostrarPanel(s.entorno);
    } catch (error) {
      hueco.textContent = error instanceof Error ? error.message : 'No se ha podido entrar.';
      hueco.hidden = false;
      clave.select();
    }
  });

  $('[data-salir]').addEventListener('click', async () => {
    await api('sesion', { metodo: 'DELETE' }).catch(() => {});
    listaPedidos.replaceChildren();
    mostrarEntrada(true, true);
  });

  /* ---------------- Pestañas ---------------- */

  function irA(nombre: string): void {
    seccion = nombre;
    quitarAviso();
    for (const boton of document.querySelectorAll<HTMLElement>('[data-ir]')) boton.setAttribute('aria-selected', String(boton.dataset.ir === nombre));
    for (const s of document.querySelectorAll<HTMLElement>('[data-seccion]')) s.hidden = s.dataset.seccion !== nombre;
    if (nombre === 'pedidos') void cargarPedidos();
    if (nombre === 'calendario') void cargarCalendario();
    if (nombre === 'presupuestos') void cargarPresupuestos();
    if (nombre === 'ajustes') void cargarAjustes();
    if (nombre === 'apuntar') prepararApuntar();
  }
  for (const boton of document.querySelectorAll<HTMLElement>('[data-ir]')) boton.addEventListener('click', () => irA(boton.dataset.ir!));
  $('[data-actualizar]').addEventListener('click', () => irA(seccion));

  /* ---------------- Pedidos ---------------- */

  function pintarCifras(r: Resumen): void {
    const cifra = (numero: number, rotulo: string, alerta = false) =>
      h('li', { 'data-alerta': alerta && numero > 0 ? 'si' : undefined }, h('span', { class: 'numero' }, String(numero)), h('span', { class: 'rotulo' }, rotulo));
    $('[data-cifras]').replaceChildren(
      cifra(r.nuevos, 'nuevos, sin empezar', true),
      cifra(r.hoy, 'para hoy'),
      cifra(r.manana, 'para mañana'),
      cifra(r.atrasados, 'con la fecha pasada', true),
    );
    const globo = $('[data-globo-pedidos]');
    globo.hidden = r.nuevos === 0;
    globo.textContent = String(r.nuevos);
    const globoPresupuestos = $('[data-globo-presupuestos]');
    globoPresupuestos.hidden = r.presupuestosNuevos === 0;
    globoPresupuestos.textContent = String(r.presupuestosNuevos);
    document.title = (r.nuevos > 0 ? `(${r.nuevos}) ` : '') + `Panel de pedidos · ${NEGOCIO.nombre}`;
  }

  function etiquetasDe(p: PedidoPanel): HTMLElement[] {
    const cobro =
      p.pago.estado === 'pagado'
        ? h('span', { class: 'etiqueta verde' }, `Cobrado${FORMA[p.pago.metodo] ? ` · ${FORMA[p.pago.metodo]}` : ''}`)
        : p.pago.estado === 'reembolsado'
          ? h('span', { class: 'etiqueta gris' }, 'Devuelto')
          : h('span', { class: 'etiqueta roja' }, p.pago.metodo === 'tienda' ? 'Sin cobrar · paga al recoger' : 'Sin cobrar');
    return [
      h('span', { class: `etiqueta ${COLOR_ESTADO[p.estado] ?? ''}` }, p.estadoNombre),
      h('span', { class: 'etiqueta gris' }, ORIGEN[p.origen] ?? p.origen),
      cobro,
      ...(p.prueba ? [h('span', { class: 'etiqueta ambar' }, 'Prueba')] : []),
    ];
  }

  function cuerpoDe(p: PedidoPanel): HTMLElement[] {
    const d = p.destinatario;
    const partes: HTMLElement[] = [
      h(
        'ul',
        { class: 'pedido-lineas' },
        ...p.lineas.map((l) =>
          h('li', null, `${l.cantidad} × ${l.nombre}${l.detalle ? ` (${l.detalle})` : ''}`, l.nota ? h('span', { class: 'nota' }, ` · ${l.nota}`) : null),
        ),
      ),
    ];
    if (p.entrega.metodo === 'domicilio') {
      partes.push(
        h(
          'p',
          { class: 'pedido-dato' },
          h('b', null, 'Para: '),
          d.nombre || 'Sin nombre',
          d.telefono ? ' · ' : null,
          d.telefono ? h('a', { href: enlaceTel(d.telefono) }, d.telefono) : null,
          h('br', null),
          [d.direccion, [d.cp, d.localidad].filter(Boolean).join(' ')].filter(Boolean).join(', ') || h('span', { class: 'menor' }, 'Dirección borrada'),
        ),
      );
    }
    if (p.entrega.metodo === 'hospital') {
      partes.push(h('p', { class: 'pedido-dato' }, h('b', null, 'Para: '), d.nombre || 'Sin nombre', d.detalle ? ` · ${d.detalle}` : ''));
    }
    if (p.entrega.nota) partes.push(h('p', { class: 'pedido-dato' }, h('b', null, 'Indicaciones: '), p.entrega.nota));
    if (p.dedicatoria) partes.push(h('p', { class: 'pedido-dedicatoria' }, h('b', null, 'Tarjeta: '), p.dedicatoria));
    if (p.observaciones) partes.push(h('p', { class: 'pedido-dato' }, h('b', null, 'Observaciones: '), p.observaciones));
    const c = p.comprador;
    partes.push(
      h(
        'p',
        { class: 'pedido-dato' },
        h('b', null, 'Cliente: '),
        c.nombre,
        c.telefono ? ' · ' : null,
        c.telefono ? h('a', { href: enlaceTel(c.telefono) }, c.telefono) : null,
        c.telefono ? ' · ' : null,
        c.telefono ? h('a', { href: enlaceWa(c.telefono), rel: 'noopener', target: '_blank' }, 'WhatsApp') : null,
      ),
    );
    if (p.notaInterna) partes.push(h('p', { class: 'pedido-nota-interna' }, h('b', null, 'Nota: '), p.notaInterna));
    return partes;
  }

  function tarjetaDe(p: PedidoPanel): HTMLElement {
    const paso = siguientePaso(p);
    return h(
      'article',
      { class: 'pedido-tarjeta', 'data-estado': p.estado, 'data-ref': p.ref },
      h('div', { class: 'pedido-cabeza' }, h('span', { class: 'pedido-ref' }, p.ref), ...etiquetasDe(p), h('span', { class: 'pedido-total' }, eurosDeCentimos(p.total))),
      h('p', { class: 'pedido-entrega' }, `${p.entrega.nombre} · ${p.entrega.fechaTexto}`),
      ...cuerpoDe(p),
      h(
        'div',
        { class: 'pedido-acciones' },
        paso ? h('button', { class: 'boton pequeno', type: 'button', onclick: () => void cambiarPedido(p.ref, { estado: paso.estado }) }, paso.texto) : null,
        h('button', { class: 'boton linea pequeno', type: 'button', onclick: () => void abrirFicha(p.ref) }, 'Ver y cambiar'),
        h('button', { class: 'boton linea pequeno', type: 'button', onclick: () => imprimir(p) }, 'Imprimir'),
      ),
    );
  }

  async function cargarPedidos(silencioso = false): Promise<void> {
    const q = $<HTMLInputElement>('[data-buscar]').value.trim();
    // Al buscar se mira en todos los pedidos, no solo en la vista elegida.
    const parametros = new URLSearchParams({ vista: q ? 'todos' : vista });
    if (q) parametros.set('q', q);
    try {
      const r = await api<{ hoy: string; resumen: Resumen; pedidos: PedidoPanel[] }>('pedidos?' + parametros.toString());
      hoy = r.hoy;
      pintarCifras(r.resumen);
      if (!r.pedidos.length) {
        const vacio: Record<string, string> = {
          marcha: 'No hay pedidos por hacer.',
          hoy: 'No hay pedidos para hoy.',
          proximos: 'No hay pedidos para los próximos días.',
          todos: 'Todavía no hay pedidos.',
        };
        listaPedidos.replaceChildren(h('p', { class: 'sin-pedidos' }, q ? `Ningún pedido coincide con «${q}».` : vacio[vista]));
        return;
      }
      const nodos: HTMLElement[] = [];
      let grupo = '';
      for (const p of r.pedidos) {
        // Agrupados por día de entrega, salvo en «Todos», que va por orden de llegada.
        const clave = vista === 'todos' || q ? '' : p.entrega.fecha;
        if (clave && clave !== grupo) {
          grupo = clave;
          const cuando = clave === r.hoy ? 'Hoy, ' : clave === sumarDias(r.hoy, 1) ? 'Mañana, ' : clave < r.hoy ? 'Con la fecha pasada: ' : '';
          nodos.push(h('h2', { class: 'grupo-dia' }, cuando + fechaLarga(clave, r.hoy)));
        }
        nodos.push(tarjetaDe(p));
      }
      listaPedidos.replaceChildren(...nodos);
      if (!silencioso) quitarAviso();
    } catch (error) {
      if (!silencioso) avisar(error);
    }
  }

  async function cambiarPedido(ref: string, cambios: Record<string, unknown>): Promise<PedidoPanel | null> {
    try {
      const r = await api<{ pedido: PedidoPanel }>(`pedidos/${encodeURIComponent(ref)}`, { metodo: 'PATCH', cuerpo: cambios });
      quitarAviso();
      await cargarPedidos(true);
      return r.pedido;
    } catch (error) {
      avisar(error);
      return null;
    }
  }

  for (const boton of document.querySelectorAll<HTMLElement>('[data-vista]')) {
    boton.addEventListener('click', () => {
      vista = boton.dataset.vista!;
      for (const b of document.querySelectorAll<HTMLElement>('[data-vista]')) b.setAttribute('aria-pressed', String(b === boton));
      void cargarPedidos();
    });
  }
  let esperaBusqueda = 0;
  $('[data-buscar]').addEventListener('input', () => {
    window.clearTimeout(esperaBusqueda);
    esperaBusqueda = window.setTimeout(() => void cargarPedidos(), 350);
  });

  /* ---------------- Ficha de un pedido ---------------- */

  async function abrirFicha(ref: string): Promise<void> {
    try {
      const r = await api<{ pedido: PedidoPanel }>(`pedidos/${encodeURIComponent(ref)}`);
      pintarFicha(r.pedido);
      if (!ficha.open) ficha.showModal();
    } catch (error) {
      avisar(error);
    }
  }

  function pintarFicha(p: PedidoPanel): void {
    const error = h('p', { class: 'aviso error', role: 'alert', hidden: true });
    const aplicar = async (cambios: Record<string, unknown>) => {
      error.hidden = true;
      try {
        const r = await api<{ pedido: PedidoPanel }>(`pedidos/${encodeURIComponent(p.ref)}`, { metodo: 'PATCH', cuerpo: cambios });
        pintarFicha(r.pedido);
        void cargarPedidos(true);
      } catch (e) {
        if (e instanceof SinSesion) return;
        error.textContent = e instanceof Error ? e.message : 'No se ha podido guardar.';
        error.hidden = false;
      }
    };

    const estado = h('select', { id: 'f-estado' }, ...datos.estados.map((e) => h('option', { value: e.id, selected: e.id === p.estado }, e.nombre)));
    if (!datos.estados.some((e) => e.id === p.estado)) estado.prepend(h('option', { value: p.estado, selected: true }, p.estadoNombre));
    const fecha = h('input', { id: 'f-fecha', type: 'date', value: p.entrega.fecha });
    const nota = h('textarea', { id: 'f-nota', rows: 2, maxlength: 500 });
    nota.value = p.notaInterna;

    const cobroWeb = p.pago.metodo === 'stripe' || p.pago.metodo === 'simulado';
    const forma = h(
      'select',
      { id: 'f-forma' },
      ...[
        ['', 'Sin cobrar'],
        ['efectivo', 'Cobrado en efectivo'],
        ['tarjeta', 'Cobrado con tarjeta (datáfono)'],
        ['bizum', 'Cobrado por Bizum'],
        ['transferencia', 'Cobrado por transferencia'],
      ].map(([valor, texto]) => h('option', { value: valor, selected: p.pago.estado === 'pagado' ? valor === p.pago.metodo : valor === '' }, texto)),
    );

    const zonaCancelar = h('div', null);
    const pedirCancelar = () => {
      zonaCancelar.replaceChildren(
        h(
          'p',
          { class: 'peligro' },
          p.pago.estado === 'pagado' && cobroWeb
            ? '¿Cancelar este pedido? El dinero NO se devuelve solo: la devolución hay que hacerla después en Stripe.'
            : '¿Cancelar este pedido?',
        ),
        h(
          'div',
          { class: 'botones' },
          h('button', { class: 'boton rojo pequeno', type: 'button', onclick: () => void aplicar({ estado: 'cancelado' }) }, 'Sí, cancelar el pedido'),
          h('button', { class: 'boton linea pequeno', type: 'button', onclick: () => zonaCancelar.replaceChildren(botonCancelar) }, 'No'),
        ),
      );
    };
    const botonCancelar = h('button', { class: 'enlace-boton peligro', type: 'button', onclick: pedirCancelar }, 'Cancelar el pedido');
    if (p.estado !== 'cancelado') zonaCancelar.append(botonCancelar);

    fichaContenido.replaceChildren(
      h('div', { class: 'ficha-cerrar' }, h('button', { class: 'boton linea pequeno', type: 'button', onclick: () => ficha.close() }, 'Cerrar')),
      h(
        'div',
        { class: 'ficha-interior' },
        h('h2', { id: 't-ficha' }, `Pedido ${p.ref}`),
        h('p', { class: 'pedido-cabeza' }, ...etiquetasDe(p), h('span', { class: 'pedido-total' }, eurosDeCentimos(p.total))),
        h('p', { class: 'pedido-entrega' }, `${p.entrega.nombre} · ${p.entrega.fechaTexto}`),
        ...cuerpoDe(p),
        p.comprador.email ? h('p', { class: 'pedido-dato' }, h('b', null, 'Correo: '), h('a', { href: `mailto:${p.comprador.email}` }, p.comprador.email)) : null,
        h(
          'p',
          { class: 'pedido-dato menor' },
          `Productos ${eurosDeCentimos(p.subtotal)} · Reparto ${eurosDeCentimos(p.envio)} · Total ${eurosDeCentimos(p.total)} (IVA incluido). Apuntado el ${horaMadrid(p.creado)}.`,
        ),
        error,

        h('h3', null, 'Estado'),
        h(
          'div',
          { class: 'en-linea' },
          h('div', { class: 'campo' }, h('label', { for: 'f-estado' }, 'Cambiar a'), estado),
          h('button', { class: 'boton pequeno', type: 'button', onclick: () => void aplicar({ estado: estado.value }) }, 'Guardar el estado'),
        ),

        h('h3', null, 'Día de entrega'),
        h(
          'div',
          { class: 'en-linea' },
          h('div', { class: 'campo' }, h('label', { for: 'f-fecha' }, 'Nuevo día'), fecha),
          h('button', { class: 'boton pequeno', type: 'button', onclick: () => void aplicar({ fecha: fecha.value }) }, 'Cambiar el día'),
        ),

        h('h3', null, 'Cobro'),
        cobroWeb
          ? h('p', { class: 'pedido-dato' }, 'Este pedido se pagó en la web. Las devoluciones se hacen desde Stripe y aquí aparecen solas.')
          : h(
              'div',
              { class: 'en-linea' },
              h('div', { class: 'campo' }, h('label', { for: 'f-forma' }, 'Cómo está'), forma),
              h(
                'button',
                { class: 'boton pequeno', type: 'button', onclick: () => void aplicar({ pagado: forma.value !== '', formaDeCobro: forma.value }) },
                'Guardar el cobro',
              ),
            ),

        h('h3', null, 'Nota para la tienda'),
        h('div', { class: 'campo' }, h('label', { for: 'f-nota', class: 'solo-lectores' }, 'Nota para la tienda'), nota),
        h('button', { class: 'boton pequeno', type: 'button', onclick: () => void aplicar({ notaInterna: nota.value }) }, 'Guardar la nota'),

        h('h3', null, 'Historial'),
        h('ul', { class: 'historial' }, ...(p.eventos ?? []).map((e) => h('li', null, `${horaMadrid(e.fecha)} · ${e.detalle}`))),

        h('h3', null, 'Otras acciones'),
        h('div', { class: 'botones' }, h('button', { class: 'boton linea pequeno', type: 'button', onclick: () => imprimir(p) }, 'Imprimir')),
        zonaCancelar,
      ),
    );
  }

  // Pulsar fuera de la ficha la cierra.
  ficha.addEventListener('click', (evento) => {
    if (evento.target === ficha) ficha.close();
  });

  /* ---------------- Imprimir ---------------- */

  function imprimir(p: PedidoPanel): void {
    const d = p.destinatario;
    hoja.replaceChildren(
      h('h1', null, `Pedido ${p.ref}`),
      h('p', null, h('b', null, `${p.entrega.nombre} · ${p.entrega.fechaTexto}`)),
      h('h2', null, 'Qué lleva'),
      h('ul', null, ...p.lineas.map((l) => h('li', null, `${l.cantidad} × ${l.nombre}${l.detalle ? ` (${l.detalle})` : ''}${l.nota ? ` — ${l.nota}` : ''}`))),
      p.observaciones ? h('p', null, h('b', null, 'Observaciones: '), p.observaciones) : null,
      p.notaInterna ? h('p', null, h('b', null, 'Nota: '), p.notaInterna) : null,
      p.entrega.metodo !== 'recogida' ? h('h2', null, 'Entrega') : null,
      p.entrega.metodo !== 'recogida' ? h('p', null, h('b', null, 'Para: '), `${d.nombre}${d.telefono ? ` · ${d.telefono}` : ''}`) : null,
      p.entrega.metodo === 'domicilio' ? h('p', null, [d.direccion, [d.cp, d.localidad].filter(Boolean).join(' ')].filter(Boolean).join(', ')) : null,
      p.entrega.metodo === 'hospital' && d.detalle ? h('p', null, d.detalle) : null,
      p.entrega.nota ? h('p', null, h('b', null, 'Indicaciones: '), p.entrega.nota) : null,
      h('h2', null, 'Cliente'),
      h('p', null, `${p.comprador.nombre}${p.comprador.telefono ? ` · ${p.comprador.telefono}` : ''}`),
      h('p', null, `Total: ${eurosDeCentimos(p.total)} · ${COBRO[p.pago.estado] ?? p.pago.estado}`),
      p.dedicatoria ? h('div', { class: 'tarjeta-imprimir' }, p.dedicatoria) : null,
    );
    window.print();
  }

  /* ---------------- Apuntar un pedido ---------------- */

  const formApuntar = $<HTMLFormElement>('[data-form-apuntar]');
  const lineasManual = $('[data-lineas-manual]');
  const campoManual = (nombre: string) => formApuntar.elements.namedItem(nombre) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  const aNumero = (texto: string) => Number(texto.replace(',', '.'));

  function totalManual(): void {
    let total = 0;
    for (const fila of lineasManual.querySelectorAll<HTMLElement>('.linea-manual')) {
      const [, cantidad, precio] = fila.querySelectorAll('input');
      total += (Number(cantidad!.value) || 0) * (aNumero(precio!.value) || 0);
    }
    if (campoManual('metodo').value !== 'recogida') total += aNumero(campoManual('envio').value) || 0;
    $('[data-total-manual]').textContent = eurosDeCentimos(Math.round(total * 100));
  }

  function otraLinea(): void {
    const n = lineasManual.children.length + 1;
    const nombre = h('input', { type: 'text', list: 'productos-catalogo', maxlength: 120, placeholder: 'Producto', 'aria-label': `Producto ${n}`, autocomplete: 'off' });
    const cantidad = h('input', { type: 'text', inputmode: 'numeric', value: 1, 'aria-label': `Cantidad del producto ${n}`, autocomplete: 'off' });
    const precio = h('input', { type: 'text', inputmode: 'decimal', placeholder: '€', 'aria-label': `Precio del producto ${n}, en euros`, autocomplete: 'off' });
    // Si el nombre coincide con un producto del catálogo, se propone su precio.
    nombre.addEventListener('change', () => {
      const producto = datos.productos.find((x) => x.nombre === nombre.value);
      if (producto && producto.precio !== null && !precio.value) precio.value = String(producto.precio).replace('.', ',');
      totalManual();
    });
    const fila = h(
      'div',
      { class: 'linea-manual' },
      nombre,
      cantidad,
      precio,
      h(
        'button',
        {
          type: 'button',
          'aria-label': `Quitar el producto ${n}`,
          onclick: () => {
            if (lineasManual.children.length > 1) fila.remove();
            totalManual();
          },
        },
        '×',
      ),
    );
    lineasManual.append(fila);
  }

  function ajustarEntregaManual(): void {
    const metodo = campoManual('metodo').value;
    $('[data-manual-reparto]').hidden = metodo === 'recogida';
    $('[data-manual-domicilio]').hidden = metodo !== 'domicilio';
    $('[data-manual-hospital]').hidden = metodo !== 'hospital';
    const envio = campoManual('envio');
    if (metodo === 'recogida') envio.value = '';
    else if (!envio.value) envio.value = String(metodo === 'hospital' ? datos.envioHospital : datos.envioToledo);
    totalManual();
  }

  function prepararApuntar(): void {
    if (!lineasManual.children.length) {
      $('#productos-catalogo').replaceChildren(...datos.productos.map((p) => h('option', { value: p.nombre })));
      otraLinea();
    }
    if (!campoManual('fecha').value) campoManual('fecha').value = hoy;
    ajustarEntregaManual();
  }

  $('[data-otra-linea]').addEventListener('click', otraLinea);
  campoManual('metodo').addEventListener('change', ajustarEntregaManual);
  formApuntar.addEventListener('input', totalManual);

  formApuntar.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const fallo = $('[data-fallo-apuntar]');
    fallo.hidden = true;
    const cobro = campoManual('cobro').value;
    const metodo = campoManual('metodo').value;
    const cuerpo = {
      origen: (formApuntar.querySelector<HTMLInputElement>('input[name="origen"]:checked')?.value ?? 'tienda') as string,
      lineas: [...lineasManual.querySelectorAll<HTMLElement>('.linea-manual')].map((fila) => {
        const [nombre, cantidad, precio] = fila.querySelectorAll('input');
        const producto = datos.productos.find((x) => x.nombre === nombre!.value);
        return { nombre: nombre!.value, cantidad: Number(cantidad!.value), precio: aNumero(precio!.value || '0'), iva: producto?.iva ?? 'flores' };
      }),
      entrega: { metodo, fecha: campoManual('fecha').value, nota: campoManual('entregaNota').value },
      envio: metodo === 'recogida' ? 0 : aNumero(campoManual('envio').value || '0'),
      destinatario: { nombre: campoManual('destNombre').value, telefono: campoManual('destTelefono').value },
      direccion: { calle: campoManual('calle').value, cp: campoManual('cp').value, localidad: campoManual('localidad').value },
      hospital: { detalle: campoManual('hospDetalle').value },
      dedicatoria: campoManual('dedicatoria').value,
      comprador: { nombre: campoManual('nombre').value, telefono: campoManual('telefono').value },
      notaInterna: campoManual('notaInterna').value,
      pagado: cobro !== '',
      formaDeCobro: cobro,
    };
    const pintarErrores = (errores: Record<string, string>) => {
      for (const hueco of formApuntar.querySelectorAll<HTMLElement>('[data-error-de]')) {
        const mensaje = errores[hueco.dataset.errorDe!];
        hueco.textContent = mensaje ?? '';
        hueco.hidden = !mensaje;
      }
    };
    pintarErrores({});
    try {
      await api('pedidos', { metodo: 'POST', cuerpo });
      formApuntar.reset();
      lineasManual.replaceChildren();
      prepararApuntar();
      vista = 'marcha';
      for (const b of document.querySelectorAll<HTMLElement>('[data-vista]')) b.setAttribute('aria-pressed', String(b.dataset.vista === 'marcha'));
      irA('pedidos');
    } catch (error) {
      if (error instanceof SinSesion) return;
      const errores = (error as { errores?: Record<string, string> }).errores;
      if (errores) pintarErrores(errores);
      fallo.textContent = error instanceof Error ? error.message : 'No se ha podido apuntar el pedido.';
      fallo.hidden = false;
    }
  });

  /* ---------------- Calendario ---------------- */

  const MOTIVO: Record<string, string> = { cerrado: 'Cerrado', festivo: 'Festivo', hora: 'Ya no admite pedidos para hoy', completo: 'Completo', lejos: '', pasado: '' };

  async function cargarCalendario(): Promise<void> {
    try {
      const r = await api<{ cupoGeneral: number; horaLimite: string; dias: DiaPanel[] }>('dias');
      $('[data-ayuda-calendario]').textContent =
        `La web admite ${r.cupoGeneral} pedidos por día y, para el mismo día, hasta las ${r.horaLimite.replace(/^0/, '')}. ` +
        'Aquí puedes cerrar un día, abrir un domingo o un festivo, o cambiar cuántos pedidos de la web caben en un día concreto.';
      $('[data-lista-dias]').replaceChildren(...r.dias.map(filaDia));
      quitarAviso();
    } catch (error) {
      avisar(error);
    }
  }

  function filaDia(d: DiaPanel): HTMLElement {
    const abre = d.ajuste?.estado === 'abierto' || (d.ajuste?.estado !== 'cerrado' && d.abrePorDefecto);
    const estado = d.ajuste?.estado === 'abierto' ? 'Abierto a mano' : d.ajuste?.estado === 'cerrado' ? 'Cerrado a mano' : d.abrePorDefecto ? 'Abierto' : MOTIVO[d.motivoCierre ?? 'cerrado'];
    const cupo = h('input', { type: 'text', inputmode: 'numeric', value: d.ajuste?.cupo ?? '', placeholder: String(TIENDA.cupoDiario), id: `cupo-${d.fecha}`, autocomplete: 'off' });
    const nota = h('input', { type: 'text', maxlength: 120, value: d.ajuste?.nota ?? '', id: `nota-${d.fecha}`, autocomplete: 'off' });

    const guardar = async (cambio: { estado?: 'abierto' | 'cerrado' | null; quitar?: boolean }) => {
      const cuerpo = cambio.quitar
        ? { estado: null, cupo: null, nota: '' }
        : { estado: cambio.estado !== undefined ? cambio.estado : (d.ajuste?.estado ?? null), cupo: cupo.value.trim() === '' ? null : Number(cupo.value), nota: nota.value };
      try {
        await api(`dias/${d.fecha}`, { metodo: 'PUT', cuerpo });
        await cargarCalendario();
      } catch (error) {
        avisar(error);
      }
    };

    return h(
      'div',
      { class: 'dia', 'data-abre': abre ? 'si' : 'no', 'data-fecha': d.fecha },
      h('span', { class: 'dia-nombre' }, d.etiqueta),
      h('span', { class: `etiqueta ${abre ? (d.disponible ? 'verde' : 'ambar') : 'gris'}` }, abre && !d.disponible && d.motivo ? (MOTIVO[d.motivo] ?? estado) : estado),
      h(
        'span',
        { class: 'dia-cifras' },
        abre ? `Pedidos de la web: ${d.pedidosWeb} de ${d.cupo}` : 'No admite pedidos de la web',
        d.pedidosTotales ? ` · ${d.pedidosTotales} ${d.pedidosTotales === 1 ? 'pedido' : 'pedidos'} en total` : '',
        d.ajuste?.nota ? ` · ${d.ajuste.nota}` : '',
      ),
      h(
        'details',
        null,
        h('summary', null, 'Cambiar este día'),
        h(
          'div',
          { class: 'dia-cambios' },
          abre
            ? h('button', { class: 'boton linea pequeno', type: 'button', onclick: () => void guardar({ estado: 'cerrado' }) }, 'Cerrar este día')
            : h('button', { class: 'boton linea pequeno', type: 'button', onclick: () => void guardar({ estado: 'abierto' }) }, 'Abrir este día'),
          h('div', { class: 'campo' }, h('label', { for: `cupo-${d.fecha}` }, 'Pedidos web'), cupo),
          h('div', { class: 'campo ancha' }, h('label', { for: `nota-${d.fecha}` }, 'Nota (solo para la tienda)'), nota),
          h('button', { class: 'boton pequeno', type: 'button', onclick: () => void guardar({}) }, 'Guardar'),
          d.ajuste ? h('button', { class: 'enlace-boton', type: 'button', onclick: () => void guardar({ quitar: true }) }, 'Dejarlo como estaba') : null,
        ),
      ),
    );
  }

  /* ---------------- Presupuestos ---------------- */

  async function cargarPresupuestos(): Promise<void> {
    try {
      const r = await api<{ presupuestos: PresupuestoPanel[] }>('presupuestos');
      const lista = $('[data-lista-presupuestos]');
      if (!r.presupuestos.length) {
        lista.replaceChildren(h('p', { class: 'sin-pedidos' }, 'Todavía no ha llegado ninguna solicitud.'));
        return;
      }
      lista.replaceChildren(...r.presupuestos.map(tarjetaPresupuesto));
      quitarAviso();
    } catch (error) {
      avisar(error);
    }
  }

  function tarjetaPresupuesto(p: PresupuestoPanel): HTMLElement {
    const estado = h('select', { id: `pe-${p.ref}` }, ...Object.entries(ESTADOS_PRESUPUESTO).map(([id, nombre]) => h('option', { value: id, selected: id === p.estado }, nombre)));
    const nota = h('input', { type: 'text', maxlength: 500, value: p.notaInterna, id: `pn-${p.ref}`, autocomplete: 'off' });
    const guardar = async () => {
      try {
        await api(`presupuestos/${encodeURIComponent(p.ref)}`, { metodo: 'PATCH', cuerpo: { estado: estado.value, notaInterna: nota.value } });
        await Promise.all([cargarPresupuestos(), cargarPedidos(true)]);
      } catch (error) {
        avisar(error);
      }
    };
    return h(
      'article',
      { class: 'presupuesto', 'data-estado': p.estado },
      h(
        'div',
        { class: 'pedido-cabeza' },
        h('span', { class: 'pedido-ref' }, p.ref),
        h('span', { class: `etiqueta ${p.estado === 'nuevo' ? '' : 'gris'}` }, ESTADOS_PRESUPUESTO[p.estado] ?? p.estado),
        h('span', { class: 'etiqueta lima' }, p.tipoNombre),
      ),
      h('p', { class: 'pedido-dato' }, h('b', null, 'Recibida: '), horaMadrid(p.creado), p.fechaEvento ? ` · Fecha del evento: ${fechaLarga(p.fechaEvento, hoy)}` : ''),
      h(
        'p',
        { class: 'pedido-dato' },
        h('b', null, 'Contacto: '),
        p.nombre,
        ' · ',
        h('a', { href: enlaceTel(p.telefono) }, p.telefono),
        ' · ',
        h('a', { href: enlaceWa(p.telefono), rel: 'noopener', target: '_blank' }, 'WhatsApp'),
        p.email ? ' · ' : null,
        p.email ? h('a', { href: `mailto:${p.email}` }, p.email) : null,
      ),
      h('p', { class: 'presupuesto-mensaje' }, p.mensaje),
      h(
        'div',
        { class: 'en-linea' },
        h('div', { class: 'campo' }, h('label', { for: `pe-${p.ref}` }, 'Estado'), estado),
        h('div', { class: 'campo' }, h('label', { for: `pn-${p.ref}` }, 'Nota para la tienda'), nota),
        h('button', { class: 'boton pequeno', type: 'button', onclick: () => void guardar() }, 'Guardar'),
      ),
    );
  }

  /* ---------------- Ajustes ---------------- */

  interface EstadoTienda {
    entorno: string;
    baseDatos: boolean;
    pago: string | null;
    stripe: string | null;
    webhook: boolean;
    pedidosOnline: boolean;
    correo: boolean;
    motivos: string[];
    ultimoAvisoStripe: { tipo: string; fecha: string } | null;
    reglas: { horaLimite: string; cupoDiario: number; pagoEnTienda: boolean; diasDatosDestinatario: number | null };
  }

  async function cargarAjustes(): Promise<void> {
    const formExportar = $<HTMLFormElement>('[data-form-exportar]');
    const desde = formExportar.elements.namedItem('desde') as HTMLInputElement;
    const hasta = formExportar.elements.namedItem('hasta') as HTMLInputElement;
    if (!desde.value) desde.value = hoy.slice(0, 8) + '01';
    if (!hasta.value) hasta.value = hoy;
    try {
      const e = await api<EstadoTienda>('estado');
      const fila = (ok: boolean, texto: string) => h('li', null, h('span', { class: `marca ${ok ? 'ok' : 'falta'}` }, ok ? '✓' : '!'), h('span', null, texto));
      const pago =
        e.pago === 'stripe'
          ? e.stripe === 'live'
            ? 'Se cobra de verdad con Stripe.'
            : 'Stripe en modo de prueba: no se cobra de verdad.'
          : e.pago === 'simulado'
            ? 'Pago simulado: no se cobra nada.'
            : 'La web no puede cobrar: los encargos van por WhatsApp.';
      $('[data-estado-tienda]').replaceChildren(
        h(
          'ul',
          { class: 'diagnostico' },
          fila(true, e.entorno === 'produccion' ? 'Esta es la web pública.' : 'Esta es una vista de pruebas: aquí no hay pedidos reales.'),
          fila(e.pedidosOnline, e.pedidosOnline ? 'La web admite pedidos con pago.' : 'La web no admite pedidos con pago: funciona como catálogo.'),
          fila(e.pago !== null, pago),
          fila(e.pago !== 'stripe' || e.webhook, e.ultimoAvisoStripe ? `Último aviso de Stripe: ${horaMadrid(e.ultimoAvisoStripe.fecha)}.` : 'Todavía no ha llegado ningún aviso de Stripe.'),
          fila(e.correo, e.correo ? 'Los correos de aviso de pedido están activados.' : 'Sin correos propios de aviso: los pedidos se ven aquí y en los correos de Stripe.'),
          fila(
            true,
            `Reglas: hasta las ${e.reglas.horaLimite.replace(/^0/, '')} para el mismo día; ${e.reglas.cupoDiario} pedidos web al día; ` +
              (e.reglas.diasDatosDestinatario !== null ? `los datos de quien recibe las flores se borran a los ${e.reglas.diasDatosDestinatario} días.` : 'los datos de entrega no se borran.'),
          ),
        ),
        e.motivos.length ? h('ul', { class: 'ayuda-seccion' }, ...e.motivos.map((m) => h('li', null, m))) : null,
        h('p', { class: 'ayuda-seccion' }, 'Los precios, el horario, el reparto y estas reglas se cambian en el repositorio de la web (archivos de la carpeta «compartido»).'),
      );
      quitarAviso();
    } catch (error) {
      avisar(error);
    }
  }

  $<HTMLFormElement>('[data-form-exportar]').addEventListener('submit', (evento) => {
    evento.preventDefault();
    const formulario = evento.currentTarget as HTMLFormElement;
    const parametros = new URLSearchParams(new FormData(formulario) as unknown as Record<string, string>);
    // Es una descarga normal: el navegador manda la cookie de sesión y guarda el archivo.
    window.location.assign('/api/panel/exportar?' + parametros.toString());
  });

  void comprobarSesion();
}
