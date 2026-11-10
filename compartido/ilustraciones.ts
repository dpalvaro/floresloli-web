/* =====================================================================
   ILUSTRACIONES de producto, dibujadas con código.

   Se usan mientras un producto no tiene foto real (fotos: [] en el
   catálogo). Son dibujos propios, sin derechos de terceros. Cada producto
   sale siempre igual: el dibujo depende de su id.
   ===================================================================== */

import type { Ilustracion, FlorIlustracion } from './catalogo.ts';

const VERDE = '#4F8A4B';
const VERDE_OSC = '#3B6E3F';
const VERDE_CLARO = '#8DBB6E';
const FONDOS = ['#ECE8F6', '#EEF4D3', '#F8E9EF', '#F5EFE0', '#E6F0EC'];

/* ---------- Utilidades ---------- */

function semilla(texto: string): () => number {
  let h = 1779033703 ^ texto.length;
  for (let i = 0; i < texto.length; i++) {
    h = Math.imul(h ^ texto.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mezclar(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

const oscuro = (hex: string, t = 0.18) => mezclar(hex, '#2B2350', t);
const claro = (hex: string, t = 0.3) => mezclar(hex, '#FFFFFF', t);

/** ¿Es un color muy claro (blanco, crema)? Entonces necesita un borde para verse. */
function esClaro(hex: string): boolean {
  const [r, g, b] = rgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 228;
}

const n = (x: number) => (Math.round(x * 10) / 10).toString();

function en(x: number, y: number, giro: number, escala: number, contenido: string): string {
  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)}) scale(${n(escala)})">${contenido}</g>`;
}

/* ---------- Hojas y tallos ---------- */

function hoja(largo: number, ancho: number, color: string): string {
  return `<path d="M0 0Q${n(largo * 0.45)} ${n(-ancho)} ${n(largo)} 0Q${n(largo * 0.45)} ${n(ancho)} 0 0Z" fill="${color}"/>`;
}

function hojaRedonda(r: number, color: string): string {
  return `<path d="M0 0C${n(-r)} ${n(-r * 0.4)} ${n(-r * 0.9)} ${n(-r * 1.5)} 0 ${n(-r * 1.7)}C${n(r * 0.9)} ${n(-r * 1.5)} ${n(r)} ${n(-r * 0.4)} 0 0Z" fill="${color}"/>`;
}

/* ---------- Flores (centradas en 0,0; radio 1 = 50 px) ---------- */

function florRosa(color: string): string {
  const borde = esClaro(color) ? ` stroke="${oscuro(color, 0.14)}" stroke-width="1.5"` : '';
  return (
    `<circle r="50" fill="${color}"${borde}/>` +
    `<path d="M-34 6A36 36 0 0 1 20 -30A30 30 0 0 0 -34 6Z" fill="${oscuro(color, 0.16)}"/>` +
    `<path d="M34 -4A36 36 0 0 1 -18 32A30 30 0 0 0 34 -4Z" fill="${oscuro(color, 0.1)}"/>` +
    `<circle r="17" fill="${oscuro(color, 0.24)}"/>` +
    `<path d="M-9 3A10 10 0 0 1 9 -3" fill="none" stroke="${claro(color, 0.25)}" stroke-width="4" stroke-linecap="round"/>`
  );
}

function florMargarita(color: string, centro = '#F2C230', petalos = 12): string {
  const borde = esClaro(color) ? ` stroke="${oscuro(color, 0.16)}" stroke-width="1.2"` : '';
  let s = '';
  for (let i = 0; i < petalos; i++) {
    s += `<ellipse cx="0" cy="-31" rx="10.5" ry="20" fill="${color}"${borde} transform="rotate(${n((360 / petalos) * i)})"/>`;
  }
  return s + `<circle r="14" fill="${centro}"/><circle r="6" fill="${oscuro(centro, 0.22)}"/>`;
}

function florGirasol(color: string): string {
  let s = '';
  for (let i = 0; i < 18; i++) {
    s += `<path d="M0 -20Q9 -38 0 -52Q-9 -38 0 -20Z" fill="${i % 2 ? color : oscuro(color, 0.08)}" transform="rotate(${i * 20})"/>`;
  }
  return s + `<circle r="23" fill="#5A3A22"/><circle r="13" fill="#3F2716"/>`;
}

function florClavel(color: string): string {
  const borde = esClaro(color) ? ` stroke="${oscuro(color, 0.16)}" stroke-width="1.2"` : '';
  let s = '';
  for (let i = 0; i < 10; i++) s += `<circle cx="0" cy="-34" r="16" fill="${color}"${borde} transform="rotate(${i * 36})"/>`;
  for (let i = 0; i < 7; i++) s += `<circle cx="0" cy="-19" r="13" fill="${oscuro(color, 0.08)}" transform="rotate(${i * 51 + 20})"/>`;
  return s + `<circle r="13" fill="${oscuro(color, 0.16)}"/>`;
}

function florLirio(color: string): string {
  const borde = esClaro(color) ? ` stroke="${oscuro(color, 0.18)}" stroke-width="1.2"` : '';
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += `<path d="M0 0Q16 -26 0 -54Q-16 -26 0 0Z" fill="${i % 2 ? color : oscuro(color, 0.07)}"${borde} transform="rotate(${i * 60})"/>`;
  }
  for (let i = 0; i < 5; i++) s += `<circle cx="0" cy="-15" r="3.4" fill="#C9772B" transform="rotate(${i * 72 + 15})"/>`;
  return s + `<circle r="5" fill="${VERDE_CLARO}"/>`;
}

/** Tulipán de perfil, con la base en 0,0 y la flor hacia arriba. */
function florTulipan(color: string): string {
  return (
    `<path d="M-24 -6C-28 -40 -18 -58 -12 -66C-8 -54 -4 -50 0 -70C4 -50 8 -54 12 -66C18 -58 28 -40 24 -6C14 6 -14 6 -24 -6Z" fill="${color}"/>` +
    `<path d="M0 -70C-9 -46 -9 -18 0 2C9 -18 9 -46 0 -70Z" fill="${oscuro(color, 0.12)}"/>`
  );
}

function florOrquidea(color: string): string {
  const borde = esClaro(color) ? ` stroke="${oscuro(color, 0.2)}" stroke-width="1.3"` : '';
  return (
    `<ellipse cx="-27" cy="-6" rx="25" ry="20" fill="${color}"${borde}/>` +
    `<ellipse cx="27" cy="-6" rx="25" ry="20" fill="${color}"${borde}/>` +
    `<path d="M0 -4Q13 -30 0 -50Q-13 -30 0 -4Z" fill="${color}"${borde}/>` +
    `<path d="M0 0Q22 18 13 40Q4 26 0 0Z" fill="${color}"${borde}/>` +
    `<path d="M0 0Q-22 18 -13 40Q-4 26 0 0Z" fill="${color}"${borde}/>` +
    `<path d="M0 -3C10 2 10 16 0 22C-10 16 -10 2 0 -3Z" fill="#C2408A"/>` +
    `<circle cy="-2" r="5" fill="#F2C230"/>`
  );
}

/** Espata de anturio o espatifilo, con el tallo saliendo por abajo. */
function florAnturio(color: string): string {
  const borde = esClaro(color) ? ` stroke="${oscuro(color, 0.2)}" stroke-width="1.4"` : '';
  return (
    `<path d="M0 30C-44 8 -44 -40 0 -62C44 -40 44 8 0 30Z" fill="${color}"${borde}/>` +
    `<path d="M-2 14Q-8 -18 6 -38" fill="none" stroke="${esClaro(color) ? '#E9D58A' : '#F6E7A8'}" stroke-width="8" stroke-linecap="round"/>`
  );
}

function florPascua(color: string): string {
  let s = '';
  for (let i = 0; i < 7; i++) {
    s += `<path d="M0 0Q20 -24 0 -58Q-20 -24 0 0Z" fill="${i % 2 ? color : oscuro(color, 0.12)}" transform="rotate(${n((360 / 7) * i)})"/>`;
  }
  for (let i = 0; i < 5; i++) s += `<circle cx="0" cy="-7" r="3.6" fill="#F2C230" transform="rotate(${i * 72})"/>`;
  return s;
}

function florSuculenta(color: string): string {
  let s = '';
  const capas: [number, number, string][] = [
    [8, 52, oscuro(color, 0.1)],
    [7, 38, color],
    [5, 24, claro(color, 0.25)],
  ];
  capas.forEach(([cuantas, largo, c], k) => {
    for (let i = 0; i < cuantas; i++) {
      s += `<path d="M0 0Q${n(largo * 0.34)} ${n(-largo * 0.5)} 0 ${n(-largo)}Q${n(-largo * 0.34)} ${n(-largo * 0.5)} 0 0Z" fill="${c}" transform="rotate(${n((360 / cuantas) * i + k * 22)})"/>`;
    }
  });
  return s + `<circle r="6" fill="${claro(color, 0.45)}"/>`;
}

function florRedonda(color: string): string {
  const borde = esClaro(color) ? ` stroke="${oscuro(color, 0.16)}" stroke-width="1.2"` : '';
  let s = '';
  for (let i = 0; i < 8; i++) s += `<circle cx="0" cy="-28" r="20" fill="${color}"${borde} transform="rotate(${i * 45})"/>`;
  return s + `<circle r="19" fill="${oscuro(color, 0.1)}"/><circle r="8" fill="${claro(color, 0.4)}"/>`;
}

/** Espiga (lavanda, trigo): tallo vertical desde 0,0 hacia arriba. */
function espiga(color: string, alto = 90): string {
  let s = `<path d="M0 0V${-alto}" stroke="${VERDE}" stroke-width="3" stroke-linecap="round"/>`;
  for (let i = 0; i < 7; i++) {
    const y = -alto + i * 9;
    s += `<ellipse cx="${i % 2 ? 6 : -6}" cy="${n(y)}" rx="6.5" ry="9" fill="${i % 3 === 0 ? oscuro(color, 0.1) : color}"/>`;
  }
  return s + `<ellipse cx="0" cy="${-alto - 6}" rx="6" ry="9" fill="${color}"/>`;
}

function flor(tipo: FlorIlustracion, color: string, azar: () => number): string {
  switch (tipo) {
    case 'rosa': return florRosa(color);
    case 'margarita': return florMargarita(color, esClaro(color) ? '#F2C230' : claro('#F2C230', 0.2));
    case 'girasol': return florGirasol(color);
    case 'clavel': return florClavel(color);
    case 'lirio': return florLirio(color);
    case 'pascua': return florPascua(color);
    case 'suculenta': return florSuculenta(color);
    case 'orquidea': return florOrquidea(color);
    case 'mixta': {
      const r = azar();
      if (r < 0.34) return florRosa(color);
      if (r < 0.62) return florMargarita(color, '#F2C230', 11);
      if (r < 0.82) return florClavel(color);
      return florRedonda(color);
    }
    default: return florRedonda(color);
  }
}

/* ---------- Composiciones ---------- */

interface Punto { x: number; y: number; r: number }

/** Reparte flores en un óvalo con la espiral del girasol: quedan juntas y sin huecos. */
function repartir(cx: number, cy: number, rx: number, ry: number, cuantas: number, azar: () => number): Punto[] {
  const giro = azar() * Math.PI * 2;
  const puntos: Punto[] = [];
  for (let i = 0; i < cuantas; i++) {
    const d = Math.sqrt((i + 0.6) / cuantas);
    const a = i * 2.39996 + giro;
    puntos.push({ x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, r: 0.5 + azar() * 0.16 });
  }
  return puntos.sort((p, q) => p.y - q.y);
}

function corolaDeHojas(cx: number, cy: number, rx: number, ry: number, cuantas: number, azar: () => number, desde = 0, hasta = 360): string {
  let s = '';
  for (let i = 0; i < cuantas; i++) {
    const a = desde + ((hasta - desde) / cuantas) * (i + 0.5) + (azar() - 0.5) * 14;
    const rad = (a * Math.PI) / 180;
    const x = cx + Math.cos(rad) * rx * 0.82;
    const y = cy + Math.sin(rad) * ry * 0.82;
    const color = [VERDE, VERDE_OSC, VERDE_CLARO][Math.floor(azar() * 3)];
    s += en(x, y, a, 1, hoja(54 + azar() * 22, 15 + azar() * 6, color));
  }
  return s;
}

function cupulaDeFlores(il: Ilustracion, cx: number, cy: number, rx: number, ry: number, cuantas: number, azar: () => number): string {
  let s = '';
  repartir(cx, cy, rx, ry, cuantas, azar).forEach((p, i) => {
    const color = il.colores[(i + Math.floor(azar() * il.colores.length)) % il.colores.length];
    const escala = Math.min(1.12, (rx / 108) * 0.74 * Math.sqrt(13 / cuantas)) * (p.r + 0.42);
    s += en(p.x, p.y, azar() * 360, escala, flor(il.flor, color, azar));
  });
  return s;
}

function ramo(il: Ilustracion, azar: () => number): string {
  const cx = 200, cy = 198;
  let s = '';
  // Papel: dos hojas cruzadas que se cierran en el atado
  s += `<path d="M82 250L318 250L226 452L174 452Z" fill="#F4EBDD"/>`;
  s += `<path d="M82 250L200 300L174 452Z" fill="#E9DCC7"/>`;
  s += `<path d="M318 250L200 300L226 452Z" fill="#EFE3D0"/>`;
  if (il.flor === 'tulipan') {
    // Tulipanes de perfil, en abanico
    for (let i = 0; i < 9; i++) {
      const a = -52 + i * 13 + (azar() - 0.5) * 6;
      const largo = 150 + azar() * 40;
      const rad = ((a - 90) * Math.PI) / 180;
      const x = 200 + Math.cos(rad) * largo, y = 330 + Math.sin(rad) * largo;
      s += `<path d="M200 330L${n(x)} ${n(y)}" stroke="${VERDE}" stroke-width="5" stroke-linecap="round"/>`;
      s += en(200 + Math.cos(rad) * largo * 0.5, 330 + Math.sin(rad) * largo * 0.5, a - 90 + (i % 2 ? 30 : -30), 1, hoja(70, 13, i % 2 ? VERDE_CLARO : VERDE_OSC));
      s += en(x, y, a, 0.92, florTulipan(il.colores[i % il.colores.length]));
    }
  } else if (il.flor === 'espiga') {
    s += corolaDeHojas(cx, cy + 20, 130, 110, 9, azar, 190, 350);
    for (let i = 0; i < 13; i++) {
      const a = -58 + i * 9.6 + (azar() - 0.5) * 5;
      const rad = ((a - 90) * Math.PI) / 180;
      const base = 60 + azar() * 60;
      s += en(200 + Math.cos(rad) * base, 320 + Math.sin(rad) * base, a, 1, espiga(il.colores[i % il.colores.length], 84 + azar() * 30));
    }
    s += cupulaDeFlores({ ...il, flor: 'margarita' }, cx, cy + 62, 74, 38, 5, azar);
  } else {
    s += corolaDeHojas(cx, cy, 128, 116, 12, azar, 150, 390);
    const grandes = il.flor === 'girasol' ? 6 : il.flor === 'lirio' ? 8 : 13;
    s += cupulaDeFlores(il, cx, cy, il.flor === 'girasol' ? 96 : 108, il.flor === 'girasol' ? 84 : 96, grandes, azar);
  }
  // Atado y lazo
  s += `<path d="M150 318Q200 338 250 318L262 344Q200 366 138 344Z" fill="#F4EBDD"/>`;
  s += `<rect x="166" y="372" width="68" height="15" rx="7.5" fill="#5B4AA0"/>`;
  s += `<path d="M200 380C176 360 150 366 152 382C154 398 180 394 200 380C220 394 246 398 248 382C250 366 224 360 200 380Z" fill="#5B4AA0"/>`;
  s += `<circle cx="200" cy="380" r="8" fill="#2B2350"/>`;
  return s;
}

function centro(il: Ilustracion, azar: () => number): string {
  let s = '';
  s += corolaDeHojas(200, 262, 164, 104, 12, azar, 160, 380);
  s += cupulaDeFlores(il, 200, 250, 132, 92, 13, azar);
  s += `<path d="M112 322H288L268 404Q200 420 132 404Z" fill="#FFFFFF"/>`;
  s += `<path d="M112 322H288L283 344Q200 358 117 344Z" fill="#ECE8F6"/>`;
  return s;
}

function cesta(il: Ilustracion, azar: () => number): string {
  let s = '';
  s += `<path d="M96 318C96 120 304 120 304 318" fill="none" stroke="#B98A54" stroke-width="13" stroke-linecap="round"/>`;
  s += corolaDeHojas(200, 268, 150, 92, 10, azar, 170, 370);
  s += cupulaDeFlores(il, 200, 258, 124, 80, 12, azar);
  s += `<path d="M92 314H308L282 424Q200 440 118 424Z" fill="#C99B63"/>`;
  for (let i = 0; i < 4; i++) {
    const y = 334 + i * 24;
    s += `<path d="M${n(97 + i * 6.5)} ${y}Q200 ${y + 14} ${n(303 - i * 6.5)} ${y}" fill="none" stroke="#A97B45" stroke-width="5"/>`;
  }
  s += `<rect x="86" y="304" width="228" height="20" rx="10" fill="#B98A54"/>`;
  return s;
}

function caja(il: Ilustracion, azar: () => number): string {
  let s = '';
  s += `<path d="M96 262V392Q200 436 304 392V262Z" fill="#5B4AA0"/>`;
  s += `<path d="M96 262V392Q150 414 200 418V262Z" fill="#4C3D8C"/>`;
  s += `<rect x="186" y="262" width="28" height="158" fill="#D6E59B"/>`;
  s += `<ellipse cx="200" cy="262" rx="104" ry="42" fill="#2B2350"/>`;
  s += cupulaDeFlores(il, 200, 246, 96, 44, 12, azar);
  return s;
}

function tiesto(x: number, y: number, ancho: number, alto: number, color = '#C8744A'): string {
  const a = ancho / 2;
  return (
    `<path d="M${n(x - a * 0.86)} ${n(y)}H${n(x + a * 0.86)}L${n(x + a * 0.68)} ${n(y + alto)}H${n(x - a * 0.68)}Z" fill="${color}"/>` +
    `<rect x="${n(x - a)}" y="${n(y - 16)}" width="${n(ancho)}" height="26" rx="8" fill="${oscuro(color, 0.12)}"/>`
  );
}

function maceta(il: Ilustracion, azar: () => number): string {
  let s = '';
  const c = il.colores;
  switch (il.flor) {
    case 'orquidea': {
      s += en(200, 352, -150, 1, hoja(120, 26, VERDE_OSC)) + en(200, 352, -30, 1, hoja(120, 26, VERDE)) + en(200, 352, -175, 1, hoja(88, 22, VERDE)) + en(200, 352, -5, 1, hoja(88, 22, VERDE_OSC));
      const varas: [string, number[][]][] = [
        ['M196 350C176 250 150 160 104 92', [[108, 96], [136, 150], [160, 212]]],
        ['M206 350C226 240 262 150 304 104', [[300, 108], [268, 160], [244, 222]]],
      ];
      varas.forEach(([d, flores], k) => {
        s += `<path d="${d}" fill="none" stroke="${VERDE_OSC}" stroke-width="5" stroke-linecap="round"/>`;
        flores.forEach(([x, y], i) => { s += en(x, y, (k ? 14 : -14) + (azar() - 0.5) * 16, 0.8 + (i === 0 ? -0.14 : 0), florOrquidea(c[k % c.length])); });
      });
      s += tiesto(200, 356, 150, 100, '#FFFFFF');
      break;
    }
    case 'anturio': {
      for (let i = 0; i < 7; i++) {
        const a = -160 + i * 23 + (azar() - 0.5) * 8;
        s += en(200, 356, a + 90, 1, hojaRedonda(58 + azar() * 16, i % 2 ? VERDE : VERDE_OSC));
      }
      const pos = [[150, 178, -18], [214, 132, 6], [262, 196, 22]];
      pos.forEach(([x, y, g]) => {
        s += `<path d="M200 356Q${n((x + 200) / 2)} ${n(y + 110)} ${x} ${n(y + 30)}" fill="none" stroke="${VERDE_OSC}" stroke-width="5" stroke-linecap="round"/>`;
        s += en(x, y, g, 0.9, florAnturio(c[0]));
      });
      s += tiesto(200, 356, 160, 100, '#FFFFFF');
      break;
    }
    case 'hojas': {
      for (let i = 0; i < 9; i++) {
        const a = -168 + i * 19.5 + (azar() - 0.5) * 8;
        const largo = 0.72 + azar() * 0.28;
        const hx = 200 + Math.cos((a * Math.PI) / 180) * 104 * largo, hy = 356 + Math.sin((a * Math.PI) / 180) * 176 * largo;
        s += `<path d="M200 356L${n(hx)} ${n(hy)}" stroke="${VERDE_OSC}" stroke-width="5" stroke-linecap="round"/>`;
        s += en(hx, hy, a + 90, 1, hojaRedonda(40 + azar() * 18, [VERDE, VERDE_OSC, VERDE_CLARO][i % 3]));
      }
      s += tiesto(200, 356, 160, 104);
      break;
    }
    case 'suculenta': {
      const pos: [number, number, number][] = [[128, 262, 1.3], [272, 256, 1.36], [200, 206, 1.7], [88, 306, 0.84], [314, 308, 0.9], [200, 296, 1.0]];
      pos.forEach(([x, y, e], i) => { s += en(x, y, azar() * 60, e, florSuculenta(c[i % c.length])); });
      s += `<path d="M64 318H336L310 426Q200 446 90 426Z" fill="#FFFFFF"/><path d="M64 318H336L330 342Q200 358 70 342Z" fill="#ECE8F6"/>`;
      break;
    }
    case 'pascua': {
      s += corolaDeHojas(200, 268, 150, 110, 12, azar, 150, 390);
      repartir(200, 236, 96, 84, 6, azar).forEach((p) => { s += en(p.x, p.y, azar() * 50, 1.02, florPascua(c[0])); });
      s += tiesto(200, 348, 150, 100, '#B9442F');
      break;
    }
    case 'tulipan': {
      // Ciclamen: flores erguidas sobre hojas redondas
      for (let i = 0; i < 8; i++) s += en(120 + i * 23, 322 + (i % 2) * 14, (azar() - 0.5) * 40, 1, hojaRedonda(34, i % 2 ? VERDE : VERDE_OSC));
      for (let i = 0; i < 7; i++) {
        const x = 134 + i * 22 + (azar() - 0.5) * 10, y = 170 + azar() * 70;
        s += `<path d="M${n(x)} ${n(y)}L${n(190 + (x - 200) * 0.3)} 340" stroke="${oscuro('#B56576', 0.1)}" stroke-width="4"/>`;
        s += en(x, y, (azar() - 0.5) * 30, 0.7, florTulipan(c[i % c.length]));
      }
      s += tiesto(200, 348, 150, 100);
      break;
    }
    default: {
      // Bola de flor menuda (crisantemo, kalanchoe) o composición de varias plantas
      s += corolaDeHojas(200, 256, 150, 116, 14, azar, 150, 390);
      const tipo: FlorIlustracion = il.flor === 'mixta' ? 'mixta' : 'margarita';
      repartir(200, 240, 118, 100, il.flor === 'mixta' ? 16 : 26, azar).forEach((p, i) => {
        s += en(p.x, p.y, azar() * 360, il.flor === 'mixta' ? 0.56 : 0.42, flor(tipo, c[i % c.length], azar));
      });
      s += tiesto(200, 348, 160, 100);
    }
  }
  return s;
}

function corona(il: Ilustracion, azar: () => number): string {
  let s = '';
  s += `<path d="M150 470L200 300L250 470" fill="none" stroke="#8A6B4A" stroke-width="8" stroke-linecap="round"/>`;
  for (let i = 0; i < 22; i++) {
    const a = (360 / 22) * i + (azar() - 0.5) * 8;
    const rad = (a * Math.PI) / 180;
    s += en(200 + Math.cos(rad) * 138, 222 + Math.sin(rad) * 138, a, 1, hoja(48 + azar() * 16, 11, i % 2 ? VERDE : VERDE_OSC));
  }
  const cuantas = 15;
  for (let i = 0; i < cuantas; i++) {
    const a = ((Math.PI * 2) / cuantas) * i;
    const r = 108 + (i % 2 ? 9 : -9);
    s += en(200 + Math.cos(a) * r, 222 + Math.sin(a) * r, azar() * 360, 0.62 + azar() * 0.12, flor(il.flor, il.colores[i % il.colores.length], azar));
  }
  s += `<path d="M168 330C150 360 150 400 162 432L182 420C176 396 178 366 190 342Z" fill="#FFFFFF"/><path d="M232 330C250 360 250 400 238 432L218 420C224 396 222 366 210 342Z" fill="#F6F3FB"/>`;
  return s;
}

function cupula(il: Ilustracion): string {
  let s = '';
  s += `<path d="M200 392V246" stroke="${VERDE_OSC}" stroke-width="6" stroke-linecap="round"/>`;
  s += en(200, 330, -148, 1, hoja(56, 15, VERDE)) + en(200, 300, -32, 1, hoja(56, 15, VERDE_OSC));
  s += en(200, 214, 0, 1.06, florRosa(il.colores[0]));
  s += `<path d="M112 396V210C112 96 288 96 288 210V396Z" fill="#FFFFFF" fill-opacity="0.34" stroke="#FFFFFF" stroke-width="5"/>`;
  s += `<path d="M138 250V214C138 170 160 146 180 138" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" stroke-opacity="0.85"/>`;
  s += `<circle cx="200" cy="102" r="14" fill="#FFFFFF" fill-opacity="0.9"/>`;
  s += `<rect x="92" y="392" width="216" height="34" rx="12" fill="#8A6B4A"/><rect x="104" y="424" width="192" height="14" rx="7" fill="#6E5338"/>`;
  return s;
}

function tallo(il: Ilustracion): string {
  let s = '';
  s += `<path d="M150 440L246 168" stroke="${VERDE_OSC}" stroke-width="8" stroke-linecap="round"/>`;
  s += en(196, 310, -160, 1, hoja(74, 20, VERDE)) + en(214, 258, -30, 1, hoja(74, 20, VERDE_OSC)) + en(182, 350, -40, 1, hoja(58, 16, VERDE_CLARO));
  s += en(252, 148, 18, 1.3, florRosa(il.colores[0]));
  s += `<path d="M110 330L214 364L176 470L122 452Z" fill="#F4EBDD"/><path d="M110 330L166 400L122 452Z" fill="#E9DCC7"/>`;
  s += `<rect x="128" y="404" width="62" height="13" rx="6.5" fill="#5B4AA0" transform="rotate(18 159 410)"/>`;
  return s;
}

function objeto(il: Ilustracion): string {
  const c = il.colores[0];
  switch (il.flor) {
    case 'jarron':
      return (
        `<path d="M146 110H254V150C254 186 300 216 300 300C300 384 262 420 200 420C138 420 100 384 100 300C100 216 146 186 146 150Z" fill="#FFFFFF" fill-opacity="0.5" stroke="#FFFFFF" stroke-width="6"/>` +
        `<path d="M108 270C140 258 170 284 200 272C230 260 262 282 292 270C296 280 298 290 298 300C298 382 262 416 200 416C138 416 102 382 102 300C102 290 104 280 108 270Z" fill="${c}" fill-opacity="0.75"/>` +
        `<rect x="136" y="96" width="128" height="20" rx="10" fill="#FFFFFF"/>` +
        `<path d="M132 300C132 340 150 372 176 386" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-opacity="0.8"/>`
      );
    case 'bombones': {
      let s = `<rect x="74" y="150" width="252" height="212" rx="18" fill="#5B4AA0"/><rect x="92" y="168" width="216" height="176" rx="10" fill="#2B2350"/>`;
      const tonos = [c, oscuro(c, 0.3), claro(c, 0.35), '#E9D5B5'];
      for (let f = 0; f < 3; f++) for (let k = 0; k < 4; k++) {
        const x = 128 + k * 48, y = 198 + f * 58;
        s += `<circle cx="${x}" cy="${y}" r="19" fill="${tonos[(f + k) % 4]}"/><path d="M${x - 9} ${y - 3}Q${x} ${y - 12} ${x + 9} ${y - 3}" fill="none" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round"/>`;
      }
      return s + `<path d="M74 128H326V150H74Z" fill="#D6E59B"/>`;
    }
    case 'peluche':
      return (
        `<circle cx="132" cy="140" r="34" fill="${oscuro(c, 0.12)}"/><circle cx="268" cy="140" r="34" fill="${oscuro(c, 0.12)}"/>` +
        `<circle cx="132" cy="140" r="17" fill="${claro(c, 0.45)}"/><circle cx="268" cy="140" r="17" fill="${claro(c, 0.45)}"/>` +
        `<ellipse cx="118" cy="360" rx="34" ry="46" fill="${oscuro(c, 0.12)}"/><ellipse cx="282" cy="360" rx="34" ry="46" fill="${oscuro(c, 0.12)}"/>` +
        `<ellipse cx="200" cy="350" rx="92" ry="98" fill="${c}"/><ellipse cx="200" cy="366" rx="54" ry="60" fill="${claro(c, 0.45)}"/>` +
        `<circle cx="200" cy="196" r="92" fill="${c}"/><ellipse cx="200" cy="222" rx="42" ry="34" fill="${claro(c, 0.5)}"/>` +
        `<circle cx="166" cy="184" r="9" fill="#2B2350"/><circle cx="234" cy="184" r="9" fill="#2B2350"/><ellipse cx="200" cy="210" rx="12" ry="9" fill="#2B2350"/>` +
        `<path d="M186 230Q200 242 214 230" fill="none" stroke="#2B2350" stroke-width="4" stroke-linecap="round"/>` +
        `<path d="M160 282Q200 300 240 282L246 300Q200 320 154 300Z" fill="#5B4AA0"/>`
      );
    default:
      return (
        `<path d="M200 300C196 350 214 380 196 420C186 444 204 458 198 478" fill="none" stroke="#8E80C4" stroke-width="3" stroke-linecap="round"/>` +
        `<ellipse cx="200" cy="182" rx="98" ry="118" fill="${c}"/>` +
        `<path d="M186 296L214 296L206 312H194Z" fill="${oscuro(c, 0.15)}"/>` +
        `<path d="M142 150C150 112 172 92 196 86" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" stroke-opacity="0.6"/>`
      );
  }
}

/* ---------- Punto de entrada ---------- */

/**
 * SVG de 400 × 500 con la ilustración de un producto.
 * @param id identificador del producto (hace de semilla: mismo id, mismo dibujo).
 */
export function ilustracionSvg(id: string, il: Ilustracion, titulo?: string): string {
  const azar = semilla(id);
  const fondo = FONDOS[Math.floor(azar() * FONDOS.length)];
  let dibujo: string;
  switch (il.forma) {
    case 'ramo': dibujo = ramo(il, azar); break;
    case 'centro': dibujo = centro(il, azar); break;
    case 'cesta': dibujo = cesta(il, azar); break;
    case 'caja': dibujo = caja(il, azar); break;
    case 'maceta': dibujo = maceta(il, azar); break;
    case 'corona': dibujo = corona(il, azar); break;
    case 'cupula': dibujo = cupula(il); break;
    case 'tallo': dibujo = tallo(il); break;
    default: dibujo = objeto(il);
  }
  const accesible = titulo
    ? ` role="img" aria-label="${titulo.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"`
    : ' aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500"${accesible}><rect width="400" height="500" fill="${fondo}"/>${dibujo}</svg>`;
}
