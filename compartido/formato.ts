/* Cómo se escriben los importes. Sin dependencias: lo usan el servidor y el navegador. */

/** «30 €», «12,50 €» */
export function euros(cantidad: number): string {
  const texto = Number.isInteger(cantidad) ? String(cantidad) : cantidad.toFixed(2).replace('.', ',');
  return texto + ' €';
}

/** Céntimos → «43,00 €» */
export function eurosDeCentimos(centimos: number): string {
  const signo = centimos < 0 ? '-' : '';
  const abs = Math.abs(Math.round(centimos));
  return `${signo}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')} €`;
}
