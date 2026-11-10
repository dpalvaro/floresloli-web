/* Comportamiento común a todas las páginas: menú, contador de la cesta y «abierto ahora». */

import { ahoraEnMadrid, estadoApertura } from '../../compartido/fechas.ts';
import { unidades } from './cesta.ts';

/* ---------- Menú ---------- */

const cabecera = document.querySelector<HTMLElement>('[data-cabecera]');
const botonMenu = document.querySelector<HTMLButtonElement>('[data-abrir-menu]');
const submenus = [...document.querySelectorAll<HTMLButtonElement>('[data-submenu]')];
const escritorio = window.matchMedia('(min-width: 1000px)');

function cerrarSubmenus(excepto?: HTMLButtonElement): void {
  for (const boton of submenus) if (boton !== excepto) boton.setAttribute('aria-expanded', 'false');
}

function cerrarMenu(): void {
  if (!cabecera) return;
  cabecera.removeAttribute('data-abierto');
  botonMenu?.setAttribute('aria-expanded', 'false');
}

botonMenu?.addEventListener('click', () => {
  if (!cabecera) return;
  const abrir = !cabecera.hasAttribute('data-abierto');
  cabecera.toggleAttribute('data-abierto', abrir);
  botonMenu.setAttribute('aria-expanded', String(abrir));
  if (!abrir) cerrarSubmenus();
});

for (const boton of submenus) {
  boton.addEventListener('click', () => {
    const abrir = boton.getAttribute('aria-expanded') !== 'true';
    cerrarSubmenus(boton);
    boton.setAttribute('aria-expanded', String(abrir));
  });
}

document.addEventListener('keydown', (evento) => {
  if (evento.key !== 'Escape') return;
  const abierto = submenus.find((b) => b.getAttribute('aria-expanded') === 'true');
  cerrarSubmenus();
  if (abierto) abierto.focus();
  else if (cabecera?.hasAttribute('data-abierto')) {
    cerrarMenu();
    botonMenu?.focus();
  }
});

document.addEventListener('click', (evento) => {
  const destino = evento.target as Node;
  // En escritorio, pulsar fuera cierra el desplegable abierto.
  if (escritorio.matches && !submenus.some((b) => b.parentElement?.contains(destino))) cerrarSubmenus();
  if (!escritorio.matches && cabecera?.hasAttribute('data-abierto') && !cabecera.contains(destino)) cerrarMenu();
});

escritorio.addEventListener('change', () => {
  cerrarSubmenus();
  cerrarMenu();
});

/* ---------- Contador de la cesta ---------- */

function pintarCesta(): void {
  const total = unidades();
  for (const cuenta of document.querySelectorAll<HTMLElement>('[data-cesta-cuenta]')) {
    cuenta.hidden = total === 0;
    cuenta.textContent = String(total);
  }
  for (const enlace of document.querySelectorAll<HTMLElement>('[data-cesta-enlace] .solo-lectores')) {
    enlace.textContent = total === 0 ? 'Tu cesta, vacía' : `Tu cesta: ${total} ${total === 1 ? 'artículo' : 'artículos'}`;
  }
}

pintarCesta();
window.addEventListener('cesta:cambio', pintarCesta);
window.addEventListener('storage', pintarCesta);
window.addEventListener('pageshow', pintarCesta);

/* ---------- «Abierto ahora» ---------- */

function pintarApertura(): void {
  const estado = estadoApertura(ahoraEnMadrid());
  for (const elemento of document.querySelectorAll<HTMLElement>('[data-apertura]')) {
    elemento.textContent = estado.texto;
    elemento.dataset.abierta = String(estado.abierta);
  }
}

if (document.querySelector('[data-apertura]')) {
  pintarApertura();
  window.setInterval(pintarApertura, 60_000);
}
