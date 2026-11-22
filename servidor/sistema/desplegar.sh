#!/usr/bin/env bash
# =====================================================================
#  PUBLICAR UNA VERSIÓN DE LA TIENDA  (/usr/local/sbin/floresloli-desplegar)
#
#  Lo ejecuta SSH como «comando forzado» del usuario despliegue: la clave
#  que tiene GitHub solo puede lanzar esto, sin terminal ni nada más.
#
#    publicar <commit>   recibe el paquete .tgz por la entrada estándar,
#                        lo comprueba, lo pone en marcha y, si la tienda
#                        no responde, vuelve sola a la versión anterior.
#    anterior            vuelve a la versión anterior. A mano:
#                        sudo -u despliegue floresloli-desplegar anterior
#    versiones           lista las versiones guardadas.
# =====================================================================
set -Eeuo pipefail
umask 027

RAIZ=/srv/floresloli
VERSIONES=$RAIZ/versiones
ACTUAL=$RAIZ/actual
GUARDAR=5
MAX_PAQUETE=$((200 * 1024 * 1024))
SYSTEMCTL=/usr/bin/systemctl

decir() { printf '%s\n' "$*"; logger -t floresloli-desplegar -- "$*" 2>/dev/null || true; }
morir() { decir "ERROR: $*"; exit 1; }

orden=${SSH_ORIGINAL_COMMAND:-$*}
read -r accion version sobra <<<"$orden" || true

# Un despliegue cada vez
exec 9>"$RAIZ/.cerrojo"
flock -n 9 || morir "ya hay otro despliegue en marcha"

responde() {
  local _
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 3 http://127.0.0.1:8788/api/estado 2>/dev/null | grep -q '"entorno"'; then return 0; fi
    sleep 1
  done
  return 1
}

# 9>&-: el cerrojo no pasa a otros procesos (si no, el siguiente despliegue lo vería ocupado)
reiniciar() { sudo -n "$SYSTEMCTL" restart floresloli.service 9>&-; }

cambiar_a() {
  ln -sfn "$1" "$RAIZ/actual.nuevo"
  mv -Tf "$RAIZ/actual.nuevo" "$ACTUAL"
}

# Versiones guardadas, de la más nueva a la más vieja (los nombres los pone este script: fecha-commit).
guardadas() {
  local v
  for v in "$VERSIONES"/*/; do
    if [[ -d "$v" ]]; then printf '%s\n' "${v%/}"; fi
  done | sort -r
}

# La versión publicada justo antes que la de ahora.
anterior_de() {
  local actual=$1 v visto=no
  for v in $(guardadas); do
    if [[ $visto == si ]]; then printf '%s' "$v"; return 0; fi
    [[ "$v" == "$actual" ]] && visto=si
  done
  return 1
}

case "${accion:-}" in
  publicar)
    [[ "${version:-}" =~ ^[0-9a-f]{7,40}$ && -z "${sobra:-}" ]] || morir "uso: publicar <commit>"
    destino="$VERSIONES/$(date -u +%Y%m%dT%H%M%SZ)-${version:0:12}"
    paquete=$(mktemp "$RAIZ/.paquete.XXXXXX")
    trap 'rm -f "$paquete"' EXIT

    head -c $((MAX_PAQUETE + 1)) >"$paquete"
    [[ $(stat -c %s "$paquete") -le $MAX_PAQUETE ]] || morir "paquete demasiado grande"
    [[ -s "$paquete" ]] || morir "paquete vacío"

    # Solo carpetas y archivos normales, dentro de la carpeta: nada de enlaces, rutas absolutas ni «..».
    # (La lista se lee entera primero: con «tar | grep -q» y pipefail, un fallo podría colarse.)
    lista=$(tar -tzf "$paquete") || morir "el paquete no se puede leer"
    raros=$(tar -tvzf "$paquete" | awk '{ t = substr($1, 1, 1); if (t != "-" && t != "d") print }') || morir "el paquete no se puede leer"
    [[ -z "$raros" ]] || morir "el paquete trae tipos de archivo no permitidos"
    if grep -qE '(^/|(^|/)\.\.(/|$))' <<<"$lista"; then morir "el paquete trae rutas no permitidas"; fi
    for imprescindible in dist/index.html servidor/servidor.ts functions/api/_middleware.ts package.json; do
      grep -qxF -e "$imprescindible" -e "./$imprescindible" <<<"$lista" || morir "al paquete le falta $imprescindible"
    done

    mkdir -p "$destino"
    tar -xzf "$paquete" -C "$destino" --no-same-owner --no-same-permissions
    chmod -R u=rwX,g=rX,o= "$destino"

    previa=$(readlink -f "$ACTUAL" 2>/dev/null || true)
    cambiar_a "$destino"
    reiniciar || true
    if responde; then
      decir "Publicada la versión ${version:0:12} ($destino)"
    else
      if [[ -n "$previa" && -d "$previa" && "$previa" != "$destino" ]]; then
        decir "La versión ${version:0:12} no responde: vuelvo a la anterior"
        cambiar_a "$previa"
        reiniciar || true
        if responde; then decir "De vuelta en $previa"; else decir "La anterior tampoco responde: hay que mirarlo (journalctl -u floresloli)"; fi
        rm -rf -- "$destino"
      else
        decir "La versión ${version:0:12} no responde y no hay otra a la que volver: mira journalctl -u floresloli"
      fi
      exit 1
    fi

    # Se guardan las últimas versiones para poder volver atrás
    actual=$(readlink -f "$ACTUAL")
    guardadas | tail -n +$((GUARDAR + 1)) | while read -r v; do
      if [[ "$v" != "$actual" && "$v" != "$previa" ]]; then rm -rf -- "$v"; fi
    done
    ;;

  anterior)
    actual=$(readlink -f "$ACTUAL" 2>/dev/null || true)
    previa=$(anterior_de "$actual") || morir "no hay versión anterior guardada"
    cambiar_a "$previa"
    reiniciar
    responde || morir "la versión anterior no responde (journalctl -u floresloli)"
    decir "Vuelta a $previa"
    ;;

  versiones)
    actual=$(readlink -f "$ACTUAL" 2>/dev/null || true)
    for v in $(guardadas); do
      if [[ "$v" == "$actual" ]]; then printf '* %s (la de ahora)\n' "$(basename "$v")"; else printf '  %s\n' "$(basename "$v")"; fi
    done
    ;;

  *)
    morir "orden no admitida"
    ;;
esac
