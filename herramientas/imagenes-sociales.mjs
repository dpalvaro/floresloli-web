/* =====================================================================
   ICONOS E IMAGEN DE COMPARTIR

   Genera, a partir de public/favicon.svg y de una foto de la tienda:
     public/favicon-32.png         icono para navegadores antiguos
     public/apple-touch-icon.png   icono al guardar la web en el móvil
     public/social/portada.jpg     imagen que sale al compartir un enlace
                                   (WhatsApp, Facebook…), 1200 × 630

   Uso:  npm run imagenes
   Cuándo: al cambiar el logo, el nombre, el teléfono o la foto de portada.

   Los iconos se hacen con sharp (ya instalado). La imagen de compartir se
   dibuja con un navegador para usar las tipografías de la web: hace falta
   Playwright. Si no está, el script lo dice y deja la imagen como estaba.
   ===================================================================== */

import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { NEGOCIO, direccionCompleta } from '../compartido/negocio.ts';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const publico = join(raiz, 'public');

/** Foto de la imagen de compartir. Sin personas reconocibles: la de la fachada no vale. */
const FOTO = 'src/assets/fotos/ramo.jpg';

/* ---------- Iconos ---------- */

const svg = await readFile(join(publico, 'favicon.svg'));
await sharp(svg, { density: 300 }).resize(32, 32).png().toFile(join(publico, 'favicon-32.png'));
await sharp(svg, { density: 300 }).resize(180, 180).flatten({ background: '#D6E59B' }).png().toFile(join(publico, 'apple-touch-icon.png'));
console.log('✓ Iconos: public/favicon-32.png y public/apple-touch-icon.png');

/* ---------- Imagen de compartir ---------- */

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.log('! Imagen de compartir sin cambios: falta Playwright.');
  console.log('  Para generarla: npm install --no-save playwright && npx playwright install chromium && npm run imagenes');
  process.exit(0);
}

const aDatos = async (ruta, tipo) => `data:${tipo};base64,${(await readFile(join(raiz, ruta))).toString('base64')}`;
const logo = NEGOCIO.logo && existsSync(join(raiz, 'src/assets', NEGOCIO.logo)) ? join(raiz, 'src/assets', NEGOCIO.logo) : null;
const escapar = (texto) => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<style>
  @font-face { font-family: Gloock; src: url(${await aDatos('public/fuentes/gloock-latin-400-normal.woff2', 'font/woff2')}) format('woff2'); }
  @font-face { font-family: Figtree; font-weight: 600; src: url(${await aDatos('public/fuentes/figtree-latin-600-normal.woff2', 'font/woff2')}) format('woff2'); }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; display: grid; grid-template-columns: 690px 510px; background: #D6E59B; font-family: Figtree, sans-serif; color: #2B2350; }
  .texto { padding: 76px 40px 64px 76px; display: flex; flex-direction: column; justify-content: center; }
  h1 { font: 400 92px/0.98 Gloock, serif; letter-spacing: -1px; color: #5B4AA0; }
  .logo { max-width: 520px; max-height: 240px; object-fit: contain; object-position: left; }
  .que { margin-top: 30px; font-size: 37px; line-height: 1.2; font-weight: 600; }
  .donde { margin-top: 18px; font-size: 28px; line-height: 1.3; font-weight: 600; color: #463A85; }
  .foto { position: relative; background: url(${await aDatos(FOTO, 'image/jpeg')}) center 30% / cover; }
  /* El faldón del toldo, en vertical, entre el texto y la foto. */
  .foto::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 22px;
    background: radial-gradient(circle at 0 21px, #D6E59B 20px, transparent 21px) repeat-y left top / 22px 42px; }
</style></head>
<body>
  <div class="texto">
    ${logo ? `<img class="logo" src="${pathToFileURL(logo)}" alt="">` : `<h1>${escapar(NEGOCIO.nombre).replace(' y ', ' y<br>')}</h1>`}
    <p class="que">Floristería en el ${escapar(NEGOCIO.direccion.barrio)} de ${escapar(NEGOCIO.direccion.ciudad)}</p>
    <p class="donde">${escapar(NEGOCIO.direccion.calle)} · ${escapar(NEGOCIO.telefono)}</p>
  </div>
  <div class="foto"></div>
</body></html>`;

const navegador = await chromium.launch();
try {
  const pagina = await navegador.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await pagina.setContent(html, { waitUntil: 'load' });
  await pagina.evaluate(() => document.fonts.ready);
  const captura = await pagina.screenshot({ type: 'png' });
  await mkdir(join(publico, 'social'), { recursive: true });
  const jpg = await sharp(captura).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  await writeFile(join(publico, 'social', 'portada.jpg'), jpg);
  console.log(`✓ Imagen de compartir: public/social/portada.jpg (${Math.round(jpg.length / 1024)} KB) · ${direccionCompleta()}`);
} finally {
  await navegador.close();
}
