/* =====================================================================
   LA CESTA Y EL PEDIDO (página /pedido/)

   Dos maneras de terminar, con el mismo formulario:
   · «pago»: la tienda puede cobrar. Se manda el pedido a /api/pedidos, que
     recalcula todo y devuelve la dirección de la página de pago.
   · «whatsapp»: la tienda aún no cobra en la web, o algún producto de la
     cesta no tiene precio. El formulario escribe el encargo y abre WhatsApp.

   Los importes que se ven aquí son orientativos: los que valen los calcula
   el servidor.
   ===================================================================== */

import { ahoraEnMadrid, calendarioEntrega, fechaLarga } from '../../compartido/fechas.ts';
import type { DiaEntrega } from '../../compartido/fechas.ts';
import { euros, eurosDeCentimos } from '../../compartido/formato.ts';
import { NEGOCIO, SALUDO_WHATSAPP, enlaceWhatsApp } from '../../compartido/negocio.ts';
import { calcularLineas, validarPedido } from '../../compartido/pedido.ts';
import type { Errores, LineaCalculada, PedidoEntrada, ProductoCompra } from '../../compartido/pedido.ts';
import { TIENDA, nombreMetodo, precioEnvioCentimos, zonaDeCp } from '../../compartido/tienda.ts';
import type { MetodoEntrega } from '../../compartido/tienda.ts';
import { anadir, cambiarCantidad, claveLinea, leerCesta, quitar, vaciar } from './cesta.ts';
import type { LineaCesta } from './cesta.ts';

type Modo = 'pago' | 'tienda' | 'whatsapp';

interface EstadoTienda {
  pedidosOnline: boolean;
  pago: 'stripe' | 'simulado' | null;
  pagoEnTienda: boolean;
}

const CLAVE_FORMULARIO = 'floresloli.pedido.v1';
const CAMPOS_GUARDADOS = [
  'fecha', 'destNombre', 'calle', 'cp', 'localidad', 'destTelefono', 'entregaNota',
  'hospNombre', 'hospDetalle', 'dedicatoria', 'nombre', 'telefono', 'email', 'observaciones',
];

const MOTIVO_CORTO: Record<string, string> = {
  pasado: 'ya ha pasado',
  cerrado: 'cerrado',
  festivo: 'festivo',
  hora: 'ya es tarde para hoy',
  completo: 'completo',
  lejos: 'demasiado lejos',
};

const formulario = document.querySelector<HTMLFormElement>('[data-pedido]');
const datos = JSON.parse(document.getElementById('datos-pedido')?.textContent ?? '{}') as {
  catalogo: ProductoCompra[];
  complementos: string[];
};

if (formulario && datos.catalogo) iniciar(formulario, datos.catalogo, datos.complementos ?? []);

function iniciar(form: HTMLFormElement, catalogo: ProductoCompra[], idsComplementos: string[]): void {
  const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
  const vacia = $('[data-vacia]');
  const enviado = $('[data-enviado]');
  const listaLineas = $('[data-lineas]');
  const cajaComplementos = $('[data-complementos]');
  const listaComplementos = $('[data-lista-complementos]');
  const selectorFecha = $<HTMLSelectElement>('#fecha');
  const ayudaFecha = $('[data-ayuda-fecha]');
  const ayudaCp = $('[data-ayuda-cp]');
  const boton = $<HTMLButtonElement>('[data-enviar]');
  const fallo = $('[data-fallo]');
  const notaPago = $('[data-nota-pago]');
  const formaPago = $('[data-forma-pago]');
  const opcionHospital = $('[data-opcion-hospital]');
  const notaHospital = $('[data-nota-hospital]');
  const notaHospitalOriginal = [...notaHospital.childNodes].map((n) => n.cloneNode(true));

  const campo = (nombre: string) => form.elements.namedItem(nombre) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  const valor = (nombre: string) => (campo(nombre)?.value ?? '').trim();

  let tienda: EstadoTienda = { pedidosOnline: false, pago: null, pagoEnTienda: false };
  let dias: DiaEntrega[] = calendarioEntrega(ahoraEnMadrid(), new Map(), new Map(), 35);
  let enviando = false;

  /* ---------------- Lo que se guarda mientras se rellena ---------------- */

  interface Guardado {
    campos?: Record<string, string>;
    metodo?: string;
    /** Pedido creado en un intento anterior que no llegó a pagarse. */
    intento?: { ref: string; token: string } | null;
  }

  const leerGuardado = (): Guardado => {
    try {
      return JSON.parse(sessionStorage.getItem(CLAVE_FORMULARIO) ?? '{}') ?? {};
    } catch {
      return {};
    }
  };
  const escribirGuardado = (g: Guardado) => {
    try {
      sessionStorage.setItem(CLAVE_FORMULARIO, JSON.stringify(g));
    } catch {
      /* Sin almacenamiento de sesión: no pasa nada, solo no se recuerda el formulario. */
    }
  };
  const guardarFormulario = () => {
    const campos: Record<string, string> = {};
    for (const nombre of CAMPOS_GUARDADOS) campos[nombre] = campo(nombre)?.value ?? '';
    escribirGuardado({ ...leerGuardado(), campos, metodo: metodo() ?? '' });
  };

  /* ---------------- Lecturas ---------------- */

  const metodo = (): MetodoEntrega | undefined => {
    const elegido = form.querySelector<HTMLInputElement>('input[name="metodo"]:checked')?.value;
    return elegido === 'recogida' || elegido === 'domicilio' || elegido === 'hospital' ? elegido : undefined;
  };

  const calculo = () => calcularLineas(leerCesta(), catalogo, { fecha: selectorFecha.value || undefined, metodo: metodo() });

  /** Cómo se va a terminar este pedido, según lo que la tienda permite y lo que hay en la cesta. */
  const modo = (): Modo => {
    const conPrecio = !calculo().haySinPrecio;
    const puedeEnTienda = tienda.pagoEnTienda && conPrecio && metodo() === 'recogida';
    const puedeAhora = tienda.pedidosOnline && conPrecio;
    if (puedeAhora && puedeEnTienda) return form.querySelector<HTMLInputElement>('input[name="pago"]:checked')?.value === 'tienda' ? 'tienda' : 'pago';
    if (puedeAhora) return 'pago';
    if (puedeEnTienda) return 'tienda';
    return 'whatsapp';
  };

  const entradaDelPedido = (): PedidoEntrada => {
    const m = metodo();
    return {
      lineas: leerCesta(),
      entrega: { metodo: m as MetodoEntrega, fecha: selectorFecha.value, nota: m === 'domicilio' ? valor('entregaNota') : '' },
      destinatario: { nombre: m === 'hospital' ? valor('hospNombre') : m === 'domicilio' ? valor('destNombre') : '', telefono: m === 'domicilio' ? valor('destTelefono') : '' },
      direccion: { calle: valor('calle'), cp: valor('cp'), localidad: valor('localidad') },
      hospital: { detalle: valor('hospDetalle') },
      dedicatoria: campo('dedicatoria').value,
      comprador: { nombre: valor('nombre'), telefono: valor('telefono'), email: valor('email') },
      observaciones: campo('observaciones').value,
      acepta: (campo('acepta') as HTMLInputElement).checked,
      web: campo('web').value,
      sustituye: leerGuardado().intento ?? null,
    };
  };

  /* ---------------- Pintar ---------------- */

  const crear = <K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase?: string, texto?: string): HTMLElementTagNameMap[K] => {
    const e = document.createElement(etiqueta);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  };

  function pintarLineas(): void {
    const cesta = leerCesta();
    const hayCesta = cesta.length > 0;
    form.hidden = !hayCesta || !enviado.hidden;
    vacia.hidden = hayCesta || !enviado.hidden;
    listaLineas.replaceChildren();
    if (!hayCesta) return;

    for (const linea of cesta) {
      const clave = claveLinea(linea);
      const producto = catalogo.find((p) => p.id === linea.id);
      const calc = calcularLineas([linea], catalogo);
      const calculada: LineaCalculada | undefined = calc.lineas[0];
      const li = crear('li', 'linea');

      const texto = crear('div');
      if (producto) {
        const enlace = crear('a', 'linea-nombre', producto.nombre);
        enlace.href = `/tienda/${producto.id}/`;
        texto.append(enlace);
      } else texto.append(crear('span', 'linea-nombre', 'Producto que ya no está en la web'));
      if (calculada?.detalle) texto.append(crear('span', 'linea-detalle', calculada.detalle));
      if (linea.nota) texto.append(crear('span', 'linea-detalle', `«${linea.nota}»`));
      li.append(texto);

      const precio = crear('div', 'linea-precio');
      if (calculada && calculada.total !== null) precio.textContent = eurosDeCentimos(calculada.total);
      else if (calculada) {
        precio.classList.add('sin');
        precio.textContent = 'Precio por WhatsApp';
      }
      li.append(precio);

      const acciones = crear('div', 'linea-acciones');
      if (calculada) {
        const cantidad = crear('div', 'cantidad');
        const menos = crear('button', undefined, '−');
        menos.type = 'button';
        menos.setAttribute('aria-label', `Quitar una unidad de ${calculada.nombre}`);
        menos.addEventListener('click', () => cambiarCantidad(clave, linea.cantidad - 1));
        const cuenta = crear('output', undefined, String(linea.cantidad));
        cuenta.setAttribute('aria-label', 'Cantidad');
        const mas = crear('button', undefined, '+');
        mas.type = 'button';
        mas.setAttribute('aria-label', `Añadir una unidad de ${calculada.nombre}`);
        mas.disabled = linea.cantidad >= TIENDA.limites.unidadesPorLinea;
        mas.addEventListener('click', () => cambiarCantidad(clave, linea.cantidad + 1));
        cantidad.append(menos, cuenta, mas);
        acciones.append(cantidad);
      }
      const botonQuitar = crear('button', 'enlace-boton quitar', 'Quitar');
      botonQuitar.type = 'button';
      botonQuitar.setAttribute('aria-label', `Quitar ${calculada?.nombre ?? 'este producto'} de la cesta`);
      botonQuitar.addEventListener('click', () => quitar(clave));
      acciones.append(botonQuitar);
      li.append(acciones);

      if (!calculada && calc.errores[0]) li.append(crear('p', 'linea-error', calc.errores[0]));
      listaLineas.append(li);
    }
  }

  function pintarComplementos(): void {
    const enCesta = new Set(leerCesta().map((l) => l.id));
    const disponibles = catalogo.filter((p) => idsComplementos.includes(p.id) && !enCesta.has(p.id) && p.variantes.length === 0 && !p.aMedida);
    listaComplementos.replaceChildren();
    for (const p of disponibles) {
      const li = crear('li');
      const b = crear('button', undefined, p.precio !== null ? `+ ${p.nombre} · ${euros(p.precio)}` : `+ ${p.nombre}`);
      b.type = 'button';
      b.addEventListener('click', () => anadir({ id: p.id, cantidad: 1 }));
      li.append(b);
      listaComplementos.append(li);
    }
    cajaComplementos.hidden = disponibles.length === 0 || leerCesta().length === 0;
  }

  function pintarFechas(): void {
    const elegida = selectorFecha.value || leerGuardado().campos?.fecha || '';
    selectorFecha.replaceChildren();
    for (const dia of dias) {
      const opcion = crear('option', undefined, dia.disponible ? dia.etiqueta : `${dia.etiqueta} · ${MOTIVO_CORTO[dia.motivo ?? 'cerrado']}`);
      opcion.value = dia.fecha;
      opcion.disabled = !dia.disponible;
      selectorFecha.append(opcion);
    }
    const disponible = (fecha: string) => dias.some((d) => d.fecha === fecha && d.disponible);
    const primera = dias.find((d) => d.disponible)?.fecha ?? '';
    selectorFecha.value = disponible(elegida) ? elegida : primera;

    const hoy = dias[0];
    if (hoy && !hoy.disponible && hoy.motivo === 'hora') ayudaFecha.textContent = hoy.aviso ?? '';
    else if (hoy?.disponible) ayudaFecha.textContent = `Para hoy, pide antes de las ${TIENDA.horaLimiteMismoDia.replace(/^0/, '')}.`;
    else ayudaFecha.textContent = 'Los domingos y festivos la tienda cierra.';
  }

  function pintarSecciones(): void {
    const m = metodo();
    for (const seccion of form.querySelectorAll<HTMLElement>('[data-solo]')) seccion.hidden = seccion.dataset.solo !== m;

    // El hospital no se ofrece si algún producto de la cesta no se puede llevar allí.
    const cesta = leerCesta();
    const noVan = cesta.map((l) => catalogo.find((p) => p.id === l.id)).filter((p) => p && !p.hospital);
    const radioHospital = opcionHospital.querySelector<HTMLInputElement>('input')!;
    radioHospital.disabled = noVan.length > 0;
    if (noVan.length > 0) {
      if (radioHospital.checked) radioHospital.checked = false;
      notaHospital.textContent = `No disponible con «${noVan[0]!.nombre}» en la cesta.`;
    } else notaHospital.replaceChildren(...notaHospitalOriginal.map((n) => n.cloneNode(true)));
  }

  function pintarZona(): void {
    const cp = valor('cp');
    ayudaCp.textContent = '';
    delete ayudaCp.dataset.tipo;
    if (metodo() !== 'domicilio' || !/^\d{5}$/.test(cp)) return;
    const zona = zonaDeCp(cp);
    if (zona && zona.precio !== null) {
      ayudaCp.textContent = `Reparto en ${zona.nombre}: ${euros(zona.precio)}.`;
      ayudaCp.dataset.tipo = 'bien';
      if (!valor('localidad') && zona.id === 'toledo') campo('localidad').value = 'Toledo';
    } else {
      ayudaCp.textContent =
        modo() === 'whatsapp'
          ? 'Fuera de Toledo capital el reparto depende de la distancia: te decimos el precio por WhatsApp.'
          : TIENDA.entrega.domicilio.fueraDeZona;
      ayudaCp.dataset.tipo = 'aviso';
    }
  }

  function pintarResumen(): void {
    const calc = calculo();
    const m = metodo();
    const elModo = modo();
    const envio = m ? precioEnvioCentimos(m, valor('cp')) : null;

    $('[data-subtotal]').textContent = calc.haySinPrecio ? (calc.subtotal > 0 ? `${eurosDeCentimos(calc.subtotal)} + lo que falta` : 'Por WhatsApp') : eurosDeCentimos(calc.subtotal);
    $('[data-rotulo-envio]').textContent = m ? nombreMetodo(m) : 'Entrega';
    $('[data-envio]').textContent = !m ? 'Elige cómo lo recibes' : envio === null ? (/^\d{5}$/.test(valor('cp')) ? 'Por WhatsApp' : 'Escribe el código postal') : envio === 0 ? 'Gratis' : eurosDeCentimos(envio);
    const totalConocido = !calc.haySinPrecio && envio !== null;
    $('[data-total]').textContent = totalConocido ? eurosDeCentimos(calc.subtotal + envio) : 'Te lo confirmamos';
    $('[data-iva]').hidden = !totalConocido;

    // Elegir entre pagar ahora o al recoger: solo cuando las dos cosas son posibles.
    formaPago.hidden = !(tienda.pedidosOnline && tienda.pagoEnTienda && !calc.haySinPrecio && m === 'recogida');

    for (const e of form.querySelectorAll<HTMLElement>('[data-solo-modo]')) e.hidden = elModo === 'whatsapp';

    boton.classList.toggle('wa', elModo === 'whatsapp');
    if (enviando) return;
    if (elModo === 'pago') {
      boton.textContent = totalConocido ? `Pagar ${eurosDeCentimos(calc.subtotal + envio)}` : 'Pagar';
      notaPago.textContent =
        tienda.pago === 'simulado'
          ? 'Vista de pruebas: el pago es simulado y no se cobra nada.'
          : `Pagas con tarjeta${TIENDA.pago.bizum ? ' o con Bizum' : ''} en una página segura de Stripe. La tienda no ve los datos de tu tarjeta.`;
    } else if (elModo === 'tienda') {
      boton.textContent = 'Hacer el pedido';
      notaPago.textContent = 'Lo pagas al recogerlo en la tienda.';
    } else {
      boton.textContent = 'Enviar el encargo por WhatsApp';
      notaPago.textContent = calc.haySinPrecio
        ? 'Te contestamos por WhatsApp con el precio y lo confirmas antes de que lo preparemos.'
        : 'Se abre WhatsApp con el encargo ya escrito. Te contestamos para confirmarlo.';
    }
  }

  function pintarCuenta(): void {
    const texto = campo('dedicatoria').value;
    const max = TIENDA.limites.dedicatoria;
    $('[data-cuenta-dedicatoria]').textContent = texto.length > max * 0.7 ? `Te quedan ${max - texto.length} caracteres.` : '';
  }

  function pintarTodo(): void {
    pintarLineas();
    pintarComplementos();
    pintarSecciones();
    pintarZona();
    pintarResumen();
    pintarCuenta();
  }

  function pintarErrores(errores: Errores): void {
    let primero: HTMLElement | null = null;
    for (const hueco of form.querySelectorAll<HTMLElement>('[data-error-de]')) {
      const mensaje = errores[hueco.dataset.errorDe!];
      // El propio hueco está oculto mientras no hay error: se mira si lo está la sección que lo contiene.
      const visible = !hueco.parentElement?.closest('[hidden]');
      hueco.textContent = mensaje && visible ? mensaje : '';
      hueco.hidden = !(mensaje && visible);
    }
    for (const control of form.querySelectorAll<HTMLElement>('[data-campo]')) {
      const mensaje = errores[control.dataset.campo!];
      const visible = !control.closest('[hidden]');
      if (mensaje && visible) {
        control.setAttribute('aria-invalid', 'true');
        primero ??= control;
      } else control.removeAttribute('aria-invalid');
    }
    if (errores['lineas'] && !primero) listaLineas.scrollIntoView({ block: 'center' });
    primero?.focus();
  }

  function mostrarFallo(mensaje: string, conWhatsApp = false): void {
    fallo.replaceChildren(document.createTextNode(mensaje));
    if (conWhatsApp) {
      const enlace = crear('a', undefined, 'Enviar el encargo por WhatsApp');
      enlace.href = enlaceWhatsApp(textoWhatsApp());
      enlace.rel = 'noopener';
      fallo.append(document.createTextNode(' '), enlace, document.createTextNode(` o llamar al ${NEGOCIO.telefono}.`));
    }
    fallo.hidden = false;
  }

  /* ---------------- WhatsApp ---------------- */

  function textoWhatsApp(): string {
    const calc = calculo();
    const m = metodo();
    const cesta = leerCesta();
    const lineas = cesta.map((linea) => {
      const c = calcularLineas([linea], catalogo).lineas[0];
      if (!c) return '';
      const precio = c.total !== null ? `: ${eurosDeCentimos(c.total)}` : '';
      return `· ${c.cantidad} × ${c.nombre}${c.detalle ? ` (${c.detalle})` : ''}${precio}${c.nota ? `\n  ${c.nota}` : ''}`;
    });

    const partes = [`${SALUDO_WHATSAPP}.`, lineas.filter(Boolean).join('\n')];

    const entrega: string[] = [];
    if (m) entrega.push(`${nombreMetodo(m)}${selectorFecha.value ? `, el ${fechaLarga(selectorFecha.value)}` : ''}.`);
    if (m === 'domicilio') {
      const direccion = [valor('calle'), [valor('cp'), valor('localidad')].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      if (valor('destNombre')) entrega.push(`Para: ${valor('destNombre')}${valor('destTelefono') ? ` (tel. ${valor('destTelefono')})` : ''}`);
      if (direccion) entrega.push(`Dirección: ${direccion}`);
      if (valor('entregaNota')) entrega.push(`Indicaciones: ${valor('entregaNota')}`);
    }
    if (m === 'hospital') {
      if (valor('hospNombre')) entrega.push(`Para: ${valor('hospNombre')}`);
      if (valor('hospDetalle')) entrega.push(`Planta y habitación: ${valor('hospDetalle')}`);
    }
    partes.push(entrega.join('\n'));

    if (valor('dedicatoria')) partes.push(`Dedicatoria: «${valor('dedicatoria')}»`);
    if (valor('observaciones')) partes.push(`Observaciones: ${valor('observaciones')}`);
    if (!calc.haySinPrecio && calc.subtotal > 0) {
      const envio = m ? precioEnvioCentimos(m, valor('cp')) : null;
      partes.push(envio !== null ? `Total según la web: ${eurosDeCentimos(calc.subtotal + envio)}` : `Productos según la web: ${eurosDeCentimos(calc.subtotal)}`);
    }
    if (valor('nombre')) partes.push(`Mi nombre: ${valor('nombre')}`);
    return partes.filter(Boolean).join('\n\n');
  }

  function validarParaWhatsApp(): Errores {
    const e: Errores = {};
    const m = metodo();
    const calc = calculo();
    if (calc.errores.length) e['lineas'] = calc.errores.join(' ');
    if (!m) e['entrega.metodo'] = 'Elige cómo quieres recibirlo.';
    if (!selectorFecha.value) e['entrega.fecha'] = 'Elige el día.';
    if (m === 'domicilio') {
      if (valor('destNombre').length < 2) e['destinatario.nombre'] = 'Escribe el nombre de quien lo recibe.';
      if (valor('calle').length < 5) e['direccion.calle'] = 'Escribe la calle, el número y el piso.';
    }
    if (m === 'hospital' && valor('hospNombre').length < 2) e['destinatario.nombre'] = 'Escribe el nombre de la persona ingresada.';
    if (valor('nombre').length < 2) e['comprador.nombre'] = 'Escribe tu nombre.';
    return e;
  }

  function enviarPorWhatsApp(): void {
    const errores = validarParaWhatsApp();
    pintarErrores(errores);
    if (Object.keys(errores).length) return;
    const direccion = enlaceWhatsApp(textoWhatsApp());
    $<HTMLAnchorElement>('[data-enlace-whatsapp]').href = direccion;
    // En el móvil abre la aplicación; en el ordenador, WhatsApp Web en otra pestaña.
    const ventana = window.open(direccion, '_blank', 'noopener');
    enviado.hidden = false;
    form.hidden = true;
    enviado.focus();
    if (!ventana) window.location.href = direccion;
  }

  /* ---------------- Pago ---------------- */

  async function enviarPedido(pagarEnTienda: boolean): Promise<void> {
    const entrada = entradaDelPedido();
    if (pagarEnTienda) entrada.pagoEnTienda = true;

    const validacion = validarPedido(entrada, catalogo);
    if (!validacion.ok) {
      pintarErrores(validacion.errores);
      return;
    }
    const dia = dias.find((d) => d.fecha === entrada.entrega.fecha);
    if (dia && !dia.disponible) {
      pintarErrores({ 'entrega.fecha': dia.aviso ?? 'Ese día no está disponible.' });
      return;
    }
    pintarErrores({});

    enviando = true;
    boton.disabled = true;
    boton.textContent = pagarEnTienda ? 'Enviando el pedido…' : 'Abriendo la página de pago…';
    try {
      const respuesta = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entrada),
      });
      const cuerpo = (await respuesta.json().catch(() => ({}))) as {
        ref?: string;
        token?: string;
        url?: string;
        mensaje?: string;
        errores?: Errores;
        porWhatsApp?: boolean;
      };

      if (respuesta.status === 201 && cuerpo.url && cuerpo.ref && cuerpo.token) {
        escribirGuardado({ ...leerGuardado(), intento: { ref: cuerpo.ref, token: cuerpo.token } });
        window.location.assign(cuerpo.url);
        return; // El botón se queda desactivado mientras se carga la página de pago.
      }

      if (cuerpo.errores) pintarErrores(cuerpo.errores);
      if (respuesta.status === 409) await cargarDisponibilidad();
      if (cuerpo.porWhatsApp || respuesta.status === 503) {
        tienda = { ...tienda, pedidosOnline: false, pagoEnTienda: false };
        mostrarFallo(cuerpo.mensaje ?? 'Ahora mismo no podemos cobrar en la web.', true);
      } else mostrarFallo(cuerpo.mensaje ?? 'No hemos podido hacer el pedido. Inténtalo de nuevo.', respuesta.status >= 500);
    } catch {
      mostrarFallo('No se ha podido enviar: parece que no hay conexión.', true);
    }
    enviando = false;
    boton.disabled = false;
    pintarResumen();
  }

  /* ---------------- Datos del servidor ---------------- */

  async function cargarEstado(): Promise<void> {
    try {
      const r = await fetch('/api/estado', { headers: { Accept: 'application/json' } });
      if (r.ok) tienda = (await r.json()) as EstadoTienda;
    } catch {
      /* Sin API (web sin funciones o sin conexión): los encargos van por WhatsApp. */
    }
  }

  async function cargarDisponibilidad(): Promise<void> {
    try {
      const r = await fetch('/api/disponibilidad', { headers: { Accept: 'application/json' } });
      if (r.ok) {
        const cuerpo = (await r.json()) as { dias?: DiaEntrega[] };
        if (Array.isArray(cuerpo.dias) && cuerpo.dias.length) dias = cuerpo.dias;
      }
    } catch {
      /* Se queda con el calendario calculado en el navegador (horario y festivos, sin cupo). */
    }
    pintarFechas();
  }

  /* ---------------- Arranque ---------------- */

  const guardado = leerGuardado();
  for (const [nombre, texto] of Object.entries(guardado.campos ?? {})) {
    const c = campo(nombre);
    if (c && nombre !== 'fecha' && typeof texto === 'string') c.value = texto;
  }
  if (guardado.metodo) {
    const radio = form.querySelector<HTMLInputElement>(`input[name="metodo"][value="${CSS.escape(guardado.metodo)}"]`);
    if (radio) radio.checked = true;
  }
  $('[data-cancelado]').hidden = new URLSearchParams(location.search).get('cancelado') !== '1';

  pintarFechas();
  pintarTodo();
  void Promise.all([cargarEstado(), cargarDisponibilidad()]).then(pintarTodo);

  form.addEventListener('input', (evento) => {
    // Al corregir un campo, se le quita la marca de error.
    const control = evento.target as HTMLElement;
    if (control.dataset?.campo) {
      control.removeAttribute('aria-invalid');
      for (const hueco of form.querySelectorAll<HTMLElement>(`[data-error-de="${control.dataset.campo}"]`)) hueco.hidden = true;
    }
    guardarFormulario();
    pintarZona();
    pintarResumen();
    pintarCuenta();
  });
  form.addEventListener('change', () => {
    guardarFormulario();
    pintarSecciones();
    pintarZona();
    pintarResumen();
  });
  window.addEventListener('cesta:cambio', pintarTodo);
  window.addEventListener('storage', pintarTodo);
  // Al volver atrás desde la página de pago, el navegador puede enseñar la página guardada con el botón desactivado.
  window.addEventListener('pageshow', (evento) => {
    if (!evento.persisted) return;
    enviando = false;
    boton.disabled = false;
    pintarTodo();
  });

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (enviando) return;
    fallo.hidden = true;
    const elModo = modo();
    if (elModo === 'whatsapp') enviarPorWhatsApp();
    else void enviarPedido(elModo === 'tienda');
  });

  $('[data-vaciar]').addEventListener('click', () => {
    vaciar();
    try {
      sessionStorage.removeItem(CLAVE_FORMULARIO);
    } catch {
      /* nada */
    }
    enviado.hidden = true;
    pintarTodo();
  });
}
