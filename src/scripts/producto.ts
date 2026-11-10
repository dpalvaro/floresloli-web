/* Ficha de producto: elegir opción, importe o modelo y añadir a la cesta. */

import { anadir } from './cesta.ts';
import type { LineaCesta } from './cesta.ts';

const formulario = document.querySelector<HTMLFormElement>('[data-compra]');

if (formulario) {
  const aMedida = formulario.dataset.aMedida === 'si';
  const numModelos = Number(formulario.dataset.modelos ?? 0);
  const cantidad = formulario.querySelector<HTMLInputElement>('#cantidad')!;
  const importe = formulario.querySelector<HTMLInputElement>('#importe');
  const error = formulario.querySelector<HTMLElement>('[data-error]')!;
  const anadido = formulario.querySelector<HTMLElement>('[data-anadido]')!;
  const precioVista = document.querySelector<HTMLElement>('[data-precio-vista]');
  const botonesImporte = [...formulario.querySelectorAll<HTMLButtonElement>('[data-importe]')];

  const limitar = (valor: number, min: number, max: number) => Math.min(max, Math.max(min, valor));
  const maxUnidades = Number(cantidad.max) || 20;

  formulario.querySelector('[data-menos]')?.addEventListener('click', () => {
    cantidad.value = String(limitar((Number(cantidad.value) || 1) - 1, 1, maxUnidades));
  });
  formulario.querySelector('[data-mas]')?.addEventListener('click', () => {
    cantidad.value = String(limitar((Number(cantidad.value) || 1) + 1, 1, maxUnidades));
  });

  // Al cambiar de tamaño, el precio grande cambia con él.
  for (const radio of formulario.querySelectorAll<HTMLInputElement>('input[name="variante"]')) {
    const pintar = () => {
      if (radio.checked && radio.dataset.precio && precioVista) precioVista.textContent = radio.dataset.precio;
    };
    radio.addEventListener('change', pintar);
    pintar();
  }

  const marcarImporte = () => {
    for (const boton of botonesImporte) boton.setAttribute('aria-pressed', String(boton.dataset.importe === importe?.value));
  };
  for (const boton of botonesImporte) {
    boton.addEventListener('click', () => {
      if (!importe) return;
      importe.value = boton.dataset.importe ?? '';
      marcarImporte();
      error.hidden = true;
    });
  }
  importe?.addEventListener('input', marcarImporte);

  // Desde la portada se llega con el importe ya elegido: /tienda/ramo-a-tu-medida/?importe=35
  const importeInicial = new URLSearchParams(location.search).get('importe');
  if (importe && importeInicial && /^\d{1,3}$/.test(importeInicial)) {
    importe.value = importeInicial;
    marcarImporte();
  }

  const fallo = (mensaje: string, campo?: HTMLElement | null) => {
    error.textContent = mensaje;
    error.hidden = false;
    anadido.hidden = true;
    campo?.focus();
  };

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    error.hidden = true;
    const datos = new FormData(formulario);
    const linea: LineaCesta = {
      id: formulario.dataset.id!,
      cantidad: limitar(Math.round(Number(cantidad.value)) || 1, 1, maxUnidades),
    };

    const variante = datos.get('variante');
    if (formulario.querySelector('input[name="variante"]')) {
      if (!variante) return fallo('Elige una opción.', formulario.querySelector<HTMLElement>('input[name="variante"]'));
      linea.variante = String(variante);
    }

    if (aMedida && importe) {
      const valor = Number(importe.value);
      const min = Number(importe.min);
      const max = Number(importe.max);
      if (!importe.value || !Number.isInteger(valor) || valor < min || valor > max) {
        return fallo(`Escribe un importe entre ${min} y ${max} €, sin céntimos.`, importe);
      }
      linea.importe = valor;
    }

    if (numModelos > 0) {
      const modelo = datos.get('modelo');
      if (!modelo) return fallo('Elige un modelo.', formulario.querySelector<HTMLElement>('input[name="modelo"]'));
      linea.modelo = Number(modelo);
    }

    const nota = String(datos.get('nota') ?? '').trim().slice(0, 200);
    if (nota) linea.nota = nota;

    anadir(linea);
    anadido.hidden = false;
    anadido.focus();
  });
}
