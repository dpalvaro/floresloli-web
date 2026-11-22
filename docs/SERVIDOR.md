# Servidor propio de la tienda

La tienda se publica en un servidor propio en la Unión Europea, fuera de Cloudflare.

**Por qué:** los días de partido, LaLiga obliga a las operadoras españolas a bloquear direcciones de Cloudflare. Con ellas caen muchas webs que nada tienen que ver, y una tienda no puede quedarse sin vender cada fin de semana. Un servidor con una IP solo para la tienda no comparte dirección con nadie, y es muy difícil que lo bloqueen. Decisión de Álvaro del 22/11/2026.

Cloudflare Pages se queda solo para las **vistas previas** de cada rama, que son de pruebas. Cuando la tienda esté en su dominio, la dirección antigua `floresyplantasloli.pages.dev` llevará a la nueva (paso 7).

## Cómo está montado

```
Cliente ──HTTPS──▶ Caddy (puertos 80 y 443) ──▶ tienda en Node (solo 127.0.0.1:8788) ──▶ SQLite (/var/lib/floresloli)
                   certificado automático         servidor/servidor.ts: web (dist/)
                   HTTP/2 y 3, compresión,        y API (functions/), la misma
                   HSTS, IP real del cliente      que en Cloudflare
```

- **Sin dependencias en producción.** El servidor usa solo lo que trae Node 24: HTTP, SQLite y TypeScript. No hay paquetes de npm que mantener ni que puedan colar código.
- **La misma API en los dos sitios.** `servidor/` hace en Node lo mismo que Cloudflare Pages: rutas de `functions/`, base de datos con la forma de D1 y cabeceras de `_headers`. La API no se ha tocado.
- **Publicación desde GitHub.** Al fusionar en `main`, GitHub Actions:
  1. Pasa las pruebas, incluida una compra completa contra el servidor propio.
  2. Compila la web de producción y comprueba que no lleva nada de ejemplo.
  3. Manda el paquete al servidor.
  4. El servidor lo pone en marcha. Si no responde, vuelve solo a la versión anterior.

### Seguridad

| Riesgo | Qué lo para |
|---|---|
| Que alguien entre por SSH | Solo con clave, sin contraseñas y sin root. Solo pueden entrar tu usuario y el de despliegue. fail2ban bloquea a quien prueba claves |
| Que roben la clave de GitHub | Solo la ve el último paso de la publicación, que corre solo desde `main` y en una máquina aparte que no instala nada de npm. Aun así, esa clave solo puede ejecutar `floresloli-desplegar publicar`: ni terminal, ni túneles, ni otros comandos. Y su `sudo` solo reinicia la tienda |
| Que alguien suba cambios a `main` sin revisión | Regla de GitHub en `main` (paso 5): solo entra lo que llega por petición de revisión con las pruebas en verde, y nadie puede reescribir la historia |
| Un fallo en la tienda | Corre con un usuario sin privilegios y encerrada por systemd (nota de exposición 1,5 sobre 10): solo puede escribir en su base de datos y no ve el resto del sistema |
| Puertos abiertos | Cortafuegos: solo 22, 80 y 443. La tienda escucha solo dentro de la máquina |
| Fallos de seguridad del sistema, Node o Caddy | Se actualizan solos cada día. Si hace falta reiniciar, a las 04:30 |
| Datos en tránsito | HTTPS siempre (Let's Encrypt, renovación automática) y HSTS |
| Robo de las copias | Se cifran con tu clave pública de age: sin tu clave privada no se pueden abrir, ni siquiera en el servidor |
| Que se caiga o se estropee | systemd la levanta si se cae, vuelta atrás automática al publicar, 5 versiones guardadas, copia cifrada cada noche (30 días) y la copia diaria de OVH |
| Precios o productos de ejemplo en la web pública | GitHub no publica si la compilación de producción lleva algo de ejemplo |
| Cabecera Host o IP falseadas | La tienda usa su dirección fija (`URL_PUBLICA`) y la IP que pone Caddy, nunca lo que diga la petición |

Las cabeceras de seguridad de cada página (CSP, X-Frame-Options…) son las de `public/_headers`, las mismas que en Cloudflare.

## Lo que hace falta

- **VPS:** OVHcloud VPS-1, unos 4,61 € al mes con IVA, con 2 núcleos, 4 GB de memoria y copia diaria incluida. Debian 13 y centro de datos en la Unión Europea (Francia o Alemania).
- **Dominio** a nombre de Loli, por ejemplo `floresyplantasloli.es`. El `.es` se compra en cualquier registrador; con OVH queda todo en el mismo sitio.
- **Tres claves en tu ordenador.** Se crean una vez (paso 1) y se guardan en tu gestor de contraseñas.
- **Tu cuenta de GitHub,** para dejarle a GitHub los datos del servidor.

Coste total: unos 6 € al mes, más el dominio (unos 10 € al año). Lo paga quien decida Álvaro con Loli. Este documento no fija precios.

---

## Paso a paso

### 1. Las tres claves (en tu Mac)

```bash
mkdir -p ~/.ssh/tienda && cd ~/.ssh/tienda
# Tu clave para entrar al servidor. Ponle una frase de paso cuando la pida.
ssh-keygen -t ed25519 -f tienda-alvaro -C "alvaro tienda"
# La de GitHub, solo para publicar. Sin frase de paso: la usa una máquina.
ssh-keygen -t ed25519 -f tienda-github -N "" -C "github despliegue tienda"
# La de las copias. La privada (clave-copias.txt) es la única forma de abrir las copias.
brew install age
age-keygen -o clave-copias.txt
```

Guarda las tres privadas en tu gestor de contraseñas: `tienda-alvaro`, `tienda-github` y, sobre todo, `clave-copias.txt`. Si pierdes `clave-copias.txt`, las copias no se pueden abrir. Las `.pub` son públicas y van al servidor.

### 2. Contratar el VPS

En OVHcloud contrata un VPS-1 con **Debian 13** y un centro de datos en Francia o Alemania. Cuando te pida una clave SSH, pega el contenido de `~/.ssh/tienda/tienda-alvaro.pub`. Apunta la IP que te dan (IPv4, y la IPv6 si la hay).

En el panel de OVH, comprueba que la **copia de seguridad diaria** del VPS está activada.

### 3. Dominio y DNS

En el registrador del dominio, crea estos registros:

| Tipo | Nombre | Valor |
|---|---|---|
| A | @ (el dominio) | IPv4 del VPS |
| AAAA | @ | IPv6 del VPS (si la hay) |
| A y AAAA | www | las mismas (si quieres que funcione también con www) |

**No pongas el dominio detrás del proxy de Cloudflare** (la nube naranja): volverían los bloqueos de los partidos. Si los DNS están en Cloudflare, déjalos en «DNS only» (nube gris).

### 4. Preparar el servidor

Desde tu Mac, en la carpeta del repositorio (rama `main` una vez fusionado, o esta rama antes):

```bash
scp -r servidor/sistema ~/.ssh/tienda/tienda-alvaro.pub ~/.ssh/tienda/tienda-github.pub debian@IP_DEL_VPS:~/
ssh debian@IP_DEL_VPS
```

Ya dentro del servidor (cambia el dominio, tu correo y la clave `age1…`, que está en `clave-copias.txt`):

```bash
sudo bash ~/sistema/preparar.sh \
  --dominio floresyplantasloli.es --con-www \
  --correo tu-correo@ejemplo.es \
  --usuario alvaro \
  --clave-ssh ~/tienda-alvaro.pub \
  --clave-despliegue ~/tienda-github.pub \
  --clave-copias age1…
```

Tarda unos minutos. Te pide una contraseña para tu usuario: solo sirve para `sudo`, porque para entrar se usa la clave. Al terminar enseña:

1. **Cómo comprobar que entras.** Hazlo en otra terminal **antes de cerrar esta**: `ssh -i ~/.ssh/tienda/tienda-alvaro alvaro@IP_DEL_VPS`. Desde ahí, el usuario `debian` ya no puede entrar.
2. **Los tres datos para GitHub** (paso 5).
3. **La clave del panel de Loli.** Solo sale una vez: guárdala en tu gestor de contraseñas y dásela a Loli en persona.

Para no escribir tanto, añade esto a `~/.ssh/config` de tu Mac y entra con `ssh tienda`:

```
Host tienda
  HostName IP_DEL_VPS
  User alvaro
  IdentityFile ~/.ssh/tienda/tienda-alvaro
```

### 5. GitHub

En el repositorio `floresloli-web` › **Settings** › **Environments** › «New environment», crea un entorno llamado `produccion`. Dentro:

- **Deployment branches:** solo `main`.
- **Environment secrets:**

| Nombre | Valor |
|---|---|
| `SERVIDOR_HOST` | La IP del VPS |
| `SERVIDOR_HUELLA` | La línea que empieza por la IP y sigue con `ssh-ed25519 …`, tal como la enseña `preparar.sh` |
| `SERVIDOR_CLAVE` | El contenido de `~/.ssh/tienda/tienda-github`, la privada, sin `.pub`, entera |

Mientras estos datos no estén, GitHub pasa las pruebas pero no publica nada.

Como todo lo que entra en `main` se publica solo, protege esa rama. En **Settings** › **Rules** › **Rulesets** › «New branch ruleset»:

- **Ruleset name:** `main protegida`. **Enforcement status:** Active.
- **Target branches:** «Add target» › «Include default branch».
- Deja marcadas **Restrict deletions** y **Block force pushes**.
- Marca **Require a pull request before merging** (con 0 aprobaciones: el visto bueno es tuyo al fusionar).
- Marca **Require status checks to pass** y añade `Pruebas`. Aparece en la lista cuando las pruebas han corrido una vez, por ejemplo en la petición de revisión de este cambio.
- No pongas a nadie en **Bypass list**.

Así nadie, ni un agente ni tú por despiste, puede subir algo a `main` sin petición de revisión y sin las pruebas en verde.

### 6. Dominio en la web

Dile a Claude o a Desarrollo cuál es el dominio. Hay que cambiarlo en `compartido/negocio.ts` (`web.url`) y en `astro.config.mjs` (`SITIO`), las dos a la vez. Llega como petición de revisión.

### 7. La dirección antigua lleva a la nueva

**Antes de publicar**, en Cloudflare › proyecto `floresyplantasloli` › **Settings** › **Variables and Secrets** › entorno **Production** (no en Preview), añade:

`URL_PUBLICA` = `https://tu-dominio`

Cloudflare solo aplica las variables en el siguiente despliegue, y el siguiente será el de la tienda. Desde ese momento, cualquier enlace a `floresyplantasloli.pages.dev` lleva a la misma página del dominio nuevo. Así no se pierden los enlaces que ya hay en Google, en redes y en tarjetas. Las vistas previas no cambian.

### 8. Publicar

Fusiona en `main` la petición de la tienda (#1), esta y la del dominio. GitHub publica en unos minutos: lo verás en la pestaña **Actions**.

Comprueba:

- `https://tu-dominio/` carga con el candado.
- `https://tu-dominio/api/estado` dice `"entorno":"produccion"`.
- `https://tu-dominio/panel/` deja entrar con la clave del paso 4.
- `https://floresyplantasloli.pages.dev/tienda/` te lleva a `https://tu-dominio/tienda/`.
- [SSL Labs](https://www.ssllabs.com/ssltest/) da A o A+, y [securityheaders.com](https://securityheaders.com) da A o mejor.

Sin claves de Stripe, la tienda funciona como **catálogo** y los encargos van por WhatsApp. Es el punto de partida seguro.

Después cambia la web en la ficha de Google, en Facebook y en Instagram (T38).

### 9. Stripe (para cobrar)

Sigue `docs/PUESTA-EN-MARCHA.md`, apartado «Stripe». En el servidor, las claves van en la configuración:

```bash
ssh tienda
sudoedit /etc/floresloli/entorno      # STRIPE_SECRET_KEY=sk_live_… y STRIPE_WEBHOOK_SECRET=whsec_…
sudo systemctl restart floresloli
```

La dirección del webhook es `https://tu-dominio/api/stripe/webhook`.

### 10. Aviso si se cae

Crea una cuenta gratuita en un servicio de vigilancia, por ejemplo UptimeRobot:

- Monitor HTTPS de `https://tu-dominio/api/estado` cada 5 minutos.
- Palabra clave: `entorno`.
- Aviso al correo o al móvil.

Así te enteras antes que Loli.

### 11. Probar una copia

Haz esto una vez al principio y luego cada tres meses: baja una copia y ábrela (apartado «Recuperar una copia»). Una copia que nunca se ha probado no es una copia.

---

## Día a día

Todo desde tu Mac, con `ssh tienda`:

| Para… | Orden |
|---|---|
| Ver si la tienda está en marcha | `systemctl status floresloli --no-pager` |
| Ver lo último que ha pasado | `sudo journalctl -u floresloli -n 100 --no-pager` (Caddy: `-u caddy`) |
| Cambiar la configuración (Stripe, correo, clave del panel) | `sudoedit /etc/floresloli/entorno` y `sudo systemctl restart floresloli` |
| Ver las versiones publicadas | `sudo -u despliegue floresloli-desplegar versiones` |
| Volver a la versión anterior | `sudo -u despliegue floresloli-desplegar anterior` |
| Ver las copias | `sudo ls -lh /var/backups/floresloli` |
| Hacer una copia ahora | `sudo systemctl start floresloli-copia && sudo journalctl -u floresloli-copia -n 3 --no-pager` |
| Ver quién ha sido bloqueado | `sudo fail2ban-client status sshd` |

Las actualizaciones de seguridad se instalan solas. Node 24 tiene parches hasta abril de 2028: antes de esa fecha hay que pasar a la siguiente versión larga (cambiar `NODE_MAYOR` en `preparar.sh` y volver a lanzarlo).

### Cambiar la clave del panel

Hazlo si alguien deja de trabajar en la tienda o si crees que se conoce:

```bash
sudoedit /etc/floresloli/entorno          # nueva PANEL_CLAVE (mínimo 8 caracteres; mejor 20 al azar)
sudo systemctl restart floresloli
```

Si además cambias `SECRETO_SESION`, se cierran todas las sesiones abiertas del panel.

### Recuperar una copia

1. Baja la copia a tu Mac (cambia el nombre por el de la copia que quieras):
   ```bash
   ssh -t tienda 'sudo install -m 600 -o alvaro /var/backups/floresloli/tienda-AAAAMMDD-HHMM.sqlite.gz.age ~/'
   scp tienda:tienda-AAAAMMDD-HHMM.sqlite.gz.age . && ssh tienda 'rm ~/tienda-*.age'
   ```
2. Ábrela con tu clave privada:
   ```bash
   age -d -i ~/.ssh/tienda/clave-copias.txt tienda-AAAAMMDD-HHMM.sqlite.gz.age | gunzip > tienda.sqlite
   sqlite3 tienda.sqlite 'PRAGMA integrity_check;'      # tiene que decir «ok»
   ```
3. Solo si hay que sustituir la base de datos del servidor (se pierden los pedidos posteriores a la copia):
   ```bash
   scp tienda.sqlite tienda:
   ssh -t tienda
   sudo systemctl stop floresloli
   sudo mv /var/lib/floresloli/tienda.sqlite /var/lib/floresloli/tienda.sqlite.antes
   sudo rm -f /var/lib/floresloli/tienda.sqlite-wal /var/lib/floresloli/tienda.sqlite-shm
   sudo install -m 600 -o floresloli -g floresloli ~/tienda.sqlite /var/lib/floresloli/tienda.sqlite && rm ~/tienda.sqlite
   sudo systemctl start floresloli
   ```

Borra del Mac la copia descifrada cuando termines: lleva datos de clientes.

## Si algo falla

| Síntoma | Qué mirar |
|---|---|
| La web no carga | `systemctl status floresloli caddy --no-pager`. Si la tienda no arranca: `sudo journalctl -u floresloli -n 50`. Si es tras publicar: `sudo -u despliegue floresloli-desplegar anterior` |
| Sale un aviso de certificado | El DNS no apunta al VPS o está detrás del proxy de Cloudflare: `sudo journalctl -u caddy -n 50` |
| GitHub no publica | Pestaña **Actions** del repositorio: el paso que falla lo dice. «Host key verification failed» = `SERVIDOR_HUELLA` mal copiada |
| No puedes entrar por SSH | Panel de OVH › VPS › **KVM**: entra con tu usuario y tu contraseña de `sudo` (la consola no es SSH) |
| La cesta solo ofrece WhatsApp | Faltan las claves de Stripe o algún producto no tiene precio confirmado: panel › «Ajustes» |

## Archivos

| Archivo | En el servidor | Para qué |
|---|---|---|
| `servidor/servidor.ts`, `d1.ts`, `funciones.ts`, `estaticos.ts` | `/srv/floresloli/actual/servidor/` | La tienda en Node |
| `servidor/sistema/preparar.sh` | Se lanza una vez | Deja el servidor listo |
| `servidor/sistema/floresloli.service` | `/etc/systemd/system/` | El servicio, aislado |
| `servidor/sistema/Caddyfile` | `/etc/caddy/Caddyfile` | HTTPS y proxy |
| `servidor/sistema/entorno.ejemplo` | `/etc/floresloli/entorno` (solo root) | Claves y configuración |
| `servidor/sistema/desplegar.sh` | `/usr/local/sbin/floresloli-desplegar` | Publicar y volver atrás |
| `servidor/sistema/copia.sh` y `floresloli-copia.*` | `/usr/local/sbin/floresloli-copia` y systemd | Copia cifrada cada noche |
| `.github/workflows/publicar.yml` | GitHub | Pruebas y publicación |

Probar el servidor propio en tu ordenador: `npm run local:servidor` (compila y arranca en http://127.0.0.1:8788 con la base de datos en `.datos/`).
