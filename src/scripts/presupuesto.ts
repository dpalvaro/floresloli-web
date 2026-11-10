/* Formulario de presupuesto: valida, envía a la API y, si la API no está, ofrece WhatsApp. */

import { NEGOCIO, SALUDO_WHATSAPP, enlaceWhatsApp } from '../../compartido/negocio.ts';
import { TIPOS_PRESUPUESTO, emailValido, normalizarTelefono } from '../../compartido/pedido.ts';
import { fechaLarga } from '../../compartido/fechas.ts';

const formulario = document.querySelector<HTMLFormElement>('[data-presupuesto]');

if (formulario) {
  const fallo = formulario.querySelector<HTMLElement>('[data-fallo]')!;
  const enviado = document.querySelector<HTMLElement>('[data-enviado]')!;
  const boton = formulario.querySelector<HTMLButtonElement>('button[type="submit"]')!;

  const campo = (nombre: string) => formulario.elements.namedItem(nombre) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

  const pintarErrores = (errores: Record<string, string>) => {
    let primero: HTMLElement | null = null;
    for (const hueco of formulario.querySelectorAll<HTMLElement>('[data-error-de]')) {
      const nombre = hueco.dataset.errorDe!;
      const mensaje = errores[nombre];
      const control = campo(nombre);
      hueco.textContent = mensaje ?? '';
      hueco.hidden = !mensaje;
      control?.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
      if (mensaje && !primero) primero = control;
    }
    primero?.focus();
  };

  const leer = () => ({
    tipo: campo('tipo').value,
    fecha: campo('fecha').value,
    mensaje: campo('mensaje').value.trim(),
    nombre: campo('nombre').value.trim(),
    telefono: campo('telefono').value.trim(),
    email: campo('email').value.trim(),
    acepta: (campo('acepta') as HTMLInputElement).checked,
    web: campo('web').value,
  });

  const validar = (d: ReturnType<typeof leer>) => {
    const errores: Record<string, string> = {};
    if (!d.tipo) errores.tipo = 'Elige para qué es.';
    if (d.mensaje.length < 10) errores.mensaje = 'Cuéntanos qué necesitas, aunque sea en dos líneas.';
    if (d.nombre.length < 2) errores.nombre = 'Escribe tu nombre.';
    if (!normalizarTelefono(d.telefono)) errores.telefono = 'Escribe un teléfono válido, con sus 9 cifras.';
    if (d.email && !emailValido(d.email)) errores.email = 'Ese correo no parece válido. Revísalo o déjalo en blanco.';
    if (!d.acepta) errores.acepta = 'Marca la casilla para aceptar la política de privacidad.';
    return errores;
  };

  /** Si la web no puede recoger la solicitud, se manda la misma información por WhatsApp. */
  const ofrecerWhatsApp = (d: ReturnType<typeof leer>, motivo: string) => {
    const tipo = TIPOS_PRESUPUESTO.find((t) => t.id === d.tipo)?.nombre ?? '';
    const texto = [
      `${SALUDO_WHATSAPP}. Quiero un presupuesto.`,
      tipo ? `Para: ${tipo}` : '',
      d.fecha ? `Fecha: ${fechaLarga(d.fecha)}` : '',
      d.mensaje,
      `Nombre: ${d.nombre}`,
    ]
      .filter(Boolean)
      .join('\n');
    fallo.replaceChildren(
      document.createTextNode(motivo + ' '),
      Object.assign(document.createElement('a'), { href: enlaceWhatsApp(texto), rel: 'noopener', textContent: 'Enviarla por WhatsApp' }),
      document.createTextNode(` o llamar al ${NEGOCIO.telefono}.`),
    );
    fallo.hidden = false;
  };

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    fallo.hidden = true;
    const datos = leer();
    const errores = validar(datos);
    pintarErrores(errores);
    if (Object.keys(errores).length) return;

    boton.disabled = true;
    boton.textContent = 'Enviando…';
    try {
      const respuesta = await fetch('/api/presupuestos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      const cuerpo = (await respuesta.json().catch(() => ({}))) as { ref?: string; errores?: Record<string, string>; mensaje?: string };
      if (respuesta.status === 201 && cuerpo.ref) {
        formulario.hidden = true;
        enviado.hidden = false;
        enviado.querySelector('[data-referencia]')!.textContent = `Referencia: ${cuerpo.ref}`;
        enviado.focus();
        return;
      }
      if (respuesta.status === 422 && cuerpo.errores) {
        pintarErrores(cuerpo.errores);
        return;
      }
      if (respuesta.status === 429) {
        fallo.textContent = cuerpo.mensaje ?? 'Has enviado varias solicitudes seguidas. Espera un rato o llámanos.';
        fallo.hidden = false;
        return;
      }
      ofrecerWhatsApp(datos, 'Ahora mismo no podemos recoger la solicitud aquí.');
    } catch {
      ofrecerWhatsApp(datos, 'No se ha podido enviar: parece que no hay conexión.');
    } finally {
      boton.disabled = false;
      boton.textContent = 'Enviar la solicitud';
    }
  });
}
