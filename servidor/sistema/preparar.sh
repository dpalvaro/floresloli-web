#!/usr/bin/env bash
# =====================================================================
#  PREPARAR EL SERVIDOR DE LA TIENDA (una sola vez)
#
#  En un VPS recién instalado con Debian 12 o 13, o Ubuntu 24.04, con
#  sudo. Lo deja cerrado y listo para que GitHub publique la tienda.
#  Paso a paso: docs/SERVIDOR.md.
#
#    sudo bash preparar.sh \
#      --dominio floresyplantasloli.es [--con-www] \
#      --correo tu-correo@ejemplo.es \
#      --usuario alvaro \
#      --clave-ssh ~/tienda-alvaro.pub          (o el texto «ssh-ed25519 AAAA…»)
#      --clave-despliegue ~/tienda-github.pub   (otra clave, solo para GitHub)
#      --clave-copias age1…                     (clave pública de age para las copias)
#
#  Qué hace:
#    · Actualiza el sistema e instala Node.js 24, Caddy, SQLite y age.
#    · Crea tu usuario (entra solo con tu clave SSH y usa sudo con
#      contraseña), el usuario de la tienda (sin acceso) y el de
#      despliegue (su clave solo puede publicar versiones).
#    · SSH: sin contraseñas, sin root, solo esos dos usuarios.
#    · Cortafuegos (solo 22, 80 y 443), fail2ban y actualizaciones de
#      seguridad automáticas, con reinicio a las 04:30 si hace falta.
#    · La tienda como servicio aislado, Caddy con HTTPS automático y una
#      copia cifrada de la base de datos cada noche.
#
#  Se puede volver a lanzar: lo hecho se deja como está y la configuración
#  de la tienda (/etc/floresloli/entorno) nunca se pisa.
# =====================================================================
set -Eeuo pipefail
umask 022

CARPETA=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
paso() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
aviso() { printf '\033[33m!! %s\033[0m\n' "$*"; }
morir() { printf '\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }
trap 'morir "ha fallado la línea $LINENO: $BASH_COMMAND"' ERR

# Huella de la clave con la que firma Caddy sus paquetes (cloudsmith.io/~caddy/repos/stable/pub-keys)
HUELLA_CADDY=65760C51EDEA2017CEA2CA15155B6D79CA56EA34
NODE_MAYOR=24

DOMINIO='' CORREO='' USUARIO=alvaro CLAVE_SSH='' CLAVE_DESPLIEGUE='' CLAVE_COPIAS='' CON_WWW=no
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dominio) DOMINIO=${2:-}; shift 2 ;;
    --correo) CORREO=${2:-}; shift 2 ;;
    --usuario) USUARIO=${2:-}; shift 2 ;;
    --clave-ssh) CLAVE_SSH=${2:-}; shift 2 ;;
    --clave-despliegue) CLAVE_DESPLIEGUE=${2:-}; shift 2 ;;
    --clave-copias) CLAVE_COPIAS=${2:-}; shift 2 ;;
    --con-www) CON_WWW=si; shift ;;
    -h | --help) sed -n '2,32p' "$0"; exit 0 ;;
    *) morir "opción desconocida: $1 (mira --help)" ;;
  esac
done

leer_clave() { if [[ -f "$1" ]]; then head -n 1 -- "$1"; else printf '%s' "$1"; fi; }
CLAVE_SSH=$(leer_clave "$CLAVE_SSH")
CLAVE_DESPLIEGUE=$(leer_clave "$CLAVE_DESPLIEGUE")
CLAVE_COPIAS=$(leer_clave "$CLAVE_COPIAS" | tr -d '[:space:]')
DOMINIO=${DOMINIO,,}

# ---------------------------------------------------------------------
paso "Comprobaciones"
[[ $EUID -eq 0 ]] || morir "lánzalo con sudo"
# shellcheck source=/dev/null
[[ -r /etc/os-release ]] && . /etc/os-release
case "${ID:-}" in debian | ubuntu) ;; *) morir "este script es para Debian o Ubuntu" ;; esac
[[ "$DOMINIO" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$ ]] || morir "--dominio no válido (sin https:// ni barras)"
[[ "$CORREO" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || morir "--correo no válido"
[[ "$USUARIO" =~ ^[a-z][a-z0-9_-]{1,30}$ ]] || morir "--usuario no válido (minúsculas, sin espacios)"
case "$USUARIO" in root | floresloli | despliegue | caddy) morir "elige otro nombre de usuario" ;; esac
clave_ssh_valida() { [[ "$1" =~ ^(ssh-ed25519|sk-ssh-ed25519@openssh.com|ecdsa-sha2-nistp(256|384|521)|sk-ecdsa-sha2-nistp256@openssh.com|ssh-rsa)\ [A-Za-z0-9+/=]+(\ [^\"]*)?$ ]] && ssh-keygen -l -f - <<<"$1" >/dev/null 2>&1; }
clave_ssh_valida "$CLAVE_SSH" || morir "--clave-ssh no es una clave pública SSH (la de tu archivo .pub)"
clave_ssh_valida "$CLAVE_DESPLIEGUE" || morir "--clave-despliegue no es una clave pública SSH"
[[ "$(cut -d' ' -f2 <<<"$CLAVE_SSH")" != "$(cut -d' ' -f2 <<<"$CLAVE_DESPLIEGUE")" ]] || morir "la clave de despliegue tiene que ser distinta de la tuya"
[[ "$CLAVE_COPIAS" =~ ^age1[a-z0-9]{58}$ ]] || morir "--clave-copias tiene que ser una clave pública de age (empieza por age1)"
for f in floresloli.service floresloli-copia.service floresloli-copia.timer Caddyfile desplegar.sh copia.sh entorno.ejemplo; do
  [[ -f "$CARPETA/$f" ]] || morir "falta $f junto a este script (copia la carpeta servidor/sistema entera)"
done
echo "Sistema: ${PRETTY_NAME:-$ID}. Dominio: $DOMINIO$([[ $CON_WWW == si ]] && echo " y www.$DOMINIO"). Usuario: $USUARIO."

# ---------------------------------------------------------------------
paso "Sistema al día y paquetes básicos"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get -y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold full-upgrade
apt-get -y -q install ca-certificates curl gnupg ufw fail2ban python3-systemd unattended-upgrades apt-listchanges needrestart sqlite3 age sudo
timedatectl set-timezone Europe/Madrid || aviso "no se ha podido poner la hora de Madrid"

# ---------------------------------------------------------------------
paso "Node.js $NODE_MAYOR (repositorio firmado de NodeSource)"
install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
chmod 0644 /etc/apt/keyrings/nodesource.gpg
echo "Huella de la clave de NodeSource: $(gpg --show-keys --with-colons /etc/apt/keyrings/nodesource.gpg | awk -F: '$1 == "fpr" { print $10; exit }')"
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAYOR}.x nodistro main" >/etc/apt/sources.list.d/nodesource.list
cat >/etc/apt/preferences.d/nodesource <<'EOF'
Package: nodejs
Pin: origin deb.nodesource.com
Pin-Priority: 600
EOF
apt-get update -q
apt-get -y -q install nodejs
[[ "$(node -p 'process.versions.node.split(".")[0]')" == "$NODE_MAYOR" ]] || morir "no se ha instalado Node.js $NODE_MAYOR"
node -e "require('node:sqlite')" 2>/dev/null || morir "este Node.js no trae SQLite"
echo "Node.js $(node -v)"

# ---------------------------------------------------------------------
paso "Caddy (repositorio firmado oficial)"
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
gpg --show-keys --with-colons /usr/share/keyrings/caddy-stable-archive-keyring.gpg | grep -q "^fpr:*:*:*:*:*:*:*:*:$HUELLA_CADDY:" \
  || morir "la clave descargada de Caddy no es la oficial ($HUELLA_CADDY)"
chmod 0644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" >/etc/apt/sources.list.d/caddy-stable.list
apt-get update -q
apt-get -y -q install caddy
caddy version

# ---------------------------------------------------------------------
paso "Usuarios"
# Tú: entras con tu clave y administras con sudo (con contraseña)
if ! id "$USUARIO" >/dev/null 2>&1; then
  adduser --disabled-password --gecos '' "$USUARIO"
fi
usermod -aG sudo "$USUARIO"
CASA=$(getent passwd "$USUARIO" | cut -d: -f6)
install -d -m 700 -o "$USUARIO" -g "$USUARIO" "$CASA/.ssh"
touch "$CASA/.ssh/authorized_keys"
grep -qxF "$CLAVE_SSH" "$CASA/.ssh/authorized_keys" || echo "$CLAVE_SSH" >>"$CASA/.ssh/authorized_keys"
chown "$USUARIO:$USUARIO" "$CASA/.ssh/authorized_keys"
chmod 600 "$CASA/.ssh/authorized_keys"
if passwd -S "$USUARIO" | awk '{ exit !($2 == "L" || $2 == "NP") }'; then
  if [[ -t 0 ]]; then
    echo "Pon una contraseña para «$USUARIO». Solo sirve para sudo (para entrar se usa tu clave SSH). Guárdala en tu gestor de contraseñas."
    until passwd "$USUARIO"; do aviso "No ha valido: otra vez"; done
  else
    aviso "«$USUARIO» no tiene contraseña para sudo: ponla luego con «sudo passwd $USUARIO»"
  fi
fi

# La tienda: sin contraseña, sin terminal y sin casa
if ! id floresloli >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /var/lib/floresloli --no-create-home --shell /usr/sbin/nologin floresloli
fi

# Despliegue: su única clave solo puede lanzar floresloli-desplegar
if ! id despliegue >/dev/null 2>&1; then
  useradd --system --user-group --create-home --home-dir /var/lib/despliegue --shell /bin/bash despliegue
fi
passwd -l despliegue >/dev/null
install -d -m 700 -o despliegue -g despliegue /var/lib/despliegue/.ssh
printf 'restrict,command="/usr/local/sbin/floresloli-desplegar" %s\n' "$CLAVE_DESPLIEGUE" >/var/lib/despliegue/.ssh/authorized_keys
chown despliegue:despliegue /var/lib/despliegue/.ssh/authorized_keys
chmod 600 /var/lib/despliegue/.ssh/authorized_keys

SYSTEMCTL=$(command -v systemctl)
cat >/etc/sudoers.d/floresloli <<EOF
# El usuario de despliegue solo puede reiniciar la tienda.
despliegue ALL=(root) NOPASSWD: $SYSTEMCTL restart floresloli.service
EOF
chmod 440 /etc/sudoers.d/floresloli
visudo -cf /etc/sudoers.d/floresloli >/dev/null || { rm -f /etc/sudoers.d/floresloli; morir "sudoers no válido"; }

# ---------------------------------------------------------------------
paso "Carpetas, programas y configuración de la tienda"
# El bit setgid (2) hace que todo lo que publique despliegue sea del grupo floresloli: la tienda lo lee, pero no lo puede cambiar
install -d -m 2750 -o despliegue -g floresloli /srv/floresloli /srv/floresloli/versiones
install -d -m 700 -o floresloli -g floresloli /var/lib/floresloli
install -d -m 700 -o root -g root /var/backups/floresloli
install -d -m 750 -o root -g root /etc/floresloli
install -m 755 -o root -g root "$CARPETA/desplegar.sh" /usr/local/sbin/floresloli-desplegar
install -m 755 -o root -g root "$CARPETA/copia.sh" /usr/local/sbin/floresloli-copia
printf '%s\n' "$CLAVE_COPIAS" >/etc/floresloli/copia-clave-publica
chmod 644 /etc/floresloli/copia-clave-publica

CLAVE_PANEL_NUEVA=''
if [[ ! -f /etc/floresloli/entorno ]]; then
  CLAVE_PANEL_NUEVA=$(LC_ALL=C tr -dc 'A-HJ-NP-Za-km-z2-9' </dev/urandom | head -c 20 || true)
  SECRETO=$(head -c 48 /dev/urandom | base64 | tr -d '\n=+/')
  [[ ${#CLAVE_PANEL_NUEVA} -eq 20 && ${#SECRETO} -ge 40 ]] || morir "no se han podido generar las claves"
  (
    umask 077
    sed -e "s|{{DOMINIO}}|$DOMINIO|g" -e "s|{{PANEL_CLAVE}}|$CLAVE_PANEL_NUEVA|" -e "s|{{SECRETO_SESION}}|$SECRETO|" \
      "$CARPETA/entorno.ejemplo" >/etc/floresloli/entorno
  )
  chown root:root /etc/floresloli/entorno
  chmod 600 /etc/floresloli/entorno
else
  echo "La configuración /etc/floresloli/entorno ya existía: no se toca."
fi

# ---------------------------------------------------------------------
paso "Servicios (tienda y copias)"
install -m 644 "$CARPETA/floresloli.service" "$CARPETA/floresloli-copia.service" "$CARPETA/floresloli-copia.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable floresloli.service >/dev/null
systemctl enable --now floresloli-copia.timer >/dev/null
if [[ -e /srv/floresloli/actual ]]; then systemctl restart floresloli.service; fi

# ---------------------------------------------------------------------
paso "Caddy: HTTPS para $DOMINIO"
install -d -m 750 -o caddy -g caddy /var/log/caddy
CADDY_NUEVO=$(mktemp /etc/caddy/Caddyfile.XXXXXX)
sed -e "s|{{DOMINIO}}|$DOMINIO|g" -e "s|{{CORREO}}|$CORREO|g" "$CARPETA/Caddyfile" >"$CADDY_NUEVO"
if [[ $CON_WWW != si ]]; then sed -i '/^# WWW-INICIO/,/^# WWW-FIN/d' "$CADDY_NUEVO"; fi
caddy validate --adapter caddyfile --config "$CADDY_NUEVO" >/dev/null || { rm -f "$CADDY_NUEVO"; morir "el Caddyfile no es válido"; }
chmod 644 "$CADDY_NUEVO"
mv -f "$CADDY_NUEVO" /etc/caddy/Caddyfile
systemctl enable caddy >/dev/null
systemctl reload caddy 2>/dev/null || systemctl restart caddy

# ---------------------------------------------------------------------
paso "Cortafuegos: solo SSH, HTTP y HTTPS"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw limit 22/tcp comment 'SSH' >/dev/null
ufw allow 80/tcp comment 'HTTP' >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null
ufw allow 443/udp comment 'HTTP/3' >/dev/null
ufw --force enable >/dev/null
ufw status verbose

# ---------------------------------------------------------------------
paso "fail2ban: bloqueo de quien prueba claves por SSH"
cat >/etc/fail2ban/jail.d/floresloli.local <<'EOF'
[DEFAULT]
backend = systemd
banaction = ufw
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
EOF
systemctl enable fail2ban >/dev/null
systemctl restart fail2ban

# ---------------------------------------------------------------------
paso "Actualizaciones automáticas"
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat >/etc/apt/apt.conf.d/52floresloli-unattended <<'EOF'
// Tienda: además de las de seguridad del sistema, las de Node.js 24 y Caddy.
Unattended-Upgrade::Origins-Pattern {
        "site=deb.nodesource.com";
        "site=dl.cloudsmith.io";
};
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
EOF
install -d /etc/needrestart/conf.d
echo "\$nrconf{restart} = 'a';" >/etc/needrestart/conf.d/floresloli.conf
unattended-upgrade --dry-run >/dev/null 2>&1 || aviso "unattended-upgrade --dry-run ha dado un aviso: revísalo con «sudo unattended-upgrade --dry-run -v»"

# ---------------------------------------------------------------------
paso "Ajustes del sistema"
cat >/etc/sysctl.d/90-floresloli.conf <<'EOF'
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
EOF
sysctl --system >/dev/null || aviso "algún ajuste del sistema no se ha podido aplicar"
install -d /etc/systemd/journald.conf.d
cat >/etc/systemd/journald.conf.d/floresloli.conf <<'EOF'
[Journal]
SystemMaxUse=300M
MaxRetentionSec=1month
EOF
systemctl restart systemd-journald

# ---------------------------------------------------------------------
paso "SSH: solo claves, sin root, solo $USUARIO y despliegue"
[[ -s "$CASA/.ssh/authorized_keys" ]] || morir "tu clave no está en $CASA/.ssh/authorized_keys: no cierro el acceso"
cat >/etc/ssh/sshd_config.d/00-floresloli.conf <<EOF
# Tienda: este archivo va primero, así que manda sobre los demás.
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PubkeyAuthentication yes
AuthenticationMethods publickey
AllowUsers $USUARIO despliegue
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
PermitTunnel no
MaxAuthTries 3
MaxSessions 4
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
EOF
chmod 644 /etc/ssh/sshd_config.d/00-floresloli.conf
if ! sshd -t; then
  rm -f /etc/ssh/sshd_config.d/00-floresloli.conf
  morir "la configuración de SSH no es válida: no se ha cambiado nada"
fi
if systemctl is-active --quiet ssh.socket 2>/dev/null; then
  echo "SSH arranca con cada conexión (ssh.socket): las conexiones nuevas ya usan esta configuración."
else
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
fi

# ---------------------------------------------------------------------
IPS=$(hostname -I | xargs)
HUELLA=$(ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub | awk '{ print $2 }')
CLAVE_HOST=$(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)
IP4=$(hostname -I | tr ' ' '\n' | grep -m1 -E '^[0-9.]+$' || true)

paso "Hecho"
cat <<EOF

1) ANTES DE CERRAR ESTA SESIÓN, abre otra terminal y comprueba que entras:
     ssh $USUARIO@${IP4:-$DOMINIO}
   Te tiene que enseñar esta huella del servidor: $HUELLA
   Si no entras, desde ESTA sesión deshaz el cierre de SSH con:
     sudo rm /etc/ssh/sshd_config.d/00-floresloli.conf && sudo systemctl reload ssh

2) En GitHub (floresloli-web › Settings › Environments › produccion › secrets):
     SERVIDOR_HOST    ${IP4:-<IP del servidor>}
     SERVIDOR_HUELLA  ${IP4:-<IP>} $CLAVE_HOST
     SERVIDOR_CLAVE   la clave PRIVADA de despliegue (el archivo sin .pub)

3) DNS de $DOMINIO$([[ $CON_WWW == si ]] && echo " y www.$DOMINIO"): registro A a ${IP4:-la IP}$([[ -n "$(hostname -I | tr ' ' '\n' | grep ':' || true)" ]] && echo " y AAAA a la IPv6") (sin el proxy de Cloudflare).
   Caddy pedirá el certificado solo en cuanto el dominio apunte aquí.

IPs del servidor: $IPS
EOF
if [[ -n "$CLAVE_PANEL_NUEVA" ]]; then
  cat <<EOF

4) Clave del panel de pedidos (https://$DOMINIO/panel/): $CLAVE_PANEL_NUEVA
   Guárdala en tu gestor de contraseñas y dásela a Loli en persona. No vuelve a salir;
   está en /etc/floresloli/entorno (sudoedit) por si la necesitas.
EOF
fi
echo
